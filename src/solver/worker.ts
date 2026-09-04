/// <reference lib="webworker" />
import type { Hole } from '../sim/types';
import type { PhysicsParams } from '../sim/params';
import { solveHole, type SolveOptions } from './solver';

export interface SolveRequest {
  id: number;
  hole: Hole;
  params: PhysicsParams;
  options?: Partial<SolveOptions>;
}

self.onmessage = (e: MessageEvent<SolveRequest>) => {
  const { id, hole, params, options } = e.data;
  try {
    const report = solveHole(hole, params, options);
    (self as unknown as Worker).postMessage({ id, report });
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, error: (err as Error).message });
  }
};
