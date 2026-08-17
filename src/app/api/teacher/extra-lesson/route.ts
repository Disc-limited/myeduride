import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getSessionFromRequest, sessionHasRole } from '@/lib/session';
import { assertTeacherStudentAccess } from '@/lib/attendance/teacher-access';
import { todayInLagos } from '@/lib/timezone';
import { sendEmail } from '@/lib/notifications/email-service';
import { sendPushToUser } from '@/lib/push/send';
import { getParentRecipientsForStudent } from '@/lib/notifications/parent-recipients';
import { writeAuditLog } from '@/lib/audit/log';

export const dynamic = 'force-dynamic';

/**
 * POST /api/teacher/extra-lesson
 * body: { student_id, school_id, lesson_end_time?, reason?, action: 'add' | 'release' }
 *
 * add     → mark student as staying for extra lesson / delayed release with reason
 * release → end extra lesson and mark student ready for pickup
 */
export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { student_id, school_id, lesson_end_time, reason, action } = await request.json();
    if (!student_id || !school_id || !action) {
      return NextResponse.json({ error: 'student_id, school_id, action required' }, { status: 400 });
    }

    const isTeacher = session.roles.some(
      (r) => r.school_id === school_id && ['teacher', 'school_admin'].includes(r.role)
    );
    if (!isTeacher && !sessionHasRole(session, 'super_admin')) {
      return NextResponse.json({ error: 'Teacher access required' }, { status: 403 });
    }

    const supabase = getAdminClient();
    const access = await assertTeacherStudentAccess(supabase, session, school_id, student_id);
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const today = todayInLagos();

    if (action === 'add') {
      const payload: Record<string, unknown> = {
        student_id,
        school_id,
        teacher_user_id: session.user_id,
        lesson_end_time: lesson_end_time || null,
        date: today,
        is_released: false,
      };
      if (reason !== undefined) {
        payload.reason = reason ? reason.trim() : null;
      }

      let { data, error } = await supabase
        .from('extra_lessons')
        .upsert(payload, { onConflict: 'student_id,date' })
        .select()
        .single();

      if (error && error.message?.includes('reason')) {
        // Fallback if column doesn't exist yet on live DB
        delete payload.reason;
        const fallback = await supabase
          .from('extra_lessons')
          .upsert(payload, { onConflict: 'student_id,date' })
          .select()
          .single();
        data = fallback.data;
        error = fallback.error;
      }

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // 1. Audit Log teacher action
      await writeAuditLog(supabase, {
        school_id,
        actor_user_id: session.user_id,
        student_id,
        action: 'TEACHER_EXTEND_RELEASE_TIME',
        entity_type: 'extra_lesson',
        entity_id: data?.id || null,
        details: {
          lesson_end_time: lesson_end_time || null,
          reason: reason || 'Teacher delay notice',
        },
      });

      // 2. Notify Parents & Escorts of extended release time and reason
      const { data: student } = await supabase
        .from('students')
        .select('*, class:school_classes(name), school:schools(name, primary_color)')
        .eq('id', student_id)
        .single();

      if (student) {
        const schoolObj = Array.isArray(student.school) ? student.school[0] : student.school;
        const schoolName = schoolObj?.name || 'School';
        const schoolColor = schoolObj?.primary_color || '#1B4D3E';
        const formattedEndTime = lesson_end_time ? `until ${lesson_end_time}` : 'for an extended lesson';
        const reasonText = reason?.trim() ? reason.trim() : 'Teacher scheduled extra class / activity';

        const title = `⏳ Release time extended: ${student.first_name}`;
        const message = `${student.first_name} ${student.last_name}'s release time has been extended ${formattedEndTime}. Reason: ${reasonText}.`;

        const emailHtml = `
          <div style="font-family:-apple-system,sans-serif;max-width:480px;margin:0 auto;">
            <div style="background:${schoolColor};padding:20px;text-align:center;border-radius:12px 12px 0 0;">
              <h2 style="color:white;margin:0;font-size:16px;">${schoolName}</h2>
            </div>
            <div style="padding:24px;background:white;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
              <div style="text-align:center;margin-bottom:16px;">
                <span style="font-size:40px;">⏳</span>
              </div>
              <h3 style="text-align:center;color:#1f2937;margin:0 0 16px;">Student Release Time Extended</h3>
              <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:8px;padding:16px;margin-bottom:16px;">
                <p style="margin:4px 0;color:#92400e;"><strong>Student:</strong> ${student.first_name} ${student.last_name}</p>
                <p style="margin:4px 0;color:#92400e;"><strong>New Release Time:</strong> ${lesson_end_time || 'Extended'}</p>
                <p style="margin:4px 0;color:#92400e;"><strong>Reason:</strong> ${reasonText}</p>
              </div>
              <p style="text-align:center;color:#6b7280;font-size:13px;">
                Please adjust your pickup timing accordingly. Your child will be marked ready at the new time.
              </p>
              <p style="text-align:center;color:#9ca3af;font-size:12px;margin-top:20px;">MyEduRide</p>
            </div>
          </div>
        `;

        const parents = await getParentRecipientsForStudent(supabase, student_id);

        for (const parent of parents) {
          let emailSent = false;
          if (parent.email) {
            try {
              await sendEmail({
                fromName: `${schoolName} via MyEduRide`,
                to: parent.email,
                subject: `⏳ Extended Release Time notice for ${student.first_name}`,
                html: emailHtml,
              });
              emailSent = true;
            } catch (e) {
              console.error('[extra-lesson] email failed:', parent.email, e);
            }
          }

          if (parent.user_id) {
            try {
              await sendPushToUser(supabase, parent.user_id, {
                title,
                message,
                type: 'dismissal',
                student_id: student.id,
                url: '/dashboard/parent',
                tag: `delay-${student.id}-${today}`,
              });
            } catch (e) {
              console.error('[extra-lesson] push failed:', e);
            }

            await supabase.from('notifications').insert({
              user_id: parent.user_id,
              school_id,
              student_id,
              title,
              message,
              type: 'dismissal',
              is_read: false,
              email_sent: emailSent,
              push_sent: true,
            });
          }
        }
      }

      return NextResponse.json({ success: true, extra_lesson: data });
    }

    if (action === 'release') {
      const { error } = await supabase
        .from('extra_lessons')
        .update({ is_released: true, released_at: new Date().toISOString() })
        .eq('student_id', student_id)
        .eq('school_id', school_id)
        .eq('date', today);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // Audit Log teacher action
      await writeAuditLog(supabase, {
        school_id,
        actor_user_id: session.user_id,
        student_id,
        action: 'TEACHER_RELEASE_FROM_EXTRA_LESSON',
        entity_type: 'extra_lesson',
        details: { released_at: new Date().toISOString() },
      });

      const readyRes = await fetch(new URL('/api/teacher/ready-for-pickup', request.url).toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: request.headers.get('cookie') || '',
        },
        body: JSON.stringify({ student_id, school_id }),
      });

      const readyJson = await readyRes.json();
      if (!readyRes.ok && readyRes.status !== 409) {
        return NextResponse.json(
          { error: readyJson.error || 'Extra lesson ended but ready-for-pickup failed' },
          { status: readyRes.status }
        );
      }

      return NextResponse.json({
        success: true,
        ready: readyRes.ok,
        dismissal: readyJson.dismissal || null,
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: unknown) {
    console.error('[extra-lesson]', err);
    const message = err instanceof Error ? err.message : 'Failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

