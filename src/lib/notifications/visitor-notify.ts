// @ts-nocheck
import { nowUtcIso } from '@/lib/utils/time';

/**
 * Dispatches high-priority in-app notifications and real-time broadcasts
 * to the designated staff host and school administrators whenever a visitor
 * is created or scanned at the gate.
 */
export async function dispatchVisitorArrivalNotice(
  supabase: any,
  schoolId: string,
  visitor: any,
  trigger: 'created' | 'scanned' = 'created'
) {
  if (!supabase || !schoolId || !visitor) return;

  try {
    const entryTimeFormatted = visitor.entry_time
      ? new Date(visitor.entry_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : 'Just now';

    const targetUserIds = new Set<string>();

    // 1. Direct host user if linked
    if (visitor.host_user_id) {
      targetUserIds.add(visitor.host_user_id);
    }

    // 2. Look up host by name or school admin users for this school
    try {
      const { data: staffRoles } = await supabase
        .from('user_school_roles')
        .select('user_id, role, profile:user_profiles(id, full_name, email, phone)')
        .eq('school_id', schoolId)
        .eq('is_active', true);

      const staffList = staffRoles || [];

      // If host_user_id wasn't set, try to match by name
      if (!visitor.host_user_id && visitor.person_to_see) {
        const queryName = String(visitor.person_to_see).toLowerCase().trim();
        for (const s of staffList) {
          const profileName = String(s.profile?.full_name || '').toLowerCase();
          if (profileName && (profileName.includes(queryName) || queryName.includes(profileName))) {
            targetUserIds.add(s.user_id);
          }
        }
      }

      // Also notify School Administrators so they have live oversight and can accept/decline on behalf
      for (const s of staffList) {
        if (s.role === 'school_admin' || s.role === 'super_admin') {
          targetUserIds.add(s.user_id);
        }
      }
    } catch (lookupErr) {
      console.warn('[dispatchVisitorArrivalNotice] Staff lookup notice:', lookupErr);
    }

    const nowIso = nowUtcIso();
    const isScan = trigger === 'scanned';

    // 3. Insert notification records for all recipients
    const notifRows = Array.from(targetUserIds).map((userId) => {
      const isDirectHost = userId === visitor.host_user_id;
      const title = isScan
        ? `📲 Visitor Scanned at Gate: ${visitor.full_name}`
        : `🔔 Visitor at School Gate: ${visitor.full_name}`;

      const message = isDirectHost
        ? `${visitor.full_name} (${visitor.phone}) is at the school gate to visit you. Purpose: "${visitor.purpose_of_visit}". Arrival Time: ${entryTimeFormatted}. Please open your dashboard to Accept or Decline entry.`
        : `${visitor.full_name} (${visitor.phone}) is at the gate to see ${visitor.person_to_see}. Purpose: "${visitor.purpose_of_visit}". Arrival Time: ${entryTimeFormatted}. Awaiting clearance.`;

      return {
        school_id: schoolId,
        user_id: userId,
        title,
        message,
        type: isScan ? 'visitor_arrival_scan' : 'visitor_access_request',
        priority: 'high',
        is_read: false,
        created_at: nowIso,
      };
    });

    if (notifRows.length > 0) {
      await supabase.from('notifications').insert(notifRows);
    }

    // 4. Real-time Supabase Broadcast
    try {
      const channel = supabase.channel(`school:${schoolId}:visitors`);
      await channel.send({
        type: 'broadcast',
        event: 'visitor_created_or_scanned',
        payload: {
          trigger,
          visitor_id: visitor.id,
          full_name: visitor.full_name,
          phone: visitor.phone,
          purpose_of_visit: visitor.purpose_of_visit,
          person_to_see: visitor.person_to_see,
          department: visitor.department,
          vehicle_plate: visitor.vehicle_plate,
          host_user_id: visitor.host_user_id || null,
          entry_time: visitor.entry_time,
          status: visitor.status || 'on_campus',
          host_response: visitor.host_response || 'pending',
          timestamp: nowIso,
        },
      });
    } catch (broadcastErr) {
      console.warn('[dispatchVisitorArrivalNotice] Broadcast notice:', broadcastErr);
    }
  } catch (err) {
    console.warn('[dispatchVisitorArrivalNotice] General error:', err);
  }
}
