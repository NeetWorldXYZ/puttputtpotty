/**
 * Minimal path router: `/` and `/editor`. Uses history.pushState so the
 * URLs are real paths (Vite's dev server and any SPA-fallback host serve
 * them). Also accepts `#/editor` for static hosts without a fallback.
 */

import { useEffect, useState } from 'react';

export type Route = 'play' | 'editor';

function read(): Route {
  const p = window.location.pathname.replace(/\/+$/, '');
  const h = window.location.hash;
  if (p.endsWith('/editor') || h === '#/editor' || h === '#editor') return 'editor';
  return 'play';
}

export function navigate(route: Route): void {
  const base = import.meta.env.BASE_URL.replace(/\/+$/, '');
  const path = route === 'editor' ? `${base}/editor` : `${base}/`;
  window.history.pushState(null, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(read);
  useEffect(() => {
    const on = () => setRoute(read());
    window.addEventListener('popstate', on);
    window.addEventListener('hashchange', on);
    return () => {
      window.removeEventListener('popstate', on);
      window.removeEventListener('hashchange', on);
    };
  }, []);
  return route;
}
