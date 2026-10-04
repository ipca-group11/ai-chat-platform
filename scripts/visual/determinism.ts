#!/usr/bin/env node
// Proves the screenshots are deterministic (AICHAT-39): runs the visual project N times in the Playwright Docker
// image, each time rewriting every baseline (--update-snapshots=all), and checks after each run that no image
// differs from the committed one, byte for byte.
//   node scripts/visual/determinism.ts [runs]      (default 10; run the build of the apps first)
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const runs = Number(process.argv[2] ?? 10);
const folder = 'e2e/src/visual/__screenshots__/visual';

function hashAll(): string {
  const hash = createHash('sha256');
  for (const file of readdirSync(folder).sort()) hash.update(file).update(readFileSync(join(folder, file)));
  return hash.digest('hex').slice(0, 12);
}

const committed = hashAll();
console.log(`committed baselines: ${readdirSync(folder).length} images, sha256 ${committed}`);
let failed = 0;
for (let run = 1; run <= runs; run += 1) {
  const result = spawnSync('pnpm', ['--filter', 'e2e', 'run', 'visual', '--update-snapshots=all'], { encoding: 'utf8' });
  const changed = execFileSync('git', ['status', '--porcelain', folder], { encoding: 'utf8' }).split('\n').filter(Boolean).length;
  const digest = hashAll();
  const same = result.status === 0 && changed === 0 && digest === committed;
  if (!same) failed += 1;
  console.log(`run ${run}: exit ${result.status}, images changed vs committed: ${changed}, sha256 ${digest} ${same ? 'identical' : 'DIFFERENT'}`);
}
console.log(failed === 0 ? `all ${runs} runs produced identical images` : `${failed} of ${runs} runs differed`);
process.exit(failed === 0 ? 0 : 1);
