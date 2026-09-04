/**
 * The simulation. Pure functions over a plain SimState. No imports from the
 * UI layer, no DOM, no Math.random.
 *
 * Determinism notes:
 *  - Fixed timestep FIXED_DT. Callers must never pass a variable dt.
 *  - Inside step() only +, -, *, /, comparisons and Math.sqrt are used.
 *    Math.cos/sin/pow are used once per stroke in applyStroke().
 *  - Iteration order over colliders/zones is the compiled array order,
 *    which is derived from the hole JSON order, so it is stable.
 */

import type { Hole, Point, Stroke, SurfaceType } from './types';
import type { PhysicsParams } from './params';
import { FIXED_DT, cupRadius, powerToSpeed } from './params';
import type { World, CircleCollider, SegmentCollider } from './world';
import {
  EPS,
  closestPointOnSegment,
  len,
  pointInPolygon,
  sweepCirclePoint,
  sweepCircleSegment,
} from './geometry';

export const STROKE_CAP = 8;

/** How much score a failed hole costs: par + this. */
export const MAX_OVER_PAR = 4;

export interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export type SimEvent =
  | { type: 'bounce'; x: number; y: number; nx: number; ny: number; speed: number; kind: string }
  | { type: 'lipOut'; x: number; y: number }
  | { type: 'sunk'; x: number; y: number }
  | { type: 'hazard'; x: number; y: number; hazardType: string; penalty: number }
  | { type: 'rest'; x: number; y: number }
  | { type: 'timeout'; x: number; y: number }
  | { type: 'sticky'; x: number; y: number }
  | { type: 'pipe'; x: number; y: number; exitX: number; exitY: number };

export interface SimState {
  ball: Ball;
  /** True between strokes. */
  resting: boolean;
  sunk: boolean;
  /** Hole finished: sunk, or stroke cap reached. */
  done: boolean;
  strokes: number;
  penalties: number;
  /** Ball position before the current/most recent stroke. */
  lastSafe: Point;
  /** Seconds simulated in the current stroke. */
  strokeTime: number;
  /** Seconds simulated in total. */
  totalTime: number;
  /** Accumulated seconds below rest threshold (used on slopes). */
  lowSpeedTime: number;
  /** Seconds during which the cup is ignored (after a lip-out). */
  cupCooldown: number;
  /** Seconds during which pipes are ignored (after coming out of one). */
  pipeCooldown: number;
  /** mulberry32 state. */
  rng: number;
  /** Strokes taken so far, for replay. */
  strokeHistory: Stroke[];
  /** Events emitted during the most recent step. Cleared every step. */
  events: SimEvent[];
  /** Surface type under the ball after the last step. */
  surface: SurfaceType;
}

export function createSimState(hole: Hole, seed: number): SimState {
  return {
    ball: { x: hole.tee.x, y: hole.tee.y, vx: 0, vy: 0 },
    resting: true,
    sunk: false,
    done: false,
    strokes: 0,
    penalties: 0,
    lastSafe: { x: hole.tee.x, y: hole.tee.y },
    strokeTime: 0,
    totalTime: 0,
    lowSpeedTime: 0,
    cupCooldown: 0,
    pipeCooldown: 0,
    rng: seed >>> 0,
    strokeHistory: [],
    events: [],
    surface: 'felt',
  };
}

export function cloneState(s: SimState): SimState {
  return JSON.parse(JSON.stringify(s)) as SimState;
}

export function totalStrokes(s: SimState): number {
  return s.strokes + s.penalties;
}

/** Score for the hole. Failing to sink within the cap scores par + MAX_OVER_PAR. */
export function holeScore(s: SimState, par: number): number {
  const cap = par + MAX_OVER_PAR;
  if (!s.sunk) return cap;
  const n = totalStrokes(s);
  return n < cap ? n : cap;
}

export function ballSpeed(b: Ball): number {
  return len(b.vx, b.vy);
}

/**
 * Launch the ball. Returns false if the stroke was rejected (ball still
 * moving, or hole already finished).
 */
export function applyStroke(state: SimState, params: PhysicsParams, stroke: Stroke): boolean {
  if (state.done || !state.resting) return false;
  const speed = powerToSpeed(stroke.power, params);
  if (speed <= 0) return false;
  state.ball.vx = Math.cos(stroke.angle) * speed;
  state.ball.vy = Math.sin(stroke.angle) * speed;
  state.lastSafe = { x: state.ball.x, y: state.ball.y };
  state.strokes += 1;
  state.strokeTime = 0;
  state.lowSpeedTime = 0;
  state.cupCooldown = 0;
  state.pipeCooldown = 0;
  state.resting = false;
  state.strokeHistory.push({ angle: stroke.angle, power: stroke.power });
  state.events = [];
  return true;
}

