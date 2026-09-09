/** Human golfer portraits. Legacy porcelain/seat keys retain saved profile compatibility. */

export interface Avatar {
  porcelain: string;
  seat: string;
  hat: string;
  face: string;
  ball: string;
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

export const DEFAULT_AVATAR: Avatar = { porcelain: 'white', seat: 'white', hat: 'none', face: 'happy', ball: 'white' };

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

export const AVATAR_VIEWBOX = '0 0 160 170';

/** SVG markup for an avatar. `id` keeps gradient ids unique when several are on one page. */
export function avatarSvg(input: Avatar | null | undefined, id = 'av'): string {
  const av = normalizeAvatar(input);
  const p = PORCELAIN[av.porcelain];
  const shirt = SEATS[av.seat].color;
  return `<path d="M25 151 C25 120 47 104 80 104 C113 104 135 120 135 151 Z" fill="${shirt}" stroke="${INK}" stroke-width="7" stroke-linejoin="round"/>
<path d="M30 144 H130 V149 H30 Z" fill="${INK}" opacity=".12"/>
<circle cx="80" cy="73" r="36" fill="${p.top}" stroke="${INK}" stroke-width="7"/>
<path d="M102 47 A36 36 0 0 1 59 103 A36 36 0 0 0 102 47" fill="${p.bottom}" opacity=".35"/>
${faceSvg(av.face)}
${hatSvg(av.hat)}
${ballSvg(ballLook(av), 132, 146, 13, id)}`;
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
  };
}
