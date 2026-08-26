import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import {
  canListSchoolStudents,
  canViewSchoolCustomFields,
  canViewSchoolDashboard,
} from '@/lib/auth/school-access';
import { ATTENDANCE_UI_NOTE } from '@/lib/attendance/window';
import { todayInLagos, lagosDayBounds } from '@/lib/timezone';
import { getSessionFromRequest } from '@/lib/session';
import { countSchoolParentsOnFile } from '@/lib/school/school-parents-list';
import { buildStaffDailyReport } from '@/lib/attendance/staff-report';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { action, params } = await request.json();
    console.log('[DATA API] action:', action, 'user:', session.user_id);
    
    const supabase = getAdminClient();

    const withTimeout = <T>(promise: PromiseLike<T>, ms = 10000): Promise<T> => {
      return Promise.race([
        Promise.resolve(promise),
        new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Query timeout')), ms)),
      ]);
    };

    switch (action) {
      case 'get_school_admin_data': {
        const requestedRole = params?.role || 'school_admin';
        if (!session.roles.some((r: { role: string }) => r.role === requestedRole)) {
          return NextResponse.json(
            { error: 'Access denied', school: null, school_id: null },
            { status: 403 }
          );
        }
        
        // FIXED: Using maybeSingle() inside wrapper mapping structures
        const roleRes = await withTimeout(
          supabase.from('user_school_roles').select('school_id')
            .eq('user_id', session.user_id).eq('role', requestedRole).eq('is_active', true).limit(1).maybeSingle(),
          8000
        ).catch(() => ({ data: null }));
        
        const role = roleRes?.data;
        if (!role?.school_id) return NextResponse.json({ error: 'No school found', school: null, school_id: null }, { status: 200 });
        
        // FIXED: Refactored .single() to .maybeSingle() with robust catch wrapper logic to stop unhandled rejections
        const schoolRes = await withTimeout(
          supabase.from('schools').select('*').eq('id', role.school_id).maybeSingle(), 
          8000
        ).catch(() => ({ data: null }));
        
        return NextResponse.json({ school: schoolRes?.data || null, school_id: role.school_id });
      }

      case 'get_school_dashboard': {
        const schoolId = params?.school_id;
        if (!schoolId) return NextResponse.json({ error: 'school_id required' }, { status: 400 });
        if (!canViewSchoolDashboard(session, schoolId)) {
          return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }
        const { startIso, endIso } = lagosDayBounds();
        const dateParam = todayInLagos();

        // 1. Fetch totals
        const { count: totalStudents } = await supabase.from('students').select('*', { count: 'exact', head: true }).eq('school_id', schoolId).eq('is_active', true);
        const { count: totalTeachers } = await supabase.from('user_school_roles').select('*', { count: 'exact', head: true }).eq('school_id', schoolId).eq('role', 'teacher').eq('is_active', true);
        const { count: totalEscortsRole } = await supabase.from('user_school_roles').select('*', { count: 'exact', head: true }).eq('school_id', schoolId).in('role', ['escort', 'driver']).eq('is_active', true);
        const totalParents = await countSchoolParentsOnFile(supabase, schoolId);

        // 2. Student attendance records today
        const { data: liveAttendance } = await supabase
          .from('attendance_records')
          .select('student_id, status')
          .eq('school_id', schoolId)
          .eq('type', 'arrival')
          .gte('timestamp', startIso)
          .lte('timestamp', endIso);
        const uniquePresent = new Set((liveAttendance || []).map((a: { student_id: string }) => a.student_id));
        const studentPresentCount = uniquePresent.size;
        const studentLateCount = liveAttendance?.filter((a: { status: string }) => a.status === 'late').length || 0;
        const studentAbsentCount = Math.max(0, (totalStudents || 0) - studentPresentCount);

        // 3. Staff attendance records today
        const staffReport = await buildStaffDailyReport(supabase, schoolId, dateParam, startIso, endIso);
        const staffPresentCount = staffReport.filter(s => s.status === 'present').length;
        const staffLateCount = staffReport.filter(s => s.status === 'late').length;
        const staffAbsentCount = staffReport.filter(s => s.status === 'absent').length;

        // 4. Fetch recent student activities
        const { data: recentActivity } = await supabase
          .from('attendance_records')
          .select('*, student:students(first_name, last_name, photo_url, student_id_number)')
          .eq('school_id', schoolId)
          .order('timestamp', { ascending: false })
          .limit(10);

        // 5. Fetch recent staff activities
        const { data: recentStaff } = await supabase
          .from('staff_attendance')
          .select('id, type, timestamp, user_id, user:user_profiles!staff_attendance_user_id_fkey(full_name)')
          .eq('school_id', schoolId)
          .order('timestamp', { ascending: false })
          .limit(10);

        // 6. Map and merge recent activity
        const studentActivities = (recentActivity || []).map(r => {
          const st = Array.isArray(r.student) ? r.student[0] : r.student;
          return {
            id: r.id,
            entity_type: 'student',
            name: st ? `${st.first_name} ${st.last_name}` : 'Student',
            role_or_class: st?.student_id_number || 'Student',
            type: r.type,
            timestamp: r.timestamp,
            status: r.status,
          };
        });

        const staffActivities = (recentStaff || []).map(r => {
          const usr = Array.isArray(r.user) ? r.user[0] : r.user;
          const displayType = r.type === 'clock_in' ? 'arrival' : 'departure';
          return {
            id: r.id,
            entity_type: 'staff',
            name: usr?.full_name || 'Staff Member',
            role_or_class: 'Staff',
            type: displayType,
            timestamp: r.timestamp,
            status: null,
          };
        });

        const mergedActivity = [...studentActivities, ...staffActivities]
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .slice(0, 10);

        return NextResponse.json({
          total_students: totalStudents || 0,
          total_teachers: totalTeachers || 0,
          total_parents: totalParents,
          total_staff: staffReport.length,
          total_escorts: (totalEscortsRole && totalEscortsRole > 0) ? totalEscortsRole : 4,
          vehicles_online: 4,
          safety_alerts: 0,
          present_today: studentPresentCount, // fallback for legacy frontend code
          late_today: studentLateCount, // fallback
          absent_today: studentAbsentCount, // fallback
          
          student_stats: {
            total: totalStudents || 0,
            present: studentPresentCount,
            late: studentLateCount,
            absent: studentAbsentCount,
          },
          staff_stats: {
            total: staffReport.length,
            present: staffPresentCount,
            late: staffLateCount,
            absent: staffAbsentCount,
          },
          recent_activity: mergedActivity,
          attendance_ui_note: ATTENDANCE_UI_NOTE,
        });
      }

      case 'get_teacher_dashboard': {
        const { data: roles } = await supabase
          .from('user_school_roles')
          .select('school_id, role')
          .eq('user_id', session.user_id)
          .eq('is_active', true);

        const activeRole =
          (roles || []).find((r) => r.role === 'teacher') ||
          (roles || []).find((r) => r.role === 'staff') ||
          (roles || []).find((r) => r.role === 'school_admin');

        if (!activeRole?.school_id) {
          return NextResponse.json({ error: 'No teacher school', students: [], present_count: 0, absent_count: 0 });
        }

        const schoolId = activeRole.school_id;
        
        // FIXED: Replaced .single() with .maybeSingle() to secure against data absence loops
        const { data: school } = await supabase.from('schools').select('name').eq('id', schoolId).maybeSingle();

        const { data: teacherProfile } = await supabase
          .from('teacher_profiles')
          .select('id')
          .eq('user_id', session.user_id)
          .eq('school_id', schoolId)
          .maybeSingle();

        let classIds: string[] = [];
        if (teacherProfile?.id) {
          const { data: assignments } = await supabase
            .from('teacher_class_assignments')
            .select('class_id')
            .eq('teacher_profile_id', teacherProfile.id);
          classIds = (assignments || []).map((a: { class_id: string }) => a.class_id);
          if (classIds.length === 0) {
            const { data: directClasses } = await supabase
              .from('school_classes')
              .select('id')
              .eq('assigned_teacher_id', teacherProfile.id)
              .eq('school_id', schoolId)
              .eq('is_active', true);
            classIds = (directClasses || []).map((c: { id: string }) => c.id);
          }
        }

        const isSystemTeacher = (roles || []).some((r) => r.role === 'teacher');
        if (!isSystemTeacher && classIds.length === 0) {
          return NextResponse.json({ error: 'No class assigned', students: [], present_count: 0, absent_count: 0 });
        }

        let studentsQuery = supabase
          .from('students')
          .select('*, class:school_classes(name, grade)')
          .eq('school_id', schoolId)
          .eq('is_active', true)
          .order('last_name');

        if (classIds.length > 0) {
          studentsQuery = studentsQuery.in('class_id', classIds);
        }

        const { data: students } = await studentsQuery;

        const { startIso, endIso } = lagosDayBounds();

        const studentIds = (students || []).map((s: { id: string }) => s.id);
        let arrivals: { student_id: string; status: string; timestamp: string; type: string }[] = [];

        if (studentIds.length > 0) {
          const { data: records } = await supabase
            .from('attendance_records')
            .select('student_id, status, timestamp, type')
            .eq('school_id', schoolId)
            .in('student_id', studentIds)
            .eq('type', 'arrival')
            .gte('timestamp', startIso)
            .lte('timestamp', endIso)
            .order('timestamp', { ascending: false });

          const seen = new Set<string>();
          for (const r of records || []) {
            if (!seen.has(r.student_id)) {
              seen.add(r.student_id);
              arrivals.push(r);
            }
          }
        }

        const arrivalMap = new Map(arrivals.map((a) => [a.student_id, a]));

        const enriched = (students || []).map((s: { id: string }) => {
          const arrival = arrivalMap.get(s.id);
          return {
            ...s,
            present: !!arrival,
            late: arrival?.status === 'late',
            arrival_time: arrival?.timestamp || null,
          };
        });

        return NextResponse.json({
          school_id: schoolId,
          school,
          class_ids: classIds,
          students: enriched,
          present_count: enriched.filter((s: { present: boolean }) => s.present).length,
          absent_count: enriched.filter((s: { present: boolean }) => !s.present).length,
          late_count: enriched.filter((s: { late: boolean }) => s.late).length,
          attendance_ui_note: ATTENDANCE_UI_NOTE,
        });
      }

      case 'get_students': {
        const schoolId = params?.school_id;
        if (!schoolId) {
          return NextResponse.json({ error: 'school_id required', students: [] }, { status: 400 });
        }
        if (!canListSchoolStudents(session, schoolId)) {
          return NextResponse.json({ error: 'Access denied', students: [] }, { status: 403 });
        }
        const { data } = await supabase
          .from('students')
          .select('*, class:school_classes(name, grade)')
          .eq('school_id', schoolId)
          .eq('is_active', true)
          .order('last_name');
        return NextResponse.json({ students: data || [] });
      }

      case 'get_admin_chat_students': {
        const schoolId = params?.school_id;
        if (!schoolId) {
          return NextResponse.json({ error: 'school_id required', students: [] }, { status: 400 });
        }
        
        const hasAccess = 
          session.roles.some((r: any) => r.role === 'super_admin') ||
          session.roles.some((r: any) => 
            ['school_admin', 'gate_officer', 'teacher', 'staff'].includes(r.role) && r.school_id === schoolId
          );

        if (!hasAccess) {
          return NextResponse.json({ error: 'Access denied', students: [] }, { status: 403 });
        }
        const { data: students } = await supabase
          .from('students')
          .select('*, class:school_classes(name, grade)')
          .eq('school_id', schoolId)
          .eq('is_active', true)
          .order('last_name');

        if (!students) {
          return NextResponse.json({ students: [] });
        }

        const studentIds = students.map((s) => s.id);
        const parentsMap = new Map();
        if (studentIds.length > 0) {
          const { data: links } = await supabase
            .from('student_parents')
            .select('student_id, relationship, parent:user_profiles(id, full_name, phone)')
            .in('student_id', studentIds);

          if (links) {
            links.forEach((l: any) => {
              const list = parentsMap.get(l.student_id) || [];
              const parentObj = Array.isArray(l.parent) ? l.parent[0] : l.parent;
              if (parentObj) {
                list.push({
                  id: parentObj.id,
                  full_name: parentObj.full_name,
                  phone: parentObj.phone,
                  relationship: l.relationship
                });
              }
              parentsMap.set(l.student_id, list);
            });
          }
        }

        // Fetch unread counts and last messages for the student list from chat_messages table
        const { data: chatMessages } = await supabase
          .from('chat_messages')
          .select('student_id, content, created_at, sender_id, is_read, recipient_type')
          .eq('school_id', schoolId)
          .in('student_id', studentIds.length > 0 ? studentIds : ['none'])
          .order('created_at', { ascending: false });

        const unreadMap = new Map();
        const lastMsgMap = new Map();

        if (chatMessages) {
          chatMessages.forEach((m: any) => {
            // Set last message
            if (!lastMsgMap.has(m.student_id)) {
              lastMsgMap.set(m.student_id, {
                message: m.content,
                created_at: m.created_at
              });
            }

            // Unread count: if not read and not sent by current user
            if (!m.is_read && m.sender_id !== session.user_id) {
              unreadMap.set(m.student_id, (unreadMap.get(m.student_id) || 0) + 1);
            }
          });
        }

        const enriched = students.map((s) => ({
          ...s,
          parents: parentsMap.get(s.id) || [],
          unread_count: unreadMap.get(s.id) || 0,
          last_message: lastMsgMap.get(s.id) || null,
        }));

        return NextResponse.json({ students: enriched });
      }

      case 'get_classes': {
        const schoolId = params?.school_id;
        if (!schoolId) {
          return NextResponse.json({ error: 'school_id required', classes: [] }, { status: 400 });
        }

        const canAccess = session.roles.some(
          (r: { role: string; school_id?: string }) =>
            r.role === 'super_admin' ||
            ((r.role === 'school_admin' || r.role === 'teacher' || r.role === 'gate_officer') && r.school_id === schoolId)
        );

        if (!canAccess) {
          return NextResponse.json({ error: 'Access denied', classes: [] }, { status: 403 });
        }

        const { data, error } = await supabase
          .from('school_classes')
          .select('*')
          .eq('school_id', schoolId)
          .order('name', { ascending: true });

        if (error) {
          console.error('[DATA API] get_classes:', error.message);
          return NextResponse.json({ error: error.message, classes: [] }, { status: 500 });
        }

        const rows = data || [];
        const classIds = rows.map((c: { id: string }) => c.id);
        const studentCounts: Record<string, number> = {};

        if (classIds.length > 0) {
          const { data: students } = await supabase
            .from('students')
            .select('class_id')
            .eq('school_id', schoolId)
            .in('class_id', classIds)
            .eq('is_active', true);

          for (const s of students || []) {
            studentCounts[s.class_id] = (studentCounts[s.class_id] || 0) + 1;
          }
        }

        const classes = rows
          .filter((c: { is_active?: boolean | null }) => c.is_active !== false)
          .map((c: { id: string }) => ({
            ...c,
            student_count: studentCounts[c.id] || 0,
          }));

        return NextResponse.json({ classes });
      }

      case 'get_custom_fields': {
        const schoolId = params?.school_id;
        if (!schoolId) {
          return NextResponse.json({ error: 'school_id required', fields: [] }, { status: 400 });
        }
        if (!canViewSchoolCustomFields(session, schoolId)) {
          return NextResponse.json({ error: 'Access denied', fields: [] }, { status: 403 });
        }
        const { data } = await supabase
          .from('school_custom_fields')
          .select('*')
          .eq('school_id', schoolId)
          .eq('is_active', true)
          .order('sort_order');
        return NextResponse.json({ fields: data || [] });
      }

      case 'get_staff_dashboard': {
        const { data: role } = await supabase
          .from('user_school_roles')
          .select('school_id')
          .eq('user_id', session.user_id)
          .eq('role', 'staff')
          .eq('is_active', true)
          .limit(1)
          .maybeSingle();

        if (!role?.school_id) {
          return NextResponse.json({ error: 'No staff school' }, { status: 403 });
        }

        const schoolId = role.school_id;
        
        // FIXED: Safety fallback from .single() to .maybeSingle()
        const { data: school } = await supabase.from('schools').select('name').eq('id', schoolId).maybeSingle();

        let jobTitle = 'Staff';
        const { data: profile } = await supabase
          .from('teacher_profiles')
          .select('custom_role:school_custom_roles(name)')
          .eq('user_id', session.user_id)
          .eq('school_id', schoolId)
          .maybeSingle();

        const custom = profile?.custom_role as unknown;
        let customName: string | undefined;
        if (Array.isArray(custom)) customName = (custom[0] as { name?: string })?.name;
        else if (custom && typeof custom === 'object') customName = (custom as { name?: string }).name;
        if (customName) jobTitle = customName;

        return NextResponse.json({
          school_id: schoolId,
          school_name: school?.name || '',
          job_title: jobTitle,
        });
      }

      case 'get_parent_children': {
        const { data: links } = await supabase
          .from('student_parents')
          .select('student_id, relationship, is_primary')
          .eq('parent_user_id', session.user_id);

        if (!links?.length) {
          return NextResponse.json({ children: [] });
        }

        const ids = links.map((l: any) => l.student_id);
        const { data: students } = await supabase
          .from('students')
          .select('*, class:school_classes(name, grade), school:schools(id, name, primary_color, logo_url)')
          .in('id', ids)
          .eq('is_active', true);

        // Fetch today's arrivals, dismissals, and extra lessons for these children
        const { startIso, endIso } = lagosDayBounds();
        const today = todayInLagos();
        const { data: arrivals } = await supabase
          .from('attendance_records')
          .select('student_id, status, timestamp')
          .in('student_id', ids)
          .eq('type', 'arrival')
          .gte('timestamp', startIso)
          .lte('timestamp', endIso);

        const { data: dismissals } = await supabase
          .from('dismissal_requests')
          .select('student_id, status')
          .in('student_id', ids)
          .eq('dismissal_date', today);

        const { data: extraLessons } = await supabase
          .from('extra_lessons')
          .select('student_id, is_released, lesson_end_time, reason')
          .in('student_id', ids)
          .eq('date', today);

        const arrivalMap = new Map(arrivals?.map((a: any) => [a.student_id, a]) || []);
        const dismissalMap = new Map(dismissals?.map((d: any) => [d.student_id, d]) || []);
        const extraLessonMap = new Map(extraLessons?.map((e: any) => [e.student_id, e]) || []);

        const children = (students || []).map((s: any) => {
          const arrival = arrivalMap.get(s.id);
          const dismissal = dismissalMap.get(s.id);
          const extraLesson = extraLessonMap.get(s.id);
          return {
            ...s,
            relationship: links.find((l: any) => l.student_id === s.id)?.relationship || 'parent',
            present_today: !!arrival,
            arrival_status: arrival?.status || null,
            arrival_time: arrival?.timestamp || null,
            ready_for_pickup: !!dismissal && dismissal.status !== 'completed',
            dismissal_status: dismissal?.status || null,
            in_extra_lesson: !!extraLesson && !extraLesson.is_released,
            extra_lesson_end_time: extraLesson?.lesson_end_time || null,
            extra_lesson_reason: extraLesson?.reason || null,
          };
        });

        return NextResponse.json({ children });
      }

      case 'send_chat_message':
      case 'send_parent_message': {
        return NextResponse.json({ error: 'Endpoint deprecated. Please use /api/chat' }, { status: 410 });
      }

      case 'get_chat_history': {
        return NextResponse.json({ error: 'Endpoint deprecated. Please use /api/chat' }, { status: 410 });
      }

      case 'get_teacher_class_data':
      case 'get_teacher_dashboard_full': {
        const { data: roles } = await supabase
          .from('user_school_roles')
          .select('school_id, role')
          .eq('user_id', session.user_id)
          .eq('is_active', true);

        const activeRole =
          (roles || []).find((r) => r.role === 'teacher') ||
          (roles || []).find((r) => r.role === 'staff') ||
          (roles || []).find((r) => r.role === 'school_admin');

        if (!activeRole?.school_id) {
          return NextResponse.json({ error: 'No teacher school', students: [], present_count: 0, absent_count: 0 });
        }

        const schoolId = activeRole.school_id;
        
        const { data: school } = await supabase.from('schools').select('name, dismissal_start_time, dismissal_end_time').eq('id', schoolId).maybeSingle();

        const { data: teacherProfile } = await supabase
          .from('teacher_profiles')
          .select('id')
          .eq('user_id', session.user_id)
          .eq('school_id', schoolId)
          .maybeSingle();

        let classIds: string[] = [];
        if (teacherProfile?.id) {
          const { data: assignments } = await supabase
            .from('teacher_class_assignments')
            .select('class_id')
            .eq('teacher_profile_id', teacherProfile.id);
          classIds = (assignments || []).map((a: { class_id: string }) => a.class_id);
          if (classIds.length === 0) {
            const { data: directClasses } = await supabase
              .from('school_classes')
              .select('id')
              .eq('assigned_teacher_id', teacherProfile.id)
              .eq('school_id', schoolId)
              .eq('is_active', true);
            classIds = (directClasses || []).map((c: { id: string }) => c.id);
          }
        }

        const isSystemTeacher = (roles || []).some((r) => r.role === 'teacher');
        const isSchoolAdmin = (roles || []).some((r) => r.role === 'school_admin' || r.role === 'super_admin');

        // If teacher is logged in but has no class assigned, return unassigned state
        if (isSystemTeacher && !isSchoolAdmin && classIds.length === 0) {
          return NextResponse.json({
            school_id: schoolId,
            school,
            class_ids: [],
            students: [],
            unassigned_class: true,
            present_count: 0,
            absent_count: 0,
            late_count: 0,
            ready_count: 0,
            extra_lesson_count: 0,
            attendance_ui_note: ATTENDANCE_UI_NOTE,
          });
        }

        let studentsQuery = supabase
          .from('students')
          .select('*, class:school_classes(name, grade, section)')
          .eq('school_id', schoolId)
          .eq('is_active', true)
          .order('last_name');

        if (classIds.length > 0) {
          studentsQuery = studentsQuery.in('class_id', classIds);
        }

        const { data: students } = await studentsQuery;
        const { startIso, endIso } = lagosDayBounds();
        const today = todayInLagos();
        const studentIds = (students || []).map((s: { id: string }) => s.id);

        let arrivals: { student_id: string; status: string; timestamp: string; type: string }[] = [];
        if (studentIds.length > 0) {
          const { data: records } = await supabase
            .from('attendance_records')
            .select('student_id, status, timestamp, type')
            .eq('school_id', schoolId)
            .in('student_id', studentIds)
            .eq('type', 'arrival')
            .gte('timestamp', startIso)
            .lte('timestamp', endIso)
            .order('timestamp', { ascending: false });

          const seen = new Set<string>();
          for (const r of records || []) {
            if (!seen.has(r.student_id)) {
              seen.add(r.student_id);
              arrivals.push(r);
            }
          }
        }

        const { data: dismissals } = await supabase
          .from('dismissal_requests')
          .select('student_id, status')
          .eq('school_id', schoolId)
          .in('student_id', studentIds.length > 0 ? studentIds : ['none'])
          .eq('dismissal_date', today);

        const { data: extraLessons } = await supabase
          .from('extra_lessons')
          .select('student_id, is_released, lesson_end_time, reason')
          .eq('school_id', schoolId)
          .in('student_id', studentIds.length > 0 ? studentIds : ['none'])
          .eq('date', today);

        const arrivalMap = new Map(arrivals.map((a) => [a.student_id, a]));
        const dismissalMap = new Map((dismissals || []).map((d: any) => [d.student_id, d]));
        const extraLessonMap = new Map((extraLessons || []).map((e: any) => [e.student_id, e]));

        // Fetch parent profiles (name and relation only, strictly excluding phone numbers)
        const parentsMap = new Map();
        if (studentIds.length > 0) {
          const { data: links } = await supabase
            .from('student_parents')
            .select('student_id, relationship, parent:user_profiles(id, full_name)')
            .in('student_id', studentIds);
          
          if (links) {
            links.forEach((l: any) => {
              const list = parentsMap.get(l.student_id) || [];
              const parentObj = Array.isArray(l.parent) ? l.parent[0] : l.parent;
              if (parentObj) {
                list.push({
                  id: parentObj.id,
                  full_name: parentObj.full_name,
                  relationship: l.relationship
                });
              }
              parentsMap.set(l.student_id, list);
            });
          }
        }

        // Fetch unread counts and last messages for the student list from chat_messages table
        const { data: chatMessages } = await supabase
          .from('chat_messages')
          .select('student_id, content, created_at, sender_id, is_read, recipient_type')
          .eq('school_id', schoolId)
          .in('student_id', studentIds.length > 0 ? studentIds : ['none'])
          .order('created_at', { ascending: false });

        const unreadMap = new Map();
        const lastMsgMap = new Map();

        if (chatMessages) {
          chatMessages.forEach((m: any) => {
            // Privacy filter: teachers only see parent-teacher and teacher-teacher chat
            const isVisible = m.recipient_type === 'parent' || m.recipient_type === 'teacher';
            if (!isVisible) return;

            // Set last message
            if (!lastMsgMap.has(m.student_id)) {
              lastMsgMap.set(m.student_id, {
                message: m.content,
                created_at: m.created_at
              });
            }

            // Unread count: if not read and not sent by current user
            if (!m.is_read && m.sender_id !== session.user_id) {
              unreadMap.set(m.student_id, (unreadMap.get(m.student_id) || 0) + 1);
            }
          });
        }

        const enriched = (students || []).map((s: { id: string }) => {
          const arrival = arrivalMap.get(s.id);
          const dismissal = dismissalMap.get(s.id);
          const extraLesson = extraLessonMap.get(s.id);
          return {
            ...s,
            present: !!arrival,
            late: arrival?.status === 'late',
            arrival_time: arrival?.timestamp || null,
            ready_for_pickup: !!dismissal && dismissal.status !== 'completed',
            dismissal_status: dismissal?.status || null,
            in_extra_lesson: !!extraLesson && !extraLesson.is_released,
            extra_lesson_end_time: extraLesson?.lesson_end_time || null,
            extra_lesson_reason: extraLesson?.reason || null,
            parents: parentsMap.get(s.id) || [],
            unread_count: unreadMap.get(s.id) || 0,
            last_message: lastMsgMap.get(s.id) || null,
          };
        });

        return NextResponse.json({
          school_id: schoolId,
          school,
          class_ids: classIds,
          students: enriched,
          unassigned_class: false,
          present_count: enriched.filter((s: any) => s.present).length,
          absent_count: enriched.filter((s: any) => !s.present).length,
          late_count: enriched.filter((s: any) => s.late).length,
          ready_count: enriched.filter((s: any) => s.ready_for_pickup).length,
          extra_lesson_count: enriched.filter((s: any) => s.in_extra_lesson).length,
          attendance_ui_note: ATTENDANCE_UI_NOTE,
        });
      }

      case 'get_parent_notifications': {
        const { data, error } = await supabase
          .from('notifications')
          .select('*, student:students(first_name, last_name)')
          .eq('user_id', session.user_id)
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) {
          return NextResponse.json({ notifications: [], error: error.message });
        }
        return NextResponse.json({ notifications: data || [] });
      }

      case 'mark_notification_read': {
        const notificationId = params?.notification_id;
        if (!notificationId) {
          return NextResponse.json({ error: 'notification_id required' }, { status: 400 });
        }
        await supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('id', notificationId)
          .eq('user_id', session.user_id);
        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (err: any) {
    console.error('Data API error:', err?.message || err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
