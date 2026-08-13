import { NextRequest, NextResponse } from 'next/server';
import { registerEscortApplication } from '@/lib/escort/escort-db';
import { sendEmail } from '@/lib/notifications/email-service';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.fullName?.trim() || !body.emailOrUsername?.trim()) {
      return NextResponse.json(
        { error: 'Full name and email/username are required' },
        { status: 400 }
      );
    }

    // Email format validation if email is provided
    if (body.emailOrUsername.includes('@')) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(body.emailOrUsername.trim())) {
        return NextResponse.json(
          { error: 'Invalid email address format' },
          { status: 400 }
        );
      }
    }

    // Vehicle Registration No format validation if provided
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

    const result = await registerEscortApplication(body);

    // Send confirmation email to applicant if email provided
    if (body.emailOrUsername && body.emailOrUsername.includes('@')) {
      try {
        await sendEmail({
          fromName: 'MyEduRide Verification',
          to: body.emailOrUsername.trim().toLowerCase(),
          subject: 'Escort Registration Received — Application Under Review',
          html: `
            <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; background:#0b1c30; color:#ffffff; padding: 24px; rounded: 16px;">
              <h2 style="color:#00A859; margin-top:0;">Registration Application Received!</h2>
              <p>Dear <strong>${body.fullName}</strong>,</p>
              <p>Thank you for registering as a <strong>Shared Escort</strong> on MyEduRide — The Student Safety Platform.</p>
              <div style="background:#132842; padding: 16px; border-radius: 12px; margin: 16px 0;">
                <p style="margin:4px 0;"><strong>Application ID:</strong> ${result.appId}</p>
                <p style="margin:4px 0;"><strong>Escort ID Code:</strong> ${result.escortIdCode}</p>
                <p style="margin:4px 0;"><strong>Allocated Operating City:</strong> ${body.city || 'Lagos'}</p>
                <p style="margin:4px 0; color:#FFC107;"><strong>Status:</strong> Under Review by City Manager</p>
              </div>
              <p style="font-size:13px; color:#cbd5e1;">Your submitted profile, NIN details, driver licence, address pin, and vehicle information have been routed to your City Manager for review.</p>
              <p style="font-size:12px; color:#94a3b8; margin-top: 24px;">MyEduRide — DAISAF Industrial Services Company Limited</p>
            </div>
          `,
        });
      } catch (emailErr) {
        console.warn('[escorts/register] email send notice:', emailErr);
      }
    }

    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Registration failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
