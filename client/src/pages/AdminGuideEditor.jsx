import { useState } from 'react';
import Breadcrumb from '@/components/Breadcrumb';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiPost, apiPut } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import RowEditor from '@/components/RowEditor';
import { toFormService, toApiService, newRow } from '@/lib/serviceForm';
import Callout from '@/components/Callout';
import ErrorNotice from '@/components/ErrorNotice';
import StatusPill from '@/components/StatusPill';
import SubmitForReview from '@/components/SubmitForReview';
import Field, { CheckField } from '@/components/Field';
import { DOMAINS } from '@/lib/directory';
import { PANEL, RING_ON_CANVAS, BUTTON_PRIMARY, BUTTON_DANGER_SOLID, FIELD } from '@/lib/ui';

const TEXT_SECTIONS = [
  ['situation', 'Your situation'],
  ['law_says', 'What the law says (with article numbers)'],
  ['your_rights', 'Your rights'],
  ['steps', 'Steps to take'],
  ['get_help', 'Where to get help'],
];

const BLANK = { domain: 'tenancy', title: '', situation: '', 
  law_says: '', your_rights: '', steps: '', get_help: '', source_law: '', source_url: '', summary: '' };

// The labels for the "How to do it" rows. The keys are the ones the server uses. The words are for
// the person typing. The unit is in the label because a bare "Amount" gets typed as "20 000".
const label = (key, text, extra = {}) => ({ key, label: text, ...extra });
const FEE_FIELDS = [
  label('item', 'What the fee is for'),
  label('amount_rwf', 'Amount in FRW, digits only (empty if not published)'),
  label('note', 'Note'),
  label('source_url', 'Source link (https://)'),
];
const DOCUMENT_FIELDS = [
  label('name', 'Document'),
  label('notes', 'Notes (format, validity)'),
  label('where_to_get', 'Where to get it'),
  label('required_if', 'Only needed if…'),
  label('source_url', 'Source link (https://)'),
];
const OFFICE_FIELDS = [
  label('name', 'Office'),
  label('address', 'Street address'),
  label('district', 'District'),
  label('hours', 'Opening hours'),
  label('phone', 'Phone'),
  label('map_url', 'Map link (https://)'),
  label('source_url', 'Source link (https://)'),
];
const STEP_FIELDS = [
  label('instruction', 'What the reader does', { wide: true }),
  label('url_at_step', 'Page address at this step (https://)'),
];

