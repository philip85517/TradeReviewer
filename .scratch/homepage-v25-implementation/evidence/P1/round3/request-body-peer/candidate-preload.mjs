// REVIEW CANDIDATE. Not loaded or activated during preparation.
// --import alone is inert: both opt-in variables are required.
import { openSync, realpathSync, writeSync, closeSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { installRequestBodyObserver } from './candidate-observer.mjs';

if (process.env.TRADEREVIEW_REQUEST_BODY_TRACE === '1') {
  let fd;
  let uninstall;
  try {
    const directory = realpathSync(fileURLToPath(new URL('.', import.meta.url)));
    const requested = process.env.TRADEREVIEW_REQUEST_BODY_TRACE_FILE;
    if (!requested || !requested.startsWith('/') || realpathSync(dirname(requested)) !== directory ||
        !/^[a-zA-Z0-9][a-zA-Z0-9._-]*\.ndjson$/.test(basename(requested))) {
      throw new Error('candidate destination rejected');
    }
    // Parent start-local and its vinext child inherit NODE_OPTIONS. Separate PID
    // files prevent collision or cross-process line interleaving; wx never truncates.
    const actual = join(directory, `${basename(requested, '.ndjson')}.${process.pid}.ndjson`);
    fd = openSync(actual, 'wx', 0o600);
    const write = record => writeSync(fd, `${JSON.stringify(record)}\n`);
    // Import the installed adapter only after opt-in, never a product/app module.
    // This early import is a timing perturbation documented in CANDIDATE.md.
    const { NodeRequest } = await import('srvx/node');
    write({ phase: 'candidate-preload', at: new Date().toISOString(), pid: process.pid,
      node: process.version, adapter: 'srvx/node', protocol: 'request-body-peer-v1' });
    uninstall = installRequestBodyObserver({ NodeRequest, write, maxEvents: 2000, maxRequests: 200 });
    process.once('exit', () => {
      try { uninstall(); } catch {}
      try { closeSync(fd); } catch {}
    });
  } catch {
    try { uninstall?.(); } catch {}
    if (fd !== undefined) { try { closeSync(fd); } catch {} }
    // Fixed message, no raw error, URL, filesystem path or environment value.
    process.stderr.write('[request-body-peer] candidate not active: setup unavailable\n');
  }
}
