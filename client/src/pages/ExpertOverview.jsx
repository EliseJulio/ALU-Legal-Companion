import { useAuth } from '@/lib/AuthContext';
import { useApi } from '@/lib/useApi';
import { useNow } from '@/lib/useNow';
import FigureStrip from '@/components/overview/FigureStrip';
import NeedsYou from '@/components/overview/NeedsYou';
import ThisMonth from '@/components/overview/ThisMonth';
import { greeting, figureOf, questionFigures, bookingFigures, sharedFigures, plural } from '@/lib/overview';
import { readableDate } from '@/lib/dates';
import { readableSlot } from '@/lib/bookings';

// The lawyer's overview. Requesters stay anonymous.
// The figures and rows say only anonymous or signed-in. They never show a name or an anonymous token.
export default function ExpertOverview() {
  const { user } = useAuth();
  const questions = useApi('/questions/open');
  const bookings = useApi('/bookings/expert');
  const shared = useApi('/matters/shared');
  const summary = useApi('/questions/summary');

  const now = useNow();
  const q = questionFigures(questions.data ?? []);
  const b = bookingFigures(bookings.data ?? [], now);
  const s = sharedFigures(shared.data ?? []);

  const figures = [
    figureOf('Questions waiting', [questions], {
      value: q.count,
      // The server says how many are overdue. If it cannot, the oldest date is still shown.
      note: summary.data?.overdue > 0
        ? `${summary.data.overdue} overdue`
        : q.oldest ? `Oldest asked ${readableDate(q.oldest)}` : 'None waiting',
    }),
    figureOf('Booking requests', [bookings], {
      value: b.requested,
      note: b.nextRequest ? `Next: ${readableSlot(b.nextRequest.slot)}` : 'None waiting',
    }),
    figureOf('Appointments this week', [bookings], {
      value: b.thisWeek,
      note: `${b.acceptedThisWeek} accepted`,
    }),
    figureOf('Documents to check', [shared], {
      value: s.documents,
      note: s.matters === 0 ? 'None waiting' : `In ${s.matters} shared ${plural(s.matters, 'matter')}`,
    }),
  ];

  return (
    <div className="wide:-mx-2.5">
      <header className="wide:px-2.5">
        <h1 className="font-head text-[length:clamp(24px,2.7vw,30px)] leading-[1.15] tracking-[-0.01em] text-ink">{greeting(user)}</h1>
        <p className="mt-2.5 max-w-reading text-sm leading-[1.6] text-muted-foreground">
          What is waiting for you. Requesters stay anonymous.
        </p>
      </header>

      <FigureStrip figures={figures} />

      <div className="mt-5 grid gap-3 lg:grid-cols-12 lg:items-start">
        <NeedsYou
          questions={questions.data}
          bookings={bookings.data}
          shared={shared.data}
          loading={questions.loading || bookings.loading || shared.loading}
          error={questions.error || bookings.error || shared.error}
        />
        <ThisMonth summary={summary.data} loading={summary.loading} error={summary.error} className="lg:col-span-4" />
      </div>
    </div>
  );
}
