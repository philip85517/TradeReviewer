import { DatabaseSync } from "node:sqlite";
import { writeFileSync } from "node:fs";
import { expect, it } from "vitest";
import { SqliteStore } from "../../../../../app/lib/storage/sqlite-store";
import { buildInstrumentTradeSummaries } from "../../../../../app/lib/trades/instruments";
import { buildTradeLibraryEntries } from "../../../../../app/lib/trades/library";
import { buildHomepageV25PerformanceFromEntries } from "../../../../../app/lib/reviews/homepage-v25-performance";
import { tradeNatureOf } from "../../../../../app/lib/trades/types";
import type { DailyCandleRecord } from "../../../../../app/lib/market/contracts";

it("summarizes live market and current fee coverage from read-only isolated SQLite", () => {
  const database = new DatabaseSync(".data/tradereview-test.sqlite", { readOnly: true });
  try {
    const store = new SqliteStore(database);
    const bootstrap = store.getBootstrap();
    const allCandles = store.getDailyCandles();
    const candlesByInstrument: Record<string, DailyCandleRecord[]> = {};
    for (const candle of allCandles) (candlesByInstrument[candle.instrumentId] ??= []).push(candle);
    const entries = buildTradeLibraryEntries(buildInstrumentTradeSummaries(bootstrap.executions), candlesByInstrument, {});
    const asOf = "2026-10-23T05:00:00.000Z";
    const output = buildHomepageV25PerformanceFromEntries({ entries, candlesByInstrument, period: { start: "2026-01-01", end: "2026-10-23" }, asOf });
    const byMarket: Record<string, { liveFills: number; validFeeFills: number; nonzeroFeeFills: number; groups: number; currentMetricGroups: number; marketValueAvailable: number; unrealizedAvailable: number; feeAvailable: number; quantityKnown: number; costKnown: number; feesKnown: number; quotePresent: number; quoteDates: Record<string, number>; reasons: Record<string, number> }> = {};
    const get = (market: string) => byMarket[market] ??= { liveFills: 0, validFeeFills: 0, nonzeroFeeFills: 0, groups: 0, currentMetricGroups: 0, marketValueAvailable: 0, unrealizedAvailable: 0, feeAvailable: 0, quantityKnown: 0, costKnown: 0, feesKnown: 0, quotePresent: 0, quoteDates: {}, reasons: {} };
    const markets = new Map(bootstrap.executions.map(fill => [fill.instrument.id, fill.instrument.market]));
    for (const fill of bootstrap.executions.filter(fill => tradeNatureOf(fill) === "live")) {
      const item = get(fill.instrument.market); item.liveFills++;
      if (typeof fill.fee === "string" && fill.fee.trim() && Number.isFinite(Number(fill.fee)) && Number(fill.fee) >= 0) { item.validFeeFills++; if (Number(fill.fee) > 0) item.nonzeroFeeFills++; }
    }
    for (const group of output.instruments) {
      const item = get(markets.get(group.identity.instrumentId) ?? "unknown"); item.groups++;
      const evidence = group.evidence.current;
      if (group.currentMarketValue.coverage.total > 0) {
        item.currentMetricGroups++;
        if (group.currentMarketValue.available) item.marketValueAvailable++;
        if (group.currentUnrealized.available) item.unrealizedAvailable++;
        if (group.currentOpenFees.available) item.feeAvailable++;
        if (evidence.quantity !== null) item.quantityKnown++;
        if (evidence.costKnown) item.costKnown++;
        if (evidence.feesKnown) item.feesKnown++;
        if (evidence.quote) { item.quotePresent++; item.quoteDates[evidence.quote.date] = (item.quoteDates[evidence.quote.date] ?? 0) + 1; }
        for (const reason of new Set([...group.currentMarketValue.reasons, ...group.currentUnrealized.reasons, ...group.currentOpenFees.reasons])) item.reasons[reason] = (item.reasons[reason] ?? 0) + 1;
      }
    }
    writeFileSync(".scratch/homepage-v25-implementation/evidence/resume-2026-10-23/F-data-prep/market-fee-coverage.json", JSON.stringify({ request: { asOf, nature: "default live", fx: "not supplied; per-group original currency coverage" }, scope: output.scope, byMarket, total: { sourceFills: bootstrap.executions.length, groups: output.instruments.length, currentMarketValue: output.currentMarketValue.coverage, currentUnrealized: output.currentUnrealized.coverage, currentOpenFees: output.currentOpenFees.coverage }, note: "Combined isolated backup contains original 1866 non-live fills and 83 live seed fills. No nature was inferred or changed. Fee validity counts only source top-level fields; F feeKnown/feeAvailable are the authoritative lineage-aware result. Aggregate group counts, not identities, trades or money values. Quote availability describes the frozen selector, not completed-session correctness." }, null, 2) + "\n");
    expect(output.scope.includedExecutions).toBe(83);
    expect(output.scope.excludedExecutions).toBe(1866);
  } finally { database.close(); }
}, 180_000);
