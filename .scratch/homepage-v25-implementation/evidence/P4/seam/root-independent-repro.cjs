const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (mod, file) => mod._compile(
  ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText,
  file,
);
const F = require(process.cwd() + '/app/lib/reviews/homepage-v25-performance.ts');
const { buildTradeLibraryEntries } = require(process.cwd() + '/app/lib/trades/library.ts');
const { buildInstrumentTradeSummaries } = require(process.cwd() + '/app/lib/trades/instruments.ts');
const instrument = {
  id: 'US:AAPL', symbol: 'AAPL', name: 'Apple', market: 'US', currency: 'USD',
};
const fill = (id, executedAt, o = {}) => ({
  id, accountId: 'a', accountLabel: 'A', instrument,
  side: 'buy', quantity: '1', price: '100', fee: '2', executedAt,
  ...o,
  source: { platform: 'statement', row: 1, tradeNature: 'live', ...o.source },
});
const entriesFor = xs => buildTradeLibraryEntries(
  buildInstrumentTradeSummaries(xs), {}, {},
);
const sourceFor = entries => F.prepareHomepageV25Source({
  entries, candlesByInstrument: {}, fxObservations: [], currentFxSnapshot: null,
  lifetimeSourceCoverage: [],
  revisions: { trades: 'review-new-1', metadata: 'm', quotes: 'q', fx: 'f' },
});
const read = (xs, entries = entriesFor(xs)) => F.readHomepageV25FinancialFacts(
  sourceFor(entries), { asOf: '2026-01-22T10:00:00Z' },
).groups[0];
{
const xs = [
  fill('next-shanghai-day', '2026-01-05T18:00:00Z', { fee: '10' }),
  fill('coarse-jan5', '2026-01-05', {
    fee: '2',
    source: { timePrecision: 'date-only', tradingDate: '2026-01-05' },
  }),
];
const entries = entriesFor(xs);
const actual = F.readHomepageV25FinancialFacts(
  sourceFor(entries), { asOf: '2026-01-05' },
).groups[0];
const legacy = F.buildHomepageV25PerformanceFromEntries({
  entries, candlesByInstrument: {},
  period: { start: '2026-01-01', end: '2026-01-05' }, asOf: '2026-01-05',
});
console.log(JSON.stringify({id:'ISR-01',selected:actual.canonical.selectedExecutionIds,canonicalFees:actual.canonical.terminal.fees,openFees:actual.openFees,allocations:actual.allocations,legacyOpenFees:legacy.currentOpenFees,diagnostics:actual.diagnostics}));
}
{
const xs = [
  fill('b', '2026-01-05T15:00:00Z', {
    source: { historyIncomplete: ['prior-statement'] },
  }),
  fill('s', '2026-01-06T15:00:00Z', { side: 'sell', price: '110' }),
];
const actual = read(xs);
console.log(JSON.stringify({id:'ISR-02',quantity:actual.quantityCoverage,firstFact:actual.canonical.facts[0],firstAllocation:actual.allocations[0]}));
}
{
const xs = [
  fill('b', '2026-01-05T15:00:00Z'),
  fill('s', '2026-01-06T15:00:00Z', { side: 'sell', price: '110' }),
];
const entries = entriesFor(xs);
// 只损坏 episode 关联，entry.executions 原始 fills 不变。
entries[0].episodes[0].episode.executions = [];
const actual = read(xs, entries);
console.log(JSON.stringify({id:'ISR-03',selected:actual.canonical.selectedExecutionIds,episode:actual.episodeCoverage}));
}
{
const xs = [
  fill('db', '2026-01-05', {
    source: { timePrecision: 'date-only', tradingDate: '2026-01-05' },
  }),
  fill('ds', '2026-01-06', {
    side: 'sell', price: '110',
    source: { timePrecision: 'date-only', tradingDate: '2026-01-06' },
  }),
];
const entries = entriesFor(xs);
// builder 原本给出 closed/long，start Jan5、end Jan6，executions db/ds。
// status、方向、executions、entry 原始 fills 全部保留；只改结束声明。
entries[0].episodes[0].episode.endedAt = '2027-01-06T23:59:59.999Z';
const actual = read(xs, entries);
console.log(JSON.stringify({id:'ISR-04',close:actual.canonical.facts.at(-1).time,episode:actual.episodeCoverage}));
}