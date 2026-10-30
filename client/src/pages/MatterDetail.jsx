import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import { signInPath } from '@/lib/url';
import { apiDelete, apiPost, apiPut } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { useAuth } from '@/lib/AuthContext';
import { hasRole } from '@/lib/auth';
import Breadcrumb from '@/components/Breadcrumb';
import Callout from '@/components/Callout';
import ErrorNotice from '@/components/ErrorNotice';
import Icon from '@/components/Icon';
import StatusPill from '@/components/StatusPill';
import Disclaimer from '@/components/Disclaimer';
import MatterDocuments from '@/components/MatterDocuments';
import { dueInWords, readableDay, todayIso } from '@/lib/dates';
import {
  RING_ON_CANVAS, FIELD, DATE_FIELD, BUTTON_PRIMARY, BUTTON_OUTLINE, BUTTON_ON_CHROME, BUTTON_DANGER_SOLID,
} from '@/lib/ui';

const PANEL = 'rounded-card border border-border bg-surface p-6';
const H2 = 'font-head text-2xl leading-heading text-primary';
const REMINDER_WORDS = { pending: 'Scheduled', sent: 'Sent', missed: 'Not sent in time', cancelled: 'Cancelled' };

// Add a line to the record. The owner and a legal expert the matter is shared with can both do it.
function LogStep({ matterId, onDone }) {
  const [text, setText] = useState('');
  const [date, setDate] = useState(todayIso());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiPost(`/matters/${matterId}/events`, { description: text.trim(), occurred_on: date });
      setText('');
      onDone();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className={PANEL}>
      <h2 id="add-heading" className={H2}>Add to your record</h2>
      <label htmlFor="step-text" className="mt-3 block text-sm font-medium">What happened</label>
      <p id="step-hint" className="mt-1 text-sm text-muted-foreground">Free text can identify you. Avoid unnecessary sensitive details.</p>
      <textarea id="step-text" rows={3} value={text} onChange={(e) => setText(e.target.value)} aria-describedby="step-hint" className={FIELD} />
      <label htmlFor="step-date" className="mt-3 block text-sm font-medium">When</label>
      <input id="step-date" type="date" max={todayIso()} value={date} onChange={(e) => setDate(e.target.value)} className={DATE_FIELD} />
      {error && <ErrorNotice error={error} className="mt-2" />}
      <button type="submit" aria-disabled={(busy || !text.trim()) || undefined} aria-busy={busy} className={`${BUTTON_PRIMARY} mt-4`}>
        Add to the record
      </button>
    </form>
  );
}

