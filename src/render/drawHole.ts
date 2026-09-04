/**
 * Cartoon renderer. Static layers (surround, props, floor, zones,
 * obstacles, cup, walls) are painted once per hole+scale into an offscreen
 * bitmap and blitted; dynamic things (trail, aim, ball, flashes, labels)
 * draw on top every frame. Same call signature the game and editor used
 * before.
 */

import type { Hole } from '../sim/types';
import type { Camera } from './camera';
import { themeById, OUTLINE, type Theme } from './themes';
import { drawFloor, drawSurround } from './floors';
import { drawDecal, drawProp, placeDecals, placeProps } from './props';
import { traceRegion, wallLoops } from './region';
import {
  COLORS,
  drawAim,
  drawBall,
  drawCup,
  drawHazard,
  drawObstacle,
  drawSlopeZone,
  drawSurfaceZone,
  drawTee,
  drawTrail,
  drawWalls,
  hazardSeed,
  holeSeed,
} from './objects';
import { roundRectPath, chunky, polygonCentroid } from './shapes';

export interface AimOverlay {
  x: number;
  y: number;
  dx: number;
  dy: number;
  power: number;
  lengthUnits: number;
  cancelling: boolean;
}

export interface DrawOptions {
  ballRadius: number;
  cupRadius: number;
  ball?: { x: number; y: number } | null;
  trail?: number[];
  trailOld?: number[];
  aim?: AimOverlay | null;
  cupFlash?: number;
  zoneLabels?: boolean;
  overlay?: (ctx: CanvasRenderingContext2D) => void;
  /** Device pixel ratio the target context is scaled by (for bitmap resolution). */
  dpr?: number;
}

// ---------------------------------------------------------------------------
// Static layer cache

interface StaticLayer {
  canvas: HTMLCanvasElement | OffscreenCanvas;
  ppu: number;
  key: string;
}

const layerCache = new Map<string, StaticLayer>();
const holeKeys = new WeakMap<Hole, string>();
const MAX_SIDE = 4096;

function holeKey(hole: Hole): string {
  let k = holeKeys.get(hole);
  if (!k) {
    k = `${hole.id}|${JSON.stringify(hole)}`;
    holeKeys.set(hole, k);
  }
  return k;
}

