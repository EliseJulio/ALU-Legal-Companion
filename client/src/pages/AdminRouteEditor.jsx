import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiPost, apiPut } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import ErrorNotice from '@/components/ErrorNotice';
import AdminEditorPage from '@/components/AdminEditorPage';
import Field, { CheckField } from '@/components/Field';
import { ADMIN_BUTTON_OUTLINE, ADMIN_BUTTON_PRIMARY, SelectField } from '@/components/AdminRecords';
import { DOMAINS } from '@/lib/directory';

const BLANK = {
  matter_type: '', title: '', keywords: '', first_forum_id: '', legal_basis: '', exclusions: '',
  steps: '', deadline_days: '', deadline_runs_from: '', deadline_note: '', area: '',
};

// A route is where a kind of matter must go first. Every field is a checked fact. So any edit,
// however small, sends the route back to draft. The form is seeded from the saved route.
function RouteForm({ route, offices }) {
  const navigate = useNavigate();
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
      setError({ message: 'Tick the box to say you understand this route leaves the site until it is published again.' });
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
      navigate('/admin/routes');
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} aria-label={route ? 'Edit route' : 'New route'}>
      <Field
        id="r-type"
        label="Matter code"
        hint="Lowercase letters, digits and underscores. For example deposit_kept."
        value={values.matter_type}
        onChange={set('matter_type')}
      />
      <Field id="r-title" label="The situation in the words a student would use" className="mt-4" value={values.title} onChange={set('title')} />
      <SelectField
        id="r-area"
        label="Area of law"
        hint="Offered as a topic in the guided questions on the Directory and Legal guides. Changing it sends the route back to draft."
        className="mt-4"
        value={values.area}
        onChange={set('area')}
      >
        <option value="">No area</option>
        {DOMAINS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
      </SelectField>
      <Field id="r-keywords" label="Other words people use" className="mt-4" value={values.keywords} onChange={set('keywords')} />
      <SelectField id="r-office" label="Goes first to" className="mt-4" value={values.first_forum_id} onChange={set('first_forum_id')}>
        <option value="">Choose an entry…</option>
        {offices?.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
      </SelectField>
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
        <div className="mt-4 border-t border-border pt-4">
          <p className="text-sm font-semibold text-warning-strong">
            This route is published. Saving any change takes it off the site until it is published again.
          </p>
          <CheckField id="r-understood" label="I understand" checked={understood} onChange={setUnderstood} />
        </div>
      )}

      {error && <ErrorNotice error={error} className="mt-4" />}
      <div className="mt-5 flex flex-wrap gap-3">
        <button type="submit" aria-disabled={busy || undefined} aria-busy={busy} className={ADMIN_BUTTON_PRIMARY}>{busy ? 'Saving…' : 'Save route'}</button>
        <Link to="/admin/routes" className={ADMIN_BUTTON_OUTLINE}>Cancel</Link>
      </div>
    </form>
  );
}

// Add a route or change one, on its own page like the checklists. An existing route is read from
// the staff list because the public route answers 404 for anything that is not published.
export default function AdminRouteEditor() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const { data: routes, error, loading } = useApi(isNew ? null : '/directory/routes/all');
  const { data: offices } = useApi('/directory/providers/all');
  const route = isNew ? null : routes?.find((r) => String(r.id) === id);
  const title = isNew ? 'New route' : 'Edit route';

  return (
    <AdminEditorPage title={title} status={route?.status} backTo="/admin/routes" backLabel="All routes">
      {!isNew && loading && <p className="text-muted-foreground">Loading…</p>}
      {error && <ErrorNotice error={error} />}
      {!isNew && routes && !route && (
        <p>
          That route does not exist. <Link to="/admin/routes" className="font-semibold text-primary-text underline">Back to all routes</Link>
        </p>
      )}

      {(isNew || route) && <RouteForm key={route?.id ?? 'new'} route={route} offices={offices} />}
    </AdminEditorPage>
  );
}
