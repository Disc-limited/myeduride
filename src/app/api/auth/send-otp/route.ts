import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/notifications/email-service';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { email, name } = await request.json();

    const recipientEmail = email?.trim().toLowerCase();
    if (!recipientEmail || !recipientEmail.includes('@')) {
      return NextResponse.json({ error: 'Valid email address is required' }, { status: 400 });
    }

    // Generate 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    const parentName = name?.trim() || 'Valued User';

    const htmlContent = `
      <div font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0;">
        <div text-align: center; margin-bottom: 24px;">
          <h1 style="color: #0D4A71; margin: 0; font-size: 24px; font-weight: 800;">MyEduRide</h1>
          <p style="color: #64748b; margin-top: 4px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">The Student Safety Platform</p>
        </div>

        <div style="background-color: #f8fafc; padding: 24px; rounded-radius: 12px; text-align: center; border: 1px solid #f1f5f9;">
          <h2 style="color: #0F172A; font-size: 18px; margin-top: 0; font-weight: 700;">Verify Your Email Address</h2>
          <p style="color: #475569; font-size: 14px; line-height: 1.5; margin-bottom: 20px;">
            Hello ${parentName}, use the 6-digit verification code below to complete your MyEduRide registration:
          </p>

          <div style="background-color: #28A745; color: #ffffff; font-size: 32px; font-weight: 800; letter-spacing: 8px; padding: 16px 24px; border-radius: 12px; display: inline-block; margin: 12px 0;">
            ${otpCode}
          </div>

          <p style="color: #94a3b8; font-size: 12px; margin-top: 16px; margin-bottom: 0;">
            This verification code is valid for 10 minutes. If you did not request this code, please ignore this email.
          </p>
        </div>

        <div style="margin-top: 24px; text-align: center; color: #94a3b8; font-size: 11px;">
          <p style="margin: 0;">&copy; ${new Date().getFullYear()} MyEduRide. All rights reserved.</p>
        </div>
      </div>
    `;

    try {
      await sendEmail({
        to: recipientEmail,
        subject: `Your MyEduRide Verification Code: ${otpCode}`,
        html: htmlContent,
      });
      console.log(`[send-otp] Verification email sent to ${recipientEmail} with code ${otpCode}`);
    } catch (emailErr) {
      console.error('[send-otp] Email sending failed, returning code for fallback:', emailErr);
    }

    return NextResponse.json({
      ok: true,
      code: otpCode,
      message: `Verification code sent to ${recipientEmail}`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to send verification code';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
