import assert from 'node:assert/strict';
import test from 'node:test';
import { EventEmitter } from 'node:events';
import { IncomingMessage, Server, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { installBoundedObserver, HARD_LIMITS } from './bounded-observer.mjs';

test('disabled import has no global mutations; hard limits cannot be enlarged', () => {
  const original = Object.getOwnPropertyDescriptor(Server.prototype, 'emit');
  const observer = installBoundedObserver({ limits: { durationMs: 999999, requests: 999999, events: 999999, bytes: 999999, descriptors: 999999 } });
  assert.deepEqual(observer.state().limits, HARD_LIMITS);
  const result = observer.stop({ toString() { throw new Error('must not serialize caller values'); } });
  assert.equal(result.reason, 'manual');
  assert.deepEqual(Object.getOwnPropertyDescriptor(Server.prototype, 'emit'), original);
});

function memoryRequest(method = 'GET', url = '/home?secret=QUERY_SECRET') {
  const req = new IncomingMessage(null);
  req.method = method; req.url = url; req.headers = { host: 'memory.invalid', authorization: 'HEADER_SECRET' };
  req.rawHeaders = ['host', 'memory.invalid', 'authorization', 'HEADER_SECRET'];
  const res = new ServerResponse(req);
  return { req, res };
}

test('natural srvx discovery, GET/RSC coverage, actual bodies and exact restoration', async () => {
  const prototypes = [Object, Server.prototype, IncomingMessage.prototype, ServerResponse.prototype, ReadableStream.prototype, Request.prototype];
  const before = prototypes.map(p => Object.getOwnPropertyDescriptors(p));
  let flushed;
  const observer = installBoundedObserver({ onFlush: value => { flushed = value; } });
  const { NodeRequest } = await import('srvx/node');
  assert.equal(observer.state().discoveredPrototypes, 1);
  const server = new EventEmitter(); Object.setPrototypeOf(server, Server.prototype);
  const get = memoryRequest(); const rsc = memoryRequest('GET', '/home.rsc?secret=QUERY_SECRET');
  server.on('request', (req, res) => {
    const raw = new NodeRequest({ req, res });
    assert.equal(raw.redirect, 'follow');
    assert.equal(raw._request.method, req.method);
    res.statusCode = 204; res.emit('finish'); res.emit('close');
  });
  server.emit('request', get.req, get.res); server.emit('request', rsc.req, rsc.res);
  const put = memoryRequest('PUT', '/api/storage/reviews?secret=QUERY_SECRET');
  const raw = new NodeRequest(put);
  server.removeAllListeners('request'); server.on('request', () => {}); server.emit('request', put.req, put.res);
  const promise = raw.text(); put.req.push('BODY_SECRET'); put.req.push(null);
  assert.equal(await promise, 'BODY_SECRET');
  observer.stop('manual');
  assert.equal(observer.state().pendingDescriptors, 0);
  assert.equal(observer.state().active, false);
  assert.equal(flushed.restoration.failed, 0);
  assert.equal(flushed.restoration.skipped, 0);
  for (let i = 0; i < prototypes.length; i++) {
    const after = Object.getOwnPropertyDescriptors(prototypes[i]);
    assert.deepEqual(Reflect.ownKeys(after), Reflect.ownKeys(before[i]), `prototype ${i} keys`);
    for (const key of Reflect.ownKeys(before[i])) assert.deepEqual(after[key], before[i][key], `prototype ${i} descriptor ${String(key)}`);
  }
  const entries = flushed.events.filter(e => e.phase === 'request-entry');
  assert.deepEqual(entries.slice(0, 2).map(e => [e.method, e.route, e.rsc]), [['GET', '/home', false], ['GET', '/home', true]]);
  assert.ok(flushed.events.some(e => e.phase === 'node-first-intent' && e.operation === 'srvx:text'));
  assert.ok(flushed.events.some(e => e.phase === 'response-finish' && e.status === 204));
  assert.doesNotMatch(flushed.text, /BODY_SECRET|QUERY_SECRET|HEADER_SECRET|authorization|memory\.invalid/);
});

async function loadedInstall(options = {}) {
  const { NodeRequest } = await import('srvx/node');
  return { NodeRequest, observer: installBoundedObserver({ ...options, nodeRequestPrototype: NodeRequest.prototype }) };
}

function dispatch(req, res) {
  const server = new EventEmitter(); Object.setPrototypeOf(server, Server.prototype);
  server.emit('request', req, res);
}

test('same stream lock precedes natural target throw, which immediately uninstalls', async () => {
  let flushed;
  const { NodeRequest, observer } = await loadedInstall({ onFlush: r => { flushed = r; } });
  try {
    const pair = memoryRequest('POST', '/home'); dispatch(pair.req, pair.res);
    const raw = new NodeRequest(pair);
    const stream = raw.body; // Application's natural operation, never instrumentation probing.
    const reader = stream.getReader();
    for (const key of ['read', 'cancel', 'releaseLock']) assert.equal(Object.getOwnPropertyDescriptor(reader, key), undefined); // Native internal symbols are retained; no per-reader wrapper.
    let thrown;
    try { void raw.redirect; } catch (error) { thrown = error; }
    assert.ok(thrown instanceof TypeError);
    assert.equal(flushed.reason, 'target-throw');
    assert.equal(observer.state().active, false);
    assert.deepEqual(flushed.restoration, { restored: observer.state().peakDescriptors, skipped: 0, failed: 0, ownedRemaining: 0 });
    const natural = flushed.events.find(e => e.phase === 'web-body-natural-return');
    const intent = flushed.events.find(e => e.phase === 'web-first-intent');
    const failure = flushed.events.find(e => e.phase === 'materialize-throw');
    assert.equal(intent.operation, 'web:getReader'); assert.equal(intent.stream, natural.stream); assert.equal(failure.stream, natural.stream);
    assert.equal(natural.web.locked, false); assert.equal(failure.web.locked, true);
    assert.ok(natural.seq < intent.seq && intent.seq < failure.seq);
    assert.ok(intent.stack.some(s => s.includes('bounded-observer.test.mjs:')));
    assert.ok(failure.stack.some(s => s.includes('srvx/dist/adapters/node.mjs:')));
    assert.doesNotMatch(flushed.text, /QUERY_SECRET|HEADER_SECRET|memory\.invalid/);
    reader.releaseLock(); pair.req.destroy();
  } finally { observer.stop(); }
});

test('GET/HEAD do not create streams; POST bridge, tee, read and native body consumers preserve content', async () => {
  const { NodeRequest, observer } = await loadedInstall();
  try {
    for (const method of ['GET', 'HEAD']) {
      const pair = memoryRequest(method); dispatch(pair.req, pair.res);
      const raw = new NodeRequest(pair);
      assert.equal(raw.body, null); assert.equal(raw._request.method, method);
    }
    const pair = memoryRequest('PUT'); dispatch(pair.req, pair.res);
    const raw = new NodeRequest(pair); const stream = raw.body;
    const [left, right] = stream.tee();
    pair.req.push('STREAM_BODY_SECRET'); pair.req.push(null);
    assert.deepEqual(await Promise.all([new Response(left).text(), new Response(right).text()]), ['STREAM_BODY_SECRET', 'STREAM_BODY_SECRET']);
    const finished = observer.stop();
    assert.equal(finished.events.filter(e => e.phase === 'web-body-natural-return' && e.method === 'GET').length, 0);
    assert.ok(finished.events.some(e => e.phase === 'node-first-data'));
    assert.doesNotMatch(finished.text, /STREAM_BODY_SECRET/);
  } finally { observer.stop(); }
});

test('request entry never invokes lazy body/bodyUsed/redirect; observed errors and thenables retain identity', () => {
  const counts = { body: 0, bodyUsed: 0, redirect: 0, materialize: 0, text: 0 };
  const expectedError = new TypeError('synthetic-secret-not-logged');
  const sentinel = { get then() { throw new Error('must not attach Promise handler'); } };
  class LazyFixture {
    constructor(pair) { this.runtime = { node: pair }; }
    get body() { counts.body++; return null; }
    get bodyUsed() { counts.bodyUsed++; return false; }
    get redirect() { counts.redirect++; return this._request; }
    get _request() { counts.materialize++; throw expectedError; }
    text() { counts.text++; return sentinel; }
    json() { return sentinel; }
  }
  const observer = installBoundedObserver({ nodeRequestPrototype: LazyFixture.prototype });
  try {
    const pair = memoryRequest('POST'); const raw = new LazyFixture(pair); dispatch(pair.req, pair.res);
    assert.deepEqual(counts, { body: 0, bodyUsed: 0, redirect: 0, materialize: 0, text: 0 });
    assert.equal(raw.text(), sentinel); assert.equal(counts.text, 1);
    assert.throws(() => raw._request, error => error === expectedError);
    const result = observer.stop();
    assert.doesNotMatch(result.text, /synthetic-secret-not-logged/);
    assert.deepEqual(counts, { body: 0, bodyUsed: 0, redirect: 0, materialize: 1, text: 1 });
  } finally { observer.stop(); }
});

test('all hard budgets stop, remove wrappers, flush once, and permit no later events/patches', () => {
  for (const budget of ['duration', 'requests', 'events', 'bytes', 'descriptors']) {
    const base = Object.getOwnPropertyDescriptor(IncomingMessage.prototype, 'read');
    const serverBase = Object.getOwnPropertyDescriptor(Server.prototype, 'emit');
    let time = 0, flushes = 0, scheduled, cancelled = 0;
    const limits = budget === 'duration' ? { durationMs: 10 } : budget === 'requests' ? { requests: 2 } : budget === 'events' ? { events: 3 } : budget === 'bytes' ? { bytes: 4096 } : { descriptors: 3 };
    const observer = installBoundedObserver({ limits, clock: () => time, schedule: callback => { scheduled = callback; return 1; }, cancel: () => { cancelled++; }, onFlush: () => { flushes++; } });
    if (budget === 'duration') { time = 10; scheduled(); }
    else for (let i = 0; i < 30 && observer.state().active; i++) { const p = memoryRequest('GET'); dispatch(p.req, p.res); }
    assert.equal(observer.state().active, false, budget);
    const result = observer.stop(); const stopped = observer.state();
    assert.equal(result.reason, budget); assert.equal(stopped.pendingDescriptors, 0); assert.equal(result.restoration.ownedRemaining, 0);
    assert.equal(result.restoration.failed, 0); assert.equal(flushes, 1); assert.ok(result.bytes <= result.limits.bytes);
    assert.equal(result.buffer.buffer.byteLength, result.limits.bytes);
    assert.ok(stopped.seq <= result.limits.events); assert.ok(stopped.requests <= result.limits.requests); assert.ok(stopped.peakDescriptors <= result.limits.descriptors);
    assert.deepEqual(Object.getOwnPropertyDescriptor(IncomingMessage.prototype, 'read'), base);
    assert.deepEqual(Object.getOwnPropertyDescriptor(Server.prototype, 'emit'), serverBase);
    const p = memoryRequest('PUT'); dispatch(p.req, p.res); p.req.resume();
    assert.deepEqual(observer.state(), stopped); assert.equal(flushes, 1);
    assert.equal(result.events.filter(e => e.phase === 'observer-stop').length, 1);
    if (budget !== 'descriptors') assert.equal(cancelled, 1);
  }
});

test('automatic real timer removes lifecycle listener and restores even without requests', async () => {
  const before = process.listenerCount('beforeExit'); const original = Object.getOwnPropertyDescriptor(Server.prototype, 'emit');
  const observer = installBoundedObserver({ limits: { durationMs: 10 } });
  await new Promise(resolve => setTimeout(resolve, 25));
  assert.equal(observer.state().active, false); assert.equal(observer.stop().reason, 'duration');
  assert.equal(process.listenerCount('beforeExit'), before);
  assert.deepEqual(Object.getOwnPropertyDescriptor(Server.prototype, 'emit'), original);
});

test('source drift discovery fails closed; later third-party descriptor is preserved', () => {
  const original = Object.getOwnPropertyDescriptor(IncomingMessage.prototype, 'read');
  const observer = installBoundedObserver();
  try {
    let getters = 0; const drifted = {};
    Object.defineProperty(drifted, 'body', { get() { getters++; return undefined; } });
    Object.setPrototypeOf(drifted, Request.prototype);
    assert.equal(observer.state().discoveredPrototypes, 0); assert.equal(getters, 0);
    const replacement = function replacementRead() { return null; };
    Object.defineProperty(IncomingMessage.prototype, 'read', { configurable: true, enumerable: false, writable: true, value: replacement });
    const result = observer.stop();
    assert.equal(result.restoration.skipped, 1); assert.equal(result.restoration.ownedRemaining, 0);
    assert.equal(IncomingMessage.prototype.read, replacement);
  } finally {
    observer.stop();
    if (original) Object.defineProperty(IncomingMessage.prototype, 'read', original); else delete IncomingMessage.prototype.read;
  }
});

test('sink failure does not escape the original synchronous operation', () => {
  const observer = installBoundedObserver({ limits: { requests: 1 }, onFlush() { throw new Error('sink unavailable'); } });
  const pair = memoryRequest();
  assert.doesNotThrow(() => dispatch(pair.req, pair.res));
  assert.equal(observer.state().active, false); assert.equal(observer.stop().restoration.failed, 0);
});

test('native Request json consumes its naturally mapped stream without altered payload or extra Promise handlers', async () => {
  const { NodeRequest, observer } = await loadedInstall();
  try {
    const pair = memoryRequest('POST'); dispatch(pair.req, pair.res);
    const native = new NodeRequest(pair)._request;
    const promise = native.json(); pair.req.push('{"private":"JSON_BODY_SECRET"}'); pair.req.push(null);
    assert.deepEqual(await promise, { private: 'JSON_BODY_SECRET' });
    const result = observer.stop();
    assert.ok(result.events.some(e => e.phase === 'web-first-intent' && e.operation === 'native-request:json'));
    assert.doesNotMatch(result.text, /JSON_BODY_SECRET/);
  } finally { observer.stop(); }
});

test('native clone marks its internal stream transition unknown while both payloads remain intact', async () => {
  const { NodeRequest, observer } = await loadedInstall();
  try {
    const pair = memoryRequest('POST'); dispatch(pair.req, pair.res);
    const native = new NodeRequest(pair)._request;
    const clone = native.clone();
    const promises = [native.json(), clone.json()];
    pair.req.push('{"private":"CLONE_BODY_SECRET"}'); pair.req.push(null);
    assert.deepEqual(await Promise.all(promises), [{ private: 'CLONE_BODY_SECRET' }, { private: 'CLONE_BODY_SECRET' }]);
    const result = observer.stop();
    const boundary = result.events.find(e => e.phase === 'native-request-clone-return');
    assert.equal(boundary.internalStreamTransition, 'not-observed');
    assert.equal(typeof boundary.previousObservedStream, 'number');
    // Node 26 clone currently calls public tee first. This intent is recorded once;
    // it does not prove which branch became either Request's private body.
    const publicTee = result.events.find(e => e.phase === 'web-first-intent' && e.operation === 'web:tee');
    assert.ok(publicTee); assert.equal(publicTee.stream, boundary.previousObservedStream);
    assert.doesNotMatch(result.text, /CLONE_BODY_SECRET/);
  } finally { observer.stop(); }
});

test('custom error stack getters and global stack formatters are never invoked', () => {
  let stackReads = 0, formatterCalls = 0;
  const expected = new TypeError('private-error');
  Object.defineProperty(expected, 'stack', { configurable: true, get() { stackReads++; return 'private-stack'; } });
  class Fixture {
    constructor(pair) { this.runtime = { node: pair }; }
    get body() { return null; }
    get _request() { throw expected; }
    text() { return Promise.resolve(''); }
    json() { return Promise.resolve(null); }
  }
  const formatter = Object.getOwnPropertyDescriptor(Error, 'prepareStackTrace');
  const observer = installBoundedObserver({ nodeRequestPrototype: Fixture.prototype });
  try {
    Object.defineProperty(Error, 'prepareStackTrace', { configurable: true, writable: true, value() { formatterCalls++; return 'private-formatter'; } });
    const pair = memoryRequest('POST'); dispatch(pair.req, pair.res);
    assert.throws(() => new Fixture(pair)._request, e => e === expected);
    const result = observer.stop(); assert.equal(stackReads, 0); assert.equal(formatterCalls, 0);
    assert.doesNotMatch(result.text, /private-error|private-stack|private-formatter/);
  } finally {
    observer.stop();
    if (formatter) Object.defineProperty(Error, 'prepareStackTrace', formatter); else delete Error.prepareStackTrace;
  }
});

test('opt-in preload is inert by default and flushes a real no-socket child once on beforeExit', () => {
  const dir = dirname(fileURLToPath(import.meta.url));
  const preload = join(dir, 'bounded-preload.mjs');
  const prefix = join(dir, `offline-preload-${process.pid}-${Date.now()}`);
  const env = { ...process.env, NODE_OPTIONS: '', TRADEREVIEW_REQUEST_BODY_BOUNDED: '0', TRADEREVIEW_REQUEST_BODY_BOUNDED_FILE: prefix };
  const disabled = spawnSync(process.execPath, ['--input-type=module', '-e', `import {Server} from 'node:http'; const a=Object.setPrototypeOf,b=Server.prototype.emit; await import(${JSON.stringify(preload)}); console.log(a===Object.setPrototypeOf && b===Server.prototype.emit);`], { env, encoding: 'utf8' });
  assert.equal(disabled.status, 0, disabled.stderr); assert.equal(disabled.stdout.trim(), 'true');
  assert.equal(existsSync(`${prefix}.${disabled.pid}.ndjson`), false);
  env.TRADEREVIEW_REQUEST_BODY_BOUNDED = '1';
  const enabled = spawnSync(process.execPath, ['--import', preload, '--input-type=module', '-e', `import {IncomingMessage,Server,ServerResponse} from 'node:http'; import {EventEmitter} from 'node:events'; const {NodeRequest}=await import('srvx/node'); const req=new IncomingMessage(null); req.method='GET'; req.url='/home.rsc?private=NEVER_LOG'; req.headers={host:'memory.invalid'}; req.rawHeaders=['host','memory.invalid']; const res=new ServerResponse(req); const server=new EventEmitter(); Object.setPrototypeOf(server,Server.prototype); server.emit('request',req,res); const raw=new NodeRequest({req,res}); if(raw.redirect!=='follow') throw new Error('unexpected');`], { env, encoding: 'utf8' });
  assert.equal(enabled.status, 0, enabled.stderr);
  const text = readFileSync(`${prefix}.${enabled.pid}.ndjson`, 'utf8');
  const events = text.trim().split('\n').map(line => JSON.parse(line)); const last = events.at(-1);
  assert.equal(last.phase, 'observer-stop'); assert.equal(last.reason, 'before-exit');
  assert.equal(last.restoration.failed, 0); assert.equal(last.restoration.ownedRemaining, 0);
  assert.ok(events.some(e => e.phase === 'srvx-prototype-discovered'));
  assert.ok(events.some(e => e.phase === 'request-entry' && e.route === '/home' && e.rsc));
  assert.doesNotMatch(text, /NEVER_LOG|memory\.invalid/);
});
