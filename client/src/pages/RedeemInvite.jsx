import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { apiPost } from '@/lib/api';
import { scrubTokenFromUrl } from '@/lib/url';
import { useAuth } from '@/lib/AuthContext';
import ErrorNotice from '@/components/ErrorNotice';
import { RING, FIELD } from '@/lib/ui';

// The only way to become a legal expert. An admin sends an invitation by email. Using it proves
// the person owns the address. The link brings the code in the address. If the code is not
// there the reader can paste it. The invitation works once, so nothing is sent until the form
// is complete.
export default function RedeemInvite() {
  const [params] = useSearchParams();
  const [code, setCode] = useState(params.get('token') ?? '');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(event) {
    event.preventDefault();
    if (!code.trim()) {
      setError({ message: 'Paste the invitation code from your email.' });
      return;
    }
    if (!name.trim()) {
      setError({ message: 'Enter your name.' });
      return;
    }
    if (password.length < 8) {
      setError({ message: 'Choose a password of at least 8 characters.' });
      return;
    }
    setError(null);
    setSending(true);
    try {
      const session = await apiPost('/auth/redeem-invite', {
        invite_token: code.trim(),
        name: name.trim(),
        password,
      });
      scrubTokenFromUrl();
      signIn(session);
      navigate('/expert');
    } catch (err) {
      // The server says why an invitation was refused. The message is shown as it is.
      setError(err);
    } finally {
      setPassword('');
      setSending(false);
    }
  }

  return (
    <div>
      <h1 className="font-head text-2xl text-primary">Redeem your invitation</h1>
      <p className="mt-1 text-muted-foreground">
        Legal experts join by invitation only. The invitation works once and creates your account.
      </p>

      {error && <ErrorNotice error={error} className="mt-4" />}

      <form onSubmit={handleSubmit} noValidate className="mt-4 rounded border border-border bg-surface p-4">
        <label htmlFor="code" className="block text-sm font-medium">Invitation code</label>
        <input
          id="code"
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoComplete="off"
          spellCheck="false"
          className={`${FIELD} font-mono`}
        />

        <label htmlFor="name" className="mt-4 block text-sm font-medium">Your name</label>
        <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className={FIELD} />

        <label htmlFor="password" className="mt-4 block text-sm font-medium">Password</label>
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

        <button
          type="submit"
          disabled={sending}
          className={`mt-4 inline-flex min-h-touch items-center rounded px-4 font-head 
            font-semibold text-primary-foreground ${RING} ${sending ? 'bg-disabled' : 'bg-primary'}`}
        >
          {sending ? 'Creating your account…' : 'Create my account'}
        </button>
      </form>

      <p className="mt-4 text-sm">
        <Link to="/login" className={`inline-flex min-h-touch items-center font-semibold 
          text-primary underline ${RING} focus-visible:ring-offset-canvas`}>
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
