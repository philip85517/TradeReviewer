// No listen(), fetch, database, application import, or preload activation.
import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { Readable, PassThrough } from 'node:stream';
import { IncomingMessage, Server } from 'node:http';
import { NodeRequest } from 'srvx/node';
import { installRequestBodyObserver } from './candidate-observer.mjs';

function fixture({ RequestClass = NodeRequest, write, ...limits } = {}) {
  const records = [];
  const serverPrototype = Object.create(EventEmitter.prototype);
  const server = Object.create(serverPrototype);
  EventEmitter.call(server);
  const stop = installRequestBodyObserver({
    NodeRequest: RequestClass, serverPrototype,
    write: write ?? (entry => records.push(entry)), ...limits,
  });
  function request(url = '/api/storage/recall?secret=DO_NOT_LOG', method = 'PUT') {
    const req = Readable.from([Buffer.from('BODY_MUST_NOT_APPEAR')]);
    Object.assign(req, { method, url, headers: { host: 'example.invalid' }, rawHeaders: ['host', 'example.invalid'] });
    return req;
  }
  return { records, server, serverPrototype, stop, request };
}

// Catches eager body/bodyUsed/reader sampling and hidden added data listeners.
test('capture is passive until the application naturally reads the real srvx body', () => {
  const f = fixture();
  const req = f.request();
  const bodyDescriptor = Object.getOwnPropertyDescriptor(NodeRequest.prototype, 'body');
  const materializer = Object.getOwnPropertyDescriptor(NodeRequest.prototype, '_request');
  let bodyCalls = 0;
  let materializerCalls = 0;
  Object.defineProperty(NodeRequest.prototype, 'body', { ...bodyDescriptor, get() { bodyCalls++; return bodyDescriptor.get.call(this); } });
  Object.defineProperty(NodeRequest.prototype, '_request', { ...materializer, get() { materializerCalls++; return materializer.get.call(this); } });
  try {
    const raw = new NodeRequest({ req });
    f.server.on('request', incoming => { assert.equal(incoming, req); void raw.method; });
    assert.equal(f.server.emit('request', req, {}), true);
    assert.equal(bodyCalls, 0);
    assert.equal(materializerCalls, 0);
    assert.equal(req.listenerCount('data'), 0);
    assert.equal(Readable.isDisturbed(req), false);
    assert.equal(f.records.find(entry => entry.phase === 'request-entry')?.method, 'PUT');
    assert.equal(f.records.find(entry => entry.phase === 'request-entry')?.route, '/api/storage/recall');
    assert.ok(f.records.some(entry => entry.phase === 'server-dispatch-return'));
    assert.equal(f.records.some(entry => entry.phase === 'capture-unavailable'), false);
  } finally {
    Object.defineProperty(NodeRequest.prototype, 'body', bodyDescriptor);
    Object.defineProperty(NodeRequest.prototype, '_request', materializer);
    f.stop(); req.destroy();
  }
});

// Catches lost IncomingMessage identity or missing first-consumer stack.
test('real srvx text consumption keeps its result and records the same request ID', async () => {
  const f = fixture(); const req = f.request();
  try {
    f.server.emit('request', req, {});
    const raw = new NodeRequest({ req });
    assert.equal(await raw.text(), 'BODY_MUST_NOT_APPEAR');
    const entry = f.records.find(value => value.phase === 'request-entry');
    const text = f.records.find(value => value.operation === 'srvx:text' && value.phase === 'operation');
    const first = f.records.find(value => value.phase === 'consumption-intent' && value.first === true);
    assert.ok(text, 'must observe the real natural text call');
    assert.equal(text.id, entry.id);
    assert.equal(first.id, entry.id);
    assert.match(first.callerStack.join('\n'), /candidate-observer\.test\.mjs/);
    const serialized = JSON.stringify(f.records);
    assert.equal(serialized.includes('BODY_MUST_NOT_APPEAR'), false);
    assert.equal(serialized.includes('DO_NOT_LOG'), false);
    assert.equal(serialized.includes('secret='), false);
  } finally { f.stop(); req.destroy(); }
});

// Catches observer wrappers changing receiver/arguments/value or swallowing exceptions.
test('node method wrappers preserve receiver arguments return value and exact thrown object', () => {
  const f = fixture(); const req = f.request(); const value = {}; const thrown = new Error('SENSITIVE_MESSAGE');
  const calls = [];
  req.read = function(...args) { calls.push({ receiver: this, args }); if (args[0] === 'throw') throw thrown; return value; };
  const before = req.read;
  try {
    f.server.emit('request', req, {});
    assert.equal(req.read(7, value), value);
    assert.deepEqual(calls[0], { receiver: req, args: [7, value] });
    assert.throws(() => req.read('throw'), error => error === thrown);
    assert.ok(f.records.some(entry => entry.phase === 'operation-throw'));
    assert.equal(JSON.stringify(f.records).includes('SENSITIVE_MESSAGE'), false);
  } finally { f.stop(); assert.equal(req.read, before); req.destroy(); }
});

