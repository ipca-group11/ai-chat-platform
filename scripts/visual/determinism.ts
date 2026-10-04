#!/usr/bin/env node
// Proves the screenshots are deterministic (AICHAT-39): runs the visual project N times in the Playwright Docker
// image, each time rewriting every baseline (--update-snapshots=all), and checks after each run that no image
// differs from the committed one, byte for byte.
//   node scripts/visual/determinism.ts [runs]      (default 10; run the build of the apps first)
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const runs = Number(process.argv[2] ?? 10);
const folder = 'e2e/src/visual/__screenshots__/visual';

const digestOf = (file: string): string => createHash('sha256').update(readFileSync(join(folder, file))).digest('hex');

/** One digest per image, by file name. */
function hashEach(): Map<string, string> {
  return new Map(readdirSync(folder).sort().map((file) => [file, digestOf(file)]));
}

/** One short digest of all images together. */
function hashAll(images: Map<string, string>): string {
  return createHash('sha256').update([...images].join('\n')).digest('hex').slice(0, 12);
}

const committed = hashEach();
console.log(`committed baselines: ${committed.size} images, sha256 ${hashAll(committed)}`);
let failed = 0;
for (let run = 1; run <= runs; run += 1) {
  const result = spawnSync('pnpm', ['--filter', 'e2e', 'run', 'visual', '--update-snapshots=all'], { encoding: 'utf8' });
  const now = hashEach();
  const changed = [...now].filter(([file, digest]) => committed.get(file) !== digest).map(([file]) => file);
  const same = result.status === 0 && changed.length === 0 && now.size === committed.size;
  if (!same) failed += 1;
  console.log(`run ${run}: exit ${result.status}, images changed: ${changed.length}${changed.length ? ` (${changed.join(', ')})` : ''}, sha256 ${hashAll(now)} ${same ? 'identical' : 'DIFFERENT'}`);
}
console.log(failed === 0 ? `all ${runs} runs produced identical images` : `${failed} of ${runs} runs differed`);
process.exit(failed === 0 ? 0 : 1);
