import { useEffect, useRef, useState } from 'react';
import { WizardContextProvider } from '@/components/wizard/WizardContext';
import WizardStepper from '@/components/wizard/WizardStepper';
import { WizCheck } from '@/components/wizard/WizardField';
import { BUTTON_OUTLINE, BUTTON_PRIMARY, CARD } from '@/lib/ui';

// The ring gap of the publish gate box. Its row is the canvas until it is ticked. Then it is the blue tint.
// The gap takes the colour of the row the box sits on. Otherwise it shows as a white halo.
const GATE_OFFSET = 'focus-visible:ring-offset-canvas checked:focus-visible:ring-offset-primary-subtle';
const PLAIN_GATE_OFFSET = 'focus-visible:ring-offset-surface';
import { countErrors, firstErrorId } from '@/lib/wizard';

// One reusable step form. The page passes the steps.
// The wizard owns which step is open and which steps the person has visited.
// It also owns when messages appear and where focus goes.
// It never sends a request. The page does when the wizard calls onSaveDraft or onFinish.
//
// A step is { id, label, title, lede, render(), validate(), facts(), review }.
//   render   the fields. Only the open step is rendered.
//   validate the problems on the step as { fieldId: message }. Empty means the step is complete.
//   facts    the lines the review card shows for this step as [{ label, value }].
//   review   true for the last step. It holds the review and the gate.
//
// Layout. The steps sit in a row of circles at the top. One form card sits below them.
// Back and Save draft are on the left of the card. Next is on the right.
// Below 1180 px the circles stand alone under "Step N of 5".
// Back and Save draft and Next then sit in a bar at the bottom of the screen above the app bar.
// `help` is a card under the form.
// `variant="aside"` is the narrow column in a page: circles on top and no card border and no help.
// `variant="plain"` is for a page that already draws its one card (AdminEditorPage).
// It has no card border or padding and the help is a divider.
//
// The publish gate is one tick box on the last step.
// It is required only when the page says so (a published guide or entry or checklist).
// While it is unticked no request is made.

