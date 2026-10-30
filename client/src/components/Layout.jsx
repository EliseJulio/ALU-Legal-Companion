import { useRef } from 'react';
import { useLocation } from 'react-router-dom';
import SideNav from '@/components/SideNav';
import Footer from '@/components/Footer';
import { useSidebar } from '@/lib/sidebar';
import { usePageTitle } from '@/lib/usePageTitle';

// The page padding. Content is 1200 wide on a big screen. The padding grows with the screen.
const PAGE = 'px-5 py-8 md:px-12 md:py-10';

// The frame of every page: the side navigation on the left and the page with its footer next
// to it. Below the lg width the side navigation becomes a slim bar above the page. The menu can
// be narrowed or hidden. The page then takes the space. The choice is kept on this device.
export default function Layout({ children }) {
  const { pathname } = useLocation();
  const { mode, setMode, show } = useSidebar();
  // The front door is made of full-width bands, each with its own colour. It sets its own
  // width and padding. Every other page sits in the same centred column.
  const bands = pathname === '/';
  const mainRef = useRef(null);
  // Each page gets its own title in the browser tab, taken from its heading.
  usePageTitle(mainRef, bands);

  return (
    <div className={`flex min-h-screen flex-col ${mode === 'hidden' ? '' : 'lg:flex-row'}`}>
      {/* The first thing a keyboard user can reach. It jumps over the navigation. */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-surface focus:px-3 focus:py-2 focus:text-primary focus:ring-2 focus:ring-focus"
      >
        Skip to main content
      </a>
      <SideNav mode={mode} onMode={setMode} onShow={show} />
      <div className="flex min-w-0 flex-1 flex-col">
        <main id="main" ref={mainRef} className={bands ? 'w-full flex-1' : `mx-auto w-full max-w-content flex-1 ${PAGE}`}>
          {children}
        </main>
        <Footer />
      </div>
    </div>
  );
}
