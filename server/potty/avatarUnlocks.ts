/** Cosmetic-only adapter for the pinned gameplay engine's avatar normalizer. */
import { gearReward, gearUnlocked, type GearAwards } from './cosmeticCatalog.ts';
export const EARNED_HEAD_IDS = [
  'bubble','robot','swamp','vampire','shark','ghost','raccoon',
  'flame','lion','diamond','basketball','pickle','doughnut',
] as const;

export function normalizeAvatarChoice<T extends { head: string; seat:string; ball:string }>(
  input: unknown,
  normalize: (value: unknown) => T,
): T {
  const value = normalize(input);
  const o = input && typeof input === 'object' ? input as Record<string,unknown> : {};
  if(typeof o.head==='string' && (EARNED_HEAD_IDS as readonly string[]).includes(o.head))value.head=o.head;
  for(const slot of ['seat','ball'] as const){
    const key=o[slot];if(typeof key==='string' && gearReward(slot,key))value[slot]=key;
  }
  return value;
}

export function needsUnlockCheck(av:{head:string;seat:string;ball:string}):boolean {
  return (EARNED_HEAD_IDS as readonly string[]).includes(av.head)||!!gearReward('seat',av.seat)||!!gearReward('ball',av.ball);
}
export function lockedAvatarPart(av:{head:string;seat:string;ball:string},awards:(GearAwards & {unlocked?:string[]})|null):string|null {
  if((EARNED_HEAD_IDS as readonly string[]).includes(av.head)&&!awards?.unlocked?.includes(av.head))return 'head';
  if(!gearUnlocked('seat',av.seat,awards))return 'shirt';
  if(!gearUnlocked('ball',av.ball,awards))return 'ball';
  return null;
}
