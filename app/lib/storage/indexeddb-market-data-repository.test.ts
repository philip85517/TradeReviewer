import "fake-indexeddb/auto";

import { afterEach, describe, expect, it } from "vitest";

import type {
  CoverageSegment,
  DailyCandleRecord,
  IntervalCoverageSegment,
  MarketCandleRecord,
} from "../market/contracts";
import {
  INTERVAL_COVERAGE,
  MARKET_CANDLES,
  openTradeReviewDatabase,
  PROVIDER_SYMBOLS,
  transactionDone,
} from "./indexeddb-schema";
import { IndexedDbMarketDataRepository } from "./indexeddb-market-data-repository";

const databases: string[] = [];

function repository() {
  const name = `trade-reviewer-test-${crypto.randomUUID()}`;
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

const coverage: CoverageSegment = {
  startDate: "2025-01-01",
  endDate: "2025-01-31",
  status: "complete",
  provider: "tencent",
  fetchedAt: "2025-02-01T00:00:00.000Z",
  missingTradingDates: [],
};

const intervalCandle: MarketCandleRecord = {
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

const intervalCoverage: IntervalCoverageSegment = {
  interval: "15m",
  requestedStart: "2025-01-02T02:00:00.000Z",
  requestedEnd: "2025-01-02T03:00:00.000Z",
  actualStart: "2025-01-02T02:30:00.000Z",
  actualEnd: "2025-01-02T02:30:00.000Z",
  status: "complete",
  provider: "tencent",
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

describe("IndexedDbMarketDataRepository", () => {
  it("atomically stores candles, coverage and the resolved provider symbol", async () => {
    const repo = repository();

    await repo.commitSyncResult({
      instrumentId: "HK:1810",
      candles: [candle],
      coverage: [coverage],
      providerSymbol: {
        provider: "tencent",
        symbol: "hk01810",
      },
    });

    expect(
      await repo.getDailyCandles("HK:1810", "2025-01-01", "2025-01-31"),
    ).toEqual([candle]);
    expect(await repo.getCoverage("HK:1810")).toEqual([coverage]);
    expect(await repo.getProviderSymbol("HK:1810", "tencent")).toBe(
      "hk01810",
    );
  });

  it("uses compound keys so the same candle can be written idempotently", async () => {
    const repo = repository();
    const result = {
      instrumentId: "HK:1810",
      candles: [candle],
      coverage: [coverage],
      providerSymbol: {
        provider: "tencent" as const,
        symbol: "hk01810",
      },
    };

    await repo.commitSyncResult(result);
    await repo.commitSyncResult(result);

    expect(
      await repo.getDailyCandles("HK:1810", "2025-01-01", "2025-01-31"),
    ).toHaveLength(1);
  });

  it("stores identical interval sync results idempotently with coverage and provider symbol", async () => {
    const repo = repository();
    const result = {
      instrumentId: "HK:1810",
      interval: "15m" as const,
      candles: [intervalCandle],
      coverage: [intervalCoverage],
      providerSymbol: {
        provider: "tencent" as const,
        symbol: "hk01810",
      },
    };

    await repo.commitIntervalSyncResult(result);
    await repo.commitIntervalSyncResult(result);

    expect(
      await repo.getCandles(
        "HK:1810",
        "15m",
        "2025-01-02T02:00:00.000Z",
        "2025-01-02T03:00:00.000Z",
      ),
    ).toEqual([intervalCandle]);
    expect(await repo.getIntervalCoverage("HK:1810", "15m")).toEqual([
      intervalCoverage,
    ]);
    expect(await repo.getProviderSymbol("HK:1810", "tencent")).toBe(
      "hk01810",
    );
  });

  it("uses generic daily candles in preference to legacy daily cache records", async () => {
    const repo = repository();
    await repo.commitSyncResult({
      instrumentId: "HK:1810",
      candles: [candle],
      coverage: [coverage],
      providerSymbol: {
        provider: "tencent",
        symbol: "hk01810",
      },
    });
    const genericDailyCandle: MarketCandleRecord = {
      ...intervalCandle,
      interval: "1D",
      timestamp: "2025-01-02T00:00:00.000Z",
      close: "36.5",
    };

    await repo.commitIntervalSyncResult({
      instrumentId: "HK:1810",
      interval: "1D",
      candles: [genericDailyCandle],
      coverage: [],
      providerSymbol: {
        provider: "tencent",
        symbol: "hk01810",
      },
    });

    expect(
      await repo.getCandles(
        "HK:1810",
        "1D",
        "2025-01-01T00:00:00.000Z",
        "2025-01-31T23:59:59.999Z",
      ),
    ).toEqual([genericDailyCandle]);
  });

  it("rolls back all interval stores when their transaction is aborted", async () => {
    const databaseName = `trade-reviewer-test-${crypto.randomUUID()}`;
    databases.push(databaseName);
    const repo = new IndexedDbMarketDataRepository(databaseName);
    const database = await openTradeReviewDatabase(databaseName);
    try {
      const transaction = database.transaction(
        [MARKET_CANDLES, INTERVAL_COVERAGE, PROVIDER_SYMBOLS],
        "readwrite",
      );
      const completion = transactionDone(transaction);
      transaction.objectStore(MARKET_CANDLES).put(intervalCandle);
      transaction.objectStore(INTERVAL_COVERAGE).put({
        instrumentId: "HK:1810",
        interval: "15m",
        segments: [intervalCoverage],
      });
      transaction.objectStore(PROVIDER_SYMBOLS).put({
        instrumentId: "HK:1810",
        provider: "tencent",
        symbol: "hk01810",
      });
      transaction.abort();

      await expect(completion).rejects.toBeInstanceOf(Error);
    } finally {
      database.close();
    }

    expect(
      await repo.getCandles(
        "HK:1810",
        "15m",
        "2025-01-02T02:00:00.000Z",
        "2025-01-02T03:00:00.000Z",
      ),
    ).toEqual([]);
    expect(await repo.getIntervalCoverage("HK:1810", "15m")).toEqual([]);
    expect(await repo.getProviderSymbol("HK:1810", "tencent")).toBeUndefined();
  });
});
