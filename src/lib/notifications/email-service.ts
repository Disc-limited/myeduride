import nodemailer from 'nodemailer';
import { Resend } from 'resend';

const senderEmail = process.env.SENDER_EMAIL || 'noreply@assetid.site';

// Determine transport mechanism based on environment configuration
const useSMTP = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD);

let transporter: nodemailer.Transporter | null = null;
if (useSMTP) {
  try {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '465', 10),
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });
    console.log('[Email Service] Configured SMTP transporter with host:', process.env.SMTP_HOST);
  } catch (error) {
    console.error('[Email Service] Error initializing SMTP transporter:', error);
  }
}

let resendClient: Resend | null = null;
if (!useSMTP && process.env.RESEND_API_KEY) {
  try {
    resendClient = new Resend(process.env.RESEND_API_KEY);
    console.log('[Email Service] Configured Resend SDK client.');
  } catch (error) {
    console.error('[Email Service] Error initializing Resend SDK:', error);
  }
}

interface SendEmailOptions {
  to: string | string[];
  fromName?: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, fromName, subject, html }: SendEmailOptions) {
  const fromNameFormatted = fromName ? `${fromName} <${senderEmail}>` : `MyEduRide <${senderEmail}>`;
  const recipientList = Array.isArray(to) ? to : [to];

  if (useSMTP && transporter) {
    console.log(`[Email Service] Sending email via SMTP to:`, recipientList);
    try {
      const info = await transporter.sendMail({
        from: fromNameFormatted,
        to: recipientList.join(', '),
        subject,
        html,
      });
      return { success: true, data: info };
    } catch (error) {
      console.error(`[Email Service] SMTP error:`, error);
      throw error;
    }
  } else if (resendClient) {
    console.log(`[Email Service] Sending email via Resend API to:`, recipientList);
    try {
      const response = await resendClient.emails.send({
        from: fromNameFormatted,
        to: recipientList,
        subject,
        html,
      });
      if (response.error) {
        throw new Error(response.error.message);
      }
      return { success: true, data: response.data };
    } catch (error) {
      console.error(`[Email Service] Resend API error:`, error);
      throw error;
    }
  } else {
    console.warn(`[Email Service] No email service configured (SMTP or Resend API key missing).`);
    console.log(`Subject: ${subject}`);
    console.log(`To: ${recipientList.join(', ')}`);
    return { success: false, error: 'No email service configured' };
  }
}
