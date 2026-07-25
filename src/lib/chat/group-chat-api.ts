import { getAdminClient } from '@/lib/supabase/admin';
import type { AppSession } from '@/lib/session';

export interface GroupChatRoom {
  id: string;
  school_id: string;
  name: string;
  description: string;
  created_by: string;
  created_at: string;
  unread_count?: number;
  last_message?: string;
  last_message_time?: string;
}

export interface GroupChatMessage {
  id: string;
  school_id: string;
  room_id: string;
  sender_id: string;
  content: string;
  media_url: string | null;
  media_type: string | null;
  created_at: string;
  // Enriched fields
  sender_name?: string;
  sender_avatar?: string | null;
}

export interface CreateRoomParams {
  school_id: string;
  name: string;
  description: string;
  participant_ids: string[];
}

export interface SendRoomMessageParams {
  school_id: string;
  room_id: string;
  content: string;
  media_url?: string | null;
  media_type?: 'image' | 'audio' | 'document' | null;
}

export interface RoomHistoryParams {
  room_id: string;
  limit?: number;
  cursor?: string;
}

/**
 * Helper to check if current user is an admin in the school.
 */
async function checkIsAdmin(session: AppSession, schoolId: string): Promise<boolean> {
  return session.roles.some(
    (r) => r.school_id === schoolId && ['super_admin', 'school_admin'].includes(r.role)
  );
}

/**
 * Create a new group chat room and add initial participants.
 * Only administrators can create rooms.
 */
export async function createChatRoom(session: AppSession, params: CreateRoomParams) {
  const { school_id, name, description, participant_ids } = params;
  const supabase = getAdminClient();

  // Guard: Verify user has school_admin or super_admin role
  const isAdmin = await checkIsAdmin(session, school_id);
  if (!isAdmin) {
    return { error: 'Only school administrators can create chat rooms' };
  }

  // Insert room
  const { data: room, error: roomErr } = await supabase
    .from('staff_chat_rooms')
    .insert({
      school_id,
      name: name.trim(),
      description: description.trim(),
      created_by: session.user_id,
    })
    .select('id')
    .single();

  if (roomErr) {
    console.error('[group-chat] create room error:', roomErr.message);
    return { error: roomErr.message };
  }

  const roomId = room.id;

  // Add participants (always include creator)
  const uniqueUserIds = Array.from(new Set([...participant_ids, session.user_id]));
  const participantInserts = uniqueUserIds.map((userId) => ({
    room_id: roomId,
    user_id: userId,
  }));

  const { error: partErr } = await supabase
    .from('staff_chat_room_participants')
    .insert(participantInserts);

  if (partErr) {
    console.error('[group-chat] add participants error:', partErr.message);
    // Cleanup room on participant insert failure
    await supabase.from('staff_chat_rooms').delete().eq('id', roomId);
    return { error: 'Failed to assign participants to room' };
  }

  return { success: true, id: roomId };
}

/**
 * Fetch all chat rooms that the user belongs to (or all school rooms if administrator).
 */
