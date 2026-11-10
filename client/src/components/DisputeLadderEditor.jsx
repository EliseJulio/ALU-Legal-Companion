import { useState } from 'react';
import { Link } from 'react-router-dom';
import { apiPost } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import ErrorNotice from '@/components/ErrorNotice';
import StatusPill from '@/components/StatusPill';
import { ADMIN_BUTTON_OUTLINE, ADMIN_BUTTON_PRIMARY, Cell, RecordList, RecordRow } from '@/components/AdminRecords';

const ROW = 'md:grid-cols-[minmax(0,1fr)_9rem_auto]';

// The steps of the dispute ladder, listed on the Routes page. A step is written on its own page
// (/admin/ladder/...). Publishing a draft step is one action, so it stays here.
// The public page shows only published steps. It shows them on a matter with an Abunzi office.
export default function DisputeLadderEditor() {
  const { data, error, loading, refetch } = useApi('/directory/ladder/all');
  // Anything that is not a list is shown as no steps, so a bad answer cannot break the page.
  const steps = Array.isArray(data) ? data : [];
  const [publishError, setPublishError] = useState(null);

  async function publish(step) {
    setPublishError(null);
    try {
      await apiPost(`/directory/ladder/${step.id}/publish`);
      refetch();
    } catch (err) {
      setPublishError(err);
    }
  }

  return (
    <section aria-labelledby="ladder-heading" className="mt-10">
      <h2 id="ladder-heading" className="font-head text-[22px] leading-[1.25] tracking-[-0.02em] text-ink">Dispute ladder</h2>
      <p className="mt-2 max-w-reading text-sm text-muted-foreground">
        The steps before court. They show on a matter whose first office is an Abunzi committee.
        A step is shown to the public only when it is published.
      </p>
      <p className="mt-4"><Link to="/admin/ladder/new" className={ADMIN_BUTTON_PRIMARY}>Add a step</Link></p>

      {loading && <p className="mt-6 text-muted-foreground">Loading…</p>}
      {error && <ErrorNotice error={error} className="mt-6" />}
      {publishError && <ErrorNotice error={publishError} className="mt-4" />}

      <RecordList title="Dispute ladder steps" columns={['Step', 'Status', '']} template={ROW} className="mt-6">
        {steps.map((s) => (
          <RecordRow key={s.id} template={ROW}>
            <Cell>
              <h3 className="font-head text-base leading-[1.3] text-ink">{s.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Order {s.position}{s.tagline ? ` · ${s.tagline}` : ''}
              </p>
            </Cell>
            <Cell label="Status">
              <StatusPill status={s.status} />
            </Cell>
            <Cell className="flex flex-wrap items-start gap-2 md:justify-end">
              <Link to={`/admin/ladder/${s.id}`} className={ADMIN_BUTTON_OUTLINE} aria-label={`Edit ${s.title}`}>Edit</Link>
              {s.status === 'draft' && (
                <button type="button" className={ADMIN_BUTTON_PRIMARY} onClick={() => publish(s)}>Publish</button>
              )}
            </Cell>
          </RecordRow>
        ))}
      </RecordList>
    </section>
  );
}
