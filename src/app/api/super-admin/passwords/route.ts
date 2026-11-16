import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getSessionFromRequest, sessionHasRole } from '@/lib/session';
import { getPlatformSchoolId } from '@/lib/auth/super-admin';
import { parentInfoFromCustomFields } from '@/lib/school/provision-parent-for-student';

export const dynamic = 'force-dynamic';

const STAFF_ROLES = new Set(['school_admin', 'teacher', 'gate_officer', 'staff']);

type CredentialUser = {
  id: string;
  username: string;
  full_name: string;
  email?: string | null;
  phone?: string | null;
  roles: string[];
  password: string;
  staff_id_number?: string | null;
  failed_login_attempts?: number;
  locked_until?: string | null;
};

type AuthorisedPickupPerson = {
  id: string;
  name: string;
  phone: string | null;
  relationship: string | null;
};

type StudentParentCredential = {
  student_id: string;
  student_name: string;
  student_id_number: string;
  class_name: string | null;
  parent_user_id: string | null;
  parent_name: string;
  parent_username: string;
  parent_username_on_file?: string;
  password: string;
  parent_on_file_name?: string;
  parent_phone?: string | null;
  parent_email?: string | null;
  authorised_pickup_persons?: AuthorisedPickupPerson[];
  primary_pickup_person?: string | null;
  needs_parent_account?: boolean;
};

type SchoolCredentials = {
  id: string;
  name: string;
  address: string | null;
  staff: CredentialUser[];
  parents: CredentialUser[];
  students: StudentParentCredential[];
  other: CredentialUser[];
  users: CredentialUser[];
  total_users: number;
};

function toUserRow(
  profile: {
    id: string;
    username: string | null;
    full_name: string | null;
    failed_login_attempts?: number;
    locked_until?: string | null;
    email?: string | null;
    phone?: string | null;
  },
  roles: string[],
  password: string,
  staffIdNumber?: string | null
): CredentialUser {
  return {
    id: profile.id,
    username: profile.username || '',
    full_name: profile.full_name || '',
    email: profile.email || '',
    phone: profile.phone || '',
    roles: [...roles].sort(),
    password,
    staff_id_number: staffIdNumber ?? null,
    failed_login_attempts: profile.failed_login_attempts || 0,
    locked_until: profile.locked_until || null,
  };
}

