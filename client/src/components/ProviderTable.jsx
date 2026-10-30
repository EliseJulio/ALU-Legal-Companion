import { Link } from 'react-router-dom';
import Icon from '@/components/Icon';
import { typeLabel } from '@/lib/directory';
import { readableDay } from '@/lib/dates';
import { BUTTON_OUTLINE, BUTTON_PRIMARY, RING_ON_CANVAS } from '@/lib/ui';

// The directory compared in one table, for a wide screen. Each row is one body. A value that was
// not recorded says so in words, so no cell is ever empty. The narrow layout uses cards instead.
const NOT_RECORDED = 'Not recorded';
const CELL = 'px-4 py-4 align-top text-sm';
const HEAD = 'px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground';

// Scales for a person who gives advice and a building for an organisation.
const iconFor = (category) => (category === 'organisation' ? 'account_balance' : 'balance');

export default function ProviderTable({ providers }) {
  return (
    <div className="mt-6 overflow-x-auto rounded-card border border-border bg-surface">
      <table className="w-full min-w-[56rem] text-left">
        <caption className="sr-only">Providers compared by services, location, languages and cost</caption>
        <thead className="border-b border-border bg-canvas">
          <tr>
            {['Provider', 'Services', 'Location', 'Languages', 'Cost', 'Action'].map((name) => (
              <th key={name} scope="col" className={HEAD}>{name}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {providers.map((p) => (
            <tr key={p.id}>
              <th scope="row" className={`${CELL} w-[20rem] font-normal`}>
                <div className="flex gap-3">
                  <span aria-hidden="true" className="grid h-11 w-11 shrink-0 place-items-center rounded-card bg-canvas text-primary">
                    <Icon name={iconFor(p.category)} className="text-xl" />
                  </span>
                  <div className="min-w-0">
                    <Link to={`/directory/${p.id}`} className={`inline-flex min-h-touch items-center font-head text-xl leading-heading text-primary hover:underline ${RING_ON_CANVAS}`}>
                      {p.name}
                    </Link>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{typeLabel(p.type)}</p>
                    {/* The cards say when an entry is old. The table must not hide it. */}
                    {readableDay(p.last_checked_at) && (
                      <p className="mt-1 text-xs text-muted-foreground">Details last checked {readableDay(p.last_checked_at)}</p>
                    )}
                    {p.stale && (
                      <p className="mt-1 text-xs font-semibold text-warning-strong">Not re-checked for over six months. Confirm by phone first.</p>
                    )}
                  </div>
                </div>
              </th>
              <td className={CELL}>{p.services || NOT_RECORDED}</td>
              <td className={CELL}>{p.location || NOT_RECORDED}</td>
              <td className={CELL}>{p.languages || NOT_RECORDED}</td>
              <td className={CELL}>{p.is_free ? 'Free' : 'May charge a fee. Ask first.'}</td>
              <td className={`${CELL} w-[13rem]`}>
                {/* Words, not colour, say whether a booking can be asked for here. */}
                {p.bookable ? (
                  <>
                    <span className="inline-block rounded-pill border border-info bg-primary-subtle px-2.5 py-1 text-xs font-semibold text-info">Bookings open</span>
                    <Link to={`/directory/book/${p.id}`} className={`${BUTTON_PRIMARY} mt-2 w-full`}>
                      Request consultation{' '}<span className="sr-only">with {p.name}</span>
                    </Link>
                  </>
                ) : (
                  <>
                    <span className="inline-block rounded-pill border border-border bg-badge px-2.5 py-1 text-xs font-semibold text-muted-foreground">Contact directly</span>
                    <Link to={`/directory/${p.id}`} className={`${BUTTON_OUTLINE} mt-2 w-full`}>
                      Expand listing{' '}<span className="sr-only">for {p.name}</span>
                    </Link>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
