import { Link } from 'react-router-dom';
import Breadcrumb from '@/components/Breadcrumb';
import { useApi } from '@/lib/useApi';
import ErrorNotice from '@/components/ErrorNotice';
import StatusPill from '@/components/StatusPill';
import SubmitForReview from '@/components/SubmitForReview';
import { CARD, PAGE_TITLE } from '@/lib/ui';
import { ADMIN_BUTTON_OUTLINE, ADMIN_BUTTON_PRIMARY, Cell, RecordList, RecordRow } from '@/components/AdminRecords';

// Name and status then the actions. Wide screens get three columns. Phones stack them.
const ROW = 'md:grid-cols-[minmax(0,1fr)_11rem_auto]';

// The admin's list of document checklists. "Buying a second-hand car needs these documents."
// The admin publishes a checklist directly. Changing a published checklist takes it back to draft.
export default function AdminChecklists() {
  const { data: lists, error, loading, refetch } = useApi('/checklists/all');

  return (
    <div>
      <Breadcrumb trail={[{ label: 'Admin workspace' }]} current="Document checklists" />
      <h1 className={`mt-4 ${PAGE_TITLE}`}>Document checklists</h1>
      <p className="mt-2.5 max-w-reading text-sm text-muted-foreground">
        Which documents a task needs. For example buying a second-hand car. Changing a published
        checklist takes it back to draft until it is published again.
      </p>
      <p className="mt-4"><Link to="/admin/checklists/new" className={ADMIN_BUTTON_PRIMARY}>Write a new checklist</Link></p>

      {loading && <p className="mt-6 text-muted-foreground">Loading…</p>}
      {error && <ErrorNotice error={error} className="mt-6" />}
      {lists?.length === 0 && <p className={`mt-6 text-muted-foreground ${CARD}`}>There are no checklists yet.</p>}

      <RecordList columns={['Checklist', 'Status', '']} template={ROW} className="mt-6">
        {lists?.map((list) => (
          <RecordRow key={list.id} template={ROW}>
            <Cell>
              <h2 className="font-head text-base font-semibold leading-[1.3] text-ink">{list.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {list.items.length} {list.items.length === 1 ? 'document' : 'documents'}
              </p>
            </Cell>
            <Cell label="Status">
              <StatusPill status={list.status} />
            </Cell>
            <Cell className="flex flex-wrap items-start gap-2 md:justify-end">
              <Link to={`/admin/checklists/${list.id}`} className={ADMIN_BUTTON_OUTLINE} aria-label={`Edit ${list.title}`}>Edit</Link>
              {list.status === 'draft' && <SubmitForReview path={`/checklists/${list.id}`} onDone={refetch} />}
            </Cell>
          </RecordRow>
        ))}
      </RecordList>
    </div>
  );
}
