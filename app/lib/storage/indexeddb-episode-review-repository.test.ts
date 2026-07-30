import "fake-indexeddb/auto";

import { afterEach, describe, expect, it } from "vitest";

import type {
  CoverageSegment,
  DailyCandleRecord,
} from "../market/contracts";
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

function openVersionTwo(
  name: string,
  legacyCandle: DailyCandleRecord,
  legacyCoverage: CoverageSegment,
  reviewRecord: EpisodeReviewRecord,
) {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.open(name, 2);
    request.onupgradeneeded = () => {
      const database = request.result;
      database.createObjectStore("dailyCandles", {
        keyPath: ["instrumentId", "tradingDate", "adjustmentMode"],
      });
      database.createObjectStore("coverage", { keyPath: "instrumentId" });
      database.createObjectStore("providerSymbols", {
        keyPath: ["instrumentId", "provider"],
      });
      database.createObjectStore("reviews", { keyPath: "episodeId" });
      const transaction = request.transaction;
      transaction?.objectStore("dailyCandles").put(legacyCandle);
      transaction?.objectStore("coverage").put({
        instrumentId: legacyCandle.instrumentId,
        segments: [legacyCoverage],
      });
      transaction?.objectStore("providerSymbols").put({
        instrumentId: legacyCandle.instrumentId,
        provider: legacyCandle.provider,
        symbol: legacyCandle.providerSymbol,
      });
      transaction?.objectStore("reviews").put(reviewRecord);
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

const coverage: CoverageSegment = {
  startDate: "2025-01-01",
  endDate: "2025-01-31",
  status: "complete",
  provider: "tencent",
  fetchedAt: "2025-02-01T00:00:00.000Z",
  missingTradingDates: [],
};

function review(thesis: string): EpisodeReviewRecord {
  return {
    version: 1,
    tagDictionaryVersion: 1,
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
  it("upgrades version two while preserving legacy market data and reviews", async () => {
    const databaseName = `trade-reviewer-v2-${crypto.randomUUID()}`;
    databases.push(databaseName);
    const reviewRecord = review("等待突破");
    await openVersionTwo(databaseName, candle, coverage, reviewRecord);

    const repo = new IndexedDbMarketDataRepository(databaseName);
    const reviews = new IndexedDbEpisodeReviewRepository(databaseName);

    expect(
      await repo.getCandles(
        "US:XPEV",
        "1D",
        "2025-01-01T00:00:00.000Z",
        "2025-01-31T23:59:59.999Z",
      ),
    ).toEqual([
      expect.objectContaining({
        instrumentId: "US:XPEV",
        interval: "1D",
        timestamp: "2025-01-02T00:00:00.000Z",
        close: "11",
      }),
    ]);
    expect(await repo.getCoverage("US:XPEV")).toEqual([coverage]);
    expect(await repo.getProviderSymbol("US:XPEV", "tencent")).toBe(
      "usXPEV",
    );
    expect(await reviews.get("episode-1")).toEqual(reviewRecord);
  });

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

  it("reloads cursor-versioned plans without crossing episode boundaries", async () => {
    const databaseName = `trade-reviewer-plan-revisions-${crypto.randomUUID()}`;
    databases.push(databaseName);
    const reviews = new IndexedDbEpisodeReviewRepository(databaseName);
    const first = {
      ...review("future plan"),
      planRevisions: [
        {
          knowledgeAt: "2025-01-02T10:00:00.000Z",
          plan: {
            ...review("entry plan").plan,
            plannedRiskAmount: "100",
          },
        },
        {
          knowledgeAt: "2025-01-02T11:00:00.000Z",
          plan: {
            ...review("future plan").plan,
            plannedRiskAmount: "50",
          },
        },
      ],
    };
    const second = {
      ...review("other episode"),
      episodeId: "episode-2",
      planRevisions: [
        {
          knowledgeAt: "2025-01-03T10:00:00.000Z",
          plan: review("other episode").plan,
        },
      ],
    };

    await reviews.put(first);
    await reviews.put(second);

    expect((await reviews.get("episode-1"))?.planRevisions).toEqual(
      first.planRevisions,
    );
    expect((await reviews.get("episode-2"))?.planRevisions).toEqual(
      second.planRevisions,
    );
    expect(await reviews.getAll()).toHaveLength(2);
  });
});