function makeCanvas(w: number, h: number): HTMLCanvasElement | OffscreenCanvas {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function getStaticLayer(hole: Hole, ppuWanted: number, cupR: number, ballR: number): StaticLayer {
  const b = hole.bounds;
  let ppu = ppuWanted;
  const maxPpu = Math.min(MAX_SIDE / b.w, MAX_SIDE / b.h);
  if (ppu > maxPpu) ppu = maxPpu;
  ppu = Math.round(ppu * 4) / 4;
  const key = `${holeKey(hole)}|${ppu}|${cupR}|${ballR}`;
  const hit = layerCache.get(key);
  if (hit) return hit;
  const w = Math.max(1, Math.ceil(b.w * ppu));
  const h = Math.max(1, Math.ceil(b.h * ppu));
  const canvas = makeCanvas(w, h);
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  ctx.setTransform(ppu, 0, 0, ppu, -b.x * ppu, -b.y * ppu);
  paintStatic(ctx, hole, cupR, ballR);
  const layer = { canvas, ppu, key };
  // Small LRU.
  if (layerCache.size > 6) {
    const first = layerCache.keys().next().value;
    if (first !== undefined) layerCache.delete(first);
  }
  layerCache.set(key, layer);
  return layer;
}

function paintStatic(ctx: CanvasRenderingContext2D, hole: Hole, cupR: number, ballR: number): void {
  const theme: Theme = themeById(hole.theme);
  const b = hole.bounds;
  const seed = holeSeed(hole);
  const region = wallLoops(hole);

  // Out of play area + props.
  drawSurround(ctx, b, theme);
  for (const p of placeProps(hole, region, theme)) drawProp(ctx, p);

  // Floor inside the playable region.
  ctx.save();
  traceRegion(ctx, region);
  ctx.clip('evenodd');
  drawFloor(ctx, b, theme, seed);
  for (const d of placeDecals(hole, region, theme)) drawDecal(ctx, d);
  hole.surfaceZones.forEach((z, i) => drawSurfaceZone(ctx, z, seed + i * 7));
  hole.slopeZones.forEach((z) => drawSlopeZone(ctx, z));
  hole.hazards.forEach((h, i) => drawHazard(ctx, h, hazardSeed(h, i)));
  ctx.restore();

  drawTee(ctx, hole.tee.x, hole.tee.y, ballR);
  hole.obstacles.forEach((o, i) => drawObstacle(ctx, o, seed + 31 * i));
  drawCup(ctx, hole.cup.x, hole.cup.y, cupR, 0);
  drawWalls(ctx, hole.walls, theme);
}

/** Drop cached bitmaps (e.g. after editing). Cheap to call. */
export function invalidateStaticLayers(): void {
  layerCache.clear();
}

// ---------------------------------------------------------------------------

export function drawHole(ctx: CanvasRenderingContext2D, hole: Hole, cam: Camera, o: DrawOptions): void {
  const S = cam.scale;
  const b = hole.bounds;
  const theme = themeById(hole.theme);
  const dpr = o.dpr ?? 1;

  ctx.fillStyle = theme.page;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  const layer = getStaticLayer(hole, S * dpr, o.cupRadius, o.ballRadius);
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(layer.canvas as CanvasImageSource, b.x * S + cam.ox, b.y * S + cam.oy, b.w * S, b.h * S);
  ctx.restore();

  // Dynamic layer in world units.
  ctx.save();
  ctx.translate(cam.ox, cam.oy);
  ctx.scale(S, S);
  if (o.trailOld && o.trailOld.length >= 4) drawTrail(ctx, o.trailOld, 0.25, 0.18);
  if (o.trail && o.trail.length >= 4) drawTrail(ctx, o.trail, 0.55, 0.22);
  if (o.cupFlash && o.cupFlash > 0) drawCup(ctx, hole.cup.x, hole.cup.y, o.cupRadius, o.cupFlash);
  if (o.aim) drawAim(ctx, o.aim.x, o.aim.y, o.aim.dx, o.aim.dy, o.aim.lengthUnits * (0.25 + 0.75 * o.aim.power), o.aim.cancelling);
  if (o.ball) drawBall(ctx, o.ball.x, o.ball.y, o.ballRadius);

  if (o.zoneLabels) {
    const label = (text: string, x: number, y: number) => {
      ctx.save();
      ctx.font = '700 1px Fredoka, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const size = Math.max(0.7, Math.min(1.1, 12 / S));
      ctx.translate(x, y);
      ctx.scale(size, size);
      const w = ctx.measureText(text).width + 0.8;
      roundRectPath(ctx, -w / 2, -0.6, w, 1.2, 0.3);
      chunky(ctx, 'rgba(31,42,68,0.85)', 0.08);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(text, 0, 0.05);
      ctx.restore();
    };
    for (const z of hole.surfaceZones) {
      const c = polygonCentroid(z.polygon);
      label(z.surfaceType, c.x, c.y + 1.4);
    }
    for (const z of hole.slopeZones) {
      const c = polygonCentroid(z.polygon);
      label(`slope ${z.direction}${z.grade}`, c.x, c.y);
    }
    for (const h of hole.hazards) {
      const c = polygonCentroid(h.polygon);
      label(`${h.type} +${h.penalty}`, c.x, c.y + 1.6);
    }
    for (const ob of hole.obstacles) {
      const s = ob.shape;
      const implemented = ['blocker', 'bumper', 'post', 'deadWall', 'curb', 'pipe'].includes(ob.type);
      if (implemented) continue;
      const cx = s.kind === 'rect' ? s.x + s.w / 2 : s.kind === 'circle' ? s.x : polygonCentroid(s.points).x;
      const cy = s.kind === 'rect' ? s.y + s.h / 2 : s.kind === 'circle' ? s.y : polygonCentroid(s.points).y;
      label(ob.type, cx, cy);
    }
  }
  ctx.restore();

  if (o.overlay) o.overlay(ctx);
}

/** Small overview with the viewport rectangle and ball. Flat on purpose. */
export function drawMinimap(
  ctx: CanvasRenderingContext2D,
  hole: Hole,
  x: number,
  y: number,
  w: number,
  h: number,
  viewWorld: { x: number; y: number; w: number; h: number },
  ball: { x: number; y: number } | null,
): void {
  const b = hole.bounds;
  const theme = themeById(hole.theme);
  const s = Math.min(w / b.w, h / b.h);
  const ox = x + (w - b.w * s) / 2 - b.x * s;
  const oy = y + (h - b.h * s) / 2 - b.y * s;
  ctx.save();
  roundRectPath(ctx, x - 5, y - 5, w + 10, h + 10, 6);
  chunky(ctx, 'rgba(31,42,68,0.9)', 2, '#ffffff');
  ctx.fillStyle = theme.floor.a;
  ctx.fillRect(b.x * s + ox, b.y * s + oy, b.w * s, b.h * s);
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  for (const wl of hole.walls) {
    ctx.beginPath();
    ctx.moveTo(wl.a.x * s + ox, wl.a.y * s + oy);
    ctx.lineTo(wl.b.x * s + ox, wl.b.y * s + oy);
    ctx.stroke();
  }
  for (const ob of hole.obstacles) {
    const sh = ob.shape;
    ctx.fillStyle = ob.type === 'bumper' ? COLORS.bumperCore : ob.type === 'post' ? COLORS.plunger : ob.type === 'pipe' ? COLORS.pipe : COLORS.blockerShade;
    if (sh.kind === 'rect') ctx.fillRect(sh.x * s + ox, sh.y * s + oy, sh.w * s, sh.h * s);
    else if (sh.kind === 'circle') {
      ctx.beginPath();
      ctx.arc(sh.x * s + ox, sh.y * s + oy, Math.max(1.5, sh.r * s), 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      sh.points.forEach((p, i) => (i ? ctx.lineTo(p.x * s + ox, p.y * s + oy) : ctx.moveTo(p.x * s + ox, p.y * s + oy)));
      ctx.closePath();
      ctx.fill();
    }
  }
  for (const hz of hole.hazards) {
    ctx.beginPath();
    hz.polygon.forEach((p, i) => (i ? ctx.lineTo(p.x * s + ox, p.y * s + oy) : ctx.moveTo(p.x * s + ox, p.y * s + oy)));
    ctx.closePath();
    ctx.fillStyle = hz.type === 'water' ? COLORS.water : hz.type === 'drain' ? COLORS.drainDark : COLORS.pit;
    ctx.fill();
  }
  ctx.fillStyle = OUTLINE;
  ctx.beginPath();
  ctx.arc(hole.cup.x * s + ox, hole.cup.y * s + oy, Math.max(2.5, s * 0.9), 0, Math.PI * 2);
  ctx.fill();
  if (ball) {
    ctx.beginPath();
    ctx.arc(ball.x * s + ox, ball.y * s + oy, Math.max(3, s * 0.9), 0, Math.PI * 2);
    chunky(ctx, COLORS.ball, 1.5);
  }
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(viewWorld.x * s + ox, viewWorld.y * s + oy, viewWorld.w * s, viewWorld.h * s);
  ctx.restore();
}
