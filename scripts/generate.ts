/**
 * CLI: generate holes.
 *   npm run generate                          # 14 holes, one per archetype, seed "demo"
 *   npm run generate -- --seed abc --count 30 --out generated
 *   npm run generate -- --course 2026-09-04   # a 9-hole course
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ARCHETYPES } from '../src/generator/archetypes';
import { generateCourse, generateHole } from '../src/generator/generator';

const args = process.argv.slice(2);
const opt = (name: string, def?: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const seed = opt('seed', 'demo')!;
const count = parseInt(opt('count', '14')!, 10);
const out = opt('out');
const course = opt('course');
if (out) mkdirSync(out, { recursive: true });

const t0 = Date.now();
const rows: string[] = [];
const save = (id: string, hole: unknown) => {
  if (out) writeFileSync(join(out, `${id}.json`), JSON.stringify(hole, null, 2));
};

if (course) {
  const c = generateCourse(course);
  for (const g of c.holes) {
    rows.push(`${g.hole.id.padEnd(18)} ${g.archetype.padEnd(11)} ${g.difficulty.padEnd(7)} par ${g.hole.par}  best ${g.report.bestStrokes}  find ${Math.round(g.report.cupFindRate * 100)}%  ${g.attempts} tries${g.fallback ? ' FALLBACK' : ''}  ${g.hole.name}`);
    save(g.hole.id, g.hole);
  }
  console.log(`course ${course}: total par ${c.holes.reduce((a, g) => a + g.hole.par, 0)}`);
} else {
  for (let i = 0; i < count; i++) {
    const archetype = ARCHETYPES[i % ARCHETYPES.length];
    const g = generateHole({ seed: `${seed}:${i}`, archetype });
    rows.push(`${g.hole.id.padEnd(18)} ${g.archetype.padEnd(11)} ${g.difficulty.padEnd(7)} par ${g.hole.par}  best ${g.report.bestStrokes}  find ${Math.round(g.report.cupFindRate * 100)}%  ${g.attempts} tries${g.fallback ? ' FALLBACK' : ''}  ${g.hole.name}`);
    save(g.hole.id, g.hole);
  }
}
console.log(rows.join('\n'));
console.log(`${rows.length} holes in ${((Date.now() - t0) / 1000).toFixed(1)}s${out ? `, written to ${out}/` : ''}`);
