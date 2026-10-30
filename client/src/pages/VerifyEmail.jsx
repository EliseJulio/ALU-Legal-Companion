import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiPost } from '@/lib/api';
import { scrubTokenFromUrl } from '@/lib/url';
import { useAuth } from '@/lib/AuthContext';
import ErrorNotice from '@/components/ErrorNotice';
import AuthLayout from '@/components/AuthLayout';
import { RING } from '@/lib/ui';

const BUTTON_LINK = `mt-4 inline-flex min-h-button items-center justify-center rounded bg-primary px-5 font-sans font-semibold text-primary-foreground ${RING}`;

// The link in the email opens this page. The check runs when the page opens because the reader
// has already clicked the link. A second button would be a second click for the same thing.
export default function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const { signIn } = useAuth();
  const [verified, setVerified] = useState(null);
  const [error, setError] = useState(null);
  // The link works once. In development React runs this effect twice and the second call
  // would report that the link was already used. The ref stops the second call.
  const spent = useRef(false);

  useEffect(() => {
    if (!token || spent.current) return;
    spent.current = true;

    apiPost('/auth/verify-email', { token })
      .then((session) => {
        // From here the token is spent. It is removed from the address bar.
        scrubTokenFromUrl();
        // Verifying is the way in. The server returns a session so the reader is signed in.
        signIn(session);
        setVerified(session.user);
      })
      // The server says why a link was refused: used, expired or not valid. Each has a
      // different next step. The message is shown as it is.
      .catch((err) => setError(err));
  }, [token, signIn]);

  if (!token) {
    return (
      <AuthLayout eyebrow="Verification" title="This link is incomplete">
        <p className="mt-3">Open the link from the email again. If it does not work,
          ask for a new one on the sign-in page.</p>
        <Link to="/login" className={BUTTON_LINK}>Go to sign in</Link>
      </AuthLayout>
    );
  }

  if (verified) {
    return (
      <AuthLayout eyebrow="Verification" title="Email confirmed">
        <p className="mt-3" role="status">
          Welcome, {verified.name}. You are signed in to your private workspace. This
          confirmation link cannot be used again.
        </p>
        <Link to="/" className={BUTTON_LINK}>Go to the home page</Link>
      </AuthLayout>
    );
  }

  if (error) {
    return (
      <AuthLayout eyebrow="Verification" title="We could not verify your address">
        <ErrorNotice error={error} className="mt-4" />
        <Link to="/login" className={BUTTON_LINK}>Go to sign in</Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout eyebrow="Verification" title="Verifying your address">
      <p className="mt-3 text-muted-foreground">One moment…</p>
    </AuthLayout>
  );
}
