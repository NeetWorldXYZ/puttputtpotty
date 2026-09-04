/**
 * Playable region from the wall list: chains wall segments into closed
 * loops. Even-odd over the loops = inside the hole. Used for clipping the
 * floor and for placing props outside the playable area.
 */

import type { Hole, Point, Polygon } from '../sim/types';
import { distSqPointSegment, pointInPolygon } from '../sim/geometry';

export interface Region {
  loops: Polygon[];
  /** True when no closed loop was found and the bounds rect is used instead. */
  fallback: boolean;
}

function key(p: Point): string {
  return `${Math.round(p.x * 1000)},${Math.round(p.y * 1000)}`;
}

export function wallLoops(hole: Hole): Region {
  const walls = hole.walls;
  const used = new Array(walls.length).fill(false);
  const byPoint = new Map<string, number[]>();
  walls.forEach((w, i) => {
    for (const p of [w.a, w.b]) {
      const k = key(p);
      const arr = byPoint.get(k) ?? [];
      arr.push(i);
      byPoint.set(k, arr);
    }
  });
  const loops: Polygon[] = [];
  for (let start = 0; start < walls.length; start++) {
    if (used[start]) continue;
    const loop: Point[] = [walls[start].a];
    let cur = walls[start].b;
    used[start] = true;
    let guard = 0;
    let closed = false;
    while (guard++ < walls.length + 2) {
      if (key(cur) === key(loop[0])) {
        closed = true;
        break;
      }
      loop.push(cur);
      const cands = (byPoint.get(key(cur)) ?? []).filter((i) => !used[i]);
      if (cands.length === 0) break;
      const i = cands[0];
      used[i] = true;
      cur = key(walls[i].a) === key(cur) ? walls[i].b : walls[i].a;
    }
    if (closed && loop.length >= 3) loops.push(loop);
  }
  const b = hole.bounds;
  const inside = loops.some((l) => pointInPolygon(hole.tee.x, hole.tee.y, l));
  if (!inside) {
    return {
      loops: [
        [
          { x: b.x, y: b.y },
          { x: b.x + b.w, y: b.y },
          { x: b.x + b.w, y: b.y + b.h },
          { x: b.x, y: b.y + b.h },
        ],
      ],
      fallback: true,
    };
  }
  return { loops, fallback: false };
}

export function pointInRegion(r: Region, x: number, y: number): boolean {
  let n = 0;
  for (const l of r.loops) if (pointInPolygon(x, y, l)) n++;
  return n % 2 === 1;
}

export function distToWalls(hole: Hole, x: number, y: number): number {
  let best = Infinity;
  for (const w of hole.walls) {
    const d = distSqPointSegment(x, y, w.a.x, w.a.y, w.b.x, w.b.y);
    if (d < best) best = d;
  }
  return Math.sqrt(best);
}

export function traceRegion(ctx: CanvasRenderingContext2D, r: Region): void {
  ctx.beginPath();
  for (const l of r.loops) {
    l.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
  }
}
