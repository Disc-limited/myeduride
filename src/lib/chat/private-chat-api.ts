import { getAdminClient } from '@/lib/supabase/admin';
import type { AppSession } from '@/lib/session';

export interface PrivateChatMessage {
  id: string;
  school_id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  media_url: string | null;
  media_type: string | null;
  is_read: boolean;
  created_at: string;
  // Enriched fields
  sender_name?: string;
  sender_avatar?: string | null;
}

export interface SendPrivateParams {
  school_id: string;
  recipient_id: string;
  content: string;
  media_url?: string | null;
  media_type?: 'image' | 'audio' | 'document' | null;
}

export interface PrivateHistoryParams {
  recipient_id: string;
  limit?: number;
  cursor?: string;
}

/**
 * Fetch all staff members at the user's school (excluding current user).
 */
export async function getStaffRoster(session: AppSession, schoolId: string) {
  const supabase = getAdminClient();

  // 1. Fetch user school roles for active staff members
  const { data: roles, error: rolesErr } = await supabase
    .from('user_school_roles')
    .select(`
      user_id,
      role,
      user_profiles:user_id (
        id,
        full_name,
        username,
        avatar_url
      )
    `)
    .eq('school_id', schoolId)
    .in('role', ['super_admin', 'school_admin', 'teacher', 'gate_officer', 'staff'])
    .eq('is_active', true);

  if (rolesErr) {
    console.error('[private-chat] error fetching roster roles:', rolesErr.message);
    throw rolesErr;
  }

  // 2. Fetch presence timestamps
  const userIds = [...new Set(roles.map((r: any) => r.user_id))];
  let presenceMap = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: presence } = await supabase
      .from('user_presence')
      .select('user_id, last_seen_at')
      .in('user_id', userIds);

    if (presence) {
      presence.forEach((p: any) => {
        presenceMap.set(p.user_id, p.last_seen_at);
      });
    }
  }

  // 3. Group roles and presence status
  const rosterMap = new Map<string, any>();
  roles.forEach((r: any) => {
    // Skip if profile is missing or if it's the current user
    if (!r.user_profiles || r.user_id === session.user_id) return;

    const profile = r.user_profiles as any;
    const lastSeen = presenceMap.get(r.user_id);
    const isOnline = lastSeen ? new Date(lastSeen).getTime() > Date.now() - 5 * 60 * 1000 : false;

    if (!rosterMap.has(r.user_id)) {
      rosterMap.set(r.user_id, {
        id: profile.id,
        full_name: profile.full_name,
        username: profile.username,
        avatar_url: profile.avatar_url,
        roles: [r.role],
        is_online: isOnline,
        last_seen_at: lastSeen || null,
      });
    } else {
      const existing = rosterMap.get(r.user_id);
      if (!existing.roles.includes(r.role)) {
        existing.roles.push(r.role);
      }
    }
  });

  return Array.from(rosterMap.values());
}

/**
 * Send a private message between staff members.
 */
export async function sendPrivateMessage(session: AppSession, params: SendPrivateParams) {
  const { school_id, recipient_id, content, media_url, media_type } = params;
  const supabase = getAdminClient();

  const { data: msg, error: insertErr } = await supabase
    .from('staff_private_messages')
    .insert({
      school_id,
      sender_id: session.user_id,
      recipient_id,
      content: content.trim(),
      media_url: media_url || null,
      media_type: media_type || null,
      is_read: false,
    })
    .select('id')
    .single();

  if (insertErr) {
    console.error('[private-chat] insert error:', insertErr.message);
    return { error: insertErr.message };
  }

  return { success: true, id: msg?.id };
}

/**
 * Get private chat history between current user and specified recipient.
 */
export async function getPrivateChatHistory(session: AppSession, params: PrivateHistoryParams) {
  const { recipient_id, limit = 50, cursor } = params;
  const supabase = getAdminClient();

  let query = supabase
    .from('staff_private_messages')
    .select('*')
    .or(`and(sender_id.eq.${session.user_id},recipient_id.eq.${recipient_id}),and(sender_id.eq.${recipient_id},recipient_id.eq.${session.user_id})`)
    .order('created_at', { ascending: false })
    .limit(limit + 1);

  if (cursor) {
    query = query.lt('created_at', cursor);
  }

  const { data: rawMessages, error } = await query;

  if (error) {
    console.error('[private-chat] history error:', error.message);
    return { messages: [], has_more: false };
  }

  let messages = rawMessages || [];
  const hasMore = messages.length > limit;
  if (hasMore) {
    messages = messages.slice(0, limit);
  }

  // Reverse to make it chronological (oldest first)
  messages.reverse();

  // Enrich with sender details
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

  const enriched: PrivateChatMessage[] = messages.map((m: any) => {
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
 * Mark all messages in a thread as read for current user.
 */
export async function markPrivateThreadRead(userId: string, senderId: string) {
  const supabase = getAdminClient();

  await supabase
    .from('staff_private_messages')
    .update({ is_read: true })
    .eq('recipient_id', userId)
    .eq('sender_id', senderId)
    .eq('is_read', false);
}

/**
 * Get unread message counts from other staff members in this school.
 */
export async function getPrivateUnreadCounts(session: AppSession, schoolId: string) {
  const supabase = getAdminClient();

  const { data, error } = await supabase
    .from('staff_private_messages')
    .select('sender_id, created_at, content')
    .eq('school_id', schoolId)
    .eq('recipient_id', session.user_id)
    .eq('is_read', false);

  if (error) {
    console.error('[private-chat] unread count error:', error.message);
    return [];
  }

  const countsMap = new Map<string, { count: number; last_message: string; last_message_time: string }>();

  data?.forEach((m: any) => {
    if (!countsMap.has(m.sender_id)) {
      countsMap.set(m.sender_id, {
        count: 1,
        last_message: m.content,
        last_message_time: m.created_at,
      });
    } else {
      const entry = countsMap.get(m.sender_id)!;
      entry.count++;
      if (new Date(m.created_at).getTime() > new Date(entry.last_message_time).getTime()) {
        entry.last_message = m.content;
        entry.last_message_time = m.created_at;
      }
    }
  });

  return Array.from(countsMap.entries()).map(([sender_id, val]) => ({
    sender_id,
    unread_count: val.count,
    last_message: val.last_message,
    last_message_time: val.last_message_time,
  }));
}
