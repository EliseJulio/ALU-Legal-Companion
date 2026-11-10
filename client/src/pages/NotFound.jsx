import { Link } from 'react-router-dom';
import Callout from '@/components/Callout';
import { BUTTON_PRIMARY, BUTTON_OUTLINE, PAGE_TITLE, RING_ON_CANVAS } from '@/lib/ui';

// A lost person is never left at a dead end. The page says what happened.
// It offers the way home and the main places. It keeps emergency help one click away.
// The emergency link in the menu is still there. This one is for someone who has not opened the menu.
export default function NotFound() {
  return (
    <div className="max-w-xl">
      <h1 className={PAGE_TITLE}>Page not found</h1>
      <p className="mt-3 text-muted-foreground">That page does not exist or has moved. Choose where to go next.</p>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Link to="/" className={BUTTON_PRIMARY}>Go to the home page</Link>
        <Link to="/directory" className={BUTTON_OUTLINE}>Find where a matter goes first</Link>
        <Link to="/guides" className={BUTTON_OUTLINE}>Read the legal guides</Link>
        <Link to="/directory" className={BUTTON_OUTLINE}>Look in the directory</Link>
        <Link to="/search" className={BUTTON_OUTLINE}>Search the site</Link>
      </div>

      <Callout title="Need urgent help?" className="mt-8">
        Do not wait for a page to load.{' '}
        <Link to="/emergency" className={`rounded-control font-semibold text-info underline ${RING_ON_CANVAS}`}>See all emergency contacts</Link>
      </Callout>
    </div>
  );
}
