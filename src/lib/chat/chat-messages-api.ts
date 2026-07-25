import { getAdminClient } from '@/lib/supabase/admin';
import type { AppSession } from '@/lib/session';
import { resolveRecipients, buildChatTitle } from './chat-recipients';

// ---- Types ----

export interface ChatMessage {
  id: string;
  school_id: string;
  student_id: string;
  sender_id: string;
  sender_name: string;
  recipient_type: string;
  content: string;
  media_url: string | null;
  media_type: string | null;
  is_read: boolean;
  created_at: string;
  // Enriched fields (added by getChatHistory)
  sender_avatar?: string | null;
}

export interface SendChatParams {
  session: AppSession;
  studentId: string;
  recipientType: string;
  content: string;
  mediaUrl?: string | null;
  mediaType?: 'image' | 'audio' | 'document' | null;
}

export interface ChatHistoryParams {
  session: AppSession;
  studentId: string;
  limit?: number;
  cursor?: string; // ISO date string for cursor-based pagination
}

export interface UnreadCountResult {
  student_id: string;
  unread_count: number;
  last_message: { content: string; created_at: string; sender_name: string } | null;
}

// ---- Core API ----

/**
 * Send a chat message. Inserts into chat_messages and optionally notifies via push/email.
 */
export async function sendChatMessage(params: SendChatParams) {
  const { session, studentId, recipientType, content, mediaUrl, mediaType } = params;
  const supabase = getAdminClient();

  // Fetch student for name + school_id
  const { data: student } = await supabase
    .from('students')
    .select('first_name, last_name, school_id')
    .eq('id', studentId)
    .maybeSingle();

  if (!student) {
    return { error: 'Student not found' };
  }

  const studentName = `${student.first_name} ${student.last_name}`;
  const title = buildChatTitle(session, recipientType, studentName);

  // Insert the chat message
  const { data: msg, error: insertErr } = await supabase
    .from('chat_messages')
    .insert({
      school_id: student.school_id,
      student_id: studentId,
      sender_id: session.user_id,
      sender_name: session.full_name || 'User',
      recipient_type: recipientType,
      title,
      content: content.trim(),
      media_url: mediaUrl || null,
      media_type: mediaType || null,
      is_read: false,
    })
    .select('id')
    .single();

  if (insertErr) {
    console.error('[chat] insert error:', insertErr.message);
    return { error: insertErr.message };
  }

  // Resolve recipients and send push/email notifications (fire-and-forget)
  sendNotifications(session, studentId, student.school_id, recipientType, content, studentName).catch((e) =>
    console.error('[chat] notification error:', e)
  );

  return { success: true, id: msg?.id };
}

/**
 * Get chat history for a student thread with cursor-based pagination.
 */
