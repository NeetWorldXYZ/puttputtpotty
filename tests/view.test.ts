import { describe, expect, it } from 'vitest';
import { fitView, floorMatrix, followView, makeView, project, unproject } from '../src/render/view';

const region = { x0: 8, y0: 92, w: 374, h: 704 };
const bounds = { x: 0, y: 0, w: 30, h: 60 };

describe('tilted view', () => {
  it('looks at its target at the centre of the region', () => {
    const v = makeView(region, 15, 40, 12, bounds.h);
    const p = project(v, 15, 40, 0);
    expect(p.x).toBeCloseTo(region.x0 + region.w / 2, 6);
    expect(p.y).toBeCloseTo(region.y0 + region.h / 2, 6);
    expect(p.k).toBeCloseTo(12, 6);
  });

  it('puts farther points higher and smaller on screen, and height goes up', () => {
    const v = makeView(region, 15, 40, 12, bounds.h);
    const near = project(v, 15, 50, 0);
    const far = project(v, 15, 10, 0);
    expect(far.y).toBeLessThan(near.y);
    expect(far.k).toBeLessThan(near.k);
    const up = project(v, 15, 40, 2);
    expect(up.y).toBeLessThan(project(v, 15, 40, 0).y);
    expect(up.x).toBeCloseTo(project(v, 15, 40, 0).x, 6);
  });

  it('unprojects back to where it projected from', () => {
    const v = makeView(region, 15, 40, 12, bounds.h);
    for (const [x, y, z] of [
      [3, 5, 0],
      [27, 58, 0],
      [15, 40, 0],
      [10, 20, 0.5],
    ]) {
      const p = project(v, x, y, z);
      const w = unproject(v, p.x, p.y, z);
      expect(w).not.toBeNull();
      expect(w!.x).toBeCloseTo(x, 4);
      expect(w!.y).toBeCloseTo(y, 4);
    }
    expect(unproject(v, region.x0 + region.w / 2, -5000)).toBeNull();
  });

  it('agrees with the CSS matrix that lays the floor bitmap down', () => {
    const v = makeView(region, 15, 40, 12, bounds.h);
    const ppu = 9;
    const m = floorMatrix(v, bounds, ppu)
      .replace(/^matrix3d\(|\)$/g, '')
      .split(',')
      .map(Number);
    expect(m).toHaveLength(16);
    const apply = (ex: number, ey: number) => {
      // column-major: out[row] = sum over col of m[col*4+row] * in[col]
      const inp = [ex, ey, 0, 1];
      const out = [0, 0, 0, 0];
      for (let col = 0; col < 4; col++) for (let row = 0; row < 4; row++) out[row] += m[col * 4 + row] * inp[col];
      return { x: out[0] / out[3], y: out[1] / out[3] };
    };
    for (const [wx, wy] of [
      [0, 0],
      [30, 60],
      [12, 33],
    ]) {
      const p = project(v, wx, wy, 0);
      const q = apply((wx - bounds.x) * ppu, (wy - bounds.y) * ppu);
      expect(q.x).toBeCloseTo(p.x, 2);
      expect(q.y).toBeCloseTo(p.y, 2);
    }
  });

  it('fits the whole hole inside the region', () => {
    const v = fitView(region, bounds, 4);
    for (const [x, y] of [
      [0, 0],
      [30, 0],
      [0, 60],
      [30, 60],
    ]) {
      const p = project(v, x, y, 0);
      expect(p.x).toBeGreaterThanOrEqual(region.x0 + 3.5);
      expect(p.x).toBeLessThanOrEqual(region.x0 + region.w - 3.5);
      expect(p.y).toBeGreaterThanOrEqual(region.y0 + 3.5);
      expect(p.y).toBeLessThanOrEqual(region.y0 + region.h - 3.5);
      expect(p.depth).toBeGreaterThan(0);
    }
    expect(v.scale).toBeGreaterThan(5);
  });

  it('keeps a following camera over the hole', () => {
    const long = { x: 0, y: 0, w: 30, h: 200 };
    const v = followView(region, long, 12, 15, 190);
    expect(v.ty).toBeLessThan(190);
    const w = followView(region, long, 12, 15, 2);
    expect(w.ty).toBeGreaterThan(2);
  });
});
