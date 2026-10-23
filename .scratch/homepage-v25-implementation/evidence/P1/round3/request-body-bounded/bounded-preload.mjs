// Opt in only; do not import srvx or open a file/socket merely by loading this module.
import { writeFileSync } from 'node:fs';
import { dirname, basename, isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { installBoundedObserver } from './bounded-observer.mjs';

const ownDirectory = dirname(fileURLToPath(import.meta.url));
const enabled = process.env.TRADEREVIEW_REQUEST_BODY_BOUNDED === '1';
const prefix = process.env.TRADEREVIEW_REQUEST_BODY_BOUNDED_FILE;
if (enabled && typeof prefix === 'string' && isAbsolute(prefix) && dirname(prefix) === ownDirectory && /^[a-zA-Z0-9_-]+$/.test(basename(prefix))) {
  const output = join(ownDirectory, `${basename(prefix)}.${process.pid}.ndjson`);
  installBoundedObserver({ onFlush: result => {
    // Once after complete uninstall; exclusive create prevents replacing previous evidence.
    writeFileSync(output, result.buffer, { flag: 'wx', mode: 0o600 });
  } });
}
