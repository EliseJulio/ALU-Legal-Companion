import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { signInPath } from '@/lib/url';
import { apiPost, apiPut } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { useAuth } from '@/lib/AuthContext';
import Breadcrumb from '@/components/Breadcrumb';
import Callout from '@/components/Callout';
import ErrorNotice from '@/components/ErrorNotice';
import PasswordField from '@/components/PasswordField';
import { readableDate } from '@/lib/dates';
import { FIELD, BUTTON_PRIMARY } from '@/lib/ui';

const PANEL = 'rounded-card border border-border bg-surface p-6';
const LABEL = 'text-xs font-semibold uppercase tracking-wide text-muted-foreground';
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
    <form onSubmit={save} className={PANEL} aria-labelledby="name-heading">
      <h2 id="name-heading" className="font-head text-2xl leading-heading text-primary">Your name</h2>
      <label htmlFor="settings-name" className="mt-2 block text-sm font-medium">Name</label>
      <input id="settings-name" type="text" maxLength={100} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className={FIELD} />
      {error && <ErrorNotice error={error} className="mt-3" />}
      <div role="status">{done && <p className="mt-3 text-sm">Your name is saved.</p>}</div>
      <button type="submit" aria-disabled={busy || undefined} className={`${BUTTON_PRIMARY} mt-3`}>
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
  const [shown, setShown] = useState(false);
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
      setShown(false);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className={PANEL} aria-labelledby="password-heading">
      <h2 id="password-heading" className="font-head text-2xl leading-heading text-primary">Change your password</h2>
      <p className="mt-1 text-sm text-muted-foreground">This signs you out everywhere else and keeps you signed in here.</p>

      <PasswordField
        id="current-password"
        label="Current password"
        className="mt-3"
        value={current}
        onChange={(e) => setCurrent(e.target.value)}
        shown={shown}
        toggle={false}
        autoComplete="current-password"
      />
      <PasswordField
        id="new-password"
        label="New password"
        hint="At least 8 characters."
        className="mt-3"
        value={next}
        onChange={(e) => setNext(e.target.value)}
        shown={shown}
        toggle={false}
        autoComplete="new-password"
      />
      <PasswordField
        id="again-password"
        label="Confirm new password"
        className="mt-3"
        value={again}
        onChange={(e) => setAgain(e.target.value)}
        shown={shown}
        onShownChange={setShown}
        toggleLabel="Show passwords"
        controls="current-password new-password again-password"
        autoComplete="new-password"
      />

      {error && <ErrorNotice error={error} className="mt-3" />}
      <div role="status">{done && <p className="mt-3 text-sm">Your password is changed. Other devices are signed out.</p>}</div>
      <button type="submit" aria-disabled={busy || undefined} className={`${BUTTON_PRIMARY} mt-3`}>
        {busy ? 'Saving…' : 'Change password'}
      </button>
    </form>
  );
}

// One page for every signed-in role. There is nowhere to enter a phone number, a home address or
// a student number. The platform keeps as little about a person as it can.
export default function AccountSettings() {
  const { user } = useAuth();
  const here = useLocation();
  // The account is requested only for a signed-in person. A visitor would get a 401.
  const { data: me, error, loading } = useApi(user ? '/auth/me' : null);

  if (!user) {
    return (
      <div className={`mt-6 ${PANEL}`}>
        <h1 className="font-head text-4xl leading-heading text-primary md:text-5xl">Sign in to manage your account</h1>
        <Link to={signInPath(here)} className={`${BUTTON_PRIMARY} mt-3`}>Sign in</Link>
      </div>
    );
  }

  const since = me ? readableDate(me.created_at) : null;

  return (
    <div>
      <Breadcrumb trail={[{ label: 'Home', to: '/' }]} current="Account settings" />
      <h1 className="mt-6 font-head text-4xl leading-heading text-primary md:text-5xl">Account settings</h1>
      <p className="mt-4 max-w-reading text-muted-foreground">Manage your name and password. No extra personal information is collected.</p>

      {loading && <p className="mt-4 text-muted-foreground">Loading your account…</p>}
      {error && <ErrorNotice error={error} className="mt-4" />}

      <div className="mt-6 grid gap-6 xl:grid-cols-[22rem_minmax(0,1fr)]">
        <div className="min-w-0 space-y-6">
          {me && (
            <section className={PANEL} aria-labelledby="overview-heading">
              <h2 id="overview-heading" className="font-head text-2xl leading-heading text-primary">Overview</h2>
              <dl className="mt-3 space-y-4 text-sm">
                <div>
                  <dt className={LABEL}>Name</dt>
                  <dd className="mt-1 font-medium">{me.name}</dd>
                </div>
                <div>
                  <dt className={LABEL}>Email / confirmation</dt>
                  <dd className="mt-1 font-medium">{me.email} {me.email_verified_at ? '(confirmed)' : '(not confirmed)'}</dd>
                </div>
                <div>
                  <dt className={LABEL}>Role</dt>
                  <dd className="mt-1 font-medium">{ROLE_WORDS[me.role] ?? me.role}</dd>
                </div>
                {since && (
                  <div>
                    <dt className={LABEL}>Member since</dt>
                    <dd className="mt-1 font-medium">{since}</dd>
                  </div>
                )}
              </dl>
            </section>
          )}

          <Callout title="Your account stays separate from shared matter identity">
            Free text can still identify you. Share only what you intend to disclose.
          </Callout>
        </div>

        <div className="min-w-0 space-y-6">
          <NameForm current={user.name} />
          <PasswordForm />
        </div>
      </div>
    </div>
  );
}
