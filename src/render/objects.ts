/**
 * Gameplay objects. Drawn identically in every environment so a hazard
 * always reads as that hazard. World units.
 */

import type { Hazard, Hole, Obstacle, Polygon, SlopeZone, SurfaceZone, Wall } from '../sim/types';
import { compassVector } from '../sim/geometry';
import { OUTLINE, type Theme } from './themes';
import { bbox, chunky, circle, dropShadow, ellipse, highlight, makeRand, polygonCentroid, roundRectPath, roundedPolygonPath, hashString } from './shapes';

export const COLORS = {
  ball: '#ffffff',
  aim: '#ffd166',
  tee: '#ffd166',
  water: '#3a86ff',
  waterLight: '#9be1ff',
  drain: '#6c757d',
  drainDark: '#343a40',
  drainSlot: '#adb5bd',
  pit: '#12131f',
  pitRim: '#4a4d6a',
  overflow: '#4fb3a8',
  oob: '#e63946',
  gum: '#ff69b4',
  gumLight: '#ffb3d9',
  tile: '#bfe9ff',
  tileLight: '#e9f8ff',
  shag: '#f1d3a5',
  shagDark: '#d8b27c',
  wet: '#c7ecff',
  sand: '#e6d3a3',
  sandDot: '#c9ad6b',
  blocker: '#eef2f5',
  blockerShade: '#c9d2da',
  deadWall: '#6b7280',
  deadWallDot: '#4b5563',
  curb: '#ffd60a',
  bumper: '#ffffff',
  bumperCore: '#d9a066',
  plunger: '#e63946',
  plungerHandle: '#d9a066',
  pipe: '#2ec4b6',
  toilet: '#ffffff',
  toiletWater: '#9be1ff',
  trail: 'rgba(255,255,255,0.55)',
};

// ---------------------------------------------------------------------------
// Zones

function shapeRadius(poly: Polygon): number {
  const b = bbox(poly);
  return Math.min(0.9, Math.min(b.maxX - b.minX, b.maxY - b.minY) * 0.18);
}

export function drawSurfaceZone(ctx: CanvasRenderingContext2D, z: SurfaceZone, seed: number): void {
  const poly = z.polygon;
  const rand = makeRand(seed);
  const b = bbox(poly);
  roundedPolygonPath(ctx, poly, shapeRadius(poly));
  ctx.save();
  switch (z.surfaceType) {
    case 'tile':
      chunky(ctx, COLORS.tile, 0.16);
      ctx.clip();
      ctx.strokeStyle = COLORS.tileLight;
      ctx.lineWidth = 0.14;
      ctx.beginPath();
      for (let x = Math.floor(b.minX); x <= b.maxX; x += 2) {
        ctx.moveTo(x, b.minY);
        ctx.lineTo(x, b.maxY);
      }
      for (let y = Math.floor(b.minY); y <= b.maxY; y += 2) {
        ctx.moveTo(b.minX, y);
        ctx.lineTo(b.maxX, y);
      }
      ctx.stroke();
      break;
    case 'shag':
      chunky(ctx, COLORS.shag, 0.16);
      ctx.clip();
      ctx.fillStyle = COLORS.shagDark;
      for (let i = 0; i < ((b.maxX - b.minX) * (b.maxY - b.minY)) / 1.3; i++) {
        circle(ctx, b.minX + rand() * (b.maxX - b.minX), b.minY + rand() * (b.maxY - b.minY), 0.14 + rand() * 0.1);
        ctx.fill();
      }
      break;
    case 'wet':
      chunky(ctx, COLORS.wet, 0.16);
      ctx.clip();
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.7;
      for (let i = 0; i < 3; i++) ellipse(ctx, b.minX + (0.2 + 0.3 * i) * (b.maxX - b.minX), b.minY + (0.25 + 0.25 * i) * (b.maxY - b.minY), 0.9, 0.28), ctx.fill();
      ctx.globalAlpha = 1;
      break;
    case 'sand':
      chunky(ctx, COLORS.sand, 0.16);
      ctx.clip();
      ctx.fillStyle = COLORS.sandDot;
      for (let i = 0; i < ((b.maxX - b.minX) * (b.maxY - b.minY)) / 1.6; i++) {
        circle(ctx, b.minX + rand() * (b.maxX - b.minX), b.minY + rand() * (b.maxY - b.minY), 0.1 + rand() * 0.12);
        ctx.fill();
      }
      break;
    case 'sticky':
      chunky(ctx, COLORS.gum, 0.18);
      ctx.clip();
      ctx.fillStyle = COLORS.gumLight;
      for (let i = 0; i < 4; i++) {
        ellipse(ctx, b.minX + rand() * (b.maxX - b.minX), b.minY + rand() * (b.maxY - b.minY), 0.45, 0.3);
        ctx.fill();
      }
      break;
    default:
      ctx.restore();
      return;
  }
  ctx.restore();
  // Icon: wet-floor cone / gum blob mark so the meaning reads at a glance.
  const c = polygonCentroid(poly);
  const s = Math.min(1.2, Math.min(b.maxX - b.minX, b.maxY - b.minY) * 0.22);
  if (z.surfaceType === 'wet') drawConeIcon(ctx, c.x, c.y, s);
  if (z.surfaceType === 'sticky') drawStickyIcon(ctx, c.x, c.y, s);
}

