import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getSessionFromRequest, sessionHasRole } from '@/lib/session';
import { isValidUsername, normalizeUsername, authEmailFromUsername } from '@/lib/auth/username';

export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session || !sessionHasRole(session, 'super_admin')) {
      return NextResponse.json({ error: 'Super admin access required' }, { status: 403 });
    }

    const { user_id, full_name, username, email, phone } = await request.json();

    if (!user_id || !full_name?.trim() || !username?.trim()) {
      return NextResponse.json({ error: 'User ID, Full Name, and Username are required' }, { status: 400 });
    }

    const normalizedUsername = normalizeUsername(username);
    if (!isValidUsername(normalizedUsername)) {
      return NextResponse.json(
        { error: 'Username must be 3–30 characters (letters, numbers, underscore only)' },
        { status: 400 }
      );
    }

    const supabase = getAdminClient();

    // Check username uniqueness
    const { data: existingUser } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('username', normalizedUsername)
      .neq('id', user_id)
      .maybeSingle();

    if (existingUser) {
      return NextResponse.json({ error: 'Username is already taken' }, { status: 409 });
    }

    // Check phone uniqueness
    if (phone?.trim()) {
      const { data: existingPhone } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('phone', phone.trim())
        .neq('id', user_id)
        .maybeSingle();
      if (existingPhone) {
        return NextResponse.json({ error: 'Phone number is already in use by another account' }, { status: 409 });
      }
    }

    // Sync Auth User
    const newAuthEmail = authEmailFromUsername(normalizedUsername);
    const { error: authErr } = await supabase.auth.admin.updateUserById(user_id, {
      email: newAuthEmail,
      email_confirm: true,
      user_metadata: {
        username: normalizedUsername,
        full_name: full_name.trim(),
      },
    });

    if (authErr) {
      return NextResponse.json({ error: `Auth sync failed: ${authErr.message}` }, { status: 500 });
    }

    // Update Profile
    const { error: profileErr } = await supabase
      .from('user_profiles')
      .update({
        username: normalizedUsername,
        full_name: full_name.trim(),
        phone: phone?.trim() || null,
        email: email?.trim() ? email.toLowerCase().trim() : null,
      })
      .eq('id', user_id);

    if (profileErr) {
      return NextResponse.json({ error: `Failed to update user profile: ${profileErr.message}` }, { status: 500 });
    }

    // Sync any student custom_fields (if parent)
    const { data: links } = await supabase
      .from('student_parents')
      .select('student_id')
      .eq('parent_user_id', user_id);

    if (links?.length) {
      const studentIds = links.map((l) => l.student_id);
      const { data: students } = await supabase
        .from('students')
        .select('id, custom_fields')
        .in('id', studentIds);

      for (const student of students || []) {
        const cf = { ...(student.custom_fields || {}) } as Record<string, any>;
        cf.parent_name = full_name.trim();
        cf.parent_username = normalizedUsername;
        cf.parent_phone = phone?.trim() || '';
        cf.parent_email = email?.trim() || '';

        await supabase
          .from('students')
          .update({ custom_fields: cf })
          .eq('id', student.id);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Super-admin user update error:', error);
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}
