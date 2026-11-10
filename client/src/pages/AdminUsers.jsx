import { useEffect, useRef, useState } from 'react';
import Breadcrumb from '@/components/Breadcrumb';
import Select from '@/components/Select';
import { apiPost, apiPut } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { useAuth } from '@/lib/AuthContext';
import Callout from '@/components/Callout';
import ErrorNotice from '@/components/ErrorNotice';
import StatusPill from '@/components/StatusPill';
import { readableDate } from '@/lib/dates';
import { CARD, PAGE_TITLE, RING } from '@/lib/ui';
import {
  ADMIN_BUTTON_DANGER, ADMIN_BUTTON_OUTLINE, ADMIN_SELECT,
} from '@/components/AdminRecords';

// The list is a real table: Person and role and status and action. On a phone each person becomes a card.
// The table elements then stop being table boxes. Each one keeps its table role by attribute.
// So a screen reader still hears the column and row headers.
// There is only one copy of the markup so nothing is read twice.
const COLUMNS = [
  ['Person', ''],
  ['Role', 'md:w-[15rem] lg:w-[22rem]'],
  ['Status', 'md:w-[9.5rem]'],
  ['Action', 'md:w-[10.5rem]'],
];
const TH = 'text-left text-xs font-medium text-muted-foreground md:border-b md:border-border-soft md:pb-2 md:pr-3';
const TD = 'min-w-0 md:px-0 md:pr-3 md:align-middle';

// Change role is blue once the chosen role differs. It is grey until then.
const ROLE_BUTTON = `inline-flex min-h-touch shrink-0 items-center justify-center rounded-control px-4 font-sans text-sm font-semibold leading-snug text-primary-foreground ${RING}`;
const ROLE_BUTTON_ON = `${ROLE_BUTTON} bg-primary`;
const ROLE_BUTTON_OFF = `${ROLE_BUTTON} bg-disabled`;

const ROLE_WORDS = { student: 'Student', staff: 'Staff', legal_expert: 'Legal expert', admin: 'Administrator' };
const RELOAD_NOTE = 'The change was saved but the list could not reload. Reload the page.';
// A legal expert is never in this list. They join by invitation only.
const CHANGEABLE = ['student', 'staff', 'admin'];