export async function getChatHistory(params: ChatHistoryParams): Promise<{
  messages: ChatMessage[];
  has_more: boolean;
}> {
  const { session, studentId, limit = 50, cursor } = params;
  const supabase = getAdminClient();

  const isParent = session.roles.some((r) => r.role === 'parent');
  const isTeacher = session.roles.some((r) => r.role === 'teacher' || r.role === 'staff');
  const isAdmin = session.roles.some((r) => r.role === 'school_admin' || r.role === 'super_admin');

  // Mark all unread messages for this student as read for the current user
  // For staff: mark messages where they are the recipient (recipient_type matches their role)
  // For parents: mark messages sent TO parents
  // We mark all as read since the user is viewing this thread
  // Using a simple approach: mark messages not sent by the current user as read
  try {
    await supabase.rpc('mark_chat_read', { p_student_id: studentId, p_user_id: session.user_id });
  } catch (err) {
    // Fallback: direct update if RPC doesn't exist yet
    // This is a simplified approach - marks all messages in the thread
  }

  // Build query
  let query = supabase
    .from('chat_messages')
    .select('*')
    .eq('student_id', studentId)
    .order('created_at', { ascending: true })
    .limit(limit + 1); // Fetch one extra to detect "has_more"

  if (cursor) {
    query = query.lt('created_at', cursor);
  }

  // Privacy filtering
  if (isTeacher && !isAdmin) {
    // Teachers only see parent<->teacher messages, teacher<->teacher, and teacher<->school
    query = query.in('recipient_type', ['parent', 'teacher', 'school']);
  }

  const { data: rawMessages, error } = await query;

  if (error) {
    console.error('[chat] history error:', error.message);
    return { messages: [], has_more: false };
  }

  let messages = rawMessages || [];

  // Determine has_more
  const hasMore = messages.length > limit;
  if (hasMore) {
    messages = messages.slice(0, limit);
  }

  // Enrich with sender avatars and roles
  const senderIds = [...new Set(messages.map((m: any) => m.sender_id))];
  const avatarMap = new Map<string, string | null>();
  const senderRolesMap = new Map<string, string[]>();

  if (senderIds.length > 0) {
    const [profilesRes, rolesRes] = await Promise.all([
      supabase
        .from('user_profiles')
        .select('id, avatar_url')
        .in('id', senderIds),
      supabase
        .from('user_school_roles')
        .select('user_id, role')
        .in('user_id', senderIds)
        .eq('is_active', true)
    ]);

    if (profilesRes.data) {
      profilesRes.data.forEach((p: any) => avatarMap.set(p.id, p.avatar_url));
    }

    if (rolesRes.data) {
      rolesRes.data.forEach((r: any) => {
        const list = senderRolesMap.get(r.user_id) || [];
        list.push(r.role);
        senderRolesMap.set(r.user_id, list);
      });
    }
  }

  // Filter out private staff-to-staff messages not involving the current user
  if (!isAdmin) {
    messages = messages.filter((m: any) => {
      const senderRoles = senderRolesMap.get(m.sender_id) || [];
      const senderIsStaff = senderRoles.some(r => ['teacher', 'staff', 'school_admin', 'super_admin'].includes(r));
      const recipientIsStaff = m.recipient_type === 'teacher' || m.recipient_type === 'school';
      
      const isStaffToStaff = senderIsStaff && recipientIsStaff;
      const involvesCurrent = m.sender_id === session.user_id;

      if (isStaffToStaff && !involvesCurrent) {
        // If it is staff-to-staff and does not involve the current user:
        // Allow teachers and school staff to see class messages sent to 'teacher'
        if (m.recipient_type === 'teacher' && session.roles.some(r => r.role === 'teacher' || r.role === 'staff')) {
          return true;
        }
        return false;
      }
      return true;
    });
  }

  const enriched: ChatMessage[] = messages.map((m: any) => ({
    ...m,
    message: m.content, // Map content to message for frontend compatibility
    sender_avatar: avatarMap.get(m.sender_id) || null,
  }));

  return { messages: enriched, has_more: hasMore };
}

/**
 * Get unread counts and last message per student for a school (used in student list sidebar).
 */
export async function getUnreadCounts(params: {
  session: AppSession;
  schoolId: string;
}): Promise<UnreadCountResult[]> {
  const { session, schoolId } = params;
  const supabase = getAdminClient();

  // Get all messages for this school, grouped by student
  const { data: messages } = await supabase
    .from('chat_messages')
    .select('student_id, content, created_at, sender_id, sender_name, is_read')
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false });

  if (!messages || messages.length === 0) return [];

  const studentMap = new Map<string, UnreadCountResult>();

  for (const m of messages) {
    if (!studentMap.has(m.student_id)) {
      studentMap.set(m.student_id, {
        student_id: m.student_id,
        unread_count: 0,
        last_message: {
          content: m.content,
          created_at: m.created_at,
          sender_name: m.sender_name,
        },
      });
    }

    const entry = studentMap.get(m.student_id)!;

    // Count unread messages that were NOT sent by the current user
    if (!m.is_read && m.sender_id !== session.user_id) {
      entry.unread_count++;
    }
  }

  return Array.from(studentMap.values());
}

/**
 * Mark all messages in a student thread as read for the current user.
 */
export async function markThreadRead(params: {
  studentId: string;
  userId: string;
}) {
  const { studentId, userId } = params;
  const supabase = getAdminClient();

  // Mark messages as read where the current user is NOT the sender
  // (you can't "read" your own messages)
  await supabase
    .from('chat_messages')
    .update({ is_read: true })
    .eq('student_id', studentId)
    .neq('sender_id', userId)
    .eq('is_read', false);
}

