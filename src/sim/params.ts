/**
 * Global physics parameters. Every value here is exposed in the dev panel.
 * Defaults come from section 1 of the parameter spec; anything not in the
 * spec is marked as a phase-1 choice.
 */

export interface PhysicsParams {
  /** Ball radius in units. 1 unit = ball diameter, so 0.5. */
  ballRadius: number;
  /** Speed of a full power shot, units/sec. */
  maxPuttVelocity: number;
  /**
   * Power curve exponent. Drag fraction t in [0,1] maps to power t^exp.
   * 1 = linear. >1 compresses the low end so short putts get finer control
   * (which is what the spec's "eased" row is asking for).
   */
  powerCurveExponent: number;
  /**
   * Base friction for felt. Implemented as a velocity damping coefficient:
   * each step v *= (1 - friction * surfaceMultiplier * dt). With 0.85 a full
   * power shot on felt rolls out in ~5.6s / ~70 units, which sits inside
   * the 8s max sim time. Other interpretations of "0.85" (multiplier per
   * second, linear decel) give 30s+ roll-outs, so this is the one that
   * matches the rest of the spec.
   */
  baseFriction: number;
  /** Default wall restitution. 1 = no energy lost. */
  wallRestitution: number;
  /** Speed below which the ball is snapped to rest, units/sec. */
  restThreshold: number;
  /** Ball faster than this over the cup lips out instead of dropping, units/sec. */
  cupCaptureSpeed: number;
  /** Cup radius as a multiple of ball radius. */
  cupRadiusMultiplier: number;
  /** Slope pull, units/sec^2 per grade step. */
  slopeAccelPerGrade: number;
  /** A stroke is force-stopped after this many simulated seconds. */
  maxSimTime: number;

  // --- surfaces (multipliers on baseFriction) — phase-1 choices ---
  frictionTile: number;
  frictionShag: number;
  frictionWet: number;
  frictionSand: number;

  // --- obstacles — from section 4 of the spec ---
  bumperRestitution: number;
  deadWallRestitution: number;
  /** Ball faster than this passes over a curb; slower bounces off it. */
  curbJumpSpeed: number;

  // --- lip-out feel — phase-1 choices ---
  /** Fraction of speed kept after a lip-out. */
  lipOutSpeedKeep: number;
  /** How hard the cup rim deflects a too-fast ball (0 = pass straight over). */
  lipOutDeflect: number;
}

export const DEFAULT_PARAMS: PhysicsParams = {
  ballRadius: 0.5,
  maxPuttVelocity: 75,
  powerCurveExponent: 1.6,
  baseFriction: 0.85,
  wallRestitution: 0.75,
  restThreshold: 0.5,
  cupCaptureSpeed: 18,
  cupRadiusMultiplier: 1.2,
  slopeAccelPerGrade: 12,
  maxSimTime: 8,

  frictionTile: 0.45,
  frictionShag: 2.6,
  frictionWet: 0.18,
  frictionSand: 4.5,

  bumperRestitution: 1.15,
  deadWallRestitution: 0.2,
  curbJumpSpeed: 25,

  lipOutSpeedKeep: 0.82,
  lipOutDeflect: 0.6,
};

/** Metadata used by the dev panel to build sliders. */
export interface ParamMeta {
  key: keyof PhysicsParams;
  label: string;
  min: number;
  max: number;
  step: number;
  group: string;
}

export const PARAM_META: ParamMeta[] = [
  { key: 'ballRadius', label: 'Ball radius', min: 0.25, max: 1, step: 0.01, group: 'Ball' },
  { key: 'maxPuttVelocity', label: 'Max putt velocity', min: 10, max: 120, step: 1, group: 'Ball' },
  { key: 'powerCurveExponent', label: 'Power curve exponent', min: 0.5, max: 3, step: 0.05, group: 'Ball' },
  { key: 'restThreshold', label: 'Rest threshold', min: 0.05, max: 3, step: 0.05, group: 'Ball' },
  { key: 'maxSimTime', label: 'Max sim time (s)', min: 2, max: 20, step: 0.5, group: 'Ball' },

  { key: 'baseFriction', label: 'Base friction (felt)', min: 0.1, max: 3, step: 0.01, group: 'Surfaces' },
  { key: 'frictionTile', label: 'Tile ×', min: 0.05, max: 2, step: 0.01, group: 'Surfaces' },
  { key: 'frictionShag', label: 'Shag ×', min: 1, max: 6, step: 0.05, group: 'Surfaces' },
  { key: 'frictionWet', label: 'Wet ×', min: 0.02, max: 1, step: 0.01, group: 'Surfaces' },
  { key: 'frictionSand', label: 'Sand ×', min: 1, max: 10, step: 0.1, group: 'Surfaces' },
  { key: 'slopeAccelPerGrade', label: 'Slope accel / grade', min: 0, max: 40, step: 0.5, group: 'Surfaces' },

  { key: 'wallRestitution', label: 'Wall restitution', min: 0.1, max: 1.2, step: 0.01, group: 'Walls' },
  { key: 'bumperRestitution', label: 'Bumper restitution', min: 0.5, max: 2, step: 0.01, group: 'Walls' },
  { key: 'deadWallRestitution', label: 'Dead wall restitution', min: 0, max: 1, step: 0.01, group: 'Walls' },
  { key: 'curbJumpSpeed', label: 'Curb jump speed', min: 5, max: 60, step: 0.5, group: 'Walls' },

  { key: 'cupCaptureSpeed', label: 'Cup capture speed', min: 1, max: 60, step: 0.5, group: 'Cup' },
  { key: 'cupRadiusMultiplier', label: 'Cup radius (× ball r)', min: 0.8, max: 3, step: 0.05, group: 'Cup' },
  { key: 'lipOutSpeedKeep', label: 'Lip-out speed kept', min: 0.3, max: 1, step: 0.01, group: 'Cup' },
  { key: 'lipOutDeflect', label: 'Lip-out deflect', min: 0, max: 2, step: 0.05, group: 'Cup' },
];

/** Fixed simulation timestep. Never change at runtime. */
export const FIXED_DT = 1 / 120;

export function cupRadius(p: PhysicsParams): number {
  return p.ballRadius * p.cupRadiusMultiplier;
}

/**
 * Drag fraction -> launch speed. Uses Math.pow, which is only used here at
 * launch time (never inside the step loop) so the core sim stays on
 * correctly-rounded IEEE ops only.
 */
export function powerToSpeed(power: number, p: PhysicsParams): number {
  const t = power < 0 ? 0 : power > 1 ? 1 : power;
  return Math.pow(t, p.powerCurveExponent) * p.maxPuttVelocity;
}
