/**
 * CLI: solve one or more hole JSON files and print a report.
 *   npm run solve                      # all shipped holes
 *   npm run solve -- path/to/hole.json # specific files
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { solveHole } from '../src/solver/solver';
import { validateHole } from '../src/sim/validate';
import { DEFAULT_PARAMS } from '../src/sim/params';

const args = process.argv.slice(2);
const files = args.length
  ? args
  : readdirSync('src/holes')
      .filter((f) => f.endsWith('.json'))
      .sort()
      .map((f) => join('src/holes', f));

for (const f of files) {
  const v = validateHole(JSON.parse(readFileSync(f, 'utf8')));
  if (!v.ok || !v.hole) {
    console.log(`${f}: INVALID\n  ${v.errors.join('\n  ')}`);
    continue;
  }
  const r = solveHole(v.hole, DEFAULT_PARAMS);
  console.log(`${v.hole.name} (${v.hole.id})  declared par ${v.hole.par}`);
  console.log(
    `  solver par ${r.par ?? '-'}  best ${r.bestStrokes ?? '-'}  success ${Math.round(r.successRate * 100)}%  ace ${(r.aceRate * 100).toFixed(1)}%  hazard ${(r.hazardRate * 100).toFixed(1)}%`,
  );
  console.log(
    `  tee->cup direct ${r.teeToCupDirect.toFixed(1)}u  path ${r.teeToCupPath < 0 ? 'blocked' : r.teeToCupPath.toFixed(1) + 'u'}  cup-corner ${r.cupNearestCorner.toFixed(1)}u  traps ${r.trapsFound}  ${r.timeMs.toFixed(0)}ms`,
  );
  console.log(`  ${r.accepted ? 'ACCEPT' : 'REJECT: ' + r.rejectReasons.join('; ')}`);
}