export default function Wizard({
  steps,
  finalLabel = 'Publish',
  saveLabel = 'Save draft',
  busy = false,
  gate = null,
  onSaveDraft,
  onFinish,
  status = '',
  notice = null,
  label = 'Steps',
  help = null,
  variant = 'page',
}) {
  const [current, setCurrent] = useState(0);
  const [visited, setVisited] = useState(() => new Set([0]));
  const [attempted, setAttempted] = useState(() => new Set());
  const [gateShown, setGateShown] = useState(false);
  const [note, setNote] = useState('');
  const headingRef = useRef(null);
  const focusRef = useRef(null);
  const last = steps.length - 1;
  const step = steps[current];
  const aside = variant === 'aside';
  const plain = variant === 'plain';

  const errorsAt = (i) => (steps[i].validate ? steps[i].validate() : {});
  const gateError = gate?.required && !gate.checked ? gate.message : '';

  // Focus moves after each change of step or message.
  // It goes to the step heading on a change of step. It goes to the first field with a problem when Next or Publish is refused.
  useEffect(() => {
    const target = focusRef.current;
    if (!target) return;
    focusRef.current = null;
    if (target === 'heading') headingRef.current?.focus();
    else document.getElementById(target)?.focus();
  });

  function go(i, focus = 'heading') {
    if (i < 0 || i > last) return;
    setVisited((v) => new Set([...v, current, i]));
    setCurrent(i);
    setNote('');
    focusRef.current = focus;
  }

  function refuse(i, errors) {
    setAttempted((a) => new Set([...a, i]));
    setVisited((v) => new Set([...v, i]));
    setCurrent(i);
    focusRef.current = firstErrorId(errors) ?? 'heading';
  }

  function holdForGate() {
    setGateShown(true);
    setVisited((v) => new Set([...v, current]));
    setCurrent(last);
    focusRef.current = gate.id;
    setNote(`Not saved to the site yet. ${gate.message}`);
  }

  function next() {
    const errors = errorsAt(current);
    if (countErrors(errors)) {
      setAttempted((a) => new Set([...a, current]));
      focusRef.current = firstErrorId(errors);
      setNote(`${step.label} is not finished. ${countErrors(errors) === 1 ? '1 item needs attention.' : `${countErrors(errors)} items need attention.`}`);
      return;
    }
    go(current + 1);
  }

  // A save as a draft is never refused for a missing field. The server answers for the fields it holds.
  // Only the publish gate can stop it and only for a published record.
  function saveDraft() {
    if (gateError) { holdForGate(); return; }
    onSaveDraft?.();
  }

  // Publish checks every step first. The page is sent to the first step with a problem and the
  // focus lands on the field. Nothing is sent until every step is clean and the gate is ticked.
  function finish() {
    for (let i = 0; i <= last; i += 1) {
      if (steps[i].review) continue;
      const errors = errorsAt(i);
      if (countErrors(errors)) {
        setNote(`Not published yet. ${steps[i].label} needs attention.`);
        refuse(i, errors);
        return;
      }
    }
    if (gateError) { holdForGate(); return; }
    onFinish?.();
  }

  const shown = attempted.has(current) ? errorsAt(current) : {};
  const context = {
    ...shown,
    ...(gate && gateShown && gateError ? { [gate.id]: gateError } : {}),
  };

  function railState(i) {
    if (i === current) return 'current';
    if (!visited.has(i)) return 'upcoming';
    return countErrors(errorsAt(i)) ? 'error' : 'complete';
  }

  const view = steps.map((s, i) => ({ id: s.id, label: s.label, state: railState(i) }));
  const problems = view.filter((s) => s.state === 'error').map((s) => s.label);
  // The phone order is the step heading then the circles then the form.
  // Desktop keeps the circles on top. The aside keeps them on top on every width.
  const phoneOrder = (n) => (aside ? '' : `max-[1179px]:order-${n}`);
  const phoneOnly = aside ? '' : 'hidden max-[1179px]:block';

  return (
    <div className={`flex min-w-0 flex-col gap-6 ${aside ? '' : plain ? 'w-full max-[1179px]:pb-24' : 'mx-auto w-full max-w-form max-[1179px]:pb-24'}`}>
      <div className={phoneOrder(2)}>
        <WizardStepper steps={view} label={label} onGo={go} compact={aside} />
      </div>

      <header className={`min-w-0 ${phoneOrder(1)}`}>
        <p className={`text-sm text-muted-foreground ${phoneOnly}`}>{`Step ${current + 1} of ${steps.length}`}</p>
        <h2 ref={headingRef} tabIndex={-1} className="mt-1 font-head text-xl leading-[1.25] text-ink focus:outline-none">{step.title}</h2>
        {step.lede && <p className="mt-2 text-sm text-muted-foreground">{step.lede}</p>}
        {problems.length > 0 && (
          <p className={`mt-2 text-sm font-semibold text-ink ${aside ? '' : 'hidden max-[1179px]:block'}`}>
            Needs attention: {problems.join(', ')}.
          </p>
        )}
      </header>

      <form
        aria-label={step.title}
        noValidate
        onSubmit={(e) => { e.preventDefault(); if (current === last) finish(); else next(); }}
        className={aside || plain
          ? 'min-w-0'
          : `min-w-0 ${CARD} max-[1179px]:border-0 max-[1179px]:bg-transparent max-[1179px]:p-0`}
      >
        {notice}
        <div role="status" className="text-sm font-semibold text-ink">{note || status}</div>

        <WizardContextProvider value={context}>
          <div className="mt-4">
            {step.review ? (
              <Review steps={steps} errorsAt={errorsAt} go={go} />
            ) : step.render()}
          </div>
          {step.review && gate && (
            <div className={plain
              ? 'mt-6 border-t border-border pt-4'
              : 'mt-6 rounded-card border border-border bg-canvas p-4 has-[:checked]:border-primary-text has-[:checked]:bg-primary-subtle'}>
              <WizCheck id={gate.id} label={gate.label} sub={gate.sub} checked={gate.checked} onChange={gate.onChange} offset={plain ? PLAIN_GATE_OFFSET : GATE_OFFSET} />
            </div>
          )}
        </WizardContextProvider>

        <div className={aside
          ? 'mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4'
          : 'mt-6 flex items-center justify-between gap-3 border-t border-border pt-4 max-[1179px]:fixed max-[1179px]:inset-x-0 max-[1179px]:bottom-[calc(4.25rem+env(safe-area-inset-bottom))] max-[1179px]:z-30 max-[1179px]:mt-0 max-[1179px]:grid max-[1179px]:grid-cols-3 max-[1179px]:gap-2 max-[1179px]:border-t max-[1179px]:bg-canvas max-[1179px]:px-4 max-[1179px]:py-2 max-[1179px]:pb-[max(0.5rem,env(safe-area-inset-bottom))]'}
        >
          <div className={`flex flex-wrap items-center gap-2 ${aside ? '' : 'max-[1179px]:contents'}`}>
            <button
              type="button"
              aria-disabled={current === 0 || undefined}
              onClick={() => { if (current > 0) go(current - 1); }}
              className={`${BUTTON_OUTLINE} ${aside ? '' : 'max-[1179px]:px-2 max-[1179px]:text-center'}`}
            >
              Back
            </button>
            {onSaveDraft && saveLabel && (
              <button
                type="button"
                aria-disabled={busy || undefined}
                aria-busy={busy || undefined}
                onClick={saveDraft}
                className={`${BUTTON_OUTLINE} ${aside ? '' : 'max-[1179px]:px-2 max-[1179px]:text-center'}`}
              >
                {saveLabel}
              </button>
            )}
          </div>
          <div className={`flex items-center gap-2 ${aside ? '' : 'max-[1179px]:contents'}`}>
            {current < last ? (
              <button type="button" onClick={next} className={`${BUTTON_PRIMARY} ${aside ? '' : 'max-[1179px]:px-2 max-[1179px]:text-center'}`}>
                Next
              </button>
            ) : (
              <button
                type="button"
                aria-disabled={busy || undefined}
                aria-busy={busy || undefined}
                onClick={finish}
                className={`${BUTTON_PRIMARY} ${aside ? '' : 'max-[1179px]:px-2 max-[1179px]:text-center'}`}
              >
                {busy ? 'Working…' : finalLabel}
              </button>
            )}
          </div>
        </div>
      </form>

      {help && !aside && (
        <section
          aria-labelledby="wizard-help"
          className={plain ? 'border-t border-border pt-6' : CARD}
        >
          <h2 id="wizard-help" className="font-head text-base leading-[1.3] text-ink">{help.title}</h2>
          {help.intro && <p className="mt-2 text-sm text-muted-foreground">{help.intro}</p>}
          <ul className="mt-3 grid list-disc gap-2 pl-5 text-sm text-ink">
            {help.items.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </section>
      )}
    </div>
  );
}

// The review: one part per step with a word that says whether it is complete and an Edit link back to it.
function Review({ steps, errorsAt, go }) {
  return (
    <div className="grid">
      {steps.map((s, i) => {
        if (s.review || !s.facts) return null;
        const bad = countErrors(errorsAt(i));
        return (
          <section key={s.id} aria-labelledby={`review-${s.id}`} className="border-t border-border py-4 first:border-t-0 first:pt-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 id={`review-${s.id}`} className="font-head text-base text-ink">
                {s.label}{' '}
                <span className="text-sm font-normal text-muted-foreground">{bad ? 'Needs attention' : 'Complete'}</span>
              </h3>
              <button type="button" onClick={() => go(i)} className={BUTTON_OUTLINE}>
                Edit <span className="sr-only">{s.label}</span>
              </button>
            </div>
            <dl className="mt-3 grid gap-2 text-sm">
              {s.facts().map((row) => (
                <div key={row.label} className="grid gap-0.5 sm:grid-cols-[12rem_minmax(0,1fr)] sm:gap-3">
                  <dt className="text-muted-foreground">{row.label}</dt>
                  <dd className="whitespace-pre-line break-words text-ink">{row.value || <span className="text-muted-foreground">Not given</span>}</dd>
                </div>
              ))}
            </dl>
          </section>
        );
      })}
    </div>
  );
}
