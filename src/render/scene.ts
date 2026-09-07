/**
 * The tilted-camera renderer for play. The floor (surround, tiles, zones,
 * hazards, decals, shadows) is a flat bitmap the browser lays onto the screen
 * with a CSS 3D transform; this module draws everything that stands up:
 * the slab edge, the pipe walls, solid obstacles, the flag, the ball, and the
 * flat per-frame bits (aim, trail, effects) projected onto the floor.
 *
 * Standing things are painted far to near so a near wall covers the ball and
 * the flag pole never hides behind the back wall.
 */

import type { Hole, Obstacle, Point, Wall } from '../sim/types';
import { isMoving } from '../sim/types';
import { OUTLINE, themeById, type Theme } from './themes';
import type { FloorLayer } from './drawHole';
import { COLORS, SOLID_OBSTACLES, drawBall, drawCup, drawMover, shapePath, type BallStyle } from './objects';
import { drawPropAnimated } from './props';
import { bbox, chunky, circle, dropShadow, highlight, makeRand, polygonCentroid, roundRectPath } from './shapes';
import { billboard, localTransform, project, type View } from './view';
import type { AimOverlay } from './drawHole';

/** Visual thickness of the playable slab below the floor. */
const SLAB = 1.1;
/** Pipe walls: radius and how far they sit above the floor on their plinth. */
const WALL_R = 0.5;
const WALL_LIFT = 0.4;
const FLAG_H = 6;
const HEIGHTS: Record<string, number> = { blocker: 2.0, deadWall: 2.0, bumper: 1.4, post: 1.5 };
/** Wall segments are drawn in short pieces so depth sorting works along a long side wall. */
const CHUNK = 3;

export interface SceneOptions {
  ballRadius: number;
  cupRadius: number;
  dpr: number;
  floor: FloorLayer;
  ball: { x: number; y: number } | null;
  ballStyle?: BallStyle | null;
  squash?: { amt: number; ang: number };
  /** Flush animation: the ball spirals into the cup instead of sitting at `ball`. */
  sink?: { x: number; y: number; t: number } | null;
  trail?: number[];
  trailOld?: number[];
  aim?: AimOverlay | null;
  cupFlash?: number;
  zoneLabels?: boolean;
  time?: number;
  clock?: number;
  /** Particle effects, drawn in world units around the ball. */
  fx?: (ctx: CanvasRenderingContext2D) => void;
}

interface Item {
  /** Nearest world y: bigger is closer to the camera and paints later. */
  y: number;
  draw: () => void;
}

