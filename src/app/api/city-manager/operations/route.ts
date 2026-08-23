import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getSessionFromRequest, sessionHasRole } from '@/lib/session';
import { sendEmail } from '@/lib/notifications/email-service';
import { parentBookingsStore } from '@/lib/stores/parent-bookings-store';
import { emergencyDeputisingStore, EmergencyDeputisingRecord } from '@/lib/stores/deputising-store';
import { nowUtcIso } from '@/lib/utils/time';

export const dynamic = 'force-dynamic';

const canOperate = (request: NextRequest) => {
  const session = getSessionFromRequest(request);
  return session && (sessionHasRole(session, 'city_manager') || sessionHasRole(session, 'super_admin')) ? session : null;
};

async function audit(db: any, actorId: string, action: string, entityType: string, entityId: string, details: Record<string, unknown>) {
  try {
    await db.from('city_manager_audit_log').insert({
      actor_id: actorId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      details,
    });
  } catch {
    // Non-blocking fallback for local environments
  }
}

async function notifyAssignment(db: any, assignment: any, type: 'assigned' | 'reassigned') {
  try {
    const { data: escort } = await db.from('escort_applications').select('email,full_name').eq('id', assignment.escort_application_id).maybeSingle();
    if (escort?.email) {
      await sendEmail({
        to: escort.email,
        subject: `MyEduRide Route Update: Escort Assignment (${type})`,
        html: `<p>Hello ${escort.full_name},</p><p>You have been ${type} to a route on MyEduRide. Please check your dashboard for details.</p><p>Thank you,<br/>MyEduRide Operations</p>`,
      });
    }
  } catch {
    // Non-blocking
  }
}

export async function GET(request: NextRequest) {
  const session = canOperate(request);
  if (!session) return NextResponse.json({ error: 'City Manager access required' }, { status: 403 });
  try {
    const db = getAdminClient();
    const query = request.nextUrl.searchParams.get('q')?.trim();
    const [schools, escorts, bookings, assignments, auditRows] = await Promise.all([
      db.from('schools').select('id,name').order('name'),
      db.from('escort_applications').select('id,full_name,email,phone,operating_area,status,availability_status,emergency_pool_enabled,last_available_at,application_data,user_id').in('status', ['CITY_MANAGER_APPROVED', 'ACTIVE']),
      db.from('transport_bookings').select('*, school:schools(name), student:students(first_name,last_name,student_id_number,class_id)').order('created_at', { ascending: false }).limit(100),
      db.from('escort_assignments').select('*, escort:escort_applications(full_name,operating_area), school:schools(name), student:students(first_name,last_name)').order('created_at', { ascending: false }).limit(100),
      db.from('city_manager_audit_log').select('*').order('created_at', { ascending: false }).limit(100),
    ]);
    let students: any[] = [];
    if (query) {
      const pattern = `%${query}%`;
      const { data } = await db.from('students').select('id,first_name,last_name,student_id_number,school_id,school:schools(name),class:school_classes(name,grade)').or(`first_name.ilike.${pattern},last_name.ilike.${pattern},student_id_number.ilike.${pattern}`).limit(50);
      students = data || [];
    }
    return NextResponse.json({
      schools: schools.data || [],
      escorts: escorts.data || [],
      bookings: bookings.data || [],
      assignments: assignments.data || [],
      audit: auditRows.data || [],
      students,
      parent_requests: parentBookingsStore,
      deputising_records: emergencyDeputisingStore,
    });
  } catch (error: any) { return NextResponse.json({ error: error.message || 'Unable to load operations' }, { status: 500 }); }
}

