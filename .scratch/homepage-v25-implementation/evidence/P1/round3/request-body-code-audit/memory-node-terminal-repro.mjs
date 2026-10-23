import assert from 'node:assert/strict';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import { createHash } from 'node:crypto';
import { NodeRequest } from 'srvx/node';
import { cloneRequestWithHeaders } from 'vinext/server/request-pipeline';

// No socket, network, DB, application import, runtime observer, or file writes.
const nativeSources = process.binding('natives');
const sourceKeys = ['internal/deps/undici/undici', 'internal/webstreams/adapters', '_http_server', '_http_incoming'];
console.log(JSON.stringify({ kind: 'runtime', node: process.version, sources: sourceKeys.map(key => ({ key, sha256: createHash('sha256').update(nativeSources[key]).digest('hex') })) }));

function state(req) {
  return { disturbed: Readable.isDisturbed(req), readable: req.readable, nodeIsReadable: Readable.isReadable(req), readableEnded: req.readableEnded, destroyed: req.destroyed, readableAborted: req.readableAborted, complete: req.complete, aborted: req.aborted };
}
function webState(body) {
  return { locked: body.locked, disturbed: Readable.isDisturbed(body) };
}
function memoryRequest() {
  const req = new IncomingMessage(null);
  req.method = 'PUT'; req.url = '/memory-only';
  req.headers = { host: 'memory.invalid' }; req.rawHeaders = ['host', 'memory.invalid'];
  return { req, res: new ServerResponse(req) };
}

for (const name of ['fresh', 'node-partially-read', 'node-drained', 'node-destroyed-unread']) {
  const pair = memoryRequest(); const req = pair.req;
  if (name === 'node-partially-read') {
    // Buffer the complete parser payload first: with socket=null an early _read
    // would itself throw while checking socket.readable, invalidating the fixture.
    req.push(Buffer.from('AB')); req.push(null); req.complete = true;
    assert.equal(req.read(1).toString(), 'A');
  } else if (name === 'node-drained') {
    req.push(Buffer.from('AB')); req.push(null); req.complete = true;
    for await (const chunk of req) assert.equal(chunk.toString(), 'AB');
  } else if (name === 'node-destroyed-unread') {
    req.destroy();
    await new Promise(resolve => setImmediate(resolve));
  } else {
    req.push(Buffer.from('AB')); req.push(null); req.complete = true;
  }

  const raw = new NodeRequest(pair);
  const beforeFirst = state(req); const listenersBefore = req.listenerCount('data');
  let firstError;
  try { new Request(raw, { headers: new Headers() }); } catch (error) { firstError = error; }
  assert.ok(firstError instanceof TypeError);
  assert.match(firstError.message, /Cannot read private member #state/);
  assert.equal(req.listenerCount('data'), listenersBefore);
  assert.deepEqual(state(req), beforeFirst);
  const firstAttemptDataListenersAdded = req.listenerCount('data') - listenersBefore;

  // The installed helper itself performs the first body access. Inspect only after
  // its return/throw, before any body read; terminal failures retain cached stream.
  let cloned, cloneError;
  try { cloned = cloneRequestWithHeaders(raw, new Headers()); } catch (error) { cloneError = error; }
  const firstBody = webState(raw.body);
  const terminal = name === 'node-drained' || name === 'node-destroyed-unread';
  if (terminal) {
    assert.deepEqual(firstBody, { locked: false, disturbed: true });
    assert.ok(cloneError instanceof TypeError);
    assert.equal(cloneError.message, 'Response body object should not be disturbed or locked');
  } else {
    assert.deepEqual(firstBody, { locked: false, disturbed: false });
    assert.equal(cloneError, undefined);
    assert.equal(await cloned.text(), name === 'fresh' ? 'AB' : 'B');
  }
  console.log(JSON.stringify({ kind: 'case', name, nodeAtFirstAttempt: beforeFirst, firstAttemptError: firstError.message, firstAttemptDataListenersAdded, firstBody, clone: cloneError ? { outcome: 'target-error', message: cloneError.message, stack: cloneError.stack.split('\n').slice(0, 9) } : { outcome: 'success', payloadVerified: true } }));
  req.destroy(); pair.res.destroy();
}
console.log(JSON.stringify({ kind: 'result', assertions: 'PASS', actualIncidentConsumer: 'NOT VERIFIED', network: 'none', database: 'none' }));
