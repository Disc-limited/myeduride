import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getSessionFromRequest, sessionHasRole } from '@/lib/session';
import { uploadBase64Photo } from '@/lib/storage/upload-photo';

/** POST — add or replace staff ID card photo and synchronize across all profile records */
export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { school_id, user_id, photo_base64 } = await request.json();
    if (!school_id || !user_id || !photo_base64) {
      return NextResponse.json(
        { error: 'school_id, user_id, and photo_base64 required' },
        { status: 400 }
      );
    }

    const allowed =
      sessionHasRole(session, 'super_admin') ||
      session.roles.some(
        (r) => r.school_id === school_id && ['school_admin'].includes(r.role)
      );
    if (!allowed) {
      return NextResponse.json({ error: 'School admin access required' }, { status: 403 });
    }

    const supabase = getAdminClient();
    const { data: profile } = await supabase
      .from('teacher_profiles')
      .select('id, staff_id_number')
      .eq('user_id', user_id)
      .eq('school_id', school_id)
      .maybeSingle();

    const staffId = profile?.staff_id_number || `STF-${Date.now().toString().slice(-4)}`;
    const storagePath = `staff/${school_id}/${staffId}.jpg`;

    const { path, error: uploadErr } = await uploadBase64Photo(supabase, storagePath, photo_base64);
    if (uploadErr || !path) {
      return NextResponse.json(
        { error: `Photo could not be saved: ${uploadErr || 'upload failed'}` },
        { status: 500 }
      );
    }

    // 1. Update teacher_profiles
    if (profile?.id) {
      await supabase
        .from('teacher_profiles')
        .update({ photo_url: path })
        .eq('id', profile.id);
    }

    // 2. Synchronize user_profiles (so avatar displays in Teacher Dashboard, Chat, etc.)
    await supabase
      .from('user_profiles')
      .update({ avatar_url: path, photo_url: path })
      .eq('id', user_id);

    // 3. Synchronize users table if exists
    try {
      await supabase
        .from('users')
        .update({ avatar_url: path })
        .eq('id', user_id);
    } catch {
      // optional
    }

    return NextResponse.json({
      success: true,
      photo_url: path,
      preview_url: `/api/photo?path=${encodeURIComponent(path)}&t=${Date.now()}`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
