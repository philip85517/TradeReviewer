import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
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
  render(
    <div className="chart-stage" data-testid="chart-stage">
      <DrawingCanvas {...(props as Parameters<typeof DrawingCanvas>[0])} />
    </div>,
  );
  const canvas = screen.getByRole("img", { name: "绘图画布" });
  const stage = screen.getByTestId("chart-stage");
  vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
    x: 0, y: 0, width: 100, height: 100, top: 0, left: 0,
    right: 100, bottom: 100, toJSON: () => ({}),
  });
  return { canvas, props, stage };
}

describe("drawing interactions", () => {
  it("enables pointer interaction for creation tools but leaves cursor mode to the chart", () => {
    const { canvas } = renderCanvas({ activeTool: "rectangle" });

    expect(canvas.parentElement).toHaveClass("drawing-mode");
    cleanup();

    const { canvas: cursorCanvas } = renderCanvas({ activeTool: "cursor" });
    expect(cursorCanvas.parentElement).not.toHaveClass("drawing-mode");
  });

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
    const { stage } = renderCanvas({
      activeTool: "cursor", drawings: [drawing], selectedDrawingId: "line-1", onCommand, onSelectDrawing,
    });

    const pointerDown = new MouseEvent("pointerdown", {
      bubbles: true,
      clientX: 10,
      clientY: 100,
    });
    const preventDefault = vi.spyOn(pointerDown, "preventDefault");
    const stopPropagation = vi.spyOn(pointerDown, "stopPropagation");
    const pointerMove = new MouseEvent("pointermove", {
      bubbles: true,
      clientX: 20,
      clientY: 90,
    });
    const pointerUp = new MouseEvent("pointerup", {
      bubbles: true,
      clientX: 20,
      clientY: 90,
    });
    act(() => {
      stage.dispatchEvent(pointerDown);
      stage.dispatchEvent(pointerMove);
      stage.dispatchEvent(pointerUp);
    });

    expect(onSelectDrawing).toHaveBeenCalledWith("line-1");
    expect(onSelectDrawing).toHaveBeenCalledTimes(1);
    expect(preventDefault).not.toHaveBeenCalled();
    expect(stopPropagation).not.toHaveBeenCalled();
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
    const { stage } = renderCanvas({ activeTool: "cursor", drawings: [drawing], onCommand });

    fireEvent.pointerDown(stage, { pointerId: 1, clientX: 10, clientY: 100 });
    fireEvent.pointerMove(stage, { pointerId: 1, clientX: 20, clientY: 90 });
    fireEvent.pointerUp(stage, { pointerId: 1, clientX: 20, clientY: 90 });

    expect(onCommand).not.toHaveBeenCalled();
  });

  it("opens and edits selected text from a cursor-mode stage event", () => {
    const onCommand = vi.fn();
    const drawing: Drawing = {
      id: "text-1",
      tool: "text",
      text: "原注释",
      anchors: [{ time: candles[0].time, price: 100 }],
      style: { color: "#2f80ed", lineWidth: 1.5, opacity: 1 },
      hidden: false,
      locked: false,
      visibleOn: "all",
      stage: "during-replay",
    };
    const { stage } = renderCanvas({
      activeTool: "cursor",
      drawings: [drawing],
      selectedDrawingId: drawing.id,
      onCommand,
    });

    fireEvent.pointerDown(stage, { clientX: 10, clientY: 100 });
    const editor = screen.getByRole("textbox", { name: "文字标注" });
    expect(editor).toHaveStyle({ pointerEvents: "auto" });
    fireEvent.change(editor, { target: { value: "更新注释" } });
    fireEvent.keyDown(editor, { key: "Enter" });

    expect(onCommand).toHaveBeenCalledWith(expect.objectContaining({
      type: "replace",
      drawing: expect.objectContaining({ id: "text-1", text: "更新注释" }),
    }));
  });

  it("moves a whole drawing in time and price with one replacement command", () => {
    const onCommand = vi.fn();
    const start = Date.parse("2026-01-01T00:00:00.000Z");
    const day = 86_400_000;
    const coordinateAdapter = {
      timeToX: (time: string) => ((Date.parse(time) - start) / day + 1) * 10,
      priceToY: (price: number) => 200 - price,
      xToTime: (x: number) => new Date(start + (x / 10 - 1) * day).toISOString(),
      yToPrice: (y: number) => 200 - y,
    };
    const drawing: Drawing = {
      id: "move-line", tool: "trend-line", anchors: [
        { time: "2026-01-01T00:00:00.000Z", price: 100 },
        { time: "2026-01-03T00:00:00.000Z", price: 120 },
      ], style: { color: "#2f80ed", lineWidth: 2, opacity: 1 },
      hidden: false, locked: false, visibleOn: "all", stage: "during-replay",
    };
    const { stage } = renderCanvas({
      activeTool: "cursor",
      cursor: "2026-01-05T00:00:00.000Z",
      candles: [
        candles[0],
        { ...candles[1], time: "2026-01-03T00:00:00.000Z" },
        { ...candles[1], time: "2026-01-05T00:00:00.000Z" },
      ],
      drawings: [drawing],
      coordinateAdapter,
      onCommand,
    });

    fireEvent.pointerDown(stage, { pointerId: 1, clientX: 20, clientY: 90 });
    fireEvent.pointerMove(stage, { pointerId: 1, clientX: 50, clientY: 70 });
    fireEvent.pointerUp(stage, { pointerId: 1, clientX: 50, clientY: 70 });

    expect(onCommand).toHaveBeenCalledTimes(1);
    expect(onCommand).toHaveBeenCalledWith(expect.objectContaining({
      type: "replace",
      drawing: expect.objectContaining({ anchors: [
        { time: "2026-01-03T00:00:00.000Z", price: 120 },
        { time: "2026-01-05T00:00:00.000Z", price: 140 },
      ] }),
    }));
  });

  it.each([
    ["long-risk-reward", 80, 80, 140],
    ["short-risk-reward", 120, 120, 60],
  ] as const)("normalizes a reversed %s creation drag and defaults the target to 2R", (tool, endY, stop, target) => {
    const onCommand = vi.fn();
    const { canvas } = renderCanvas({ activeTool: tool, onCommand });

    fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 10, clientY: 100 });
    fireEvent.pointerUp(canvas, { pointerId: 1, clientX: 40, clientY: endY });

    expect(onCommand).toHaveBeenCalledWith(expect.objectContaining({
      type: "add",
      drawing: expect.objectContaining({
        tool,
        anchors: [
          expect.objectContaining({ price: 100 }),
          expect.objectContaining({ price: stop }),
          expect.objectContaining({ price: target }),
        ],
      }),
    }));
  });

  it.each([
    ["long-risk-reward", 90, 110, 90, 120],
    ["short-risk-reward", 110, 90, 110, 80],
  ] as const)("keeps %s canonical when its stop handle crosses entry", (tool, initialStop, crossedStop, expectedStop, target) => {
    const onCommand = vi.fn();
    const drawing: Drawing = {
      id: `${tool}-1`, tool, anchors: [
        { time: candles[0].time, price: 100 },
        { time: candles[1].time, price: initialStop },
        { time: candles[1].time, price: target },
      ], style: { color: "#2f80ed", lineWidth: 1.5, opacity: 1 },
      hidden: false, locked: false, visibleOn: "all", stage: "during-replay",
    };
    const { stage } = renderCanvas({
      activeTool: "cursor", drawings: [drawing], selectedDrawingId: drawing.id, onCommand,
    });

    fireEvent.pointerDown(stage, { pointerId: 1, clientX: 80, clientY: 200 - initialStop });
    fireEvent.pointerMove(stage, { pointerId: 1, clientX: 80, clientY: 200 - crossedStop });
    fireEvent.pointerUp(stage, { pointerId: 1, clientX: 80, clientY: 200 - crossedStop });

    expect(onCommand).toHaveBeenCalledTimes(1);
    expect(onCommand).toHaveBeenCalledWith(expect.objectContaining({
      type: "replace",
      drawing: expect.objectContaining({ anchors: [
        expect.objectContaining({ price: 100 }),
        expect.objectContaining({ price: expectedStop }),
        expect.objectContaining({ price: target }),
      ] }),
    }));
  });

  it.each([
    ["long-risk-reward", 90, 120, 80, 120],
    ["short-risk-reward", 110, 80, 120, 80],
  ] as const)("keeps %s canonical when its target handle crosses entry", (tool, stop, initialTarget, crossedTarget, expectedTarget) => {
    const onCommand = vi.fn();
    const drawing: Drawing = {
      id: `${tool}-target`, tool, anchors: [
        { time: candles[0].time, price: 100 },
        { time: candles[1].time, price: stop },
        { time: candles[1].time, price: initialTarget },
      ], style: { color: "#2f80ed", lineWidth: 1.5, opacity: 1 },
      hidden: false, locked: false, visibleOn: "all", stage: "during-replay",
    };
    const { stage } = renderCanvas({
      activeTool: "cursor", drawings: [drawing], selectedDrawingId: drawing.id, onCommand,
    });

    fireEvent.pointerDown(stage, { pointerId: 1, clientX: 80, clientY: 200 - initialTarget });
    fireEvent.pointerMove(stage, { pointerId: 1, clientX: 80, clientY: 200 - crossedTarget });
    fireEvent.pointerUp(stage, { pointerId: 1, clientX: 80, clientY: 200 - crossedTarget });

    expect(onCommand).toHaveBeenCalledTimes(1);
    expect(onCommand).toHaveBeenCalledWith(expect.objectContaining({
      type: "replace",
      drawing: expect.objectContaining({ anchors: [
        expect.objectContaining({ price: 100 }),
        expect.objectContaining({ price: stop }),
        expect.objectContaining({ price: expectedTarget }),
      ] }),
    }));
  });
});
