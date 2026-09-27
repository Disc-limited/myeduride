import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getSessionFromRequest, sessionHasRole } from '@/lib/session';
import { isSuperAdminUsername } from '@/lib/auth/super-admin';
import { writeAuditLog } from '@/lib/audit/log';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session || !sessionHasRole(session, 'super_admin')) {
      return NextResponse.json({ error: 'Super admin access required' }, { status: 403 });
    }

    const { user_id } = await request.json();
    if (!user_id || typeof user_id !== 'string') {
      return NextResponse.json({ error: 'Valid user_id is required' }, { status: 400 });
    }

    // Safety: Cannot delete yourself
    if (session.user_id === user_id) {
      return NextResponse.json(
        { error: 'Cannot delete your own active super admin account' },
        { status: 400 }
      );
    }

    const supabase = getAdminClient();

    // 1. Fetch user profile
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('id, username, full_name, email, phone')
      .eq('id', user_id)
      .maybeSingle();

    // Check if target is a super admin
    if (profile?.username && isSuperAdminUsername(profile.username)) {
      // Count super admins
      const { data: allProfiles } = await supabase
        .from('user_profiles')
        .select('username');

      const superAdminCount = (allProfiles || []).filter((p) =>
        isSuperAdminUsername(p.username)
      ).length;

      if (superAdminCount <= 1) {
        return NextResponse.json(
          { error: 'Cannot delete the only remaining super admin account' },
          { status: 400 }
        );
      }
    }

    // 2. Fetch roles for auditing
    const { data: roles } = await supabase
      .from('user_school_roles')
      .select('role, school_id')
      .eq('user_id', user_id);

    const roleNames = (roles || []).map((r) => r.role);

    // 3. Foreign-key safe cleanup before profile deletion

    // student_parents
    await supabase.from('student_parents').delete().eq('parent_user_id', user_id);

    // pickup_requests
    await supabase.from('pickup_requests').delete().eq('parent_user_id', user_id);
    await supabase
      .from('pickup_requests')
      .update({ acknowledged_by: null })
      .eq('acknowledged_by', user_id);

    // pickup_notices
    await supabase
      .from('pickup_notices')
      .update({ created_by: null })
      .eq('created_by', user_id);

    // attendance_records
    await supabase
      .from('attendance_records')
      .update({ verified_by_user_id: null })
      .eq('verified_by_user_id', user_id);

    // staff_attendance
    await supabase
      .from('staff_attendance')
      .update({ verified_by_user_id: null })
      .eq('verified_by_user_id', user_id);
    await supabase.from('staff_attendance').delete().eq('user_id', user_id);

    // dismissal_requests
    await supabase.from('dismissal_requests').delete().eq('requested_by_user_id', user_id);

    // gate_activity_logs
    await supabase
      .from('gate_activity_logs')
      .update({ gate_officer_user_id: null })
      .eq('gate_officer_user_id', user_id);

    // gate_sessions
    await supabase.from('gate_sessions').delete().eq('gate_officer_user_id', user_id);

    // student_class_promotions
    await supabase
      .from('student_class_promotions')
      .update({ promoted_by: null })
      .eq('promoted_by', user_id);

    // extra_lessons
    await supabase.from('extra_lessons').delete().eq('teacher_user_id', user_id);

    // teacher_profiles & teacher_class_assignments
    const { data: teachers } = await supabase
      .from('teacher_profiles')
      .select('id')
      .eq('user_id', user_id);

    if (teachers && teachers.length > 0) {
      const teacherIds = teachers.map((t) => t.id);
      await supabase
        .from('teacher_class_assignments')
        .delete()
        .in('teacher_profile_id', teacherIds);
      await supabase.from('teacher_profiles').delete().eq('user_id', user_id);
    }

    // chat & communications
    await supabase.from('chat_messages').delete().eq('sender_id', user_id);
    await supabase.from('staff_private_messages').delete().eq('sender_id', user_id);
    await supabase.from('staff_private_messages').delete().eq('recipient_id', user_id);

    // notifications & presence
    await supabase.from('notifications').delete().eq('user_id', user_id);
    await supabase.from('push_subscriptions').delete().eq('user_id', user_id);
    await supabase.from('user_presence').delete().eq('user_id', user_id);

    // escort & shared rides
    await supabase.from('escort_applications').delete().eq('user_id', user_id);
    await supabase.from('shared_ride_escorts').delete().eq('user_id', user_id);

    // security & auth tokens
    await supabase.from('otp_codes').delete().eq('user_id', user_id);
    await supabase.from('password_reset_requests').delete().eq('user_id', user_id);
    await supabase.from('auth_security_events').delete().eq('user_id', user_id);

    // wallets
    await supabase.from('wallets').delete().eq('user_id', user_id);

    // user_school_roles
    await supabase.from('user_school_roles').delete().eq('user_id', user_id);

    // 4. Delete user_profiles
    const { error: profileErr } = await supabase
      .from('user_profiles')
      .delete()
      .eq('id', user_id);

    if (profileErr) {
      console.error('[super-admin/users/delete] profile delete failed:', profileErr);
    }

    // 5. Delete from Supabase Auth
    const { error: authErr } = await supabase.auth.admin.deleteUser(user_id);
    if (authErr) {
      console.warn('[super-admin/users/delete] auth user delete warning:', authErr.message);
    }

    // 6. Write audit log
    await writeAuditLog(supabase, {
      actor_user_id: session.user_id,
      action: 'user_account_deleted',
      details: {
        deleted_user_id: user_id,
        username: profile?.username || 'unknown',
        full_name: profile?.full_name || 'unknown',
        email: profile?.email || null,
        roles: roleNames,
      },
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: `Account for "${profile?.full_name || profile?.username || user_id}" has been deleted.`,
    });
  } catch (err: any) {
    console.error('[super-admin/users/delete] error:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to delete account' },
      { status: 500 }
    );
  }
}