// ---------------------------------------------------------------------------
// Zones

function surfaceFriction(type: SurfaceType, p: PhysicsParams): number {
  switch (type) {
    case 'tile':
      return p.frictionTile;
    case 'shag':
      return p.frictionShag;
    case 'wet':
      return p.frictionWet;
    case 'sand':
      return p.frictionSand;
    case 'sticky':
      return 0; // handled separately (instant stop)
    default:
      return 1;
  }
}

function inAABB(x: number, y: number, a: { minX: number; minY: number; maxX: number; maxY: number }): boolean {
  return x >= a.minX && x <= a.maxX && y >= a.minY && y <= a.maxY;
}

/** Last matching zone wins, so later zones in the JSON override earlier ones. */
function surfaceAt(world: World, x: number, y: number): SurfaceType {
  let s: SurfaceType = 'felt';
  for (const z of world.surfaceZones) {
    if (inAABB(x, y, z.aabb) && pointInPolygon(x, y, z.polygon)) s = z.surfaceType;
  }
  return s;
}

/** Slopes stack: overlapping slope zones add their pulls. */
function slopeAt(world: World, x: number, y: number, p: PhysicsParams): Point {
  let ax = 0;
  let ay = 0;
  for (const z of world.slopeZones) {
    if (inAABB(x, y, z.aabb) && pointInPolygon(x, y, z.polygon)) {
      const a = z.grade * p.slopeAccelPerGrade;
      ax += z.dx * a;
      ay += z.dy * a;
    }
  }
  return { x: ax, y: ay };
}

// ---------------------------------------------------------------------------
// Collision

const MAX_COLLISION_ITERS = 12;
/** Hits within this many seconds of the earliest are treated as simultaneous. */
const TOI_GROUP_EPS = 1e-7;
/** Push-out after contact so the ball never rests exactly on a face. */
const SKIN = 1e-4;
/** Normal speeds below this don't bounce, they just stop (kills jitter). */
const MIN_BOUNCE_SPEED = 0.75;

function restitutionOf(c: SegmentCollider | CircleCollider, p: PhysicsParams): number {
  if (c.restitution !== null) return c.restitution;
  if (c.kind === 'bumper') return p.bumperRestitution;
  if (c.kind === 'deadWall') return p.deadWallRestitution;
  return p.wallRestitution;
}

/** Curbs are skipped entirely while the ball is fast enough to jump them. */
function skipCollider(c: SegmentCollider | CircleCollider, speed: number, p: PhysicsParams): boolean {
  if (c.kind !== 'curb') return false;
  return speed > (c.jumpSpeed ?? p.curbJumpSpeed);
}

interface HitAcc {
  nx: number;
  ny: number;
  e: number;
  kind: string;
}

/**
 * Moves the ball for `dt` seconds with continuous collision detection.
 * Appends every position the ball visited to `path` (flat x,y pairs),
 * starting with the position before the move, so callers can test the
 * whole swept route against the cup and hazards.
 */
