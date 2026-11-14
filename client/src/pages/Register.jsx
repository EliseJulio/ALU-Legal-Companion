import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiGet, apiPost } from '@/lib/api';
import { FORM_ERROR_ID, fieldProblem, focusField, useFieldMarks } from '@/lib/fieldError';
import { isAluEmail, ALLOWED_DOMAINS } from '@/lib/email';
import ErrorNotice from '@/components/ErrorNotice';
import AuthLayout, { AuthTabs } from '@/components/AuthLayout';
import Callout from '@/components/Callout';
import PasswordField from '@/components/PasswordField';
import { RING, FORM_FIELD, BUTTON_LG_PRIMARY, BUTTON_DISABLED, BUTTON_OUTLINE, BUTTON_TEXT, CARD } from '@/lib/ui';

// Sign-up for students and staff with an ALU address. Registering is not signing in. The
// server sends a link and the account works once the link is used. So no session is made here.
//
// The link is the only way in, so sign-up is paused when the server cannot send mail at all
// (production with no mail service). The page asks first and shows the form only when it can
// answer. If the question itself fails, the form is shown: a broken check must never block sign-up.
const SHELL = {
  eyebrow: 'Register',
  title: 'Create an ALU account',
  intro: 'Students and staff only. Legal experts join by invitation. An account lets you track your matters and get reminders. You do not need one to use the directory or ask a question anonymously.',
};

function problemWith(name, email, password) {
  if (!name) return fieldProblem('name', 'Enter your name.');
  if (!email) return fieldProblem('email', 'Enter your ALU email address.');
  if (!isAluEmail(email)) {
    return fieldProblem('email', `Sign-up is limited to the ALU community: ${ALLOWED_DOMAINS.map((d) => `@${d}`).join(' or ')}.`);
  }
  if (password.length < 8) return fieldProblem('password', 'Choose a password of at least 8 characters.');
  return null;
}

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [shown, setShown] = useState(false);
  const [role, setRole] = useState('student');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const { marks, edited } = useFieldMarks(error);
  const [message, setMessage] = useState(null);
  // 'checking' until the server answers, then 'open' or 'paused'. A failed check becomes 'open'.
  const [mail, setMail] = useState('checking');

  useEffect(() => {
    let live = true;
    apiGet('/auth/mail-status', { anonymous: true })
      .then((reply) => { if (live) setMail(reply?.available === false ? 'paused' : 'open'); })
      .catch(() => { if (live) setMail('open'); });
    return () => { live = false; };
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    const problem = problemWith(name.trim(), email.trim(), password);
    if (problem) {
      setError(problem);
      focusField(problem.field);
      return;
    }
    setError(null);
    setSending(true);
    try {
      const reply = await apiPost('/auth/register', { name: name.trim(), email: email.trim(), password, role });
      // The server's message says what happened to the email. It is shown as it is.
      setMessage(reply.message);
    } catch (err) {
      setError(err);
    } finally {
      setPassword('');
      setShown(false);
      setSending(false);
    }
  }

  if (message) {
    return (
      <AuthLayout eyebrow="Verification" title="Check your email" intro="Single-use confirmation link required before access.">
        <div className={CARD}>
          <div role="status"><Callout title="Email confirmation required">{message}</Callout></div>
          <Link to="/login" className={`mt-4 w-full ${BUTTON_LG_PRIMARY}`}>
            Go to sign in
          </Link>
        </div>
      </AuthLayout>
    );
  }

  // Until the answer comes back the form is not drawn at all, so it cannot flash and then vanish.
  if (mail === 'checking') {
    return (
      <AuthLayout {...SHELL}>
        <p role="status" className="text-sm text-muted-foreground">Checking…</p>
      </AuthLayout>
    );
  }

  // Sign-up is paused: no form, only a calm notice and a way back to sign in.
  if (mail === 'paused') {
    return (
      <AuthLayout {...SHELL}>
        <div className={CARD}>
          <h2 className="font-head text-lg font-semibold text-ink">Sign-up is paused</h2>
          <p className="mt-2 text-sm text-ink">
            We cannot send confirmation emails right now, so we cannot finish creating accounts. Please try again later.
          </p>
          <Link to="/login" className={`mt-4 ${BUTTON_OUTLINE}`}>Back to sign in</Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout {...SHELL}>
      {error && <ErrorNotice error={error} id={FORM_ERROR_ID} className="mb-4" />}

      <div className={CARD}>
        <AuthTabs current="create" />
        <form onSubmit={handleSubmit} noValidate>
          <label htmlFor="name" className="block text-sm font-semibold">Your name</label>
          <input id="name" type="text" value={name} onChange={(e) => { setName(e.target.value); edited('name'); }} autoComplete="name" className={FORM_FIELD} {...marks('name')} />

          <label htmlFor="email" className="mt-4 block text-sm font-semibold">ALU email address</label>
          <input id="email" type="email" value={email} onChange={(e) => { setEmail(e.target.value); edited('email'); }} autoComplete="email" className={FORM_FIELD} {...marks('email')} />

          <PasswordField
            id="password"
            label="Password"
            shown={shown}
            onShownChange={setShown}
            hint="At least 8 characters."
            className="mt-4"
            value={password}
            onChange={(e) => { setPassword(e.target.value); edited('password'); }}
            autoComplete="new-password"
            {...marks('password')}
          />

          <fieldset className="mt-4">
            <legend className="text-sm font-semibold">I am</legend>
            {[['student', 'A student'], ['staff', 'A member of staff']].map(([value, label]) => (
              <label key={value} className="flex min-h-touch cursor-pointer items-center gap-3 text-sm">
                <input
                  type="radio"
                  name="role"
                  checked={role === value}
                  onChange={() => setRole(value)}
                  className={`h-5 w-5 accent-primary ${RING}`}
                />
                <span>{label}</span>
              </label>
            ))}
          </fieldset>

          <p className="mt-4 text-sm text-muted-foreground">
            By creating an account you agree to the{' '}
            <Link to="/privacy" className={`rounded-control font-semibold text-info underline ${RING}`}>privacy and terms page</Link>.
          </p>

          <button
            type="submit"
            aria-disabled={sending || undefined}
            className={`mt-6 w-full ${sending ? BUTTON_DISABLED : BUTTON_LG_PRIMARY}`}
          >
            {sending ? 'Creating your account…' : 'Create account'}
          </button>
        </form>
      </div>

      <p className="mt-4 text-sm">
        <Link to="/login" className={BUTTON_TEXT}>Already registered? Sign in →</Link>
      </p>
    </AuthLayout>
  );
}
