/**
 * Decorative props (outside the playable area) and floor decals (inside,
 * subtle). All drawn in world units with the house outline. Props never
 * affect gameplay.
 */

import type { Hole } from '../sim/types';
import { pointInPolygon } from '../sim/geometry';
import { OUTLINE, type DecalKind, type PropKind, type Theme } from './themes';
import { circle, ellipse, makeRand, roundRectPath, chunky, highlight, hashString } from './shapes';
import { distToWalls, pointInRegion, type Region } from './region';

export interface PropPlacement {
  kind: PropKind;
  x: number;
  y: number;
  r: number;
  seed: number;
}

export interface DecalPlacement {
  kind: DecalKind;
  x: number;
  y: number;
  r: number;
  seed: number;
}

export function placeProps(hole: Hole, region: Region, theme: Theme): PropPlacement[] {
  if (theme.props.length === 0 || region.fallback) return [];
  const rand = makeRand(hashString(hole.id + ':props'));
  const b = hole.bounds;
  const cands: { x: number; y: number }[] = [];
  for (let y = b.y + 1.5; y < b.y + b.h - 1.5; y += 1) {
    for (let x = b.x + 1.5; x < b.x + b.w - 1.5; x += 1) {
      if (pointInRegion(region, x, y)) continue;
      if (distToWalls(hole, x, y) < 1.9) continue;
      cands.push({ x, y });
    }
  }
  const out: PropPlacement[] = [];
  // Fewer, varied props: round-robin through the theme's list, signs at most twice.
  const target = Math.min(14, Math.round((cands.length / 55) * theme.propDensity) + 2);
  const SIGNS: PropKind[] = ['outOfOrder', 'washSign', 'gateSign', 'neonSign'];
  const counts = new Map<PropKind, number>();
  let order = shuffle(theme.props.slice(), rand);
  let k = 0;
  let tries = 0;
  while (out.length < target && tries++ < 600 && cands.length) {
    const c = cands[Math.floor(rand() * cands.length)];
    const jx = c.x + (rand() - 0.5) * 0.8;
    const jy = c.y + (rand() - 0.5) * 0.8;
    if (out.some((p) => Math.hypot(p.x - jx, p.y - jy) < 5)) continue;
    if (k >= order.length) {
      order = shuffle(theme.props.slice(), rand);
      k = 0;
    }
    const kind = order[k++];
    const n = counts.get(kind) ?? 0;
    if (SIGNS.includes(kind) && n >= 2) continue;
    counts.set(kind, n + 1);
    out.push({ kind, x: jx, y: jy, r: rand() * Math.PI * 2, seed: Math.floor(rand() * 1e9) });
  }
  return out;
}

