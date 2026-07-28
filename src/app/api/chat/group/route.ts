import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';
import {
  createChatRoom,
  getChatRooms,
  getRoomChatHistory,
  sendRoomMessage,
  getRoomParticipants,
  manageRoomParticipants,
  updateChatRoom,
  deleteChatRoom,
  markRoomRead,
} from '@/lib/chat/group-chat-api';

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
      case 'create_room': {
        const { school_id, name, description, participant_ids } = params || {};
        if (!school_id || !name?.trim() || !participant_ids) {
          return NextResponse.json({ error: 'school_id, name, and participant_ids required' }, { status: 400 });
        }
        const result = await createChatRoom(session, {
          school_id,
          name: name.trim(),
          description: description || '',
          participant_ids,
        });

        if (result.error) {
          return NextResponse.json({ error: result.error }, { status: 400 });
        }
        return NextResponse.json({ success: true, id: result.id });
      }

      case 'get_rooms': {
        const { school_id } = params || {};
        if (!school_id) {
          return NextResponse.json({ error: 'school_id required' }, { status: 400 });
        }
        const rooms = await getChatRooms(session, school_id);
        return NextResponse.json({ rooms });
      }

      case 'get_room_history': {
        const { room_id, limit, cursor } = params || {};
        if (!room_id) {
          return NextResponse.json({ error: 'room_id required' }, { status: 400 });
        }

        // Fetching history also updates the read watermark
        await markRoomRead(session.user_id, room_id);

        const history = await getRoomChatHistory(session, {
          room_id,
          limit: limit || 50,
          cursor: cursor || undefined,
        });

        return NextResponse.json(history);
      }

      case 'send_room_message': {
        const { school_id, room_id, content, media_url, media_type } = params || {};
        if (!school_id || !room_id || (!content?.trim() && !media_url?.trim())) {
          return NextResponse.json({ error: 'school_id, room_id, and message content or attachment required' }, { status: 400 });
        }

        const fallbackContent = content?.trim() || (
          media_type === 'image' ? '📷 Photo' : media_type === 'audio' ? '🎙️ Voice Note' : '📄 Attachment'
        );

        const result = await sendRoomMessage(session, {
          school_id,
          room_id,
          content: fallbackContent,
          media_url,
          media_type,
        });

        if (result.error) {
          return NextResponse.json({ error: result.error }, { status: 400 });
        }

        return NextResponse.json({ success: true, id: result.id });
      }

      case 'get_room_participants': {
        const { room_id } = params || {};
        if (!room_id) {
          return NextResponse.json({ error: 'room_id required' }, { status: 400 });
        }
        const participants = await getRoomParticipants(room_id);
        return NextResponse.json({ participants });
      }

      case 'manage_participants': {
        const { room_id, add_ids, remove_ids } = params || {};
        if (!room_id) {
          return NextResponse.json({ error: 'room_id required' }, { status: 400 });
        }
        const result = await manageRoomParticipants(session, {
          room_id,
          add_ids,
          remove_ids,
        });

        if (result.error) {
          return NextResponse.json({ error: result.error }, { status: 400 });
        }
        return NextResponse.json({ success: true });
      }

      case 'update_room': {
        const { room_id, name, description } = params || {};
        if (!room_id || !name?.trim()) {
          return NextResponse.json({ error: 'room_id and name required' }, { status: 400 });
        }
        const result = await updateChatRoom(session, {
          room_id,
          name: name.trim(),
          description: description || '',
        });

        if (result.error) {
          return NextResponse.json({ error: result.error }, { status: 400 });
        }
        return NextResponse.json({ success: true });
      }

      case 'delete_room': {
        const { room_id } = params || {};
        if (!room_id) {
          return NextResponse.json({ error: 'room_id required' }, { status: 400 });
        }
        const result = await deleteChatRoom(session, room_id);

        if (result.error) {
          return NextResponse.json({ error: result.error }, { status: 400 });
        }
        return NextResponse.json({ success: true });
      }

      case 'mark_room_read': {
        const { room_id } = params || {};
        if (!room_id) {
          return NextResponse.json({ error: 'room_id required' }, { status: 400 });
        }
        await markRoomRead(session.user_id, room_id);
        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (err: any) {
    console.error('[Group Chat API] uncaught error:', err?.message || err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
