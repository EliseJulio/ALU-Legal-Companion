import { Link } from 'react-router-dom';
import { useApi } from '@/lib/useApi';
import ErrorNotice from '@/components/ErrorNotice';
import StatusPill from '@/components/StatusPill';
import { DOMAINS } from '@/lib/directory';
import { PANEL, BUTTON_PRIMARY, BUTTON_OUTLINE } from '@/lib/ui';

// Every guide in every state. The admin writes and edits. There is no publish button on this
// page or anywhere else in the admin pages. Only a legal expert can publish, so nothing here can
// look like it decides what students are shown.
export default function AdminGuides() {
  const { data: guides, error, loading } = useApi('/guides/all');

  return (
    <div>
      <h1 className="font-head text-2xl text-primary">Manage guides</h1>
      <p className="mt-1 text-muted-foreground">
        Write a guide and send it for review. A legal expert reads it and publishes it. Editing a
        published guide takes it off the site until an expert has checked the change.
      </p>
      <p className="mt-4"><Link to="/admin/guides/new" className={BUTTON_PRIMARY}>Write a new guide</Link></p>

      {loading && <p className="mt-6 text-muted-foreground">Loading…</p>}
      {error && <ErrorNotice error={error} className="mt-6" />}
      {guides?.length === 0 && <p className={`mt-6 text-muted-foreground ${PANEL}`}>There are no guides yet.</p>}

      <ul className="mt-6 space-y-3">
        {guides?.map((guide) => (
          <li key={guide.id} className={PANEL}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-head font-semibold text-primary">{guide.title}</h2>
              <StatusPill status={guide.status} />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {DOMAINS.find((d) => d.value === guide.domain)?.label ?? guide.domain} · {guide.source_law}
            </p>
            {guide.status === 'published' && guide.verified_by_name && (
              <p className="mt-1 text-sm">Verified by {guide.verified_by_name}</p>
            )}
            {guide.status === 'draft' && guide.review_comment && (
              <p className="mt-1 text-sm font-semibold text-warning-strong">Returned by an expert: {guide.review_comment}</p>
            )}
            <Link to={`/admin/guides/${guide.id}`} className={`${BUTTON_OUTLINE} mt-3`}>Edit</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
