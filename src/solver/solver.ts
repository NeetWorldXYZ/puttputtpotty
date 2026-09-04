/**
 * Hole solver. Plays a hole thousands of times headlessly with seeded
 * randomness and reports par, difficulty and the section-9 reject rules.
 *
 * Deterministic: same hole + params + options -> same report.
 */

import type { Hole, Stroke } from '../sim/types';
import type { PhysicsParams } from '../sim/params';
import { DEFAULT_PARAMS } from '../sim/params';
import { compileHole, type World } from '../sim/world';
import { applyStroke, cloneState, createSimState, runUntilRest, STROKE_CAP, type SimState } from '../sim/sim';
import { rngNext, seedFromString } from '../sim/rng';
import { buildDistanceField, directionToCup, distanceToCup, type DistanceField } from './distanceField';

export interface SolveOptions {
  /** Random tee shots used for the ace-rate / cup-find-rate stats. */
  randomShots: number;
  /** Half-angle (radians) of the forward cone random tee shots are drawn from. */
  randomCone: number;
  /** Random-policy plays used for the cup-find-rate. */
  randomPlays: number;
  /** "Competent player" runs used to estimate par: a few options considered per stroke. */
  runs: number;
  /** Candidate strokes a competent player considers per stroke. */
  candidatesPerStroke: number;
  /** Strong-search runs used for best-possible strokes. */
  strongRuns: number;
  strongCandidates: number;
  /** Shots tried from a rest position when checking for traps. */
  trapProbeShots: number;
  seed: number;
}

export const DEFAULT_SOLVE_OPTIONS: SolveOptions = {
  randomShots: 300,
  randomCone: (75 * Math.PI) / 180,
  randomPlays: 100,
  runs: 12,
  candidatesPerStroke: 16,
  strongRuns: 4,
  strongCandidates: 40,
  trapProbeShots: 24,
  seed: 1,
};

export interface SolveRun {
  strokes: number | null;
  penalties: number;
  solution: Stroke[];
  /** Rest positions after each stroke (for drawing). */
  positions: { x: number; y: number }[];
}

export interface SolveReport {
  holeId: string;
  /** Estimated par: median strokes over competent runs, rounded up, floored at 2. null if unsolved. */
  par: number | null;
  bestStrokes: number | null;
  /** Fraction of greedy runs that sank the ball within the stroke cap. */
  successRate: number;
  /** Fraction of random tee shots that sink in one. */
  aceRate: number;
  /** Fraction of random tee shots that end up in a hazard. */
  hazardRate: number;
  /** Fraction of random-policy plays (no search, cone-random shots) that sink within the cap. */
  cupFindRate: number;
  /** Straight-line vs. geodesic tee-to-cup distance, units. */
  teeToCupDirect: number;
  teeToCupPath: number;
  cupNearestCorner: number;
  trapsFound: number;
  /** Every successful run took a penalty: the hazard can't be avoided. */
  hazardUnavoidable: boolean;
  rejectReasons: string[];
  accepted: boolean;
  bestRun: SolveRun | null;
  runs: SolveRun[];
  timeMs: number;
}

interface Ctx {
  world: World;
  params: PhysicsParams;
  df: DistanceField;
  rng: number;
}

function rand(ctx: Ctx): number {
  const [s, v] = rngNext(ctx.rng);
  ctx.rng = s;
  return v;
}

function shoot(ctx: Ctx, from: SimState, stroke: Stroke): SimState {
  const s = cloneState(from);
  applyStroke(s, ctx.params, stroke);
  runUntilRest(s, ctx.world, ctx.params);
  return s;
}

/** Route-aware "how good is this rest position": lower is better. */
function positionCost(ctx: Ctx, s: SimState): number {
  if (s.sunk) return -1000;
  const d = distanceToCup(ctx.df, s.ball.x, s.ball.y, false);
  return (Number.isFinite(d) ? d : 1e6) + s.penalties * 40;
}

function sampleCandidate(ctx: Ctx, s: SimState, k: number, total: number): Stroke {
  // First 60%: aimed along the geodesic with noise. Rest: uniform.
  const aimed = k < total * 0.6 ? directionToCup(ctx.df, s.ball.x, s.ball.y, 3 + Math.floor(rand(ctx) * 6)) : null;
  if (aimed) {
    const base = Math.atan2(aimed.y, aimed.x);
    const angle = base + (rand(ctx) - 0.5) * 0.9;
    const power = 0.15 + rand(ctx) * 0.85;
    return { angle, power };
  }
  return { angle: rand(ctx) * Math.PI * 2, power: 0.1 + rand(ctx) * 0.9 };
}

