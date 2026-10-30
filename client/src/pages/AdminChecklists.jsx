import { Link } from 'react-router-dom';
import Breadcrumb from '@/components/Breadcrumb';
import { useApi } from '@/lib/useApi';
import ErrorNotice from '@/components/ErrorNotice';
import StatusPill from '@/components/StatusPill';
import SubmitForReview from '@/components/SubmitForReview';
import { PANEL, BUTTON_PRIMARY, BUTTON_OUTLINE } from '@/lib/ui';

// The admin's list of document checklists. "Buying a second-hand car needs these documents."
// A list of required documents is a claim about what an office will ask for, so the admin
// publishes it directly. Changing a published checklist takes it back to draft.
export default function AdminChecklists() {
  const { data: lists, error, loading, refetch } = useApi('/checklists/all');

  return (
    <div>
      <Breadcrumb trail={[{ label: 'Admin workspace' }]} current="Document checklists" />
      <h1 className="mt-6 font-head text-3xl leading-heading text-primary md:text-4xl">Document checklists</h1>
      <p className="mt-1 text-muted-foreground">
        Which documents a task needs. For example buying a second-hand car. Changing a published
        checklist takes it back to draft until it is published again.
      </p>
      <p className="mt-4"><Link to="/admin/checklists/new" className={BUTTON_PRIMARY}>Write a new checklist</Link></p>

      {loading && <p className="mt-6 text-muted-foreground">Loading…</p>}
      {error && <ErrorNotice error={error} className="mt-6" />}
      {lists?.length === 0 && <p className={`mt-6 text-muted-foreground ${PANEL}`}>There are no checklists yet.</p>}

      <ul className="mt-6 space-y-3">
        {lists?.map((list) => (
          <li key={list.id} className={PANEL}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-head font-semibold text-primary">{list.title}</h2>
              <StatusPill status={list.status} />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {list.items.length} {list.items.length === 1 ? 'document' : 'documents'}
            </p>
            <div className="mt-3 flex flex-wrap items-start gap-3">
              <Link to={`/admin/checklists/${list.id}`} className={BUTTON_OUTLINE} aria-label={`Edit ${list.title}`}>Edit</Link>
              {list.status === 'draft' && <SubmitForReview path={`/checklists/${list.id}`} onDone={refetch} />}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
