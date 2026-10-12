import { useState } from 'react';
import { apiPost, apiPut } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import ErrorNotice from '@/components/ErrorNotice';
import StatusPill from '@/components/StatusPill';
import SubmitForReview from '@/components/SubmitForReview';
import Field, { CheckField } from '@/components/Field';
import { CATEGORIES, PROVIDER_TYPES } from '@/lib/directory';
import { PANEL, BUTTON_PRIMARY, BUTTON_OUTLINE } from '@/lib/ui';

const BLANK = {
  name: '', category: 'lawyer', type: 'pro_bono_lawyer', location: '', contact: '', services: '', languages: '',
  is_free: true, official_source_url: '', bookable: false, meet_link: '', user_id: '',
};

// The form starts from the saved entry. With these update rules a blank box means "empty this".
// An empty account box would unlink an expert while someone edited a phone number. So the form
// shows what is saved first.
function ProviderForm({ provider, onDone, onCancel }) {
  const [values, setValues] = useState(() => {
    if (!provider) return BLANK;
    return Object.fromEntries(Object.keys(BLANK).map((key) => [key, provider[key] ?? BLANK[key]]));
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const set = (key) => (event) => setValues((v) => ({ ...v, [key]: event.target.value }));
  const flip = (key) => (checked) => setValues((v) => ({ ...v, [key]: checked }));

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const body = { ...values, user_id: String(values.user_id).trim() === '' ? null : Number(values.user_id) };
    try {
      if (provider) await apiPut(`/directory/providers/${provider.id}`, body);
      else await apiPost('/directory/providers', body);
      onDone();
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className={`mt-4 ${PANEL}`} aria-label={provider ? 'Edit entry' : 'New entry'}>
      <h2 className="font-head text-lg font-semibold text-primary">{provider ? `Edit ${provider.name}` : 'New entry'}</h2>
      {provider?.status === 'published' && (
        <p className="mt-2 rounded border border-warning-border bg-warning-subtle p-3 text-sm font-semibold text-warning-strong">
          This entry is published. Changing the name, kind, place, contact, services, languages,
          cost or source sends it back for review. Changing the account, bookings or video room
          does not.
        </p>
      )}
      <Field id="p-name" label="Name" className="mt-4" value={values.name} onChange={set('name')} />
      <Field id="p-category" label="Group" as="select" className="mt-4" value={values.category} onChange={set('category')}>
        {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
      </Field>
      <Field id="p-type" label="Kind of body" as="select" className="mt-4" value={values.type} onChange={set('type')}>
        {PROVIDER_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
      </Field>
      <Field id="p-location" label="Place" className="mt-4" value={values.location} onChange={set('location')} />
      <Field id="p-contact" label="How to reach it" className="mt-4" value={values.contact} onChange={set('contact')} />
      <Field id="p-services" label="What it does" as="textarea" rows={3} className="mt-4" value={values.services} onChange={set('services')} />
      <Field id="p-languages" label="Languages" className="mt-4" value={values.languages} onChange={set('languages')} />
      <CheckField id="p-free" label="It is free" className="mt-2" checked={values.is_free} onChange={flip('is_free')} />
      <Field
        id="p-source"
        label="The body’s own page"
        hint="The expert checks the facts against this."
        className="mt-4"
        value={values.official_source_url}
        onChange={set('official_source_url')}
      />
      <CheckField id="p-bookable" label="It takes online bookings" className="mt-2" checked={values.bookable} onChange={flip('bookable')} />
      <Field
        id="p-room"
        label="Video room address"
        hint="A Google Meet address that starts with https://meet.google.com/."
        className="mt-4"
        value={values.meet_link}
        onChange={set('meet_link')}
      />
      <Field
        id="p-account"
        label="Expert account number"
        hint="The account that receives bookings and shared matters for this entry. Without it that expert’s inbox stays empty."
        className="mt-4"
        type="number"
        min="1"
        value={values.user_id}
        onChange={set('user_id')}
      />

      {error && <ErrorNotice error={error} className="mt-4" />}
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="submit" disabled={busy} aria-busy={busy} className={BUTTON_PRIMARY}>{busy ? 'Saving…' : 'Save entry'}</button>
        <button type="button" className={BUTTON_OUTLINE} onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

// The directory of lawyers, consultants and organisations. The admin writes the entries and sends
// them for review. A legal expert verifies them. Only then do they show to students.
export default function AdminProviders() {
  const { data: providers, error, loading, refetch } = useApi('/directory/providers/all');
  // null means no form. "new" means a blank form. Otherwise it is the entry being edited.
  const [editing, setEditing] = useState(null);

  function finished() {
    setEditing(null);
    refetch();
  }

  return (
    <div>
      <h1 className="font-head text-2xl text-primary">Manage directory</h1>
      <p className="mt-1 text-muted-foreground">
        Lawyers, consultants and organisations. Write an entry and send it for review. It shows
        to students only after a legal expert has verified it.
      </p>
      {editing === null && (
        <p className="mt-4"><button type="button" className={BUTTON_PRIMARY} 
        onClick={() => setEditing('new')}>Add an entry</button></p>
      )}

      {editing !== null && (
        <ProviderForm
          key={editing === 'new' ? 'new' : editing.id}
          provider={editing === 'new' ? null : editing}
          onDone={finished}
          onCancel={() => setEditing(null)}
        />
      )}

      {loading && <p className="mt-6 text-muted-foreground">Loading…</p>}
      {error && <ErrorNotice error={error} className="mt-6" />}

      <ul className="mt-6 space-y-3">
        {providers?.map((p) => (
          <li key={p.id} className={PANEL}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-head font-semibold text-primary">{p.name}</h2>
              <StatusPill status={p.status} />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {CATEGORIES.find((c) => c.value === p.category)?.label ?? p.category}
              {p.bookable ? ' · takes bookings' : ''}
              {p.stale && p.status === 'published' ? ' · not re-checked for six months' : ''}
            </p>
            {/* If the account is missing the expert's inbox is empty and nothing reports an
                error. So it is shown on every row. */}
            <p className="mt-1 text-sm">{p.user_id ? `Account ${p.user_id}` : 'No account linked'}</p>
            {p.status === 'draft' && p.review_comment && (
              <p className="mt-1 text-sm font-semibold text-warning-strong">Returned by an expert: {p.review_comment}</p>
            )}
            <div className="mt-3 flex flex-wrap gap-3">
              <button type="button" className={BUTTON_OUTLINE} onClick={() => setEditing(p)}>Edit</button>
              {p.status === 'draft' && <SubmitForReview path={`/directory/providers/${p.id}`} onDone={refetch} />}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
