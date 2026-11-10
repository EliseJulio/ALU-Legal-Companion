import { useEffect, useRef, useState } from 'react';
import Panel from '@/components/overview/Panel';
import CardState from '@/components/overview/CardState';
import { niceTop } from '@/lib/overview';

// Questions asked and bookings requested in each of the last eight weeks as grouped bars.
// Questions are solid black bars and bookings are solid grey ones side by side in that order.
// Both are named in a key. Every bar with a height carries its number so colour is never the only clue.
// A table with the same numbers is there for a screen reader. Counts only.

const HEIGHT = 260;
const LEFT = 32;
const RIGHT = 6;
const TOP = 28;
const BOTTOM = 30;

const weekWords = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
};

// The width of the box the chart sits in, so the text keeps its size on a phone. Without
// ResizeObserver (a test) it keeps the first guess.
function useWidth(ref, first = 640) {
  const [width, setWidth] = useState(first);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const read = () => {
      const w = Math.round(el.getBoundingClientRect().width);
      if (w >= 200) setWidth(w);
    };
    read();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(read);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}

// A bar with rounded-control top corners and a flat bottom. A bar of no height is not drawn: its number still is.
function topRounded(x, y, w, h) {
  if (h <= 0) return '';
  const r = Math.min(4, w / 2, h);
  return `M${x} ${y + h}V${y + r}Q${x} ${y} ${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h}Z`;
}

export function WeeklyBars({ weeks }) {
  const box = useRef(null);
  const width = useWidth(box);
  const max = Math.max(0, ...weeks.flatMap((w) => [w.questions, w.bookings]));
  const top = niceTop(max);
  const y = (v) => TOP + (HEIGHT - TOP - BOTTOM) * (1 - v / top);
  const groupW = (width - LEFT - RIGHT) / weeks.length;
  const barW = Math.min(22, Math.max(8, (groupW - 14) / 2.3));
  // Every label when there is room, every other one on a narrow screen.
  const every = groupW >= 52 ? 1 : 2;
  const last = weeks[weeks.length - 1];
  const summary = `Grouped bars for ${weeks.length} weeks from ${weekWords(weeks[0].week_start)}. `
    + `Questions went from ${weeks[0].questions} to ${last.questions} and bookings from ${weeks[0].bookings} to ${last.bookings}.`;

  return (
    <div ref={box}>
      <svg viewBox={`0 0 ${width} ${HEIGHT}`} role="img" aria-label={summary} focusable="false" className="block h-auto w-full">
        {[0, 1, 2, 3, 4].map((i) => {
          const v = (top / 4) * i;
          return (
            <g key={i}>
              <line x1={LEFT} x2={width - RIGHT} y1={y(v)} y2={y(v)} className="stroke-border" />
              <text x={LEFT - 8} y={y(v) + 4} textAnchor="end" fontSize="12" className="fill-muted-foreground">{v}</text>
            </g>
          );
        })}
        {weeks.map((w, i) => {
          const gx = LEFT + i * groupW + (groupW - (barW * 2 + 4)) / 2;
          return (
            <g key={w.week_start}>
              {/* Questions first in solid black. Bookings next to them in solid grey. */}
              <path d={topRounded(gx, y(w.questions), barW, y(0) - y(w.questions))} className="fill-inverse" />
              <path d={topRounded(gx + barW + 4, y(w.bookings), barW, y(0) - y(w.bookings))} className="fill-faint" />
              {/* A number only where there is a bar. The table below has every figure, zeros included. */}
              {w.questions > 0 && (
                <text x={gx + barW / 2} y={y(w.questions) - 4} textAnchor="middle" fontSize={groupW >= 44 ? 12 : 10} className="fill-ink">{w.questions}</text>
              )}
              {w.bookings > 0 && (
                <text x={gx + barW * 1.5 + 4} y={y(w.bookings) - 4} textAnchor="middle" fontSize={groupW >= 44 ? 12 : 10} className="fill-ink">{w.bookings}</text>
              )}
              {i % every === (weeks.length - 1) % every && (
                <text x={LEFT + i * groupW + groupW / 2} y={HEIGHT - 8} textAnchor="middle" fontSize="12" className="fill-muted-foreground">{weekWords(w.week_start)}</text>
              )}
            </g>
          );
        })}
      </svg>
      <ul aria-label="Key" className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
        <li className="inline-flex items-center gap-2">
          <span aria-hidden="true" className="inline-block size-3 rounded-t-control bg-inverse" />
          Questions asked
        </li>
        <li className="inline-flex items-center gap-2">
          <span aria-hidden="true" className="inline-block size-3 rounded-t-control bg-faint" />
          Bookings requested
        </li>
      </ul>
      <div className="sr-only">
      <table>
        <caption>Questions asked and bookings requested each week</caption>
        <thead>
          <tr><th scope="col">Week starting</th><th scope="col">Questions</th><th scope="col">Bookings</th></tr>
        </thead>
        <tbody>
          {weeks.map((w) => (
            <tr key={w.week_start}><th scope="row">{weekWords(w.week_start)}</th><td>{w.questions}</td><td>{w.bookings}</td></tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}

// The card on the admin overview. The weeks come from the server, oldest first.
export default function WeeklyChart({ weeks, loading, error, className = '' }) {
  const none = Array.isArray(weeks) && weeks.every((w) => w.questions === 0 && w.bookings === 0);
  return (
    <Panel id="weekly-chart" title="Questions and bookings each week" className={className}>
      <CardState loading={loading} error={error} empty={none && <p>No questions or bookings in the last eight weeks.</p>}>
        {weeks && <WeeklyBars weeks={weeks} />}
      </CardState>
    </Panel>
  );
}
