import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';
import {
  getStaffRoster,
  sendPrivateMessage,
  getPrivateChatHistory,
  getPrivateUnreadCounts,
} from '@/lib/chat/private-chat-api';

export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Role-based access control guard: verify user has at least one active staff role
    const isStaff = session.roles.some((r) =>
      ['super_admin', 'school_admin', 'teacher', 'gate_officer', 'staff'].includes(r.role)
    );

    if (!isStaff) {
      return NextResponse.json({ error: 'Unauthorized role' }, { status: 403 });
    }

    const { action, params } = await request.json();

    switch (action) {
      case 'get_staff_roster': {
        const { school_id } = params || {};
        if (!school_id) {
          return NextResponse.json({ error: 'school_id required' }, { status: 400 });
        }
        const roster = await getStaffRoster(session, school_id);
        return NextResponse.json({ roster });
      }

      case 'send_private': {
        const { school_id, recipient_id, content, media_url, media_type } = params || {};
        if (!school_id || !recipient_id || !content?.trim()) {
          return NextResponse.json({ error: 'school_id, recipient_id, and content required' }, { status: 400 });
        }

        const result = await sendPrivateMessage(session, {
          school_id,
          recipient_id,
          content: content.trim(),
          media_url,
          media_type,
        });

        if (result.error) {
          return NextResponse.json({ error: result.error }, { status: 400 });
        }

        return NextResponse.json({ success: true, id: result.id });
      }

      case 'get_private_history': {
        const { recipient_id, limit, cursor } = params || {};
        if (!recipient_id) {
          return NextResponse.json({ error: 'recipient_id required' }, { status: 400 });
        }

        const history = await getPrivateChatHistory(session, {
          recipient_id,
          limit: limit || 50,
          cursor: cursor || undefined,
        });

        return NextResponse.json(history);
      }

      case 'get_unread_counts': {
        const { school_id } = params || {};
        if (!school_id) {
          return NextResponse.json({ error: 'school_id required' }, { status: 400 });
        }
        const counts = await getPrivateUnreadCounts(session, school_id);
        return NextResponse.json({ counts });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (err: any) {
    console.error('[Private Chat API] uncaught error:', err?.message || err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
