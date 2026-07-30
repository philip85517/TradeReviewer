import { describe, expect, it } from "vitest";

import {
  calculateRMultiple,
  episodePlanAtCursor,
  episodeReviewStatus,
  mergeEpisodePlanRevision,
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

  it("treats a legacy plan as known without hiding it on rewind", () => {
    const legacy = record({
      plan: {
        ...record().plan,
        thesis: "legacy thesis",
        plannedRiskAmount: "100",
      },
    });

    expect(
      episodePlanAtCursor(legacy, "2025-01-02T10:07:00.000Z"),
    ).toMatchObject({
      thesis: "legacy thesis",
      plannedRiskAmount: "100",
    });
  });

  it("selects only the latest plan revision known at the replay cursor", () => {
    const revised = record({
      plan: {
        ...record().plan,
        thesis: "future edit",
        plannedRiskAmount: "50",
      },
      planRevisions: [
        {
          knowledgeAt: "2025-01-02T10:00:00.000Z",
          plan: {
            ...record().plan,
            thesis: "entry plan",
            plannedRiskAmount: "100",
          },
        },
        {
          knowledgeAt: "2025-01-02T11:00:00.000Z",
          plan: {
            ...record().plan,
            thesis: "future edit",
            plannedRiskAmount: "50",
          },
        },
      ],
    });

    expect(
      episodePlanAtCursor(revised, "2025-01-02T10:59:59.999Z"),
    ).toMatchObject({
      thesis: "entry plan",
      plannedRiskAmount: "100",
    });
    expect(
      episodePlanAtCursor(revised, "2025-01-02T11:00:00.000Z"),
    ).toMatchObject({
      thesis: "future edit",
      plannedRiskAmount: "50",
    });
  });

  it("merges a rewind edit from the visible plan while preserving future revisions", () => {
    const futurePlan = {
      ...record().plan,
      thesis: "future edit",
      expectedPath: "future path",
      plannedRiskAmount: "50",
    };
    const revised = record({
      plan: futurePlan,
      planRevisions: [
        {
          knowledgeAt: "2025-01-02T10:00:00.000Z",
          plan: {
            ...record().plan,
            thesis: "entry plan",
            expectedPath: "entry path",
            plannedRiskAmount: "100",
          },
        },
        {
          knowledgeAt: "2025-01-02T11:00:00.000Z",
          plan: futurePlan,
        },
      ],
    });

    const merged = mergeEpisodePlanRevision({
      record: revised,
      knowledgeAt: "2025-01-02T10:30:00.000Z",
      episodeStartedAt: "2025-01-02T10:00:00.000Z",
      plan: {
        ...episodePlanAtCursor(
          revised,
          "2025-01-02T10:30:00.000Z",
        )!,
        thesis: "rewind edit",
      },
    });

    expect(merged.planRevisions).toHaveLength(3);
    expect(
      episodePlanAtCursor(merged, "2025-01-02T10:30:00.000Z"),
    ).toMatchObject({
      thesis: "rewind edit",
      expectedPath: "entry path",
      plannedRiskAmount: "100",
    });
    expect(
      episodePlanAtCursor(merged, "2025-01-02T11:00:00.000Z"),
    ).toEqual(futurePlan);
    expect(merged.plan).toEqual(futurePlan);
  });
});
