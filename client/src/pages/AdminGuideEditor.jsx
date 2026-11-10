import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { apiPost, apiPut } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import RowEditor from '@/components/RowEditor';
import { toFormService, toApiService, newRow } from '@/lib/serviceForm';
import ErrorNotice from '@/components/ErrorNotice';
import AdminEditorPage from '@/components/AdminEditorPage';
import SubmitForReview from '@/components/SubmitForReview';
import Field from '@/components/Field';
import Wizard from '@/components/wizard/Wizard';
import { WizField } from '@/components/wizard/WizardField';
import { DOMAINS } from '@/lib/directory';
import { plainGuideError, plainGuideMessage } from '@/lib/guideErrors';
import { collect, digits, httpsLink, requiredText } from '@/lib/wizard';
import { ADMIN_BUTTON_OUTLINE } from '@/components/AdminRecords';

const LIST = '/admin/guides';

const BLANK = { domain: 'tenancy', title: '', situation: '',
  law_says: '', your_rights: '', steps: '', get_help: '', source_law: '', source_url: '', summary: '' };

// The five text parts of the template the server requires, with the message for each when empty.
const SECTION_TEXT = [
  ['situation', 'Your situation', 'Describe the situation in a few sentences.'],
  ['law_says', 'What the law says (with article numbers)', 'Say what the law says, with the article.'],
  ['your_rights', 'Your rights', 'Say what the reader is entitled to.'],
  ['steps', 'Steps to take', 'Write the steps, one on each line.'],
  ['get_help', 'Where to get help', 'Say where the reader can get help.'],
];

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

// The help card under the form. It says what publishing does, in the admin's own terms.
const GUIDE_HELP = {
  title: 'Before you publish',
  intro: 'Publishing takes the whole text live at once. Check the official sources first, as there is no separate reviewer.',
  items: [
    'Cite every article you rely on.',
    'Put a fee or an office in its own row.',
    'A placeholder reference must never be displayed as published.',
    'Use the words the official page uses for a service and its office.',
  ],
};

const domainLabel = (value) => DOMAINS.find((d) => d.value === value)?.label ?? value;
const names = (rows, key = 'name') => rows.map((r) => r[key]).filter((v) => String(v ?? '').trim()).join('\n');

