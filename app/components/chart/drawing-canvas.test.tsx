import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Drawing } from "../../lib/chart/drawings";
import { DrawingCanvas } from "./drawing-canvas";
import { DrawingToolbar } from "./drawing-toolbar";

afterEach(cleanup);

const candles = [
  { time: "2026-01-01T00:00:00.000Z", open: 100, high: 105, low: 95, close: 102, volume: 10 },
  { time: "2026-01-02T00:00:00.000Z", open: 102, high: 108, low: 98, close: 106, volume: 12 },
];

const adapter = {
  timeToX: (time: string) => (time === candles[0].time ? 10 : 80),
  priceToY: (price: number) => 200 - price,
  xToTime: (x: number) => (x < 50 ? candles[0].time : "2026-02-01T00:00:00.000Z"),
  yToPrice: (y: number) => 200 - y,
};

function renderCanvas(overrides: Record<string, unknown> = {}) {
  const props = {
    episodeId: "episode-1",
    candles,
    cursor: candles[1].time,
    drawings: [] as Drawing[],
    activeTool: "rectangle" as const,
    onAddDrawing: vi.fn(),
    coordinateAdapter: adapter,
    ...overrides,
  };
  render(<DrawingCanvas {...(props as Parameters<typeof DrawingCanvas>[0])} />);
  const canvas = screen.getByRole("img", { name: "绘图画布" });
  vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
    x: 0, y: 0, width: 100, height: 100, top: 0, left: 0,
    right: 100, bottom: 100, toJSON: () => ({}),
  });
  return { canvas, props };
}

describe("drawing interactions", () => {
  it("exposes every drawing tool as an enabled pressed-state button", () => {
    render(
      <DrawingToolbar
        activeTool="cursor"
        canUndo={false}
        canRedo={false}
        allLocked={false}
        onToolChange={vi.fn()}
        onUndo={vi.fn()}
        onRedo={vi.fn()}
        onClear={vi.fn()}
        onToggleLock={vi.fn()}
      />,
    );

    for (const name of [
      "趋势线", "水平线", "垂直线", "矩形区间", "箭头", "价格标注",
      "文字标注", "区间测量", "做多盈亏比", "做空盈亏比",
    ]) {
      expect(screen.getByRole("button", { name })).toBeEnabled();
    }
    expect(screen.getByRole("button", { name: "选择" })).toHaveAttribute("aria-pressed", "true");
  });

  it("creates a rectangle command with cursor-clamped anchors", () => {
    const onCommand = vi.fn();
    const { canvas } = renderCanvas({ onCommand });

    fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 10, clientY: 100 });
    fireEvent.pointerUp(canvas, { pointerId: 1, clientX: 90, clientY: 80 });

    expect(onCommand).toHaveBeenCalledWith(expect.objectContaining({
      type: "add",
      drawing: expect.objectContaining({
        tool: "rectangle",
        anchors: [
          { time: candles[0].time, price: 100 },
          { time: candles[1].time, price: 120 },
        ],
      }),
    }));
  });

  it("opens an inline editor and commits placed text", () => {
    const onCommand = vi.fn();
    const { canvas } = renderCanvas({ activeTool: "text", onCommand });

    fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 10, clientY: 100 });
    const editor = screen.getByRole("textbox", { name: "文字标注" });
    fireEvent.change(editor, { target: { value: "突破确认" } });
    fireEvent.keyDown(editor, { key: "Enter" });

    expect(onCommand).toHaveBeenCalledWith(expect.objectContaining({
      type: "add",
      drawing: expect.objectContaining({ tool: "text", text: "突破确认" }),
    }));
  });

  it("selects a line and emits one replacement after its handle is dragged", () => {
    const onCommand = vi.fn();
    const onSelectDrawing = vi.fn();
    const drawing: Drawing = {
      id: "line-1", tool: "trend-line", anchors: [
        { time: candles[0].time, price: 100 }, { time: candles[1].time, price: 120 },
      ], style: { color: "#2f80ed", lineWidth: 2, opacity: 1 },
      hidden: false, locked: false, visibleOn: "all", stage: "during-replay",
    };
    const { canvas } = renderCanvas({
      activeTool: "cursor", drawings: [drawing], selectedDrawingId: "line-1", onCommand, onSelectDrawing,
    });

    fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 10, clientY: 100 });
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 20, clientY: 90 });
    fireEvent.pointerUp(canvas, { pointerId: 1, clientX: 20, clientY: 90 });

    expect(onSelectDrawing).toHaveBeenCalledWith("line-1");
    expect(onCommand).toHaveBeenCalledTimes(1);
    expect(onCommand).toHaveBeenCalledWith(expect.objectContaining({
      type: "replace",
      drawing: expect.objectContaining({ anchors: [
        { time: candles[0].time, price: 110 }, { time: candles[1].time, price: 120 },
      ] }),
    }));
  });

  it("does not move a locked drawing", () => {
    const onCommand = vi.fn();
    const drawing: Drawing = {
      id: "locked", tool: "horizontal-line", anchors: [{ time: candles[0].time, price: 100 }],
      style: { color: "#2f80ed", lineWidth: 2, opacity: 1 },
      hidden: false, locked: true, visibleOn: "all", stage: "during-replay",
    };
    const { canvas } = renderCanvas({ activeTool: "cursor", drawings: [drawing], onCommand });

    fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 10, clientY: 100 });
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 20, clientY: 90 });
    fireEvent.pointerUp(canvas, { pointerId: 1, clientX: 20, clientY: 90 });

    expect(onCommand).not.toHaveBeenCalled();
  });
});
