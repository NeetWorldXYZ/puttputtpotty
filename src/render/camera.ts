import type { Rect } from '../sim/types';

/** screen = world * scale + offset */
export interface Camera {
  scale: number;
  ox: number;
  oy: number;
}

export function worldToScreen(cam: Camera, x: number, y: number): { x: number; y: number } {
  return { x: x * cam.scale + cam.ox, y: y * cam.scale + cam.oy };
}

export function screenToWorld(cam: Camera, sx: number, sy: number): { x: number; y: number } {
  return { x: (sx - cam.ox) / cam.scale, y: (sy - cam.oy) / cam.scale };
}

/** Scale that fits the whole rect into the viewport. */
export function fitScale(bounds: Rect, viewW: number, viewH: number, pad = 0): number {
  return Math.min((viewW - pad * 2) / bounds.w, (viewH - pad * 2) / bounds.h);
}

export function fitCamera(bounds: Rect, viewW: number, viewH: number, pad = 0): Camera {
  const scale = fitScale(bounds, viewW, viewH, pad);
  const ox = (viewW - bounds.w * scale) / 2 - bounds.x * scale;
  const oy = (viewH - bounds.h * scale) / 2 - bounds.y * scale;
  return { scale, ox, oy };
}

/**
 * Camera at a fixed scale centred on a target, clamped so the view never
 * shows outside the bounds on an axis where the bounds are bigger than the
 * view (and centred on the axis where they are smaller).
 */
export function followCamera(bounds: Rect, viewW: number, viewH: number, scale: number, tx: number, ty: number): Camera {
  const worldW = bounds.w * scale;
  const worldH = bounds.h * scale;
  let ox: number;
  let oy: number;
  if (worldW <= viewW) ox = (viewW - worldW) / 2 - bounds.x * scale;
  else {
    ox = viewW / 2 - tx * scale;
    const min = viewW - (bounds.x + bounds.w) * scale;
    const max = -bounds.x * scale;
    if (ox < min) ox = min;
    if (ox > max) ox = max;
  }
  if (worldH <= viewH) oy = (viewH - worldH) / 2 - bounds.y * scale;
  else {
    oy = viewH / 2 - ty * scale;
    const min = viewH - (bounds.y + bounds.h) * scale;
    const max = -bounds.y * scale;
    if (oy < min) oy = min;
    if (oy > max) oy = max;
  }
  return { scale, ox, oy };
}