// Every row error is named by the row's box id, so the wizard can show it beside the box.
function rowChecks(rows, idBase, pairs) {
  return rows.flatMap((row, i) => pairs.map(([key, check]) => [`${idBase}-${i}-${key}`, check(row[key])]));
}

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
  const published = guide?.status === 'published';
  // The "how to do it" part. It starts from what is saved, for the same reason as the rest.
  const [service, setService] = useState(() => toFormService(guide?.service));
  const setSvc = (field) => (event) => setService((s) => ({ ...s, [field]: event.target.value }));
  const setRows = (list) => (rows) => setService((s) => ({ ...s, [list]: rows }));

  const set = (key) => (event) => setValues((v) => ({ ...v, [key]: event.target.value }));

  // Saving never sends a request before the admin has ticked the box for a published guide.
  // The wizard holds that check. A draft has no gate because a draft is not on the site.
  // A save returns to the list. If the publish is refused the page stays so the message is read.
  // A new guide that was saved but not published goes to its own page.
  // It exists now and a second save from this form would create a copy.
  async function save(publishAfter) {
    if (busy) return;
    setBusy(true);
    setError(null);
    const body = Object.fromEntries(Object.keys(BLANK).map((key) => [key, values[key]]));
    body.source_url = values.source_url.trim() || null;
    body.summary = values.summary.trim() || null;
    // Always sent. It is null when the form is empty. The server keeps the old block when the key
    // is left out. So an admin who emptied the form would otherwise change nothing.
    body.service = toApiService(service);
    const refused = (err) => ({ message: `Saved as a draft. It is not published yet: ${plainGuideMessage(err?.message) || 'the server gave no reason'}` });
    try {
      if (guide) {
        const updated = await apiPut(`/guides/${guide.id}`, body);
        setUnderstood(false);
        if (publishAfter && updated?.status !== 'published') {
          try {
            await apiPost(`/guides/${guide.id}/publish`);
          } catch (err) {
            setError(refused(err));
            onSaved();
            return;
          }
        }
        navigate(LIST);
      } else {
        const created = await apiPost('/guides', body);
        if (publishAfter && created?.status !== 'published') {
          try {
            await apiPost(`/guides/${created.id}/publish`);
          } catch (err) {
            navigate(`/admin/guides/${created.id}`, { state: { notice: refused(err).message } });
            return;
          }
        }
        navigate(LIST);
      }
    } catch (err) {
      setError(plainGuideError(err));
    } finally {
      setBusy(false);
    }
  }

  const basicsErrors = () => collect([
    ['guide-title', requiredText(values.title, 'Give the guide a title.')],
  ]);
  const lawErrors = () => collect([
    ['guide-source-law', requiredText(values.source_law, 'Name the law the guide is based on.')],
    ['guide-source-url', httpsLink(values.source_url)],
  ]);
  const rightsErrors = () => collect(SECTION_TEXT.map(([key, , message]) => [`guide-${key}`, requiredText(values[key], message)]));
  const serviceErrors = () => collect([
    ['svc-portal_url', httpsLink(service.portal_url)],
    ['svc-portal_help_url', httpsLink(service.portal_help_url)],
    ['svc-days_min', digits(service.days_min)],
    ['svc-days_max', digits(service.days_max)],
    ...rowChecks(service.fees, 'svc-fee', [['amount_rwf', (v) => digits(v, 'Write the amount in digits only, or leave it empty.')], ['source_url', (v) => httpsLink(v)]]),
    ...rowChecks(service.documents, 'svc-doc', [['source_url', (v) => httpsLink(v)]]),
    ...rowChecks(service.offices, 'svc-office', [['source_url', (v) => httpsLink(v)], ['map_url', (v) => httpsLink(v)]]),
    ...rowChecks(service.walkthrough, 'svc-step', [['url_at_step', (v) => httpsLink(v)]]),
  ]);

  const steps = [
    {
      id: 'basics',
      label: 'Basics',
      title: 'Basics',
      lede: 'Say what the guide is about, in the words a student would use.',
      validate: basicsErrors,
      facts: () => [
        { label: 'Area of law', value: domainLabel(values.domain) },
        { label: 'Title', value: values.title },
        { label: 'Summary', value: values.summary },
      ],
      render: () => (
        <>
          <WizField as="select" id="guide-domain" label="Area of law" value={values.domain} onChange={set('domain')}>
            {DOMAINS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
          </WizField>
          <WizField id="guide-title" label="Title" className="mt-4" value={values.title} onChange={set('title')} />
          <WizField
            id="guide-summary"
            label="Summary"
            hint="One or two plain sentences that say what the guide is for. Shown on the guide card."
            as="textarea"
            rows={2}
            maxLength={280}
            className="mt-4"
            value={values.summary}
            onChange={set('summary')}
          />
          <p className="mt-1 text-xs text-muted-foreground">{values.summary.length} of 280</p>
        </>
      ),
    },
    {
      id: 'law',
      label: 'Law and sources',
      title: 'Law and sources',
      lede: 'Name the law and link to its full text. Every claim in the guide must trace to it.',
      validate: lawErrors,
      facts: () => [
        { label: 'The law', value: values.source_law },
        { label: 'Link to the full text', value: values.source_url },
      ],
      render: () => (
        <>
          <WizField
            id="guide-source-law"
            label="The law it is based on"
            hint="For example: Law No. 66/2018 of 30/08/2018."
            value={values.source_law}
            onChange={set('source_law')}
          />
          <WizField
            id="guide-source-url"
            label="Link to the full text (optional)"
            hint="It must start with https://."
            className="mt-4"
            value={values.source_url}
            onChange={set('source_url')}
          />
        </>
      ),
    },
    {
      id: 'rights',
      label: 'Rights and steps',
      title: 'Rights and steps',
      lede: 'Write the guide in plain words. Keep one idea in each paragraph.',
      validate: rightsErrors,
      facts: () => SECTION_TEXT.map(([key, text]) => ({ label: text, value: values[key] })),
      render: () => (
        <>
          {SECTION_TEXT.map(([key, text]) => (
            <WizField key={key} id={`guide-${key}`} label={text} as="textarea" rows={5} className="mt-4" value={values[key]} onChange={set(key)} />
          ))}
        </>
      ),
    },
    {
      id: 'service',
      label: 'How to do it',
      title: 'How to do it',
      lede: 'Only for a guide that ends in a service. Leave every part empty for a guide that does not. Leave out what you cannot confirm from an official source and list it under “Not confirmed”.',
      validate: serviceErrors,
      facts: () => [
        { label: 'Portal name', value: service.portal_name },
        { label: 'Link to the exact service page', value: service.portal_url },
        { label: 'Who can apply', value: service.who_can_apply },
        { label: 'How long it takes', value: service.processing_text },
        { label: 'Fees', value: service.fees.map((f) => `${f.item}${f.amount_rwf ? `, ${f.amount_rwf} FRW` : ''}`).join('\n') },
        { label: 'Documents', value: names(service.documents) },
        { label: 'Offices', value: names(service.offices) },
        { label: 'Step by step', value: names(service.walkthrough, 'instruction') },
        { label: 'Not confirmed', value: service.unconfirmed },
      ],
      render: () => (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <WizField id="svc-portal_name" label="Portal name" value={service.portal_name} onChange={setSvc('portal_name')} />
            <WizField id="svc-checked_at" label="Facts last checked on" hint="As YYYY-MM-DD." value={service.checked_at} onChange={setSvc('checked_at')} />
            <WizField id="svc-portal_url" label="Link to the exact service page" value={service.portal_url} onChange={setSvc('portal_url')} />
            <WizField id="svc-portal_help_url" label="Link to the official help article" value={service.portal_help_url} onChange={setSvc('portal_help_url')} />
            <WizField id="svc-who_can_apply" label="Who can apply" as="textarea" rows={2} className="sm:col-span-2" value={service.who_can_apply} onChange={setSvc('who_can_apply')} />
            <WizField id="svc-processing_text" label="How long it takes, in words" className="sm:col-span-2" value={service.processing_text} onChange={setSvc('processing_text')} />
            <WizField id="svc-days_min" label="Fewest days (digits)" inputMode="numeric" value={service.days_min} onChange={setSvc('days_min')} />
            <WizField id="svc-days_max" label="Most days (digits)" inputMode="numeric" value={service.days_max} onChange={setSvc('days_max')} />
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

          <WizField
            id="svc-unconfirmed"
            label="Not confirmed"
            hint="One for each line. Shown to readers as “Ask the office to confirm”."
            as="textarea"
            rows={3}
            className="mt-6"
            value={service.unconfirmed}
            onChange={setSvc('unconfirmed')}
          />
        </>
      ),
    },
    {
      id: 'review',
      label: 'Review and publish',
      title: 'Review and publish',
      review: true,
      render: () => null,
    },
  ];

  const gate = published ? {
    id: 'guide-understood',
    label: 'I understand',
    sub: 'Saving changes takes this guide off the site until it is published again.',
    message: 'Tick the box to say you understand this guide leaves the site until it is published again.',
    required: true,
    checked: understood,
    onChange: setUnderstood,
  } : null;

  // A published guide is saved as a draft. It is published again from the page above, once the
  // admin has read the saved text. A draft is published with the save.
  const finalLabel = published ? 'Save changes' : 'Publish guide';

  return (
    <Wizard
      steps={steps}
      finalLabel={finalLabel}
      saveLabel="Save draft"
      busy={busy}
      gate={gate}
      label="Guide steps"
      help={GUIDE_HELP}
      variant="plain"
      onSaveDraft={() => save(false)}
      onFinish={() => save(!published)}
      notice={error ? <ErrorNotice error={error} className="mb-4" /> : null}
    />
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
    <form onSubmit={submit} className="mt-8 border-t border-border pt-6" noValidate aria-labelledby="withdraw-heading">
      <h2 id="withdraw-heading" className="font-head text-base text-ink">Take this guide off the site</h2>
      <p className="mt-1 max-w-reading text-sm text-muted-foreground">
        It leaves the site at once and stays off until someone edits it and publishes it again.
      </p>
      <Field id="withdraw-comment" label="Reason" as="textarea" rows={2} className="mt-3" value={comment} onChange={(e) => setComment(e.target.value)} aria-required="true" />
      {error && <ErrorNotice error={error} className="mt-2" />}
      <button type="submit" aria-disabled={busy || undefined} aria-busy={busy} className={`${ADMIN_BUTTON_OUTLINE} mt-3`}>
        {busy ? 'Withdrawing…' : 'Withdraw guide'}
      </button>
    </form>
  );
}

