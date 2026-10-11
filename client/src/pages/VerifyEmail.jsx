import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiPost } from '@/lib/api';
import { scrubTokenFromUrl } from '@/lib/url';
import { useAuth } from '@/lib/AuthContext';
import ErrorNotice from '@/components/ErrorNotice';
import { RING } from '@/lib/ui';

const BUTTON_LINK = `mt-4 inline-flex min-h-touch items-center rounded bg-primary px-4 font-head font-semibold text-primary-foreground ${RING}`;

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
      <div>
        <h1 className="font-head text-2xl text-primary">This link is incomplete</h1>
        <p className="mt-2">Open the link from the email again. If it does not work, 
          ask for a new one on the sign-in page.</p>
        <Link to="/login" className={BUTTON_LINK}>Go to sign in</Link>
      </div>
    );
  }

  if (verified) {
    return (
      <div>
        <h1 className="font-head text-2xl text-primary">Your address is verified</h1>
        <p className="mt-2" role="status">Welcome, {verified.name}. You are signed in.</p>
        <Link to="/" className={BUTTON_LINK}>Go to the home page</Link>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h1 className="font-head text-2xl text-primary">We could not verify your address</h1>
        <ErrorNotice error={error} className="mt-4" />
        <Link to="/login" className={BUTTON_LINK}>Go to sign in</Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-head text-2xl text-primary">Verifying your address</h1>
      <p className="mt-2 text-muted-foreground">One moment…</p>
    </div>
  );
}
