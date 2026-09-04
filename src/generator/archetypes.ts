/**
 * Hole archetypes. Each builds the playable area as convex cells plus tee,
 * cup and a spine (waypoints tee -> cup) that decoration uses to reason
 * about "along the route". Everything lives inside a 30-wide portrait
 * playfield, x in [1, 29], y from 2 downward; the tee is near the bottom.
 */

import type { Obstacle, Polygon, Point } from '../sim/types';
import { beam, miterJoint, rect, regularPolygon, roundPoly, trapezoid } from './geom';
import type { Rng } from './rng';

export const ARCHETYPES = [
  'straight',
  'lBend',
  'dogleg',
  'sCurve',
  'zFold',
  'splitPath',
  'forkMerge',
  'loopAround',
  'chamber',
  'funnel',
  'bottleneck',
  'switchback',
  'cross',
  'ring',
] as const;
export type Archetype = (typeof ARCHETYPES)[number];

export type LengthClass = 'short' | 'medium' | 'long';
export type WidthClass = 'tight' | 'normal' | 'wide';

export interface ArchetypeParams {
  length: LengthClass;
  width: WidthClass;
}

export interface Skeleton {
  archetype: Archetype;
  cells: Polygon[];
  tee: Point;
  cup: Point;
  /** Waypoints tee -> cup, through the cells. */
  spine: Point[];
  /** Islands that are part of the archetype (split path, ring, ...). */
  islands: Obstacle[];
  /** Cells where decoration is allowed (excludes tiny joints). */
  decorable: Polygon[];
  height: number;
}

const X0 = 1;
const X1 = 29;
const XC = 15;
const TOP = 2;

function lengthUnits(rng: Rng, l: LengthClass): number {
  return l === 'short' ? rng.range(26, 40) : l === 'medium' ? rng.range(40, 68) : rng.range(68, 100);
}
function widthUnits(rng: Rng, w: WidthClass): number {
  return w === 'tight' ? rng.range(4.5, 6) : w === 'normal' ? rng.range(7, 10) : rng.range(11, 16);
}

function finish(sk: Omit<Skeleton, 'height' | 'decorable'> & { decorable?: Polygon[] }): Skeleton {
  // Safety net: slide the whole skeleton so it sits inside x in [0.5, 29.5] and y >= 1.
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  for (const c of sk.cells) for (const p of c) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
  }
  let dx = 0;
  if (minX < 0.5) dx = 0.5 - minX;
  else if (maxX > 29.5) dx = 29.5 - maxX;
  const dy = minY < 1 ? 1 - minY : 0;
  const mv = (p: Point): Point => ({ x: p.x + dx, y: p.y + dy });
  const cells = sk.cells.map((c) => c.map(mv));
  const decorable = (sk.decorable ?? sk.cells).map((c) => c.map(mv));
  const islands = sk.islands.map((o) => {
    const s = o.shape;
    if (s.kind === 'polygon') return { ...o, shape: { kind: 'polygon' as const, points: roundPoly(s.points.map(mv)) } };
    return { ...o, shape: { ...s, x: s.x + dx, y: s.y + dy } };
  }) as Obstacle[];
  let maxY = 0;
  for (const c of cells) for (const p of c) maxY = Math.max(maxY, p.y);
  const tee = mv(sk.tee);
  const cup = mv(sk.cup);
  return {
    ...sk,
    cells: cells.map(roundPoly),
    decorable: decorable.map(roundPoly),
    islands,
    spine: sk.spine.map(mv),
    tee: { x: Math.round(tee.x * 2) / 2, y: Math.round(tee.y * 2) / 2 },
    cup: { x: Math.round(cup.x * 2) / 2, y: Math.round(cup.y * 2) / 2 },
    height: Math.max(36, Math.ceil(maxY + 3)),
  };
}

// ---------------------------------------------------------------------------

