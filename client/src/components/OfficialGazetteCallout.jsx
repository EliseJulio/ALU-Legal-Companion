import Icon from '@/components/Icon';
import { secureAddress } from '@/lib/url';
import { instrumentOf } from '@/lib/sourceKind';
import { RING } from '@/lib/ui';

// A callout that cites the official source of a guide from the Official Gazette (Inyandiko y'Amategeko).
// It links the guide's legal section to the text.
export default function OfficialGazetteCallout({ sourceLaw, sourceUrl }) {
  if (!sourceLaw) return null;
  const lawLink = secureAddress(sourceUrl);
  const { badge, note } = instrumentOf(sourceLaw);

  return (
    <aside aria-label="Official Rwandan statutory reference" className="mb-4 rounded-card bg-chrome-raised p-4 text-xs text-ink">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2.5">
        <div className="flex items-center gap-1.5 font-semibold text-ink">
          <Icon name="verified" className="text-base text-primary-text" />
          <span>Official Gazette of Rwanda</span>
          <span className="font-normal text-muted-foreground">· Inyandiko y'Amategeko</span>
        </div>
        <span className="rounded-control bg-primary-subtle px-2.5 py-0.5 font-mono text-xs font-medium text-primary-text">
          {badge}
        </span>
      </div>
      <div className="mt-2.5">
        <p className="font-mono text-xs font-semibold leading-relaxed text-ink">Statutory basis: {sourceLaw}</p>
        <p className="mt-1 text-muted-foreground">
          {note}
        </p>
        {lawLink && (
          <a
            href={lawLink}
            target="_blank"
            rel="noopener noreferrer"
            className={`mt-2 inline-flex min-h-touch items-center gap-1 font-semibold text-primary-text underline ${RING}`}
          >
            <span>Read enacted law in the Official Gazette</span>
            <span aria-hidden="true">↗</span>
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        )}
      </div>
    </aside>
  );
}
