import { Link } from 'react-router-dom';
import Panel from '@/components/overview/Panel';
import CardState from '@/components/overview/CardState';
import StatusWord from '@/components/overview/StatusWord';
import { needsRows, requesterWords } from '@/lib/overview';
import { readableDate } from '@/lib/dates';
import { readableSlot } from '@/lib/bookings';
import { BUTTON_OUTLINE, BUTTON_PRIMARY, RING_ON_CANVAS } from '@/lib/ui';

// One group of rows with its heading. Each row has one action that opens the page where it is done.
function Group({ title, children }) {
  return (
    <div className="mt-4 first:mt-0">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <ul className="mt-2 divide-y divide-border-soft">{children}</ul>
    </div>
  );
}

// A row. The text is what the row is about and the link is the one thing to do with it.
function Row({ title, detail, word, tone, action, to, primary }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0">
      <div className="min-w-0">
        <p className="break-words text-sm font-semibold text-ink">{title}</p>
        <p className="text-[13px] text-muted-foreground">{detail}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {word && <StatusWord word={word} tone={tone} />}
        <Link to={to} className={primary ? BUTTON_PRIMARY : BUTTON_OUTLINE}>{action}</Link>
      </div>
    </li>
  );
}

// What is waiting for a lawyer. Requesters are never named: the words say only anonymous or signed-in.
export default function NeedsYou({ questions, bookings, shared, loading, error }) {
  const rows = needsRows({ questions, bookings, shared });
  const nothing = rows.questions.length + rows.requests.length + rows.matters.length === 0;
  return (
    <Panel id="needs-you" title="Needs you" action={<Link to="/expert/questions" className={`inline-flex min-h-touch items-center text-sm font-semibold text-info hover:underline underline-offset-2 ${RING_ON_CANVAS}`}>All questions</Link>} className="lg:col-span-8">
      <CardState
        loading={loading}
        error={error}
        empty={nothing && <p>Nothing is waiting for you right now.</p>}
      >
        {rows.questions.length > 0 && (
          <Group title="Questions waiting">
            {rows.questions.map((q) => (
              <Row
                key={q.id}
                title={q.kind === 'anonymous' ? 'Anonymous question' : 'Question from a signed-in person'}
                detail={`Asked ${readableDate(q.created_at) ?? 'recently'}`}
                word={q.overdue ? 'Overdue' : 'Waiting'} tone={q.overdue ? 'urgent' : 'waiting'}
                action="Answer" to="/expert/questions" primary
              />
            ))}
          </Group>
        )}
        {rows.requests.length > 0 && (
          <Group title="Booking requests">
            {rows.requests.map((b) => (
              <Row
                key={b.id}
                title={`Requested for ${readableSlot(b.slot) ?? 'a time to be agreed'}`}
                detail={`${requesterWords(b.requester)}${b.topic ? ` · ${b.topic}` : ''}`}
                word="Requested" tone="waiting"
                action="Review" to="/expert/calendar"
              />
            ))}
          </Group>
        )}
        {rows.matters.length > 0 && (
          <Group title="Shared matters with documents to check">
            {rows.matters.map((m) => (
              <Row
                key={m.id}
                title={m.title}
                detail={`Shared record · ${m.documents_waiting} ${m.documents_waiting === 1 ? 'document' : 'documents'} to check`}
                action="Open" to={`/matters/${m.id}`}
              />
            ))}
          </Group>
        )}
      </CardState>
    </Panel>
  );
}
