import { Link } from 'react-router-dom';
import Icon from '@/components/Icon';
import { RING_ON_CANVAS } from '@/lib/ui';

// The link to the emergency numbers. It is the one red thing in the app.
// It is on every page for every person. It sits in the top bar and never inside a menu.
// The words are always shown because not everyone knows the warning sign.
// On a phone the words may take two lines so the pill stays one touch target tall or taller.
// `roomy` is the wide top bar with 18 px either side. Elsewhere it stays compact.
// `short` is the phone bar. "Numbers" is read out only so the pill stays on one line.
// The link keeps its full name for a screen reader.
export default function EmergencyLink({ className = '', roomy = false, short = false }) {
  const padding = roomy ? 'px-[18px]' : 'px-3 sm:px-4';
  return (
    <Link
      to="/emergency"
      // The short form names itself in full, so a screen reader hears "Emergency numbers".
      aria-label={short ? 'Emergency numbers' : undefined}
      className={`inline-flex min-h-touch min-w-touch items-center justify-center gap-2 rounded-control bg-alert py-2 text-left text-sm font-semibold leading-tight text-alert-foreground sm:whitespace-nowrap ${padding} ${RING_ON_CANVAS} ${className}`}
    >
      <Icon name="warning" />
      {short ? 'Emergency' : 'Emergency numbers'}
    </Link>
  );
}
