/**
 * Canvas renderer shared by the play view and the editor. Draws the hole
 * geometry from the Hole data; dynamic things (ball, trail, aim) are passed
 * in via DrawOptions so this stays stateless.
 */

import type { Hole, Polygon } from '../sim/types';
import { compassVector } from '../sim/geometry';
import type { Camera } from './camera';
import { PALETTE, surfaceColor } from './palette';

export interface AimOverlay {
  /** Ball position (world). */
  x: number;
  y: number;
  /** Unit shot direction. */
  dx: number;
  dy: number;
  /** 0..1 */
  power: number;
  /** Line length in world units at full power. */
  lengthUnits: number;
  cancelling: boolean;
}

export interface DrawOptions {
  ballRadius: number;
  cupRadius: number;
  ball?: { x: number; y: number } | null;
  /** Flat x,y pairs (world). */
  trail?: number[];
  trailOld?: number[];
  aim?: AimOverlay | null;
  /** 0..1, ring flash after a lip-out. */
  cupFlash?: number;
  /** Draw type labels on zones (editor). */
  zoneLabels?: boolean;
  /** Extra drawing on top, in screen space. */
  overlay?: (ctx: CanvasRenderingContext2D) => void;
}

function tracePolygon(ctx: CanvasRenderingContext2D, cam: Camera, poly: Polygon): void {
  ctx.beginPath();
  poly.forEach((p, i) => {
    const sx = p.x * cam.scale + cam.ox;
    const sy = p.y * cam.scale + cam.oy;
    if (i === 0) ctx.moveTo(sx, sy);
    else ctx.lineTo(sx, sy);
  });
  ctx.closePath();
}

function polygonCentroid(poly: Polygon): { x: number; y: number } {
  let x = 0;
  let y = 0;
  for (const p of poly) {
    x += p.x;
    y += p.y;
  }
  return { x: x / poly.length, y: y / poly.length };
}

