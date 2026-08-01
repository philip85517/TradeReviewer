import { describe, expect, it } from "vitest";

import {
  calculateRiskReward,
  clampDrawingToCursor,
  normalizeDrawing,
  requiredAnchorCount,
  validateDrawing,
  visibleDrawingsAtCursor,
  type LegacyDrawing,
  type NormalizedDrawing,
} from "./drawings";

describe("drawing replay safety", () => {
  it("clamps every future anchor to the revealed cursor", () => {
    const cursor = "2025-01-06T00:00:00.000Z";
    const drawing: NormalizedDrawing = {
      version: 2,
      id: "trend-1",
      episodeId: "episode-1",
      name: "趋势线",
      tool: "trend-line",
      anchors: [
        { time: "2025-01-03T00:00:00.000Z", price: 10 },
        { time: "2025-01-09T00:00:00.000Z", price: 12 },
      ],
      style: { color: "#2f80ed", lineWidth: 2, opacity: 1 },
      hidden: false,
      locked: false,
      visibleOn: "all",
      stage: "during-replay",
      createdAtCursor: cursor,
      zIndex: 0,
    };

    const clamped = clampDrawingToCursor(drawing, cursor);

    expect(clamped.anchors).toEqual([
      { time: "2025-01-03T00:00:00.000Z", price: 10 },
      { time: cursor, price: 12 },
    ]);
    expect(drawing.anchors[1].time).toBe("2025-01-09T00:00:00.000Z");
  });

  it("hides annotations that were created after a rewound cursor", () => {
    const drawing: NormalizedDrawing = {
      version: 2,
      id: "late-note",
      episodeId: "episode-1",
      name: "复盘文字",
      tool: "text",
      anchors: [{ time: "2025-01-08T00:00:00.000Z", price: 12 }],
      style: { color: "#2f80ed", lineWidth: 1, opacity: 1 },
      hidden: false,
      locked: false,
      visibleOn: "all",
      stage: "during-replay",
      createdAtCursor: "2025-01-08T00:00:00.000Z",
      zIndex: 0,
    };

    expect(
      visibleDrawingsAtCursor(
        [drawing],
        "2025-01-06T00:00:00.000Z",
        "1D",
      ),
    ).toEqual([]);
    expect(
      visibleDrawingsAtCursor(
        [drawing],
        "2025-01-08T00:00:00.000Z",
        "1D",
      ),
    ).toEqual([drawing]);
  });
});

describe("drawing contracts", () => {
  const style = { color: "#2f80ed", lineWidth: 2, opacity: 1 };

  it("defines the required anchors for the expanded tool set", () => {
    expect(requiredAnchorCount("vertical-line")).toBe(1);
    expect(requiredAnchorCount("rectangle")).toBe(2);
    expect(requiredAnchorCount("arrow")).toBe(2);
    expect(requiredAnchorCount("measure")).toBe(2);
    expect(requiredAnchorCount("long-risk-reward")).toBe(3);
    expect(requiredAnchorCount("short-risk-reward")).toBe(3);
  });

  it("rejects a long risk-reward drawing whose stop is above entry", () => {
    const longRiskRewardWithStopAboveEntry: LegacyDrawing = {
      id: "long-invalid",
      tool: "long-risk-reward",
      anchors: [
        { time: "2025-01-06T00:00:00.000Z", price: 100 },
        { time: "2025-01-06T00:00:00.000Z", price: 105 },
        { time: "2025-01-06T00:00:00.000Z", price: 120 },
      ],
      style,
      hidden: false,
      locked: false,
      visibleOn: "all",
      stage: "during-replay",
    };

    expect(() => validateDrawing(longRiskRewardWithStopAboveEntry)).toThrow(
      "做多止损必须低于入场价",
    );
  });

  it("normalizes a legacy risk-reward drawing to its inferred direction", () => {
    const normalized = normalizeDrawing(
      {
        id: "legacy-risk",
        tool: "risk-reward",
        anchors: [
          { time: "2025-01-06T00:00:00.000Z", price: 100 },
          { time: "2025-01-06T00:00:00.000Z", price: 95 },
          { time: "2025-01-06T00:00:00.000Z", price: 110 },
        ],
        style,
        hidden: false,
        locked: false,
        visibleOn: "all",
        stage: "during-replay",
        zIndex: 99,
      },
      "episode-1",
      "2025-01-10T00:00:00.000Z",
      4,
    );

    expect(normalized).toMatchObject({
      version: 2,
      episodeId: "episode-1",
      name: "long-risk-reward",
      tool: "long-risk-reward",
      zIndex: 4,
      createdAtCursor: "2025-01-10T00:00:00.000Z",
    });
  });
});

describe("calculateRiskReward", () => {
  it("calculates long risk, reward, and R multiple", () => {
    expect(
      calculateRiskReward({
        direction: "long",
        entry: 100,
        stop: 95,
        target: 115,
        quantity: 20,
      }),
    ).toEqual({
      riskPerShare: 5,
      rewardPerShare: 15,
      riskPercent: 5,
      rewardPercent: 15,
      ratio: 3,
      riskAmount: 100,
      rewardAmount: 300,
    });
  });
});
