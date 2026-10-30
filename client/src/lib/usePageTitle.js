import { useEffect } from 'react';

export const SITE_NAME = 'ALU Legal Companion';

// Sets the title of the browser tab from the heading of the page. The tab title is the first thing a
// screen reader says when a page opens, and a different page needs a different title. The heading
// is read from the main area and watched, so a page that loads its name later is covered, and no page
// has to set a title of its own. The front page and a page with no heading yet use the name of the site.
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
