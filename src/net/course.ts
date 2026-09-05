import type { Hole } from '../sim/types';
import { HOLES_PER_COURSE, api, type King, type LocationSummary } from './api';
import type { OsmPlace } from './overpass';

export interface CourseResult {
  location: LocationSummary;
  holes: Hole[];
  par: number;
  king: King | null;
}

/**
 * The server builds a bathroom's course one hole per request (edge CPU
 * budget), so this keeps asking until all holes exist. Transient server
 * errors (a request over budget) are retried a few times.
 */
export async function loadCourse(place: OsmPlace, opts: { onProgress?: (building: number, have: number) => void; signal?: { cancelled: boolean } } = {}): Promise<CourseResult> {
  let failures = 0;
  for (let i = 0; i < 40; i++) {
    if (opts.signal?.cancelled) throw new Error('cancelled');
    try {
      const r = await api.hole(place);
      failures = 0;
      if (r.ready && r.holes.length >= HOLES_PER_COURSE) return { location: r.location, holes: r.holes, par: r.par ?? r.holes.reduce((a, h) => a + h.par, 0), king: r.king };
      opts.onProgress?.(r.building ?? r.holes.length + 1, r.holes.length);
    } catch (e) {
      failures++;
      if (failures >= 4) throw e;
      await new Promise((res) => setTimeout(res, 600 * failures));
      continue;
    }
    await new Promise((res) => setTimeout(res, 150));
  }
  throw new Error('the course is taking too long to build, try again');
}
