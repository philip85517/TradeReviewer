import { beforeEach, describe, expect, it } from "vitest";

import type { Drawing } from "../chart/drawings";
import {
  loadReviewState,
  saveReviewState,
  type StoredReviewState,
} from "./review-storage";

const drawing: Drawing = {
  id: "price-1",
  tool: "price-label",
  anchors: [{ time: "2025-01-06T00:00:00.000Z", price: 12.5 }],
  style: { color: "#f3ba2f", lineWidth: 1, opacity: 0.9 },
  hidden: false,
  locked: true,
  visibleOn: "all",
  stage: "pre-trade",
  createdAtCursor: "2025-01-06T00:00:00.000Z",
  text: "突破价",
};

describe("review storage", () => {
  beforeEach(() => localStorage.clear());

  it("round-trips versioned review state without losing drawings", () => {
    const state: StoredReviewState = {
      version: 1,
      replayCursor: "2025-01-06T00:00:00.000Z",
      timeframe: "1D",
      thesis: "等待突破后回踩确认",
      drawings: [drawing],
    };

    saveReviewState("episode-1", state);

    expect(loadReviewState("episode-1")).toEqual(state);
  });

  it("migrates legacy drawings to the saved replay knowledge boundary", () => {
    const legacyDrawing = { ...drawing };
    delete legacyDrawing.createdAtCursor;
    window.localStorage.setItem(
      "trade-reviewer:review:v1:legacy",
      JSON.stringify({
        version: 1,
        replayCursor: "2025-01-10T00:00:00.000Z",
        timeframe: "1D",
        thesis: "",
        drawings: [legacyDrawing],
      }),
    );

    expect(
      loadReviewState("legacy")?.drawings[0].createdAtCursor,
    ).toBe("2025-01-10T00:00:00.000Z");
  });
});
