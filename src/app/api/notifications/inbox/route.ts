import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getSessionFromRequest } from '@/lib/session';

export const dynamic = 'force-dynamic';

/** GET /api/notifications/inbox?school_id=xxx&limit=50 */
export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    let schoolId = request.nextUrl.searchParams.get('school_id');
    if (schoolId === 'undefined' || schoolId === 'null') schoolId = null;

    const limit = Math.min(parseInt(request.nextUrl.searchParams.get('limit') || '50', 10), 100);
    const supabase = getAdminClient();
    const sessAny = session as any;

    // Fallback schoolId resolution
    if (!schoolId) {
      schoolId = sessAny.primary_school_id || sessAny.school_id || sessAny.primary_school?.id || null;
    }

    if (!schoolId && session.user_id) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('school_id, primary_school_id')
        .eq('id', session.user_id)
        .maybeSingle();
      if (profile?.school_id || profile?.primary_school_id) {
        schoolId = profile.school_id || profile.primary_school_id;
      }
    }

    if (!schoolId && session.user_id) {
      const { data: staff } = await supabase
        .from('staff_profiles')
        .select('school_id')
        .eq('user_id', session.user_id)
        .limit(1)
        .maybeSingle();
      if (staff?.school_id) schoolId = staff.school_id;
    }

    // 1. Fetch user notifications
    let query = supabase
      .from('notifications')
      .select('*, student:students(first_name, last_name)')
      .eq('user_id', session.user_id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (schoolId) query = query.eq('school_id', schoolId);

    const { data: userNotifs, error: notifErr } = await query;
    if (notifErr) return NextResponse.json({ error: notifErr.message }, { status: 500 });

    const notificationsList: any[] = [...(userNotifs || [])];

    // 2. Fetch school broadcast notices if schoolId exists
    if (schoolId) {
      try {
        const { data: schoolNotices } = await supabase
          .from('school_notices')
          .select('*')
          .eq('school_id', schoolId)
          .order('created_at', { ascending: false })
          .limit(20);

        if (schoolNotices) {
          const userRole = (sessAny.role || sessAny.roles?.[0] || '').toLowerCase();
          for (const sn of schoolNotices) {
            const targets = sn.target_audiences || [];
            const isMatch =
              targets.length === 0 ||
              targets.includes('all') ||
              !userRole ||
              (userRole.includes('parent') && targets.includes('parents')) ||
              ((userRole.includes('teacher') || userRole.includes('staff')) && targets.includes('teachers')) ||
              (userRole.includes('escort') && targets.includes('escorts')) ||
              ((userRole.includes('gate') || userRole.includes('gatemanager')) && targets.includes('gate_officers'));

            if (isMatch) {
              // Avoid duplicates
              const exists = notificationsList.some(
                (n) => n.title === sn.title || n.message === sn.message
              );
              if (!exists) {
                notificationsList.push({
                  id: sn.id,
                  user_id: session.user_id,
                  school_id: sn.school_id,
                  title: `[Notice] ${sn.title}`,
                  message: sn.message,
                  type: 'notice',
                  media_url: sn.media_url || null,
                  is_read: false,
                  created_at: sn.created_at,
                });
              }
            }
          }
        }
      } catch (err) {
        console.warn('[inbox] school_notices query warning:', err);
      }
    }

    // Sort composite list by created_at DESC
    notificationsList.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    // Exclude raw chat strings
    const cleanData = notificationsList.filter((n: any) => {
      const msg = n.message || '';
      return !msg.startsWith('[sender_id:') && !msg.includes('[Message from');
    });

    const unread = cleanData.filter((n: any) => !n.is_read).length;
    return NextResponse.json({ notifications: cleanData, unread_count: unread });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** PATCH /api/notifications/inbox  body: { id } | { mark_all: true, school_id? } */
export async function PATCH(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const body = await request.json();
    const supabase = getAdminClient();

    if (body.mark_all) {
      let q = supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', session.user_id)
        .eq('is_read', false);
      if (body.school_id) q = q.eq('school_id', body.school_id);
      await q;
      return NextResponse.json({ success: true });
    }

    if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', body.id)
      .eq('user_id', session.user_id);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
