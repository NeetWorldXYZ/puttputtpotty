/**
 * Minimal path router: `/` (title), `/?course=handmade`, `/?seed=xyz`,
 * `/?loc=osm:node:1&mode=throne` (a bathroom's hole), `/map` and `/editor`.
 * Uses history.pushState so the URLs are real paths; `#/editor` and `#/map`
 * also work on static hosts without an SPA fallback.
 */

import { useEffect, useState } from 'react';

export type Route = 'play' | 'editor' | 'map' | 'leaders';

export interface Location {
  route: Route;
  /** Generated-course seed, or null. */
  seed: string | null;
  /** Named course ('handmade'), or null. */
  course: string | null;
  /** Bathroom (location) id for a single-hole location play, or null. */
  loc: string | null;
  /** 'throne' submits the run for the throne; anything else is practice. */
  mode: string | null;
  /** Hole count for a generated course (default 9). */
  n: number | null;
}

export interface NavigateOptions {
  seed?: string | null;
  course?: string | null;
  loc?: string | null;
  mode?: string | null;
  n?: number | null;
  /** Replace the history entry instead of pushing one. */
  replace?: boolean;
}

function read(): Location {
  const p = window.location.pathname.replace(/\/+$/, '');
  const h = window.location.hash.replace(/^#\/?/, '');
  const route: Route = p.endsWith('/editor') || h === 'editor' ? 'editor' : p.endsWith('/map') || h === 'map' ? 'map' : p.endsWith('/leaders') || h === 'leaders' ? 'leaders' : 'play';
  const q = new URLSearchParams(window.location.search);
  const clean = (v: string | null) => (v && v.trim() ? v.trim() : null);
  const nRaw = Number(q.get('n'));
  const n = Number.isInteger(nRaw) && nRaw >= 1 && nRaw <= 36 ? nRaw : null;
  return { route, seed: clean(q.get('seed')), course: clean(q.get('course')), loc: clean(q.get('loc')), mode: clean(q.get('mode')), n };
}

export function navigate(route: Route, seed: string | null = null, course: string | null = null, extra: NavigateOptions = {}): void {
  const base = import.meta.env.BASE_URL.replace(/\/+$/, '');
  const path = route === 'editor' ? `${base}/editor` : route === 'map' ? `${base}/map` : route === 'leaders' ? `${base}/leaders` : `${base}/`;
  const q = new URLSearchParams();
  const s = extra.seed ?? seed;
  const c = extra.course ?? course;
  if (s) q.set('seed', s);
  if (c) q.set('course', c);
  if (extra.loc) q.set('loc', extra.loc);
  if (extra.mode) q.set('mode', extra.mode);
  if (extra.n && extra.n !== 9) q.set('n', String(extra.n));
  const qs = q.toString();
  const url = path + (qs ? `?${qs}` : '');
  if (extra.replace) window.history.replaceState(null, '', url);
  else window.history.pushState(null, '', url);
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
