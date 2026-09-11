import type { Stroke } from '../sim/types';
export interface PendingHole { user: string; seed: string; index: number; strokes: Stroke[] }
const key = 'ppp.daily.outbox.v1';
export function pendingDaily(): PendingHole[] {
  try { return JSON.parse(localStorage.getItem(key) ?? '[]'); } catch { return []; }
}
function same(a: PendingHole, b: PendingHole) { return a.user === b.user && a.seed === b.seed && a.index === b.index; }
export function queueDaily(hole: PendingHole): PendingHole {
  const pending = pendingDaily();
  const first = pending.find(h => same(h, hole));
  if (first) return first; // A retry must never replace the first attempt's strokes.
  localStorage.setItem(key, JSON.stringify([...pending, hole]));
  return hole;
}
export function acknowledgeDaily(hole: PendingHole) {
  localStorage.setItem(key, JSON.stringify(pendingDaily().filter(h => !same(h, hole))));
}
