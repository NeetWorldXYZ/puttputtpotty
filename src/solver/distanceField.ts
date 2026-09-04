/**
 * Geodesic distance field over a hole: a coarse grid where each cell holds
 * the walking distance (in cells) to the cup, avoiding walls, obstacles
 * and (optionally) hazards. Used by the solver as a route-aware heuristic
 * ("how far is this rest position from the cup, really") and for the
 * static reject rules (cup unreachable, hazard unavoidable).
 */

import type { Hole } from '../sim/types';
import type { World } from '../sim/world';
import { distSqPointSegment, pointInPolygon } from '../sim/geometry';

export interface DistanceField {
  cell: number;
  cols: number;
  rows: number;
  originX: number;
  originY: number;
  /** Cell centre is a legal ball-centre position (not inside a wall/obstacle, inside bounds). */
  free: Uint8Array;
  /** Cell centre is inside a hazard polygon. */
  hazard: Uint8Array;
  /** Steps to the cup, hazards treated as walls. Infinity if unreachable. */
  distSafe: Float32Array;
  /** Steps to the cup, hazards passable. Infinity if unreachable. */
  distAny: Float32Array;
}

export function buildDistanceField(world: World, ballRadius: number, cell = 0.5): DistanceField {
  const hole: Hole = world.hole;
  const b = hole.bounds;
  const cols = Math.max(1, Math.ceil(b.w / cell));
  const rows = Math.max(1, Math.ceil(b.h / cell));
  const n = cols * rows;
  const free = new Uint8Array(n);
  const hazard = new Uint8Array(n);
  // A cell is blocked if a collider comes within ball radius + half a cell of
  // its centre, so the walk can never step across a wall between two cells.
  const block = ballRadius + cell * 0.5;
  const r2 = block * block;

  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const x = b.x + (i + 0.5) * cell;
      const y = b.y + (j + 0.5) * cell;
      const idx = j * cols + i;
      let ok = x - ballRadius >= b.x && x + ballRadius <= b.x + b.w && y - ballRadius >= b.y && y + ballRadius <= b.y + b.h;
      if (ok) {
        for (const s of world.segments) {
          if (s.kind === 'bounds' || s.kind === 'curb') continue;
          if (distSqPointSegment(x, y, s.ax, s.ay, s.bx, s.by) < r2) {
            ok = false;
            break;
          }
        }
      }
      if (ok) {
        for (const c of world.circles) {
          if (c.kind === 'curb') continue;
          const dx = x - c.x;
          const dy = y - c.y;
          const m = block + c.r;
          if (dx * dx + dy * dy < m * m) {
            ok = false;
            break;
          }
        }
      }
      // Inside a solid obstacle but not near its edge: also blocked.
      if (ok) {
        for (const o of hole.obstacles) {
          if (o.type !== 'blocker' && o.type !== 'deadWall') continue;
          const s = o.shape;
          const inside =
            s.kind === 'rect'
              ? x > s.x && x < s.x + s.w && y > s.y && y < s.y + s.h
              : s.kind === 'polygon'
                ? pointInPolygon(x, y, s.points)
                : false;
          if (inside) {
            ok = false;
            break;
          }
        }
      }
      free[idx] = ok ? 1 : 0;
      if (ok) {
        for (const h of world.hazards) {
          if (pointInPolygon(x, y, h.polygon)) {
            hazard[idx] = 1;
            break;
          }
        }
      }
    }
  }

  const df: DistanceField = {
    cell,
    cols,
    rows,
    originX: b.x,
    originY: b.y,
    free,
    hazard,
    distSafe: new Float32Array(n),
    distAny: new Float32Array(n),
  };
  bfs(df, hole.cup.x, hole.cup.y, true, df.distSafe);
  bfs(df, hole.cup.x, hole.cup.y, false, df.distAny);
  return df;
}

export function cellIndex(df: DistanceField, x: number, y: number): number {
  let i = Math.floor((x - df.originX) / df.cell);
  let j = Math.floor((y - df.originY) / df.cell);
  if (i < 0) i = 0;
  else if (i >= df.cols) i = df.cols - 1;
  if (j < 0) j = 0;
  else if (j >= df.rows) j = df.rows - 1;
  return j * df.cols + i;
}

