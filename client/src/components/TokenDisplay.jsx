import { useState } from 'react';
import Icon from '@/components/Icon';
import { RING_ON_WARNING as RING, BUTTON_PRIMARY, BUTTON_DISABLED } from '@/lib/ui';

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
    <div className="rounded-card border border-warning-border bg-warning-subtle p-6">
      <h2 className="flex items-center gap-2 font-head text-2xl leading-heading text-warning-strong">
        <Icon name="warning" />
        Save this code before leaving
      </h2>
      <p className="mt-2 text-sm">
        This code is shown once and cannot be recovered. It is the only way to {purpose} because
        nothing here is linked to your name or email.
      </p>

      <p className="mt-4 text-xs font-medium text-muted-foreground">Your code</p>
      <code className="mt-1 block select-all break-all rounded bg-surface px-4 py-3 font-mono
      text-3xl tracking-widest text-primary">
        {token}
      </code>

      <button
        type="button"
        onClick={handleCopy}
        className={`mt-3 inline-flex min-h-touch items-center gap-2 
          rounded border border-primary bg-surface px-4 font-sans
          text-sm font-semibold text-primary ${RING}`}
      >
        <Icon name="content_copy" className="text-base" />
        Copy code
      </button>
      {/* The status region is always on the page. Its first message would not be read out
          if it were added later. */}
      <p role="status" className="mt-2 text-sm">{message}</p>

      <label htmlFor="token-saved" className="mt-2 flex min-h-touch 
      cursor-pointer items-center gap-3 text-sm">
        <input
          id="token-saved"
          type="checkbox"
          checked={saved}
          onChange={(e) => setSaved(e.target.checked)}
          className={`h-5 w-5 shrink-0 accent-primary ${RING}`}
        />
        <span>I have saved my code somewhere private.</span>
      </label>

      <button
        type="button"
        aria-disabled={!saved || undefined}
        onClick={() => onContinue()}
        className={`mt-4 ${saved ? BUTTON_PRIMARY : BUTTON_DISABLED}`}
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
