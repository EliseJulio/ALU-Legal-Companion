import { useEffect } from 'react';

const SITE_NAME = 'ALU Legal Companion';

// Sets the title of the browser tab from the heading of the page.
// A screen reader says the tab title first when a page opens. A different page needs a different title.
// The heading is read from the main area and watched. A page that loads its name later is covered.
// No page has to set a title of its own.
// The front page and a page with no heading yet use the name of the site.
export function usePageTitle(mainRef, isFrontPage) {
  useEffect(() => {
    const main = mainRef.current;
    if (!main) return undefined;
    const update = () => {
      const heading = main.querySelector('h1')?.textContent.trim();
      document.title = heading && !isFrontPage ? `${heading} | ${SITE_NAME}` : SITE_NAME;
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(main, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [mainRef, isFrontPage]);
}
