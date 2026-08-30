import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getSessionFromRequest } from '@/lib/session';
import { sendEmail } from '@/lib/notifications/email-service';
import { writeAuditLog } from '@/lib/audit/log';
import { nowUtcIso } from '@/lib/utils/time';

export const dynamic = 'force-dynamic';

/**
 * GET /api/school-admin/notices?school_id=xxx
 * Returns sent notice history for the school.
 */
export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    let schoolId = searchParams.get('school_id');
    const sessAny = session as any;
    const supabase = getAdminClient();

    if (!schoolId || schoolId === 'undefined' || schoolId === 'null') {
      schoolId = sessAny.primary_school_id || sessAny.school_id || sessAny.primary_school?.id || null;
    }

    if (!schoolId && session.user_id) {
      const { data: prof } = await supabase
        .from('user_profiles')
        .select('school_id, primary_school_id')
        .eq('id', session.user_id)
        .maybeSingle();
      schoolId = prof?.school_id || prof?.primary_school_id || null;
    }

    if (!schoolId) {
      return NextResponse.json({ error: 'school_id parameter is required' }, { status: 400 });
    }

    const { data: notices, error } = await supabase
      .from('school_notices')
      .select('*')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) throw error;

    return NextResponse.json({ success: true, notices: notices || [] });
  } catch (err: any) {
    console.error('[GET /api/school-admin/notices] error:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch notices' }, { status: 500 });
  }
}

/**
 * POST /api/school-admin/notices
 * Broadcasts a vital notice to targeted user groups across the school.
 */
