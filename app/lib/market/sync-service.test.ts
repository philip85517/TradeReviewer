import "fake-indexeddb/auto";

import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  CoverageSegment,
  DailyCandleRecord,
} from "./contracts";
import { syncMarketData } from "./sync-service";
import { IndexedDbMarketDataRepository } from "../storage/indexeddb-market-data-repository";

const databases: string[] = [];

function repository() {
  const name = `trade-reviewer-sync-${crypto.randomUUID()}`;
  databases.push(name);
  return new IndexedDbMarketDataRepository(name);
}

const candle: DailyCandleRecord = {
  instrumentId: "HK:1810",
  tradingDate: "2025-01-02",
  open: "34.1",
  high: "35",
  low: "33.8",
  close: "34.5",
  volume: "1200",
  currency: "HKD",
  provider: "tencent",
  providerSymbol: "hk01810",
  adjustmentMode: "raw",
  fetchedAt: "2025-02-01T00:00:00.000Z",
};

afterEach(async () => {
  await Promise.all(
    databases.splice(0).map(
      (name) =>
        new Promise<void>((resolve, reject) => {
          const request = indexedDB.deleteDatabase(name);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        }),
    ),
  );
});

describe("syncMarketData", () => {
  it("performs zero network requests on a complete cache hit", async () => {
    const repo = repository();
    const coverage: CoverageSegment = {
      startDate: "2025-01-01",
      endDate: "2025-01-31",
      status: "complete",
      provider: "tencent",
      fetchedAt: "2025-02-01T00:00:00.000Z",
      missingTradingDates: [],
    };
    await repo.commitSyncResult({
      instrumentId: "HK:1810",
      candles: [candle],
      coverage: [coverage],
      providerSymbol: { provider: "tencent", symbol: "hk01810" },
    });
    const fetcher = vi.fn<typeof fetch>();

    const result = await syncMarketData({
      instrumentId: "HK:1810",
      symbol: "1810",
      market: "HK",
      currency: "HKD",
      required: { startDate: "2025-01-01", endDate: "2025-01-31" },
      repository: repo,
      fetcher,
    });

    expect(result.source).toBe("cache");
    expect(result.candles).toEqual([candle]);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("requests only a missing range and persists it for the next load", async () => {
    const repo = repository();
    const fetcher = vi.fn<typeof fetch>(async () =>
      Response.json({
        provider: "tencent",
        providerSymbol: "hk01810",
        fetchedAt: "2025-02-01T00:00:00.000Z",
        adjustmentMode: "raw",
        warnings: [],
        candles: [
          {
            tradingDate: "2025-01-02",
            open: "34.1",
            high: "35",
            low: "33.8",
            close: "34.5",
            volume: "1200",
          },
          {
            tradingDate: "2025-01-03",
            open: "34.5",
            high: "36",
            low: "34",
            close: "35.5",
            volume: "1500",
          },
        ],
      }),
    );

    const first = await syncMarketData({
      instrumentId: "HK:1810",
      symbol: "1810",
      market: "HK",
      currency: "HKD",
      required: { startDate: "2025-01-01", endDate: "2025-01-03" },
      repository: repo,
      fetcher,
    });
    const secondFetcher = vi.fn<typeof fetch>();
    const second = await syncMarketData({
      instrumentId: "HK:1810",
      symbol: "1810",
      market: "HK",
      currency: "HKD",
      required: { startDate: "2025-01-01", endDate: "2025-01-03" },
      repository: repo,
      fetcher: secondFetcher,
    });

    expect(first.source).toBe("network");
    expect(String(fetcher.mock.calls[0][0])).toContain(
      "market=HK&symbol=1810&start=2025-01-01&end=2025-01-03",
    );
    expect(second.source).toBe("cache");
    expect(secondFetcher).not.toHaveBeenCalled();
  });

  it("keeps coverage partial when a provider omits an expected trading day", async () => {
    const repo = repository();
    const fetcher = vi.fn<typeof fetch>(async () =>
      Response.json({
        provider: "tencent",
        providerSymbol: "hk01810",
        fetchedAt: "2025-02-01T00:00:00.000Z",
        adjustmentMode: "raw",
        warnings: [],
        candles: [
          {
            tradingDate: "2025-01-02",
            open: "34.1",
            high: "35",
            low: "33.8",
            close: "34.5",
            volume: "1200",
          },
        ],
      }),
    );

    const result = await syncMarketData({
      instrumentId: "HK:1810",
      symbol: "1810",
      market: "HK",
      currency: "HKD",
      required: { startDate: "2025-01-01", endDate: "2025-01-03" },
      repository: repo,
      fetcher,
    });

    expect(result.status).toBe("partial");
    expect(await repo.getCoverage("HK:1810")).toEqual([
      expect.objectContaining({
        status: "partial",
        missingTradingDates: ["2025-01-03"],
      }),
    ]);
  });

  it("preserves surrounding coverage after filling one missing day", async () => {
    const repo = repository();
    await repo.commitSyncResult({
      instrumentId: "HK:1810",
      candles: [candle],
      coverage: [
        {
          startDate: "2025-01-01",
          endDate: "2025-01-03",
          status: "partial",
          provider: "tencent",
          fetchedAt: "2025-02-01T00:00:00.000Z",
          missingTradingDates: ["2025-01-03"],
        },
      ],
      providerSymbol: { provider: "tencent", symbol: "hk01810" },
    });
    const fetcher = vi.fn<typeof fetch>(async () =>
      Response.json({
        provider: "tencent",
        providerSymbol: "hk01810",
        fetchedAt: "2025-02-02T00:00:00.000Z",
        adjustmentMode: "raw",
        warnings: [],
        candles: [
          {
            tradingDate: "2025-01-03",
            open: "34.5",
            high: "36",
            low: "34",
            close: "35.5",
            volume: "1500",
          },
        ],
      }),
    );

    const first = await syncMarketData({
      instrumentId: "HK:1810",
      symbol: "1810",
      market: "HK",
      currency: "HKD",
      required: { startDate: "2025-01-01", endDate: "2025-01-03" },
      repository: repo,
      fetcher,
    });
    const secondFetcher = vi.fn<typeof fetch>();
    const second = await syncMarketData({
      instrumentId: "HK:1810",
      symbol: "1810",
      market: "HK",
      currency: "HKD",
      required: { startDate: "2025-01-01", endDate: "2025-01-03" },
      repository: repo,
      fetcher: secondFetcher,
    });

    expect(first.status).toBe("complete");
    expect(second.status).toBe("complete");
    expect(second.source).toBe("cache");
    expect(secondFetcher).not.toHaveBeenCalled();
  });

  it("keeps calendar-out-of-range cache coverage partial", async () => {
    const repo = repository();
    await repo.commitSyncResult({
      instrumentId: "HK:1810",
      candles: [candle],
      coverage: [
        {
          startDate: "2031-01-01",
          endDate: "2031-01-31",
          status: "partial",
          provider: "tencent",
          fetchedAt: "2031-02-01T00:00:00.000Z",
          missingTradingDates: [],
          reason: "calendar-out-of-range",
        },
      ],
      providerSymbol: { provider: "tencent", symbol: "hk01810" },
    });
    const fetcher = vi.fn<typeof fetch>();

    const result = await syncMarketData({
      instrumentId: "HK:1810",
      symbol: "1810",
      market: "HK",
      currency: "HKD",
      required: { startDate: "2031-01-01", endDate: "2031-01-31" },
      repository: repo,
      fetcher,
    });

    expect(result.source).toBe("cache");
    expect(result.status).toBe("partial");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("does not commit a response after its abort signal is cancelled", async () => {
    const repo = repository();
    const controller = new AbortController();
    const fetcher = vi.fn<typeof fetch>(async () => {
      controller.abort();
      return Response.json({
        provider: "tencent",
        providerSymbol: "hk01810",
        fetchedAt: "2025-02-01T00:00:00.000Z",
        adjustmentMode: "raw",
        warnings: [],
        candles: [
          {
            tradingDate: "2025-01-02",
            open: "34.1",
            high: "35",
            low: "33.8",
            close: "34.5",
            volume: "1200",
          },
        ],
      });
    });

    await expect(
      syncMarketData({
        instrumentId: "HK:1810",
        symbol: "1810",
        market: "HK",
        currency: "HKD",
        required: { startDate: "2025-01-02", endDate: "2025-01-02" },
        repository: repo,
        fetcher,
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(await repo.getCoverage("HK:1810")).toEqual([]);
  });
});
