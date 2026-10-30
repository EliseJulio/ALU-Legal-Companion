import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { signInPath } from '@/lib/url';
import { useApi } from '@/lib/useApi';
import { useAuth } from '@/lib/AuthContext';
import { canOwnActivity } from '@/lib/auth';
import { useMediaQuery } from '@/lib/useMediaQuery';
import GuideCard from '@/components/GuideCard';
import SaveGuideButton from '@/components/SaveGuideButton';
import Breadcrumb from '@/components/Breadcrumb';
import Callout from '@/components/Callout';
import ErrorNotice from '@/components/ErrorNotice';
import { DOMAINS } from '@/lib/directory';
import { BUTTON_PRIMARY, BUTTON_TEXT } from '@/lib/ui';

const CELL = 'px-4 py-4 align-top text-sm';
const HEAD = 'px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground';
const subjectOf = (domain) => DOMAINS.find((d) => d.value === domain)?.label ?? 'Not recorded';

// The saved guides in one table for a wide screen. Each row has the one link to read the guide
// and the button to take it off the list. The guide's name is the row heading, not a link, so
// the page does not read as two links to the same place.
function SavedTable({ guides, onRemoved }) {
  return (
    <div className="mt-6 overflow-x-auto rounded-card border border-border bg-surface">
      <table className="w-full min-w-[52rem] text-left">
        <caption className="sr-only">Your saved guides with their subject, who checked them and what you can do</caption>
        <thead className="border-b border-border bg-canvas">
          <tr>
            {['Guide', 'Category', 'Status', 'Actions'].map((name) => (
              <th key={name} scope="col" className={HEAD}>{name}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {guides.map((g) => {
            const withdrawn = g.status === 'withdrawn';
            const underReview = !withdrawn && g.status !== 'published';
            return (
              <tr key={g.id}>
                <th scope="row" className={`${CELL} w-[22rem] font-normal`}>
                  <p className="font-head text-xl leading-heading text-primary">{g.title}</p>
                  <p className="mt-1 w-fit rounded bg-primary-subtle px-2 py-0.5 font-mono text-xs text-primary">{g.source_law}</p>
                </th>
                <td className={CELL}>{subjectOf(g.domain)}</td>
                <td className={CELL}>
                  {withdrawn ? (
                    <p className="text-sm text-muted-foreground">Withdrawn</p>
                  ) : underReview ? (
                    <p className="text-sm text-muted-foreground">Under review</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Private save</p>
                  )}
                </td>
                <td className={`${CELL} w-[14rem]`}>
                  {withdrawn ? (
                    <p className="text-sm text-muted-foreground">This guide has been withdrawn.</p>
                  ) : underReview ? (
                    <p className="text-sm text-muted-foreground">
                      This guide is currently under review and will be visible again shortly.
                    </p>
                  ) : (
                    <Link to={`/guides/${g.id}`} className={`${BUTTON_PRIMARY} w-full`}>
                      <span>Read guide{' '}<span className="sr-only">{g.title}</span></span>
                    </Link>
                  )}
                  <SaveGuideButton guideId={g.id} initiallySaved title={g.title} className="mt-2" onChange={(saved) => !saved && onRemoved(g)} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// A saved guide that is not currently published. No link to read it: GET /api/guides/:id 404s for
// anything unpublished, the same as a guide this reader never saved. The save itself is kept and
// the row comes back once an administrator republishes the guide.
function UnderReviewCard({ guide, action }) {
  const withdrawn = guide.status === 'withdrawn';
  return (
    <li className="flex flex-col gap-3 rounded-card border border-border bg-canvas p-6">
      <p className="font-head text-xl leading-heading text-primary">{guide.title}</p>
      <p className="text-sm text-muted-foreground">
        {withdrawn
          ? 'This guide has been withdrawn.'
          : 'This guide is currently under review and will be visible again shortly.'}
      </p>
      {action}
    </li>
  );
}

export default function SavedGuides() {
  const { user } = useAuth();
  const here = useLocation();

  // There are three cases. A visitor. A signed-in role that keeps no saved list. A student or
  // staff member. Only the last one asks the server. The list needs a login and the server refuses an
  // expert or an admin. Asking anyway would show them an error where nothing is wrong.
  const canSave = canOwnActivity(user);
  const { data: guides, error, loading, refetch } = useApi(canSave ? '/bookmarks' : null);
  const wide = useMediaQuery('(min-width: 1280px)');
  const status = useRef(null);
  const [removed, setRemoved] = useState(null);
  // Guides taken off in this visit. They leave the screen at once, so a second press cannot save
  // one again while the list is read from the server a moment later.
  const [gone, setGone] = useState([]);

  // The server has already agreed. The list is read again so it is the server's list.
  function onRemoved(guide) {
    setGone((old) => [...old, guide.id]);
    setRemoved(guide.title);
    refetch();
  }

  // The button that was pressed has left the page. Focus goes to the message, so what the reader
  // hears is the message itself and not a heading read out over it.
  useEffect(() => {
    if (removed) status.current?.focus();
  }, [removed]);

  const shown = guides?.filter((g) => !gone.includes(g.id));

  return (
    <div>
      <Breadcrumb trail={[{ label: 'Home', to: '/' }]} current="Saved Resources" />
      <h1 className="mt-6 font-head text-4xl leading-heading text-primary md:text-5xl">Saved Resources</h1>

      {!user ? (
        <div className="mt-6 rounded-card border border-border bg-surface p-6">
          <p className="font-medium">Sign in to see your saved guides.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Saving a guide keeps it with your account. Reading the guides never needs one.
          </p>
          <Link to={signInPath(here)} className={`${BUTTON_PRIMARY} mt-3`}>Sign in</Link>
        </div>
      ) : !canSave ? (
        // Not an error box. Nothing failed. This account type just keeps no saved list.
        <div className="mt-6 rounded-card border border-border bg-surface p-6">
          <p className="font-medium">Saved guides are for student and staff accounts.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            You are signed in as {user.name}. Nothing is missing and nothing has gone wrong. Every
            guide is open to you without saving it.
          </p>
          <Link to="/guides" className={`${BUTTON_PRIMARY} mt-3`}>Browse the guides</Link>
        </div>
      ) : (
        <>
          {/* A guide shows as temporarily unavailable after an edit rather than disappearing.
              Without this sentence that still reads as a lost save. */}
          <p className="mt-4 max-w-reading text-muted-foreground">
            Your private reading collection, newest saved first. Only visible in your own workspace.
            A guide can be temporarily unavailable after an edit and cannot be opened until it is
            published again. The save itself is never lost.
          </p>
          {/* Always on the page so the first message is read out. */}
          <p ref={status} tabIndex={-1} role="status" className="mt-3 text-sm focus:outline-none">
            {removed && `Removed “${removed}” from your saved list.`}
          </p>

          {loading && <p className="mt-6 text-muted-foreground">Loading your saved guides…</p>}
          {error && <ErrorNotice error={error} className="mt-6" />}

          {shown?.length === 0 && (
            <div className="mt-6 rounded-card border border-border bg-surface p-6">
              <p className="font-medium">You have not saved any guides yet.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Open a guide and choose “Save guide” to keep it here for later.
              </p>
              <Link to="/guides" className={`${BUTTON_PRIMARY} mt-3`}>Browse the guides</Link>
            </div>
          )}

          {/* The server already sends the newest save first. The page keeps that order. */}
          {shown?.length > 0 && (wide ? (
            <SavedTable guides={shown} onRemoved={onRemoved} />
          ) : (
            <ul className="mt-6 grid gap-5 md:grid-cols-2">
              {shown.map((g) => {
                const action = <SaveGuideButton guideId={g.id} initiallySaved title={g.title} onChange={(saved) => !saved && onRemoved(g)} />;
                return g.status !== 'published'
                  ? <UnderReviewCard key={g.id} guide={g} action={action} />
                  : <GuideCard key={g.id} guide={g} action={action} />;
              })}
            </ul>
          ))}

          <Callout title="Saved does not mean current" className="mt-6">
            Check the source each time you use a guide. Saving keeps your
            reference, not a legal guarantee.
          </Callout>
          <p className="mt-4"><Link to="/guides" className={BUTTON_TEXT}>Explore Legal Guides →</Link></p>
        </>
      )}
    </div>
  );
}
