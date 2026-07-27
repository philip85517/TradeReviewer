import "fake-indexeddb/auto";

import { afterEach, describe, expect, it } from "vitest";

import type { DailyCandleRecord } from "../market/contracts";
import type { EpisodeReviewRecord } from "../reviews/types";
import { IndexedDbEpisodeReviewRepository } from "./indexeddb-episode-review-repository";
import { IndexedDbMarketDataRepository } from "./indexeddb-market-data-repository";

const databases: string[] = [];

function openVersionOne(name: string, candle: DailyCandleRecord) {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      database.createObjectStore("dailyCandles", {
        keyPath: ["instrumentId", "tradingDate", "adjustmentMode"],
      });
      database.createObjectStore("coverage", { keyPath: "instrumentId" });
      database.createObjectStore("providerSymbols", {
        keyPath: ["instrumentId", "provider"],
      });
      request.transaction
        ?.objectStore("dailyCandles")
        .put(candle);
    };
    request.onsuccess = () => {
      request.result.close();
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

const candle: DailyCandleRecord = {
  instrumentId: "US:XPEV",
  tradingDate: "2025-01-02",
  open: "10",
  high: "12",
  low: "9",
  close: "11",
  volume: "1000",
  currency: "USD",
  provider: "tencent",
  providerSymbol: "usXPEV",
  adjustmentMode: "raw",
  fetchedAt: "2025-02-01T00:00:00.000Z",
};

function review(thesis: string): EpisodeReviewRecord {
  return {
    version: 1,
    episodeId: "episode-1",
    instrumentId: "US:XPEV",
    updatedAt: "2025-02-02T00:00:00.000Z",
    plan: {
      thesis,
      expectedPath: "突破后回踩",
      invalidationCondition: "跌破前低",
      targetRange: "15–18",
      plannedRiskAmount: "100",
      confidence: 4,
    },
    review: {
      decisionQuality: 4,
      executionQuality: 3,
      riskManagement: "按计划退出",
      psychology: "平静",
      reusableRule: "等待确认",
      completed: true,
    },
    confirmedTagIds: ["breakout"],
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

describe("IndexedDbEpisodeReviewRepository", () => {
  it("upgrades version one without losing cached market data", async () => {
    const databaseName = `trade-reviewer-review-${crypto.randomUUID()}`;
    databases.push(databaseName);
    await openVersionOne(databaseName, candle);

    const reviews = new IndexedDbEpisodeReviewRepository(databaseName);
    await reviews.put(review("等待突破"));

    expect(await reviews.get("episode-1")).toEqual(review("等待突破"));
    expect(await reviews.getAll()).toEqual([review("等待突破")]);
    expect(
      await new IndexedDbMarketDataRepository(
        databaseName,
      ).getDailyCandles("US:XPEV", "2025-01-01", "2025-01-31"),
    ).toEqual([candle]);
  });

  it("atomically replaces the record for the same episode", async () => {
    const databaseName = `trade-reviewer-review-${crypto.randomUUID()}`;
    databases.push(databaseName);
    const reviews = new IndexedDbEpisodeReviewRepository(databaseName);

    await reviews.put(review("第一版"));
    await reviews.put(review("修订版"));

    expect(await reviews.getAll()).toEqual([review("修订版")]);
  });
});