function straight(rng: Rng, p: ArchetypeParams): Skeleton {
  const L = lengthUnits(rng, p.length);
  const w = widthUnits(rng, p.width);
  const variance = rng.pick(['constant', 'constant', 'narrowing', 'widening']);
  const wTop = variance === 'narrowing' ? Math.max(4, w * 0.6) : variance === 'widening' ? Math.min(18, w * 1.5) : w;
  const cell = trapezoid(XC, TOP, TOP + L, wTop, w);
  return finish({
    archetype: 'straight',
    cells: [cell],
    tee: { x: XC, y: TOP + L - 4 },
    cup: { x: XC + rng.range(-1, 1) * (wTop / 4), y: TOP + 4 },
    spine: [
      { x: XC, y: TOP + L - 4 },
      { x: XC, y: TOP + 4 },
    ],
    islands: [],
  });
}

function lBend(rng: Rng, p: ArchetypeParams): Skeleton {
  const L = lengthUnits(rng, p.length);
  const w = Math.min(widthUnits(rng, p.width), 10);
  const dir = rng.sign(); // -1: turn left (west), +1: turn right
  const legV = Math.max(18, L * 0.6);
  const legH = Math.max(12, Math.min(L - legV + w, 26 - w));
  const vx = dir < 0 ? X1 - w : X0; // vertical leg hugs one side
  const vertical = rect(vx, TOP, w, legV);
  const hy = TOP;
  const hx = dir < 0 ? vx + w - legH : vx;
  const horizontal = rect(Math.max(X0, hx), hy, Math.min(legH, 28), w);
  const cupX = dir < 0 ? Math.max(X0 + 3, hx + 3) : Math.min(X1 - 3, hx + legH - 3);
  return finish({
    archetype: 'lBend',
    cells: [vertical, horizontal],
    tee: { x: vx + w / 2, y: TOP + legV - 4 },
    cup: { x: cupX, y: hy + w / 2 },
    spine: [
      { x: vx + w / 2, y: TOP + legV - 4 },
      { x: vx + w / 2, y: hy + w / 2 },
      { x: cupX, y: hy + w / 2 },
    ],
    islands: [],
  });
}

function dogleg(rng: Rng, p: ArchetypeParams): Skeleton {
  const L = lengthUnits(rng, p.length);
  const w = Math.min(widthUnits(rng, p.width), 9);
  const dir = rng.sign();
  const bend = rng.range(30, 60) * (Math.PI / 180);
  const leg1 = L * 0.55;
  const bendSin = Math.abs(Math.sin(bend));
  const leg2 = Math.min(L * 0.45, (26 - 1.5 * w) / Math.max(bendSin, 0.3));
  const startX = dir < 0 ? XC + 6 : XC - 6;
  const startY = TOP + L * 0.5 + leg1;
  const angle1 = -Math.PI / 2;
  const angle2 = angle1 + dir * bend;
  // Clamp so leg2 stays inside the playfield.
  const endX = startX + Math.cos(angle2) * leg2;
  const shift = endX < X0 + w / 2 + 1 ? X0 + w / 2 + 1 - endX : endX > X1 - w / 2 - 1 ? X1 - w / 2 - 1 - endX : 0;
  const sx = startX + shift;
  const cornerY = startY - leg1;
  const c1 = beam(sx, startY, leg1, w, angle1);
  const c2 = beam(sx, cornerY, leg2, w, angle2);
  const joint = miterJoint({ x: sx, y: cornerY }, { x: Math.cos(angle1), y: Math.sin(angle1) }, { x: Math.cos(angle2), y: Math.sin(angle2) }, w);
  const cup = { x: sx + Math.cos(angle2) * (leg2 - 3.5), y: cornerY + Math.sin(angle2) * (leg2 - 3.5) };
  return finish({
    archetype: 'dogleg',
    cells: joint ? [c1, joint, c2] : [c1, c2],
    tee: { x: sx, y: startY - 4 },
    cup,
    spine: [{ x: sx, y: startY - 4 }, { x: sx, y: cornerY }, cup],
    islands: [],
    decorable: [c1, c2],
  });
}

