/** Modular golfer portraits. Storage keys stay compatible with the deployed server. */
import { renderAvatarArt, renderAvatarPart, renderProfileAvatarArt, renderResultAvatarArt } from './avatarArt';
import { EARNABLE_HEADS, STARTER_HEADS, earnedHeadTones } from './earnedHeads';
import { EARNABLE_BALLS, EARNABLE_SHIRTS, EARNABLE_HATS, EARNABLE_FACES, EARNABLE_COLORS, STARTER_HATS, STARTER_FACES, STARTER_COLORS, STARTER_BALLS, STARTER_SHIRTS, type EarnedBall } from '../../server/potty/cosmeticCatalog';

export interface Avatar {
  /** Skin tone for the classic golfer; for the other heads, that head's colour. */
  porcelain: string;
  seat: string;
  hat: string;
  face: string;
  ball: string;
  /** Which head: the classic golfer, or one of the starters. Missing on old profiles: classic. */
  head: string;
}

export const HEADS: Record<string, { label: string; blurb: string }> = {
  classic: { label: 'Classic', blurb: 'Always a good choice.' },
  roll: { label: 'Roll Head', blurb: 'For the true potty players.' },
  turd: { label: 'Turd King', blurb: 'Legendary status.' },
  alien: { label: 'Area Bowl', blurb: 'Out of this world putting.' },
  dawg: { label: 'Dawg', blurb: "Man's best bogey buddy." },
  ...EARNABLE_HEADS,
};

/** Head colours by the same seven keys as skin tones, so one picker serves every head. */
const HEAD_TONES: Record<string, Record<string, { top: string; bottom: string; label: string }>> = {
  roll: {
    white: { top: '#fffaf0', bottom: '#e6dccb', label: 'White' },
    mint: { top: '#e2f7ea', bottom: '#b9dcc6', label: 'Mint' },
    pink: { top: '#ffe1ea', bottom: '#f0b8c8', label: 'Pink' },
    sky: { top: '#dff1ff', bottom: '#b4d6f0', label: 'Sky' },
    lavender: { top: '#ece2ff', bottom: '#c9b8ec', label: 'Lavender' },
    gold: { top: '#fff2c2', bottom: '#eacf86', label: 'Cream' },
    onyx: { top: '#cfd5dd', bottom: '#a4adb9', label: 'Grey' },
  },
  turd: {
    white: { top: '#c58a4f', bottom: '#a06a38', label: 'Caramel' },
    mint: { top: '#b07a45', bottom: '#8c5a2e', label: 'Toffee' },
    pink: { top: '#a06a3a', bottom: '#7d4f27', label: 'Bronze' },
    sky: { top: '#8b5a2b', bottom: '#6b421c', label: 'Classic' },
    lavender: { top: '#7a4a22', bottom: '#5a3416', label: 'Cocoa' },
    gold: { top: '#6b3e1c', bottom: '#4d2b12', label: 'Espresso' },
    onyx: { top: '#4f2f18', bottom: '#33200f', label: 'Midnight' },
  },
  alien: {
    white: { top: '#b6f28a', bottom: '#8cd25c', label: 'Lime' },
    mint: { top: '#7ed957', bottom: '#5cb63a', label: 'Green' },
    pink: { top: '#4fd1a0', bottom: '#2fa77b', label: 'Sea' },
    sky: { top: '#7ee0ff', bottom: '#4fbde6', label: 'Ice' },
    lavender: { top: '#c9a3ff', bottom: '#a27ae6', label: 'Nebula' },
    gold: { top: '#ffd447', bottom: '#e0b12a', label: 'Solar' },
    onyx: { top: '#8e97b0', bottom: '#66708c', label: 'Grey' },
  },
  dawg: {
    white: { top: '#f5e9d8', bottom: '#dcc7a8', label: 'Cream' },
    mint: { top: '#e8c9a0', bottom: '#cba57a', label: 'Fawn' },
    pink: { top: '#d9a677', bottom: '#b8845a', label: 'Tan' },
    sky: { top: '#c48c62', bottom: '#a76e4c', label: 'Red' },
    lavender: { top: '#a66d49', bottom: '#855135', label: 'Brown' },
    gold: { top: '#8c8c8c', bottom: '#6b6b6b', label: 'Grey' },
    onyx: { top: '#4a4a4a', bottom: '#2e2e2e', label: 'Black' },
  },
};

