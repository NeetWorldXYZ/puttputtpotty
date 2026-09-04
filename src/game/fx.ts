/**
 * Render-only effects: particles, floating texts, screen shake. Uses
 * Math.random freely because nothing here touches the simulation.
 * World units unless noted.
 */

import { OUTLINE } from '../render/themes';
import { chunky, circle, roundRectPath } from '../render/shapes';

type Kind = 'dot' | 'ring' | 'star' | 'confetti' | 'spark' | 'bubble';

interface Particle {
  kind: Kind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  rot: number;
  vrot: number;
  drag: number;
  gravity: number;
}

interface FloatText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  max: number;
  scale: number;
}

export interface BurstOptions {
  count?: number;
  color?: string | string[];
  speed?: number;
  size?: number;
  life?: number;
  kind?: Kind;
  spread?: number;
  dir?: number;
  gravity?: number;
  drag?: number;
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

export class Fx {
  particles: Particle[] = [];
  texts: FloatText[] = [];
  shakeAmp = 0;
  shakeT = 0;
  private shakeX = 0;
  private shakeY = 0;

  burst(x: number, y: number, o: BurstOptions = {}): void {
    const n = o.count ?? 10;
    const colors = Array.isArray(o.color) ? o.color : [o.color ?? '#ffffff'];
    for (let i = 0; i < n; i++) {
      const a = o.dir !== undefined ? o.dir + rnd(-1, 1) * (o.spread ?? Math.PI) : rnd(0, Math.PI * 2);
      const sp = rnd(0.3, 1) * (o.speed ?? 8);
      const max = rnd(0.6, 1.2) * (o.life ?? 0.5);
      this.particles.push({
        kind: o.kind ?? 'dot',
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: max,
        max,
        size: rnd(0.6, 1.3) * (o.size ?? 0.25),
        color: colors[Math.floor(Math.random() * colors.length)],
        rot: rnd(0, Math.PI * 2),
        vrot: rnd(-8, 8),
        drag: o.drag ?? 4,
        gravity: o.gravity ?? 0,
      });
    }
    if (this.particles.length > 600) this.particles.splice(0, this.particles.length - 600);
  }

  ring(x: number, y: number, color: string, size = 1.2, life = 0.45): void {
    this.particles.push({ kind: 'ring', x, y, vx: 0, vy: 0, life, max: life, size, color, rot: 0, vrot: 0, drag: 0, gravity: 0 });
  }

  text(x: number, y: number, text: string, color = '#ffffff', scale = 1): void {
    this.texts.push({ x, y, text, color, life: 1.4, max: 1.4, scale });
  }

  shake(amp: number): void {
    this.shakeAmp = Math.max(this.shakeAmp, amp);
    this.shakeT = 0;
  }

  /** Screen-space shake offset (CSS px) for this frame. */
  shakeOffset(): { x: number; y: number } {
    return { x: this.shakeX, y: this.shakeY };
  }

  update(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.vy += p.gravity * dt;
      const d = Math.exp(-p.drag * dt);
      p.vx *= d;
      p.vy *= d;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vrot * dt;
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life -= dt;
      t.y -= dt * 1.2;
      if (t.life <= 0) this.texts.splice(i, 1);
    }
    if (this.shakeAmp > 0.05) {
      this.shakeT += dt;
      const decay = Math.exp(-this.shakeT * 9);
      const a = this.shakeAmp * decay;
      this.shakeX = (Math.random() * 2 - 1) * a;
      this.shakeY = (Math.random() * 2 - 1) * a;
      if (a < 0.2) {
        this.shakeAmp = 0;
        this.shakeX = 0;
        this.shakeY = 0;
      }
    }
  }

  /** Draw in world units (ctx already transformed). */
  draw(ctx: CanvasRenderingContext2D): void {
    for (const p of this.particles) {
      const k = p.life / p.max;
      ctx.save();
      ctx.translate(p.x, p.y);
      switch (p.kind) {
        case 'dot':
          ctx.globalAlpha = Math.min(1, k * 1.5);
          circle(ctx, 0, 0, p.size * (0.6 + 0.4 * k));
          chunky(ctx, p.color, Math.max(0.06, p.size * 0.35));
          break;
        case 'bubble':
          ctx.globalAlpha = Math.min(1, k * 1.5);
          circle(ctx, 0, 0, p.size * (1.2 - 0.6 * k));
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 0.08;
          ctx.stroke();
          break;
        case 'spark':
          ctx.globalAlpha = k;
          ctx.strokeStyle = p.color;
          ctx.lineWidth = p.size * 0.5;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(-p.vx * 0.05, -p.vy * 0.05);
          ctx.stroke();
          break;
        case 'star': {
          ctx.globalAlpha = k;
          ctx.rotate(p.rot);
          ctx.beginPath();
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            const r = i % 2 === 0 ? p.size : p.size * 0.45;
            ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
          }
          ctx.closePath();
          chunky(ctx, p.color, 0.08);
          break;
        }
        case 'confetti':
          ctx.globalAlpha = Math.min(1, k * 2);
          ctx.rotate(p.rot);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size, -p.size * 0.5, p.size * 2, p.size);
          ctx.strokeStyle = OUTLINE;
          ctx.lineWidth = 0.06;
          ctx.strokeRect(-p.size, -p.size * 0.5, p.size * 2, p.size);
          break;
        case 'ring':
          ctx.globalAlpha = k;
          circle(ctx, 0, 0, p.size * (1 + (1 - k) * 2.2));
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 0.22 * k + 0.06;
          ctx.stroke();
          break;
      }
      ctx.restore();
    }
    for (const t of this.texts) {
      const k = t.life / t.max;
      const pop = k > 0.85 ? 1 + (k - 0.85) * 3 : 1;
      ctx.save();
      ctx.globalAlpha = Math.min(1, k * 2.5);
      ctx.translate(t.x, t.y);
      ctx.scale(t.scale * pop, t.scale * pop);
      ctx.font = '700 1.1px Fredoka, "Trebuchet MS", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const w = ctx.measureText(t.text).width + 1;
      roundRectPath(ctx, -w / 2, -0.75, w, 1.5, 0.4);
      chunky(ctx, OUTLINE, 0.14, '#ffffff');
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, 0, 0.06);
      ctx.restore();
    }
  }
}
