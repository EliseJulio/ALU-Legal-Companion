import { useState } from 'react';
import { Link } from 'react-router-dom';
import { apiPost, apiPut } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { useAuth } from '@/lib/AuthContext';
import ErrorNotice from '@/components/ErrorNotice';
import { readableDate } from '@/lib/dates';
import { FIELD, BUTTON_PRIMARY } from '@/lib/ui';

const PANEL = 'rounded border border-border bg-surface p-4';
const ROLE_WORDS = { student: 'Student', staff: 'Staff', legal_expert: 'Legal expert', admin: 'Administrator' };

// Change your own name. The server reads the name and nothing else, so this form cannot be used
// to change a role or an address. A new token comes back because the name is stored in it.
function NameForm({ current }) {
  const { signIn } = useAuth();
  const [name, setName] = useState(current);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  async function save(event) {
    event.preventDefault();
    if (!name.trim()) {
      setError({ message: 'Your name cannot be empty.' });
      return;
    }
    setBusy(true);
    setError(null);
    setDone(false);
    try {
      signIn(await apiPut('/auth/me', { name: name.trim() }));
      setDone(true);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className={`mt-6 ${PANEL}`} aria-labelledby="name-heading">
      <h2 id="name-heading" className="font-head text-lg font-semibold text-primary">Your name</h2>
      <label htmlFor="settings-name" className="mt-2 block text-sm font-medium">Name</label>
      <input id="settings-name" type="text" maxLength={100} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className={FIELD} />
      {error && <ErrorNotice error={error} className="mt-3" />}
      <div role="status">{done && <p className="mt-3 text-sm">Your name is saved.</p>}</div>
      <button type="submit" disabled={busy} className={`${BUTTON_PRIMARY} mt-3`}>
        {busy ? 'Saving…' : 'Save name'}
      </button>
    </form>
  );
}

// Change your password. It ends every other session of the account and keeps this one. People
// change a password when they think someone else has got in.
function PasswordForm() {
  const { signIn } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  async function save(event) {
    event.preventDefault();
    setDone(false);
    if (!current) {
      setError({ message: 'Enter your current password.' });
      return;
    }
    if (next.length < 8) {
      setError({ message: 'Choose a new password of at least 8 characters.' });
      return;
    }
    if (next !== again) {
      setError({ message: 'The two new passwords are not the same.' });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      signIn(await apiPost('/auth/change-password', { current_password: current, new_password: next }));
      setDone(true);
    } catch (err) {
      setError(err);
    } finally {
      // None of the three boxes keeps its text, whether it worked or not.
      setCurrent('');
      setNext('');
      setAgain('');
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className={`mt-6 ${PANEL}`} aria-labelledby="password-heading">
      <h2 id="password-heading" className="font-head text-lg font-semibold text-primary">Change your password</h2>
      <p className="mt-1 text-sm text-muted-foreground">This signs you out everywhere else and keeps you signed in here.</p>

      <label htmlFor="current-password" className="mt-3 block text-sm font-medium">Current password</label>
      <input id="current-password" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" className={FIELD} />

      <label htmlFor="new-password" className="mt-3 block text-sm font-medium">New password</label>
      <p id="new-password-hint" className="mt-1 text-sm text-muted-foreground">At least 8 characters.</p>
      <input id="new-password" type="password" value={next} onChange={(e) => setNext(e.target.value)} aria-describedby="new-password-hint" autoComplete="new-password" className={FIELD} />

      <label htmlFor="again-password" className="mt-3 block text-sm font-medium">Type the new password again</label>
      <input id="again-password" type="password" value={again} onChange={(e) => setAgain(e.target.value)} autoComplete="new-password" className={FIELD} />

      {error && <ErrorNotice error={error} className="mt-3" />}
      <div role="status">{done && <p className="mt-3 text-sm">Your password is changed. Other devices are signed out.</p>}</div>
      <button type="submit" disabled={busy} className={`${BUTTON_PRIMARY} mt-3`}>
        {busy ? 'Saving…' : 'Change password'}
      </button>
    </form>
  );
}

// One page for every signed-in role. There is nowhere to enter a phone number, a home address or
// a student number. The platform keeps as little about a person as it can.
export default function AccountSettings() {
  const { user } = useAuth();
  // The account is requested only for a signed-in person. A visitor would get a 401.
  const { data: me, error, loading } = useApi(user ? '/auth/me' : null);

  if (!user) {
    return (
      <div className={`mt-6 ${PANEL}`}>
        <h1 className="font-head text-2xl text-primary">Sign in to manage your account</h1>
        <Link to="/login" className={`${BUTTON_PRIMARY} mt-3`}>Sign in</Link>
      </div>
    );
  }

  const since = me ? readableDate(me.created_at) : null;

  return (
    <div>
      <h1 className="font-head text-2xl text-primary">Your account</h1>

      {loading && <p className="mt-4 text-muted-foreground">Loading your account…</p>}
      {error && <ErrorNotice error={error} className="mt-4" />}

      {me && (
        <section className={`mt-4 ${PANEL}`} aria-labelledby="overview-heading">
          <h2 id="overview-heading" className="font-head text-lg font-semibold text-primary">Overview</h2>
          <dl className="mt-2 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
            <dt className="text-muted-foreground">Name</dt>
            <dd className="font-medium">{me.name}</dd>
            <dt className="text-muted-foreground">Email</dt>
            <dd className="font-medium">{me.email} {me.email_verified_at ? '(confirmed)' : '(not confirmed)'}</dd>
            <dt className="text-muted-foreground">Role</dt>
            <dd className="font-medium">{ROLE_WORDS[me.role] ?? me.role}</dd>
            {since && (<><dt className="text-muted-foreground">Member since</dt><dd className="font-medium">{since}</dd></>)}
          </dl>
        </section>
      )}

      <NameForm current={user.name} />
      <PasswordForm />
    </div>
  );
}