/** The colour swatches the picker should show for a head. */
export function headTones(head: string): Record<string, { top: string; bottom: string; label: string }> {
  return { ...(earnedHeadTones(head) ?? HEAD_TONES[head] ?? PORCELAIN), ...Object.fromEntries(Object.entries(EARNABLE_COLORS).map(([key,v]) => [key,{top:v.color,bottom:v.accent,label:v.label}])) };
}

export const PORCELAIN: Record<string, { top: string; bottom: string; label: string }> = {
  white: { top: '#fff1d2', bottom: '#edcaa0', label: 'Fair' },
  mint: { top: '#f0cfaa', bottom: '#d9aa7d', label: 'Light' },
  pink: { top: '#e3b38a', bottom: '#c38d64', label: 'Warm' },
  sky: { top: '#c48c62', bottom: '#a76e4c', label: 'Tan' },
  lavender: { top: '#a66d49', bottom: '#855135', label: 'Brown' },
  gold: { top: '#825238', bottom: '#653c29', label: 'Deep' },
  onyx: { top: '#5d3d30', bottom: '#422a23', label: 'Rich' },
};

export const SEATS: Record<string, { color: string; label: string }> = {
  white: { color: '#fff8e5', label: 'White' },
  ink: { color: '#1f2a44', label: 'Black' },
  red: { color: '#ff5f7e', label: 'Red' },
  blue: { color: '#4db8ff', label: 'Blue' },
  wood: { color: '#ffc943', label: 'Pizza' },
  gold: { color: '#ffd447', label: 'Gold' },
  ...EARNABLE_SHIRTS,
};

export const HATS: Record<string, string> = { none: 'None', crown: 'Crown', cap: 'Cap', tophat: 'Top Hat', plunger: 'Plunger', halo: 'Halo', ...Object.fromEntries(Object.entries(EARNABLE_HATS).map(([k,v]) => [k,v.label])) };
// The old sleepy slot becomes the moustache design; other face choices retain their identity.
export const FACES: Record<string, string> = { happy: 'Default', cool: 'Cool', wink: 'Wink', angry: 'Angry', sleepy: 'Mustache', ...Object.fromEntries(Object.entries(EARNABLE_FACES).map(([k,v]) => [k,v.label])) };

export interface BallLook {
  color: string;
  pattern: 'plain' | 'stripe' | 'dots';
  accent: string;
  label: string;
  motif?: 'eight' | 'fire' | 'gold';
  material?: EarnedBall;
}
export const BALLS: Record<string, BallLook> = {
  white: { color: '#ffffff', pattern: 'plain', accent: '#c4cfdb', label: 'Classic' },
  tomato: { color: '#ff6f3c', pattern: 'plain', accent: '#ffcf51', label: 'Fire', motif: 'fire' },
  lemon: { color: '#ffd447', pattern: 'plain', accent: '#fff0a8', label: 'Gold', motif: 'gold' },
  lime: { color: '#7ed957', pattern: 'plain', accent: '#c6f2a8', label: 'Green' },
  sky: { color: '#4db8ff', pattern: 'plain', accent: '#b3e1ff', label: 'Sky' },
  grape: { color: '#9b6bff', pattern: 'plain', accent: '#d4c1ff', label: 'Grape' },
  bubblegum: { color: '#ff8fc8', pattern: 'plain', accent: '#ffd0e8', label: 'Bubblegum' },
  ink: { color: '#1f2a44', pattern: 'plain', accent: '#5a6474', label: '8 Ball', motif: 'eight' },
  stripe: { color: '#ffffff', pattern: 'stripe', accent: '#ff5f7e', label: 'Racing stripe' },
  dots: { color: '#ffffff', pattern: 'dots', accent: '#4db8ff', label: 'Polka' },
  tiger: { color: '#ff9f1c', pattern: 'stripe', accent: '#1f2a44', label: 'Tiger' },
  ...Object.fromEntries(Object.entries(EARNABLE_BALLS).map(([material,item]) => [material,{...item,pattern:'plain' as const,material:material as EarnedBall}])),
};

