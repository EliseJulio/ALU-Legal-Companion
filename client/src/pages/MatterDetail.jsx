import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import { signInPath } from '@/lib/url';
import { apiDelete, apiPost, apiPostForm, apiPut } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { LIVE } from '@/lib/live';
import { useAuth } from '@/lib/AuthContext';
import { hasRole } from '@/lib/auth';
import Breadcrumb from '@/components/Breadcrumb';
import Callout from '@/components/Callout';
import ErrorNotice from '@/components/ErrorNotice';
import Icon from '@/components/Icon';
import StatusPill from '@/components/StatusPill';
import Disclaimer from '@/components/Disclaimer';
import MatterDocuments from '@/components/MatterDocuments';
import { ShareCard, AccessCard } from '@/components/ShareMatter';
import RecordAttachment, { RecordFileLink } from '@/components/RecordAttachment';
import { readableDay, todayIso } from '@/lib/dates';
import { useScrollToHash } from '@/lib/useScrollToHash';
import { matterDeadline } from '@/lib/overview';
import StatusWord from '@/components/overview/StatusWord';
import {
  RING_ON_CANVAS, FIELD, DATE_FIELD, pillClass, BUTTON_PRIMARY, BUTTON_OUTLINE, BUTTON_DANGER_SOLID, BUTTON_DESTRUCTIVE, CARD,
} from '@/lib/ui';

const H2 = 'font-head text-base font-semibold leading-[1.3] text-ink';
const REMINDER_WORDS = { pending: 'Scheduled', sent: 'Sent', missed: 'Not sent in time', cancelled: 'Cancelled' };

