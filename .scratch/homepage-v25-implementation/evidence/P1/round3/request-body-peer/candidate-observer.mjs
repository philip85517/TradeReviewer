// Candidate only. Importing this module installs nothing and opens no file/socket.
import { Server } from 'node:http';
import { Readable } from 'node:stream';
import { performance } from 'node:perf_hooks';

const safeRoutes = new Set([
  '/', '/trades', '/api/storage/recall', '/api/storage/review-summaries',
  '/api/storage/trades', '/api/storage/reviews', '/api/storage/review-states',
  '/api/storage/settings', '/api/storage/market-data', '/api/storage/migrate',
  '/api/storage/trade-revisions', '/api/storage/instruments/metadata',
  '/api/trading-room/cash', '/api/trading-room/cash/baselines',
  '/api/trading-room/principal', '/api/trading-room/account-principal',
  '/api/trading-room/reference-capital', '/api/trading-room/fx',
  '/api/fx', '/api/instruments/resolve', '/api/market-data/daily', '/api/market-data/intraday',
]);

function routeTag(url) {
  const pathname = new URL(url ?? '/', 'http://observer.invalid').pathname;
  const route = pathname.endsWith('.rsc') ? pathname.slice(0, -4) || '/' : pathname;
  return { route: safeRoutes.has(route) ? route : '<redacted-path>', api: pathname.startsWith('/api/') };
}

// Never includes error.message, request URL, query, headers, content, or arguments.
function codeStack() {
  try {
    return (new Error().stack ?? '').split('\n').filter(line => /^\s*at /.test(line))
      .filter(line => !line.includes('/candidate-observer.mjs:'))
      .slice(0, 10).map(line => line.replaceAll(process.cwd(), '<worktree>').replace(/\?[^\s)]*/g, '?<redacted>'));
  } catch { return ['<stack-unavailable>']; }
}

