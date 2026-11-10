import { lazy } from 'react';
import { beginPageLoad, endPageLoad } from '@/lib/pagePending';

// A page that downloads when it is first opened. If the download fails it is usually because a new
// version of the site went live and the old file name is gone. A reload fetches the new names, so the
// page is reloaded once. A flag in sessionStorage stops a loop: a second failure in the same tab
// reaches the error screen. A page that loads clears the flag, so a later new version can be
// recovered the same way. If storage is blocked the flag cannot be kept, so no reload is tried.
const FLAG = 'alc.chunk-reload';
const RELOAD_WAIT_MS = 5000;

// True when this tab has not reloaded for a failed page yet. The flag is now set.
function claimReload() {
  try {
    if (sessionStorage.getItem(FLAG)) return false;
    sessionStorage.setItem(FLAG, '1');
    return true;
  } catch (error) {
    console.warn('[lazyPage] storage is blocked, so a failed page will not be reloaded', error);
    return false;
  }
}

// Only a file that could not be fetched is helped by a reload.
// A script that fails while it runs is a bug and a reload would hide it.
// Offline a reload only lands on the browser's offline page.
function isFetchFailure(error) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
  const text = `${error?.name ?? ''} ${error?.message ?? ''}`;
  return /ChunkLoadError|Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|404|Load failed/i.test(text);
}

function clearFlag() {
  try {
    sessionStorage.removeItem(FLAG);
  } catch {
    // Nothing to clear.
  }
}

export function loadPage(importer, reload = () => window.location.reload()) {
  // The file counts as downloading until it has settled for good. Layout.jsx shows the thin bar meanwhile.
  beginPageLoad();
  let ended = false;
  const finish = () => {
    if (ended) return;
    ended = true;
    endPageLoad();
  };

  let started;
  try {
    started = importer();
  } catch (error) {
    finish();
    throw error;
  }

  return started.then(
    (module) => {
      clearFlag();
      finish();
      return module;
    },
    (error) => {
      if (!isFetchFailure(error) || !claimReload()) {
        finish();
        throw error;
      }
      console.warn('[lazyPage] a page file did not load, reloading once', error);
      reload();
      // The page is going away. Waiting keeps the loading message on screen, not the error screen.
      // If the reload never happens, the error screen is shown after a few seconds and not never.
      // The file still counts as downloading during that wait, so the bar stays while the reload runs.
      return new Promise((_, fail) => setTimeout(() => {
        finish();
        fail(error);
      }, RELOAD_WAIT_MS));
    },
  );
}

export const lazyPage = (importer) => lazy(() => loadPage(importer));
