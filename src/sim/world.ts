/**
 * Compiles a Hole (data) into a World (flat collider lists) that the step
 * function can iterate cheaply. The world is immutable after compile.
 */

import type { Hole, Polygon, SurfaceType, Hazard, SlopeZone, ObstacleShape } from './types';
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

export interface World {
  hole: Hole;
  segments: SegmentCollider[];
  circles: CircleCollider[];
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
      default:
        // Reserved for later phases; ignored by the simulation.
        break;
    }
  }

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

  return { hole, segments, circles, surfaceZones, slopeZones, hazards };
}
