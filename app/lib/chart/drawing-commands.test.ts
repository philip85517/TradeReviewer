import { describe, expect, it } from "vitest";

import type { NormalizedDrawing } from "./drawings";
import {
  applyDrawingCommand,
  createDrawingHistory,
  redoDrawingCommand,
  undoDrawingCommand,
} from "./drawing-commands";

function drawing(
  id: string,
  overrides: Partial<NormalizedDrawing> = {},
): NormalizedDrawing {
  return {
    version: 2,
    id,
    episodeId: "episode-1",
    name: "趋势线",
    tool: "trend-line",
    anchors: [
      { time: "2025-01-02T00:00:00.000Z", price: 10 },
      { time: "2025-01-03T00:00:00.000Z", price: 12 },
    ],
    style: { color: "#2f80ed", lineWidth: 2, opacity: 1 },
    hidden: false,
    locked: false,
    visibleOn: "all",
    stage: "during-replay",
    createdAtCursor: "2025-01-03T00:00:00.000Z",
    zIndex: 0,
    ...overrides,
  };
}

describe("drawing command history", () => {
  it("rejects a legacy generic risk-reward drawing from command history", () => {
    const legacyRiskReward = {
      ...drawing("legacy-risk", {
        tool: "long-risk-reward",
        anchors: [
          { time: "2025-01-02T00:00:00.000Z", price: 100 },
          { time: "2025-01-02T00:00:00.000Z", price: 95 },
          { time: "2025-01-02T00:00:00.000Z", price: 110 },
        ],
      }),
      tool: "risk-reward",
    } as unknown as NormalizedDrawing;

    expect(() => createDrawingHistory([legacyRiskReward])).toThrow(
      "规范化绘图不支持旧版风险回报工具",
    );
  });

  it("creates, updates, renames, toggles, reorders, deletes, and clears drawings", () => {
    const trend = drawing("trend");
    const label = drawing("label", {
      name: "价格标注",
      tool: "price-label",
      anchors: [{ time: "2025-01-03T00:00:00.000Z", price: 12 }],
      zIndex: 1,
    });
    let history = createDrawingHistory([trend]);

    history = applyDrawingCommand(history, { type: "add", drawing: label });
    history = applyDrawingCommand(history, {
      type: "replace",
      drawing: { ...trend, anchors: [{ time: "2025-01-04T00:00:00.000Z", price: 11 }, trend.anchors[1]] },
    });
    history = applyDrawingCommand(history, {
      type: "rename",
      id: trend.id,
      name: "下降趋势线",
    });
    history = applyDrawingCommand(history, { type: "toggle-hidden", id: label.id });
    history = applyDrawingCommand(history, { type: "toggle-locked", id: label.id });
    history = applyDrawingCommand(history, { type: "move", id: label.id, direction: "down" });

    expect(history.present).toMatchObject([
      { id: "label", zIndex: 0, hidden: true, locked: true },
      {
        id: "trend",
        zIndex: 1,
        name: "下降趋势线",
        anchors: [
          { time: "2025-01-04T00:00:00.000Z", price: 11 },
          { time: "2025-01-03T00:00:00.000Z", price: 12 },
        ],
      },
    ]);

    history = applyDrawingCommand(history, { type: "delete", id: trend.id });
    expect(history.present.map((item) => item.id)).toEqual(["label"]);

    history = applyDrawingCommand(history, {
      type: "add",
      drawing: drawing("unlocked"),
    });
    history = applyDrawingCommand(history, { type: "clear-unlocked" });
    expect(history.present.map((item) => item.id)).toEqual(["label"]);
  });

  it("does not replace or delete a locked drawing", () => {
    const locked = drawing("locked", { locked: true });
    let history = createDrawingHistory([locked]);

    history = applyDrawingCommand(history, {
      type: "replace",
      drawing: { ...locked, name: "不应替换" },
    });
    history = applyDrawingCommand(history, { type: "delete", id: locked.id });

    expect(history.present).toEqual([locked]);
    expect(history.past).toEqual([]);
  });

  it("undoes and redoes immutable commands", () => {
    const trend = drawing("trend");
    let history = createDrawingHistory([trend]);
    history = applyDrawingCommand(history, {
      type: "rename",
      id: trend.id,
      name: "下降趋势线",
    });
    const renamed = history.present[0];

    history = undoDrawingCommand(history);
    expect(history.present[0].name).toBe("趋势线");
    history = redoDrawingCommand(history);
    expect(history.present[0].name).toBe("下降趋势线");
    expect(history.present[0]).not.toBe(renamed);
  });
});
