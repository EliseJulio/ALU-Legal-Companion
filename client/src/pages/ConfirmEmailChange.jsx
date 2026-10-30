import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiPost } from '@/lib/api';
import { scrubTokenFromUrl } from '@/lib/url';
import { useAuth } from '@/lib/AuthContext';
import ErrorNotice from '@/components/ErrorNotice';
import AuthLayout from '@/components/AuthLayout';
import { RING } from '@/lib/ui';

const BUTTON_LINK = `mt-4 inline-flex min-h-button items-center justify-center rounded bg-primary px-5 font-sans font-semibold text-primary-foreground ${RING}`;

// The link sent to the new address opens this page. The change runs when the page opens because
// the reader has already clicked the link. Other devices are signed out, this one stays signed in.
export default function ConfirmEmailChange() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const { signIn } = useAuth();
  const [changed, setChanged] = useState(null);
  const [error, setError] = useState(null);
  // The link works once. In development React runs this effect twice and the second call
  // would report that the link was already used. The ref stops the second call.
  const spent = useRef(false);

  useEffect(() => {
    if (!token || spent.current) return;
    spent.current = true;

    apiPost('/auth/confirm-email-change', { token })
      .then((session) => {
        scrubTokenFromUrl();
        signIn(session);
        setChanged(session.user);
      })
      // The server says why a link was refused: used, expired or not valid. The message is shown as it is.
      .catch((err) => setError(err));
  }, [token, signIn]);

  if (!token) {
    return (
      <AuthLayout eyebrow="Email address" title="This link is incomplete">
        <p className="mt-3">Open the link from the email again. If it does not work,
          ask for a new one in your account settings.</p>
        <Link to="/settings" className={BUTTON_LINK}>Go to account settings</Link>
      </AuthLayout>
    );
  }

  if (changed) {
    return (
      <AuthLayout eyebrow="Email address" title="Email address changed">
        <p className="mt-3" role="status">
          Your account now uses {changed.email}. Other devices were signed out. This link
          cannot be used again.
        </p>
        <Link to="/settings" className={BUTTON_LINK}>Go to account settings</Link>
      </AuthLayout>
    );
  }

  if (error) {
    return (
      <AuthLayout eyebrow="Email address" title="We could not change your address">
        <ErrorNotice error={error} className="mt-4" />
        <Link to="/settings" className={BUTTON_LINK}>Go to account settings</Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout eyebrow="Email address" title="Changing your address">
      <p className="mt-3 text-muted-foreground">One moment…</p>
    </AuthLayout>
  );
}
