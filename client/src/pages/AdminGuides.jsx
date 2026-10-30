import { Link } from 'react-router-dom';
import Breadcrumb from '@/components/Breadcrumb';
import { useApi } from '@/lib/useApi';
import Callout from '@/components/Callout';
import ErrorNotice from '@/components/ErrorNotice';
import StatusPill from '@/components/StatusPill';
import { DOMAINS } from '@/lib/directory';
import { PANEL, BUTTON_PRIMARY, BUTTON_OUTLINE } from '@/lib/ui';

// Every guide in every state. The admin writes and edits. There is no publish button on this
// page. A guide is published from its own page once the admin has checked it against the law.
export default function AdminGuides() {
  const { data: guides, error, loading } = useApi('/guides/all');

  return (
    <div>
      <Breadcrumb trail={[{ label: 'Admin workspace' }]} current="Guides" />
      <h1 className="mt-6 font-head text-4xl leading-heading text-primary md:text-5xl">Guides</h1>
      <p className="mt-3 max-w-reading text-muted-foreground">
        Create and edit guide drafts. An admin publishes a guide once it has been checked against the
        law. Editing a published guide takes it off the site until it is published again.
      </p>
      <Callout title="This is a management workspace" className="mt-6">
        A guide shows to students only after an admin has checked and published it.
      </Callout>
      <p className="mt-4"><Link to="/admin/guides/new" className={BUTTON_PRIMARY}>Write a new guide</Link></p>

      {loading && <p className="mt-6 text-muted-foreground">Loading…</p>}
      {error && <ErrorNotice error={error} className="mt-6" />}
      {guides?.length === 0 && <p className={`mt-6 text-muted-foreground ${PANEL}`}>There are no guides yet.</p>}

      <h2 className="mt-8 font-head text-2xl leading-heading text-primary">Guide records</h2>
      <ul className="mt-3 space-y-3">
        {guides?.map((guide) => (
          <li key={guide.id} className={PANEL}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-head text-xl leading-heading text-primary">{guide.title}</h3>
              <StatusPill status={guide.status} />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {DOMAINS.find((d) => d.value === guide.domain)?.label ?? guide.domain} · {guide.source_law}
            </p>
            <Link to={`/admin/guides/${guide.id}`} className={`${BUTTON_OUTLINE} mt-3`}>Edit</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
