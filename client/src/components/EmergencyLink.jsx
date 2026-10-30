import { Link } from 'react-router-dom';
import Icon from '@/components/Icon';
import { RING_ON_CHROME } from '@/lib/ui';

// The link to the emergency numbers. It is a pale pill with crimson text so it stands out on
// the dark side bar. Crimson text on the navy itself would fail. It is always in the side bar
// or the phone bar. It is never inside a menu.
// `compact` is for the narrow side bar. The words stay on the screen, small and under the icon,
// because not everyone knows the symbol. On a phone the pill is small and its words take two lines,
// so the brand, this link and Menu fit on one row. From 640 px up it is the full pill.
export default function EmergencyLink({ className = '', compact = false }) {
  const shape = compact
    ? 'rounded-pill lg:flex-col lg:gap-0.5 lg:rounded-xl lg:px-1 lg:py-1.5 lg:text-center lg:text-[11px] lg:leading-tight'
    : 'rounded-pill';
  return (
    <Link
      to="/emergency"
      className={`inline-flex min-h-touch max-w-[7.5rem] items-center justify-center gap-1.5 bg-pill px-2.5 text-xs font-semibold leading-tight text-pill-foreground sm:max-w-none sm:px-4 sm:text-sm sm:leading-normal ${shape} ${RING_ON_CHROME} ${className}`}
    >
      <Icon name="warning" className={compact ? 'text-base lg:text-xl' : 'text-base'} />
      Emergency numbers
    </Link>
  );
}
