import { writeFileSync } from "node:fs";
import { expect, it } from "vitest";
import { buildInstrumentTradeSummaries } from "../../../../../../app/lib/trades/instruments";
import { buildTradeLibraryEntries } from "../../../../../../app/lib/trades/library";
import type { TradeExecution } from "../../../../../../app/lib/trades/types";
import type { DailyCandleRecord, SupportedMarket } from "../../../../../../app/lib/market/contracts";
import { requiredMarketDataRange } from "../../../../../../app/lib/market/sync-range";
import { dailyRecordToChartCandle } from "../../../../../../app/lib/market/types";
import { buildHomepageV25PerformanceFromEntries } from "../../../../../../app/lib/reviews/homepage-v25-performance";
import { buildHomepageHoldings } from "../../../../../../app/components/homepage-v25/holdings-model";

const cases: { market: SupportedMarket; currency: string; asOf: string; expectedDate: string; expectedPrice: string; scopeMarket: "us" | "hk" | "a" }[] = [
  { market: "US", currency: "USD", asOf: "2026-10-22T17:30:00.000Z", expectedDate: "2026-10-21", expectedPrice: "110", scopeMarket: "us" },
  { market: "CN-SH", currency: "CNY", asOf: "2026-10-22T08:30:00.000Z", expectedDate: "2026-10-22", expectedPrice: "999", scopeMarket: "a" },
  { market: "HK", currency: "HKD", asOf: "2026-10-22T08:30:00.000Z", expectedDate: "2026-10-22", expectedPrice: "999", scopeMarket: "hk" },
];

for (const scenario of cases) it(`${scenario.market}: F and P1 must select the completed exchange session`, () => {
  const instrument = { id: `${scenario.market}:CUTOFF`, symbol: "CUTOFF", name: "Synthetic cutoff probe", market: scenario.market, currency: scenario.currency };
  const fill: TradeExecution = { id: "known-buy", accountId: "synthetic", accountLabel: "synthetic", instrument, side: "buy", executedAt: "2026-10-20T02:00:00.000Z", quantity: "1", price: "100", fee: "2", source: { platform: "futu", row: 1, tradeNature: "live" } };
  const entries = buildTradeLibraryEntries(buildInstrumentTradeSummaries([fill]), {}, {});
  const candles: DailyCandleRecord[] = ["2026-10-20", "2026-10-21", "2026-10-22"].map((tradingDate, index) => {
    const price = ["100", "110", "999"][index];
    const closeAt = dailyRecordToChartCandle({ instrumentId: instrument.id, tradingDate, open: price, high: price, low: price, close: price, volume: "1", currency: scenario.currency, provider: "tencent", providerSymbol: "CUTOFF", adjustmentMode: "raw", fetchedAt: "2026-10-23T00:01:00.000Z" }).knowledgeAt!;
    return { instrumentId: instrument.id, tradingDate, open: price, high: price, low: price, close: price, volume: "1", currency: scenario.currency, provider: "tencent", providerSymbol: "CUTOFF", adjustmentMode: "raw", fetchedAt: closeAt };
  });
  const candlesByInstrument = { [instrument.id]: candles };
  const range = requiredMarketDataRange(fill.executedAt, fill.executedAt, { market: scenario.market, open: true, now: new Date(scenario.asOf) });
  const current = buildHomepageV25PerformanceFromEntries({ entries, candlesByInstrument, asOf: scenario.asOf, period: { start: "2026-10-20", end: "2026-10-23" } });
  const p1 = buildHomepageHoldings(entries, { asOf: scenario.asOf, candlesByInstrument, scope: { live: true, market: scenario.scopeMarket, accounts: ["*"], rangeMode: "all" } });
  const actual = { scenario, input: { fill, candles, asOf: scenario.asOf }, completedSession: range.endDate, chartKnowledgeAt: candles.map(candle => ({ date: candle.tradingDate, knowledgeAt: dailyRecordToChartCandle(candle).knowledgeAt })), current: { marketValue: current.currentMarketValue.value, unrealized: current.currentUnrealized.value, quote: current.instruments[0].evidence.current.quote }, p1: { marketValue: p1.rows[0]?.marketValue, unrealized: p1.rows[0]?.reportPnl, quote: p1.rows[0]?.quote, financialEvidence: p1.rows[0]?.financialEvidence } };
  writeFileSync(`.scratch/homepage-v25-implementation/evidence/resume-2026-10-23/F-data-prep/session-fix/traces/session-cutoff-${scenario.market}.json`, JSON.stringify(actual, null, 2) + "\n");
  expect(range.endDate).toBe(scenario.expectedDate);
  expect(current.instruments[0].evidence.current.quote?.date).toBe(range.endDate);
  expect(current.currentMarketValue.value).toBe(scenario.expectedPrice);
  expect(p1.rows[0]?.quote?.quoteDate).toBe(range.endDate);
});
