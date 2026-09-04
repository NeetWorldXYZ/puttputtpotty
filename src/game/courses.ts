import { dailySeed } from '../generator/generator';
import { navigate } from '../router';

export type CourseChoice = 'handmade' | 'random' | 'daily' | 'title';

export function randomSeed(): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}

export function goToCourse(choice: CourseChoice): void {
  if (choice === 'title') navigate('play', null, null);
  else if (choice === 'handmade') navigate('play', null, 'handmade');
  else if (choice === 'daily') navigate('play', dailySeed(), null);
  else navigate('play', randomSeed(), null);
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

export { dailySeed };
