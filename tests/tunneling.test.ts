import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PARAMS,
  applyStroke,
  compileHole,
  createSimState,
  runUntilRest,
  step,
  type Hole,
  type PhysicsParams,
} from '../src/sim';

/** A box with a single zero-thickness wall across the middle. */
function thinWallHole(): Hole {
  return {
    version: 1,
    id: 'test-thin-wall',
    name: 'Thin wall',
    par: 1,
    bounds: { x: 0, y: 0, w: 30, h: 60 },
    walls: [{ a: { x: 0, y: 30 }, b: { x: 30, y: 30 } }],
    tee: { x: 15, y: 50 },
    cup: { x: 15, y: 5 },
    surfaceZones: [],
    slopeZones: [],
    hazards: [],
    obstacles: [],
  };
}

function shootAt(params: PhysicsParams, angle: number, power = 1) {
  const hole = thinWallHole();
  const world = compileHole(hole);
  const state = createSimState(hole, 1);
  applyStroke(state, params, { angle, power });
  let crossed = false;
  let maxStepDist = 0;
  let prev = { x: state.ball.x, y: state.ball.y };
  while (!state.resting && !state.done) {
    step(state, world, params);
    const d = Math.hypot(state.ball.x - prev.x, state.ball.y - prev.y);
    if (d > maxStepDist) maxStepDist = d;
    if (state.ball.y < 30) crossed = true;
    prev = { x: state.ball.x, y: state.ball.y };
  }
  return { state, crossed, maxStepDist };
}

describe('no tunneling', () => {
  it('a max-power shot straight at a thin wall bounces off it', () => {
    const r = shootAt(DEFAULT_PARAMS, -Math.PI / 2);
    expect(r.crossed).toBe(false);
    expect(r.state.ball.y).toBeGreaterThan(30 + DEFAULT_PARAMS.ballRadius - 1e-3);
    // Sanity: the ball really was moving faster than the wall is "thick".
    expect(r.maxStepDist).toBeGreaterThan(0.3);
  });

  it('holds at every angle, including glancing ones', () => {
    for (let i = 0; i <= 40; i++) {
      const angle = -Math.PI / 2 + (i / 40 - 0.5) * Math.PI * 0.9;
      const r = shootAt(DEFAULT_PARAMS, angle);
      expect(r.crossed, `angle ${angle}`).toBe(false);
    }
  });

  it('holds even at absurd velocities (600 units/s, 5 units per step)', () => {
    const params = { ...DEFAULT_PARAMS, maxPuttVelocity: 600 };
    for (let i = 0; i <= 20; i++) {
      const angle = -Math.PI / 2 + (i / 20 - 0.5) * Math.PI * 0.8;
      const r = shootAt(params, angle);
      expect(r.crossed, `angle ${angle}`).toBe(false);
      expect(r.maxStepDist).toBeGreaterThan(2);
    }
  });

  it('the ball never leaves the bounds rectangle', () => {
    const hole = thinWallHole();
    hole.walls = [];
    const world = compileHole(hole);
    const params = { ...DEFAULT_PARAMS, maxPuttVelocity: 300, wallRestitution: 1 };
    for (let i = 0; i < 24; i++) {
      const state = createSimState(hole, i);
      applyStroke(state, params, { angle: (i / 24) * Math.PI * 2, power: 1 });
      while (!state.resting && !state.done) {
        step(state, world, params);
        expect(state.ball.x).toBeGreaterThanOrEqual(0);
        expect(state.ball.x).toBeLessThanOrEqual(30);
        expect(state.ball.y).toBeGreaterThanOrEqual(0);
        expect(state.ball.y).toBeLessThanOrEqual(60);
      }
    }
  });
});

