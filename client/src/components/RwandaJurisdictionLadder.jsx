import { useApi } from '@/lib/useApi';
import { CARD } from '@/lib/ui';

// The dispute ladder, drawn from the steps an admin published. No step text is typed here. When
// no step is published the component draws nothing, so an empty box never shows.
// The parent decides when it appears: the office in the answer must be an Abunzi committee.
// `defaultOpen` opens it at once. It is closed by default inside an answer.
export default function RwandaJurisdictionLadder({ defaultOpen = false }) {
  const { data: steps } = useApi('/directory/ladder');
  if (!steps?.length) return null;

  return (
    <details open={defaultOpen} className={`group mt-6 ${CARD}`}>
      <summary className="flex min-h-touch cursor-pointer list-none items-center justify-between gap-3 font-head text-[15px] leading-[1.3] text-ink">
        <span>Dispute ladder</span>
        <span className="text-sm font-semibold text-info group-open:hidden">Show the steps</span>
        <span className="hidden text-sm font-semibold text-info group-open:inline">Hide the steps</span>
      </summary>
      <p className="mt-2 text-sm text-muted-foreground">Follow the steps in order.</p>
      <ol className="mt-4 flex flex-col gap-3">
        {steps.map((step) => (
          <li key={step.id} className="flex gap-3 rounded-card bg-chrome-raised p-4">
            <span aria-hidden="true" className="font-head text-[16px] text-muted-foreground">{step.position}</span>
            <div className="min-w-0">
              <h3 className="font-head text-[16px] leading-[1.3] text-ink">{step.title}</h3>
              {step.tagline && <p className="mt-1 text-sm font-semibold text-muted-foreground">{step.tagline}</p>}
              {step.description && <p className="mt-2 text-sm">{step.description}</p>}
              {step.law_cited && <p className="mt-2 font-mono text-xs text-muted-foreground">{step.law_cited}</p>}
            </div>
          </li>
        ))}
      </ol>
    </details>
  );
}
