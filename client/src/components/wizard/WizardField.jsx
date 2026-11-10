import Select from '@/components/Select';
import { useWizardErrors } from '@/components/wizard/WizardContext';
import { FORM_FIELD, FORM_TEXTAREA, CHECKBOX, RING } from '@/lib/ui';

// The message under a field. It is words in ink with a small mark, never red. Red is kept for the
// emergency numbers. Nothing is shown when there is no message.
export function FieldError({ id, message }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1 flex items-start gap-2 text-sm font-semibold text-ink">
      <span aria-hidden="true" className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-control bg-inverse text-[11px] font-bold leading-none text-inverse-foreground">!</span>
      <span>{message}</span>
    </p>
  );
}

// A labelled box inside a step. Its message comes from the wizard by id. aria-invalid and the
// message are tied to the box, so a screen reader reads both with it.
export function WizField({ id, label, hint, as = 'input', className = '', children, ...props }) {
  const errors = useWizardErrors();
  const message = errors[id];
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = message ? `${id}-error` : undefined;
  const describedBy = [hintId, errId].filter(Boolean).join(' ') || undefined;
  const common = { id, 'aria-describedby': describedBy, 'aria-invalid': message ? true : undefined, ...props };
  const Box = as;
  const box = as === 'select'
    ? <Select {...common} className={`${FORM_FIELD} ${RING}`} wrapperClassName="mt-2 flex w-full">{children}</Select>
    : <Box {...common} className={as === 'textarea' ? FORM_TEXTAREA : FORM_FIELD}>{children}</Box>;
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-semibold">{label}</label>
      {hint && <p id={hintId} className="mt-1 text-sm text-muted-foreground">{hint}</p>}
      {box}
      <FieldError id={errId} message={message} />
    </div>
  );
}

// A tick box with its words beside it. It is used for "Required" and "It is free" and the gate.
// The label is the words of the choice only. The sub-line is linked to the box as its description.
// So the accessible name stays the label.
// `offset` is the ring gap colour for the surface the box sits on.
// A tinted row needs its own tint here. Otherwise the gap shows as a white halo.
export function WizCheck({ id, label, sub, checked, onChange, className = '', offset = '' }) {
  const errors = useWizardErrors();
  const message = errors[id];
  const errId = message ? `${id}-error` : undefined;
  const subId = sub ? `${id}-sub` : undefined;
  const describedBy = [subId, errId].filter(Boolean).join(' ') || undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="flex min-h-touch cursor-pointer items-start gap-3 text-sm">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          aria-invalid={message ? true : undefined}
          aria-describedby={describedBy}
          className={`mt-1 ${CHECKBOX} ${RING} ${offset}`}
        />
        <span className="font-semibold">{label}</span>
      </label>
      {sub && <p id={subId} className="ml-8 text-sm text-muted-foreground">{sub}</p>}
      <FieldError id={errId} message={message} />
    </div>
  );
}
