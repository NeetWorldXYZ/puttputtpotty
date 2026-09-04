/**
 * Minimal path router: `/` (title), `/?course=handmade`, `/?seed=xyz` and
 * `/editor`. Uses history.pushState so the URLs are real paths; `#/editor`
 * also works on static hosts without an SPA fallback.
 */

import { useEffect, useState } from 'react';

export type Route = 'play' | 'editor';

export interface Location {
  route: Route;
  /** Generated-course seed, or null. */
  seed: string | null;
  /** Named course ('handmade'), or null. */
  course: string | null;
}

function read(): Location {
  const p = window.location.pathname.replace(/\/+$/, '');
  const h = window.location.hash;
  const route: Route = p.endsWith('/editor') || h === '#/editor' || h === '#editor' ? 'editor' : 'play';
  const q = new URLSearchParams(window.location.search);
  const seed = q.get('seed');
  const course = q.get('course');
  return { route, seed: seed && seed.trim() ? seed.trim() : null, course: course && course.trim() ? course.trim() : null };
}

export function navigate(route: Route, seed: string | null = null, course: string | null = null): void {
  const base = import.meta.env.BASE_URL.replace(/\/+$/, '');
  const path = route === 'editor' ? `${base}/editor` : `${base}/`;
  const q = new URLSearchParams();
  if (seed) q.set('seed', seed);
  if (course) q.set('course', course);
  const qs = q.toString();
  window.history.pushState(null, '', path + (qs ? `?${qs}` : ''));
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
