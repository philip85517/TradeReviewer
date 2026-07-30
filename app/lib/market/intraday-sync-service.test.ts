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
    request: {
      instrumentId: "HK:1810",
      symbol: "1810",
      market: "HK",
      interval: "15m",
      startTime: "2025-01-02T02:00:00.000Z",
      endTime: "2025-01-02T03:00:00.000Z",
    },
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
  it("splits inclusive intraday requests into provider-safe sub-500-bar chunks", () => {
    const chunks = splitIntradayRequestRange({
        startTime: "2025-01-01T00:00:00.000Z",
        endTime: "2025-05-01T00:00:00.000Z",
      });

    expect(chunks).toHaveLength(9);
    expect(chunks[0]).toEqual({
      startTime: "2025-01-01T00:00:00.000Z",
      endTime: "2025-01-14T23:59:59.999Z",
    });
    expect(chunks.at(-1)).toEqual({
      startTime: "2025-04-23T00:00:00.000Z",
      endTime: "2025-05-01T00:00:00.000Z",
    });
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

  it.each([
    {
      label: "invalid response",
      expected: "invalid-response",
      response: () => Response.json({ changed: "shape" }),
    },
    {
      label: "rate limit",
      expected: "source-rate-limited",
      response: () =>
        Response.json(
          { error: { code: "source-rate-limited" } },
          { status: 429 },
        ),
    },
    {
      label: "access refusal",
      expected: "source-forbidden",
      response: () =>
        Response.json(
          { error: { code: "source-forbidden" } },
          { status: 403 },
        ),
    },
  ] as const)(
    "preserves $label identity at the synchronization boundary",
    async ({ expected, response }) => {
      const repo = repository();
      const result = await syncIntradayMarketData(
        syncOptions(repo, vi.fn<typeof fetch>(async () => response())),
      );

      expect(result.status).toBe(expected);
    },
  );

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
      await repo.getProviderSymbol("HK:1810", "tencent"),
    ).toBeUndefined();
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

  it("preserves complete coverage when a history-limit refresh overlaps it", async () => {
    const repo = repository();
    const confirmedCoverage: IntervalCoverageSegment = {
      ...completeCoverage,
      requestedStart: "2025-01-01T00:00:00.000Z",
      requestedEnd: "2025-03-31T23:59:59.999Z",
    };
    await repo.commitIntervalSyncResult({
      instrumentId: "HK:1810",
      interval: "15m",
      candles: [candle],
      coverage: [confirmedCoverage],
      providerSymbol: { provider: "tencent", symbol: "hk01810" },
    });
    const historyLimitFetcher = vi.fn<typeof fetch>(async () =>
      Response.json(
        { error: { code: "provider-history-limit" } },
        { status: 502 },
      ),
    );

    const refreshed = await syncIntradayMarketData({
      instrumentId: "HK:1810",
      symbol: "1810",
      market: "HK",
      currency: "HKD",
      required: {
        startTime: "2025-02-01T00:00:00.000Z",
        endTime: "2025-04-30T23:59:59.999Z",
      },
      repository: repo,
      fetcher: historyLimitFetcher,
    });

    expect(refreshed.requestedRanges).toEqual([
      {
        startTime: "2025-04-01T00:00:00.000Z",
        endTime: "2025-04-14T23:59:59.999Z",
      },
      {
        startTime: "2025-04-15T00:00:00.000Z",
        endTime: "2025-04-28T23:59:59.999Z",
      },
      {
        startTime: "2025-04-29T00:00:00.000Z",
        endTime: "2025-04-30T23:59:59.999Z",
      },
    ]);
    expect(refreshed.coverage).toEqual(
      expect.arrayContaining([
        confirmedCoverage,
        expect.objectContaining({
          status: "partial",
          requestedStart: "2025-04-01T00:00:00.000Z",
          requestedEnd: "2025-04-14T23:59:59.999Z",
          reason: "provider-history-limit",
        }),
      ]),
    );
    expect(
      refreshed.coverage.filter((segment) => segment.status === "partial"),
    ).toHaveLength(3);

    const cacheOnlyFetcher = vi.fn<typeof fetch>();
    const cached = await syncIntradayMarketData({
      instrumentId: "HK:1810",
      symbol: "1810",
      market: "HK",
      currency: "HKD",
      required: {
        startTime: "2025-02-01T00:00:00.000Z",
        endTime: "2025-03-31T23:59:59.999Z",
      },
      repository: repo,
      fetcher: cacheOnlyFetcher,
    });

    expect(cached).toMatchObject({ source: "cache", status: "complete" });
    expect(cacheOnlyFetcher).not.toHaveBeenCalled();
  });

  it("keeps a sparse session response partial and retries only its missing ranges", async () => {
    const repo = repository();
    const fetcher = vi.fn<typeof fetch>(async () => intradayResponse());
    const first = await syncIntradayMarketData(syncOptions(repo, fetcher));
    const missingFetcher = vi.fn<typeof fetch>(async (input) => {
      const url = new URL(String(input), "http://localhost");
      return Response.json({
        provider: "tencent",
        providerSymbol: "hk01810",
        fetchedAt: "2025-02-01T00:00:00.000Z",
        interval: "15m",
        adjustmentMode: "raw",
        warnings: [],
        request: {
          instrumentId: "HK:1810",
          symbol: "1810",
          market: "HK",
          interval: "15m",
          startTime: url.searchParams.get("start"),
          endTime: url.searchParams.get("end"),
        },
        candles: [],
      });
    });
    const second = await syncIntradayMarketData(
      syncOptions(repo, missingFetcher),
    );
    const cachedFetcher = vi.fn<typeof fetch>();
    const third = await syncIntradayMarketData(
      syncOptions(repo, cachedFetcher),
    );

    expect(first).toMatchObject({ source: "network", status: "partial" });
    expect(first.coverage).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          requestedStart: candle.timestamp,
          requestedEnd: candle.timestamp,
          status: "complete",
        }),
        expect.objectContaining({
          requestedStart: "2025-01-02T02:00:00.000Z",
          requestedEnd: "2025-01-02T03:00:00.000Z",
          status: "partial",
          reason: "missing-candles",
        }),
      ]),
    );
    expect(second.requestedRanges).toEqual([
      {
        startTime: "2025-01-02T02:00:00.000Z",
        endTime: "2025-01-02T02:29:59.999Z",
      },
      {
        startTime: "2025-01-02T02:30:00.001Z",
        endTime: "2025-01-02T03:00:00.000Z",
      },
    ]);
    expect(third).toMatchObject({
      source: "cache",
      status: "partial",
      candles: [
        expect.objectContaining({
          timestamp: candle.timestamp,
        }),
      ],
    });
    expect(third.coverage).toEqual(
      expect.arrayContaining([
      expect.objectContaining({
          requestedStart: "2025-01-02T02:00:00.000Z",
          requestedEnd: "2025-01-02T02:29:59.999Z",
          status: "partial",
        }),
        expect.objectContaining({
          requestedStart: "2025-01-02T02:30:00.001Z",
          requestedEnd: "2025-01-02T03:00:00.000Z",
          status: "partial",
        }),
      ]),
    );
    expect(missingFetcher).toHaveBeenCalledTimes(2);
    expect(cachedFetcher).not.toHaveBeenCalled();
  });

  it("rejects a response for a different instrument before persistence", async () => {
    const repo = repository();
    const fetcher = vi.fn<typeof fetch>(async () =>
      Response.json({
        ...((await intradayResponse().json()) as object),
        request: {
          instrumentId: "HK:9999",
          symbol: "9999",
          market: "HK",
          interval: "15m",
          startTime: "2025-01-02T02:00:00.000Z",
          endTime: "2025-01-02T03:00:00.000Z",
        },
      }),
    );

    await expect(
      syncIntradayMarketData(syncOptions(repo, fetcher)),
    ).rejects.toThrow("行情接口响应标的不匹配");
    expect(
      await repo.getCandles(
        "HK:1810",
        "15m",
        "2025-01-02T02:00:00.000Z",
        "2025-01-02T03:00:00.000Z",
      ),
    ).toEqual([]);
  });

  it("retries only the missing sides of capped actual coverage and then stabilizes no-data gaps", async () => {
    const repo = repository();
    const cappedCoverage: IntervalCoverageSegment = {
      interval: "15m",
      requestedStart: "2025-01-02T02:00:00.000Z",
      requestedEnd: "2025-01-02T03:00:00.000Z",
      actualStart: "2025-01-02T02:15:00.000Z",
      actualEnd: "2025-01-02T02:30:00.000Z",
      status: "partial",
      provider: "tencent",
      reason: "provider-history-limit",
      fetchedAt: "2025-02-01T00:00:00.000Z",
    };
    await repo.commitIntervalSyncResult({
      instrumentId: "HK:1810",
      interval: "15m",
      candles: [candle],
      coverage: [cappedCoverage],
      providerSymbol: { provider: "tencent", symbol: "hk01810" },
    });
    const historyLimitFetcher = vi.fn<typeof fetch>(async () =>
      Response.json(
        { error: { code: "provider-history-limit" } },
        { status: 502 },
      ),
    );

    const first = await syncIntradayMarketData(
      syncOptions(repo, historyLimitFetcher),
    );

    expect(first.requestedRanges).toEqual([
      {
        startTime: "2025-01-02T02:00:00.000Z",
        endTime: "2025-01-02T02:14:59.999Z",
      },
      {
        startTime: "2025-01-02T02:30:00.001Z",
        endTime: "2025-01-02T03:00:00.000Z",
      },
    ]);
    expect(first.coverage).toEqual(
      expect.arrayContaining([
        cappedCoverage,
        expect.objectContaining({
          requestedStart: "2025-01-02T02:00:00.000Z",
          requestedEnd: "2025-01-02T02:14:59.999Z",
          status: "partial",
        }),
        expect.objectContaining({
          requestedStart: "2025-01-02T02:30:00.001Z",
          requestedEnd: "2025-01-02T03:00:00.000Z",
          status: "partial",
        }),
      ]),
    );

    const noLoopFetcher = vi.fn<typeof fetch>();
    const second = await syncIntradayMarketData(
      syncOptions(repo, noLoopFetcher),
    );
    expect(second.source).toBe("cache");
    expect(second.status).toBe("partial");
    expect(noLoopFetcher).not.toHaveBeenCalled();
  });

  it("rejects an intraday route response without echoed request identity", async () => {
    const repo = repository();
    const fetcher = vi.fn<typeof fetch>(async () => {
      const body = (await intradayResponse().json()) as Record<string, unknown>;
      delete body.request;
      return Response.json(body);
    });

    await expect(
      syncIntradayMarketData(syncOptions(repo, fetcher)),
    ).rejects.toThrow("行情接口响应标的不匹配");
  });
});
