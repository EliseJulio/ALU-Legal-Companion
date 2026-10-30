import Icon from '@/components/Icon';

// Outlined and never filled. The crisis path must not look like an alarm. A solid red block
// would tell a person that asking for help is an error.
export default function CrisisAlert() {
  return (
    <div role="alert" className="rounded border border-warning-border border-l-4 border-l-warning bg-warning-subtle p-3.5">
      {/* h3 and not h2. Guide pages list their five sections as h2. This block stays in the
          heading outline without joining that list. */}
      <h3 className="flex items-center gap-2 font-bold text-warning-strong">
        <Icon name="warning" className="text-base" />
        If you are in danger right now
      </h3>
      {/* The ring offset has the colour of this block. Without it the ring shows a white halo. */}
      <ul className="mt-2 space-y-1 text-sm">
        <li>
          <a
            href="tel:3029"
            className="inline-flex min-h-touch items-center gap-2 focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-warning-subtle"
          >
            <span className="font-mono text-base font-bold text-primary">3029</span>{' '}
            <span>Isange One Stop Centre</span>
            <span className="rounded bg-secondary-subtle px-1.5 py-0.2 text-[11px] font-semibold text-secondary">Toll-free</span>
          </a>
        </li>
        <li>
          <a
            href="tel:112"
            className="inline-flex min-h-touch items-center gap-2 focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-warning-subtle"
          >
            <span className="font-mono text-base font-bold text-primary">112</span>{' '}
            <span>Police</span>
            <span className="rounded bg-secondary-subtle px-1.5 py-0.2 text-[11px] font-semibold text-secondary">Toll-free</span>
          </a>
        </li>
      </ul>
      <p className="mt-2 text-xs text-muted-foreground">
        Free, confidential, 24 hours · Toll-free / Ubuntu (dialable without airtime on MTN and Airtel Rwanda).
      </p>
    </div>
  );
}
