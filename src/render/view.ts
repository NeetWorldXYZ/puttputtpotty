/**
 * The tilted camera. A pinhole above and behind the ball, pitched down at the
 * floor, so the far end of a hole recedes and walls have height. The physics
 * never sees any of this: the sim stays flat, the camera only changes how it
 * is drawn and how a screen drag maps back onto the floor.
 *
 * World units are the sim's units; z is height above the floor. Screen
 * coordinates are css px on the play canvas.
 */

import type { Rect } from '../sim/types';

/** Angle between the view ray and the floor. Steeper reads more like the old top-down view. */
export const PITCH = (58 * Math.PI) / 180;
/** Focal length as a multiple of the play region height: smaller means stronger perspective. */
const FOCAL = 1.15;

export interface Region2D {
  x0: number;
  y0: number;
  w: number;
  h: number;
}

export interface View extends Region2D {
  /** The point on the floor the camera looks at (screen centre of the play region). */
  tx: number;
  ty: number;
  /** css px per world unit at the look-at point. */
  scale: number;
  pitch: number;
  /** Focal length, css px. */
  f: number;
  /** Screen-shake offset, css px. */
  shakeX: number;
  shakeY: number;
}

export interface Projected {
  x: number;
  y: number;
  /** css px per world unit at this depth. */
  k: number;
  depth: number;
}

export function makeView(region: Region2D, tx: number, ty: number, scale: number, boundsH: number, pitch = PITCH): View {
  // Long holes need a longer lens so the near end never lands behind the camera.
  const f = Math.max(FOCAL * region.h, 1.1 * boundsH * Math.cos(pitch) * scale);
  return { ...region, tx, ty, scale, pitch, f, shakeX: 0, shakeY: 0 };
}

interface Cam {
  cx: number;
  cy: number;
  cz: number;
  cosP: number;
  sinP: number;
  ox: number;
  oy: number;
}

function camOf(v: View): Cam {
  const cosP = Math.cos(v.pitch);
  const sinP = Math.sin(v.pitch);
  const D = v.f / v.scale;
  return { cx: v.tx, cy: v.ty + D * cosP, cz: D * sinP, cosP, sinP, ox: v.x0 + v.w / 2 + v.shakeX, oy: v.y0 + v.h / 2 + v.shakeY };
}

export function project(v: View, x: number, y: number, z = 0): Projected {
  const c = camOf(v);
  const qy = y - c.cy;
  const qz = z - c.cz;
  const depth = -qy * c.cosP - qz * c.sinP;
  const yc = -qy * c.sinP + qz * c.cosP;
  const k = v.f / depth;
  return { x: c.ox + (x - c.cx) * k, y: c.oy - yc * k, k, depth };
}

/** Where a screen point lands on the plane at height z, or null when it points above the horizon. */
export function unproject(v: View, px: number, py: number, z = 0): { x: number; y: number } | null {
  const c = camOf(v);
  const X = (px - c.ox) / v.f;
  const Y = -(py - c.oy) / v.f;
  const dx = X;
  const dy = -Y * c.sinP - c.cosP;
  const dz = Y * c.cosP - c.sinP;
  if (dz >= -1e-6) return null;
  const t = (z - c.cz) / dz;
  return { x: c.cx + dx * t, y: c.cy + dy * t };
}

/**
 * Affine fit of the projection around (x, y, z): the world-to-screen map for
 * things drawn in world units near that point. Exact for the point itself and
 * close enough for anything a few units across.
 */
export function localTransform(ctx: CanvasRenderingContext2D, v: View, x: number, y: number, z: number, dpr: number): Projected {
  const p = project(v, x, y, z);
  const e = 0.05;
  const px = project(v, x + e, y, z);
  const py = project(v, x, y + e, z);
  const a = (px.x - p.x) / e;
  const b = (px.y - p.y) / e;
  const c = (py.x - p.x) / e;
  const d = (py.y - p.y) / e;
  ctx.setTransform(dpr * a, dpr * b, dpr * c, dpr * d, dpr * (p.x - a * x - c * y), dpr * (p.y - b * x - d * y));
  return p;
}

/** Camera-facing sprite transform at a point: world units, no foreshortening. */
export function billboard(ctx: CanvasRenderingContext2D, v: View, x: number, y: number, z: number, dpr: number): Projected {
  const p = project(v, x, y, z);
  ctx.setTransform(dpr * p.k, 0, 0, dpr * p.k, dpr * p.x, dpr * p.y);
  return p;
}

/**
 * CSS matrix3d that lays a floor bitmap onto the screen. The bitmap covers
 * `r` at `ppu` css px per world unit, with transform-origin 0 0 and its box
 * at the canvas origin. Same maths as project(), so the two layers agree.
 */
