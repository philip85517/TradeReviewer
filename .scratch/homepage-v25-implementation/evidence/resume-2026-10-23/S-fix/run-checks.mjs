import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const output = path.dirname(new URL(import.meta.url).pathname);
const mode = process.argv[2];
const stateTest = 'app/lib/reviews/homepage-v25-state.test.ts';
const tests = mode === 'neighbors' ? [stateTest, 'app/lib/reviews/dashboard-browse-preferences.test.ts', 'app/components/library/library-browse-state.test.ts'] : [stateTest];
const args = ['node_modules/vitest/vitest.mjs', 'run', ...tests, '--maxWorkers=1', '--reporter=verbose'];
const result = spawnSync(process.execPath, args, { cwd: process.cwd(), encoding: 'utf8', env: { ...process.env, NO_COLOR: '1' } });
fs.writeFileSync(path.join(output, `${mode}.log`), result.stdout + result.stderr);
const sourceHashes = Object.fromEntries(['app/lib/reviews/homepage-v25-state.ts', stateTest].map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
const metadata = { mode, node: process.version, executable: process.execPath, args, exitStatus: result.status, sourceHashes };
fs.writeFileSync(path.join(output, `${mode}.json`), JSON.stringify(metadata, null, 2) + '\n');
console.log(result.stdout + result.stderr);
console.log(JSON.stringify(metadata, null, 2));
process.exitCode = result.status ?? 1;
