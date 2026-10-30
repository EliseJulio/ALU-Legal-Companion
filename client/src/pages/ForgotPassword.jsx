import { useState } from 'react';
import { Link } from 'react-router-dom';
import { apiPost } from '@/lib/api';
import { looksLikeEmail } from '@/lib/email';
import ErrorNotice from '@/components/ErrorNotice';
import AuthLayout from '@/components/AuthLayout';
import Callout from '@/components/Callout';
import { RING, RING_ON_CANVAS, FIELD } from '@/lib/ui';

// Ask for a link to set a new password. The server gives the same answer for every address,
// with or without an account. This page shows that answer as it is and adds nothing. Anything
// extra, such as "we found your account", would let a stranger find out which addresses exist.
export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    const address = email.trim();
    if (!address) {
      setError({ message: 'Enter the email address for your account.' });
      return;
    }
    if (!looksLikeEmail(address)) {
      setError({ message: 'That does not look like an email address.' });
      return;
    }
    setError(null);
    setMessage(null);
    setSending(true);
    try {
      const reply = await apiPost('/auth/forgot-password', { email: address });
      setMessage(reply?.message || 'Your request has been sent.');
    } catch (err) {
      setError(err);
    } finally {
      setSending(false);
    }
  }

  return (
    <AuthLayout eyebrow="Recovery" title="Forgot your password?" intro="If an account exists, reset instructions will be sent.">
      {error && <ErrorNotice error={error} className="mt-4" />}
      <div role="status">
        {message && <Callout title="Check your email" className="mt-4">{message}</Callout>}
      </div>

      <form onSubmit={handleSubmit} noValidate className="mt-4 rounded-card border border-border bg-surface p-6">
        <label htmlFor="email" className="block text-sm font-medium">Email address</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          className={FIELD}
        />
        <button
          type="submit"
          aria-disabled={sending || undefined}
          className={`mt-4 inline-flex min-h-button items-center justify-center rounded px-5 font-sans
            font-semibold text-primary-foreground ${RING} ${sending ? 'bg-disabled' : 'bg-primary'}`}
        >
          {sending ? 'Sending…' : 'Send reset instructions'}
        </button>
      </form>

      <p className="mt-4 text-sm">
        <Link to="/login" className={`inline-flex min-h-touch items-center
          font-semibold text-info underline underline-offset-2 ${RING_ON_CANVAS}`}>
          Back to sign in →
        </Link>
      </p>
    </AuthLayout>
  );
}
