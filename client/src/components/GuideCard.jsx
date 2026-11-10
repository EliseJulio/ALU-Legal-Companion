import { Link } from 'react-router-dom';
import { DOMAINS } from '@/lib/directory';
import { RING_ON_CANVAS, CARD } from '@/lib/ui';

// One published guide as a list card. The saved list uses it too because the server returns the
// same fields for both. It is a list item so the page puts it inside a ul. The title is the one
// link and its box is stretched over the whole card, so the card is all clickable but a screen
// reader hears only the title. The "Read guide" words are only a cue.
// `action` is an optional control under the card, such as a Remove button. It sits above the
// stretched link so it can be pressed.
export default function GuideCard({ guide, action }) {
  const subject = DOMAINS.find((d) => d.value === guide.domain)?.label;
  return (
    <li className={`relative flex flex-col gap-3 ${CARD} hover:border-calm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-focus has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-canvas`}>
      {/* The topic is a small grey pill, as on the overview cards. */}
      {subject && (
        <p className="w-fit rounded-control bg-chrome-raised px-[11px] py-0.5 text-xs font-medium text-muted-foreground">{subject}</p>
      )}
      <h2 className="font-head text-[17px] leading-[1.3] tracking-[-0.01em] text-ink">
        <Link to={`/guides/${guide.id}`} className={`inline-flex min-h-touch items-center rounded-control after:absolute after:inset-0 after:content-[''] ${RING_ON_CANVAS}`}>
          {guide.title}
        </Link>
      </h2>
      {guide.summary && <p className="text-sm text-muted-foreground">{guide.summary}</p>}
      {/* The law is a citation in the mono face. It is quiet and has no box. */}
      <p className="font-mono text-xs text-faint">{guide.source_law}</p>
      <span aria-hidden="true" className="mt-auto pt-1 text-sm font-medium text-primary-text">Read guide →</span>
      {action && <div className="relative z-10">{action}</div>}
    </li>
  );
}
