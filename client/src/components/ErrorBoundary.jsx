import { Component } from 'react';
import Icon from '@/components/Icon';
import aluLogo from '@/assets/brand/alu-logo.png';
import aluLogoLight from '@/assets/brand/alu-logo-light.png';
// lib/ui.js has no imports, so this stays a plain string with nothing that can fail.
import { CARD } from '@/lib/ui';

// The last line of defence. A thrown error in the page would leave a blank screen.
// Components should still handle the errors they can act on. This catches the ones they missed.
//
// The fallback is a small shell of its own. It must not depend on anything that may have failed.
// It uses no router and no auth and no theme code. Plain anchors do a full page load.
// The theme is already on the page as data-theme from the script in index.html.
// It keeps the Emergency numbers link and the disclaimer.
// The error text is never shown. It goes to the console.
const LOGO_DARK = 'block [:root[data-theme=light]_&]:hidden [@media(prefers-color-scheme:light)]:hidden [:root[data-theme=dark]_&]:block';
const LOGO_LIGHT = 'hidden [:root[data-theme=light]_&]:block [@media(prefers-color-scheme:light)]:block [:root[data-theme=dark]_&]:hidden';
const RING = 'focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-canvas';

function CrashShell() {
  return (
    <div className="flex min-h-screen flex-col bg-canvas text-ink">
      <header className="border-b border-border bg-canvas">
        <div className="flex items-center gap-2 px-4 py-2 md:px-8 md:py-3">
          <a href="/" className={`flex min-h-touch min-w-touch shrink-0 items-center gap-2 rounded-control ${RING}`}>
            <img src={aluLogo} alt="" aria-hidden="true" className={`h-5 w-auto max-w-[3.25rem] shrink-0 object-contain sm:h-7 sm:max-w-none ${LOGO_DARK}`} />
            <img src={aluLogoLight} alt="" aria-hidden="true" className={`h-5 w-auto max-w-[3.25rem] shrink-0 object-contain sm:h-7 sm:max-w-none ${LOGO_LIGHT}`} />
            <span className="sr-only sm:not-sr-only sm:font-head sm:text-base sm:leading-tight">
              <span className="sr-only">ALU</span> Legal Companion
            </span>
          </a>
          <a
            href="/emergency"
            className={`ml-auto inline-flex min-h-touch min-w-touch items-center justify-center gap-2 rounded-control bg-alert px-3 py-2 text-left text-sm font-semibold leading-tight text-alert-foreground sm:whitespace-nowrap sm:px-[18px] ${RING}`}
          >
            <Icon name="warning" />
            Emergency numbers
          </a>
        </div>
      </header>
      <main id="main" className="flex flex-1 items-center justify-center px-4 py-10">
        <div className={`w-full max-w-md text-center ${CARD}`}>
          <h1 className="font-head text-[17px] text-ink">Something went wrong on this page.</h1>
          <p className="mt-2 text-sm text-muted-foreground">Reload the page to try again.</p>
          <div className="mt-5 flex flex-col items-stretch gap-3 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className={`inline-flex min-h-touch items-center justify-center rounded-control bg-primary px-5 py-2.5 font-sans text-sm font-semibold leading-snug text-primary-foreground ${RING.replace('ring-offset-canvas', 'ring-offset-surface')}`}
            >
              Reload page
            </button>
            <a
              href="/"
              className={`inline-flex min-h-touch items-center justify-center rounded-control border border-primary bg-surface px-5 py-2.5 font-sans text-sm font-semibold leading-snug text-primary-text ${RING.replace('ring-offset-canvas', 'ring-offset-surface')}`}
            >
              Go to the home page
            </a>
          </div>
        </div>
      </main>
      <footer className="px-4 py-4 text-center text-sm text-muted-foreground">
        Legal information, not legal advice.
      </footer>
    </div>
  );
}

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, errorInfo) {
    // The technical detail goes to the console for the developer, never to the screen.
    console.error('[ErrorBoundary]', error, errorInfo?.componentStack);
  }

  render() {
    return this.state.failed ? <CrashShell /> : this.props.children;
  }
}