// The form starts from the saved guide. A blank box in an edit means "empty this". So the
// form must show what is saved before anyone types.
function GuideForm({ guide, onSaved }) {
  const navigate = useNavigate();
  // A field the server holds as null is an empty box here. A null in a text box is a warning.
  const [values, setValues] = useState(() => (guide
    ? Object.fromEntries(Object.keys(BLANK).map((key) => [key, guide[key] ?? BLANK[key]]))
    : BLANK));
  const [understood, setUnderstood] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const published = guide?.status === 'published';
  // The "how to do it" part. It starts from what is saved, for the same reason as the rest.
  const [service, setService] = useState(() => toFormService(guide?.service));
  const setSvc = (field) => (event) => setService((s) => ({ ...s, [field]: event.target.value }));
  const setRows = (list) => (rows) => setService((s) => ({ ...s, [list]: rows }));

  const set = (key) => (event) => setValues((v) => ({ ...v, [key]: event.target.value }));

  async function save(event) {
    event.preventDefault();
    // The integrity rule. Saving a published guide takes it off the site. So no request is made
    // until the admin has said they understand. A warning shown every time would be clicked
    // through, so it appears only for a published guide.
    if (published && !understood) {
      setError({ message: 'Tick the box to say you understand this guide leaves the site until it is published again.' });
      return;
    }
    setBusy(true);
    setError(null);
    setSaved(false);
    const body = Object.fromEntries(Object.keys(BLANK).map((key) => [key, values[key]]));
    body.source_url = values.source_url.trim() || null;
    body.summary = values.summary.trim() || null;
    // Always sent. It is null when the form is empty. The server keeps the old block when the key
    // is left out. So an admin who emptied the form would otherwise change nothing.
    body.service = toApiService(service);
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
      <Field
        id="guide-summary"
        label="Summary"
        hint="One or two plain sentences that say what the guide is for. Shown on the guide card."
        as="textarea"
        rows={2}
        maxLength={280}
        aria-describedby="guide-summary-hint guide-summary-count"
        className="mt-4"
        value={values.summary}
        onChange={set('summary')}
      />
      <p id="guide-summary-count" className="mt-1 text-xs text-muted-foreground">{values.summary.length} of 280</p>
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

      <section aria-labelledby="svc-heading" className="mt-8 border-t border-border pt-6">
        <h2 id="svc-heading" className="font-head text-2xl leading-heading text-primary">How to do it (optional)</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          The practical facts a reader needs to finish the task. The exact service page, the
          documents, the fees, the days and where to go. Changing any of it takes a published
          guide back to draft. Leave out what you cannot confirm from an official source and list
          it under &ldquo;Not confirmed&rdquo;. Never guess a fee, a number of days or an address.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field id="svc-portal_name" label="Portal name" value={service.portal_name} onChange={setSvc('portal_name')} />
          <Field id="svc-checked_at" label="Facts last checked on" hint="As YYYY-MM-DD." value={service.checked_at} onChange={setSvc('checked_at')} />
          <Field id="svc-portal_url" label="Link to the exact service page" value={service.portal_url} onChange={setSvc('portal_url')} />
          <Field id="svc-portal_help_url" label="Link to the official help article" value={service.portal_help_url} onChange={setSvc('portal_help_url')} />
          <Field id="svc-who_can_apply" label="Who can apply" as="textarea" rows={2} className="sm:col-span-2" value={service.who_can_apply} onChange={setSvc('who_can_apply')} />
          <Field id="svc-processing_text" label="How long it takes, in words" className="sm:col-span-2" value={service.processing_text} onChange={setSvc('processing_text')} />
          <Field id="svc-days_min" label="Fewest days (digits)" inputMode="numeric" value={service.days_min} onChange={setSvc('days_min')} />
          <Field id="svc-days_max" label="Most days (digits)" inputMode="numeric" value={service.days_max} onChange={setSvc('days_max')} />
        </div>

        <RowEditor idBase="svc-fee" legend="Fees" itemName="Fee" rows={service.fees} columns={FEE_FIELDS}
          blank={newRow.fees} onChange={setRows('fees')} addLabel="Add a fee" />
        <RowEditor idBase="svc-doc" legend="Documents the reader must bring" itemName="Document" rows={service.documents}
          columns={DOCUMENT_FIELDS} blank={newRow.documents} onChange={setRows('documents')} addLabel="Add a document" />
        <RowEditor idBase="svc-office" legend="Offices" itemName="Office" rows={service.offices} columns={OFFICE_FIELDS}
          blank={newRow.offices} onChange={setRows('offices')} addLabel="Add an office" />
        <RowEditor idBase="svc-step" legend="Step by step manual" hint="One row for each screen, with the official page it happens on."
          itemName="Step" rows={service.walkthrough} columns={STEP_FIELDS} blank={newRow.walkthrough}
          onChange={setRows('walkthrough')} addLabel="Add a step" />

        <Field
          id="svc-unconfirmed"
          label="Not confirmed"
          hint="One for each line. Shown to readers as “Ask the office to confirm”."
          as="textarea"
          rows={3}
          className="mt-6"
          value={service.unconfirmed}
          onChange={setSvc('unconfirmed')}
        />
      </section>

      {published && (
        <div className="mt-4 rounded border border-warning-border bg-warning-subtle p-3">
          <p className="text-sm font-semibold text-warning-strong">
            This guide is published. Saving any change takes it off the site until it is published again.
          </p>
          <CheckField id="guide-understood" label="I understand" checked={understood} onChange={setUnderstood} />
        </div>
      )}

      {error && <ErrorNotice error={error} className="mt-4" />}
      <div role="status">
        {saved && <p className="mt-4 text-sm">Saved. The guide is now a draft. Publish it when it is ready.</p>}
      </div>
      <button type="submit" aria-disabled={busy || undefined} aria-busy={busy} className={`${BUTTON_PRIMARY} mt-4`}>
        {busy ? 'Saving…' : guide ? 'Save changes' : 'Save the guide'}
      </button>
    </form>
  );
}

