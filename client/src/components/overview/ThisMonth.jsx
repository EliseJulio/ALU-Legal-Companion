import Panel from '@/components/overview/Panel';
import CardState from '@/components/overview/CardState';
import { plural } from '@/lib/overview';

// How many questions this lawyer answered this month and how long an answer took on average. The
// numbers are counts and one average. They come from the server and say nothing about who asked.
export default function ThisMonth({ summary, loading, error, className = '' }) {
  const answered = summary?.answered_this_month ?? 0;
  const average = summary?.average_wait_days;
  return (
    <Panel id="this-month" title="This month" className={className}>
      <CardState
        loading={loading}
        error={error}
        empty={summary && answered === 0 && <p>You have not answered a question this month yet.</p>}
      >
        <p className="flex items-baseline gap-2">
          <span className="font-sans text-[40px] font-medium leading-none tracking-tight text-ink">{answered}</span>
          <span className="text-[15px] text-muted-foreground">{plural(answered, 'question')} answered</span>
        </p>
        {typeof average === 'number' && (
          <p className="mt-2.5 text-sm text-muted-foreground">
            Average wait for an answer: {average} {plural(average, 'day')}.
          </p>
        )}
      </CardState>
    </Panel>
  );
}
