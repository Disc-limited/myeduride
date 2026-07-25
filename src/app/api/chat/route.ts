import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';
import { getAdminClient } from '@/lib/supabase/admin';
import {
  sendChatMessage,
  getChatHistory,
  getUnreadCounts,
  getEduChartUnreadTotal,
  markThreadRead,
  verifyTeacherStudentAssignment,
} from '@/lib/chat/chat-messages-api';

export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { action, params } = await request.json();
    console.log('[CHAT API] action:', action, 'user:', session.user_id);

    switch (action) {
      case 'send': {
        const { student_id, recipient_type, message_text, media_url, media_type, attach_profile_photo } = params || {};

        if (!student_id || !recipient_type || (!message_text?.trim() && !media_url && !attach_profile_photo)) {
          return NextResponse.json(
            { error: 'Missing required parameters (student_id, recipient_type, message_text or media_url)' },
            { status: 400 }
          );
        }

        const isTeacher = session.roles.some((r) => r.role === 'teacher' || r.role === 'staff');
        const isAdmin = session.roles.some((r) => r.role === 'school_admin' || r.role === 'super_admin');
        if (isTeacher && !isAdmin) {
          const isAssigned = await verifyTeacherStudentAssignment(session.user_id, student_id);
          if (!isAssigned) {
            return NextResponse.json({ error: 'Access denied: student not assigned' }, { status: 403 });
          }
        }

        let resolvedMediaUrl = media_url || null;
        let resolvedMediaType = media_type || null;

        if (attach_profile_photo) {
          const supabase = getAdminClient();
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('avatar_url')
            .eq('id', session.user_id)
            .maybeSingle();

          if (profile?.avatar_url) {
            resolvedMediaUrl = profile.avatar_url;
            resolvedMediaType = 'image';
          } else {
            resolvedMediaUrl = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" fill="none"><rect width="100%" height="100%" rx="12" fill="%23E8F5E9"/><circle cx="200" cy="110" r="50" fill="%231B4D3E"/><path d="M130,210 C130,170 170,160 200,160 C230,160 270,170 270,210" fill="%231B4D3E"/><text x="200" y="240" font-family="sans-serif" font-size="16" font-weight="bold" fill="%231B4D3E" text-anchor="middle">MyEduRide User</text><text x="200" y="265" font-family="sans-serif" font-size="12" fill="%234CAF50" font-weight="bold" text-anchor="middle">Click to set your photo in Settings</text></svg>';
            resolvedMediaType = 'image';
          }
        }

        const result = await sendChatMessage({
          session,
          studentId: student_id,
          recipientType: recipient_type,
          content: message_text?.trim() || '',
          mediaUrl: resolvedMediaUrl,
          mediaType: resolvedMediaType,
        });

        if (result.error) {
          return NextResponse.json({ error: result.error }, { status: 500 });
        }

        return NextResponse.json({ success: true, id: result.id });
      }

      case 'history': {
        const { student_id, limit, cursor } = params || {};

        if (!student_id) {
          return NextResponse.json({ error: 'student_id required' }, { status: 400 });
        }

        const isTeacher = session.roles.some((r) => r.role === 'teacher' || r.role === 'staff');
        const isAdmin = session.roles.some((r) => r.role === 'school_admin' || r.role === 'super_admin');
        if (isTeacher && !isAdmin) {
          const isAssigned = await verifyTeacherStudentAssignment(session.user_id, student_id);
          if (!isAssigned) {
            return NextResponse.json({ error: 'Access denied: student not assigned' }, { status: 403 });
          }
        }

        // Also mark thread as read when loading history
        await markThreadRead({ studentId: student_id, userId: session.user_id });

        const result = await getChatHistory({
          session,
          studentId: student_id,
          limit: limit || 50,
          cursor: cursor || undefined,
        });

        return NextResponse.json(result);
      }

      case 'mark_read': {
        const { student_id } = params || {};

        if (!student_id) {
          return NextResponse.json({ error: 'student_id required' }, { status: 400 });
        }

        const isTeacher = session.roles.some((r) => r.role === 'teacher' || r.role === 'staff');
        const isAdmin = session.roles.some((r) => r.role === 'school_admin' || r.role === 'super_admin');
        if (isTeacher && !isAdmin) {
          const isAssigned = await verifyTeacherStudentAssignment(session.user_id, student_id);
          if (!isAssigned) {
            return NextResponse.json({ error: 'Access denied: student not assigned' }, { status: 403 });
          }
        }

        await markThreadRead({ studentId: student_id, userId: session.user_id });
        return NextResponse.json({ success: true });
      }

      case 'unread_counts': {
        const { school_id } = params || {};

        if (!school_id) {
          return NextResponse.json({ error: 'school_id required' }, { status: 400 });
        }

        const counts = await getUnreadCounts({ session, schoolId: school_id });
        return NextResponse.json({ counts });
      }

      case 'unread_total': {
        const total = await getEduChartUnreadTotal(session);
        return NextResponse.json({ unread_total: total });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (err: any) {
    console.error('[CHAT API] error:', err?.message || err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
