import { describe, expect, it } from "vitest";

import {
  calculateRMultiple,
  createEmptyEpisodeReviewRecord,
  episodeReviewStatus,
  normalizeEpisodeReviewRecord,
} from "./review-metrics";
import type { EpisodeReviewRecord } from "./types";

function record(
  overrides: Partial<EpisodeReviewRecord> = {},
): EpisodeReviewRecord {
  return {
    version: 1,
    episodeId: "episode-1",
    instrumentId: "US:XPEV",
    updatedAt: "2025-01-10T00:00:00.000Z",
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
    confirmedTagIds: [],
    ...overrides,
  };
}

describe("episode review metrics", () => {
  it("creates a deterministic blank record for suggestion confirmation", () => {
    expect(
      createEmptyEpisodeReviewRecord(
        "episode-new",
        "US:XPEV",
        "2026-07-27T01:00:00.000Z",
      ),
    ).toEqual({
      version: 1,
      episodeId: "episode-new",
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
      confirmedTagIds: [],
    });
  });

  it("marks only explicitly completed records as reviewed", () => {
    expect(episodeReviewStatus()).toBe("pending");
    expect(episodeReviewStatus(record())).toBe("pending");
    expect(
      episodeReviewStatus(
        record({
          review: {
            ...record().review,
            completed: true,
          },
        }),
      ),
    ).toBe("completed");
  });

  it("calculates exact R only from a positive user-entered risk", () => {
    expect(calculateRMultiple({ netPnl: "250" }, "100")).toBe("2.5");
    expect(calculateRMultiple({ netPnl: "-125" }, "50")).toBe("-2.5");
    expect(calculateRMultiple({ netPnl: null }, "100")).toBeNull();
    expect(calculateRMultiple({ netPnl: "250" }, "")).toBeNull();
    expect(calculateRMultiple({ netPnl: "250" }, "0")).toBeNull();
    expect(calculateRMultiple({ netPnl: "250" }, "-10")).toBeNull();
    expect(calculateRMultiple({ netPnl: "Infinity" }, "100")).toBeNull();
    expect(calculateRMultiple({ netPnl: "250" }, "Infinity")).toBeNull();
    expect(calculateRMultiple({ netPnl: "1e-400" }, "1e-400")).toBe("1");
  });

  it("normalizes text and deduplicates only explicitly confirmed tags", () => {
    const normalized = normalizeEpisodeReviewRecord(
      record({
        plan: {
          ...record().plan,
          thesis: "  等待突破  ",
          expectedPath: " 突破后回踩 ",
        },
        review: {
          ...record().review,
          psychology: "  有一点 FOMO  ",
        },
        confirmedTagIds: ["breakout", "fomo", "breakout", " "],
      }),
    );

    expect(normalized.plan.thesis).toBe("等待突破");
    expect(normalized.plan.expectedPath).toBe("突破后回踩");
    expect(normalized.review.psychology).toBe("有一点 FOMO");
    expect(normalized.confirmedTagIds).toEqual(["breakout", "fomo"]);
  });
});
