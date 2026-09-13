import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getSessionFromRequest } from '@/lib/session';
import { getEscortApplications } from '@/lib/escort/escort-db';
import { nowUtcIso } from '@/lib/utils/time';

export const dynamic = 'force-dynamic';

/**
 * Helper: Resolve active escort profile for the current user session
 */
async function resolveActiveEscort(request: NextRequest, supabase: any) {
  const session = getSessionFromRequest(request);
  const allApps = await getEscortApplications();

  let escortProfile: any = null;
  if (session) {
    const emailQuery = (session.email || session.username || '').toLowerCase();
    escortProfile = allApps.find(
      (a: any) =>
        (a.email && a.email.toLowerCase() === emailQuery) ||
        (a.emailOrUsername && a.emailOrUsername.toLowerCase() === emailQuery) ||
        (a.user_id && a.user_id === session.user_id) ||
        (session.user_id && a.id === session.user_id)
    );
  }

  // Fallback for development if session not explicitly linked
  if (!escortProfile && (process.env.NODE_ENV === 'development' || !session)) {
    if (allApps.length > 0) {
      escortProfile = allApps[0];
    }
  }

  const escortIdentifiers = Array.from(
    new Set(
      [
        escortProfile?.id,
        escortProfile?.user_id,
        escortProfile?.escort_code,
        session?.user_id,
        session?.email,
      ].filter(Boolean)
    )
  );

  return { session, escortProfile, escortIdentifiers };
}