// Catches Promise replacement/microtask attachment and materializer error replacement.
test('srvx wrappers return the original promise and rethrow the original getter error', () => {
  const pending = new Promise(() => {}); const thrown = new TypeError('Response body object should not be disturbed or locked');
  class SyntheticRequest {
    constructor(req) { this.runtime = { node: { req } }; }
    text(...args) { assert.equal(this.marker, 'receiver'); assert.deepEqual(args, ['literal']); return pending; }
    get _request() { throw thrown; }
    get body() { throw new Error('must not eagerly inspect body'); }
  }
  const f = fixture({ RequestClass: SyntheticRequest }); const req = f.request();
  try {
    f.server.emit('request', req, {}); const raw = new SyntheticRequest(req); raw.marker = 'receiver';
    assert.equal(raw.text('literal'), pending);
    assert.throws(() => raw._request, error => error === thrown);
    assert.ok(f.records.some(entry => entry.errorCode === 'body-disturbed-or-locked'));
  } finally { f.stop(); req.destroy(); }
});

// Catches observer-created readers or native stream/reader identity replacement.
test('natural Web stream reader calls are observed without an extra reader', async () => {
  const f = fixture(); const req = f.request();
  try {
    f.server.emit('request', req, {}); const raw = new NodeRequest({ req });
    const stream = raw.body;
    assert.equal(stream.locked, false);
    assert.equal(Readable.isDisturbed(stream), false);
    const reader = stream.getReader();
    assert.equal(stream.locked, true);
    const first = await reader.read();
    assert.equal(Buffer.from(first.value).toString(), 'BODY_MUST_NOT_APPEAR');
    reader.releaseLock();
    assert.equal(stream.locked, false);
    assert.ok(f.records.some(entry => entry.operation === 'web:getReader'));
    assert.ok(f.records.some(entry => entry.operation === 'reader:read'));
    assert.ok(f.records.some(entry => entry.operation === 'reader:releaseLock'));
    assert.equal(JSON.stringify(f.records).includes('BODY_MUST_NOT_APPEAR'), false);
  } finally { f.stop(); req.destroy(); }
});

// Catches instrumentation exceptions changing HTTP handler behavior.
test('sink failure cannot replace an original request handler exception', () => {
  const f = fixture({ write() { throw new Error('sink unavailable'); } }); const req = f.request();
  const thrown = new Error('handler failure');
  f.server.on('request', () => { throw thrown; });
  try { assert.throws(() => f.server.emit('request', req, {}), error => error === thrown); }
  finally { f.stop(); req.destroy(); }
});

// Catches unbounded trace growth and accidental retention of arbitrary URL identifiers.
test('unknown paths are redacted and request IDs remain distinct', () => {
  const f = fixture(); const a = f.request('/users/PRIVATE_ACCOUNT?token=DO_NOT_LOG'); const b = f.request();
  try {
    f.server.emit('request', a, {}); f.server.emit('request', b, {});
    const entries = f.records.filter(entry => entry.phase === 'request-entry');
    assert.equal(entries.length, 2); assert.notEqual(entries[0].id, entries[1].id);
    assert.equal(entries[0].route, '<redacted-path>');
    assert.equal(JSON.stringify(f.records).includes('PRIVATE_ACCOUNT'), false);
    assert.equal(JSON.stringify(f.records).includes('DO_NOT_LOG'), false);
  } finally { f.stop(); a.destroy(); b.destroy(); }
});

test('real IncomingMessage and inherited Server.emit remain passive without listening', () => {
  const records = [];
  const stop = installRequestBodyObserver({ NodeRequest, write: row => records.push(row) });
  const socket = new PassThrough(); const req = new IncomingMessage(socket); const server = new Server();
  Object.assign(req, { method: 'POST', url: '/api/storage/recall?token=DO_NOT_LOG' });
  const original = req.read;
  server.on('request', incoming => assert.equal(incoming, req));
  try {
    assert.equal(server.listening, false);
    assert.equal(server.emit('request', req, {}), true);
    assert.equal(req.listenerCount('data'), 0);
    assert.equal(Readable.isDisturbed(req), false);
    assert.equal(records.some(row => row.phase === 'consumption-intent'), false);
    assert.ok(records.some(row => row.phase === 'server-dispatch-return'));
    assert.notEqual(req.read, original);
  } finally { stop(); assert.equal(req.read, original); req.destroy(); socket.destroy(); }
});

test('trace and request budgets stop recording without reading or blocking dispatch', () => {
  const f = fixture({ maxEvents: 3, maxRequests: 1 }); const a = f.request(); const b = f.request();
  try {
    assert.equal(f.server.emit('request', a, {}), false);
    assert.equal(f.server.emit('request', b, {}), false);
    assert.equal(f.records.filter(row => row.phase === 'trace-budget-exhausted').length, 1);
    assert.equal(f.records.length, 4);
    assert.equal(a.listenerCount('data'), 0); assert.equal(b.listenerCount('data'), 0);
    assert.equal(Readable.isDisturbed(a), false); assert.equal(Readable.isDisturbed(b), false);
  } finally { f.stop(); a.destroy(); b.destroy(); }
});

test('stack formatter failure and a later third party patch preserve original semantics', () => {
  const f = fixture(); const req = f.request(); const value = {}; const saved = Error.prepareStackTrace;
  req.read = () => value;
  try {
    f.server.emit('request', req, {});
    Error.prepareStackTrace = () => { throw new Error('formatter failure'); };
    assert.equal(req.read(), value);
    assert.deepEqual(f.records.find(row => row.phase === 'consumption-intent')?.callerStack, ['<stack-unavailable>']);
    const laterPatch = () => 'later'; req.read = laterPatch;
    f.stop(); assert.equal(req.read, laterPatch);
  } finally { Error.prepareStackTrace = saved; f.stop(); req.destroy(); }
});
