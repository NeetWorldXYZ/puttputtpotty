import { describe, expect, it } from 'vitest';
// @ts-expect-error plain ESM helper shared with the pre-build script
import { buildCourse } from '../scripts/lib/course.mjs';
import { courseSlots } from '../src/generator/generator';

describe('course pre-build', () => {
  it('builds the same shape of row the API builds on demand', () => {
    const { row } = buildCourse({ id: 'osm:node:5551', name: 'Corner Bar', poi_type: 'bar', lat: 42.3, lng: -83.7 });
    expect(row.theme).toBe('diveBar');
    expect(row.difficulty).toBe('medium');
    expect(row.holes).toHaveLength(3);
    expect(row.gen_holes).toBe(3);
    expect(row.par).toBe(row.holes.reduce((a: number, h: { par: number }) => a + h.par, 0));
    expect(row.hole).toBe(row.holes[0]);
    expect(row.hole_par).toBe(row.holes[0].par);
    expect(row.holes.map((h: { id: string }) => h.id)).toEqual(['osm:node:5551#1', 'osm:node:5551#2', 'osm:node:5551#3']);
    expect(row.holes[1].name).toBe('Corner Bar 2');
    expect(row.holes.every((h: { theme: string }) => h.theme === 'diveBar')).toBe(true);
    // Seeds come from the same plan the API uses.
    expect(courseSlots('osm:node:5551', 3)).toHaveLength(3);
  });
});
