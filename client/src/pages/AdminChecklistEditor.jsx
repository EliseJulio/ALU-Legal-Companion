import { useState } from 'react';
import Breadcrumb from '@/components/Breadcrumb';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiPost, apiPut } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import ErrorNotice from '@/components/ErrorNotice';
import StatusPill from '@/components/StatusPill';
import Field, { CheckField } from '@/components/Field';
import RowEditor from '@/components/RowEditor';
import { blankItem, slugify, toApiChecklist, toFormChecklist } from '@/lib/checklistForm';
import { PANEL, RING_ON_CANVAS, BUTTON_PRIMARY } from '@/lib/ui';

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
  const [saved, setSaved] = useState(false);
  const published = list?.status === 'published';

  const set = (field) => (event) => { setForm((f) => ({ ...f, [field]: event.target.value })); setSaved(false); };
  const setItems = (items) => { setForm((f) => ({ ...f, items })); setSaved(false); };

  const missing = [!form.title.trim() && 'a title', form.items.every((i) => !i.name.trim()) && 'at least one document'].filter(Boolean);

  async function save(event) {
    event.preventDefault();
    if (published && !understood) {
      setError({ message: 'Tick the box to say you understand this checklist leaves the site until it is published again.' });
      return;
    }
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const body = toApiChecklist({ ...form, slug: form.slug.trim() || slugify(form.title) });
      if (list) {
        await apiPut(`/checklists/${list.id}`, body);
        setSaved(true);
        setUnderstood(false);
        onSaved();
      } else {
        const created = await apiPost('/checklists', body);
        navigate(`/admin/checklists/${created.id}`);
      }
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className={`mt-4 ${PANEL}`}>
      <Field id="cl-title" label="Title" value={form.title} onChange={set('title')} />
      <Field
        id="cl-slug"
        label="Short name for the system"
        hint="Lower-case letters, digits and hyphens. Made from the title if empty."
        className="mt-4"
        value={form.slug}
        onChange={set('slug')}
      />
      <Field id="cl-description" label="What this checklist is for" as="textarea" rows={3} className="mt-4" value={form.description} onChange={set('description')} />

      <RowEditor
        idBase="cl-item"
        legend="Documents"
        hint="One row for each document. Say where each fact comes from. Leave out anything you could not confirm and say so in the description."
        itemName="Document"
        rows={form.items}
        columns={ITEM_FIELDS}
        blank={blankItem}
        onChange={setItems}
        addLabel="Add a document"
      />

      {published && (
        <div className="mt-4 rounded border border-warning-border bg-warning-subtle p-3">
          <p className="text-sm font-semibold text-warning-strong">
            This checklist is published. Saving any change takes it back to draft. It leaves the
            site until it is published again.
          </p>
          <CheckField id="cl-understood" label="I understand" checked={understood} onChange={setUnderstood} />
        </div>
      )}

      {missing.length > 0 && <p className="mt-4 text-sm text-muted-foreground">Still needed before this can be saved: {missing.join(' and ')}.</p>}
      {error && <ErrorNotice error={error} className="mt-4" />}
      <div role="status">
        {saved && <p className="mt-4 text-sm">Saved. The checklist is now a draft. Publish it from the checklist list when it is ready.</p>}
      </div>
      <button type="submit" aria-disabled={(busy || missing.length > 0) || undefined} aria-busy={busy} className={`${BUTTON_PRIMARY} mt-4`}>
        {busy ? 'Saving…' : list ? 'Save changes' : 'Create this draft'}
      </button>
    </form>
  );
}

// Write a new checklist or change one. An existing one is read from the staff list because the
// public route answers 404 for anything that is not published.
export default function AdminChecklistEditor() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const { data: lists, error, loading, refetch } = useApi(isNew ? null : '/checklists/all');
  const list = isNew ? null : lists?.find((c) => String(c.id) === id);

  return (
    <div>
      <p className="text-sm">
        <Link to="/admin/checklists" className={`inline-flex min-h-touch items-center font-semibold text-primary underline ${RING_ON_CANVAS}`}>
          ← All checklists
        </Link>
      </p>
      <Breadcrumb trail={[{ label: 'Admin workspace' }]} current={isNew ? 'Write a new checklist' : 'Edit checklist'} />
      <h1 className="mt-6 font-head text-3xl leading-heading text-primary md:text-4xl">{isNew ? 'Write a new checklist' : 'Edit checklist'}</h1>

      {!isNew && loading && <p className="mt-4 text-muted-foreground">Loading…</p>}
      {error && <ErrorNotice error={error} className="mt-4" />}
      {!isNew && lists && !list && <p className={`mt-4 ${PANEL}`}>That checklist does not exist.</p>}

      {list && (
        <>
          <p className="mt-2 flex items-center gap-2 text-sm">Status: <StatusPill status={list.status} /></p>
        </>
      )}

      {(isNew || list) && <ChecklistForm key={list?.updated_at ?? 'new'} list={list} onSaved={refetch} />}
    </div>
  );
}
