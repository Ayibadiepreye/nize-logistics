import nodemailer from 'nodemailer';

const service = process.env.EMAIL_SERVICE || 'smtp';

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
