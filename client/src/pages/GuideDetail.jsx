import { useParams, Link, useLocation } from 'react-router-dom';
import { useApi } from '@/lib/useApi';
import { useAuth } from '@/lib/AuthContext';
import { canOwnActivity } from '@/lib/auth';
import CrisisAlert from '@/components/CrisisAlert';
import Disclaimer from '@/components/Disclaimer';
import OfficialGazetteCallout from '@/components/OfficialGazetteCallout';
import GuideSection from '@/components/GuideSection';
import GuideHelp from '@/components/GuideHelp';
import GuideServiceBlock from '@/components/GuideServiceBlock';
import SaveGuideButton from '@/components/SaveGuideButton';
import ErrorNotice from '@/components/ErrorNotice';
import { DOMAINS } from '@/lib/directory';
import { BUTTON_OUTLINE, BUTTON_PRIMARY, BUTTON_TEXT, RING_ON_CANVAS } from '@/lib/ui';
import { secureAddress, signInPath } from '@/lib/url';

const PANEL = 'rounded-card border border-border bg-surface p-6';

export default function GuideDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const here = useLocation();
  const { data: guide, error, loading } = useApi(`/guides/${id}`);

  // The guide itself is open to everyone and does not say whether this reader saved it. The
  // saved list needs a login, so it is requested only for a student or staff member. A visitor
  // who asked would get a 401 and that clears a login that may still be good. An expert or admin
  // would get a 403. Its error is not shown. The worst it means is a label that starts at "Save".
  const { data: saved, loading: savedLoading } = useApi(canOwnActivity(user) ? '/bookmarks' : null);

  if (loading) return <p role="status" className="text-muted-foreground">Loading…</p>;

  // A withdrawn guide was public knowledge, so it says so plainly instead of a bare 404 — the
  // server's 410 carries the reason in its error message.
  if (error?.status === 410) {
    return (
      <div>
        <h1 className="font-head text-4xl leading-heading text-primary">This guide has been withdrawn</h1>
        <div className={`mt-6 ${PANEL}`}>
          <p className="font-medium">{error.message}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            It will come back only once someone edits it and an admin publishes it again.
          </p>
          <Link to="/guides" className={`${BUTTON_PRIMARY} mt-4`}>Browse all guides</Link>
        </div>
      </div>
    );
  }

  // A 404 usually does not mean the guide is gone. Any edit to a published guide takes it off
  // the site until it is checked and published again. So a real guide returns 404 while it is being
  // re-checked. Only a 404 gets this explanation. Any other error would not be about that, so it
  // keeps the server's own message.
  if (error?.status === 404) {
    return (
      <div>
        <h1 className="font-head text-4xl leading-heading text-primary">This guide is being re-checked</h1>
        <div className={`mt-6 ${PANEL}`}>
          <p className="font-medium">It will be back once an admin has checked and published it again.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Whenever a guide is edited it leaves the site until an admin has checked the change.
            That is on purpose. It stops anyone reading law that nobody has verified. Nothing has
            been deleted and a saved guide is still saved.
          </p>
          <Link to="/guides" className={`${BUTTON_PRIMARY} mt-4`}>Browse all guides</Link>
        </div>
      </div>
    );
  }

  if (error) return <ErrorNotice error={error} />;
  if (!guide) return <ErrorNotice error={{ message: 'This guide could not be loaded. Please try again.' }} />;

  const subject = DOMAINS.find((d) => d.value === guide.domain)?.label;
  const lawLink = secureAddress(guide.source_url);
  const parts = [
    { id: 'guide-situation', title: 'Your situation', text: guide.situation },
    { id: 'guide-law', title: 'What the law says', text: guide.law_says },
    { id: 'guide-rights', title: 'Your rights', text: guide.your_rights },
    { id: 'guide-steps', title: 'Steps to take', text: guide.steps },
    { id: 'guide-help', title: 'Where to get help', text: guide.get_help },
  ];

  return (
    <article>
      <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
        <Link to="/" className={`underline ${RING_ON_CANVAS}`}>Home</Link> /{' '}
        <Link to="/guides" className={`underline ${RING_ON_CANVAS}`}>Legal Guides</Link> /{' '}
        <span aria-current="page">{guide.title}</span>
      </nav>

      <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Legal information for ALU students &amp; staff</p>
      <h1 className="mt-3 font-head text-4xl leading-heading text-primary md:text-5xl">{guide.title}</h1>
      <p className="mt-4 text-muted-foreground">
        {subject ? `${subject} · ` : ''}Legal information, not legal advice
      </p>
      {guide.summary && <p className="mt-3 max-w-reading">{guide.summary}</p>}
      <div className="mt-5">
        <Link to="/ask" className={BUTTON_OUTLINE}>Ask a legal expert</Link>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Browse without an account. Your personal matters stay private.</p>

      {/* Harassment guides show the crisis numbers without being asked. */}
      {guide.domain === 'harassment' && <div className="mt-6"><CrisisAlert /></div>}

      <div className="mt-8 grid gap-8 xl:grid-cols-[14.5rem_minmax(0,1fr)] xl:gap-10">
        {/* A card on a phone, as in the design. Beside the text on a wide screen it is plain. */}
        <div className="flex flex-col gap-4 rounded-card border border-border bg-surface p-6 xl:sticky xl:top-6 xl:self-start xl:rounded-none xl:border-0 xl:bg-transparent xl:p-0">
          <nav aria-labelledby="guide-contents">
            <p id="guide-contents" className="font-head text-2xl leading-heading text-primary xl:font-sans xl:text-base xl:font-semibold xl:text-ink">In this guide</p>
            <ul className="mt-2 flex flex-col">
              {parts.map((p) => (
                <li key={p.id}><a href={`#${p.id}`} className={BUTTON_TEXT}>{p.title}</a></li>
              ))}
            </ul>
          </nav>

          {/* Only students and staff can save, because the server refuses everyone else. A
              visitor is shown how to start. An expert or admin is shown nothing. */}
          {canOwnActivity(user) && !savedLoading && (
            <SaveGuideButton guideId={guide.id} initiallySaved={saved?.some((g) => g.id === guide.id) ?? false} />
          )}
          {!user && (
            <div>
              <Link to={signInPath(here)} className={`${BUTTON_OUTLINE} w-full`}>Sign in to save guide</Link>
              <p className="mt-2 text-xs text-muted-foreground">Sign in to save this guide to your account.</p>
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-8">
          {parts.map((p) => (
            <GuideSection
              key={p.id}
              id={p.id}
              title={p.title}
              callout={p.id === 'guide-law' && guide.source_law ? (
                <OfficialGazetteCallout sourceLaw={guide.source_law} sourceUrl={guide.source_url} />
              ) : null}
            >
              {p.id === 'guide-help' ? <GuideHelp text={p.text} /> : p.text}
            </GuideSection>
          ))}

          {/* The practical part. The links, fees, documents, offices and steps. It
              is only on guides that have it. */}
          <GuideServiceBlock service={guide.service} />

          <section className={PANEL} aria-labelledby="guide-sources">
            <h2 id="guide-sources" className="font-head text-2xl text-primary">Sources &amp; review</h2>
            <dl className="mt-3 flex flex-col gap-3 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Official reference</dt>
                <dd className="mt-0.5 flex flex-wrap items-center gap-x-4">
                  <span className="rounded bg-primary-subtle px-2 py-0.5 font-mono text-xs text-primary">{guide.source_law}</span>
                  {lawLink && (
                    <a href={lawLink} target="_blank" rel="noopener noreferrer" className={BUTTON_TEXT}>
                      Read the full law <span aria-hidden="true">↗</span>
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  )}
                </dd>
              </div>
            </dl>
          </section>

          <div className="grid gap-5 md:grid-cols-2">
            <section className={PANEL} aria-labelledby="guide-route">
              <h2 id="guide-route" className="font-head text-2xl text-primary">Related route</h2>
              <p className="mt-2 text-sm">Find a possible next destination for your situation.</p>
              <Link to="/where-to-go" className={`mt-2 ${BUTTON_TEXT}`}>Browse routes<span aria-hidden="true">&nbsp;→</span></Link>
            </section>
            <section className={PANEL} aria-labelledby="guide-human">
              <h2 id="guide-human" className="font-head text-2xl text-primary">Human assistance</h2>
              <p className="mt-2 text-sm">Compare providers and see who accepts consultation requests.</p>
              <Link to="/directory" className={`mt-2 ${BUTTON_TEXT}`}>Browse the Directory<span aria-hidden="true">&nbsp;→</span></Link>
            </section>
          </div>
        </div>
      </div>

      <Disclaimer className="mt-8 text-center" />
    </article>
  );
}
