// Importing this module installs nothing. No srvx import, Request replacement, or I/O.
import { createHash } from 'node:crypto';
import { Server, IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';

export const HARD_LIMITS = Object.freeze({ durationMs: 60_000, requests: 100, events: 1024, bytes: 256 * 1024, descriptors: 512 });
const SELF = fileURLToPath(import.meta.url);
const NATIVE_STACK_GETTER = Object.getOwnPropertyDescriptor(new Error(), 'stack')?.get;
const INITIAL_FORMATTER = Object.getOwnPropertyDescriptor(Error, 'prepareStackTrace');
const NODE26_FORMATTER_SOURCE = 'function ErrorPrepareStackTrace(error, trace) { return internalPrepareStackTrace(error, trace); }';
const SAFE_INITIAL_FORMATTER = typeof INITIAL_FORMATTER?.value === 'function' && Function.prototype.toString.call(INITIAL_FORMATTER.value).replace(/\s+/g, ' ') === NODE26_FORMATTER_SOURCE ? INITIAL_FORMATTER.value : undefined;
const FINGERPRINTS = Object.freeze({
  body: '9c72e7cde00ddb0da599e81d28d2f75fd7b261f35898249c1d35c89c8bf9f416',
  _request: '41ec8776037605caf614049a6d164dedcb796cb6442b3b77b140731faa3fcfa9',
  text: '514df34471a5686212bcd8e1e49793b5579d016d5711dc011c983f92b9055cf7',
  json: 'a885e378f7ed8d5fe094f8996f121f3f478dc21308aa0b82c42f973ec58ea53d',
});
const SAFE_ROUTES = new Set(['/', '/home', '/trades', '/api/storage/recall', '/api/storage/review-summaries', '/api/storage/trades', '/api/storage/reviews', '/api/storage/review-states', '/api/storage/settings', '/api/storage/market-data', '/api/storage/migrate', '/api/storage/trade-revisions', '/api/storage/instruments/metadata', '/api/trading-room/cash', '/api/trading-room/cash/baselines', '/api/trading-room/principal', '/api/trading-room/account-principal', '/api/trading-room/reference-capital', '/api/trading-room/fx', '/api/fx', '/api/instruments/resolve', '/api/market-data/daily', '/api/market-data/intraday']);
const METHOD = /^(GET|HEAD|POST|PUT|PATCH|DELETE|OPTIONS)$/;
const STOP_REASONS = new Set(['manual', 'duration', 'requests', 'events', 'bytes', 'descriptors', 'before-exit', 'target-throw', 'materialize-throw', 'diagnostic-error', 'patch-unavailable', 'lazy-prototype-mismatch']);

function dataValue(object, key) {
  return Object.getOwnPropertyDescriptor(object, key)?.value;
}
function inheritedDescriptor(object, key) {
  for (let p = object; p; p = Object.getPrototypeOf(p)) {
    const d = Object.getOwnPropertyDescriptor(p, key);
    if (d) return d;
  }
}
function sameDescriptor(a, b) {
  return a && b && ['value', 'get', 'set', 'writable', 'enumerable', 'configurable'].every(k => a[k] === b[k]);
}
function routeTag(raw) {
  if (typeof raw !== 'string' || !raw.startsWith('/')) return { route: '<redacted-path>', rsc: false };
  const pathname = raw.split('?', 1)[0].split('#', 1)[0];
  const rsc = pathname.endsWith('.rsc');
  const route = rsc ? pathname.slice(0, -4) || '/' : pathname;
  return { route: SAFE_ROUTES.has(route) ? route : '<redacted-path>', rsc };
}
function errorKind(error) {
  const message = error && (typeof error === 'object' || typeof error === 'function') ? dataValue(error, 'message') : undefined;
  return message === 'Response body object should not be disturbed or locked' || message === 'Body is unusable: Body has already been read' || message === 'Body is unusable'
    ? 'body-unusable' : 'other';
}

// Locations only: no error messages, arbitrary function names, URL queries, or arguments.
function stackLocations(error, root) {
  try {
    // Do not run an application's error.stack getter or custom global formatter.
    const formatter = Object.getOwnPropertyDescriptor(Error, 'prepareStackTrace');
    if (formatter && (formatter.get || formatter.value !== undefined && formatter.value !== SAFE_INITIAL_FORMATTER)) return [];
    const captured = error ?? new Error();
    const descriptor = Object.getOwnPropertyDescriptor(captured, 'stack');
    const stack = typeof descriptor?.value === 'string' ? descriptor.value : descriptor?.get === NATIVE_STACK_GETTER ? Reflect.apply(NATIVE_STACK_GETTER, captured, []) : undefined;
    if (typeof stack !== 'string') return [];
    const result = [];
    for (const line of stack.split('\n')) {
      if (!/^\s*at /.test(line) || line.includes(SELF)) continue;
      const match = line.match(/(?:\(|\s)((?:file:\/\/)?\/[^?\s()]+|node:[a-zA-Z0-9_./:-]+):(\d+):(\d+)\)?$/);
      if (!match) continue;
      let file = match[1].replace(/^file:\/\//, '');
      if (file.startsWith(`${root}/`)) file = `<worktree>/${file.slice(root.length + 1)}`;
      else if (!file.startsWith('node:')) file = '<external-code>';
      if (!/^(?:<worktree>\/[A-Za-z0-9_./@+-]+|<external-code>|node:[A-Za-z0-9_./:-]+)$/.test(file)) file = '<external-code>';
      result.push(`${file}:${match[2]}:${match[3]}`);
      if (result.length === 6) break;
    }
    // Each emitted stack is also independently limited, even with long repository paths.
    while (Buffer.byteLength(JSON.stringify(result)) > 2048) result.pop();
    return result;
  } catch { return []; }
}

export function installBoundedObserver({ limits: requested = {}, onFlush = () => {}, nodeRequestPrototype, root = process.cwd(), clock = () => performance.now(), schedule = setTimeout, cancel = clearTimeout } = {}) {
  const limits = Object.freeze(Object.fromEntries(Object.entries(HARD_LIMITS).map(([key, hard]) => {
    const candidate = requested[key];
    const minimum = key === 'bytes' ? 4096 : 1;
    return [key, Number.isFinite(candidate) ? Math.max(minimum, Math.min(hard, Math.floor(candidate))) : hard];
  })));
  const getOwn = Object.getOwnPropertyDescriptor;
  const define = Object.defineProperty;
  const functionSource = Function.prototype.toString;
  const lockedGetter = getOwn(ReadableStream.prototype, 'locked').get;
  const nativeIsDisturbed = Readable.isDisturbed;
  const patches = [];
  // One fixed-size retained byte buffer while active. Objects/strings used to encode
  // one event are transient; this bound is not a claim about total JS heap overhead.
  const buffer = Buffer.alloc(limits.bytes);
  let tracked = new WeakMap();
  let responses = new WeakMap();
  let streams = new WeakMap();
  let nativeRequests = new WeakMap();
  const discovered = new WeakSet();
  const requestPrototypes = new WeakSet();
  const started = clock();
  const markerReserve = Math.min(2048, limits.bytes / 2);
  let active = true, seq = 0, requests = 0, bytes = 0, streamSeq = 0, nativeSeq = 0, prototypeCount = 0;
  let timer, result, peakDescriptors = 0, flushing = false;

  function state() {
    return { active, seq, requests, bytes, pendingDescriptors: patches.length, peakDescriptors, discoveredPrototypes: prototypeCount, limits };
  }
  function guard() {
    if (!active) return false;
    if (clock() - started >= limits.durationMs) { stop('duration'); return false; }
    return true;
  }
  function nodeState(req) {
    try { return { disturbed: nativeIsDisturbed(req), readableEnded: req.readableEnded, flowing: req.readableFlowing, destroyed: req.destroyed, complete: req.complete, aborted: req.aborted }; }
    catch { return { unavailable: true }; }
  }
  function webState(stream) {
    try { return { locked: Reflect.apply(lockedGetter, stream, []), disturbed: nativeIsDisturbed(stream) }; }
    catch { return { unavailable: true }; }
  }
  function emit(meta, phase, extra = {}) {
    if (!guard()) return false;
    try {
      const entry = { seq: seq + 1, at: new Date().toISOString(), elapsedMs: Math.round(clock() - started), pid: process.pid, phase, ...(meta ? { id: meta.id, method: meta.method, route: meta.route, rsc: meta.rsc } : {}), ...extra };
      const line = `${JSON.stringify(entry)}\n`;
      const size = Buffer.byteLength(line);
      if (bytes + size > limits.bytes - markerReserve) { stop('bytes'); return false; }
      seq++; buffer.write(line, bytes, size, 'utf8'); bytes += size;
      if (seq >= limits.events) stop('events');
      return true;
    } catch { stop('diagnostic-error'); return false; }
  }
  function stop(reason = 'manual') {
    if (!active) return result;
    reason = STOP_REASONS.has(reason) ? reason : 'manual';
    active = false;
    if (timer !== undefined) cancel(timer);
    process.removeListener('beforeExit', beforeExit);
    const restoration = { restored: 0, skipped: 0, failed: 0, ownedRemaining: 0 };
    for (let i = patches.length - 1; i >= 0; i--) {
      const p = patches[i];
      try {
        const current = getOwn(p.target, p.key);
        if (!sameDescriptor(current, p.installed)) { restoration.skipped++; continue; }
        if (p.previous) define(p.target, p.key, p.previous);
        else delete p.target[p.key];
        restoration.restored++;
      } catch { restoration.failed++; }
    }
    for (const p of patches) {
      const current = getOwn(p.target, p.key);
      if (current && (current.value === p.installed.value && typeof p.installed.value === 'function' || current.get === p.installed.get && typeof p.installed.get === 'function')) restoration.ownedRemaining++;
    }
    patches.length = 0;
    tracked = new WeakMap(); responses = new WeakMap(); streams = new WeakMap(); nativeRequests = new WeakMap();
    const marker = { phase: 'observer-stop', at: new Date().toISOString(), pid: process.pid, reason, lastSeq: seq, requests, elapsedMs: Math.round(clock() - started), regularBytes: bytes, restoration };
    const markerLine = `${JSON.stringify(marker)}\n`;
    const markerSize = Buffer.byteLength(markerLine);
    buffer.write(markerLine, bytes, markerSize, 'utf8'); bytes += markerSize;
    result = { get events() { return buffer.toString('utf8', 0, bytes).trimEnd().split('\n').map(line => JSON.parse(line)); }, get text() { return buffer.toString('utf8', 0, bytes); }, buffer: buffer.subarray(0, bytes), restoration, reason, limits, bytes };
    if (!flushing) { flushing = true; try { onFlush(result); } catch { /* Preserve observed results if output fails. */ } }
    return result;
  }
  function patch(target, key, installed) {
    if (!guard()) return false;
    if (patches.length >= limits.descriptors) { stop('descriptors'); return false; }
    const previous = getOwn(target, key);
    try {
      define(target, key, installed);
      patches.push({ target, key, previous, installed: getOwn(target, key) });
      peakDescriptors = Math.max(peakDescriptors, patches.length);
      if (patches.length >= limits.descriptors) stop('descriptors');
      return active;
    } catch { stop('patch-unavailable'); return false; }
  }
  function firstIntent(meta, family, operation, streamInfo) {
    if (!meta || !guard() || meta[family]) return;
    meta[family] = true;
    emit(meta, `${family}-first-intent`, { operation, ...(streamInfo ? { stream: streamInfo.id, web: webState(streamInfo.ref.deref()) } : {}), node: nodeState(meta.ref.deref()), stack: stackLocations(undefined, root) });
  }
  function firstNodeData(meta, operation) {
    if (!meta || meta.nodeData || !guard() || meta.method === 'GET' || meta.method === 'HEAD') return;
    meta.nodeData = true;
    // The original operation already returned/emitted a chunk. Never inspect it or its length.
    emit(meta, 'node-first-data', { operation, node: nodeState(meta.ref.deref()), stack: stackLocations(undefined, root) });
  }
  function observeStream(value, meta) {
    if (!value || !guard()) return;
    let info = streams.get(value);
    if (!info) {
      info = { id: ++streamSeq, meta, ref: new WeakRef(value) }; streams.set(value, info);
      emit(meta, 'web-body-natural-return', { stream: info.id, web: webState(value), node: nodeState(meta.ref.deref()) });
    }
    meta.lastStream = info;
  }
  function metaForLazy(object) {
    // In installed srvx, runtime/node/req are own data properties; never invoke a custom getter.
    try {
      const runtime = dataValue(object, 'runtime');
      const node = runtime && dataValue(runtime, 'node');
      const req = node && dataValue(node, 'req');
      return req && tracked.get(req);
    } catch { return undefined; }
  }
  function method(target, key, before, after) {
    const descriptor = inheritedDescriptor(target, key);
    if (typeof descriptor?.value !== 'function') return;
    const original = descriptor.value;
    patch(target, key, { configurable: true, enumerable: descriptor.enumerable, writable: descriptor.writable, value: function(...args) {
      let context;
      if (guard()) { try { context = before?.(this, args); } catch { stop('diagnostic-error'); } }
      // Exactly one call. Preserve receiver, arguments, Promise/result and synchronous error identity.
      const value = Reflect.apply(original, this, args);
      if (active && after) { try { after(value, context, this); } catch { stop('diagnostic-error'); } }
      return value;
    } });
  }
  function instrumentNativePrototype(proto) {
    if (!proto || requestPrototypes.has(proto) || !guard()) return;
    requestPrototypes.add(proto);
    const body = getOwn(proto, 'body');
    if (body?.get) patch(proto, 'body', { ...body, get: function() {
      const value = Reflect.apply(body.get, this, []);
      const info = active && nativeRequests.get(this);
      if (info && value) { try { observeStream(value, info.meta); info.stream = streams.get(value); } catch { stop('diagnostic-error'); } }
      return value;
    } });
    for (const key of ['text', 'json', 'arrayBuffer', 'bytes', 'blob', 'formData', 'clone']) method(proto, key, object => {
      const info = nativeRequests.get(object);
      if (info && key !== 'clone') firstIntent(info.meta, 'web', `native-request:${key}`, info.stream);
      return info;
    }, (value, info) => {
      // clone is native internal tee; identity tracked but no claim public stream hooks saw it.
      if (key === 'clone' && info) {
        const previousStream = info.stream;
        // Native clone can replace the original's internal stream. Do not attribute
        // a later consumer to its earlier stream until a natural body getter maps it.
        info.stream = undefined;
        info.meta.lastStream = undefined;
        const clone = ++nativeSeq;
        emit(info.meta, 'native-request-clone-return', { nativeRequest: info.id, clone, previousObservedStream: previousStream?.id ?? null, internalStreamTransition: 'not-observed' });
        if (active) nativeRequests.set(value, { id: clone, meta: info.meta });
      }
    });
  }
  function instrumentLazyPrototype(proto, parent) {
    if (!guard() || discovered.has(proto)) return;
    discovered.add(proto); prototypeCount++;
    instrumentNativePrototype(parent);
    for (const key of ['body', '_request']) {
      const descriptor = getOwn(proto, key);
      if (!descriptor?.get) { stop('lazy-prototype-mismatch'); return; }
      patch(proto, key, { ...descriptor, get: function() {
        const meta = active && metaForLazy(this);
        const first = meta && key === '_request' && !meta.materialized;
        if (first) { meta.materialized = true; emit(meta, 'materialize-enter', { node: nodeState(meta.ref.deref()) }); }
        let value;
        try { value = Reflect.apply(descriptor.get, this, []); }
        catch (error) {
          if (meta && active) {
            try {
              const kind = errorKind(error);
              emit(meta, 'materialize-throw', { operation: `srvx:${key}`, errorKind: kind, stream: meta.lastStream?.id ?? null, web: meta.lastStream ? webState(meta.lastStream.ref.deref()) : undefined, node: nodeState(meta.ref.deref()), stack: stackLocations(error, root) });
              stop(kind === 'body-unusable' ? 'target-throw' : 'materialize-throw');
            } catch { stop('diagnostic-error'); }
          }
          throw error;
        }
        if (meta && active) {
          try {
            if (key === 'body') observeStream(value, meta);
            else {
              if (!nativeRequests.has(value)) nativeRequests.set(value, { id: ++nativeSeq, meta, stream: meta.lastStream });
              if (first) emit(meta, 'materialize-return', { nativeRequest: nativeRequests.get(value).id, stream: meta.lastStream?.id ?? null, node: nodeState(meta.ref.deref()) });
            }
          } catch { stop('diagnostic-error'); }
        }
        return value;
      } });
    }
    for (const key of ['text', 'json']) method(proto, key, object => {
      const meta = metaForLazy(object);
      firstIntent(meta, meta?.lastStream ? 'web' : 'node', `srvx:${key}`, meta?.lastStream);
    });
    emit(undefined, 'srvx-prototype-discovered', { fingerprints: 'srvx-0.11.15-exact', count: prototypeCount });
  }
  function capture(req, res) {
    if (!req || tracked.has(req) || !guard()) return;
    const method = dataValue(req, 'method');
    const meta = { id: ++requests, method: typeof method === 'string' && METHOD.test(method) ? method : '<other-method>', ...routeTag(dataValue(req, 'url')), ref: new WeakRef(req) };
    tracked.set(req, meta); if (res) responses.set(res, meta);
    emit(meta, 'request-entry', { node: nodeState(req) });
    if (requests >= limits.requests) stop('requests');
  }
  function beforeExit() { stop('before-exit'); }

  method(Server.prototype, 'emit', (server, args) => { if (args[0] === 'request') capture(args[1], args[2]); });
  method(ServerResponse.prototype, 'emit', (res, args) => {
    const meta = responses.get(res);
    if (meta && (args[0] === 'finish' && !meta.finished || args[0] === 'close' && !meta.closed)) {
      meta[args[0] === 'finish' ? 'finished' : 'closed'] = true;
      emit(meta, `response-${args[0]}`, { status: inheritedDescriptor(res, 'statusCode')?.value, node: nodeState(meta.ref.deref()) });
    }
  });
  for (const key of ['read', 'resume', 'pipe', 'iterator', Symbol.asyncIterator]) method(IncomingMessage.prototype, key, req => {
    const meta = tracked.get(req);
    if (meta && meta.method !== 'GET' && meta.method !== 'HEAD') firstIntent(meta, 'node', `node:${typeof key === 'symbol' ? 'asyncIterator' : key}`);
    return meta;
  }, (value, meta) => { if (key === 'read' && value !== null && value !== undefined) firstNodeData(meta, 'node:read-returned-data'); });
  method(IncomingMessage.prototype, 'emit', (req, args) => {
    const meta = tracked.get(req);
    if (meta && args[0] === 'data' && args.length > 1) firstNodeData(meta, 'node:emit-data');
  });
  for (const key of ['on', 'addListener', 'once', 'prependListener', 'prependOnceListener']) method(IncomingMessage.prototype, key, (req, args) => {
    const meta = tracked.get(req);
    if (meta && meta.method !== 'GET' && meta.method !== 'HEAD' && args[0] === 'data') firstIntent(meta, 'node', `node:${key}:data`);
  });
  method(Readable, 'toWeb', (owner, args) => tracked.get(args[0]), (value, meta) => { if (meta) observeStream(value, meta); });
  for (const key of ['getReader', 'tee', 'pipeTo', 'pipeThrough', 'values', 'cancel', Symbol.asyncIterator]) method(ReadableStream.prototype, key, stream => {
    const info = streams.get(stream);
    if (info) firstIntent(info.meta, 'web', `web:${typeof key === 'symbol' ? 'asyncIterator' : key}`, info);
    return info;
  }, (value, info) => {
    if (key === 'tee' && info && Array.isArray(value)) {
      for (const child of value) observeStream(child, info.meta);
    }
  });
  method(Object, 'setPrototypeOf', (owner, args) => args, (value, args) => {
    const [proto, parent] = args;
    if (!proto || !parent || discovered.has(proto)) return;
    for (const [key, fingerprint] of Object.entries(FINGERPRINTS)) {
      const d = getOwn(proto, key), fn = d?.get ?? d?.value;
      if (typeof fn !== 'function' || createHash('sha256').update(Reflect.apply(functionSource, fn, [])).digest('hex') !== fingerprint) return;
    }
    instrumentLazyPrototype(proto, parent);
  });
  if (nodeRequestPrototype) instrumentLazyPrototype(nodeRequestPrototype, Object.getPrototypeOf(nodeRequestPrototype));
  if (active) {
    process.once('beforeExit', beforeExit);
    timer = schedule(() => stop('duration'), limits.durationMs);
    timer?.unref?.();
    emit(undefined, 'observer-ready', { limits, srvxDiscovery: 'natural-exact-fingerprint', bodies: 'never-probed' });
  }
  return Object.freeze({ stop, state });
}
