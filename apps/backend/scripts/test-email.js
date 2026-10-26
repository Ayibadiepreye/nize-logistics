/**
 * Sends a real message through the configured mail transport.
 *
 *   node scripts/test-email.js <to-address>
 *
 * Reports the SMTP dialogue rather than a boolean, so an auth failure or a
 * relay rejection is distinguishable from a genuine success.
 */
import '../src/config/env.js';
import nodemailer from 'nodemailer';

async function main() {
  const to = process.argv[2];
  if (!to) {
    console.error('usage: node scripts/test-email.js <to-address>');
    process.exit(1);
  }

  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });

  console.log(`host   : ${process.env.SMTP_HOST}:${process.env.SMTP_PORT}`);
  console.log(`from   : ${process.env.EMAIL_FROM}`);
  console.log(`to     : ${to}\n`);

  // Verify the credentials against the server before attempting a send.
  try {
    await transport.verify();
    console.log('VERIFY : connection and authentication accepted\n');
  } catch (err) {
    console.log('VERIFY : FAILED');
    console.log(`  code    : ${err.code || '(none)'}`);
    console.log(`  response: ${err.response || err.message}`);
    process.exit(1);
  }

  try {
    const info = await transport.sendMail({
      from: process.env.EMAIL_FROM,
      to,
      subject: 'Nize Logistics — mail transport test',
      text: 'If you are reading this, the Nize Logistics SMTP transport is working.',
      html: '<p>If you are reading this, the <strong>Nize Logistics</strong> SMTP transport is working.</p>',
    });

    console.log('SEND   : accepted');
    console.log(`  messageId : ${info.messageId}`);
    console.log(`  accepted  : ${JSON.stringify(info.accepted)}`);
    console.log(`  rejected  : ${JSON.stringify(info.rejected)}`);
    console.log(`  response  : ${info.response}`);
  } catch (err) {
    console.log('SEND   : FAILED');
    console.log(`  code    : ${err.code || '(none)'}`);
    console.log(`  response: ${err.response || err.message}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('test-email failed:', e.message);
  process.exit(1);
});
