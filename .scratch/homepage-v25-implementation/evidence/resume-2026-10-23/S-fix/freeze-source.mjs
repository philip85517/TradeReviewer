import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const output = path.dirname(new URL(import.meta.url).pathname);
const owned = ['app/lib/reviews/homepage-v25-state.ts', 'app/lib/reviews/homepage-v25-state.test.ts'];
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const diagnostic = JSON.parse(fs.readFileSync(path.join(output, '../S-debug/observations.json'), 'utf8'));
const comparisons = Object.entries(diagnostic.sourceHashes).filter(([file]) => !owned.includes(file))
  .map(([file, before]) => ({ file, before, after: hash(file), unchanged: hash(file) === before }));
const current = Object.fromEntries(owned.map(file => [file, hash(file)]));
const bindings = ['green.json', 'neighbors.json', 'boundaries.json'].map(file => {
  const saved = JSON.parse(fs.readFileSync(path.join(output, file), 'utf8'));
  return { file, matching: owned.every(source => saved.sourceHashes[source] === current[source]) };
});
const evidenceHashes = Object.fromEntries(['REPORT.md', 'INTERFACES.md', 'red.log', 'green.log', 'neighbors.log', 'boundaries.json'].map(file => [file, hash(path.join(output, file))]));
const result = { sourceHashes: current, comparisons, bindings, evidenceHashes };
fs.writeFileSync(path.join(output, 'source-freeze.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
process.exitCode = comparisons.every(item => item.unchanged) && bindings.every(item => item.matching) ? 0 : 1;
