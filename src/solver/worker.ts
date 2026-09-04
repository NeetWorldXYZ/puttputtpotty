/// <reference lib="webworker" />
import type { Hole } from '../sim/types';
import type { PhysicsParams } from '../sim/params';
import { solveHole, type SolveOptions } from './solver';
import { generateCourse, generateHole, type GenerateOptions } from '../generator/generator';

export type WorkerRequest =
  | { kind: 'solve'; id: number; hole: Hole; params: PhysicsParams; options?: Partial<SolveOptions> }
  | { kind: 'generate'; id: number; options: GenerateOptions }
  | { kind: 'course'; id: number; seed: string; count?: number; params: PhysicsParams };

const post = (m: unknown) => (self as unknown as Worker).postMessage(m);

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const req = e.data;
  try {
    if (req.kind === 'solve') {
      post({ id: req.id, report: solveHole(req.hole, req.params, req.options) });
    } else if (req.kind === 'generate') {
      post({ id: req.id, generated: generateHole(req.options) });
    } else {
      const course = generateCourse(req.seed, req.count ?? 9, req.params, (i, g) => post({ id: req.id, progress: i + 1, hole: g.hole }));
      post({ id: req.id, course });
    }
  } catch (err) {
    post({ id: req.id, error: (err as Error).message });
  }
};