function sOrZ(rng: Rng, p: ArchetypeParams, sharp: boolean, arche: Archetype): Skeleton {
  const L = lengthUnits(rng, p.length);
  const w = Math.min(widthUnits(rng, p.width), 9);
  const dir = rng.sign();
  const legV = Math.max(12, L * 0.3);
  const shiftX = Math.min(28 - w, Math.max(w + 2, L * 0.35));
  const x1 = dir < 0 ? X1 - w : X0;
  const x2 = dir < 0 ? x1 - shiftX : x1 + shiftX;
  const bottomY = TOP + legV * 2 + (sharp ? w : shiftX * 0.7);
  const bottom = rect(x1, bottomY - legV, w, legV);
  const top = rect(x2, TOP, w, legV);
  const cells: Polygon[] = [bottom, top];
  if (sharp) {
    // Z: horizontal connector.
    const cx = Math.min(x1, x2);
    cells.push(rect(cx, bottomY - legV, shiftX + w, w));
    top[2].y = bottomY - legV + w;
    top[3].y = bottomY - legV + w;
  } else {
    // S: diagonal connector.
    const ax = x1 + w / 2;
    const ay = bottomY - legV + w / 2;
    const bx = x2 + w / 2;
    const by = TOP + legV - w / 2;
    const ang = Math.atan2(by - ay, bx - ax);
    const len = Math.hypot(bx - ax, by - ay);
    cells.push(beam(ax, ay, len, w, ang));
    const up = { x: 0, y: -1 };
    const diag = { x: Math.cos(ang), y: Math.sin(ang) };
    const j1 = miterJoint({ x: ax, y: ay }, up, diag, w);
    const j2 = miterJoint({ x: bx, y: by }, diag, up, w);
    if (j1) cells.push(j1);
    if (j2) cells.push(j2);
  }
  const tee = { x: x1 + w / 2, y: bottomY - 4 };
  const cup = { x: x2 + w / 2, y: TOP + 3.5 };
  return finish({
    archetype: arche,
    cells,
    tee,
    cup,
    spine: [tee, { x: x1 + w / 2, y: bottomY - legV + w / 2 }, { x: x2 + w / 2, y: TOP + legV - w / 2 }, cup],
    islands: [],
    decorable: [bottom, top],
  });
}

function splitOrFork(rng: Rng, p: ArchetypeParams, merge: boolean): Skeleton {
  const L = lengthUnits(rng, p.length);
  const roomH = 10;
  const laneLen = Math.max(16, L - roomH * 2);
  const total = laneLen + roomH * 2;
  const W = 26;
  const room = rect(X0 + 1, TOP, W, total);
  // Island splits the middle into two lanes of different widths.
  const narrow = rng.range(4.5, 6);
  const wideLane = rng.range(7, 10);
  const islandW = W - narrow - wideLane;
  const narrowLeft = rng.chance(0.5);
  const ix = narrowLeft ? X0 + 1 + narrow : X0 + 1 + wideLane;
  const iy = TOP + roomH;
  const islandShape = rng.pick(['rect', 'rect', 'diamondish']);
  const islandPts: Polygon =
    islandShape === 'rect'
      ? rect(ix, iy, islandW, laneLen)
      : [
          { x: ix + islandW * 0.15, y: iy },
          { x: ix + islandW * 0.85, y: iy },
          { x: ix + islandW, y: iy + laneLen * 0.2 },
          { x: ix + islandW, y: iy + laneLen * 0.8 },
          { x: ix + islandW * 0.85, y: iy + laneLen },
          { x: ix + islandW * 0.15, y: iy + laneLen },
          { x: ix, y: iy + laneLen * 0.8 },
          { x: ix, y: iy + laneLen * 0.2 },
        ];
  const narrowCx = narrowLeft ? X0 + 1 + narrow / 2 : X1 - 1 - narrow / 2;
  const wideCx = narrowLeft ? X1 - 1 - wideLane / 2 : X0 + 1 + wideLane / 2;
  const tee = { x: XC, y: TOP + total - 5 };
  // Split: cup sits above the narrow (risky) lane. Fork-merge: cup centred.
  const cup = merge ? { x: XC, y: TOP + 4 } : { x: narrowCx, y: TOP + 4 };
  return finish({
    archetype: merge ? 'forkMerge' : 'splitPath',
    cells: [room],
    tee,
    cup,
    spine: [tee, { x: wideCx, y: iy + laneLen }, { x: wideCx, y: iy }, cup],
    islands: [{ type: 'blocker', shape: { kind: 'polygon', points: roundPoly(islandPts) } }],
    decorable: [rect(X0 + 1, TOP, W, roomH), rect(X0 + 1, iy + laneLen, W, roomH), rect(narrowCx - narrow / 2, iy, narrow, laneLen), rect(wideCx - wideLane / 2, iy, wideLane, laneLen)],
  });
}

