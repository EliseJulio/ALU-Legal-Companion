// Only one panel of the top bar is open at a time. These are the bell panel and the account menu.
// A panel that opens says so. Every other panel closes when it hears it.
// A window event keeps the two components apart so neither has to know the other exists.
const EVENT = 'alc-popover';

// Called by a panel at the moment it opens. `name` is that panel's own name.
export function announcePopover(name) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: name }));
}

// Calls `close` when a different panel opens. Returns the function that stops listening.
export function closeWhenOtherOpens(name, close) {
  const onOpen = (event) => {
    if (event.detail !== name) close();
  };
  window.addEventListener(EVENT, onOpen);
  return () => window.removeEventListener(EVENT, onOpen);
}
