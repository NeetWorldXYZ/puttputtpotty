/** Shared material finishes. Call inside a clipped shape; never changes geometry. */
import type { Rect } from '../sim/types';
import { makeRand } from './shapes';

export type Material = 'ceramic' | 'rubber' | 'metal' | 'water' | 'fabric' | 'stone' | 'wood' | 'turf';

export function finishMaterial(ctx: CanvasRenderingContext2D, b: Rect, material: Material, seed = 1): void {
  ctx.save();
  const light = ctx.createLinearGradient(b.x, b.y, b.x + b.w, b.y + b.h);
  light.addColorStop(0, material === 'metal' ? '#ffffff65' : '#ffffff24');
  light.addColorStop(0.35, '#ffffff00');
  light.addColorStop(1, '#102a4433');
  ctx.fillStyle = light;
  ctx.fillRect(b.x, b.y, b.w, b.h);
  const rand = makeRand(seed);
  if (material === 'turf' || material === 'fabric' || material === 'stone') {
    ctx.strokeStyle = material === 'turf' ? '#12382a22' : '#17324918';
    ctx.lineWidth = 0.035;
    ctx.beginPath();
    const n = Math.min(1800, Math.round(b.w * b.h * 1.5));
    for (let i = 0; i < n; i++) {
      const x = b.x + rand() * b.w, y = b.y + rand() * b.h;
      ctx.moveTo(x, y); ctx.lineTo(x + 0.09, y + 0.14);
    }
    ctx.stroke();
  }
  if (material === 'ceramic' || material === 'metal' || material === 'wood') {
    const step = material === 'ceramic' ? 3 : material === 'wood' ? 1.2 : 5;
    ctx.strokeStyle = material === 'wood' ? '#37271920' : '#102a4428';
    ctx.lineWidth = material === 'ceramic' ? 0.07 : 0.035;
    ctx.beginPath();
    for (let y = b.y + step; y < b.y + b.h; y += step) {
      ctx.moveTo(b.x, y); ctx.lineTo(b.x + b.w, y);
    }
    if (material === 'ceramic') for (let x = b.x + step; x < b.x + b.w; x += step) {
      ctx.moveTo(x, b.y); ctx.lineTo(x, b.y + b.h);
    }
    ctx.stroke();
  }
  if (material === 'water') {
    ctx.strokeStyle = '#d8faff75'; ctx.lineWidth = 0.075;
    ctx.beginPath();
    for (let y = b.y + 0.8; y < b.y + b.h; y += 1.6) {
      for (let x = b.x + 0.4; x < b.x + b.w; x += 3.2) {
        ctx.moveTo(x,y);ctx.quadraticCurveTo(x+0.6,y-0.2,x+1.2,y);
      }
    }
    ctx.stroke();
  }
  ctx.restore();
}
