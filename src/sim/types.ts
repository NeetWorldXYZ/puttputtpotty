/**
 * Hole data format.
 *
 * Units: 1 unit = one ball diameter. x grows to the right, y grows DOWN
 * (canvas convention). Compass directions therefore map as
 * N = -y, S = +y, E = +x, W = -x.
 *
 * Everything in this file must stay a plain JSON-serialisable shape: the
 * same types describe the on-disk JSON, the editor's working copy and the
 * object the simulation compiles from.
 */

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A polygon is an ordered list of vertices; the last edge closes to the first. */
export type Polygon = Point[];

export interface Wall {
  a: Point;
  b: Point;
  /** Optional per-wall restitution override (dead walls, backboards, ...). */
  restitution?: number;
}

export type SurfaceType = 'felt' | 'tile' | 'shag' | 'wet' | 'sand' | 'sticky';

export const SURFACE_TYPES: readonly SurfaceType[] = [
  'felt',
  'tile',
  'shag',
  'wet',
  'sand',
  'sticky',
] as const;

export interface SurfaceZone {
  polygon: Polygon;
  surfaceType: SurfaceType;
}

export type CompassDirection = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

export const COMPASS_DIRECTIONS: readonly CompassDirection[] = [
  'N',
  'NE',
  'E',
  'SE',
  'S',
  'SW',
  'W',
  'NW',
] as const;

export interface SlopeZone {
  polygon: Polygon;
  /** Direction the ball is pulled toward. */
  direction: CompassDirection;
  /** 1 = subtle, 2 = noticeable, 3 = severe. */
  grade: 1 | 2 | 3;
}

export type HazardType = 'drain' | 'water' | 'outOfBounds' | 'pit' | 'overflow';

export const HAZARD_TYPES: readonly HazardType[] = [
  'drain',
  'water',
  'outOfBounds',
  'pit',
  'overflow',
] as const;

/**
 * Where the ball goes after a hazard.
 *  - lastSafe: where the ball was resting before the stroke that found the hazard
 *  - tee:      the tee
 *  - entry:    the point where the ball crossed into the hazard polygon
 */
export type HazardReset = 'lastSafe' | 'tee' | 'entry';

export const HAZARD_RESETS: readonly HazardReset[] = ['lastSafe', 'tee', 'entry'] as const;

export interface Hazard {
  polygon: Polygon;
  type: HazardType;
  /** Penalty strokes added when the ball enters the hazard. */
  penalty: number;
  resetTo: HazardReset;
}

/**
 * Obstacles. Phase 1 only *simulates* `blocker` and `bumper`; the other
 * kinds are declared so later phases can add them without a data migration.
 * Unknown / unimplemented kinds are ignored by the simulation and drawn as
 * an outline by the renderer.
 */
export type ObstacleShape =
  | { kind: 'rect'; x: number; y: number; w: number; h: number }
  | { kind: 'circle'; x: number; y: number; r: number }
  | { kind: 'polygon'; points: Point[] };

/** Plain wall island, any shape. */
export interface BlockerObstacle {
  type: 'blocker';
  shape: ObstacleShape;
  restitution?: number;
}

/** High-restitution circle; adds energy. */
export interface BumperObstacle {
  type: 'bumper';
  shape: { kind: 'circle'; x: number; y: number; r: number };
  restitution?: number;
}

/** Small circular obstacle, punishing to clip. Same physics as a circle blocker. */
export interface PostObstacle {
  type: 'post';
  shape: { kind: 'circle'; x: number; y: number; r: number };
  restitution?: number;
}

/** Absorbs almost all energy on contact. */
export interface DeadWallObstacle {
  type: 'deadWall';
  shape: ObstacleShape;
  restitution?: number;
}

/**
 * Low wall: stops the ball when it is slower than the curb jump speed,
 * fast shots pass straight over. Keep curbs thin (a strip < ball diameter)
 * so the ball can never come to rest inside one.
 */
export interface CurbObstacle {
  type: 'curb';
  shape: ObstacleShape;
  /** Overrides the global curb jump speed. */
  jumpSpeed?: number;
}

/**
 * Pipe / tunnel: a ball whose centre enters the entry circle is carried to
 * `exit` instantly. `mode` 'keep' preserves the velocity vector;
 * 'redirect' keeps the speed but points it along `exitAngle` (radians,
 * y-down). One-way.
 */
export interface PipeObstacle {
  type: 'pipe';
  shape: { kind: 'circle'; x: number; y: number; r: number };
  exit: Point;
  mode: 'keep' | 'redirect';
  exitAngle?: number;
}

/** Reserved for later phases. Declared so the JSON format is forward compatible. */
export interface FutureObstacle {
  type:
    | 'gate'
    | 'rail'
    | 'backboard'
    | 'windmill'
    | 'slidingGate'
    | 'pendulum'
    | 'piston'
    | 'rotatingPlatform'
    | 'flipper'
    | 'whirlpool'
    | 'roller'
    | 'plungerBumper';
  shape: ObstacleShape;
  /** Free-form per-type parameters (period, phase, speed...). */
  params?: Record<string, number | string | boolean>;
}

export type Obstacle = BlockerObstacle | BumperObstacle | PostObstacle | DeadWallObstacle | CurbObstacle | PipeObstacle | FutureObstacle;

/** Obstacle types the simulation actually collides with. */
export const SIMULATED_OBSTACLE_TYPES: readonly string[] = ['blocker', 'bumper', 'post', 'deadWall', 'curb', 'pipe'] as const;

export interface Hole {
  /** Format version, bump on breaking changes. */
  version: 1;
  id: string;
  name: string;
  par: number;
  /** Playfield rectangle. Also acts as an outer wall so the ball can never escape. */
  bounds: Rect;
  walls: Wall[];
  tee: Point;
  cup: Point;
  surfaceZones: SurfaceZone[];
  slopeZones: SlopeZone[];
  hazards: Hazard[];
  obstacles: Obstacle[];
}

/** A stroke, as recorded for replay. Angle in radians (y-down), power in [0, 1]. */
export interface Stroke {
  angle: number;
  power: number;
}

export function emptyHole(id = 'untitled'): Hole {
  return {
    version: 1,
    id,
    name: 'Untitled',
    par: 3,
    bounds: { x: 0, y: 0, w: 30, h: 60 },
    walls: [],
    tee: { x: 15, y: 52 },
    cup: { x: 15, y: 10 },
    surfaceZones: [],
    slopeZones: [],
    hazards: [],
    obstacles: [],
  };
}
