import { useState } from 'react';
import Icon from '@/components/Icon';
import { RING_ON_WARNING as RING, CHECKBOX, BUTTON_LG_PRIMARY, BUTTON_OUTLINE } from '@/lib/ui';

// The warning colours are used here because the code cannot be recovered. An anonymous record
// has no name or email behind it. So the warning is the message and not decoration.
// The ring uses the offset of the tinted card so it shows no white halo.

// `purpose` has no default on purpose. Two flows show this card and a default would let a new
// one say the wrong thing. The caller names what the code is for.
export default function TokenDisplay({ token, purpose, onContinue }) {
  const [saved, setSaved] = useState(false);
  const [copyState, setCopyState] = useState('idle');

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(token);
      setCopyState('copied');
    } catch {
      // Never silent. The reader is told what to do instead.
      setCopyState('failed');
    }
  }

  const message = {
    copied: 'Copied to your clipboard.',
    failed: 'Copying is blocked in this browser. Select the code above and copy it yourself.',
  }[copyState] ?? '';

  return (
    <div className="rounded-card border border-warning-border bg-warning-subtle p-[22px]">
      <h2 className="flex items-center gap-2 font-head text-[20px] leading-[1.25] text-warning-strong">
        <Icon name="warning" />
        Save this code before leaving
      </h2>
      <p className="mt-2 text-sm">
        This code is shown once and cannot be recovered. It is the only way to {purpose} because
        nothing here is linked to your name or email.
      </p>

      <p className="mt-4 text-xs font-medium text-muted-foreground">Your code</p>
      {/* A dashed box. The code is ink, not blue: blue is for actions. */}
      <code className="mt-1 block select-all break-all rounded-card border border-dashed border-border bg-surface px-5 py-4 font-mono text-[22px] tracking-[0.08em] text-ink">
        {token}
      </code>

      <button
        type="button"
        onClick={handleCopy}
        className={`${BUTTON_OUTLINE} mt-3 focus-visible:ring-offset-warning-subtle`}
      >
        <Icon name="content_copy" className="text-base" />
        Copy code
      </button>
      {/* The status region is always on the page. Its first message would not be read out
          if it were added later. */}
      <p role="status" className="mt-2 text-sm">{message}</p>

      <label htmlFor="token-saved" className="mt-2 flex min-h-touch cursor-pointer items-center gap-3 text-sm">
        <input
          id="token-saved"
          type="checkbox"
          checked={saved}
          onChange={(e) => setSaved(e.target.checked)}
          className={`${CHECKBOX} ${RING}`}
        />
        <span>I have saved my code somewhere private.</span>
      </label>

      {/* The continue action sits below the warning and the tick box, never above them. The
          button is aria-disabled until the tick box is ticked, which index.css draws as disabled. */}
      <button
        type="button"
        aria-disabled={!saved || undefined}
        onClick={() => onContinue()}
        className={`mt-4 w-full ${BUTTON_LG_PRIMARY}`}
      >
        Continue to check my request
      </button>
      {!saved && (
        <p className="mt-2 text-xs text-muted-foreground">
          Tick the box above to continue. This code will not be shown again.
        </p>
      )}
    </div>
  );
}