function drawConeIcon(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.beginPath();
  ctx.moveTo(0, -1.2);
  ctx.lineTo(0.8, 0.8);
  ctx.lineTo(-0.8, 0.8);
  ctx.closePath();
  chunky(ctx, '#ffd60a', 0.14);
  ctx.fillStyle = OUTLINE;
  ctx.fillRect(-0.45, -0.2, 0.9, 0.3);
  ctx.restore();
}

function drawStickyIcon(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 0.16;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-0.9, 0.6);
  ctx.quadraticCurveTo(-0.6, -0.9, 0, 0.2);
  ctx.quadraticCurveTo(0.6, -0.9, 0.9, 0.6);
  ctx.stroke();
  ctx.restore();
}

export function drawSlopeZone(ctx: CanvasRenderingContext2D, z: SlopeZone): void {
  const v = compassVector(z.direction);
  const poly = z.polygon;
  const b = bbox(poly);
  ctx.save();
  roundedPolygonPath(ctx, poly, shapeRadius(poly));
  ctx.clip();
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = OUTLINE;
  ctx.fill();
  ctx.globalAlpha = 1;
  const spacing = 3.2;
  const size = 0.8 + z.grade * 0.25;
  const px = -v.y;
  const py = v.x;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let x = Math.floor(b.minX / spacing) * spacing + spacing / 2; x < b.maxX; x += spacing) {
    for (let y = Math.floor(b.minY / spacing) * spacing + spacing / 2; y < b.maxY; y += spacing) {
      const tipX = x + (v.x * size) / 2;
      const tipY = y + (v.y * size) / 2;
      const baseX = x - (v.x * size) / 2;
      const baseY = y - (v.y * size) / 2;
      ctx.beginPath();
      ctx.moveTo(baseX + px * size * 0.55, baseY + py * size * 0.55);
      ctx.lineTo(tipX, tipY);
      ctx.lineTo(baseX - px * size * 0.55, baseY - py * size * 0.55);
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 0.42;
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 0.2;
      ctx.stroke();
    }
  }
  ctx.restore();
}

