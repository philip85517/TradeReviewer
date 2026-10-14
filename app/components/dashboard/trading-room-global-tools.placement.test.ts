import { describe, expect, it } from "vitest";

import { resolveNotificationPanelPlacement } from "./trading-room-global-tools.placement";

describe("resolveNotificationPanelPlacement", () => {
  it("keeps a normal below-trigger panel when the visible intersection has room", () => {
    expect(resolveNotificationPanelPlacement({
      visibleTop: 0,
      visibleBottom: 844,
      triggerTop: 200,
      triggerBottom: 244,
      containingBlockTop: 100,
      preferredHeight: 300,
    })).toEqual({
      side: "below",
      top: 153,
      maxHeight: 300,
    });
  });

  it("flips above the trigger and stops at the real clipping boundary", () => {
    expect(resolveNotificationPanelPlacement({
      visibleTop: 86,
      visibleBottom: 740,
      triggerTop: 647,
      triggerBottom: 691,
      containingBlockTop: 647,
      preferredHeight: 620,
    })).toEqual({
      side: "above",
      top: -561,
      maxHeight: 552,
    });
  });

});
