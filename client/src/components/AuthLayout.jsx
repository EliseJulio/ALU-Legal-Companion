import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { RING_ON_CANVAS, PAGE_TITLE, TAB, TAB_CURRENT, TAB_IDLE } from '@/lib/ui';

// The switch at the top of the sign-in and sign-up cards. Both tabs are links to their own page,
// so the one on screen is marked with aria-current and the other is a link to it.
export function AuthTabs({ current }) {
  return (
    <nav aria-label="Sign in or create an account" className="mb-6 flex flex-wrap gap-1">
      {current === 'signin'
        ? <span aria-current="page" className={`${TAB} ${TAB_CURRENT}`}>Sign in</span>
        : <Link to="/login" className={`${TAB} ${TAB_IDLE}`}>Sign in</Link>}
      {current === 'create'
        ? <span aria-current="page" className={`${TAB} ${TAB_CURRENT}`}>Create account</span>
        : <Link to="/register" className={`${TAB} ${TAB_IDLE}`}>Create account</Link>}
    </nav>
  );
}

// The frame the account entry pages share. On the left it has a small label for the kind of page and the one heading
// and a line that says what the page is for and an optional aside.
// The form sits in a column on the right on a wide screen and under the heading on a phone.
// The closing note is the same everywhere.
// It reminds the reader to keep a password private. It says emergency numbers do not need an account.
// Page titles come from the one h1 (usePageTitle).
export default function AuthLayout({ eyebrow, title, intro, aside, children }) {
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
    <div>
      {/* The source order is heading then form then aside so a phone reads the form before the aside.
          On a wide screen the heading and aside sit in the left column and the form in the right. */}
      <div className="grid gap-10 wide:grid-cols-[minmax(0,1fr)_minmax(0,440px)] wide:gap-x-16">
        <header className="min-w-0 wide:col-start-1 wide:row-start-1 wide:self-start wide:pt-8">
          {eyebrow && <p className="text-sm font-medium text-muted-foreground">{eyebrow}</p>}
          <h1 ref={heading} tabIndex={-1} className={`mt-1 ${PAGE_TITLE} focus:outline-none`}>{title}</h1>
          {intro && <p className="mt-3 max-w-reading text-muted-foreground">{intro}</p>}
        </header>
        <div className="min-w-0 wide:col-start-2 wide:row-span-2 wide:row-start-1 wide:self-start wide:pt-8">{children}</div>
        {aside && <div className="min-w-0 max-w-reading wide:col-start-1 wide:row-start-2 wide:self-start">{aside}</div>}
      </div>
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
