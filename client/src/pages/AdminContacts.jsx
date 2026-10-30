import { useState } from 'react';
import Breadcrumb from '@/components/Breadcrumb';
import { apiDelete, apiPost, apiPut } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import Callout from '@/components/Callout';
import ErrorNotice from '@/components/ErrorNotice';
import Field from '@/components/Field';
import { PANEL, BUTTON_PRIMARY, BUTTON_OUTLINE } from '@/lib/ui';

const BLANK = { name: '', contact: '', when_to_use: '', sort_order: '100' };

// The form starts from the saved contact. A blank box in an edit means "empty this".
function ContactForm({ contact, onDone, onCancel }) {
  const [values, setValues] = useState(() => (
    contact ? { ...BLANK, ...contact, sort_order: String(contact.sort_order) } : BLANK
  ));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (key) => (event) => setValues((v) => ({ ...v, [key]: event.target.value }));

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const body = {
      name: values.name,
      contact: values.contact,
      when_to_use: values.when_to_use,
      sort_order: Number(values.sort_order),
    };
    try {
      if (contact) await apiPut(`/admin/emergency-contacts/${contact.id}`, body);
      else await apiPost('/admin/emergency-contacts', body);
      onDone();
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className={`mt-4 ${PANEL}`} aria-label={contact ? 'Edit contact' : 'New contact'}>
      <h2 className="font-head text-2xl leading-heading text-primary">{contact ? `Edit ${contact.name}` : 'New contact'}</h2>
      <Field id="c-name" label="Name" className="mt-4" value={values.name} onChange={set('name')} />
      <Field
        id="c-contact"
        label="Number or website"
        hint="A phone number becomes a link people can tap to call."
        className="mt-4"
        value={values.contact}
        onChange={set('contact')}
      />
      <Field id="c-when" label="When to use it" as="textarea" 
      rows={2} className="mt-4" value={values.when_to_use} 
      onChange={set('when_to_use')} />
      <Field
        id="c-order"
        label="Order on the page"
        hint="A smaller number comes first."
        className="mt-4"
        type="number"
        min="0"
        value={values.sort_order}
        onChange={set('sort_order')}
      />
      {error && <ErrorNotice error={error} className="mt-4" />}
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="submit" 
        aria-disabled={busy || undefined} aria-busy={busy} className={BUTTON_PRIMARY}>
          {busy ? 'Saving…' : 'Save contact'}</button>
        <button type="button" className={BUTTON_OUTLINE} onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

function ContactRow({ contact, onEdit, onDone }) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await apiDelete(`/admin/emergency-contacts/${contact.id}`);
      onDone();
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  return (
    <li className={PANEL}>
      <h2 className="font-head font-semibold text-primary">{contact.name}</h2>
      <p className="mt-1 font-mono text-sm">{contact.contact}</p>
      <p className="mt-1 text-sm text-muted-foreground">{contact.when_to_use}</p>
      <div className="mt-3 flex flex-wrap gap-3">
        <button type="button" className={BUTTON_OUTLINE} onClick={onEdit}>Edit</button>
        {!asking && <button type="button" className={BUTTON_OUTLINE} onClick={() => setAsking(true)}>Delete</button>}
      </div>
      {asking && (
        <div className="mt-3" role="group" aria-label={`Delete ${contact.name}`}>
          <p className="text-sm font-semibold">Delete this contact? It disappears from the urgent help page at once. The built-in list stays available if you delete every one.</p>
          <div className="mt-2 flex gap-3">
            <button type="button" aria-disabled={busy || undefined} className={BUTTON_PRIMARY} onClick={remove}>Delete contact record</button>
            <button type="button" className={BUTTON_OUTLINE} onClick={() => setAsking(false)}>Keep contact</button>
          </div>
        </div>
      )}
      {error && <ErrorNotice error={error} className="mt-3" />}
    </li>
  );
}

// The numbers on the urgent help page. A wrong number can be fixed here without changing the
// code. Deleting every contact is safe. The public page then shows a built-in list, so a person
// in a crisis never sees an empty page.
export default function AdminContacts() {
  const { data: contacts, error, loading, refetch } = useApi('/admin/emergency-contacts');
  const [editing, setEditing] = useState(null);

  function finished() {
    setEditing(null);
    refetch();
  }

  return (
    <div>
      <Breadcrumb trail={[{ label: 'Admin workspace' }]} current="Urgent contacts" />
      <h1 className="mt-6 font-head text-4xl leading-heading text-primary md:text-5xl">Urgent contacts</h1>
      <p className="mt-3 max-w-reading text-muted-foreground">
        Manage the numbers shown on the urgent help page, and where each one comes from.
      </p>
      <Callout title="The page is never empty" className="mt-6">
        If you delete every one, the urgent help page shows a built-in list so it is never empty.
      </Callout>
      {editing === null && (
        <p className="mt-4"><button type="button" 
        className={BUTTON_PRIMARY} onClick={() => setEditing('new')}
        >Add a contact</button></p>
      )}

      {editing !== null && (
        <ContactForm
          key={editing === 'new' ? 'new' : editing.id}
          contact={editing === 'new' ? null : editing}
          onDone={finished}
          onCancel={() => setEditing(null)}
        />
      )}

      {loading && !contacts && <p className="mt-6 text-muted-foreground">Loading…</p>}
      {error && <ErrorNotice error={error} className="mt-6" />}
      {contacts?.length === 0 && (
        <p className={`mt-6 text-muted-foreground ${PANEL}`}>
          No contacts are saved. The urgent help page is showing the built-in list.</p>
      )}

      <ul className="mt-6 space-y-3">
        {contacts?.map((c) => (
          <ContactRow key={c.id} contact={c} onEdit={() => setEditing(c)} onDone={refetch} />
        ))}
      </ul>
    </div>
  );
}
