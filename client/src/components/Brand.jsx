import { Link } from 'react-router-dom';
import { RING_ON_CHROME } from '@/lib/ui';
// Imported and not written as a path. A typo is then a build error. The app makes no request to
// any other site.
import aluLogo from '@/assets/brand/alu-logo.png';

// The logo and the name next to it. The name is set in the heading font, as in the design.
// The logo is decoration because the name already says it. A screen reader hears "ALU Legal
// Companion" because of the hidden word in front. In the side bar the name sits under the logo.
// `compact` leaves only the logo on a wide screen. `bar` keeps the brand in one row.
// One alignment is chosen here so two classes never fight over the same property.
export default function Brand({ compact = false, bar = false }) {
  let layout = 'lg:flex-col lg:items-start lg:gap-2';
  if (bar) layout = '';
  else if (compact) layout = 'lg:min-w-touch lg:flex-col lg:items-center lg:justify-center lg:gap-2';
  return (
    <Link to="/" className={`flex min-h-touch min-w-0 items-center gap-2 sm:gap-3 ${layout} ${RING_ON_CHROME}`}>
      <img src={aluLogo} alt="" aria-hidden="true" className={`h-5 w-auto shrink-0 sm:h-7 ${compact ? 'lg:h-5' : ''}`} />
      <span className={`block break-words font-head text-base font-normal leading-tight sm:text-xl ${bar ? '' : 'lg:text-xl'} ${compact ? 'lg:sr-only' : ''}`}>
        <span className="sr-only">ALU </span>
        Legal Companion
      </span>
    </Link>
  );
}
