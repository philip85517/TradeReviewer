import { describe, expect, it, vi } from "vitest";
import type { MarketDataRepository } from "../storage/market-data-repository";
import type { CoverageSegment, DailyCandleRecord, IntervalCoverageSegment, MarketCandleRecord } from "./contracts";
import { refreshMarketData } from "./market-data-service";

function cachedRepository(): MarketDataRepository {
  const daily: DailyCandleRecord[] = [{
    instrumentId: "US:ABC", tradingDate: "2024-01-02", open: "1", high: "2", low: "1", close: "2", volume: "3",
    currency: "USD", provider: "yahoo", providerSymbol: "ABC", adjustmentMode: "raw", fetchedAt: "2024-01-02T00:00:00.000Z",
  }];
  const hourly: MarketCandleRecord[] = [{
    instrumentId: "US:ABC", interval: "1h", timestamp: "2024-01-02T14:30:00.000Z", open: "1", high: "2", low: "1", close: "2", volume: "3",
    currency: "USD", provider: "yahoo", providerSymbol: "ABC", adjustmentMode: "raw", fetchedAt: "2024-01-02T00:00:00.000Z",
  }];
  const dailyCoverage: CoverageSegment[] = [{ startDate: "2024-01-02", endDate: "2024-01-02", status: "complete", missingTradingDates: [] }];
  const hourlyCoverage: IntervalCoverageSegment[] = [{ interval: "1h", requestedStart: "2024-01-02T14:30:00.000Z", requestedEnd: "2024-01-02T15:30:00.000Z", status: "complete" }];
  return {
    getDailyCandles: vi.fn().mockResolvedValue(daily), getCoverage: vi.fn().mockResolvedValue(dailyCoverage),
    getCandles: vi.fn().mockResolvedValue(hourly), getIntervalCoverage: vi.fn().mockResolvedValue(hourlyCoverage),
    getProviderSymbol: vi.fn().mockResolvedValue(undefined), commitSyncResult: vi.fn(), commitIntervalSyncResult: vi.fn(),
  };
}

describe("refreshMarketData cache integration", () => {
  it("uses complete cached coverage through both real synchronizers without fetching", async () => {
    const repository = cachedRepository();
    const fetcher = vi.fn().mockRejectedValue(new Error("network should not be used"));
    const result = await refreshMarketData({
      instrumentId: "US:ABC", symbol: "ABC", market: "US", currency: "USD",
      dailyRange: { startDate: "2024-01-02", endDate: "2024-01-02" },
      hourlyRanges: [{ startTime: "2024-01-02T14:30:00.000Z", endTime: "2024-01-02T15:30:00.000Z" }],
      repository, fetcher,
      previous: { daily: [], dailyCoverage: [], intraday: [], intradayCoverage: [], intradayInterval: "1h" },
    });
    expect(result.daily.source).toBe("cache");
    expect(result.hourly.source).toBe("cache");
    expect(result.daily.candles).toHaveLength(1);
    expect(result.hourly.candles).toHaveLength(1);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
