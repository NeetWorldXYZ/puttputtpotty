import { dailySeed } from '../generator/generator';
import { navigate } from '../router';

export type CourseChoice = 'handmade' | 'random' | 'daily';

export function randomSeed(): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}

export function goToCourse(choice: CourseChoice): void {
  if (choice === 'handmade') navigate('play', null);
  else if (choice === 'daily') navigate('play', dailySeed());
  else navigate('play', randomSeed());
}

export { dailySeed };
