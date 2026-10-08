// Sending email. It is used for verification links and password reset links.
//
// The platform must work with no mail account at all. It must say which mode it is in.
//   no SMTP_URL   Dev mode. The message is printed in the server log and nothing is sent.
//                 This lets a developer finish the flow from the terminal.
//   SMTP_URL set  Real mode. The message is sent over SMTP and nothing is printed.
//
// A verification link is a bearer credential. Whoever holds it can verify that account.
// Printing it is fine on a developer's laptop and wrong anywhere else. So the printing code
// only runs in dev mode. It checks that again by itself and refuses to run if a real
// transport is configured. If the choice at the bottom of this file is ever changed by mistake
// it fails loudly in development. It does not write live links into a production log.
import nodemailer from 'nodemailer';

// This address can never be registered, so if it appears in a real mailbox MAIL_FROM was not set.
const DEFAULT_FROM = 'ALU Legal Companion <no-reply@alu-legal.invalid>';

const mailFrom = () => process.env.MAIL_FROM || DEFAULT_FROM;

// Read at call time and not at import time, so a late config or a test sees the truth.
export function isRealTransport() {
  return Boolean(process.env.SMTP_URL);
}

// --- Dev mode. Everything that can print a message is in this function. ---

function sendViaTerminal({ to, subject, text }) {
  if (isRealTransport()) {
    throw new Error('Dev mail mode refused to run: SMTP_URL is set and printing the message would leak a live link into the logs.');
  }
  const preview = [
    '──────── mail: DEV MODE — NOT SENT (no SMTP_URL) ────────',
    `From:    ${mailFrom()}`,
    `To:      ${to}`,
    `Subject: ${subject}`,
    '',
    text,
    '─────────────────────────────────────────────────────────',
  ].join('\n');
  console.log(preview);
  return { delivered: false, preview };
}

// --- Real mode. Nothing below can print a message. ---

// One connection pool for the process. It is rebuilt only if SMTP_URL changes.
let transporter = null;
let transporterUrl = null;

function smtpTransporter() {
  const url = process.env.SMTP_URL;
  if (!transporter || transporterUrl !== url) {
    transporter = nodemailer.createTransport(url);
    transporterUrl = url;
  }
  return transporter;
}

// There is no fallback to dev mode when this fails. A fallback would print a live link.
// A configured transport that cannot send must fail and let the caller decide what to do.
async function sendViaSmtp({ to, subject, text }) {
  await smtpTransporter().sendMail({ from: mailFrom(), to, subject, text });
  return Object.freeze({ delivered: true });
}

export async function sendMail({ to, subject, text } = {}) {
  if (!to || !subject || !text) {
    throw new Error('sendMail requires to, subject and text');
  }
  return isRealTransport()
    ? sendViaSmtp({ to, subject, text })
    : sendViaTerminal({ to, subject, text });
}
