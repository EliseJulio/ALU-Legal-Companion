import { numberedSteps } from '@/lib/numberedSteps';

// One of the five parts of a guide. The text keeps its line breaks. The id lets the contents
// list on the page jump here. Text that is a numbered list is shown as a list with bold numbers.
export default function GuideSection({ id, title, callout, children }) {
  const steps = numberedSteps(children);
  return (
    <section id={id} aria-labelledby={id ? `${id}-title` : undefined} className="scroll-mt-6">
      <h2 id={id ? `${id}-title` : undefined} className="font-head text-[22px] leading-[1.25] tracking-[-0.02em] text-ink">{title}</h2>
      {callout && <div className="mt-3">{callout}</div>}
      {steps ? (
        <ol className="mt-3 max-w-[70ch] list-decimal space-y-3 pl-7 text-[15px] leading-[1.7] text-muted-foreground marker:font-bold marker:text-primary-text">
          {steps.map((step, i) => <li key={i} className="whitespace-pre-line pl-1">{step}</li>)}
        </ol>
      ) : (
        <div className="mt-3 max-w-[70ch] whitespace-pre-line text-[15px] leading-[1.7] text-muted-foreground">{children}</div>
      )}
    </section>
  );
}
