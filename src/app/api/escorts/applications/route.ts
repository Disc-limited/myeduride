import { NextRequest, NextResponse } from 'next/server';
import { getEscortApplications, updateEscortApplicationStatus } from '@/lib/escort/escort-db';
import { sendEmail } from '@/lib/notifications/email-service';
import { getAdminClient } from '@/lib/supabase/admin';
import { getSessionFromRequest } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const city = searchParams.get('city') || undefined;

    const applications = await getEscortApplications(city);
    return NextResponse.json({ success: true, applications });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch escort applications';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { appId, status, notes, escortEmail, escortName, uploadedDocDetails, isResubmitted, nin, photo } = body;

    if (!appId || !status) {
      return NextResponse.json(
        { error: 'Application ID (appId) and status are required' },
        { status: 400 }
      );
    }



    const result = await updateEscortApplicationStatus(appId, status, notes, { uploadedDocDetails, isResubmitted, nin, photo });

    // Keep City Manager approval decisions in the central accountability ledger.
    if (['CITY_MANAGER_APPROVED', 'REJECTED', 'CORRECTION_REQUESTED', 'ESCALATED'].includes(status)) {
      try {
        const session = getSessionFromRequest(request);
        await getAdminClient().from('city_manager_audit_log').insert({
          actor_user_id: session?.user_id || null,
          action: 'ESCORT_APPLICATION_' + status,
          entity_type: 'escort_application',
          entity_id: appId,
          details: { notes: notes || null },
        });
      } catch (auditError) {
        console.warn('[escorts/applications] audit logging notice:', auditError);
      }
    }

    // Resolve applicant email and name if not directly supplied in body
    let targetEmail = escortEmail;
    let targetName = escortName;

    if (!targetEmail || !targetEmail.includes('@')) {
      try {
        const { getEscortApplications } = await import('@/lib/escort/escort-db');
        const allApps = await getEscortApplications();
        const matched = allApps.find((a: any) => a.id === appId);
        if (matched) {
          targetEmail = matched.email || matched.emailOrUsername;
          targetName = matched.name || matched.fullName;
        }
      } catch (findErr) {
        console.warn('[escorts/applications] target email lookup warning:', findErr);
      }
    }

    // Send email alert to Escort upon City Manager action
    if (targetEmail && targetEmail.includes('@')) {
      let emailSubject = 'Update on your MyEduRide Escort Account';
      let emailHtml = '';

      if (status === 'CITY_MANAGER_APPROVED') {
        emailSubject = 'Congratulations! Your MyEduRide Escort account has been approved';
        emailHtml = `
          <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; background:#0b1c30; color:#ffffff; padding: 24px; border-radius: 16px;">
            <h2 style="color:#00A859; margin-top:0;">Account Approved by City Manager!</h2>
            <p>Dear <strong>${targetName || 'Escort'}</strong>,</p>
            <p style="background:#00A859; color:#ffffff; padding: 14px; border-radius: 10px; font-weight: bold;">
              Congratulations! Your MyEduRide Escort account has been approved. You can now proceed with the required registration payment to activate your account.
            </p>
            <p style="font-size:13px; color:#cbd5e1;">Please log into your dashboard to complete the registration fee payment (₦1,200.00) and activate live operational trip features.</p>
            <p style="font-size:12px; color:#94a3b8; margin-top: 24px;">MyEduRide — Student Safety Platform</p>
          </div>
        `;
      } else if (status === 'CORRECTION_REQUESTED') {
        const origin = request.headers.get('origin') || request.headers.get('host')?.includes('localhost') ? 'http://localhost:3000' : 'https://myeduride.com';
        const correctionUrl = `${origin}/auth/register?mode=correction&role=driver&email=${encodeURIComponent(targetEmail || '')}&appId=${encodeURIComponent(appId || '')}`;
        emailSubject = 'Action Required: Profile Document Correction Requested — MyEduRide';
        emailHtml = `
          <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; background:#0b1c30; color:#ffffff; padding: 24px; border-radius: 16px;">
            <h2 style="color:#FFC107; margin-top:0;">Profile & Document Correction Requested</h2>
            <p>Dear <strong>${targetName || 'Escort'}</strong>,</p>
            <p>Your City Manager reviewed your registration application and requested the following update / document re-upload:</p>
            <p style="background:#2b2207; color:#FFC107; padding: 16px; border-radius: 12px; border: 1px solid #7a6109; font-weight: bold; font-size: 14px;">
              "${notes || 'Please review your uploaded NIN slip / document credentials and re-upload clear copies.'}"
            </p>
            <p style="font-size:13px; color:#cbd5e1; margin-top: 16px;">Click the button below to update your requested credentials. All your previously filled registration details remain saved.</p>
            <div style="text-align: center; margin: 24px 0;">
              <a href="${correctionUrl}" style="display: inline-block; background: #00A859; color: #ffffff; text-decoration: none; font-weight: bold; font-size: 14px; padding: 12px 28px; border-radius: 10px; shadow: 0 4px 12px rgba(0,168,89,0.3);">
                Re-upload Requested Documents →
              </a>
            </div>
            <p style="font-size:12px; color:#94a3b8; margin-top: 24px;">MyEduRide — Student Safety Platform</p>
          </div>
        `;
      } else if (status === 'REJECTED') {
        emailSubject = 'Application Status Update — MyEduRide Escort';
        emailHtml = `
          <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; background:#0b1c30; color:#ffffff; padding: 24px; border-radius: 16px;">
            <h2 style="color:#ef4444; margin-top:0;">Application Status Notice</h2>
            <p>Dear <strong>${targetName || 'Escort'}</strong>,</p>
            <p>Your escort application was not approved. Reason: <strong>${notes || 'Documentation requirements not met.'}</strong></p>
          </div>
        `;
      }

      if (emailHtml) {
        try {
          await sendEmail({
            fromName: 'MyEduRide City Manager',
            to: targetEmail.trim().toLowerCase(),
            subject: emailSubject,
            html: emailHtml,
          });
        } catch (emailErr) {
          console.warn('[escorts/applications] email notify warning:', emailErr);
        }
      }
    }

    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update application status';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const appId = searchParams.get('appId');
    const deleteType = (searchParams.get('type') || 'soft') as 'soft' | 'hard';

    if (!appId) {
      return NextResponse.json({ error: 'Application ID (appId) is required' }, { status: 400 });
    }

    const { deleteEscortApplication } = await import('@/lib/escort/escort-db');
    const result = await deleteEscortApplication(appId, deleteType);

    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete application';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