// Pulls a published guide off the site. Unlike an edit, it does not come back on its own — it
// stays withdrawn until someone edits and publishes it fresh. A reason is required.
function WithdrawAction({ guideId, onDone }) {
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit(event) {
    event.preventDefault();
    const trimmed = comment.trim();
    if (!trimmed) {
      setError({ message: 'Say why this guide is being withdrawn.' });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiPost(`/guides/${guideId}/withdraw`, { comment: trimmed });
      onDone();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 rounded border border-warning-border bg-warning-subtle p-4" noValidate>
      <p className="text-sm font-semibold text-warning-strong">Withdraw this guide</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Takes it off the site at once. It does not come back on its own — it stays withdrawn until
        someone edits it and publishes it fresh.
      </p>
      <label htmlFor="withdraw-comment" className="mt-3 block text-sm font-medium">Reason</label>
      <textarea
        id="withdraw-comment"
        rows={2}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        aria-required="true"
        className={`${FIELD} mt-1`}
      />
      {error && <ErrorNotice error={error} className="mt-2" />}
      <button type="submit" aria-disabled={busy || undefined} aria-busy={busy} className={`${BUTTON_DANGER_SOLID} mt-3`}>
        {busy ? 'Withdrawing…' : 'Withdraw'}
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
      <Breadcrumb trail={[{ label: 'Admin workspace' }]} current={id ? 'Edit guide' : 'Write a new guide'} />
      <h1 className="mt-6 font-head text-4xl leading-heading text-primary md:text-5xl">{id ? 'Edit guide' : 'Write a new guide'}</h1>

      {id && loading && <p className="mt-4 text-muted-foreground">Loading…</p>}
      {error && <ErrorNotice error={error} className="mt-4" />}
      {id && guides && !guide && <p className={`mt-4 ${PANEL}`}>That guide does not exist.</p>}

      {guide && (
        <>
          <p className="mt-2 flex items-center gap-2 text-sm">Status: <StatusPill status={guide.status} /></p>
          {guide.status === 'withdrawn' && (
            <p className="mt-2 text-sm text-muted-foreground">Withdrawn. Edit it and publish again to bring it back.</p>
          )}
          {guide.status === 'draft' && <SubmitForReview path={`/guides/${guide.id}`} onDone={refetch} className="mt-4" />}
          {guide.status === 'published' && <WithdrawAction guideId={guide.id} onDone={refetch} />}
        </>
      )}

      {/* Keyed by the guide, not by its save time. A save reloads the guide and the form must stay
          mounted or the "Saved" line it just showed would vanish. */}
      {(!id || guide) && (
        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start">
          <GuideForm key={guide?.id ?? 'new'} guide={guide} onSaved={refetch} />
          <aside aria-label="About publication" className="min-w-0 space-y-4">
            <section className={PANEL} aria-labelledby="boundary-heading">
              <h2 id="boundary-heading" className="font-head text-2xl leading-heading text-primary">Publishing</h2>
              <p className="mt-3 text-sm">
                Publishing takes the whole text live at once. Check the official sources before
                publishing — there is no separate reviewer.
              </p>
            </section>
            <Callout title="Source required">A placeholder reference must never be displayed as published.</Callout>
          </aside>
        </div>
      )}
    </div>
  );
}
