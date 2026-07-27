import "fake-indexeddb/auto";

import { afterEach, describe, expect, it } from "vitest";

import type { TagSuggestionRecord } from "../insights/types";
import type { EpisodeReviewRecord } from "../reviews/types";
import { IndexedDbEpisodeReviewRepository } from "./indexeddb-episode-review-repository";
import { IndexedDbTagSuggestionRepository } from "./indexeddb-tag-suggestion-repository";
import { persistSuggestionDecision } from "./indexeddb-suggestion-decision";

const databases: string[] = [];

const suggestion: TagSuggestionRecord = {
  version: 1,
  id: "episode-1:entry-20d-breakout:1",
  episodeId: "episode-1",
  instrumentId: "US:XPEV",
  tagId: "breakout",
  finalTagId: "breakout",
  ruleId: "entry-20d-breakout",
  ruleVersion: 1,
  status: "confirmed",
  suggestedAt: "2026-07-27T00:00:00.000Z",
  decidedAt: "2026-07-27T01:00:00.000Z",
  evidence: [],
};

const review: EpisodeReviewRecord = {
  version: 1,
  episodeId: "episode-1",
  instrumentId: "US:XPEV",
  updatedAt: "2026-07-27T01:00:00.000Z",
  plan: {
    thesis: "",
    expectedPath: "",
    invalidationCondition: "",
    targetRange: "",
    plannedRiskAmount: "",
    confidence: null,
  },
  review: {
    decisionQuality: null,
    executionQuality: null,
    riskManagement: "",
    psychology: "",
    reusableRule: "",
    completed: false,
  },
  confirmedTagIds: ["breakout"],
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

describe("persistSuggestionDecision", () => {
  it("commits a confirmed suggestion and authoritative review together", async () => {
    const databaseName = `trade-reviewer-decision-${crypto.randomUUID()}`;
    databases.push(databaseName);

    await persistSuggestionDecision({
      databaseName,
      suggestion,
      review,
    });

    expect(
      await new IndexedDbTagSuggestionRepository(databaseName).getAll(),
    ).toEqual([suggestion]);
    expect(
      await new IndexedDbEpisodeReviewRepository(databaseName).get(
        "episode-1",
      ),
    ).toEqual(review);
  });

  it("rolls back the suggestion when the review write fails", async () => {
    const databaseName = `trade-reviewer-decision-${crypto.randomUUID()}`;
    databases.push(databaseName);
    const invalidReview = {
      ...review,
      episodeId: undefined,
    } as unknown as EpisodeReviewRecord;

    await expect(
      persistSuggestionDecision({
        databaseName,
        suggestion,
        review: invalidReview,
      }),
    ).rejects.toBeDefined();

    expect(
      await new IndexedDbTagSuggestionRepository(databaseName).getAll(),
    ).toEqual([]);
    expect(
      await new IndexedDbEpisodeReviewRepository(databaseName).getAll(),
    ).toEqual([]);
  });

  it("persists a rejection without creating a review", async () => {
    const databaseName = `trade-reviewer-decision-${crypto.randomUUID()}`;
    databases.push(databaseName);
    const rejected: TagSuggestionRecord = {
      ...suggestion,
      finalTagId: null,
      status: "rejected",
    };

    await persistSuggestionDecision({
      databaseName,
      suggestion: rejected,
    });

    expect(
      await new IndexedDbTagSuggestionRepository(databaseName).getAll(),
    ).toEqual([rejected]);
    expect(
      await new IndexedDbEpisodeReviewRepository(databaseName).getAll(),
    ).toEqual([]);
  });
});