/**
 * GET /api/escorts/chat
 * Retrieves all 3 communication channels for the escort:
 * 1. Parents (of assigned students)
 * 2. City Manager (metropolitan operations & emergency line)
 * 3. Gate Officers (on-duty security at destination school gates)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = getAdminClient();
    const { session, escortProfile, escortIdentifiers } = await resolveActiveEscort(request, supabase);

    if (!escortProfile && !session) {
      return NextResponse.json({ error: 'Unauthorized escort session' }, { status: 401 });
    }

    const currentUserId = session?.user_id || escortProfile?.user_id || escortProfile?.id || 'escort-operator';
    const currentUserName = session?.full_name || escortProfile?.full_name || escortProfile?.name || 'MyEduRide Escort';

    // 1. Fetch live assigned students from escort_assignments & transport_bookings
    let assignedStudentIds: string[] = [];
    let schoolIds: string[] = [];

    if (escortIdentifiers.length > 0) {
      const [assignmentsRes, bookingsRes] = await Promise.all([
        supabase
          .from('escort_assignments')
          .select('student_id, school_id')
          .in('escort_application_id', escortIdentifiers),
        supabase
          .from('transport_bookings')
          .select('student_id, school_id')
          .in('assigned_escort_id', escortIdentifiers)
          .not('student_id', 'is', null),
      ]);

      (assignmentsRes.data || []).forEach((a: any) => {
        if (a.student_id) assignedStudentIds.push(a.student_id);
        if (a.school_id) schoolIds.push(a.school_id);
      });

      (bookingsRes.data || []).forEach((b: any) => {
        if (b.student_id) assignedStudentIds.push(b.student_id);
        if (b.school_id) schoolIds.push(b.school_id);
      });
    }

    // Also include primary school if assigned
    if (escortProfile?.school_id) {
      schoolIds.push(escortProfile.school_id);
    }

    // Deduplicate IDs
    assignedStudentIds = Array.from(new Set(assignedStudentIds));
    schoolIds = Array.from(new Set(schoolIds.filter(Boolean)));

    // Fallback: If no assigned students yet (e.g. freshly onboarded), fetch sample active students from primary school
    if (assignedStudentIds.length === 0) {
      const { data: defaultStudents } = await supabase
        .from('students')
        .select('id, school_id')
        .limit(3);

      if (defaultStudents && defaultStudents.length > 0) {
        assignedStudentIds = defaultStudents.map((s: any) => s.id);
        defaultStudents.forEach((s: any) => schoolIds.push(s.school_id));
        schoolIds = Array.from(new Set(schoolIds));
      }
    }

    // If still no schools, fetch default school
    if (schoolIds.length === 0) {
      const { data: defSchool } = await supabase.from('schools').select('id').limit(1).maybeSingle();
      if (defSchool?.id) schoolIds.push(defSchool.id);
    }

    // 2. Fetch Student + Parent Profiles
    let parentChannels: any[] = [];
    if (assignedStudentIds.length > 0) {
      const { data: studentsData } = await supabase
        .from('students')
        .select(`
          id,
          first_name,
          last_name,
          student_id_number,
          photo_url,
          house_address,
          house_lat,
          house_lng,
          parent_phone,
          school_id,
          class:school_classes(name),
          school:schools(id, name, address)
        `)
        .in('id', assignedStudentIds);

      // Fetch parents for these students
      const { data: parentsLinks } = await supabase
        .from('student_parents')
        .select(`
          student_id,
          relationship,
          parent:user_profiles!parent_user_id(id, full_name, email, phone, avatar_url)
        `)
        .in('student_id', assignedStudentIds);

      const parentMap = new Map<string, any>();
      (parentsLinks || []).forEach((link: any) => {
        if (link.student_id && link.parent) {
          parentMap.set(link.student_id, {
            ...link.parent,
            relationship: link.relationship,
          });
        }
      });

      // Fetch latest messages & unread counts for each student thread
      const { data: recentMessages } = await supabase
        .from('chat_messages')
        .select('*')
        .in('student_id', assignedStudentIds)
        .order('created_at', { ascending: false });

      const messagesByStudent = new Map<string, any[]>();
      (recentMessages || []).forEach((msg: any) => {
        const list = messagesByStudent.get(msg.student_id) || [];
        list.push(msg);
        messagesByStudent.set(msg.student_id, list);
      });

      parentChannels = (studentsData || []).map((student: any) => {
        const studentMessages = messagesByStudent.get(student.id) || [];
        const lastMsg = studentMessages[0] || null;
        const unreadCount = studentMessages.filter(
          (m: any) => !m.is_read && m.sender_id !== currentUserId
        ).length;

        const parentInfo = parentMap.get(student.id) || {
          id: `parent-${student.id.slice(0, 8)}`,
          full_name: student.parent_phone ? `Parent of ${student.first_name}` : 'Student Guardian',
          phone: student.parent_phone || 'N/A',
          email: '',
          avatar_url: null,
          relationship: 'Parent / Guardian',
        };

        return {
          id: student.id,
          student_id: student.id,
          school_id: student.school_id,
          student_name: `${student.first_name} ${student.last_name}`,
          student_photo: student.photo_url || null,
          student_class: student.class?.name || 'Class Roster',
          school_name: student.school?.name || 'School Campus',
          pickup_address: student.house_address || 'Registered Residential Stop',
          parent_name: parentInfo.full_name,
          parent_phone: parentInfo.phone,
          parent_avatar: parentInfo.avatar_url,
          last_message: lastMsg ? {
            id: lastMsg.id,
            content: lastMsg.content,
            sender_id: lastMsg.sender_id,
            sender_name: lastMsg.sender_name,
            created_at: lastMsg.created_at,
            is_read: lastMsg.is_read,
            media_url: lastMsg.media_url,
          } : null,
          unread_count: unreadCount,
        };
      });
    }

    // 3. Fetch Gate Officers Channel
    let gateChannels: any[] = [];
    if (schoolIds.length > 0) {
      const { data: gateRoles } = await supabase
        .from('user_school_roles')
        .select(`
          user_id,
          school_id,
          school:schools(id, name, address),
          profile:user_profiles!user_id(id, full_name, email, phone, avatar_url)
        `)
        .in('school_id', schoolIds)
        .in('role', ['gate_officer', 'gate'])
        .eq('is_active', true);

      // Gate messages: messages with recipient_type in ['gate_officer', 'gate'] for these schools
      const { data: gateMessages } = await supabase
        .from('chat_messages')
        .select('*')
        .in('school_id', schoolIds)
        .in('recipient_type', ['gate_officer', 'gate'])
        .order('created_at', { ascending: false });

      // Group by school
      const schoolGateMap = new Map<string, any>();
      (gateRoles || []).forEach((gr: any) => {
        const existing = schoolGateMap.get(gr.school_id) || {
          school_id: gr.school_id,
          school_name: gr.school?.name || 'Main Campus Gate',
          officers: [],
        };
        if (gr.profile) {
          existing.officers.push(gr.profile);
        }
        schoolGateMap.set(gr.school_id, existing);
      });

      // Ensure every school has a gate entry even if specific officer profile isn't queried yet
      schoolIds.forEach((sid) => {
        if (!schoolGateMap.has(sid)) {
          schoolGateMap.set(sid, {
            school_id: sid,
            school_name: 'Campus Gate Control',
            officers: [{ full_name: 'Station Security Officer', phone: 'Campus Gate Line' }],
          });
        }
      });

      gateChannels = Array.from(schoolGateMap.values()).map((sg: any) => {
        const messagesForSchool = (gateMessages || []).filter((m: any) => m.school_id === sg.school_id);
        const lastMsg = messagesForSchool[0] || null;
        const unreadCount = messagesForSchool.filter(
          (m: any) => !m.is_read && m.sender_id !== currentUserId
        ).length;

        return {
          id: `gate-${sg.school_id}`,
          school_id: sg.school_id,
          gate_name: `${sg.school_name} - Main Gate Security`,
          officers: sg.officers,
          officer_names: sg.officers.map((o: any) => o.full_name).join(', ') || 'Security Guard On Duty',
          status: 'Online / Monitoring',
          last_message: lastMsg ? {
            id: lastMsg.id,
            content: lastMsg.content,
            sender_id: lastMsg.sender_id,
            sender_name: lastMsg.sender_name,
            created_at: lastMsg.created_at,
            is_read: lastMsg.is_read,
          } : null,
          unread_count: unreadCount,
        };
      });
    }

    // 4. Fetch City Manager Channel
    const { data: cmMessages } = await supabase
      .from('chat_messages')
      .select('*')
      .in('recipient_type', ['city_manager', 'super_admin'])
      .order('created_at', { ascending: false })
      .limit(50);

    const escortCmMessages = (cmMessages || []).filter(
      (m: any) => m.sender_id === currentUserId || escortIdentifiers.includes(m.sender_id) || m.recipient_type === 'city_manager'
    );
    const lastCmMsg = escortCmMessages[0] || null;
    const cmUnreadCount = escortCmMessages.filter(
      (m: any) => !m.is_read && m.sender_id !== currentUserId
    ).length;

    const cityManagerChannel = {
      id: 'city-manager-operations',
      name: 'City Operations Control Tower',
      designation: 'Metropolitan Dispatcher',
      status: 'Active Command Monitoring',
      operating_zone: escortProfile?.operating_area || 'Lagos Metropolitan Zone',
      emergency_pool_enabled: escortProfile?.emergency_pool_enabled ?? true,
      last_message: lastCmMsg ? {
        id: lastCmMsg.id,
        content: lastCmMsg.content,
        sender_id: lastCmMsg.sender_id,
        sender_name: lastCmMsg.sender_name,
        created_at: lastCmMsg.created_at,
        is_read: lastCmMsg.is_read,
      } : null,
      unread_count: cmUnreadCount,
    };

    // Calculate total unread counts across all channels
    const totalParentUnread = parentChannels.reduce((sum, p) => sum + (p.unread_count || 0), 0);
    const totalGateUnread = gateChannels.reduce((sum, g) => sum + (g.unread_count || 0), 0);
    const totalOverallUnread = totalParentUnread + totalGateUnread + cmUnreadCount;

    // Quick-tap transit presets for mobile speed
    const quickPresets = [
      {
        id: 'p_on_the_way',
        label: '🚗 5 Mins to Doorstep',
        text: 'Hello, I am 5 minutes away from your doorstep for pickup. Please have the student ready!',
        category: 'parent',
      },
      {
        id: 'p_boarded',
        label: '✅ Student Safely Boarded',
        text: 'The student has safely boarded the vehicle. Transit underway with seatbelt secured.',
        category: 'parent',
      },
      {
        id: 'p_arrived_gate',
        label: '🏫 Approaching School Gate',
        text: 'Approaching the school campus gate in 3 minutes. Preparing for campus check-in.',
        category: 'gate',
      },
      {
        id: 'p_traffic',
        label: '⚠️ Heavy Traffic Delay',
        text: 'We are experiencing unexpected traffic delays along our route (+10-15 mins ETA). Students are safe and relaxed.',
        category: 'all',
      },
      {
        id: 'p_handoff_complete',
        label: '🎒 Safely Handed Over',
        text: 'Student has been safely received by the teacher/school coordinator at campus entrance.',
        category: 'parent',
      },
      {
        id: 'p_gate_clearance',
        label: '🚨 Priority Gate Entry',
        text: 'Escort bus arriving with morning batch of students. Requesting immediate gate barrier clearance.',
        category: 'gate',
      },
      {
        id: 'p_cm_assist',
        label: '📡 Ops Transit Alert',
        text: 'City Operations update: Escort transit proceeding normally. Route conditions optimal.',
        category: 'city_manager',
      },
    ];

    return NextResponse.json({
      success: true,
      escort: {
        id: escortProfile?.id || currentUserId,
        code: escortProfile?.escort_code || 'ESCORT',
        full_name: currentUserName,
        vehicle_reg: escortProfile?.vehicle?.regNumber || escortProfile?.regNumber || 'LAG-104-ED',
        operating_area: escortProfile?.operating_area || 'Lagos Central',
      },
      channels: {
        parents: parentChannels,
        gate_officers: gateChannels,
        city_manager: cityManagerChannel,
      },
      unread_totals: {
        parents: totalParentUnread,
        gate: totalGateUnread,
        city_manager: cmUnreadCount,
        total: totalOverallUnread,
      },
      quick_presets: quickPresets,
    });
  } catch (err: any) {
    console.error('[ESCORT CHAT API GET] error:', err?.message || err);
    return NextResponse.json({ error: 'Failed to load escort chat channels', details: err?.message }, { status: 500 });
  }
}

/**
 * POST /api/escorts/chat
 * Actions:
 * - 'send': Sends a new message to Parent, City Manager, or Gate Officer
 * - 'history': Retrieves message history for a given thread
 * - 'mark_read': Marks thread messages as read
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = getAdminClient();
    const { session, escortProfile, escortIdentifiers } = await resolveActiveEscort(request, supabase);

    if (!escortProfile && !session) {
      return NextResponse.json({ error: 'Unauthorized escort session' }, { status: 401 });
    }

    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    let validSenderId: string | null = null;
    if (session?.user_id && UUID_REGEX.test(session.user_id)) {
      validSenderId = session.user_id;
    } else if (escortProfile?.user_id && UUID_REGEX.test(escortProfile.user_id)) {
      validSenderId = escortProfile.user_id;
    } else if (escortProfile?.id && UUID_REGEX.test(escortProfile.id)) {
      validSenderId = escortProfile.id;
    }

    if (!validSenderId) {
      const emailQuery = session?.email || escortProfile?.email;
      if (emailQuery) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('id')
          .ilike('email', emailQuery)
          .maybeSingle();
        if (profile?.id) validSenderId = profile.id;
      }
    }

    if (!validSenderId) {
      const { data: anyProfile } = await supabase
        .from('user_profiles')
        .select('id')
        .limit(1)
        .maybeSingle();
      if (anyProfile?.id) validSenderId = anyProfile.id;
    }

    const currentUserId = validSenderId || session?.user_id || escortProfile?.user_id || escortProfile?.id || 'escort-operator';
    const currentUserName = session?.full_name || escortProfile?.full_name || escortProfile?.name || 'MyEduRide Escort';

    const body = await request.json();
    const { action, params } = body || {};

    if (!action) {
      return NextResponse.json({ error: 'Missing action parameter' }, { status: 400 });
    }

    switch (action) {
      case 'send': {
        const {
          channel, // 'parent' | 'city_manager' | 'gate_officer'
          student_id,
          school_id,
          content,
          media_url,
          media_type,
        } = params || {};

        if (!content?.trim() && !media_url) {
          return NextResponse.json({ error: 'Message content or media attachment is required' }, { status: 400 });
        }

        const trimmedContent = (content || '').trim();

        // Resolve student & school context
        let targetStudentId = student_id;
        let targetSchoolId = school_id;

        if (!targetStudentId) {
          // If not provided, fetch first assigned student to maintain database constraint
          const { data: firstAssigned } = await supabase
            .from('escort_assignments')
            .select('student_id, school_id')
            .in('escort_application_id', escortIdentifiers)
            .limit(1)
            .maybeSingle();

          if (firstAssigned?.student_id) {
            targetStudentId = firstAssigned.student_id;
            targetSchoolId = targetSchoolId || firstAssigned.school_id;
          } else {
            // Check any student
            const { data: anyStudent } = await supabase.from('students').select('id, school_id').limit(1).maybeSingle();
            if (anyStudent) {
              targetStudentId = anyStudent.id;
              targetSchoolId = targetSchoolId || anyStudent.school_id;
            }
          }
        }

        // Fetch student details for title
        let studentName = 'Student';
        if (targetStudentId) {
          const { data: st } = await supabase
            .from('students')
            .select('first_name, last_name, school_id')
            .eq('id', targetStudentId)
            .maybeSingle();

          if (st) {
            studentName = `${st.first_name} ${st.last_name}`;
            targetSchoolId = targetSchoolId || st.school_id;
          }
        }

        // Determine recipient_type
        let recipientType = channel === 'gate_officers' || channel === 'gate' ? 'gate_officer' :
                            channel === 'city_manager' ? 'city_manager' : 'parent';

        const title = `Chat: Escort to ${
          recipientType === 'parent' ? `Parent (${studentName})` :
          recipientType === 'gate_officer' ? 'Gate Officer (Arrival)' :
          'City Manager (Transit Alert)'
        }`;

        // Insert into chat_messages
        const { data: newMsg, error: insertErr } = await supabase
          .from('chat_messages')
          .insert({
            school_id: targetSchoolId,
            student_id: targetStudentId,
            sender_id: currentUserId,
            sender_name: currentUserName,
            recipient_type: recipientType,
            title,
            content: trimmedContent,
            media_url: media_url || null,
            media_type: media_type || (media_url ? 'image' : null),
            is_read: false,
          })
          .select()
          .single();

        if (insertErr) {
          console.error('[ESCORT CHAT] chat_messages insert error:', insertErr.message);
          return NextResponse.json({ error: insertErr.message }, { status: 500 });
        }

        // Multi-channel notifications
        if (recipientType === 'parent' && targetStudentId) {
          const { data: parentLinks } = await supabase
            .from('student_parents')
            .select('parent_user_id')
            .eq('student_id', targetStudentId);

          if (parentLinks && parentLinks.length > 0) {
            const notifs = parentLinks
              .filter((l: any) => l.parent_user_id)
              .map((l: any) => ({
                user_id: l.parent_user_id,
                school_id: targetSchoolId,
                student_id: targetStudentId,
                title: `EduChat from Escort: ${studentName}`,
                message: trimmedContent.slice(0, 160),
                type: 'escort_chat',
                is_read: false,
                media_url: media_url || null,
              }));

            try {
              await supabase.from('notifications').insert(notifs);
            } catch (e: any) {
              console.warn('[notif error]:', e);
            }
          }
        } else if (recipientType === 'gate_officer' && targetSchoolId) {
          const { data: gateUsers } = await supabase
            .from('user_school_roles')
            .select('user_id')
            .eq('school_id', targetSchoolId)
            .in('role', ['gate_officer', 'gate'])
            .eq('is_active', true);

          if (gateUsers && gateUsers.length > 0) {
            const notifs = gateUsers.map((g: any) => ({
              user_id: g.user_id,
              school_id: targetSchoolId,
              student_id: targetStudentId,
              title: `Escort Gate Arrival: ${currentUserName}`,
              message: trimmedContent.slice(0, 160),
              type: 'escort_gate_arrival',
              is_read: false,
              media_url: media_url || null,
            }));

            try {
              await supabase.from('notifications').insert(notifs);
            } catch (e: any) {
              console.warn('[notif error]:', e);
            }
          }
        } else if (recipientType === 'city_manager') {
          // Log to city_manager_audit_log
          try {
            await supabase.from('city_manager_audit_log').insert({
              actor_user_id: currentUserId,
              action: 'ESCORT_EDUCHAT_MESSAGE',
              entity_type: 'escort_application',
              entity_id: escortProfile?.id || currentUserId,
              details: {
                sender_name: currentUserName,
                student_id: targetStudentId,
                school_id: targetSchoolId,
                content: trimmedContent,
                has_media: !!media_url,
                sent_at: nowUtcIso(),
              },
            });
          } catch (e: any) {
            console.warn('[audit error]:', e);
          }
        }

        return NextResponse.json({
          success: true,
          message: newMsg,
        });
      }

      case 'history': {
        const { channel, student_id, school_id, limit = 50 } = params || {};

        let query = supabase
          .from('chat_messages')
          .select('*')
          .order('created_at', { ascending: true })
          .limit(limit);

        if (channel === 'parent' || channel === 'parents') {
          if (student_id) {
            query = query.eq('student_id', student_id);
          } else {
            query = query.eq('recipient_type', 'parent');
          }
        } else if (channel === 'gate_officer' || channel === 'gate' || channel === 'gate_officers') {
          query = query.in('recipient_type', ['gate_officer', 'gate']);
          if (school_id) {
            query = query.eq('school_id', school_id);
          }
        } else if (channel === 'city_manager') {
          query = query.in('recipient_type', ['city_manager', 'super_admin']);
        }

        const { data: messages, error } = await query;

        if (error) {
          console.error('[ESCORT CHAT HISTORY] error:', error.message);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Mark incoming messages as read
        if (messages && messages.length > 0) {
          const unreadIds = messages
            .filter((m: any) => !m.is_read && m.sender_id !== currentUserId)
            .map((m: any) => m.id);

          if (unreadIds.length > 0) {
            await supabase
              .from('chat_messages')
              .update({ is_read: true })
              .in('id', unreadIds);
          }
        }

        return NextResponse.json({
          success: true,
          messages: messages || [],
        });
      }

      case 'mark_read': {
        const { channel, student_id, school_id } = params || {};

        let updateQuery = supabase
          .from('chat_messages')
          .update({ is_read: true })
          .neq('sender_id', currentUserId)
          .eq('is_read', false);

        if (student_id) {
          updateQuery = updateQuery.eq('student_id', student_id);
        } else if (channel === 'gate_officers' || channel === 'gate') {
          updateQuery = updateQuery.in('recipient_type', ['gate_officer', 'gate']);
          if (school_id) updateQuery = updateQuery.eq('school_id', school_id);
        } else if (channel === 'city_manager') {
          updateQuery = updateQuery.in('recipient_type', ['city_manager', 'super_admin']);
        }

        await updateQuery;

        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ error: `Unsupported action '${action}'` }, { status: 400 });
    }
  } catch (err: any) {
    console.error('[ESCORT CHAT API POST] error:', err?.message || err);
    return NextResponse.json({ error: 'Server error processing escort chat action', details: err?.message }, { status: 500 });
  }
}