function shuffle<T>(arr: T[], rand: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function placeDecals(hole: Hole, region: Region, theme: Theme): DecalPlacement[] {
  if (theme.decals.length === 0 || theme.decalDensity <= 0) return [];
  const rand = makeRand(hashString(hole.id + ':decals'));
  const b = hole.bounds;
  const zones = [...hole.surfaceZones.map((z) => z.polygon), ...hole.hazards.map((h) => h.polygon), ...hole.slopeZones.map((z) => z.polygon)];
  const out: DecalPlacement[] = [];
  const n = Math.round((b.w * b.h) / 90 * theme.decalDensity);
  let tries = 0;
  while (out.length < n && tries++ < n * 30) {
    const x = b.x + rand() * b.w;
    const y = b.y + rand() * b.h;
    if (!pointInRegion(region, x, y)) continue;
    if (distToWalls(hole, x, y) < 1.4) continue;
    if (Math.hypot(x - hole.tee.x, y - hole.tee.y) < 3 || Math.hypot(x - hole.cup.x, y - hole.cup.y) < 3.5) continue;
    if (zones.some((z) => pointInPolygon(x, y, z))) continue;
    if (out.some((d) => Math.hypot(d.x - x, d.y - y) < 3)) continue;
    out.push({ kind: theme.decals[Math.floor(rand() * theme.decals.length)], x, y, r: rand() * Math.PI * 2, seed: Math.floor(rand() * 1e9) });
  }
  return out;
}

/** Props that move; they are skipped in the static layer and drawn every frame. */
export const ANIMATED_KINDS: readonly PropKind[] = ['neonSign', 'star', 'torch', 'crowd', 'waterfall', 'sensor', 'sinkPuddle', 'droplet'];

export function drawPropAnimated(ctx: CanvasRenderingContext2D, p: PropPlacement, t: number): void {
  const ph = (p.seed % 1000) / 1000;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  switch (p.kind) {
    case 'star': {
      const a = 0.45 + 0.55 * Math.abs(Math.sin(t * 2.2 + ph * 9));
      ctx.globalAlpha = a;
      ctx.fillStyle = '#ffffff';
      const r = 0.12 + ph * 0.16 + 0.05 * Math.sin(t * 5 + ph * 7);
      circle(ctx, 0, 0, r);
      ctx.fill();
      if (ph > 0.7) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 0.06;
        ctx.beginPath();
        ctx.moveTo(-r * 3, 0);
        ctx.lineTo(r * 3, 0);
        ctx.moveTo(0, -r * 3);
        ctx.lineTo(0, r * 3);
        ctx.stroke();
      }
      break;
    }
    case 'neonSign': {
      const flick = Math.sin(t * 17 + ph * 20) * Math.sin(t * 3.1 + ph) > 0.85 ? 0.25 : 1;
      ctx.rotate((ph - 0.5) * 0.3);
      roundRectPath(ctx, -1.8, -0.7, 3.6, 1.4, 0.4);
      chunky(ctx, '#1a1226', 0.14);
      ctx.save();
      ctx.globalAlpha = flick;
      ctx.shadowColor = '#ff3fa4';
      ctx.shadowBlur = 8;
      label(ctx, 'OPEN', 0, 0, 0.8, '#ff9fd2');
      ctx.restore();
      break;
    }
    case 'torch': {
      roundRectPath(ctx, -0.22, -0.4, 0.44, 1.8, 0.2);
      chunky(ctx, '#8a5a2b', 0.12);
      const w = 1 + 0.18 * Math.sin(t * 9 + ph * 10);
      const h = 1 + 0.22 * Math.sin(t * 7.3 + ph * 5);
      ctx.beginPath();
      ctx.moveTo(-0.6 * w, -0.4);
      ctx.quadraticCurveTo(-0.5 * w, -1.7 * h, 0.1 * Math.sin(t * 6 + ph), -1.9 * h);
      ctx.quadraticCurveTo(0.5 * w, -1.7 * h, 0.6 * w, -0.4);
      ctx.closePath();
      chunky(ctx, '#ff9f1c', 0.12);
      ctx.fillStyle = '#ffd166';
      ellipse(ctx, 0, -1.0 * h, 0.25 * w, 0.45 * h);
      ctx.fill();
      ctx.fillStyle = '#ffd166';
      ctx.globalAlpha = 0.6;
      circle(ctx, 0.4 * Math.sin(t * 4 + ph), -2.3 - ((t * 1.5 + ph * 3) % 1.2), 0.08);
      ctx.fill();
      break;
    }
    case 'crowd': {
      for (let k = -2; k <= 2; k++) {
        const c = ['#3a86ff', '#e63946', '#ffd166', '#5be3a3', '#ff6f3c'][k + 2];
        const bob = -0.3 * Math.abs(Math.sin(t * 4 + k * 0.9 + ph * 6));
        circle(ctx, k * 0.9, -0.5 + bob, 0.42);
        chunky(ctx, '#f1c27d', 0.12);
        roundRectPath(ctx, k * 0.9 - 0.5, -0.1 + bob, 1.0, 1.1, 0.3);
        chunky(ctx, c, 0.12);
      }
      break;
    }
    case 'waterfall': {
      roundRectPath(ctx, -1.6, -1.6, 3.2, 3.2, 0.6);
      chunky(ctx, '#3a86ff', 0.16);
      ctx.save();
      roundRectPath(ctx, -1.6, -1.6, 3.2, 3.2, 0.6);
      ctx.clip();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 0.18;
      const off = (t * 3) % 1.2;
      ctx.beginPath();
      for (let k = -1; k <= 1; k++) {
        for (let y = -2.2 + off; y < 2; y += 1.2) {
          ctx.moveTo(k * 0.8, y);
          ctx.lineTo(k * 0.8, y + 0.6);
        }
      }
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = '#ffffff';
      for (let k = 0; k < 4; k++) {
        circle(ctx, -1.0 + k * 0.7, 1.0 + 0.12 * Math.sin(t * 6 + k), 0.18);
        ctx.fill();
      }
      break;
    }
    case 'sensor': {
      roundRectPath(ctx, -0.6, -0.4, 1.2, 0.8, 0.2);
      chunky(ctx, '#dde2e7', 0.14);
      const on = Math.sin(t * 2.5 + ph * 6) > 0.6;
      ctx.fillStyle = on ? '#e63946' : '#7a1f1a';
      circle(ctx, 0, 0, 0.15);
      ctx.fill();
      if (on) {
        ctx.strokeStyle = '#e63946';
        ctx.lineWidth = 0.08;
        ctx.beginPath();
        ctx.arc(0, 0, 0.5, -0.6, 0.6);
        ctx.stroke();
      }
      break;
    }
    case 'sinkPuddle': {
      ctx.globalAlpha = 0.85;
      ellipse(ctx, 0, 0, 1.7, 1.0);
      chunky(ctx, '#3a86ff', 0.12);
      highlight(ctx, -0.5, -0.3, 0.5, 0.18, 0.7);
      const k = ((t * 0.7 + ph) % 1);
      ctx.globalAlpha = (1 - k) * 0.8;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 0.1;
      ellipse(ctx, 0.2, 0.1, 0.3 + k * 1.2, 0.18 + k * 0.7);
      ctx.stroke();
      break;
    }
    case 'droplet': {
      ctx.translate(0.4 * Math.sin(t * 1.3 + ph * 8), 0.35 * Math.cos(t * 1.1 + ph * 5));
      ctx.rotate(0.3 * Math.sin(t * 0.9 + ph));
      ctx.beginPath();
      ctx.moveTo(0, -1.1);
      ctx.quadraticCurveTo(0.9, 0.1, 0, 0.8);
      ctx.quadraticCurveTo(-0.9, 0.1, 0, -1.1);
      chunky(ctx, '#3a86ff', 0.14);
      highlight(ctx, -0.25, -0.2, 0.18, 0.28);
      break;
    }
    default:
      break;
  }
  ctx.restore();
}

