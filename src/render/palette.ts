/** Flat, high contrast palette. No gradients, no shadows, no textures. */
export const PALETTE = {
  page: '#07090a',
  outOfPlay: '#0e1214',
  felt: '#173d2a',
  tile: '#1c3f52',
  shag: '#4a3a16',
  wet: '#164a66',
  sand: '#5a4a1e',
  sticky: '#4a1538',
  hazard: '#7a1428',
  hazardEdge: '#ff5f7e',
  slopeArrow: 'rgba(255,255,255,0.28)',
  wall: '#eef2f4',
  wallDead: '#8a949a',
  blocker: '#2b3338',
  blockerEdge: '#eef2f4',
  deadWall: '#3a3f42',
  curb: 'rgba(238,242,244,0.18)',
  curbEdge: '#b7c2c8',
  pipe: '#7fd6ff',
  bumper: '#ff6f3c',
  bumperEdge: '#ffd0bd',
  ball: '#ffffff',
  ballEdge: '#07090a',
  cup: '#000000',
  cupRing: '#f4f6f7',
  cupFlash: '#ffd166',
  tee: '#8fb3a3',
  aim: '#ffd166',
  aimDim: 'rgba(255,209,102,0.35)',
  trail: 'rgba(255,255,255,0.32)',
  trailOld: 'rgba(255,255,255,0.14)',
  text: '#f4f6f7',
  textDim: '#8b969c',
  accent: '#ffd166',
  danger: '#ff5f7e',
  good: '#5be3a3',
  grid: 'rgba(255,255,255,0.06)',
  gridMajor: 'rgba(255,255,255,0.14)',
  select: '#5be3a3',
  draft: '#ffd166',
} as const;

export function surfaceColor(type: string): string {
  switch (type) {
    case 'tile':
      return PALETTE.tile;
    case 'shag':
      return PALETTE.shag;
    case 'wet':
      return PALETTE.wet;
    case 'sand':
      return PALETTE.sand;
    case 'sticky':
      return PALETTE.sticky;
    default:
      return PALETTE.felt;
  }
}