export async function getChatRooms(session: AppSession, schoolId: string) {
  const supabase = getAdminClient();
  const isAdmin = await checkIsAdmin(session, schoolId);

  let roomsQuery = supabase
    .from('staff_chat_rooms')
    .select('*')
    .eq('school_id', schoolId);

  if (!isAdmin) {
    // If not admin, subquery rooms where current user is a participant
    const { data: participations } = await supabase
      .from('staff_chat_room_participants')
      .select('room_id')
      .eq('user_id', session.user_id);
    
    const roomIds = (participations || []).map((p) => p.room_id);
    if (roomIds.length === 0) {
      return [];
    }
    roomsQuery = roomsQuery.in('id', roomIds);
  }

  const { data: rooms, error: roomsErr } = await roomsQuery.order('created_at', { ascending: false });

  if (roomsErr) {
    console.error('[group-chat] get rooms error:', roomsErr.message);
    throw roomsErr;
  }

  // Enrich rooms with unread message counts based on last_read_at watermark
  const enrichedRooms: GroupChatRoom[] = [];

  for (const room of (rooms || [])) {
    // 1. Fetch user's participant record for watermark
    const { data: part } = await supabase
      .from('staff_chat_room_participants')
      .select('last_read_at')
      .eq('room_id', room.id)
      .eq('user_id', session.user_id)
      .maybeSingle();

    const lastRead = part?.last_read_at || new Date(0).toISOString();

    // 2. Count messages created after last_read_at (excluding self messages)
    const { count, error: countErr } = await supabase
      .from('staff_room_messages')
      .select('id', { count: 'exact', head: true })
      .eq('room_id', room.id)
      .gt('created_at', lastRead)
      .neq('sender_id', session.user_id);

    // 3. Fetch last message content and timestamp
    const { data: lastMsg } = await supabase
      .from('staff_room_messages')
      .select('content, created_at')
      .eq('room_id', room.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    enrichedRooms.push({
      ...room,
      unread_count: countErr ? 0 : (count || 0),
      last_message: lastMsg?.content || undefined,
      last_message_time: lastMsg?.created_at || undefined,
    });
  }

  return enrichedRooms;
}

/**
 * Get chat history for a group room with cursor-based pagination.
 */
export async function getRoomChatHistory(session: AppSession, params: RoomHistoryParams) {
  const { room_id, limit = 50, cursor } = params;
  const supabase = getAdminClient();

  // Fetch messages
  let query = supabase
    .from('staff_room_messages')
    .select('*')
    .eq('room_id', room_id)
    .order('created_at', { ascending: false })
    .limit(limit + 1);

  if (cursor) {
    query = query.lt('created_at', cursor);
  }

  const { data: rawMessages, error } = await query;

  if (error) {
    console.error('[group-chat] room history error:', error.message);
    return { messages: [], has_more: false };
  }

  let messages = rawMessages || [];
  const hasMore = messages.length > limit;
  if (hasMore) {
    messages = messages.slice(0, limit);
  }

  // Reverse to make it chronological (oldest first)
  messages.reverse();

  // Enrich with sender details (name, avatar)
  const senderIds = [...new Set(messages.map((m: any) => m.sender_id))];
  const profileMap = new Map<string, { full_name: string; avatar_url: string | null }>();

  if (senderIds.length > 0) {
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('id, full_name, avatar_url')
      .in('id', senderIds);

    if (profiles) {
      profiles.forEach((p: any) => {
        profileMap.set(p.id, { full_name: p.full_name, avatar_url: p.avatar_url });
      });
    }
  }

  const enriched: GroupChatMessage[] = messages.map((m: any) => {
    const profile = profileMap.get(m.sender_id);
    return {
      ...m,
      sender_name: profile?.full_name || 'Staff Member',
      sender_avatar: profile?.avatar_url || null,
    };
  });

  return { messages: enriched, has_more: hasMore };
}

/**
 * Send a message inside a group chat room.
 */
export async function sendRoomMessage(session: AppSession, params: SendRoomMessageParams) {
  const { school_id, room_id, content, media_url, media_type } = params;
  const supabase = getAdminClient();

  // Verify participant check (handled by RLS, but doing a helper check is safer)
  const { data: participation, error: partErr } = await supabase
    .from('staff_chat_room_participants')
    .select('id')
    .eq('room_id', room_id)
    .eq('user_id', session.user_id)
    .maybeSingle();

  if (partErr || !participation) {
    return { error: 'You are not a participant of this group room' };
  }

  const { data: msg, error: insertErr } = await supabase
    .from('staff_room_messages')
    .insert({
      school_id,
      room_id,
      sender_id: session.user_id,
      content: content.trim(),
      media_url: media_url || null,
      media_type: media_type || null,
    })
    .select('id')
    .single();

  if (insertErr) {
    console.error('[group-chat] room message insert error:', insertErr.message);
    return { error: insertErr.message };
  }

  // Update sender's last_read_at timestamp to avoid counting their own sent messages as unread
  await markRoomRead(session.user_id, room_id);

  return { success: true, id: msg?.id };
}

/**
 * Mark a room as read for a specific user (updates the last_read_at watermark).
 */
export async function markRoomRead(userId: string, roomId: string) {
  const supabase = getAdminClient();

  await supabase
    .from('staff_chat_room_participants')
    .update({ last_read_at: new Date().toISOString() })
    .eq('room_id', roomId)
    .eq('user_id', userId);
}

/**
 * Get all participants of a room.
 */
export async function getRoomParticipants(roomId: string) {
  const supabase = getAdminClient();

  const { data, error } = await supabase
    .from('staff_chat_room_participants')
    .select(`
      user_id,
      user_profiles:user_id (
        id,
        full_name,
        username,
        avatar_url
      )
    `)
    .eq('room_id', roomId);

  if (error) {
    console.error('[group-chat] get participants error:', error.message);
    throw error;
  }

  return (data || []).map((d: any) => ({
    id: d.user_profiles?.id,
    full_name: d.user_profiles?.full_name || 'Staff Member',
    username: d.user_profiles?.username || '',
    avatar_url: d.user_profiles?.avatar_url || null,
  }));
}

/**
 * Update room participants list (add/remove).
 * Only administrators can manage participants.
 */
export async function manageRoomParticipants(
  session: AppSession,
  params: { room_id: string; add_ids?: string[]; remove_ids?: string[] }
) {
  const { room_id, add_ids = [], remove_ids = [] } = params;
  const supabase = getAdminClient();

  // Fetch room to check school_id
  const { data: room } = await supabase
    .from('staff_chat_rooms')
    .select('school_id')
    .eq('id', room_id)
    .single();

  if (!room) {
    return { error: 'Room not found' };
  }

  // Guard: verify admin
  const isAdmin = await checkIsAdmin(session, room.school_id);
  if (!isAdmin) {
    return { error: 'Only school administrators can manage participants' };
  }

  // Remove participants
  if (remove_ids.length > 0) {
    // Prevent admin from accidentally removing themselves if they want to stay
    const { error: delErr } = await supabase
      .from('staff_chat_room_participants')
      .delete()
      .eq('room_id', room_id)
      .in('user_id', remove_ids);

    if (delErr) {
      console.error('[group-chat] remove participants error:', delErr.message);
      return { error: delErr.message };
    }
  }

  // Add participants
  if (add_ids.length > 0) {
    const participantInserts = add_ids.map((userId) => ({
      room_id,
      user_id: userId,
    }));

    const { error: insErr } = await supabase
      .from('staff_chat_room_participants')
      .upsert(participantInserts, { onConflict: 'room_id,user_id' });

    if (insErr) {
      console.error('[group-chat] add participants error:', insErr.message);
      return { error: insErr.message };
    }
  }

  return { success: true };
}

/**
 * Update room details (name, description).
 */
export async function updateChatRoom(
  session: AppSession,
  params: { room_id: string; name: string; description: string }
) {
  const { room_id, name, description } = params;
  const supabase = getAdminClient();

  // Fetch room for school_id
  const { data: room } = await supabase
    .from('staff_chat_rooms')
    .select('school_id')
    .eq('id', room_id)
    .single();

  if (!room) {
    return { error: 'Room not found' };
  }

  const isAdmin = await checkIsAdmin(session, room.school_id);
  if (!isAdmin) {
    return { error: 'Only administrators can update room details' };
  }

  const { error: updateErr } = await supabase
    .from('staff_chat_rooms')
    .update({
      name: name.trim(),
      description: description.trim(),
    })
    .eq('id', room_id);

  if (updateErr) {
    console.error('[group-chat] update room error:', updateErr.message);
    return { error: updateErr.message };
  }

  return { success: true };
}

/**
 * Delete a chat room. Cascades participant mapping and messages.
 */
export async function deleteChatRoom(session: AppSession, roomId: string) {
  const supabase = getAdminClient();

  // Fetch room for school_id
  const { data: room } = await supabase
    .from('staff_chat_rooms')
    .select('school_id')
    .eq('id', roomId)
    .single();

  if (!room) {
    return { error: 'Room not found' };
  }

  const isAdmin = await checkIsAdmin(session, room.school_id);
  if (!isAdmin) {
    return { error: 'Only administrators can delete chat rooms' };
  }

  const { error: delErr } = await supabase
    .from('staff_chat_rooms')
    .delete()
    .eq('id', roomId);

  if (delErr) {
    console.error('[group-chat] delete room error:', delErr.message);
    return { error: delErr.message };
  }

  return { success: true };
}
