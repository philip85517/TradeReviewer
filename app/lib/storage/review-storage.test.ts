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
});
