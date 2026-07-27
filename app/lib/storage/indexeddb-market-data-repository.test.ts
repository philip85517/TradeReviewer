import "fake-indexeddb/auto";

import { afterEach, describe, expect, it } from "vitest";

import type {
  CoverageSegment,
  DailyCandleRecord,
} from "../market/contracts";
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
});
