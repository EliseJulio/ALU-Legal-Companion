import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiPost } from '@/lib/api';
import { scrubTokenFromUrl } from '@/lib/url';
import ErrorNotice from '@/components/ErrorNotice';
import AuthLayout from '@/components/AuthLayout';
import { BUTTON_LG_PRIMARY } from '@/lib/ui';

const BUTTON_LINK = `mt-6 ${BUTTON_LG_PRIMARY}`;

// The link in the email opens this page. The check runs when the page opens because the reader
// has already clicked the link. A second button would be a second click for the same thing.
// Success does not sign anyone in. The link may have been opened by someone other than the
// person who registered, so the person signs in with their own password.
export default function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState(null);
  // The link works once. In development React runs this effect twice and the second call
  // would report that the link was already used. The ref stops the second call.
  const spent = useRef(false);

  useEffect(() => {
    if (!token || spent.current) return;
    spent.current = true;

    apiPost('/auth/verify-email', { token })
      .then(() => {
        // From here the token is spent. It is removed from the address bar.
        scrubTokenFromUrl();
        setVerified(true);
      })
      // The server says why a link was refused: used, expired or not valid. Each has a
      // different next step. The token is spent either way, so it is removed here too.
      .catch((err) => {
        scrubTokenFromUrl();
        setError(err);
      });
  }, [token]);

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
      <AuthLayout eyebrow="Verification" title="Your email address is verified">
        <p className="mt-3" role="status">
          You can now sign in with your email and password. This confirmation link cannot be
          used again.
        </p>
        <Link to="/login" className={BUTTON_LINK}>Go to sign in</Link>
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