export async function GET(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session || !sessionHasRole(session, 'super_admin')) {
    return NextResponse.json({ error: 'Super admin access required' }, { status: 403 });
  }

  try {
    const supabase = getAdminClient();
    const platformSchoolId = getPlatformSchoolId();

    // High-performance bulk data load across all required tables in parallel
    const [
      schoolsRes,
      authUsersRes,
      rolesRes,
      profilesRes,
      teachersRes,
      studentsRes,
      parentLinksRes,
      pickupsRes,
    ] = await Promise.all([
      supabase.from('schools').select('id, name, address').order('name'),
      supabase.auth.admin.listUsers({ perPage: 1000 }),
      supabase.from('user_school_roles').select('user_id, school_id, role').eq('is_active', true).limit(10000),
      supabase.from('user_profiles').select('id, username, full_name, email, phone, failed_login_attempts, locked_until').limit(10000),
      supabase.from('teacher_profiles').select('user_id, school_id, staff_id_number').limit(10000),
      supabase.from('students').select('id, school_id, first_name, last_name, student_id_number, custom_fields, class:school_classes(name)').eq('is_active', true).order('last_name').limit(10000),
      supabase.from('student_parents').select('student_id, parent_user_id, is_primary').limit(10000),
      supabase.from('pickup_authorizations').select('id, student_id, name, relationship, phone, photo_url, slot_number').order('slot_number', { ascending: true }).limit(10000),
    ]);

    if (schoolsRes.error) {
      return NextResponse.json({ error: schoolsRes.error.message }, { status: 500 });
    }

    const schools = schoolsRes.data || [];
    const profiles = profilesRes.data || [];
    const roles = rolesRes.data || [];
    const teachers = teachersRes.data || [];
    const studentsRaw = studentsRes.data || [];
    const parentLinks = parentLinksRes.data || [];
    const pickups = pickupsRes.data || [];
    const authUsers = authUsersRes.data?.users || [];

    // Build fast lookup maps
    const profileById = new Map<string, any>();
    for (const p of profiles) {
      profileById.set(p.id, p);
    }

    const authById = new Map<string, string>();
    for (const u of authUsers) {
      const pw = (u.user_metadata?.login_password as string) || '';
      authById.set(u.id, pw);
    }

    const staffIdByUserSchool = new Map<string, string | null>();
    for (const t of teachers) {
      staffIdByUserSchool.set(`${t.user_id}:${t.school_id}`, t.staff_id_number);
    }

    const rolesBySchoolUser = new Map<string, Map<string, string[]>>();
    const superAdminUserIds = new Set<string>();

    for (const row of roles) {
      if (!row.user_id) continue;
      if (row.role === 'super_admin') {
        superAdminUserIds.add(row.user_id);
      }
      if (!row.school_id) continue;
      if (!rolesBySchoolUser.has(row.school_id)) {
        rolesBySchoolUser.set(row.school_id, new Map());
      }
      const userMap = rolesBySchoolUser.get(row.school_id)!;
      if (!userMap.has(row.user_id)) userMap.set(row.user_id, []);
      userMap.get(row.user_id)!.push(row.role);
    }

    // Match super admins by username / email
    for (const p of profiles) {
      const uLower = (p.username || '').toLowerCase();
      const eLower = (p.email || '').toLowerCase();
      if (uLower === 'superadmin' || uLower === 'admin' || eLower === 'admin@myeduride.com') {
        superAdminUserIds.add(p.id);
      }
    }

    const sortUsers = (a: CredentialUser, b: CredentialUser) =>
      (a.full_name || a.username).localeCompare(b.full_name || b.username);

    const superAdmins: CredentialUser[] = [];
    for (const uid of superAdminUserIds) {
      const profile = profileById.get(uid);
      if (!profile) continue;
      const password = authById.get(uid) || '';
      const staffId = staffIdByUserSchool.get(`${uid}:${platformSchoolId}`) ?? null;
      superAdmins.push(toUserRow(profile, ['super_admin'], password, staffId));
    }
    superAdmins.sort(sortUsers);

    // Group students by school
    const studentsBySchool = new Map<string, any[]>();
    for (const s of studentsRaw) {
      if (!studentsBySchool.has(s.school_id)) studentsBySchool.set(s.school_id, []);
      studentsBySchool.get(s.school_id)!.push(s);
    }

    // Group parent links by student
    const linksByStudent = new Map<string, any[]>();
    for (const l of parentLinks) {
      if (!linksByStudent.has(l.student_id)) linksByStudent.set(l.student_id, []);
      linksByStudent.get(l.student_id)!.push(l);
    }

    // Group pickup authorizations by student
    const pickupsByStudent = new Map<string, AuthorisedPickupPerson[]>();
    for (const pk of pickups) {
      const sid = pk.student_id;
      if (!pickupsByStudent.has(sid)) pickupsByStudent.set(sid, []);
      pickupsByStudent.get(sid)!.push({
        id: pk.id,
        name: pk.name,
        phone: pk.phone || null,
        relationship: pk.relationship || `Slot ${pk.slot_number || 1}`,
      });
    }

    const schoolCredentials: SchoolCredentials[] = [];

    for (const school of schools) {
      if (school.id === platformSchoolId) continue;

      const userMap = rolesBySchoolUser.get(school.id);
      const staff: CredentialUser[] = [];
      const parents: CredentialUser[] = [];
      const other: CredentialUser[] = [];
      const studentParentIds = new Set<string>();

      const rawSchoolStudents = studentsBySchool.get(school.id) || [];
      const students: StudentParentCredential[] = [];

      for (const st of rawSchoolStudents) {
        const cls = st.class as { name?: string } | { name?: string }[] | null;
        const className = Array.isArray(cls) ? cls[0]?.name : cls?.name;
        const onFile = parentInfoFromCustomFields(st.custom_fields);
        const authorised = pickupsByStudent.get(st.id) || [];
        const links = linksByStudent.get(st.id) || [];
        const primary = links.find((l) => l.is_primary) || links[0] || null;

        let parentUserId: string | null = null;
        let parentName = onFile.parent_name;
        let parentUsername = '';
        let password = '';

        const pid = primary?.parent_user_id;
        if (pid) {
          parentUserId = pid;
          studentParentIds.add(pid);
          const pProfile = profileById.get(pid);
          parentName = pProfile?.full_name || onFile.parent_name;
          parentUsername = pProfile?.username?.trim() || '';
          password = authById.get(pid) || '';
        }

        students.push({
          student_id: st.id,
          student_name: `${st.first_name || ''} ${st.last_name || ''}`.trim(),
          student_id_number: st.student_id_number || '',
          class_name: className || null,
          parent_user_id: parentUserId,
          parent_name: parentName,
          parent_username: parentUsername,
          parent_username_on_file: onFile.parent_username || '',
          password,
          parent_on_file_name: onFile.parent_name,
          parent_phone: onFile.parent_phone,
          parent_email: onFile.parent_email,
          authorised_pickup_persons: authorised,
          primary_pickup_person: authorised[0]?.name || null,
          needs_parent_account: !parentUserId && (!!onFile.parent_name || !!onFile.parent_username),
        });
      }

      if (userMap) {
        for (const [userId, uRoles] of userMap.entries()) {
          const profile = profileById.get(userId);
          if (!profile) continue;

          // Skip pure super admin users from school user lists
          if (superAdminUserIds.has(userId) && !uRoles.some((r) => r !== 'super_admin')) {
            continue;
          }

          const password = authById.get(userId) || '';
          const staffId = staffIdByUserSchool.get(`${userId}:${school.id}`) ?? null;
          const row = toUserRow(profile, uRoles, password, staffId);

          const isParentOnly = uRoles.every((r) => r === 'parent');
          const isStaff = uRoles.some((r) => STAFF_ROLES.has(r));

          if (isStaff) staff.push(row);
          else if (isParentOnly) {
            if (!studentParentIds.has(userId)) parents.push(row);
          } else other.push(row);
        }
      }

      staff.sort(sortUsers);
      parents.sort(sortUsers);
      other.sort(sortUsers);
      students.sort((a, b) => a.student_name.localeCompare(b.student_name));
      const users = [...staff, ...parents, ...other];

      schoolCredentials.push({
        id: school.id,
        name: school.name,
        address: school.address,
        staff,
        parents,
        students,
        other,
        users,
        total_users: users.length + students.filter((s) => s.parent_user_id).length,
      });
    }

    const totalUsers =
      superAdmins.length + schoolCredentials.reduce((n, s) => n + s.total_users, 0);
    const totalStudents = schoolCredentials.reduce((n, s) => n + s.students.length, 0);
    const totalStaff = schoolCredentials.reduce((n, s) => n + s.staff.length, 0);

    const availableLetters = Array.from(
      new Set(
        schoolCredentials
          .map((s) => s.name.trim().charAt(0).toUpperCase())
          .filter((c) => /[A-Z]/.test(c))
      )
    ).sort();

    return NextResponse.json({
      super_admins: superAdmins,
      schools: schoolCredentials,
      total_users: totalUsers,
      total_students: totalStudents,
      total_staff: totalStaff,
      total_schools: schoolCredentials.length,
      available_letters: availableLetters,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to load credentials';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
