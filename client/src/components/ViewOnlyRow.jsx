import { ScheduleMark } from '@/components/ScheduleItem';
import { longDay } from '@/lib/schedule';

// One item for the admin. It names the provider and the state and nothing else.
// There is no action and no requester and no topic on this page. The admin's rows do not carry those fields.
export default function ViewOnlyRow({ item }) {
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
        <p className="break-words text-sm text-muted-foreground">{longDay(item.date)}</p>
      </div>
    </div>
  );
}
