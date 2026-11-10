import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { apiPost } from '@/lib/api';
import { scrubTokenFromUrl } from '@/lib/url';
import { useAuth } from '@/lib/AuthContext';
import { homeFor } from '@/lib/nav';
import { FORM_ERROR_ID, fieldProblem, focusField, useFieldMarks } from '@/lib/fieldError';
import ErrorNotice from '@/components/ErrorNotice';
import AuthLayout from '@/components/AuthLayout';
import PasswordField from '@/components/PasswordField';
import { BUTTON_LG_PRIMARY, BUTTON_DISABLED, BUTTON_TEXT, CARD } from '@/lib/ui';

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
  const { marks, edited } = useFieldMarks(error);

  async function handleSubmit(event) {
    event.preventDefault();
    if (password.length < 8) {
      setError(fieldProblem('password', 'Choose a password of at least 8 characters.'));
      focusField('password');
      return;
    }
    if (password !== again) {
      setError(fieldProblem('again', 'The two passwords are not the same.'));
      focusField('again');
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
        <Link to="/forgot-password" className={`mt-6 ${BUTTON_LG_PRIMARY}`}>
          Ask for a new link
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout eyebrow="Reset" title="Choose a new password" intro="After resetting your password, other sessions will be signed out.">
      {error && <ErrorNotice error={error} id={FORM_ERROR_ID} className="mb-4" />}

      <div className={CARD}>
        <form onSubmit={handleSubmit} noValidate>
          <PasswordField
            id="password"
            label="New password"
            hint="At least 8 characters."
            value={password}
            onChange={(e) => { setPassword(e.target.value); edited('password'); }}
            shown={shown}
            toggle={false}
            autoComplete="new-password"
            {...marks('password')}
          />

          <PasswordField
            id="again"
            label="Confirm new password"
            className="mt-4"
            value={again}
            onChange={(e) => { setAgain(e.target.value); edited('again'); }}
            shown={shown}
            onShownChange={setShown}
            toggleLabel="Show passwords"
            controls="password again"
            autoComplete="new-password"
            {...marks('again')}
          />

          <button
            type="submit"
            aria-disabled={sending || undefined}
            className={`mt-6 w-full ${sending ? BUTTON_DISABLED : BUTTON_LG_PRIMARY}`}
          >
            {sending ? 'Saving…' : 'Reset password'}
          </button>
        </form>
      </div>

      <p className="mt-4 text-sm">
        <Link to="/forgot-password" className={BUTTON_TEXT}>
          Request reset instructions →
        </Link>
      </p>
    </AuthLayout>
  );
}
