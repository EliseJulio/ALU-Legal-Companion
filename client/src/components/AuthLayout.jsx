import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { RING_ON_CANVAS } from '@/lib/ui';

// The frame the account entry pages share: a small label for the kind of page, the one heading,
// a line that says what the page is for, the page's own content and a closing note. The note is
// the same everywhere. It reminds the reader to keep a password private and that emergency
// numbers do not need an account. The page is narrow so a line of text stays readable and a form
// does not stretch across a wide screen. Page titles come from the one h1 (usePageTitle).
export default function AuthLayout({ eyebrow, title, intro, children }) {
  // When the same page changes its state (a form becomes "Check your email") the button that
  // was pressed is gone. Focus moves to the new heading so a keyboard or screen reader user
  // is not left at the top of the page. The first heading of a page is left alone.
  const heading = useRef(null);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    heading.current?.focus();
  }, [title]);
  return (
    <div className="max-w-xl">
      {eyebrow && <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{eyebrow}</p>}
      <h1 ref={heading} tabIndex={-1} className="mt-1 font-head text-4xl leading-heading text-primary focus:outline-none md:text-5xl">{title}</h1>
      {intro && <p className="mt-3 text-muted-foreground">{intro}</p>}
      {children}
      <div className="mt-10 border-t border-border pt-4 text-sm text-muted-foreground">
        <p>Keep your password private. You can browse public information without signing in.</p>
        <Link
          to="/emergency"
          className={`mt-1 inline-flex min-h-touch items-center font-semibold text-warning-strong underline underline-offset-2 ${RING_ON_CANVAS}`}
        >
          Emergency help remains available<span aria-hidden="true"> →</span>
        </Link>
      </div>
    </div>
  );
}
