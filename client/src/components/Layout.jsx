import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import BottomBar from '@/components/BottomBar';
import Footer from '@/components/Footer';
import MoreSheet from '@/components/MoreSheet';
import { MenuPanel } from '@/components/MenuPanel';
import PageProgress from '@/components/PageProgress';
import SignedOutNotice from '@/components/SignedOutNotice';
import TopBar from '@/components/TopBar';
import { useAuth } from '@/lib/AuthContext';
import { rememberSignedOutOffline } from '@/lib/signedOutNotice';
import { useLoadingBar } from '@/lib/pagePending';
import { quickLinks, sheetGroups } from '@/lib/nav';
import { useNarrowMenu } from '@/lib/sidebar';
import { useMediaQuery } from '@/lib/useMediaQuery';
import { usePageTitle } from '@/lib/usePageTitle';

// The wide layout starts at this width. Tailwind's `wide` screen uses the same number (1180px).
const WIDE = '(min-width: 1180px)';

// The page padding. Content is 1200 wide on a big screen. The padding grows with the screen.
const PAGE = 'px-5 py-8 md:px-12 md:py-10';
// With the sidebar the page sits 10 px in from the column. It sits 28 px under the top bar.
const PAGE_WIDE = 'wide:px-2.5 wide:pt-7 wide:pb-8';

// The grid of the wide layout. The sidebar is the first column at 264 px or 76 px.
// The top bar and the page are in the second. Whole class names so Tailwind builds them.
// The grid keeps a 24 px margin from the window edge and 12 px between the panel and the page.
// It never grows past 1480 px.
const GRID = 'wide:mx-auto wide:grid wide:max-w-[1480px] wide:grid-cols-[auto_minmax(0,1fr)] wide:grid-rows-[auto_1fr] wide:gap-x-3 wide:px-6 wide:pt-3';
const PLACE = 'wide:col-start-2';

// The frame of every page. On a wide screen: a top bar, the sidebar and the page with its footer.
// On a phone and a tablet: a slim top bar, the page and a bottom bar with a More sheet. A visitor on a
// wide screen has no sidebar. The layout is one frame for every person.
export default function Layout({ children }) {
  const location = useLocation();
  const { pathname } = location;
  const { user, signOut: endSession } = useAuth();
  const navigate = useNavigate();
  const wide = useMediaQuery(WIDE);
  const [narrow, setNarrow] = useNarrowMenu();
  const [moreOpen, setMoreOpen] = useState(false);
  // What the status line says to a screen reader after the menu changes.
  const [note, setNote] = useState('');
  const mainRef = useRef(null);
  // Set when a person closes the More sheet, so focus goes back to the More button. A page change
  // does not set it, so focus does not jump after a link.
  const returnFocus = useRef(false);
  const wasSignedIn = useRef(Boolean(user));
  // The front door is made of full-width bands, each with its own colour. Every other page sits in
  // the same centred column.
  const bands = pathname === '/';
  // Each page gets its own title in the browser tab, taken from its heading.
  usePageTitle(mainRef, bands);
  // While the next page downloads the old page stays on screen.
  // After 150 ms the thin bar appears under the top bar. The old page is dimmed and marked busy.
  const loading = useLoadingBar();

  // A new page closes the More sheet.
  const [openedOn, setOpenedOn] = useState(pathname);
  if (pathname !== openedOn) {
    setOpenedOn(pathname);
    if (moreOpen) setMoreOpen(false);
  }

  // Signing out from any page ends on the landing page. The session is cleared even if the request failed.
  // The move replaces the page so Back does not return to a page that now says "Sign in to reach this page".
  // A second press while the first is on its way sends nothing.
  // A ref is used and not state so the guard holds before the next render.
  const signingOut = useRef(false);
  const signOut = useCallback(async () => {
    if (signingOut.current) return;
    signingOut.current = true;
    try {
      const reached = await endSession();
      // The browser is signed out either way. When no answer came from the server, the landing page
      // says so once, because the token may still work there.
      if (!reached) rememberSignedOutOffline();
      navigate('/', { replace: true });
    } finally {
      signingOut.current = false;
    }
  }, [endSession, navigate]);

  const closeMore = useCallback(() => {
    returnFocus.current = true;
    setMoreOpen(false);
  }, []);

  // Runs after the sheet is gone and the page is no longer inert, so the button can take focus.
  useEffect(() => {
    if (!moreOpen && returnFocus.current) {
      returnFocus.current = false;
      document.getElementById('more-button')?.focus();
    }
  }, [moreOpen]);

  // Signing out takes the menu away with the person. Focus goes to the start of the page.
  useEffect(() => {
    if (wasSignedIn.current && !user) mainRef.current?.focus();
    wasSignedIn.current = Boolean(user);
  }, [user]);

  // Narrowing or widening keeps focus on the same toggle because the sidebar does not remount.
  // The status line tells a screen reader what changed.
  const choose = (next) => {
    setNote(next ? 'Menu narrowed' : 'Menu widened');
    setNarrow(next);
  };

  const sidebar = wide && Boolean(user);
  const shell = sidebar ? GRID : 'flex flex-col';
  const place = sidebar ? PLACE : '';

  return (
    <>
      {/* While the More sheet is open the page behind it is inert: it cannot be read or reached. */}
      <div inert={moreOpen || undefined} className={`min-h-screen flex-col ${shell}`}>
        {/* The first thing a keyboard user can reach. It jumps over the navigation. */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-control focus:bg-surface focus:px-3 focus:py-2 focus:text-primary-text focus:ring-2 focus:ring-focus"
        >
          Skip to main content
        </a>
        <p role="status" className="sr-only">{note}</p>

        {/* The top bar comes first in the page, so the emergency numbers are early in the keyboard order.
            The grid below places it beside the sidebar. */}
        <TopBar user={user} phone={!wide} onSignOut={signOut} className={`${sidebar ? `wide:row-start-1 ${place}` : ''}`} />

        {sidebar && (
          <MenuPanel
            user={user}
            narrow={narrow}
            onToggle={() => choose(!narrow)}
            onSignOut={signOut}
            className="wide:col-start-1 wide:row-span-2 wide:row-start-1"
          />
        )}

        <div className={`flex min-w-0 flex-1 flex-col pb-[calc(6rem+env(safe-area-inset-bottom))] wide:pb-0 ${sidebar ? `wide:row-start-2 ${place}` : ''}`}>
          {/* Directly under the top bar, full width of the page area. */}
          <PageProgress show={loading} />
          <main
            id="main"
            ref={mainRef}
            tabIndex={-1}
            aria-busy={loading ? 'true' : undefined}
            className={`outline-none transition-opacity ${loading ? 'opacity-60' : ''} ${bands ? 'w-full flex-1' : `mx-auto w-full max-w-content flex-1 ${PAGE} ${sidebar ? PAGE_WIDE : ''}`}`}
          >
            {/* Keyed on the location, so the notice reads its flag again on every arrival at the landing page. */}
            {pathname === '/' && (
              <div className="mx-auto w-full max-w-content px-5 pt-5 md:px-8">
                <SignedOutNotice key={location.key} />
              </div>
            )}
            {children}
          </main>
          <Footer />
        </div>

        {!wide && (
          <BottomBar links={quickLinks(user)} moreOpen={moreOpen} onMore={() => setMoreOpen(true)} />
        )}
      </div>

      <MoreSheet
        open={moreOpen && !wide}
        groups={sheetGroups(user)}
        user={user}
        onClose={closeMore}
        onSignOut={() => { setMoreOpen(false); signOut(); }}
      />
    </>
  );
}