export function floorMatrix(v: View, r: Rect, ppu: number): string {
  const c = camOf(v);
  // Linear forms in (ex, ey, 1): xc, yc, depth.
  const xc0 = r.x - c.cx;
  const qy0 = r.y - c.cy;
  const yc0 = -qy0 * c.sinP - c.cz * c.cosP;
  const d0 = -qy0 * c.cosP + c.cz * c.sinP;
  const ycY = -c.sinP / ppu;
  const dY = -c.cosP / ppu;
  const xcX = 1 / ppu;
  // X = ox*depth + f*xc ; Y = oy*depth - f*yc ; Z = 0 ; W = depth
  const m = [
    [v.f * xcX, c.ox * dY, 0, c.ox * d0 + v.f * xc0],
    [0, c.oy * dY - v.f * ycY, 0, c.oy * d0 - v.f * yc0],
    [0, 0, 1, 0],
    [0, dY, 0, d0],
  ];
  const cols: string[] = [];
  for (let col = 0; col < 4; col++) for (let row = 0; row < 4; row++) cols.push(String(m[row][col]));
  return `matrix3d(${cols.join(',')})`;
}

function fits(v: View, b: Rect, pad: number): boolean {
  const pts = [
    [b.x, b.y, 0],
    [b.x + b.w, b.y, 0],
    [b.x, b.y + b.h, 0],
    [b.x + b.w, b.y + b.h, 0],
    [b.x, b.y, 4],
    [b.x + b.w, b.y, 4],
  ];
  for (const [x, y, z] of pts) {
    const p = project(v, x, y, z);
    if (p.depth <= 0.1) return false;
    if (p.x < v.x0 + pad || p.x > v.x0 + v.w - pad || p.y < v.y0 + pad || p.y > v.y0 + v.h - pad) return false;
  }
  return true;
}

/** Largest scale that shows the whole bounds inside the region, centred. */
export function fitView(region: Region2D, b: Rect, pad = 0, pitch = PITCH): View {
  let tx = b.x + b.w / 2;
  let ty = b.y + b.h / 2;
  let v = makeView(region, tx, ty, 1, b.h, pitch);
  for (let pass = 0; pass < 3; pass++) {
    let lo = 0.2;
    let hi = 400;
    for (let i = 0; i < 30; i++) {
      const mid = (lo + hi) / 2;
      if (fits(makeView(region, tx, ty, mid, b.h, pitch), b, pad)) lo = mid;
      else hi = mid;
    }
    v = makeView(region, tx, ty, lo, b.h, pitch);
    // Perspective makes the far half shorter on screen: re-centre the projected box.
    const far = project(v, tx, b.y, 0).y;
    const near = project(v, tx, b.y + b.h, 0).y;
    const off = (far + near) / 2 - (region.y0 + region.h / 2);
    ty += off / (lo * Math.sin(pitch));
    tx = b.x + b.w / 2;
  }
  return v;
}

/** Fixed scale, looking at a target clamped so the view stays over the bounds where they are bigger than it. */
export function followView(region: Region2D, b: Rect, scale: number, tx: number, ty: number, pitch = PITCH): View {
  const halfW = region.w / 2 / scale;
  const halfH = region.h / 2 / (scale * Math.sin(pitch));
  const cx = b.w <= halfW * 2 ? b.x + b.w / 2 : Math.min(b.x + b.w - halfW, Math.max(b.x + halfW, tx));
  if (b.h <= halfH * 2) {
    // The whole length fits: centre the projected hole, not its midpoint (perspective shortens the far half).
    let cy = b.y + b.h / 2;
    for (let i = 0; i < 3; i++) {
      const v = makeView(region, cx, cy, scale, b.h, pitch);
      const far = project(v, cx, b.y, 0).y;
      const near = project(v, cx, b.y + b.h, 0).y;
      cy += ((far + near) / 2 - (region.y0 + region.h / 2)) / (scale * Math.sin(pitch));
    }
    return makeView(region, cx, cy, scale, b.h, pitch);
  }
  const cy = Math.min(b.y + b.h - halfH * 0.9, Math.max(b.y + halfH * 0.7, ty));
  return makeView(region, cx, cy, scale, b.h, pitch);
}

/** Rough world rectangle the view covers (for the minimap). */
export function viewRect(v: View): Rect {
  const halfW = v.w / 2 / v.scale;
  const halfH = v.h / 2 / (v.scale * Math.sin(v.pitch));
  return { x: v.tx - halfW, y: v.ty - halfH, w: halfW * 2, h: halfH * 2 };
}
