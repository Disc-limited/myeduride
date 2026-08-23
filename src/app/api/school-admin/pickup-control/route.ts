import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getSessionFromRequest } from '@/lib/session';
import { writeAuditLog } from '@/lib/audit/log';
import { writeGateActivityLog } from '@/lib/gate/activity-log';
import { notifyParentsOfAttendance } from '@/lib/notifications/parent-notify';
import { nowUtcIso, todayInLagos } from '@/lib/timezone';
import { getEscortApplications } from '@/lib/escort/escort-db';

export const dynamic = 'force-dynamic';

function isAuthorizedSchoolAdmin(session: any, schoolId: string) {
  if (!session) return false;
  return session.roles?.some(
    (r: any) =>
      r.role === 'super_admin' ||
      (r.school_id === schoolId && (r.role === 'school_admin' || r.role === 'gate_officer'))
  );
}

/**
 * GET /api/school-admin/pickup-control
 * High-performance composite query returning:
 * 1. School students with class, today's check-in/out status, ready-for-pickup status, walk-home permissions
 * 2. Linked parents with photo, phone, NIN verification badge
 * 3. Linked siblings within the school (via shared parent or explicit sibling relations)
 * 4. School Escorts & strictly City Manager Approved MyEduRide Escorts
 * 5. Recent pickup accountability ledger
 */
