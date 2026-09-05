import { dailySeed, secondsUntilNextDaily } from '../generator/generator';
import { navigate } from '../router';

export type CourseChoice = 'handmade' | 'random' | 'daily' | 'title';

export function randomSeed(): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}

export const COURSE_LENGTHS = [
  { n: 3, label: '3', blurb: 'quick one, a coffee break' },
  { n: 9, label: '9', blurb: 'the classic' },
  { n: 18, label: '18', blurb: 'a proper round' },
  { n: 27, label: '27', blurb: "marathon, it'll be a while" },
] as const;

const LEN_KEY = 'ppp.len.v1';
export function getPreferredLength(): number {
  try {
    const n = Number(localStorage.getItem(LEN_KEY));
    return COURSE_LENGTHS.some((l) => l.n === n) ? n : 9;
  } catch {
    return 9;
  }
}
export function setPreferredLength(n: number): void {
  try {
    localStorage.setItem(LEN_KEY, String(n));
  } catch {
    /* ignore */
  }
}

export function goToCourse(choice: CourseChoice, n?: number): void {
  if (choice === 'title') navigate('play', null, null);
  else if (choice === 'handmade') navigate('play', null, 'handmade');
  else if (choice === 'daily') navigate('play', dailySeed(), null);
  else navigate('play', randomSeed(), null, { n: n ?? getPreferredLength() });
}

const BEST_KEY = 'ppp.best.v1';

export function getBest(seed: string): number | null {
  try {
    const m = JSON.parse(localStorage.getItem(BEST_KEY) ?? '{}') as Record<string, number>;
    return typeof m[seed] === 'number' ? m[seed] : null;
  } catch {
    return null;
  }
}

/** Returns true if this is a new best. */
export function recordBest(seed: string, total: number): boolean {
  try {
    const m = JSON.parse(localStorage.getItem(BEST_KEY) ?? '{}') as Record<string, number>;
    const prev = m[seed];
    if (typeof prev === 'number' && prev <= total) return false;
    m[seed] = total;
    localStorage.setItem(BEST_KEY, JSON.stringify(m));
    return true;
  } catch {
    return false;
  }
}

export { dailySeed, secondsUntilNextDaily };
