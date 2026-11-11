import { ScheduleRow } from '@/components/ScheduleItem';
import { longDay } from '@/lib/schedule';
import { CARD } from '@/lib/ui';

const byWhen = (a, b) => `${a.date} ${a.time ?? ''}`.localeCompare(`${b.date} ${b.time ?? ''}`);

// The words of each group. A page can swap any of them.
const DEFAULT_GROUPS = {
  accepted: { id: 'appointments-upcoming', title: 'Upcoming', note: 'The lawyer accepted these times.' },
  requested: { id: 'appointments-waiting', title: 'Waiting for the lawyer', note: 'A request is not an appointment until the lawyer accepts it.' },
  earlier: { id: 'appointments-earlier', title: 'Earlier', note: null },
};

// Consultations in up to three lists: accepted and requested and earlier (past or declined).
// Each row is a target for a link that ends in #consult-ID. `groups` overrides the words of a group.
// `order` sets which list comes first. `showDate` puts the day above each row. A row that names its own day turns it off.
export default function AppointmentGroups({
  items,
  order = ['accepted', 'requested', 'earlier'],
  groups = {},
  renderRow = (item) => <ScheduleRow item={item} />,
  showDate = true,
}) {
  const upcoming = items.filter((i) => i.mark === 'accepted').sort(byWhen);
  const waiting = items.filter((i) => i.mark === 'requested').sort(byWhen);
  const earlier = items.filter((i) => i.mark !== 'accepted' && i.mark !== 'requested').sort(byWhen).reverse();
  const lists = { accepted: upcoming, requested: waiting, earlier };

  return (
    <>
      {order.map((kind) => {
        const list = lists[kind];
        if (!list || list.length === 0) return null;
        const { id, title, note } = { ...DEFAULT_GROUPS[kind], ...groups[kind] };
        return (
          <section key={kind} aria-labelledby={id} className={`mt-6 ${CARD}`}>
            <h2 id={id} className="font-head text-lg text-ink">
              {title} <span className="text-sm font-normal text-muted-foreground">({list.length})</span>
            </h2>
            {note && <p className="mt-1 text-sm text-muted-foreground">{note}</p>}
            <ul className="mt-4 divide-y divide-border-soft">
              {list.map((item) => (
                <li
                  key={item.key}
                  data-anchor={item.key}
                  tabIndex={-1}
                  className="rounded-control py-4 first:pt-0 last:pb-0 focus:outline-none"
                >
                  {showDate && <p className="mb-2 text-sm text-muted-foreground">{longDay(item.date)}</p>}
                  {renderRow(item)}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </>
  );
}
