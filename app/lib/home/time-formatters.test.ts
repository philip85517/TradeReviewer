import {afterEach, expect, it, vi} from 'vitest';
import type {TradeExecution} from '../trades/types';

afterEach(() => vi.restoreAllMocks());
function countFormatters() {
  const Original = Intl.DateTimeFormat;
  return vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(function (
    locales?: Intl.LocalesArgument, options?: Intl.DateTimeFormatOptions,
  ) { return new Original(locales, options); });
}

it('reuses market formatters while preserving summer, winter and cross-zone times', async () => {
  vi.resetModules();
  const calls = countFormatters();
  const {marketLocalTimestampToIso, utcIsoToMarketLocal} = await import('../market/providers/errors');
  for (let i = 0; i < 20; i++) {
    expect(marketLocalTimestampToIso('2025-07-01 16:00:00', 'America/New_York')).toBe('2025-07-01T20:00:00.000Z');
    expect(marketLocalTimestampToIso('2025-01-02 16:00:00', 'America/New_York')).toBe('2025-01-02T21:00:00.000Z');
    expect(utcIsoToMarketLocal('2025-01-02T16:30:00.000Z', 'Asia/Shanghai')).toBe('2025-01-03 00:30:00');
  }
  expect(calls).toHaveBeenCalledTimes(2);
  expect(() => utcIsoToMarketLocal('not-a-date', 'Asia/Shanghai')).toThrow();
  expect(() => utcIsoToMarketLocal('2025-01-02T00:00:00Z', 'invalid/zone')).toThrow();
});

it('reuses source-zone formatters without caching mutable execution results', async () => {
  vi.resetModules();
  const calls = countFormatters();
  const {replayExecutionAt} = await import('../import/statement-evidence');
  const execution: TradeExecution = {
    id: 'date-only', accountId: 'a', accountLabel: 'a',
    instrument: {id: 'US:A', market: 'US', symbol: 'A', name: 'A', currency: 'USD'},
    source: {platform: 'manual', row: 1, timePrecision: 'date-only', sourceTimezone: 'America/New_York'},
    executedAt: '2025-01-02T04:30:00.000Z', side: 'buy', quantity: '1', price: '1', fee: '0',
  };
  for (let i = 0; i < 20; i++) {
    execution.executedAt = '2025-01-02T04:30:00.000Z';
    expect(replayExecutionAt(execution)).toBe('2025-01-01T23:59:59.999Z');
    execution.executedAt = '2025-07-02T04:30:00.000Z';
    expect(replayExecutionAt(execution)).toBe('2025-07-02T23:59:59.999Z');
    execution.source.sourceTimezone = 'Asia/Shanghai';
    expect(replayExecutionAt(execution)).toBe('2025-07-02T23:59:59.999Z');
    execution.source.sourceTimezone = 'America/New_York';
  }
  expect(calls).toHaveBeenCalledTimes(2);
  execution.source.sourceTimezone = 'invalid/zone';
  expect(replayExecutionAt(execution)).toBe('2025-07-02T23:59:59.999Z');
  execution.source.marketCalendarDate = '2025-07-03';
  expect(replayExecutionAt(execution)).toBe('2025-07-03T23:59:59.999Z');
});
