import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { apiPost } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import OwnerOnly from '@/components/OwnerOnly';
import Breadcrumb from '@/components/Breadcrumb';
import Callout from '@/components/Callout';
import ErrorNotice from '@/components/ErrorNotice';
import RwandaJurisdictionLadder from '@/components/RwandaJurisdictionLadder';
import Wizard from '@/components/wizard/Wizard';
import { WizField } from '@/components/wizard/WizardField';
import { collect, requiredText } from '@/lib/wizard';
import { readableDays } from '@/lib/directory';
import { todayIso } from '@/lib/dates';
import { RING_ON_CANVAS, BUTTON_OUTLINE } from '@/lib/ui';

// The help card under the form. A matter is a record for its owner.
const MATTER_HELP = {
  title: 'Before you start',
  intro: 'This is a record for you. It is not legal advice and it does not decide the case.',
  items: [
    'Write the next step as one action you can take this week.',
    'A deadline you enter is yours to check. Leave it empty if you are not sure.',
    'Reminders are a courtesy. We email you 7 days and 1 day before. Meeting the deadline stays your responsibility.',
  ],
};

function NewMatterForm() {
  const [params] = useSearchParams();
  const routeId = params.get('route');
  const navigate = useNavigate();
  // With no route id the path is empty and nothing is requested.
  const { data: route, error: routeError, loading } = useApi(routeId ? `/directory/routes/${routeId}` : null);

  const [title, setTitle] = useState('');
  const [nextAction, setNextAction] = useState('');
  const [nextDue, setNextDue] = useState('');
  const [start, setStart] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function save() {
    if (busy) return;
    setBusy(true);
    setError(null);
    // From a route the SERVER works out the deadline from the verified number of days. The page
    // only says when the clock started. Without a route the reader types the date.
    const body = route
      ? {
          route_id: route.id,
          title: title.trim() || undefined,
          next_action: nextAction.trim() || undefined,
          deadline_start: route.deadline_days && start ? start : undefined,
        }
      : { title: title.trim(), next_action: nextAction.trim() || null, next_due: nextDue || null };
    try {
      const matter = await apiPost('/matters', body);
      navigate(`/matters/${matter.id}`);
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  if (routeId && loading) return <p className="text-muted-foreground">Loading…</p>;
  if (routeId && routeError) return <ErrorNotice error={routeError} />;

  const days = route ? readableDays(route.deadline_days) : null;
  const hasStart = Boolean(route && days);

  const matterErrors = () => collect([
    ['matter-title', route ? '' : requiredText(title, 'Give the matter a short private name.')],
  ]);
  const nextErrors = () => collect([
    ['matter-start', hasStart && start > todayIso() ? 'That date is in the future. Leave it empty if it has not happened yet.' : ''],
  ]);

  const steps = [
    {
      id: 'matter',
      label: 'The matter',
      title: 'The matter',
      lede: 'Give it a short name that only you will recognise.',
      validate: matterErrors,
      facts: () => [
        ...(route ? [{ label: 'Where it goes first', value: `${route.title}. First step: ${route.first_forum.name}.` }] : []),
        { label: 'Private name', value: title.trim() || (route ? route.title : '') },
      ],
      render: () => (
        <>
          {route && (
            <p className="mb-4 text-muted-foreground">
              For: <span className="font-semibold text-ink">{route.title}</span>. First step: {route.first_forum.name}.
            </p>
          )}
          {route?.first_forum.type === 'abunzi' && <RwandaJurisdictionLadder defaultOpen />}
          <WizField
            id="matter-title"
            label={<>Private name <span className="font-normal text-muted-foreground">{route ? '(optional)' : '(required)'}</span></>}
            hint="Use a short name you can recognise. Avoid unnecessary identifying details. Reminder emails never include it."
            aria-required={route ? undefined : true}
            type="text"
            maxLength={200}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={route ? route.title : 'e.g. Deposit from my old flat'}
          />
        </>
      ),
    },
    {
      id: 'next',
      label: 'Next step and deadline',
      title: 'Next step and deadline',
      lede: 'The next thing you will do, and the date it has to be done by, if you know it.',
      validate: nextErrors,
      facts: () => [
        { label: 'Next step', value: nextAction.trim() },
        hasStart
          ? { label: `When was ${route.deadline_runs_from}`, value: start }
          : { label: 'Known deadline', value: route ? '' : nextDue },
      ],
      render: () => (
        <>
          <WizField
            id="matter-next"
            label="Next step"
            type="text"
            value={nextAction}
            onChange={(e) => setNextAction(e.target.value)}
            placeholder={route ? route.steps[0] : ''}
          />
          {hasStart && (
            <div className="mt-4 rounded-card border border-warning-border bg-warning-subtle p-4">
              <WizField
                id="matter-start"
                label={`When was ${route.deadline_runs_from}?`}
                hint={`You have ${days} from that day. We will work out the date and remind you before it. Leave it empty if it has not happened yet. You can add the date later.`}
                type="date"
                max={todayIso()}
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
          )}
          {!route && (
            <>
              <WizField
                id="matter-due"
                label="Known deadline (optional)"
                hint="Leave this blank if no date has been confirmed."
                className="mt-4"
                type="date"
                value={nextDue}
                onChange={(e) => setNextDue(e.target.value)}
              />
              <p className="mt-2 text-sm text-muted-foreground">
                Want the date worked out for you?{' '}
                <Link to="/directory" className={`font-semibold text-info hover:underline underline-offset-2 ${RING_ON_CANVAS}`}>Find where your matter goes</Link>{' '}
                and answer two short questions.
              </p>
            </>
          )}
        </>
      ),
    },
    { id: 'review', label: 'Review', title: 'Review', lede: 'Check the record. Edit takes you back to that step.', review: true, render: () => null },
  ];

  return (
    <div>
      <Breadcrumb trail={[{ label: 'Home', to: '/' }, { label: 'My matters', to: '/matters' }]} current="New matter" />
      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <h1 className="font-head text-[length:clamp(24px,2.7vw,30px)] leading-[1.15] tracking-[-0.01em] text-ink">New matter</h1>
        <Link to="/matters" className={`inline-flex min-h-touch items-center font-semibold text-info hover:underline underline-offset-2 ${RING_ON_CANVAS}`}>
          <span aria-hidden="true">←&nbsp;</span>Return to My matters
        </Link>
      </div>
      <p className="mt-4 max-w-reading text-muted-foreground">A short record of your next step.</p>
      <Callout title="Private by default" className="mt-4">
        Only you can see this matter. Leave a deadline blank if you do not know it.
      </Callout>

      <div className="mt-6">
        <Wizard
          steps={steps}
          finalLabel="Create private matter"
          saveLabel={null}
          busy={busy}
          label="New matter steps"
          help={MATTER_HELP}
          onFinish={save}
          notice={error ? <ErrorNotice error={error} className="mb-4" /> : null}
        />
      </div>
      <p className="mt-4">
        <Link to="/matters" className={BUTTON_OUTLINE}>Cancel</Link>
      </p>
    </div>
  );
}

export default function NewMatter() {
  return <OwnerOnly><NewMatterForm /></OwnerOnly>;
}
