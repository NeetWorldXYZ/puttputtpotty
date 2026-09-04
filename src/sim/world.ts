/**
 * Compiles a Hole (data) into a World (flat collider lists) that the step
 * function can iterate cheaply. The world is immutable after compile.
 */

import type { Hole, Polygon, SurfaceType, Hazard, SlopeZone, ObstacleShape, MovingObstacle } from './types';
import { isMoving } from './types';
import { polygonBounds, compassVector } from './geometry';

export type ColliderKind = 'wall' | 'bounds' | 'blocker' | 'bumper' | 'post' | 'deadWall' | 'curb';

export interface SegmentCollider {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  kind: ColliderKind;
  /** Per-collider override; null means "use the global for this kind". */
  restitution: number | null;
  /** Curbs only: speed above which the ball passes over. null = global. */
  jumpSpeed: number | null;
  /** Bounding box, for broadphase culling. */
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface CircleCollider {
  x: number;
  y: number;
  r: number;
  kind: ColliderKind;
  restitution: number | null;
  jumpSpeed: number | null;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface ZoneAABB {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface CompiledSurfaceZone {
  polygon: Polygon;
  aabb: ZoneAABB;
  surfaceType: SurfaceType;
}

export interface CompiledSlopeZone {
  polygon: Polygon;
  aabb: ZoneAABB;
  /** Unit direction vector (y-down). */
  dx: number;
  dy: number;
  grade: number;
  source: SlopeZone;
}

export interface CompiledHazard {
  polygon: Polygon;
  aabb: ZoneAABB;
  source: Hazard;
}

export interface Pipe {
  x: number;
  y: number;
  r: number;
  exitX: number;
  exitY: number;
  mode: 'keep' | 'redirect';
  /** Unit exit direction for redirect pipes. */
  dx: number;
  dy: number;
}

/** A collider that moves: static geometry for a given clock value plus its surface motion. */
export interface DynamicSegment extends SegmentCollider {
  /** Translational velocity. */
  vx: number;
  vy: number;
  /** Angular velocity (rad/s) about (cx, cy). */
  omega: number;
  cx: number;
  cy: number;
}

export interface DynamicCircle extends CircleCollider {
  vx: number;
  vy: number;
  omega: number;
  cx: number;
  cy: number;
}

export interface DynamicColliders {
  segments: DynamicSegment[];
  circles: DynamicCircle[];
}

export interface World {
  hole: Hole;
  segments: SegmentCollider[];
  circles: CircleCollider[];
  pipes: Pipe[];
  moving: MovingObstacle[];
  /** Longest period among moving obstacles (0 if none). */
  maxPeriod: number;
  surfaceZones: CompiledSurfaceZone[];
  slopeZones: CompiledSlopeZone[];
  hazards: CompiledHazard[];
}

function seg(ax: number, ay: number, bx: number, by: number, kind: ColliderKind, restitution: number | null, jumpSpeed: number | null): SegmentCollider {
  return {
    ax,
    ay,
    bx,
    by,
    kind,
    restitution,
    jumpSpeed,
    minX: Math.min(ax, bx),
    minY: Math.min(ay, by),
    maxX: Math.max(ax, bx),
    maxY: Math.max(ay, by),
  };
}

function circ(x: number, y: number, r: number, kind: ColliderKind, restitution: number | null, jumpSpeed: number | null): CircleCollider {
  return { x, y, r, kind, restitution, jumpSpeed, minX: x - r, minY: y - r, maxX: x + r, maxY: y + r };
}

function rectSegments(
  x: number,
  y: number,
  w: number,
  h: number,
  kind: ColliderKind,
  restitution: number | null,
  jumpSpeed: number | null = null,
): SegmentCollider[] {
  return [
    seg(x, y, x + w, y, kind, restitution, jumpSpeed),
    seg(x + w, y, x + w, y + h, kind, restitution, jumpSpeed),
    seg(x + w, y + h, x, y + h, kind, restitution, jumpSpeed),
    seg(x, y + h, x, y, kind, restitution, jumpSpeed),
  ];
}

function polygonSegments(pts: Polygon, kind: ColliderKind, restitution: number | null, jumpSpeed: number | null = null): SegmentCollider[] {
  const out: SegmentCollider[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    out.push(seg(a.x, a.y, b.x, b.y, kind, restitution, jumpSpeed));
  }
  return out;
}

function addShape(
  segments: SegmentCollider[],
  circles: CircleCollider[],
  shape: ObstacleShape,
  kind: ColliderKind,
  restitution: number | null,
  jumpSpeed: number | null = null,
): void {
  if (shape.kind === 'rect') segments.push(...rectSegments(shape.x, shape.y, shape.w, shape.h, kind, restitution, jumpSpeed));
  else if (shape.kind === 'circle') circles.push(circ(shape.x, shape.y, shape.r, kind, restitution, jumpSpeed));
  else if (shape.points.length >= 2) segments.push(...polygonSegments(shape.points, kind, restitution, jumpSpeed));
}

export function compileHole(hole: Hole): World {
  const segments: SegmentCollider[] = [];
  const circles: CircleCollider[] = [];
  const pipes: Pipe[] = [];
  const moving: MovingObstacle[] = [];

  // Bounds act as a safety wall so the ball can never leave the playfield.
  const b = hole.bounds;
  segments.push(...rectSegments(b.x, b.y, b.w, b.h, 'bounds', null));

  for (const w of hole.walls) {
    segments.push(seg(w.a.x, w.a.y, w.b.x, w.b.y, 'wall', w.restitution ?? null, null));
  }

  for (const o of hole.obstacles) {
    switch (o.type) {
      case 'blocker':
        addShape(segments, circles, o.shape, 'blocker', o.restitution ?? null);
        break;
      case 'bumper':
        addShape(segments, circles, o.shape, 'bumper', o.restitution ?? null);
        break;
      case 'post':
        addShape(segments, circles, o.shape, 'post', o.restitution ?? null);
        break;
      case 'deadWall':
        addShape(segments, circles, o.shape, 'deadWall', o.restitution ?? null);
        break;
      case 'curb':
        addShape(segments, circles, o.shape, 'curb', null, o.jumpSpeed ?? null);
        break;
      case 'pipe': {
        const a = o.exitAngle ?? 0;
        pipes.push({
          x: o.shape.x,
          y: o.shape.y,
          r: o.shape.r,
          exitX: o.exit.x,
          exitY: o.exit.y,
          mode: o.mode,
          dx: Math.cos(a),
          dy: Math.sin(a),
        });
        break;
      }
      case 'windmill':
      case 'slidingGate':
      case 'pendulum':
        if (isMoving(o)) moving.push(o);
        break;
      default:
        // Reserved for later phases; ignored by the simulation.
        break;
    }
  }
  const maxPeriod = moving.reduce((m, o) => Math.max(m, o.period), 0);

  const surfaceZones: CompiledSurfaceZone[] = hole.surfaceZones.map((z) => ({
    polygon: z.polygon,
    aabb: polygonBounds(z.polygon),
    surfaceType: z.surfaceType,
  }));

  const slopeZones: CompiledSlopeZone[] = hole.slopeZones.map((z) => {
    const v = compassVector(z.direction);
    return {
      polygon: z.polygon,
      aabb: polygonBounds(z.polygon),
      dx: v.x,
      dy: v.y,
      grade: z.grade,
      source: z,
    };
  });

  const hazards: CompiledHazard[] = hole.hazards.map((h) => ({
    polygon: h.polygon,
    aabb: polygonBounds(h.polygon),
    source: h,
  }));

  return { hole, segments, circles, pipes, moving, maxPeriod, surfaceZones, slopeZones, hazards };
}

// ---------------------------------------------------------------------------
// Moving obstacles: geometry at a clock value. Only +,-,*,/ and sin/cos of
// the clock are used; sin/cos are evaluated once per obstacle per step.

const TWO_PI = 6.283185307179586;

function dynSeg(ax: number, ay: number, bx: number, by: number, kind: ColliderKind, restitution: number | null, vx: number, vy: number, omega: number, cx: number, cy: number): DynamicSegment {
  return { ...seg(ax, ay, bx, by, kind, restitution, null), vx, vy, omega, cx, cy };
}

/** Rotated rect (centre, half extents, angle) as four dynamic segments. */
function rotRectSegments(out: DynamicSegment[], cx: number, cy: number, hl: number, hw: number, ang: number, ox: number, kind: ColliderKind, restitution: number | null, vx: number, vy: number, omega: number, pcx: number, pcy: number): void {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  // local corners: along +-hl, across +-hw, offset so the rect starts at (ox,oy) along its axis
  const pts = [
    [ox, -hw],
    [ox + hl * 2, -hw],
    [ox + hl * 2, hw],
    [ox, hw],
  ].map(([lx, ly]) => [cx + lx * c - ly * s, cy + lx * s + ly * c]);
  for (let i = 0; i < 4; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % 4];
    out.push(dynSeg(a[0], a[1], b[0], b[1], kind, restitution, vx, vy, omega, pcx, pcy));
  }
}

export function movingColliders(world: World, clock: number): DynamicColliders {
  const segments: DynamicSegment[] = [];
  const circles: DynamicCircle[] = [];
  for (const o of world.moving) {
    const rest = o.restitution ?? null;
    if (o.type === 'windmill') {
      const w = (o.direction * TWO_PI) / o.period;
      const ang = o.phase + w * clock;
      const bw = (o.bladeWidth ?? 0.7) / 2;
      const s = o.shape;
      for (let k = 0; k < o.blades; k++) {
        const a = ang + (k * TWO_PI) / o.blades;
        rotRectSegments(segments, s.x, s.y, s.r / 2, bw, a, 0, 'blocker', rest, 0, 0, w, s.x, s.y);
      }
      circles.push({ x: s.x, y: s.y, r: Math.max(0.4, bw * 1.3), kind: 'blocker', restitution: rest, jumpSpeed: null, minX: s.x - 1, minY: s.y - 1, maxX: s.x + 1, maxY: s.y + 1, vx: 0, vy: 0, omega: w, cx: s.x, cy: s.y });
    } else if (o.type === 'slidingGate') {
      const s = o.shape;
      let off: number;
      let vel: number;
      if (o.look === 'luggage') {
        // steady ping-pong (triangle wave)
        const u = (((clock / o.period + o.phase / TWO_PI) % 1) + 1) % 1;
        const tri = u < 0.5 ? u * 4 - 1 : 3 - u * 4;
        off = o.amplitude * tri;
        vel = ((u < 0.5 ? 4 : -4) * o.amplitude) / o.period;
      } else {
        const th = (TWO_PI * clock) / o.period + o.phase;
        off = o.amplitude * Math.sin(th);
        vel = ((o.amplitude * TWO_PI) / o.period) * Math.cos(th);
      }
      const dx = o.axis === 'x' ? off : 0;
      const dy = o.axis === 'y' ? off : 0;
      const vx = o.axis === 'x' ? vel : 0;
      const vy = o.axis === 'y' ? vel : 0;
      const x = s.x + dx;
      const y = s.y + dy;
      segments.push(dynSeg(x, y, x + s.w, y, 'blocker', rest, vx, vy, 0, 0, 0));
      segments.push(dynSeg(x + s.w, y, x + s.w, y + s.h, 'blocker', rest, vx, vy, 0, 0, 0));
      segments.push(dynSeg(x + s.w, y + s.h, x, y + s.h, 'blocker', rest, vx, vy, 0, 0, 0));
      segments.push(dynSeg(x, y + s.h, x, y, 'blocker', rest, vx, vy, 0, 0, 0));
    } else {
      const s = o.shape;
      const th = (TWO_PI * clock) / o.period + o.phase;
      const theta = o.arc * Math.sin(th);
      const omega = ((o.arc * TWO_PI) / o.period) * Math.cos(th);
      // arm hangs toward +y at theta = 0
      const ang = Math.PI / 2 + theta;
      rotRectSegments(segments, s.x, s.y, s.r / 2, 0.22, ang, 0, 'blocker', rest, 0, 0, omega, s.x, s.y);
      const bx = s.x + Math.cos(ang) * s.r;
      const by = s.y + Math.sin(ang) * s.r;
      const br = o.bobRadius ?? 0.9;
      circles.push({ x: bx, y: by, r: br, kind: 'blocker', restitution: rest, jumpSpeed: null, minX: bx - br, minY: by - br, maxX: bx + br, maxY: by + br, vx: 0, vy: 0, omega, cx: s.x, cy: s.y });
    }
  }
  return { segments, circles };
}

/** Surface velocity of a dynamic collider at a point. */
export function surfaceVelocity(c: { vx: number; vy: number; omega: number; cx: number; cy: number }, px: number, py: number): { x: number; y: number } {
  return { x: c.vx - c.omega * (py - c.cy), y: c.vy + c.omega * (px - c.cx) };
}
