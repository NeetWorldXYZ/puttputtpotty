/** Small drawing helpers shared by the cartoon renderer. All in world units. */

import type { Point } from '../sim/types';
import { OUTLINE } from './themes';

/** Deterministic tiny PRNG for decoration placement. */
export function makeRand(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Polygon path with rounded corners (radius clamped to half the shorter adjacent edge). */
export function roundedPolygonPath(ctx: CanvasRenderingContext2D, pts: Point[], radius: number): void {
  const n = pts.length;
  if (n < 3) {
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    return;
  }
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i + n - 1) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const l1 = Math.hypot(p1.x - p0.x, p1.y - p0.y);
    const l2 = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const r = Math.min(radius, l1 / 2, l2 / 2);
    const ax = p1.x + ((p0.x - p1.x) / (l1 || 1)) * r;
    const ay = p1.y + ((p0.y - p1.y) / (l1 || 1)) * r;
    const bx = p1.x + ((p2.x - p1.x) / (l2 || 1)) * r;
    const by = p1.y + ((p2.y - p1.y) / (l2 || 1)) * r;
    if (i === 0) ctx.moveTo(ax, ay);
    else ctx.lineTo(ax, ay);
    ctx.quadraticCurveTo(p1.x, p1.y, bx, by);
  }
  ctx.closePath();
}

export function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

/** Fill + outline the current path in the house style. */
export function chunky(ctx: CanvasRenderingContext2D, fill: string, lineWidth = 0.22, outline = OUTLINE): void {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineJoin = 'round';
  ctx.lineWidth = lineWidth;
  ctx.strokeStyle = outline;
  ctx.stroke();
}

export function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
}

export function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number): void {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
}

export function polygonCentroid(pts: Point[]): Point {
  let x = 0;
  let y = 0;
  for (const p of pts) {
    x += p.x;
    y += p.y;
  }
  return { x: x / pts.length, y: y / pts.length };
}

export function bbox(pts: Point[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { minX, minY, maxX, maxY };
}

/** Soft shadow under an object: a dark ellipse offset down-right. */
export function dropShadow(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number): void {
  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = OUTLINE;
  ellipse(ctx, x + 0.18, y + 0.28, rx, ry);
  ctx.fill();
  ctx.restore();
}

export function highlight(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, alpha = 0.85): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#ffffff';
  ellipse(ctx, x, y, rx, ry);
  ctx.fill();
  ctx.restore();
}
