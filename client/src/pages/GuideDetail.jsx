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
import Breadcrumb from '@/components/Breadcrumb';
import { DOMAINS } from '@/lib/directory';
import { BUTTON_OUTLINE, BUTTON_PRIMARY, BUTTON_TEXT, CARD } from '@/lib/ui';
import { secureAddress, signInPath } from '@/lib/url';

// Panels use the overview card: 6 px corners and 22 px padding and a thin border.
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
        <h1 className="font-head text-[length:clamp(24px,2.7vw,30px)] leading-[1.15] tracking-[-0.01em] text-ink">This guide has been withdrawn</h1>
        <div className={`mt-6 ${CARD}`}>
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
        <h1 className="font-head text-[length:clamp(24px,2.7vw,30px)] leading-[1.15] tracking-[-0.01em] text-ink">This guide is being re-checked</h1>
        <div className={`mt-6 ${CARD}`}>
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
      <Breadcrumb trail={[{ label: 'Home', to: '/' }, { label: 'Legal guides', to: '/guides' }]} current={guide.title} />

      <header className="mt-6">
        <p className="text-sm font-semibold text-faint">Legal information for ALU students &amp; staff</p>
        <h1 className="mt-3 font-head text-[length:clamp(24px,2.7vw,30px)] leading-[1.15] tracking-[-0.01em] text-ink">{guide.title}</h1>
        <p className="mt-3 text-muted-foreground">
          {subject ? `${subject} · ` : ''}Legal information not legal advice
        </p>
        {guide.summary && <p className="mt-3 max-w-[70ch] text-muted-foreground">{guide.summary}</p>}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link to="/ask" className={BUTTON_OUTLINE}>Ask a legal expert</Link>
        </div>
        <p className="mt-3 text-xs text-faint">Browse without an account. Your personal matters stay private.</p>
      </header>

      {/* Harassment guides show the crisis numbers without being asked. */}
      {guide.domain === 'harassment' && <div className="mt-6"><CrisisAlert /></div>}

      <div className="mt-8 grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
        {/* The article card. The reader's text sits here; the practical help sits beside it on a wide screen. */}
        <div className="flex min-w-0 flex-col gap-4">
          <div className={`flex flex-col gap-8 ${CARD} xl:border-0 xl:bg-transparent xl:p-0`}>
            <nav aria-labelledby="guide-contents">
              <p id="guide-contents" className="text-sm font-semibold text-ink">In this guide</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {parts.map((p) => (
                  <li key={p.id}><a href={`#${p.id}`} className={`${BUTTON_TEXT} min-h-touch`}>{p.title}</a></li>
                ))}
              </ul>
            </nav>

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

            <section aria-labelledby="guide-sources" className="border-t border-border-soft pt-6">
              <h2 id="guide-sources" className="font-head text-[15px] leading-[1.3] text-ink">Sources &amp; review</h2>
              <dl className="mt-3 flex flex-col gap-3 text-sm">
                <div>
                  <dt className="text-sm text-faint">Official reference</dt>
                  <dd className="mt-1 flex flex-wrap items-center gap-x-4">
                    <span className="font-mono text-xs text-faint">{guide.source_law}</span>
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
          </div>

          <Disclaimer className="text-center" />

          <div className="grid gap-4 md:grid-cols-2">
            <section className={CARD} aria-labelledby="guide-route">
              <h2 id="guide-route" className="font-head text-[15px] leading-[1.3] text-ink">Related route</h2>
              <p className="mt-2 text-sm">Find a possible next destination for your situation.</p>
              <Link to="/directory" className={`mt-2 ${BUTTON_TEXT}`}>Find where your matter goes<span aria-hidden="true">&nbsp;→</span></Link>
            </section>
            <section className={CARD} aria-labelledby="guide-human">
              <h2 id="guide-human" className="font-head text-[15px] leading-[1.3] text-ink">Human assistance</h2>
              <p className="mt-2 text-sm">Compare providers and see who accepts consultation requests.</p>
              <Link to="/directory" className={`mt-2 ${BUTTON_TEXT}`}>Browse the directory<span aria-hidden="true">&nbsp;→</span></Link>
            </section>
          </div>
        </div>

        {/* The side column: save or sign in, then the practical "How to do it" block. */}
        <aside className="flex min-w-0 flex-col gap-4 xl:sticky xl:top-6" aria-label="Save and how to do it">
          {/* Only students and staff can save, because the server refuses everyone else. A
              visitor is shown how to start. An expert or admin is shown nothing. */}
          {canOwnActivity(user) && !savedLoading && (
            <div className={CARD}>
              <SaveGuideButton guideId={guide.id} initiallySaved={saved?.some((g) => g.id === guide.id) ?? false} />
            </div>
          )}
          {!user && (
            <div className={CARD}>
              <Link to={signInPath(here)} className={`${BUTTON_OUTLINE} w-full`}>Sign in to save guide</Link>
              <p className="mt-2 text-xs text-muted-foreground">Sign in to save this guide to your account.</p>
            </div>
          )}

          <GuideServiceBlock service={guide.service} />
        </aside>
      </div>
    </article>
  );
}
