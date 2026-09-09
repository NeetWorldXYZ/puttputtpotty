/** Human golfer portraits. Legacy porcelain/seat keys retain saved profile compatibility. */

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
  return HEAD_TONES[head] ?? PORCELAIN;
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
  white: { color: '#63bdcb', label: 'Teal' },
  ink: { color: '#1f2a44', label: 'Black' },
  red: { color: '#ff5f7e', label: 'Red' },
  blue: { color: '#4db8ff', label: 'Blue' },
  wood: { color: '#c8874a', label: 'Clay' },
  gold: { color: '#ffd447', label: 'Gold' },
};

export const HATS: Record<string, string> = { none: 'No hat', crown: 'Crown', cap: 'Cap', tophat: 'Top hat', plunger: 'Plunger', halo: 'Halo' };
export const FACES: Record<string, string> = { happy: 'Happy', cool: 'Cool', sleepy: 'Sleepy', angry: 'Fired up', wink: 'Wink' };

export interface BallLook {
  color: string;
  pattern: 'plain' | 'stripe' | 'dots';
  accent: string;
  label: string;
}
export const BALLS: Record<string, BallLook> = {
  white: { color: '#ffffff', pattern: 'plain', accent: '#c4cfdb', label: 'Classic' },
  tomato: { color: '#ff6f3c', pattern: 'plain', accent: '#ffb08a', label: 'Tomato' },
  lemon: { color: '#ffd447', pattern: 'plain', accent: '#fff0a8', label: 'Lemon' },
  lime: { color: '#7ed957', pattern: 'plain', accent: '#c6f2a8', label: 'Lime' },
  sky: { color: '#4db8ff', pattern: 'plain', accent: '#b3e1ff', label: 'Sky' },
  grape: { color: '#9b6bff', pattern: 'plain', accent: '#d4c1ff', label: 'Grape' },
  bubblegum: { color: '#ff8fc8', pattern: 'plain', accent: '#ffd0e8', label: 'Bubblegum' },
  ink: { color: '#1f2a44', pattern: 'plain', accent: '#5a6474', label: 'Eight ball' },
  stripe: { color: '#ffffff', pattern: 'stripe', accent: '#ff5f7e', label: 'Racing stripe' },
  dots: { color: '#ffffff', pattern: 'dots', accent: '#4db8ff', label: 'Polka' },
  tiger: { color: '#ff9f1c', pattern: 'stripe', accent: '#1f2a44', label: 'Tiger' },
};

export const DEFAULT_AVATAR: Avatar = { porcelain: 'white', seat: 'white', hat: 'none', face: 'happy', ball: 'white', head: 'classic' };

