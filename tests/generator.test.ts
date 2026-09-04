import { describe, expect, it } from 'vitest';
import { ARCHETYPES, buildSkeleton } from '../src/generator/archetypes';
import { unionWalls } from '../src/generator/geom';
import { generateHole, generateCourse, COURSE_DIFFICULTY } from '../src/generator/generator';
import { Rng } from '../src/generator/rng';
import { validateHole, replay } from '../src/sim';

const FAST = { randomShots: 60, randomPlays: 20, runs: 4, strongRuns: 1 };

describe('generator', () => {
  it('every archetype builds a valid hole across seeds', () => {
    for (const a of ARCHETYPES) {
      for (let s = 0; s < 6; s++) {
        const rng = new Rng(`${a}:${s}`);
        const sk = buildSkeleton(a, rng, { length: rng.pick(['short', 'medium', 'long']), width: rng.pick(['tight', 'normal', 'wide']) });
        const walls = unionWalls(sk.cells);
        expect(walls.length, `${a}:${s} has walls`).toBeGreaterThan(2);
        for (const c of sk.cells) for (const p of c) {
          expect(p.x, `${a}:${s} inside x`).toBeGreaterThanOrEqual(0);
          expect(p.x, `${a}:${s} inside x`).toBeLessThanOrEqual(30);
          expect(p.y, `${a}:${s} inside y`).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  it('generateHole returns a solver-accepted, schema-valid hole', () => {
    for (const a of ARCHETYPES) {
      const g = generateHole({ seed: `t:${a}`, archetype: a, solve: FAST });
      expect(validateHole(g.hole).ok, a).toBe(true);
      expect(g.report.par, a).not.toBeNull();
      expect(g.fallback, `${a} needed the fallback`).toBe(false);
    }
  });

  it('is deterministic for a seed', () => {
    const a = generateHole({ seed: 'det', solve: FAST });
    const b = generateHole({ seed: 'det', solve: FAST });
    expect(a.hole).toEqual(b.hole);
    expect(a.archetype).toEqual(b.archetype);
  });

  it('different seeds give different holes', () => {
    const a = generateHole({ seed: 'one', archetype: 'lBend', solve: FAST });
    const b = generateHole({ seed: 'two', archetype: 'lBend', solve: FAST });
    expect(JSON.stringify(a.hole.walls)).not.toEqual(JSON.stringify(b.hole.walls));
  });

  it('generated holes replay deterministically', () => {
    const g = generateHole({ seed: 'replay', archetype: 'chamber', solve: FAST });
    const strokes = [
      { angle: -Math.PI / 2 + 0.2, power: 0.9 },
      { angle: -1.2, power: 0.5 },
      { angle: 2.5, power: 0.7 },
    ];
    const r1 = replay(g.hole, 7, strokes);
    const r2 = replay(g.hole, 7, strokes);
    expect(r1.state).toEqual(r2.state);
  });

  it('a course has 9 distinct archetypes with the difficulty curve', () => {
    const c = generateCourse('course-test', 9, undefined);
    expect(c.holes).toHaveLength(9);
    const arches = new Set(c.holes.map((h) => h.archetype));
    expect(arches.size).toBe(9);
    expect(c.holes.map((h) => h.difficulty)).toEqual(COURSE_DIFFICULTY);
    const ids = new Set(c.holes.map((h) => h.hole.id));
    expect(ids.size).toBe(9);
  }, 120_000);
});
