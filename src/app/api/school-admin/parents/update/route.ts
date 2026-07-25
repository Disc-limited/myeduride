import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getSessionFromRequest, sessionHasRole } from '@/lib/session';
import { isValidUsername, normalizeUsername, authEmailFromUsername } from '@/lib/auth/username';

export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const {
      parent_user_id,
      student_id,
      student_ids,
      school_id,
      name,
      phone,
      email,
      username,
    } = await request.json();

    if (!school_id || !name?.trim()) {
      return NextResponse.json({ error: 'School ID and Parent Name are required' }, { status: 400 });
    }

    const isSuperAdmin = sessionHasRole(session, 'super_admin');
    const isSchoolAdmin = session.roles.some(
      (r) => r.school_id === school_id && r.role === 'school_admin'
    );

    if (!isSuperAdmin && !isSchoolAdmin) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const supabase = getAdminClient();

    // 1. Parent has an active login account
    if (parent_user_id) {
      let finalUsername = username ? normalizeUsername(username) : '';
      if (finalUsername) {
        if (!isValidUsername(finalUsername)) {
          return NextResponse.json(
            { error: 'Username must be 3–30 characters (letters, numbers, underscore only)' },
            { status: 400 }
          );
        }

        // Check uniqueness of username
        const { data: existingUser } = await supabase
          .from('user_profiles')
          .select('id')
          .eq('username', finalUsername)
          .neq('id', parent_user_id)
          .maybeSingle();

        if (existingUser) {
          return NextResponse.json({ error: 'Username is already taken by another account' }, { status: 409 });
        }
      }

      // Check uniqueness of phone number
      if (phone?.trim()) {
        const { data: existingPhone } = await supabase
          .from('user_profiles')
          .select('id')
          .eq('phone', phone.trim())
          .neq('id', parent_user_id)
          .maybeSingle();
        if (existingPhone) {
          return NextResponse.json({ error: 'Phone number is already in use by another account' }, { status: 409 });
        }
      }

      // Get current profile
      const { data: currentProfile } = await supabase
        .from('user_profiles')
        .select('username')
        .eq('id', parent_user_id)
        .maybeSingle();

      if (!finalUsername && currentProfile?.username) {
        finalUsername = currentProfile.username;
      }

      // Sync Supabase Auth User
      const newAuthEmail = authEmailFromUsername(finalUsername);
      const { error: authErr } = await supabase.auth.admin.updateUserById(parent_user_id, {
        email: newAuthEmail,
        email_confirm: true,
        user_metadata: {
          username: finalUsername,
          full_name: name.trim(),
        },
      });

      if (authErr) {
        return NextResponse.json({ error: `Auth sync failed: ${authErr.message}` }, { status: 500 });
      }

      // Update User Profile
      const { error: profileErr } = await supabase
        .from('user_profiles')
        .update({
          username: finalUsername,
          full_name: name.trim(),
          phone: phone?.trim() || null,
          email: email?.trim() ? email.toLowerCase().trim() : null,
        })
        .eq('id', parent_user_id);

      if (profileErr) {
        return NextResponse.json({ error: `Failed to update user profile: ${profileErr.message}` }, { status: 500 });
      }

      // Find all students linked to this parent
      const { data: links } = await supabase
        .from('student_parents')
        .select('student_id')
        .eq('parent_user_id', parent_user_id);

      if (links?.length) {
        const studentIds = links.map((l) => l.student_id);
        const { data: students } = await supabase
          .from('students')
          .select('id, custom_fields')
          .in('id', studentIds);

        for (const student of students || []) {
          const cf = { ...(student.custom_fields || {}) } as Record<string, any>;
          cf.parent_name = name.trim();
          cf.parent_username = finalUsername;
          cf.parent_phone = phone?.trim() || '';
          cf.parent_email = email?.trim() || '';

          await supabase
            .from('students')
            .update({ custom_fields: cf })
            .eq('id', student.id);
        }
      }
    } else {
      // 2. Parent is only on-file (no user_id login)
      const idsToUpdate = Array.isArray(student_ids) && student_ids.length > 0 ? student_ids : (student_id ? [student_id] : []);
      if (idsToUpdate.length === 0) {
        return NextResponse.json({ error: 'Student ID is required to update parent on-file details' }, { status: 400 });
      }

      for (const targetId of idsToUpdate) {
        const { data: student } = await supabase
          .from('students')
          .select('custom_fields')
          .eq('id', targetId)
          .single();

        if (student) {
          const cf = { ...(student.custom_fields || {}) } as Record<string, any>;
          cf.parent_name = name.trim();
          cf.parent_phone = phone?.trim() || '';
          cf.parent_email = email?.trim() || '';

          await supabase
            .from('students')
            .update({ custom_fields: cf })
            .eq('id', targetId);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Parent update error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
