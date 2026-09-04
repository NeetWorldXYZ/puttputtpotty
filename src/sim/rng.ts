/**
 * mulberry32 — small, fast, seedable 32-bit PRNG. State is a single uint32
 * so it serialises as a plain number inside SimState.
 *
 * Phase 1 physics is fully deterministic without randomness; the RNG is
 * threaded through the state so that later phases (generator, moving
 * obstacles with random phase, ...) can draw from it without changing the
 * replay contract.
 */

export function seedFromString(s: string): number {
  // FNV-1a 32-bit
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Advance the state and return [nextState, value in [0,1)]. Pure. */
export function rngNext(state: number): [number, number] {
  let a = (state + 0x6d2b79f5) >>> 0;
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return [a, value];
}
