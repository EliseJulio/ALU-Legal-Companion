import Icon from '@/components/Icon';
import { RING } from '@/lib/ui';
import { stepAriaLabel, stepWord } from '@/lib/wizard';

// The row of steps at the top of a wizard. Each step is a button whose name says its state in
// words: "Basics, needs attention". The circle shows the same state in shape and colour. Done is a
// soft blue tint with a check. The current step is solid blue with its number. A step to do is an
// outline. A step with a problem is black with "!". A thin neutral line joins the circles. The line
// is never a selected-state marker.
//
// The circle is round because it is a step marker. tests/lib/tokens.test.js lists this file as the
// one exception to "rounded-full is for avatars and dots".
//
// Below the wide layout (1180 px) the names hide and the circles are smaller, so a phone shows the
// row only. `compact` hides the names everywhere, for a narrow column.

const BUTTON = `flex min-h-touch w-full min-w-touch flex-col items-center rounded-control px-1 text-center text-sm leading-tight text-muted-foreground hover:bg-chrome-raised ${RING}`;
const ROW = 'grid h-11 w-full place-items-center';
const CIRCLE = 'relative z-10 grid place-items-center rounded-full font-semibold tabular-nums';
const SIZE = 'h-7 w-7 text-sm max-[1179px]:h-6 max-[1179px]:w-6 max-[1179px]:text-xs';
const SIZE_COMPACT = 'h-6 w-6 text-xs';
const TONE = {
  complete: 'bg-primary-subtle text-primary-text',
  current: 'bg-primary text-primary-foreground',
  upcoming: 'border border-input bg-canvas text-muted-foreground',
  error: 'bg-inverse text-inverse-foreground',
};

export default function WizardStepper({ steps, label, onGo, compact = false }) {
  const last = steps.length - 1;
  return (
    <nav aria-label={label}>
      <ol data-wizard-rail className="flex items-start">
        {steps.map((s, i) => (
          <li key={s.id} data-state={s.state} className="relative flex min-w-0 flex-1 flex-col items-center">
            {i < last && <span aria-hidden="true" className="pointer-events-none absolute left-1/2 top-[22px] h-px w-full bg-calm" />}
            <button
              type="button"
              onClick={() => onGo(i)}
              aria-current={s.state === 'current' ? 'step' : undefined}
              aria-label={stepAriaLabel(s.label, s.state, i + 1)}
              className={BUTTON}
            >
              <span className={ROW}>
                <span className={`${CIRCLE} ${compact ? SIZE_COMPACT : SIZE} ${TONE[s.state]}`}>
                  {s.state === 'complete' ? <Icon name="check" size="14px" /> : s.state === 'error' ? '!' : i + 1}
                </span>
              </span>
              {!compact && (
                <>
                  <span className={`max-[1179px]:hidden ${s.state === 'current' ? 'font-semibold text-ink' : ''}`}>{s.label}</span>
                  {s.state === 'error' && <span className="text-xs font-semibold text-ink max-[1179px]:hidden">{stepWord('error')}</span>}
                </>
              )}
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}