// One person. The admin can change the role of a student or staff member or admin.
// They can switch an account off or on again.
// An account is never deleted because guides and directory entries keep the account of the admin who published them.
// Switching off asks first in the same cell. Switching on again does not ask because it is easy to undo.
function PersonRow({ person, isMe, onDone, onAnnounce, reloadFailed = false }) {
  const [role, setRole] = useState(person.role);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const off = Boolean(person.deactivated_at);
  const status = off ? 'deactivated' : person.email_verified_at ? 'active' : 'unverified';
  const canChangeRole = CHANGEABLE.includes(person.role);
  const unchanged = role === person.role;

  const cancelRef = useRef(null);
  const switchOffRef = useRef(null);
  const switchOnRef = useRef(null);
  // After Cancel or after a refused request focus goes back to Switch off.
  const backToSwitchOff = useRef(false);
  // After a request goes through, focus waits for the button the new state shows.
  const waitForOff = useRef(null);

  useEffect(() => {
    if (confirming) {
      cancelRef.current?.focus();
    } else if (backToSwitchOff.current) {
      backToSwitchOff.current = false;
      switchOffRef.current?.focus();
    }
  }, [confirming]);

  useEffect(() => {
    if (waitForOff.current !== null && waitForOff.current === off) {
      waitForOff.current = null;
      (off ? switchOnRef : switchOffRef).current?.focus();
    }
  }, [off]);

  // Set the moment a request starts, so a second press before the next render sends nothing.
  const inFlight = useRef(false);

  async function act(request) {
    if (inFlight.current) return false;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    onAnnounce('');
    try {
      await request();
    } catch (err) {
      // For example "this is the last active admin". The server says why, in words.
      setError(err);
      return false;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
    // The change went through. A failed reload is shown by the page, not as this person's error.
    onDone();
    return true;
  }

  // A control that is greyed out must also do nothing when pressed.
  async function changeRole() {
    if (busy || unchanged) return;
    const chosen = role;
    if (await act(() => apiPut(`/admin/users/${person.id}/role`, { role: chosen }))) {
      onAnnounce(`Role changed to ${ROLE_WORDS[chosen]}.`);
    }
  }

  function askToSwitchOff() {
    if (busy) return;
    setConfirming(true);
  }

  function cancelSwitchOff() {
    // Once Confirm is pressed the request is on its way, so Cancel can no longer stop it.
    if (inFlight.current) return;
    backToSwitchOff.current = true;
    setConfirming(false);
  }

  async function confirmSwitchOff() {
    // A second press while the request is on its way must not close the confirm step.
    if (inFlight.current) return;
    const done = await act(() => apiPost(`/admin/users/${person.id}/deactivate`));
    if (done) {
      waitForOff.current = true;
      onAnnounce('Account switched off.');
    } else {
      backToSwitchOff.current = true;
    }
    setConfirming(false);
  }

  async function switchOn() {
    if (await act(() => apiPost(`/admin/users/${person.id}/reactivate`))) {
      waitForOff.current = false;
      onAnnounce('Account switched on.');
    }
  }

  function onConfirmKeyDown(e) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      cancelSwitchOff();
    }
  }

  const nameId = `person-${person.id}-name`;

  return (
    <tr role="row" className="flex flex-wrap items-center gap-x-3 gap-y-3 border-t border-border-soft py-4 first:border-t-0 first:pt-2 md:table-row md:py-0">
      <th role="rowheader" scope="row" aria-labelledby={nameId} className={`${TD} max-md:w-full py-0 text-left font-normal md:py-2`}>
        <h3 id={nameId} className="font-head text-base font-semibold leading-5 text-ink break-words">{person.name}</h3>
        <p className="text-sm leading-5 break-all">{person.email}</p>
        <p className="text-xs leading-4 text-muted-foreground">
          {ROLE_WORDS[person.role] ?? person.role} · Account {person.id} · Joined {readableDate(person.created_at)}
          {isMe ? ' · This is you' : ''}
        </p>
        {error && <ErrorNotice error={error} className="mt-2" />}
        {/* The change went through, but the list shown is the one from before it. Say so here. */}
        {reloadFailed && <p role="alert" className="mt-2 text-sm font-semibold leading-5 text-ink">{RELOAD_NOTE}</p>}
      </th>

      {/* The select is named by its aria-label, so there is no visible label line above it. */}
      <td role="cell" className={`${TD} max-md:w-full md:py-2`}>
        {canChangeRole ? (
          // Below 360 px the button drops under the select, so the select is never squeezed to a stub.
          <div className="flex flex-col gap-2 min-[360px]:flex-row min-[360px]:items-center">
            <Select
              id={`role-${person.id}`}
              aria-label={`Role of ${person.name}`}
              className={ADMIN_SELECT}
              wrapperClassName="flex min-w-0 w-full min-[360px]:flex-1"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              {CHANGEABLE.map((r) => <option key={r} value={r}>{ROLE_WORDS[r]}</option>)}
            </Select>
            <button
              type="button"
              aria-disabled={(busy || unchanged) || undefined}
              className={unchanged ? ROLE_BUTTON_OFF : ROLE_BUTTON_ON}
              onClick={changeRole}
            >
              Change role
            </button>
          </div>
        ) : (
          <p className="text-sm leading-5 text-muted-foreground">
            A legal expert’s role cannot be changed. Their directory entry and guides are tied to the account. Switch it off instead.
          </p>
        )}
        {isMe && (
          <p className="mt-1 text-xs leading-4 text-muted-foreground">You cannot switch off your own account. Ask another administrator.</p>
        )}
      </td>

      {/* On a phone the status and the action share the last line. */}
      <td role="cell" className={`${TD} md:py-2`}>
        <StatusPill status={status} />
      </td>
      <td role="cell" className={`${TD} max-md:ml-auto md:py-2`}>
        {off ? (
          <button ref={switchOnRef} type="button" aria-disabled={busy || undefined} className={`${ADMIN_BUTTON_OUTLINE} whitespace-nowrap`} onClick={switchOn}>
            Switch on again
          </button>
        ) : isMe ? null : confirming ? (
          <div role="group" aria-labelledby={`${nameId}-ask`} onKeyDown={onConfirmKeyDown} className="flex flex-col gap-1 max-md:items-end">
            <p id={`${nameId}-ask`} className="text-xs font-semibold leading-4 text-ink break-words max-md:text-right">
              Switch off {person.name}?
            </p>
            <div className="flex gap-1.5">
              <button ref={cancelRef} type="button" aria-disabled={busy || undefined} className={`${ADMIN_BUTTON_OUTLINE} !px-3`} onClick={cancelSwitchOff}>
                Cancel
              </button>
              <button type="button" aria-disabled={busy || undefined} className={`${ADMIN_BUTTON_DANGER} !px-3`} onClick={confirmSwitchOff}>
                Confirm
              </button>
            </div>
          </div>
        ) : (
          <button ref={switchOffRef} type="button" aria-disabled={busy || undefined} className={`${ADMIN_BUTTON_OUTLINE} whitespace-nowrap`} onClick={askToSwitchOff}>
            Switch off
          </button>
        )}
      </td>
    </tr>
  );
}

