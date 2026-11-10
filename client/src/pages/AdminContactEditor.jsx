import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiPost, apiPut } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import ErrorNotice from '@/components/ErrorNotice';
import AdminEditorPage from '@/components/AdminEditorPage';
import Field from '@/components/Field';
import { ADMIN_BUTTON_OUTLINE, ADMIN_BUTTON_PRIMARY } from '@/components/AdminRecords';

const LIST = '/admin/contacts';
const BLANK = { name: '', contact: '', when_to_use: '', sort_order: '100' };

// The form starts from the saved contact. A blank box in an edit means "empty this". A save returns
// to the list, which loads the contacts again.
function ContactForm({ contact }) {
  const navigate = useNavigate();
  const [values, setValues] = useState(() => (
    contact ? { ...BLANK, ...contact, sort_order: String(contact.sort_order) } : BLANK
  ));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (key) => (event) => setValues((v) => ({ ...v, [key]: event.target.value }));

  async function save(event) {
    event.preventDefault();
    if (busy) return;
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
      navigate(LIST);
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} aria-label={contact ? 'Edit contact' : 'New contact'}>
      <Field id="c-name" label="Name" value={values.name} onChange={set('name')} />
      <Field
        id="c-contact"
        label="Number or website"
        hint="A phone number becomes a link people can tap to call."
        className="mt-4"
        value={values.contact}
        onChange={set('contact')}
      />
      <Field id="c-when" label="When to use it" as="textarea" rows={2} className="mt-4" value={values.when_to_use} onChange={set('when_to_use')} />
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
      <div className="mt-5 flex flex-wrap gap-3">
        <button type="submit" aria-disabled={busy || undefined} aria-busy={busy} className={ADMIN_BUTTON_PRIMARY}>
          {busy ? 'Saving…' : 'Save contact'}
        </button>
        <Link to={LIST} className={ADMIN_BUTTON_OUTLINE}>Cancel</Link>
      </div>
    </form>
  );
}

// Add an urgent contact or change one, on its own page like the routes. The list keeps deleting.
export default function AdminContactEditor() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const { data: contacts, error, loading } = useApi(isNew ? null : '/admin/emergency-contacts');
  const contact = isNew ? null : contacts?.find((c) => String(c.id) === id);
  const title = isNew ? 'New contact' : 'Edit contact';

  return (
    <AdminEditorPage title={title} backTo={LIST} backLabel="All urgent contacts">
      {!isNew && loading && <p className="text-muted-foreground">Loading…</p>}
      {error && <ErrorNotice error={error} />}
      {!isNew && contacts && !contact && (
        <p>
          That contact does not exist. <Link to={LIST} className="font-semibold text-primary-text underline">Back to all urgent contacts</Link>
        </p>
      )}

      {(isNew || contact) && <ContactForm key={contact?.id ?? 'new'} contact={contact} />}
    </AdminEditorPage>
  );
}