export function drawDecal(ctx: CanvasRenderingContext2D, d: DecalPlacement): void {
  const rand = makeRand(d.seed);
  ctx.save();
  ctx.translate(d.x, d.y);
  ctx.rotate(d.r);
  switch (d.kind) {
    case 'stain':
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = '#3b2a12';
      ellipse(ctx, 0, 0, 1.2 + rand() * 0.8, 0.8 + rand() * 0.5);
      ctx.fill();
      break;
    case 'scuff':
      ctx.globalAlpha = 0.3;
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 0.14;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-0.8, 0);
      ctx.quadraticCurveTo(0, -0.4 + rand() * 0.8, 0.9, 0.1);
      ctx.stroke();
      break;
    case 'crack':
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 0.1;
      ctx.beginPath();
      ctx.moveTo(-1, 0);
      ctx.lineTo(-0.3, 0.2);
      ctx.lineTo(0.2, -0.3);
      ctx.lineTo(1, 0.1);
      ctx.moveTo(0.2, -0.3);
      ctx.lineTo(0.5, -0.9);
      ctx.stroke();
      break;
    case 'petal':
      ctx.fillStyle = '#ff9ac2';
      for (let k = 0; k < 3; k++) {
        ellipse(ctx, (rand() - 0.5) * 1.6, (rand() - 0.5) * 1.6, 0.32, 0.2);
        ctx.fill();
      }
      break;
    case 'leaf':
      ctx.fillStyle = '#4f9a3a';
      ellipse(ctx, 0, 0, 0.8, 0.32);
      ctx.fill();
      ctx.strokeStyle = '#2f6b22';
      ctx.lineWidth = 0.08;
      ctx.beginPath();
      ctx.moveTo(-0.7, 0);
      ctx.lineTo(0.7, 0);
      ctx.stroke();
      break;
    case 'confetti':
      for (let k = 0; k < 5; k++) {
        ctx.fillStyle = ['#ff3fa4', '#ffd166', '#3a86ff', '#5be3a3'][k % 4];
        ctx.save();
        ctx.translate((rand() - 0.5) * 2.4, (rand() - 0.5) * 2.4);
        ctx.rotate(rand() * 3);
        ctx.fillRect(-0.22, -0.12, 0.44, 0.24);
        ctx.restore();
      }
      break;
    case 'sparkle':
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.moveTo(0, -0.6);
      ctx.quadraticCurveTo(0.08, -0.08, 0.6, 0);
      ctx.quadraticCurveTo(0.08, 0.08, 0, 0.6);
      ctx.quadraticCurveTo(-0.08, 0.08, -0.6, 0);
      ctx.quadraticCurveTo(-0.08, -0.08, 0, -0.6);
      ctx.fill();
      break;
  }
  ctx.restore();
}

