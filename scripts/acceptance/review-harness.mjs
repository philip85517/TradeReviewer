const OBSERVATION_KEYS = [
  'workspaceCount',
  'visibleWorkspaceCount',
  'busy',
  'loading',
  'error',
  'selectCount',
  'selectVisible',
  'uiEpisodeId',
  'documentEpisodeId',
  'canvasEpisodeId',
  'sdkReady',
  'restorationReady',
];

function isObject(value) {
  return value !== null && typeof value === 'object';
}
/**
 * Clone values into a journal-safe shape. `active` is the current recursion
 * path, rather than a process-wide seen set, so a shared child is preserved
 * while a genuine back-edge is rendered as [Circular].
 */
function cloneJsonSafe(value, active) {
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'function') return undefined;
  if (value === null || typeof value !== 'object') return value;

  if (active.has(value)) return '[Circular]';
  active.add(value);
  try {
    if (Array.isArray(value)) {
      return value.map((item) => cloneJsonSafe(item, active));
    }

    const output = {};
    for (const [key, item] of Object.entries(value)) {
      if (key.startsWith('__') || typeof item === 'function') continue;
      const safe = cloneJsonSafe(item, active);
      if (safe !== undefined) output[key] = safe;
    }
    return output;
  } finally {
    active.delete(value);
  }
}

// Keep the public callback unary: Array#map passes (value, index, array), and
// the index must never be mistaken for the recursion-path WeakSet.
export function jsonSafe(value) {
  return cloneJsonSafe(value, new WeakSet());
}

export function serializeRows(rows) {
  if (!Array.isArray(rows)) {
    throw new TypeError('serializeRows expects an array');
  }
  return rows.map((row) => jsonSafe(row));
}

function harnessError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, details);
  return error;
}

function validateReadyObservation(observation) {
  if (!isObject(observation)) throw new TypeError('read() must return an observation object');
  for (const key of OBSERVATION_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(observation, key)) {
      throw new TypeError(`read() observation is missing ${key}`);
    }
  }
  for (const key of ['workspaceCount', 'visibleWorkspaceCount', 'selectCount']) {
    if (!Number.isInteger(observation[key]) || observation[key] < 0) {
      throw new TypeError(`read() observation has invalid ${key}`);
    }
  }
  if (observation.visibleWorkspaceCount > observation.workspaceCount) {
    throw new TypeError('visibleWorkspaceCount exceeds workspaceCount');
  }
  if (typeof observation.selectVisible !== 'boolean') {
    throw new TypeError('read() observation has invalid selectVisible');
  }
  return observation;
}

function validateClockOption(name, value) {
  if (!Number.isFinite(value) || value < 0) throw new TypeError(`${name} must be a non-negative number`);
}

function defaultSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function traceEntry(at, observation) {
  return { at, observation: jsonSafe(observation) };
}

function withObservationDetails(error, { trajectory, lastObservation }) {
  error.trajectory = trajectory;
  error.lastObservation = lastObservation;
  return error;
}

export async function waitForWorkspaceReady(read, expectedEpisodeId, options = {}) {
  if (typeof read !== 'function') throw new TypeError('read must be a function');
  if (expectedEpisodeId === undefined || expectedEpisodeId === null || expectedEpisodeId === '') {
    throw new TypeError('expectedEpisodeId must be non-empty');
  }

  const timeoutMs = options.timeoutMs ?? 20_000;
  const pollMs = options.pollMs ?? 100;
  const sleep = options.sleep ?? defaultSleep;
  const now = options.now ?? Date.now;
  validateClockOption('timeoutMs', timeoutMs);
  validateClockOption('pollMs', pollMs);
  if (typeof sleep !== 'function' || typeof now !== 'function') {
    throw new TypeError('sleep and now must be functions');
  }

  const trajectory = [];
  const startedAt = now();
  let lastObservation;

  while (true) {
    let observation;
    try {
      observation = validateReadyObservation(await read());
    } catch (cause) {
      throw withObservationDetails(
        harnessError('HARNESS_ERROR', 'Workspace observation failed', { cause: String(cause?.message ?? cause) }),
        { trajectory, lastObservation },
      );
    }

    lastObservation = observation;
    trajectory.push(traceEntry(now(), observation));

    if (observation.error) {
      throw withObservationDetails(
        harnessError('LOAD_ERROR', 'Workspace reported a load error'),
        { trajectory, lastObservation },
      );
    }
    if (observation.workspaceCount > 1 || observation.visibleWorkspaceCount > 1) {
      throw withObservationDetails(
        harnessError('HARNESS_ERROR', 'Workspace observation is not unique'),
        { trajectory, lastObservation },
      );
    }
    if (observation.selectCount > 1) {
      throw withObservationDetails(
        harnessError('HARNESS_ERROR', 'Episode selector observation is not unique'),
        { trajectory, lastObservation },
      );
    }

    const ready =
      observation.workspaceCount === 1 &&
      observation.visibleWorkspaceCount === 1 &&
      !observation.busy &&
      !observation.loading &&
      observation.selectCount === 1 &&
      observation.selectVisible === true &&
      observation.uiEpisodeId === expectedEpisodeId &&
      observation.documentEpisodeId === expectedEpisodeId &&
      observation.canvasEpisodeId === expectedEpisodeId &&
      observation.sdkReady === true &&
      observation.restorationReady === true;
    if (ready) return { observation, trajectory };

    const elapsed = now() - startedAt;
    if (elapsed >= timeoutMs) {
      const completeFinalIdentity =
        observation.uiEpisodeId !== null && observation.uiEpisodeId !== undefined &&
        observation.documentEpisodeId !== null && observation.documentEpisodeId !== undefined &&
        observation.canvasEpisodeId !== null && observation.canvasEpisodeId !== undefined;
      const finalIdentityMismatch =
        completeFinalIdentity &&
        (observation.uiEpisodeId !== expectedEpisodeId ||
          observation.documentEpisodeId !== expectedEpisodeId ||
          observation.canvasEpisodeId !== expectedEpisodeId);
      const code = finalIdentityMismatch ? 'IDENTITY_MISMATCH' : 'LOAD_NOT_READY';
      throw withObservationDetails(
        harnessError(code, code === 'IDENTITY_MISMATCH' ? 'Workspace identity did not match expected episode' : 'Workspace did not become ready'),
        { trajectory, lastObservation },
      );
    }
    await sleep(Math.min(pollMs, Math.max(0, timeoutMs - elapsed)));
  }
}
function validateSelectionObservation(observation) {
  if (!isObject(observation)) throw new TypeError('read() must return a selection observation object');
  if (!Array.isArray(observation.drawings)) throw new TypeError('read() observation drawings must be an array');
  if (!Object.prototype.hasOwnProperty.call(observation, 'selectedDrawingId')) {
    throw new TypeError('read() observation is missing selectedDrawingId');
  }
  if (!Object.prototype.hasOwnProperty.call(observation, 'episodeId')) {
    throw new TypeError('read() observation is missing episodeId');
  }
  return observation;
}

