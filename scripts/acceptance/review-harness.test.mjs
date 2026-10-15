import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import {
  jsonSafe,
  serializeRows,
  selectExactDrawing,
  waitForWorkspaceReady,
} from './review-harness.mjs';

const ready = (overrides = {}) => ({
  workspaceCount: 1,
  visibleWorkspaceCount: 1,
  busy: false,
  loading: false,
  error: null,
  selectCount: 1,
  selectVisible: true,
  uiEpisodeId: 'episode-1',
  documentEpisodeId: 'episode-1',
  canvasEpisodeId: 'episode-1',
  sdkReady: true,
  restorationReady: true,
  ...overrides,
});

function deterministicClock() {
  let time = 0;
  return {
    now: () => time,
    sleep: async (ms) => {
      time += Math.max(ms, 1);
    },
  };
}

function selection(drawingId = null, overrides = {}) {
  return {
    selectedDrawingId: drawingId,
    episodeId: 'episode-1',
    drawings: drawingId
      ? [{ id: drawingId, episodeId: 'episode-1', tool: 'text' }]
      : [],
    ...overrides,
  };
}

test('serializes real SQLite rows and is safe as an Array#map callback', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec('CREATE TABLE fixture (id TEXT, quantity INTEGER)');
    db.prepare('INSERT INTO fixture VALUES (?, ?)').run('trade-1', 3);
    const rows = db.prepare('SELECT * FROM fixture').all();
    assert.deepEqual(rows.map(jsonSafe), [{ id: 'trade-1', quantity: 3 }]);
    assert.deepEqual(serializeRows(rows), [{ id: 'trade-1', quantity: 3 }]);
  } finally {
    db.close();
  }
});

test('jsonSafe preserves shared children while marking only cycles', () => {
  const shared = { value: 'same' };
  const cycle = { name: 'root' };
  cycle.self = cycle;
  assert.deepEqual(jsonSafe({
    left: shared,
    right: shared,
    cycle,
    quantity: 4n,
    callback: () => 'ignored',
    __internal: 'ignored',
  }), {
    left: { value: 'same' },
    right: { value: 'same' },
    cycle: { name: 'root', self: '[Circular]' },
    quantity: 4,
  });
  assert.deepEqual(serializeRows([]), []);
  assert.throws(() => serializeRows(null), /expects an array/);
});

test('waitForWorkspaceReady waits through loading, old identity, and missing identity', async () => {
  const clock = deterministicClock();
  const observations = [
    ready({ loading: true, sdkReady: false, restorationReady: false }),
    ready({ uiEpisodeId: 'episode-old', documentEpisodeId: 'episode-old', canvasEpisodeId: 'episode-old' }),
    ready({ uiEpisodeId: null, documentEpisodeId: null, canvasEpisodeId: null }),
    ready(),
  ];
  let reads = 0;
  const result = await waitForWorkspaceReady(
    async () => observations[Math.min(reads++, observations.length - 1)],
    'episode-1',
    { timeoutMs: 100, pollMs: 10, ...clock },
  );
  assert.equal(result.observation.uiEpisodeId, 'episode-1');
  assert.equal(result.trajectory.length, 4);
  assert.equal(reads, 4);
});

test('waitForWorkspaceReady fails immediately for load errors, duplicates, and read failures', async () => {
  const clock = deterministicClock();
  await assert.rejects(
    () => waitForWorkspaceReady(async () => ready({ error: 'boom' }), 'episode-1', clock),
    (error) => error.code === 'LOAD_ERROR' && error.trajectory.length === 1,
  );
  await assert.rejects(
    () => waitForWorkspaceReady(async () => ready({ workspaceCount: 2, visibleWorkspaceCount: 2 }), 'episode-1', clock),
    (error) => error.code === 'HARNESS_ERROR' && error.trajectory.length === 1,
  );
  await assert.rejects(
    () => waitForWorkspaceReady(async () => ready({ selectVisible: 1 }), 'episode-1', clock),
    (error) => error.code === 'HARNESS_ERROR' && /selectVisible/.test(error.cause),
  );
  await assert.rejects(
    () => waitForWorkspaceReady(async () => { throw new Error('observer broke'); }, 'episode-1', clock),
    (error) => error.code === 'HARNESS_ERROR' && /observer broke/.test(error.cause),
  );
});

test('waitForWorkspaceReady reports identity mismatch and not-ready timeout distinctly', async () => {
  const clock = deterministicClock();
  await assert.rejects(
    () => waitForWorkspaceReady(
      async () => ready({ uiEpisodeId: 'wrong', documentEpisodeId: 'wrong', canvasEpisodeId: 'wrong' }),
      'episode-1',
      { timeoutMs: 10, pollMs: 10, ...clock },
    ),
    (error) => error.code === 'IDENTITY_MISMATCH' && error.lastObservation.uiEpisodeId === 'wrong',
  );
  const missingClock = deterministicClock();
  await assert.rejects(
    () => waitForWorkspaceReady(
      async () => ready({ uiEpisodeId: null, documentEpisodeId: null, canvasEpisodeId: null }),
      'episode-1',
      { timeoutMs: 20, pollMs: 10, ...missingClock },
    ),
    (error) => error.code === 'LOAD_NOT_READY' && error.lastObservation.uiEpisodeId === null,
  );
});

