import fs from 'node:fs';
import { expect, it } from 'vitest';
import { buildHomepageV25PerformanceFromEntries } from '../../../../../app/lib/reviews/homepage-v25-performance';
import { buildTradeLibraryEntries } from '../../../../../app/lib/trades/library';
import { buildInstrumentTradeSummaries } from '../../../../../app/lib/trades/instruments';
import type { TradeExecution } from '../../../../../app/lib/trades/types';

it('measures real ledger projection cost before a daily-series consumer is built', () => {
  const rows: object[] = [];
  const instrument = { id: 'US:PERF', symbol: 'PERF', name: 'Acceptance scaling', market: 'US', currency: 'USD' };
  for (const size of [20, 100, 200]) {
    const fills: TradeExecution[] = Array.from({ length: size }, (_, i) => ({ id: `scale:${i}`, accountId: 'acceptance', accountLabel: 'Acceptance', instrument,
      side: i % 2 ? 'sell' : 'buy', quantity: '1', price: i % 2 ? '110' : '100', fee: '1', executedAt: new Date(Date.UTC(2026, 0, 2, 1, i)).toISOString(), source: { platform: 'statement', row: i, tradeNature: 'live' } }));
    const entries = buildTradeLibraryEntries(buildInstrumentTradeSummaries(fills), {}, {});
    const start = performance.now();
    const result = buildHomepageV25PerformanceFromEntries({ entries, period: { start: '2026-01-01', end: '2026-01-31' }, asOf: '2026-01-31' });
    const elapsedMs = performance.now() - start;
    rows.push({ size, elapsedMs, net: result.net.value, closedEpisodes: entries.flatMap(e => e.episodes).length });
    expect(result.net.value).toBe(String(size * 4));
    if (elapsedMs > 5000) break;
  }
  fs.writeFileSync('.scratch/homepage-v25-implementation/evidence/resume-2026-10-23/coordinator/F-scaling.json', JSON.stringify(rows, null, 2));
}, 60000);
