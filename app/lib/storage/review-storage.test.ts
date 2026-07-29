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

  it("writes version-2 state while accepting the current version-1 workspace input", () => {
    const state: StoredReviewState = {
      version: 1,
      replayCursor: "2025-01-06T00:00:00.000Z",
      timeframe: "1D",
      thesis: "等待突破后回踩确认",
      drawings: [drawing],
    };

    saveReviewState("episode-1", state);

    expect(loadReviewState("episode-1")).toMatchObject({
      version: 2,
      episodeId: "episode-1",
      replayCursor: state.replayCursor,
      timeframe: "1D",
      activePanelTab: "stats",
      thesis: state.thesis,
    });
    expect(loadReviewState("episode-1")?.drawings[0]).toMatchObject({
      version: 2,
      episodeId: "episode-1",
      name: "price-label",
      zIndex: 0,
    });
    expect(
      localStorage.getItem("trade-reviewer:review:v1:episode-1"),
    ).toBeNull();
    expect(
      localStorage.getItem("trade-reviewer:review:v2:episode-1"),
    ).not.toBeNull();
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

    expect(loadReviewState("legacy")).toMatchObject({
      version: 2,
      episodeId: "legacy",
      activePanelTab: "stats",
    });
    expect(loadReviewState("legacy")?.drawings[0]).toMatchObject({
      createdAtCursor: "2025-01-10T00:00:00.000Z",
      version: 2,
      episodeId: "legacy",
    });
    expect(localStorage.getItem("trade-reviewer:review:v2:legacy")).not.toBeNull();
  });
});