/** Any input (server rows, old caches, user payloads) -> a valid avatar. Unknown parts fall back. */
export function normalizeAvatar(input: unknown): Avatar {
  const o = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const pick = (v: unknown, allowed: Record<string, unknown>, fallback: string) => (typeof v === 'string' && v in allowed ? v : fallback);
  return {
    porcelain: pick(o.porcelain, PORCELAIN, DEFAULT_AVATAR.porcelain),
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

const INK = '#1f2a44';

function hatSvg(hat: string): string {
  switch (hat) {
    case 'crown':
      return `<path d="M44 40 L52 16 L66 30 L80 8 L94 30 L108 16 L116 40 Z" fill="#ffc63a" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
<circle cx="52" cy="16" r="4.5" fill="#ff6f3c" stroke="${INK}" stroke-width="3"/><circle cx="80" cy="8" r="5" fill="#ff6f3c" stroke="${INK}" stroke-width="3"/><circle cx="108" cy="16" r="4.5" fill="#ff6f3c" stroke="${INK}" stroke-width="3"/>`;
    case 'cap':
      return `<path d="M42 42 Q80 4 118 42 Z" fill="#ff5f7e" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/><rect x="104" y="34" width="30" height="9" rx="4.5" fill="#ff5f7e" stroke="${INK}" stroke-width="4"/><circle cx="80" cy="8" r="4" fill="#fff" stroke="${INK}" stroke-width="3"/>`;
    case 'tophat':
      return `<rect x="56" y="2" width="48" height="40" rx="4" fill="${INK}"/><rect x="44" y="34" width="72" height="10" rx="5" fill="${INK}"/><rect x="56" y="28" width="48" height="7" fill="#ff5f7e"/>`;
    case 'plunger':
      return `<rect x="76" y="0" width="8" height="30" rx="3" fill="#c8874a" stroke="${INK}" stroke-width="3"/><path d="M58 42 Q80 18 102 42 Z" fill="#c0392b" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>`;
    case 'halo':
      return `<ellipse cx="80" cy="12" rx="30" ry="7" fill="none" stroke="#ffd447" stroke-width="6"/><ellipse cx="80" cy="12" rx="30" ry="7" fill="none" stroke="${INK}" stroke-width="2" opacity="0.5"/>`;
    default:
      return '';
  }
}

function faceSvg(face: string): string {
  const eyes = `<path d="M66 69 v2 M94 69 v2" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`;
  const smile = `<path d="M67 84 Q80 97 93 84" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`;
  if (face === 'cool') return `<path d="M52 63 h25 v9 q-12 14 -25 0 Z M83 63 h25 v9 q-12 14 -25 0 Z" fill="${INK}"/><path d="M77 66 h6" stroke="${INK}" stroke-width="4"/>${smile}`;
  if (face === 'sleepy') return `<path d="M59 70 q7 6 14 0 M87 70 q7 6 14 0" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/><ellipse cx="80" cy="88" rx="5" ry="6" fill="${INK}"/>`;
  if (face === 'angry') return `${eyes}<path d="M59 60 l14 4 M101 60 l-14 4 M68 88 q12 -7 24 0" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`;
  if (face === 'wink') return `<path d="M66 69 v2 M87 71 Q94 65 101 71" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>${smile}`;
  return `${eyes}${smile}`;
}

function ballSvg(look: BallLook, cx: number, cy: number, r: number, id: string): string {
  let pattern = '';
  if (look.pattern === 'stripe') pattern = `<rect x="${cx - r}" y="${cy - r * 0.28}" width="${r * 2}" height="${r * 0.56}" fill="${look.accent}" clip-path="url(#${id}-clip)"/>`;
  else if (look.pattern === 'dots')
    pattern = [
      [-0.45, -0.35],
      [0.4, -0.45],
      [-0.1, 0.15],
      [0.45, 0.35],
      [-0.5, 0.4],
    ]
      .map(([dx, dy]) => `<circle cx="${cx + dx * r}" cy="${cy + dy * r}" r="${r * 0.18}" fill="${look.accent}" clip-path="url(#${id}-clip)"/>`)
      .join('');
  else pattern = [[-0.38, -0.38], [0.24, -0.45], [-0.15, 0.15], [0.38, 0.23]].map(([dx, dy]) => `<circle cx="${cx + dx * r}" cy="${cy + dy * r}" r="${r * 0.14}" fill="${look.accent}" opacity="0.8"/>`).join('');
  return `<clipPath id="${id}-clip"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath><circle cx="${cx}" cy="${cy}" r="${r}" fill="${look.color}" stroke="${INK}" stroke-width="4.5"/>${pattern}<circle cx="${cx - r * 0.35}" cy="${cy - r * 0.35}" r="${r * 0.22}" fill="#fff" opacity="0.85"/>`;
}

/** The head itself, no face: each one fills the same circle the classic golfer's head does, so faces and hats land right. */
function headSvg(head: string, tone: { top: string; bottom: string }): string {
  const shade = `<path d="M102 47 A36 36 0 0 1 59 103 A36 36 0 0 0 102 47" fill="${tone.bottom}" opacity=".35"/>`;
  switch (head) {
    case 'roll':
      // A roll of paper seen a little from above: the body, the top with its hollow core, a loose sheet.
      return `<path d="M122 95 q10 -4 12 12 q-8 6 -14 -2 Z" fill="${tone.top}" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>
<rect x="44" y="40" width="72" height="68" rx="10" fill="${tone.top}" stroke="${INK}" stroke-width="7"/>
<path d="M104 44 v60 a12 6 0 0 1 -6 3 v-63 Z" fill="${tone.bottom}" opacity=".5"/>
<ellipse cx="80" cy="40" rx="36" ry="12" fill="${tone.top}" stroke="${INK}" stroke-width="7"/>
<ellipse cx="80" cy="40" rx="13" ry="4.5" fill="${tone.bottom}" stroke="${INK}" stroke-width="5"/>`;
    case 'turd':
      // A soft-serve swirl: one wide, smooth body carrying the face, a coil line either side, a curl on top.
      return `<path d="M40 110 C28 110 30 92 44 90 C34 76 46 62 60 62 C58 48 74 38 84 40 C80 32 88 24 96 30 C102 34 100 42 94 44 C106 46 112 60 104 66 C120 70 122 90 112 92 C128 94 126 110 116 110 Z" fill="${tone.top}" stroke="${INK}" stroke-width="7" stroke-linejoin="round"/>
<path d="M44 90 C56 86 70 84 80 84" fill="none" stroke="${tone.bottom}" stroke-width="4" stroke-linecap="round" opacity=".75"/>
<path d="M104 66 C96 64 88 62 80 62" fill="none" stroke="${tone.bottom}" stroke-width="4" stroke-linecap="round" opacity=".75"/>
<path d="M60 62 C66 58 74 56 80 56" fill="none" stroke="${tone.bottom}" stroke-width="3.5" stroke-linecap="round" opacity=".5"/>
<path d="M112 92 C102 92 92 92 84 94" fill="none" stroke="${tone.bottom}" stroke-width="3.5" stroke-linecap="round" opacity=".5"/>
<path d="M90 36 C92 30 98 30 98 34" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".55"/>`;
    case 'alien':
      // A big cranium and a small chin; the face sits low.
      return `<path d="M80 28 C124 28 124 74 106 96 C98 107 62 107 54 96 C36 74 36 28 80 28 Z" fill="${tone.top}" stroke="${INK}" stroke-width="7" stroke-linejoin="round"/>
<path d="M108 50 C114 70 104 90 96 98 C106 86 112 68 108 50 Z" fill="${tone.bottom}" opacity=".4"/>`;
    case 'dawg':
      // A bulldog: a wide head with heavy jowls, ears flopping out from the top corners, a broad muzzle and a big nose.
      return `<path d="M50 46 C38 40 26 52 30 66 C32 76 42 82 52 78 Z" fill="${tone.bottom}" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>
<path d="M110 46 C122 40 134 52 130 66 C128 76 118 82 108 78 Z" fill="${tone.bottom}" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>
<path d="M44 58 C44 36 116 36 116 58 L118 84 C118 98 108 108 96 108 L64 108 C52 108 42 98 42 84 Z" fill="${tone.top}" stroke="${INK}" stroke-width="7" stroke-linejoin="round"/>
<path d="M52 92 C52 78 108 78 108 92 C108 104 98 110 80 110 C62 110 52 104 52 92 Z" fill="#fff7ea" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
<path d="M56 100 C60 108 72 110 80 110 C88 110 100 108 104 100" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round" opacity=".5"/>
<ellipse cx="80" cy="79" rx="10" ry="6.5" fill="${INK}"/>
<circle cx="76" cy="77" r="2.2" fill="#fff" opacity=".7"/>
<path d="M80 85 v5" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/>
<path d="M62 50 q18 -8 36 0" fill="none" stroke="${tone.bottom}" stroke-width="4" stroke-linecap="round" opacity=".55"/>`;
    default:
      return `<circle cx="80" cy="73" r="36" fill="${tone.top}" stroke="${INK}" stroke-width="7"/>${shade}`;
  }
}

export const AVATAR_VIEWBOX = '0 0 160 170';

/** SVG markup for an avatar. `id` keeps gradient ids unique when several are on one page. */
export function avatarSvg(input: Avatar | null | undefined, id = 'av'): string {
  const av = normalizeAvatar(input);
  const tone = headTones(av.head)[av.porcelain] ?? PORCELAIN[av.porcelain];
  const shirt = SEATS[av.seat].color;
  return `<path d="M25 151 C25 120 47 104 80 104 C113 104 135 120 135 151 Z" fill="${shirt}" stroke="${INK}" stroke-width="7" stroke-linejoin="round"/>
<path d="M30 144 H130 V149 H30 Z" fill="${INK}" opacity=".12"/>
${headSvg(av.head, tone)}
${faceSvg(av.face)}
${hatSvg(av.hat)}
${ballSvg(ballLook(av), 132, 146, 13, id)}`;
}

/** A new player's first look: any of the five heads in any colour, the rest kept plain so the editor has somewhere to go. */
export function starterAvatar(r: () => number): Avatar {
  const pick = (keys: string[]) => keys[Math.floor(r() * keys.length) % keys.length];
  const head = pick(Object.keys(HEADS));
  return {
    head,
    porcelain: pick(Object.keys(headTones(head))),
    seat: pick(Object.keys(SEATS)),
    hat: head === 'turd' || head === 'alien' || head === 'dawg' ? 'crown' : 'none',
    face: 'happy',
    ball: 'white',
  };
}

/** A random look, from a 0..1 source: bots and previews. */
export function randomAvatar(r: () => number): Avatar {
  const pick = (keys: string[]) => keys[Math.floor(r() * keys.length) % keys.length];
  return {
    porcelain: pick(Object.keys(PORCELAIN)),
    seat: pick(Object.keys(SEATS)),
    hat: pick(Object.keys(HATS)),
    face: pick(Object.keys(FACES)),
    ball: pick(Object.keys(BALLS)),
    head: pick(Object.keys(HEADS)),
  };
}
