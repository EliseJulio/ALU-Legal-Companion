import { Link } from 'react-router-dom';
import { BUTTON_PRIMARY, BUTTON_OUTLINE, RING } from '@/lib/ui';
import { markClass, CHIP_TONE, isSolidChip } from '@/lib/scheduleStyle';
import { chipAria } from '@/lib/schedule';

// The circle of an item. It is decoration: the words beside it are the state.
export function ScheduleMark({ mark, onSolid = false }) {
  return (
    <span aria-hidden="true" className={markClass(mark, onSolid)}>
      {mark === 'soon' && <span className="size-1 rounded-full bg-primary-text" />}
    </span>
  );
}

// One item on the month or week grid. It is a button so a keyboard reaches it.
// It selects its day which opens the day list.
// Its label says the state and the time and the title and the day in full.
// The chip is one filled block with its words drawn on the fill.
// The Late chip draws its circle in the inverse colour.
// The focus ring gap takes the colour of the day cell because the gap sits outside the chip.
export function ScheduleChip({ item, onSelect }) {
  const solid = isSolidChip(item.mark);
  const ring = `${RING} focus-visible:ring-offset-surface`;
  return (
    <button
      type="button"
      onClick={() => onSelect(item.date)}
      aria-label={chipAria(item)}
      title={chipAria(item)}
      className={`flex min-h-touch w-full min-w-0 flex-col items-start justify-center gap-0.5 rounded-control px-2 py-1 text-left text-xs leading-tight ${CHIP_TONE[item.mark] ?? CHIP_TONE.unknown} ${ring}`}
    >
      <span className="flex min-w-0 max-w-full items-center gap-1.5 font-semibold">
        <ScheduleMark mark={item.mark} onSolid={solid} />
        <span className="min-w-0 truncate">{item.word}</span>
      </span>
      <span className="block w-full min-w-0 truncate">
        {item.time ? `${item.time} ` : ''}{item.title}
      </span>
    </button>
  );
}

// What a person can do with an item, if anything. An accepted consultation links to its join page.
function ItemAction({ item }) {
  if (item.kind === 'matter') {
    return (
      <Link to={item.href} className={`${BUTTON_OUTLINE} mt-2 w-full sm:w-auto`}>
        Open matter<span className="sr-only">: {item.title}</span>
      </Link>
    );
  }
  if (item.status === 'accepted') {
    return (
      <Link to={`/call/${item.id}`} className={`${BUTTON_PRIMARY} mt-2 w-full sm:w-auto`}>
        Join the call
      </Link>
    );
  }
  if (item.status === 'requested') {
    return <p className="mt-2 text-sm text-muted-foreground">Waiting for the lawyer to accept.</p>;
  }
  return null;
}

// One item as a row in the day list and the phone agenda. The state is its first line, in words.
export function ScheduleRow({ item }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-1.5">
        <ScheduleMark mark={item.mark} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold tabular-nums text-ink">
          {item.word}{item.time ? ` · ${item.time}` : ''}
        </p>
        <p className="mt-0.5 break-words font-semibold text-ink">{item.title}</p>
        <p className="break-words text-sm text-muted-foreground">{item.sub}</p>
        <ItemAction item={item} />
      </div>
    </div>
  );
}