// Write a new guide or change one. An existing guide is read from the staff list because the
// public route answers 404 for anything that is not published.
export default function AdminGuideEditor() {
  const { id } = useParams();
  const location = useLocation();
  const { data: guides, error, loading, refetch } = useApi(id ? '/guides/all' : null);
  const guide = id ? guides?.find((g) => String(g.id) === id) : null;
  // Set when a new guide was saved but could not be published. See GuideForm.save.
  const notice = location.state?.notice;

  // The actions on the saved guide sit above the card, so the card holds only the form.
  const actions = guide && (
    <>
      {guide.status === 'withdrawn' && (
        <p className="mt-2 text-sm text-muted-foreground">Withdrawn. Edit it and publish again to bring it back.</p>
      )}
      {guide.status === 'draft' && <SubmitForReview path={`/guides/${guide.id}`} onDone={refetch} className="mt-4" />}
    </>
  );

  return (
    <AdminEditorPage
      title={id ? 'Edit guide' : 'Write a new guide'}
      status={guide?.status}
      backTo={LIST}
      backLabel="All guides"
      above={actions}
    >
      {id && loading && <p className="text-muted-foreground">Loading…</p>}
      {error && <ErrorNotice error={error} />}
      {notice && <ErrorNotice error={{ message: notice }} className="mb-4" />}
      {id && guides && !guide && <p>That guide does not exist. <Link to={LIST} className="font-semibold text-primary-text underline">Back to all guides</Link></p>}

      {/* Keyed by the guide, not by its reload. A refresh after a failed publish must not remount
          the form and throw away what was typed. */}
      {(!id || guide) && <GuideForm key={guide?.id ?? 'new'} guide={guide} onSaved={refetch} />}

      {/* The rarest action sits last, so the edit form is the first thing the admin sees. */}
      {guide?.status === 'published' && <WithdrawAction guideId={guide.id} onDone={refetch} />}
    </AdminEditorPage>
  );
}
