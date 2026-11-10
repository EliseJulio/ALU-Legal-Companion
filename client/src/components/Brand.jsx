import { Link } from 'react-router-dom';
import { RING_ON_CANVAS, RING_ON_CHROME } from '@/lib/ui';
import { readSession } from '@/lib/auth';
import { homeFor } from '@/lib/nav';
// Imported and not written as a path. A typo is then a build error. The app makes no request to
// any other site.
import aluLogo from '@/assets/brand/alu-logo.png';
import aluLogoLight from '@/assets/brand/alu-logo-light.png';

// Two logos, one per theme. The theme is set on the page as data-theme, or it follows the device
// when no choice is made (lib/theme.js). The classes below pick the right one with no script.
// The rules are ordered by specificity, not by position: a choice on the page beats the device.
const SHOW_DARK = 'block [:root[data-theme=light]_&]:hidden [@media(prefers-color-scheme:light)]:hidden [:root[data-theme=dark]_&]:block';
const SHOW_LIGHT = 'hidden [:root[data-theme=light]_&]:block [@media(prefers-color-scheme:light)]:block [:root[data-theme=dark]_&]:hidden';

// The logo and the name next to it, linked to the front page or, when signed in, to the person's overview. The logo is decoration because the
// name says it. `compact` keeps only the logo on the screen: the name is still read out.
// `tone` is the background the link sits on, so its focus ring has the right gap colour.
// `duplicate` is for a second copy of the same link on the page. A screen reader and Tab skip it.
// `stacked` is the sidebar's brand: "Legal" with "Companion" under it, the logo to the left. It keeps
// the same accessible name, "ALU Legal Companion".
export default function Brand({ tone = 'canvas', compact = false, duplicate = false, stacked = false }) {
  const ring = tone === 'chrome' ? RING_ON_CHROME : RING_ON_CANVAS;
  // A signed-in person goes to their own overview. A visitor goes to the front page.
  // The stored session is read here so the link works without the auth provider around it.
  const to = homeFor(readSession());
  // The wordmark is wide. In the 76 px narrowed sidebar and the phone bar it is held to a smaller width.
  // The sidebar logo is 25 px high. The phone bar keeps its small logo.
  const logoSize = stacked
    ? (compact ? 'h-auto max-h-[25px] w-11 shrink-0 object-contain' : 'h-[25px] w-auto shrink-0')
    : compact ? 'h-5 w-auto max-w-[3.25rem] object-contain shrink-0' : 'h-6 w-auto shrink-0 sm:h-7';
  return (
    <Link
      to={to}
      tabIndex={duplicate ? -1 : undefined}
      aria-hidden={duplicate || undefined}
      className={`flex min-h-touch min-w-touch shrink-0 items-center gap-2 rounded-control ${ring}`}
    >
      <img src={aluLogo} alt="" aria-hidden="true" data-logo="dark" className={`${logoSize} ${SHOW_DARK}`} />
      <img src={aluLogoLight} alt="" aria-hidden="true" data-logo="light" className={`${logoSize} ${SHOW_LIGHT}`} />
      {stacked && !compact ? (
        <span className="font-head text-[16px] font-semibold leading-[1.15] tracking-[-0.01em]">
          <span className="sr-only">ALU</span>{' '}
          <span className="block">Legal</span>{' '}
          <span className="block">Companion</span>
        </span>
      ) : (
        <span className={`font-head text-base leading-tight ${compact ? 'sr-only' : 'sm:text-base'}`}>
          <span className="sr-only">ALU</span>{' '}
          Legal Companion
        </span>
      )}
    </Link>
  );
}
