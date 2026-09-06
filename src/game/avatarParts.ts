/**
 * Player avatars: the toilet mascot with choices. Porcelain and seat colours,
 * a hat, a face and a golf ball. Rendered as SVG for chips, banners and
 * boards, and the ball look is drawn on the canvas during play. No uploads,
 * nothing to moderate. Every part is a named item so unlocks can come later.
 */

export interface Avatar {
  porcelain: string;
  seat: string;
  hat: string;
  face: string;
  ball: string;
}

export const PORCELAIN: Record<string, { top: string; bottom: string; label: string }> = {
  white: { top: '#ffffff', bottom: '#d6e2ee', label: 'Porcelain' },
  mint: { top: '#eafff5', bottom: '#9fe3c3', label: 'Mint' },
  pink: { top: '#ffeaf1', bottom: '#ffb3c9', label: 'Blush' },
  sky: { top: '#eaf6ff', bottom: '#9fd0ff', label: 'Sky' },
  lavender: { top: '#f3ecff', bottom: '#c6b0ff', label: 'Lavender' },
  gold: { top: '#fff6cf', bottom: '#f2c94c', label: 'Gold' },
  onyx: { top: '#6a7486', bottom: '#2b3242', label: 'Onyx' },
};

export const SEATS: Record<string, { color: string; label: string }> = {
  white: { color: '#ffffff', label: 'White' },
  ink: { color: '#1f2a44', label: 'Black' },
  red: { color: '#ff5f7e', label: 'Red' },
  blue: { color: '#4db8ff', label: 'Blue' },
  wood: { color: '#c8874a', label: 'Wood' },
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
  const eyes = `<circle cx="64" cy="70" r="9" fill="#fff" stroke="${INK}" stroke-width="4"/><circle cx="96" cy="70" r="9" fill="#fff" stroke="${INK}" stroke-width="4"/>
<circle cx="66.5" cy="71.5" r="4" fill="${INK}"/><circle cx="98.5" cy="71.5" r="4" fill="${INK}"/><circle cx="68" cy="69.5" r="1.4" fill="#fff"/><circle cx="100" cy="69.5" r="1.4" fill="#fff"/>`;
  switch (face) {
    case 'cool':
      return `<rect x="50" y="61" width="26" height="17" rx="7" fill="${INK}"/><rect x="84" y="61" width="26" height="17" rx="7" fill="${INK}"/><path d="M76 67 h8" stroke="${INK}" stroke-width="4"/><path d="M54 66 h8" stroke="#fff" stroke-width="2.5" opacity="0.6"/>
<path d="M70 87 Q84 92 94 84" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`;
    case 'sleepy':
      return `<path d="M55 71 q9 7 18 0" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/><path d="M87 71 q9 7 18 0" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>
<ellipse cx="80" cy="88" rx="5" ry="3.5" fill="${INK}"/><text x="112" y="58" font-family="Arial, sans-serif" font-weight="900" font-size="16" fill="${INK}">z</text>`;
    case 'angry':
      return `${eyes}<path d="M52 56 l22 9" stroke="${INK}" stroke-width="4.5" stroke-linecap="round"/><path d="M108 56 l-22 9" stroke="${INK}" stroke-width="4.5" stroke-linecap="round"/>
<path d="M66 90 Q80 82 94 90" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`;
    case 'wink':
      return `<circle cx="64" cy="70" r="9" fill="#fff" stroke="${INK}" stroke-width="4"/><circle cx="66.5" cy="71.5" r="4" fill="${INK}"/><circle cx="68" cy="69.5" r="1.4" fill="#fff"/>
<path d="M87 71 q9 6 18 0" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>
<path d="M66 86 Q80 94 94 86" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/><path d="M84 88 q4 8 -4 9" fill="#ff5f7e" stroke="${INK}" stroke-width="2.5"/>`;
    default:
      return `${eyes}<path d="M66 86 Q80 94 94 86" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`;
  }
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
  const seat = SEATS[av.seat].color;
  const look = ballLook(av);
  return `<defs><linearGradient id="${id}-porc" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.top}"/><stop offset="1" stop-color="${p.bottom}"/></linearGradient></defs>
<ellipse cx="80" cy="160" rx="54" ry="7" fill="rgba(0,0,0,0.3)"/>
<rect x="40" y="46" width="80" height="50" rx="10" fill="url(#${id}-porc)" stroke="${INK}" stroke-width="5"/>
<rect x="34" y="40" width="92" height="14" rx="6" fill="${p.top}" stroke="${INK}" stroke-width="5"/>
<rect x="112" y="60" width="16" height="7" rx="3.5" fill="#c7d1dd" stroke="${INK}" stroke-width="3.5"/>
${faceSvg(av.face)}
<path d="M26 104 C26 94 44 90 80 90 C116 90 134 94 134 104 L128 128 C122 148 104 156 80 156 C56 156 38 148 32 128 Z" fill="url(#${id}-porc)" stroke="${INK}" stroke-width="5"/>
<ellipse cx="80" cy="104" rx="46" ry="15" fill="${seat}" stroke="${INK}" stroke-width="5"/>
<ellipse cx="80" cy="105" rx="31" ry="9" fill="#4db8ff" stroke="${INK}" stroke-width="4"/>
<ellipse cx="70" cy="103" rx="9" ry="3" fill="#9fdcff"/>
${hatSvg(av.hat)}
<path d="M8 150 h14 M4 142 h16 M10 134 h10" stroke="${INK}" stroke-width="3.5" stroke-linecap="round" opacity="0.6"/>
${ballSvg(look, 36, 146, 13, id)}`;
}
