// Evidence-only offline aggregation. No app imports, network, browser, or DB.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const directory = fileURLToPath(new URL('.', import.meta.url));
const names = ['root-window-02.33284.ndjson', 'root-window-02.33286.ndjson'];
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const count = (rows, key) => Object.fromEntries([...rows.reduce((map, row) => {
  const value = key(row); if (value !== undefined) map.set(value, (map.get(value) ?? 0) + 1); return map;
}, new Map())].sort(([a], [b]) => a.localeCompare(b)));
const brief = row => row && Object.fromEntries(['seq', 'at', 'id', 'method', 'route', 'phase', 'operation', 'first', 'node', 'web', 'callerStack'].filter(key => row[key] !== undefined).map(key => [key, row[key]]));
const before = Object.fromEntries(names.map(name => [name, sha(readFileSync(directory + name))]));
const files = names.map(name => {
  const bytes = readFileSync(directory + name);
  const lines = bytes.toString('utf8').trim().split('\n');
  const rows = lines.map((line, index) => ({ ...JSON.parse(line), evidenceLine: index + 1 }));
  const sequenced = rows.filter(row => row.seq !== undefined);
  assert.deepEqual(sequenced.map(row => row.seq), sequenced.map((_, i) => i + 1));
  const entries = rows.filter(row => row.phase === 'request-entry');
  const ids = new Set(entries.map(row => row.id));
  assert.ok(rows.every(row => !row.id || ids.has(row.id)));
  const nonGet = entries.filter(row => !['GET', 'HEAD'].includes(row.method)).map(entry => {
    const requestRows = rows.filter(row => row.id === entry.id);
    return {
      entry: brief(entry), evidenceLines: [requestRows[0].evidenceLine, requestRows.at(-1).evidenceLine],
      eventCount: requestRows.length,
      phaseCounts: count(requestRows, row => row.phase),
      operationCounts: count(requestRows, row => row.operation),
      intents: requestRows.filter(row => row.phase === 'consumption-intent').map(brief),
      bodyStates: requestRows.filter(row => row.phase === 'web-body-returned').map(brief),
      firstNodeDisturbed: brief(requestRows.find(row => row.node?.disturbed)),
      end: brief(requestRows.find(row => row.phase === 'node-end')),
      close: brief(requestRows.find(row => row.phase === 'node-close')),
      last: brief(requestRows.at(-1)),
    };
  });
  const routes = [...new Set(entries.map(row => row.method + ' ' + row.route))].sort().map(key => {
    const requestRows = rows.filter(row => row.id && row.method + ' ' + row.route === key);
    return { methodRoute: key, requests: entries.filter(row => row.method + ' ' + row.route === key).length,
      eventCount: requestRows.length, phases: count(requestRows, row => row.phase) };
  });
  return {
    name, sha256: sha(bytes), bytes: bytes.length, lines: lines.length,
    firstTimed: brief(rows.find(row => row.at)), lastTimed: brief(rows.findLast(row => row.at)),
    sequence: { first: sequenced[0]?.seq, last: sequenced.at(-1)?.seq, contiguous: true },
    requestCount: entries.length, methodCounts: count(entries, row => row.method), routes,
    phaseCounts: count(rows, row => row.phase),
    getterBeginCounts: count(rows.filter(row => row.phase === 'getter-begin'), row => row.operation),
    getterReturnCounts: count(rows.filter(row => row.phase === 'getter-return'), row => row.operation),
    consumptionIntentCounts: count(rows.filter(row => row.phase === 'consumption-intent'), row => row.operation),
    firstIntentCounts: count(rows.filter(row => row.phase === 'consumption-intent' && row.first), row => row.operation),
    operationCounts: count(rows.filter(row => row.phase === 'operation'), row => row.operation),
    earliestIntent: brief(rows.find(row => row.phase === 'consumption-intent')),
    earliestGetter: brief(rows.find(row => row.phase === 'getter-begin')),
    operationThrows: rows.filter(row => row.phase === 'operation-throw').map(brief),
    errorOrAbortEvents: rows.filter(row => ['node-error', 'node-aborted', 'capture-unavailable', 'patch-unavailable'].includes(row.phase)).map(brief),
    webBodyStates: rows.filter(row => row.phase === 'web-body-returned').map(brief),
    firstDisturbed: brief(rows.find(row => row.node?.disturbed)),
    requestsWithoutFirstIntent: entries.filter(entry => !rows.some(row => row.id === entry.id && row.phase === 'consumption-intent' && row.first)).map(row => ({ id: row.id, method: row.method, route: row.route, entrySeq: row.seq })),
    requestsWithoutNodeEnd: entries.filter(entry => !rows.some(row => row.id === entry.id && row.phase === 'node-end')).map(row => ({ id: row.id, method: row.method, route: row.route, entrySeq: row.seq })),
    nonGet,
    cutoff: rows.at(-1), lastThreeTimed: rows.filter(row => row.at).slice(-3).map(brief),
  };
});
const sourceNames = ['candidate-observer.mjs', 'candidate-preload.mjs', 'root-window-02-timeout.ax.txt', 'root-window-02-timeout.png'];
const manifest = {
  generatedAt: new Date().toISOString(), node: process.version,
  command: [process.execPath, process.argv[1]],
  scope: 'offline read-only log aggregation; no preload execution, service, HTTP, browser, or DB',
  inputHashesBefore: before,
  supplementalHashes: Object.fromEntries(sourceNames.map(name => [name, sha(readFileSync(directory + name))])),
  files,
  inputHashesAfter: Object.fromEntries(names.map(name => [name, sha(readFileSync(directory + name))])),
};
assert.deepEqual(manifest.inputHashesAfter, before);
manifest.inputsStable = true;
writeFileSync(directory + 'root-window-02-analysis.json', JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ node: process.version, inputsStable: true, files: files.map(file => ({ name: file.name, lines: file.lines, requests: file.requestCount, methods: file.methodCounts, throws: file.operationThrows.length, cutoff: file.cutoff.phase })) }));
