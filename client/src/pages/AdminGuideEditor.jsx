import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiPost, apiPut } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import ErrorNotice from '@/components/ErrorNotice';
import StatusPill from '@/components/StatusPill';
import SubmitForReview from '@/components/SubmitForReview';
import Field, { CheckField } from '@/components/Field';
import { DOMAINS } from '@/lib/directory';
import { PANEL, RING_ON_CANVAS, BUTTON_PRIMARY } from '@/lib/ui';

const TEXT_SECTIONS = [
  ['situation', 'Your situation'],
  ['law_says', 'What the law says (with article numbers)'],
  ['your_rights', 'Your rights'],
  ['steps', 'Steps to take'],
  ['get_help', 'Where to get help'],
];

const BLANK = { domain: 'tenancy', title: '', situation: '', 
  law_says: '', your_rights: '', steps: '', get_help: '', source_law: '', source_url: '' };

// The form starts from the saved guide. A blank box in an edit means "empty this". So the
// form must show what is saved before anyone types.
function GuideForm({ guide, onSaved }) {
  const navigate = useNavigate();
  const [values, setValues] = useState(() => (guide ? { ...BLANK, ...guide, source_url: guide.source_url ?? '' } : BLANK));
  const [understood, setUnderstood] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const published = guide?.status === 'published';

  const set = (key) => (event) => setValues((v) => ({ ...v, [key]: event.target.value }));

  async function save(event) {
    event.preventDefault();
    // The integrity rule. Saving a published guide takes it off the site. So no request is made
    // until the admin has said they understand. A warning shown every time would be clicked
    // through, so it appears only for a published guide.
    if (published && !understood) {
      setError({ message: 'Tick the box to say you understand this guide leaves the site until an expert checks it again.' });
      return;
    }
    setBusy(true);
    setError(null);
    setSaved(false);
    const body = Object.fromEntries(Object.keys(BLANK).map((key) => [key, values[key]]));
    body.source_url = values.source_url.trim() || null;
    try {
      if (guide) {
        await apiPut(`/guides/${guide.id}`, body);
        setSaved(true);
        setUnderstood(false);
        onSaved();
      } else {
        const created = await apiPost('/guides', body);
        navigate(`/admin/guides/${created.id}`);
      }
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className={`mt-4 ${PANEL}`}>
      <Field id="guide-domain" label="Area of law" as="select" value={values.domain} onChange={set('domain')}>
        {DOMAINS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
      </Field>
      <Field id="guide-title" label="Title" className="mt-4" value={values.title} onChange={set('title')} />
      {TEXT_SECTIONS.map(([key, label]) => (
        <Field key={key} id={`guide-${key}`} label={label} as="textarea" rows={5} className="mt-4" value={values[key]} onChange={set(key)} />
      ))}
      <Field
        id="guide-source-law"
        label="The law it is based on"
        hint="For example: Law No. 66/2018 of 30/08/2018."
        className="mt-4"
        value={values.source_law}
        onChange={set('source_law')}
      />
      <Field
        id="guide-source-url"
        label="Link to the full text (optional)"
        hint="It must start with https://."
        className="mt-4"
        value={values.source_url}
        onChange={set('source_url')}
      />

      {published && (
        <div className="mt-4 rounded border border-warning-border bg-warning-subtle p-3">
          <p className="text-sm font-semibold text-warning-strong">
            This guide is published. Saving any change takes it off the site until a legal expert
            has checked it again.
          </p>
          <CheckField id="guide-understood" label="I understand" checked={understood} onChange={setUnderstood} />
        </div>
      )}

      {error && <ErrorNotice error={error} className="mt-4" />}
      <div role="status">
        {saved && <p className="mt-4 text-sm">Saved. The guide is now a draft. Send it for review when it is ready.</p>}
      </div>
      <button type="submit" disabled={busy} aria-busy={busy} className={`${BUTTON_PRIMARY} mt-4`}>
        {busy ? 'Saving…' : guide ? 'Save changes' : 'Save the guide'}
      </button>
    </form>
  );
}

// Write a new guide or change one. An existing guide is read from the staff list because the
// public route answers 404 for anything that is not published.
export default function AdminGuideEditor() {
  const { id } = useParams();
  const { data: guides, error, loading, refetch } = useApi(id ? '/guides/all' : null);
  const guide = id ? guides?.find((g) => String(g.id) === id) : null;

  return (
    <div>
      <p className="text-sm">
        <Link to="/admin/guides" className={`inline-flex min-h-touch items-center font-semibold text-primary underline ${RING_ON_CANVAS}`}>
          ← All guides
        </Link>
      </p>
      <h1 className="font-head text-2xl text-primary">{id ? 'Edit guide' : 'Write a new guide'}</h1>

      {id && loading && <p className="mt-4 text-muted-foreground">Loading…</p>}
      {error && <ErrorNotice error={error} className="mt-4" />}
      {id && guides && !guide && <p className={`mt-4 ${PANEL}`}>That guide does not exist.</p>}

      {guide && (
        <>
          <p className="mt-2 flex items-center gap-2 text-sm">Status: <StatusPill status={guide.status} /></p>
          {guide.status === 'draft' && guide.review_comment && (
            <p className="mt-2 text-sm font-semibold text-warning-strong">Returned by an expert: {guide.review_comment}</p>
          )}
          {guide.status === 'pending_review' && (
            <p className="mt-2 text-sm text-muted-foreground">Waiting for a legal expert. You can still change it.</p>
          )}
          {guide.status === 'draft' && <SubmitForReview path={`/guides/${guide.id}`} onDone={refetch} className="mt-4" />}
        </>
      )}

      {(!id || guide) && <GuideForm key={guide?.updated_at ?? 'new'} guide={guide} onSaved={refetch} />}
    </div>
  );
}
