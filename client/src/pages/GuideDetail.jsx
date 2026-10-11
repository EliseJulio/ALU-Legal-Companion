import { useParams, Link } from 'react-router-dom';
import { useApi } from '@/lib/useApi';
import { useAuth } from '@/lib/AuthContext';
import { canOwnActivity } from '@/lib/auth';
import VerifiedStamp from '@/components/VerifiedStamp';
import CrisisAlert from '@/components/CrisisAlert';
import Disclaimer from '@/components/Disclaimer';
import GuideSection from '@/components/GuideSection';
import SaveGuideButton from '@/components/SaveGuideButton';
import ErrorNotice from '@/components/ErrorNotice';
import { RING, BUTTON_PRIMARY } from '@/lib/ui';

export default function GuideDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { data: guide, error, loading } = useApi(`/guides/${id}`);

  // The guide itself is open to everyone and does not say whether this reader saved it. The
  // saved list needs a login, so it is requested only for a student or staff member. A visitor
  // who asked would get a 401 and that clears a login that may still be good. An expert or admin
  // would get a 403. Its error is not shown. The worst it means is a label that starts at "Save".
  const { data: saved, loading: savedLoading } = useApi(canOwnActivity(user) ? '/bookmarks' : null);

  if (loading) return <p className="text-muted-foreground">Loading…</p>;

  // A 404 usually does not mean the guide is gone. Any edit to a published guide takes it off
  // the site until a legal expert checks it again. So a real guide returns 404 while it is being
  // re-checked. Only a 404 gets this explanation. Any other error would not be about that, so it
  // keeps the server's own message.
  if (error?.status === 404) {
    return (
      <div>
        <h1 className="font-head text-2xl text-primary">This guide is being re-checked</h1>
        <div className="mt-6 rounded border border-border bg-surface p-4">
          <p className="font-medium">It will be back once a legal expert has verified it again.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Whenever a guide is edited it leaves the site until a lawyer has checked the change.
            That is on purpose. It stops anyone reading law that nobody has verified. Nothing has
            been deleted and a saved guide is still saved.
          </p>
          <Link to="/guides" className={`${BUTTON_PRIMARY} mt-3 focus-visible:ring-offset-canvas`}>Browse all guides</Link>
        </div>
      </div>
    );
  }

  if (error) return <ErrorNotice error={error} />;
  if (!guide) return <ErrorNotice error={{ message: 'This guide could not be loaded. Please try again.' }} />;

  return (
    <article>
      <h1 className="font-head text-2xl text-primary">{guide.title}</h1>
      <div className="mt-2">
        <VerifiedStamp name={guide.verified_by_name} date={guide.verified_at} />
      </div>

      {/* Harassment guides show the crisis numbers without being asked. */}
      {guide.domain === 'harassment' && <div className="mt-4"><CrisisAlert /></div>}

      <div className="mt-5 space-y-4 rounded border border-border bg-surface p-4">
        <GuideSection title="Your situation">{guide.situation}</GuideSection>

        <GuideSection title="What the law says">
          {guide.law_says}
          <p className="mt-2">
            <span className="rounded bg-primary-subtle px-2 py-0.5 font-mono text-xs text-primary">{guide.source_law}</span>
            {guide.source_url && (
              <a
                href={guide.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className={`ml-2 text-xs text-primary underline ${RING}`}
              >
                Read the full law ↗
              </a>
            )}
          </p>
        </GuideSection>

        <GuideSection title="Your rights">{guide.your_rights}</GuideSection>
        <GuideSection title="Steps to take">{guide.steps}</GuideSection>
        <GuideSection title="Where to get help">{guide.get_help}</GuideSection>
      </div>

      {/* Only students and staff can save, because the server refuses everyone else. A visitor
          sees no prompt here. The page is about the law. */}
      {canOwnActivity(user) && !savedLoading && (
        <SaveGuideButton className="mt-4" guideId={guide.id} initiallySaved={saved?.some((g) => g.id === guide.id) ?? false} />
      )}

      <Disclaimer className="mt-4 text-center" />
    </article>
  );
}
