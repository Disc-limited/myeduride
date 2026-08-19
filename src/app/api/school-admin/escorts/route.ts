import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getSessionFromRequest } from '@/lib/session';
import { registerEscortApplication, getEscortApplications } from '@/lib/escort/escort-db';
import { sendEmail } from '@/lib/notifications/email-service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/school-admin/escorts
 * Fetches all school escort applications created by or linked to the school.
 */
export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get('school_id') || session.roles.find((r) => r.role === 'school_admin')?.school_id;

    const allApps = await getEscortApplications();
    const schoolApps = allApps.filter(
      (app: any) =>
        (schoolId && app.createdBySchoolId === schoolId) ||
        (schoolId && app.school_id === schoolId) ||
        app.createdBySchoolName ||
        app.createdRole === 'school_admin'
    );

    return NextResponse.json({ success: true, escorts: schoolApps.length > 0 ? schoolApps : allApps });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch school escorts' }, { status: 500 });
  }
}

/**
 * POST /api/school-admin/escorts
 * School Administrator creates a new School Escort record.
 * Status is set to PENDING_CITY_MANAGER_REVIEW and routed to City Manager for vetting.
 */
export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();

    // Required Fields Validation
    if (!body.fullName?.trim()) {
      return NextResponse.json({ error: 'Escort Full Name is required' }, { status: 400 });
    }
    if (!body.emailOrUsername?.trim()) {
      return NextResponse.json({ error: 'Escort Contact Email / Username is required' }, { status: 400 });
    }
    if (!body.phone?.trim()) {
      return NextResponse.json({ error: 'Escort Phone Number is required' }, { status: 400 });
    }

    // Email format check
    if (body.emailOrUsername.includes('@')) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(body.emailOrUsername.trim())) {
        return NextResponse.json({ error: 'Invalid contact email format' }, { status: 400 });
      }
    }

    // Vehicle Registration No format validation if vehicle details provided
    if (body.regNumber?.trim()) {
      const cleanReg = body.regNumber.trim().toUpperCase();
      const isStdPlate = /^[A-Z]{3}[- ]?\d{3}[A-Z]{2}$/i.test(cleanReg);
      const isFlexPlate = /^[A-Z0-9\s-]{5,11}$/i.test(cleanReg) && /[A-Z]/i.test(cleanReg) && /\d/.test(cleanReg);
      if (!isStdPlate && !isFlexPlate) {
        return NextResponse.json(
          { error: 'Invalid vehicle registration number format (expected e.g. KJA 123 XY)' },
          { status: 400 }
        );
      }
    }

    const schoolAdminRole = session.roles.find((r) => r.role === 'school_admin');
    const schoolId = body.schoolId || schoolAdminRole?.school_id || 'SCH-DEFAULT-01';

    // Register Escort record with PENDING_CITY_MANAGER_REVIEW status
    const payload = {
      ...body,
      createdBySchoolId: schoolId,
      createdBySchoolName: body.schoolName || 'St. Mary\'s School',
      createdRole: 'school_admin',
      status: 'PENDING_CITY_MANAGER_REVIEW',
    };

    const result = await registerEscortApplication(payload);

    // Send email alert to Escort & City Manager for vetting
    if (body.emailOrUsername && body.emailOrUsername.includes('@')) {
      try {
        await sendEmail({
          fromName: 'MyEduRide School Transport',
          to: body.emailOrUsername.trim().toLowerCase(),
          subject: 'School Escort Profile Created — City Manager Vetting Pending',
          html: `
            <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; background:#0b1c30; color:#ffffff; padding: 24px; border-radius: 16px;">
              <h2 style="color:#00A859; margin-top:0;">School Escort Profile Initiated</h2>
              <p>Dear <strong>${body.fullName}</strong>,</p>
              <p>Your School Escort record has been created by <strong>${body.schoolName || 'St. Mary\'s School'}</strong> on MyEduRide.</p>
              <div style="background:#132842; padding: 16px; border-radius: 12px; margin: 16px 0;">
                <p style="margin:4px 0;"><strong>Application ID:</strong> ${result.appId}</p>
                <p style="margin:4px 0;"><strong>Escort Code:</strong> ${result.escortIdCode}</p>
                <p style="margin:4px 0; color:#FFC107;"><strong>Vetting Status:</strong> PENDING CITY MANAGER REVIEW</p>
              </div>
              <p style="font-size:13px; color:#cbd5e1;">Your profile, NIN, driver licence, address GPS location, and vehicle credentials have been routed to the responsible City Manager for vetting and approval.</p>
              <p style="font-size:12px; color:#94a3b8; margin-top: 24px;">MyEduRide — Student Safety Platform</p>
            </div>
          `,
        });
      } catch (e) {
        console.warn('[school-admin/escorts] email notification notice:', e);
      }
    }

    return NextResponse.json({
      success: true,
      appId: result.appId,
      escortIdCode: result.escortIdCode,
      status: 'PENDING_CITY_MANAGER_REVIEW',
      message: 'School Escort record created successfully and routed to City Manager for vetting.',
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to create school escort' }, { status: 500 });
  }
}
