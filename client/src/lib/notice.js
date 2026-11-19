import { useSyncExternalStore } from 'react';

// One short message for the page the person is on. It stays when the list under it reloads.
let current = null;
let nextId = 0;
const listeners = new Set();

function emit() {
  listeners.forEach((listener) => listener());
}

export function announce(text) {
  nextId += 1;
  current = { id: nextId, text };
  emit();
}

export function clearNotice() {
  if (current === null) return;
  current = null;
  emit();
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useNotice() {
  return useSyncExternalStore(subscribe, () => current, () => current);
}
