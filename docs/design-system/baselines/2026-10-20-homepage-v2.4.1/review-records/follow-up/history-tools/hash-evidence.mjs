#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { ensureRepoRoot } from './repo-root.mjs';
ensureRepoRoot(import.meta.url);
const sourceRoot = 'docs/design-system/baselines/2026-10-20-homepage-v2.4.1/source/images';
const workRoot = '.scratch/homepage-v241-repair/work/history';
const sourceNames = fs.readdirSync(sourceRoot)
  .filter((name) => /^(history(?:-stats-[^.]*)?|journeys-year|contribution[^.]*)\.svg$/.test(name))
  .map((name) => path.join(sourceRoot, name));
const workNames = [
  'COVERAGE.md',
  'MODIFICATIONS.md',
  'REPORT.md',
  'apply-shared-embedded.mjs',
  'hash-evidence.mjs',
  'render-evidence.mjs',
  'render-shared-evidence.mjs',
  'transform-history-source.mjs',
  'verify-final.mjs',
];
const followUpRoot = 'docs/design-system/baselines/2026-10-20-homepage-v2.4.1/review-records/follow-up/history-tools';
const followUpNames = [
  'README.md',
  'apply-shared-embedded.mjs',
  'hash-evidence.mjs',
  'render-evidence.mjs',
  'render-shared-evidence.mjs',
  'repo-root.mjs',
  'transform-history-source.mjs',
  'verify-final.mjs',
].map((name) => path.join(followUpRoot, name));
const evidenceNames = [];
for (const dir of ['evidence/updated', 'evidence/shared', 'evidence/shared-rendered']) {
  const absolute = path.join(workRoot, dir);
  if (!fs.existsSync(absolute)) continue;
  for (const name of fs.readdirSync(absolute).sort()) {
    evidenceNames.push(path.join(workRoot, dir, name));
  }
}
const files = [
  ...sourceNames,
  ...workNames.map((name) => path.join(workRoot, name)),
  ...followUpNames,
  ...evidenceNames,
]
  .filter((file) => fs.existsSync(file))
  .sort();
const lines = files.map((file) => {
  const hash = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  return `${hash}  ${file}`;
});
console.log(lines.join('\n'));
