import { Link } from 'react-router-dom';
import { DOMAINS } from '@/lib/directory';
import { RING_ON_CANVAS } from '@/lib/ui';

// One published guide as a list card. The saved list uses it too because the server returns the
// same fields for both. It is a list item so the page puts it inside a ul. The title is the one
// link and its box is stretched over the whole card, so the card is all clickable but a screen
// reader hears only the title. The "Read guide" words are only a cue.
// `action` is an optional control under the card, such as a Remove button. It sits above the
// stretched link so it can be pressed.
export default function GuideCard({ guide, action }) {
  const subject = DOMAINS.find((d) => d.value === guide.domain)?.label;
  return (
    <li className="relative flex flex-col gap-4 rounded-card border border-border bg-surface p-6 focus-within:border-primary hover:border-primary has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-focus has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-canvas">
      {subject && <p className="text-xs font-semibold text-muted-foreground">{subject}</p>}
      <h2 className="font-head text-2xl leading-heading text-primary">
        <Link to={`/guides/${guide.id}`} className={`rounded after:absolute after:inset-0 after:content-[''] ${RING_ON_CANVAS}`}>
          {guide.title}
        </Link>
      </h2>
      {guide.summary && <p className="text-sm text-muted-foreground">{guide.summary}</p>}
      <p className="w-fit rounded bg-primary-subtle px-2 py-0.5 font-mono text-xs text-primary">
        {guide.source_law}
      </p>
      <span aria-hidden="true" className="mt-auto inline-flex min-h-button w-fit items-center rounded bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground">Read guide →</span>
      {action && <div className="relative z-10">{action}</div>}
    </li>
  );
}
