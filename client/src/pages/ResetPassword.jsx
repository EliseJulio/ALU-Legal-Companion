import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { apiPost } from '@/lib/api';
import { scrubTokenFromUrl } from '@/lib/url';
import { useAuth } from '@/lib/AuthContext';
import { homeFor } from '@/lib/nav';
import ErrorNotice from '@/components/ErrorNotice';
import AuthLayout from '@/components/AuthLayout';
import PasswordField from '@/components/PasswordField';
import { RING } from '@/lib/ui';

// Set a new password with the link from the email. The link works once. The page checks the
// two passwords before it sends anything so the link is not used up on a typo. When it works the
// server signs the reader in. A reset also ends every other session of the account.
export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [shown, setShown] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    if (password.length < 8) {
      setError({ message: 'Choose a password of at least 8 characters.' });
      return;
    }
    if (password !== again) {
      setError({ message: 'The two passwords are not the same.' });
      return;
    }
    setError(null);
    setSending(true);
    try {
      const session = await apiPost('/auth/reset-password', { token, password });
      // The link is spent. A failed try keeps it in the address because it is not spent then.
      scrubTokenFromUrl();
      signIn(session);
      navigate(homeFor(session.user), { replace: true });
    } catch (err) {
      // The server says why a link was refused. The message is shown as it is.
      setError(err);
    } finally {
      setPassword('');
      setShown(false);
      setAgain('');
      setSending(false);
    }
  }

  if (!token) {
    return (
      <AuthLayout eyebrow="Reset" title="This link is incomplete">
        <p className="mt-3">Open the link from the email again or ask for a new one.</p>
        <Link to="/forgot-password" className={`mt-4 inline-flex min-h-button items-center justify-center rounded
          bg-primary px-5 font-sans font-semibold text-primary-foreground ${RING}`}>
          Ask for a new link
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout eyebrow="Reset" title="Choose a new password" intro="After resetting your password, other sessions will be signed out.">
      {error && <ErrorNotice error={error} className="mt-4" />}

      <form onSubmit={handleSubmit} noValidate className="mt-4 rounded-card border border-border bg-surface p-6">
        <PasswordField
          id="password"
          label="New password"
          hint="At least 8 characters."
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          shown={shown}
          toggle={false}
          autoComplete="new-password"
        />

        <PasswordField
          id="again"
          label="Confirm new password"
          className="mt-4"
          value={again}
          onChange={(e) => setAgain(e.target.value)}
          shown={shown}
          onShownChange={setShown}
          toggleLabel="Show passwords"
        controls="password again"
          autoComplete="new-password"
        />

        <button
          type="submit"
          aria-disabled={sending || undefined}
          className={`mt-4 inline-flex min-h-button items-center justify-center rounded px-5
            font-sans font-semibold text-primary-foreground
            ${RING} ${sending ? 'bg-disabled' : 'bg-primary'}`}
        >
          {sending ? 'Saving…' : 'Reset password'}
        </button>
      </form>

      <p className="mt-4 text-sm">
        <Link to="/forgot-password" className={`inline-flex min-h-touch items-center
          font-semibold text-info underline underline-offset-2 ${RING} focus-visible:ring-offset-canvas`}>
          Request reset instructions →
        </Link>
      </p>
    </AuthLayout>
  );
}
