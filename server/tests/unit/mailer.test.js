import { jest } from '@jest/globals';
import { sendMail, isRealTransport } from '../../src/services/mailer.js';

describe('mailer in dev mode', () => {
  let log;
  beforeEach(() => { log = jest.spyOn(console, 'log').mockImplementation(() => {}); });
  afterEach(() => { log.mockRestore(); });

  it('is in dev mode when SMTP_URL is empty', () => {
    expect(isRealTransport()).toBe(false);
  });

  it('prints the message and says it was not delivered', async () => {
    const result = await sendMail({ to: 'a@example.org', subject: 'Hello', text: 'Body text' });
    expect(result.delivered).toBe(false);
    expect(result.preview).toContain('To:      a@example.org');
    expect(result.preview).toContain('Body text');
    expect(log).toHaveBeenCalledTimes(1);
  });

  it('refuses a message with a missing part', async () => {
    await expect(sendMail({ subject: 'Hello', text: 'Body' })).rejects.toThrow(/requires to, subject and text/);
    await expect(sendMail({ to: 'a@example.org', text: 'Body' })).rejects.toThrow();
    await expect(sendMail({ to: 'a@example.org', subject: 'Hello' })).rejects.toThrow();
    await expect(sendMail()).rejects.toThrow();
  });
});

describe('mailer mode', () => {
  it('switches to real mode when SMTP_URL is set', () => {
    const original = process.env.SMTP_URL;
    try {
      process.env.SMTP_URL = 'smtp://user:pass@mail.example.org:587';
      expect(isRealTransport()).toBe(true);
    } finally {
      process.env.SMTP_URL = original;
    }
  });
});

describe('mailer in production with no SMTP configured', () => {
  it('refuses to send rather than print a live link to the log', async () => {
    const prevEnv = process.env.NODE_ENV;
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    process.env.NODE_ENV = 'production';
    try {
      await expect(sendMail({
        to: 'student@alustudent.com',
        subject: 'Reset your password',
        text: 'https://app.example/reset-password?token=SECRET_TOKEN_VALUE',
      })).rejects.toThrow(/SMTP_URL is not set in production/);
      const leaked = log.mock.calls.some(([line]) => String(line).includes('SECRET_TOKEN_VALUE'));
      expect(leaked).toBe(false);
    } finally {
      process.env.NODE_ENV = prevEnv;
      log.mockRestore();
    }
  });
});
