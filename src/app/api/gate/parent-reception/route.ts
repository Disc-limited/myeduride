// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getSessionFromRequest } from '@/lib/session';
import { canAccessGateOperations } from '@/lib/gate/access';
import { nowUtcIso, todayInLagos } from '@/lib/timezone';

export const dynamic = 'force-dynamic';

/**
 * POST /api/gate/parent-reception
 * Handles gate reception for parents:
 * 1. action: 'student_dropoff' -> Morning check-in of one or more children attached to parent.
 * 2. action: 'student_pickup'  -> Afternoon sign-out/release of one or more children into parent custody.
 * 3. action: 'register_visit'  -> Register parent visit with purpose, host staff, vehicle plate, alerting school.
 */
export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const {
      action,
      school_id,
      parent_id,
      parent_name,
      parent_phone,
      student_ids = [],
      // For visit action
      purpose_of_visit,
      person_to_see,
      host_user_id,
      department,
      vehicle_plate,
      notes,
    } = body;

    if (!school_id) {
      return NextResponse.json({ error: 'school_id required' }, { status: 400 });
    }

    if (!canAccessGateOperations(session, school_id)) {
      return NextResponse.json({ error: 'Gate access required' }, { status: 403 });
    }

    const supabase = getAdminClient();
    const nowIso = nowUtcIso();
    const day = todayInLagos();
    const verifiedBy = session.user_id;

    // ------------------------------------------------------------------------
    // ACTION 1: STUDENT DROP-OFF (Morning Arrival)
    // ------------------------------------------------------------------------
    if (action === 'student_dropoff') {
      if (!Array.isArray(student_ids) || student_ids.length === 0) {
        return NextResponse.json({ error: 'Please select at least one student for drop-off' }, { status: 400 });
      }

      const results: any[] = [];

      for (const studentId of student_ids) {
        // Record arrival in attendance_records
        const { data: attRecord, error: attError } = await supabase
          .from('attendance_records')
          .insert({
            student_id: studentId,
            school_id: school_id,
            date: day,
            timestamp: nowIso,
            type: 'arrival',
            status: 'present',
            verification_method: 'parent_card_scan',
            verified_by: verifiedBy,
          })
          .select()
          .single();

        if (attError) {
          console.warn(`[parent-reception dropoff] Attendance insert warning for student ${studentId}:`, attError);
        }

        // Log gate activity
        await supabase.from('gate_activity_logs').insert({
          school_id: school_id,
          student_id: studentId,
          actor_id: verifiedBy,
          action_type: 'check_in',
          status: 'success',
          created_at: nowIso,
          details: {
            verification_method: 'parent_card_scan',
            parent_id: parent_id || null,
            parent_name: parent_name || 'Parent',
            parent_phone: parent_phone || null,
            mode: 'morning_dropoff',
          },
        });

        results.push({ student_id: studentId, status: 'checked_in' });
      }

      return NextResponse.json({
        success: true,
        message: `Successfully checked in ${results.length} student(s) with parent drop-off`,
        results,
      });
    }

    // ------------------------------------------------------------------------
    // ACTION 2: STUDENT PICKUP (Afternoon Sign-out / Release)
    // ------------------------------------------------------------------------
    if (action === 'student_pickup') {
      if (!Array.isArray(student_ids) || student_ids.length === 0) {
        return NextResponse.json({ error: 'Please select at least one student for release' }, { status: 400 });
      }

      const results: any[] = [];

      for (const studentId of student_ids) {
        // Record departure in attendance_records
        const { data: attRecord, error: attError } = await supabase
          .from('attendance_records')
          .insert({
            student_id: studentId,
            school_id: school_id,
            date: day,
            timestamp: nowIso,
            type: 'departure',
            status: 'released',
            verification_method: 'parent_card_scan',
            verified_by: verifiedBy,
          })
          .select()
          .single();

        if (attError) {
          console.warn(`[parent-reception pickup] Attendance insert warning for student ${studentId}:`, attError);
        }

        // Close pending dismissal requests for today
        await supabase
          .from('dismissal_requests')
          .update({
            status: 'completed',
            released_at: nowIso,
            released_by: verifiedBy,
          })
          .eq('student_id', studentId)
          .eq('school_id', school_id)
          .eq('dismissal_date', day);

        // Log gate activity with parent custody attribution
        await supabase.from('gate_activity_logs').insert({
          school_id: school_id,
          student_id: studentId,
          actor_id: verifiedBy,
          action_type: 'check_out',
          status: 'success',
          created_at: nowIso,
          details: {
            verification_method: 'parent_card_scan',
            parent_id: parent_id || null,
            parent_name: parent_name || 'Parent',
            parent_phone: parent_phone || null,
            mode: 'afternoon_pickup_release',
            overrides_bus: true,
          },
        });

        results.push({ student_id: studentId, status: 'released' });
      }

      return NextResponse.json({
        success: true,
        message: `Successfully released ${results.length} student(s) to parent ${parent_name || ''}`,
        results,
      });
    }

    // ------------------------------------------------------------------------
    // ACTION 3: REGISTER CAMPUS VISIT (For Other Purpose)
    // ------------------------------------------------------------------------
    if (action === 'register_visit') {
      const cleanName = (parent_name || '').trim();
      const cleanPhone = (parent_phone || '').trim();
      const cleanPurpose = (purpose_of_visit || '').trim();

      if (!cleanName || !cleanPurpose) {
        return NextResponse.json(
          { error: 'Parent full name and purpose of visit are required' },
          { status: 400 }
        );
      }

      const passToken = `EDURIDE-PAR-${Math.floor(100000 + Math.random() * 900000)}`;

      const visitorPayload: Record<string, any> = {
        school_id: school_id,
        digital_pass_token: passToken,
        full_name: cleanName,
        phone: cleanPhone || 'N/A',
        purpose_of_visit: cleanPurpose,
        person_to_see: person_to_see?.trim() || 'General Administration',
        department: department?.trim() || 'School Administration',
        vehicle_plate: vehicle_plate?.toUpperCase().trim() || 'N/A',
        visitor_type: 'Parent / Guardian',
        entry_time: nowIso,
        status: 'on_campus',
        security_flag: 'cleared',
        host_user_id: host_user_id || null,
        host_response: 'accepted',
      };

      // Try inserting into gate_visitors
      let newVisitor: any = null;
      const res1 = await supabase
        .from('gate_visitors')
        .insert(visitorPayload)
        .select()
        .single();

      if (res1.error && res1.error.message?.includes('host_')) {
        delete visitorPayload.host_user_id;
        delete visitorPayload.host_response;
        const res2 = await supabase
          .from('gate_visitors')
          .insert(visitorPayload)
          .select()
          .single();
        newVisitor = res2.data;
        if (res2.error) throw res2.error;
      } else {
        if (res1.error) throw res1.error;
        newVisitor = res1.data;
      }

      // Log gate activity
      await supabase.from('gate_activity_logs').insert({
        school_id: school_id,
        actor_id: verifiedBy,
        action_type: 'parent_visit_registered',
        status: 'success',
        created_at: nowIso,
        details: {
          parent_id: parent_id || null,
          parent_name: cleanName,
          parent_phone: cleanPhone,
          purpose_of_visit: cleanPurpose,
          person_to_see: person_to_see || 'Administration',
          vehicle_plate: vehicle_plate || null,
          pass_token: passToken,
          notes: notes || null,
        },
      });

      // Notify host staff in-app if selected
      if (host_user_id) {
        try {
          await supabase.from('notifications').insert({
            school_id: school_id,
            user_id: host_user_id,
            title: `Parent on Campus: ${cleanName}`,
            message: `${cleanName} (${cleanPhone || 'Parent'}) has arrived at the gate for: "${cleanPurpose}". Meeting with: ${person_to_see || 'You'}.`,
            type: 'visitor_access_request',
            priority: 'high',
            is_read: false,
            created_at: nowIso,
          });
        } catch (notifErr) {
          console.warn('[parent-reception] Host notification warning:', notifErr);
        }
      }

      return NextResponse.json({
        success: true,
        message: `Parent visit successfully registered for ${cleanName}. Campus entry pass issued.`,
        pass_token: passToken,
        visitor: newVisitor,
      });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err: any) {
    console.error('[POST /api/gate/parent-reception] Error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
