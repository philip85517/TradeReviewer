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
  it("preserves the route error code at the daily synchronization boundary", async () => {
    const repo = repository();
    const fetcher = vi.fn<typeof fetch>(async () =>
      Response.json(
        { error: { code: "source-rate-limited", message: "请稍后再试" } },
        { status: 429 },
      ),
    );

    await expect(
      syncMarketData({
        instrumentId: "HK:1810",
        symbol: "1810",
        market: "HK",
        currency: "HKD",
        required: { startDate: "2025-01-01", endDate: "2025-01-03" },
        repository: repo,
        fetcher,
      }),
    ).rejects.toMatchObject({
      code: "source-rate-limited",
      message: "请稍后再试",
    });
  });

  it("persists a no-data daily gap as stable partial coverage", async () => {
    const repo = repository();
    const fetcher = vi.fn<typeof fetch>(async () =>
      Response.json(
        { error: { code: "no-data", message: "该日期没有公开日线行情" } },
        { status: 502 },
      ),
    );

    const first = await syncMarketData({
      instrumentId: "HK:1810",
      symbol: "1810",
      market: "HK",
      currency: "HKD",
      required: { startDate: "2024-01-02", endDate: "2024-01-02" },
      repository: repo,
      fetcher,
    });
    const secondFetcher = vi.fn<typeof fetch>();
    const second = await syncMarketData({
      instrumentId: "HK:1810",
      symbol: "1810",
      market: "HK",
      currency: "HKD",
      required: { startDate: "2024-01-02", endDate: "2024-01-02" },
      repository: repo,
      fetcher: secondFetcher,
    });

    expect(first).toMatchObject({ source: "network", status: "partial" });
    expect(await repo.getCoverage("HK:1810")).toEqual([
      expect.objectContaining({
        startDate: "2024-01-02",
        endDate: "2024-01-02",
        status: "partial",
        missingTradingDates: [],
        reason: "no-data",
      }),
    ]);
    expect(second).toMatchObject({ source: "cache", status: "partial" });
    expect(secondFetcher).not.toHaveBeenCalled();
  });

  it("retries previously unavailable daily gaps when the user requests an update", async () => {
    const repo = repository();
    await repo.commitSyncResult({
      instrumentId: "HK:1810",
      candles: [],
      coverage: [{
        startDate: "2026-04-19",
        endDate: "2026-04-19",
        status: "partial",
        reason: "no-data",
        missingTradingDates: [],
      }],
    });
    const fetcher = vi.fn<typeof fetch>(async () =>
      Response.json({
        provider: "baidu",
        providerSymbol: "01810",
        fetchedAt: "2026-08-31T00:00:00.000Z",
        adjustmentMode: "raw",
        warnings: [],
        request: {
          instrumentId: "HK:1810",
          symbol: "1810",
          market: "HK",
          startDate: "2026-04-19",
          endDate: "2026-04-19",
        },
        candles: [{
          tradingDate: "2026-04-19",
          open: "100",
          high: "101",
          low: "99",
          close: "100.5",
          volume: "1200",
        }],
      }),
    );

    const result = await syncMarketData({
      instrumentId: "HK:1810",
      symbol: "1810",
      market: "HK",
      currency: "HKD",
      required: { startDate: "2026-04-19", endDate: "2026-04-19" },
      repository: repo,
      fetcher,
      retryUnavailable: true,
    });

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result.status).toBe("complete");
    expect(result.candles).toHaveLength(1);
  });

  it("stabilizes an unavailable historical gap before the first known candle", async () => {
    const repo = repository();
    await repo.commitSyncResult({
      instrumentId: "HK:1810",
      candles: [candle],
      coverage: [{
        startDate: "2024-01-02",
        endDate: "2025-01-02",
        status: "partial",
        provider: "tencent",
        fetchedAt: "2025-02-01T00:00:00.000Z",
        missingTradingDates: ["2024-01-02"],
      }],
      providerSymbol: { provider: "tencent", symbol: "hk01810" },
    });
    const fetcher = vi.fn<typeof fetch>(async () =>
      Response.json(
        { error: { code: "source-unavailable", message: "其他行情源暂不可用" } },
        { status: 502 },
      ),
    );

    const first = await syncMarketData({
      instrumentId: "HK:1810",
      symbol: "1810",
      market: "HK",
      currency: "HKD",
      required: { startDate: "2024-01-02", endDate: "2025-01-02" },
      repository: repo,
      fetcher,
    });
    const secondFetcher = vi.fn<typeof fetch>();
    const second = await syncMarketData({
      instrumentId: "HK:1810",
      symbol: "1810",
      market: "HK",
      currency: "HKD",
      required: { startDate: "2024-01-02", endDate: "2025-01-02" },
      repository: repo,
      fetcher: secondFetcher,
    });

    expect(first.status).toBe("partial");
    expect(fetcher).not.toHaveBeenCalled();
    expect(await repo.getCoverage("HK:1810")).toContainEqual(
      expect.objectContaining({
        startDate: "2024-01-02",
        endDate: "2024-01-02",
        status: "partial",
        missingTradingDates: [],
        reason: "no-data",
      }),
    );
    expect(second).toMatchObject({ source: "cache", status: "partial" });
    expect(secondFetcher).not.toHaveBeenCalled();
  });

  it("stabilizes a known missing historical gap after the last known candle without network", async () => {
    const repo = repository();
    await repo.commitSyncResult({
      instrumentId: "HK:1810",
      candles: [candle],
      coverage: [
        {
          startDate: "2025-01-01",
          endDate: "2025-01-02",
          status: "complete",
          provider: "tencent",
          fetchedAt: "2025-02-01T00:00:00.000Z",
          missingTradingDates: [],
        },
        {
          startDate: "2025-01-03",
          endDate: "2025-01-03",
          status: "partial",
          fetchedAt: "2025-02-01T00:00:00.000Z",
          missingTradingDates: [],
          reason: "no-data",
        },
        {
          startDate: "2025-01-04",
          endDate: "2025-01-04",
          status: "partial",
          provider: "tencent",
          fetchedAt: "2025-02-01T00:00:00.000Z",
          missingTradingDates: ["2025-01-04"],
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
      required: { startDate: "2025-01-01", endDate: "2025-01-04" },
      repository: repo,
      fetcher,
    });

    expect(result.status).toBe("partial");
    expect(fetcher).not.toHaveBeenCalled();
    expect(await repo.getCoverage("HK:1810")).toContainEqual(
      expect.objectContaining({
        startDate: "2025-01-04",
        endDate: "2025-01-04",
        status: "partial",
        missingTradingDates: [],
        reason: "no-data",
      }),
    );
  });

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
        request: {
          instrumentId: "HK:1810",
          symbol: "1810",
          market: "HK",
          startDate: "2025-01-01",
          endDate: "2025-01-03",
        },
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
    const requestUrl = new URL(
      String(fetcher.mock.calls[0][0]),
      "http://localhost",
    );
    expect([...requestUrl.searchParams.keys()].sort()).toEqual([
      "end",
      "market",
      "start",
      "symbol",
    ]);
    expect(fetcher.mock.calls[0][1]).toEqual({ signal: undefined });
    expect(fetcher.mock.calls[0][1]).not.toHaveProperty("body");
    expect(fetcher.mock.calls[0][1]).not.toHaveProperty("method");
    expect(second.source).toBe("cache");
    expect(secondFetcher).not.toHaveBeenCalled();
  });

  it("persists Tiger daily candles and avoids duplicate writes on a cache-only resync", async () => {
    const repo = repository();
    const commitSpy = vi.spyOn(repo, "commitSyncResult");
    const fetcher = vi.fn<typeof fetch>(async () =>
      Response.json({
        provider: "tiger",
        providerSymbol: "AAPL",
        fetchedAt: "2026-08-31T00:00:00.000Z",
        adjustmentMode: "raw",
        warnings: [],
        request: {
          instrumentId: "US:AAPL",
          symbol: "AAPL",
          market: "US",
          startDate: "2025-01-02",
          endDate: "2025-01-03",
        },
        candles: [
          {
            tradingDate: "2025-01-02",
            open: "100",
            high: "101",
            low: "99",
            close: "100.5",
            volume: "1200",
          },
          {
            tradingDate: "2025-01-03",
            open: "101",
            high: "102",
            low: "100",
            close: "101.5",
            volume: "1300",
          },
        ],
      }),
    );

    const first = await syncMarketData({
      instrumentId: "US:AAPL",
      symbol: "AAPL",
      market: "US",
      currency: "USD",
      required: { startDate: "2025-01-02", endDate: "2025-01-03" },
      repository: repo,
      fetcher,
    });
    const secondFetcher = vi.fn<typeof fetch>();
    const second = await syncMarketData({
      instrumentId: "US:AAPL",
      symbol: "AAPL",
      market: "US",
      currency: "USD",
      required: { startDate: "2025-01-02", endDate: "2025-01-03" },
      repository: repo,
      fetcher: secondFetcher,
    });

    expect(first).toMatchObject({ source: "network", status: "complete" });
    expect(commitSpy).toHaveBeenCalledTimes(1);
    expect(commitSpy).toHaveBeenCalledWith({
      instrumentId: "US:AAPL",
      candles: [
        expect.objectContaining({
          instrumentId: "US:AAPL",
          tradingDate: "2025-01-02",
          close: "100.5",
          currency: "USD",
          provider: "tiger",
          providerSymbol: "AAPL",
          adjustmentMode: "raw",
          fetchedAt: "2026-08-31T00:00:00.000Z",
        }),
        expect.objectContaining({
          instrumentId: "US:AAPL",
          tradingDate: "2025-01-03",
          provider: "tiger",
          providerSymbol: "AAPL",
        }),
      ],
      coverage: [
        expect.objectContaining({
          startDate: "2025-01-02",
          endDate: "2025-01-03",
          status: "complete",
          provider: "tiger",
          fetchedAt: "2026-08-31T00:00:00.000Z",
          missingTradingDates: [],
        }),
      ],
      providerSymbol: { provider: "tiger", symbol: "AAPL" },
    });
    expect(await repo.getDailyCandles("US:AAPL", "2025-01-02", "2025-01-03")).toEqual([
      expect.objectContaining({ provider: "tiger", providerSymbol: "AAPL" }),
      expect.objectContaining({ provider: "tiger", providerSymbol: "AAPL" }),
    ]);
    expect(await repo.getCoverage("US:AAPL")).toEqual([
      expect.objectContaining({ provider: "tiger", status: "complete" }),
    ]);
    expect(await repo.getProviderSymbol("US:AAPL", "tiger")).toBe("AAPL");
    expect(second).toMatchObject({ source: "cache", status: "complete" });
    expect(secondFetcher).not.toHaveBeenCalled();
    expect(commitSpy).toHaveBeenCalledTimes(1);
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
        request: {
          instrumentId: "HK:1810",
          symbol: "1810",
          market: "HK",
          startDate: "2025-01-01",
          endDate: "2025-01-03",
        },
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
        request: {
          instrumentId: "HK:1810",
          symbol: "1810",
          market: "HK",
          startDate: "2025-01-03",
          endDate: "2025-01-03",
        },
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
        request: {
          instrumentId: "HK:1810",
          symbol: "1810",
          market: "HK",
          startDate: "2025-01-02",
          endDate: "2025-01-02",
        },
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

  it("rejects a response for a different daily instrument before persistence", async () => {
    const repo = repository();
    const fetcher = vi.fn<typeof fetch>(async () =>
      Response.json({
        provider: "tencent",
        providerSymbol: "hk09999",
        fetchedAt: "2025-02-01T00:00:00.000Z",
        adjustmentMode: "raw",
        warnings: [],
        request: {
          instrumentId: "HK:9999",
          symbol: "9999",
          market: "HK",
          startDate: "2025-01-02",
          endDate: "2025-01-02",
        },
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

    await expect(
      syncMarketData({
        instrumentId: "HK:1810",
        symbol: "1810",
        market: "HK",
        currency: "HKD",
        required: { startDate: "2025-01-02", endDate: "2025-01-02" },
        repository: repo,
        fetcher,
      }),
    ).rejects.toThrow("行情接口响应标的不匹配");
    expect(await repo.getCoverage("HK:1810")).toEqual([]);
  });

  it("rejects a daily route response without echoed request identity", async () => {
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

    await expect(
      syncMarketData({
        instrumentId: "HK:1810",
        symbol: "1810",
        market: "HK",
        currency: "HKD",
        required: { startDate: "2025-01-02", endDate: "2025-01-02" },
        repository: repo,
        fetcher,
      }),
    ).rejects.toThrow("行情接口响应标的不匹配");
  });
});
