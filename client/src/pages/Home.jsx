import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { canOwnActivity } from '@/lib/auth';
import { useApi } from '@/lib/useApi';
import { LIVE } from '@/lib/live';
import { useNow } from '@/lib/useNow';
import { DOMAINS } from '@/lib/directory';
import OwnerOnly from '@/components/OwnerOnly';
import Panel from '@/components/overview/Panel';
import { BUTTON_OUTLINE } from '@/lib/ui';
import FigureStrip from '@/components/overview/FigureStrip';
import DocumentsReady from '@/components/overview/DocumentsReady';
import NextDeadline from '@/components/overview/NextDeadline';
import ProgressByMatter from '@/components/overview/ProgressByMatter';
import WhatNeedsYou from '@/components/overview/WhatNeedsYou';
import {
  greeting, figureOf, studentFigures, openMatters, attentionSentence, daysLeft,
} from '@/lib/overview';

// The words for an area of law. A route with no area or an unknown one says so and does not guess.
const areaLabel = (value) => DOMAINS.find((d) => d.value === value)?.label ?? 'Not listed';

// With nothing open, the four cards would each say "nothing" in their own way. One message and one
// action say it once.
function NoOpenMatters({ hasAny }) {
  return (
    <Panel id="no-matters" title="Your matters" className="mt-5">
      <p className="text-muted-foreground">{hasAny ? 'You have no open matters.' : 'You have no matters yet.'}</p>
      <Link to="/matters/new" className={`${BUTTON_OUTLINE} mt-4`}>Start a matter</Link>
    </Panel>
  );
}

// The student's home: what is open, what needs them and how their documents stand. Every figure is
// worked out in lib/overview.js from the lists below, which the server already answers to the owner only.
function HomeBoard({ user }) {
  const matters = useApi('/matters', LIVE);
  const progress = useApi('/matters/progress', LIVE);
  const reminders = useApi('/matters/reminders', LIVE);
  const bookings = useApi('/bookings/mine', LIVE);
  const bookmarks = useApi('/bookmarks');
  const routes = useApi('/directory/routes');

  const now = useNow();
  const f = studentFigures({
    matters: matters.data ?? [],
    progress: progress.data ?? [],
    bookings: bookings.data ?? [],
    bookmarks: bookmarks.data ?? [],
  }, now);
  const open = openMatters(matters.data);
  // The soonest deadline is the first open matter that has one. The server sends them soonest first.
  const soonest = open.find((m) => m.next_due && daysLeft(m, now) !== null) ?? null;
  // The area of each matter's route, in the words the directory uses. A route with no area says so.
  const areas = new Map((routes.data ?? []).map((r) => [r.id, areaLabel(r.area)]));

  // Only once the matters have loaded and answered: a failed or slow request is not an empty list.
  const noOpen = Boolean(matters.data) && !matters.error && open.length === 0;

  const figures = [
    figureOf('Open matters', [matters], f.open),
    figureOf('Need your attention', [matters, progress], f.attention),
    figureOf('Next deadline', [matters], f.deadline),
    figureOf('Appointments', [bookings], f.appointments),
    figureOf('Saved guides', [bookmarks], f.saved),
  ];

  const sentence = matters.data && progress.data ? attentionSentence(f.attention.value) : '';

  // On a wide screen the figures and cards run 10 px wider than the heading. The
  // heading keeps the 10 px inset.
  return (
    <div className="wide:-mx-2.5">
      <header className="wide:px-2.5">
        <h1 className="font-head text-[length:clamp(24px,2.7vw,30px)] leading-[1.15] tracking-[-0.01em] text-ink">{greeting(user)}</h1>
        <p className="mt-2.5 max-w-reading text-sm leading-[1.6] text-muted-foreground">{sentence}</p>
      </header>

      <FigureStrip figures={figures} />

      {noOpen ? <NoOpenMatters hasAny={matters.data.length > 0} /> : (
      /* The cards sit on a 12-column grid with a 12 px gap. */
      <div className="mt-5 grid gap-3 lg:grid-cols-12 lg:items-start">
        <DocumentsReady progress={progress.data} loading={progress.loading} error={progress.error} />
        <NextDeadline
          matter={soonest}
          today={now}
          loading={matters.loading}
          error={matters.error}
          reminders={reminders.data}
          loadingReminders={reminders.loading}
          errorReminders={reminders.error}
        />
        <ProgressByMatter progress={progress.data} loading={progress.loading} error={progress.error} />
        <WhatNeedsYou
          matters={open}
          progress={progress.data}
          areas={areas}
          loading={matters.loading}
          error={matters.error}
          today={now}
        />
      </div>
      )}
    </div>
  );
}

// Only a student or staff member has matters. Anyone else is told so. The server refuses them too.
export default function Home() {
  const { user } = useAuth();
  return <OwnerOnly>{canOwnActivity(user) && <HomeBoard user={user} />}</OwnerOnly>;
}
