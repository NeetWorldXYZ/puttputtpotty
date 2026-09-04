import type { Hole } from '../sim/types';
import straight from './01-straight.json';
import lBend from './02-l-bend.json';
import splitPath from './03-split-path.json';

/** The course, in play order. Add a new hole by importing its JSON and appending here. */
export const COURSE: Hole[] = [straight as Hole, lBend as Hole, splitPath as Hole];
