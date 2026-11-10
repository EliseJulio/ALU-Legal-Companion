import { Link } from 'react-router-dom';
import Breadcrumb from '@/components/Breadcrumb';
import { useApi } from '@/lib/useApi';
import Callout from '@/components/Callout';
import ErrorNotice from '@/components/ErrorNotice';
import StatusPill from '@/components/StatusPill';
import SubmitForReview from '@/components/SubmitForReview';
import DisputeLadderEditor from '@/components/DisputeLadderEditor';
import { ADMIN_BUTTON_OUTLINE, ADMIN_BUTTON_PRIMARY, Cell, RecordList, RecordRow } from '@/components/AdminRecords';
import { readableDays } from '@/lib/directory';
import { PAGE_TITLE } from '@/lib/ui';

// Name and status then the actions. Wide screens get three columns. Phones stack them.
const ROW = 'md:grid-cols-[minmax(0,1fr)_11rem_auto]';

// The routes that say where each kind of matter goes first. Written and published directly by
// the admin. A route shows to students only when it and its first office are both published.
export default function AdminRoutes() {
  const { data: routes, error, loading, refetch } = useApi('/directory/routes/all');

  return (
    <div>
      <Breadcrumb trail={[{ label: 'Admin workspace' }]} current="Routes" />
      <h1 className={`mt-4 ${PAGE_TITLE}`}>Routes</h1>
      <p className="mt-2.5 max-w-reading text-sm text-muted-foreground">
        Manage the first office, the legal basis, the ordered steps and the confirmed deadlines,
        and publish the route directly.
      </p>
      <Callout title="First-office dependency" className="mt-6">
        A route only goes public when its first office is published too.
      </Callout>
      <p className="mt-4"><Link to="/admin/routes/new" className={ADMIN_BUTTON_PRIMARY}>Add a route</Link></p>

      {loading && <p className="mt-6 text-muted-foreground">Loading…</p>}
      {error && <ErrorNotice error={error} className="mt-6" />}

      <RecordList title="Route records" columns={['Route', 'Status', '']} template={ROW} className="mt-6">
        {routes?.map((r) => (
          <RecordRow key={r.id} template={ROW}>
            <Cell>
              <h3 className="font-head text-base leading-[1.3] text-ink">{r.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                First office: {r.first_forum_name}
                {r.first_forum_status !== 'published' ? ' (not published yet, so this route stays hidden)' : ''}
                {readableDays(r.deadline_days) ? ` · ${readableDays(r.deadline_days)} from ${r.deadline_runs_from}` : ''}
              </p>
            </Cell>
            <Cell label="Status">
              <StatusPill status={r.status} />
            </Cell>
            <Cell className="flex flex-wrap items-start gap-2 md:justify-end">
              <Link to={`/admin/routes/${r.id}`} className={ADMIN_BUTTON_OUTLINE} aria-label={`Edit ${r.title}`}>Edit</Link>
              {r.status === 'draft' && <SubmitForReview path={`/directory/routes/${r.id}`} onDone={refetch} />}
            </Cell>
          </RecordRow>
        ))}
      </RecordList>

      <DisputeLadderEditor />
    </div>
  );
}