export function drawHazard(ctx: CanvasRenderingContext2D, h: Hazard, seed: number): void {
  const poly = h.polygon;
  const b = bbox(poly);
  const c = polygonCentroid(poly);
  const rand = makeRand(seed);
  const iconS = Math.max(0.9, Math.min(1.6, Math.min(b.maxX - b.minX, b.maxY - b.minY) * 0.22));
  roundedPolygonPath(ctx, poly, Math.min(1.4, shapeRadius(poly) * 2));
  ctx.save();
  switch (h.type) {
    case 'water':
      chunky(ctx, COLORS.water, 0.24);
      ctx.clip();
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.85;
      ellipse(ctx, b.minX + (b.maxX - b.minX) * 0.32, b.minY + (b.maxY - b.minY) * 0.3, Math.min(1.6, (b.maxX - b.minX) * 0.2), 0.45);
      ctx.fill();
      ctx.globalAlpha = 0.6;
      ellipse(ctx, b.minX + (b.maxX - b.minX) * 0.7, b.minY + (b.maxY - b.minY) * 0.68, 0.8, 0.28);
      ctx.fill();
      ctx.restore();
      drawDropletIcon(ctx, c.x, c.y, iconS);
      return;
    case 'drain':
      chunky(ctx, COLORS.drain, 0.24);
      ctx.clip();
      ctx.fillStyle = COLORS.drainDark;
      roundedPolygonPath(ctx, poly, Math.min(1.4, shapeRadius(poly) * 2));
      ctx.save();
      ctx.translate(0.35, 0.35);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = COLORS.drainSlot;
      for (let y = b.minY + 0.9; y < b.maxY - 0.5; y += 0.9) {
        roundRectPath(ctx, b.minX + 0.8, y, b.maxX - b.minX - 1.6, 0.4, 0.2);
        ctx.fill();
      }
      ctx.restore();
      return;
    case 'pit':
      chunky(ctx, COLORS.pit, 0.24);
      ctx.clip();
      ctx.strokeStyle = COLORS.pitRim;
      ctx.lineWidth = 0.5;
      roundedPolygonPath(ctx, poly, Math.min(1.4, shapeRadius(poly) * 2));
      ctx.save();
      ctx.translate(0, 0.25);
      ctx.stroke();
      ctx.restore();
      ctx.restore();
      drawPitIcon(ctx, c.x, c.y, iconS);
      return;
    case 'overflow':
      chunky(ctx, COLORS.overflow, 0.24);
      ctx.clip();
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.7;
      for (let i = 0; i < 6; i++) {
        circle(ctx, b.minX + rand() * (b.maxX - b.minX), b.minY + rand() * (b.maxY - b.minY), 0.22 + rand() * 0.25);
        ctx.fill();
      }
      ctx.restore();
      drawWaveIcon(ctx, c.x, c.y, iconS);
      return;
    case 'outOfBounds':
      chunky(ctx, COLORS.oob, 0.24);
      ctx.clip();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      for (let d = b.minX - (b.maxY - b.minY); d < b.maxX; d += 1.8) {
        ctx.moveTo(d, b.minY);
        ctx.lineTo(d + (b.maxY - b.minY), b.maxY);
      }
      ctx.stroke();
      ctx.restore();
      return;
  }
  ctx.restore();
}

function drawDropletIcon(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.beginPath();
  ctx.moveTo(0, -1.1);
  ctx.quadraticCurveTo(0.95, 0.15, 0, 0.85);
  ctx.quadraticCurveTo(-0.95, 0.15, 0, -1.1);
  chunky(ctx, COLORS.waterLight, 0.16);
  highlight(ctx, -0.25, -0.15, 0.16, 0.3);
  ctx.restore();
}

function drawPitIcon(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ellipse(ctx, 0, 0, 1.1, 0.7);
  chunky(ctx, '#000000', 0.16, COLORS.pitRim);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 0.14;
  ctx.beginPath();
  ctx.moveTo(-0.6, -0.5);
  ctx.lineTo(0.6, -0.5);
  ctx.moveTo(-0.9, -0.2);
  ctx.lineTo(0.9, -0.2);
  ctx.stroke();
  ctx.restore();
}

