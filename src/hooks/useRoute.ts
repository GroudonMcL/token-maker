import { useSyncExternalStore } from 'react';

/**
 * A tiny router: the current path, and `navigate()` to change it without a
 * page reload. Cloudflare Pages serves index.html for unknown paths, so
 * /about and /privacy work when opened directly too.
 */
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener('popstate', cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener('popstate', cb);
  };
}

export function navigate(path: string) {
  if (path === window.location.pathname) return;
  window.history.pushState(null, '', path);
  window.scrollTo(0, 0);
  listeners.forEach((l) => l());
}

export function useRoute(): string {
  return useSyncExternalStore(subscribe, () => window.location.pathname, () => '/');
}
