const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const ts = require('typescript');
const root = process.cwd();
const evidence = path.join(root, '.scratch/homepage-v25-implementation/evidence/P4/seam');
let baseline = true;
const inputs = new Map([
  ['app/lib/replay/position-ledger.ts', 'input-position-ledger.ts'],
  ['app/lib/reviews/homepage-v25-performance.ts', 'input-homepage-v25-performance.ts'],
].map(([file, snapshot]) => [path.join(root, file), path.join(evidence, snapshot)]));
require.extensions['.ts'] = (module, filename) => {
  const code = fs.readFileSync(baseline && inputs.has(filename) ? inputs.get(filename) : filename, 'utf8');
  module._compile(ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename);
};
const usd = { id: 'US:AAPL', symbol: 'AAPL', name: 'Apple', market: 'US', currency: 'USD' };
const fill = (id, day, overrides = {}) => ({ id, accountId: 'a', accountLabel: 'A', instrument: usd, side: 'buy', quantity: '1', price: '100', fee: '0', executedAt: `${day}T15:00:00Z`, ...overrides, source: { platform: 'statement', row: 1, tradeNature: 'live', ...overrides.source } });
const common = { accountId: 'a', market: 'US', symbol: 'AAPL', currency: 'USD', source: [{ page: 1, row: 2 }] };
const events = [
  { ...common, id: 'application', kind: 'ipo', date: '2026-01-08', amount: '-220', description: 'IPO application' },
  { ...common, id: 'fee', kind: 'fee', date: '2026-01-08', amount: '-2', description: 'IPO fee' },
  { ...common, id: 'allocation', kind: 'ipo', date: '2026-01-10', quantity: '2', displayTimePolicy: 'session-open', description: 'IPO allocation' },
  { ...common, id: 'refund', kind: 'ipo', date: '2026-01-20', amount: '20', description: 'IPO refund' },
];
const cases = [
  ['cumulative', [fill('b1', '2026-01-05', { fee: '2' }), fill('b2', '2026-01-06', { price: '200', fee: '4' }), fill('s1', '2026-01-07', { side: 'sell', price: '180', fee: '2' }), fill('s2', '2026-01-08', { side: 'sell', price: '190', fee: '2' })]],
  ['reverse', [fill('buy', '2026-01-05', { fee: '2' }), fill('reverse', '2026-01-06', { side: 'sell', quantity: '2', price: '120', fee: '4', source: { positionEffect: 'open-short' } }), fill('cover', '2026-01-07', { price: '110', fee: '1', source: { positionEffect: 'close-short' } })]],
  ['late-ipo', [fill('sale1', '2026-01-15', { side: 'sell', price: '120', fee: '1', source: { positionEvents: events } }), fill('sale2', '2026-01-16', { side: 'sell', price: '130', fee: '1' })]],
  ['future-currency', [fill('buy', '2026-01-05'), fill('future', '2026-02-10', { instrument: { id: 'HK:00700', symbol: '00700', name: 'Tencent', market: 'HK', currency: 'HKD' } })]],
];
const quotes = ['2025-12-31', '2026-01-02', '2026-01-09', '2026-01-15', '2026-01-16', '2026-01-22'].map((tradingDate, index) => ({ instrumentId: usd.id, tradingDate, open: String(100 + index * 10), high: String(100 + index * 10), low: String(100 + index * 10), close: String(100 + index * 10), volume: '1', currency: 'USD', adjustmentMode: 'raw', provider: 'eastmoney', providerSymbol: 'AAPL', fetchedAt: `${tradingDate}T23:00:00Z` }));
function run() {
  const f = require(path.join(root, 'app/lib/reviews/homepage-v25-performance.ts'));
  const ledger = require(path.join(root, 'app/lib/replay/position-ledger.ts'));
  const { buildTradeLibraryEntries } = require(path.join(root, 'app/lib/trades/library.ts'));
  const { buildInstrumentTradeSummaries } = require(path.join(root, 'app/lib/trades/instruments.ts'));
  return cases.map(([name, executions]) => {
    const entries = buildTradeLibraryEntries(buildInstrumentTradeSummaries(structuredClone(executions)), { 'US:AAPL': quotes }, { 'US:AAPL': 'ready' });
    const source = f.prepareHomepageV25Source({ entries, candlesByInstrument: { 'US:AAPL': quotes }, fxObservations: ['2025-12-31', '2026-01-16', '2026-01-22'].map(businessDate => ({ id: `fx-${businessDate}`, source: 'history', sourceRevision: 'f1', businessDate, rates: { 'USD/CNY': '7' }, status: 'complete', publishedAtByPair: { 'USD/CNY': `${businessDate}T00:00:00Z` }, knownAtByPair: { 'USD/CNY': `${businessDate}T00:00:00Z` }, fetchedAt: `${businessDate}T00:00:00Z`, evidenceIds: ['fx'] })), currentFxSnapshot: null, lifetimeSourceCoverage: [{ accountId: 'a', instrumentId: 'US:AAPL', nature: 'live', simulationRunId: null, state: 'complete', coversInception: true, through: '2026-02-12T00:00:00Z', knownAt: '2025-01-01T00:00:00Z', evidenceIds: ['complete'], reasons: [] }], revisions: { trades: 't1', metadata: 'm1', quotes: 'q1', fx: 'f1' } });
    const initial = f.inspectHomepageV25PreparedSource(source);
    const batches = ['2026-01-18T18:00:00Z', '2026-01-22T18:00:00Z'].map(asOf => {
      const request = { periodStart: '2026-01-01', asOf, endpoints: [{ key: 'partial', at: '2026-01-07' }, { key: 'closed', at: '2026-01-16' }], targetCurrency: 'CNY' };
      const result = f.projectHomepageV25Boundaries(source, request);
      assert.deepEqual(f.projectHomepageV25Boundaries(source, request), result);
      return result;
    });
    const beforeFacts = f.inspectHomepageV25PreparedSource(source);
    if (!baseline) {
      f.readHomepageV25FinancialFacts(source, { asOf: '2026-01-18T18:00:00Z', targetCurrency: 'CNY' });
      f.readHomepageV25FinancialFacts(source, { asOf: '2026-01-22T18:00:00Z', targetCurrency: 'CNY' });
      assert.deepEqual(f.inspectHomepageV25PreparedSource(source), beforeFacts);
    }
    const wrappers = ['2026-01-07', '2026-01-18', '2026-01-22'].map(cursor => ledger.replayPositionAtPrice({ executions: structuredClone(executions), cursor, markPrice: '140' }));
    return { name, initial, batches, after: beforeFacts, wrappers };
  });
}
const accepted = run();
for (const name of Object.keys(require.cache)) if (name.startsWith(path.join(root, 'app') + path.sep)) delete require.cache[name];
baseline = false;
const candidate = run();
assert.deepEqual(candidate, accepted);
const bytes = JSON.stringify(candidate);
console.log(JSON.stringify({ status: 'PASS', cases: cases.map(([name]) => name), batches: 8, wrappers: 12, fullPublicJsonBytes: Buffer.byteLength(bytes), fullPublicSha256: crypto.createHash('sha256').update(bytes).digest('hex'), compared: ['every legacy wrapper field', 'complete A public result including reasons/coverage/FX/diagnostics', 'initial and retained source/index/cache counters', 'cached repeat public result'], explicitFactsRetainedGrowth: 0, baselineSources: Object.fromEntries([...inputs.entries()].map(([file, snapshot]) => [path.relative(root, file), crypto.createHash('sha256').update(fs.readFileSync(snapshot)).digest('hex')])) }, null, 2));
