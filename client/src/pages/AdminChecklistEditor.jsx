import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { apiPost, apiPut } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import ErrorNotice from '@/components/ErrorNotice';
import AdminEditorPage from '@/components/AdminEditorPage';
import RowEditor from '@/components/RowEditor';
import Wizard from '@/components/wizard/Wizard';
import { WizField } from '@/components/wizard/WizardField';
import { blankItem, slugify, toApiChecklist, toFormChecklist } from '@/lib/checklistForm';
import { collect, keyName, requiredText, httpsLink } from '@/lib/wizard';

const LIST = '/admin/checklists';

// The help card under the form, in the admin's own terms.
const CHECKLIST_HELP = {
  title: 'Before you publish',
  intro: 'A matter cannot be ready without its required documents, so mark each one with care.',
  items: [
    'Tick required only for a document a matter cannot be ready without.',
    'Say where each fact comes from: the official page, not a summary of it.',
    'Use the document names the official page uses.',
  ],
};

// The labels for the document rows. The keys are the ones the server uses. The words are for the
// person typing.
const ITEM_FIELDS = [
  { key: 'name', label: 'The document' },
  { key: 'key', label: 'Short name for the system (optional. Made from the name if empty)' },
  { key: 'notes', label: 'What it must show', wide: true },
  { key: 'where_to_get', label: 'Where to get it' },
  { key: 'required_if', label: 'Only needed if… (leave empty if it is always needed)' },
  { key: 'source_url', label: 'Source link (https://)' },
  { key: 'required', label: 'Required (untick for an optional or conditional document)', checkbox: true },
];

const ITEM_TEXT_KEYS = ['key', 'name', 'notes', 'where_to_get', 'required_if', 'source_url'];

// A row with any text is a document someone meant to add. Its name is then required.
const hasText = (row) => ITEM_TEXT_KEYS.some((k) => String(row[k] ?? '').trim() !== '');

