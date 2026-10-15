import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRef, type Ref } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { NormalizedDrawing } from "../../lib/chart/drawings";
import { DrawingCanvas, paintDrawingScene, type DrawingCanvasHandle } from "./drawing-canvas";

const candles = [
  { time: "2026-01-01T00:00:00.000Z", open: 100, high: 105, low: 95, close: 102, volume: 10 },
  { time: "2026-01-02T00:00:00.000Z", open: 102, high: 108, low: 98, close: 106, volume: 12 },
  { time: "2026-01-03T00:00:00.000Z", open: 106, high: 110, low: 100, close: 108, volume: 12 },
];

const adapter = {
  timeToX: (time: string) => candles.findIndex((candle) => candle.time === time) * 40 + 10,
  priceToY: (price: number) => 200 - price,
  xToTime: (x: number) => candles[Math.max(0, Math.min(candles.length - 1, Math.round((x - 10) / 40)))]?.time ?? candles[0].time,
  yToPrice: (y: number) => 200 - y,
};

function renderCanvas(overrides: Record<string, unknown> = {}) {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(private readonly callback: ResizeObserverCallback) {}

      observe(target: Element) {
        this.callback(
          [{ target, contentRect: { width: 160, height: 200 } } as ResizeObserverEntry],
          this as unknown as ResizeObserver,
        );
      }

      disconnect() {}
    },
  );
  const { ref, ...restOverrides } = overrides;
  const props = {
    episodeId: "episode-1",
    candles,
    cursor: candles[2].time,
    drawings: [] as NormalizedDrawing[],
    selectedDrawingId: null,
    activeTool: "trend-line" as const,
    plannedRiskAmount: undefined,
    currency: "HKD",
    onSelectDrawing: vi.fn(),
    onCommand: vi.fn(),
    coordinateAdapter: adapter,
    ...restOverrides,
  };
  const view = render(
    <div className="chart-stage" data-testid="chart-stage">
    <DrawingCanvas ref={ref as Ref<DrawingCanvasHandle> | undefined} {...(props as Parameters<typeof DrawingCanvas>[0])} />
    </div>,
  );
  const canvas = screen.getByRole("img", { name: "绘图画布" });
  vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
    x: 0, y: 0, width: 160, height: 200, top: 0, left: 0, right: 160, bottom: 200,
    toJSON: () => ({}),
  });
  return { ...view, canvas, props };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("drawing creation state", () => {
  it("stages multiline Text through an anchored preview before opening the editor", () => {
    const { canvas } = renderCanvas({ activeTool: "text", multilineText: true });

    fireEvent.pointerDown(canvas, { pointerId: 30, clientX: 20, clientY: 100 });
    fireEvent.pointerUp(canvas, { pointerId: 30, clientX: 20, clientY: 100 });

    expect(screen.queryByRole("textbox", { name: "文字标注" })).not.toBeInTheDocument();
    const creationStatus = screen.getByRole("status");
    expect(creationStatus).toHaveTextContent("已取锚点");
    expect(creationStatus).toHaveTextContent(candles[0].time);
    expect(creationStatus).toHaveTextContent("100.00");
    expect(creationStatus).toHaveStyle({ top: "40px" });
    expect(screen.getByLabelText("文字定位预览")).toBeInTheDocument();

    fireEvent.pointerMove(canvas, { pointerId: 30, clientX: 100, clientY: 80 });
    expect(screen.getByRole("status")).toHaveTextContent("移动到标签位置");

    fireEvent.pointerDown(canvas, { pointerId: 30, clientX: 100, clientY: 80 });
    fireEvent.pointerUp(canvas, { pointerId: 30, clientX: 100, clientY: 80 });
    expect(screen.getByRole("textbox", { name: "文字标注" })).toBeInTheDocument();
  });

  it("pauses replay as soon as the first staged Text anchor is placed", () => {
    const onDrawingInteractionStart = vi.fn();
    const { canvas } = renderCanvas({ activeTool: "text", multilineText: true, onDrawingInteractionStart });

    fireEvent.pointerDown(canvas, { pointerId: 37, clientX: 20, clientY: 100 });
    fireEvent.pointerUp(canvas, { pointerId: 37, clientX: 20, clientY: 100 });

    expect(onDrawingInteractionStart).toHaveBeenCalledTimes(1);
  });

  it("cancels a staged first anchor with Escape and starts the next gesture cleanly", () => {
    const { canvas } = renderCanvas({ activeTool: "text", multilineText: true });

    fireEvent.pointerDown(canvas, { pointerId: 32, clientX: 20, clientY: 100 });
    fireEvent.pointerUp(canvas, { pointerId: 32, clientX: 20, clientY: 100 });
    expect(screen.getByRole("status")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("文字定位预览")).not.toBeInTheDocument();

    fireEvent.pointerDown(canvas, { pointerId: 33, clientX: 40, clientY: 80 });
    fireEvent.pointerUp(canvas, { pointerId: 33, clientX: 40, clientY: 80 });
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("binds staged Text to the nearest revealed source bar", () => {
    const { canvas } = renderCanvas({
      activeTool: "text",
      multilineText: true,
      cursor: candles[0].time,
    });

    // The adapter projects this point onto a later bar, but only the first
    // candle is revealed at the replay cursor.
    fireEvent.pointerDown(canvas, { pointerId: 35, clientX: 100, clientY: 100 });
    fireEvent.pointerUp(canvas, { pointerId: 35, clientX: 100, clientY: 100 });

    expect(screen.getByRole("status")).toHaveTextContent(candles[0].time);
    expect(screen.getByRole("status")).toHaveTextContent("100.00");
  });

  it("rejects staged Text when no source bar is revealed", () => {
    const { canvas } = renderCanvas({
      activeTool: "text",
      multilineText: true,
      cursor: "2025-12-31T00:00:00.000Z",
    });

    fireEvent.pointerDown(canvas, { pointerId: 36, clientX: 20, clientY: 100 });
    fireEvent.pointerUp(canvas, { pointerId: 36, clientX: 20, clientY: 100 });

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("没有可见行情锚点");
  });

  it("keeps a non-empty editor draft from being replaced by a new text gesture", () => {
    const { canvas } = renderCanvas({ activeTool: "text", multilineText: true });

    fireEvent.pointerDown(canvas, { pointerId: 34, clientX: 20, clientY: 100 });
    fireEvent.pointerMove(canvas, { pointerId: 34, clientX: 100, clientY: 80 });
    fireEvent.pointerUp(canvas, { pointerId: 34, clientX: 100, clientY: 80 });
    const editor = screen.getByRole("textbox", { name: "文字标注" });
    fireEvent.change(editor, { target: { value: "保留草稿" } });

    fireEvent.pointerDown(canvas, { pointerId: 35, clientX: 40, clientY: 80 });
    expect(screen.getByRole("textbox", { name: "文字标注" })).toHaveValue("保留草稿");
    expect(screen.getByRole("dialog", { name: "文字草稿待决议" })).toBeInTheDocument();
  });

  it("keeps a non-empty new draft through Escape and reuses one decision surface", () => {
    const { canvas } = renderCanvas({ activeTool: "text", multilineText: true });

    fireEvent.pointerDown(canvas, { pointerId: 40, clientX: 20, clientY: 100 });
    fireEvent.pointerMove(canvas, { pointerId: 40, clientX: 100, clientY: 80 });
    fireEvent.pointerUp(canvas, { pointerId: 40, clientX: 100, clientY: 80 });
    const editor = screen.getByRole("textbox", { name: "文字标注" });
    fireEvent.change(editor, { target: { value: "保留草稿" } });

    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.keyDown(window, { key: "Escape" });

    expect(screen.getByRole("textbox", { name: "文字标注" })).toHaveValue("保留草稿");
    expect(screen.getAllByRole("dialog", { name: "文字草稿待决议" })).toHaveLength(1);
    expect(screen.getByRole("button", { name: "继续编辑文字" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "完成文字草稿" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "放弃文字草稿" })).toBeInTheDocument();
  });

  it("returns an empty new Text draft to the cursor tool on explicit cancel", () => {
    const onRequestCursorTool = vi.fn();
    const { canvas } = renderCanvas({
      activeTool: "text",
      multilineText: true,
      onRequestCursorTool,
    });

    fireEvent.pointerDown(canvas, { pointerId: 45, clientX: 20, clientY: 100 });
    fireEvent.pointerMove(canvas, { pointerId: 45, clientX: 100, clientY: 80 });
    fireEvent.pointerUp(canvas, { pointerId: 45, clientX: 100, clientY: 80 });
    expect(screen.getByRole("textbox", { name: "文字标注" })).toHaveValue("");

    fireEvent.click(screen.getByRole("button", { name: "取消文字编辑" }));

    expect(onRequestCursorTool).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("textbox", { name: "文字标注" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("文字定位预览")).not.toBeInTheDocument();
  });

  it("does not select another Text body while a non-empty draft is awaiting a decision", () => {
    const onSelectDrawing = vi.fn();
    const first = {
      id: "text-a",
      tool: "text" as const,
      text: "A",
      anchors: [{ time: candles[0].time, price: 100 }],
      style: { color: "#2f80ed", lineWidth: 1.5, opacity: 1 },
      hidden: false,
      locked: false,
      visibleOn: "all" as const,
      stage: "during-replay" as const,
      version: 2 as const,
      episodeId: "episode-1",
      name: "文字",
      zIndex: 0,
      createdAtCursor: candles[2].time,
    } satisfies NormalizedDrawing;
    const second = { ...first, id: "text-b", text: "B", zIndex: 1 };
    renderCanvas({
      activeTool: "cursor",
      drawings: [first, second],
      selectedDrawingId: first.id,
      onSelectDrawing,
    });

    fireEvent.click(screen.getByRole("button", { name: `编辑文字 ${first.id}` }));
    const editor = screen.getByRole("textbox", { name: "文字标注" });
    fireEvent.change(editor, { target: { value: "A 草稿" } });
    fireEvent.pointerDown(screen.getByLabelText(`文字内容 ${second.id}`));
    fireEvent.keyDown(screen.getByRole("button", { name: `选择文字 ${second.id}` }), { key: "Enter" });

    expect(onSelectDrawing).not.toHaveBeenCalledWith(second.id);
    expect(screen.getByRole("textbox", { name: "文字标注" })).toHaveValue("A 草稿");
    expect(screen.getByRole("dialog", { name: "文字草稿待决议" })).toBeInTheDocument();
  });

  it("does not implicitly commit a non-empty draft on textarea blur", () => {
    const onCommand = vi.fn();
    const { canvas } = renderCanvas({ activeTool: "text", multilineText: true, onCommand });

    fireEvent.pointerDown(canvas, { pointerId: 41, clientX: 20, clientY: 100 });
    fireEvent.pointerMove(canvas, { pointerId: 41, clientX: 100, clientY: 80 });
    fireEvent.pointerUp(canvas, { pointerId: 41, clientX: 100, clientY: 80 });
    const editor = screen.getByRole("textbox", { name: "文字标注" });
    fireEvent.change(editor, { target: { value: "不应自动提交" } });
    fireEvent.blur(editor, { relatedTarget: document.body });

    expect(onCommand).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox", { name: "文字标注" })).toHaveValue("不应自动提交");
    expect(screen.getByRole("dialog", { name: "文字草稿待决议" })).toBeInTheDocument();
  });

  it("reuses the same pending Promise for repeated prepareTextDraft calls", async () => {
    const ref = createRef<DrawingCanvasHandle>();
    const { canvas } = renderCanvas({ activeTool: "text", multilineText: true, ref });

    fireEvent.pointerDown(canvas, { pointerId: 42, clientX: 20, clientY: 100 });
    fireEvent.pointerMove(canvas, { pointerId: 42, clientX: 100, clientY: 80 });
    fireEvent.pointerUp(canvas, { pointerId: 42, clientX: 100, clientY: 80 });
    const editor = screen.getByRole("textbox", { name: "文字标注" });
    fireEvent.change(editor, { target: { value: "待决议" } });

    const first = ref.current!.prepareTextDraft("undo");
    const second = ref.current!.prepareTextDraft("redo");
    expect(first).toBe(second);
    await waitFor(() => expect(screen.getByRole("button", { name: "继续编辑文字" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "继续编辑文字" }));
    await expect(first).resolves.toBe(false);
    await waitFor(() => expect(document.activeElement).toBe(editor));
  });

  it("resolves explicit completion and discard without losing a non-empty buffer", async () => {
    const onCommand = vi.fn();
    const completeRef = createRef<DrawingCanvasHandle>();
    const complete = renderCanvas({ activeTool: "text", multilineText: true, onCommand, ref: completeRef });
    fireEvent.pointerDown(complete.canvas, { pointerId: 43, clientX: 20, clientY: 100 });
    fireEvent.pointerMove(complete.canvas, { pointerId: 43, clientX: 100, clientY: 80 });
    fireEvent.pointerUp(complete.canvas, { pointerId: 43, clientX: 100, clientY: 80 });
    fireEvent.change(screen.getByRole("textbox", { name: "文字标注" }), { target: { value: "完成草稿" } });
    const completion = completeRef.current!.prepareTextDraft("save");
    await waitFor(() => expect(screen.getByRole("button", { name: "完成文字草稿" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "完成文字草稿" }));
    await expect(completion).resolves.toBe(true);
    await expect(completeRef.current!.prepareTextDraft("capture")).resolves.toBe(true);
    expect(onCommand).toHaveBeenCalledTimes(1);
    cleanup();

    const discardRef = createRef<DrawingCanvasHandle>();
    const discard = renderCanvas({ activeTool: "text", multilineText: true, onCommand, ref: discardRef });
    fireEvent.pointerDown(discard.canvas, { pointerId: 44, clientX: 20, clientY: 100 });
    fireEvent.pointerMove(discard.canvas, { pointerId: 44, clientX: 100, clientY: 80 });
    fireEvent.pointerUp(discard.canvas, { pointerId: 44, clientX: 100, clientY: 80 });
    fireEvent.change(screen.getByRole("textbox", { name: "文字标注" }), { target: { value: "放弃草稿" } });
    const discarded = discardRef.current!.prepareTextDraft("leave");
    await waitFor(() => expect(screen.getByRole("button", { name: "放弃文字草稿" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "放弃文字草稿" }));
    await expect(discarded).resolves.toBe(true);
    expect(onCommand).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("textbox", { name: "文字标注" })).not.toBeInTheDocument();
  });

  it("supports drag-to-place Text and keeps the market anchor independent", () => {
    const { canvas } = renderCanvas({ activeTool: "text", multilineText: true });

    fireEvent.pointerDown(canvas, { pointerId: 31, clientX: 20, clientY: 100 });
    fireEvent.pointerMove(canvas, { pointerId: 31, clientX: 100, clientY: 80 });
    fireEvent.pointerUp(canvas, { pointerId: 31, clientX: 100, clientY: 80 });

    expect(screen.getByRole("textbox", { name: "文字标注" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "文字标注" })).toHaveValue("");
  });

  it("paints a first-point marker and a channel baseline for non-persistent previews", () => {
    const methods = new Map<string, ReturnType<typeof vi.fn>>();
    const context = new Proxy({} as Record<string, unknown>, {
      get(target, property: string) {
        if (!methods.has(property)) methods.set(property, vi.fn());
        return methods.get(property);
      },
      set() { return true; },
    }) as unknown as CanvasRenderingContext2D;
    const preview = {
      version: 2 as const,
      episodeId: "episode-1",
      id: "__creation-preview__",
      name: "趋势线",
      tool: "trend-line" as const,
      anchors: [{ time: candles[0].time, price: 100 }],
      style: { color: "#2f80ed", lineWidth: 2, opacity: 0.95 },
      hidden: false,
      locked: false,
      visibleOn: "all" as const,
      stage: "during-replay" as const,
      zIndex: 0,
      createdAtCursor: candles[0].time,
    };
    paintDrawingScene(context, {
      width: 160,
      height: 200,
      drawings: [],
      preview,
      pointFor: () => ({ x: 20, y: 100 }),
      pointForDrawing: () => ({ x: 20, y: 100 }),
      currency: "HKD",
    }, false, true);
    expect(methods.get("arc")).toHaveBeenCalled();

    const baseline = { ...preview, tool: "parallel-channel" as const, name: "平行通道", anchors: preview.anchors.concat({ time: candles[1].time, price: 120 }) };
    paintDrawingScene(context, {
      width: 160,
      height: 200,
      drawings: [],
      preview: baseline,
      pointFor: (anchor) => ({ x: anchor.time === candles[0].time ? 20 : 100, y: anchor.price === 100 ? 100 : 80 }),
      pointForDrawing: () => ({ x: 20, y: 100 }),
      currency: "HKD",
    }, false, true);
    expect(methods.get("lineTo")).toHaveBeenCalled();
  });

  it("cancels an idle selection from window Escape without canvas focus", () => {
    const onSelectDrawing = vi.fn();
    renderCanvas({ activeTool: "cursor", selectedDrawingId: "line-1", onSelectDrawing });

    fireEvent.keyDown(window, { key: "Escape" });

    expect(onSelectDrawing).toHaveBeenCalledWith(null);
  });

  it("leaves an open menu's Escape action to the menu before clearing selection", () => {
    const onSelectDrawing = vi.fn();
    const view = renderCanvas({ activeTool: "cursor", selectedDrawingId: "line-1", onSelectDrawing });
    const menu = document.createElement("details");
    menu.open = true;
    menu.setAttribute("role", "menu");
    document.body.appendChild(menu);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onSelectDrawing).not.toHaveBeenCalled();

    menu.remove();
    const toolbar = document.createElement("button");
    toolbar.className = "drawing-toolbar";
    document.body.appendChild(toolbar);
    fireEvent.keyDown(toolbar, { key: "Escape" });
    expect(onSelectDrawing).toHaveBeenCalledWith(null);
    toolbar.remove();
    view.unmount();
  });

  it("does not let an unrelated open disclosure block Escape", () => {
    const onSelectDrawing = vi.fn();
    renderCanvas({ activeTool: "cursor", selectedDrawingId: "line-1", onSelectDrawing });
    const disclosure = document.createElement("details");
    disclosure.open = true;
    document.body.appendChild(disclosure);

    fireEvent.keyDown(window, { key: "Escape" });

    expect(onSelectDrawing).toHaveBeenCalledWith(null);
    disclosure.remove();
  });

  it("keeps the first trend click pending and commits exactly once on the second click", () => {
    const onCommand = vi.fn();
    const { canvas } = renderCanvas({ onCommand });

    fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 20, clientY: 100 });
    fireEvent.pointerUp(canvas, { pointerId: 1, clientX: 20, clientY: 100 });
    expect(onCommand).not.toHaveBeenCalled();

    fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 100, clientY: 80 });
    fireEvent.pointerUp(canvas, { pointerId: 1, clientX: 100, clientY: 80 });

    expect(onCommand).toHaveBeenCalledTimes(1);
    expect(onCommand.mock.calls[0][0]).toEqual(expect.objectContaining({ type: "add" }));
  });

  it.each(["horizontal-line", "vertical-line", "price-label"] as const)(
    "stages %s until the confirming release",
    (activeTool) => {
      const onCommand = vi.fn();
      const { canvas } = renderCanvas({ activeTool, onCommand });

      fireEvent.pointerDown(canvas, { pointerId: 41, clientX: 60, clientY: 100 });
      expect(onCommand).not.toHaveBeenCalled();
      expect(screen.getByRole("status")).toHaveTextContent("已取第一个点");

      fireEvent.pointerMove(canvas, { pointerId: 41, clientX: 100, clientY: 80 });
      fireEvent.pointerUp(canvas, { pointerId: 41, clientX: 100, clientY: 80 });

      expect(onCommand).toHaveBeenCalledTimes(1);
      expect(onCommand.mock.calls[0][0]).toEqual(expect.objectContaining({
        type: "add",
        drawing: expect.objectContaining({ tool: activeTool }),
      }));
    },
  );

  it.each(["horizontal-line", "vertical-line", "price-label"] as const)(
    "finalizes %s by returning to cursor and selecting the new object",
    (activeTool) => {
      const onCommand = vi.fn();
      const onRequestCursorTool = vi.fn();
      const onSelectDrawing = vi.fn();
      const { canvas } = renderCanvas({ activeTool, onCommand, onRequestCursorTool, onSelectDrawing });

      fireEvent.pointerDown(canvas, { pointerId: 45, clientX: 60, clientY: 100 });
      fireEvent.pointerUp(canvas, { pointerId: 45, clientX: 100, clientY: 80 });

      const command = onCommand.mock.calls[0]?.[0];
      expect(onCommand).toHaveBeenCalledTimes(1);
      expect(onRequestCursorTool).toHaveBeenCalledTimes(1);
      expect(onSelectDrawing).toHaveBeenCalledWith(command.drawing.id);
    },
  );

  it.each(["horizontal-line", "vertical-line", "price-label"] as const)(
    "moves the %s preview with the pointer before release",
    (activeTool) => {
      const methods = new Map<string, ReturnType<typeof vi.fn>>();
      const context = new Proxy({} as Record<string, unknown>, {
        get(target, property: string) {
          if (!methods.has(property)) methods.set(property, vi.fn());
          return methods.get(property);
        },
        set() { return true; },
      }) as unknown as CanvasRenderingContext2D;
      vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context);
      const { canvas } = renderCanvas({ activeTool });

      fireEvent.pointerDown(canvas, { pointerId: 44, clientX: 60, clientY: 100 });
      methods.get("moveTo")?.mockClear();
      fireEvent.pointerMove(canvas, { pointerId: 44, clientX: 100, clientY: 80 });

      // Time anchors snap to the nearest revealed candle (x=90 for the
      // pointer position in this fixture); price anchors remain pixel exact.
      const expectedMove = activeTool === "vertical-line" ? [90, 0] : [0, 80];
      expect(methods.get("moveTo")?.mock.calls).toContainEqual(expectedMove);
    },
  );

  it("cancels a staged horizontal line without writing a command", () => {
    const onCommand = vi.fn();
    const { canvas } = renderCanvas({ activeTool: "horizontal-line", onCommand });

    fireEvent.pointerDown(canvas, { pointerId: 42, clientX: 60, clientY: 100 });
    expect(screen.getByRole("status")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });

    expect(onCommand).not.toHaveBeenCalled();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("creates a new risk/reward object with a 1:1 target while preserving the stop anchor", () => {
    const onCommand = vi.fn();
    const onRequestCursorTool = vi.fn();
    const onSelectDrawing = vi.fn();
    const { canvas } = renderCanvas({ activeTool: "long-risk-reward", onCommand, onRequestCursorTool, onSelectDrawing });

    fireEvent.pointerDown(canvas, { pointerId: 43, clientX: 20, clientY: 80 });
    fireEvent.pointerUp(canvas, { pointerId: 43, clientX: 20, clientY: 80 });
    fireEvent.pointerDown(canvas, { pointerId: 43, clientX: 100, clientY: 120 });
    fireEvent.pointerUp(canvas, { pointerId: 43, clientX: 100, clientY: 120 });

    const command = onCommand.mock.calls[0]?.[0];
    expect(command).toEqual(expect.objectContaining({ type: "add" }));
    const [entry, stop, target] = command.drawing.anchors;
    expect(stop.price).not.toBe(entry.price);
    expect(target.price - entry.price).toBeCloseTo(entry.price - stop.price, 6);
    expect(onRequestCursorTool).toHaveBeenCalledTimes(1);
    expect(onSelectDrawing).toHaveBeenCalledWith(command.drawing.id);
  });

  it("finalizes a parallel channel only after its third width point", () => {
    const onCommand = vi.fn();
    const onRequestCursorTool = vi.fn();
    const onSelectDrawing = vi.fn();
    const { canvas } = renderCanvas({ activeTool: "parallel-channel", onCommand, onRequestCursorTool, onSelectDrawing });

    fireEvent.pointerDown(canvas, { pointerId: 46, clientX: 20, clientY: 100 });
    fireEvent.pointerUp(canvas, { pointerId: 46, clientX: 20, clientY: 100 });
    fireEvent.pointerDown(canvas, { pointerId: 46, clientX: 100, clientY: 80 });
    fireEvent.pointerUp(canvas, { pointerId: 46, clientX: 100, clientY: 80 });
    expect(onCommand).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("已确定通道基线");

    fireEvent.pointerDown(canvas, { pointerId: 46, clientX: 100, clientY: 60 });
    fireEvent.pointerUp(canvas, { pointerId: 46, clientX: 100, clientY: 60 });

    const command = onCommand.mock.calls[0]?.[0];
    expect(onCommand).toHaveBeenCalledTimes(1);
    expect(command.drawing.anchors).toHaveLength(3);
    expect(onRequestCursorTool).toHaveBeenCalledTimes(1);
    expect(onSelectDrawing).toHaveBeenCalledWith(command.drawing.id);
  });

  it.each(["arrow", "fibonacci", "measure"] as const)(
    "finalizes the two-point %s tool once after click-click",
    (activeTool) => {
      const onCommand = vi.fn();
      const onRequestCursorTool = vi.fn();
      const onSelectDrawing = vi.fn();
      const { canvas } = renderCanvas({ activeTool, onCommand, onRequestCursorTool, onSelectDrawing });

      fireEvent.pointerDown(canvas, { pointerId: 47, clientX: 20, clientY: 100 });
      fireEvent.pointerUp(canvas, { pointerId: 47, clientX: 20, clientY: 100 });
      fireEvent.pointerDown(canvas, { pointerId: 47, clientX: 100, clientY: 80 });
      fireEvent.pointerUp(canvas, { pointerId: 47, clientX: 100, clientY: 80 });

      const command = onCommand.mock.calls[0]?.[0];
      expect(onCommand).toHaveBeenCalledTimes(1);
      expect(command.drawing.tool).toBe(activeTool);
      expect(onRequestCursorTool).toHaveBeenCalledTimes(1);
      expect(onSelectDrawing).toHaveBeenCalledWith(command.drawing.id);
    },
  );

  it("keeps the current RR step and preview after an invalid second point", () => {
    const onCommand = vi.fn();
    const { canvas } = renderCanvas({
      activeTool: "long-risk-reward",
      onCommand,
    });

    fireEvent.pointerDown(canvas, { pointerId: 82, clientX: 20, clientY: 100 });
    fireEvent.pointerUp(canvas, { pointerId: 82, clientX: 20, clientY: 100 });
    fireEvent.pointerDown(canvas, { pointerId: 82, clientX: 100, clientY: 100 });
    fireEvent.pointerUp(canvas, { pointerId: 82, clientX: 100, clientY: 100 });

    expect(onCommand).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("已取第一个点");
    expect(screen.getByRole("alert")).toHaveTextContent("止损价不能等于入场价");
  });

  it("shows the current creation stage while a drawing is pending", () => {
    const { canvas } = renderCanvas({ activeTool: "parallel-channel" });

    fireEvent.pointerDown(canvas, { pointerId: 15, clientX: 20, clientY: 100 });
    expect(screen.getByRole("status")).toHaveTextContent("已取第一个点");

    fireEvent.pointerUp(canvas, { pointerId: 15, clientX: 20, clientY: 100 });
    fireEvent.pointerDown(canvas, { pointerId: 15, clientX: 100, clientY: 80 });
    fireEvent.pointerUp(canvas, { pointerId: 15, clientX: 100, clientY: 80 });
    expect(screen.getByRole("status")).toHaveTextContent("已确定通道基线");
  });

  it("keeps the dynamic preview updating after the first click releases capture", () => {
    const methods = new Map<string, ReturnType<typeof vi.fn>>();
    const context = new Proxy({} as Record<string, unknown>, {
      get(target, property: string) {
        if (!methods.has(property)) methods.set(property, vi.fn());
        return methods.get(property);
      },
      set() { return true; },
    }) as unknown as CanvasRenderingContext2D;
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context);
    const { canvas } = renderCanvas({ activeTool: "trend-line" });

    fireEvent.pointerDown(canvas, { pointerId: 16, clientX: 20, clientY: 100 });
    fireEvent.pointerUp(canvas, { pointerId: 16, clientX: 20, clientY: 100 });
    methods.get("lineTo")?.mockClear();
    fireEvent.pointerMove(canvas, { pointerId: 16, clientX: 100, clientY: 80 });

    expect(methods.get("lineTo")).toHaveBeenCalled();
  });

  it("lets a non-cursor tool receive clicks over a text card", () => {
    const textDrawing: NormalizedDrawing = {
      version: 2,
      episodeId: "episode-1",
      id: "text-1",
      name: "文字标注",
      tool: "text",
      anchors: [{ time: candles[0].time, price: 100 }],
      style: { color: "#e7edf6", lineWidth: 1, opacity: 0.95 },
      hidden: false,
      locked: false,
      visibleOn: "all",
      stage: "during-replay",
      zIndex: 0,
      createdAtCursor: candles[2].time,
      placement: "anchor",
      canvasX: 0.2,
      canvasY: 0.2,
      text: "existing text card",
      textWidth: 120,
      fontSize: 14,
      background: "transparent",
    };
    renderCanvas({ activeTool: "trend-line", drawings: [textDrawing] });

    expect(document.querySelector(".drawing-text-card-text-layer")).toHaveStyle({ pointerEvents: "none" });
  });

  it("cancels an unfinished creation with Escape without writing a command", () => {
    const onCommand = vi.fn();
    const { canvas } = renderCanvas({ onCommand });
    fireEvent.pointerDown(canvas, { pointerId: 11, clientX: 20, clientY: 100 });
    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.pointerDown(canvas, { pointerId: 11, clientX: 100, clientY: 80 });
    fireEvent.pointerUp(canvas, { pointerId: 11, clientX: 100, clientY: 80 });

    expect(onCommand).not.toHaveBeenCalled();
  });

  it("does not cancel a creation while Escape belongs to an IME composition", () => {
    const onCommand = vi.fn();
    const { canvas } = renderCanvas({ onCommand });
    fireEvent.pointerDown(canvas, { pointerId: 13, clientX: 20, clientY: 100 });
    fireEvent.pointerUp(canvas, { pointerId: 13, clientX: 20, clientY: 100 });
    const imeEscape = new KeyboardEvent("keydown", { key: "Escape", bubbles: true });
    Object.defineProperty(imeEscape, "isComposing", { value: true });
    Object.defineProperty(imeEscape, "keyCode", { value: 229 });
    window.dispatchEvent(imeEscape);
    fireEvent.pointerDown(canvas, { pointerId: 13, clientX: 100, clientY: 80 });
    fireEvent.pointerUp(canvas, { pointerId: 13, clientX: 100, clientY: 80 });

    expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("does not create a zero-length trend for a sub-three-pixel gesture", () => {
    const onCommand = vi.fn();
    const { canvas } = renderCanvas({ onCommand });
    fireEvent.pointerDown(canvas, { pointerId: 12, clientX: 20, clientY: 100 });
    fireEvent.pointerUp(canvas, { pointerId: 12, clientX: 22, clientY: 101 });

    expect(onCommand).not.toHaveBeenCalled();
  });

  it("does not commit a channel with zero width", () => {
    const onCommand = vi.fn();
    const { canvas } = renderCanvas({ activeTool: "parallel-channel", onCommand });

    fireEvent.pointerDown(canvas, { pointerId: 14, clientX: 20, clientY: 100 });
    fireEvent.pointerUp(canvas, { pointerId: 14, clientX: 20, clientY: 100 });
    fireEvent.pointerDown(canvas, { pointerId: 14, clientX: 100, clientY: 80 });
    fireEvent.pointerUp(canvas, { pointerId: 14, clientX: 100, clientY: 80 });
    fireEvent.pointerDown(canvas, { pointerId: 14, clientX: 100, clientY: 80 });
    fireEvent.pointerUp(canvas, { pointerId: 14, clientX: 100, clientY: 80 });

    expect(onCommand).not.toHaveBeenCalled();
  });

  it("clears an unfinished channel baseline when the tool changes", () => {
    const onCommand = vi.fn();
    const view = renderCanvas({ activeTool: "parallel-channel", onCommand });

    fireEvent.pointerDown(view.canvas, { pointerId: 2, clientX: 20, clientY: 100 });
    fireEvent.pointerMove(view.canvas, { pointerId: 2, clientX: 100, clientY: 80 });
    fireEvent.pointerUp(view.canvas, { pointerId: 2, clientX: 100, clientY: 80 });
    expect(onCommand).not.toHaveBeenCalled();

    view.rerender(
      <div className="chart-stage" data-testid="chart-stage">
        <DrawingCanvas {...(view.props as Parameters<typeof DrawingCanvas>[0])} activeTool="cursor" />
      </div>,
    );
    view.rerender(
      <div className="chart-stage" data-testid="chart-stage">
        <DrawingCanvas {...(view.props as Parameters<typeof DrawingCanvas>[0])} activeTool="parallel-channel" />
      </div>,
    );
    const canvas = screen.getByRole("img", { name: "绘图画布" });
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
      x: 0, y: 0, width: 160, height: 200, top: 0, left: 0, right: 160, bottom: 200,
      toJSON: () => ({}),
    });
    fireEvent.pointerDown(canvas, { pointerId: 3, clientX: 140, clientY: 70 });
    fireEvent.pointerUp(canvas, { pointerId: 3, clientX: 140, clientY: 70 });

    expect(onCommand).not.toHaveBeenCalled();
  });

  it("drops an empty text draft when switching tools", () => {
    const view = renderCanvas({ activeTool: "text" });
    fireEvent.pointerDown(view.canvas, { pointerId: 4, clientX: 20, clientY: 100 });
    expect(screen.getByRole("textbox", { name: "文字标注" })).toBeInTheDocument();
    expect(document.querySelector(".drawing-text-editor-shell")).toHaveStyle({ pointerEvents: "auto" });

    view.rerender(
      <div className="chart-stage" data-testid="chart-stage">
        <DrawingCanvas {...(view.props as Parameters<typeof DrawingCanvas>[0])} activeTool="trend-line" />
      </div>,
    );

    expect(screen.queryByRole("textbox", { name: "文字标注" })).not.toBeInTheDocument();
  });

  it("keeps non-empty text content when switching tools", () => {
    const view = renderCanvas({ activeTool: "text" });
    fireEvent.pointerDown(view.canvas, { pointerId: 5, clientX: 20, clientY: 100 });
    const editor = screen.getByRole("textbox", { name: "文字标注" });
    fireEvent.change(editor, { target: { value: "保留这段文字" } });

    view.rerender(
      <div className="chart-stage" data-testid="chart-stage">
        <DrawingCanvas {...(view.props as Parameters<typeof DrawingCanvas>[0])} activeTool="trend-line" />
      </div>,
    );

    expect(screen.getByRole("textbox", { name: "文字标注" })).toHaveValue("保留这段文字");
  });
});
