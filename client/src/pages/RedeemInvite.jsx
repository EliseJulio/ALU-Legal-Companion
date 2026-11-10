import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { apiPost } from '@/lib/api';
import { scrubTokenFromUrl } from '@/lib/url';
import { useAuth } from '@/lib/AuthContext';
import { FORM_ERROR_ID, fieldProblem, focusField, useFieldMarks } from '@/lib/fieldError';
import ErrorNotice from '@/components/ErrorNotice';
import AuthLayout from '@/components/AuthLayout';
import Callout from '@/components/Callout';
import PasswordField from '@/components/PasswordField';
import { FORM_FIELD, BUTTON_LG_PRIMARY, BUTTON_DISABLED, BUTTON_TEXT, CARD } from '@/lib/ui';

// The only way to become a legal expert. An admin sends an invitation by email. Using it proves
// the person owns the address. The link brings the code in the address. Without it the page says the
// link is incomplete. The invitation works once, so nothing is sent until the form
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
  const { marks, edited } = useFieldMarks(error);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(event) {
    event.preventDefault();
    const problem = (() => {
      if (!code.trim()) return fieldProblem('code', 'Paste the invitation code from your email.');
      if (!name.trim()) return fieldProblem('name', 'Enter your name.');
      if (password.length < 8) return fieldProblem('password', 'Choose a password of at least 8 characters.');
      if (password !== again) return fieldProblem('again', 'The two passwords are not the same.');
      return null;
    })();
    if (problem) {
      setError(problem);
      focusField(problem.field);
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
      setShown(false);
      setAgain('');
      setSending(false);
    }
  }

  // Without the code in the address the form cannot work. Say so first,
  // instead of letting the reader fill in the whole form.
  if (!params.get('token')) {
    return (
      <AuthLayout eyebrow="Invitation" title="This link is incomplete">
        <p className="mt-3">Open the link from your invitation email again. If it still does not work, ask the person who invited you for a new one.</p>
        <Link to="/login" className={`mt-6 ${BUTTON_LG_PRIMARY}`}>
          Back to sign in
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout eyebrow="Invitation" title="Accept your invitation" intro="Invited experts only. No self-registration.">
      <Callout title="Invited experts only" className="mb-4">
        Your invitation code is in the email you were sent. It is filled in for you when you open the link.
      </Callout>

      {error && <ErrorNotice error={error} id={FORM_ERROR_ID} className="mb-4" />}

      <div className={CARD}>
      <form onSubmit={handleSubmit} noValidate>
        <label htmlFor="code" className="block text-sm font-semibold">Invitation</label>
        <input
          id="code"
          type="text"
          value={code}
          onChange={(e) => { setCode(e.target.value); edited('code'); }}
          autoComplete="off"
          spellCheck="false"
          className={`${FORM_FIELD} font-mono`}
          {...marks('code')}
        />

        <label htmlFor="name" className="mt-4 block text-sm font-semibold">Name</label>
        <input id="name" type="text" value={name} onChange={(e) => { setName(e.target.value); edited('name'); }} autoComplete="name" className={FORM_FIELD} {...marks('name')} />

        <PasswordField
          id="password"
          label="Password"
          hint="At least 8 characters."
          className="mt-4"
          value={password}
          onChange={(e) => { setPassword(e.target.value); edited('password'); }}
          shown={shown}
          toggle={false}
          autoComplete="new-password"
          {...marks('password')}
        />

        <PasswordField
          id="again"
          label="Confirm password"
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
          {sending ? 'Creating your account…' : 'Redeem invitation'}
        </button>
      </form>
      </div>

      <p className="mt-4 text-sm text-muted-foreground">
        Your invitation can be used once. If it has expired, contact the person who invited you.
      </p>

      <p className="mt-4 text-sm">
        <Link to="/login" className={BUTTON_TEXT}>
          Back to sign in →
        </Link>
      </p>
    </AuthLayout>
  );
}
