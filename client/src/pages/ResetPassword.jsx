import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { apiPost } from '@/lib/api';
import { scrubTokenFromUrl } from '@/lib/url';
import { useAuth } from '@/lib/AuthContext';
import ErrorNotice from '@/components/ErrorNotice';
import { RING, FIELD } from '@/lib/ui';

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
      navigate('/');
    } catch (err) {
      // The server says why a link was refused. The message is shown as it is.
      setError(err);
    } finally {
      setPassword('');
      setAgain('');
      setSending(false);
    }
  }

  if (!token) {
    return (
      <div>
        <h1 className="font-head text-2xl text-primary">This link is incomplete</h1>
        <p className="mt-2">Open the link from the email again or ask for a new one.</p>
        <Link to="/forgot-password" className={`mt-4 inline-flex min-h-touch items-center rounded 
          bg-primary px-4 font-head font-semibold text-primary-foreground ${RING}`}>
          Ask for a new link
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-head text-2xl text-primary">Set a new password</h1>

      {error && <ErrorNotice error={error} className="mt-4" />}

      <form onSubmit={handleSubmit} noValidate className="mt-4 rounded border 
      border-border bg-surface p-4">
        <label htmlFor="password" className="block text-sm font-medium">New password</label>
        <p id="password-hint" className="mt-1 text-sm text-muted-foreground">At least 8 characters.</p>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-describedby="password-hint"
          autoComplete="new-password"
          className={FIELD}
        />

        <label htmlFor="again" className="mt-4 block text-sm font-medium">Type it again</label>
        <input
          id="again"
          type="password"
          value={again}
          onChange={(e) => setAgain(e.target.value)}
          autoComplete="new-password"
          className={FIELD}
        />

        <button
          type="submit"
          disabled={sending}
          className={`mt-4 inline-flex min-h-touch items-center rounded px-4 
            font-head font-semibold text-primary-foreground 
            ${RING} ${sending ? 'bg-disabled' : 'bg-primary'}`}
        >
          {sending ? 'Saving…' : 'Save new password'}
        </button>
      </form>

      <p className="mt-4 text-sm">
        <Link to="/forgot-password" className={`inline-flex min-h-touch items-center 
          font-semibold text-primary underline ${RING} focus-visible:ring-offset-canvas`}>
          Need a new link?
        </Link>
      </p>
    </div>
  );
}