function greedyRun(ctx: Ctx, hole: Hole, seed: number, candidates: number): SolveRun {
  ctx.rng = seed >>> 0;
  let state = createSimState(hole, seed);
  const solution: Stroke[] = [];
  const positions: { x: number; y: number }[] = [];
  for (let stroke = 0; stroke < STROKE_CAP; stroke++) {
    let best: SimState | null = null;
    let bestStroke: Stroke | null = null;
    let bestCost = Infinity;
    for (let k = 0; k < candidates; k++) {
      const cand = sampleCandidate(ctx, state, k, candidates);
      const next = shoot(ctx, state, cand);
      const cost = positionCost(ctx, next);
      if (cost < bestCost) {
        bestCost = cost;
        best = next;
        bestStroke = cand;
      }
      if (next.sunk) break;
    }
    if (!best || !bestStroke) break;
    state = best;
    solution.push(bestStroke);
    positions.push({ x: state.ball.x, y: state.ball.y });
    if (state.sunk || state.done) break;
  }
  return {
    strokes: state.sunk ? state.strokes + state.penalties : null,
    penalties: state.penalties,
    solution,
    positions,
  };
}

function nearestCornerDistance(hole: Hole): number {
  let best = Infinity;
  const pts: { x: number; y: number }[] = [];
  for (const w of hole.walls) pts.push(w.a, w.b);
  for (const o of hole.obstacles) {
    const s = o.shape;
    if (s.kind === 'rect') pts.push({ x: s.x, y: s.y }, { x: s.x + s.w, y: s.y }, { x: s.x, y: s.y + s.h }, { x: s.x + s.w, y: s.y + s.h });
  }
  for (const p of pts) {
    const d = Math.hypot(p.x - hole.cup.x, p.y - hole.cup.y);
    if (d < best) best = d;
  }
  return best;
}

/** A rest position from which no probe shot improves the route distance and none sinks. */
function isTrap(ctx: Ctx, hole: Hole, s: SimState, opts: SolveOptions): boolean {
  if (s.sunk || s.done) return false;
  const here = distanceToCup(ctx.df, s.ball.x, s.ball.y, false);
  for (let k = 0; k < opts.trapProbeShots; k++) {
    const cand: Stroke = { angle: (k / opts.trapProbeShots) * Math.PI * 2, power: 0.3 + 0.7 * ((k * 7) % 5) / 4 };
    const next = shoot(ctx, s, cand);
    if (next.sunk) return false;
    if (next.penalties > s.penalties) continue; // hazard resets are not "escape"
    const d = distanceToCup(ctx.df, next.ball.x, next.ball.y, false);
    if (d < here - 1) return false;
  }
  void hole;
  return true;
}

