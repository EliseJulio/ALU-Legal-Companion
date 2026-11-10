import Icon from '@/components/Icon';

// Outlined and never filled. The crisis path must not look like an alarm. A solid red block
// would tell a person that asking for help is an error.
export default function CrisisAlert() {
  return (
    <div role="alert" className="rounded-card border border-border bg-warning-subtle p-[22px]">
      {/* A level 2 heading, so the block appears in the page's heading outline. */}
      <h2 className="flex items-center gap-2 font-head text-[15px] leading-[1.3] text-ink">
        <Icon name="warning" className="text-base" />
        If you are in danger right now
      </h2>
      {/* The ring offset has the colour of this block. Without it the ring shows a white halo. */}
      <ul className="mt-2 space-y-1 text-sm">
        <li>
          <a
            href="tel:3029"
            className="inline-flex min-h-touch items-center gap-2 focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-warning-subtle"
          >
            <span className="font-mono text-base font-bold text-alert-text">3029</span>{' '}
            <span>Isange One Stop Centre</span>
            <span className="rounded-control bg-badge px-1.5 py-0.5 text-xs font-semibold text-muted-foreground">Toll-free</span>
          </a>
        </li>
        <li>
          <a
            href="tel:112"
            className="inline-flex min-h-touch items-center gap-2 focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-warning-subtle"
          >
            <span className="font-mono text-base font-bold text-alert-text">112</span>{' '}
            <span>Police</span>
            <span className="rounded-control bg-badge px-1.5 py-0.5 text-xs font-semibold text-muted-foreground">Toll-free</span>
          </a>
        </li>
      </ul>
      <p className="mt-2 text-xs text-muted-foreground">
        Free, confidential, 24 hours · Toll-free / Ubuntu (dialable without airtime on MTN and Airtel Rwanda).
      </p>
    </div>
  );
}