function selectionMatches(observation, expected) {
  if (observation.selectedDrawingId !== expected.drawingId) return false;
  if (observation.episodeId !== expected.episodeId) return false;
  const drawing = observation.drawings.find((item) => item?.id === expected.drawingId);
  return drawing?.id === expected.drawingId && drawing?.episodeId === expected.episodeId && drawing?.tool === expected.tool;
}

function selectionError(code, message, before, after, trajectory) {
  return harnessError(code, message, { before, after, trajectory });
}

export async function selectExactDrawing({ read, neutralize, click, expected, timeoutMs = 2_000, pollMs = 50, sleep = defaultSleep, now = Date.now }) {
  if (typeof read !== 'function' || typeof neutralize !== 'function' || typeof click !== 'function') {
    throw new TypeError('read, neutralize, and click must be functions');
  }
  if (!expected || !expected.drawingId || !expected.episodeId || expected.tool !== 'text') {
    throw new TypeError('expected must contain drawingId, episodeId, and tool:text');
  }
  validateClockOption('timeoutMs', timeoutMs);
  validateClockOption('pollMs', pollMs);
  if (typeof sleep !== 'function' || typeof now !== 'function') {
    throw new TypeError('sleep and now must be functions');
  }

  const trajectory = [];
  const startedAt = now();
  let before;
  let after;
  const observe = async () => {
    try {
      const observation = validateSelectionObservation(await read());
      after = observation;
      trajectory.push(traceEntry(now(), observation));
      return observation;
    } catch (cause) {
      throw harnessError('HARNESS_ERROR', 'Selection observation failed', { cause: String(cause?.message ?? cause), before, after, trajectory });
    }
  };

  before = await observe();
  try {
    await neutralize();
  } catch (cause) {
    throw selectionError('HARNESS_ERROR', 'Could not neutralize current drawing selection', before, after, trajectory);
  }

  let neutralized = false;
  while (true) {
    const current = await observe();
    if (current.selectedDrawingId === null) {
      neutralized = true;
      break;
    }
    const elapsed = now() - startedAt;
    if (elapsed >= timeoutMs) {
      throw selectionError('SELECTION_NOT_TARGET', 'Drawing selection did not clear before click', before, after, trajectory);
    }
    await sleep(Math.min(pollMs, Math.max(0, timeoutMs - elapsed)));
  }
  if (!neutralized) throw selectionError('SELECTION_NOT_TARGET', 'Drawing selection did not clear before click', before, after, trajectory);

  try {
    await click();
  } catch (cause) {
    throw selectionError('HARNESS_ERROR', 'Drawing click failed', before, after, trajectory);
  }

  while (true) {
    const current = await observe();
    if (current.selectedDrawingId !== null) {
      if (current.selectedDrawingId !== expected.drawingId || !selectionMatches(current, expected)) {
        throw selectionError('SELECTION_NOT_TARGET', 'Clicked drawing did not become the expected target', before, after, trajectory);
      }
      return { before, after: current, trajectory };
    }
    const elapsed = now() - startedAt;
    if (elapsed >= timeoutMs) {
      throw selectionError('SELECTION_NOT_TARGET', 'Expected drawing was not selected before timeout', before, after, trajectory);
    }
    await sleep(Math.min(pollMs, Math.max(0, timeoutMs - elapsed)));
  }
}
