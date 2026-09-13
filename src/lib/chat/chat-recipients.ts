import { getAdminClient } from '@/lib/supabase/admin';
import type { AppSession } from '@/lib/session';

/**
 * Resolve recipient user IDs for a chat message based on sender role and recipient type.
 */
export async function resolveRecipients({
  session,
  studentId,
  recipientType,
}: {
  session: AppSession;
  studentId: string;
  recipientType: string;
}): Promise<string[]> {
  const supabase = getAdminClient();

  // Fetch student info
  const { data: student } = await supabase
    .from('students')
    .select('first_name, last_name, class_id, school_id')
    .eq('id', studentId)
    .maybeSingle();

  if (!student) return [];

  const isParent = session.roles.some((r) => r.role === 'parent');
  const isTeacher = session.roles.some((r) => r.role === 'teacher' || r.role === 'staff');
  const isAdmin = session.roles.some((r) => r.role === 'school_admin' || r.role === 'super_admin');
  const isEscort = session.roles.some((r) =>
    r.role === 'myeduride_escort' ||
    r.role === 'school_escort' ||
    r.role === 'escort' ||
    r.role === 'driver'
  );

  const recipientUserIds: string[] = [];

  if (isParent) {
    // Verify parent link
    const { data: link } = await supabase
      .from('student_parents')
      .select('relationship')
      .eq('student_id', studentId)
      .eq('parent_user_id', session.user_id)
      .maybeSingle();

    if (!link) return [];

    if (recipientType === 'teacher') {
      await addTeachersForClass(supabase, student.class_id, recipientUserIds);
    } else if (recipientType === 'escort') {
      await addEscortsForStudent(supabase, studentId, student.school_id, recipientUserIds);
    } else {
      // 'school' or 'admin'
      await addSchoolAdmins(supabase, student.school_id, recipientUserIds);
    }
  } else if (isEscort) {
    if (recipientType === 'parent') {
      const { data: links } = await supabase
        .from('student_parents')
        .select('parent_user_id')
        .eq('student_id', studentId);

      if (links) {
        links.forEach((l: any) => {
          if (l.parent_user_id && !recipientUserIds.includes(l.parent_user_id)) {
            recipientUserIds.push(l.parent_user_id);
          }
        });
      }
    } else if (recipientType === 'gate_officer' || recipientType === 'gate') {
      await addGateOfficers(supabase, student.school_id, recipientUserIds);
    } else if (recipientType === 'city_manager') {
      await addCityManagers(supabase, recipientUserIds);
    } else if (recipientType === 'school' || recipientType === 'admin') {
      await addSchoolAdmins(supabase, student.school_id, recipientUserIds);
    }
  } else if (isTeacher || isAdmin) {
    if (recipientType === 'parent') {
      const { data: links } = await supabase
        .from('student_parents')
        .select('parent_user_id')
        .eq('student_id', studentId);

      if (links) {
        links.forEach((l: any) => {
          if (l.parent_user_id && !recipientUserIds.includes(l.parent_user_id)) {
            recipientUserIds.push(l.parent_user_id);
          }
        });
      }
    } else if (recipientType === 'teacher') {
      await addTeachersForClass(supabase, student.class_id, recipientUserIds);
    } else if (recipientType === 'gate_officer' || recipientType === 'gate') {
      await addGateOfficers(supabase, student.school_id, recipientUserIds);
    } else if (recipientType === 'city_manager') {
      await addCityManagers(supabase, recipientUserIds);
    } else if (recipientType === 'escort') {
      await addEscortsForStudent(supabase, studentId, student.school_id, recipientUserIds);
    } else if (recipientType === 'school' || recipientType === 'admin') {
      await addSchoolAdmins(supabase, student.school_id, recipientUserIds);
    }
  }

  return recipientUserIds;
}

/**
 * Build the notification title for a chat message (used for push/email alerts).
 */
export function buildChatTitle(
  session: AppSession,
  recipientType: string,
  studentName: string
): string {
  const isParent = session.roles.some((r) => r.role === 'parent');
  const isTeacher = session.roles.some((r) => r.role === 'teacher' || r.role === 'staff');
  const isEscort = session.roles.some((r) =>
    r.role === 'myeduride_escort' ||
    r.role === 'school_escort' ||
    r.role === 'escort' ||
    r.role === 'driver'
  );

  if (isEscort) {
    if (recipientType === 'parent') return `Chat: Escort to Parent (${studentName})`;
    if (recipientType === 'gate_officer' || recipientType === 'gate') return `Chat: Escort to Gate Officer (${studentName})`;
    if (recipientType === 'city_manager') return `Chat: Escort to City Manager (${studentName})`;
    return `Chat: Escort to ${recipientType} (${studentName})`;
  }

  if (isParent) {
    if (recipientType === 'teacher') return `Chat: Parent to Teacher (${studentName})`;
    if (recipientType === 'escort') return `Chat: Parent to Escort (${studentName})`;
    return `Chat: Parent to School (${studentName})`;
  }

  if (isTeacher) {
    if (recipientType === 'parent') return `Chat: Teacher to Parent (${studentName})`;
    if (recipientType === 'teacher') return `Chat: Teacher to Teacher (${studentName})`;
    if (recipientType === 'escort') return `Chat: Teacher to Escort (${studentName})`;
    return `Chat: Teacher to School (${studentName})`;
  }

  // Admin / City Manager / Gate Officer
  if (recipientType === 'parent') return `Chat: School to Parent (${studentName})`;
  if (recipientType === 'teacher') return `Chat: Admin to Teacher (${studentName})`;
  if (recipientType === 'escort') return `Chat: Operations to Escort (${studentName})`;
  if (recipientType === 'gate_officer' || recipientType === 'gate') return `Chat: Operations to Gate Officer (${studentName})`;
  return `Chat: Admin to School (${studentName})`;
}

