import { useState } from 'react';
import { apiPost, apiPut } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { useAuth } from '@/lib/AuthContext';
import ErrorNotice from '@/components/ErrorNotice';
import StatusPill from '@/components/StatusPill';
import Field from '@/components/Field';
import { readableDate } from '@/lib/dates';
import { PANEL, BUTTON_PRIMARY, BUTTON_OUTLINE } from '@/lib/ui';

const ROLE_WORDS = { student: 'Student', staff: 'Staff', legal_expert: 'Legal expert', admin: 'Administrator' };
// A legal expert is never in this list. They join by invitation only.
const CHANGEABLE = ['student', 'staff', 'admin'];

// One person. The admin can change the role of a student, staff member or admin. They can
// switch an account off or on again. An account is never deleted, because guides and directory
// entries keep the name of the expert who checked them.
function PersonRow({ person, isMe, onDone }) {
  const [role, setRole] = useState(person.role);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const off = Boolean(person.deactivated_at);
  const status = off ? 'deactivated' : person.email_verified_at ? 'active' : 'unverified';
  const canChangeRole = CHANGEABLE.includes(person.role);

  async function act(request) {
    setBusy(true);
    setError(null);
    try {
      await request();
      onDone();
    } catch (err) {
      // For example "this is the last active admin". The server says why, in words.
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className={PANEL}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-head font-semibold text-primary">{person.name}</h2>
        <StatusPill status={status} />
      </div>
      <p className="mt-1 text-sm">{person.email}</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {ROLE_WORDS[person.role] ?? person.role} · Account {person.id} · Joined {readableDate(person.created_at)}
        {isMe ? ' · This is you' : ''}
      </p>

      {canChangeRole ? (
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <Field
            id={`role-${person.id}`}
            label={`Role of ${person.name}`}
            as="select"
            className="w-full sm:w-56"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            {CHANGEABLE.map((r) => <option key={r} value={r}>{ROLE_WORDS[r]}</option>)}
          </Field>
          <button
            type="button"
            disabled={busy || role === person.role}
            className={BUTTON_PRIMARY}
            onClick={() => act(() => apiPut(`/admin/users/${person.id}/role`, { role }))}
          >
            Change role
          </button>
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">
          A legal expert’s role cannot be changed. Their directory entry and guides are tied to the account. Switch it off instead.
        </p>
      )}

      <div className="mt-3">
        {off ? (
          <button type="button" disabled={busy} className={BUTTON_OUTLINE} onClick={() => act(() => apiPost(`/admin/users/${person.id}/reactivate`))}>
            Switch on again
          </button>
        ) : isMe ? (
          <p className="text-sm text-muted-foreground">You cannot switch off your own account. Ask another administrator.</p>
        ) : (
          <button type="button" disabled={busy} className={BUTTON_OUTLINE} onClick={() => act(() => apiPost(`/admin/users/${person.id}/deactivate`))}>
            Switch off
          </button>
        )}
      </div>

      {error && <ErrorNotice error={error} className="mt-3" />}
    </li>
  );
}

// Everyone with an account. This is the most personal data the platform shows. It lists name,
// email and role because managing accounts needs them. There is no count of what a person asked
// or booked. That would turn account management into watching people.
export default function AdminUsers() {
  const { user: me } = useAuth();
  const { data: people, error, loading, refetch } = useApi('/admin/users');

  return (
    <div>
      <h1 className="font-head text-2xl text-primary">People</h1>
      <p className="mt-1 text-muted-foreground">
        Change a role or switch an account off. A switched-off account cannot sign in and its
        old sessions stay dead. Legal experts join by invitation only.
      </p>

      {loading && <p className="mt-6 text-muted-foreground">Loading…</p>}
      {error && <ErrorNotice error={error} className="mt-6" />}

      <ul className="mt-6 space-y-3">
        {people?.map((person) => (
          <PersonRow key={person.id} person={person} isMe={person.id === me?.id} onDone={refetch} />
        ))}
      </ul>
    </div>
  );
}
