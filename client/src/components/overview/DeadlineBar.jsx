import { BAR_DAYS, deadlineCells } from '@/lib/overview';

// Each cell's fill. The words in the key say the same thing, so colour is never the only clue.
const FILL = {
  left: 'bg-inverse',
  close: 'bg-primary-text',
  passed: 'bg-calm',
  none: 'border border-border bg-chrome-raised',
};

const KEY = [
  ['passed', 'Time passed'],
  ['close', 'Getting close'],
  ['left', 'Days left'],
];

// The 30 days before a deadline with one cell a day. The bar is decoration.
// The figure and the words beside it say how many days are left. The key says what each colour means.
// `span` is from barSpan(): the day the matter was opened and where today falls between then and the due date.
export default function DeadlineBar({ left, span = null }) {
  const cells = deadlineCells(left);
  const inWindow = left !== null && left >= 0 && left <= BAR_DAYS;
  return (
    <div>
      <div aria-hidden="true" className="grid grid-cols-[repeat(30,minmax(0,1fr))] gap-[3px]">
        {cells.map((cell, i) => <span key={i} className={`h-6 rounded-bar ${FILL[cell]}`} />)}
      </div>
      {/* The bar is the last 30 days. When the matter was opened earlier, the left edge is not the opened day. */}
      <div className="mt-2 flex justify-between gap-3 text-xs text-muted-foreground">
        <span>{span && (span.total === null || span.total <= BAR_DAYS) ? `Opened ${span.openedWords}` : `${BAR_DAYS} days before`}</span>
        <span>{span?.total ? `Day ${span.day} of ${span.total}` : 'Due day'}</span>
      </div>
      {span && span.total > BAR_DAYS && (
        <p className="mt-1 text-xs text-muted-foreground">Opened {span.openedWords}</p>
      )}
      {inWindow && (
        <ul aria-label="Key" className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
          {KEY.map(([tone, words]) => (
            <li key={tone} className="inline-flex items-center gap-2">
              <span aria-hidden="true" className={`inline-block size-3 rounded-bar ${FILL[tone]}`} />
              {words}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
