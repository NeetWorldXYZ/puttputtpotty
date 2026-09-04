/**
 * Decoration: surfaces, slopes, hazards, obstacles and chamfers placed into
 * a skeleton's decorable cells. Everything keeps clear of the tee and cup
 * and never fully blocks a lane; the solver has the final say anyway.
 */

import type { Hole, Obstacle, Polygon, Point, SurfaceType, CompassDirection, HazardType } from '../sim/types';
import { COMPASS_DIRECTIONS } from '../sim/types';
import { innerRect, rect, regularPolygon, round2, roundPoly, polygonCentroid } from './geom';
import type { Skeleton } from './archetypes';
import type { Rng } from './rng';

export type Difficulty = 'easy' | 'medium' | 'hard';

interface Budget {
  surfaces: [number, number];
  slopes: [number, number];
  maxGrade: 1 | 2 | 3;
  hazardChance: number;
  hazards: [number, number];
  obstacles: [number, number];
  chamferChance: number;
}

interface BudgetExt extends Budget {
  pipeChance: number;
  /** Chance of at least one moving obstacle, and the max count (never more than 2, per the design doc). */
  moverChance: number;
  movers: [number, number];
}

/** Every difficulty places at least one obstacle. */
const BUDGETS: Record<Difficulty, BudgetExt> = {
  easy: { surfaces: [0, 2], slopes: [0, 1], maxGrade: 1, hazardChance: 0.4, hazards: [1, 1], obstacles: [1, 2], chamferChance: 0.3, pipeChance: 0.1, moverChance: 0.25, movers: [1, 1] },
  medium: { surfaces: [1, 2], slopes: [0, 2], maxGrade: 2, hazardChance: 0.8, hazards: [1, 2], obstacles: [2, 3], chamferChance: 0.4, pipeChance: 0.25, moverChance: 0.6, movers: [1, 1] },
  hard: { surfaces: [1, 3], slopes: [1, 2], maxGrade: 3, hazardChance: 1, hazards: [1, 2], obstacles: [3, 5], chamferChance: 0.5, pipeChance: 0.35, moverChance: 0.85, movers: [1, 2] },
};

/** The static obstacle catalogue the generator composes from. */
export const OBSTACLE_KINDS = [
  'post',
  'postRow',
  'postTriangle',
  'bumper',
  'bumperPair',
  'bar',
  'deadBar',
  'diamond',
  'triangle',
  'hexagon',
  'curb',
  'gate',
  'offsetGate',
  'pillarPair',
] as const;
export type ObstacleKind = (typeof OBSTACLE_KINDS)[number];

const EASY_KINDS: ObstacleKind[] = ['post', 'bumper', 'diamond'];
const MEDIUM_KINDS: ObstacleKind[] = ['post', 'postRow', 'bumper', 'bumperPair', 'bar', 'diamond', 'triangle', 'hexagon', 'gate'];
// Curbs are in the catalogue but not generated yet: without a visual cue a curb reads as a wall.
const HARD_KINDS: ObstacleKind[] = OBSTACLE_KINDS.filter((k) => k !== 'curb');

function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

interface Placed {
  bbox: { minX: number; minY: number; maxX: number; maxY: number };
}