function drawWaveIcon(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 0.34;
  ctx.lineCap = 'round';
  for (let k = -1; k <= 1; k += 2) {
    ctx.beginPath();
    ctx.moveTo(-1.1, k * 0.35);
    ctx.quadraticCurveTo(-0.55, k * 0.35 - 0.6, 0, k * 0.35);
    ctx.quadraticCurveTo(0.55, k * 0.35 + 0.6, 1.1, k * 0.35);
    ctx.stroke();
  }
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 0.16;
  for (let k = -1; k <= 1; k += 2) {
    ctx.beginPath();
    ctx.moveTo(-1.1, k * 0.35);
    ctx.quadraticCurveTo(-0.55, k * 0.35 - 0.6, 0, k * 0.35);
    ctx.quadraticCurveTo(0.55, k * 0.35 + 0.6, 1.1, k * 0.35);
    ctx.stroke();
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Obstacles

function shapePath(ctx: CanvasRenderingContext2D, s: Obstacle['shape']): void {
  if (s.kind === 'rect') roundRectPath(ctx, s.x, s.y, s.w, s.h, Math.min(0.6, s.w / 3, s.h / 3));
  else if (s.kind === 'circle') circle(ctx, s.x, s.y, s.r);
  else roundedPolygonPath(ctx, s.points, 0.5);
}

function shapeShadow(ctx: CanvasRenderingContext2D, s: Obstacle['shape']): void {
  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = OUTLINE;
  ctx.translate(0.2, 0.32);
  shapePath(ctx, s);
  ctx.fill();
  ctx.restore();
}

export function drawObstacle(ctx: CanvasRenderingContext2D, o: Obstacle, seed: number): void {
  const s = o.shape;
  switch (o.type) {
    case 'blocker': {
      shapeShadow(ctx, s);
      shapePath(ctx, s);
      chunky(ctx, COLORS.blocker, 0.24);
      // top highlight band
      ctx.save();
      shapePath(ctx, s);
      ctx.clip();
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.6;
      const b = s.kind === 'rect' ? { minX: s.x, minY: s.y, maxX: s.x + s.w, maxY: s.y + s.h } : s.kind === 'circle' ? { minX: s.x - s.r, minY: s.y - s.r, maxX: s.x + s.r, maxY: s.y + s.r } : bbox(s.points);
      roundRectPath(ctx, b.minX + 0.35, b.minY + 0.3, Math.max(0.4, b.maxX - b.minX - 0.7), Math.max(0.3, (b.maxY - b.minY) * 0.22), 0.3);
      ctx.fill();
      ctx.restore();
      return;
    }
    case 'deadWall': {
      shapeShadow(ctx, s);
      shapePath(ctx, s);
      chunky(ctx, COLORS.deadWall, 0.24);
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
      return;
    }
    case 'curb': {
      shapePath(ctx, s);
      chunky(ctx, COLORS.curb, 0.16);
      ctx.save();
      shapePath(ctx, s);
      ctx.clip();
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 0.35;
      const b = s.kind === 'rect' ? { minX: s.x, minY: s.y, maxX: s.x + s.w, maxY: s.y + s.h } : s.kind === 'circle' ? { minX: s.x - s.r, minY: s.y - s.r, maxX: s.x + s.r, maxY: s.y + s.r } : bbox(s.points);
      ctx.beginPath();
      for (let d = b.minX - (b.maxY - b.minY); d < b.maxX; d += 1.2) {
        ctx.moveTo(d, b.minY);
        ctx.lineTo(d + (b.maxY - b.minY), b.maxY);
      }
      ctx.stroke();
      ctx.restore();
      return;
    }
    case 'post': {
      if (s.kind !== 'circle') return;
      // plunger: rubber cup + handle stub
      dropShadow(ctx, s.x, s.y, s.r, s.r * 0.8);
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = s.r * 0.6 + 0.16;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x + s.r * 1.4, s.y - s.r * 2.0);
      ctx.stroke();
      ctx.strokeStyle = COLORS.plungerHandle;
      ctx.lineWidth = s.r * 0.6;
      ctx.stroke();
      circle(ctx, s.x, s.y, s.r);
      chunky(ctx, COLORS.plunger, 0.22);
      highlight(ctx, s.x - s.r * 0.35, s.y - s.r * 0.35, s.r * 0.28, s.r * 0.2);
      return;
    }
    case 'bumper': {
      if (s.kind !== 'circle') return;
      // toilet-paper roll seen from above
      dropShadow(ctx, s.x, s.y, s.r, s.r * 0.85);
      circle(ctx, s.x, s.y, s.r);
      chunky(ctx, COLORS.bumper, 0.24);
      ctx.strokeStyle = '#dfe6ee';
      ctx.lineWidth = 0.12;
      circle(ctx, s.x, s.y, s.r * 0.72);
      ctx.stroke();
      circle(ctx, s.x, s.y, s.r * 0.36);
      chunky(ctx, COLORS.bumperCore, 0.14);
      // loose sheet
      ctx.beginPath();
      ctx.moveTo(s.x + s.r * 0.95, s.y - s.r * 0.25);
      ctx.lineTo(s.x + s.r * 1.7, s.y - s.r * 0.5);
      ctx.lineTo(s.x + s.r * 1.55, s.y + s.r * 0.1);
      ctx.closePath();
      chunky(ctx, COLORS.bumper, 0.14);
      return;
    }
    case 'pipe': {
      if (s.kind !== 'circle') return;
      // Entry mouth + exit ring with arrow.
      dropShadow(ctx, s.x, s.y, s.r, s.r * 0.85);
      circle(ctx, s.x, s.y, s.r);
      chunky(ctx, COLORS.pipe, 0.24);
      circle(ctx, s.x, s.y, s.r * 0.62);
      ctx.fillStyle = OUTLINE;
      ctx.fill();
      const ex = o.exit.x;
      const ey = o.exit.y;
      ctx.save();
      ctx.setLineDash([0.25, 0.55]);
      ctx.strokeStyle = COLORS.pipe;
      ctx.lineWidth = 0.1;
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.restore();
      circle(ctx, ex, ey, 0.95);
      chunky(ctx, COLORS.pipe, 0.22);
      circle(ctx, ex, ey, 0.5);
      ctx.fillStyle = OUTLINE;
      ctx.fill();
      const a = o.mode === 'redirect' ? (o.exitAngle ?? 0) : Math.atan2(ey - s.y, ex - s.x);
      ctx.save();
      ctx.translate(ex, ey);
      ctx.rotate(a);
      ctx.lineCap = 'round';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(1.0, 0);
      ctx.lineTo(2.3, 0);
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 0.24;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(2.9, 0);
      ctx.lineTo(2.0, -0.55);
      ctx.lineTo(2.0, 0.55);
      ctx.closePath();
      chunky(ctx, '#ffffff', 0.16);
      ctx.restore();
      return;
    }
    default: {
      // Reserved types: dashed outline placeholder.
      ctx.save();
      ctx.setLineDash([0.4, 0.3]);
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 0.18;
      shapePath(ctx, s);
      ctx.stroke();
      ctx.restore();
    }
  }
}

// ---------------------------------------------------------------------------
// Tee, cup, walls

export function drawTee(ctx: CanvasRenderingContext2D, x: number, y: number, ballR: number): void {
  const w = ballR * 4.4;
  const h = ballR * 3;
  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = OUTLINE;
  roundRectPath(ctx, x - w / 2 + 0.15, y - h / 2 + 0.25, w, h, 0.5);
  ctx.fill();
  ctx.restore();
  roundRectPath(ctx, x - w / 2, y - h / 2, w, h, 0.5);
  chunky(ctx, COLORS.tee, 0.22);
  ctx.save();
  ctx.setLineDash([0.35, 0.3]);
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 0.12;
  roundRectPath(ctx, x - w / 2 + 0.55, y - h / 2 + 0.5, w - 1.1, h - 1.0, 0.3);
  ctx.stroke();
  ctx.restore();
}

export function drawCup(ctx: CanvasRenderingContext2D, x: number, y: number, cupR: number, flash = 0): void {
  const rx = cupR * 2.1;
  const ry = cupR * 2.5;
  // tank behind (toward -y)
  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = OUTLINE;
  ellipse(ctx, x + 0.2, y + 0.45, rx, ry);
  ctx.fill();
  ctx.restore();
  roundRectPath(ctx, x - rx * 0.7, y - ry - cupR * 0.9, rx * 1.4, cupR * 1.2, 0.35);
  chunky(ctx, COLORS.toilet, 0.22);
  roundRectPath(ctx, x - cupR * 0.4, y - ry - cupR * 0.6, cupR * 0.8, cupR * 0.5, 0.2);
  ctx.fillStyle = '#c0c8d0';
  ctx.fill();
  ellipse(ctx, x, y + 0.15, rx, ry);
  chunky(ctx, COLORS.toilet, 0.22);
  ellipse(ctx, x, y + 0.25, rx * 0.66, ry * 0.7);
  chunky(ctx, flash > 0 ? COLORS.aim : COLORS.toiletWater, 0.14);
  // the actual capture radius: the dark hole
  circle(ctx, x, y, cupR);
  ctx.fillStyle = OUTLINE;
  ctx.fill();
  if (flash > 0) {
    ctx.save();
    ctx.globalAlpha = flash;
    ctx.strokeStyle = COLORS.aim;
    ctx.lineWidth = 0.22;
    ellipse(ctx, x, y + 0.15, rx + (1 - flash) * 1.2, ry + (1 - flash) * 1.2);
    ctx.stroke();
    ctx.restore();
  }
}

export function drawWalls(ctx: CanvasRenderingContext2D, walls: Wall[], theme: Theme): void {
  const p = theme.pipe;
  const W = 1.0;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const path = () => {
    ctx.beginPath();
    for (const w of walls) {
      ctx.moveTo(w.a.x, w.a.y);
      ctx.lineTo(w.b.x, w.b.y);
    }
  };
  // shadow
  ctx.save();
  ctx.translate(0.2, 0.35);
  ctx.globalAlpha = 0.25;
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = W + 0.3;
  path();
  ctx.stroke();
  ctx.restore();
  if (p.style === 'neon') {
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = p.fill;
    ctx.lineWidth = W + 1.4;
    path();
    ctx.stroke();
    ctx.restore();
  }
  // outline
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = W + 0.48;
  path();
  ctx.stroke();
  // body
  ctx.strokeStyle = p.fill;
  ctx.lineWidth = W;
  path();
  ctx.stroke();
  // style passes
  if (p.style === 'tape' && p.alt) {
    ctx.save();
    ctx.strokeStyle = p.alt;
    ctx.lineWidth = W;
    ctx.setLineDash([1.6, 1.6]);
    ctx.lineCap = 'butt';
    path();
    ctx.stroke();
    ctx.restore();
  } else if (p.style === 'knit' && p.alt) {
    ctx.save();
    ctx.strokeStyle = p.alt;
    ctx.lineWidth = W * 0.55;
    ctx.setLineDash([0.5, 0.5]);
    ctx.lineCap = 'butt';
    path();
    ctx.stroke();
    ctx.restore();
  } else if (p.style === 'bands' || p.style === 'bamboo') {
    ctx.save();
    ctx.strokeStyle = p.style === 'bamboo' ? p.shade : (p.alt ?? p.shade);
    ctx.lineWidth = W + 0.2;
    ctx.setLineDash([0.5, p.style === 'bamboo' ? 3.2 : 5.5]);
    ctx.lineCap = 'butt';
    path();
    ctx.stroke();
    ctx.restore();
  }
  // shade + highlight
  ctx.save();
  ctx.translate(0.16, 0.16);
  ctx.strokeStyle = p.shade;
  ctx.lineWidth = W * 0.22;
  ctx.globalAlpha = 0.7;
  path();
  ctx.stroke();
  ctx.restore();
  ctx.save();
  ctx.translate(-0.17, -0.17);
  ctx.strokeStyle = p.highlight;
  ctx.lineWidth = W * (p.style === 'gold' || p.style === 'chrome' ? 0.3 : 0.22);
  ctx.globalAlpha = 0.9;
  path();
  ctx.stroke();
  ctx.restore();
  if (p.style === 'neon') {
    ctx.save();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = W * 0.16;
    ctx.globalAlpha = 0.9;
    path();
    ctx.stroke();
    ctx.restore();
  }
}

export function drawBall(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  dropShadow(ctx, x, y, r * 1.05, r * 0.75);
  circle(ctx, x, y, r);
  chunky(ctx, COLORS.ball, Math.max(0.12, r * 0.36));
  highlight(ctx, x - r * 0.32, y - r * 0.32, r * 0.28, r * 0.2, 0.95);
}

export function drawAim(ctx: CanvasRenderingContext2D, x: number, y: number, dx: number, dy: number, len: number, cancelling: boolean): void {
  const ex = x + dx * len;
  const ey = y + dy * len;
  const col = cancelling ? '#8b969c' : COLORS.aim;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (cancelling) ctx.setLineDash([0.4, 0.5]);
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(ex, ey);
  ctx.stroke();
  ctx.strokeStyle = col;
  ctx.lineWidth = 0.26;
  ctx.stroke();
  ctx.setLineDash([]);
  const a = Math.atan2(dy, dx);
  ctx.translate(ex, ey);
  ctx.rotate(a);
  ctx.beginPath();
  ctx.moveTo(0.7, 0);
  ctx.lineTo(-0.5, -0.65);
  ctx.lineTo(-0.5, 0.65);
  ctx.closePath();
  chunky(ctx, col, 0.2);
  ctx.restore();
  // backswing hint
  ctx.save();
  ctx.setLineDash([0.3, 0.4]);
  ctx.strokeStyle = col;
  ctx.globalAlpha = 0.6;
  ctx.lineWidth = 0.12;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - dx * len * 0.5, y - dy * len * 0.5);
  ctx.stroke();
  ctx.restore();
}

export function drawTrail(ctx: CanvasRenderingContext2D, pts: number[], alpha: number, width: number): void {
  if (pts.length < 4) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = width + 0.16;
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.stroke();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = width;
  ctx.stroke();
  ctx.restore();
}

export function hazardSeed(h: Hazard, i: number): number {
  return hashString(`${h.type}:${i}:${h.polygon[0]?.x}`);
}

export function holeSeed(hole: Hole): number {
  return hashString(hole.id);
}
