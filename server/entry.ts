// Bundled for the Supabase edge function: everything the verifier needs, no DOM.
export { generateHole, generateSlot, courseSlots } from '../src/generator/generator';
export { replay } from '../src/sim/replay';
export { validateHole } from '../src/sim/validate';
export { DEFAULT_PARAMS } from '../src/sim/params';
export { holeScore } from '../src/sim/sim';
export type { Hole, Stroke } from '../src/sim/types';
export { nameProblem, placeNameProblem, sloganProblem } from '../src/net/wordfilter';
export { normalizeAvatar, randomAvatar } from '../src/game/avatarParts';
export { solveHole } from '../src/solver/solver';
