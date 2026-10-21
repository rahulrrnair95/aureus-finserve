import { lazy } from 'react';

const RELOAD_KEY = 'af.chunkReloadAt';

/**
 * React.lazy for route pages, with two extras:
 * - After a new deploy the old hashed page files are gone, so a tab opened before it fails to load the next page
 *   (the host answers with index.html). We reload once to pick up the new build instead of leaving a blank screen;
 *   a second failure within a minute is thrown to the error boundary.
 * - `Page.preload()` fetches the page's code ahead of time (see preloadPages).
 */
export function lazyPage(load) {
  const Page = lazy(() =>
    load().catch((err) => {
      let last = 0;
      try {
        last = Number(sessionStorage.getItem(RELOAD_KEY)) || 0;
      } catch {
        /* storage blocked: fall through to the reload */
      }
      if (Date.now() - last > 60000) {
        try {
          sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
        } catch {
          /* ignore */
        }
        window.location.reload();
        return new Promise(() => {}); // keep showing the loader until the reload happens
      }
      throw err;
    }),
  );
  Page.preload = () => load().catch(() => {});
  return Page;
}

/** Fetch page code in the background once the browser is idle, so later navigation is instant. */
export function preloadPages(pages) {
  const run = () => pages.forEach((p) => p?.preload?.());
  if ('requestIdleCallback' in window) window.requestIdleCallback(run, { timeout: 4000 });
  else window.setTimeout(run, 2500);
}
