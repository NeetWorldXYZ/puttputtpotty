/**
 * Minimal path router: `/` and `/editor`, plus an optional `?seed=` query
 * that selects a generated course. Uses history.pushState so the URLs are
 * real paths (Vite's dev server and any SPA-fallback host serve them).
 * Also accepts `#/editor` for static hosts without a fallback.
 */

import { useEffect, useState } from 'react';

export type Route = 'play' | 'editor';

export interface Location {
  route: Route;
  /** Generated-course seed, or null for the handmade course. */
  seed: string | null;
}

function read(): Location {
  const p = window.location.pathname.replace(/\/+$/, '');
  const h = window.location.hash;
  const route: Route = p.endsWith('/editor') || h === '#/editor' || h === '#editor' ? 'editor' : 'play';
  const seed = new URLSearchParams(window.location.search).get('seed');
  return { route, seed: seed && seed.trim() ? seed.trim() : null };
}

export function navigate(route: Route, seed: string | null = null): void {
  const base = import.meta.env.BASE_URL.replace(/\/+$/, '');
  const path = route === 'editor' ? `${base}/editor` : `${base}/`;
  const q = seed ? `?seed=${encodeURIComponent(seed)}` : '';
  window.history.pushState(null, '', path + q);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function useLocation(): Location {
  const [loc, setLoc] = useState<Location>(read);
  useEffect(() => {
    const on = () => setLoc(read());
    window.addEventListener('popstate', on);
    window.addEventListener('hashchange', on);
    return () => {
      window.removeEventListener('popstate', on);
      window.removeEventListener('hashchange', on);
    };
  }, []);
  return loc;
}