const TEXT_FONT = '700 1px Fredoka, "Trebuchet MS", sans-serif';

function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, fill: string, bg?: string): void {
  ctx.save();
  ctx.font = TEXT_FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.translate(x, y);
  ctx.scale(size, size);
  if (bg) {
    const w = ctx.measureText(text).width + 0.8;
    roundRectPath(ctx, -w / 2, -0.62, w, 1.24, 0.3);
    chunky(ctx, bg, 0.12);
  }
  ctx.fillStyle = fill;
  ctx.fillText(text, 0, 0.04);
  ctx.restore();
}

export function drawProp(ctx: CanvasRenderingContext2D, p: PropPlacement): void {
  const rand = makeRand(p.seed);
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const tilt = (rand() - 0.5) * 0.5;
  switch (p.kind) {
    case 'stain':
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#2b1d0a';
      ellipse(ctx, 0, 0, 1.6, 1.0);
      ctx.fill();
      break;
    case 'bolt':
      circle(ctx, 0, 0, 0.5);
      chunky(ctx, '#b0b8c0', 0.16);
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 0.12;
      ctx.beginPath();
      ctx.moveTo(-0.3, 0);
      ctx.lineTo(0.3, 0);
      ctx.stroke();
      break;
    case 'mopBucket':
      ctx.rotate(tilt);
      roundRectPath(ctx, -1.1, -0.9, 2.2, 1.8, 0.4);
      chunky(ctx, '#ffd60a');
      ellipse(ctx, 0, -0.5, 0.8, 0.35);
      chunky(ctx, '#3a86ff', 0.14);
      ctx.strokeStyle = '#8a5a2b';
      ctx.lineWidth = 0.28;
      ctx.beginPath();
      ctx.moveTo(0.4, -0.6);
      ctx.lineTo(1.9, -2.4);
      ctx.stroke();
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 0.1;
      ctx.stroke();
      break;
    case 'wrench':
      ctx.rotate(tilt + 0.8);
      roundRectPath(ctx, -0.25, -1.4, 0.5, 2.8, 0.25);
      chunky(ctx, '#b8c2cc', 0.16);
      circle(ctx, 0, -1.5, 0.55);
      chunky(ctx, '#b8c2cc', 0.16);
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(-0.2, -1.95, 0.4, 0.5);
      break;
    case 'hammer':
      ctx.rotate(tilt - 0.6);
      roundRectPath(ctx, -0.2, -0.6, 0.4, 2.6, 0.2);
      chunky(ctx, '#c98d5a', 0.14);
      roundRectPath(ctx, -0.9, -1.2, 1.8, 0.8, 0.2);
      chunky(ctx, '#8d99a6', 0.16);
      break;
    case 'outOfOrder':
      ctx.rotate(tilt);
      label(ctx, 'OUT OF ORDER', 0, 0, 0.7, '#1f2a44', '#ffd60a');
      break;
    case 'towel':
      ctx.rotate(tilt);
      roundRectPath(ctx, -1.4, -0.9, 2.8, 1.8, 0.5);
      chunky(ctx, '#ffffff', 0.18);
      ctx.strokeStyle = '#f0c04a';
      ctx.lineWidth = 0.16;
      ctx.beginPath();
      ctx.moveTo(-1.1, -0.3);
      ctx.lineTo(1.1, -0.3);
      ctx.moveTo(-1.1, 0.3);
      ctx.lineTo(1.1, 0.3);
      ctx.stroke();
      break;
    case 'orchid':
      ellipse(ctx, 0, 0.6, 0.8, 0.5);
      chunky(ctx, '#c9bca6', 0.14);
      ctx.strokeStyle = '#3f8a3f';
      ctx.lineWidth = 0.14;
      ctx.beginPath();
      ctx.moveTo(0, 0.4);
      ctx.quadraticCurveTo(0.4, -0.8, 0.2, -1.6);
      ctx.stroke();
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2;
        ellipse(ctx, 0.2 + Math.cos(a) * 0.45, -1.6 + Math.sin(a) * 0.45, 0.32, 0.2);
        chunky(ctx, '#ff8fb8', 0.08);
      }
      break;
    case 'goldTap':
      roundRectPath(ctx, -0.5, -0.4, 1.0, 1.2, 0.3);
      chunky(ctx, '#f0c04a', 0.16);
      ctx.strokeStyle = '#f0c04a';
      ctx.lineWidth = 0.35;
      ctx.beginPath();
      ctx.moveTo(0, -0.3);
      ctx.quadraticCurveTo(0, -1.4, 0.9, -1.2);
      ctx.stroke();
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 0.12;
      ctx.stroke();
      break;
    case 'doily':
      circle(ctx, 0, 0, 1.1);
      chunky(ctx, '#fff8f0', 0.12);
      ctx.strokeStyle = '#d99aa9';
      ctx.lineWidth = 0.08;
      ctx.setLineDash([0.2, 0.2]);
      circle(ctx, 0, 0, 0.7);
      ctx.stroke();
      break;
    case 'sticker': {
      ctx.rotate(rand() * 6);
      const cols = ['#ff3fa4', '#ffd166', '#5be3a3', '#3a86ff', '#ff6f3c'];
      const c = cols[Math.floor(rand() * cols.length)];
      if (rand() < 0.5) {
        circle(ctx, 0, 0, 0.9);
        chunky(ctx, c, 0.14);
      } else {
        ctx.beginPath();
        for (let k = 0; k < 10; k++) {
          const a = (k / 10) * Math.PI * 2;
          const r = k % 2 === 0 ? 1.0 : 0.45;
          ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.closePath();
        chunky(ctx, c, 0.14);
      }
      break;
    }
    case 'graffiti': {
      ctx.rotate(tilt);
      const cols = ['#ff3fa4', '#5be3a3', '#ffd166', '#3a86ff'];
      ctx.strokeStyle = cols[Math.floor(rand() * cols.length)];
      ctx.lineWidth = 0.3;
      ctx.beginPath();
      let x = -1.6;
      ctx.moveTo(x, 0);
      for (let k = 0; k < 4; k++) {
        x += 0.8;
        ctx.quadraticCurveTo(x - 0.4, (rand() - 0.5) * 2.2, x, (rand() - 0.5) * 0.6);
      }
      ctx.stroke();
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 0.08;
      ctx.globalAlpha = 0.5;
      ctx.stroke();
      break;
    }
    case 'bottle':
      ctx.rotate(tilt + 1.2);
      roundRectPath(ctx, -0.45, -0.6, 0.9, 2.0, 0.35);
      chunky(ctx, '#7a4b1e', 0.14);
      roundRectPath(ctx, -0.2, -1.5, 0.4, 1.0, 0.15);
      chunky(ctx, '#7a4b1e', 0.12);
      ctx.fillStyle = '#ffd166';
      ctx.fillRect(-0.35, 0.1, 0.7, 0.6);
      break;
    case 'neonSign':
      ctx.rotate(tilt * 0.3);
      roundRectPath(ctx, -1.8, -0.7, 3.6, 1.4, 0.4);
      chunky(ctx, '#1a1226', 0.14);
      ctx.save();
      ctx.shadowColor = '#ff3fa4';
      ctx.shadowBlur = 6;
      label(ctx, 'OPEN', 0, 0, 0.8, '#ff9fd2');
      ctx.restore();
      break;
    case 'stallDoor':
      roundRectPath(ctx, -1.2, -1.8, 2.4, 3.6, 0.25);
      chunky(ctx, '#6f8fa8', 0.18);
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(-0.9, -0.3, 0.5, 0.25);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 0.14;
      ctx.beginPath();
      ctx.moveTo(-0.9, -1.4);
      ctx.lineTo(0.9, -1.4);
      ctx.stroke();
      break;
    case 'suitcase':
      ctx.rotate(tilt);
      roundRectPath(ctx, -1.3, -0.9, 2.6, 1.8, 0.35);
      chunky(ctx, ['#e63946', '#3a86ff', '#ffd166'][Math.floor(rand() * 3)], 0.18);
      roundRectPath(ctx, -0.5, -1.3, 1.0, 0.5, 0.2);
      chunky(ctx, OUTLINE, 0.1);
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 0.1;
      ctx.beginPath();
      ctx.moveTo(-1.3, 0);
      ctx.lineTo(1.3, 0);
      ctx.stroke();
      break;
    case 'gateSign':
      label(ctx, `GATE ${12 + Math.floor(rand() * 30)} →`, 0, 0, 0.7, '#ffffff', '#1f2a44');
      break;
    case 'hardHat':
      ellipse(ctx, 0, 0.2, 1.3, 0.5);
      chunky(ctx, '#ffd60a', 0.16);
      ctx.beginPath();
      ctx.arc(0, 0.1, 0.95, Math.PI, 0);
      ctx.closePath();
      chunky(ctx, '#ffd60a', 0.16);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ellipse(ctx, -0.3, -0.35, 0.3, 0.15);
      ctx.fill();
      break;
    case 'cone':
      ctx.beginPath();
      ctx.moveTo(0, -1.6);
      ctx.lineTo(0.9, 0.7);
      ctx.lineTo(-0.9, 0.7);
      ctx.closePath();
      chunky(ctx, '#ff6f3c', 0.16);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(-0.45, -0.4);
      ctx.lineTo(0.45, -0.4);
      ctx.lineTo(0.6, 0);
      ctx.lineTo(-0.6, 0);
      ctx.closePath();
      ctx.fill();
      roundRectPath(ctx, -1.1, 0.6, 2.2, 0.35, 0.1);
      chunky(ctx, '#ff6f3c', 0.12);
      break;
    case 'torch':
      roundRectPath(ctx, -0.22, -0.4, 0.44, 1.8, 0.2);
      chunky(ctx, '#8a5a2b', 0.12);
      ctx.beginPath();
      ctx.moveTo(-0.6, -0.4);
      ctx.quadraticCurveTo(-0.5, -1.7, 0, -1.9);
      ctx.quadraticCurveTo(0.5, -1.7, 0.6, -0.4);
      ctx.closePath();
      chunky(ctx, '#ff9f1c', 0.12);
      ctx.fillStyle = '#ffd166';
      ellipse(ctx, 0, -1.0, 0.25, 0.45);
      ctx.fill();
      break;
    case 'shield':
      ctx.beginPath();
      ctx.moveTo(-1, -1.2);
      ctx.lineTo(1, -1.2);
      ctx.lineTo(1, 0.2);
      ctx.quadraticCurveTo(0.6, 1.2, 0, 1.4);
      ctx.quadraticCurveTo(-0.6, 1.2, -1, 0.2);
      ctx.closePath();
      chunky(ctx, '#c0392b', 0.16);
      ctx.fillStyle = '#ffd166';
      ctx.fillRect(-0.15, -0.9, 0.3, 1.9);
      ctx.fillRect(-0.8, -0.2, 1.6, 0.3);
      break;
    case 'chain':
      ctx.rotate(tilt);
      ctx.strokeStyle = '#8d99a6';
      ctx.lineWidth = 0.22;
      for (let k = -2; k <= 2; k++) {
        ellipse(ctx, k * 0.7, 0, 0.42, 0.26);
        ctx.stroke();
      }
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 0.08;
      for (let k = -2; k <= 2; k++) {
        ellipse(ctx, k * 0.7, 0, 0.42, 0.26);
        ctx.stroke();
      }
      break;
    case 'star':
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.6 + rand() * 0.4;
      circle(ctx, 0, 0, 0.12 + rand() * 0.16);
      ctx.fill();
      break;
    case 'planet': {
      const c = ['#ff6f3c', '#5be3a3', '#b388ff'][Math.floor(rand() * 3)];
      circle(ctx, 0, 0, 1.2);
      chunky(ctx, c, 0.16);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 0.18;
      ellipse(ctx, 0, 0, 1.9, 0.45);
      ctx.stroke();
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 0.08;
      ctx.stroke();
      break;
    }
    case 'droplet':
      ctx.beginPath();
      ctx.moveTo(0, -1.1);
      ctx.quadraticCurveTo(0.9, 0.1, 0, 0.8);
      ctx.quadraticCurveTo(-0.9, 0.1, 0, -1.1);
      chunky(ctx, '#3a86ff', 0.14);
      highlight(ctx, -0.25, -0.2, 0.18, 0.28);
      break;
    case 'ghostRoll':
      ctx.beginPath();
      ctx.moveTo(-0.9, 1.0);
      ctx.lineTo(-0.9, -0.4);
      ctx.arc(0, -0.4, 0.9, Math.PI, 0);
      ctx.lineTo(0.9, 1.0);
      ctx.lineTo(0.45, 0.6);
      ctx.lineTo(0, 1.0);
      ctx.lineTo(-0.45, 0.6);
      ctx.closePath();
      chunky(ctx, '#ffffff', 0.16);
      ctx.fillStyle = OUTLINE;
      circle(ctx, -0.3, -0.4, 0.14);
      ctx.fill();
      circle(ctx, 0.3, -0.4, 0.14);
      ctx.fill();
      ellipse(ctx, 0, 0.1, 0.18, 0.12);
      ctx.fill();
      break;
    case 'crackedMirror':
      roundRectPath(ctx, -1.3, -1.6, 2.6, 3.2, 0.3);
      chunky(ctx, '#bfe4ff', 0.18);
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 0.08;
      ctx.beginPath();
      ctx.moveTo(-0.9, -1.2);
      ctx.lineTo(-0.1, 0);
      ctx.lineTo(0.8, 1.2);
      ctx.moveTo(-0.1, 0);
      ctx.lineTo(0.9, -0.6);
      ctx.moveTo(-0.1, 0);
      ctx.lineTo(-1.0, 0.7);
      ctx.stroke();
      break;
    case 'cobweb':
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 0.06;
      for (let k = 0; k < 5; k++) {
        const a = -Math.PI / 2 + (k / 4) * (Math.PI / 2);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * 2.2, Math.sin(a) * 2.2);
        ctx.stroke();
      }
      for (let r = 0.6; r < 2.2; r += 0.55) {
        ctx.beginPath();
        ctx.arc(0, 0, r, -Math.PI / 2, 0);
        ctx.stroke();
      }
      break;
    case 'palm':
      ctx.rotate(tilt);
      ctx.strokeStyle = '#8a5a2b';
      ctx.lineWidth = 0.3;
      ctx.beginPath();
      ctx.moveTo(0, 1.2);
      ctx.quadraticCurveTo(0.2, 0, 0, -0.8);
      ctx.stroke();
      for (let k = 0; k < 5; k++) {
        const a = -Math.PI / 2 + (k - 2) * 0.55;
        ctx.save();
        ctx.translate(0, -0.8);
        ctx.rotate(a);
        ellipse(ctx, 1.1, 0, 1.2, 0.35);
        chunky(ctx, '#4f9a3a', 0.12);
        ctx.restore();
      }
      break;
    case 'hibiscus':
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2;
        ellipse(ctx, Math.cos(a) * 0.55, Math.sin(a) * 0.55, 0.5, 0.32);
        chunky(ctx, '#ff5f7e', 0.1);
      }
      circle(ctx, 0, 0, 0.28);
      chunky(ctx, '#ffd166', 0.08);
      break;
    case 'waterfall':
      roundRectPath(ctx, -1.6, -1.6, 3.2, 3.2, 0.6);
      chunky(ctx, '#3a86ff', 0.16);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 0.18;
      ctx.beginPath();
      for (let k = -1; k <= 1; k++) {
        ctx.moveTo(k * 0.8, -1.2);
        ctx.lineTo(k * 0.8, 0.6);
      }
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      for (let k = 0; k < 4; k++) {
        circle(ctx, -1.0 + k * 0.7, 1.0, 0.18);
        ctx.fill();
      }
      break;
    case 'washSign':
      label(ctx, 'WASH YOUR HANDS', 0, 0, 0.55, '#1f2a44', '#ffffff');
      break;
    case 'dispenser':
      roundRectPath(ctx, -0.7, -0.9, 1.4, 1.8, 0.25);
      chunky(ctx, '#ffffff', 0.16);
      ctx.fillStyle = '#5be3a3';
      ctx.fillRect(-0.4, -0.5, 0.8, 0.5);
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(-0.3, 0.4, 0.6, 0.2);
      break;
    case 'sensor':
      roundRectPath(ctx, -0.6, -0.4, 1.2, 0.8, 0.2);
      chunky(ctx, '#dde2e7', 0.14);
      ctx.fillStyle = '#e63946';
      circle(ctx, 0, 0, 0.15);
      ctx.fill();
      ctx.strokeStyle = '#e63946';
      ctx.lineWidth = 0.08;
      ctx.beginPath();
      ctx.arc(0, 0, 0.5, -0.6, 0.6);
      ctx.stroke();
      break;
    case 'potpourri':
      ellipse(ctx, 0, 0.2, 1.1, 0.6);
      chunky(ctx, '#d99aa9', 0.14);
      for (let k = 0; k < 6; k++) {
        ctx.fillStyle = ['#ff9ac2', '#c084fc', '#ffd166'][k % 3];
        ellipse(ctx, (rand() - 0.5) * 1.4, -0.2 + (rand() - 0.5) * 0.5, 0.25, 0.16);
        ctx.fill();
      }
      break;
    case 'knitCover':
      ellipse(ctx, 0, 0, 1.3, 1.6);
      chunky(ctx, '#f28cae', 0.16);
      ctx.strokeStyle = '#9ad0c2';
      ctx.lineWidth = 0.14;
      ctx.setLineDash([0.25, 0.2]);
      for (let y = -1.1; y <= 1.1; y += 0.5) {
        ctx.beginPath();
        ctx.moveTo(-1.1, y);
        ctx.lineTo(1.1, y);
        ctx.stroke();
      }
      break;
    case 'crowd':
      for (let k = -2; k <= 2; k++) {
        const c = ['#3a86ff', '#e63946', '#ffd166', '#5be3a3', '#ff6f3c'][k + 2];
        circle(ctx, k * 0.9, -0.5, 0.42);
        chunky(ctx, '#f1c27d', 0.12);
        roundRectPath(ctx, k * 0.9 - 0.5, -0.1, 1.0, 1.1, 0.3);
        chunky(ctx, c, 0.12);
      }
      break;
    case 'pennant':
      ctx.rotate(tilt);
      ctx.beginPath();
      ctx.moveTo(-1.6, -0.7);
      ctx.lineTo(1.6, 0);
      ctx.lineTo(-1.6, 0.7);
      ctx.closePath();
      chunky(ctx, ['#e63946', '#3a86ff'][Math.floor(rand() * 2)], 0.14);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(-1.3, -0.35);
      ctx.lineTo(0.2, 0);
      ctx.lineTo(-1.3, 0.35);
      ctx.closePath();
      ctx.fill();
      break;
    case 'foamFinger':
      ctx.rotate(tilt);
      roundRectPath(ctx, -0.8, -0.2, 1.6, 1.6, 0.4);
      chunky(ctx, '#ffd166', 0.14);
      roundRectPath(ctx, -0.35, -1.7, 0.7, 1.7, 0.35);
      chunky(ctx, '#ffd166', 0.14);
      label(ctx, '#1', 0, 0.6, 0.6, OUTLINE);
      break;
    case 'sinkPuddle':
      ctx.globalAlpha = 0.85;
      ellipse(ctx, 0, 0, 1.7, 1.0);
      chunky(ctx, '#3a86ff', 0.12);
      highlight(ctx, -0.5, -0.3, 0.5, 0.18, 0.7);
      break;
  }
  ctx.restore();
}
