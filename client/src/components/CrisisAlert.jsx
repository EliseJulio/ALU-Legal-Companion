import { TriangleAlert } from 'lucide-react';

// Outlined and never filled. The crisis path must not look like an alarm. A solid red block
// would tell a person that asking for help is an error.
export default function CrisisAlert() {
  return (
    <div role="alert" className="rounded border border-warning-border border-l-4 border-l-warning bg-warning-subtle p-3">
      {/* h3 and not h2. Guide pages list their five sections as h2. This block stays in the
          heading outline without joining that list. */}
      <h3 className="flex items-center gap-2 font-bold text-warning-strong">
        <TriangleAlert aria-hidden="true" className="h-4 w-4" />
        If you are in danger right now
      </h3>
      {/* The ring offset has the colour of this block. Without it the ring shows a white halo. */}
      <ul className="mt-2 space-y-1 text-sm">
        <li>
          <a
            href="tel:3029"
            className="inline-flex min-h-touch items-center gap-2 focus-visible:ring-2 focus-visible:ring-primary-strong focus-visible:ring-offset-2 focus-visible:ring-offset-warning-subtle"
          >
            <span className="font-mono text-base font-bold text-primary">3029</span>{' '}
            <span>Isange One Stop Centre</span>
          </a>
        </li>
        <li>
          <a
            href="tel:112"
            className="inline-flex min-h-touch items-center gap-2 focus-visible:ring-2 focus-visible:ring-primary-strong focus-visible:ring-offset-2 focus-visible:ring-offset-warning-subtle"
          >
            <span className="font-mono text-base font-bold text-primary">112</span>{' '}
            <span>Police</span>
          </a>
        </li>
      </ul>
      <p className="mt-2 text-xs text-muted-foreground">Free, confidential, 24 hours.</p>
    </div>
  );
}