function loopOrRing(rng: Rng, p: ArchetypeParams, ring: boolean): Skeleton {
  const L = lengthUnits(rng, p.length);
  const W = 26;
  const H = Math.max(34, Math.min(L, 70));
  const room = rect(X0 + 1, TOP, W, H);
  const lane = ring ? rng.range(5, 7) : rng.range(8, 11);
  const iw = W - lane * 2;
  const ih = H - lane * 2;
  const shape = ring ? rng.pick(['round', 'rect']) : rng.pick(['round', 'rect', 'diamond']);
  const cx = XC;
  const cy = TOP + H / 2;
  let pts: Polygon;
  if (shape === 'round') pts = regularPolygon(cx, cy, Math.min(iw, ih) / 2, 12);
  else if (shape === 'diamond') pts = regularPolygon(cx, cy, Math.min(iw, ih) / 2, 4);
  else pts = rect(cx - iw / 2, cy - ih / 2, iw, ih);
  if (shape === 'round' || shape === 'diamond') {
    // stretch to fill
    const sy = ih / Math.min(iw, ih);
    const sx = iw / Math.min(iw, ih);
    pts = pts.map((q) => ({ x: cx + (q.x - cx) * sx * 0.95, y: cy + (q.y - cy) * sy * 0.95 }));
  }
  const tee = { x: XC + rng.range(-3, 3), y: TOP + H - lane / 2 };
  const cup = { x: XC + rng.range(-3, 3), y: TOP + lane / 2 };
  return finish({
    archetype: ring ? 'ring' : 'loopAround',
    cells: [room],
    tee,
    cup,
    spine: [tee, { x: X0 + 1 + lane / 2, y: TOP + H - lane / 2 }, { x: X0 + 1 + lane / 2, y: TOP + lane / 2 }, cup],
    islands: [{ type: 'blocker', shape: { kind: 'polygon', points: roundPoly(pts) } }],
    decorable: [rect(X0 + 1, TOP, W, lane), rect(X0 + 1, TOP + H - lane, W, lane), rect(X0 + 1, TOP + lane, lane, ih), rect(X1 - 1 - lane, TOP + lane, lane, ih)],
  });
}

function chamber(rng: Rng, p: ArchetypeParams): Skeleton {
  const L = lengthUnits(rng, p.length);
  const w = Math.min(widthUnits(rng, p.width), 8);
  const roomH = Math.max(16, L * 0.4);
  const corrH = Math.max(14, L - roomH);
  const roomW = rng.range(20, 26);
  const roomX = XC - roomW / 2;
  const room = rect(roomX, TOP, roomW, roomH);
  const corrX = XC + rng.range(-1, 1) * (roomW / 2 - w / 2 - 2);
  const corr = rect(corrX - w / 2, TOP + roomH - 1, w, corrH + 1);
  const cup = { x: roomX + rng.range(4, roomW - 4), y: TOP + rng.range(3.5, roomH * 0.5) };
  const tee = { x: corrX, y: TOP + roomH + corrH - 4 };
  return finish({
    archetype: 'chamber',
    cells: [room, corr],
    tee,
    cup,
    spine: [tee, { x: corrX, y: TOP + roomH - 2 }, cup],
    islands: [],
  });
}

function funnel(rng: Rng, p: ArchetypeParams): Skeleton {
  const L = lengthUnits(rng, p.length);
  const wBottom = rng.range(16, 26);
  const wTop = Math.max(4.5, widthUnits(rng, p.width) * 0.6);
  void p;
  const cell = trapezoid(XC, TOP, TOP + L, wTop, wBottom);
  const tee = { x: XC + rng.range(-wBottom / 4, wBottom / 4), y: TOP + L - 4 };
  const cup = { x: XC, y: TOP + 3.5 };
  return finish({ archetype: 'funnel', cells: [cell], tee, cup, spine: [tee, cup], islands: [] });
}