function integrate(state: SimState, world: World, p: PhysicsParams, dt: number, path: number[]): void {
  const b = state.ball;
  const r = p.ballRadius;
  let remaining = dt;
  path.push(b.x, b.y);

  const hits: HitAcc[] = [];

  for (let iter = 0; iter < MAX_COLLISION_ITERS && remaining > 1e-9; iter++) {
    if (b.vx * b.vx + b.vy * b.vy < EPS) break;

    let tMin = Infinity;
    hits.length = 0;
    const speedNow = len(b.vx, b.vy);

    // Broadphase: swept AABB of the ball for this sub-move, padded by the skin.
    const ex = b.x + b.vx * remaining;
    const ey = b.y + b.vy * remaining;
    const pad = r + SKIN * 2;
    const sMinX = (b.x < ex ? b.x : ex) - pad;
    const sMaxX = (b.x > ex ? b.x : ex) + pad;
    const sMinY = (b.y < ey ? b.y : ey) - pad;
    const sMaxY = (b.y > ey ? b.y : ey) + pad;

    for (const s of world.segments) {
      if (s.maxX < sMinX || s.minX > sMaxX || s.maxY < sMinY || s.minY > sMaxY) continue;
      if (skipCollider(s, speedNow, p)) continue;
      const h = sweepCircleSegment(b.x, b.y, b.vx, b.vy, r, s.ax, s.ay, s.bx, s.by, remaining);
      if (!h) continue;
      if (h.t < tMin - TOI_GROUP_EPS) {
        tMin = h.t;
        hits.length = 0;
        hits.push({ nx: h.nx, ny: h.ny, e: restitutionOf(s, p), kind: s.kind });
      } else if (h.t <= tMin + TOI_GROUP_EPS) {
        hits.push({ nx: h.nx, ny: h.ny, e: restitutionOf(s, p), kind: s.kind });
      }
    }
    for (const c of world.circles) {
      if (c.maxX < sMinX || c.minX > sMaxX || c.maxY < sMinY || c.minY > sMaxY) continue;
      if (skipCollider(c, speedNow, p)) continue;
      const h = sweepCirclePoint(b.x, b.y, b.vx, b.vy, r + c.r, c.x, c.y, remaining);
      if (!h) continue;
      if (h.t < tMin - TOI_GROUP_EPS) {
        tMin = h.t;
        hits.length = 0;
        hits.push({ nx: h.nx, ny: h.ny, e: restitutionOf(c, p), kind: c.kind });
      } else if (h.t <= tMin + TOI_GROUP_EPS) {
        hits.push({ nx: h.nx, ny: h.ny, e: restitutionOf(c, p), kind: c.kind });
      }
    }

    if (tMin === Infinity) {
      b.x += b.vx * remaining;
      b.y += b.vy * remaining;
      path.push(b.x, b.y);
      remaining = 0;
      break;
    }

    // Advance to the contact.
    b.x += b.vx * tMin;
    b.y += b.vy * tMin;
    remaining -= tMin;

    // Combine simultaneous normals (shared vertices, concave corners).
    let nx = 0;
    let ny = 0;
    let e = 0;
    let kind = hits[0].kind;
    for (const h of hits) {
      nx += h.nx;
      ny += h.ny;
      if (h.e > e) {
        e = h.e;
        kind = h.kind;
      }
    }
    const nl = len(nx, ny);
    if (nl < EPS) {
      nx = hits[0].nx;
      ny = hits[0].ny;
    } else {
      nx /= nl;
      ny /= nl;
    }

    const vn = b.vx * nx + b.vy * ny;
    if (vn < 0) {
      const speedBefore = len(b.vx, b.vy);
      if (-vn < MIN_BOUNCE_SPEED) {
        // Too slow to bounce: remove the normal component (slide).
        b.vx -= vn * nx;
        b.vy -= vn * ny;
      } else {
        b.vx -= (1 + e) * vn * nx;
        b.vy -= (1 + e) * vn * ny;
        state.events.push({ type: 'bounce', x: b.x, y: b.y, nx, ny, speed: speedBefore, kind });
      }
    }

    b.x += nx * SKIN;
    b.y += ny * SKIN;
    path.push(b.x, b.y);
  }

  resolveOverlaps(b, world, r, p);
}

/** Static push-out for any residual penetration (belt and braces). */
function resolveOverlaps(b: Ball, world: World, r: number, p: PhysicsParams): void {
  const speed = len(b.vx, b.vy);
  for (let pass = 0; pass < 2; pass++) {
    const bMinX = b.x - r;
    const bMaxX = b.x + r;
    const bMinY = b.y - r;
    const bMaxY = b.y + r;
    for (const s of world.segments) {
      if (s.maxX < bMinX || s.minX > bMaxX || s.maxY < bMinY || s.minY > bMaxY) continue;
      if (skipCollider(s, speed, p)) continue;
      const c = closestPointOnSegment(b.x, b.y, s.ax, s.ay, s.bx, s.by);
      let dx = b.x - c.x;
      let dy = b.y - c.y;
      const d = len(dx, dy);
      if (d >= r - 1e-6) continue;
      if (d < EPS) {
        // Centre exactly on the segment: use the left normal.
        const sx = s.bx - s.ax;
        const sy = s.by - s.ay;
        const sl = len(sx, sy);
        if (sl < EPS) continue;
        dx = -sy / sl;
        dy = sx / sl;
      } else {
        dx /= d;
        dy /= d;
      }
      const push = r - d + SKIN;
      b.x += dx * push;
      b.y += dy * push;
    }
    for (const c of world.circles) {
      if (c.maxX < bMinX || c.minX > bMaxX || c.maxY < bMinY || c.minY > bMaxY) continue;
      if (skipCollider(c, speed, p)) continue;
      let dx = b.x - c.x;
      let dy = b.y - c.y;
      const d = len(dx, dy);
      const min = r + c.r;
      if (d >= min - 1e-6) continue;
      if (d < EPS) {
        dx = 1;
        dy = 0;
      } else {
        dx /= d;
        dy /= d;
      }
      const push = min - d + SKIN;
      b.x += dx * push;
      b.y += dy * push;
    }
  }
}

