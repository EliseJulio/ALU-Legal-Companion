import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { apiPost } from '@/lib/api';
import { scrubTokenFromUrl } from '@/lib/url';
import { useAuth } from '@/lib/AuthContext';
import ErrorNotice from '@/components/ErrorNotice';
import AuthLayout from '@/components/AuthLayout';
import Callout from '@/components/Callout';
import PasswordField from '@/components/PasswordField';
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
  const [again, setAgain] = useState('');
  const [shown, setShown] = useState(false);
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
    if (password !== again) {
      setError({ message: 'The two passwords are not the same.' });
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
      navigate('/expert/questions');
    } catch (err) {
      // The server says why an invitation was refused. The message is shown as it is.
      setError(err);
    } finally {
      setPassword('');
      setShown(false);
      setAgain('');
      setSending(false);
    }
  }

  return (
    <AuthLayout eyebrow="Invitation" title="Accept your invitation" intro="Invited experts only. No self-registration.">
      <Callout title="Invited experts only" className="mt-4">
        Your invitation code is in the email you were sent. It is filled in for you when you open the link.
      </Callout>

      {error && <ErrorNotice error={error} className="mt-4" />}

      <form onSubmit={handleSubmit} noValidate className="mt-4 rounded-card border border-border bg-surface p-6">
        <label htmlFor="code" className="block text-sm font-medium">Invitation</label>
        <input
          id="code"
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoComplete="off"
          spellCheck="false"
          className={`${FIELD} font-mono`}
        />

        <label htmlFor="name" className="mt-4 block text-sm font-medium">Name</label>
        <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className={FIELD} />

        <PasswordField
          id="password"
          label="Password"
          hint="At least 8 characters."
          className="mt-4"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          shown={shown}
          toggle={false}
          autoComplete="new-password"
        />

        <PasswordField
          id="again"
          label="Confirm password"
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
          className={`mt-4 inline-flex min-h-button items-center justify-center rounded px-5 font-sans
            font-semibold text-primary-foreground ${RING} ${sending ? 'bg-disabled' : 'bg-primary'}`}
        >
          {sending ? 'Creating your account…' : 'Redeem invitation'}
        </button>
      </form>

      <p className="mt-4 text-sm text-muted-foreground">
        Your invitation can be used once. If it has expired, contact the person who invited you.
      </p>

      <p className="mt-4 text-sm">
        <Link to="/login" className={`inline-flex min-h-touch items-center font-semibold 
          text-info underline underline-offset-2 ${RING} focus-visible:ring-offset-canvas`}>
          Back to sign in →
        </Link>
      </p>
    </AuthLayout>
  );
}
