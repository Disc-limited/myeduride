import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getSessionFromRequest, sessionHasRole } from '@/lib/session';
import { isValidUsername, normalizeUsername, authEmailFromUsername } from '@/lib/auth/username';
import { getCustomRole } from '@/lib/staff/custom-roles';

export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const {
      user_id,
      school_id,
      username,
      full_name,
      phone,
      contact_email,
      role,
      custom_role_id,
      class_id,
      teacher_responsibility,
    } = await request.json();

    const accessRole = role || 'staff';
    let finalTeacherResponsibility = teacher_responsibility || null;
    if (accessRole === 'teacher' && !finalTeacherResponsibility) {
      finalTeacherResponsibility = 'class_teacher';
    }

    if (!user_id || !school_id || !username?.trim() || !full_name?.trim() || !role) {
      return NextResponse.json({ error: 'Required fields are missing' }, { status: 400 });
    }

    const isSuperAdmin = sessionHasRole(session, 'super_admin');
    const isSchoolAdmin = session.roles.some(
      (r) => r.school_id === school_id && r.role === 'school_admin'
    );

    if (!isSuperAdmin && !isSchoolAdmin) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const normalizedUsername = normalizeUsername(username);
    if (!isValidUsername(normalizedUsername)) {
      return NextResponse.json(
        { error: 'Username must be 3–30 characters (letters, numbers, underscore only)' },
        { status: 400 }
      );
    }

    const supabase = getAdminClient();

    // Check if username is taken by another user
    const { data: existingUser } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('username', normalizedUsername)
      .neq('id', user_id)
      .maybeSingle();

    if (existingUser) {
      return NextResponse.json({ error: 'Username is already in use by another account' }, { status: 409 });
    }

    // Check if phone number is taken by another user
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

    // 1. Sync Supabase Auth User email and metadata
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

    // 2. Update User Profile
    const { error: profileErr } = await supabase
      .from('user_profiles')
      .update({
        username: normalizedUsername,
        full_name: full_name.trim(),
        phone: phone?.trim() || null,
        email: contact_email?.trim() ? contact_email.toLowerCase().trim() : null,
      })
      .eq('id', user_id);

    if (profileErr) {
      return NextResponse.json({ error: `Failed to update profile: ${profileErr.message}` }, { status: 500 });
    }

    // 3. Update User Roles
    const { error: deleteRoleErr } = await supabase
      .from('user_school_roles')
      .delete()
      .eq('user_id', user_id)
      .eq('school_id', school_id)
      .in('role', ['school_admin', 'teacher', 'gate_officer', 'staff']);

    if (deleteRoleErr) {
      return NextResponse.json({ error: `Failed to clear old roles: ${deleteRoleErr.message}` }, { status: 500 });
    }

    const rolesToInsert = [
      { user_id, school_id, role: 'staff', is_active: true }
    ];
    if (finalTeacherResponsibility === 'class_teacher' || finalTeacherResponsibility === 'subject_teacher' || finalTeacherResponsibility === 'both') {
      rolesToInsert.push({ user_id, school_id, role: 'teacher', is_active: true });
    }
    if (accessRole !== 'staff' && accessRole !== 'teacher') {
      rolesToInsert.push({ user_id, school_id, role: accessRole, is_active: true });
    }

    const { error: insertRoleErr } = await supabase
      .from('user_school_roles')
      .insert(rolesToInsert);

    if (insertRoleErr) {
      return NextResponse.json({ error: `Failed to assign role: ${insertRoleErr.message}` }, { status: 500 });
    }

    // 4. Update Teacher Profile
    const { data: existingTeacherProfile } = await supabase
      .from('teacher_profiles')
      .select('id')
      .eq('user_id', user_id)
      .eq('school_id', school_id)
      .maybeSingle();

    let teacherProfileId = existingTeacherProfile?.id;

    if (!teacherProfileId) {
      const staffIdNumber = `STF-${school_id.slice(0, 4).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
      const qrCodeData = `MYEDURIDE:STAFF:${staffIdNumber}`;
      const { data: newProfile, error: createProfileErr } = await supabase
        .from('teacher_profiles')
        .insert({
          user_id,
          school_id,
          staff_id_number: staffIdNumber,
          qr_code_data: qrCodeData,
          custom_role_id: custom_role_id || null,
          teacher_responsibility: finalTeacherResponsibility,
        })
        .select()
        .single();

      if (createProfileErr) {
        return NextResponse.json({ error: `Failed to create staff profile: ${createProfileErr.message}` }, { status: 500 });
      }
      teacherProfileId = newProfile.id;
    } else {
      const { error: updateProfileErr } = await supabase
        .from('teacher_profiles')
        .update({
          custom_role_id: custom_role_id || null,
          teacher_responsibility: finalTeacherResponsibility,
        })
        .eq('id', teacherProfileId);

      if (updateProfileErr) {
        return NextResponse.json({ error: `Failed to update staff profile: ${updateProfileErr.message}` }, { status: 500 });
      }
    }

    // 5. Update Class Assignment
    await supabase
      .from('teacher_class_assignments')
      .delete()
      .eq('teacher_profile_id', teacherProfileId);

    let customRole = null;
    if (accessRole === 'staff' && custom_role_id) {
      customRole = await getCustomRole(supabase, custom_role_id, school_id);
    }
    const mayAssignClass =
      finalTeacherResponsibility === 'class_teacher' ||
      finalTeacherResponsibility === 'both' ||
      (accessRole === 'staff' && !!customRole?.can_assign_class);

    if (class_id && mayAssignClass) {
      const { error: assignErr } = await supabase.from('teacher_class_assignments').upsert(
        {
          teacher_profile_id: teacherProfileId,
          class_id: class_id,
          is_primary: true,
        },
        { onConflict: 'teacher_profile_id,class_id' }
      );

      if (assignErr) {
        return NextResponse.json({ error: `Failed to assign class: ${assignErr.message}` }, { status: 500 });
      }

      await supabase
        .from('school_classes')
        .update({ assigned_teacher_id: teacherProfileId })
        .eq('id', class_id)
        .eq('school_id', school_id);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Staff update error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
