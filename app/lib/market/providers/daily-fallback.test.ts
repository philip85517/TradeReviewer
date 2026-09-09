import { expect, it, vi } from "vitest";
import type { MarketDataProvider, ProviderResult } from "../contracts";
import { fetchDailyWithCoverage } from "./daily-fallback";

it("fills the missing session from a backup and preserves per-bar provenance", async () => {
  const result = (provider: "tiger" | "tencent", date: string): ProviderResult => ({
    provider, providerSymbol: "100", fetchedAt: "2026-09-05T00:00:00Z", warnings: [],
    candles: [{ tradingDate: date, open: "1", high: "2", low: "1", close: "2", volume: "100" }],
  });
  const tiger: MarketDataProvider = { id: "tiger", supports: () => true, fetchDaily: vi.fn(async () => result("tiger", "2026-09-03")), fetchIntraday: vi.fn() };
  const tencent: MarketDataProvider = { id: "tencent", supports: () => true, fetchDaily: vi.fn(async () => result("tencent", "2026-09-04")), fetchIntraday: vi.fn() };
  const request = { instrumentId: "HK:100", symbol: "100", market: "HK" as const, startDate: "2026-09-03", endDate: "2026-09-04" };
  const actual = await fetchDailyWithCoverage([tiger, tencent], request, fetch);
  expect(tencent.fetchDaily).toHaveBeenCalledWith({ ...request, startDate: "2026-09-04" }, expect.any(Function));
  expect(actual.candles.map(c => c.tradingDate)).toEqual(["2026-09-03", "2026-09-04"]);
  expect(actual.candleSources?.["2026-09-04"].provider).toBe("tencent");
});
