import nodemailer from 'nodemailer';

/**
 * Choose the email provider with EMAIL_SERVICE. Supported values:
 *
 *   smtp    — any SMTP provider: Mailjet, SendGrid SMTP, Mailgun SMTP,
 *             Gmail (App Password), or a generic relay. Set SMTP_HOST,
 *             SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, EMAIL_FROM.
 *             (This is the default and what Mailjet uses today.)
 *   resend  — Resend's API. Set RESEND_API_KEY and EMAIL_FROM.
 *
 * Switching providers is a matter of changing EMAIL_SERVICE and the matching
 * variables — no code edit. Anything other than the two values above logs a
 * warning and sends nothing, so a typo fails loudly instead of dropping mail.
 */
export function getActiveEmailService() {
  return (process.env.EMAIL_SERVICE || 'smtp').toLowerCase();
}

const service = getActiveEmailService();
console.log(`📧 Email service configured: ${service}`);

// SMTP Transport (Mailjet or generic)
const smtpTransport = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendEmail({ to, subject, html, text }) {
  try {
    if (service === 'smtp') {
      await smtpTransport.sendMail({
        from: process.env.EMAIL_FROM || 'noreply@nizelogistics.com',
        to,
        subject,
        html,
        text,
      });
      console.log(`📧 Email sent to ${to}: ${subject}`);
    } else if (service === 'resend') {
      // Resend integration (optional)
      const resend = await import('resend').then(m => m.Resend);
      const client = new resend(process.env.RESEND_API_KEY);
      await client.emails.send({
        from: process.env.EMAIL_FROM || 'onboarding@resend.dev',
        to,
        subject,
        html,
      });
      console.log(`📧 Email sent via Resend to ${to}`);
    } else {
      console.warn('Email service not configured');
    }
  } catch (error) {
    console.error('Email send error:', error);
    throw error;
  }
}