// Add a line to the record. The owner and a legal expert the matter is shared with can both do it.
function LogStep({ matterId, onDone, canAttach = false }) {
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [date, setDate] = useState(todayIso());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function save(event) {
    event.preventDefault();
    if (busy) return; // a second press must not make a second entry with a second file
    setBusy(true);
    setError(null);
    try {
      if (file) {
        // A file goes as a form. A note with no file stays plain JSON.
        const form = new FormData();
        form.append('description', text.trim());
        form.append('occurred_on', date);
        form.append('file', file);
        await apiPostForm(`/matters/${matterId}/events`, form);
      } else {
        await apiPost(`/matters/${matterId}/events`, { description: text.trim(), occurred_on: date });
      }
      setText('');
      setFile(null);
      onDone();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className={CARD}>
      <h2 id="add-heading" className={H2}>Add to your record</h2>
      <label htmlFor="step-text" className="mt-3 block text-sm font-medium">What happened</label>
      <p id="step-hint" className="mt-1 text-sm text-muted-foreground">Free text can identify you. Avoid unnecessary sensitive details.</p>
      <textarea id="step-text" rows={3} value={text} onChange={(e) => setText(e.target.value)} aria-describedby="step-hint" className={FIELD} />
      <label htmlFor="step-date" className="mt-3 block text-sm font-medium">When</label>
      <input id="step-date" type="date" max={todayIso()} value={date} onChange={(e) => setDate(e.target.value)} className={DATE_FIELD} />
      {canAttach && <RecordAttachment file={file} onChange={setFile} disabled={busy} />}
      {error && <ErrorNotice error={error} className="mt-2" />}
      <button type="submit" aria-disabled={(busy || !text.trim()) || undefined} aria-busy={busy} className={`${BUTTON_PRIMARY} mt-4`}>
        Add to the record
      </button>
    </form>
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
    <form onSubmit={save} className={`mt-4 ${CARD}`}>
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

// The figures across the top of an owner's matter. Each is a value and its words.
function Ticker({ m }) {
  const pending = m.reminders.filter((r) => r.status === 'pending').length;
  const figures = [
    { label: 'Deadline', value: m.next_due ? readableDay(m.next_due) : 'None', words: m.next_due ? matterDeadline(m.next_due, m.status)?.words : 'No deadline recorded' },
    { label: 'Reminders', value: String(pending), words: 'scheduled' },
    { label: 'Shared with', value: m.shared_with_name ?? 'No one', words: m.shared_with ? 'Expert access' : 'Only you' },
  ];
  return (
    <dl className={`grid grid-cols-2 gap-x-4 gap-y-4 ${CARD} md:grid-cols-3`}>
      {figures.map((f) => (
        <div key={f.label} className="min-w-0">
          <dt className="text-xs text-muted-foreground">{f.label}</dt>
          <dd className="mt-1 break-words font-head text-xl font-medium text-ink">{f.value}</dd>
          <dd className="text-sm text-muted-foreground">{f.words}</dd>
        </div>
      ))}
    </dl>
  );
}

// Private or shared, as a small tag with a lock. The word says it and the lock only decorates.
function PrivacyTag({ shared }) {
  return (
    <span className={`${pillClass('neutral')} gap-1`}>
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
  const { data: m, error, loading, refetch } = useApi(allowed ? `/matters/${id}` : null, LIVE);
  useScrollToHash(Boolean(m));
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

  // Closing the edit form by Save or Cancel puts focus back on the button that opened it.
  useEffect(() => {
    if (!editing && wasEditing.current) changeButton.current?.focus();
    wasEditing.current = editing;
  }, [editing]);

  if (!allowed) {
    return (
      <div className={`mt-6 ${CARD}`}>
        <h1 className="font-head text-[length:clamp(24px,2.7vw,30px)] leading-[1.15] tracking-[-0.01em] text-ink">
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
        trail={[{ label: 'Home', to: '/' }, owner ? { label: 'My matters', to: '/matters' } : { label: 'Shared matters', to: '/expert/matters' }]}
        current={m.title}
      />
      <p className="mt-6 text-sm font-semibold text-muted-foreground">
        {owner ? (open ? 'Open matter' : 'Finished matter') : 'Shared matter'}
      </p>
      <h1 className="mt-1 font-head text-[length:clamp(24px,2.7vw,30px)] leading-[1.15] tracking-[-0.01em] text-ink">{m.title}</h1>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <StatusPill status={m.status} />
        {matterDeadline(m.next_due, m.status)?.late && <StatusWord word="Late" tone="urgent" />}
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
          <Link to={`/where-to-go/${m.route_id}`} className={`inline-flex min-h-touch items-center font-semibold text-info hover:underline underline-offset-2 ${RING_ON_CANVAS}`}>
            Where this goes first, and the steps
          </Link>
        </p>
      )}

      {owner && <div className="mt-6"><Ticker m={m} /></div>}

      <div className={`mt-6 grid gap-8 ${owner ? 'xl:grid-cols-[minmax(0,1fr)_21rem]' : ''}`}>
        <div className="min-w-0">
          <section className={CARD} aria-labelledby="next-heading">
            <h2 id="next-heading" className="text-sm font-semibold text-muted-foreground">What comes next</h2>
            <p className="mt-3 font-head text-[24px] leading-[1.2]">
              {m.next_action || <span className="text-muted-foreground">Nothing recorded.</span>}
            </p>
            <p className="mt-3 text-ink">
              {m.next_due ? `Deadline: ${readableDay(m.next_due)} (${matterDeadline(m.next_due, m.status)?.words})` : 'No deadline recorded'}
            </p>
            {owner && !editing && open && (
              <button ref={changeButton} type="button" className={`${BUTTON_OUTLINE} mt-4 w-full sm:w-auto`} onClick={() => setEditing(true)}>
                Change next step or deadline
              </button>
            )}
          </section>
          {owner && editing && <EditNext matter={m} onDone={() => { setEditing(false); setNotice('Next step saved.'); refetch(); }} onCancel={() => setEditing(false)} />}

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <section aria-labelledby="record-heading">
              <h2 id="record-heading" className={H2}>What has happened</h2>
              {m.events.length === 0 && <p className="mt-2 text-muted-foreground">Nothing recorded yet.</p>}
              <ol className="mt-3 space-y-4">
                {m.events.map((e) => (
                  <li key={e.id} data-anchor={`event-${e.id}`} tabIndex={-1} className="rounded-control focus:outline-none">
                    <p className="text-sm font-semibold text-muted-foreground">
                      {readableDay(e.occurred_on)} ·{' '}
                      {e.author_is_owner ? (owner ? 'You' : 'The person who shared this') : `Note from ${e.author_name ?? 'a legal expert'}`}
                      <RecordFileLink matterId={m.id} event={e} />
                    </p>
                    <p className="mt-1">{e.description}</p>
                  </li>
                ))}
              </ol>
            </section>
            {open && <LogStep matterId={m.id} canAttach={owner} onDone={() => { setNotice('Added to the record.'); refetch(); }} />}
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

            <section className={CARD}>
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

            <section className={CARD}>
              <h2 id="delete-heading" className={H2}>Delete this matter?</h2>
              <p className="mt-3 text-sm">Permanently removes the record. This is separate from finishing the matter.</p>
              <button
                ref={deleteButton}
                type="button"
                className={`${BUTTON_DESTRUCTIVE} mt-3`}
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
        <section id="confirm-delete" className={`mt-8 ${CARD}`} role="group" aria-labelledby="confirm-heading" onKeyDown={(e) => { if (e.key === 'Escape') setConfirmDelete(false); }}>
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
