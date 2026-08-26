import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getSessionFromRequest, sessionHasRole } from '@/lib/session';
import { uploadBase64Photo } from '@/lib/storage/upload-photo';
import { ensureStaffProfile } from '@/lib/staff/ensure-profile';

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

    // 1. Ensure staff profile exists so staff_id_number is deterministically established
    const staffProfile = await ensureStaffProfile(supabase, school_id, user_id);
    const staffId = staffProfile?.staff_id_number || `STF-${school_id.slice(0, 4).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
    const storagePath = `staff/${school_id}/${staffId}.jpg`;

    const { path, error: uploadErr } = await uploadBase64Photo(supabase, storagePath, photo_base64);
    if (uploadErr || !path) {
      return NextResponse.json(
        { error: `Photo could not be saved: ${uploadErr || 'upload failed'}` },
        { status: 500 }
      );
    }

    // 2. Synchronize teacher_profiles table
    if (staffProfile?.id) {
      await supabase
        .from('teacher_profiles')
        .update({ photo_url: path })
        .eq('id', staffProfile.id);
    } else {
      await supabase
        .from('teacher_profiles')
        .upsert(
          {
            user_id,
            school_id,
            staff_id_number: staffId,
            qr_code_data: `MYEDURIDE:STAFF:${staffId}`,
            photo_url: path,
          },
          { onConflict: 'user_id,school_id' }
        );
    }

    // 3. Synchronize user_profiles table (so avatar displays across headers, dashboards, and chat)
    await supabase
      .from('user_profiles')
      .update({ avatar_url: path, photo_url: path })
      .eq('id', user_id);

    // 4. Synchronize users table if present
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
