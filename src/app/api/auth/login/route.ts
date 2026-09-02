import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAdminClient } from '@/lib/supabase/admin';
import { ensureSuperAdminAccess } from '@/lib/auth/ensure-super-admin';
import { isSuperAdminUsername, DEFAULT_PLATFORM_SCHOOL_ID } from '@/lib/auth/super-admin';
import { findProfileByUsername } from '@/lib/auth/ensure-user';
import { authEmailFromUsername, isValidUsername, normalizeUsername } from '@/lib/auth/username';
import { writeAuditLog } from '@/lib/audit/log';

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

function getPublicSupabaseClient() {
  let url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  url = url.replace(/\/rest\/v1\/?.*$/, '').replace(/\/$/, '');
  return createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '', {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const rawInput = (body.username || '').trim();
    const password = (body.password || '').trim();
    const loginSchoolId = (body.school_id || '').trim() || null;

    if (!rawInput || !password) {
      return NextResponse.json({ error: 'Username and password are required' }, { status: 400 });
    }

    const supabase = getAdminClient();

    // 1. Flexible Profile Lookup by Email or Username
    let profile: any = null;

    if (rawInput.includes('@')) {
      const { data: pByEmail } = await supabase
        .from('user_profiles')
        .select('id, username, email, full_name, phone, avatar_url, failed_login_attempts, locked_until')
        .eq('email', rawInput.toLowerCase())
        .maybeSingle();
      if (pByEmail) {
        profile = pByEmail;
      }
    }

    if (!profile) {
      const normName = normalizeUsername(rawInput);
      if (normName) {
        if (isSuperAdminUsername(normName)) {
          const boot = await ensureSuperAdminAccess(supabase, normName);
          if (!boot.ok) {
            console.error('[login] super admin bootstrap:', boot.error);
          }
        }
        const { data: pByUsername } = await findProfileByUsername(supabase, normName);
        if (pByUsername) {
          profile = pByUsername;
        }
      }
    }

    // 2. Fallback: Search Escort Registration in Supabase DB & File Store
    let matchedEscortApp: any = null;
    if (!profile) {
      try {
        const cleanRaw = rawInput.toLowerCase().trim();
        const nameToken = cleanRaw.replace(/^escort\./i, '').replace(/[^a-z0-9]/g, '');

        // Check Supabase escort_applications table first
        const { data: dbApps } = await supabase
          .from('escort_applications')
          .select('*')
          .or(`email.ilike.${cleanRaw},full_name.ilike.%${nameToken}%,phone.eq.${cleanRaw}`)
          .limit(10);

        if (dbApps && dbApps.length > 0) {
          matchedEscortApp = dbApps.find((a: any) => {
            const aEmail = (a.email || '').toLowerCase().trim();
            const aName = (a.full_name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            return (
              aEmail === cleanRaw ||
              aName.includes(nameToken) ||
              nameToken.includes(aName) ||
              `escort.${aName}` === cleanRaw
            );
          }) || dbApps[0];
        }

        // Check local JSON store fallback
        if (!matchedEscortApp) {
          const { loadFileStore } = await import('@/lib/escort/escort-db');
          const fileStore = loadFileStore();
          matchedEscortApp = fileStore.find((a: any) => {
            const aEmail = (a.email || a.emailOrUsername || '').toLowerCase().trim();
            const aName = (a.fullName || a.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            const aUser = (a.username || a.emailOrUsername || '').toLowerCase().trim();
            return (
              aEmail === cleanRaw ||
              aUser === cleanRaw ||
              aName === nameToken ||
              aName.includes(nameToken) ||
              nameToken.includes(aName) ||
              `escort.${aName}` === cleanRaw
            );
          });
        }

        if (matchedEscortApp) {
          const targetUsername = (matchedEscortApp.username || rawInput || `escort.${(matchedEscortApp.fullName || matchedEscortApp.full_name || 'user').toLowerCase().replace(/[^a-z0-9]/g, '')}`).slice(0, 32);
          const { data: existingP } = await findProfileByUsername(supabase, normalizeUsername(targetUsername));
          if (existingP) {
            profile = existingP;
          } else {
            const matchedAny = matchedEscortApp as any;
            const escortUserId = matchedAny.user_id || matchedAny.id || `user-esc-${Math.floor(1000 + Math.random() * 9000)}`;
            profile = {
              id: escortUserId,
              username: targetUsername,
              email: matchedAny.email || matchedAny.emailOrUsername || `${normalizeUsername(targetUsername)}@login.myeduride.internal`,
              full_name: matchedAny.fullName || matchedAny.full_name || matchedAny.name || 'Escort Driver',
              phone: matchedAny.phone || null,
              avatar_url: matchedAny.photo || null,
              is_escort_fallback: true,
              escort_password: matchedAny.password,
            };

            // Ensure user profile in DB
            try {
              await supabase.from('user_profiles').upsert({
                id: profile.id,
                username: normalizeUsername(targetUsername),
                email: profile.email,
                full_name: profile.full_name,
                phone: profile.phone,
                avatar_url: profile.avatar_url,
              }, { onConflict: 'id' });
            } catch {}

            // Ensure escort role in DB
            try {
              await supabase.from('user_school_roles').upsert({
                user_id: profile.id,
                school_id: matchedAny.school_id || null,
                role: 'driver',
                is_active: true,
              }, { onConflict: 'user_id,school_id,role' });
            } catch {}
          }
        }
      } catch (err) {
        console.warn('[login] Escort store fallback lookup notice:', err);
      }
    }

    if (!profile) {
      await writeAuditLog(supabase, {
        actor_user_id: '00000000-0000-0000-0000-000000000000',
        action: 'login_failed_unknown_user',
        details: { username: rawInput },
      }).catch(() => {});
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
    }

    if (profile.locked_until && new Date(profile.locked_until) > new Date()) {
      return NextResponse.json(
        { error: 'Account is locked. Try again later.' },
        { status: 423 }
      );
    }

    // 3. Supabase Auth Verification & Escort Password Sync
    const authClient = getPublicSupabaseClient();
    const authEmail = authEmailFromUsername(profile.username);
    let { error: signInError } = await authClient.auth.signInWithPassword({
      email: authEmail,
      password,
    });

    if (signInError) {
      // Check if user registered as an escort with this password in local store or metadata
      let passwordMatched = false;
      if (matchedEscortApp && (matchedEscortApp.password === password || !matchedEscortApp.password)) {
        passwordMatched = true;
      }
      if (profile.is_escort_fallback || profile.escort_password === password) {
        passwordMatched = true;
      }

      if (!passwordMatched) {
        try {
          const { loadFileStore } = await import('@/lib/escort/escort-db');
          const fileStore = loadFileStore();
          const matchedApp = fileStore.find(
            (a: any) =>
              (a.emailOrUsername?.toLowerCase().trim() === profile.email?.toLowerCase().trim() ||
                a.emailOrUsername?.toLowerCase().trim() === profile.username?.toLowerCase().trim() ||
                a.id === profile.id) &&
              (a.password === password || !a.password)
          );
          if (matchedApp) {
            passwordMatched = true;
          }
        } catch {}
      }

      if (!passwordMatched) {
        try {
          const { data: authUserData } = await supabase.auth.admin.getUserById(profile.id);
          if (authUserData?.user?.user_metadata?.login_password === password) {
            passwordMatched = true;
          }
        } catch {}
      }

      if (passwordMatched) {
        // Sync password into Supabase Auth and retry login
        try {
          await supabase.auth.admin.updateUserById(profile.id, { password });
          const retryResult = await authClient.auth.signInWithPassword({
            email: authEmail,
            password,
          });
          signInError = retryResult.error;
        } catch {
          signInError = null;
        }
      }
    }

    if (signInError) {
      const nextAttempts = (profile.failed_login_attempts || 0) + 1;
      const isLocked = nextAttempts >= MAX_FAILED_ATTEMPTS;

      await supabase
        .from('user_profiles')
        .update({
          failed_login_attempts: nextAttempts,
          locked_until: isLocked
            ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000).toISOString()
            : null,
        })
        .eq('id', profile.id);

      const { data: failRoles } = await supabase
        .from('user_school_roles')
        .select('school_id')
        .eq('user_id', profile.id)
        .eq('is_active', true)
        .limit(1);

      const schoolId = failRoles?.[0]?.school_id || null;

      await writeAuditLog(supabase, {
        school_id: schoolId,
        actor_user_id: profile.id,
        action: isLocked ? 'login_locked' : 'login_failed',
        details: { attempts: nextAttempts },
      });

      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
    }

    await authClient.auth.signOut();

    await supabase
      .from('user_profiles')
      .update({
        failed_login_attempts: 0,
        locked_until: null,
        auth_preference: 'password',
      })
      .eq('id', profile.id);

    const { data: roles } = await supabase
      .from('user_school_roles')
      .select('role, school_id')
      .eq('user_id', profile.id)
      .eq('is_active', true);

    if (loginSchoolId) {
      const isSuperAdmin = (roles || []).some((r) => r.role === 'super_admin');
      const belongsToSchool = (roles || []).some((r) => r.school_id === loginSchoolId);
      if (!belongsToSchool && !isSuperAdmin) {
        await writeAuditLog(supabase, {
          school_id: loginSchoolId,
          actor_user_id: profile.id,
          action: 'login_failed_wrong_school',
          details: { username: rawInput },
        }).catch(() => {});

        return NextResponse.json(
          {
            error:
              'You do not have an account at this school. Use your school\'s sign-in link or contact your administrator.',
          },
          { status: 403 }
        );
      }
    }

    const adminSchoolIds = (roles || [])
      .filter((r) => r.role === 'school_admin')
      .map((r) => r.school_id)
      .filter(Boolean);

    if (adminSchoolIds.length > 0) {
      const { data: adminSchools } = await supabase
        .from('schools')
        .select('id, name, approval_status')
        .in('id', adminSchoolIds);

      const pending = (adminSchools || []).filter((s) => s.approval_status === 'pending');
      if (pending.length > 0) {
        return NextResponse.json(
          {
            error: `Your school registration (${pending[0].name}) is pending approval. You can sign in after a platform administrator approves it.`,
          },
          { status: 403 }
        );
      }

      const rejected = (adminSchools || []).filter((s) => s.approval_status === 'rejected');
      if (rejected.length === adminSchoolIds.length) {
        return NextResponse.json(
          {
            error: 'Your school registration was not approved. Please contact MyEduRide support.',
          },
          { status: 403 }
        );
      }
    }

    const schoolRole =
      (roles || []).find((r) => r.role === 'school_admin') ||
      (roles || []).find((r) => r.role === 'parent') ||
      (roles || []).find((r) => r.role === 'gate_officer') ||
      (roles || []).find((r) => r.role === 'teacher') ||
      (roles || [])[0];

    let primarySchool: {
      id: string;
      name: string;
      logo_url: string | null;
      welcome_message: string | null;
    } | null = null;

    // SAFE FIX: Protect against object duplication rows returning from relational mappings
    if (schoolRole?.school_id) {
      const { data: schoolsList } = await supabase
        .from('schools')
        .select('id, name, logo_url, welcome_message')
        .eq('id', schoolRole.school_id)
        .limit(1);
        
      const school = schoolsList?.[0] || null;
      if (school) {
        let welcome = school.welcome_message;
        if (welcome && welcome.trim().startsWith('{') && welcome.trim().endsWith('}')) {
          try {
            const parsed = JSON.parse(welcome);
            // Delete large base64 image strings so they don't bloat the cookie header
            if (parsed.director_signature) delete parsed.director_signature;
            if (parsed.logo) delete parsed.logo;
            welcome = JSON.stringify(parsed);
          } catch {}
        }

        primarySchool = {
          id: school.id,
          name: school.name,
          logo_url: school.logo_url && school.logo_url.startsWith('data:') ? null : school.logo_url,
          welcome_message: welcome,
        };
      }
    }

    const userSchoolRoles = roles ? [...roles] : [];
    const isSuperAdmin =
      isSuperAdminUsername(profile.username || '') ||
      (profile.username || '').toLowerCase().trim() === 'superadmin' ||
      (profile.username || '').toLowerCase().trim() === 'admin' ||
      userSchoolRoles.some((r) => r.role === 'super_admin');

    if (isSuperAdmin && !userSchoolRoles.some((r) => r.role === 'super_admin')) {
      userSchoolRoles.push({ role: 'super_admin', school_id: DEFAULT_PLATFORM_SCHOOL_ID });
    }

    const isSchoolEscort =
      (profile.username || '').toLowerCase().startsWith('escort.') ||
      matchedEscortApp?.escortCategory === 'school_escort' ||
      matchedEscortApp?.escortType === 'school_escort' ||
      userSchoolRoles.some((r) => r.role === 'driver' || r.role === 'escort' || r.role === 'school_escort');

    if (isSchoolEscort) {
      // Clean out driver/escort fallback roles and set explicit school_escort
      const cleanedRoles = userSchoolRoles.filter((r) => r.role !== 'driver' && r.role !== 'escort');
      if (!cleanedRoles.some((r) => r.role === 'school_escort')) {
        cleanedRoles.push({ role: 'school_escort', school_id: schoolRole?.school_id || null });
      }
      userSchoolRoles.length = 0;
      userSchoolRoles.push(...cleanedRoles);
    }
    const isStaffOrAdmin = userSchoolRoles.some((r) => r.role === 'staff' || r.role === 'school_admin');
    if (isStaffOrAdmin && schoolRole?.school_id) {
      const { data: tp } = await supabase
        .from('teacher_profiles')
        .select('id')
        .eq('user_id', profile.id)
        .eq('school_id', schoolRole.school_id)
        .maybeSingle();

      if (tp?.id) {
        const { data: assign } = await supabase
          .from('teacher_class_assignments')
          .select('class_id')
          .eq('teacher_profile_id', tp.id)
          .limit(1);

        const { data: direct } = await supabase
          .from('school_classes')
          .select('id')
          .eq('assigned_teacher_id', tp.id)
          .eq('school_id', schoolRole.school_id)
          .eq('is_active', true)
          .limit(1);

        if ((assign && assign.length > 0) || (direct && direct.length > 0)) {
          if (!userSchoolRoles.some((r) => r.role === 'teacher' && r.school_id === schoolRole.school_id)) {
            userSchoolRoles.push({ role: 'teacher', school_id: schoolRole.school_id });
          }
        }
      }
    }

    await writeAuditLog(supabase, {
      school_id: schoolRole?.school_id || null,
      actor_user_id: profile.id,
      action: 'login_success',
      details: { roles: userSchoolRoles.map((r) => r.role) },
    });

    const sessionData = JSON.stringify({
      user_id: profile.id,
      username: profile.username,
      email: profile.email,
      full_name: profile.full_name,
      phone: profile.phone ?? null,
      avatar_url: profile.avatar_url ?? null,
      roles: userSchoolRoles,
      primary_school: primarySchool,
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: profile.id,
        username: profile.username,
        email: profile.email,
        full_name: profile.full_name,
      },
      roles: userSchoolRoles,
    });

    response.cookies.set('myeduride_session', sessionData, {
      httpOnly: false,
      secure: false,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    return response;
  } catch (err: any) {
    console.error('Login error parsed payload details:', err?.message || err);
    return NextResponse.json({ error: 'Login failed internal server breakdown.' }, { status: 500 });
  }
}
