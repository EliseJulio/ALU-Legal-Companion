import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import RouteAnswer from '@/components/RouteAnswer';
import NoMatchPanel from '@/components/NoMatchPanel';
import { useApi } from '@/lib/useApi';
import { DOMAINS } from '@/lib/directory';
import { BUTTON_DISABLED, BUTTON_PRIMARY, BUTTON_TEXT, CARD, CHIP, RING } from '@/lib/ui';

const CHOICE = `flex min-h-touch w-full items-center rounded-card border border-border bg-surface px-4 py-3 text-left hover:border-muted-foreground ${RING}`;
// The chosen one is a soft blue tint, as on the other selectable cards.
const CHOICE_ON = `flex min-h-touch w-full items-center rounded-card border border-primary bg-primary-subtle px-4 py-3 text-left font-semibold text-primary-text ${RING}`;
const HEADING = 'font-head text-[length:clamp(18px,2vw,22px)] leading-[1.2] text-ink focus:outline-none';

// Two short questions then the answer in one card. It sits on the Directory and on Legal Guides.
// The areas offered are only those with a published matter. Nothing here is typed as a fact.
// The answer is read from the matter an admin published. Its address is ?route=ID so a link opens it.
// `onSkip` puts focus on the search of the page.
export default function GuidedStart({ onSkip = () => {} }) {
  const [params, setParams] = useSearchParams();
  const routeParam = params.get('route');
  const routeId = /^\d{1,9}$/.test(routeParam ?? '') ? routeParam : null;
  const [open, setOpen] = useState(Boolean(routeId));
  const [area, setArea] = useState('');
  const [noMatch, setNoMatch] = useState(false);
  // The matter picked on the second question. Continue opens it.
  const [picked, setPicked] = useState(null);
  const { data: routes } = useApi('/directory/routes');
  const heading = useRef(null);
  const openButton = useRef(null);
  const wasOpen = useRef(false);

  const areas = DOMAINS.filter((d) => routes?.some((r) => r.area === d.value));
  // The area of the matter being read. An address that opens a matter knows it from the list.
  const listed = routeId ? routes?.find((r) => String(r.id) === routeId) : null;
  const currentArea = routeId ? (listed?.area ?? area) : area;
  const label = DOMAINS.find((d) => d.value === currentArea)?.label;
  const matters = routes?.filter((r) => r.area === currentArea) ?? [];

  let step = 'area';
  if (!open && !routeId) step = 'closed';
  else if (routeId) step = 'answer';
  else if (noMatch) step = 'nomatch';
  else if (currentArea) step = 'matter';

  // Each new question takes focus, so a keyboard or screen reader user lands on it. The answer
  // takes focus itself when it is ready.
  useEffect(() => {
    if (step === 'closed' || step === 'answer') return;
    heading.current?.focus();
  }, [step, currentArea]);

  // Hiding the questions puts focus back on the button that opened them.
  useEffect(() => {
    if (step === 'closed' && wasOpen.current) openButton.current?.focus();
    wasOpen.current = step !== 'closed';
  }, [step]);

  // Nothing shows until a published matter has an area and the list has loaded.
  if (!routeId && areas.length === 0) return null;

  // The address holds the chosen matter, so a reload and the Back button keep it.
  function setRoute(id) {
    setParams((old) => {
      const next = new URLSearchParams(old);
      if (id) next.set('route', String(id));
      else next.delete('route');
      return next;
    });
  }

  function hide() {
    setOpen(false);
    setArea('');
    setNoMatch(false);
    setPicked(null);
    if (routeId) setRoute(null);
  }

  function leaveAnswer() {
    setArea(currentArea);
    setPicked(null);
    setRoute(null);
  }

  function goOn() {
    if (picked === null) return;
    setNoMatch(false);
    setRoute(picked);
  }

  const headingProps = { ref: heading, tabIndex: -1, className: HEADING };

  if (step === 'closed') {
    return (
      <section aria-label="Not sure where your matter goes?" className={`mt-8 ${CARD}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-head text-[length:clamp(18px,2vw,22px)] leading-[1.2] text-ink">Not sure where your matter goes?</h2>
          <button
            ref={openButton}
            type="button"
            aria-expanded="false"
            onClick={() => setOpen(true)}
            className={BUTTON_PRIMARY}
          >
            Answer two questions
          </button>
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Not sure where your matter goes?" className={`mt-8 ${CARD}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {step !== 'answer' && (
          <p className="text-sm font-semibold text-muted-foreground">
            {step === 'area' ? 'Question 1 of 2' : 'Question 2 of 2'}
          </p>
        )}
        <button type="button" onClick={hide} className={BUTTON_TEXT}>Hide questions</button>
      </div>

      {step === 'area' && (
        <>
          <h2 {...headingProps}>What is this about?</h2>
          <p className="mt-1 text-sm text-muted-foreground">Choose the closest one. You can go back.</p>
          <div role="group" aria-label="Topics" className="mt-4 flex flex-wrap gap-2">
            {areas.map(({ value, label: name }) => (
              <button key={value} type="button" onClick={() => { setNoMatch(false); setPicked(null); setArea(value); }} className={CHIP}>
                {name}
              </button>
            ))}
          </div>
          <p className="mt-4 text-sm">
            Is someone in danger right now?{' '}
            <Link to="/emergency" className="font-semibold underline underline-offset-4">See emergency numbers</Link>
          </p>
          <button type="button" onClick={onSkip} className={`mt-2 ${BUTTON_TEXT}`}>Not sure? Skip these questions</button>
        </>
      )}

      {step === 'matter' && (
        <>
          <h2 {...headingProps}>Which of these is closest? ({label})</h2>
          <p className="mt-1 text-sm text-muted-foreground">Choose one to read where it goes first, the steps and any deadline.</p>
          <ul className="mt-4 grid gap-2">
            {matters.map((r) => (
              <li key={r.id}>
                <button type="button" aria-pressed={picked === r.id} onClick={() => setPicked(r.id)} className={picked === r.id ? CHOICE_ON : CHOICE}>{r.title}</button>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            <button
              type="button"
              disabled={picked === null}
              onClick={goOn}
              className={picked === null ? BUTTON_DISABLED : BUTTON_PRIMARY}
            >
              Continue
            </button>
            <button type="button" onClick={() => { setPicked(null); setArea(''); }} className={BUTTON_TEXT}>Back</button>
            <button type="button" onClick={() => setNoMatch(true)} className={BUTTON_TEXT}>None of these?</button>
          </div>
        </>
      )}

      {step === 'nomatch' && (
        <>
          <h2 {...headingProps}>No matter here matches that yet</h2>
          <NoMatchPanel>
            <p className="mt-1 text-sm text-muted-foreground">
              Browse the directory for the offices that help, or ask a legal expert. You can ask without giving your name.
            </p>
          </NoMatchPanel>
          <button type="button" onClick={() => setNoMatch(false)} className={`mt-3 ${BUTTON_TEXT}`}>Back</button>
        </>
      )}

      {step === 'answer' && <RouteAnswer routeId={routeId} onBack={leaveAnswer} />}
    </section>
  );
}
