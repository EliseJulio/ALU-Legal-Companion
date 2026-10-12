import { useApi } from '@/lib/useApi';
import ErrorNotice from '@/components/ErrorNotice';
import GuideSection from '@/components/GuideSection';
import ReviewActions from '@/components/ReviewActions';
import { DOMAINS } from '@/lib/directory';
import { PANEL, RING } from '@/lib/ui';
import { secureAddress } from '@/lib/url';

// A guide may carry markers like [verify: Art. 5, Law 66/2018] where the writer was not sure of a
// citation. A guide published with one still has a placeholder in it. So the expert is told how
// many there are before they verify.
const MARKER = /\[verify:[^\]]*\]/gi;

const SECTIONS = [
  ['situation', 'Your situation'],
  ['law_says', 'What the law says'],
  ['your_rights', 'Your rights'],
  ['steps', 'Steps to take'],
  ['get_help', 'Where to get help'],
];

function markersIn(guide) {
  return SECTIONS.reduce((total, [key]) => total + (guide[key]?.match(MARKER)?.length ?? 0), 0);
}

// The guides waiting for a legal expert. The whole text is shown, because verifying a guide
// without being able to read it would make the stamp mean nothing.
export default function ExpertQueue() {
  const { data: guides, error, loading, refetch } = useApi('/guides/all');
  const waiting = guides?.filter((g) => g.status === 'pending_review');

  return (
    <div>
      <h1 className="font-head text-2xl text-primary">Review queue</h1>
      <p className="mt-1 text-muted-foreground">
        Guides waiting for you to check them against the law. Nothing reaches a student until you
        verify it. Editing a published guide sends it back here.
      </p>

      {loading && <p className="mt-6 text-muted-foreground">Loading the queue…</p>}
      {error && <ErrorNotice error={error} className="mt-6" />}
      {waiting?.length === 0 && <p className={`mt-6 text-muted-foreground ${PANEL}`}>No guides are waiting for review.</p>}

      <ul className="mt-6 space-y-4">
        {waiting?.map((guide) => {
          const markers = markersIn(guide);
          const domain = DOMAINS.find((d) => d.value === guide.domain)?.label ?? guide.domain;
          return (
            <li key={guide.id} className={PANEL}>
              <h2 className="font-head text-lg font-semibold text-primary">{guide.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{domain} · {guide.source_law}</p>
              {secureAddress(guide.source_url) && (
                <p className="mt-1 text-sm">
                  <a href={secureAddress(guide.source_url)} target="_blank" rel="noopener noreferrer" className={`font-semibold text-primary underline ${RING}`}>
                    Open the full law ↗
                  </a>
                </p>
              )}

              {markers > 0 && (
                <p className="mt-3 rounded border border-warning-border bg-warning-subtle p-3 text-sm font-semibold text-warning-strong">
                  This guide still has {markers} unresolved [verify: …] {markers === 1 ? 'marker' : 'markers'}. Publishing it would show
                  that placeholder to students.
                </p>
              )}

              <details className="mt-3">
                <summary className={`min-h-touch cursor-pointer py-2 font-semibold text-primary ${RING}`}>Read the full text</summary>
                <div className="mt-2 space-y-4">
                  {SECTIONS.map(([key, title]) => <GuideSection key={key} title={title}>{guide[key]}</GuideSection>)}
                </div>
              </details>

              <ReviewActions path={`/guides/${guide.id}`} onDone={refetch} className="mt-4" />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
