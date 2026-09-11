/** Cosmetic-only adapter for the pinned gameplay engine's avatar normalizer. */
export const EARNED_HEAD_IDS = [
  'bubble','robot','swamp','vampire','shark','ghost','raccoon',
  'flame','lion','diamond','basketball','pickle','doughnut',
] as const;

export function normalizeAvatarChoice<T extends { head: string }>(
  input: unknown,
  normalize: (value: unknown) => T,
): T {
  const value = normalize(input);
  const head = input && typeof input === 'object' ? (input as { head?: unknown }).head : null;
  return typeof head === 'string' && (EARNED_HEAD_IDS as readonly string[]).includes(head)
    ? { ...value, head }
    : value;
}