function shade(color: string, k: number): string {
  if (!/^#[0-9a-f]{6}$/i.test(color)) return color;
  const n = parseInt(color.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

function outlinePts(s: Obstacle['shape']): Point[] {
  if (s.kind === 'rect')
    return [
      { x: s.x, y: s.y },
      { x: s.x + s.w, y: s.y },
      { x: s.x + s.w, y: s.y + s.h },
      { x: s.x, y: s.y + s.h },
    ];
  if (s.kind === 'circle') {
    const pts: Point[] = [];
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2;
      pts.push({ x: s.x + Math.cos(a) * s.r, y: s.y + Math.sin(a) * s.r });
    }
    return pts;
  }
  return s.points;
}

function shapeCentre(s: Obstacle['shape']): Point {
  if (s.kind === 'rect') return { x: s.x + s.w / 2, y: s.y + s.h / 2 };
  if (s.kind === 'circle') return { x: s.x, y: s.y };
  return polygonCentroid(s.points);
}

function shapeMaxY(s: Obstacle['shape']): number {
  if (s.kind === 'rect') return s.y + s.h;
  if (s.kind === 'circle') return s.y + s.r;
  return bbox(s.points).maxY;
}

export function drawScene(ctx: CanvasRenderingContext2D, hole: Hole, v: View, o: SceneOptions): void {
  const dpr = o.dpr;
  const theme: Theme = themeById(hole.theme);
  const screen = () => ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  screen();

  // --- slab edge: the floor is a raised block, so its near faces show below the edge
  if (!o.floor.region.fallback) {
    ctx.fillStyle = shade(theme.surroundB, 0.5);
    for (const loop of o.floor.region.loops) {
      let area = 0;
      for (let i = 0; i < loop.length; i++) {
        const p = loop[i];
        const q = loop[(i + 1) % loop.length];
        area += p.x * q.y - q.x * p.y;
      }
      const ccw = area > 0;
      for (let i = 0; i < loop.length; i++) {
        const p = loop[i];
        const q = loop[(i + 1) % loop.length];
        const ex = q.x - p.x;
        const ey = q.y - p.y;
        // outward normal (screen y grows downward, so this is "toward the camera" when ny > 0)
        const ny = ccw ? -ex : ex;
        if (ny <= 0.05 * Math.hypot(ex, ey)) continue;
        const a = project(v, p.x, p.y, 0);
        const b = project(v, q.x, q.y, 0);
        const c = project(v, q.x, q.y, -SLAB);
        const d = project(v, p.x, p.y, -SLAB);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.lineTo(c.x, c.y);
        ctx.lineTo(d.x, d.y);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  // --- flat per-frame life on the floor
  const t = o.time ?? 0;
  for (const p of o.floor.animated) {
    localTransform(ctx, v, p.x, p.y, 0, dpr);
    drawPropAnimated(ctx, p, t);
  }
  if (o.time !== undefined) {
    for (const h of hole.hazards) {
      if (h.type !== 'water' && h.type !== 'overflow') continue;
      const c = polygonCentroid(h.polygon);
      localTransform(ctx, v, c.x, c.y, 0, dpr);
      ctx.save();
      ctx.strokeStyle = '#ffffff';
      for (let k = 0; k < 2; k++) {
        const ph = (t * 0.45 + k * 0.5) % 1;
        ctx.globalAlpha = (1 - ph) * 0.55;
        ctx.lineWidth = 0.12;
        ctx.beginPath();
        ctx.ellipse(c.x - 1.2, c.y + 0.9, 0.3 + ph * 2.2, 0.16 + ph * 1.1, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }
  }
  if (o.cupFlash && o.cupFlash > 0) {
    localTransform(ctx, v, hole.cup.x, hole.cup.y, 0, dpr);
    drawCup(ctx, hole.cup.x, hole.cup.y, o.cupRadius, o.cupFlash);
  }
  screen();
  const trail = (pts: number[], alpha: number, width: number) => {
    if (pts.length < 4) return;
    const k = project(v, pts[pts.length - 2], pts[pts.length - 1], 0).k;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i < pts.length; i += 2) {
      const q = project(v, pts[i], pts[i + 1], 0);
      if (i) ctx.lineTo(q.x, q.y);
      else ctx.moveTo(q.x, q.y);
    }
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = (width + 0.16) * k;
    ctx.stroke();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = width * k;
    ctx.stroke();
    ctx.restore();
  };
  if (o.trailOld) trail(o.trailOld, 0.25, 0.18);
  if (o.trail) trail(o.trail, 0.55, 0.22);
  if (o.aim) drawAimProjected(ctx, v, o.aim);

  // --- standing things, far to near
  const items: Item[] = [];
  const glow = theme.pipe.style === 'neon' ? (Math.sin(t * 15) * Math.sin(t * 2.3) > 0.9 ? 0.05 : 0.16 + 0.06 * Math.sin(t * 6)) : 0;
  for (const w of hole.walls) {
    const len = Math.hypot(w.b.x - w.a.x, w.b.y - w.a.y);
    const n = Math.max(1, Math.ceil(len / CHUNK));
    for (let i = 0; i < n; i++) {
      const a = { x: w.a.x + ((w.b.x - w.a.x) * i) / n, y: w.a.y + ((w.b.y - w.a.y) * i) / n };
      const b = { x: w.a.x + ((w.b.x - w.a.x) * (i + 1)) / n, y: w.a.y + ((w.b.y - w.a.y) * (i + 1)) / n };
      const capA = i === 0;
      const capB = i === n - 1;
      items.push({ y: Math.max(a.y, b.y), draw: () => pipeChunk(ctx, v, a, b, theme.pipe, glow, capA, capB) });
    }
  }
  const seed = hole.id.length;
  hole.obstacles.forEach((ob, i) => {
    if (isMoving(ob)) {
      items.push({
        y: shapeMaxY(ob.shape),
        draw: () => {
          const c = shapeCentre(ob.shape);
          localTransform(ctx, v, c.x, c.y, 0, dpr);
          drawMover(ctx, ob, o.clock ?? o.time ?? 0);
          screen();
        },
      });
      return;
    }
    if (!SOLID_OBSTACLES.includes(ob.type)) return;
    items.push({ y: shapeMaxY(ob.shape), draw: () => solid(ctx, v, ob, HEIGHTS[ob.type] ?? 1.5, seed + i * 31, dpr) });
  });
  items.push({ y: hole.cup.y, draw: () => flag(ctx, v, hole.cup.x, hole.cup.y) });
  if (o.ball) {
    const b = o.ball;
    items.push({
      y: b.y + o.ballRadius,
      draw: () => {
        const r = o.ballRadius;
        if (o.sink) {
          const u = Math.min(1, o.sink.t / 0.75);
          const rad = (1 - u) * 1.1;
          const a = u * Math.PI * 5;
          const sc = 1 - u * 0.85;
          localTransform(ctx, v, o.sink.x, o.sink.y, 0, dpr);
          ctx.translate(o.sink.x + Math.cos(a) * rad, o.sink.y + Math.sin(a) * rad * 0.7);
          ctx.scale(sc, sc);
          drawBall(ctx, 0, 0, r, o.ballStyle, false);
          screen();
          return;
        }
        localTransform(ctx, v, b.x, b.y, 0, dpr);
        dropShadow(ctx, b.x + 0.08, b.y + 0.12, r * 1.05, r * 0.8);
        billboard(ctx, v, b.x, b.y, r, dpr);
        const sq = o.squash;
        if (sq && sq.amt > 0.02) {
          ctx.rotate(sq.ang);
          ctx.scale(1 - 0.32 * sq.amt, 1 + 0.32 * sq.amt);
        }
        drawBall(ctx, 0, 0, r, o.ballStyle, false);
        screen();
      },
    });
  }
  items.sort((a, b) => a.y - b.y);
  for (const it of items) {
    it.draw();
    screen();
  }

  // --- effects and labels on top
  if (o.fx) {
    const at = o.ball ?? hole.cup;
    localTransform(ctx, v, at.x, at.y, 0, dpr);
    o.fx(ctx);
    screen();
  }
  if (o.zoneLabels) {
    const label = (text: string, x: number, y: number) => {
      const p = project(v, x, y, 0);
      const size = Math.max(9, Math.min(14, p.k * 0.9));
      ctx.save();
      ctx.font = `700 ${size}px Fredoka, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const w = ctx.measureText(text).width + size * 0.8;
      roundRectPath(ctx, p.x - w / 2, p.y - size * 0.65, w, size * 1.3, size * 0.35);
      ctx.fillStyle = 'rgba(31,42,68,0.85)';
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillText(text, p.x, p.y + 0.5);
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
  }
  screen();
}

/**
 * One short piece of pipe wall: plinth, round body, specular line. Each pass
 * is a quad whose width follows the perspective at either end, so a long
 * wall tapers smoothly; only the true ends of a wall get round caps.
 */
function pipeChunk(ctx: CanvasRenderingContext2D, v: View, a: Point, b: Point, pipe: Theme['pipe'], glow: number, capA: boolean, capB: boolean): void {
  const R = WALL_R;
  const zc = WALL_LIFT + R;
  // a band of half-width `hw` world units (scaled by depth at each end) at height z, shifted by (dx, dy) world-ish units
  const band = (z: number, hw: number, dx = 0, dy = 0, extraPx = 0) => {
    const p = project(v, a.x, a.y, z);
    const q = project(v, b.x, b.y, z);
    const px = p.x + dx * p.k;
    const py = p.y + dy * p.k;
    const qx = q.x + dx * q.k;
    const qy = q.y + dy * q.k;
    const ex = qx - px;
    const ey = qy - py;
    const len = Math.hypot(ex, ey) || 1;
    const nx = -ey / len;
    const ny = ex / len;
    const wa = hw * p.k + extraPx;
    const wb = hw * q.k + extraPx;
    ctx.beginPath();
    ctx.moveTo(px + nx * wa, py + ny * wa);
    ctx.lineTo(qx + nx * wb, qy + ny * wb);
    ctx.lineTo(qx - nx * wb, qy - ny * wb);
    ctx.lineTo(px - nx * wa, py - ny * wa);
    ctx.closePath();
    if (capA) {
      ctx.moveTo(px + wa, py);
      ctx.arc(px, py, wa, 0, Math.PI * 2);
    }
    if (capB) {
      ctx.moveTo(qx + wb, qy);
      ctx.arc(qx, qy, wb, 0, Math.PI * 2);
    }
    ctx.fill();
  };
  if (glow > 0) {
    ctx.save();
    ctx.globalAlpha = glow;
    ctx.fillStyle = pipe.fill;
    band(zc, R * 2.5);
    ctx.restore();
  }
  const steps = 4;
  ctx.fillStyle = OUTLINE;
  for (let i = 0; i <= steps; i++) band(0.05 + (zc - 0.05) * (i / steps), R, 0, 0, 1.2);
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    ctx.fillStyle = shade(pipe.shade, 0.7 + 0.3 * u);
    band(0.05 + (zc - 0.05) * u, R);
  }
  ctx.fillStyle = pipe.fill;
  band(zc, R);
  band(zc + R * 0.5, R * 0.7);
  if (pipe.style === 'tape' && pipe.alt) {
    // safety tape: alternating stripes along the top
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.max(1, Math.round(len / 1.6));
    ctx.fillStyle = pipe.alt;
    for (let i = 0; i < n; i += 2) {
      const t0 = i / n;
      const t1 = Math.min(1, (i + 1) / n);
      const sa = { x: a.x + (b.x - a.x) * t0, y: a.y + (b.y - a.y) * t0 };
      const sb = { x: a.x + (b.x - a.x) * t1, y: a.y + (b.y - a.y) * t1 };
      const p = project(v, sa.x, sa.y, zc + R * 0.5);
      const q = project(v, sb.x, sb.y, zc + R * 0.5);
      const ex = q.x - p.x;
      const ey = q.y - p.y;
      const l = Math.hypot(ex, ey) || 1;
      const nx = -ey / l;
      const ny = ex / l;
      ctx.beginPath();
      ctx.moveTo(p.x + nx * 0.7 * R * p.k, p.y + ny * 0.7 * R * p.k);
      ctx.lineTo(q.x + nx * 0.7 * R * q.k, q.y + ny * 0.7 * R * q.k);
      ctx.lineTo(q.x - nx * 0.7 * R * q.k, q.y - ny * 0.7 * R * q.k);
      ctx.lineTo(p.x - nx * 0.7 * R * p.k, p.y - ny * 0.7 * R * p.k);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.save();
  ctx.globalAlpha = 0.45;
  ctx.fillStyle = pipe.shade;
  band(zc - R * 0.55, R * 0.25);
  ctx.globalAlpha = pipe.style === 'chrome' || pipe.style === 'gold' ? 1 : 0.85;
  ctx.fillStyle = pipe.highlight;
  band(zc + R * 0.75, R * 0.22, -0.12 * R, 0);
  ctx.restore();
}

/** A raised obstacle: side faces swept up from the floor, then its top face drawn flat at that height. */
function solid(ctx: CanvasRenderingContext2D, v: View, ob: Obstacle, h: number, seed: number, dpr: number): void {
  const s = ob.shape;
  const pts = outlinePts(s);
  const topColor = ob.type === 'blocker' ? COLORS.blocker : ob.type === 'deadWall' ? COLORS.deadWall : ob.type === 'bumper' ? COLORS.bumper : COLORS.plunger;
  const sideColor = ob.type === 'blocker' ? COLORS.blockerShade : ob.type === 'deadWall' ? COLORS.deadWallDot : ob.type === 'bumper' ? '#cfd8e0' : shade(COLORS.plunger, 0.8);
  const path = (z: number) => {
    ctx.beginPath();
    pts.forEach((p, i) => {
      const q = project(v, p.x, p.y, z);
      if (i) ctx.lineTo(q.x, q.y);
      else ctx.moveTo(q.x, q.y);
    });
    ctx.closePath();
  };
  const steps = Math.max(3, Math.round(h * 4));
  ctx.lineJoin = 'round';
  // outline of the whole solid
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2.4;
  for (let i = 0; i <= steps; i++) {
    path((h * i) / steps);
    ctx.stroke();
  }
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    ctx.fillStyle = shade(sideColor, 0.72 + 0.28 * u);
    path(h * u);
    ctx.fill();
  }
  // top face, drawn in world units on the plane at height h
  const c = shapeCentre(s);
  localTransform(ctx, v, c.x, c.y, h, dpr);
  shapePath(ctx, s);
  chunky(ctx, topColor, 0.2);
  switch (ob.type) {
    case 'blocker': {
      ctx.save();
      shapePath(ctx, s);
      ctx.clip();
      const b = s.kind === 'rect' ? { minX: s.x, minY: s.y, maxX: s.x + s.w, maxY: s.y + s.h } : s.kind === 'circle' ? { minX: s.x - s.r, minY: s.y - s.r, maxX: s.x + s.r, maxY: s.y + s.r } : bbox(s.points);
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.6;
      roundRectPath(ctx, b.minX + 0.35, b.minY + 0.3, Math.max(0.4, b.maxX - b.minX - 0.7), Math.max(0.3, (b.maxY - b.minY) * 0.22), 0.3);
      ctx.fill();
      ctx.restore();
      break;
    }
    case 'deadWall': {
      ctx.save();
      shapePath(ctx, s);
      ctx.clip();
      const rand = makeRand(seed);
      const b = s.kind === 'rect' ? { minX: s.x, minY: s.y, maxX: s.x + s.w, maxY: s.y + s.h } : s.kind === 'circle' ? { minX: s.x - s.r, minY: s.y - s.r, maxX: s.x + s.r, maxY: s.y + s.r } : bbox(s.points);
      ctx.fillStyle = COLORS.deadWallDot;
      for (let i = 0; i < ((b.maxX - b.minX) * (b.maxY - b.minY)) / 0.8; i++) {
        circle(ctx, b.minX + rand() * (b.maxX - b.minX), b.minY + rand() * (b.maxY - b.minY), 0.12 + rand() * 0.14);
        ctx.fill();
      }
      ctx.restore();
      break;
    }
    case 'bumper': {
      if (s.kind !== 'circle') break;
      ctx.strokeStyle = '#dfe6ee';
      ctx.lineWidth = 0.12;
      circle(ctx, s.x, s.y, s.r * 0.72);
      ctx.stroke();
      circle(ctx, s.x, s.y, s.r * 0.36);
      chunky(ctx, COLORS.bumperCore, 0.14);
      break;
    }
    case 'post': {
      if (s.kind !== 'circle') break;
      highlight(ctx, s.x - s.r * 0.35, s.y - s.r * 0.35, s.r * 0.28, s.r * 0.2);
      break;
    }
  }
}

function flag(ctx: CanvasRenderingContext2D, v: View, x: number, y: number): void {
  const base = project(v, x, y, 0);
  const top = project(v, x, y, FLAG_H);
  const k = base.k;
  ctx.lineCap = 'round';
  // pole shadow across the floor
  ctx.strokeStyle = 'rgba(0,0,0,0.22)';
  ctx.lineWidth = 0.18 * k;
  ctx.beginPath();
  ctx.moveTo(base.x, base.y);
  const sh = project(v, x + FLAG_H * 0.35, y + FLAG_H * 0.22, 0);
  ctx.lineTo(sh.x, sh.y);
  ctx.stroke();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 0.22 * k + 2;
  ctx.beginPath();
  ctx.moveTo(base.x, base.y);
  ctx.lineTo(top.x, top.y);
  ctx.stroke();
  ctx.strokeStyle = '#eef2f6';
  ctx.lineWidth = 0.22 * k;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(top.x, top.y);
  ctx.lineTo(top.x + 2.4 * k, top.y + 1.0 * k);
  ctx.lineTo(top.x, top.y + 2.0 * k);
  ctx.closePath();
  ctx.fillStyle = '#ff4d5e';
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 1.6;
  ctx.lineJoin = 'round';
  ctx.stroke();
}

function drawAimProjected(ctx: CanvasRenderingContext2D, v: View, aim: AimOverlay): void {
  const len = aim.lengthUnits * (0.25 + 0.75 * aim.power);
  const col = aim.cancelling ? '#8b969c' : COLORS.aim;
  const a = project(v, aim.x, aim.y, 0);
  const ex = aim.x + aim.dx * len;
  const ey = aim.y + aim.dy * len;
  const e = project(v, ex, ey, 0);
  const k = a.k;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (aim.cancelling) ctx.setLineDash([0.4 * k, 0.5 * k]);
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 0.5 * k;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(e.x, e.y);
  ctx.stroke();
  ctx.strokeStyle = col;
  ctx.lineWidth = 0.26 * k;
  ctx.stroke();
  ctx.setLineDash([]);
  const ang = Math.atan2(e.y - a.y, e.x - a.x);
  const hk = e.k;
  ctx.translate(e.x, e.y);
  ctx.rotate(ang);
  ctx.beginPath();
  ctx.moveTo(0.7 * hk, 0);
  ctx.lineTo(-0.5 * hk, -0.65 * hk);
  ctx.lineTo(-0.5 * hk, 0.65 * hk);
  ctx.closePath();
  ctx.fillStyle = col;
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 0.2 * hk;
  ctx.stroke();
  ctx.restore();
  // backswing hint
  const b = project(v, aim.x - aim.dx * len * 0.5, aim.y - aim.dy * len * 0.5, 0);
  ctx.save();
  ctx.setLineDash([0.3 * k, 0.4 * k]);
  ctx.strokeStyle = col;
  ctx.globalAlpha = 0.6;
  ctx.lineWidth = 0.12 * k;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.restore();
}

export type { Wall };
