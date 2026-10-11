import { useState } from 'react';
import { Link } from 'react-router-dom';
import { apiPost } from '@/lib/api';
import { isAluEmail, ALLOWED_DOMAINS } from '@/lib/email';
import ErrorNotice from '@/components/ErrorNotice';
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
      setSending(false);
    }
  }

  if (message) {
    return (
      <div>
        <h1 className="font-head text-2xl text-primary">Check your email</h1>
        <div role="status" className="mt-4 rounded border border-border bg-surface p-4">
          <p>{message}</p>
          <Link to="/login" className={`mt-4 inline-flex min-h-touch items-center rounded bg-primary px-4 font-head font-semibold text-primary-foreground ${RING}`}>
            Go to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-head text-2xl text-primary">Create an account</h1>
      <p className="mt-1 text-muted-foreground">
        For ALU students and staff. An account lets you track your matters and get reminders. You
        do not need one to use the directory or ask a question anonymously.
      </p>

      {error && <ErrorNotice error={error} className="mt-4" />}

      <form onSubmit={handleSubmit} noValidate className="mt-4 rounded border border-border bg-surface p-4">
        <label htmlFor="name" className="block text-sm font-medium">Your name</label>
        <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className={FIELD} />

        <label htmlFor="email" className="mt-4 block text-sm font-medium">ALU email address</label>
        <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className={FIELD} />

        <label htmlFor="password" className="mt-4 block text-sm font-medium">Password</label>
        <p id="password-hint" className="mt-1 text-sm text-muted-foreground">At least 8 characters.</p>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-describedby="password-hint"
          autoComplete="new-password"
          className={FIELD}
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
          disabled={sending}
          className={`mt-4 inline-flex min-h-touch items-center rounded px-4 
            font-head font-semibold text-primary-foreground 
            ${RING} ${sending ? 'bg-disabled' : 'bg-primary'}`}
        >
          {sending ? 'Creating your account…' : 'Create account'}
        </button>
      </form>

      <p className="mt-4 text-sm">
        Already have an account?{' '}
        <Link to="/login" className={`inline-flex min-h-touch items-center font-semibold 
          text-primary underline ${RING_ON_CANVAS}`}>
          Sign in
        </Link>
      </p>
    </div>
  );
}
