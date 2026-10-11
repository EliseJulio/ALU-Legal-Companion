import { useState } from 'react';
import { Copy, TriangleAlert } from 'lucide-react';
import { RING_ON_WARNING as RING } from '@/lib/ui';

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
    <div className="rounded border border-warning-border bg-warning-subtle p-4">
      <h2 className="flex items-center gap-2 font-head text-lg font-bold text-warning-strong">
        <TriangleAlert aria-hidden="true" className="h-5 w-5" />
        Save this code now
      </h2>
      <p className="mt-2 text-sm">
        This code is shown once and cannot be recovered. It is the only way to {purpose} because
        nothing here is linked to your name or email.
      </p>

      <p className="mt-4 text-xs font-medium text-muted-foreground">Your code</p>
      <code className="mt-1 block select-all break-all font-mono 
      text-3xl tracking-widest text-primary">
        {token}
      </code>

      <button
        type="button"
        onClick={handleCopy}
        className={`mt-3 inline-flex min-h-touch items-center gap-2 
          rounded border border-primary bg-surface px-4 font-head 
          text-sm font-semibold text-primary ${RING}`}
      >
        <Copy aria-hidden="true" className="h-4 w-4" />
        Copy
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
        <span>I have saved this code somewhere I can find it again.</span>
      </label>

      <button
        type="button"
        disabled={!saved}
        onClick={() => onContinue()}
        className={`mt-3 inline-flex min-h-touch items-center rounded px-4 
          font-head font-semibold text-primary-foreground 
          ${RING} ${saved ? 'bg-primary' : 'bg-disabled'}`}
      >
        Continue
      </button>
      {!saved && (
        <p className="mt-2 text-xs text-muted-foreground">
          Tick the box above to continue. This code will not be shown again.
        </p>
      )}
    </div>
  );
}
