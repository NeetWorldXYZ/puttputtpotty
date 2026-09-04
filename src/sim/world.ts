/**
 * Compiles a Hole (data) into a World (flat collider lists) that the step
 * function can iterate cheaply. The world is immutable after compile.
 */

import type { Hole, Polygon, SurfaceType, Hazard, SlopeZone } from './types';
import { polygonBounds, compassVector } from './geometry';

export type ColliderKind = 'wall' | 'bounds' | 'blocker' | 'bumper';

export interface SegmentCollider {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  kind: ColliderKind;
  /** Per-collider override; null means "use the global for this kind". */
  restitution: number | null;
}

export interface CircleCollider {
  x: number;
  y: number;
  r: number;
  kind: ColliderKind;
  restitution: number | null;
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
): SegmentCollider[] {
  return [
    { ax: x, ay: y, bx: x + w, by: y, kind, restitution },
    { ax: x + w, ay: y, bx: x + w, by: y + h, kind, restitution },
    { ax: x + w, ay: y + h, bx: x, by: y + h, kind, restitution },
    { ax: x, ay: y + h, bx: x, by: y, kind, restitution },
  ];
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
    });
  }

  for (const o of hole.obstacles) {
    if (o.type === 'blocker') {
      const s = o.shape;
      if (s.kind === 'rect') {
        segments.push(...rectSegments(s.x, s.y, s.w, s.h, 'blocker', o.restitution ?? null));
      } else {
        circles.push({ x: s.x, y: s.y, r: s.r, kind: 'blocker', restitution: o.restitution ?? null });
      }
    } else if (o.type === 'bumper') {
      const s = o.shape;
      circles.push({ x: s.x, y: s.y, r: s.r, kind: 'bumper', restitution: o.restitution ?? null });
    }
    // Other obstacle types are reserved for later phases and ignored here.
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
