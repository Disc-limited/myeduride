import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getSessionFromRequest, sessionHasRole } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session || !sessionHasRole(session, 'super_admin')) {
    return NextResponse.json({ error: 'Super admin access required' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const selectedSchoolId = searchParams.get('school_id')?.trim();

  try {
    const supabase = getAdminClient();

    // 1. Fetch all schools for dropdown filter & name lookup
    const { data: schools, error: schoolsErr } = await supabase
      .from('schools')
      .select('id, name, address')
      .order('name');

    if (schoolsErr) {
      return NextResponse.json({ error: schoolsErr.message }, { status: 500 });
    }

    const schoolsList = schools || [];
    const schoolMap = new Map<string, string>(schoolsList.map((s) => [s.id, s.name]));

    // 2. Fetch active students (optionally filtered by school)
    let studentsQuery = supabase
      .from('students')
      .select('id, first_name, last_name, student_id_number, school_id, custom_fields, class:school_classes(name)')
      .eq('is_active', true)
      .order('last_name');

    if (selectedSchoolId && selectedSchoolId !== 'all') {
      studentsQuery = studentsQuery.eq('school_id', selectedSchoolId);
    }

    const { data: students, error: studErr } = await studentsQuery;
    if (studErr) {
      return NextResponse.json({ error: studErr.message }, { status: 500 });
    }

    const safeStudents = students || [];
    const studentIds = safeStudents.map((s) => s.id);

    // 3. Batch fetch student_parents links
    const links: Array<{ student_id: string; parent_user_id: string; is_primary: boolean }> = [];
    if (studentIds.length > 0) {
      for (let i = 0; i < studentIds.length; i += 1000) {
        const batch = studentIds.slice(i, i + 1000);
        const { data: batchLinks } = await supabase
          .from('student_parents')
          .select('student_id, parent_user_id, is_primary')
          .in('student_id', batch);
        if (batchLinks?.length) links.push(...batchLinks);
      }
    }

    // 4. Batch fetch parent user profiles
    const linkedUserIds = [...new Set(links.map((l) => l.parent_user_id).filter(Boolean))];
    const profileById = new Map<
      string,
      { id: string; full_name: string | null; username: string | null; phone: string | null; email: string | null }
    >();

    if (linkedUserIds.length > 0) {
      for (let i = 0; i < linkedUserIds.length; i += 1000) {
        const batch = linkedUserIds.slice(i, i + 1000);
        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('id, full_name, username, phone, email')
          .in('id', batch);
        if (profiles) {
          for (const p of profiles) profileById.set(p.id, p);
        }
      }
    }

    // Also fetch registered parent profiles with role = 'parent' (optionally filtered by school)
    let roleParentQuery = supabase
      .from('user_profiles')
      .select('id, full_name, username, phone, email, school_id')
      .eq('role', 'parent');

    if (selectedSchoolId && selectedSchoolId !== 'all') {
      roleParentQuery = roleParentQuery.eq('school_id', selectedSchoolId);
    }

    const { data: registeredParents } = await roleParentQuery;
    if (registeredParents) {
      for (const p of registeredParents) {
        if (!profileById.has(p.id)) profileById.set(p.id, p);
      }
    }

    // 5. Build student lookup dictionary
    const studentById = new Map(
      safeStudents.map((s) => {
        const cls = s.class as { name?: string } | { name?: string }[] | null;
        const className = Array.isArray(cls) ? cls[0]?.name : cls?.name;
        return [
          s.id,
          {
            student_id: s.id,
            student_name: `${s.first_name || ''} ${s.last_name || ''}`.trim(),
            class_name: className || null,
            student_id_number: s.student_id_number || '',
            school_id: s.school_id,
            custom_fields: s.custom_fields,
          },
        ];
      })
    );

    // 6. Aggregate Parents into unified directory rows
    const parentsMap = new Map<
      string,
      {
        id: string | null;
        name: string;
        phone: string | null;
        username: string | null;
        has_login: boolean;
        school_id: string;
        school_name: string;
        children: Array<{
          student_id: string;
          student_name: string;
          class_name: string | null;
          student_id_number: string;
        }>;
      }
    >();

    const studentsWithLinks = new Set<string>();

    // A) Process parents linked through student_parents
    for (const link of links) {
      const student = studentById.get(link.student_id);
      if (!student) continue;
      studentsWithLinks.add(student.student_id);

      const profile = profileById.get(link.parent_user_id);
      const parentId = link.parent_user_id;
      const key = `user:${parentId}`;

      const childInfo = {
        student_id: student.student_id,
        student_name: student.student_name,
        class_name: student.class_name,
        student_id_number: student.student_id_number,
      };

      const existing = parentsMap.get(key);
      if (existing) {
        if (!existing.children.some((c) => c.student_id === childInfo.student_id)) {
          existing.children.push(childInfo);
        }
      } else {
        const schoolName = schoolMap.get(student.school_id) || 'School';
        parentsMap.set(key, {
          id: parentId,
          name: profile?.full_name || profile?.username || 'Parent',
          phone: profile?.phone || null,
          username: profile?.username || null,
          has_login: !!profile?.username,
          school_id: student.school_id,
          school_name: schoolName,
          children: [childInfo],
        });
      }
    }

    // B) Process students with parents on file in custom_fields (unlinked / pending registration)
    for (const student of safeStudents) {
      if (studentsWithLinks.has(student.id)) continue;

      const cf = (student.custom_fields || {}) as Record<string, any>;
      const onFileName = (cf.parent_name || cf.guardian_name || cf.father_name || cf.mother_name || '').trim();
      const onFilePhone = (cf.parent_phone || cf.guardian_phone || cf.phone || '').trim();
      const onFileEmail = (cf.parent_email || cf.guardian_email || cf.email || '').trim();
      const onFileUsername = (cf.parent_username || cf.username || '').trim();

      if (!onFileName && !onFilePhone && !onFileEmail && !onFileUsername) continue;

      const cls = student.class as { name?: string } | { name?: string }[] | null;
      const className = Array.isArray(cls) ? cls[0]?.name : cls?.name;
      const childInfo = {
        student_id: student.id,
        student_name: `${student.first_name || ''} ${student.last_name || ''}`.trim(),
        class_name: className || null,
        student_id_number: student.student_id_number || '',
      };

      const key = onFileUsername
        ? `username:${onFileUsername.toLowerCase()}`
        : onFilePhone
        ? `phone:${onFilePhone}`
        : `name:${onFileName.toLowerCase()}|${student.school_id}`;

      const existing = parentsMap.get(key);
      if (existing) {
        if (!existing.children.some((c) => c.student_id === childInfo.student_id)) {
          existing.children.push(childInfo);
        }
      } else {
        const schoolName = schoolMap.get(student.school_id) || 'School';
        parentsMap.set(key, {
          id: null,
          name: onFileName || onFileUsername || 'Parent on File',
          phone: onFilePhone || null,
          username: onFileUsername || null,
          has_login: false,
          school_id: student.school_id,
          school_name: schoolName,
          children: [childInfo],
        });
      }
    }

    // C) Also include any registered parent profiles that don't have children linked yet
    if (registeredParents) {
      for (const p of registeredParents) {
        const key = `user:${p.id}`;
        if (!parentsMap.has(key)) {
          const schoolName = p.school_id ? (schoolMap.get(p.school_id) || 'School') : 'Platform';
          parentsMap.set(key, {
            id: p.id,
            name: p.full_name || p.username || 'Parent',
            phone: p.phone || null,
            username: p.username || null,
            has_login: !!p.username,
            school_id: p.school_id || '',
            school_name: schoolName,
            children: [],
          });
        }
      }
    }

    // 7. Sort children and sort parents alphabetically
    const allParents = [...parentsMap.values()].map((p) => ({
      ...p,
      children: p.children.sort((a, b) => a.student_name.localeCompare(b.student_name)),
    })).sort((a, b) => a.name.localeCompare(b.name));

    const withLoginCount = allParents.filter((p) => p.has_login).length;

    return NextResponse.json({
      schools: schoolsList,
      parents: allParents,
      total: allParents.length,
      with_login: withLoginCount,
      no_login: allParents.length - withLoginCount,
    });
  } catch (error: unknown) {
    console.error('[GET /api/super-admin/parents] error:', error);
    const message = error instanceof Error ? error.message : 'Failed to load parents data';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
