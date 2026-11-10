import Panel from '@/components/overview/Panel';
import CardState from '@/components/overview/CardState';
import { documentFigures, plural } from '@/lib/overview';

// One row per open matter: its name and a bar and the count. The count is the number a person reads.
// The bar is only a picture of it. There are three columns: the name and the bar and the figures.
function ProgressRow({ row, docs }) {
  // The bar never runs past its track, even if the figures were ever out of step.
  const pct = docs.needed > 0 ? Math.min(100, Math.round((docs.checked / docs.needed) * 100)) : 0;
  return (
    <li className="grid grid-cols-[140px_minmax(0,1fr)_96px] items-center gap-3.5 max-[700px]:grid-cols-[92px_minmax(0,1fr)_80px] max-[700px]:gap-2.5">
      <p className="min-w-0 break-words text-sm text-ink">{row.title}</p>
      {/* A bar with nothing in it says nothing, so it is drawn only once something is checked. */}
      {pct > 0 ? (
        <div aria-hidden="true" className="h-2 overflow-hidden rounded-bar bg-border-soft">
          <div className="h-2 rounded-bar bg-primary" style={{ width: `${pct}%` }} />
        </div>
      ) : <span aria-hidden="true" />}
      <p className="text-right font-mono text-sm font-medium text-ink">
        {docs.checked}/{docs.needed}
      </p>
    </li>
  );
}

// Each open matter with the share of its documents a lawyer has checked.
export default function ProgressByMatter({ progress, loading, error }) {
  const count = progress?.length;
  // Matters with figures get a row. The rest are said once in one line and not once per matter.
  const rows = (progress ?? []).map((row) => ({ row, docs: documentFigures(row) }));
  const withFigures = rows.filter((r) => r.docs);
  const noList = rows.filter((r) => !r.docs && !r.row.checklist).length;
  const updating = rows.filter((r) => !r.docs && r.row.checklist?.under_review).length;
  const rest = [
    noList > 0 && `${noList} ${plural(noList, 'matter has', 'matters have')} no document checklist yet.`,
    updating > 0 && `${updating} ${plural(updating, 'checklist is', 'checklists are')} being updated.`,
  ].filter(Boolean).join(' ');
  return (
    <Panel
      id="progress-by-matter"
      title="Progress by matter"
      action={count ? <span className="text-xs text-muted-foreground">{count} open</span> : null}
      className="lg:col-span-5"
    >
      <CardState
        loading={loading}
        error={error}
        empty={progress?.length === 0 && <p>You have no open matters. Progress shows here once you open one.</p>}
      >
        {withFigures.length > 0 && (
          <>
            <ul className="grid gap-[15px]">
              {withFigures.map(({ row, docs }) => <ProgressRow key={row.id} row={row} docs={docs} />)}
            </ul>
            <p className="mt-[18px] text-xs text-muted-foreground">
              Documents a lawyer has checked, out of the documents each matter needs. Not a promise an office will accept them.
            </p>
          </>
        )}
        {rest && <p className={withFigures.length > 0 ? 'mt-3 text-sm text-muted-foreground' : 'text-muted-foreground'}>{rest}</p>}
      </CardState>
    </Panel>
  );
}