// ---------------------------------------------------------------------------
// Pipes: entering the entry circle carries the ball to the exit.

function checkPipes(state: SimState, world: World, path: number[]): void {
  if (world.pipes.length === 0 || state.pipeCooldown > 0) return;
  const b = state.ball;
  for (const pipe of world.pipes) {
    const dx = b.x - pipe.x;
    const dy = b.y - pipe.y;
    if (dx * dx + dy * dy > pipe.r * pipe.r) continue;
    const speed = len(b.vx, b.vy);
    if (speed < EPS) continue;
    state.events.push({ type: 'pipe', x: b.x, y: b.y, exitX: pipe.exitX, exitY: pipe.exitY });
    b.x = pipe.exitX;
    b.y = pipe.exitY;
    if (pipe.mode === 'redirect') {
      b.vx = pipe.dx * speed;
      b.vy = pipe.dy * speed;
    }
    state.pipeCooldown = 0.5;
    state.cupCooldown = 0;
    // The swept path restarts at the exit so the cup/hazard checks don't span the jump.
    path.length = 0;
    path.push(b.x, b.y);
    return;
  }
}

// ---------------------------------------------------------------------------
// Cup + hazards, tested against the swept path.

function checkCup(state: SimState, world: World, p: PhysicsParams, path: number[]): void {
  if (state.cupCooldown > 0) return;
  const cup = world.hole.cup;
  const cr = cupRadius(p);
  const b = state.ball;

  for (let i = 0; i + 3 < path.length; i += 2) {
    const ax = path[i];
    const ay = path[i + 1];
    const bx = path[i + 2];
    const by = path[i + 3];
    const c = closestPointOnSegment(cup.x, cup.y, ax, ay, bx, by);
    const dx = c.x - cup.x;
    const dy = c.y - cup.y;
    const d = len(dx, dy);
    if (d >= cr) continue;

    const speed = len(b.vx, b.vy);
    if (speed <= p.cupCaptureSpeed) {
      b.x = cup.x;
      b.y = cup.y;
      b.vx = 0;
      b.vy = 0;
      state.sunk = true;
      state.done = true;
      state.resting = true;
      state.events.push({ type: 'sunk', x: cup.x, y: cup.y });
      return;
    }

    // Lip out: ride the rim. Bend the velocity away from the cup centre in
    // proportion to how far off-centre the pass was, and bleed some speed.
    const off = d / cr; // 0 = dead centre, 1 = grazing
    let rx = 0;
    let ry = 0;
    if (d > EPS) {
      rx = dx / d;
      ry = dy / d;
    }
    const kick = p.lipOutDeflect * off;
    const ux = b.vx / speed + rx * kick;
    const uy = b.vy / speed + ry * kick;
    const ul = len(ux, uy);
    const newSpeed = speed * p.lipOutSpeedKeep;
    if (ul > EPS) {
      b.vx = (ux / ul) * newSpeed;
      b.vy = (uy / ul) * newSpeed;
    }
    state.cupCooldown = 0.25;
    state.events.push({ type: 'lipOut', x: c.x, y: c.y });
    return;
  }
}

