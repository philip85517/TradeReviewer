import { expect, it } from "vitest";
import { buildInstrumentTradeSummaries } from "@/app/lib/trades/instruments";
import { buildTradeLibraryEntries } from "@/app/lib/trades/library";
import type { TradeExecution } from "@/app/lib/trades/types";
import type { DailyCandleRecord } from "@/app/lib/market/contracts";
import { prepareHomepageV25Source } from "@/app/lib/reviews/homepage-v25-performance";
import { buildHomepageV25Series } from "@/app/lib/reviews/homepage-v25-series";

// Independent literal counterexample only. No production, frozen test, or policy edits.
const usd = { id: "US:AAPL", symbol: "AAPL", name: "Apple", market: "US", currency: "USD" };
const hkd = { id: "HK:00005", symbol: "00005", name: "HSBC", market: "HK", currency: "HKD" };
const fill = (id: string, instrument: typeof usd, executedAt: string): TradeExecution => ({
  id, accountId: "a", accountLabel: "A", instrument, side: "buy", quantity: "1", price: "100", fee: "0", executedAt,
  source: { platform: "statement", row: 1, tradeNature: "live" },
});
const quote = (tradingDate: string, close: string): DailyCandleRecord => ({
  instrumentId: usd.id, tradingDate, open: close, high: close, low: close, close, volume: "1", currency: "USD",
  adjustmentMode: "raw", provider: "eastmoney", providerSymbol: "AAPL", fetchedAt: `${tradingDate}T23:00:00Z`,
});
const snapshot = {
  id: "current-usd-fx", source: "broker", asOf: "2026-02-02T00:00:00Z", baseCurrency: "CNY" as const,
  status: "complete" as const, rates: { "USD/CNY": "7" },
};
function project(includeFutureHkd: boolean) {
  const executions = [fill("usd-buy", usd, "2026-01-05T15:00:00Z")];
  if (includeFutureHkd) executions.push(fill("hkd-future-buy", hkd, "2026-03-05T05:00:00Z"));
  const candlesByInstrument = { [usd.id]: [quote("2026-01-28", "110"), quote("2026-01-29", "110"), quote("2026-01-30", "120")] };
  const entries = buildTradeLibraryEntries(buildInstrumentTradeSummaries(executions), candlesByInstrument, { [usd.id]: "ready", [hkd.id]: "ready" });
  const source = prepareHomepageV25Source({
    entries, candlesByInstrument, lifetimeSourceCoverage: [],
    fxObservations: [{
      id: "historical-usd-fx", source: "broker-history", sourceRevision: "f1", businessDate: "2026-01-30",
      rates: { "USD/CNY": "7" }, status: "complete", evidenceIds: ["history-fetch"],
      publishedAtByPair: { "USD/CNY": "2026-01-30T00:00:00Z" },
      knownAtByPair: { "USD/CNY": "2026-01-30T00:00:00Z" }, fetchedAt: "2026-01-30T00:00:00Z",
    }],
    currentFxSnapshot: {
      snapshot, sourceRevision: "f1", fetchedAt: "2026-02-02T00:01:00Z", evidenceIds: ["current-fetch"],
      publishedAtByPair: { "USD/CNY": "2026-02-02T00:00:00Z" },
    },
    revisions: { trades: "t1", metadata: "m1", quotes: "q1", fx: "f1" },
  });
  return buildHomepageV25Series(source, {
    period: { start: "2026-01-30", end: "2026-01-30" },
    asOf: "2026-02-02T10:00:00Z", targetCurrency: "CNY", requestGeneration: "independent-future-currency",
  });
}

it("a future-only HKD group cannot erase an eligible USD group's historical/current conversion", () => {
  const control = project(false);
  const withFuture = project(true);
  const point = withFuture.points[0];
  // Jan30 Shanghai day-end precedes the US close; both opening and endpoint mark110.
  // Consequently selected Jan30 net0, endpoint market110*7=770, current120*7=840, currentUF20*7=140.
  const expected = ["0", "770", "840", "140"];
  const values = (bundle: typeof control) => [bundle.points[0].net.value, bundle.points[0].marketValue.value,
    bundle.current.currentMarketValue.value, bundle.current.currentUnrealized.value];
  expect(values(control)).toEqual(expected);
  expect(point.marketValue.money.originalByCurrency).toEqual({ USD: "110" });
  expect(withFuture.current.currentMarketValue.money.originalByCurrency).toEqual({ USD: "120" });
  expect(point.instruments.find(item => item.identity.instrumentId === hkd.id)?.evidence.endpoint.executionIds).toEqual([]);
  console.log(JSON.stringify({ expected, control: values(control), withFuture: values(withFuture),
    endpointFx: point.fxCoverage, currentFx: withFuture.current.fxCoverage }, null, 2));
  expect(values(withFuture)).toEqual(expected);
});
