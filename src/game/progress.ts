/**
 * Royal ranks (from thrones held this season) and levels (from Throne
 * Points, which only ever go up). The app remembers the last rank and level
 * it showed you, so a promotion or a level-up gets a moment of its own.
 */
export const RANKS: readonly (readonly [number, string])[] = [
  [0, 'Squire'],
  [1, 'Throne Holder'],
  [3, 'Duke of Doo'],
  [6, 'Porcelain Prince'],
  [12, 'Lord of the Loos'],
  [25, 'King of Kings'],
];

export function rankIndex(thrones: number): number {
  let i = 0;
  for (let k = 0; k < RANKS.length; k++) if (thrones >= RANKS[k][0]) i = k;
  return i;
}
export function royalTitle(thrones: number): string {
  return RANKS[rankIndex(thrones)][1];
}
/** Thrones needed for the next rank, or null at the top. */
export function nextRank(thrones: number): { title: string; at: number } | null {
  const i = rankIndex(thrones);
  return i + 1 < RANKS.length ? { title: RANKS[i + 1][1], at: RANKS[i + 1][0] } : null;
}

/** Level n starts at tpForLevel(n): 0, 100, 250, 450, 700, 1000, ... (each step 50 more than the last). */
export function tpForLevel(level: number): number {
  const n = Math.max(1, level) - 1;
  return 100 * n + 25 * n * (n - 1);
}
export function levelFor(tp: number): number {
  let l = 1;
  while (tpForLevel(l + 1) <= tp) l++;
  return l;
}
export function levelProgress(tp: number): { level: number; into: number; span: number; toNext: number } {
  const level = levelFor(tp);
  const start = tpForLevel(level);
  const end = tpForLevel(level + 1);
  return { level, into: tp - start, span: end - start, toNext: end - tp };
}

export type PromoEvent = { kind: 'rank'; from: string; to: string; thrones: number } | { kind: 'level'; level: number; tp: number };

const KEY = 'ppp.progress.v1';

/**
 * Compares a fresh profile with what was last shown. Returns the moment to
 * celebrate, if any (a rank promotion wins over a level-up), and remembers
 * the new state. The first look at a profile is remembered quietly.
 */
export function checkProgress(p: { thrones: number; points?: number | null }): PromoEvent | null {
  const rank = rankIndex(p.thrones);
  const level = levelFor(p.points ?? 0);
  let prev: { rank: number; level: number } | null = null;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) prev = JSON.parse(raw) as { rank: number; level: number };
  } catch {
    /* ignore */
  }
  try {
    localStorage.setItem(KEY, JSON.stringify({ rank, level }));
  } catch {
    /* ignore */
  }
  if (!prev) return null;
  if (rank > prev.rank) return { kind: 'rank', from: RANKS[prev.rank][1], to: RANKS[rank][1], thrones: p.thrones };
  if (level > prev.level) return { kind: 'level', level, tp: p.points ?? 0 };
  return null;
}