// Like the guide editor this is a place where a verified fact can be taken off the site. Saving a
// published checklist sends it back to draft and clears the stamp. So no request is made until the
// admin says they understand. The warning shows only for a published checklist. A warning shown on
// every save is one that people learn to click through.
function ChecklistForm({ list, onSaved }) {
  const navigate = useNavigate();
  const [form, setForm] = useState(() => toFormChecklist(list));
  const [understood, setUnderstood] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const published = list?.status === 'published';

  const set = (field) => (event) => setForm((f) => ({ ...f, [field]: event.target.value }));
  const setItems = (items) => setForm((f) => ({ ...f, items }));

  const basicsErrors = () => collect([
    ['cl-title', requiredText(form.title, 'Give the checklist a title.')],
    ['cl-slug', keyName(form.slug)],
  ]);
  const documentsErrors = () => {
    const rows = form.items;
    const checks = [];
    if (!rows.some((r) => String(r.name ?? '').trim() !== '')) checks.push(['cl-item-add', 'Add at least one document.']);
    rows.forEach((row, i) => {
      if (hasText(row)) checks.push([`cl-item-${i}-name`, requiredText(row.name, 'Name the document.')]);
      if (row.key && keyName(row.key)) checks.push([`cl-item-${i}-key`, keyName(row.key)]);
      if (row.source_url) checks.push([`cl-item-${i}-source_url`, httpsLink(row.source_url)]);
    });
    return collect(checks);
  };

  // Publishing is a save followed by a publish. A draft is published with the save.
  // A published list is saved as a draft and published again from the list once it has been read.
  // A save returns to the list. If the publish is refused the page stays so the message is read.
  // A new checklist that was saved but not published goes to its own page.
  // It exists now and a second save from this form would create a copy.
  async function save(publishAfter) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const body = toApiChecklist({ ...form, slug: form.slug.trim() || slugify(form.title) });
      if (list) {
        const updated = await apiPut(`/checklists/${list.id}`, body);
        setUnderstood(false);
        if (publishAfter && updated?.status !== 'published') {
          const refusal = await publishOrSay(list.id);
          if (refusal) {
            setError({ message: refusal });
            onSaved();
            return;
          }
        }
        navigate(LIST);
      } else {
        const created = await apiPost('/checklists', body);
        if (publishAfter && created?.status !== 'published') {
          const refusal = await publishOrSay(created.id);
          if (refusal) {
            navigate(`/admin/checklists/${created.id}`, { state: { notice: refusal } });
            return;
          }
        }
        navigate(LIST);
      }
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  // The message when the publish was refused. It is null when it went through.
  async function publishOrSay(id) {
    try {
      await apiPost(`/checklists/${id}/publish`);
      return null;
    } catch (err) {
      return `Saved as a draft. It is not published yet: ${err.message}`;
    }
  }

  const steps = [
    {
      id: 'basics',
      label: 'Basics',
      title: 'Basics',
      lede: 'Name the task the checklist is for, in the words a student would use.',
      validate: basicsErrors,
      facts: () => [
        { label: 'Title', value: form.title },
        { label: 'Short name for the system', value: form.slug },
        { label: 'What this checklist is for', value: form.description },
      ],
      render: () => (
        <>
          <WizField id="cl-title" label="Title" value={form.title} onChange={set('title')} />
          <WizField
            id="cl-slug"
            label="Short name for the system"
            hint="Lower-case letters, digits and hyphens. Made from the title if empty."
            className="mt-4"
            value={form.slug}
            onChange={set('slug')}
          />
          <WizField id="cl-description" label="What this checklist is for" as="textarea" rows={3} className="mt-4" value={form.description} onChange={set('description')} />
        </>
      ),
    },
    {
      id: 'documents',
      label: 'Documents',
      title: 'Documents',
      lede: 'One row for each document. Tick required for the ones a matter cannot be ready without. Say where each fact comes from.',
      validate: documentsErrors,
      facts: () => form.items.map((row, i) => ({
        label: `${i + 1}. ${row.name || 'Unnamed document'}`,
        value: [row.required === false ? 'Optional' : 'Required', row.required_if && `Only if ${row.required_if}`, row.where_to_get && `From ${row.where_to_get}`].filter(Boolean).join(' · '),
      })),
      render: () => (
        <RowEditor
          idBase="cl-item"
          legend="Documents"
          itemName="Document"
          rows={form.items}
          columns={ITEM_FIELDS}
          blank={blankItem}
          onChange={setItems}
          addLabel="Add a document"
        />
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
    id: 'cl-understood',
    label: 'I understand',
    sub: 'Saving changes takes this checklist off until it is published again.',
    message: 'Tick the box to say you understand this checklist leaves the site until it is published again.',
    required: true,
    checked: understood,
    onChange: setUnderstood,
  } : null;

  return (
    <Wizard
      steps={steps}
      finalLabel={published ? 'Save changes' : 'Publish checklist'}
      saveLabel="Save draft"
      busy={busy}
      gate={gate}
      label="Checklist steps"
      help={CHECKLIST_HELP}
      variant="plain"
      onSaveDraft={() => save(false)}
      onFinish={() => save(!published)}
      notice={error ? <ErrorNotice error={error} className="mb-4" /> : null}
    />
  );
}

// Write a new checklist or change one. An existing one is read from the staff list because the
// public route answers 404 for anything that is not published.
export default function AdminChecklistEditor() {
  const { id } = useParams();
  const location = useLocation();
  const isNew = !id || id === 'new';
  const { data: lists, error, loading, refetch } = useApi(isNew ? null : '/checklists/all');
  const list = isNew ? null : lists?.find((c) => String(c.id) === id);

  // Set when a new checklist was saved but could not be published. See ChecklistForm.save.
  const notice = location.state?.notice;

  return (
    <AdminEditorPage
      title={isNew ? 'Write a new checklist' : 'Edit checklist'}
      status={list?.status}
      backTo={LIST}
      backLabel="All checklists"
    >
      {!isNew && loading && <p className="text-muted-foreground">Loading…</p>}
      {error && <ErrorNotice error={error} />}
      {notice && <ErrorNotice error={{ message: notice }} className="mb-4" />}
      {!isNew && lists && !list && <p>That checklist does not exist. <Link to={LIST} className="font-semibold text-primary-text underline">Back to all checklists</Link></p>}

      {/* Keyed by the checklist, so a refresh after a refused publish keeps what was typed. */}
      {(isNew || list) && <ChecklistForm key={list?.id ?? 'new'} list={list} onSaved={refetch} />}
    </AdminEditorPage>
  );
}
