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
}

export interface CircleCollider {
  x: number;
  y: number;
  r: number;
  kind: ColliderKind;
  restitution: number | null;
  jumpSpeed: number | null;
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
    { ax: x, ay: y, bx: x + w, by: y, kind, restitution, jumpSpeed },
    { ax: x + w, ay: y, bx: x + w, by: y + h, kind, restitution, jumpSpeed },
    { ax: x + w, ay: y + h, bx: x, by: y + h, kind, restitution, jumpSpeed },
    { ax: x, ay: y + h, bx: x, by: y, kind, restitution, jumpSpeed },
  ];
}

function polygonSegments(pts: Polygon, kind: ColliderKind, restitution: number | null, jumpSpeed: number | null = null): SegmentCollider[] {
  const out: SegmentCollider[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    out.push({ ax: a.x, ay: a.y, bx: b.x, by: b.y, kind, restitution, jumpSpeed });
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
  else if (shape.kind === 'circle') circles.push({ x: shape.x, y: shape.y, r: shape.r, kind, restitution, jumpSpeed });
  else if (shape.points.length >= 2) segments.push(...polygonSegments(shape.points, kind, restitution, jumpSpeed));
}

export function compileHole(hole: Hole): World {
  const segments: SegmentCollider[] = [];
  const circles: CircleCollider[] = [];

  // Bounds act as a safety wall so the ball can never leave the playfield.
  const b = hole.bounds;
  segments.push(...rectSegments(b.x, b.y, b.w, b.h, 'bounds', null));

  for (const w of hole.walls) {
    segments.push({
      ax: w.a.x,
      ay: w.a.y,
      bx: w.b.x,
      by: w.b.y,
      kind: 'wall',
      restitution: w.restitution ?? null,
      jumpSpeed: null,
    });
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