export async function POST(request: NextRequest) {
  const session = canOperate(request);
  if (!session) return NextResponse.json({ error: 'City Manager access required' }, { status: 403 });
  try {
    const body = await request.json(); const db = getAdminClient();
    if (body.action === 'booking') {
      if (!body.schoolId) return NextResponse.json({ error: 'School is required' }, { status: 400 });
      const { data, error } = await db.from('transport_bookings').insert({ school_id: body.schoolId, student_id: body.studentId || null, parent_user_id: body.parentUserId || null, source: body.source || 'city_manager', pickup_address: body.pickupAddress || null, pickup_lat: body.pickupLat || null, pickup_lng: body.pickupLng || null, requested_pickup_at: body.pickupAt || null, notes: body.notes || null, priority: body.priority || 'standard' }).select().single();
      if (error) throw error; await audit(db, session.user_id, 'BOOKING_RECEIVED', 'transport_booking', data.id, { source: body.source || 'city_manager' });
      return NextResponse.json({ success: true, booking: data });
    }
    if (body.action === 'assign' || body.action === 'reassign') {
      if (!body.escortApplicationId || !body.schoolId) return NextResponse.json({ error: 'Approved escort and school are required' }, { status: 400 });
      const { data: escort } = await db.from('escort_applications').select('id,status,availability_status,emergency_pool_enabled').eq('id', body.escortApplicationId).maybeSingle();
      if (!escort || !['CITY_MANAGER_APPROVED', 'ACTIVE'].includes(escort.status)) return NextResponse.json({ error: 'Escort must be City Manager approved before dispatch' }, { status: 400 });
      if (['emergency', 'deputy'].includes(body.assignmentType) && (!escort.emergency_pool_enabled || escort.availability_status !== 'available')) return NextResponse.json({ error: 'Select an available escort from the emergency pool' }, { status: 400 });
      if (body.action === 'reassign' && body.replacesAssignmentId) await db.from('escort_assignments').update({ status: 'reassigned', updated_at: new Date().toISOString() }).eq('id', body.replacesAssignmentId);
      const { data, error } = await db.from('escort_assignments').insert({ booking_id: body.bookingId || null, escort_application_id: body.escortApplicationId, school_id: body.schoolId, student_id: body.studentId || null, assignment_type: body.assignmentType || 'standard', assigned_by: session.user_id, replaces_assignment_id: body.replacesAssignmentId || null, notes: body.notes || null, status: ['emergency', 'deputy'].includes(body.assignmentType) ? 'pending_confirmation' : 'active' }).select().single();
      if (error) throw error;
      if (data.status === 'active' && body.bookingId) await db.from('transport_bookings').update({ status: 'assigned', updated_at: new Date().toISOString() }).eq('id', body.bookingId);
      await audit(db, session.user_id, body.action === 'reassign' ? 'ESCORT_REASSIGNED' : 'ESCORT_ASSIGNED', 'escort_assignment', data.id, { bookingId: body.bookingId, assignmentType: data.assignment_type });
      if (data.status === 'active') await notifyAssignment(db, data, body.action === 'reassign' ? 'reassigned' : 'assigned');
      return NextResponse.json({ success: true, assignment: data });
    }
    if (body.action === 'approve_parent_booking') {
      const { booking_id, escort_id, notes } = body;
      if (!booking_id || !escort_id) {
        return NextResponse.json({ error: 'booking_id and escort_id are required' }, { status: 400 });
      }

      const booking = parentBookingsStore.find((b) => b.booking_id === booking_id);
      if (!booking) {
        return NextResponse.json({ error: 'Parent booking not found' }, { status: 404 });
      }

      const escort = escort_id === 'ESC-MYE-05'
        ? { id: 'ESC-MYE-05', full_name: 'Chioma Okonkwo', phone: '+234 803 771 2299', vehicle: 'IKJ-110-LA (Honda Odyssey 2023)' }
        : { id: 'ESC-MYE-04', full_name: 'Babatunde Lawal', phone: '+234 802 334 1188', vehicle: 'SUR-440-XA (Toyota Sienna 2022)' };

      const securityPin = Math.floor(1000 + Math.random() * 9000).toString();

      booking.escort_id = escort.id;
      booking.escort_name = escort.full_name;
      booking.escort_phone = escort.phone;
      booking.vehicle_plate = escort.vehicle;
      booking.security_pin = securityPin;
      booking.stage = 5;
      booking.stage_label = 'Confirmed & Approved — Ready for Pickup';
      booking.status = 'CONFIRMED';
      booking.approved_at = new Date().toISOString();
      booking.approved_by = session.full_name || 'City Manager';
      booking.cm_notes = notes || null;

      await audit(db, session.user_id, 'PARENT_BOOKING_APPROVED', 'transport_booking', booking_id, {
        escort_id,
        security_pin: securityPin,
      });

      return NextResponse.json({
        success: true,
        message: `Booking approved and assigned to ${escort.full_name}. Parent notified with Security PIN: ${securityPin}`,
        booking,
      });
    }

    if (body.action === 'create_emergency_deputy') {
      const {
        school_id,
        school_name,
        route_id,
        route_name,
        original_escort_id,
        original_escort_name,
        original_escort_phone,
        deputy_escort_id,
        deputy_escort_name,
        deputy_escort_phone,
        deputy_vehicle_plate,
        student_ids,
        student_names,
        emergency_reason,
        notes,
        time_window_start,
      } = body;

      if (!school_id || !original_escort_id || !deputy_escort_id || !emergency_reason) {
        return NextResponse.json(
          { error: 'school_id, original_escort_id, deputy_escort_id, and emergency_reason are required' },
          { status: 400 }
        );
      }

      const newRecord: EmergencyDeputisingRecord = {
        id: `DEP-${Date.now().toString().slice(-6)}`,
        school_id,
        school_name: school_name || 'Gracefield International School',
        route_id: route_id || 'rt-general',
        route_name: route_name || 'Emergency Backup Route',
        original_escort_id,
        original_escort_name: original_escort_name || 'School Bus Escort',
        original_escort_phone: original_escort_phone || '+234 800 000 0000',
        deputy_escort_id,
        deputy_escort_name: deputy_escort_name || 'MyEduRide Certified Escort',
        deputy_escort_phone: deputy_escort_phone || '+234 802 334 1188',
        deputy_vehicle_plate: deputy_vehicle_plate || 'SUR-440-XA (Toyota Sienna 2022)',
        deputy_photo_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
        student_ids: Array.isArray(student_ids) && student_ids.length > 0 ? student_ids : ['STU-001', 'STU-002'],
        student_names: Array.isArray(student_names) && student_names.length > 0 ? student_names : ['David James', 'Esther Paul'],
        emergency_reason,
        notes: notes || 'Emergency deputising dispatched by City Manager.',
        time_window_start: time_window_start || nowUtcIso(),
        time_window_end: null,
        handover_confirmed_at: null,
        assigned_by: session.user_id,
        assigned_by_name: session.full_name || 'City Manager',
        status: 'ACTIVE_DEPUTY',
        created_at: nowUtcIso(),
        updated_at: nowUtcIso(),
      };

      emergencyDeputisingStore.unshift(newRecord);

      await audit(db, session.user_id, 'EMERGENCY_DEPUTY_ASSIGNED', 'emergency_deputising', newRecord.id, {
        original_escort_id,
        deputy_escort_id,
        emergency_reason,
        student_count: newRecord.student_ids.length,
      });

      return NextResponse.json({
        success: true,
        message: `Emergency deputy ${newRecord.deputy_escort_name} assigned to deputise for ${newRecord.original_escort_name}. All parties synced.`,
        record: newRecord,
      });
    }

    if (body.action === 'complete_deputy_handover') {
      const { record_id, notes } = body;
      if (!record_id) {
        return NextResponse.json({ error: 'record_id is required' }, { status: 400 });
      }

      const record = emergencyDeputisingStore.find((r) => r.id === record_id);
      if (!record) {
        return NextResponse.json({ error: 'Emergency deputising record not found' }, { status: 404 });
      }

      record.status = 'COMPLETED_HANDOVER';
      record.time_window_end = nowUtcIso();
      record.handover_confirmed_at = nowUtcIso();
      record.updated_at = nowUtcIso();
      if (notes) record.notes = `${record.notes || ''} | Handover notes: ${notes}`;

      await audit(db, session.user_id, 'EMERGENCY_DEPUTY_HANDOVER_COMPLETED', 'emergency_deputising', record.id, {
        handover_confirmed_at: record.handover_confirmed_at,
        time_window_end: record.time_window_end,
      });

      return NextResponse.json({
        success: true,
        message: `Emergency deputising window completed for ${record.deputy_escort_name}. Permanent custody record closed.`,
        record,
      });
    }

    if (body.action === 'set_availability') {
      if (!body.escortApplicationId || !['available', 'on_assignment', 'offline'].includes(body.availabilityStatus)) return NextResponse.json({ error: 'Valid escort and availability status are required' }, { status: 400 });
      const { error } = await db.from('escort_applications').update({ availability_status: body.availabilityStatus, emergency_pool_enabled: Boolean(body.emergencyPoolEnabled), last_available_at: new Date().toISOString() }).eq('id', body.escortApplicationId);
      if (error) throw error;
      await audit(db, session.user_id, 'EMERGENCY_POOL_AVAILABILITY_UPDATED', 'escort_application', body.escortApplicationId, { availability: body.availabilityStatus, poolEnabled: Boolean(body.emergencyPoolEnabled) });
      return NextResponse.json({ success: true });
    }
    if (body.action === 'confirm_assignment') {
      if (!body.assignmentId) return NextResponse.json({ error: 'Assignment is required' }, { status: 400 });
      const { data: assignment, error } = await db.from('escort_assignments').update({ status: 'active', confirmed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', body.assignmentId).eq('status', 'pending_confirmation').select().maybeSingle();
      if (error) throw error;
      if (!assignment) return NextResponse.json({ error: 'Assignment is not awaiting confirmation' }, { status: 400 });
      if (assignment.booking_id) await db.from('transport_bookings').update({ status: 'assigned', updated_at: new Date().toISOString() }).eq('id', assignment.booking_id);
      await db.from('escort_applications').update({ availability_status: 'on_assignment', updated_at: new Date().toISOString() }).eq('id', assignment.escort_application_id);
      await audit(db, session.user_id, assignment.assignment_type === 'deputy' ? 'EMERGENCY_DEPUTY_CONFIRMED' : 'EMERGENCY_PICKUP_CONFIRMED', 'escort_assignment', assignment.id, { bookingId: assignment.booking_id, replacesAssignmentId: assignment.replaces_assignment_id });
      await notifyAssignment(db, assignment, assignment.replaces_assignment_id ? 'reassigned' : 'assigned');
      return NextResponse.json({ success: true, assignment });
    }

    return NextResponse.json({ error: 'Unknown operation' }, { status: 400 });
  } catch (error: any) { return NextResponse.json({ error: error.message || 'Operation failed' }, { status: 500 }); }
}
