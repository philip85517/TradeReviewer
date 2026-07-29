import "fake-indexeddb/auto";

import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  IntervalCoverageSegment,
  MarketCandleRecord,
} from "./contracts";
import {
  splitIntradayRequestRange,
  syncIntradayMarketData,
} from "./intraday-sync-service";
import { resolveTimeframeAvailability } from "./availability";
import { IndexedDbMarketDataRepository } from "../storage/indexeddb-market-data-repository";

const databases: string[] = [];

function repository() {
  const name = `trade-reviewer-intraday-sync-${crypto.randomUUID()}`;
  databases.push(name);
  return new IndexedDbMarketDataRepository(name);
}

const candle: MarketCandleRecord = {
  instrumentId: "HK:1810",
  interval: "15m",
  timestamp: "2025-01-02T02:30:00.000Z",
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

const completeCoverage: IntervalCoverageSegment = {
  interval: "15m",
  requestedStart: "2025-01-01T00:00:00.000Z",
  requestedEnd: "2025-01-31T23:59:59.999Z",
  actualStart: candle.timestamp,
  actualEnd: candle.timestamp,
  status: "complete",
  provider: "tencent",
  fetchedAt: "2025-02-01T00:00:00.000Z",
};

function intradayResponse(candles = [candle]) {
  return Response.json({
    provider: "tencent",
    providerSymbol: "hk01810",
    fetchedAt: "2025-02-01T00:00:00.000Z",
    interval: "15m",
    adjustmentMode: "raw",
    warnings: [],
    candles: candles.map((record) => ({
      timestamp: record.timestamp,
      open: record.open,
      high: record.high,
      low: record.low,
      close: record.close,
      volume: record.volume,
    })),
  });
}

function syncOptions(repo: IndexedDbMarketDataRepository, fetcher: typeof fetch, signal?: AbortSignal) {
  return {
    instrumentId: "HK:1810",
    symbol: "1810",
    market: "HK" as const,
    currency: "HKD",
    required: {
      startTime: "2025-01-02T02:00:00.000Z",
      endTime: "2025-01-02T03:00:00.000Z",
    },
    repository: repo,
    fetcher,
    signal,
  };
}

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

describe("splitIntradayRequestRange", () => {
  it("splits inclusive intraday requests into at most 60-day chunks", () => {
    expect(
      splitIntradayRequestRange({
        startTime: "2025-01-01T00:00:00.000Z",
        endTime: "2025-05-01T00:00:00.000Z",
      }),
    ).toEqual([
      {
        startTime: "2025-01-01T00:00:00.000Z",
        endTime: "2025-03-01T23:59:59.999Z",
      },
      {
        startTime: "2025-03-02T00:00:00.000Z",
        endTime: "2025-04-30T23:59:59.999Z",
      },
      {
        startTime: "2025-05-01T00:00:00.000Z",
        endTime: "2025-05-01T00:00:00.000Z",
      },
    ]);
  });
});

describe("syncIntradayMarketData", () => {
  it("does not request the network for complete cached 15m coverage", async () => {
    const repo = repository();
    await repo.commitIntervalSyncResult({
      instrumentId: "HK:1810",
      interval: "15m",
      candles: [candle],
      coverage: [completeCoverage],
      providerSymbol: { provider: "tencent", symbol: "hk01810" },
    });
    const fetcher = vi.fn<typeof fetch>();

    const result = await syncIntradayMarketData({
      instrumentId: "HK:1810",
      symbol: "1810",
      market: "HK",
      currency: "HKD",
      required: {
        startTime: "2025-01-01T00:00:00.000Z",
        endTime: "2025-01-31T23:59:59.999Z",
      },
      repository: repo,
      fetcher,
    });

    expect(result.source).toBe("cache");
    expect(result.candles).toEqual([candle]);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("returns existing candles when the provider is unavailable", async () => {
    const repo = repository();
    await repo.commitIntervalSyncResult({
      instrumentId: "HK:1810",
      interval: "15m",
      candles: [candle],
      coverage: [],
      providerSymbol: { provider: "tencent", symbol: "hk01810" },
    });
    const fetcher = vi.fn<typeof fetch>(async () =>
      Response.json(
        { error: { code: "source-unavailable", message: "temporary outage" } },
        { status: 502 },
      ),
    );

    const result = await syncIntradayMarketData(syncOptions(repo, fetcher));

    expect(result).toMatchObject({
      source: "network",
      status: "source-unavailable",
      candles: [candle],
    });
  });

  it("does not commit a response after its signal is aborted", async () => {
    const repo = repository();
    const controller = new AbortController();
    const fetcher = vi.fn<typeof fetch>(async () => {
      controller.abort();
      return intradayResponse();
    });

    await expect(
      syncIntradayMarketData(syncOptions(repo, fetcher, controller.signal)),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(
      await repo.getCandles(
        "HK:1810",
        "15m",
        "2025-01-02T02:00:00.000Z",
        "2025-01-02T03:00:00.000Z",
      ),
    ).toEqual([]);
    expect(await repo.getIntervalCoverage("HK:1810", "15m")).toEqual([]);
  });

  it("records a provider history limit as stable partial coverage", async () => {
    const repo = repository();
    const fetcher = vi.fn<typeof fetch>(async () =>
      Response.json(
        {
          error: {
            code: "provider-history-limit",
            message: "provider does not retain this range",
          },
        },
        { status: 502 },
      ),
    );

    const result = await syncIntradayMarketData(syncOptions(repo, fetcher));

    expect(result.status).toBe("partial");
    expect(result.coverage).toEqual([
      expect.objectContaining({
        status: "partial",
        reason: "provider-history-limit",
      }),
    ]);
    expect(
      resolveTimeframeAvailability({
        intradayCandles: result.candles,
        dailyCandles: [],
        intradayCoverage: result.coverage,
      })["15m"],
    ).toEqual({
      enabled: false,
      reason: "公开行情源未覆盖该交易日期的 15 分钟行情",
    });
  });

  it("uses the cached result after a successful intraday sync", async () => {
    const repo = repository();
    const fetcher = vi.fn<typeof fetch>(async () => intradayResponse());
    const first = await syncIntradayMarketData(syncOptions(repo, fetcher));
    const cachedFetcher = vi.fn<typeof fetch>();
    const second = await syncIntradayMarketData(
      syncOptions(repo, cachedFetcher),
    );

    expect(first).toMatchObject({ source: "network", status: "complete" });
    expect(first.coverage).toEqual([
      expect.objectContaining({
        requestedStart: "2025-01-02T02:00:00.000Z",
        requestedEnd: "2025-01-02T03:00:00.000Z",
        actualStart: candle.timestamp,
        actualEnd: candle.timestamp,
      }),
    ]);
    expect(second).toMatchObject({ source: "cache", candles: [candle] });
    expect(cachedFetcher).not.toHaveBeenCalled();
  });
});
