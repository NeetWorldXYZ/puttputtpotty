/**
 * Runtime validation of a Hole object (e.g. from an imported JSON file).
 * Mirrors schema/hole.schema.json. Returns a list of human readable errors;
 * empty means valid.
 */

import {
  COMPASS_DIRECTIONS,
  HAZARD_RESETS,
  HAZARD_TYPES,
  SURFACE_TYPES,
  type Hole,
} from './types';

function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function isPoint(v: unknown): boolean {
  return !!v && typeof v === 'object' && isNum((v as { x: unknown }).x) && isNum((v as { y: unknown }).y);
}

function checkPolygon(v: unknown, where: string, errors: string[]): void {
  if (!Array.isArray(v) || v.length < 3) {
    errors.push(`${where}: polygon needs at least 3 points`);
    return;
  }
  v.forEach((pt, i) => {
    if (!isPoint(pt)) errors.push(`${where}[${i}]: not a point`);
  });
}

export function validateHole(input: unknown): { ok: boolean; errors: string[]; hole?: Hole } {
  const errors: string[] = [];
  if (!input || typeof input !== 'object') return { ok: false, errors: ['not an object'] };
  const h = input as Record<string, unknown>;

  if (h.version !== 1) errors.push('version must be 1');
  if (typeof h.id !== 'string' || !h.id) errors.push('id must be a non-empty string');
  if (typeof h.name !== 'string') errors.push('name must be a string');
  if (!isNum(h.par) || h.par < 1 || h.par > 9) errors.push('par must be a number 1..9');

  const b = h.bounds as Record<string, unknown> | undefined;
  if (!b || !isNum(b.x) || !isNum(b.y) || !isNum(b.w) || !isNum(b.h) || b.w <= 0 || b.h <= 0) {
    errors.push('bounds must be {x,y,w,h} with positive w,h');
  }

  if (!isPoint(h.tee)) errors.push('tee must be a point');
  if (!isPoint(h.cup)) errors.push('cup must be a point');

  if (!Array.isArray(h.walls)) errors.push('walls must be an array');
  else
    (h.walls as unknown[]).forEach((w, i) => {
      const ww = w as Record<string, unknown>;
      if (!ww || !isPoint(ww.a) || !isPoint(ww.b)) errors.push(`walls[${i}]: needs points a and b`);
      if (ww && ww.restitution !== undefined && !isNum(ww.restitution))
        errors.push(`walls[${i}]: restitution must be a number`);
    });

  if (!Array.isArray(h.surfaceZones)) errors.push('surfaceZones must be an array');
  else
    (h.surfaceZones as unknown[]).forEach((z, i) => {
      const zz = z as Record<string, unknown>;
      checkPolygon(zz?.polygon, `surfaceZones[${i}].polygon`, errors);
      if (!SURFACE_TYPES.includes(zz?.surfaceType as never))
        errors.push(`surfaceZones[${i}]: unknown surfaceType ${String(zz?.surfaceType)}`);
    });

  if (!Array.isArray(h.slopeZones)) errors.push('slopeZones must be an array');
  else
    (h.slopeZones as unknown[]).forEach((z, i) => {
      const zz = z as Record<string, unknown>;
      checkPolygon(zz?.polygon, `slopeZones[${i}].polygon`, errors);
      if (!COMPASS_DIRECTIONS.includes(zz?.direction as never))
        errors.push(`slopeZones[${i}]: unknown direction ${String(zz?.direction)}`);
      if (![1, 2, 3].includes(zz?.grade as number)) errors.push(`slopeZones[${i}]: grade must be 1, 2 or 3`);
    });

  if (!Array.isArray(h.hazards)) errors.push('hazards must be an array');
  else
    (h.hazards as unknown[]).forEach((z, i) => {
      const zz = z as Record<string, unknown>;
      checkPolygon(zz?.polygon, `hazards[${i}].polygon`, errors);
      if (!HAZARD_TYPES.includes(zz?.type as never)) errors.push(`hazards[${i}]: unknown type ${String(zz?.type)}`);
      if (!isNum(zz?.penalty) || (zz.penalty as number) < 0) errors.push(`hazards[${i}]: penalty must be >= 0`);
      if (!HAZARD_RESETS.includes(zz?.resetTo as never))
        errors.push(`hazards[${i}]: unknown resetTo ${String(zz?.resetTo)}`);
    });

  if (!Array.isArray(h.obstacles)) errors.push('obstacles must be an array');
  else
    (h.obstacles as unknown[]).forEach((o, i) => {
      const oo = o as Record<string, unknown>;
      if (!oo || typeof oo.type !== 'string') {
        errors.push(`obstacles[${i}]: missing type`);
        return;
      }
      const s = oo.shape as Record<string, unknown> | undefined;
      if (!s || typeof s.kind !== 'string') {
        errors.push(`obstacles[${i}]: missing shape`);
        return;
      }
      if (s.kind === 'rect') {
        if (!isNum(s.x) || !isNum(s.y) || !isNum(s.w) || !isNum(s.h))
          errors.push(`obstacles[${i}]: rect needs x,y,w,h`);
      } else if (s.kind === 'circle') {
        if (!isNum(s.x) || !isNum(s.y) || !isNum(s.r) || (s.r as number) <= 0)
          errors.push(`obstacles[${i}]: circle needs x,y,r>0`);
      } else if (s.kind === 'polygon') {
        checkPolygon(s.points, `obstacles[${i}].shape.points`, errors);
      } else {
        errors.push(`obstacles[${i}]: unknown shape kind ${String(s.kind)}`);
      }
      if ((oo.type === 'bumper' || oo.type === 'post' || oo.type === 'pipe') && s.kind !== 'circle')
        errors.push(`obstacles[${i}]: ${oo.type}s must be circles`);
      if (oo.type === 'pipe') {
        if (!isPoint(oo.exit)) errors.push(`obstacles[${i}]: pipe needs an exit point`);
        if (oo.mode !== 'keep' && oo.mode !== 'redirect') errors.push(`obstacles[${i}]: pipe mode must be keep or redirect`);
        if (oo.mode === 'redirect' && !isNum(oo.exitAngle)) errors.push(`obstacles[${i}]: redirect pipe needs exitAngle`);
      }
    });

  return errors.length === 0 ? { ok: true, errors, hole: input as Hole } : { ok: false, errors };
}
