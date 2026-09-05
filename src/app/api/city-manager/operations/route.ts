import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getSessionFromRequest, sessionHasRole } from '@/lib/session';
import { sendEmail } from '@/lib/notifications/email-service';
import { nowUtcIso } from '@/lib/utils/time';

export const dynamic = 'force-dynamic';

const canOperate = (request: NextRequest) => {
  const session = getSessionFromRequest(request);
  if (!session) {
    if (process.env.NODE_ENV === 'development') {
      return {
        user_id: 'dev-city-manager',
        username: 'city_manager',
        email: 'citymanager@myeduride.com',
        full_name: 'City Operations Manager',
        roles: [{ role: 'city_manager', school_id: 'all' }],
      };
    }
    return null;
  }
  if (
    sessionHasRole(session, 'city_manager') ||
    sessionHasRole(session, 'super_admin') ||
    sessionHasRole(session, 'school_admin') ||
    process.env.NODE_ENV === 'development'
  ) {
    return session;
  }
  return null;
};

async function audit(db: any, actorId: string, action: string, entityType: string, entityId: string, details: Record<string, unknown>) {
  try {
    await db.from('city_manager_audit_log').insert({
      actor_user_id: actorId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      details,
    });
  } catch {
    // Non-blocking fallback
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
    const [schoolsRes, escortsRes, bookingsRes, assignmentsRes, auditRes, deputisingRes, vehiclesRes, routesRes, walkHomeRes] = await Promise.all([
      db.from('schools').select('id,name').order('name').then((r: any) => r.data || [], () => []),
      db.from('escort_applications').select('id,full_name,email,phone,operating_area,status,availability_status,emergency_pool_enabled,last_available_at,application_data,user_id').in('status', ['CITY_MANAGER_APPROVED', 'ACTIVE']).then((r: any) => r.data || [], () => []),
      db.from('transport_bookings').select('*, school:schools(name), student:students(first_name,last_name,student_id_number,class_id)').order('created_at', { ascending: false }).limit(100).then((r: any) => r.data || [], () => []),
      db.from('escort_assignments').select('*, escort:escort_applications(id,full_name,phone,operating_area,status), school:schools(id,name), student:students(id,first_name,last_name,student_id_number,photo_url,class:school_classes(name))').order('created_at', { ascending: false }).limit(100).then((r: any) => r.data || [], () => []),
      db.from('city_manager_audit_log').select('*').order('created_at', { ascending: false }).limit(100).then((r: any) => r.data || [], () => []),
      db.from('emergency_deputising').select('*').order('created_at', { ascending: false }).limit(100).then((r: any) => r.data || [], () => []),
      db.from('school_vehicles').select('*').order('created_at', { ascending: false }).limit(100).then((r: any) => r.data || [], () => []),
      db.from('transport_routes').select('id, name, code, assigned_vehicle_id, assigned_escort_id').order('created_at', { ascending: false }).limit(100).then((r: any) => r.data || [], () => []),
      db.from('attendance_records').select('id, student_id, school_id, timestamp, verification_method, student:students(first_name, last_name, student_id_number, photo_url, class:school_classes(name)), school:schools(name)').eq('type', 'departure').ilike('verification_method', '%walk_home%').order('timestamp', { ascending: false }).limit(50).then((r: any) => r.data || [], () => []),
    ]);

    let students: any[] = [];
    if (query) {
      const pattern = `%${query}%`;
      const { data } = await db.from('students').select('id,first_name,last_name,student_id_number,school_id,school:schools(name),class:school_classes(name,grade)').or(`first_name.ilike.${pattern},last_name.ilike.${pattern},student_id_number.ilike.${pattern}`).limit(50);
      students = data || [];
    }

    // Format parent requests from database bookings
    const rawBookings = bookingsRes;
    const parentRequests = rawBookings.map((b: any) => {
      const stu = Array.isArray(b.student) ? b.student[0] : b.student;
      const sch = Array.isArray(b.school) ? b.school[0] : b.school;
      return {
        booking_id: b.id,
        child_id: b.student_id,
        child_name: stu ? `${stu.first_name} ${stu.last_name}` : 'Student',
        parent_user_id: b.parent_user_id,
        parent_name: 'Parent User',
        parent_phone: '+234 800 000 0000',
        school_id: b.school_id,
        school_name: sch?.name || 'School Campus',
        preferred_escort_id: null,
        escort_id: null,
        escort_name: b.status === 'assigned' ? 'Assigned Escort' : 'Awaiting City Manager Assignment',
        escort_phone: null,
        vehicle_plate: null,
        operating_area: 'Lagos Metropolis',
        pickup_date: b.requested_pickup_at ? b.requested_pickup_at.split('T')[0] : 'Today',
        pickup_time: b.requested_pickup_at ? b.requested_pickup_at.split('T')[1]?.slice(0, 5) : '07:00',
        pickup_location: b.pickup_address || 'Designated Stop',
        reason: b.notes || 'School Escort Unavailable',
        security_pin: null,
        stage: b.status === 'completed' ? 5 : b.status === 'in_progress' ? 4 : b.status === 'assigned' ? 3 : 2,
        stage_label: b.status === 'assigned' ? 'Escort Assigned & Dispatched' : 'Under City Manager Review',
        status: b.status === 'pending' ? 'PENDING_CM_REVIEW' : b.status.toUpperCase(),
        created_at: b.created_at,
      };
    });

    const schoolsList = schoolsRes;
    const routesList = routesRes;

    const { loadFileStore } = await import('@/lib/escort/escort-db');
    const fileStore = loadFileStore();
    const escortsList = [...escortsRes];
    const seenEscortIds = new Set(escortsList.map((e: any) => e.id));
    for (const fe of fileStore) {
      if (!seenEscortIds.has(fe.id)) {
        seenEscortIds.add(fe.id);
        const anyFe = fe as any;
        escortsList.push({
          id: fe.id,
          full_name: anyFe.full_name || fe.fullName || anyFe.name,
          phone: fe.phone,
          operating_area: fe.operatingArea || anyFe.operating_area || anyFe.service_city || anyFe.school_name,
          status: fe.status || 'ACTIVE',
          availability_status: anyFe.availability_status || 'available',
        });
      }
    }

    const { loadVehicleFileStore } = await import('@/lib/vehicle/vehicle-db');
    const fileVehicles = loadVehicleFileStore();

    const dbVehiclesList = vehiclesRes;
    const combinedVehicles = [...dbVehiclesList];
    const seenVehicleIds = new Set(combinedVehicles.map((v: any) => v.id));
    const seenPlates = new Set(combinedVehicles.map((v: any) => (v.reg_number || '').toUpperCase()));

    for (const fv of fileVehicles) {
      if (!seenVehicleIds.has(fv.id) && (!fv.reg_number || !seenPlates.has(fv.reg_number.toUpperCase()))) {
        seenVehicleIds.add(fv.id);
        if (fv.reg_number) seenPlates.add(fv.reg_number.toUpperCase());
        combinedVehicles.push(fv);
      }
    }

    const rawVehicles = combinedVehicles.map((v: any) => {
      const sch = schoolsList.find((s: any) => s.id === v.school_id);
      const matchedRoute = routesList.find((r: any) => r.assigned_vehicle_id === v.id || r.id === v.assigned_route_id);
      const matchedEscort = escortsList.find((e: any) => e.id === v.assigned_escort_id || e.id === matchedRoute?.assigned_escort_id);

      return {
        id: v.id,
        regNumber: v.reg_number,
        plateNumber: v.reg_number,
        make: v.make,
        model: `${v.make} ${v.model}`.trim(),
        type: v.type || 'School Bus',
        capacity: v.capacity || 18,
        school_id: v.school_id,
        schoolName: sch?.name || v.school_name || 'Myeduride Academy School',
        escortName: v.assigned_escort_name || matchedEscort?.full_name || matchedRoute?.assigned_escort_name || v.assigned_driver_name || (v.assigned_escort_id ? 'School Escort' : 'Unassigned Escort'),
        escortPhone: v.assigned_escort_phone || matchedEscort?.phone || matchedRoute?.assigned_escort_phone || v.assigned_driver_phone || '',
        escortId: v.assigned_escort_id || matchedRoute?.assigned_escort_id || null,
        routeName: v.assigned_route_name || (matchedRoute ? `${matchedRoute.name} (${matchedRoute.code})` : 'Unassigned Route'),
        routeId: v.assigned_route_id || matchedRoute?.id || null,
        driverName: v.assigned_driver_name || matchedEscort?.full_name || 'Unassigned Driver',
        driverPhone: v.assigned_driver_phone || matchedEscort?.phone || '',
        photoUrl: v.photo_url || v.vehicle_photos?.front || null,
        vehiclePhotos: v.vehicle_photos || null,
        roadworthinessExpiry: v.roadworthiness_expiry || '2027-01-01',
        insuranceStatus: v.insurance_status || 'Active (Verified)',
        status: v.status ? v.status.toUpperCase() : 'ACTIVE',
        speed: '0 km/h',
        fuel: '85%',
        created_at: v.created_at,
      };
    });

    const pendingCorrections = fileStore.filter(
      (a: any) => a.status === 'CORRECTION_PENDING' || !!a.proposed_correction
    );

    const formattedAssignments = (assignmentsRes || []).map((a: any) => {
      const student = Array.isArray(a.student) ? a.student[0] : a.student;
      const school = Array.isArray(a.school) ? a.school[0] : a.school;
      const escort = Array.isArray(a.escort) ? a.escort[0] : a.escort;
      const stClass = Array.isArray(student?.class) ? student.class[0] : student?.class;
      const className = typeof stClass === 'object' && stClass !== null ? (stClass.name || 'Class N/A') : (stClass || 'Class N/A');

      return {
        ...a,
        school_id: a.school_id || school?.id,
        school_name: school?.name || 'Assigned School',
        student: student ? {
          ...student,
          class: className,
          class_name: className,
        } : null,
        school: school ? {
          id: school.id,
          name: school.name,
        } : null,
        escort: escort ? {
          id: escort.id,
          full_name: escort.full_name,
          phone: escort.phone,
          vehicle_plate: escort.vehicle_plate,
        } : null,
      };
    });

    const formattedWalkHomeRecords = (walkHomeRes || []).map((w: any) => {
      const student = Array.isArray(w.student) ? w.student[0] : w.student;
      const school = Array.isArray(w.school) ? w.school[0] : w.school;
      const stClass = Array.isArray(student?.class) ? student.class[0] : student?.class;
      const className = typeof stClass === 'object' && stClass !== null ? (stClass.name || 'Class N/A') : (stClass || 'Class N/A');

      return {
        id: w.id,
        student_id: w.student_id,
        student_name: student ? `${student.first_name || ''} ${student.last_name || ''}`.trim() : 'Student',
        student_number: student?.student_id_number || 'N/A',
        student_class: className,
        school_id: w.school_id,
        school_name: school?.name || 'Assigned School',
        scanned_at: w.timestamp,
        verification_method: w.verification_method,
        status: 'Walk Home Recorded',
        notes: 'Verified Pedestrian Gate Departure',
      };
    });

    return NextResponse.json({
      schools: schoolsRes,
      escorts: escortsList,
      vehicles: rawVehicles,
      bookings: rawBookings,
      parent_requests: parentRequests,
      assignments: formattedAssignments,
      walk_home_records: formattedWalkHomeRecords,
      audit: auditRes,
      audit_logs: auditRes,
      students,
      pending_corrections: pendingCorrections,
      deputising_records: deputisingRes,
      emergency_deputising: deputisingRes,
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
      const { data: escort } = await db.from('escort_applications').select('id,status,availability_status,emergency_pool_enabled,full_name,phone').eq('id', body.escortApplicationId).maybeSingle();
      if (!escort || !['CITY_MANAGER_APPROVED', 'ACTIVE'].includes(escort.status)) return NextResponse.json({ error: 'Escort must be City Manager approved before dispatch' }, { status: 400 });
      if (['emergency', 'deputy'].includes(body.assignmentType) && (!escort.emergency_pool_enabled || escort.availability_status !== 'available')) return NextResponse.json({ error: 'Select an available escort from the emergency pool' }, { status: 400 });
      if (body.action === 'reassign' && body.replacesAssignmentId) {
        await db.from('escort_assignments').update({ status: 'reassigned', updated_at: new Date().toISOString() }).eq('id', body.replacesAssignmentId);
      }
      const { data, error } = await db.from('escort_assignments').insert({
        booking_id: body.bookingId || null,
        escort_application_id: body.escortApplicationId,
        school_id: body.schoolId,
        student_id: body.studentId || null,
        assignment_type: body.assignmentType || 'standard',
        assigned_by: session.user_id,
        replaces_assignment_id: body.replacesAssignmentId || null,
        notes: body.notes || (body.action === 'reassign' ? `Reassigned by City Manager to ${escort.full_name}` : null),
        status: ['emergency', 'deputy'].includes(body.assignmentType) ? 'pending_confirmation' : 'active'
      }).select().single();
      if (error) throw error;
      if (data.status === 'active' && body.bookingId) await db.from('transport_bookings').update({ status: 'assigned', updated_at: new Date().toISOString() }).eq('id', body.bookingId);
      
      // Also synchronize with dismissal_requests so School Admin pickup list reflects the reassigned escort immediately
      if (body.studentId && body.schoolId) {
        try {
          const today = new Date().toISOString().split('T')[0];
          await db.from('dismissal_requests').update({
            pickup_person_name: escort.full_name,
            pickup_person_phone: escort.phone || null,
            notes: `Reassigned by City Manager to ${escort.full_name}`,
          }).eq('student_id', body.studentId).eq('school_id', body.schoolId).eq('dismissal_date', today);
        } catch (syncErr) {
          console.warn('[operations reassign dismissal_requests sync notice]:', syncErr);
        }
      }

      await audit(db, session.user_id, body.action === 'reassign' ? 'ESCORT_REASSIGNED' : 'ESCORT_ASSIGNED', 'escort_assignment', data.id, { bookingId: body.bookingId, studentId: body.studentId, assignmentType: data.assignment_type });
      if (data.status === 'active') await notifyAssignment(db, data, body.action === 'reassign' ? 'reassigned' : 'assigned');
      return NextResponse.json({ success: true, assignment: data });
    }
    if (body.action === 'approve_parent_booking') {
      const { booking_id, escort_id, notes } = body;
      if (!booking_id || !escort_id) {
        return NextResponse.json({ error: 'booking_id and escort_id are required' }, { status: 400 });
      }

      const { data: escort } = await db
        .from('escort_applications')
        .select('id, full_name, phone, application_data')
        .eq('id', escort_id)
        .maybeSingle();

      const escortName = escort?.full_name || 'Assigned Escort';
      const securityPin = Math.floor(1000 + Math.random() * 9000).toString();

      const { data: updatedBooking, error: updateErr } = await db
        .from('transport_bookings')
        .update({
          status: 'assigned',
          notes: notes ? `CM Notes: ${notes} | PIN: ${securityPin}` : `PIN: ${securityPin}`,
          updated_at: nowUtcIso(),
        })
        .eq('id', booking_id)
        .select()
        .single();

      if (updateErr) throw updateErr;

      // Insert active record into escort_assignments table for live Escort Dashboard tracking
      const { data: newAssignment } = await db
        .from('escort_assignments')
        .insert({
          booking_id: booking_id,
          escort_application_id: escort_id,
          school_id: updatedBooking?.school_id || null,
          student_id: updatedBooking?.student_id || null,
          assignment_type: 'standard',
          assigned_by: session.user_id,
          notes: notes || 'Assigned & Approved by City Manager',
          status: 'active',
          created_at: nowUtcIso(),
          updated_at: nowUtcIso(),
        })
        .select()
        .maybeSingle();

      if (newAssignment) {
        try {
          await notifyAssignment(db, newAssignment, 'assigned');
        } catch (e) {
          console.warn('[city-manager operations] notifyAssignment warning:', e);
        }
      }

      await audit(db, session.user_id, 'PARENT_BOOKING_APPROVED', 'transport_booking', booking_id, {
        escort_id,
        security_pin: securityPin,
      });

      return NextResponse.json({
        success: true,
        message: `Booking approved and assigned to ${escortName}. Parent notified with Security PIN: ${securityPin}`,
        booking: updatedBooking,
        assignment: newAssignment,
      });
    }

    if (body.action === 'create_emergency_deputy') {
      const {
        school_id,
        route_id,
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

      if (!school_id || !emergency_reason || !deputy_escort_name) {
        return NextResponse.json(
          { error: 'school_id, deputy_escort_name, and emergency_reason are required' },
          { status: 400 }
        );
      }

      const { data: newRecord, error: insertErr } = await db
        .from('emergency_deputising')
        .insert({
          school_id,
          route_id: route_id || null,
          original_escort_id: original_escort_id || null,
          original_escort_name: original_escort_name || 'School Escort',
          original_escort_phone: original_escort_phone || '',
          deputy_escort_id: deputy_escort_id || null,
          deputy_escort_name,
          deputy_escort_phone: deputy_escort_phone || '',
          deputy_vehicle_plate: deputy_vehicle_plate || 'Standard Fleet Plate',
          student_ids: Array.isArray(student_ids) ? student_ids : [],
          student_names: Array.isArray(student_names) ? student_names : [],
          emergency_reason,
          notes: notes || 'Emergency deputising dispatched by City Manager.',
          time_window_start: time_window_start || nowUtcIso(),
          assigned_by: session.user_id,
          assigned_by_name: session.full_name || 'City Manager',
          status: 'ACTIVE_DEPUTY',
        })
        .select()
        .single();

      if (insertErr) throw insertErr;

      await audit(db, session.user_id, 'EMERGENCY_DEPUTY_ASSIGNED', 'emergency_deputising', newRecord.id, {
        original_escort_id,
        deputy_escort_name,
        emergency_reason,
      });

      return NextResponse.json({
        success: true,
        message: `Emergency deputy ${newRecord.deputy_escort_name} assigned. Custody record registered in database.`,
        record: newRecord,
      });
    }

    if (body.action === 'complete_deputy_handover') {
      const { record_id, notes } = body;
      if (!record_id) {
        return NextResponse.json({ error: 'record_id is required' }, { status: 400 });
      }

      const { data: record, error: updateErr } = await db
        .from('emergency_deputising')
        .update({
          status: 'COMPLETED_HANDOVER',
          time_window_end: nowUtcIso(),
          handover_confirmed_at: nowUtcIso(),
          notes: notes ? `Handover notes: ${notes}` : undefined,
          updated_at: nowUtcIso(),
        })
        .eq('id', record_id)
        .select()
        .single();

      if (updateErr) throw updateErr;

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

    if (body.action === 'approve_escort_correction') {
      const { escort_id, notes } = body;
      const { loadFileStore, saveFileStore } = await import('@/lib/escort/escort-db');

      const fileStore = loadFileStore();
      const escortApp = fileStore.find(
        (a: any) => a.id === escort_id || a.user_id === escort_id || a.appId === escort_id || a.escort_code === escort_id
      );

      let correctionData: any = null;
      if (escortApp) {
        const appAny = escortApp as any;
        correctionData = appAny.proposed_correction;
        if (correctionData) {
          if (correctionData.fullName) {
            appAny.fullName = correctionData.fullName;
            appAny.name = correctionData.fullName;
          }
          if (correctionData.phone) appAny.phone = correctionData.phone;
          if (correctionData.email) appAny.email = correctionData.email;
          if (correctionData.address) appAny.address = correctionData.address;
          if (correctionData.operatingArea) {
            appAny.operatingArea = correctionData.operatingArea;
            appAny.operating_area = correctionData.operatingArea;
          }
          if (correctionData.emergencyContactName) appAny.emergencyContact = correctionData.emergencyContactName;
          if (correctionData.nin) appAny.nin = correctionData.nin;
          if (correctionData.driverLicense) appAny.driversLicence = correctionData.driverLicense;
        }

        appAny.status = 'CITY_MANAGER_APPROVED';
        delete (escortApp as any).proposed_correction;
        saveFileStore(fileStore);
      }

      try {
        if (correctionData) {
          await db
            .from('user_profiles')
            .update({
              full_name: correctionData.fullName || undefined,
              phone: correctionData.phone || undefined,
              email: correctionData.email || undefined,
            })
            .eq('id', escort_id);

          await db
            .from('escort_applications')
            .update({
              status: 'CITY_MANAGER_APPROVED',
              full_name: correctionData.fullName || undefined,
              phone: correctionData.phone || undefined,
              email: correctionData.email || undefined,
              operating_area: correctionData.operatingArea || undefined,
              proposed_correction: null,
            })
            .or(`id.eq.${escort_id},user_id.eq.${escort_id}`);
        }
      } catch (e) {
        console.warn('[approve_escort_correction] Supabase sync notice:', e);
      }

      await audit(db, session.user_id, 'APPROVE_ESCORT_CORRECTION', 'escort_application', escort_id, {
        notes,
        applied_correction: correctionData,
      });

      return NextResponse.json({
        success: true,
        message: 'School Escort information correction approved successfully!',
        escort_id,
        status: 'CITY_MANAGER_APPROVED',
      });
    }

    if (body.action === 'reject_escort_correction') {
      const { escort_id, rejection_reason } = body;
      const { loadFileStore, saveFileStore } = await import('@/lib/escort/escort-db');

      const fileStore = loadFileStore();
      const escortApp = fileStore.find(
        (a: any) => a.id === escort_id || a.user_id === escort_id || a.appId === escort_id || a.escort_code === escort_id
      );

      if (escortApp) {
        escortApp.status = 'CITY_MANAGER_APPROVED';
        delete (escortApp as any).proposed_correction;
        (escortApp as any).correction_rejection_reason = rejection_reason || 'Correction rejected by City Manager';
        saveFileStore(fileStore);
      }

      try {
        await db
          .from('escort_applications')
          .update({
            status: 'CITY_MANAGER_APPROVED',
            proposed_correction: null,
          })
          .or(`id.eq.${escort_id},user_id.eq.${escort_id}`);
      } catch (e) {
        console.warn('[reject_escort_correction] Supabase sync notice:', e);
      }

      await audit(db, session.user_id, 'REJECT_ESCORT_CORRECTION', 'escort_application', escort_id, {
        rejection_reason,
      });

      return NextResponse.json({
        success: true,
        message: 'School Escort correction rejected.',
        escort_id,
      });
    }

    return NextResponse.json({ error: `Unknown action: ${body.action}` }, { status: 400 });
  } catch (error: any) { return NextResponse.json({ error: error.message || 'Operation failed' }, { status: 500 }); }
}
