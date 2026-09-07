import "fake-indexeddb/auto";
import { expect, it } from "vitest";
import { IndexedDbMarketDataRepository } from "../storage/indexeddb-market-data-repository";
import { syncMarketData } from "./sync-service";
import { coverageStatusForDateRange, marketDataStatusLabel } from "./sync-status";
import { reconcileDailyCoverage } from "./coverage-tail";

it("does not trust complete metadata when an actual session is absent", () => {
  const range = { startDate: "2026-09-04", endDate: "2026-09-04" };
  const coverage = reconcileDailyCoverage("US", range, [{ ...range, status: "complete", missingTradingDates: [] }], []);
  expect(coverage[0]).toMatchObject({ status: "partial", missingTradingDates: ["2026-09-04"] });
});

it.each(["no-data", "empty"])("preserves a pending tail across %s and fills it on the next update", async mode => {
  const repo = new IndexedDbMarketDataRepository(`tail-${crypto.randomUUID()}`);
  const required = { startDate: "2026-09-03", endDate: "2026-09-04" };
  const candle = { instrumentId: "HK:100", tradingDate: "2026-09-03", open: "1", high: "2", low: "1", close: "2", volume: "100", currency: "HKD", provider: "tiger" as const, providerSymbol: "100", adjustmentMode: "raw" as const, fetchedAt: "2026-09-05T00:00:00Z" };
  await repo.commitSyncResult({ instrumentId: "HK:100", candles: [candle], coverage: [{ ...required, status: "partial", actualEndDate: "2026-09-03", missingTradingDates: ["2026-09-04"], reason: "provider-latest-available" }] });
  const response = (filled: boolean) => Response.json({ provider: "tiger", providerSymbol: "100", fetchedAt: candle.fetchedAt, adjustmentMode: "raw", warnings: [], candles: filled ? [{ ...candle, tradingDate: "2026-09-04" }] : [], request: { instrumentId: "HK:100", symbol: "100", market: "HK", startDate: "2026-09-04", endDate: "2026-09-04" } });
  const options = { instrumentId: "HK:100", symbol: "100", market: "HK" as const, currency: "HKD", required, repository: repo, retryUnavailable: true };
  const pending = await syncMarketData({ ...options, fetcher: async () => mode === "empty" ? response(false) : Response.json({ error: { code: "no-data" } }, { status: 502 }) });
  expect(marketDataStatusLabel(pending.status)).toBe("尾部待补");
  expect(coverageStatusForDateRange(required, await repo.getCoverage("HK:100"))).toBe(pending.status);
  const filled = await syncMarketData({ ...options, fetcher: async () => response(true) });
  expect(filled.status).toBe("complete");
  expect(filled.candles).toHaveLength(2);
});

it("does not hide a middle no-data gap behind a pending tail", () => {
  expect(coverageStatusForDateRange({ startDate: "2026-09-01", endDate: "2026-09-04" }, [
    { startDate: "2026-09-01", endDate: "2026-09-01", status: "partial", missingTradingDates: [], reason: "no-data" },
    { startDate: "2026-09-02", endDate: "2026-09-04", status: "partial", missingTradingDates: ["2026-09-04"], actualEndDate: "2026-09-03", reason: "provider-latest-available" },
  ])).toBe("partial");
});

it("manual refresh retries historical no-data and never converts an outage into absent history", async () => {
  const repo = new IndexedDbMarketDataRepository(`retry-${crypto.randomUUID()}`);
  const required = { startDate: "2026-09-03", endDate: "2026-09-04" };
  const coverage = [{ startDate: "2026-09-03", endDate: "2026-09-03", status: "partial" as const,
    missingTradingDates: [], reason: "no-data" as const },
    { startDate: "2026-09-04", endDate: "2026-09-04", status: "complete" as const, missingTradingDates: [] }];
  await repo.commitSyncResult({ instrumentId: "US:CWEB", coverage, candles: [{ instrumentId: "US:CWEB",
    tradingDate: "2026-09-04", open: "1", high: "2", low: "1", close: "2", volume: "100",
    currency: "USD", provider: "tiger", providerSymbol: "CWEB", adjustmentMode: "raw", fetchedAt: "2026-09-05T00:00:00Z" }] });
  await expect(syncMarketData({ instrumentId: "US:CWEB", symbol: "CWEB", market: "US", currency: "USD",
    required, repository: repo, retryUnavailable: true,
    fetcher: async () => Response.json({ error: { code: "source-unavailable" } }, { status: 502 })
  })).rejects.toMatchObject({ code: "source-unavailable" });
  expect(await repo.getCoverage("US:CWEB")).toEqual(coverage);
});