export const DEFAULT_AVATAR: Avatar = { porcelain: 'white', seat: 'white', hat: 'none', face: 'happy', ball: 'white', head: 'classic' };

/** Any input (server rows, old caches, user payloads) -> a valid avatar. Unknown parts fall back. */
export function normalizeAvatar(input: unknown): Avatar {
  const o = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const pick = (v: unknown, allowed: Record<string, unknown>, fallback: string) =>
    typeof v === 'string' && Object.prototype.hasOwnProperty.call(allowed, v) ? v : fallback;
  return {
    porcelain: pick(o.porcelain, headTones(typeof o.head === 'string' ? o.head : 'classic'), DEFAULT_AVATAR.porcelain),
    seat: pick(o.seat, SEATS, DEFAULT_AVATAR.seat),
    hat: pick(o.hat, HATS, DEFAULT_AVATAR.hat),
    face: pick(o.face, FACES, DEFAULT_AVATAR.face),
    ball: pick(o.ball, BALLS, DEFAULT_AVATAR.ball),
    head: pick(o.head, HEADS, DEFAULT_AVATAR.head),
  };
}

export function ballLook(av: Avatar | null | undefined): BallLook {
  return BALLS[av?.ball ?? ''] ?? BALLS.white;
}

export const AVATAR_VIEWBOX = '0 0 160 170';

/** Shared artwork used by profiles, rankings, matches, and the dressing room. */
export function avatarSvg(input: Avatar | null | undefined, id = 'av'): string {
  const av = normalizeAvatar(input);
  return renderAvatarArt(av, headTones(av.head)[av.porcelain], SEATS[av.seat].color, ballLook(av), id);
}

export function profileAvatarSvg(input: Avatar | null | undefined, id: string): string {
  const av = normalizeAvatar(input);
  return renderProfileAvatarArt(av, headTones(av.head)[av.porcelain], SEATS[av.seat].color, ballLook(av), id);
}

export function resultAvatarSvg(input: Avatar | null | undefined, mood:'win'|'loss'|'draw', id:string):string {
  const av=normalizeAvatar(input);
  return renderResultAvatarArt(av,headTones(av.head)[av.porcelain],SEATS[av.seat].color,id,mood);
}

export function avatarPartSvg(input: Avatar, part: keyof Avatar, id: string): {markup:string;viewBox:string} {
  const av = normalizeAvatar(input);
  const tone = part === 'face' ? PORCELAIN.white : headTones(av.head)[av.porcelain];
  return renderAvatarPart(av, part, tone, SEATS[av.seat].color, ballLook(av), id);
}

/** A new player's first look: any of the five heads in any colour, the rest kept plain so the editor has somewhere to go. */
export function starterAvatar(r: () => number): Avatar {
  const pick = (keys: string[]) => keys[Math.floor(r() * keys.length) % keys.length];
  const head = pick([...STARTER_HEADS]);
  return {
    head,
    porcelain: pick([...STARTER_COLORS]),
    seat: pick([...STARTER_SHIRTS]),
    hat: head === 'turd' || head === 'alien' || head === 'dawg' ? 'crown' : 'none',
    face: 'happy',
    ball: 'white',
  };
}

/** A random look, from a 0..1 source: bots and previews. */
export function randomAvatar(r: () => number): Avatar {
  const pick = (keys: string[]) => keys[Math.floor(r() * keys.length) % keys.length];
  return {
    porcelain: pick([...STARTER_COLORS]),
    seat: pick([...STARTER_SHIRTS]),
    hat: pick([...STARTER_HATS]),
    face: pick([...STARTER_FACES]),
    ball: pick([...STARTER_BALLS]),
    head: pick([...STARTER_HEADS]),
  };
}
