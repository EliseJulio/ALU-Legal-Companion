import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiPost, apiPut } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import ErrorNotice from '@/components/ErrorNotice';
import AdminEditorPage from '@/components/AdminEditorPage';
import Field, { CheckField } from '@/components/Field';
import { ADMIN_BUTTON_OUTLINE, ADMIN_BUTTON_PRIMARY } from '@/components/AdminRecords';

const LIST = '/admin/routes';
const BLANK = { position: '', title: '', tagline: '', description: '', law_cited: '' };

// One step of the dispute ladder. A published step is changed only after the admin says it will
// leave the site until it is published again. The request is not sent before that. A save returns
// to the Routes page, where the ladder is listed.
function StepForm({ step }) {
  const navigate = useNavigate();
  const [values, setValues] = useState(() => (step
    ? { position: String(step.position), title: step.title, tagline: step.tagline ?? '', description: step.description ?? '', law_cited: step.law_cited ?? '' }
    : BLANK));
  const [understood, setUnderstood] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const published = step?.status === 'published';

  const set = (key) => (event) => setValues((v) => ({ ...v, [key]: event.target.value }));

  async function save(event) {
    event.preventDefault();
    if (busy) return;
    if (published && !understood) {
      setError({ message: 'Tick the box to say you understand this step leaves the site until it is published again.' });
      return;
    }
    setBusy(true);
    setError(null);
    const body = { ...values, position: String(values.position).trim() === '' ? null : Number(values.position) };
    try {
      if (step) await apiPut(`/directory/ladder/${step.id}`, body);
      else await apiPost('/directory/ladder', body);
      navigate(LIST);
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} aria-label={step ? 'Edit step' : 'New step'}>
      <Field
        id="lad-position"
        label="Order"
        hint="A whole number from 1 to 99. Smaller numbers come first."
        type="number"
        min="1"
        max="99"
        value={values.position}
        onChange={set('position')}
      />
      <Field id="lad-title" label="Title" className="mt-4" value={values.title} onChange={set('title')} />
      <Field id="lad-tagline" label="Tagline" className="mt-4" value={values.tagline} onChange={set('tagline')} />
      <Field id="lad-description" label="Description" as="textarea" rows={4} className="mt-4" value={values.description} onChange={set('description')} />
      <Field id="lad-law" label="Law cited" hint="Leave empty if the step cites no law." className="mt-4" value={values.law_cited} onChange={set('law_cited')} />

      {published && (
        <div className="mt-4 border-t border-border pt-4">
          <p className="text-sm font-semibold text-warning-strong">
            This step is published. Saving any change takes it off the site until it is published again.
          </p>
          <CheckField id="lad-understood" label="I understand" checked={understood} onChange={setUnderstood} />
        </div>
      )}

      {error && <ErrorNotice error={error} className="mt-4" />}
      <div className="mt-5 flex flex-wrap gap-3">
        <button type="submit" aria-disabled={busy || undefined} aria-busy={busy} className={ADMIN_BUTTON_PRIMARY}>
          {busy ? 'Saving…' : 'Save step'}
        </button>
        <Link to={LIST} className={ADMIN_BUTTON_OUTLINE}>Cancel</Link>
      </div>
    </form>
  );
}

// Add a step of the dispute ladder or change one, on its own page like the routes. An existing step
// is read from the staff list because the public ladder shows only published steps.
export default function AdminLadderEditor() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const { data, error, loading } = useApi(isNew ? null : '/directory/ladder/all');
  const steps = Array.isArray(data) ? data : [];
  const step = isNew ? null : steps.find((s) => String(s.id) === id);
  const title = isNew ? 'New step' : 'Edit step';

  return (
    <AdminEditorPage
      title={title}
      status={step?.status}
      backTo={LIST}
      backLabel="All routes"
    >
      {!isNew && loading && <p className="text-muted-foreground">Loading…</p>}
      {error && <ErrorNotice error={error} />}
      {!isNew && data && !step && (
        <p>
          That step does not exist. <Link to={LIST} className="font-semibold text-primary-text underline">Back to all routes</Link>
        </p>
      )}

      {(isNew || step) && <StepForm key={step?.id ?? 'new'} step={step} />}
    </AdminEditorPage>
  );
}
