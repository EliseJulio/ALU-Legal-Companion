import Icon from '@/components/Icon';
import { secureAddress } from '@/lib/url';

// An authentic statutory plaque for Rwandan enacted legislation from the Official Gazette
// (Inyandiko y'Amategeko). Connects the guide's legal section to statutory law rather
// than generic AI text.
export default function OfficialGazetteCallout({ sourceLaw, sourceUrl }) {
  if (!sourceLaw) return null;
  const lawLink = secureAddress(sourceUrl);

  return (
    <aside aria-label="Official Rwandan Statutory Reference" className="mb-4 rounded border border-border bg-surface-subtle p-4 text-xs text-ink">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2.5">
        <div className="flex items-center gap-1.5 font-semibold text-primary">
          <Icon name="verified" className="text-base text-primary" />
          <span className="uppercase tracking-wider">Official Gazette of Rwanda</span>
          <span className="font-normal text-muted-foreground">· Inyandiko y'Amategeko</span>
        </div>
        <span className="rounded bg-primary-subtle px-2 py-0.5 font-mono text-[11px] font-medium text-primary">
          Enacted Statute
        </span>
      </div>
      <div className="mt-2.5">
        <p className="font-mono text-xs font-semibold leading-relaxed text-ink">Statutory Basis: {sourceLaw}</p>
        <p className="mt-1 text-muted-foreground">
          Enacted by the Parliament of Rwanda. Codified and published under the authority of the Republic of Rwanda.
        </p>
        {lawLink && (
          <a
            href={lawLink}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 font-semibold text-primary underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
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
