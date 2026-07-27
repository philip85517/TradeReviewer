import "fake-indexeddb/auto";

import { afterEach, describe, expect, it } from "vitest";

import type { DailyCandleRecord } from "../market/contracts";
import type { EpisodeReviewRecord } from "../reviews/types";
import type { TagSuggestionRecord } from "../insights/types";
import { IndexedDbEpisodeReviewRepository } from "./indexeddb-episode-review-repository";
import { IndexedDbMarketDataRepository } from "./indexeddb-market-data-repository";
import { IndexedDbTagSuggestionRepository } from "./indexeddb-tag-suggestion-repository";

const databases: string[] = [];

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
  fetchedAt: "2026-07-27T00:00:00.000Z",
};

const review: EpisodeReviewRecord = {
  version: 1,
  episodeId: "episode-1",
  instrumentId: "US:XPEV",
  updatedAt: "2026-07-27T00:00:00.000Z",
  plan: {
    thesis: "等待突破",
    expectedPath: "",
    invalidationCondition: "",
    targetRange: "",
    plannedRiskAmount: "100",
    confidence: 4,
  },
  review: {
    decisionQuality: 4,
    executionQuality: 4,
    riskManagement: "",
    psychology: "",
    reusableRule: "",
    completed: true,
  },
  confirmedTagIds: [],
};

function suggestion(
  status: "suggested" | "rejected",
): TagSuggestionRecord {
  return {
    version: 1,
    tagDictionaryVersion: 1,
    id: "episode-1:entry-20d-breakout:1",
    episodeId: " episode-1 ",
    instrumentId: " US:XPEV ",
    tagId: " breakout ",
    finalTagId: null,
    ruleId: "entry-20d-breakout",
    ruleVersion: 1,
    status,
    suggestedAt: "2026-07-27T00:00:00.000Z",
    decidedAt:
      status === "rejected" ? "2026-07-27T01:00:00.000Z" : null,
    evidence: [
      {
        kind: "price-comparison",
        tradingDate: "2025-01-02",
        observed: "11",
        reference: "10",
      },
    ],
  };
}

function openVersionTwo(name: string) {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.open(name, 2);
    request.onupgradeneeded = () => {
      const database = request.result;
      database.createObjectStore("dailyCandles", {
        keyPath: ["instrumentId", "tradingDate", "adjustmentMode"],
      });
      database.createObjectStore("coverage", {
        keyPath: "instrumentId",
      });
      database.createObjectStore("providerSymbols", {
        keyPath: ["instrumentId", "provider"],
      });
      database.createObjectStore("reviews", {
        keyPath: "episodeId",
      });
      request.transaction?.objectStore("dailyCandles").put(candle);
      request.transaction?.objectStore("reviews").put(review);
    };
    request.onsuccess = () => {
      request.result.close();
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
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

describe("IndexedDbTagSuggestionRepository", () => {
  it("upgrades version two without losing candles or reviews", async () => {
    const databaseName = `trade-reviewer-suggestion-${crypto.randomUUID()}`;
    databases.push(databaseName);
    await openVersionTwo(databaseName);

    const repository = new IndexedDbTagSuggestionRepository(databaseName);
    await repository.put(suggestion("suggested"));

    expect(await repository.getAll()).toEqual([
      {
        ...suggestion("suggested"),
        episodeId: "episode-1",
        instrumentId: "US:XPEV",
        tagId: "breakout",
      },
    ]);
    expect(
      await new IndexedDbEpisodeReviewRepository(databaseName).get(
        "episode-1",
      ),
    ).toEqual(review);
    expect(
      await new IndexedDbMarketDataRepository(
        databaseName,
      ).getDailyCandles("US:XPEV", "2025-01-01", "2025-01-31"),
    ).toEqual([candle]);
  });

  it("atomically replaces a decision with the same stable id", async () => {
    const databaseName = `trade-reviewer-suggestion-${crypto.randomUUID()}`;
    databases.push(databaseName);
    const repository = new IndexedDbTagSuggestionRepository(databaseName);

    await repository.put(suggestion("suggested"));
    await repository.put(suggestion("rejected"));

    expect(await repository.getAll()).toEqual([
      {
        ...suggestion("rejected"),
        episodeId: "episode-1",
        instrumentId: "US:XPEV",
        tagId: "breakout",
      },
    ]);
  });
});