// Choose one lawyer or office to share the matter with. The owner only, and only while it is
// not shared. Once it is shared the Expert access card takes over.
function ShareCard({ matter, onDone }) {
  const { data: targets } = useApi('/matters/share-targets');
  const [choice, setChoice] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function share() {
    setBusy(true);
    setError(null);
    try {
      await apiPost(`/matters/${matter.id}/share`, { provider_id: Number(choice) });
      onDone();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={PANEL}>
      <h2 id="share-heading" className={H2}>Share with one chosen expert</h2>
      <p className="mt-3 text-sm">
        The expert sees the shared record, not your account identity. Your free text may still
        identify you.
      </p>
      {targets?.length === 0 && <p className="mt-3 text-sm">No lawyer on the platform is taking shared matters yet.</p>}
      {targets?.length > 0 && (
        <div className="mt-3">
          <label htmlFor="share-target" className="block text-sm font-medium">Share with</label>
          <select id="share-target" value={choice} onChange={(e) => setChoice(e.target.value)} className={FIELD}>
            <option value="">Choose an expert…</option>
            {targets.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <button type="button" aria-disabled={(busy || !choice) || undefined} className={`${BUTTON_PRIMARY} mt-3`} onClick={share}>
            Share this matter
          </button>
        </div>
      )}
      <p className="mt-3 text-xs text-muted-foreground">Sharing is never automatic.</p>
      {error && <ErrorNotice error={error} className="mt-3" />}
    </section>
  );
}

// Who can open the matter now, and the way to end it. Revoking takes effect at once.
function AccessCard({ matter, onDone }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function revoke() {
    setBusy(true);
    setError(null);
    try {
      await apiDelete(`/matters/${matter.id}/share`);
      onDone();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={PANEL}>
      <h2 id="access-heading" className={H2}>Expert access</h2>
      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Current access</p>
      {matter.shared_with ? (
        <>
          <p className="mt-1 text-sm">
            <span className="font-semibold">{matter.shared_with_name}</span> can read this record and add
            notes. They cannot see your name or email, change anything or see your reminders.
          </p>
          <button type="button" aria-disabled={busy || undefined} className={`${BUTTON_OUTLINE} mt-3`} onClick={revoke}>
            Revoke expert access
          </button>
          <p className="mt-3 text-xs text-muted-foreground">When shared, revoking access takes effect immediately.</p>
        </>
      ) : (
        <p className="mt-1 text-sm">No expert has been chosen yet.</p>
      )}
      {error && <ErrorNotice error={error} className="mt-3" />}
    </section>
  );
}

// Change the next step or the deadline. A new deadline replaces the reminders.
function EditNext({ matter, onDone, onCancel }) {
  const heading = useRef(null);
  // The button that opened this form has left the page, so focus goes to the form's heading.
  useEffect(() => { heading.current?.focus(); }, []);
  const [nextAction, setNextAction] = useState(matter.next_action ?? '');
  const [nextDue, setNextDue] = useState(matter.next_due ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiPut(`/matters/${matter.id}`, { next_action: nextAction.trim() || null, next_due: nextDue || null });
      onDone();
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className={`mt-4 ${PANEL}`}>
      <h2 id="edit-heading" ref={heading} tabIndex={-1} className={`${H2} focus:outline-none`}>Edit next step</h2>
      <label htmlFor="edit-next" className="mt-3 block text-sm font-medium">Next step</label>
      <input id="edit-next" type="text" value={nextAction} onChange={(e) => setNextAction(e.target.value)} className={FIELD} />
      <label htmlFor="edit-due" className="mt-3 block text-sm font-medium">Known deadline (optional)</label>
      <p id="edit-due-hint" className="mt-1 text-sm text-muted-foreground">Only enter a date you know. Changing the deadline replaces the reminders.</p>
      <input id="edit-due" type="date" value={nextDue} onChange={(e) => setNextDue(e.target.value)} aria-describedby="edit-due-hint" className={DATE_FIELD} />
      {error && <ErrorNotice error={error} className="mt-2" />}
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="submit" aria-disabled={busy || undefined} aria-busy={busy} className={BUTTON_PRIMARY}>Save next step</button>
        <button type="button" onClick={onCancel} className={BUTTON_OUTLINE}>Cancel</button>
      </div>
    </form>
  );
}

// Private or shared, as a small tag with a lock. The word says it and the lock only decorates.
function PrivacyTag({ shared }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-canvas px-3 py-1 text-xs font-semibold text-ink">
      <Icon name="lock" className="text-base" />
      {shared ? 'Shared' : 'Private'}
    </span>
  );
}

// One matter. The same page serves the owner and a legal expert it is shared with. The server
// says which in `viewer`. The expert gets the record and a note box. They get no editing, no
// deleting, no reminders and no way to share it on.
export default function MatterDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const here = useLocation();
  const navigate = useNavigate();
  const allowed = hasRole(user, ['student', 'staff', 'legal_expert']);
  const { data: m, error, loading, refetch } = useApi(allowed ? `/matters/${id}` : null);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [notice, setNotice] = useState('');
  const [erasing, setErasing] = useState(false);
  const changeButton = useRef(null);
  const wasEditing = useRef(false);
  const keepButton = useRef(null);
  const deleteButton = useRef(null);
  const askedToConfirm = useRef(false);

  // Opening the question moves focus into it. Closing it puts focus back on the button that
  // opened it, so a keyboard reader is never left at the top of the page.
  useEffect(() => {
    if (confirmDelete) {
      askedToConfirm.current = true;
      keepButton.current?.focus();
    } else if (askedToConfirm.current) {
      deleteButton.current?.focus();
    }
  }, [confirmDelete]);

  // Closing the edit form, by Save or Cancel, puts focus back on the button that opened it.
  useEffect(() => {
    if (!editing && wasEditing.current) changeButton.current?.focus();
    wasEditing.current = editing;
  }, [editing]);

  if (!allowed) {
    return (
      <div className={`mt-6 ${PANEL}`}>
        <h1 className="font-head text-4xl leading-heading text-primary md:text-5xl">
          {user ? 'Matter tracking is for students and staff' : 'Sign in to see this matter'}
        </h1>
        {!user && <Link to={signInPath(here)} className={`${BUTTON_PRIMARY} mt-3`}>Sign in</Link>}
      </div>
    );
  }
  // Only the first load replaces the page. A refetch keeps what is on screen so the button that was
  // pressed is not torn down and focus is not lost.
  if (loading && !m) return <p className="text-muted-foreground">Loading…</p>;
  if (error) return <><h1 className="sr-only">Your matter</h1><ErrorNotice error={error} /></>;

  const owner = m.viewer === 'owner';
  const shared = Boolean(m.shared_with);
  const open = m.status === 'open';

  async function setStatus(status) {
    setActionError(null);
    try {
      await apiPut(`/matters/${m.id}`, { status });
      setNotice(status === 'closed' ? 'Marked as finished.' : 'Matter reopened.');
      refetch();
    } catch (err) {
      setActionError(err);
    }
  }

  async function erase() {
    if (erasing) return;
    setActionError(null);
    setErasing(true);
    try {
      await apiDelete(`/matters/${m.id}`);
      navigate('/matters');
    } catch (err) {
      setActionError(err);
      setErasing(false);
    }
  }

  return (
    <article>
      <Breadcrumb
        trail={[{ label: 'Home', to: '/' }, owner ? { label: 'My Matters', to: '/matters' } : { label: 'Shared matters', to: '/expert/matters' }]}
        current={m.title}
      />
      <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {owner ? (open ? 'Open matter' : 'Finished matter') : 'Shared matter'}
      </p>
      <h1 className="mt-1 font-head text-4xl leading-heading text-primary md:text-5xl">{m.title}</h1>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <StatusPill status={m.status} />
        {owner && <PrivacyTag shared={shared} />}
      </div>
      {/* Always on the page so a message is read out when it appears. */}
      <p role="status" className="mt-2 text-sm font-medium">{notice}</p>
      <p className="mt-3 max-w-reading text-muted-foreground">
        {owner
          ? (shared ? `Shared with ${m.shared_with_name}. They can read this record and add notes.` : 'Only you can access this private record.')
          : 'Shared with you by its owner. You can read this record and add notes.'}
      </p>
      {m.route_id && (
        <p className="mt-1 text-sm">
          <Link to={`/where-to-go/${m.route_id}`} className={`inline-flex min-h-touch items-center font-semibold text-info underline underline-offset-2 ${RING_ON_CANVAS}`}>
            Where this goes first, and the steps
          </Link>
        </p>
      )}

      <div className={`mt-6 grid gap-8 ${owner ? 'xl:grid-cols-[minmax(0,1fr)_21rem]' : ''}`}>
        <div className="min-w-0">
          <section className="rounded-card bg-chrome p-6 text-chrome-foreground" aria-labelledby="next-heading">
            <h2 id="next-heading" className="text-xs font-semibold uppercase tracking-wide text-on-chrome">What comes next</h2>
            <p className="mt-3 font-head text-3xl leading-heading">
              {m.next_action || <span className="text-on-chrome">Nothing recorded.</span>}
            </p>
            <p className="mt-3 text-on-chrome">
              {m.next_due ? `Deadline: ${readableDay(m.next_due)} (${dueInWords(m.next_due)})` : 'No deadline recorded'}
            </p>
            {owner && !editing && open && (
              <button ref={changeButton} type="button" className={`${BUTTON_ON_CHROME} mt-4 w-full sm:w-auto`} onClick={() => setEditing(true)}>
                Change next step or deadline
              </button>
            )}
          </section>
          {owner && editing && <EditNext matter={m} onDone={() => { setEditing(false); setNotice('Next step saved.'); refetch(); }} onCancel={() => setEditing(false)} />}

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <section aria-labelledby="record-heading">
              <h2 id="record-heading" className={H2}>What has happened</h2>
              {m.events.length === 0 && <p className="mt-2 text-muted-foreground">Nothing recorded yet.</p>}
              <ol className="mt-3 space-y-3">
                {m.events.map((e) => (
                  <li key={e.id} className="border-l-4 border-border pl-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {readableDay(e.occurred_on)} ·{' '}
                      {e.author_is_owner ? (owner ? 'You' : 'The person who shared this') : `Note from ${e.author_name ?? 'a legal expert'}`}
                    </p>
                    <p className="mt-1">{e.description}</p>
                  </li>
                ))}
              </ol>
            </section>
            {open && <LogStep matterId={m.id} onDone={() => { setNotice('Added to the record.'); refetch(); }} />}
          </div>

          {owner && (
            <Callout title="Reminders are a courtesy, not a guarantee" className="mt-8">
              Where a known deadline exists, reminders are sent 7 days and 1 day before. Emails say
              only the date, never what the matter is. No reminders are scheduled without a known
              deadline. Meeting the deadline stays your responsibility.
            </Callout>
          )}

          {owner && m.reminders.length > 0 && (
            <section className="mt-6" aria-labelledby="reminders-heading">
              <h2 id="reminders-heading" className={H2}>Reminders</h2>
              <ul className="mt-2 space-y-1 text-sm">
                {m.reminders.map((r) => (
                  <li key={r.id}>{readableDay(r.send_on)}: {REMINDER_WORDS[r.status] ?? r.status}</li>
                ))}
              </ul>
              <p className="mt-1 text-xs text-muted-foreground">
                Reminders go to your email and say only the date, never what the matter is.
              </p>
            </section>
          )}

          {/* The documents. The owner attaches them and the expert it is shared with checks them. */}
          <MatterDocuments matter={m} viewer={m.viewer} />
        </div>

        {owner && (
          <aside className="min-w-0 space-y-6" aria-label="Sharing and settings for this matter">
            {!shared && <ShareCard matter={m} onDone={() => { setNotice('Matter shared.'); refetch(); }} />}
            <AccessCard matter={m} onDone={() => { setNotice('Expert access revoked.'); refetch(); }} />

            <section className={PANEL}>
              <h2 id="finish-heading" className={H2}>Finish this matter</h2>
              {open ? (
                <>
                  <p className="mt-3 text-sm">
                    Mark the matter as finished. This keeps the record available for later reference
                    without changing its private status.
                  </p>
                  <button type="button" className={`${BUTTON_OUTLINE} mt-3`} onClick={() => setStatus('closed')}>Mark as finished</button>
                </>
              ) : (
                <>
                  <p className="mt-3 text-sm">This matter is finished. Reopen it to add to the record or change the next step.</p>
                  <button type="button" className={`${BUTTON_OUTLINE} mt-3`} onClick={() => setStatus('open')}>Reopen</button>
                </>
              )}
            </section>

            <section className={PANEL}>
              <h2 id="delete-heading" className={H2}>Delete this matter?</h2>
              <p className="mt-3 text-sm">Permanently removes the record. This is separate from finishing the matter.</p>
              <button
                ref={deleteButton}
                type="button"
                className={`${BUTTON_DANGER_SOLID} mt-3`}
                aria-expanded={confirmDelete}
                aria-controls="confirm-delete"
                onClick={() => setConfirmDelete(true)}
              >
                Delete matter…
              </button>
            </section>
          </aside>
        )}
      </div>

      {owner && confirmDelete && (
        <section id="confirm-delete" className={`mt-8 ${PANEL}`} role="group" aria-labelledby="confirm-heading">
          <h2 id="confirm-heading" className={H2}>Confirm deletion</h2>
          <p className="mt-3">
            Delete “{m.title}”? This permanently removes the matter and its record. Expert access ends.
            This cannot be undone.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button ref={keepButton} type="button" className={BUTTON_OUTLINE} onClick={() => setConfirmDelete(false)}>Keep matter</button>
            <button type="button" className={BUTTON_DANGER_SOLID} aria-disabled={erasing || undefined} onClick={erase}>Permanently delete matter</button>
          </div>
        </section>
      )}
      {actionError && <ErrorNotice error={actionError} className="mt-3" />}

      <Disclaimer className="mt-6" />
    </article>
  );
}
