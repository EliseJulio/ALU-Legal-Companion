import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiDelete, apiPost, apiPut } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { useAuth } from '@/lib/AuthContext';
import { hasRole } from '@/lib/auth';
import ErrorNotice from '@/components/ErrorNotice';
import StatusPill from '@/components/StatusPill';
import Disclaimer from '@/components/Disclaimer';
import { dueInWords, readableDay, todayIso } from '@/lib/dates';
import { RING_ON_CANVAS, FIELD, DATE_FIELD, BUTTON_PRIMARY, BUTTON_OUTLINE } from '@/lib/ui';

const PANEL = 'rounded border border-border bg-surface p-4';
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
    <form onSubmit={save} className={`mt-3 ${PANEL}`}>
      <label htmlFor="step-text" className="block text-sm font-medium">What happened</label>
      <textarea id="step-text" rows={2} value={text} onChange={(e) => setText(e.target.value)} className={FIELD} />
      <label htmlFor="step-date" className="mt-3 block text-sm font-medium">When</label>
      <input id="step-date" type="date" max={todayIso()} value={date} onChange={(e) => setDate(e.target.value)} className={DATE_FIELD} />
      {error && <ErrorNotice error={error} className="mt-2" />}
      <button type="submit" disabled={busy || !text.trim()} aria-busy={busy} className={`${BUTTON_PRIMARY} mt-3`}>
        Add to the record
      </button>
    </form>
  );
}

