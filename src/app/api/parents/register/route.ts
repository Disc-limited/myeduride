import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { ensureAuthUser, ensureUserProfile } from '@/lib/auth/ensure-user';
import { suggestUniqueUsername, normalizeUsername } from '@/lib/auth/username';
import { validatePasswordPair } from '@/lib/auth/password-policy';

export const dynamic = 'force-dynamic';

/** Public API — Parent Self-Registration */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      fullName,
      email,
      phone,
      password,
      confirmPassword,
      dob,
      gender,
      address,
      emergencyContact,
      children,
      schoolName,
      preferences,
      notifications,
      pin,
    } = body;

    const parentName = (fullName || '').trim();
    if (!parentName) {
      return NextResponse.json({ error: 'Full name is required' }, { status: 400 });
    }

    const pwErr = validatePasswordPair(password || '', confirmPassword || password || '');
    if (pwErr) {
      return NextResponse.json({ error: pwErr }, { status: 400 });
    }

    const supabase = getAdminClient();

    // Determine normalized email & username
    const normalizedEmail = email?.trim() ? email.toLowerCase().trim() : null;
    const baseName = normalizedEmail ? normalizedEmail.split('@')[0] : parentName;
    const parentUsername = await suggestUniqueUsername(supabase, baseName);

    // 1. Create Auth User in Supabase Auth
    const { userId, username: createdUsername, error: authErr } = await ensureAuthUser(supabase, {
      username: parentUsername,
      email: normalizedEmail,
      full_name: parentName,
      password,
    });

    if (!userId) {
      return NextResponse.json(
        { error: `Failed to create parent account: ${authErr || 'Unknown error'}` },
        { status: 400 }
      );
    }

    // 2. Save user profile in `user_profiles` table
    const { error: profileError } = await ensureUserProfile(supabase, {
      id: userId,
      username: createdUsername || parentUsername,
      full_name: parentName,
      phone: phone?.trim() || null,
      email: normalizedEmail,
    });

    if (profileError) {
      return NextResponse.json(
        { error: `Failed to save parent profile: ${profileError.message}` },
        { status: 500 }
      );
    }

    // 3. Attach metadata & extra fields (DOB, Address, Emergency Contact, Children, PIN) to user_metadata or profiles
    await supabase.auth.admin.updateUserById(userId, {
      user_metadata: {
        role: 'parent',
        full_name: parentName,
        dob: dob || null,
        gender: gender || null,
        address: address || null,
        emergency_contact: emergencyContact || null,
        children: children || [],
        school_name: schoolName || null,
        preferences: preferences || {},
        notifications: notifications || {},
        security_pin: pin ? pin.join('') : null,
      },
    }).catch(() => {});

    return NextResponse.json({
      ok: true,
      user_id: userId,
      username: createdUsername || parentUsername,
      email: normalizedEmail,
      message: 'Parent account created successfully',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Registration failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