function drawSlopeArrows(ctx: CanvasRenderingContext2D, cam: Camera, poly: Polygon, direction: string, grade: number): void {
  // Chevrons on a grid inside the polygon's AABB, clipped to the polygon.
  const v = compassVector(direction);
  if (v.x === 0 && v.y === 0) return;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of poly) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  ctx.save();
  tracePolygon(ctx, cam, poly);
  ctx.clip();
  ctx.strokeStyle = PALETTE.slopeArrow;
  ctx.lineWidth = Math.max(1, cam.scale * 0.12);
  ctx.lineCap = 'round';
  const spacing = 4;
  const size = 0.9 + grade * 0.25;
  const px = -v.y;
  const py = v.x;
  for (let x = Math.floor(minX / spacing) * spacing + spacing / 2; x < maxX; x += spacing) {
    for (let y = Math.floor(minY / spacing) * spacing + spacing / 2; y < maxY; y += spacing) {
      // chevron: tip at (x,y) + v*size/2, arms back along -v ± perpendicular
      const tipX = x + (v.x * size) / 2;
      const tipY = y + (v.y * size) / 2;
      const baseX = x - (v.x * size) / 2;
      const baseY = y - (v.y * size) / 2;
      ctx.beginPath();
      ctx.moveTo((baseX + px * size * 0.5) * cam.scale + cam.ox, (baseY + py * size * 0.5) * cam.scale + cam.oy);
      ctx.lineTo(tipX * cam.scale + cam.ox, tipY * cam.scale + cam.oy);
      ctx.lineTo((baseX - px * size * 0.5) * cam.scale + cam.ox, (baseY - py * size * 0.5) * cam.scale + cam.oy);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawLabel(ctx: CanvasRenderingContext2D, cam: Camera, poly: Polygon, text: string): void {
  const c = polygonCentroid(poly);
  ctx.save();
  ctx.font = `${Math.max(10, cam.scale * 0.9)}px system-ui, sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, c.x * cam.scale + cam.ox, c.y * cam.scale + cam.oy);
  ctx.restore();
}

function drawPolyline(ctx: CanvasRenderingContext2D, cam: Camera, pts: number[]): void {
  if (pts.length < 4) return;
  ctx.beginPath();
  ctx.moveTo(pts[0] * cam.scale + cam.ox, pts[1] * cam.scale + cam.oy);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i] * cam.scale + cam.ox, pts[i + 1] * cam.scale + cam.oy);
  ctx.stroke();
}

export function drawHole(ctx: CanvasRenderingContext2D, hole: Hole, cam: Camera, o: DrawOptions): void {
  const S = cam.scale;
  const b = hole.bounds;

  // Playfield base (felt) inside the bounds; outside is "out of play".
  ctx.fillStyle = PALETTE.outOfPlay;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.fillStyle = PALETTE.felt;
  ctx.fillRect(b.x * S + cam.ox, b.y * S + cam.oy, b.w * S, b.h * S);

  // Surface zones.
  for (const z of hole.surfaceZones) {
    tracePolygon(ctx, cam, z.polygon);
    ctx.fillStyle = surfaceColor(z.surfaceType);
    ctx.fill();
    if (z.surfaceType === 'sticky' || z.surfaceType === 'sand') {
      // dotted edge so special surfaces read at a glance
      ctx.save();
      ctx.setLineDash([S * 0.3, S * 0.3]);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }
    if (o.zoneLabels) drawLabel(ctx, cam, z.polygon, z.surfaceType);
  }

  // Slope zones: chevrons only, base colour stays whatever surface is under.
  for (const z of hole.slopeZones) {
    drawSlopeArrows(ctx, cam, z.polygon, z.direction, z.grade);
    if (o.zoneLabels) drawLabel(ctx, cam, z.polygon, `slope ${z.direction}${z.grade}`);
  }

  // Hazards.
  for (const h of hole.hazards) {
    tracePolygon(ctx, cam, h.polygon);
    ctx.fillStyle = PALETTE.hazard;
    ctx.fill();
    ctx.strokeStyle = PALETTE.hazardEdge;
    ctx.lineWidth = Math.max(1.5, S * 0.12);
    ctx.stroke();
    if (o.zoneLabels) drawLabel(ctx, cam, h.polygon, `${h.type} +${h.penalty}`);
  }

  // Obstacles.
  for (const ob of hole.obstacles) {
    const s = ob.shape;
    const t = ob.type;
    const implemented = t === 'blocker' || t === 'bumper' || t === 'post' || t === 'deadWall' || t === 'curb';
    let fill: string = PALETTE.blocker;
    let stroke: string = PALETTE.blockerEdge;
    let lw = Math.max(2, S * 0.18);
    if (t === 'bumper') {
      fill = PALETTE.bumper;
      stroke = PALETTE.bumperEdge;
    } else if (t === 'post') {
      fill = PALETTE.blockerEdge;
      stroke = PALETTE.blockerEdge;
    } else if (t === 'deadWall') {
      fill = PALETTE.deadWall;
      stroke = PALETTE.wallDead;
      lw = Math.max(2, S * 0.28);
    } else if (t === 'curb') {
      fill = PALETTE.curb;
      stroke = PALETTE.accent;
      lw = Math.max(1, S * 0.1);
    } else if (!implemented) {
      fill = 'transparent';
      stroke = PALETTE.textDim;
    }
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.save();
    if (t === 'curb') ctx.setLineDash([S * 0.2, S * 0.4]);
    if (s.kind === 'rect') {
      ctx.fillRect(s.x * S + cam.ox, s.y * S + cam.oy, s.w * S, s.h * S);
      ctx.strokeRect(s.x * S + cam.ox, s.y * S + cam.oy, s.w * S, s.h * S);
    } else if (s.kind === 'circle') {
      ctx.beginPath();
      ctx.arc(s.x * S + cam.ox, s.y * S + cam.oy, s.r * S, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      if (t === 'bumper') {
        ctx.beginPath();
        ctx.arc(s.x * S + cam.ox, s.y * S + cam.oy, s.r * S * 0.45, 0, Math.PI * 2);
        ctx.fillStyle = PALETTE.bumperEdge;
        ctx.fill();
      }
    } else {
      tracePolygon(ctx, cam, s.points);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
    if (o.zoneLabels && !implemented) {
      const cx = s.kind === 'rect' ? s.x + s.w / 2 : s.kind === 'circle' ? s.x : polygonCentroid(s.points).x;
      const cy = s.kind === 'rect' ? s.y + s.h / 2 : s.kind === 'circle' ? s.y : polygonCentroid(s.points).y;
      drawLabel(ctx, cam, [{ x: cx, y: cy }], ob.type);
    }
  }

  // Tee.
  ctx.save();
  ctx.setLineDash([S * 0.25, S * 0.25]);
  ctx.strokeStyle = PALETTE.tee;
  ctx.lineWidth = Math.max(1, S * 0.1);
  ctx.beginPath();
  ctx.arc(hole.tee.x * S + cam.ox, hole.tee.y * S + cam.oy, o.ballRadius * S * 1.6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // Old trail then current trail.
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (o.trailOld && o.trailOld.length >= 4) {
    ctx.strokeStyle = PALETTE.trailOld;
    ctx.lineWidth = Math.max(1, S * 0.16);
    drawPolyline(ctx, cam, o.trailOld);
  }
  if (o.trail && o.trail.length >= 4) {
    ctx.strokeStyle = PALETTE.trail;
    ctx.lineWidth = Math.max(1.5, S * 0.22);
    drawPolyline(ctx, cam, o.trail);
  }

  // Cup.
  {
    const cx = hole.cup.x * S + cam.ox;
    const cy = hole.cup.y * S + cam.oy;
    const cr = o.cupRadius * S;
    ctx.beginPath();
    ctx.arc(cx, cy, cr, 0, Math.PI * 2);
    ctx.fillStyle = PALETTE.cup;
    ctx.fill();
    ctx.lineWidth = Math.max(2, S * 0.16);
    ctx.strokeStyle = o.cupFlash && o.cupFlash > 0 ? PALETTE.cupFlash : PALETTE.cupRing;
    ctx.stroke();
    if (o.cupFlash && o.cupFlash > 0) {
      ctx.beginPath();
      ctx.arc(cx, cy, cr + S * 0.6 * (1 - o.cupFlash), 0, Math.PI * 2);
      ctx.strokeStyle = PALETTE.cupFlash;
      ctx.lineWidth = Math.max(1, S * 0.1);
      ctx.stroke();
    }
  }

  // Walls.
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const w of hole.walls) {
    ctx.beginPath();
    ctx.moveTo(w.a.x * S + cam.ox, w.a.y * S + cam.oy);
    ctx.lineTo(w.b.x * S + cam.ox, w.b.y * S + cam.oy);
    const dead = w.restitution !== undefined && w.restitution < 0.5;
    ctx.strokeStyle = dead ? PALETTE.wallDead : PALETTE.wall;
    ctx.lineWidth = Math.max(2, S * (dead ? 0.32 : 0.24));
    ctx.stroke();
  }

  // Aim line + drag indicator.
  if (o.aim) {
    const a = o.aim;
    const len = a.lengthUnits * (0.25 + 0.75 * a.power);
    const bx = a.x * S + cam.ox;
    const by = a.y * S + cam.oy;
    const ex = (a.x + a.dx * len) * S + cam.ox;
    const ey = (a.y + a.dy * len) * S + cam.oy;
    ctx.save();
    ctx.strokeStyle = a.cancelling ? PALETTE.textDim : PALETTE.aim;
    ctx.lineWidth = Math.max(2, S * 0.18);
    ctx.setLineDash(a.cancelling ? [4, 6] : []);
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.setLineDash([]);
    // arrow head
    const ah = Math.max(6, S * 0.6);
    const ang = Math.atan2(ey - by, ex - bx);
    ctx.fillStyle = a.cancelling ? PALETTE.textDim : PALETTE.aim;
    ctx.beginPath();
    ctx.moveTo(ex, ey);
    ctx.lineTo(ex - ah * Math.cos(ang - 0.5), ey - ah * Math.sin(ang - 0.5));
    ctx.lineTo(ex - ah * Math.cos(ang + 0.5), ey - ah * Math.sin(ang + 0.5));
    ctx.closePath();
    ctx.fill();
    // faint backswing line behind the ball
    ctx.strokeStyle = PALETTE.aimDim;
    ctx.lineWidth = Math.max(1, S * 0.1);
    ctx.setLineDash([3, 5]);
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx - a.dx * len * S * 0.5, by - a.dy * len * S * 0.5);
    ctx.stroke();
    ctx.restore();
  }

  // Ball.
  if (o.ball) {
    ctx.beginPath();
    ctx.arc(o.ball.x * S + cam.ox, o.ball.y * S + cam.oy, o.ballRadius * S, 0, Math.PI * 2);
    ctx.fillStyle = PALETTE.ball;
    ctx.fill();
    ctx.lineWidth = Math.max(1, S * 0.08);
    ctx.strokeStyle = PALETTE.ballEdge;
    ctx.stroke();
  }

  if (o.overlay) o.overlay(ctx);
}

/** Small overview of the hole with the viewport rectangle and ball. */
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
  const s = Math.min(w / b.w, h / b.h);
  const ox = x + (w - b.w * s) / 2 - b.x * s;
  const oy = y + (h - b.h * s) / 2 - b.y * s;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(x - 4, y - 4, w + 8, h + 8);
  ctx.fillStyle = PALETTE.felt;
  ctx.fillRect(b.x * s + ox, b.y * s + oy, b.w * s, b.h * s);
  ctx.strokeStyle = PALETTE.wall;
  ctx.lineWidth = 1;
  for (const wl of hole.walls) {
    ctx.beginPath();
    ctx.moveTo(wl.a.x * s + ox, wl.a.y * s + oy);
    ctx.lineTo(wl.b.x * s + ox, wl.b.y * s + oy);
    ctx.stroke();
  }
  for (const ob of hole.obstacles) {
    const sh = ob.shape;
    ctx.fillStyle = ob.type === 'bumper' ? PALETTE.bumper : PALETTE.blocker;
    if (sh.kind === 'rect') ctx.fillRect(sh.x * s + ox, sh.y * s + oy, sh.w * s, sh.h * s);
    else if (sh.kind === 'circle') {
      ctx.beginPath();
      ctx.arc(sh.x * s + ox, sh.y * s + oy, sh.r * s, 0, Math.PI * 2);
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
    ctx.fillStyle = PALETTE.hazard;
    ctx.fill();
  }
  ctx.fillStyle = PALETTE.cupRing;
  ctx.beginPath();
  ctx.arc(hole.cup.x * s + ox, hole.cup.y * s + oy, Math.max(2, s * 0.8), 0, Math.PI * 2);
  ctx.fill();
  if (ball) {
    ctx.fillStyle = PALETTE.accent;
    ctx.beginPath();
    ctx.arc(ball.x * s + ox, ball.y * s + oy, Math.max(2.5, s * 0.8), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 1;
  ctx.strokeRect(viewWorld.x * s + ox, viewWorld.y * s + oy, viewWorld.w * s, viewWorld.h * s);
  ctx.restore();
}
