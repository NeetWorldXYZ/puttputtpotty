/**
 * Hole and course generation. Seed in, solver-validated Hole out.
 */

import type { Hole } from '../sim/types';
import type { PhysicsParams } from '../sim/params';
import { DEFAULT_PARAMS } from '../sim/params';
import { validateHole } from '../sim/validate';
import { solveHole, type SolveOptions, type SolveReport } from '../solver/solver';
import { ARCHETYPES, buildSkeleton, type Archetype, type ArchetypeParams, type LengthClass, type WidthClass } from './archetypes';
import { decorate, type Difficulty } from './decorate';
import { unionWalls, distToWalls } from './geom';
import { Rng } from './rng';

export interface GenerateOptions {
  seed: string;
  archetype?: Archetype;
  difficulty?: Difficulty;
  params?: PhysicsParams;
  /** Attempts before falling back to an undecorated hole. */
  maxAttempts?: number;
  solve?: Partial<SolveOptions>;
}

export interface GeneratedHole {
  hole: Hole;
  archetype: Archetype;
  difficulty: Difficulty;
  report: SolveReport;
  attempts: number;
  /** True if no attempt passed and the undecorated fallback was used. */
  fallback: boolean;
}

/** Cheaper solver settings for generation; the full solve is for the editor. */
export const GENERATION_SOLVE: Partial<SolveOptions> = {
  randomShots: 150,
  randomPlays: 60,
  runs: 8,
  strongRuns: 2,
};

const PAR_RANGE: Record<Difficulty, [number, number]> = { easy: [2, 3], medium: [3, 4], hard: [3, 5] };

const ADJ = ['Porcelain', 'Leaky', 'Grimy', 'Golden', 'Clogged', 'Slippery', 'Royal', 'Rusty', 'Midnight', 'Marble', 'Squeaky', 'Foggy', 'Crooked', 'Long', 'Flushed'];
const NOUN: Record<Archetype, string[]> = {
  straight: ['Flush', 'Runway', 'Drainpipe', 'Corridor'],
  lBend: ['Elbow', 'U-Bend', 'Corner Stall'],
  dogleg: ['Dogleg', 'Kink', 'Crooked Pipe'],
  sCurve: ['S-Trap', 'Snake', 'Swirl'],
  zFold: ['Z-Trap', 'Zigzag', 'Fold'],
  splitPath: ['Two Stalls', 'Fork', 'Either Way'],
  forkMerge: ['Merge', 'Y-Pipe', 'Reunion'],
  loopAround: ['Roundabout', 'Loop', 'Island'],
  chamber: ['Chamber', 'Big Room', 'Lobby'],
  funnel: ['Funnel', 'Drain', 'Plughole'],
  bottleneck: ['Bottleneck', 'Pinch', 'Squeeze'],
  switchback: ['Hairpin', 'Switchback', 'Turnaround'],
  cross: ['Crossroads', 'Junction', 'Four-Way'],
  ring: ['Ring', 'Halo', 'Bowl Rim'],
};

function nameFor(a: Archetype, rng: Rng): string {
  return `${rng.pick(ADJ)} ${rng.pick(NOUN[a])}`;
}

function classesFor(d: Difficulty, rng: Rng): ArchetypeParams {
  const length: LengthClass = d === 'easy' ? rng.pick(['short', 'medium']) : d === 'medium' ? rng.pick(['short', 'medium', 'medium']) : rng.pick(['medium', 'long']);
  const width: WidthClass = d === 'easy' ? rng.pick(['normal', 'wide']) : d === 'medium' ? rng.pick(['normal', 'normal', 'tight']) : rng.pick(['tight', 'normal']);
  return { length, width };
}

