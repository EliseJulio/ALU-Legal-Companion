import { Link } from 'react-router-dom';
import Breadcrumb from '@/components/Breadcrumb';
import { useApi } from '@/lib/useApi';
import Callout from '@/components/Callout';
import ErrorNotice from '@/components/ErrorNotice';
import StatusPill from '@/components/StatusPill';
import { DOMAINS } from '@/lib/directory';
import { CARD, PAGE_TITLE } from '@/lib/ui';
import { ADMIN_BUTTON_OUTLINE, ADMIN_BUTTON_PRIMARY, Cell, RecordList, RecordRow } from '@/components/AdminRecords';

// Name and status and the Edit button. Wide screens get three columns. Phones stack them.
const ROW = 'md:grid-cols-[minmax(0,1fr)_11rem_auto]';

// Every guide in every state. The admin writes and edits. There is no publish button on this
// page. A guide is published from its own page once the admin has checked it against the law.
export default function AdminGuides() {
  const { data: guides, error, loading } = useApi('/guides/all');

  return (
    <div>
      <Breadcrumb trail={[{ label: 'Admin workspace' }]} current="Guides" />
      <h1 className={`mt-4 ${PAGE_TITLE}`}>Guides</h1>
      <p className="mt-2.5 max-w-reading text-sm text-muted-foreground">
        Create and edit guide drafts. An admin publishes a guide once it has been checked against the
        law. Editing a published guide takes it off the site until it is published again.
      </p>
      <Callout title="This is a management workspace" className="mt-6">
        A guide shows to students only after an admin has checked and published it.
      </Callout>
      <p className="mt-4"><Link to="/admin/guides/new" className={ADMIN_BUTTON_PRIMARY}>Write a new guide</Link></p>

      {loading && <p className="mt-6 text-muted-foreground">Loading…</p>}
      {error && <ErrorNotice error={error} className="mt-6" />}
      {guides?.length === 0 && <p className={`mt-6 text-muted-foreground ${CARD}`}>There are no guides yet.</p>}

      <RecordList title="Guide records" columns={['Guide', 'Status', '']} template={ROW} className="mt-6">
        {guides?.map((guide) => (
          <RecordRow key={guide.id} template={ROW}>
            <Cell>
              <h3 className="font-head text-base leading-[1.3] text-ink">{guide.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {DOMAINS.find((d) => d.value === guide.domain)?.label ?? guide.domain} · {guide.source_law}
              </p>
            </Cell>
            <Cell label="Status">
              <StatusPill status={guide.status} />
            </Cell>
            <Cell className="flex md:justify-end">
              <Link to={`/admin/guides/${guide.id}`} className={ADMIN_BUTTON_OUTLINE} aria-label={`Edit ${guide.title}`}>Edit</Link>
            </Cell>
          </RecordRow>
        ))}
      </RecordList>
    </div>
  );
}
