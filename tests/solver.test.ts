import { describe, expect, it } from 'vitest';
import { solveHole } from '../src/solver/solver';
import { buildDistanceField, distanceToCup } from '../src/solver/distanceField';
import { compileHole, DEFAULT_PARAMS, type Hole } from '../src/sim';
import { COURSE } from '../src/holes';

describe('solver', () => {
  it('accepts the shipped holes with a par in range', () => {
    for (const h of COURSE) {
      const r = solveHole(h);
      expect(r.accepted, `${h.id}: ${r.rejectReasons.join('; ')}`).toBe(true);
      expect(r.par).not.toBeNull();
      expect(r.par as number).toBeGreaterThanOrEqual(2);
      expect(r.par as number).toBeLessThanOrEqual(5);
      expect(r.bestRun).not.toBeNull();
    }
  });

  it('is deterministic', () => {
    const a = solveHole(COURSE[1]);
    const b = solveHole(COURSE[1]);
    const strip = (r: typeof a) => ({ ...r, timeMs: 0 });
    expect(strip(a)).toEqual(strip(b));
  });

  it('measures the L-bend route as longer than the straight line', () => {
    const h = COURSE[1];
    const df = buildDistanceField(compileHole(h), DEFAULT_PARAMS.ballRadius);
    const path = distanceToCup(df, h.tee.x, h.tee.y);
    const direct = Math.hypot(h.cup.x - h.tee.x, h.cup.y - h.tee.y);
    expect(path).toBeGreaterThan(direct);
    expect(path).toBeLessThan(direct * 1.5);
  });

  it('rejects a hole whose cup is walled off', () => {
    const h: Hole = JSON.parse(JSON.stringify(COURSE[0]));
    h.walls.push({ a: { x: 11, y: 20 }, b: { x: 19, y: 20 } });
    const r = solveHole(h);
    expect(r.accepted).toBe(false);
    expect(r.rejectReasons.join(' ')).toMatch(/not reachable/);
  });

  it('rejects a hole where every route crosses a hazard', () => {
    const h: Hole = JSON.parse(JSON.stringify(COURSE[0]));
    h.hazards.push({
      polygon: [
        { x: 11, y: 24 },
        { x: 19, y: 24 },
        { x: 19, y: 30 },
        { x: 11, y: 30 },
      ],
      type: 'drain',
      penalty: 1,
      resetTo: 'lastSafe',
    });
    const r = solveHole(h);
    expect(r.accepted).toBe(false);
    expect(r.rejectReasons.join(' ')).toMatch(/hazard/);
  });

  it('rejects a cup placed against a corner', () => {
    const h: Hole = JSON.parse(JSON.stringify(COURSE[0]));
    h.cup = { x: 12, y: 5 };
    const r = solveHole(h);
    expect(r.rejectReasons.join(' ')).toMatch(/corner/);
  });
});
