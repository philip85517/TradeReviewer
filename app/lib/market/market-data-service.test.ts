import { beforeEach, describe, expect, it, vi } from "vitest";
import { refreshMarketData, type MarketDataRefreshRequest } from "./market-data-service";
import { MarketDataSyncError } from "./sync-service";
import type { MarketDataRepository } from "../storage/market-data-repository";

const { syncMarketData, syncIntradayMarketDataForRanges } = vi.hoisted(() => ({
  syncMarketData: vi.fn(),
  syncIntradayMarketDataForRanges: vi.fn(),
}));
vi.mock("./sync-service", () => ({
  syncMarketData,
  MarketDataSyncError: class MarketDataSyncError extends Error {
    code: string;
    failedRanges: Array<{ start: string; end: string; code: string; message: string }>;
    constructor(code = "source-unavailable", message = "failure", failedRanges = []) {
      super(message);
      this.code = code;
      this.failedRanges = failedRanges;
    }
  },
}));
vi.mock("./intraday-sync-service", () => ({ syncIntradayMarketDataForRanges }));

const recordMeta = { currency: "USD", provider: "yahoo" as const, providerSymbol: "ABC", adjustmentMode: "raw" as const, fetchedAt: "2024-01-02T00:00:00.000Z" };
const daily = [{ tradingDate: "2024-01-02", instrumentId: "US:ABC", open: "1", high: "2", low: "1", close: "2", volume: "3", ...recordMeta }];
const hourly = [{ timestamp: "2024-01-02T14:30:00.000Z", instrumentId: "US:ABC", interval: "1h" as const, open: "1", high: "2", low: "1", close: "2", volume: "3", ...recordMeta }];
const legacy15m = [{ ...hourly[0], interval: "15m" as const }];
const repository = (): MarketDataRepository => ({
  getCoverage: vi.fn().mockResolvedValue([]),
  getCandles: vi.fn().mockResolvedValue([]),
  getIntervalCoverage: vi.fn().mockResolvedValue([]),
  getDailyCandles: vi.fn().mockResolvedValue([]),
  getProviderSymbol: vi.fn().mockResolvedValue(undefined),
  commitSyncResult: vi.fn().mockResolvedValue(undefined),
  commitIntervalSyncResult: vi.fn().mockResolvedValue(undefined),
});
const request = (overrides: Partial<MarketDataRefreshRequest> = {}) => ({
  instrumentId: "US:ABC", symbol: "ABC", market: "US" as const, currency: "USD",
  dailyRange: { startDate: "2024-01-02", endDate: "2024-01-02" },
  hourlyRanges: [{ startTime: "2024-01-02T14:30:00.000Z", endTime: "2024-01-02T15:30:00.000Z" }],
  repository: repository(),
  previous: { daily: [], dailyCoverage: [], intraday: [], intradayCoverage: [], intradayInterval: "15m" as const },
  ...overrides,
}) satisfies MarketDataRefreshRequest;

