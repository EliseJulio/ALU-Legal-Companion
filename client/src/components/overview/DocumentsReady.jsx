import { useState } from 'react';
import { Link } from 'react-router-dom';
import Panel from '@/components/overview/Panel';
import CardState from '@/components/overview/CardState';
import Gauge from '@/components/overview/Gauge';
import Select from '@/components/Select';
import { documentFigures, defaultMatterId } from '@/lib/overview';
import { BUTTON_OUTLINE, RING } from '@/lib/ui';

// The six counts under the gauge. The key is the word a person reads, the value is the number.
const COUNTS = [
  ['checked', 'checked'],
  ['waiting', 'waiting'],
  ['toFix', 'to fix'],
  ['missing', 'missing'],
  ['expired', 'expired'],
  ['needed', 'needed'],
];

// The documents a matter needs and how many a lawyer has checked. The picker chooses the matter. It
// starts on the first matter that follows a checklist.
export default function DocumentsReady({ progress, loading, error }) {
  const [picked, setPicked] = useState(null);
  const defaultId = defaultMatterId(progress);
  // A choice that no longer exists falls back to the default, so the card never goes blank.
  const chosen = progress?.find((p) => p.id === picked) ?? progress?.find((p) => p.id === defaultId);
  const docs = documentFigures(chosen);

  // The picker is 44 px high with a grey box and a small chevron. A long title is cut short inside it
  // and the full title is still in the list (Progress by matter) and in the options.
  // No matter follows a checklist: one line, not a picker and a gauge with nothing in them.
  const noneFollow = progress?.length > 0 && progress.every((p) => !p.checklist);

  const picker = progress?.length > 0 && !noneFollow && (
    <label className="flex min-w-0 max-w-full items-center text-sm">
      <span className="sr-only">Choose a matter</span>
      <Select
        value={chosen?.id ?? ''}
        onChange={(e) => setPicked(Number(e.target.value))}
        aria-label="Choose a matter"
        className={`h-11 w-60 max-w-full cursor-pointer truncate rounded-control border border-control bg-chrome-raised py-0 pl-3.5 text-[13px] font-medium text-ink ${RING} focus-visible:ring-offset-surface`}
      >
        {progress.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
      </Select>
    </label>
  );

  return (
    <Panel id="documents-ready" title="Documents ready" action={picker || null} className="lg:col-span-5">
      <CardState
        loading={loading}
        error={error}
        empty={progress?.length === 0 && (
          <>
            <p>You have no open matters, so there are no documents to count.</p>
            <Link to="/directory" className={`${BUTTON_OUTLINE} mt-4`}>Where do I take this?</Link>
          </>
        )}
      >
        {noneFollow && (
          <p className="text-muted-foreground">None of your open matters follows a document checklist yet.</p>
        )}
        {!noneFollow && chosen && !chosen.checklist && (
          <p className="text-muted-foreground">
            This matter does not follow a document checklist yet.{' '}
            <Link to={`/matters/${chosen.id}`} className={`inline-flex min-h-touch items-center font-semibold text-info underline ${RING}`}>Add one on its page</Link>.
          </p>
        )}
        {chosen?.checklist?.under_review && (
          <p className="text-muted-foreground">
            The checklist for this matter is being updated. Its figures come back when it is published.
          </p>
        )}
        {docs && docs.needed === 0 && (
          <p className="text-muted-foreground">This checklist has no documents to count.</p>
        )}
        {docs && docs.needed > 0 && (
          <>
            <Gauge done={docs.checked} total={docs.needed} />
            <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-card border border-border bg-border sm:grid-cols-3">
              {COUNTS.map(([key, label]) => (
                <div key={key} className="flex flex-row-reverse items-baseline justify-end gap-1.5 bg-surface px-3.5 py-2.5">
                  <dt className="text-[13px] text-muted-foreground">{label}</dt>
                  <dd className="font-sans text-[15px] font-medium leading-[19px] text-ink">{key === 'needed' ? docs.needed : docs[key]}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-sm text-muted-foreground">
              Counts are documents a lawyer has checked, out of the documents this matter needs.
              {docs.ready && ' Every required document has been checked. That is not a promise an office will accept them.'}
            </p>
          </>
        )}
      </CardState>
    </Panel>
  );
}
