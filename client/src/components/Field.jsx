import { FIELD, RING } from '@/lib/ui';

// One labelled form box. The label is always shown. A hint, if there is one, is tied to the box
// so a screen reader reads it with the label. `as` picks a text box (the default), a text area
// or a select. Any other prop goes straight to the box.
export default function Field({ id, label, hint, as = 'input', className = '', children, ...props }) {
  const hintId = hint ? `${id}-hint` : undefined;
  const Box = as;
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-medium">{label}</label>
      {hint && <p id={hintId} className="mt-1 text-sm text-muted-foreground">{hint}</p>}
      <Box id={id} aria-describedby={hintId} className={FIELD} {...props}>{children}</Box>
    </div>
  );
}

// A tick box with its label beside it. The whole row is at least 44 px high.
// `describedBy` points at a message such as an error. `invalid` marks the box as the cause of it.
export function CheckField({ id, label, checked, onChange, hint, className = '', describedBy, invalid = false }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="flex min-h-touch cursor-pointer items-center gap-3 text-sm">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className={`h-5 w-5 shrink-0 accent-primary ${RING}`}
        />
        <span>{label}</span>
      </label>
      {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
    </div>
  );
}