describe("refreshMarketData", () => {
  beforeEach(() => vi.clearAllMocks());
  it("orchestrates both intervals and retains legacy 15m when hourly is empty", async () => {
    syncMarketData.mockResolvedValue({ source: "network", status: "complete", candles: daily, requestedRanges: [] });
    syncIntradayMarketDataForRanges.mockResolvedValue({ source: "network", status: "partial", candles: [], coverage: [], requestedRanges: [] });
    const previous = request({ previous: { daily: [], dailyCoverage: [], intraday: legacy15m, intradayCoverage: [], intradayInterval: "15m" } });
    const result = await refreshMarketData(previous);
    expect(result.daily.candles).toEqual(daily);
    expect(result.hourly.candles).toEqual(legacy15m);
    expect(result.hourly.retainedPrevious).toBe(true);
    expect(result.hourly.interval).toBe("15m");
  });

  it("keeps daily bars when coverage read fails and isolates hourly success", async () => {
    syncMarketData.mockResolvedValue({ source: "network", status: "complete", candles: daily, requestedRanges: [] });
    syncIntradayMarketDataForRanges.mockResolvedValue({ source: "network", status: "complete", candles: hourly, coverage: [], requestedRanges: [] });
    const failingRepository = repository();
    failingRepository.getCoverage = vi.fn().mockRejectedValue(new Error("disk"));
    const priorCoverage = [{ startDate: "2024-01-01", endDate: "2024-01-02", status: "complete" as const, missingTradingDates: [] }];
    const result = await refreshMarketData(request({ repository: failingRepository, previous: { daily: [], dailyCoverage: priorCoverage, intraday: [], intradayCoverage: [], intradayInterval: "15m" } }));
    expect(result.daily.candles).toEqual(daily);
    expect(result.daily.coverage).toEqual(priorCoverage);
    expect(result.daily.status).toBe("storage-error");
    expect(result.hourly.candles).toEqual(hourly);
    expect(result.hourly.status).toBe("complete");
  });

  it("rejects an already aborted request without publishing an outcome", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(refreshMarketData(request({ signal: controller.signal }))).rejects.toMatchObject({ name: "AbortError" });
    expect(syncMarketData).not.toHaveBeenCalled();
  });

  it("propagates child cancellation and does not return a partial result", async () => {
    syncMarketData.mockRejectedValue(new DOMException("cancel", "AbortError"));
    syncIntradayMarketDataForRanges.mockResolvedValue({ source: "cache", status: "complete", candles: hourly, coverage: [], requestedRanges: [] });
    await expect(refreshMarketData(request())).rejects.toMatchObject({ name: "AbortError" });
  });

  it("retains cached candles when one interval fails", async () => {
    syncMarketData.mockRejectedValue(new Error("daily down"));
    syncIntradayMarketDataForRanges.mockResolvedValue({ source: "network", status: "complete", candles: hourly, coverage: [], requestedRanges: [] });
    const result = await refreshMarketData(request({ previous: { daily, dailyCoverage: [], intraday: [], intradayCoverage: [], intradayInterval: "1h" } }));
    expect(result.daily.candles).toEqual(daily);
    expect(result.daily.retainedPrevious).toBe(true);
    expect(result.hourly.candles).toEqual(hourly);
  });

  it("retains daily success when hourly refresh rejects", async () => {
    syncMarketData.mockResolvedValue({ source: "network", status: "complete", candles: daily, requestedRanges: [] });
    syncIntradayMarketDataForRanges.mockRejectedValue(new Error("hourly down"));
    const result = await refreshMarketData(request({ previous: { daily: [], dailyCoverage: [], intraday: hourly, intradayCoverage: [], intradayInterval: "1h" } }));
    expect(result.daily.candles).toEqual(daily);
    expect(result.daily.status).toBe("complete");
    expect(result.hourly.candles).toEqual(hourly);
    expect(result.hourly.retainedPrevious).toBe(true);
  });

  it("preserves failed range diagnostics from a daily sync exception", async () => {
    const failedRanges = [{ start: "2024-01-02", end: "2024-01-02", code: "source-unavailable", message: "down" }];
    syncMarketData.mockRejectedValue(new MarketDataSyncError("source-unavailable", "down", failedRanges));
    syncIntradayMarketDataForRanges.mockResolvedValue({ source: "cache", status: "complete", candles: hourly, coverage: [], requestedRanges: [] });
    const result = await refreshMarketData(request());
    expect(result.daily.refreshError?.failedRanges).toEqual(failedRanges);
    expect(result.daily.refreshError?.failedCount).toBe(1);
  });

  it("normalizes non-abort DOMException failures as storage errors", async () => {
    syncMarketData.mockRejectedValue(new DOMException("disk", "NotReadableError"));
    syncIntradayMarketDataForRanges.mockRejectedValue(new DOMException("disk", "NotReadableError"));
    const result = await refreshMarketData(request({ previous: { daily: [], dailyCoverage: [], intraday: hourly, intradayCoverage: [], intradayInterval: "1h" } }));
    expect(result.daily.status).toBe("storage-error");
    expect(result.daily.refreshError?.code).toBe("storage-error");
    expect(result.hourly.status).toBe("storage-error");
    expect(result.hourly.refreshError?.code).toBe("storage-error");
  });

  it("delegates an empty hourly range list unchanged and preserves the input snapshot", async () => {
    syncMarketData.mockResolvedValue({ source: "cache", status: "complete", candles: daily, requestedRanges: [] });
    syncIntradayMarketDataForRanges.mockResolvedValue({ source: "cache", status: "not-requested", candles: [], coverage: [], requestedRanges: [] });
    const previous = { daily, dailyCoverage: [], intraday: hourly, intradayCoverage: [], intradayInterval: "15m" as const };
    const before = structuredClone(previous);
    await refreshMarketData(request({ hourlyRanges: [], previous }));
    expect(syncIntradayMarketDataForRanges).toHaveBeenCalledWith(expect.objectContaining({ requiredRanges: [] }));
    expect(previous).toEqual(before);
  });

  it("keeps partial diagnostics separate from the displayed status", async () => {
    syncMarketData.mockResolvedValue({ source: "network", status: "partial", candles: daily, requestedRanges: [], error: { code: "no-data", message: "gap", failedCount: 1, failedRanges: [] } });
    syncIntradayMarketDataForRanges.mockResolvedValue({ source: "cache", status: "complete", candles: hourly, coverage: [], requestedRanges: [] });
    const result = await refreshMarketData(request());
    expect(result.daily.status).toBe("partial");
    expect(result.daily.error?.failedCount).toBe(1);
    expect(result.daily.retainedPrevious).toBe(false);
  });

  it("keeps provider partial error and coverage-read error independently", async () => {
    syncMarketData.mockResolvedValue({ source: "network", status: "partial", candles: daily, requestedRanges: [], error: { code: "no-data", message: "gap", failedCount: 1, failedRanges: [] } });
    syncIntradayMarketDataForRanges.mockResolvedValue({ source: "cache", status: "complete", candles: hourly, coverage: [], requestedRanges: [] });
    const failingRepository = repository();
    failingRepository.getCoverage = vi.fn().mockRejectedValue(new Error("disk"));
    const result = await refreshMarketData(request({ repository: failingRepository }));
    expect(result.daily.status).toBe("storage-error");
    expect(result.daily.error?.code).toBe("no-data");
    expect(result.daily.refreshErrorSource).toBe("coverage-read");
    expect(result.daily.refreshError?.code).toBe("storage-error");
  });

  it("treats an abort while reading coverage as cancellation", async () => {
    syncMarketData.mockResolvedValue({ source: "network", status: "complete", candles: daily, requestedRanges: [] });
    syncIntradayMarketDataForRanges.mockResolvedValue({ source: "cache", status: "complete", candles: hourly, coverage: [], requestedRanges: [] });
    const abortingRepository = repository();
    abortingRepository.getCoverage = vi.fn().mockRejectedValue(new DOMException("cancel", "AbortError"));
    await expect(refreshMarketData(request({ repository: abortingRepository }))).rejects.toMatchObject({ name: "AbortError" });
  });

  it("does not publish when the signal aborts during a delayed coverage read", async () => {
    let releaseCoverage!: () => void;
    const coveragePending = new Promise<never>((resolve) => { releaseCoverage = () => resolve([] as never); });
    syncMarketData.mockResolvedValue({ source: "network", status: "complete", candles: daily, requestedRanges: [] });
    syncIntradayMarketDataForRanges.mockResolvedValue({ source: "cache", status: "complete", candles: hourly, coverage: [], requestedRanges: [] });
    const delayedRepository = repository();
    delayedRepository.getCoverage = vi.fn().mockReturnValue(coveragePending);
    const controller = new AbortController();
    const pending = refreshMarketData(request({ repository: delayedRepository, signal: controller.signal }));
    await Promise.resolve();
    controller.abort();
    releaseCoverage();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  });
});
