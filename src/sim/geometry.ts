/**
 * Pure geometry. Only +, -, *, /, comparisons and Math.sqrt are used, all of
 * which are correctly rounded under IEEE-754, so results are bit-identical
 * across JS engines. (No Math.hypot / pow / trig here — those are not
 * guaranteed to be correctly rounded.)
 */

import type { Point, Polygon } from './types';

export const EPS = 1e-9;

export interface SweepHit {
  /** Time of impact in [0, maxT]. */
  t: number;
  /** Unit contact normal pointing away from the collider, toward the ball. */
  nx: number;
  ny: number;
}

export function len(x: number, y: number): number {
  return Math.sqrt(x * x + y * y);
}

/** Ray-vs-circle: a circle of radius r moving along v from p hits a point e. */
export function sweepCirclePoint(
  px: number,
  py: number,
  vx: number,
  vy: number,
  r: number,
  ex: number,
  ey: number,
  maxT: number,
): SweepHit | null {
  const mx = px - ex;
  const my = py - ey;
  const a = vx * vx + vy * vy;
  if (a < EPS) return null;
  const b = 2 * (mx * vx + my * vy);
  const c = mx * mx + my * my - r * r;
  let t: number;
  if (c <= 0) {
    // Already overlapping. Only report if moving inward.
    if (b >= 0) return null;
    t = 0;
  } else {
    const disc = b * b - 4 * a * c;
    if (disc < 0) return null;
    t = (-b - Math.sqrt(disc)) / (2 * a);
    if (t < 0 || t > maxT) return null;
  }
  const qx = px + vx * t;
  const qy = py + vy * t;
  let nx = qx - ex;
  let ny = qy - ey;
  const nl = len(nx, ny);
  if (nl < EPS) {
    // Ball centre exactly on the point: push back along -v.
    const vl = Math.sqrt(a);
    nx = -vx / vl;
    ny = -vy / vl;
  } else {
    nx /= nl;
    ny /= nl;
  }
  return { t, nx, ny };
}

/**
 * Continuous circle-vs-segment sweep. Equivalent to a ray against the
 * capsule (segment inflated by r): the two offset faces + endpoint circles.
 */
export function sweepCircleSegment(
  px: number,
  py: number,
  vx: number,
  vy: number,
  r: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  maxT: number,
): SweepHit | null {
  let best: SweepHit | null = null;
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 > EPS) {
    const l = Math.sqrt(len2);
    const ux = dx / l;
    const uy = dy / l;
    const nx = -uy;
    const ny = ux;
    const s = (px - ax) * nx + (py - ay) * ny; // signed distance to the line
    const sn = vx * nx + vy * ny; // rate of change of s
    const sgn = s >= 0 ? 1 : -1;
    const dist = s * sgn - r; // >= 0 while outside the slab
    const rate = -sn * sgn; // > 0 while approaching
    if (rate > EPS) {
      const t = dist <= 0 ? 0 : dist / rate;
      if (t <= maxT) {
        const qx = px + vx * t;
        const qy = py + vy * t;
        const along = (qx - ax) * ux + (qy - ay) * uy;
        if (along >= 0 && along <= l) {
          best = { t, nx: nx * sgn, ny: ny * sgn };
        }
      }
    }
  }
  const ha = sweepCirclePoint(px, py, vx, vy, r, ax, ay, maxT);
  if (ha && (!best || ha.t < best.t)) best = ha;
  const hb = sweepCirclePoint(px, py, vx, vy, r, bx, by, maxT);
  if (hb && (!best || hb.t < best.t)) best = hb;
  return best;
}

/** Closest point on segment ab to p. */
export function closestPointOnSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): Point {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 < EPS) return { x: ax, y: ay };
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  return { x: ax + dx * t, y: ay + dy * t };
}

/** Squared distance from p to segment ab. */
export function distSqPointSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const c = closestPointOnSegment(px, py, ax, ay, bx, by);
  const dx = px - c.x;
  const dy = py - c.y;
  return dx * dx + dy * dy;
}

/** Even-odd ray casting. Points exactly on an edge are treated as inside-ish (consistent, deterministic). */
export function pointInPolygon(px: number, py: number, poly: Polygon): boolean {
  let inside = false;
  const n = poly.length;
  if (n < 3) return false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = poly[i].x;
    const yi = poly[i].y;
    const xj = poly[j].x;
    const yj = poly[j].y;
    const intersects = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

export function polygonBounds(poly: Polygon): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of poly) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

/** Unit vector for a compass direction, y-down. Exact values, no trig. */
export function compassVector(dir: string): Point {
  const d = 0.7071067811865476; // 1/sqrt(2)
  switch (dir) {
    case 'N':
      return { x: 0, y: -1 };
    case 'NE':
      return { x: d, y: -d };
    case 'E':
      return { x: 1, y: 0 };
    case 'SE':
      return { x: d, y: d };
    case 'S':
      return { x: 0, y: 1 };
    case 'SW':
      return { x: -d, y: d };
    case 'W':
      return { x: -1, y: 0 };
    case 'NW':
      return { x: -d, y: -d };
    default:
      return { x: 0, y: 0 };
  }
}
