// Import is inert: no srvx import, Request replacement, observer installation or I/O.
import { createHash } from 'node:crypto';
import { IncomingMessage, Server, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';

export const HARD_LIMITS = Object.freeze({ durationMs: 60_000, requests: 4, events: 128, bytes: 65_536, descriptors: 64 });
const ROUTES = new Set(['/api/storage/reviews', '/api/storage/review-summaries']);
const BUDGETS = new Set(['duration', 'requests', 'events', 'bytes', 'descriptors']);
const REASONS = new Set([...BUDGETS, 'manual', 'before-exit', 'target-throw', 'materialize-throw', 'diagnostic-error', 'patch-unavailable', 'prototype-mismatch']);
const FINGERPRINTS = Object.freeze({ body: '9c72e7cde00ddb0da599e81d28d2f75fd7b261f35898249c1d35c89c8bf9f416', _request: '41ec8776037605caf614049a6d164dedcb796cb6442b3b77b140731faa3fcfa9' });
const SELF = fileURLToPath(import.meta.url);
const own = Object.getOwnPropertyDescriptor;
const define = Object.defineProperty;
const fnSource = Function.prototype.toString;
const disturbed = Readable.isDisturbed;
const readable = Readable.isReadable;
const locked = own(ReadableStream.prototype, 'locked').get;
const nodeGetters = Object.fromEntries(['readable', 'readableEnded', 'destroyed', 'readableAborted'].map(key => [key, own(Readable.prototype, key).get]));
const nativeStackGetter = own(new Error(), 'stack')?.get;
const initialFormatter = own(Error, 'prepareStackTrace');
const defaultFormatterSource = 'function ErrorPrepareStackTrace(error, trace) { return internalPrepareStackTrace(error, trace); }';
const safeFormatter = typeof initialFormatter?.value === 'function' && Reflect.apply(fnSource, initialFormatter.value, []).replace(/\s+/g, ' ') === defaultFormatterSource ? initialFormatter.value : undefined;
let activeController;

function data(object, key) { return own(object, key)?.value; }
function inherited(object, key) {
  for (let p = object; p; p = Object.getPrototypeOf(p)) { const d = own(p, key); if (d) return d; }
}
function equalDescriptor(a, b) { return a && b && ['value', 'get', 'set', 'writable', 'enumerable', 'configurable'].every(key => a[key] === b[key]); }
function targetRoute(req) {
  if (data(req, 'method') !== 'PUT') return;
  const raw = data(req, 'url');
  if (typeof raw !== 'string' || raw.includes('#')) return;
  const path = raw.split('?', 1)[0];
  return ROUTES.has(path) ? path : undefined;
}
function nodeState(req) {
  try {
    return { disturbed: disturbed(req), isReadable: readable(req), ...Object.fromEntries(Object.entries(nodeGetters).map(([key, get]) => [key, Reflect.apply(get, req, [])])), complete: data(req, 'complete'), aborted: data(req, 'aborted') };
  } catch { return { unavailable: true }; }
}
function webState(stream) {
  try { return { locked: Reflect.apply(locked, stream, []), disturbed: disturbed(stream) }; }
  catch { return { unavailable: true }; }
}
function kind(error) {
  const message = error && (typeof error === 'object' || typeof error === 'function') ? data(error, 'message') : undefined;
  return message === 'Response body object should not be disturbed or locked' || message === 'Body is unusable: Body has already been read' || message === 'Body is unusable' ? 'body-unusable' : 'other';
}
function locations(error, root) {
  try {
    const formatter = own(Error, 'prepareStackTrace');
    if (formatter && (formatter.get || formatter.value !== undefined && formatter.value !== safeFormatter)) return [];
    const captured = error ?? new Error();
    const d = own(captured, 'stack');
    const stack = typeof d?.value === 'string' ? d.value : d?.get === nativeStackGetter ? Reflect.apply(nativeStackGetter, captured, []) : undefined;
    if (typeof stack !== 'string') return [];
    const found = [];
    for (const line of stack.split('\n')) {
      if (!/^\s*at /.test(line) || line.includes(SELF)) continue;
      const match = line.match(/(?:\(|\s)((?:file:\/\/)?\/[^?\s()]+|node:[a-zA-Z0-9_./:-]+):(\d+):(\d+)\)?$/);
      if (!match) continue;
      let file = match[1].replace(/^file:\/\//, '');
      if (file.startsWith(`${root}/`)) file = `<worktree>/${file.slice(root.length + 1)}`;
      else if (!file.startsWith('node:')) file = '<external-code>';
      if (!/^(?:<worktree>\/[A-Za-z0-9_./@+-]+|<external-code>|node:[A-Za-z0-9_./:-]+)$/.test(file)) file = '<external-code>';
      found.push(`${file}:${match[2]}:${match[3]}`);
      if (found.length === 6) break;
    }
    while (Buffer.byteLength(JSON.stringify(found)) > 2048) found.pop();
    return found;
  } catch { return []; }
}

export function installTerminalObserver({ limits: requested = {}, onFlush = () => {}, nodeRequestPrototype, root = process.cwd(), clock = () => performance.now(), schedule = setTimeout, cancel = clearTimeout } = {}) {
  // A second installation cannot stack wrappers, change sinks or extend the deadline.
  if (activeController) return activeController;
  const limits = Object.freeze(Object.fromEntries(Object.entries(HARD_LIMITS).map(([key, hard]) => [key, Number.isFinite(requested[key]) ? Math.max(key === 'bytes' ? 4096 : key === 'events' ? 2 : 1, Math.min(hard, Math.floor(requested[key]))) : hard])));
  const buffer = Buffer.alloc(limits.bytes);
  const reserve = Math.min(2048, Math.floor(limits.bytes / 2));
  const started = clock();
  const patches = [];
  let nodes = new WeakMap(), responses = new WeakMap(), streams = new WeakMap(), discovered = new WeakSet();
  let active = true, seq = 0, requests = 0, streamSeq = 0, bytes = 0, peakDescriptors = 0, prototypes = 0;
  let timer, result, flushFailed = false, blockedPhase;
  const controller = Object.freeze({ stop, state });
  activeController = controller;
  function state() { return { active, seq, requests, streams: streamSeq, bytes, pendingDescriptors: patches.length, peakDescriptors, discoveredPrototypes: prototypes, flushFailed, limits }; }
  function guard() {
    if (!active) return false;
    if (clock() - started >= limits.durationMs) { stop('duration'); return false; }
    return true;
  }
  function emit(meta, phase, extra = {}) {
    if (!guard()) return false;
    try {
      const entry = { seq: seq + 1, pid: process.pid, elapsedMs: Math.round(clock() - started), phase, ...(meta ? { id: meta.id, method: 'PUT', route: meta.route } : {}), ...extra };
      const line = `${JSON.stringify(entry)}\n`, size = Buffer.byteLength(line);
      if (bytes + size > limits.bytes - reserve) { blockedPhase = phase; stop('bytes'); return false; }
      seq++; buffer.write(line, bytes, size, 'utf8'); bytes += size;
      // One event slot and a byte reserve always belong to the stop marker.
      if (seq >= limits.events - 1) stop('events');
      return active;
    } catch { stop('diagnostic-error'); return false; }
  }
  function stop(reason = 'manual') {
    if (!active) return result;
    reason = REASONS.has(reason) ? reason : 'manual';
    active = false;
    if (activeController === controller) activeController = undefined;
    try { if (timer !== undefined) cancel(timer); } catch { /* Remain inactive. */ }
    process.removeListener('beforeExit', beforeExit);
    const restoration = { restored: 0, skipped: 0, failed: 0, ownedRemaining: 0 };
    for (let i = patches.length - 1; i >= 0; i--) {
      const p = patches[i];
      try {
        if (!equalDescriptor(own(p.target, p.key), p.installed)) { restoration.skipped++; continue; }
        if (p.previous) define(p.target, p.key, p.previous); else delete p.target[p.key];
        restoration.restored++;
      } catch { restoration.failed++; }
    }
    for (const p of patches) {
      const current = own(p.target, p.key);
      if (current && (typeof p.installed.value === 'function' && current.value === p.installed.value || typeof p.installed.get === 'function' && current.get === p.installed.get)) restoration.ownedRemaining++;
    }
    patches.length = 0;
    nodes = new WeakMap(); responses = new WeakMap(); streams = new WeakMap(); discovered = new WeakSet();
    const marker = { seq: ++seq, phase: 'observer-stop', pid: process.pid, elapsedMs: Math.round(clock() - started), reason, tailTruncated: BUDGETS.has(reason), ...(blockedPhase ? { blockedPhase } : {}), requests, streams: streamSeq, regularBytes: bytes, restoration };
    const line = `${JSON.stringify(marker)}\n`, size = Buffer.byteLength(line);
    buffer.write(line, bytes, size, 'utf8'); bytes += size;
    result = { get events() { return buffer.toString('utf8', 0, bytes).trimEnd().split('\n').map(line => JSON.parse(line)); }, get text() { return buffer.toString('utf8', 0, bytes); }, get flushFailed() { return flushFailed; }, buffer: buffer.subarray(0, bytes), bytes, reason, restoration, limits };
    try { onFlush(result); } catch { flushFailed = true; }
    return result;
  }
  function diagnostic(action) { if (guard()) try { action(); } catch { stop('diagnostic-error'); } }
  function patch(target, key, installed) {
    if (!guard()) return;
    if (patches.length >= limits.descriptors) { stop('descriptors'); return; }
    const previous = own(target, key);
    try {
      define(target, key, installed);
      patches.push({ target, key, previous, installed: own(target, key) });
      peakDescriptors = Math.max(peakDescriptors, patches.length);
      if (patches.length >= limits.descriptors) stop('descriptors');
    } catch { stop('patch-unavailable'); }
  }
  function method(target, key, before, after, failure) {
    const d = inherited(target, key);
    if (typeof d?.value !== 'function') { stop('patch-unavailable'); return; }
    const original = d.value;
    patch(target, key, { configurable: true, enumerable: d.enumerable, writable: d.writable, value: function(...args) {
      let context;
      diagnostic(() => { context = before?.(this, args); });
      let value;
      try { value = Reflect.apply(original, this, args); }
      catch (error) { if (failure) diagnostic(() => failure(error, context, this)); throw error; }
      if (after) diagnostic(() => after(value, context, this));
      return value;
    } });
  }
  function streamInfo(value, meta) {
    let info = streams.get(value);
    if (!info) { info = { id: ++streamSeq, ref: new WeakRef(value) }; streams.set(value, info); }
    return info;
  }
  function lazyMeta(object) {
    const runtime = data(object, 'runtime'), node = runtime && data(runtime, 'node'), req = node && data(node, 'req');
    return req && nodes.get(req);
  }
  function lastObserved(meta) {
    const info = meta.lastBody ?? meta.lastBridge;
    const stream = info?.ref.deref();
    return { stream: info?.id ?? null, ...(stream ? { web: webState(stream) } : {}) };
  }
  function lazy(proto) {
    if (!guard() || discovered.has(proto)) return;
    for (const [key, fingerprint] of Object.entries(FINGERPRINTS)) {
      const get = own(proto, key)?.get;
      if (typeof get !== 'function' || createHash('sha256').update(Reflect.apply(fnSource, get, [])).digest('hex') !== fingerprint) return false;
    }
    discovered.add(proto); prototypes++;
    for (const key of ['body', '_request']) {
      const d = own(proto, key);
      patch(proto, key, { ...d, get: function() {
        let meta, previous;
        diagnostic(() => {
          meta = lazyMeta(this); previous = meta?.lastBody;
          if (meta && key === '_request') emit(meta, 'materialize-enter', { node: nodeState(meta.ref.deref()), ...lastObserved(meta) });
        });
        let value;
        try { value = Reflect.apply(d.get, this, []); }
        catch (error) {
          diagnostic(() => {
            if (!meta) return;
            const errorKind = kind(error);
            emit(meta, 'materialize-throw', { operation: key, errorKind, node: nodeState(meta.ref.deref()), ...lastObserved(meta), stack: locations(error, root) });
            stop(errorKind === 'body-unusable' ? 'target-throw' : 'materialize-throw');
          });
          throw error;
        }
        diagnostic(() => {
          if (!meta) return;
          if (key === 'body' && value) {
            const info = streamInfo(value, meta);
            meta.lastBody = info;
            emit(meta, 'body-return', { stream: info.id, sameAsBridge: meta.lastBridge?.ref.deref() === value, sameAsPreviousBody: previous?.ref.deref() === value, web: webState(value), node: nodeState(meta.ref.deref()) });
          } else if (key === '_request') emit(meta, 'materialize-return', { node: nodeState(meta.ref.deref()), ...lastObserved(meta) });
        });
        return value;
      } });
    }
    emit(undefined, 'srvx-prototype-discovered', { fingerprints: 'srvx-0.11.15-body-request-exact' });
    return true;
  }
  function capture(req, res) {
    if (!req || nodes.has(req)) return;
    const route = targetRoute(req); if (!route) return;
    const meta = { id: ++requests, route, ref: new WeakRef(req) };
    nodes.set(req, meta); if (res) responses.set(res, meta);
    emit(meta, 'request-entry', { node: nodeState(req) });
    if (requests >= limits.requests) stop('requests');
  }
  function beforeExit() { stop('before-exit'); }
  // Arm the one wall timer before any patch can hit its descriptor budget.
  try {
    timer = schedule(() => stop('duration'), limits.durationMs); timer?.unref?.();
    process.once('beforeExit', beforeExit);
  } catch { stop('diagnostic-error'); }
  method(Server.prototype, 'emit', (server, args) => { if (args[0] === 'request') capture(args[1], args[2]); });
  method(IncomingMessage.prototype, 'emit', (req, args) => {
    const meta = nodes.get(req), event = args[0];
    if (meta && (event === 'aborted' || event === 'close') && !meta[event]) { meta[event] = true; emit(meta, `node-${event}`, { node: nodeState(req) }); }
  });
  method(IncomingMessage.prototype, 'destroy', req => {
    const meta = nodes.get(req);
    if (!meta || meta.destroySeen) return;
    meta.destroySeen = true;
    emit(meta, 'destroy-enter', { node: nodeState(req), stack: locations(undefined, root) });
    return meta;
  }, (value, meta, req) => { if (meta) emit(meta, 'destroy-return', { node: nodeState(req) }); });
  method(ServerResponse.prototype, 'emit', (res, args) => {
    const meta = responses.get(res), event = args[0];
    if (meta && (event === 'finish' || event === 'close') && !meta[`response-${event}`]) { meta[`response-${event}`] = true; emit(meta, `response-${event}`, { node: nodeState(meta.ref.deref()) }); }
  });
  method(Readable, 'toWeb', (owner, args) => {
    const meta = nodes.get(args[0]);
    if (meta) emit(meta, 'bridge-before', { node: nodeState(args[0]) });
    return meta;
  }, (value, meta) => {
    if (!meta) return;
    const info = streamInfo(value, meta); meta.lastBridge = info;
    emit(meta, 'bridge-after', { stream: info.id, node: nodeState(meta.ref.deref()), web: webState(value) });
  }, (error, meta) => { if (meta) { emit(meta, 'bridge-throw', { errorKind: kind(error), node: nodeState(meta.ref.deref()) }); stop('materialize-throw'); } });
  method(Object, 'setPrototypeOf', (owner, args) => args, (value, args) => { if (args?.[0] && args?.[1]) lazy(args[0]); });
  if (nodeRequestPrototype && active && !lazy(nodeRequestPrototype)) stop('prototype-mismatch');
  if (active) emit(undefined, 'observer-ready', { limits, routes: [...ROUTES], discovery: 'natural-exact-fingerprint', bodies: 'never-probed' });
  return controller;
}
