/** Procedural floors, drawn in world units inside an already-clipped region. */

import type { Rect } from '../sim/types';
import type { Theme } from './themes';
import { makeRand, roundRectPath, circle } from './shapes';

export function drawFloor(ctx: CanvasRenderingContext2D, b: Rect, t: Theme, seed: number): void {
  const f = t.floor;
  const rand = makeRand(seed ^ 0x51ed);
  ctx.fillStyle = f.a;
  ctx.fillRect(b.x - 1, b.y - 1, b.w + 2, b.h + 2);
  const x0 = Math.floor(b.x) - 1;
  const y0 = Math.floor(b.y) - 1;
  const x1 = Math.ceil(b.x + b.w) + 1;
  const y1 = Math.ceil(b.y + b.h) + 1;

  switch (f.kind) {
    case 'tile':
    case 'crackedTile':
    case 'bigTile': {
      const s = f.kind === 'bigTile' ? 5 : 3;
      const g = f.kind === 'bigTile' ? 0.14 : 0.2;
      for (let y = y0; y < y1; y += s) {
        for (let x = x0; x < x1; x += s) {
          const alt = ((x / s + y / s) | 0) % 2 === 0;
          ctx.fillStyle = alt ? f.a : f.b;
          roundRectPath(ctx, x + g / 2, y + g / 2, s - g, s - g, 0.35);
          ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.18)';
          roundRectPath(ctx, x + g / 2 + 0.15, y + g / 2 + 0.15, s - g - 0.3, (s - g) * 0.28, 0.25);
          ctx.fill();
        }
      }
      ctx.strokeStyle = f.grout;
      ctx.lineWidth = g;
      ctx.beginPath();
      for (let x = x0; x <= x1; x += s) {
        ctx.moveTo(x, y0);
        ctx.lineTo(x, y1);
      }
      for (let y = y0; y <= y1; y += s) {
        ctx.moveTo(x0, y);
        ctx.lineTo(x1, y);
      }
      ctx.stroke();
      if (f.kind === 'crackedTile') {
        ctx.strokeStyle = f.grout;
        ctx.lineWidth = 0.1;
        for (let i = 0; i < (b.w * b.h) / 60; i++) {
          const x = b.x + rand() * b.w;
          const y = b.y + rand() * b.h;
          ctx.beginPath();
          ctx.moveTo(x, y);
          let cx = x;
          let cy = y;
          for (let k = 0; k < 4; k++) {
            cx += (rand() - 0.5) * 1.6;
            cy += (rand() - 0.2) * 1.2;
            ctx.lineTo(cx, cy);
          }
          ctx.stroke();
        }
      }
      break;
    }
    case 'marble': {
      const s = 6;
      for (let y = y0; y < y1; y += s) {
        for (let x = x0; x < x1; x += s) {
          ctx.fillStyle = ((x / s + y / s) | 0) % 2 === 0 ? f.a : f.b;
          ctx.fillRect(x, y, s, s);
          ctx.strokeStyle = 'rgba(120,100,80,0.35)';
          ctx.lineWidth = 0.08;
          for (let v = 0; v < 2; v++) {
            ctx.beginPath();
            let vx = x + rand() * s;
            let vy = y;
            ctx.moveTo(vx, vy);
            while (vy < y + s) {
              vx += (rand() - 0.5) * 1.5;
              vy += 0.8 + rand();
              ctx.lineTo(vx, vy);
            }
            ctx.stroke();
          }
        }
      }
      ctx.strokeStyle = f.grout;
      ctx.lineWidth = 0.1;
      ctx.beginPath();
      for (let x = x0; x <= x1; x += s) {
        ctx.moveTo(x, y0);
        ctx.lineTo(x, y1);
      }
      for (let y = y0; y <= y1; y += s) {
        ctx.moveTo(x0, y);
        ctx.lineTo(x1, y);
      }
      ctx.stroke();
      break;
    }
    case 'checker': {
      const s = 3;
      for (let y = y0; y < y1; y += s)
        for (let x = x0; x < x1; x += s) {
          ctx.fillStyle = ((x / s + y / s) | 0) % 2 === 0 ? f.a : f.b;
          ctx.fillRect(x, y, s, s);
        }
      ctx.strokeStyle = f.grout;
      ctx.lineWidth = 0.08;
      ctx.beginPath();
      for (let x = x0; x <= x1; x += s) {
        ctx.moveTo(x, y0);
        ctx.lineTo(x, y1);
      }
      for (let y = y0; y <= y1; y += s) {
        ctx.moveTo(x0, y);
        ctx.lineTo(x1, y);
      }
      ctx.stroke();
      break;
    }
    case 'terrazzo': {
      ctx.fillStyle = f.a;
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      const n = (b.w * b.h) / 1.2;
      for (let i = 0; i < n; i++) {
        const x = b.x + rand() * b.w;
        const y = b.y + rand() * b.h;
        ctx.fillStyle = rand() < 0.5 ? f.b : f.grout;
        circle(ctx, x, y, 0.1 + rand() * 0.22);
        ctx.fill();
      }
      const s = 4;
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 0.12;
      ctx.beginPath();
      for (let x = x0; x <= x1; x += s) {
        ctx.moveTo(x, y0);
        ctx.lineTo(x, y1);
      }
      for (let y = y0; y <= y1; y += s) {
        ctx.moveTo(x0, y);
        ctx.lineTo(x1, y);
      }
      ctx.stroke();
      break;
    }
    case 'plastic': {
      ctx.fillStyle = f.a;
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      ctx.strokeStyle = f.b;
      ctx.lineWidth = 0.14;
      ctx.beginPath();
      for (let d = x0 - (y1 - y0); d < x1; d += 1.5) {
        ctx.moveTo(d, y0);
        ctx.lineTo(d + (y1 - y0), y1);
        ctx.moveTo(d + (y1 - y0), y0);
        ctx.lineTo(d, y1);
      }
      ctx.stroke();
      break;
    }
    case 'cobble': {
      ctx.fillStyle = f.grout;
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      const s = 2.4;
      let row = 0;
      for (let y = y0; y < y1; y += s, row++) {
        for (let x = x0 - (row % 2) * (s / 2); x < x1; x += s) {
          const jx = (rand() - 0.5) * 0.3;
          const jy = (rand() - 0.5) * 0.3;
          ctx.fillStyle = rand() < 0.5 ? f.a : f.b;
          roundRectPath(ctx, x + 0.15 + jx, y + 0.15 + jy, s - 0.3, s - 0.3, 0.7);
          ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.15)';
          roundRectPath(ctx, x + 0.35 + jx, y + 0.3 + jy, s - 0.7, 0.5, 0.25);
          ctx.fill();
        }
      }
      break;
    }
    case 'metalGrid': {
      ctx.fillStyle = f.a;
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      const s = 2.5;
      ctx.strokeStyle = f.b;
      ctx.lineWidth = 0.35;
      ctx.beginPath();
      for (let x = x0; x <= x1; x += s) {
        ctx.moveTo(x, y0);
        ctx.lineTo(x, y1);
      }
      for (let y = y0; y <= y1; y += s) {
        ctx.moveTo(x0, y);
        ctx.lineTo(x1, y);
      }
      ctx.stroke();
      ctx.strokeStyle = f.grout;
      ctx.lineWidth = 0.08;
      ctx.globalAlpha = 0.6;
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = f.grout;
      for (let x = x0; x <= x1; x += s)
        for (let y = y0; y <= y1; y += s) {
          circle(ctx, x, y, 0.16);
          ctx.fill();
        }
      break;
    }
    case 'bamboo': {
      const s = 2;
      for (let x = x0; x < x1; x += s) {
        ctx.fillStyle = ((x / s) | 0) % 2 === 0 ? f.a : f.b;
        ctx.fillRect(x, y0, s, y1 - y0);
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.fillRect(x + 0.2, y0, 0.5, y1 - y0);
      }
      ctx.strokeStyle = f.grout;
      ctx.lineWidth = 0.16;
      ctx.beginPath();
      for (let x = x0; x <= x1; x += s) {
        ctx.moveTo(x, y0);
        ctx.lineTo(x, y1);
      }
      ctx.stroke();
      ctx.lineWidth = 0.22;
      ctx.beginPath();
      let col = 0;
      for (let x = x0; x < x1; x += s, col++) {
        for (let y = y0 + ((col * 1.7) % 4); y < y1; y += 4.5) {
          ctx.moveTo(x, y);
          ctx.lineTo(x + s, y);
        }
      }
      ctx.stroke();
      break;
    }
    case 'floralCarpet': {
      ctx.fillStyle = f.a;
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      const s = 3;
      let row = 0;
      for (let y = y0; y < y1; y += s, row++) {
        for (let x = x0 + (row % 2) * (s / 2); x < x1; x += s) {
          const cx = x + s / 2;
          const cy = y + s / 2;
          ctx.fillStyle = f.b;
          for (let k = 0; k < 5; k++) {
            const a = (k / 5) * Math.PI * 2;
            circle(ctx, cx + Math.cos(a) * 0.45, cy + Math.sin(a) * 0.45, 0.32);
            ctx.fill();
          }
          ctx.fillStyle = f.grout;
          circle(ctx, cx, cy, 0.24);
          ctx.fill();
          ctx.strokeStyle = '#8fbf8a';
          ctx.lineWidth = 0.1;
          ctx.beginPath();
          ctx.moveTo(cx + 0.7, cy + 0.6);
          ctx.quadraticCurveTo(cx + 1.2, cy + 0.9, cx + 1.3, cy + 1.3);
          ctx.stroke();
        }
      }
      break;
    }
    case 'stripes': {
      const s = 3;
      for (let y = y0; y < y1; y += s) {
        ctx.fillStyle = ((y / s) | 0) % 2 === 0 ? f.a : f.b;
        ctx.fillRect(x0, y, x1 - x0, s);
      }
      ctx.strokeStyle = f.grout;
      ctx.lineWidth = 0.14;
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      for (let y = y0; y <= y1; y += s) {
        ctx.moveTo(x0, y);
        ctx.lineTo(x1, y);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
      break;
    }
  }
}

/** Out-of-play area inside the bounds: darker theme colour with a faint texture. */
export function drawSurround(ctx: CanvasRenderingContext2D, b: Rect, t: Theme): void {
  ctx.fillStyle = t.surround;
  ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.strokeStyle = t.surroundB;
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  for (let d = b.x - b.h; d < b.x + b.w; d += 2.6) {
    ctx.moveTo(d, b.y);
    ctx.lineTo(d + b.h, b.y + b.h);
  }
  ctx.stroke();
}