export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      school_id,
      title,
      message,
      category = 'general',
      target_audiences = ['parents', 'teachers', 'escorts', 'gate_officers'],
      send_email = true,
      media_url = null,
    } = body;

    const supabase = getAdminClient();
    const sessAny = session as any;

    let targetSchoolId = school_id;
    if (!targetSchoolId || targetSchoolId === 'undefined' || targetSchoolId === 'null') {
      targetSchoolId = sessAny.primary_school_id || sessAny.school_id || sessAny.primary_school?.id || null;
    }

    if (!targetSchoolId && session.user_id) {
      const { data: prof } = await supabase
        .from('user_profiles')
        .select('school_id, primary_school_id')
        .eq('id', session.user_id)
        .maybeSingle();
      targetSchoolId = prof?.school_id || prof?.primary_school_id || null;
    }

    if (!targetSchoolId && session.user_id) {
      const { data: roleRow } = await supabase
        .from('user_school_roles')
        .select('school_id')
        .eq('user_id', session.user_id)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();
      if (roleRow?.school_id) targetSchoolId = roleRow.school_id;
    }

    if (!title || !message) {
      return NextResponse.json({ error: 'Title and message content are required' }, { status: 400 });
    }

    if (!targetSchoolId) {
      return NextResponse.json({ error: 'Unable to resolve target school ID for this administrator session.' }, { status: 400 });
    }

    const school_id_clean = targetSchoolId;

    // 1. Resolve school name
    const { data: school } = await supabase
      .from('schools')
      .select('id, name')
      .eq('id', school_id_clean)
      .maybeSingle();

    const schoolName = school?.name || 'School Administration';

    // 2. Resolve targeted user IDs & emails
    const targetUserIdSet = new Set<string>();
    const targetEmailSet = new Set<string>();

    const targetAll = target_audiences.includes('all');

    // 2.1 Direct user_profiles resolution by school_id or primary_school_id
    try {
      const { data: directUsers } = await supabase
        .from('user_profiles')
        .select('id, email, role, school_id, primary_school_id')
        .or(`school_id.eq.${school_id_clean},primary_school_id.eq.${school_id_clean}`);

      if (directUsers) {
        for (const u of directUsers) {
          if (!u?.id) continue;
          const r = (u.role || '').toLowerCase();
          const isTeacher = r === 'teacher' || r === 'staff';
          const isGate = r === 'gate_officer' || r === 'gatemanager' || r === 'gate';
          const isEscortRole = r === 'escort';
          const isParentRole = r === 'parent';
          const isStudentRole = r === 'student';

          if (
            targetAll ||
            (target_audiences.includes('teachers') && isTeacher) ||
            (target_audiences.includes('gate_officers') && isGate) ||
            (target_audiences.includes('escorts') && isEscortRole) ||
            (target_audiences.includes('parents') && isParentRole) ||
            (target_audiences.includes('students') && isStudentRole)
          ) {
            targetUserIdSet.add(u.id);
            if (u.email) targetEmailSet.add(u.email);
          }
        }
      }
    } catch (err) {
      console.warn('[notices] direct user_profiles query notice:', err);
    }

    // 2.2 Staff / Teachers / Gate Officers via user_school_roles
    try {
      let roleQuery = supabase
        .from('user_school_roles')
        .select('user_id, role, user_profiles(id, email, full_name)')
        .eq('school_id', school_id_clean)
        .eq('is_active', true);

      const { data: roles } = await roleQuery;
      if (roles) {
        for (const r of roles) {
          const u = Array.isArray(r.user_profiles) ? r.user_profiles[0] : r.user_profiles;
          if (!u?.id) continue;

          const isTeacher = r.role === 'teacher' || r.role === 'staff';
          const isGate = r.role === 'gate_officer' || r.role === 'gatemanager';
          const isEscortRole = r.role === 'escort';
          const isParentRole = r.role === 'parent';

          if (
            targetAll ||
            (target_audiences.includes('teachers') && isTeacher) ||
            (target_audiences.includes('gate_officers') && isGate) ||
            (target_audiences.includes('escorts') && isEscortRole) ||
            (target_audiences.includes('parents') && isParentRole)
          ) {
            targetUserIdSet.add(u.id);
            if (u.email) targetEmailSet.add(u.email);
          }
        }
      }
    } catch (err) {
      console.warn('[notices] user_school_roles query notice:', err);
    }

    // 2.3 Parents linked to students in school (regardless of student active flag)
    if (targetAll || target_audiences.includes('parents') || target_audiences.includes('students')) {
      try {
        const { data: schoolStudents } = await supabase
          .from('students')
          .select('id, parent_id, school_id')
          .eq('school_id', school_id_clean);

        if (schoolStudents && schoolStudents.length > 0) {
          const parentIds = Array.from(new Set(schoolStudents.map((s) => s.parent_id).filter(Boolean)));
          if (parentIds.length > 0) {
            const { data: parentProfiles } = await supabase
              .from('user_profiles')
              .select('id, email')
              .in('id', parentIds);

            if (parentProfiles) {
              for (const p of parentProfiles) {
                targetUserIdSet.add(p.id);
                if (p.email) targetEmailSet.add(p.email);
              }
            }
          }
        }
      } catch (err) {
        console.warn('[notices] parents query notice:', err);
      }
    }

    // 2.4 Staff profiles for teachers & gate officers
    if (targetAll || target_audiences.includes('teachers') || target_audiences.includes('gate_officers')) {
      try {
        const { data: staffMembers } = await supabase
          .from('staff_profiles')
          .select('id, user_id, email, role')
          .eq('school_id', school_id_clean);

        if (staffMembers) {
          for (const s of staffMembers) {
            const r = (s.role || '').toLowerCase();
            const isTeacher = r === 'teacher' || r === 'staff';
            const isGate = r === 'gate_officer' || r === 'gatemanager' || r === 'gate';

            if (
              targetAll ||
              (target_audiences.includes('teachers') && isTeacher) ||
              (target_audiences.includes('gate_officers') && isGate)
            ) {
              if (s.user_id) targetUserIdSet.add(s.user_id);
              if (s.email) targetEmailSet.add(s.email);
            }
          }
        }
      } catch (err) {
        console.warn('[notices] staff_profiles query notice:', err);
      }
    }

    // 2.5 Escorts registered for this school
    if (targetAll || target_audiences.includes('escorts')) {
      try {
        const { data: escorts } = await supabase
          .from('escort_applications')
          .select('id, user_id, email')
          .or(`school_id.eq.${school_id_clean},primary_school_id.eq.${school_id_clean}`);

        if (escorts) {
          for (const e of escorts) {
            if (e.user_id) targetUserIdSet.add(e.user_id);
            if (e.email) targetEmailSet.add(e.email);
          }
        }
      } catch (err) {
        console.warn('[notices] escorts query notice:', err);
      }
    }

    // 2.6 Resolve any emails in targetEmailSet to user_profiles.id
    if (targetEmailSet.size > 0) {
      try {
        const emailsArray = Array.from(targetEmailSet);
        const { data: matchedProfiles } = await supabase
          .from('user_profiles')
          .select('id, email')
          .in('email', emailsArray);

        if (matchedProfiles) {
          for (const p of matchedProfiles) {
            if (p.id) targetUserIdSet.add(p.id);
          }
        }
      } catch (err) {
        console.warn('[notices] email to user_profiles lookup notice:', err);
      }
    }

    const targetUserIds = Array.from(targetUserIdSet);
    const targetEmails = Array.from(targetEmailSet);

    const categoryLabels: Record<string, string> = {
      public_holiday: 'Public Holiday Announcement',
      urgent: 'Urgent Advisory',
      event: 'Event Announcement',
      emergency: 'Emergency Safety Alert',
      general: 'School Notice',
    };

    const categoryTitle = categoryLabels[category] || 'School Notice';

    // 3. Insert notification rows into notifications table for in-app inbox
    if (targetUserIds.length > 0) {
      const notificationRows = targetUserIds.map((uid) => ({
        user_id: uid,
        school_id: school_id_clean,
        title: `[${categoryTitle}] ${title}`,
        message: message,
        type: 'notice',
        media_url: media_url || null,
        is_read: false,
        created_at: nowUtcIso(),
      }));

      // Batch insert in chunks of 100
      for (let i = 0; i < notificationRows.length; i += 100) {
        const chunk = notificationRows.slice(i, i + 100);
        await supabase.from('notifications').insert(chunk);
      }
    }

    // 4. Send email notifications if enabled
    if (send_email && targetEmails.length > 0) {
      const emailSubject = `[${schoolName}] ${categoryTitle}: ${title}`;
      const emailBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
          <div style="background-color: #0B1E36; padding: 20px; text-align: center; color: white;">
            <h2 style="margin: 0; font-size: 20px;">${schoolName}</h2>
            <p style="margin: 5px 0 0 0; font-size: 12px; color: #a0aec0;">Official School Announcement</p>
          </div>
          <div style="padding: 24px; background-color: #ffffff; color: #2d3748;">
            <span style="display: inline-block; background-color: #ebf8ff; color: #2b6cb0; font-size: 11px; font-weight: bold; padding: 4px 10px; rounded-radius: 20px; text-transform: uppercase; margin-bottom: 12px;">
              ${categoryTitle}
            </span>
            <h3 style="margin-top: 0; color: #1a202c; font-size: 18px;">${title}</h3>
            <div style="font-size: 14px; line-height: 1.6; color: #4a5568; white-space: pre-wrap; margin-bottom: 20px;">
              ${message}
            </div>
            ${
              media_url
                ? `<div style="margin-bottom: 20px;"><a href="${media_url}" style="color: #3182ce; font-weight: bold; text-decoration: underline;">View Notice Attachment / Document</a></div>`
                : ''
            }
            <hr style="border: none; border-top: 1px solid #edf2f7; margin: 20px 0;" />
            <p style="font-size: 11px; color: #a0aec0; margin: 0;">
              This vital notice was issued by ${schoolName} Administration via MyEduRide Safety System.
            </p>
          </div>
        </div>
      `;

      // Async email dispatch
      for (const email of targetEmails) {
        try {
          await sendEmail({
            to: email,
            subject: emailSubject,
            html: emailBody,
          });
        } catch (e) {
          console.warn(`[notices] email dispatch warning for ${email}:`, e);
        }
      }
    }

    // 5. Save notice record in school_notices table for admin log
    const { data: noticeRecord, error: noticeErr } = await supabase
      .from('school_notices')
      .insert({
        school_id: school_id_clean,
        sender_user_id: session.user_id,
        title,
        message,
        category: category,
        target_audiences: target_audiences,
        recipient_count: targetUserIds.length,
        send_email: !!send_email,
        media_url: media_url || null,
        created_at: nowUtcIso(),
      })
      .select()
      .single();

    if (noticeErr) {
      console.warn('[notices] school_notices insert warning:', noticeErr);
    }

    // 6. Log audit event
    await writeAuditLog(supabase, {
      school_id: school_id_clean,
      actor_user_id: session.user_id,
      action: 'SEND_SCHOOL_NOTICE',
      entity_type: 'school_notices',
      entity_id: noticeRecord?.id || null,
      details: { title, category, recipient_count: targetUserIds.length, target_audiences },
    });

    return NextResponse.json({
      success: true,
      message: `Notice dispatched to ${targetUserIds.length} recipient(s) across target community groups.`,
      recipient_count: targetUserIds.length,
      notice: noticeRecord,
    });
  } catch (err: any) {
    console.error('[POST /api/school-admin/notices] error:', err);
    return NextResponse.json({ error: err.message || 'Failed to dispatch notice' }, { status: 500 });
  }
}
