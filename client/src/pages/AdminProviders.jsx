import { Link } from 'react-router-dom';
import Breadcrumb from '@/components/Breadcrumb';
import { useApi } from '@/lib/useApi';
import Callout from '@/components/Callout';
import ErrorNotice from '@/components/ErrorNotice';
import StatusPill from '@/components/StatusPill';
import SubmitForReview from '@/components/SubmitForReview';
import { ADMIN_BUTTON_OUTLINE, ADMIN_BUTTON_PRIMARY, Cell, RecordList, RecordRow } from '@/components/AdminRecords';
import { CATEGORIES } from '@/lib/directory';
import { PAGE_TITLE } from '@/lib/ui';

// Name and status then the actions. Wide screens get three columns. Phones stack them.
const ROW = 'md:grid-cols-[minmax(0,1fr)_11rem_auto]';

const categoryLabel = (value) => CATEGORIES.find((c) => c.value === value)?.label ?? value;

// The directory of lawyers and consultants and organisations. The list only.
// Adding and changing an entry happens on its own page like the routes so the list never holds a form.
export default function AdminProviders() {
  const { data: providers, error, loading, refetch } = useApi('/directory/providers/all');

  return (
    <div>
      <Breadcrumb trail={[{ label: 'Admin workspace' }]} current="Directory entries" />
      <h1 className={`mt-4 ${PAGE_TITLE}`}>Directory entries</h1>
      <p className="mt-2.5 max-w-reading text-sm text-muted-foreground">
        Manage provider information and publish entries directly. An entry shows to students only
        once it is published.
      </p>
      <Callout title="Every fact is checked" className="mt-6">
        Check the source, the contact, the check date and the linked expert account before
        publishing an entry.
      </Callout>
      <p className="mt-4"><Link to="/admin/providers/new" className={ADMIN_BUTTON_PRIMARY}>Add an entry</Link></p>

      {loading && <p className="mt-6 text-muted-foreground">Loading…</p>}
      {error && <ErrorNotice error={error} className="mt-6" />}

      <RecordList title="Provider records" columns={['Entry', 'Status', '']} template={ROW} className="mt-6">
        {providers?.map((p) => (
          <RecordRow key={p.id} template={ROW}>
            <Cell>
              <h3 className="font-head text-base leading-[1.3] text-ink">{p.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {categoryLabel(p.category)}
                {p.bookable ? ' · takes bookings' : ''}
                {p.stale && p.status === 'published' ? ' · not re-checked for six months' : ''}
              </p>
              {/* If the account is missing the expert's inbox is empty and nothing reports an
                  error. So it is shown on every row. */}
              <p className="mt-1 text-sm">{p.user_id ? `Account ${p.user_id}` : 'No account linked'}</p>
            </Cell>
            <Cell label="Status">
              <StatusPill status={p.status} />
            </Cell>
            <Cell className="flex flex-wrap items-start gap-2 md:justify-end">
              <Link to={`/admin/providers/${p.id}`} className={ADMIN_BUTTON_OUTLINE} aria-label={`Edit ${p.name}`}>Edit</Link>
              {p.status === 'draft' && <SubmitForReview path={`/directory/providers/${p.id}`} onDone={refetch} />}
            </Cell>
          </RecordRow>
        ))}
      </RecordList>
    </div>
  );
}