// ---- Helpers ----

async function addTeachersForClass(
  supabase: ReturnType<typeof getAdminClient>,
  classId: string | null,
  recipientUserIds: string[]
) {
  if (!classId) return;

  const { data: classRow } = await supabase
    .from('school_classes')
    .select('assigned_teacher_id')
    .eq('id', classId)
    .maybeSingle();

  const teacherProfileIds: string[] = [];
  if (classRow?.assigned_teacher_id) {
    teacherProfileIds.push(classRow.assigned_teacher_id);
  }

  const { data: assignments } = await supabase
    .from('teacher_class_assignments')
    .select('teacher_profile_id')
    .eq('class_id', classId);

  if (assignments) {
    assignments.forEach((a: any) => {
      if (a.teacher_profile_id && !teacherProfileIds.includes(a.teacher_profile_id)) {
        teacherProfileIds.push(a.teacher_profile_id);
      }
    });
  }

  if (teacherProfileIds.length > 0) {
    const { data: profiles } = await supabase
      .from('teacher_profiles')
      .select('user_id')
      .in('id', teacherProfileIds);

    if (profiles) {
      profiles.forEach((p: any) => {
        if (p.user_id && !recipientUserIds.includes(p.user_id)) {
          recipientUserIds.push(p.user_id);
        }
      });
    }
  }
}

async function addSchoolAdmins(
  supabase: ReturnType<typeof getAdminClient>,
  schoolId: string,
  recipientUserIds: string[]
) {
  const { data: admins } = await supabase
    .from('user_school_roles')
    .select('user_id')
    .eq('school_id', schoolId)
    .in('role', ['school_admin', 'super_admin'])
    .eq('is_active', true);

  if (admins) {
    admins.forEach((a: any) => {
      if (a.user_id && !recipientUserIds.includes(a.user_id)) {
        recipientUserIds.push(a.user_id);
      }
    });
  }
}

async function addGateOfficers(
  supabase: ReturnType<typeof getAdminClient>,
  schoolId: string,
  recipientUserIds: string[]
) {
  const { data: gates } = await supabase
    .from('user_school_roles')
    .select('user_id')
    .eq('school_id', schoolId)
    .in('role', ['gate_officer', 'gate'])
    .eq('is_active', true);

  if (gates) {
    gates.forEach((g: any) => {
      if (g.user_id && !recipientUserIds.includes(g.user_id)) {
        recipientUserIds.push(g.user_id);
      }
    });
  }
}

async function addCityManagers(
  supabase: ReturnType<typeof getAdminClient>,
  recipientUserIds: string[]
) {
  const { data: managers } = await supabase
    .from('user_school_roles')
    .select('user_id')
    .in('role', ['city_manager', 'super_admin'])
    .eq('is_active', true);

  if (managers) {
    managers.forEach((m: any) => {
      if (m.user_id && !recipientUserIds.includes(m.user_id)) {
        recipientUserIds.push(m.user_id);
      }
    });
  }
}

async function addEscortsForStudent(
  supabase: ReturnType<typeof getAdminClient>,
  studentId: string,
  schoolId: string,
  recipientUserIds: string[]
) {
  // Check active transport bookings
  const { data: bookings } = await supabase
    .from('transport_bookings')
    .select('assigned_escort_id')
    .eq('student_id', studentId)
    .not('assigned_escort_id', 'is', null);

  if (bookings && bookings.length > 0) {
    const escortIds = bookings.map((b: any) => b.assigned_escort_id).filter(Boolean);
    const { data: apps } = await supabase
      .from('escort_applications')
      .select('user_id')
      .in('id', escortIds)
      .not('user_id', 'is', null);

    if (apps) {
      apps.forEach((a: any) => {
        if (a.user_id && !recipientUserIds.includes(a.user_id)) {
          recipientUserIds.push(a.user_id);
        }
      });
    }
  }

  // Check escort_assignments
  const { data: assignments } = await supabase
    .from('escort_assignments')
    .select('escort_application_id')
    .eq('student_id', studentId);

  if (assignments && assignments.length > 0) {
    const escortAppIds = assignments.map((a: any) => a.escort_application_id).filter(Boolean);
    const { data: apps } = await supabase
      .from('escort_applications')
      .select('user_id')
      .in('id', escortAppIds)
      .not('user_id', 'is', null);

    if (apps) {
      apps.forEach((a: any) => {
        if (a.user_id && !recipientUserIds.includes(a.user_id)) {
          recipientUserIds.push(a.user_id);
        }
      });
    }
  }
}