test('waitForWorkspaceReady classifies timeout from the final identity observation', async () => {
  const clock = deterministicClock();
  const observations = [
    ready({ uiEpisodeId: 'episode-old', documentEpisodeId: 'episode-old', canvasEpisodeId: 'episode-old' }),
    ready({ sdkReady: false, restorationReady: false }),
  ];
  let reads = 0;
  await assert.rejects(
    () => waitForWorkspaceReady(
      async () => observations[Math.min(reads++, observations.length - 1)],
      'episode-1',
      { timeoutMs: 10, pollMs: 10, ...clock },
    ),
    (error) => error.code === 'LOAD_NOT_READY' && error.lastObservation.uiEpisodeId === 'episode-1' && error.trajectory.length === 2,
  );
});

test('selectExactDrawing neutralizes first and proves the exact target after click', async () => {
  const clock = deterministicClock();
  let selected = 'overlap';
  const calls = [];
  const result = await selectExactDrawing({
    read: async () => selection(selected),
    neutralize: async () => { calls.push('neutralize'); selected = null; },
    click: async () => { calls.push('click'); selected = 'drawing-target'; },
    expected: { drawingId: 'drawing-target', episodeId: 'episode-1', tool: 'text' },
    timeoutMs: 50,
    pollMs: 10,
    ...clock,
  });
  assert.deepEqual(calls, ['neutralize', 'click']);
  assert.equal(result.before.selectedDrawingId, 'overlap');
  assert.equal(result.after.selectedDrawingId, 'drawing-target');
  assert.ok(result.trajectory.some(({ observation }) => observation.selectedDrawingId === null));
});

test('selectExactDrawing does not treat an already-selected target as click proof', async () => {
  const clock = deterministicClock();
  let selected = 'drawing-target';
  const calls = [];
  await selectExactDrawing({
    read: async () => selection(selected),
    neutralize: async () => { calls.push('neutralize'); selected = null; },
    click: async () => { calls.push('click'); selected = 'drawing-target'; },
    expected: { drawingId: 'drawing-target', episodeId: 'episode-1', tool: 'text' },
    timeoutMs: 50,
    pollMs: 10,
    ...clock,
  });
  assert.deepEqual(calls, ['neutralize', 'click']);
});

test('selectExactDrawing stops immediately when the actual selected ID is another drawing', async () => {
  const clock = deterministicClock();
  let selected = null;
  let reads = 0;
  let clicks = 0;
  await assert.rejects(
    () => selectExactDrawing({
      read: async () => { reads += 1; return selection(selected); },
      neutralize: async () => { selected = null; },
      click: async () => { clicks += 1; selected = 'other-drawing'; },
      expected: { drawingId: 'drawing-target', episodeId: 'episode-1', tool: 'text' },
      timeoutMs: 100,
      pollMs: 10,
      ...clock,
    }),
    (error) => error.code === 'SELECTION_NOT_TARGET' &&
      error.after.selectedDrawingId === 'other-drawing' &&
      error.trajectory.at(-1).observation.selectedDrawingId === 'other-drawing' &&
      reads === 3 && clicks === 1,
  );
});

test('selectExactDrawing rejects wrong identity/tool and bounded no-selection', async () => {
  const clock = deterministicClock();
  await assert.rejects(
    () => selectExactDrawing({
      read: async () => selection(null, { drawings: [{ id: 'other', episodeId: 'episode-1', tool: 'text' }] }),
      neutralize: async () => {},
      click: async () => {},
      expected: { drawingId: 'drawing-target', episodeId: 'episode-1', tool: 'text' },
      timeoutMs: 20,
      pollMs: 10,
      ...clock,
    }),
    (error) => error.code === 'SELECTION_NOT_TARGET' && error.before && error.after && error.trajectory.length > 0,
  );
  const wrongClock = deterministicClock();
  let clicked = false;
  await assert.rejects(
    () => selectExactDrawing({
      read: async () => clicked
        ? selection('drawing-target', { episodeId: 'episode-other', drawings: [{ id: 'drawing-target', episodeId: 'episode-other', tool: 'line' }] })
        : selection(null),
      neutralize: async () => {},
      click: async () => { clicked = true; },
      expected: { drawingId: 'drawing-target', episodeId: 'episode-1', tool: 'text' },
      timeoutMs: 20,
      pollMs: 10,
      ...wrongClock,
    }),
    (error) => error.code === 'SELECTION_NOT_TARGET' && /expected target/.test(error.message),
  );
  const observerClock = deterministicClock();
  await assert.rejects(
    () => selectExactDrawing({
      read: async () => { throw new Error('selection observer broke'); },
      neutralize: async () => {},
      click: async () => {},
      expected: { drawingId: 'drawing-target', episodeId: 'episode-1', tool: 'text' },
      timeoutMs: 20,
      pollMs: 10,
      ...observerClock,
    }),
    (error) => error.code === 'HARNESS_ERROR' && error.before === undefined && Array.isArray(error.trajectory),
  );
});
