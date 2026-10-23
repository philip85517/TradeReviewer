import assert from 'node:assert/strict';
import test from 'node:test';
import { EventEmitter } from 'node:events';
import { IncomingMessage, Server, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import { cloneRequestWithHeaders } from 'vinext/server/request-pipeline';

const surfaces = [Object, Server.prototype, IncomingMessage.prototype, ServerResponse.prototype, Readable, Request.prototype, ReadableStream.prototype];
const initial = surfaces.map(p => Object.getOwnPropertyDescriptors(p));
const nativeRequest = globalThis.Request;
let api;
try { api = await import('./terminal-observer.mjs'); }
catch (error) { if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error; }
let NodeRequest;
function implementation() {
  assert.equal(typeof api?.installTerminalObserver, 'function', 'RED: terminal observer has not been implemented');
  return api;
}
function pair(method = 'PUT', url = '/api/storage/reviews?private=QUERY_SECRET') {
  const req = new IncomingMessage(null);
  req.method = method; req.url = url;
  req.headers = { host: 'memory.invalid', authorization: 'HEADER_SECRET' };
  req.rawHeaders = ['host', 'memory.invalid', 'authorization', 'HEADER_SECRET'];
  return { req, res: new ServerResponse(req) };
}
function dispatch(p, callback = () => {}) {
  const server = new EventEmitter(); Object.setPrototypeOf(server, Server.prototype);
  server.on('request', callback);
  return server.emit('request', p.req, p.res);
}
function buffered(p) { p.req.push(Buffer.from('BODY_SECRET')); p.req.push(null); p.req.complete = true; return p; }
function snapshot(req) {
  return { length: req.readableLength, disturbed: Readable.isDisturbed(req), flowing: req.readableFlowing, data: req.listenerCount('data'), readable: req.listenerCount('readable') };
}
function install(options = {}) {
  return implementation().installTerminalObserver({ nodeRequestPrototype: NodeRequest?.prototype, ...options });
}
function assertRestored(before) {
  for (let i = 0; i < surfaces.length; i++) {
    const after = Object.getOwnPropertyDescriptors(surfaces[i]);
    assert.deepEqual(Reflect.ownKeys(after), Reflect.ownKeys(before[i]), `surface ${i} keys`);
    for (const key of Reflect.ownKeys(before[i])) assert.deepEqual(after[key], before[i][key], `surface ${i} descriptor ${String(key)}`);
  }
}
function assertStop(result, reason) {
  assert.equal(result.reason, reason);
  assert.equal(result.events.filter(e => e.phase === 'observer-stop').length, 1);
  assert.equal(result.events.at(-1).phase, 'observer-stop');
  assert.equal(result.restoration.failed, 0);
  assert.equal(result.restoration.ownedRemaining, 0);
  assert.ok(result.events.length <= result.limits.events);
  assert.ok(result.bytes <= result.limits.bytes);
}

// Catches import side effects, raised hard limits, stacked installs, and extended deadlines.
test('inert import and one install never change Request or extend hard bounds', () => {
  implementation(); assertRestored(initial);
  let now = 0, timers = 0, cancelled = 0, trigger;
  const observer = install({ limits: { durationMs: 999999, requests: 999999, events: 999999, bytes: 999999, descriptors: 999999 }, clock: () => now, schedule: fn => { trigger = fn; timers++; return 7; }, cancel: () => { cancelled++; } });
  try {
    assert.deepEqual(observer.state().limits, { durationMs: 60000, requests: 4, events: 128, bytes: 65536, descriptors: 64 });
    now = 59_999;
    assert.equal(install(), observer); assert.equal(timers, 1);
    assert.equal(globalThis.Request, nativeRequest);
    now = 60_000; trigger();
    assertStop(observer.stop(), 'duration'); assert.equal(cancelled, 1);
  } finally { observer.stop(); }
  assertRestored(initial);
});

// Catches a missed naturally evaluated srvx prototype and any observation-only body read.
test('natural discovery captures clean bridge identity with no extra stream consumption', async () => {
  implementation(); const before = surfaces.map(p => Object.getOwnPropertyDescriptors(p));
  const beforeExit = process.listenerCount('beforeExit');
  const observer = install();
  try {
    ({ NodeRequest } = await import('srvx/node'));
    assert.equal(observer.state().discoveredPrototypes, 1);
    const p = buffered(pair()); const atEntry = snapshot(p.req);
    assert.equal(dispatch(p), true); assert.deepEqual(snapshot(p.req), atEntry);
    const raw = new NodeRequest(p);
    const cloned = cloneRequestWithHeaders(raw, new Headers());
    const afterNatural = snapshot(p.req);
    const result = observer.stop(); assertStop(result, 'manual');
    assert.equal(globalThis.Request, nativeRequest);
    const entry = result.events.find(e => e.phase === 'request-entry');
    const bridgeBefore = result.events.find(e => e.phase === 'bridge-before');
    const bridgeAfter = result.events.find(e => e.phase === 'bridge-after');
    const body = result.events.find(e => e.phase === 'body-return');
    assert.equal(entry.id, bridgeBefore.id); assert.equal(bridgeBefore.id, bridgeAfter.id);
    assert.equal(body.stream, bridgeAfter.stream); assert.equal(body.sameAsBridge, true);
    assert.deepEqual(bridgeAfter.web, { locked: false, disturbed: false });
    assert.ok(entry.seq < bridgeBefore.seq && bridgeBefore.seq < bridgeAfter.seq && bridgeAfter.seq < body.seq);
    assert.deepEqual(snapshot(p.req), afterNatural); // stop also performs no body operation.
    assert.equal(await cloned.text(), 'BODY_SECRET');
    assert.doesNotMatch(result.text, /BODY_SECRET|QUERY_SECRET|HEADER_SECRET|authorization|memory\.invalid/);
    p.req.destroy(); p.res.destroy();
  } finally { observer.stop(); }
  assertRestored(before); assert.equal(process.listenerCount('beforeExit'), beforeExit);
});

// Catches GET/startup traffic taking identities/slots, and loose path/method matching.
test('only exact two PUT routes allocate identities; static GET cannot exhaust the window', () => {
  const observer = install();
  try {
    for (let i = 0; i < 200; i++) dispatch(pair('GET', '/home.rsc?private=QUERY_SECRET'));
    for (const [method, url] of [['POST', '/api/storage/reviews'], ['PUT', '/api/storage/reviews/'], ['PUT', '/api/storage/reviews-extra'], ['PUT', 'http://memory.invalid/api/storage/reviews'], ['PUT', '/api/storage/reviews#fragment']]) dispatch(pair(method, url));
    assert.equal(observer.state().requests, 0); assert.equal(observer.state().streams, 0);
    assert.equal(observer.state().active, true);
    dispatch(pair()); dispatch(pair('PUT', '/api/storage/review-summaries'));
    const result = observer.stop();
    assert.deepEqual(result.events.filter(e => e.phase === 'request-entry').map(e => [e.id, e.method, e.route]), [[1, 'PUT', '/api/storage/reviews'], [2, 'PUT', '/api/storage/review-summaries']]);
    assert.doesNotMatch(result.text, /QUERY_SECRET|fragment|home|memory\.invalid/);
  } finally { observer.stop(); }
});

for (const kind of ['normal-drain', 'unread-destroy']) {
  // Catches mapping only after bridge, conflating complete/end with abort, or replacing the thrown error.
  test(`${kind}: before/after same N and S retain terminal cause and stop at natural target throw`, async () => {
    const observer = install(); const p = kind === 'normal-drain' ? buffered(pair()) : pair();
    try {
      dispatch(p);
      if (kind === 'normal-drain') for await (const chunk of p.req) assert.equal(chunk.toString(), 'BODY_SECRET');
      else { p.req.destroy(); await new Promise(resolve => setImmediate(resolve)); }
      const raw = new NodeRequest(p); let thrown;
      try { cloneRequestWithHeaders(raw, new Headers()); } catch (error) { thrown = error; }
      assert.ok(thrown instanceof TypeError);
      assert.equal(thrown.message, 'Response body object should not be disturbed or locked');
      const result = observer.stop(); assertStop(result, 'target-throw');
      const pre = result.events.find(e => e.phase === 'bridge-before');
      const post = result.events.find(e => e.phase === 'bridge-after');
      const body = result.events.find(e => e.phase === 'body-return');
      const failure = result.events.find(e => e.phase === 'materialize-throw');
      const wantNormal = kind === 'normal-drain';
      assert.equal(pre.node.readableEnded, wantNormal); assert.equal(pre.node.readableAborted, !wantNormal);
      assert.equal(pre.node.complete, wantNormal); assert.equal(pre.node.aborted, !wantNormal);
      assert.equal(pre.node.destroyed, true); assert.equal(pre.node.isReadable, false);
      assert.equal(post.id, pre.id); assert.equal(post.stream, body.stream); assert.equal(failure.stream, post.stream);
      assert.equal(body.sameAsBridge, true); assert.deepEqual(post.web, { locked: false, disturbed: true });
      assert.equal(failure.errorKind, 'body-unusable'); assert.ok(failure.stack.some(s => s.includes('srvx/dist/adapters/node.mjs:')));
      assert.ok(result.events.some(e => e.phase === 'node-close'));
      assert.equal(result.events.some(e => e.phase === 'node-aborted'), !wantNormal);
      const destroy = result.events.filter(e => e.phase === 'destroy-enter');
      assert.ok(destroy.length <= 1); assert.ok(destroy.every(e => e.stack.length <= 6));
      if (!wantNormal) {
        assert.equal(destroy.length, 1);
        assert.ok(destroy[0].stack.some(s => s.includes('terminal-observer.test.mjs:')));
      }
      assert.doesNotMatch(result.text, /BODY_SECRET|QUERY_SECRET|HEADER_SECRET|memory\.invalid/);
    } finally { observer.stop(); p.req.destroy(); p.res.destroy(); }
  });
}

// Catches a wrapper probing lazy getters, modifying returned objects, or touching Promise.then.
test('request entry leaves lazy getters untouched and natural Request results retain identity', () => {
  const observer = install(); const p = buffered(pair());
  try {
    let called = 0;
    dispatch(p, (req, res) => { assert.equal(req, p.req); assert.equal(res, p.res); called++; });
    assert.equal(called, 1); assert.equal(observer.state().streams, 0);
    assert.equal(p.req.listenerCount('data'), 0); assert.equal(p.req.listenerCount('readable'), 0);
    const raw = new NodeRequest(p);
    const native = raw._request;
    assert.equal(raw._request, native); assert.equal(raw.body, native.body);
    const promise = native.text(); assert.ok(promise instanceof Promise);
    observer.stop(); return promise.then(text => { assert.equal(text, 'BODY_SECRET'); p.req.destroy(); p.res.destroy(); });
  } finally { observer.stop(); }
});

// Catches budget overflow, missing truncation markers, retained wrappers/timers, or more than one flush.
test('each hard budget restores immediately with one explicit bounded stop marker', () => {
  for (const reason of ['duration', 'requests', 'events', 'bytes', 'descriptors']) {
    const before = surfaces.map(p => Object.getOwnPropertyDescriptors(p));
    const beforeExit = process.listenerCount('beforeExit');
    let time = 0, trigger, flushes = 0, cancelled = 0;
    const limits = reason === 'duration' ? { durationMs: 10 } : reason === 'requests' ? { requests: 2 } : reason === 'events' ? { events: 3 } : reason === 'bytes' ? { bytes: 4096 } : { descriptors: 2 };
    const observer = install({ limits, clock: () => time, schedule: fn => { trigger = fn; return 1; }, cancel: () => { cancelled++; }, onFlush: () => { flushes++; } });
    let p;
    try {
      if (reason === 'duration') { time = 10; trigger(); }
      else if (reason === 'bytes') {
        p = buffered(pair()); dispatch(p); const raw = new NodeRequest(p);
        for (let i = 0; i < 40 && observer.state().active; i++) void raw.body;
      } else if (reason !== 'descriptors') for (let i = 0; i < 4 && observer.state().active; i++) dispatch(pair());
      assert.equal(observer.state().active, false, reason);
      const result = observer.stop(); assertStop(result, reason);
      assert.equal(result.events.at(-1).tailTruncated, true);
      assert.equal(result.restoration.skipped, 0); assert.equal(observer.state().pendingDescriptors, 0);
      assert.ok(observer.state().peakDescriptors <= result.limits.descriptors);
      assert.equal(flushes, 1); assert.equal(cancelled, 1);
      const stopped = observer.state();
      dispatch(pair()); if (p) p.req.destroy();
      assert.deepEqual(observer.state(), stopped); assert.equal(observer.stop(), result); assert.equal(flushes, 1);
      assertRestored(before); assert.equal(process.listenerCount('beforeExit'), beforeExit);
    } finally { observer.stop(); if (p) { p.req.destroy(); p.res.destroy(); } }
  }
});

// Catches a timer armed only after traffic (or a timer that keeps Node alive forever).
test('real wall timer expires even with only static GET requests', async () => {
  const before = surfaces.map(p => Object.getOwnPropertyDescriptors(p));
  const observer = install({ limits: { durationMs: 10 } });
  dispatch(pair('GET', '/assets/static.js'));
  await new Promise(resolve => setTimeout(resolve, 25));
  assertStop(observer.stop(), 'duration'); assert.equal(observer.state().requests, 0); assertRestored(before);
});

// Catches restoration clobbering a later owner, inactive saved wrappers observing, and sink throws escaping.
test('later descriptors survive; stale wrapper delegates; failed sink cannot change natural dispatch', () => {
  const original = Object.getOwnPropertyDescriptor(Readable, 'toWeb');
  let flushes = 0;
  const observer = install({ onFlush() { flushes++; throw new Error('sink unavailable'); } });
  const savedEmit = Server.prototype.emit;
  const later = function laterToWeb() { return 'third-party'; };
  try {
    Object.defineProperty(Readable, 'toWeb', { ...original, value: later });
    const result = observer.stop(); assert.equal(result.restoration.skipped, 1);
    assert.equal(Readable.toWeb, later); assert.equal(result.flushFailed, true);
    let calls = 0; const server = new EventEmitter(); server.on('request', () => { calls++; });
    const p = pair(); assert.equal(Reflect.apply(savedEmit, server, ['request', p.req, p.res]), true);
    assert.equal(calls, 1); assert.equal(flushes, 1); assertStop(result, 'manual');
  } finally { observer.stop(); Object.defineProperty(Readable, 'toWeb', original); }
});

// Catches prototype lookalikes being patched, or stack extraction executing an app formatter.
test('source drift fails closed and custom stack formatter is never invoked', () => {
  const observer = install(); let getterReads = 0, formatCalls = 0;
  const formatter = Object.getOwnPropertyDescriptor(Error, 'prepareStackTrace');
  try {
    const drifted = {};
    Object.defineProperty(drifted, 'body', { configurable: true, get() { getterReads++; return null; } });
    Object.setPrototypeOf(drifted, Request.prototype); assert.equal(getterReads, 0);
    Object.defineProperty(Error, 'prepareStackTrace', { configurable: true, writable: true, value() { formatCalls++; return 'STACK_SECRET'; } });
    const p = pair(); dispatch(p); p.req.destroy();
    const result = observer.stop(); assert.equal(formatCalls, 0); assert.doesNotMatch(result.text, /STACK_SECRET/);
  } finally {
    observer.stop(); if (formatter) Object.defineProperty(Error, 'prepareStackTrace', formatter); else delete Error.prepareStackTrace;
  }
});

// Catches generic wrapper re-invocation, altered receiver/arguments/result/error, and added then handlers.
test('toWeb wrapper preserves an existing delegate and never accesses a returned thenable', () => {
  const original = Object.getOwnPropertyDescriptor(Readable, 'toWeb');
  for (const outcome of ['return', 'throw']) {
    let calls = 0, thenReads = 0, observedArgs, observedThis;
    const sentinel = { get then() { thenReads++; throw new Error('must not attach handlers'); } };
    const expected = new TypeError('PRIVATE_ERROR');
    const delegate = function(...args) { calls++; observedArgs = args; observedThis = this; if (outcome === 'throw') throw expected; return sentinel; };
    Object.defineProperty(Readable, 'toWeb', { ...original, value: delegate });
    const observer = install(); const p = pair(); const receiver = {}; const options = { highWaterMark: 7 };
    try {
      dispatch(p);
      if (outcome === 'return') assert.equal(Reflect.apply(Readable.toWeb, receiver, [p.req, options]), sentinel);
      else assert.throws(() => Reflect.apply(Readable.toWeb, receiver, [p.req, options]), error => error === expected);
      const result = observer.stop(); assert.equal(calls, 1); assert.equal(thenReads, 0);
      assert.equal(observedThis, receiver); assert.equal(observedArgs[0], p.req); assert.equal(observedArgs[1], options);
      assert.doesNotMatch(result.text, /PRIVATE_ERROR|QUERY_SECRET|HEADER_SECRET/);
      assert.equal(Readable.toWeb, delegate);
    } finally { observer.stop(); Object.defineProperty(Readable, 'toWeb', original); }
  }
});

// Catches a beforeExit path that leaves wrappers behind or flushes a second time.
test('the owned beforeExit hook stops once without requiring request traffic', () => {
  const before = process.listeners('beforeExit'), descriptors = surfaces.map(p => Object.getOwnPropertyDescriptors(p));
  let flushes = 0; const observer = install({ onFlush: () => { flushes++; } });
  const hooks = process.listeners('beforeExit').filter(fn => !before.includes(fn));
  assert.equal(hooks.length, 1); hooks[0]();
  assertStop(observer.stop(), 'before-exit'); hooks[0](); assert.equal(flushes, 1);
  assert.deepEqual(process.listeners('beforeExit'), before); assertRestored(descriptors);
});

// Catches accidental opt-in defaults or invalid output prefixes installing a live observer.
test('preload stays inert when disabled or when its output prefix is invalid', async () => {
  const enabledBefore = process.env.TRADEREVIEW_REQUEST_BODY_TERMINAL;
  const fileBefore = process.env.TRADEREVIEW_REQUEST_BODY_TERMINAL_FILE;
  const before = surfaces.map(p => Object.getOwnPropertyDescriptors(p));
  try {
    for (const [suffix, enabled, prefix] of [['disabled', '0', '/tmp/invalid-prefix'], ['invalid', '1', '/tmp/invalid-prefix']]) {
      process.env.TRADEREVIEW_REQUEST_BODY_TERMINAL = enabled;
      process.env.TRADEREVIEW_REQUEST_BODY_TERMINAL_FILE = prefix;
      let preload;
      try { preload = await import(`./terminal-preload.mjs?${suffix}`); }
      catch (error) { if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error; }
      assert.equal(preload?.activation?.state, 'disabled', 'RED: inert opt-in preload is missing');
      assertRestored(before);
    }
  } finally {
    if (enabledBefore === undefined) delete process.env.TRADEREVIEW_REQUEST_BODY_TERMINAL; else process.env.TRADEREVIEW_REQUEST_BODY_TERMINAL = enabledBefore;
    if (fileBefore === undefined) delete process.env.TRADEREVIEW_REQUEST_BODY_TERMINAL_FILE; else process.env.TRADEREVIEW_REQUEST_BODY_TERMINAL_FILE = fileBefore;
  }
});
