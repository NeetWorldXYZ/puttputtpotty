/**
 * Cartoon renderer. Static layers (surround, props, floor, zones,
 * obstacles, cup, walls) are painted once per hole+scale into an offscreen
 * bitmap and blitted; dynamic things (trail, aim, ball, flashes, labels)
 * draw on top every frame. Same call signature the game and editor used
 * before.
 */

import type { Hole } from '../sim/types';
import { spriteRevision } from './sprites';
import { isMoving } from '../sim/types';
import type { Camera } from './camera';
import { themeById, OUTLINE, type Theme } from './themes';
import { drawFloor, drawSurround } from './floors';
import { ANIMATED_KINDS, drawDecal, drawProp, drawPropAnimated, placeDecals, placeProps, type PropPlacement } from './props';
import { traceRegion, wallLoops, type Region } from './region';
import {
  COLORS,
  drawAim,
  drawBall,
  drawCup,
  drawHazard,
  drawMover,
  drawObstacle,
  drawSlopeZone,
  drawSurfaceZone,
  drawTee,
  drawTrail,
  drawWalls,
  drawWallGlow,
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
  /** Seconds, for animated environment bits. Omit for a still frame. */
  time?: number;
  /** Obstacle clock for moving obstacles (defaults to `time`, else 0). */
  clock?: number;
  /** Hide the static ball drawn by callers (e.g. during the sink animation). */
  extra?: (ctx: CanvasRenderingContext2D) => void;
}

// ---------------------------------------------------------------------------
// Static layer cache

interface StaticLayer {
  canvas: HTMLCanvasElement | OffscreenCanvas;
  ppu: number;
  key: string;
  animated: PropPlacement[];
  region: Region;
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
  const key = `${holeKey(hole)}|${ppu}|${cupR}|${ballR}|${spriteRevision()}`;
  const hit = layerCache.get(key);
  if (hit) return hit;
  const w = Math.max(1, Math.ceil(b.w * ppu));
  const h = Math.max(1, Math.ceil(b.h * ppu));
  const canvas = makeCanvas(w, h);
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  ctx.setTransform(ppu, 0, 0, ppu, -b.x * ppu, -b.y * ppu);
  const { animated, region } = paintStatic(ctx, hole, cupR, ballR);
  const layer: StaticLayer = { canvas, ppu, key, animated, region };
  // Small LRU.
  if (layerCache.size > 6) {
    const first = layerCache.keys().next().value;
    if (first !== undefined) layerCache.delete(first);
  }
  layerCache.set(key, layer);
  return layer;
}

function paintStatic(ctx: CanvasRenderingContext2D, hole: Hole, cupR: number, ballR: number): { animated: PropPlacement[]; region: Region } {
  const theme: Theme = themeById(hole.theme);
  const b = hole.bounds;
  const seed = holeSeed(hole);
  const region = wallLoops(hole);

  // Out of play area + props (animated ones are drawn per frame instead).
  drawSurround(ctx, b, theme);
  const props = placeProps(hole, region, theme);
  const animated: PropPlacement[] = [];
  for (const p of props) {
    if (ANIMATED_KINDS.includes(p.kind)) animated.push(p);
    else drawProp(ctx, p);
  }

  // Floor inside the playable region.
  ctx.save();
  traceRegion(ctx, region);
  ctx.clip('evenodd');
  drawFloor(ctx, b, theme, seed);
  for (const d of placeDecals(hole, region, theme)) drawDecal(ctx, d);
  hole.surfaceZones.forEach((z, i) => drawSurfaceZone(ctx, z, seed + i * 7));
  hole.slopeZones.forEach((z) => drawSlopeZone(ctx, z));
  hole.hazards.forEach((h, i) => drawHazard(ctx, h, hazardSeed(h, i)));
  // Ambient occlusion along the walls: the floor darkens where it meets a pipe.
  if (!region.fallback) {
    ctx.save();
    ctx.globalAlpha = 0.28;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.2;
    ctx.lineJoin = 'round';
    traceRegion(ctx, region);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();

  drawTee(ctx, hole.tee.x, hole.tee.y, ballR);
  hole.obstacles.forEach((o, i) => {
    if (!isMoving(o)) drawObstacle(ctx, o, seed + 31 * i);
  });
  drawCup(ctx, hole.cup.x, hole.cup.y, cupR, 0);
  drawWalls(ctx, hole.walls, theme);

  // Spotlight vignette over the whole bounds.
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  const rMax = Math.hypot(b.w, b.h) * 0.62;
  const grad = ctx.createRadialGradient(cx, cy, rMax * 0.45, cx, cy, rMax);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.38)');
  ctx.fillStyle = grad;
  ctx.fillRect(b.x, b.y, b.w, b.h);
  return { animated, region };
}

/** Per-frame environment life: animated props, water ripples, neon flicker. */
function drawAnimated(ctx: CanvasRenderingContext2D, hole: Hole, layer: StaticLayer, theme: Theme, t: number): void {
  for (const p of layer.animated) drawPropAnimated(ctx, p, t);
  // Water hazards ripple.
  for (const h of hole.hazards) {
    if (h.type !== 'water' && h.type !== 'overflow') continue;
    const c = polygonCentroid(h.polygon);
    ctx.save();
    ctx.strokeStyle = '#ffffff';
    for (let k = 0; k < 2; k++) {
      const ph = ((t * 0.45 + k * 0.5) % 1);
      ctx.globalAlpha = (1 - ph) * 0.55;
      ctx.lineWidth = 0.12;
      ctx.beginPath();
      ctx.ellipse(c.x - 1.2, c.y + 0.9, 0.3 + ph * 2.2, 0.16 + ph * 1.1, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
  if (theme.pipe.style === 'neon') {
    const flick = Math.sin(t * 15) * Math.sin(t * 2.3) > 0.9 ? 0.05 : 0.16 + 0.06 * Math.sin(t * 6);
    drawWallGlow(ctx, hole.walls, theme.pipe.fill, flick);
  }
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
  if (o.time !== undefined) drawAnimated(ctx, hole, layer, theme, o.time);
  const clock = o.clock ?? o.time ?? 0;
  for (const ob of hole.obstacles) if (isMoving(ob)) drawMover(ctx, ob, clock);
  if (o.trailOld && o.trailOld.length >= 4) drawTrail(ctx, o.trailOld, 0.25, 0.18);
  if (o.trail && o.trail.length >= 4) drawTrail(ctx, o.trail, 0.55, 0.22);
  if (o.cupFlash && o.cupFlash > 0) drawCup(ctx, hole.cup.x, hole.cup.y, o.cupRadius, o.cupFlash);
  if (o.aim) drawAim(ctx, o.aim.x, o.aim.y, o.aim.dx, o.aim.dy, o.aim.lengthUnits * (0.25 + 0.75 * o.aim.power), o.aim.cancelling);
  if (o.ball) drawBall(ctx, o.ball.x, o.ball.y, o.ballRadius);
  if (o.extra) o.extra(ctx);

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