// Everyone with an account. It lists name, email and role. It has no count of what a person asked
// or booked.
export default function AdminUsers() {
  const { user: me } = useAuth();
  const { data: fetched, error, loading, refetch } = useApi('/admin/users');
  const [announcement, setAnnouncement] = useState('');
  // The list kept from before the last change. A failed reload gives no list from the server, so the
  // page keeps this one and the changed person's row says the list is out of date.
  const [before, setBefore] = useState(null);
  const [changed, setChanged] = useState(null);
  const people = fetched ?? before;
  const reloadFailed = Boolean(error) && changed !== null;

  function changeSaved(personId) {
    setBefore(fetched ?? before);
    setChanged(personId);
    refetch();
  }

  return (
    <div>
      <Breadcrumb trail={[{ label: 'Admin workspace' }]} current="People" />
      <h1 className={`mt-4 ${PAGE_TITLE}`}>People</h1>
      <p className="mt-2.5 max-w-reading text-sm text-muted-foreground">
        Manage role and account state, not private questions, matter text or activity. A
        switched-off account cannot sign in and its old sessions stay dead.
      </p>
      <Callout title="Expert roles cannot be changed" className="mt-6">
        Experts join by invitation. Switch off an expert account instead of changing its role. You
        cannot switch off your own account.
      </Callout>

      {loading && <p className="mt-6 text-muted-foreground">Loading…</p>}
      {error && !reloadFailed && <ErrorNotice error={error} className="mt-6" />}

      {/* One live region for the whole page, present before anything is said in it. */}
      <p role="status" className="sr-only">{announcement}</p>

      <section className={`${CARD} mt-6`}>
        <h2 className="font-head text-base leading-[1.3] text-ink">Account access</h2>
        <table role="table" className="mt-3.5 block w-full md:table md:table-fixed md:border-collapse">
          <caption className="sr-only">Accounts, with each person’s role, status and the action you can take</caption>
          <thead role="rowgroup" className="max-md:sr-only md:table-header-group">
            <tr role="row" className="md:table-row">
              {COLUMNS.map(([name, width]) => (
                <th key={name} role="columnheader" scope="col" className={`${TH} ${width}`}>{name}</th>
              ))}
            </tr>
          </thead>
          <tbody role="rowgroup" className="block md:table-row-group">
            {people?.map((person) => (
              <PersonRow
                key={person.id}
                person={person}
                isMe={person.id === me?.id}
                onDone={() => changeSaved(person.id)}
                onAnnounce={setAnnouncement}
                reloadFailed={reloadFailed && changed === person.id}
              />
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