describe('physics behaviours', () => {
  it('reflects off a wall with restitution', () => {
    const hole = thinWallHole();
    const world = compileHole(hole);
    const params = { ...DEFAULT_PARAMS, baseFriction: 0 };
    const state = createSimState(hole, 1);
    applyStroke(state, params, { angle: -Math.PI / 2, power: 1 });
    const v0 = -state.ball.vy;
    // Step until the bounce event.
    let bounced = false;
    for (let i = 0; i < 2000 && !bounced; i++) {
      step(state, world, params);
      if (state.events.some((e) => e.type === 'bounce')) bounced = true;
    }
    expect(bounced).toBe(true);
    expect(state.ball.vy).toBeGreaterThan(0);
    expect(state.ball.vy / v0).toBeCloseTo(params.wallRestitution, 5);
  });

  it('comes to rest on felt inside the max sim time', () => {
    const hole = thinWallHole();
    hole.walls = [];
    const world = compileHole(hole);
    const state = createSimState(hole, 1);
    applyStroke(state, DEFAULT_PARAMS, { angle: -Math.PI / 2, power: 0.4 });
    runUntilRest(state, world, DEFAULT_PARAMS);
    expect(state.resting).toBe(true);
    expect(state.strokeTime).toBeLessThan(DEFAULT_PARAMS.maxSimTime);
    expect(state.ball.vx).toBe(0);
    expect(state.ball.vy).toBe(0);
  });

  it('sinks a slow ball and lips out a fast one', () => {
    const hole = thinWallHole();
    hole.walls = [];
    hole.cup = { x: 15, y: 30 };
    const world = compileHole(hole);

    const slow = createSimState(hole, 1);
    applyStroke(slow, DEFAULT_PARAMS, { angle: -Math.PI / 2, power: 0.5 });
    runUntilRest(slow, world, DEFAULT_PARAMS);
    expect(slow.sunk).toBe(true);
    expect(slow.ball).toEqual({ x: 15, y: 30, vx: 0, vy: 0 });

    const fast = createSimState(hole, 1);
    applyStroke(fast, DEFAULT_PARAMS, { angle: -Math.PI / 2, power: 1 });
    let lipped = false;
    while (!fast.resting && !fast.done) {
      step(fast, world, DEFAULT_PARAMS);
      if (fast.events.some((e) => e.type === 'lipOut')) lipped = true;
    }
    expect(lipped).toBe(true);
    expect(fast.sunk).toBe(false);
  });

  it('applies a hazard penalty and resets the ball', () => {
    const hole = thinWallHole();
    hole.walls = [];
    hole.hazards = [
      {
        polygon: [
          { x: 5, y: 20 },
          { x: 25, y: 20 },
          { x: 25, y: 26 },
          { x: 5, y: 26 },
        ],
        type: 'drain',
        penalty: 1,
        resetTo: 'lastSafe',
      },
    ];
    const world = compileHole(hole);
    const state = createSimState(hole, 1);
    applyStroke(state, DEFAULT_PARAMS, { angle: -Math.PI / 2, power: 1 });
    runUntilRest(state, world, DEFAULT_PARAMS);
    expect(state.penalties).toBe(1);
    expect(state.ball.x).toBe(15);
    expect(state.ball.y).toBe(50);
  });

  it('slopes pull the ball and shag stops it', () => {
    const hole = thinWallHole();
    hole.walls = [];
    const box = [
      { x: 0, y: 0 },
      { x: 30, y: 0 },
      { x: 30, y: 60 },
      { x: 0, y: 60 },
    ];
    hole.slopeZones = [{ polygon: box, direction: 'E', grade: 2 }];
    const world = compileHole(hole);
    const state = createSimState(hole, 1);
    applyStroke(state, DEFAULT_PARAMS, { angle: -Math.PI / 2, power: 0.3 });
    runUntilRest(state, world, DEFAULT_PARAMS);
    expect(state.ball.x).toBeGreaterThan(15 + 3);

    const shagHole = thinWallHole();
    shagHole.walls = [];
    shagHole.surfaceZones = [{ polygon: box, surfaceType: 'shag' }];
    const shagWorld = compileHole(shagHole);
    const felt = createSimState(shagHole, 1);
    applyStroke(felt, DEFAULT_PARAMS, { angle: -Math.PI / 2, power: 0.5 });
    runUntilRest(felt, compileHole({ ...shagHole, surfaceZones: [] }), DEFAULT_PARAMS);
    const shag = createSimState(shagHole, 1);
    applyStroke(shag, DEFAULT_PARAMS, { angle: -Math.PI / 2, power: 0.5 });
    runUntilRest(shag, shagWorld, DEFAULT_PARAMS);
    expect(50 - shag.ball.y).toBeLessThan((50 - felt.ball.y) * 0.6);
  });

  it('does not catch on a convex corner', () => {
    // A rectangular blocker; fire at its corner from many nearby angles.
    const hole = thinWallHole();
    hole.walls = [];
    hole.obstacles = [{ type: 'blocker', shape: { kind: 'rect', x: 12, y: 20, w: 6, h: 6 } }];
    const world = compileHole(hole);
    for (let i = 0; i < 30; i++) {
      const state = createSimState(hole, 1);
      const angle = -Math.PI / 2 + (i / 30 - 0.5) * 0.5;
      applyStroke(state, DEFAULT_PARAMS, { angle, power: 0.8 });
      const steps = runUntilRest(state, world, DEFAULT_PARAMS);
      expect(state.resting).toBe(true);
      expect(steps).toBeLessThan(DEFAULT_PARAMS.maxSimTime * 120);
      // Not inside the blocker.
      const inside =
        state.ball.x > 12 + 0.49 && state.ball.x < 18 - 0.49 && state.ball.y > 20 + 0.49 && state.ball.y < 26 - 0.49;
      expect(inside).toBe(false);
    }
  });
});

describe('pipes', () => {
  it('carries the ball from entry to exit and redirects it', () => {
    const hole = thinWallHole();
    hole.walls = [];
    hole.obstacles = [
      { type: 'pipe', shape: { kind: 'circle', x: 15, y: 40, r: 1.2 }, exit: { x: 5, y: 10 }, mode: 'redirect', exitAngle: 0 },
    ];
    const world = compileHole(hole);
    const state = createSimState(hole, 1);
    applyStroke(state, DEFAULT_PARAMS, { angle: -Math.PI / 2, power: 0.5 });
    let piped = false;
    for (let i = 0; i < 2000 && !piped; i++) {
      step(state, world, DEFAULT_PARAMS);
      if (state.events.some((e) => e.type === 'pipe')) piped = true;
    }
    expect(piped).toBe(true);
    expect(state.ball.x).toBeCloseTo(5, 1);
    expect(state.ball.y).toBeCloseTo(10, 1);
    expect(state.ball.vx).toBeGreaterThan(0);
    expect(Math.abs(state.ball.vy)).toBeLessThan(1e-9);
  });
});
