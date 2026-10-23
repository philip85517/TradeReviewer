import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const paths = [
  'AGENTS.md', 'docs/agents/development-workflow.md',
  'vite.config.ts', 'next.config.ts', 'build/sites-vite-plugin.ts', 'worker/index.ts',
  'package.json', 'package-lock.json', 'scripts/start-local.mjs', 'scripts/debug-local.mjs',
  'node_modules/vinext/package.json', 'node_modules/srvx/package.json',
  'node_modules/@vitejs/plugin-rsc/package.json', 'node_modules/vite/package.json',
  'node_modules/srvx/dist/adapters/node.mjs', 'node_modules/srvx/dist/_chunks/_url.mjs',
  'node_modules/vinext/dist/index.js', 'node_modules/vinext/dist/cli.js',
  'node_modules/vinext/dist/cli-args.js', 'node_modules/vinext/dist/server/request-pipeline.js',
  'node_modules/vinext/dist/server/app-rsc-handler.js',
  'node_modules/vinext/dist/server/app-middleware.js',
  'node_modules/vinext/dist/server/middleware-runtime.js',
  'node_modules/vinext/dist/server/app-router-entry.js',
  'node_modules/vinext/dist/server/app-server-action-execution.js',
  'node_modules/vinext/dist/entries/app-rsc-entry.js',
  'node_modules/vinext/dist/server/request-log.js',
  'node_modules/@vitejs/plugin-rsc/dist/plugin-BhzHKRFo.js',
  'node_modules/vite/dist/node/chunks/node.js',
  'app/api/storage/recall/route.ts', 'app/api/storage/trades/route.ts',
  'app/api/storage/instruments/metadata/route.ts',
  'app/lib/recall/repository.ts', 'app/lib/storage/sqlite-http-client.ts',
  'app/lib/storage/review-summary-client.ts',
  '.scratch/homepage-v25-implementation/evidence/P1/round3/ROOT-REQUEST-BODY-DIAGNOSIS.md',
  '.scratch/homepage-v25-implementation/evidence/P1/round3/request-adapter-diagnostic.json',
  '.scratch/homepage-v25-implementation/evidence/P1/round3/recall-fault-proxy.mjs',
];
const files = paths.map(path => ({ path, ...(existsSync(path)
  ? { sha256: createHash('sha256').update(readFileSync(path)).digest('hex') }
  : { exists: false }) }));
const result = {
  capturedAt: new Date().toISOString(), runtime: process.version,
  cwd: process.cwd(), head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  model: 'gpt-6.1-sol', reasoningEffort: 'ultra',
  files,
  projectFrameworkHooks: Object.fromEntries([
    'pages', 'src/pages', 'src/app', 'middleware.ts', 'proxy.ts', 'instrumentation.ts',
    'src/middleware.ts', 'src/proxy.ts', 'src/instrumentation.ts',
  ].map(path => [path, existsSync(path)])),
  frameworkConfigDiffFromHead: execFileSync('git', ['diff', '--',
    'vite.config.ts', 'next.config.ts', 'build/sites-vite-plugin.ts', 'worker/index.ts',
    'package.json', 'package-lock.json'], { encoding: 'utf8' }),
  productWrites: false, serviceOrBrowser: false, databaseAccess: false,
};
writeFileSync(new URL('./source-manifest.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ capturedAt: result.capturedAt, files: files.length, head: result.head }));
