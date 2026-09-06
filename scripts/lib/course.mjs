// Course construction shared by the pre-build script and its tests.
import { generateHole, courseSlots } from '../../server/potty/engine.js';
import { bandFor, COURSE_RAMP } from './poi.mjs';

const HOLES = 3;
const MAX_TRIES = 5; // seed variants per hole, like the API
const ATTEMPTS_PER_TRY = 2;

/** The course for one place: same seeds, ramp and naming as the API, full-quality solver. */
export function buildCourse(place) {
  const band = bandFor(place.poi_type, place.id);
  const slots = courseSlots(place.id, HOLES);
  const holes = [];
  let fallbacks = 0;
  for (let i = 0; i < HOLES; i++) {
    const slot = slots[i];
    let hole = null;
    for (let k = 0; k < MAX_TRIES; k++) {
      const seed = k === 0 ? slot.seed : `${slot.seed}:try${k}`;
      const g = generateHole({ seed, archetype: slot.archetype, difficulty: COURSE_RAMP[band.difficulty][i], maxAttempts: ATTEMPTS_PER_TRY });
      if (!g.fallback || k + 1 >= MAX_TRIES) {
        if (g.fallback) fallbacks++;
        hole = g.hole;
        break;
      }
    }
    hole.theme = band.theme;
    hole.id = `${place.id}#${i + 1}`;
    hole.name = `${place.name} ${i + 1}`;
    holes.push(hole);
  }
  return {
    row: {
      id: place.id,
      name: place.name.slice(0, 80),
      poi_type: place.poi_type,
      lat: place.lat,
      lng: place.lng,
      theme: band.theme,
      difficulty: band.difficulty,
      hole: holes[0],
      hole_par: holes[0].par,
      holes,
      par: holes.reduce((a, h) => a + h.par, 0),
      gen_holes: HOLES,
      gen_tries: 0,
      founded_by: null,
    },
    fallbacks,
  };
}
