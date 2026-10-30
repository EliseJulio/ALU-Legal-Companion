import { useState } from 'react';
import { Link } from 'react-router-dom';
import { apiPost } from '@/lib/api';
import { isAluEmail, ALLOWED_DOMAINS } from '@/lib/email';
import ErrorNotice from '@/components/ErrorNotice';
import AuthLayout from '@/components/AuthLayout';
import Callout from '@/components/Callout';
import PasswordField from '@/components/PasswordField';
import { RING, RING_ON_CANVAS, FIELD } from '@/lib/ui';

// Sign-up for students and staff with an ALU address. Registering is not signing in. The
// server sends a link and the account works once the link is used. So no session is made here.
function problemWith(name, email, password) {
  if (!name) return 'Enter your name.';
  if (!email) return 'Enter your ALU email address.';
  if (!isAluEmail(email)) {
    return `Sign-up is limited to the ALU community: ${ALLOWED_DOMAINS.map((d) => `@${d}`).join(' or ')}.`;
  }
  if (password.length < 8) return 'Choose a password of at least 8 characters.';
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
  const [message, setMessage] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    const problem = problemWith(name.trim(), email.trim(), password);
    if (problem) {
      setError({ message: problem });
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
        <div className="mt-4 rounded-card border border-border bg-surface p-6">
          <div role="status"><Callout title="Email confirmation required">{message}</Callout></div>
          <Link to="/login" className={`mt-4 inline-flex min-h-button items-center justify-center rounded bg-primary px-5 font-sans font-semibold text-primary-foreground ${RING}`}>
            Go to sign in
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      eyebrow="Register"
      title="Create an ALU account"
      intro="Students and staff only. Legal experts join by invitation. An account lets you track your matters and get reminders. You do not need one to use the directory or ask a question anonymously."
    >
      {error && <ErrorNotice error={error} className="mt-4" />}

      <form onSubmit={handleSubmit} noValidate className="mt-4 rounded-card border border-border bg-surface p-6">
        <label htmlFor="name" className="block text-sm font-medium">Your name</label>
        <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className={FIELD} />

        <label htmlFor="email" className="mt-4 block text-sm font-medium">ALU email address</label>
        <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className={FIELD} />

        <PasswordField
          id="password"
          label="Password"
          shown={shown}
          onShownChange={setShown}
          hint="At least 8 characters."
          className="mt-4"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />

        <fieldset className="mt-4">
          <legend className="text-sm font-medium">I am</legend>
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

        <button
          type="submit"
          aria-disabled={sending || undefined}
          className={`mt-4 inline-flex min-h-button items-center justify-center rounded px-5
            font-sans font-semibold text-primary-foreground
            ${RING} ${sending ? 'bg-disabled' : 'bg-primary'}`}
        >
          {sending ? 'Creating your account…' : 'Create account'}
        </button>
      </form>

      <p className="mt-4 text-sm">
        <Link to="/login" className={`inline-flex min-h-touch items-center font-semibold 
          text-info underline underline-offset-2 ${RING_ON_CANVAS}`}>
          Already registered? Sign in →
        </Link>
      </p>
    </AuthLayout>
  );
}