function assemble(seed: string, attempt: number, arche: Archetype, difficulty: Difficulty, rng: Rng, decorated: boolean): Hole {
  const sk = buildSkeleton(arche, rng, classesFor(difficulty, rng));
  const walls = unionWalls(sk.cells);
  const hole: Hole = {
    version: 1,
    id: `gen-${seed}-${attempt}`,
    name: nameFor(arche, rng),
    par: 3,
    bounds: { x: 0, y: 0, w: 30, h: Math.max(40, sk.height) },
    walls,
    tee: sk.tee,
    cup: sk.cup,
    surfaceZones: [],
    slopeZones: [],
    hazards: [],
    obstacles: [...sk.islands],
  };
  if (decorated) decorate(hole, sk, rng, difficulty);
  return hole;
}

function quickReject(hole: Hole): string | null {
  if (distToWalls(hole.tee, hole.walls) < 2) return 'tee too close to a wall';
  if (distToWalls(hole.cup, hole.walls) < 2) return 'cup too close to a wall';
  return null;
}

export function generateHole(o: GenerateOptions): GeneratedHole {
  const params = o.params ?? DEFAULT_PARAMS;
  const maxAttempts = o.maxAttempts ?? 10;
  const solveOpts = { ...GENERATION_SOLVE, ...(o.solve ?? {}) };
  const root = new Rng(o.seed);
  const archetype = o.archetype ?? root.pick(ARCHETYPES);
  const difficulty = o.difficulty ?? root.pick<Difficulty>(['easy', 'medium', 'medium', 'hard']);
  const [parLo, parHi] = PAR_RANGE[difficulty];

  let acceptedAny: GeneratedHole | null = null;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const rng = root.fork(`attempt:${attempt}`);
    const hole = assemble(o.seed, attempt, archetype, difficulty, rng, true);
    if (!validateHole(hole).ok || quickReject(hole)) continue;
    const report = solveHole(hole, params, solveOpts);
    if (!report.accepted || report.par === null) continue;
    hole.par = report.par;
    const g: GeneratedHole = { hole, archetype, difficulty, report, attempts: attempt + 1, fallback: false };
    if (report.par >= parLo && report.par <= parHi) return g;
    if (!acceptedAny) acceptedAny = g;
  }
  if (acceptedAny) return acceptedAny;

  // Fallback: undecorated skeletons until one passes (almost always the first).
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const rng = root.fork(`fallback:${attempt}`);
    const hole = assemble(o.seed, 100 + attempt, archetype, difficulty, rng, false);
    if (!validateHole(hole).ok || quickReject(hole)) continue;
    const report = solveHole(hole, params, solveOpts);
    if (report.par !== null) {
      hole.par = report.par;
      return { hole, archetype, difficulty, report, attempts: maxAttempts + attempt + 1, fallback: true };
    }
  }
  // Last resort: a straight hole always solves.
  const rng = root.fork('straight');
  const hole = assemble(o.seed, 999, 'straight', 'easy', rng, false);
  const report = solveHole(hole, params, solveOpts);
  hole.par = report.par ?? 2;
  return { hole, archetype: 'straight', difficulty: 'easy', report, attempts: maxAttempts * 2 + 1, fallback: true };
}

/** 9 holes: 2 easy, 5 medium, 2 hard with the hardest at 7 or 8, never last. */
export const COURSE_DIFFICULTY: Difficulty[] = ['easy', 'easy', 'medium', 'medium', 'medium', 'medium', 'hard', 'hard', 'medium'];

export interface GeneratedCourse {
  seed: string;
  holes: GeneratedHole[];
}

export function generateCourse(seed: string, count = 9, params: PhysicsParams = DEFAULT_PARAMS, onProgress?: (i: number, g: GeneratedHole) => void): GeneratedCourse {
  const rng = new Rng(`${seed}:course`);
  const order = rng.shuffle(ARCHETYPES);
  const holes: GeneratedHole[] = [];
  for (let i = 0; i < count; i++) {
    const difficulty = COURSE_DIFFICULTY[i % COURSE_DIFFICULTY.length];
    const g = generateHole({ seed: `${seed}:${i}`, archetype: order[i % order.length], difficulty, params });
    g.hole.id = `${seed}-${i + 1}`;
    holes.push(g);
    onProgress?.(i, g);
  }
  return { seed, holes };
}

/** Today's daily seed (UTC). */
export function dailySeed(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}
