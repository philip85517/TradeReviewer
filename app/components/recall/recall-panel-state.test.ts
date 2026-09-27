import { describe, expect, it } from "vitest";

import {
  transitionRecallPanelState,
  type RecallPanelState,
} from "./recall-workspace";

const episodeId = "episode-1";
const initialState = (overrides: Partial<RecallPanelState> = {}): RecallPanelState => ({
  episodeId,
  planOpen: true,
  moreOpen: false,
  rememberedPlanOpen: null,
  ...overrides,
});

describe("Recall More and plan panel state", () => {
  it("yields the plan panel at the actual 1105px container boundary and restores it", () => {
    const opened = transitionRecallPanelState(initialState(), {
      type: "toggle-more",
      contentWidth: 1105,
    });
    expect(opened).toMatchObject({
      moreOpen: true,
      planOpen: false,
      rememberedPlanOpen: true,
    });

    expect(transitionRecallPanelState(opened, {
      type: "toggle-more",
      contentWidth: 390,
    })).toMatchObject({
      moreOpen: false,
      planOpen: true,
      rememberedPlanOpen: null,
    });
  });

  it("keeps the plan and More panels together above the narrow container width", () => {
    expect(transitionRecallPanelState(initialState(), {
      type: "toggle-more",
      contentWidth: 1106,
    })).toMatchObject({
      moreOpen: true,
      planOpen: true,
      rememberedPlanOpen: null,
    });
  });

  it("opens the plan explicitly and clears More restoration state", () => {
    const opened = transitionRecallPanelState(initialState(), {
      type: "toggle-more",
      contentWidth: 390,
    });
    expect(transitionRecallPanelState(opened, { type: "open-plan" })).toMatchObject({
      moreOpen: false,
      planOpen: true,
      rememberedPlanOpen: null,
    });
  });

  it("keeps the footer plan action as a toggle when the plan is already open", () => {
    expect(transitionRecallPanelState(initialState(), {
      type: "toggle-plan",
      contentWidth: 1440,
    })).toMatchObject({
      moreOpen: false,
      planOpen: false,
    });
  });

  it("keeps a wide More panel open when the footer opens a closed plan", () => {
    const wideMore = transitionRecallPanelState(initialState({ planOpen: false }), {
      type: "toggle-more",
      contentWidth: 1440,
    });
    expect(transitionRecallPanelState(wideMore, {
      type: "toggle-plan",
      contentWidth: 1440,
    })).toMatchObject({
      moreOpen: true,
      planOpen: true,
    });
  });

  it("closes narrow More before the footer reopens its yielded plan", () => {
    const narrowMore = transitionRecallPanelState(initialState(), {
      type: "toggle-more",
      contentWidth: 390,
    });
    expect(transitionRecallPanelState(narrowMore, {
      type: "toggle-plan",
      contentWidth: 390,
    })).toMatchObject({
      moreOpen: false,
      planOpen: true,
      rememberedPlanOpen: null,
    });
  });

  it("yields the plan after a wide More view is resized into the narrow container", () => {
    const wideMore = transitionRecallPanelState(initialState(), {
      type: "toggle-more",
      contentWidth: 1440,
    });
    expect(transitionRecallPanelState(wideMore, {
      type: "sync-more-width",
      contentWidth: 900,
    })).toMatchObject({
      moreOpen: true,
      planOpen: false,
      rememberedPlanOpen: true,
    });
  });

  it("restores and clears narrow memory when More returns to a wide container", () => {
    const narrowMore = transitionRecallPanelState(initialState(), {
      type: "toggle-more",
      contentWidth: 390,
    });
    const wideMore = transitionRecallPanelState(narrowMore, {
      type: "sync-more-width",
      contentWidth: 1440,
    });
    expect(wideMore).toMatchObject({
      moreOpen: true,
      planOpen: true,
      rememberedPlanOpen: null,
    });
    const manuallyClosed = transitionRecallPanelState(wideMore, {
      type: "toggle-plan",
      contentWidth: 1440,
    });
    expect(manuallyClosed).toMatchObject({
      moreOpen: true,
      planOpen: false,
      rememberedPlanOpen: null,
    });
    expect(transitionRecallPanelState(manuallyClosed, {
      type: "toggle-more",
      contentWidth: 1440,
    })).toMatchObject({ moreOpen: false, planOpen: false });
  });

  it("keeps a previously closed plan closed through narrow More and a wide resize", () => {
    const narrowMore = transitionRecallPanelState(initialState({ planOpen: false }), {
      type: "toggle-more",
      contentWidth: 390,
    });
    expect(narrowMore).toMatchObject({
      moreOpen: true,
      planOpen: false,
      rememberedPlanOpen: false,
    });
    const wideMore = transitionRecallPanelState(narrowMore, {
      type: "sync-more-width",
      contentWidth: 1440,
    });
    expect(wideMore).toMatchObject({
      moreOpen: true,
      planOpen: false,
      rememberedPlanOpen: null,
    });
    expect(transitionRecallPanelState(wideMore, {
      type: "toggle-more",
      contentWidth: 1440,
    })).toMatchObject({ moreOpen: false, planOpen: false });
  });

  it("does not restore an earlier episode's panel state", () => {
    const opened = transitionRecallPanelState(initialState(), {
      type: "toggle-more",
      contentWidth: 390,
    });
    expect(transitionRecallPanelState(opened, {
      type: "episode-change",
      episodeId: "episode-2",
    })).toEqual({
      episodeId: "episode-2",
      planOpen: true,
      moreOpen: false,
      rememberedPlanOpen: null,
    });
  });
});