/** Nearest free cell index to a point (the cup/tee/ball may sit off-centre). */
function nearestFree(df: DistanceField, x: number, y: number): number {
  const start = cellIndex(df, x, y);
  if (df.free[start]) return start;
  const si = start % df.cols;
  const sj = (start - si) / df.cols;
  for (let ring = 1; ring < 6; ring++) {
    for (let dj = -ring; dj <= ring; dj++) {
      for (let di = -ring; di <= ring; di++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== ring) continue;
        const i = si + di;
        const j = sj + dj;
        if (i < 0 || j < 0 || i >= df.cols || j >= df.rows) continue;
        const idx = j * df.cols + i;
        if (df.free[idx]) return idx;
      }
    }
  }
  return -1;
}

function bfs(df: DistanceField, sx: number, sy: number, avoidHazards: boolean, out: Float32Array): void {
  out.fill(Infinity);
  const start = nearestFree(df, sx, sy);
  if (start < 0) return;
  const { cols, rows, free, hazard } = df;
  const queue: number[] = [];
  let head = 0;
  out[start] = 0;
  queue.push(start);
  // 8-connected, diagonal cost sqrt2; BFS order is close enough for a heuristic.
  const SQ2 = 1.4142135623730951;
  while (head < queue.length) {
    const cur = queue[head++];
    const ci = cur % cols;
    const cj = (cur - ci) / cols;
    const d0 = out[cur];
    for (let dj = -1; dj <= 1; dj++) {
      for (let di = -1; di <= 1; di++) {
        if (di === 0 && dj === 0) continue;
        const i = ci + di;
        const j = cj + dj;
        if (i < 0 || j < 0 || i >= cols || j >= rows) continue;
        const idx = j * cols + i;
        if (!free[idx]) continue;
        if (avoidHazards && hazard[idx]) continue;
        // Don't cut corners through blocked cells.
        if (di !== 0 && dj !== 0 && (!free[cj * cols + i] || !free[j * cols + ci])) continue;
        const nd = d0 + (di !== 0 && dj !== 0 ? SQ2 : 1);
        if (nd < out[idx] - 1e-6) {
          out[idx] = nd;
          queue.push(idx);
        }
      }
    }
  }
}

/** Geodesic distance (in units) from a point to the cup. */
export function distanceToCup(df: DistanceField, x: number, y: number, avoidHazards = true): number {
  const idx = nearestFree(df, x, y);
  if (idx < 0) return Infinity;
  const d = avoidHazards ? df.distSafe[idx] : df.distAny[idx];
  return d * df.cell;
}

/**
 * Direction (unit vector) to move from a point to get closer to the cup,
 * following the field's gradient over a few cells so walls are respected.
 * Returns null if the cup is unreachable from here.
 */
export function directionToCup(df: DistanceField, x: number, y: number, lookahead = 4): { x: number; y: number } | null {
  let idx = nearestFree(df, x, y);
  if (idx < 0 || !Number.isFinite(df.distSafe[idx])) return null;
  const startI = idx % df.cols;
  const startJ = (idx - startI) / df.cols;
  let ci = startI;
  let cj = startJ;
  for (let step = 0; step < lookahead; step++) {
    let best = idx;
    let bestD = df.distSafe[idx];
    for (let dj = -1; dj <= 1; dj++) {
      for (let di = -1; di <= 1; di++) {
        const i = ci + di;
        const j = cj + dj;
        if (i < 0 || j < 0 || i >= df.cols || j >= df.rows) continue;
        const k = j * df.cols + i;
        if (df.distSafe[k] < bestD) {
          bestD = df.distSafe[k];
          best = k;
        }
      }
    }
    if (best === idx) break;
    idx = best;
    ci = idx % df.cols;
    cj = (idx - ci) / df.cols;
  }
  const dx = ci - startI;
  const dy = cj - startJ;
  const l = Math.sqrt(dx * dx + dy * dy);
  if (l < 1e-9) return null;
  return { x: dx / l, y: dy / l };
}