export function solveHole(
  hole: Hole,
  params: PhysicsParams = DEFAULT_PARAMS,
  options: Partial<SolveOptions> = {},
): SolveReport {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const opts: SolveOptions = { ...DEFAULT_SOLVE_OPTIONS, ...options };
  const world = compileHole(hole);
  const df = buildDistanceField(world, params.ballRadius);
  const ctx: Ctx = { world, params, df, rng: opts.seed >>> 0 };
  const reasons: string[] = [];

  const teeToCupDirect = Math.hypot(hole.cup.x - hole.tee.x, hole.cup.y - hole.tee.y);
  const teeToCupPath = distanceToCup(df, hole.tee.x, hole.tee.y, true);
  const teeToCupAny = distanceToCup(df, hole.tee.x, hole.tee.y, false);
  if (!Number.isFinite(teeToCupAny)) reasons.push('cup is not reachable from the tee');
  else if (!Number.isFinite(teeToCupPath)) reasons.push('every route from tee to cup crosses a hazard');

  const cupNearestCorner = nearestCornerDistance(hole);
  if (cupNearestCorner < 2.5) reasons.push(`cup is ${cupNearestCorner.toFixed(1)} units from a wall corner (min 2.5)`);

  // Random tee shots.
  ctx.rng = seedFromString(`${hole.id}:random:${opts.seed}`);
  const start = createSimState(hole, opts.seed);
  const teeDir = directionToCup(df, hole.tee.x, hole.tee.y, 6);
  const teeAngle = teeDir ? Math.atan2(teeDir.y, teeDir.x) : 0;
  const cone = teeDir ? opts.randomCone : Math.PI;
  let aces = 0;
  let hazards = 0;
  const restStates: SimState[] = [];
  for (let i = 0; i < opts.randomShots; i++) {
    const angle = teeAngle + (rand(ctx) * 2 - 1) * cone;
    const s = shoot(ctx, start, { angle, power: 0.1 + rand(ctx) * 0.9 });
    if (s.sunk) aces++;
    if (s.penalties > 0) hazards++;
    else if (i % 10 === 0) restStates.push(s);
  }
  const aceRate = aces / opts.randomShots;
  const hazardRate = hazards / opts.randomShots;

  // Random-policy plays: each stroke is a cone-random shot roughly toward the cup, no search.
  ctx.rng = seedFromString(`${hole.id}:plays:${opts.seed}`);
  let found = 0;
  for (let i = 0; i < opts.randomPlays; i++) {
    let s = createSimState(hole, opts.seed + i);
    for (let k = 0; k < STROKE_CAP && !s.done; k++) {
      const dir = directionToCup(df, s.ball.x, s.ball.y, 6);
      const base = dir ? Math.atan2(dir.y, dir.x) : 0;
      const angle = base + (rand(ctx) * 2 - 1) * (dir ? opts.randomCone : Math.PI);
      s = shoot(ctx, s, { angle, power: 0.1 + rand(ctx) * 0.9 });
    }
    if (s.sunk) found++;
  }
  const cupFindRate = found / opts.randomPlays;

  // Competent-player runs for par; strong runs for the best achievable.
  const runs: SolveRun[] = [];
  for (let r = 0; r < opts.runs; r++) {
    runs.push(greedyRun(ctx, hole, seedFromString(`${hole.id}:run:${opts.seed}:${r}`), opts.candidatesPerStroke));
  }
  const strong: SolveRun[] = [];
  for (let r = 0; r < opts.strongRuns; r++) {
    strong.push(greedyRun(ctx, hole, seedFromString(`${hole.id}:strong:${opts.seed}:${r}`), opts.strongCandidates));
  }
  const solved = runs.filter((r) => r.strokes !== null);
  const successRate = solved.length / runs.length;
  const strokesSorted = solved.map((r) => r.strokes as number).sort((a, b) => a - b);
  const allSolved = [...solved, ...strong.filter((r) => r.strokes !== null)];
  const bestStrokes = allSolved.length ? Math.min(...allSolved.map((r) => r.strokes as number)) : null;
  let par: number | null = null;
  if (strokesSorted.length) {
    const mid = strokesSorted.length / 2;
    const median =
      strokesSorted.length % 2 === 1
        ? strokesSorted[Math.floor(mid)]
        : (strokesSorted[mid - 1] + strokesSorted[mid]) / 2;
    // Floor at 2: a hole a competent player often aces is still "par 2" for humans;
    // the 40% ace-rate rule is what catches genuinely trivial holes.
    par = Math.max(2, Math.ceil(median));
  }
  const hazardUnavoidable = solved.length > 0 && solved.every((r) => r.penalties > 0);

  // Traps: probe a sample of random-shot rest positions and solver rest positions.
  let trapsFound = 0;
  for (const s of restStates.slice(0, 12)) if (isTrap(ctx, hole, s, opts)) trapsFound++;

  if (par === null && bestStrokes === null) reasons.push(`solver could not complete the hole in ${STROKE_CAP} strokes`);
  else if (par === null) par = Math.min(STROKE_CAP, (bestStrokes as number) + 2);
  else if (par > 5) reasons.push(`estimated par ${par} is over 5`);
  if (aceRate > 0.4) reasons.push(`${Math.round(aceRate * 100)}% of random shots ace it (max 40%)`);
  if (cupFindRate < 0.03) reasons.push(`only ${Math.round(cupFindRate * 100)}% of random plays ever find the cup (min 3%)`);
  if (hazardUnavoidable) reasons.push('every solution takes a hazard penalty');
  if (trapsFound > 0) reasons.push(`${trapsFound} trap position(s): no shot gets closer to the cup`);

  const bestRun = allSolved.length ? allSolved.reduce((a, b) => ((a.strokes as number) <= (b.strokes as number) ? a : b)) : null;
  const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();

  return {
    holeId: hole.id,
    par,
    bestStrokes,
    successRate,
    aceRate,
    hazardRate,
    cupFindRate,
    teeToCupDirect,
    teeToCupPath: Number.isFinite(teeToCupPath) ? teeToCupPath : -1,
    cupNearestCorner,
    trapsFound,
    hazardUnavoidable,
    rejectReasons: reasons,
    accepted: reasons.length === 0,
    bestRun,
    runs,
    timeMs: t1 - t0,
  };
}
