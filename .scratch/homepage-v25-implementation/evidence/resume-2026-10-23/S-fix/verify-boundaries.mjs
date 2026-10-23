import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const run = promisify(execFile);
const output = path.dirname(new URL(import.meta.url).pathname);
const sources = ['app/lib/reviews/homepage-v25-state.ts', 'app/lib/reviews/homepage-v25-state.test.ts'];
const commands = {
  'root-six': ['.scratch/homepage-v25-implementation/evidence/S/coordinator-round3.mjs'],
  'typecheck': ['node_modules/typescript/bin/tsc', '--noEmit', '--strict', '--target', 'es2023', '--module', 'esnext', '--moduleResolution', 'bundler', '--skipLibCheck', '--types', 'node,vitest/globals', ...sources],
  'eslint': ['node_modules/eslint/bin/eslint.js', ...sources],
};
const results = await Promise.all(Object.entries(commands).map(async ([name, args]) => {
  let stdout = '', stderr = '', exitStatus = 0;
  try { ({ stdout, stderr } = await run(process.execPath, args, { cwd: process.cwd(), env: { ...process.env, NO_COLOR: '1' } })); }
  catch (error) { stdout = error.stdout ?? ''; stderr = error.stderr ?? ''; exitStatus = error.code ?? 1; }
  fs.writeFileSync(path.join(output, `${name}.stdout.txt`), stdout);
  fs.writeFileSync(path.join(output, `${name}.stderr.txt`), stderr);
  return { name, executable: process.execPath, args, exitStatus, stdout, stderr };
}));
const sourceHashes = Object.fromEntries(sources.map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
fs.writeFileSync(path.join(output, 'boundaries.json'), JSON.stringify({ node: process.version, sourceHashes, results }, null, 2) + '\n');
console.log(JSON.stringify({ sourceHashes, results }, null, 2));
process.exitCode = results.every(result => result.exitStatus === 0) ? 0 : 1;
