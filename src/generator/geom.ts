/**
 * Geometry for the generator. A hole's playable area is the union of convex
 * "cells" (rectangles, rotated rectangles, trapezoids); the walls are the
 * boundary of that union. Islands are obstacles placed inside.
 */

import type { Point, Polygon, Wall } from '../sim/types';
import { pointInPolygon } from '../sim/geometry';

const EPS = 1e-6;

export function rect(x: number, y: number, w: number, h: number): Polygon {
  return [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ];
}

/** Rectangle of length `len` along `angle` (radians, y-down) and width `wid`, starting at (x,y) on its centreline. */
export function beam(x: number, y: number, len: number, wid: number, angle: number): Polygon {
  const ux = Math.cos(angle);
  const uy = Math.sin(angle);
  const nx = -uy * (wid / 2);
  const ny = ux * (wid / 2);
  return [
    { x: x + nx, y: y + ny },
    { x: x + ux * len + nx, y: y + uy * len + ny },
    { x: x + ux * len - nx, y: y + uy * len - ny },
    { x: x - nx, y: y - ny },
  ];
}

/** Vertical trapezoid: width w0 at the bottom (y1) and w1 at the top (y0), centred on cx. */
export function trapezoid(cx: number, y0: number, y1: number, w1: number, w0: number): Polygon {
  return [
    { x: cx - w1 / 2, y: y0 },
    { x: cx + w1 / 2, y: y0 },
    { x: cx + w0 / 2, y: y1 },
    { x: cx - w0 / 2, y: y1 },
  ];
}