function bboxOf(pts: Point[]): Placed['bbox'] {
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

function bboxDist(b: Placed['bbox'], p: Point): number {
  const dx = Math.max(b.minX - p.x, 0, p.x - b.maxX);
  const dy = Math.max(b.minY - p.y, 0, p.y - b.maxY);
  return Math.hypot(dx, dy);
}

function overlaps(a: Placed['bbox'], b: Placed['bbox'], pad = 0.5): boolean {
  return !(a.maxX + pad < b.minX || b.maxX + pad < a.minX || a.maxY + pad < b.minY || b.maxY + pad < a.minY);
}

export function decorate(hole: Hole, sk: Skeleton, rng: Rng, difficulty: Difficulty, themeId?: string): void {
  const budget = BUDGETS[difficulty];
  const placed: Placed['bbox'][] = [];
  const clearOf = (pts: Point[], teeGap = 4, cupGap = 3.5): boolean => {
    const bb = bboxOf(pts);
    if (bboxDist(bb, hole.tee) < teeGap || bboxDist(bb, hole.cup) < cupGap) return false;
    for (const o of placed) if (overlaps(o, bb)) return false;
    return true;
  };
  const accept = (pts: Point[]): void => {
    placed.push(bboxOf(pts));
  };

  // Lanes we can decorate, with their inner rects.
  const lanes = sk.decorable
    .map((cell) => ({ cell, inner: innerRect(cell, 0.25) }))
    .filter((l): l is { cell: Polygon; inner: { x: number; y: number; w: number; h: number } } => l.inner !== null && l.inner.w >= 3 && l.inner.h >= 3);
  if (lanes.length === 0) return;

  const pickLane = () => rng.pick(lanes);

  /** A sub-rect inside a lane: fraction of its width/height, positioned randomly along it. */
  const subRect = (lane: (typeof lanes)[number], fw: number, fh: number) => {
    const w = Math.max(2, lane.inner.w * fw);
    const h = Math.max(2, lane.inner.h * fh);
    const x = lane.inner.x + rng.range(0, Math.max(0, lane.inner.w - w));
    const y = lane.inner.y + rng.range(0, Math.max(0, lane.inner.h - h));
    return { x: round2(x), y: round2(y), w: round2(w), h: round2(h) };
  };

  // --- surfaces
  const nSurf = rng.int(budget.surfaces[0], budget.surfaces[1]);
  for (let i = 0; i < nSurf; i++) {
    for (let tries = 0; tries < 6; tries++) {
      const lane = pickLane();
      const type = rng.pick<SurfaceType>(['tile', 'tile', 'shag', 'shag', 'wet', 'sand', 'sticky']);
      const tall = lane.inner.h > lane.inner.w;
      const full = type !== 'sticky' && rng.chance(0.6);
      const r = subRect(lane, full ? 1 : rng.range(0.4, 0.7), tall ? rng.range(0.2, 0.45) : full ? 1 : rng.range(0.4, 0.8));
      if (type === 'sticky' && (r.w > lane.inner.w * 0.6 || r.h > lane.inner.h * 0.6)) continue;
      const poly = rect(r.x, r.y, r.w, r.h);
      if (!clearOf(poly, 3, 3)) continue;
      hole.surfaceZones.push({ polygon: roundPoly(poly), surfaceType: type });
      accept(poly);
      break;
    }
  }

  // --- slopes (may overlap surfaces; they're not placed in `placed`)
  const nSlope = rng.int(budget.slopes[0], budget.slopes[1]);
  for (let i = 0; i < nSlope; i++) {
    const lane = pickLane();
    const tall = lane.inner.h > lane.inner.w;
    const r = subRect(lane, 1, tall ? rng.range(0.25, 0.5) : 1);
    const poly = rect(r.x, r.y, r.w, r.h);
    const bb = bboxOf(poly);
    if (bboxDist(bb, hole.cup) < 2) continue;
    const grade = rng.int(1, budget.maxGrade) as 1 | 2 | 3;
    hole.slopeZones.push({ polygon: roundPoly(poly), direction: rng.pick(COMPASS_DIRECTIONS) as CompassDirection, grade });
  }

  // --- hazards: never more than ~55% of a lane's width so a passage stays open
  if (rng.chance(budget.hazardChance)) {
    const n = rng.int(budget.hazards[0], budget.hazards[1]);
    for (let i = 0; i < n; i++) {
      for (let tries = 0; tries < 8; tries++) {
        const lane = pickLane();
        const tall = lane.inner.h > lane.inner.w;
        const across = tall ? lane.inner.w : lane.inner.h;
        if (across < 6) continue;
        const frac = rng.range(0.35, 0.55);
        const r = tall ? subRect(lane, frac, rng.range(0.15, 0.35)) : subRect(lane, rng.range(0.15, 0.35), frac);
        // Hug one side so the passage is a clean strip.
        if (tall) r.x = rng.chance(0.5) ? lane.inner.x : lane.inner.x + lane.inner.w - r.w;
        else r.y = rng.chance(0.5) ? lane.inner.y : lane.inner.y + lane.inner.h - r.h;
        const poly = rect(r.x, r.y, r.w, r.h);
        if (!clearOf(poly, 5, 4)) continue;
        const type = rng.pick<HazardType>(['drain', 'drain', 'water', 'overflow', 'pit']);
        hole.hazards.push({
          polygon: roundPoly(poly),
          type,
          penalty: 1,
          resetTo: type === 'pit' ? 'tee' : type === 'overflow' ? 'entry' : 'lastSafe',
        });
        accept(poly);
        break;
      }
    }
  }

  // --- moving obstacles (timed; at most two per hole)
  if (rng.chance(budget.moverChance)) {
    const n = rng.int(budget.movers[0], budget.movers[1]);
    for (let i = 0; i < n; i++) {
      for (let tries = 0; tries < 24; tries++) {
        const lane = pickLane();
        const made = makeMover(lane, rng, themeId);
        if (!made) continue;
        if (!clearOf(made.footprint, 4, 4)) continue;
        hole.obstacles.push(...made.obstacles);
        accept(made.footprint);
        break;
      }
    }
  }

  // --- obstacles
  const kinds = difficulty === 'easy' ? EASY_KINDS : difficulty === 'medium' ? MEDIUM_KINDS : HARD_KINDS;
  const nObs = rng.int(budget.obstacles[0], budget.obstacles[1]);
  for (let i = 0; i < nObs; i++) {
    for (let tries = 0; tries < 8; tries++) {
      const kind = rng.pick(kinds);
      const made = makeObstacle(kind, pickLane(), rng);
      if (!made) continue;
      const pts = made.footprint;
      if (!clearOf(pts, 4.5, 4)) continue;
      hole.obstacles.push(...made.obstacles);
      if (made.walls) hole.walls.push(...made.walls);
      accept(pts);
      break;
    }
  }

  ensureObstacle(hole, sk, rng, placed);

  // --- secret tunnel: entry in a lane away from the cup, exit near the cup side of the route
  if (rng.chance(budget.pipeChance) && lanes.length >= 1) {
    for (let tries = 0; tries < 24; tries++) {
      const from = pickLane();
      const to = pickLane();
      const r = 1.1;
      const entry = {
        x: from.inner.x + rng.range(r + 0.5, Math.max(r + 0.5, from.inner.w - r - 0.5)),
        y: from.inner.y + rng.range(r + 0.5, Math.max(r + 0.5, from.inner.h - r - 0.5)),
      };
      const exit = {
        x: to.inner.x + rng.range(1, Math.max(1, to.inner.w - 1)),
        y: to.inner.y + rng.range(1, Math.max(1, to.inner.h - 1)),
      };
      // Entry must be farther from the cup than the exit, and the two far apart.
      if (dist(entry, hole.cup) < dist(exit, hole.cup) + 4) continue;
      if (dist(entry, exit) < 7) continue;
      const foot = [
        { x: entry.x - r, y: entry.y - r },
        { x: entry.x + r, y: entry.y + r },
      ];
      if (!clearOf(foot, 3.5, 5)) continue;
      const exitFoot = [
        { x: exit.x - 0.8, y: exit.y - 0.8 },
        { x: exit.x + 0.8, y: exit.y + 0.8 },
      ];
      if (!clearOf(exitFoot, 2.5, 3.5)) continue;
      // Point the ball roughly toward the cup on exit.
      const ang = Math.atan2(hole.cup.y - exit.y, hole.cup.x - exit.x) + rng.range(-0.5, 0.5);
      hole.obstacles.push({
        type: 'pipe',
        shape: { kind: 'circle', x: round2(entry.x), y: round2(entry.y), r },
        exit: { x: round2(exit.x), y: round2(exit.y) },
        mode: 'redirect',
        exitAngle: round2(ang),
      });
      accept(foot);
      accept(exitFoot);
      break;
    }
  }

  // --- chamfers: triangle blockers in outside corners of rect-ish cells
  if (rng.chance(budget.chamferChance)) {
    const cell = rng.pick(sk.cells);
    if (cell.length === 4) {
      const c = polygonCentroid(cell);
      const corner = rng.pick(cell);
      const size = rng.range(2, 3.5);
      const sx = corner.x < c.x ? 1 : -1;
      const sy = corner.y < c.y ? 1 : -1;
      const tri: Polygon = [corner, { x: corner.x + sx * size, y: corner.y }, { x: corner.x, y: corner.y + sy * size }];
      if (clearOf(tri, 3, 3) && !sk.cells.some((other) => other !== cell && other.some((q) => dist(q, corner) < 1))) {
        hole.obstacles.push({ type: 'blocker', shape: { kind: 'polygon', points: roundPoly(tri) } });
        accept(tri);
      }
    }
  }
}

/**
 * Guarantee at least one real obstacle: small pieces, relaxed clearance,
 * many tries. Used at the end of decoration and by the generator's
 * undecorated fallback.
 */
export function ensureObstacle(hole: Hole, sk: Skeleton, rng: Rng, placed: Placed['bbox'][] = []): void {
  if (hole.obstacles.some((o) => o.type !== 'pipe')) return;
  const lanes = sk.decorable
    .map((cell) => ({ cell, inner: innerRect(cell, 0.25) }))
    .filter((l): l is { cell: Polygon; inner: { x: number; y: number; w: number; h: number } } => l.inner !== null && l.inner.w >= 2.5 && l.inner.h >= 2.5);
  if (lanes.length === 0) return;
  for (let tries = 0; tries < 40; tries++) {
    const lane = rng.pick(lanes);
    const kind: ObstacleKind = rng.pick(['post', 'bumper', 'diamond', 'post']);
    const made = makeObstacle(kind, lane, rng);
    if (!made) continue;
    const bb = bboxOf(made.footprint);
    if (bboxDist(bb, hole.tee) < 3 || bboxDist(bb, hole.cup) < 3) continue;
    if (placed.some((o) => overlaps(o, bb))) continue;
    hole.obstacles.push(...made.obstacles);
    placed.push(bb);
    return;
  }
}

function makeMover(lane: { cell: Polygon; inner: { x: number; y: number; w: number; h: number } }, rng: Rng, themeId?: string): Made | null {
  const r = lane.inner;
  const tall = r.h >= r.w;
  const across = tall ? r.w : r.h;
  const along = tall ? r.h : r.w;
  if (across < 6.5 || along < 5) return null;
  const t = rng.range(0.3, 0.7);
  const cx = tall ? r.x + r.w / 2 : r.x + t * r.w;
  const cy = tall ? r.y + t * r.h : r.y + r.h / 2;
  const kind = rng.pick(['windmill', 'windmill', 'windmill', 'gate', 'piston', 'pendulum', 'luggage'] as const);
  const period = rng.range(2.5, 4.5);
  const phase = rng.range(0, Math.PI * 2);
  if (kind === 'windmill') {
    const rad = Math.min(3.2, across / 2 - 1.6);
    if (rad < 1.4) return null;
    const blades = rng.pick([2, 3, 3, 4]);
    return {
      obstacles: [{ type: 'windmill', shape: { kind: 'circle', x: round2(cx), y: round2(cy), r: round2(rad) }, blades, period: round2(period), phase: round2(phase), direction: rng.sign() as 1 | -1 }],
      footprint: [
        { x: cx - rad, y: cy - rad },
        { x: cx + rad, y: cy + rad },
      ],
    };
  }
  if (kind === 'pendulum') {
    const arm = Math.min(5, across * 0.45);
    if (arm < 2.5) return null;
    // pivot at the lane's edge so the weight swings across the lane
    const px = tall ? r.x + 0.4 : cx;
    const py = tall ? cy : r.y + 0.4;
    const ang = tall ? -Math.PI / 2 : 0; // arm direction handled by the sim (hangs +y); rotate lane
    void ang;
    if (!tall) {
      return {
        obstacles: [{ type: 'pendulum', shape: { kind: 'circle', x: round2(px), y: round2(py), r: round2(arm) }, arc: round2(rng.range(0.6, 1.1)), period: round2(period), phase: round2(phase) }],
        footprint: [
          { x: px - arm, y: py },
          { x: px + arm, y: py + arm },
        ],
      };
    }
    // tall lanes: hang from the top of a short sub-rect instead
    const py2 = r.y + t * r.h - arm * 0.6;
    if (py2 < r.y + 0.5) return null;
    return {
      obstacles: [{ type: 'pendulum', shape: { kind: 'circle', x: round2(cx), y: round2(py2), r: round2(Math.min(arm, across / 2 - 1.2)) }, arc: round2(rng.range(0.7, 1.2)), period: round2(period), phase: round2(phase) }],
      footprint: [
        { x: cx - arm, y: py2 },
        { x: cx + arm, y: py2 + arm },
      ],
    };
  }
  // Sliding block across the lane. Sized so a ball (diameter 1) always fits past it:
  // gate/luggage keep >= 1.6 units on both sides, a piston keeps >= 0.55 * lane on its open side.
  const look = kind === 'luggage' || themeId === 'airport' ? 'luggage' : kind === 'piston' ? 'piston' : 'gate';
  const thick = look === 'luggage' ? 1.6 : 1.2;
  const len = look === 'piston' ? across * 0.5 : Math.max(2, across * 0.3);
  const amp = look === 'piston' ? across * 0.3 : (across - len) / 2 - 1.6;
  if (amp < 0.8) return null;
  const shape = tall
    ? { kind: 'rect' as const, x: round2(cx - len / 2), y: round2(cy - thick / 2), w: round2(len), h: thick }
    : { kind: 'rect' as const, x: round2(cx - thick / 2), y: round2(cy - len / 2), w: thick, h: round2(len) };
  const axis = tall ? 'x' : 'y';
  return {
    obstacles: [{ type: 'slidingGate', shape, axis, amplitude: round2(amp), period: round2(look === 'luggage' ? period * 1.4 : period), phase: round2(phase), look }],
    footprint: tall ? rect(r.x, cy - thick, r.w, thick * 2) : rect(cx - thick, r.y, thick * 2, r.h),
  };
}

interface Made {
  obstacles: Obstacle[];
  walls?: Hole['walls'];
  footprint: Point[];
}

function makeObstacle(kind: ObstacleKind, lane: { cell: Polygon; inner: { x: number; y: number; w: number; h: number } }, rng: Rng): Made | null {
  const r = lane.inner;
  const tall = r.h >= r.w;
  const across = tall ? r.w : r.h; // lane width
  const along = tall ? r.h : r.w;
  if (along < 4) return null;
  // A point on the lane's centreline, `t` along it, offset `o` across it.
  const at = (t: number, o = 0): Point =>
    tall ? { x: r.x + r.w / 2 + o, y: r.y + t * r.h } : { x: r.x + t * r.w, y: r.y + r.h / 2 + o };
  const t = rng.range(0.2, 0.8);
  const circ = (p: Point, rad: number, type: 'post' | 'bumper'): Obstacle => ({
    type,
    shape: { kind: 'circle', x: round2(p.x), y: round2(p.y), r: round2(rad) },
  });
  const circFoot = (p: Point, rad: number): Point[] => [
    { x: p.x - rad, y: p.y - rad },
    { x: p.x + rad, y: p.y + rad },
  ];

  switch (kind) {
    case 'post': {
      const rad = rng.range(0.6, 1.0);
      const p = at(t, rng.range(-1, 1) * (across / 2 - rad - 1.5));
      return { obstacles: [circ(p, rad, 'post')], footprint: circFoot(p, rad) };
    }
    case 'postRow': {
      if (across < 7) return null;
      const rad = 0.6;
      const n = rng.int(2, 3);
      const spacing = (across - 2) / n;
      const obs: Obstacle[] = [];
      const foot: Point[] = [];
      for (let i = 0; i < n; i++) {
        const o = -across / 2 + 1 + spacing * (i + 0.5);
        const p = at(t, o);
        obs.push(circ(p, rad, 'post'));
        foot.push(...circFoot(p, rad));
      }
      return { obstacles: obs, footprint: foot };
    }
    case 'postTriangle': {
      if (across < 8) return null;
      const rad = 0.6;
      const pts = [at(t - 0.06, 0), at(t + 0.04, -2.2), at(t + 0.04, 2.2)];
      return { obstacles: pts.map((p) => circ(p, rad, 'post')), footprint: pts.flatMap((p) => circFoot(p, rad)) };
    }
    case 'bumper': {
      const rad = rng.range(1.0, 1.5);
      const p = at(t, rng.range(-1, 1) * Math.max(0, across / 2 - rad - 2));
      return { obstacles: [circ(p, rad, 'bumper')], footprint: circFoot(p, rad) };
    }
    case 'bumperPair': {
      if (across < 9) return null;
      const rad = 1.1;
      const o = across / 2 - rad - 1.5;
      const a = at(t, -o);
      const b = at(t, o);
      return { obstacles: [circ(a, rad, 'bumper'), circ(b, rad, 'bumper')], footprint: [...circFoot(a, rad), ...circFoot(b, rad)] };
    }
    case 'bar':
    case 'deadBar': {
      if (across < 7) return null;
      const len = across * rng.range(0.35, 0.55);
      const thick = 1;
      const side = rng.sign();
      const c = at(t, side * (across / 2 - len / 2));
      const shape = tall
        ? { kind: 'rect' as const, x: round2(c.x - len / 2), y: round2(c.y - thick / 2), w: round2(len), h: thick }
        : { kind: 'rect' as const, x: round2(c.x - thick / 2), y: round2(c.y - len / 2), w: thick, h: round2(len) };
      const pts = rect(shape.x, shape.y, shape.w, shape.h);
      return { obstacles: [{ type: kind === 'bar' ? 'blocker' : 'deadWall', shape }], footprint: pts };
    }
    case 'diamond':
    case 'triangle':
    case 'hexagon': {
      if (across < 7) return null;
      const rad = rng.range(1.2, Math.min(3, across / 2 - 2.5));
      const p = at(t, rng.range(-1, 1) * (across / 2 - rad - 2));
      const sides = kind === 'diamond' ? 4 : kind === 'triangle' ? 3 : 6;
      const pts = roundPoly(regularPolygon(p.x, p.y, rad, sides, rng.range(0, Math.PI)));
      return { obstacles: [{ type: 'blocker', shape: { kind: 'polygon', points: pts } }], footprint: pts };
    }
    case 'curb': {
      const thick = 0.4;
      const c = at(t, 0);
      const shape = tall
        ? { kind: 'rect' as const, x: round2(r.x), y: round2(c.y - thick / 2), w: round2(r.w), h: thick }
        : { kind: 'rect' as const, x: round2(c.x - thick / 2), y: round2(r.y), w: thick, h: round2(r.h) };
      return { obstacles: [{ type: 'curb', shape }], footprint: rect(shape.x, shape.y, shape.w, shape.h) };
    }
    case 'gate':
    case 'offsetGate': {
      if (across < 8) return null;
      const gap = rng.range(3.2, 4.2);
      const thick = 1;
      const centre = kind === 'gate' ? 0 : rng.sign() * (across / 2 - gap / 2 - 1);
      const c = at(t, 0);
      const leftLen = across / 2 + centre - gap / 2;
      const rightLen = across / 2 - centre - gap / 2;
      const obs: Obstacle[] = [];
      const mk = (start: number, len: number) => {
        if (len < 0.8) return;
        const shape = tall
          ? { kind: 'rect' as const, x: round2(r.x + start), y: round2(c.y - thick / 2), w: round2(len), h: thick }
          : { kind: 'rect' as const, x: round2(c.x - thick / 2), y: round2(r.y + start), w: thick, h: round2(len) };
        obs.push({ type: 'blocker', shape });
      };
      mk(0, leftLen);
      mk(across - rightLen, rightLen);
      const foot = tall ? rect(r.x, c.y - 1, r.w, 2) : rect(c.x - 1, r.y, 2, r.h);
      return { obstacles: obs, footprint: foot };
    }
    case 'pillarPair': {
      if (across < 9) return null;
      const s = 1.6;
      const o = across / 2 - s - 1.2;
      const a = at(t, -o);
      const b = at(t, o);
      const mk = (p: Point): Obstacle => ({ type: 'blocker', shape: { kind: 'rect', x: round2(p.x - s / 2), y: round2(p.y - s / 2), w: s, h: s } });
      return { obstacles: [mk(a), mk(b)], footprint: [...rect(a.x - s / 2, a.y - s / 2, s, s), ...rect(b.x - s / 2, b.y - s / 2, s, s)] };
    }
  }
}
