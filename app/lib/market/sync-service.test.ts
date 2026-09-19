import "fake-indexeddb/auto";

import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  CoverageSegment,
  DailyCandleRecord,
} from "./contracts";
import { syncMarketData } from "./sync-service";
import { expectedTradingDates } from "./calendar";
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
  it("continues after an unavailable historical gap and retains both outcomes", async () => {
    const repo = repository();
    const cachedCandles = expectedTradingDates(
      "CN-SZ",
      "2023-03-08",
      "2026-09-09",
    ).map((tradingDate) => ({
      instrumentId: "CN-SZ:000519",
      tradingDate,
      open: "10",
      high: "11",
      low: "9",
      close: "10.5",
      volume: "1000",
      currency: "CNY",
      provider: "tencent" as const,
      providerSymbol: "sz000519",
      adjustmentMode: "raw" as const,
      fetchedAt: "2026-09-15T00:00:00.000Z",
    }));
    await repo.commitSyncResult({
      instrumentId: "CN-SZ:000519",
      candles: cachedCandles,
      coverage: [{
        startDate: "2023-03-08",
        endDate: "2026-09-09",
        status: "complete",
        provider: "tencent",
        fetchedAt: "2026-09-15T00:00:00.000Z",
        missingTradingDates: [],
      }],
    });
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      const url = new URL(String(input), "http://localhost");
      if (fetcher.mock.calls.length === 1) {
        return Response.json(
          { error: { code: "source-unavailable", message: "历史区间不可用" } },
          { status: 502 },
        );
      }
      return Response.json({
        provider: "tencent",
        providerSymbol: "sz000519",
        fetchedAt: "2026-09-15T00:00:00.000Z",
        adjustmentMode: "raw",
        warnings: [],
        request: {
          instrumentId: "CN-SZ:000519",
          symbol: "000519",
          market: "CN-SZ",
          startDate: url.searchParams.get("start"),
          endDate: url.searchParams.get("end"),
        },
        candles: [{
          tradingDate: "2026-09-10",
          open: "10",
          high: "11",
          low: "9",
          close: "10.5",
          volume: "1000",
        }],
      });
    });

    const result = await syncMarketData({
      instrumentId: "CN-SZ:000519",
      symbol: "000519",
      market: "CN-SZ",
      currency: "CNY",
      required: { startDate: "2023-03-07", endDate: "2026-09-10" },
      repository: repo,
      fetcher,
    });

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(String(fetcher.mock.calls[0]?.[0])).toContain(
      "start=2023-03-07&end=2023-03-07",
    );
    expect(String(fetcher.mock.calls[1]?.[0])).toContain(
      "start=2026-09-10&end=2026-09-10",
    );
    expect(result).toMatchObject({
      source: "network",
      status: "partial",
      error: {
        code: "source-unavailable",
        failedCount: 1,
        failedRanges: [{
          start: "2023-03-07",
          end: "2023-03-07",
          code: "source-unavailable",
        }],
      },
    });
    expect(result.candles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ tradingDate: "2026-09-10" }),
      ]),
    );
    expect(await repo.getCoverage("CN-SZ:000519")).toEqual(expect.arrayContaining([
      expect.objectContaining({
        startDate: "2023-03-07",
        endDate: "2023-03-07",
        status: "partial",
        reason: "source-unavailable",
      }),
      expect.objectContaining({
        startDate: "2026-09-10",
        endDate: "2026-09-10",
        status: "complete",
      }),
    ]));
    expect(await repo.getDailyCandles(
      "CN-SZ:000519",
      "2026-09-10",
      "2026-09-10",
    )).toEqual([expect.objectContaining({ tradingDate: "2026-09-10" })]);

    const retryFetcher = vi.fn<typeof fetch>(async (input, init) => {
      expect(init).toMatchObject({ cache: "no-store" });
      const url = new URL(String(input), "http://localhost");
      expect(url.searchParams.get("start")).toBe("2023-03-07");
      expect(url.searchParams.get("end")).toBe("2023-03-07");
      return Response.json({
        provider: "tencent",
        providerSymbol: "sz000519",
        fetchedAt: "2026-09-15T00:01:00.000Z",
        adjustmentMode: "raw",
        warnings: [],
        request: {
          instrumentId: "CN-SZ:000519",
          symbol: "000519",
          market: "CN-SZ",
          startDate: url.searchParams.get("start"),
          endDate: url.searchParams.get("end"),
        },
        candles: [{
          tradingDate: "2023-03-07",
          open: "10",
          high: "11",
          low: "9",
          close: "10.5",
          volume: "1000",
        }],
      });
    });

    const retried = await syncMarketData({
      instrumentId: "CN-SZ:000519",
      symbol: "000519",
      market: "CN-SZ",
      currency: "CNY",
      required: { startDate: "2023-03-07", endDate: "2026-09-10" },
      repository: repo,
      fetcher: retryFetcher,
      retryUnavailable: true,
    });

    expect(retryFetcher).toHaveBeenCalledTimes(1);
    expect(retried).toMatchObject({
      source: "network",
      status: "complete",
      requestedRanges: [{ startDate: "2023-03-07", endDate: "2023-03-07" }],
    });
    expect(retried).not.toHaveProperty("error");
    expect(retried).not.toHaveProperty("failedRanges");
  });

  it("does not let an old partial segment downgrade a newly complete required range", async () => {
    const repo = repository();
    await repo.commitSyncResult({
      instrumentId: "HK:1810",
      candles: [],
      coverage: [{
        startDate: "2024-01-01",
        endDate: "2024-12-31",
        status: "partial",
        missingTradingDates: ["2024-06-03"],
      }],
    });
    const fetcher = vi.fn<typeof fetch>(async () =>
      Response.json({
        provider: "tencent",
        providerSymbol: "hk01810",
        fetchedAt: "2026-08-31T00:00:00.000Z",
        adjustmentMode: "raw",
        warnings: [],
        request: {
          instrumentId: "HK:1810",
          symbol: "1810",
          market: "HK",
          startDate: "2025-01-02",
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
            high: "35.5",
            low: "34",
            close: "35",
            volume: "1300",
          },
        ],
      }),
    );

    const result = await syncMarketData({
      instrumentId: "HK:1810",
      symbol: "1810",
      market: "HK",
      currency: "HKD",
      required: { startDate: "2025-01-02", endDate: "2025-01-03" },
      repository: repo,
      fetcher,
    });

    expect(result.status).toBe("complete");
  });

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
      message: expect.stringContaining("请稍后再试"),
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
        missingTradingDates: expectedTradingDates("HK", "2024-01-02", "2024-12-31"),
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
        endDate: "2024-01-05",
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
      endDate: "2025-01-02",
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
      required: { startDate: "2025-01-01", endDate: "2025-01-02" },
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

  it("marks a missing contiguous provider tail as latest-available", async () => {
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

    expect(result.status).toBe("latest-available");
    expect(await repo.getCoverage("HK:1810")).toEqual([
      expect.objectContaining({
        status: "partial",
        actualEndDate: "2025-01-02",
        missingTradingDates: ["2025-01-03"],
        reason: "provider-latest-available",
      }),
    ]);
  });

  it("retries a provider-latest tail during an explicit update", async () => {
    const repo = repository();
    await repo.commitSyncResult({
      instrumentId: "HK:1810",
      candles: [candle],
      coverage: [{
        startDate: "2025-01-01",
        endDate: "2025-01-03",
        status: "partial",
        provider: "tencent",
        fetchedAt: "2025-02-01T00:00:00.000Z",
        actualEndDate: "2025-01-02",
        missingTradingDates: ["2025-01-03"],
        reason: "provider-latest-available",
      }],
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
        candles: [{
          tradingDate: "2025-01-03",
          open: "34.5",
          high: "36",
          low: "34",
          close: "35.5",
          volume: "1500",
        }],
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
      retryUnavailable: true,
    });

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(String(fetcher.mock.calls[0][0])).toContain(
      "start=2025-01-03&end=2025-01-03",
    );
    expect(result.status).toBe("complete");
    expect(result.candles).toHaveLength(2);
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

  it("fails fast when parsing raises AbortError without an aborted signal", async () => {
    const repo = repository();
    const response = new Response();
    vi.spyOn(response, "json").mockRejectedValue(
      new DOMException("route body aborted", "AbortError"),
    );
    const fetcher = vi.fn<typeof fetch>(async () => response);

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
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(await repo.getCoverage("HK:1810")).toEqual([]);
  });

  it("accepts a daily response keyed by a historical market-data symbol", async () => {
    const repo = repository();
    const fetcher = vi.fn<typeof fetch>(async () =>
      Response.json({
        provider: "baidu",
        providerSymbol: "META",
        fetchedAt: "2025-02-01T00:00:00.000Z",
        adjustmentMode: "raw",
        warnings: [],
        request: {
          instrumentId: "US:META",
          symbol: "META",
          market: "US",
          startDate: "2025-01-02",
          endDate: "2025-01-02",
        },
        candles: [{
          tradingDate: "2025-01-02",
          open: "10",
          high: "11",
          low: "9",
          close: "10.5",
          volume: "1000",
        }],
      }),
    );

    const result = await syncMarketData({
      instrumentId: "US:FB",
      symbol: "META",
      market: "US",
      currency: "USD",
      required: { startDate: "2025-01-02", endDate: "2025-01-02" },
      repository: repo,
      fetcher,
    });

    expect(result.candles).toHaveLength(1);
    expect(result.candles[0]).toMatchObject({
      instrumentId: "US:FB",
      providerSymbol: "META",
    });
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