export function regularPolygon(cx: number, cy: number, r: number, sides: number, rot = 0): Polygon {
  const out: Polygon = [];
  for (let i = 0; i < sides; i++) {
    const a = rot + (i / sides) * Math.PI * 2;
    out.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  return out;
}

export function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

export function roundPoly(p: Polygon): Polygon {
  return p.map((q) => ({ x: round2(q.x), y: round2(q.y) }));
}

function segSegParam(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, dx: number, dy: number): number | null {
  const rX = bx - ax;
  const rY = by - ay;
  const sX = dx - cx;
  const sY = dy - cy;
  const denom = rX * sY - rY * sX;
  if (Math.abs(denom) < EPS) return null;
  const t = ((cx - ax) * sY - (cy - ay) * sX) / denom;
  const u = ((cx - ax) * rY - (cy - ay) * rX) / denom;
  if (t <= EPS || t >= 1 - EPS || u < -EPS || u > 1 + EPS) return null;
  return t;
}

function distPointSeg(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy;
  let t = l2 < EPS ? 0 : ((px - ax) * dx + (py - ay) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  const qx = ax + dx * t - px;
  const qy = ay + dy * t - py;
  return Math.sqrt(qx * qx + qy * qy);
}

function insideOrOn(p: Point, poly: Polygon): boolean {
  if (pointInPolygon(p.x, p.y, poly)) return true;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    if (distPointSeg(p.x, p.y, a.x, a.y, b.x, b.y) < 1e-4) return true;
  }
  return false;
}

/**
 * Walls = boundary of the union of the cells. Each cell must be convex.
 * An edge piece is dropped when a point just outside it (away from the
 * cell's centroid) lies inside another cell: that covers pieces strictly
 * inside a neighbour and pieces where two cells abut, while keeping outer
 * edges that two cells happen to share a line with.
 */
export function unionWalls(cells: Polygon[]): Wall[] {
  const walls: Wall[] = [];
  for (let i = 0; i < cells.length; i++) {
    const poly = cells[i];
    const centroid = polygonCentroid(poly);
    for (let e = 0; e < poly.length; e++) {
      const a = poly[e];
      const b = poly[(e + 1) % poly.length];
      const ex = b.x - a.x;
      const ey = b.y - a.y;
      const el = Math.hypot(ex, ey);
      if (el < EPS) continue;
      // Outward normal: perpendicular pointing away from the centroid.
      let nx = -ey / el;
      let ny = ex / el;
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      if ((mx - centroid.x) * nx + (my - centroid.y) * ny < 0) {
        nx = -nx;
        ny = -ny;
      }
      const ts = [0, 1];
      for (let j = 0; j < cells.length; j++) {
        if (j === i) continue;
        const other = cells[j];
        for (let f = 0; f < other.length; f++) {
          const c = other[f];
          const d = other[(f + 1) % other.length];
          const t = segSegParam(a.x, a.y, b.x, b.y, c.x, c.y, d.x, d.y);
          if (t !== null) ts.push(t);
          if (distPointSeg(c.x, c.y, a.x, a.y, b.x, b.y) < 1e-4) {
            const tt = ((c.x - a.x) * ex + (c.y - a.y) * ey) / (el * el);
            if (tt > EPS && tt < 1 - EPS) ts.push(tt);
          }
        }
      }
      ts.sort((p, q) => p - q);
      for (let k = 0; k + 1 < ts.length; k++) {
        const t0 = ts[k];
        const t1 = ts[k + 1];
        if (t1 - t0 < 1e-5) continue;
        const tm = (t0 + t1) / 2;
        const probe = { x: a.x + ex * tm + nx * 0.01, y: a.y + ey * tm + ny * 0.01 };
        let interior = false;
        for (let j = 0; j < cells.length; j++) {
          if (j !== i && pointInPolygon(probe.x, probe.y, cells[j])) {
            interior = true;
            break;
          }
        }
        if (!interior) {
          walls.push({
            a: { x: round2(a.x + ex * t0), y: round2(a.y + ey * t0) },
            b: { x: round2(a.x + ex * t1), y: round2(a.y + ey * t1) },
          });
        }
      }
    }
  }
  return mergeCollinear(dedupeWalls(walls));
}

/** Remove walls with identical endpoints (either order). */
export function dedupeWalls(walls: Wall[]): Wall[] {
  const seen = new Set<string>();
  const out: Wall[] = [];
  const k = (p: Point) => `${p.x},${p.y}`;
  for (const w of walls) {
    const a = k(w.a);
    const b = k(w.b);
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(w);
  }
  return out;
}

/**
 * Convex cell that fills the outside corner where two beams of width `w`
 * meet at C, beam 1 arriving along d1 and beam 2 leaving along d2.
 */
export function miterJoint(C: Point, d1: Point, d2: Point, w: number): Polygon | null {
  const cross = d1.x * d2.y - d1.y * d2.x;
  if (Math.abs(cross) < 1e-6) return null;
  const s = cross > 0 ? -1 : 1; // outer side is opposite the turn
  const n1 = { x: -d1.y * s, y: d1.x * s };
  const n2 = { x: -d2.y * s, y: d2.x * s };
  const h = w / 2;
  const e1 = { x: C.x + n1.x * h, y: C.y + n1.y * h };
  const e2 = { x: C.x + n2.x * h, y: C.y + n2.y * h };
  const bx = n1.x + n2.x;
  const by = n1.y + n2.y;
  const bl = Math.hypot(bx, by);
  const cosHalf = bl / 2; // |n1+n2|/2 = cos(theta/2)
  const m = { x: C.x + (bx / bl) * (h / cosHalf), y: C.y + (by / bl) * (h / cosHalf) };
  return [C, e1, m, e2];
}

/** Join wall pieces that share an endpoint and direction. */
export function mergeCollinear(walls: Wall[]): Wall[] {
  const out = walls.map((w) => ({ a: { ...w.a }, b: { ...w.b } }));
  let merged = true;
  while (merged) {
    merged = false;
    outer: for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) {
        const w1 = out[i];
        const w2 = out[j];
        const ends: [Point, Point, Point, Point][] = [
          [w1.a, w1.b, w2.a, w2.b],
          [w1.a, w1.b, w2.b, w2.a],
          [w1.b, w1.a, w2.a, w2.b],
          [w1.b, w1.a, w2.b, w2.a],
        ];
        for (const [far1, near1, near2, far2] of ends) {
          if (Math.abs(near1.x - near2.x) > 1e-6 || Math.abs(near1.y - near2.y) > 1e-6) continue;
          const d1x = near1.x - far1.x;
          const d1y = near1.y - far1.y;
          const d2x = far2.x - near2.x;
          const d2y = far2.y - near2.y;
          const cross = d1x * d2y - d1y * d2x;
          const dot = d1x * d2x + d1y * d2y;
          if (Math.abs(cross) < 1e-6 && dot > 0) {
            out[i] = { a: { ...far1 }, b: { ...far2 } };
            out.splice(j, 1);
            merged = true;
            break outer;
          }
        }
      }
    }
  }
  return out;
}

