import { useState } from 'react';
import { FIELD, RING } from '@/lib/ui';

// A password box with a "Show password" tick box under it. A tick box shows its state to the eye
// and to a screen reader, and it never sends the form. The label is the same whether it is ticked
// or not. A page with two boxes names it "Show passwords" through `toggleLabel`.
//
// A page with two boxes (a new password and its repeat) keeps `shown` in its own state. It passes
// `shown` and `toggle={false}` to the first box and `shown` with `onShownChange` to the last. One
// tick box then sits under the last box and controls both. `controls` lists the ids of every box
// it changes. It is the box's own id when left out. Any other prop goes straight to the box.
export default function PasswordField({
  id, label, hint, className = '', shown, onShownChange, toggle = true, toggleLabel = 'Show password', controls, ...props
}) {
  const [own, setOwn] = useState(false);
  const visible = shown ?? own;
  const hintId = hint ? `${id}-hint` : undefined;
  const flip = () => (onShownChange ?? setOwn)(!visible);
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-medium">{label}</label>
      {hint && <p id={hintId} className="mt-1 text-sm text-muted-foreground">{hint}</p>}
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        aria-describedby={hintId}
        autoCapitalize="none"
        spellCheck={false}
        className={FIELD}
        {...props}
      />
      {toggle && (
        <label htmlFor={`${id}-show`} className="mt-1 flex min-h-touch cursor-pointer items-center gap-3 text-sm">
          <input
            id={`${id}-show`}
            type="checkbox"
            checked={visible}
            aria-controls={controls ?? id}
            onChange={flip}
            className={`h-5 w-5 shrink-0 accent-primary ${RING}`}
          />
          <span>{toggleLabel}</span>
        </label>
      )}
    </div>
  );
}