function checkHazards(state: SimState, world: World, p: PhysicsParams, path: number[]): void {
  if (world.hazards.length === 0) return;
  const b = state.ball;
  const stepLen = p.ballRadius * 0.5;
  let lastOutsideX = state.lastSafe.x;
  let lastOutsideY = state.lastSafe.y;

  for (let i = 0; i + 3 < path.length; i += 2) {
    const ax = path[i];
    const ay = path[i + 1];
    const bx = path[i + 2];
    const by = path[i + 3];
    const segLen = len(bx - ax, by - ay);
    const n = segLen > stepLen ? Math.ceil(segLen / stepLen) : 1;
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      const x = ax + (bx - ax) * t;
      const y = ay + (by - ay) * t;
      for (const h of world.hazards) {
        if (!inAABB(x, y, h.aabb) || !pointInPolygon(x, y, h.polygon)) continue;
        const src = h.source;
        state.penalties += src.penalty;
        let rx: number;
        let ry: number;
        if (src.resetTo === 'tee') {
          rx = world.hole.tee.x;
          ry = world.hole.tee.y;
        } else if (src.resetTo === 'entry') {
          rx = lastOutsideX;
          ry = lastOutsideY;
        } else {
          rx = state.lastSafe.x;
          ry = state.lastSafe.y;
        }
        state.events.push({ type: 'hazard', x, y, hazardType: src.type, penalty: src.penalty });
        b.x = rx;
        b.y = ry;
        b.vx = 0;
        b.vy = 0;
        state.cupCooldown = 0;
        settle(state, world, 'rest');
        return;
      }
      lastOutsideX = x;
      lastOutsideY = y;
    }
  }
}

// ---------------------------------------------------------------------------

function settle(state: SimState, world: World, why: 'rest' | 'timeout' | 'sticky'): void {
  const b = state.ball;
  b.vx = 0;
  b.vy = 0;
  state.resting = true;
  state.lowSpeedTime = 0;
  state.events.push({ type: why, x: b.x, y: b.y });
  if (!state.sunk && totalStrokes(state) >= STROKE_CAP) state.done = true;
  // Ball outside the bounds rectangle after everything: treat as OOB, put it back.
  const bounds = world.hole.bounds;
  if (b.x < bounds.x || b.y < bounds.y || b.x > bounds.x + bounds.w || b.y > bounds.y + bounds.h) {
    b.x = state.lastSafe.x;
    b.y = state.lastSafe.y;
  }
}

/**
 * Advance the simulation by exactly one fixed step. Safe to call while
 * resting (no-op apart from clearing events).
 */
export function step(state: SimState, world: World, p: PhysicsParams): void {
  state.events = [];
  if (state.resting || state.done) return;

  const dt = FIXED_DT;
  const b = state.ball;

  // 1. Zones under the ball centre.
  const surface = surfaceAt(world, b.x, b.y);
  const prevSurface = state.surface;
  state.surface = surface;
  // Sticky stops the ball on entry only, so a ball resting on sticky can still be shot out of it.
  if (surface === 'sticky' && prevSurface !== 'sticky') {
    settle(state, world, 'sticky');
    return;
  }
  const slope = slopeAt(world, b.x, b.y, p);
  const onSlope = slope.x !== 0 || slope.y !== 0;

  // 2. Slope pull.
  b.vx += slope.x * dt;
  b.vy += slope.y * dt;

  // 3. Friction (velocity damping). First-order so only IEEE basic ops are used.
  let damp = 1 - p.baseFriction * surfaceFriction(surface, p) * dt;
  if (damp < 0) damp = 0;
  b.vx *= damp;
  b.vy *= damp;

  // 4. Move with CCD.
  const path: number[] = [];
  integrate(state, world, p, dt, path);

  state.strokeTime += dt;
  state.totalTime += dt;
  if (state.cupCooldown > 0) {
    state.cupCooldown -= dt;
    if (state.cupCooldown < 0) state.cupCooldown = 0;
  }
  if (state.pipeCooldown > 0) {
    state.pipeCooldown -= dt;
    if (state.pipeCooldown < 0) state.pipeCooldown = 0;
  }
  checkPipes(state, world, path);

  // 5. Cup, then hazards (a sunk ball can't also drain).
  checkCup(state, world, p, path);
  if (state.sunk) return;
  checkHazards(state, world, p, path);
  if (state.resting) return;

  // 6. Rest detection.
  const speed = len(b.vx, b.vy);
  if (speed < p.restThreshold) {
    state.lowSpeedTime += dt;
    if (!onSlope || state.lowSpeedTime >= 0.5) {
      settle(state, world, 'rest');
      return;
    }
  } else {
    state.lowSpeedTime = 0;
  }

  // 7. Hard stop.
  if (state.strokeTime >= p.maxSimTime) {
    settle(state, world, 'timeout');
  }
}

/** Run steps until the ball rests (or the hole ends). Returns the number of steps taken. */
export function runUntilRest(state: SimState, world: World, p: PhysicsParams, maxSteps = 1_000_000): number {
  let n = 0;
  while (!state.resting && !state.done && n < maxSteps) {
    step(state, world, p);
    n++;
  }
  return n;
}
