import { useState } from 'react';
import { Link } from 'react-router-dom';
import Breadcrumb from '@/components/Breadcrumb';
import { apiDelete } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import Callout from '@/components/Callout';
import ErrorNotice from '@/components/ErrorNotice';
import { CARD, PAGE_TITLE } from '@/lib/ui';
import {
  ADMIN_BUTTON_DANGER, ADMIN_BUTTON_OUTLINE, ADMIN_BUTTON_PRIMARY, Cell, RecordList, RecordRow,
} from '@/components/AdminRecords';

// Name and number and when to use then the actions. Wide screens get four columns. Phones stack them.
const ROW = 'md:grid-cols-[minmax(0,1fr)_8rem_minmax(0,1.2fr)_auto]';

// One contact on the list. Edit opens its own page. Delete stays here: it is one confirmed action.
function ContactRow({ contact, onDone }) {
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
    <RecordRow template={ROW}>
      <Cell>
        <h2 className="font-head text-base font-semibold leading-[1.3] text-ink">{contact.name}</h2>
      </Cell>
      <Cell label="Number">
        <p className="font-mono text-sm">{contact.contact}</p>
      </Cell>
      <Cell label="When to use">
        <p className="text-sm text-muted-foreground">{contact.when_to_use}</p>
      </Cell>
      <Cell className="flex flex-wrap items-start gap-2 md:justify-end">
        <Link to={`/admin/contacts/${contact.id}`} className={ADMIN_BUTTON_OUTLINE} aria-label={`Edit ${contact.name}`}>Edit</Link>
        {!asking && <button type="button" className={ADMIN_BUTTON_OUTLINE} onClick={() => setAsking(true)}>Delete</button>}
      </Cell>
      {asking && (
        <Cell className="md:col-span-full" >
          <div role="group" aria-label={`Delete ${contact.name}`}>
            <p className="text-sm font-semibold">Delete this contact? It disappears from the urgent help page at once. The built-in list stays available if you delete every one.</p>
            <div className="mt-2 flex flex-wrap gap-3">
              <button type="button" aria-disabled={busy || undefined} className={ADMIN_BUTTON_DANGER} onClick={remove}>Delete contact record</button>
              <button type="button" className={ADMIN_BUTTON_OUTLINE} onClick={() => setAsking(false)}>Keep contact</button>
            </div>
          </div>
        </Cell>
      )}
      {error && <Cell className="md:col-span-full"><ErrorNotice error={error} /></Cell>}
    </RecordRow>
  );
}

// The numbers on the urgent help page. A wrong number can be fixed here without changing the
// code. Deleting every contact is safe. The public page then shows a built-in list, so a person
// in a crisis never sees an empty page.
export default function AdminContacts() {
  const { data: contacts, error, loading, refetch } = useApi('/admin/emergency-contacts');

  return (
    <div>
      <Breadcrumb trail={[{ label: 'Admin workspace' }]} current="Urgent contacts" />
      <h1 className={`mt-4 ${PAGE_TITLE}`}>Urgent contacts</h1>
      <p className="mt-2.5 max-w-reading text-sm text-muted-foreground">
        Manage the numbers shown on the urgent help page, and where each one comes from.
      </p>
      <Callout title="The page is never empty" className="mt-6">
        If you delete every one, the urgent help page shows a built-in list so it is never empty.
      </Callout>
      <p className="mt-4"><Link to="/admin/contacts/new" className={ADMIN_BUTTON_PRIMARY}>Add a contact</Link></p>

      {loading && !contacts && <p className="mt-6 text-muted-foreground">Loading…</p>}
      {error && <ErrorNotice error={error} className="mt-6" />}
      {contacts?.length === 0 && (
        <p className={`mt-6 text-muted-foreground ${CARD}`}>
          No contacts are saved. The urgent help page is showing the built-in list.</p>
      )}

      <RecordList columns={contacts?.length ? ['Name', 'Number', 'When to use', ''] : null} template={ROW} className="mt-6">
        {contacts?.map((c) => (
          <ContactRow key={c.id} contact={c} onDone={refetch} />
        ))}
      </RecordList>
    </div>
  );
}
