import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getSessionFromRequest } from '@/lib/session';

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session?.user_id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = getAdminClient();
    const body = await request.json();

    const full_name = (body.full_name ?? '').trim();
    const email = (body.email ?? '').trim().toLowerCase() || null; // null = clear
    const phone = (body.phone ?? '').trim() || null;
    const avatar_url = body.avatar_url !== undefined ? (body.avatar_url || null) : undefined;

    // ── Validation ─────────────────────────────────────────────────────
    if (!full_name) {
      return NextResponse.json({ error: 'Full name is required' }, { status: 400 });
    }

    if (email && !isValidEmail(email)) {
      return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 });
    }

    // ── Uniqueness checks ───────────────────────────────────────────────
    if (phone) {
      const { data: phoneConflict } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('phone', phone)
        .neq('id', session.user_id)
        .maybeSingle();
      if (phoneConflict) {
        return NextResponse.json(
          { error: 'That phone number is already in use by another account' },
          { status: 409 }
        );
      }
    }

    if (email) {
      const { data: emailConflict } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('email', email)
        .neq('id', session.user_id)
        .maybeSingle();
      if (emailConflict) {
        return NextResponse.json(
          { error: 'That email address is already in use by another account' },
          { status: 409 }
        );
      }
    }

    // ── Build update payload ────────────────────────────────────────────
    const updatePayload: Record<string, unknown> = {
      full_name,
      email,   // null clears the field
      phone,   // null clears the field
    };

    // Only overwrite avatar_url if the client explicitly sent a value
    if (avatar_url !== undefined) {
      updatePayload.avatar_url = avatar_url;
    }

    const { error: profileErr } = await supabase
      .from('user_profiles')
      .update(updatePayload)
      .eq('id', session.user_id);

    if (profileErr) {
      return NextResponse.json(
        { error: `Failed to update profile: ${profileErr.message}` },
        { status: 500 }
      );
    }

    // ── Synchronize teacher_profiles & users table if avatar updated ───
    if (avatar_url !== undefined) {
      try {
        await supabase
          .from('teacher_profiles')
          .update({ photo_url: avatar_url })
          .eq('user_id', session.user_id);
      } catch {
        // optional
      }

      try {
        await supabase
          .from('users')
          .update({ avatar_url })
          .eq('id', session.user_id);
      } catch {
        // optional
      }
    }

    // ── Parent → student custom_fields sync ────────────────────────────
    const { data: parentLinks } = await supabase
      .from('student_parents')
      .select('student_id')
      .eq('parent_user_id', session.user_id);

    if (parentLinks?.length) {
      const studentIds = parentLinks.map((l) => l.student_id);
      const { data: students } = await supabase
        .from('students')
        .select('id, custom_fields')
        .in('id', studentIds);

      for (const student of students ?? []) {
        const cf = { ...(student.custom_fields || {}) } as Record<string, unknown>;
        cf.parent_name = full_name;
        cf.parent_phone = phone ?? '';
        cf.parent_email = email ?? '';
        await supabase
          .from('students')
          .update({ custom_fields: cf })
          .eq('id', student.id);
      }
    }

    // ── Refresh session cookie ─────────────────────────────────────────
    const resolvedAvatarUrl =
      avatar_url !== undefined ? avatar_url : (session.avatar_url ?? null);

    const updatedSession = {
      ...session,
      full_name,
      email: email ?? null,
      phone: phone ?? null,
      avatar_url: resolvedAvatarUrl,
    };

    const response = NextResponse.json({
      success: true,
      full_name,
      email: email ?? null,
      phone: phone ?? null,
      avatar_url: resolvedAvatarUrl,
    });

    response.cookies.set('myeduride_session', JSON.stringify(updatedSession), {
      httpOnly: false,
      secure: false,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    return response;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Could not update profile';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
