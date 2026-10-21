import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getSessionFromRequest } from '@/lib/session';
import { deleteStoragePhoto } from '@/lib/storage/upload-photo';
import { writeAuditLog } from '@/lib/audit/log';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { student_id } = await request.json();
    if (!student_id) {
      return NextResponse.json({ error: 'student_id required' }, { status: 400 });
    }

    const supabase = getAdminClient();

    // 1. Fetch student to verify existence and school scope
    const { data: student, error: fetchErr } = await supabase
      .from('students')
      .select('id, school_id, first_name, last_name, photo_url')
      .eq('id', student_id)
      .single();

    if (fetchErr || !student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    // 2. Authorization check: Super Admin or School Admin of this specific school
    const isAuthorized = session.roles.some(
      (r: { role: string; school_id?: string }) =>
        r.role === 'super_admin' ||
        (r.role === 'school_admin' && (!r.school_id || r.school_id === student.school_id))
    );

    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'You do not have permission to delete this student' },
        { status: 403 }
      );
    }

    // 3. Find linked parents before breaking relationships
    const { data: parentLinks } = await supabase
      .from('student_parents')
      .select('parent_user_id')
      .eq('student_id', student_id);

    const parentIds = [...new Set((parentLinks || []).map((l) => l.parent_user_id))];

    // 4. Disassociate historical audit records where student_id is an optional foreign key
    // This preserves gate officer shifts, financial ledgers, and audit logs without FK violations
    await Promise.allSettled([
      supabase.from('gate_activity_logs').update({ student_id: null }).eq('student_id', student_id),
      supabase.from('audit_logs').update({ student_id: null }).eq('student_id', student_id),
      supabase.from('transport_bookings').update({ student_id: null }).eq('student_id', student_id),
      supabase.from('escort_assignments').update({ student_id: null }).eq('student_id', student_id),
      supabase.from('shared_ride_bookings').update({ student_id: null }).eq('student_id', student_id),
      supabase.from('escrow_holds').update({ student_id: null }).eq('student_id', student_id),
      supabase.from('wallet_transactions').update({ student_id: null }).eq('student_id', student_id),
    ]);

    // 5. Cascade-delete direct dependent child records in proper dependency order
    await Promise.allSettled([
      supabase.from('student_parents').delete().eq('student_id', student_id),
      supabase.from('attendance_records').delete().eq('student_id', student_id),
      supabase.from('dismissal_requests').delete().eq('student_id', student_id),
      supabase.from('pickup_requests').delete().eq('student_id', student_id),
      supabase.from('pickup_authorizations').delete().eq('student_id', student_id),
      supabase.from('pickup_notices').delete().eq('student_id', student_id),
      supabase.from('pickup_person_students').delete().eq('student_id', student_id),
      supabase.from('notifications').delete().eq('student_id', student_id),
      supabase.from('extra_lessons').delete().eq('student_id', student_id),
      supabase.from('student_route_assignments').delete().eq('student_id', student_id),
      supabase.from('student_class_promotions').delete().eq('student_id', student_id),
      supabase.from('escort_student_daily_trips').delete().eq('student_id', student_id),
      supabase.from('trip_legs').delete().eq('student_id', student_id),
    ]);

    // 6. Delete the student row
    const { error: deleteErr } = await supabase.from('students').delete().eq('id', student_id);
    if (deleteErr) {
      console.error('[students/delete] Failed to delete student:', deleteErr);
      return NextResponse.json({ error: deleteErr.message }, { status: 500 });
    }

    // 7. Clean up registered face/avatar photo in storage bucket
    if (student.photo_url) {
      await deleteStoragePhoto(supabase, student.photo_url).catch((err) => {
        console.warn('[students/delete] Photo cleanup warning:', err);
      });
    }

    // 8. Clean up orphaned parent roles if parent has no other children at this school
    const removedParents: string[] = [];

    for (const parentId of parentIds) {
      const { data: remainingLinks } = await supabase
        .from('student_parents')
        .select('student_id')
        .eq('parent_user_id', parentId);

      let hasOtherKidsAtSchool = false;
      if (remainingLinks?.length) {
        const otherIds = remainingLinks.map((l) => l.student_id);
        const { data: otherStudents } = await supabase
          .from('students')
          .select('school_id')
          .in('id', otherIds);
        hasOtherKidsAtSchool = (otherStudents || []).some((s) => s.school_id === student.school_id);
      }

      if (!hasOtherKidsAtSchool) {
        await supabase
          .from('user_school_roles')
          .delete()
          .eq('user_id', parentId)
          .eq('school_id', student.school_id)
          .eq('role', 'parent');

        await supabase
          .from('notifications')
          .delete()
          .eq('user_id', parentId)
          .eq('school_id', student.school_id);

        removedParents.push(parentId);
      }
    }

    // 9. Write audit log for accountability
    await writeAuditLog(supabase, {
      school_id: student.school_id,
      actor_user_id: session.user_id,
      action: 'DELETE_STUDENT',
      entity_type: 'students',
      entity_id: student.id,
      details: {
        actor_name: session.username || 'School Administrator',
        actor_role: session.roles[0]?.role || 'school_admin',
        student_name: `${student.first_name} ${student.last_name}`,
        removed_parents: removedParents,
      },
    }).catch(() => null);

    return NextResponse.json({
      success: true,
      parents_removed: removedParents.length,
    });
  } catch (err: any) {
    console.error('[students/delete] Unexpected error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
