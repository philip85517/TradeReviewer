import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

import { ensureRepoRoot } from './repo-root.mjs';
ensureRepoRoot(import.meta.url);
const root = 'docs/design-system/baselines/2026-10-20-homepage-v2.4.1/source/images';
const output = '.scratch/homepage-v241-repair/work/history/evidence/updated';
const names = [
  'history.svg',
  'history-stats-cumulative.svg',
  'history-stats-empty.svg',
  'history-stats-error.svg',
  'history-stats-extreme.svg',
  'history-stats-rounds.svg',
  'history-stats-source-missing.svg',
  'history-stats-win.svg',
  'journeys-year.svg',
  'contribution.svg',
  'contribution-states.svg',
  'contribution-current-a-share.svg',
  'contribution-historical-a-share.svg',
  'contribution-empty.svg',
  'contribution-error.svg',
  'contribution-loading.svg',
  'contribution-extreme.svg',
  'contribution-mixed-sign-demo.svg',
];

await fs.mkdir(output, { recursive: true });
for (const name of names) {
  const source = path.join(root, name);
  const destination = path.join(output, name.replace(/\.svg$/, '.png'));
  await sharp(source).png().toFile(destination);
  console.log(destination);
}
