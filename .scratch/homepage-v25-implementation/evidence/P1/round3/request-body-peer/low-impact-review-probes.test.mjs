// Evidence-only isolated process. No preload, network, listen(), app, or DB.
import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import { installRequestBodyObserver } from './candidate-observer.mjs';

function fixture(limits = {}) {
  const records = [];
  const serverPrototype = Object.create(EventEmitter.prototype);
  const server = Object.create(serverPrototype);
  EventEmitter.call(server);
  class SyntheticRequest {
    constructor(req, body) { this.runtime = { node: { req } }; this.value = body; }
    get body() { return this.value; }
  }
  const stop = installRequestBodyObserver({ NodeRequest: SyntheticRequest, serverPrototype, write: row => records.push(row), ...limits });
  const requests = [];
  function dispatch(url, method = 'GET') {
    const req = new Readable({ read() {} });
    Object.assign(req, { url, method }); requests.push(req);
    server.emit('request', req, {}); return req;
  }
  return { records, SyntheticRequest, dispatch, stop() { stop(); for (const req of requests) req.destroy(); } };
}

test('OB01 current canonical home GET and RSC GET are skipped; home POST path is redacted', () => {
  const f = fixture();
  try {
    f.dispatch('/home'); f.dispatch('/home.rsc?synthetic=DO_NOT_LOG');
    assert.equal(f.records.filter(row => row.phase === 'request-entry').length, 0);
    f.dispatch('/trades'); f.dispatch('/home', 'POST');
    assert.deepEqual(f.records.filter(row => row.phase === 'request-entry').map(row => [row.method, row.route]), [['GET', '/trades'], ['POST', '<redacted-path>']]);
    assert.equal(JSON.stringify(f.records).includes('DO_NOT_LOG'), false);
  } finally { f.stop(); }
});

test('OB02 event budget stops logs but naturally returned new streams are still patched', () => {
  const f = fixture({ maxEvents: 1 });
  try {
    const req = f.dispatch('/api/storage/recall', 'PUT');
    assert.ok(f.records.some(row => row.phase === 'trace-budget-exhausted'));
    const before = f.records.length;
    for (let index = 0; index < 4; index++) {
      const stream = new ReadableStream();
      assert.equal(Object.hasOwn(stream, 'getReader'), false);
      const raw = new f.SyntheticRequest(req, stream);
      assert.equal(raw.body, stream); // A natural getter call; observer creates no reader.
      assert.equal(Object.hasOwn(stream, 'getReader'), true);
      assert.equal(stream.locked, false);
    }
    assert.equal(f.records.length, before);
  } finally { f.stop(); }
});

test('OB03 one-time Web state snapshot stays unlocked after a real natural lock', () => {
  const f = fixture(); let reader;
  try {
    const req = f.dispatch('/api/storage/recall', 'PUT');
    const stream = new ReadableStream(); const raw = new f.SyntheticRequest(req, stream);
    assert.equal(raw.body, stream); reader = stream.getReader();
    assert.equal(stream.locked, true); assert.equal(raw.body, stream);
    const states = f.records.filter(row => row.phase === 'web-body-returned');
    assert.equal(states.length, 1); assert.equal(states[0].web.locked, false);
    assert.ok(f.records.some(row => row.phase === 'consumption-intent' && row.operation === 'web:getReader'));
  } finally { reader?.releaseLock(); f.stop(); }
});
