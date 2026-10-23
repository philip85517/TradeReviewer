// Synthetic process only: no HTTP listener, database, app import, or framework clone.
// Distinct from the prior consumed/locked Request reproduction matrix.
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { NodeRequest } from 'srvx/node';

const proto = NodeRequest.prototype;
const materializer = Object.getOwnPropertyDescriptor(proto, '_request');
const bodyGetter = Object.getOwnPropertyDescriptor(proto, 'body');
let materializerCalls = 0;
let bodyGetterCalls = 0;
Object.defineProperty(proto, '_request', {
  ...materializer,
  get() { materializerCalls++; return materializer.get.call(this); },
});
Object.defineProperty(proto, 'body', {
  ...bodyGetter,
  get() { bodyGetterCalls++; return bodyGetter.get.call(this); },
});

try {
  const nodeReq = Readable.from([Buffer.from('synthetic observer payload')]);
  Object.assign(nodeReq, {
    method: 'POST', url: '/observer-only',
    headers: { host: 'example.invalid' }, rawHeaders: ['host', 'example.invalid'],
  });
  const raw = new NodeRequest({ req: nodeReq });
  // Metadata baseline deliberately never accesses body, bodyUsed, redirect, or clone.
  const metadata = { method: raw.method, url: raw.url, host: raw.headers.get('host') };
  const baseline = { materializerCalls, bodyGetterCalls, disturbed: Readable.isDisturbed(nodeReq) };
  assert.deepEqual(baseline, { materializerCalls: 0, bodyGetterCalls: 0, disturbed: false });
  const bodyUsed = raw.bodyUsed;
  const sampled = { bodyUsed, materializerCalls, bodyGetterCalls, disturbed: Readable.isDisturbed(nodeReq) };
  assert.equal(bodyUsed, false);
  assert.equal(materializerCalls, 1);
  assert.equal(bodyGetterCalls, 1);
  console.log(JSON.stringify({
    status: 'PASS',
    runtime: process.version,
    metadata,
    baseline,
    sampled,
    conclusion: 'bodyUsed=false still invokes srvx _request and body getters; this is not a passive first sample',
    network: false,
    database: false,
    originalOverlayRootCause: 'OPEN',
  }, null, 2));
  nodeReq.destroy();
} finally {
  Object.defineProperty(proto, '_request', materializer);
  Object.defineProperty(proto, 'body', bodyGetter);
}
