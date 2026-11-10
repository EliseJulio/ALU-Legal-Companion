import { useState } from 'react';
import { Link } from 'react-router-dom';
import { apiPost } from '@/lib/api';
import { FORM_ERROR_ID, fieldProblem, focusField, useFieldMarks } from '@/lib/fieldError';
import { looksLikeEmail } from '@/lib/email';
import ErrorNotice from '@/components/ErrorNotice';
import AuthLayout from '@/components/AuthLayout';
import Callout from '@/components/Callout';
import { FORM_FIELD, BUTTON_LG_PRIMARY, BUTTON_DISABLED, BUTTON_TEXT, CARD } from '@/lib/ui';

// Ask for a link to set a new password. The server gives the same answer for every address.
// That is true with or without an account. This page shows that answer as it is and adds nothing.
// Anything extra such as "we found your account" would let a stranger find out which addresses exist.
export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const { marks, edited } = useFieldMarks(error);
  const [message, setMessage] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    const address = email.trim();
    if (!address) {
      setError(fieldProblem('email', 'Enter the email address for your account.'));
      focusField('email');
      return;
    }
    if (!looksLikeEmail(address)) {
      setError(fieldProblem('email', 'That does not look like an email address.'));
      focusField('email');
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
      {error && <ErrorNotice error={error} id={FORM_ERROR_ID} className="mb-4" />}
      <div role="status">
        {message && <Callout title="Check your email" className="mb-4">{message}</Callout>}
      </div>

      <div className={CARD}>
        <form onSubmit={handleSubmit} noValidate>
          <label htmlFor="email" className="block text-sm font-semibold">Email address</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); edited('email'); }}
            autoComplete="email"
            className={FORM_FIELD}
            {...marks('email')}
          />
          <button
            type="submit"
            aria-disabled={sending || undefined}
            className={`mt-6 w-full ${sending ? BUTTON_DISABLED : BUTTON_LG_PRIMARY}`}
          >
            {sending ? 'Sending…' : 'Send reset instructions'}
          </button>
        </form>
      </div>

      <p className="mt-4 text-sm">
        <Link to="/login" className={BUTTON_TEXT}>Back to sign in →</Link>
      </p>
    </AuthLayout>
  );
}