export function installRequestBodyObserver({ NodeRequest, serverPrototype = Server.prototype, write, maxEvents = 2000, maxRequests = 200 } = {}) {
  const tracked = new WeakMap();
  const streams = new WeakSet();
  const readers = new WeakSet();
  const patches = [];
  let active = true;
  let seq = 0;
  let requestCount = 0;
  let exhausted = false;
  let requestBudgetReported = false;

  function emit(meta, phase, extra = {}) {
    if (!active || exhausted) return;
    try {
      if (seq >= maxEvents) {
        exhausted = true;
        write({ phase: 'trace-budget-exhausted', pid: process.pid, seq: ++seq });
        return;
      }
      const req = meta?.nodeRef.deref();
      const node = req ? {
        disturbed: Readable.isDisturbed(req), readableEnded: req.readableEnded,
        flowing: req.readableFlowing, destroyed: req.destroyed,
        complete: req.complete, aborted: req.aborted,
      } : undefined;
      write({ at: new Date().toISOString(), monotonicMs: performance.now(), pid: process.pid,
        seq: ++seq, id: meta?.id, method: meta?.method, route: meta?.route, node, phase, ...extra });
    } catch { /* Diagnostic failure must never change the observed operation. */ }
  }

  function threw(meta, operation, error) {
    // Fixed classification only: arbitrary messages may contain user data.
    let errorCode = 'other';
    try { if (error?.message === 'Response body object should not be disturbed or locked') errorCode = 'body-disturbed-or-locked'; } catch {}
    emit(meta, 'operation-throw', { operation, errorCode, callerStack: codeStack() });
  }

  function patch(target, key, descriptor) {
    const previous = Object.getOwnPropertyDescriptor(target, key);
    try {
      Object.defineProperty(target, key, descriptor);
      patches.push({ ref: new WeakRef(target), key, previous, installed: descriptor });
      return true;
    } catch { emit(undefined, 'patch-unavailable', { operation: typeof key === 'symbol' ? 'asyncIterator' : key }); return false; }
  }

  function intent(meta, operation) {
    if (!meta.seen.has(operation)) {
      const first = !meta.first;
      meta.first = true;
      meta.seen.add(operation);
      emit(meta, 'consumption-intent', { operation, first, callerStack: codeStack() });
    }
  }

  function method(target, key, meta, operation, { consumes = true, result } = {}) {
    const original = target[key];
    if (typeof original !== 'function') return;
    const wrapper = function(...args) {
      if (active) {
        if (consumes) intent(meta, operation);
        emit(meta, 'operation', { operation });
      }
      try {
        const value = Reflect.apply(original, this, args);
        if (active && result) { try { result(value); } catch {} }
        return value; // Never await, attach .then/.catch, or replace a Promise/result.
      } catch (error) { threw(meta, operation, error); throw error; }
    };
    patch(target, key, { configurable: true, writable: true, enumerable: false, value: wrapper });
  }

  function reader(value, meta) {
    if (!value || readers.has(value)) return;
    readers.add(value);
    for (const name of ['read', 'cancel', 'releaseLock']) method(value, name, meta, `reader:${name}`, { consumes: name !== 'releaseLock' });
  }

  function stream(value, meta) {
    if (!value || streams.has(value)) return;
    streams.add(value);
    // This is reached only after the original body getter naturally returned.
    emit(meta, 'web-body-returned', { web: { locked: value.locked, disturbed: Readable.isDisturbed(value) } });
    for (const name of ['getReader', 'tee', 'pipeTo', 'pipeThrough', 'values', 'cancel']) {
      method(value, name, meta, `web:${name}`, { result: name === 'getReader' ? result => reader(result, meta) : undefined });
    }
    method(value, Symbol.asyncIterator, meta, 'web:asyncIterator');
  }

  function capture(req) {
    if (!req || tracked.has(req) || exhausted) return tracked.get(req);
    if (requestCount >= maxRequests) {
      if (!requestBudgetReported) { requestBudgetReported = true; emit(undefined, 'request-budget-exhausted', { maxRequests }); }
      return;
    }
    const { route, api } = routeTag(req.url);
    // Exclude static/HMR GET traffic; all mutations and API GETs stay observable.
    const httpMethod = /^(GET|HEAD|POST|PUT|PATCH|DELETE|OPTIONS)$/.test(req.method) ? req.method : '<other-method>';
    if ((httpMethod === 'GET' || httpMethod === 'HEAD') && route === '<redacted-path>' && !api) return;
    const meta = { id: `rb-${process.pid}-${++requestCount}`, route, method: httpMethod, nodeRef: new WeakRef(req), seen: new Set(), first: false };
    tracked.set(req, meta);
    emit(meta, 'request-entry');
    for (const name of ['read', 'resume', 'pipe']) method(req, name, meta, `node:${name}`);
    method(req, Symbol.asyncIterator, meta, 'node:asyncIterator');
    for (const name of ['on', 'addListener', 'once']) {
      const original = req[name];
      patch(req, name, { configurable: true, writable: true, enumerable: false, value: function(...args) {
        if (active && args[0] === 'data') intent(meta, `node:${name}:data`);
        try { return Reflect.apply(original, this, args); }
        catch (error) { threw(meta, `node:${name}`, error); throw error; }
      } });
    }
    const originalEmit = req.emit;
    patch(req, 'emit', { configurable: true, writable: true, enumerable: false, value: function(...args) {
      if (active && ['aborted', 'close', 'end', 'error'].includes(args[0])) emit(meta, `node-${args[0]}`);
      try { return Reflect.apply(originalEmit, this, args); }
      catch (error) { threw(meta, 'node:emit', error); throw error; }
    } });
    return meta;
  }

  const originalServerEmit = serverPrototype.emit;
  patch(serverPrototype, 'emit', { configurable: true, writable: true, enumerable: false, value: function(...args) {
    let meta;
    // Capture failure must not change Server.emit receiver, args, result, or error.
    if (active && args[0] === 'request') { try { meta = capture(args[1]); } catch { emit(undefined, 'capture-unavailable'); } }
    try {
      const value = Reflect.apply(originalServerEmit, this, args);
      if (meta) emit(meta, 'server-dispatch-return');
      return value;
    } catch (error) { if (meta) threw(meta, 'server:emit', error); throw error; }
  } });

  const proto = NodeRequest.prototype;
  for (const key of ['body', '_request']) {
    const original = Object.getOwnPropertyDescriptor(proto, key);
    if (!original?.get) continue;
    patch(proto, key, { ...original, get: function() {
      const meta = tracked.get(this.runtime?.node?.req);
      if (meta) emit(meta, 'getter-begin', { operation: `srvx:${key}`, callerStack: codeStack() });
      try {
        const value = Reflect.apply(original.get, this, []);
        if (meta) {
          if (key === 'body') { try { stream(value, meta); } catch {} }
          emit(meta, 'getter-return', { operation: `srvx:${key}` });
        }
        return value;
      } catch (error) { if (meta) threw(meta, `srvx:${key}`, error); throw error; }
    } });
  }
  for (const key of ['text', 'json']) {
    const original = proto[key];
    if (typeof original !== 'function') continue;
    patch(proto, key, { configurable: true, writable: true, enumerable: false, value: function(...args) {
      const meta = tracked.get(this.runtime?.node?.req);
      if (meta) { intent(meta, `srvx:${key}`); emit(meta, 'operation', { operation: `srvx:${key}` }); }
      try { return Reflect.apply(original, this, args); }
      catch (error) { if (meta) threw(meta, `srvx:${key}`, error); throw error; }
    } });
  }
  emit(undefined, 'observer-ready', { maxEvents, maxRequests });
  return function uninstall() {
    active = false;
    for (const patch of patches.reverse()) {
      const target = patch.ref.deref();
      if (!target) continue;
      const current = Object.getOwnPropertyDescriptor(target, patch.key);
      // Never overwrite a later third-party patch.
      if (current?.value !== patch.installed.value || current?.get !== patch.installed.get) continue;
      try { if (patch.previous) Object.defineProperty(target, patch.key, patch.previous); else delete target[patch.key]; } catch {}
    }
  };
}
