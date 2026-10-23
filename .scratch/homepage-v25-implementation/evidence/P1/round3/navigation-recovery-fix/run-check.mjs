import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const [label, ...args] = process.argv.slice(2);
if (!/^[a-z0-9-]+$/.test(label ?? '') || !args.length) throw new Error('label and exact Node arguments required');
const node = '/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node';
const evidence = resolve('.scratch/homepage-v25-implementation/evidence/P1/round3/navigation-recovery-fix');
const paths = JSON.parse(readFileSync(resolve(evidence, 'baseline-manifest.json'), 'utf8')).map(item => item.path);
paths.push('app/components/homepage-v25/navigation-recovery.test.tsx');
const manifest = () => Object.fromEntries(paths.map(path => [path, createHash('sha256').update(readFileSync(path)).digest('hex')]));
const before = manifest();
const startedAt = new Date().toISOString();
const result = spawnSync(node, args, { cwd: process.cwd(), encoding: 'utf8', timeout: 180000, maxBuffer: 16 * 1024 * 1024 });
const log = `${result.stdout ?? ''}${result.stderr ?? ''}`;
writeFileSync(resolve(evidence, `${label}.log`), log, { flag: 'wx' });
writeFileSync(resolve(evidence, `${label}.json`), JSON.stringify({ startedAt, endedAt: new Date().toISOString(), node, args,
  exitCode: result.status, signal: result.signal, error: result.error?.message ?? null, before, after: manifest() }, null, 2) + '\n', { flag: 'wx' });
process.stdout.write(log);
process.stdout.write(`\nRecorded ${label}: exit ${result.status}\n`);
process.exitCode = result.status ?? 1;
