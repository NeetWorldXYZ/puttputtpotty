/**
 * Replay: hole + seed + ordered strokes -> final state. This is the contract
 * that leaderboard verification, the solver and ghost replays will rely on.
 */

import type { Hole, Stroke } from './types';
import type { PhysicsParams } from './params';
import { DEFAULT_PARAMS } from './params';
import { compileHole } from './world';
import { applyStroke, createSimState, runUntilRest, type SimState } from './sim';

export interface ReplayResult {
  state: SimState;
  /** Steps taken per stroke. */
  stepsPerStroke: number[];
}

export function replay(
  hole: Hole,
  seed: number,
  strokes: readonly Stroke[],
  params: PhysicsParams = DEFAULT_PARAMS,
): ReplayResult {
  const world = compileHole(hole);
  const state = createSimState(hole, seed);
  const stepsPerStroke: number[] = [];
  for (const s of strokes) {
    if (!applyStroke(state, params, s)) {
      stepsPerStroke.push(0);
      continue;
    }
    stepsPerStroke.push(runUntilRest(state, world, params));
  }
  return { state, stepsPerStroke };
}

/** Stable serialisation of the parts of state that matter for verification. */
export function stateFingerprint(state: SimState): string {
  return JSON.stringify({
    ball: state.ball,
    resting: state.resting,
    sunk: state.sunk,
    done: state.done,
    strokes: state.strokes,
    penalties: state.penalties,
    lastSafe: state.lastSafe,
    strokeTime: state.strokeTime,
    totalTime: state.totalTime,
    rng: state.rng,
    surface: state.surface,
  });
}