/**
 * Get total unread EduChart messages for the session user (Parent or Staff/Admin).
 */
export async function getEduChartUnreadTotal(session: AppSession): Promise<number> {
  const supabase = getAdminClient();
  const isParent = session.roles.some((r) => r.role === 'parent');

  if (isParent) {
    const { data: links } = await supabase
      .from('student_parents')
      .select('student_id')
      .eq('parent_user_id', session.user_id);

    if (!links || links.length === 0) return 0;
    const studentIds = links.map((l) => l.student_id);

    const { count, error } = await supabase
      .from('chat_messages')
      .select('id', { count: 'exact', head: true })
      .in('student_id', studentIds)
      .eq('is_read', false)
      .neq('sender_id', session.user_id);

    if (error) console.error('[chat] unread total parent error:', error.message);
    return count || 0;
  } else {
    const { data: roles } = await supabase
      .from('user_school_roles')
      .select('school_id')
      .eq('user_id', session.user_id)
      .eq('is_active', true);

    if (!roles || roles.length === 0) return 0;
    const schoolIds = Array.from(new Set(roles.map((r) => r.school_id).filter(Boolean)));

    const { count, error } = await supabase
      .from('chat_messages')
      .select('id', { count: 'exact', head: true })
      .in('school_id', schoolIds)
      .eq('is_read', false)
      .neq('sender_id', session.user_id);

    if (error) console.error('[chat] unread total staff error:', error.message);
    return count || 0;
  }
}

// ---- Internal helpers ----

async function sendNotifications(
  session: AppSession,
  studentId: string,
  schoolId: string,
  recipientType: string,
  content: string,
  studentName: string
) {
  const recipientUserIds = await resolveRecipients({ session, studentId, recipientType });
  if (recipientUserIds.length === 0) return;

  const supabase = getAdminClient();
  const senderName = session.full_name || 'User';
  const title = buildChatTitle(session, recipientType, studentName);

  // Chat messages notify via EduChart icon badges instead of general notification box.
  // Email alerts
  try {
    const { sendEmail } = await import('@/lib/notifications/email-service');
    const { data: recipientProfiles } = await supabase
      .from('user_profiles')
      .select('email')
      .in('id', recipientUserIds);

    if (recipientProfiles) {
      for (const profile of recipientProfiles) {
        if (profile.email) {
          await sendEmail({
            fromName: 'MyEduRide Message',
            to: profile.email,
            subject: title,
            html: `<p><strong>${senderName}</strong> sent a chat message regarding student <strong>${studentName}</strong>:</p>
                   <blockquote style="border-left: 4px solid #1b4d3e; padding-left: 10px; color: #555;">${content.trim()}</blockquote>`,
          }).catch(() => {});
        }
      }
    }
  } catch (e) {
    console.error('[chat] email dispatch warning:', e);
  }
}

/**
 * Verify if a teacher is assigned to a student's class (either as Class Teacher or Subject Teacher).
 */
export async function verifyTeacherStudentAssignment(
  teacherUserId: string,
  studentId: string
): Promise<boolean> {
  const supabase = getAdminClient();

  // 1. Get the teacher's profile ID
  const { data: teacherProfile } = await supabase
    .from('teacher_profiles')
    .select('id')
    .eq('user_id', teacherUserId)
    .maybeSingle();

  if (!teacherProfile) return false;

  // 2. Fetch student class ID
  const { data: student } = await supabase
    .from('students')
    .select('class_id')
    .eq('id', studentId)
    .maybeSingle();

  if (!student || !student.class_id) return false;

  // 3. Check if the class matches the teacher's assigned classes (direct or via assignments)
  const [directClassRes, assignmentRes] = await Promise.all([
    supabase
      .from('school_classes')
      .select('id')
      .eq('id', student.class_id)
      .eq('assigned_teacher_id', teacherProfile.id)
      .maybeSingle(),
    supabase
      .from('teacher_class_assignments')
      .select('id')
      .eq('class_id', student.class_id)
      .eq('teacher_profile_id', teacherProfile.id)
      .maybeSingle(),
  ]);

  return !!(directClassRes.data || assignmentRes.data);
}