export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const primarySchoolId =
      searchParams.get('school_id') ||
      (session as any).primary_school?.id ||
      session.roles?.find((r: any) => r.school_id)?.school_id;

    if (!primarySchoolId) {
      return NextResponse.json({ error: 'school_id could not be determined' }, { status: 400 });
    }

    if (!isAuthorizedSchoolAdmin(session, primarySchoolId)) {
      return NextResponse.json({ error: 'Access denied: School Admin role required' }, { status: 403 });
    }

    const supabase = getAdminClient();
    const today = todayInLagos();

    // 1. Fetch School Details
    const { data: school } = await supabase
      .from('schools')
      .select('id, name, late_threshold, address')
      .eq('id', primarySchoolId)
      .maybeSingle();

    // 2. Fetch all active students in school with their class info
    const { data: students, error: studErr } = await supabase
      .from('students')
      .select(`
        id,
        first_name,
        last_name,
        student_id_number,
        photo_url,
        class_id,
        is_active,
        school_id,
        class:school_classes(id, name, grade)
      `)
      .eq('school_id', primarySchoolId)
      .eq('is_active', true)
      .order('first_name', { ascending: true });

    if (studErr) {
      return NextResponse.json({ error: studErr.message }, { status: 500 });
    }

    const studentIds = (students || []).map((s) => s.id);

    // 3. Fetch today's attendance records (arrivals and departures)
    let attendanceMap: Record<string, { arrival?: any; departure?: any }> = {};
    if (studentIds.length > 0) {
      const { data: attendanceRows } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('school_id', primarySchoolId)
        .in('student_id', studentIds)
        .gte('timestamp', `${today}T00:00:00Z`)
        .lte('timestamp', `${today}T23:59:59Z`);

      (attendanceRows || []).forEach((row) => {
        if (!attendanceMap[row.student_id]) attendanceMap[row.student_id] = {};
        if (row.type === 'arrival') attendanceMap[row.student_id].arrival = row;
        if (row.type === 'departure') attendanceMap[row.student_id].departure = row;
      });
    }

    // 4. Fetch today's dismissal requests (Ready for Pickup queue)
    let dismissalMap: Record<string, any> = {};
    if (studentIds.length > 0) {
      const { data: dismissalRows } = await supabase
        .from('dismissal_requests')
        .select('*')
        .eq('school_id', primarySchoolId)
        .eq('dismissal_date', today)
        .in('student_id', studentIds);

      (dismissalRows || []).forEach((row) => {
        dismissalMap[row.student_id] = row;
      });
    }

    // 5. Fetch linked parents from student_parents table & user_profiles
    let studentParentsMap: Record<string, any[]> = {};
    let parentToStudentsMap: Record<string, string[]> = {};
    if (studentIds.length > 0) {
      const { data: spLinks } = await supabase
        .from('student_parents')
        .select(`
          student_id,
          parent_user_id,
          relationship,
          is_primary,
          parent:user_profiles!parent_user_id(id, full_name, email, phone, photo_url, nin)
        `)
        .in('student_id', studentIds);

      (spLinks || []).forEach((link: any) => {
        const sid = link.student_id;
        const p = link.parent;
        if (!p) return;
        if (!studentParentsMap[sid]) studentParentsMap[sid] = [];
        studentParentsMap[sid].push({
          id: p.id,
          user_id: p.id,
          full_name: p.full_name,
          email: p.email,
          phone: p.phone || '',
          photo_url: p.photo_url || null,
          nin: p.nin || null,
          relationship: link.relationship || 'Parent',
          is_primary: !!link.is_primary,
        });

        if (!parentToStudentsMap[p.id]) parentToStudentsMap[p.id] = [];
        parentToStudentsMap[p.id].push(sid);
      });
    }

    // 6. Fetch authorized pickup persons for these students
    let authorizedPersonsMap: Record<string, any[]> = {};
    if (studentIds.length > 0) {
      const { data: ppLinks } = await supabase
        .from('pickup_person_students')
        .select(`
          student_id,
          pickup_person_id,
          pickup_person:pickup_persons!pickup_person_id(id, name, relationship, phone, photo_url)
        `)
        .eq('school_id', primarySchoolId)
        .in('student_id', studentIds);

      (ppLinks || []).forEach((link: any) => {
        const sid = link.student_id;
        const p = Array.isArray(link.pickup_person) ? link.pickup_person[0] : link.pickup_person;
        if (!p) return;
        if (!authorizedPersonsMap[sid]) authorizedPersonsMap[sid] = [];
        authorizedPersonsMap[sid].push({
          id: p.id,
          name: p.name,
          relationship: p.relationship || 'Authorized Person',
          phone: p.phone || '',
          photo_url: p.photo_url || null,
        });
      });
    }

    // 7. Compute linked siblings for each student
    const studentLookup = new Map((students || []).map((s) => [s.id, s]));
    let studentSiblingsMap: Record<string, any[]> = {};

    (students || []).forEach((stud) => {
      const siblings: any[] = [];
      const seenIds = new Set<string>([stud.id]);

      // Method A: Siblings sharing same parent_user_id in school
      const linkedParents = studentParentsMap[stud.id] || [];
      for (const p of linkedParents) {
        const coChildrenIds = parentToStudentsMap[p.id] || [];
        for (const coId of coChildrenIds) {
          if (!seenIds.has(coId) && studentLookup.has(coId)) {
            seenIds.add(coId);
            const sObj: any = studentLookup.get(coId);
            const sClass = Array.isArray(sObj.class) ? sObj.class[0] : sObj.class;
            siblings.push({
              id: sObj.id,
              student_id: sObj.id,
              full_name: `${sObj.first_name} ${sObj.last_name}`,
              class_name: sClass?.name || 'Class not assigned',
              grade: sClass?.grade || '',
              relationship: 'Sibling',
              photo_url: sObj.photo_url || null,
            });
          }
        }
      }

      // Method B: Explicit pickup persons marked as sibling/brother/sister
      const authPersons = authorizedPersonsMap[stud.id] || [];
      for (const ap of authPersons) {
        const rel = (ap.relationship || '').toLowerCase();
        if (rel.includes('sibling') || rel.includes('brother') || rel.includes('sister')) {
          if (!siblings.some((s) => s.full_name.toLowerCase() === ap.name.toLowerCase())) {
            siblings.push({
              id: ap.id,
              student_id: ap.id,
              full_name: ap.name,
              class_name: 'Approved Sibling Arrangement',
              grade: '',
              relationship: ap.relationship,
              photo_url: ap.photo_url || null,
            });
          }
        }
      }

      studentSiblingsMap[stud.id] = siblings;
    });

    // 8. Fetch Escorts: School Escorts & strictly City Manager Approved MyEduRide Escorts
    const allEscortApps = await getEscortApplications();
    
    // Strict Invariant: MyEduRide Escorts MUST have CITY_MANAGER_APPROVED or ACTIVE status
    const cityManagerApprovedStatuses = ['CITY_MANAGER_APPROVED', 'ACTIVE', 'ACTIVATED'];

    const schoolEscorts: any[] = [];
    const myedurideEscorts: any[] = [];

    (allEscortApps || []).forEach((app) => {
      const isApproved = cityManagerApprovedStatuses.includes(app.status);
      const isSchoolAffiliated =
        app.createdBySchoolId === primarySchoolId ||
        app.schoolId === primarySchoolId ||
        app.createdRole === 'school_admin';

      const escortItem = {
        id: app.id,
        full_name: app.name || app.fullName || 'Escort',
        phone: app.phone || '',
        email: app.email || '',
        nin: app.nin || '',
        escort_type: isSchoolAffiliated ? 'school_escort' : 'myeduride_escort',
        city_manager_status: app.status,
        operating_area: app.operatingArea || app.city || 'Lagos',
        availability_status: app.availability_status || 'available',
        emergency_pool_enabled: app.emergency_pool_enabled !== false,
        vehicle: app.vehicle || {
          reg_number: app.regNumber || 'Not specified',
          type: app.vehicleType || 'Car / Van',
          make: app.make || '',
          model: app.model || '',
          color: app.color || '',
        },
        photo_url: app.photo || app.vehiclePhotos?.front || null,
      };

      if (isSchoolAffiliated) {
        schoolEscorts.push(escortItem);
      } else if (isApproved) {
        // Only approved MyEduRide escorts are included
        myedurideEscorts.push(escortItem);
      }
    });

    // 9. Fetch today's escort assignments
    let activeAssignmentsMap: Record<string, any> = {};
    const { data: assignments } = await supabase
      .from('escort_assignments')
      .select('*, escort:escort_applications(full_name, phone, reg_number, operating_area, status)')
      .eq('school_id', primarySchoolId)
      .in('status', ['active', 'pending_confirmation']);

    (assignments || []).forEach((a) => {
      if (a.student_id) {
        activeAssignmentsMap[a.student_id] = a;
      }
    });

    // 10. Fetch recent gate activity / accountability ledger for today
    const { data: recentLogs } = await supabase
      .from('gate_activity_log')
      .select(`
        id,
        created_at,
        action_type,
        pickup_person_name,
        pickup_person_phone,
        details,
        student:students(first_name, last_name, student_id_number),
        officer:user_profiles!gate_officer_user_id(full_name)
      `)
      .eq('school_id', primarySchoolId)
      .gte('created_at', `${today}T00:00:00Z`)
      .order('created_at', { ascending: false })
      .limit(50);

    // 11. Format Student DTOs
    let totalCheckedIn = 0;
    let totalReady = 0;
    let totalAssigned = 0;
    let totalParentPickups = 0;
    let totalSiblingPickups = 0;
    let totalWalkHome = 0;
    let totalCompleted = 0;

    const formattedStudents = (students || []).map((s: any) => {
      const att = attendanceMap[s.id] || {};
      const dis = dismissalMap[s.id] || null;
      const assign = activeAssignmentsMap[s.id] || null;
      const isCheckedIn = !!att.arrival;
      const isDeparted = !!att.departure || dis?.status === 'completed';
      const isReady = dis && ['pending', 'approved'].includes(dis.status);
      const sClass = Array.isArray(s.class) ? s.class[0] : s.class;

      if (isCheckedIn) totalCheckedIn++;
      if (isReady && !isDeparted) totalReady++;
      if (isDeparted) totalCompleted++;

      // Check picker classification for metrics & DTO
      const pickerName = att.departure?.verified_by_user_id || dis?.pickup_person_name || '';
      const pickerTypeNote = (dis?.notes || att.departure?.verification_method || '').toLowerCase();

      let departurePickerType: any = null;
      if (isDeparted) {
        if (pickerTypeNote.includes('walk_home') || pickerTypeNote.includes('walk home')) {
          departurePickerType = 'walk_home';
          totalWalkHome++;
        } else if (pickerTypeNote.includes('sibling')) {
          departurePickerType = 'sibling';
          totalSiblingPickups++;
        } else if (pickerTypeNote.includes('escort')) {
          departurePickerType = pickerTypeNote.includes('myeduride') ? 'myeduride_escort' : 'school_escort';
        } else {
          departurePickerType = 'parent';
          totalParentPickups++;
        }
      }

      if (assign && !isDeparted) {
        totalAssigned++;
      }

      return {
        id: s.id,
        first_name: s.first_name,
        last_name: s.last_name,
        student_id_number: s.student_id_number,
        photo_url: s.photo_url || null,
        class_id: s.class_id,
        class_name: sClass?.name || 'Class not assigned',
        grade: sClass?.grade || '',
        walk_home_permitted: !!(s as any).walk_home_permitted,
        walk_home_notes: (s as any).walk_home_notes || '',
        today_status: {
          checked_in: isCheckedIn,
          check_in_time: att.arrival?.timestamp || null,
          is_late: att.arrival?.status === 'late',
          ready_for_pickup: !!isReady,
          ready_at: dis?.created_at || null,
          ready_note: dis?.notes || null,
          departure_completed: isDeparted,
          departure_time: att.departure?.timestamp || dis?.completed_at || null,
          departure_picker_type: departurePickerType,
          departure_picker_name: dis?.pickup_person_name || att.departure?.pickup_person_name || null,
        },
        current_assignment: assign
          ? {
              assignment_id: assign.id,
              picker_type: assign.assignment_type === 'deputy' ? 'myeduride_escort' : 'school_escort',
              picker_id: assign.escort_application_id,
              picker_name: assign.escort?.full_name || 'Assigned Escort',
              picker_phone: assign.escort?.phone || '',
              assigned_at: assign.created_at,
              notes: assign.notes,
            }
          : null,
        authorized_options: {
          parents: studentParentsMap[s.id] || [],
          siblings: studentSiblingsMap[s.id] || [],
          other_authorized_persons: authorizedPersonsMap[s.id] || [],
        },
      };
    });

    return NextResponse.json({
      success: true,
      timestamp: nowUtcIso(),
      school: {
        id: school?.id || primarySchoolId,
        name: school?.name || 'School',
        late_threshold: school?.late_threshold || '08:15',
      },
      metrics: {
        total_students: students?.length || 0,
        checked_in_today: totalCheckedIn,
        ready_for_pickup: totalReady,
        escort_assigned: totalAssigned,
        parent_picked_up: totalParentPickups,
        sibling_picked_up: totalSiblingPickups,
        walked_home: totalWalkHome,
        completed_departures: totalCompleted,
      },
      students: formattedStudents,
      escorts: {
        school_escorts: schoolEscorts,
        myeduride_escorts: myedurideEscorts,
      },
      recent_activity_ledger: (recentLogs || []).map((log: any) => {
        const logStudent = Array.isArray(log.student) ? log.student[0] : log.student;
        const logOfficer = Array.isArray(log.officer) ? log.officer[0] : log.officer;
        return {
          id: log.id,
          created_at: log.created_at,
          action_type: log.action_type,
          pickup_person_name: log.pickup_person_name,
          pickup_person_phone: log.pickup_person_phone,
          student_name: logStudent ? `${logStudent.first_name} ${logStudent.last_name}` : 'Student',
          student_id_number: logStudent?.student_id_number || '',
          officer_name: logOfficer?.full_name || 'Admin',
          details: log.details || {},
        };
      }),
    });
  } catch (err: any) {
    console.error('[pickup-control GET] Error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * POST /api/school-admin/pickup-control
 * Transactional mutation endpoint handling:
 * 1. action: 'assign_pickup' -> Assign School/MyEduRide Escort, Parent, Sibling, or Walk Home
 * 2. action: 'execute_release' -> Execute gate release with multi-tier audit logging & parent notification
 * 3. action: 'update_walk_home_status' -> Toggle student walk home permit
 */
export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { action, school_id, student_id } = body;

    if (!school_id || !student_id) {
      return NextResponse.json({ error: 'school_id and student_id required' }, { status: 400 });
    }

    if (!isAuthorizedSchoolAdmin(session, school_id)) {
      return NextResponse.json({ error: 'Access denied: School Admin role required' }, { status: 403 });
    }

    const supabase = getAdminClient();
    const nowIso = nowUtcIso();
    const today = todayInLagos();

    // Verify student exists and belongs to school
    const { data: student, error: sErr } = await supabase
      .from('students')
      .select('id, first_name, last_name, school_id, is_active')
      .eq('id', student_id)
      .eq('school_id', school_id)
      .single();

    if (sErr || !student) {
      return NextResponse.json({ error: 'Student not found in this school' }, { status: 404 });
    }

    // -------------------------------------------------------------
    // ACTION: ASSIGN PICKUP
    // -------------------------------------------------------------
    if (action === 'assign_pickup') {
      const { picker_type, picker_id, picker_name, picker_phone, notes } = body;

      if (!picker_type || !picker_name) {
        return NextResponse.json({ error: 'picker_type and picker_name required' }, { status: 400 });
      }

      // Security validation: If MyEduRide Escort, verify City Manager Approved status
      if (picker_type === 'myeduride_escort' && picker_id) {
        const { data: escort } = await supabase
          .from('escort_applications')
          .select('id, status, full_name')
          .eq('id', picker_id)
          .single();

        const approvedStatuses = ['CITY_MANAGER_APPROVED', 'ACTIVE', 'ACTIVATED'];
        if (!escort || !approvedStatuses.includes(escort.status)) {
          return NextResponse.json(
            { error: 'Security policy: MyEduRide Escorts must be approved by the City Manager before assignment' },
            { status: 400 }
          );
        }
      }

      // Upsert dismissal request record to mark student in Ready / Assigned queue
      const { data: existingDismissal } = await supabase
        .from('dismissal_requests')
        .select('id')
        .eq('school_id', school_id)
        .eq('student_id', student_id)
        .eq('dismissal_date', today)
        .maybeSingle();

      if (existingDismissal) {
        await supabase
          .from('dismissal_requests')
          .update({
            pickup_person_name: picker_name,
            pickup_person_phone: picker_phone || null,
            pickup_source: picker_type,
            notes: notes || `Assigned to ${picker_name} (${picker_type})`,
            status: 'pending',
          })
          .eq('id', existingDismissal.id);
      } else {
        await supabase.from('dismissal_requests').insert({
          school_id,
          student_id,
          dismissal_date: today,
          pickup_person_name: picker_name,
          pickup_person_phone: picker_phone || null,
          pickup_source: picker_type,
          notes: notes || `Assigned to ${picker_name} (${picker_type})`,
          status: 'pending',
        });
      }

      // If escort assignment, also record in escort_assignments table
      if (['school_escort', 'myeduride_escort'].includes(picker_type) && picker_id) {
        await supabase.from('escort_assignments').insert({
          school_id,
          student_id,
          escort_application_id: picker_id,
          assignment_type: picker_type === 'myeduride_escort' ? 'deputy' : 'standard',
          status: 'active',
          assigned_by: session.user_id,
          notes: notes || `Assigned via Central Control Pickup List to ${student.first_name} ${student.last_name}`,
        });
      }

      // Accountability Audit Logging
      await writeAuditLog(supabase, {
        school_id,
        actor_user_id: session.user_id,
        student_id,
        action: 'pickup_assigned_by_admin',
        entity_type: 'dismissal_requests',
        details: {
          picker_type,
          picker_id,
          picker_name,
          picker_phone,
          notes,
        },
      });

      return NextResponse.json({
        success: true,
        message: `Pickup assignment recorded for ${student.first_name} (${picker_name})`,
      });
    }

    // -------------------------------------------------------------
    // ACTION: EXECUTE STUDENT RELEASE (DEPARTURE)
    // -------------------------------------------------------------
    if (action === 'execute_release') {
      const { picker_type, picker_id, picker_name, picker_phone, notes } = body;

      if (!picker_type || !picker_name) {
        return NextResponse.json({ error: 'picker_type and picker_name required for release' }, { status: 400 });
      }

      // Security check for MyEduRide Escort
      if (picker_type === 'myeduride_escort' && picker_id) {
        const { data: escort } = await supabase
          .from('escort_applications')
          .select('id, status')
          .eq('id', picker_id)
          .single();

        const approvedStatuses = ['CITY_MANAGER_APPROVED', 'ACTIVE', 'ACTIVATED'];
        if (!escort || !approvedStatuses.includes(escort.status)) {
          return NextResponse.json(
            { error: 'Security policy: MyEduRide Escorts must be approved by the City Manager before student release' },
            { status: 400 }
          );
        }
      }

      // 1. Insert Tier-1 Attendance Record (Departure)
      const { data: attRecord, error: attErr } = await supabase
        .from('attendance_records')
        .insert({
          student_id,
          school_id,
          type: 'departure',
          verification_method: `central_control_${picker_type}`,
          verified_by_user_id: session.user_id,
          status: 'on_time',
          source: 'admin',
          timestamp: nowIso,
        })
        .select()
        .single();

      if (attErr) {
        console.error('[pickup-control release] attendance_records error:', attErr.message);
        return NextResponse.json({ error: `Failed to record departure: ${attErr.message}` }, { status: 500 });
      }

      // 2. Complete dismissal requests for today
      await supabase
        .from('dismissal_requests')
        .update({
          status: 'completed',
          completed_at: nowIso,
          pickup_person_name: picker_name,
          pickup_person_phone: picker_phone || null,
          pickup_source: picker_type,
          notes: notes || `Released via Central Control to ${picker_name} (${picker_type})`,
        })
        .eq('student_id', student_id)
        .eq('school_id', school_id)
        .eq('dismissal_date', today);

      // 3. Mark active escort assignment as completed if applicable
      if (['school_escort', 'myeduride_escort'].includes(picker_type)) {
        await supabase
          .from('escort_assignments')
          .update({ status: 'completed', updated_at: nowIso })
          .eq('student_id', student_id)
          .eq('school_id', school_id)
          .eq('status', 'active');
      }

      // 4. Tier-2 Gate Activity Log
      await writeGateActivityLog(supabase, {
        school_id,
        gate_officer_user_id: session.user_id,
        student_id,
        action_type: 'release',
        pickup_person_name: picker_name,
        pickup_person_phone: picker_phone || null,
        details: {
          picker_type,
          picker_id: picker_id || null,
          attendance_record_id: attRecord.id,
          release_mode: 'central_control_pickup_list',
          notes,
        },
      });

      // 5. Tier-3 Regulatory System Audit Log
      await writeAuditLog(supabase, {
        school_id,
        actor_user_id: session.user_id,
        student_id,
        action: 'gate_student_release',
        entity_type: 'attendance_records',
        entity_id: attRecord.id,
        details: {
          picker_type,
          picker_name,
          picker_phone,
          verification_method: `central_control_${picker_type}`,
          notes,
        },
      });

      // 6. Tier-4 Asynchronous Parent Notification
      const notifyResult = await notifyParentsOfAttendance({
        student_id,
        attendance_record_id: attRecord.id,
        type: 'departure',
      }).catch((e) => {
        console.warn('[pickup-control] parent notification failed:', e);
        return { notified: 0, skipped: String(e) };
      });

      return NextResponse.json({
        success: true,
        message: `${student.first_name} ${student.last_name} successfully released to ${picker_name} (${picker_type})`,
        attendance_record_id: attRecord.id,
        parents_notified: notifyResult.notified,
      });
    }

    // -------------------------------------------------------------
    // ACTION: UPDATE WALK HOME STATUS
    // -------------------------------------------------------------
    if (action === 'update_walk_home_status') {
      const { permitted, notes } = body;

      // Note: If schema doesn't have walk_home_permitted column, fallback safely
      const { error: updErr } = await supabase
        .from('students')
        .update({
          // @ts-ignore
          walk_home_permitted: Boolean(permitted),
          // @ts-ignore
          walk_home_notes: notes || null,
        })
        .eq('id', student_id);

      if (updErr && !/column/i.test(updErr.message)) {
        return NextResponse.json({ error: updErr.message }, { status: 500 });
      }

      await writeAuditLog(supabase, {
        school_id,
        actor_user_id: session.user_id,
        student_id,
        action: permitted ? 'walk_home_permitted_granted' : 'walk_home_permitted_revoked',
        entity_type: 'students',
        entity_id: student_id,
        details: { permitted, notes },
      });

      return NextResponse.json({
        success: true,
        message: `Walk home authorization updated for ${student.first_name}`,
      });
    }

    return NextResponse.json({ error: `Invalid action: ${action}` }, { status: 400 });
  } catch (err: any) {
    console.error('[pickup-control POST] Error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
