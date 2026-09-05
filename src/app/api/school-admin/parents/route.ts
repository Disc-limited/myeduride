import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getSessionFromRequest } from '@/lib/session';
import { getUnifiedSchoolParentsSummary } from '@/lib/school/school-parents-list';
import { todayInLagos, nowUtcIso } from '@/lib/timezone';
import { writeAuditLog } from '@/lib/audit/log';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session?.user_id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const explicitSchoolId = searchParams.get('school_id')?.trim();

  // Robust school ID determination matching other school-admin endpoints
  let schoolId =
    explicitSchoolId ||
    (session as any).primary_school?.id ||
    session.roles?.find((r: any) => r.role === 'school_admin' && r.school_id)?.school_id ||
    session.roles?.find((r: any) => r.school_id)?.school_id;

  const isSuperAdmin = session.roles?.some((r: any) => r.role === 'super_admin');
  const isSchoolAdmin = session.roles?.some(
    (r: any) => (r.role === 'school_admin' || r.role === 'gate_officer') && (!schoolId || r.school_id === schoolId)
  );

  const supabase = getAdminClient();

  if (!schoolId) {
    const { data: firstSchool } = await supabase.from('schools').select('id').order('name').limit(1).maybeSingle();
    schoolId = firstSchool?.id || null;
  }

  if (!schoolId) {
    return NextResponse.json({ error: 'School context could not be determined' }, { status: 400 });
  }

  if (!isSuperAdmin && !isSchoolAdmin && !session.roles?.length) {
    return NextResponse.json({ error: 'School admin access required' }, { status: 403 });
  }

  try {
    let summary: any = null;
    try {
      summary = await getUnifiedSchoolParentsSummary(supabase, schoolId, { autoDeduplicate: false });
    } catch (e) {
      console.warn('[GET /api/school-admin/parents] unified summary notice:', e);
    }

    let parentsList = summary?.parents || [];

    // Fallback: If no parents returned, aggregate from students & custom_fields directly
    if (parentsList.length === 0) {
      const { data: students } = await supabase
        .from('students')
        .select('id, first_name, last_name, student_id_number, custom_fields, class:school_classes(name)')
        .eq('school_id', schoolId)
        .eq('is_active', true);

      if (students && students.length > 0) {
        const fallbackMap = new Map<string, any>();
        for (const s of students) {
          const cf = (s.custom_fields || {}) as Record<string, any>;
          const parentName = (cf.parent_name || cf.guardian_name || '').trim();
          const parentPhone = (cf.parent_phone || cf.guardian_phone || '').trim();
          const cls = Array.isArray(s.class) ? s.class[0]?.name : (s.class as any)?.name;
          if (parentName) {
            const key = `${parentName.toLowerCase()}|${parentPhone}`;
            const childItem = {
              student_id: s.id,
              student_name: `${s.first_name} ${s.last_name}`.trim(),
              class_name: cls || null,
              student_id_number: s.student_id_number || '',
            };
            if (fallbackMap.has(key)) {
              fallbackMap.get(key).children.push(childItem);
            } else {
              fallbackMap.set(key, {
                id: null,
                name: parentName,
                phone: parentPhone || null,
                username: cf.parent_username || null,
                has_login: false,
                children: [childItem],
              });
            }
          }
        }
        parentsList = Array.from(fallbackMap.values());
      }
    }

    return NextResponse.json({
      school_id: schoolId,
      parents: parentsList,
      total: parentsList.length,
      with_login: parentsList.filter((p: any) => p.has_login).length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to load parents';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session?.user_id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      action,
      school_id: bodySchoolId,
      student_id,
      parent_name,
      parent_phone,
      parent_user_id,
      relationship = 'Parent',
      is_daily_dismissal = true,
      notes,
    } = body;

    const schoolId =
      bodySchoolId ||
      (session as any).primary_school?.id ||
      session.roles?.find((r: any) => r.school_id)?.school_id;

    if (!schoolId) {
      return NextResponse.json({ error: 'school_id required' }, { status: 400 });
    }

    const supabase = getAdminClient();
    const today = todayInLagos();
    const nowIso = nowUtcIso();

    if (action === 'assign_pickup') {
      if (!student_id || !parent_name?.trim()) {
        return NextResponse.json({ error: 'student_id and parent_name are required' }, { status: 400 });
      }

      const cleanName = parent_name.trim();
      const cleanPhone = parent_phone?.trim() || null;

      // 1. If daily dismissal requested, upsert dismissal_requests
      if (is_daily_dismissal) {
        const { data: existingDismissal } = await supabase
          .from('dismissal_requests')
          .select('id')
          .eq('school_id', schoolId)
          .eq('student_id', student_id)
          .eq('dismissal_date', today)
          .maybeSingle();

        if (existingDismissal) {
          await supabase
            .from('dismissal_requests')
            .update({
              pickup_person_name: cleanName,
              pickup_person_phone: cleanPhone,
              pickup_source: 'parent',
              notes: notes || `Assigned to parent ${cleanName}`,
              status: 'pending',
            })
            .eq('id', existingDismissal.id);
        } else {
          await supabase.from('dismissal_requests').insert({
            school_id: schoolId,
            student_id,
            dismissal_date: today,
            pickup_person_name: cleanName,
            pickup_person_phone: cleanPhone,
            pickup_source: 'parent',
            notes: notes || `Assigned to parent ${cleanName}`,
            status: 'pending',
          });
        }
      }

      // 2. Ensure parent is registered in pickup_persons and pickup_person_students
      let pickupPersonId: string | null = null;
      const { data: existingPerson } = await supabase
        .from('pickup_persons')
        .select('id')
        .eq('school_id', schoolId)
        .ilike('name', cleanName)
        .maybeSingle();

      if (existingPerson) {
        pickupPersonId = existingPerson.id;
      } else {
        const { data: newPerson } = await supabase
          .from('pickup_persons')
          .insert({
            school_id: schoolId,
            name: cleanName,
            phone: cleanPhone,
            relationship: relationship || 'Parent',
            created_by: session.user_id,
          })
          .select('id')
          .maybeSingle();

        if (newPerson) pickupPersonId = newPerson.id;
      }

      if (pickupPersonId) {
        const { data: existingLink } = await supabase
          .from('pickup_person_students')
          .select('id')
          .eq('school_id', schoolId)
          .eq('student_id', student_id)
          .eq('pickup_person_id', pickupPersonId)
          .maybeSingle();

        if (!existingLink) {
          await supabase.from('pickup_person_students').insert({
            school_id: schoolId,
            student_id,
            pickup_person_id: pickupPersonId,
          });
        }
      }

      // 3. If parent_user_id provided, ensure student_parents relation is saved
      if (parent_user_id) {
        const { data: existingSp } = await supabase
          .from('student_parents')
          .select('id')
          .eq('student_id', student_id)
          .eq('parent_user_id', parent_user_id)
          .maybeSingle();

        if (!existingSp) {
          await supabase.from('student_parents').insert({
            student_id,
            parent_user_id,
            relationship: relationship || 'Parent',
            is_primary: true,
          });
        }
      }

      // 4. Update student custom_fields if needed
      const { data: student } = await supabase
        .from('students')
        .select('id, first_name, last_name, custom_fields')
        .eq('id', student_id)
        .single();

      if (student) {
        const cf = { ...(student.custom_fields || {}) } as Record<string, any>;
        if (!cf.parent_name) cf.parent_name = cleanName;
        if (!cf.parent_phone && cleanPhone) cf.parent_phone = cleanPhone;

        await supabase
          .from('students')
          .update({ custom_fields: cf })
          .eq('id', student_id);
      }

      await writeAuditLog(supabase, {
        school_id: schoolId,
        actor_user_id: session.user_id,
        action: 'school_admin_assign_parent_pickup',
        entity_type: 'students',
        entity_id: student_id,
        details: { parent_name: cleanName, parent_phone: cleanPhone, is_daily_dismissal },
      });

      return NextResponse.json({
        success: true,
        message: `Successfully assigned ${cleanName} as pickup for ${student?.first_name || 'student'}`,
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: any) {
    console.error('[POST /api/school-admin/parents] error:', err);
    return NextResponse.json({ error: err.message || 'Failed to process request' }, { status: 500 });
  }
}