function bottleneck(rng: Rng, p: ArchetypeParams): Skeleton {
  const L = lengthUnits(rng, p.length);
  const wide = rng.range(16, 24);
  const pinch = Math.max(4, widthUnits(rng, p.width) * 0.6);
  const seg = L / 3;
  const bottom = trapezoid(XC, TOP + seg * 2, TOP + L, pinch, wide);
  const middle = rect(XC - pinch / 2, TOP + seg * 1.5 - 0.5, pinch, seg * 0.5 + 1);
  const top = trapezoid(XC, TOP, TOP + seg * 1.5, wide, pinch);
  const tee = { x: XC + rng.range(-wide / 4, wide / 4), y: TOP + L - 4 };
  const cup = { x: XC + rng.range(-wide / 4, wide / 4), y: TOP + 4 };
  return finish({
    archetype: 'bottleneck',
    cells: [bottom, middle, top],
    tee,
    cup,
    spine: [tee, { x: XC, y: TOP + seg * 1.75 }, cup],
    islands: [],
    decorable: [bottom, top],
  });
}

function switchback(rng: Rng, p: ArchetypeParams): Skeleton {
  const L = lengthUnits(rng, p.length);
  const w = Math.min(widthUnits(rng, p.width), 10);
  const legH = Math.max(16, (L - w) / 2);
  const gap = rng.range(2, 6); // inner wall thickness
  const totalW = w * 2 + gap;
  const x0 = XC - totalW / 2;
  const right = rect(x0 + w + gap, TOP, w, legH + w);
  const left = rect(x0, TOP, w, legH + w);
  const topConn = rect(x0, TOP, totalW, w);
  const tee = { x: x0 + w + gap + w / 2, y: TOP + legH + w - 4 };
  const cup = { x: x0 + w / 2, y: TOP + legH + w - 4 + rng.range(-4, 0) };
  return finish({
    archetype: 'switchback',
    cells: [right, topConn, left],
    tee,
    cup,
    spine: [tee, { x: x0 + w + gap + w / 2, y: TOP + w / 2 }, { x: x0 + w / 2, y: TOP + w / 2 }, cup],
    islands: [],
    decorable: [right, left],
  });
}

function cross(rng: Rng, p: ArchetypeParams): Skeleton {
  const L = lengthUnits(rng, p.length);
  const w = Math.min(widthUnits(rng, p.width), 9);
  const armV = Math.max(10, L * 0.32);
  const armH = 13 - w / 2;
  const cy = TOP + armV + w / 2;
  const vertical = rect(XC - w / 2, TOP, w, armV * 2 + w);
  const horizontal = rect(XC - armH - w / 2, cy - w / 2, armH * 2 + w, w);
  const tee = { x: XC, y: TOP + armV * 2 + w - 3.5 };
  const which = rng.pick(['top', 'left', 'right']);
  const cup =
    which === 'top'
      ? { x: XC, y: TOP + 3.5 }
      : which === 'left'
        ? { x: XC - armH - w / 2 + 3.5, y: cy }
        : { x: XC + armH + w / 2 - 3.5, y: cy };
  return finish({
    archetype: 'cross',
    cells: [vertical, horizontal],
    tee,
    cup,
    spine: [tee, { x: XC, y: cy }, cup],
    islands: [],
  });
}

export function buildSkeleton(arche: Archetype, rng: Rng, p: ArchetypeParams): Skeleton {
  switch (arche) {
    case 'straight':
      return straight(rng, p);
    case 'lBend':
      return lBend(rng, p);
    case 'dogleg':
      return dogleg(rng, p);
    case 'sCurve':
      return sOrZ(rng, p, false, 'sCurve');
    case 'zFold':
      return sOrZ(rng, p, true, 'zFold');
    case 'splitPath':
      return splitOrFork(rng, p, false);
    case 'forkMerge':
      return splitOrFork(rng, p, true);
    case 'loopAround':
      return loopOrRing(rng, p, false);
    case 'ring':
      return loopOrRing(rng, p, true);
    case 'chamber':
      return chamber(rng, p);
    case 'funnel':
      return funnel(rng, p);
    case 'bottleneck':
      return bottleneck(rng, p);
    case 'switchback':
      return switchback(rng, p);
    case 'cross':
      return cross(rng, p);
  }
}
