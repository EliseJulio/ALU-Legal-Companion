// Sends email. Used for the account verification link.
//
// With no SMTP_URL set, the app runs in dev mode. It prints the email in the server log and
// sends nothing. This lets you finish sign-up from the terminal without a mail account.
// With SMTP_URL set, it sends the email for real and never prints the link.
//
// A verification link works like a password: whoever has it can verify that account. So the
// link may only be printed on a developer's computer. Two checks keep it out of real logs:
//   1. Only sendViaTerminal() can print the message. The SMTP path returns a fixed result
//      that has no preview in it.
//   2. sendViaTerminal() checks the settings itself and throws an error if SMTP_URL is set.
//
// Note: email to an @alustudent.com address from a laptop will usually be rejected or sent to
// spam. A real mail provider with a verified sending domain is needed for that.
import nodemailer from 'nodemailer';

// A fake address that can never receive mail. If you see it in a real inbox,
// MAIL_FROM was never set.
const DEFAULT_FROM = 'ALU Legal Companion <no-reply@alu-legal.invalid>';

const mailFrom = () => process.env.MAIL_FROM || DEFAULT_FROM;

// Checked each time it is called so a change in settings (or a test) is seen straight away.
export function isRealTransport() {
  return Boolean(process.env.SMTP_URL);
}

// --- Dev mode: prints the email instead of sending it ---

function sendViaTerminal({ to, subject, text }) {
  // Check 2 from the top of the file. It still protects us if someone changes the code
  // at the bottom of this file by mistake.
  if (isRealTransport()) {
    throw new Error('Dev mail mode refused to run: SMTP_URL is set, and printing the email would put a live link in the logs.');
  }
  const preview = [
    '──────── mail: DEV MODE, NOT SENT (no SMTP_URL) ────────',
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

// --- Real mode: sends the email over SMTP. Nothing below can print the message. ---

// One connection is reused. It is only rebuilt if SMTP_URL changes.
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

async function sendViaSmtp({ to, subject, text, html }) {
  await smtpTransporter().sendMail({ from: mailFrom(), to, subject, text, html });
  // There is no fallback to dev mode here on purpose. If sending fails, falling back would
  // print a live link in the logs. The error goes to the caller instead.
  return Object.freeze({ delivered: true });
}

// --- The function the routes call ---

export async function sendMail({ to, subject, text, html } = {}) {
  if (!to || !subject || !text) {
    throw new Error('sendMail requires to, subject and text');
  }
  return isRealTransport()
    ? sendViaSmtp({ to, subject, text, html })
    : sendViaTerminal({ to, subject, text });
}
