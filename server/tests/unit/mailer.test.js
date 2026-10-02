// The mailer has two modes. With nothing set up it prints the email (dev mode). With SMTP_URL
// set it sends for real. Either way it says which mode it is in.
//
// Each test sets SMTP_URL to an empty string first, so no test depends on what the one
// before it left behind. The original value is put back afterwards.
import { sendMail, isRealTransport } from '../../src/services/mailer.js';

describe('mailer', () => {
  let originalSmtpUrl;

  beforeEach(() => {
    originalSmtpUrl = process.env.SMTP_URL;
    process.env.SMTP_URL = '';
  });

  afterEach(() => {
    if (originalSmtpUrl === undefined) {
      delete process.env.SMTP_URL;
    } else {
      process.env.SMTP_URL = originalSmtpUrl;
    }
  });

  test('is in dev mode when nothing is set up', () => {
    expect(isRealTransport()).toBe(false);
  });

  test('dev mode prints the link instead of sending it', async () => {
    // Capture the log by hand. Under native ES modules, `jest` is not a global here.
    const original = console.log;
    const logged = [];
    console.log = (...args) => logged.push(args.join(' '));
    try {
      const result = await sendMail({ to: 'a@alustudent.com', subject: 'x', text: 'visit https://example.test/verify?token=ABC' });
      expect(result.delivered).toBe(false);
      expect(result.preview).toContain('https://example.test/verify?token=ABC');
      expect(logged.join('\n')).toContain('https://example.test/verify?token=ABC');
    } finally {
      console.log = original;
    }
  });

  test('is in real mode when SMTP_URL is set', () => {
    process.env.SMTP_URL = 'smtp://user:pass@mail.example.test:587';
    expect(isRealTransport()).toBe(true);
  });

  // The risky moment is a failed send. Falling back to dev mode would look helpful, but it
  // would print a live link in the logs. Port 1 is never open, so this makes sending fail.
  test('real mode never prints the link, even when sending fails', async () => {
    process.env.SMTP_URL = 'smtp://127.0.0.1:1';
    const logged = [];
    const realLog = console.log;
    console.log = (...args) => logged.push(args.join(' '));
    try {
      await expect(
        sendMail({ to: 'a@alustudent.com', subject: 'x', text: 'https://app.test/verify?token=LEAKMARKER' }),
      ).rejects.toThrow();
      const output = logged.join(' ');
      expect(output).not.toContain('LEAKMARKER');
      expect(output).not.toContain('DEV MODE');
    } finally {
      console.log = realLog;
    }
  });

  test('refuses to send without a recipient, subject and text', async () => {
    await expect(sendMail({ to: 'a@alustudent.com' })).rejects.toThrow(/requires/);
  });
});