// Share the matter with one lawyer or office. Or stop sharing. The owner only.
function ShareBox({ matter, onDone }) {
  const { data: targets } = useApi('/matters/share-targets');
  const [choice, setChoice] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function act(request) {
    setBusy(true);
    setError(null);
    try {
      await request();
      onDone();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={`mt-6 ${PANEL}`} aria-labelledby="share-heading">
      <h2 id="share-heading" className="font-head text-lg font-semibold text-primary">Share with a legal expert</h2>
      {matter.shared_with ? (
        <>
          <p className="mt-1 text-sm">
            Shared with <span className="font-semibold">{matter.shared_with_name}</span>. They can read this record and add
            notes. They cannot see your name or email, change anything or see your reminders.
          </p>
          <button type="button" disabled={busy} className={`${BUTTON_OUTLINE} mt-3`} onClick={() => act(() => apiDelete(`/matters/${matter.id}/share`))}>
            Stop sharing
          </button>
        </>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted-foreground">
            A lawyer or office on the platform can read this record and add advice. You can stop
            sharing at any time and their access ends straight away.
          </p>
          {targets?.length === 0 && <p className="mt-2 text-sm">No lawyer on the platform is taking shared matters yet.</p>}
          {targets?.length > 0 && (
            <div className="mt-3">
              <label htmlFor="share-target" className="block text-sm font-medium">Share with</label>
              <select id="share-target" value={choice} onChange={(e) => setChoice(e.target.value)} className={FIELD}>
                <option value="">Choose…</option>
                {targets.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <button
                type="button"
                disabled={busy || !choice}
                className={`${BUTTON_PRIMARY} mt-3`}
                onClick={() => act(() => apiPost(`/matters/${matter.id}/share`, { provider_id: Number(choice) }))}
              >
                Share this matter
              </button>
            </div>
          )}
        </>
      )}
      {error && <ErrorNotice error={error} className="mt-3" />}
    </section>
  );
}

// Change the next step or the deadline. A new deadline replaces the reminders.
function EditNext({ matter, onDone }) {
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
    <form onSubmit={save} className="mt-3">
      <label htmlFor="edit-next" className="block text-sm font-medium">Next step</label>
      <input id="edit-next" type="text" value={nextAction} onChange={(e) => setNextAction(e.target.value)} className={FIELD} />
      <label htmlFor="edit-due" className="mt-3 block text-sm font-medium">Deadline</label>
      <input id="edit-due" type="date" value={nextDue} onChange={(e) => setNextDue(e.target.value)} className={DATE_FIELD} />
      <p className="mt-1 text-xs text-muted-foreground">Changing the deadline replaces the reminders.</p>
      {error && <ErrorNotice error={error} className="mt-2" />}
      <button type="submit" disabled={busy} aria-busy={busy} className={`${BUTTON_PRIMARY} mt-3`}>Save</button>
    </form>
  );
}

// One matter. The same page serves the owner and a legal expert it is shared with. The server
// says which in `viewer`. The expert gets the record and a note box. They get no editing, no
// deleting, no reminders and no way to share it on.
export default function MatterDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const allowed = hasRole(user, ['student', 'staff', 'legal_expert']);
  const { data: m, error, loading, refetch } = useApi(allowed ? `/matters/${id}` : null);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [actionError, setActionError] = useState(null);

  if (!allowed) {
    return (
      <div className={`mt-6 ${PANEL}`}>
        <h1 className="font-head text-2xl text-primary">Sign in to see this matter</h1>
        <Link to="/login" className={`${BUTTON_PRIMARY} mt-3`}>Sign in</Link>
      </div>
    );
  }
  if (loading) return <p className="text-muted-foreground">Loading…</p>;
  if (error) return <ErrorNotice error={error} />;

  const owner = m.viewer === 'owner';

  async function setStatus(status) {
    setActionError(null);
    try {
      await apiPut(`/matters/${m.id}`, { status });
      refetch();
    } catch (err) {
      setActionError(err);
    }
  }

  async function erase() {
    setActionError(null);
    try {
      await apiDelete(`/matters/${m.id}`);
      navigate('/matters');
    } catch (err) {
      setActionError(err);
    }
  }

  return (
    <article>
      <p className="text-sm">
        <Link to={owner ? '/matters' : '/expert/matters'} className={`inline-flex min-h-touch items-center font-semibold text-primary underline ${RING_ON_CANVAS}`}>
          ← {owner ? 'My matters' : 'Shared matters'}
        </Link>
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-head text-2xl text-primary">{m.title}</h1>
        <StatusPill status={m.status} />
      </div>
      {m.route_id && (
        <p className="mt-1 text-sm">
          <Link to={`/where-to-go/${m.route_id}`} className={`inline-flex min-h-touch items-center font-semibold text-primary underline ${RING_ON_CANVAS}`}>
            Where this goes first, and the steps
          </Link>
        </p>
      )}

      <section className={`mt-6 ${PANEL}`} aria-labelledby="next-heading">
        <h2 id="next-heading" className="font-head text-lg font-semibold text-primary">What comes next</h2>
        <p className="mt-1">{m.next_action || <span className="text-muted-foreground">Nothing recorded.</span>}</p>
        {m.next_due && (
          <p className="mt-1 font-semibold">Deadline: {readableDay(m.next_due)} ({dueInWords(m.next_due)})</p>
        )}
        {owner && !editing && m.status === 'open' && (
          <button type="button" className={`${BUTTON_OUTLINE} mt-3`} onClick={() => setEditing(true)}>
            Change next step or deadline
          </button>
        )}
        {owner && editing && <EditNext matter={m} onDone={() => { setEditing(false); refetch(); }} />}
      </section>

      {owner && m.reminders.length > 0 && (
        <section className="mt-6" aria-labelledby="reminders-heading">
          <h2 id="reminders-heading" className="font-head text-lg font-semibold text-primary">Reminders</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {m.reminders.map((r) => (
              <li key={r.id}>{readableDay(r.send_on)}: {REMINDER_WORDS[r.status] ?? r.status}</li>
            ))}
          </ul>
          <p className="mt-1 text-xs text-muted-foreground">
            Reminders go to your email and say only the date, never what the matter is. They are a
            courtesy. The deadline stays yours.
          </p>
        </section>
      )}

      <section className="mt-6" aria-labelledby="record-heading">
        <h2 id="record-heading" className="font-head text-lg font-semibold text-primary">What has been done</h2>
        {m.events.length === 0 && <p className="mt-1 text-muted-foreground">Nothing recorded yet.</p>}
        <ol className="mt-2 space-y-2">
          {m.events.map((e) => (
            <li key={e.id} className={PANEL}>
              <p className="text-xs text-muted-foreground">
                {readableDay(e.occurred_on)} ·{' '}
                {e.author_is_owner ? (owner ? 'You' : 'The person who shared this') : `Note from ${e.author_name ?? 'a legal expert'}`}
              </p>
              <p className="mt-1 text-sm">{e.description}</p>
            </li>
          ))}
        </ol>
        {m.status === 'open' && <LogStep matterId={m.id} onDone={refetch} />}
      </section>

      {owner && <ShareBox matter={m} onDone={refetch} />}

      {owner && (
        <section className="mt-6 flex flex-wrap gap-3">
          {m.status === 'open'
            ? <button type="button" className={BUTTON_OUTLINE} onClick={() => setStatus('closed')}>Mark as finished</button>
            : <button type="button" className={BUTTON_OUTLINE} onClick={() => setStatus('open')}>Reopen</button>}
          {!confirmDelete && (
            <button type="button" className={BUTTON_OUTLINE} onClick={() => setConfirmDelete(true)}>Delete this matter</button>
          )}
          {confirmDelete && (
            <div className={PANEL} role="group" aria-labelledby="delete-heading">
              <p id="delete-heading" className="text-sm font-semibold">
                Delete it for good? Its history and reminders go too. This cannot be undone.
              </p>
              <div className="mt-2 flex gap-3">
                <button type="button" className={BUTTON_PRIMARY} onClick={erase}>Yes, delete it</button>
                <button type="button" className={BUTTON_OUTLINE} onClick={() => setConfirmDelete(false)}>Keep it</button>
              </div>
            </div>
          )}
        </section>
      )}
      {actionError && <ErrorNotice error={actionError} className="mt-3" />}

      <Disclaimer className="mt-6" />
    </article>
  );
}
