import { useState } from 'react';
import { apiPost, apiPut } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import ErrorNotice from '@/components/ErrorNotice';
import StatusPill from '@/components/StatusPill';
import SubmitForReview from '@/components/SubmitForReview';
import Field, { CheckField } from '@/components/Field';
import { readableDays } from '@/lib/directory';
import { PANEL, BUTTON_PRIMARY, BUTTON_OUTLINE } from '@/lib/ui';

const BLANK = {
  matter_type: '', title: '', keywords: '', first_forum_id: '', legal_basis: '', exclusions: '',
  steps: '', deadline_days: '', deadline_runs_from: '', deadline_note: '',
};

// A route is where a kind of matter must go first. Every field is a checked fact. So any edit,
// however small, sends the route back for review. The form is seeded from the saved route.
function RouteForm({ route, offices, onDone, onCancel }) {
  const [values, setValues] = useState(() => {
    if (!route) return BLANK;
    return {
      ...Object.fromEntries(Object.keys(BLANK).map((key) => [key, route[key] ?? ''])),
      steps: (route.steps ?? []).join('\n'),
    };
  });
  const [understood, setUnderstood] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const published = route?.status === 'published';

  const set = (key) => (event) => setValues((v) => ({ ...v, [key]: event.target.value }));

  async function save(event) {
    event.preventDefault();
    if (published && !understood) {
      setError({ message: 'Tick the box to say you understand this route leaves the site until an expert checks it again.' });
      return;
    }
    setBusy(true);
    setError(null);
    const body = {
      ...values,
      first_forum_id: values.first_forum_id === '' ? null : Number(values.first_forum_id),
      steps: values.steps.split('\n').map((line) => line.trim()).filter(Boolean),
      deadline_days: String(values.deadline_days).trim() === '' ? null : Number(values.deadline_days),
    };
    try {
      if (route) await apiPut(`/directory/routes/${route.id}`, body);
      else await apiPost('/directory/routes', body);
      onDone();
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className={`mt-4 ${PANEL}`} aria-label={route ? 'Edit route' : 'New route'}>
      <h2 className="font-head text-lg font-semibold text-primary">{route ? `Edit ${route.title}` : 'New route'}</h2>
      <Field
        id="r-type"
        label="Matter code"
        hint="Lowercase letters, digits and underscores. For example deposit_kept."
        className="mt-4"
        value={values.matter_type}
        onChange={set('matter_type')}
      />
      <Field id="r-title" label="The situation in the words a student would use" className="mt-4" value={values.title} onChange={set('title')} />
      <Field id="r-keywords" label="Other words people use" className="mt-4" value={values.keywords} onChange={set('keywords')} />
      <Field id="r-office" label="Goes first to" as="select" className="mt-4" value={values.first_forum_id} onChange={set('first_forum_id')}>
        <option value="">Choose an entry…</option>
        {offices?.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
      </Field>
      <Field id="r-basis" label="Why there (the law)" as="textarea" rows={3} className="mt-4" value={values.legal_basis} onChange={set('legal_basis')} />
      <Field id="r-exclusions" label="It does not apply if" as="textarea" rows={2} className="mt-4" value={values.exclusions} onChange={set('exclusions')} />
      <Field id="r-steps" label="What happens next" hint="One step on each line." as="textarea" rows={4} className="mt-4" value={values.steps} onChange={set('steps')} />
      <Field
        id="r-days"
        label="Days to act"
        hint="Leave empty if there is no deadline. A deadline needs both the days and what they run from."
        className="mt-4"
        type="number"
        min="1"
        value={values.deadline_days}
        onChange={set('deadline_days')}
      />
      <Field id="r-from" label="The days run from" className="mt-4" value={values.deadline_runs_from} onChange={set('deadline_runs_from')} />
      <Field id="r-note" label="A note about the deadline" className="mt-4" value={values.deadline_note} onChange={set('deadline_note')} />

      {published && (
        <div className="mt-4 rounded border border-warning-border bg-warning-subtle p-3">
          <p className="text-sm font-semibold text-warning-strong">
            This route is published. Saving any change takes it off the site until a legal expert
            has checked it again.
          </p>
          <CheckField id="r-understood" label="I understand" checked={understood} onChange={setUnderstood} />
        </div>
      )}

      {error && <ErrorNotice error={error} className="mt-4" />}
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="submit" disabled={busy} aria-busy={busy} className={BUTTON_PRIMARY}>{busy ? 'Saving…' : 'Save route'}</button>
        <button type="button" className={BUTTON_OUTLINE} onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

// The routes that say where each kind of matter goes first. Written by an admin and verified by a
// legal expert. A route shows to students only when it and its first office are both verified.
export default function AdminRoutes() {
  const { data: routes, error, loading, refetch } = useApi('/directory/routes/all');
  const { data: offices } = useApi('/directory/providers/all');
  const [editing, setEditing] = useState(null);

  function finished() {
    setEditing(null);
    refetch();
  }

  return (
    <div>
      <h1 className="font-head text-2xl text-primary">Manage routes</h1>
      <p className="mt-1 text-muted-foreground">
        Where each kind of matter must go first, with the law, the steps and the deadline. A legal
        expert verifies every route.
      </p>
      {editing === null && (
        <p className="mt-4"><button type="button" className={BUTTON_PRIMARY} onClick={() => setEditing('new')}>Add a route</button></p>
      )}

      {editing !== null && (
        <RouteForm
          key={editing === 'new' ? 'new' : editing.id}
          route={editing === 'new' ? null : editing}
          offices={offices}
          onDone={finished}
          onCancel={() => setEditing(null)}
        />
      )}

      {loading && <p className="mt-6 text-muted-foreground">Loading…</p>}
      {error && <ErrorNotice error={error} className="mt-6" />}

      <ul className="mt-6 space-y-3">
        {routes?.map((r) => (
          <li key={r.id} className={PANEL}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-head font-semibold text-primary">{r.title}</h2>
              <StatusPill status={r.status} />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              First office: {r.first_forum_name}
              {r.first_forum_status !== 'published' ? ' (not verified yet, so this route stays hidden)' : ''}
              {readableDays(r.deadline_days) ? ` · ${readableDays(r.deadline_days)} from ${r.deadline_runs_from}` : ''}
            </p>
            {r.status === 'draft' && r.review_comment && (
              <p className="mt-1 text-sm font-semibold text-warning-strong">Returned by an expert: {r.review_comment}</p>
            )}
            <div className="mt-3 flex flex-wrap gap-3">
              <button type="button" className={BUTTON_OUTLINE} onClick={() => setEditing(r)}>Edit</button>
              {r.status === 'draft' && <SubmitForReview path={`/directory/routes/${r.id}`} onDone={refetch} />}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