export function polygonCentroid(p: Polygon): Point {
  let x = 0;
  let y = 0;
  for (const q of p) {
    x += q.x;
    y += q.y;
  }
  return { x: x / p.length, y: y / p.length };
}

export function polygonBBox(p: Polygon): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const q of p) {
    minX = Math.min(minX, q.x);
    minY = Math.min(minY, q.y);
    maxX = Math.max(maxX, q.x);
    maxY = Math.max(maxY, q.y);
  }
  return { minX, minY, maxX, maxY };
}

/** Shrink a convex polygon toward its centroid by `d` units (approximate, fine for placement). */
export function inset(p: Polygon, d: number): Polygon {
  const c = polygonCentroid(p);
  return p.map((q) => {
    const dx = q.x - c.x;
    const dy = q.y - c.y;
    const l = Math.hypot(dx, dy);
    if (l < d * 1.5) return { x: c.x, y: c.y };
    const k = (l - d * 1.4142) / l;
    return { x: c.x + dx * k, y: c.y + dy * k };
  });
}

/** Largest axis-aligned rect fully inside a convex polygon, sampled coarsely. */
export function innerRect(p: Polygon, margin = 0): { x: number; y: number; w: number; h: number } | null {
  const bb = polygonBBox(p);
  const cx = (bb.minX + bb.maxX) / 2;
  const cy = (bb.minY + bb.maxY) / 2;
  let best: { x: number; y: number; w: number; h: number } | null = null;
  for (let w = bb.maxX - bb.minX - margin * 2; w >= 1; w -= 0.5) {
    for (let h = bb.maxY - bb.minY - margin * 2; h >= 1; h -= 0.5) {
      const x = cx - w / 2;
      const y = cy - h / 2;
      const corners = [
        { x, y },
        { x: x + w, y },
        { x: x + w, y: y + h },
        { x, y: y + h },
      ];
      if (corners.every((q) => insideOrOn(q, p) && !onBoundaryWithin(q, p, margin))) {
        if (!best || w * h > best.w * best.h) best = { x, y, w, h };
        break;
      }
    }
  }
  return best;
}

function onBoundaryWithin(q: Point, p: Polygon, margin: number): boolean {
  if (margin <= 0) return false;
  for (let i = 0; i < p.length; i++) {
    const a = p[i];
    const b = p[(i + 1) % p.length];
    if (distPointSeg(q.x, q.y, a.x, a.y, b.x, b.y) < margin - 1e-6) return true;
  }
  return false;
}

export function pointInAnyCell(p: Point, cells: Polygon[]): boolean {
  return cells.some((c) => pointInPolygon(p.x, p.y, c));
}

/** Distance from p to the nearest wall. */
export function distToWalls(p: Point, walls: Wall[]): number {
  let best = Infinity;
  for (const w of walls) best = Math.min(best, distPointSeg(p.x, p.y, w.a.x, w.a.y, w.b.x, w.b.y));
  return best;
}
