// Opt-in entry point only. This does not import srvx or touch any body/DB/socket.
import { writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { installTerminalObserver } from './terminal-observer.mjs';

const directory = dirname(fileURLToPath(import.meta.url));
const enabled = process.env.TRADEREVIEW_REQUEST_BODY_TERMINAL === '1';
const prefix = process.env.TRADEREVIEW_REQUEST_BODY_TERMINAL_FILE;
const valid = typeof prefix === 'string' && isAbsolute(prefix) && dirname(prefix) === directory && /^[A-Za-z0-9_-]+$/.test(basename(prefix));
let state = Object.freeze({ state: 'disabled', reason: enabled ? 'invalid-output-prefix' : 'not-opted-in' });
if (enabled && valid) {
  const output = join(directory, `${basename(prefix)}.${process.pid}.ndjson`);
  const observer = installTerminalObserver({ onFlush: result => {
    // Exactly one attempt, after uninstall. Never overwrite earlier evidence.
    // On failure the controller exposes flushFailed; a missing file is invalid evidence.
    writeFileSync(output, result.buffer, { flag: 'wx', mode: 0o600 });
  } });
  state = Object.freeze({ state: 'installed', output, observer });
}
export const activation = state;
