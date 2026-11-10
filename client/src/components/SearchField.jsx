import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '@/components/Icon';
import { RING_ON_CANVAS } from '@/lib/ui';

// The search box of the wide top bar. Ctrl+K (Cmd+K on a Mac) moves to it from any page. Enter
// opens the search page with the words in the address. Escape empties the box. The results page
// does the searching, so this box only sends the words on.
// `className` sizes the box where it sits. The default fills the bar up to a maximum width.
export default function SearchField({ className = 'max-w-md flex-1' }) {
  const navigate = useNavigate();
  const box = useRef(null);

  useEffect(() => {
    const onKey = (event) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return;
      if (event.key.toLowerCase() !== 'k') return;
      event.preventDefault();
      box.current?.focus();
      box.current?.select();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // The words go in the address, so the results can be shared and reloaded. The results page takes
  // focus on its heading (location state), so a screen reader starts at the results.
  function submit(event) {
    event.preventDefault();
    const text = String(new FormData(event.currentTarget).get('q') ?? '').trim();
    navigate(text ? `/search?${new URLSearchParams({ q: text })}` : '/search', { state: { focusResults: true } });
    event.currentTarget.reset();
  }

  function clearOnEscape(event) {
    if (event.key === 'Escape' && box.current?.value) {
      event.preventDefault();
      box.current.value = '';
    }
  }

  return (
    <form
      role="search"
      aria-label="Site search"
      onSubmit={submit}
      className={`flex min-h-touch min-w-0 items-center gap-2 rounded-control border border-control bg-surface pl-4 pr-1 focus-within:ring-2 focus-within:ring-focus ${className}`}
    >
      <label htmlFor="site-search" className="sr-only">Search the site</label>
      <input
        id="site-search"
        ref={box}
        name="q"
        type="search"
        maxLength={100}
        onKeyDown={clearOnEscape}
        placeholder="Search the site"
        className="min-h-touch min-w-0 flex-1 bg-transparent text-sm text-ink placeholder:text-muted-foreground focus:outline-none"
      />
      <kbd aria-hidden="true" className="hidden shrink-0 rounded-control border border-border px-1.5 font-mono text-xs text-faint sm:inline">Ctrl K</kbd>
      <button
        type="submit"
        aria-label="Search the site"
        className={`grid min-h-touch min-w-touch shrink-0 place-items-center rounded-control text-muted-foreground hover:text-ink ${RING_ON_CANVAS}`}
      >
        <Icon name="search" />
      </button>
    </form>
  );
}
