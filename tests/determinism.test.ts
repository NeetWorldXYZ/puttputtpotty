import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PARAMS,
  applyStroke,
  compileHole,
  createSimState,
  replay,
  seedFromString,
  stateFingerprint,
  step,
  type Hole,
  type Stroke,
} from '../src/sim';
import straight from '../src/holes/01-straight.json';
import lBend from '../src/holes/02-l-bend.json';
import split from '../src/holes/03-split-path.json';

const holes = [straight as Hole, lBend as Hole, split as Hole];

// A deliberately messy set of strokes: full power into walls, slopes,
// hazards and a lip-out, so the replay covers every code path.
const strokes: Stroke[] = [
  { angle: -Math.PI / 2 + 0.31, power: 1 },
  { angle: -Math.PI / 2 - 0.9, power: 0.85 },
  { angle: Math.PI / 4, power: 0.5 },
  { angle: -Math.PI / 2, power: 0.35 },
  { angle: -2.2, power: 0.7 },
  { angle: 0.4, power: 1 },
  { angle: -1.3, power: 0.2 },
  { angle: 2.9, power: 0.6 },
];

describe('replay determinism', () => {
  for (const hole of holes) {
    it(`${hole.id}: same hole + seed + strokes -> identical final state`, () => {
      const seed = seedFromString(hole.id + ':2026-09-04');
      const a = replay(hole, seed, strokes);
      const b = replay(hole, seed, strokes);
      expect(stateFingerprint(a.state)).toEqual(stateFingerprint(b.state));
      expect(a.state).toEqual(b.state);
      expect(a.stepsPerStroke).toEqual(b.stepsPerStroke);
      // Bit-for-bit, not just "close".
      expect(Object.is(a.state.ball.x, b.state.ball.x)).toBe(true);
      expect(Object.is(a.state.ball.y, b.state.ball.y)).toBe(true);
    });
  }

  it('is independent of how steps are batched (accumulator vs. tight loop)', () => {
    const hole = holes[1];
    const seed = 12345;
    const params = DEFAULT_PARAMS;
    const world = compileHole(hole);

    // Reference: replay() runs a tight loop per stroke.
    const ref = replay(hole, seed, strokes, params);

    // Live-style: steps interleaved in irregular batches, like a frame loop
    // with a jittery accumulator would produce.
    const live = createSimState(hole, seed);
    let batch = 1;
    for (const s of strokes) {
      applyStroke(live, params, s);
      while (!live.resting && !live.done) {
        for (let i = 0; i < batch && !live.resting && !live.done; i++) step(live, world, params);
        batch = (batch % 7) + 1;
      }
    }
    expect(stateFingerprint(live)).toEqual(stateFingerprint(ref.state));
  });

  it('serialises state through JSON without changing the outcome', () => {
    const hole = holes[2];
    const seed = 99;
    const world = compileHole(hole);
    const params = DEFAULT_PARAMS;

    const a = createSimState(hole, seed);
    let b = createSimState(hole, seed);
    for (const s of strokes) {
      applyStroke(a, params, s);
      applyStroke(b, params, s);
      while (!a.resting && !a.done) {
        step(a, world, params);
        step(b, world, params);
        // Round-trip b through JSON mid-flight every step.
        b = JSON.parse(JSON.stringify(b));
      }
    }
    expect(stateFingerprint(a)).toEqual(stateFingerprint(b));
  });

  it('a different seed leaves the physics untouched in phase 1 (no randomness in play)', () => {
    const a = replay(holes[0], 1, strokes);
    const b = replay(holes[0], 2, strokes);
    expect(a.state.ball).toEqual(b.state.ball);
    expect(a.state.rng).not.toEqual(b.state.rng);
  });

  it('state contains only plain data', () => {
    const r = replay(holes[1], 7, strokes.slice(0, 3));
    const json = JSON.stringify(r.state);
    expect(JSON.parse(json)).toEqual(r.state);
  });
});
