import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { apiPost } from '@/lib/api';
import { looksLikeEmail } from '@/lib/email';
import { useAuth } from '@/lib/AuthContext';
import { homeFor } from '@/lib/nav';
import { safeNext } from '@/lib/url';
import ErrorNotice from '@/components/ErrorNotice';
import PasswordField from '@/components/PasswordField';
import Breadcrumb from '@/components/Breadcrumb';
import { FIELD, BUTTON_PRIMARY, BUTTON_DISABLED, BUTTON_OUTLINE, BUTTON_TEXT } from '@/lib/ui';

// The server answers an unknown email and a wrong password with the same 401. This page must
// not break that. Nothing below depends on why a sign in failed. The server's message is shown
// as it is and nothing is added beside it. Otherwise the form would tell a stranger which ALU
// addresses have an account.
//
// There is no ALU domain check here. Legal experts are invited at any address so such a rule
// would lock them out.
function blankProblem(email, password) {
  if (!email && !password) return 'Enter your email and password to sign in.';
  if (!email) return 'Enter the email address for your account.';
  if (!password) return 'Enter your password.';
  // A typo in the address would otherwise look like a wrong password.
  if (!looksLikeEmail(email)) return 'That does not look like an email address.';
  return null;
}

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [shown, setShown] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  // The address that a 403 was returned for. A 403 means the account exists and is not
  // verified yet, so the server has already said the account exists. Only then is a new link
  // offered. A 401 never shows this. If it did, its presence would tell a stranger that the
  // account exists.
  const [unverified, setUnverified] = useState(null);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(null);
  const [resendError, setResendError] = useState(null);
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  async function handleSubmit(event) {
    event.preventDefault();
    // The address is trimmed because a space from a paste would find no account and give the
    // same 401 as a wrong password. The password is never trimmed. A space can be part of it.
    const address = email.trim();
    const problem = blankProblem(address, password);
    if (problem) {
      setError({ message: problem });
      return;
    }

    setError(null);
    setUnverified(null);
    setResent(null);
    setResendError(null);
    setSending(true);
    try {
      const session = await apiPost('/auth/login', { email: address, password });
      signIn(session);
      // Back to the page the person came from, if it is a plain path on this site. Otherwise to
      // the start page for their role. The address is never trusted as it is.
      navigate(safeNext(params.get('next')) ?? homeFor(session.user), { replace: true });
    } catch (err) {
      setError(err);
      if (err.status === 403) setUnverified(address);
    } finally {
      // The password does not stay in the page after a try. The email is kept for a retry.
      setPassword('');
      setShown(false);
      setSending(false);
    }
  }

  async function handleResend() {
    setResent(null);
    setResendError(null);
    setResending(true);
    try {
      const reply = await apiPost('/auth/resend-verification', { email: unverified });
      // The server's sentence is shown as it is. It never says whether the address was found.
      setResent(reply?.message || 'Your request has been sent.');
    } catch (err) {
      setResendError(err);
    } finally {
      setResending(false);
    }
  }

  return (
    <div>
      <Breadcrumb trail={[{ label: 'Home', to: '/' }]} current="Sign in" />
      <div className="mt-6 grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:gap-10">
      <div className="min-w-0">
      <h1 className="font-head text-4xl leading-heading text-primary md:text-5xl">Sign in</h1>
      <p className="mt-4 max-w-reading text-muted-foreground">
        For ALU students and staff with an account and for legal experts who have redeemed their
        invite. You do not need an account to read a guide, see the directory or ask a question
        anonymously.
      </p>

      {error && <ErrorNotice error={error} className="mt-4" />}

      {unverified && (
        <div className="mt-4 rounded-card border border-border bg-surface p-6">
          <h2 className="font-head text-xl leading-heading text-primary">Need a new link?</h2>
          <p className="mt-2 text-sm">
            We can send another one to {unverified}. A link lasts 24 hours and works once.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">Look in your spam folder first.</p>
          <button
            type="button"
            onClick={handleResend}
            aria-disabled={resending || undefined}
            className={`mt-4 ${resending ? BUTTON_DISABLED : BUTTON_OUTLINE}`}
          >
            {resending ? 'Sending a new link…' : 'Send me a new link'}
          </button>
          {/* The status region is always on the page so its first message is read out. */}
          <div role="status">{resent && <p className="mt-3 text-sm">{resent}</p>}</div>
          {resendError && <ErrorNotice error={resendError} className="mt-3" />}
        </div>
      )}

      {/* noValidate so the page shows its own message and not the browser's bubble. */}
      <form onSubmit={handleSubmit} noValidate className="mt-4 rounded-card border border-border bg-surface p-6">
        <label htmlFor="email" className="block text-sm font-medium">Email</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          className={FIELD}
        />

        <PasswordField
          id="password"
          label="Password"
          shown={shown}
          onShownChange={setShown}
          className="mt-4"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />

        <button
          type="submit"
          aria-disabled={sending || undefined}
          className={`mt-4 ${sending ? BUTTON_DISABLED : BUTTON_PRIMARY}`}
        >
          {sending ? 'Signing you in…' : 'Sign in'}
        </button>
      </form>

      {/* Always shown. If it appeared only after a failed sign in it would tell a stranger
          something about the account. */}
      <p className="mt-4 text-sm">
        <Link to="/forgot-password" className={BUTTON_TEXT}>Forgot your password?</Link>
      </p>
      <p className="text-sm">
        No account yet?{' '}
        <Link to="/register" className={BUTTON_TEXT}>Create one with your ALU address</Link>
      </p>
      <p className="text-sm text-muted-foreground">
        Invited to join as a legal expert?{' '}
        <Link to="/redeem-invite" className={BUTTON_TEXT}>Redeem your invite</Link>
      </p>
      </div>

      <aside className="self-start rounded-card border border-chrome-raised bg-chrome p-8 text-chrome-foreground" aria-labelledby="record-heading">
        <h2 id="record-heading" className="font-head text-3xl leading-heading">A record you control.</h2>
        <p className="mt-4 text-on-chrome">
          Matters are private by default. You choose whether to share a record with an expert, and
          you can revoke access immediately.
        </p>
        <div className="mt-6 rounded-card bg-surface p-6 text-ink">
          <h3 className="font-head text-2xl leading-heading text-primary">Just browsing?</h3>
          <p className="mt-2 text-sm">
            Where to Go, the Directory, Legal Guides and urgent help remain available without
            signing in.
          </p>
          <div className="mt-2 flex flex-col items-start">
            <Link to="/" className={BUTTON_TEXT}>Return to public information →</Link>
            <Link to="/check-request" className={BUTTON_TEXT}>Check an anonymous request with your code →</Link>
          </div>
        </div>
        <p className="mt-6 text-sm text-on-chrome">Expert accounts are invitation-only. There is no expert self-registration.</p>
      </aside>
      </div>
    </div>
  );
}
