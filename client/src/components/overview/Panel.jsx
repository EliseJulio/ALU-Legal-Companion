import { CARD } from '@/lib/ui';

// A white card with a title. The title is a real heading so a screen reader can jump between cards.
// `action` sits on the title row. It is a link or a picker on the documents card.
export default function Panel({ id, title, action, children, className = '' }) {
  return (
    <section aria-labelledby={id} className={`min-w-0 ${CARD} ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={id} className="font-head text-[15px] leading-[1.3] text-ink">{title}</h2>
        {action}
      </div>
      <div className="mt-3.5">{children}</div>
    </section>
  );
}
