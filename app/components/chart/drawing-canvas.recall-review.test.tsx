import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRef, type Ref } from "react";

import type { NormalizedDrawing } from "../../lib/chart/drawings";
import { textLayout } from "../../lib/chart/text-geometry";
import {
  DrawingCanvas,
  paintDrawingScene,
  type DrawingCanvasHandle,
} from "./drawing-canvas";

const candles = [
  {
    time: "2026-01-01T00:00:00.000Z",
    open: 100,
    high: 105,
    low: 95,
    close: 102,
    volume: 10,
  },
  {
    time: "2026-01-02T00:00:00.000Z",
    open: 102,
    high: 108,
    low: 98,
    close: 106,
    volume: 12,
  },
];

const adapter = {
  timeToX: (time: string) => (time === candles[0].time ? 10 : 80),
  priceToY: (price: number) => 200 - price,
  xToTime: (x: number) => (x < 50 ? candles[0].time : "2026-02-01T00:00:00.000Z"),
  yToPrice: (y: number) => 200 - y,
};

function fakeContext() {
  return {
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    setLineDash: vi.fn(),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    strokeRect: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn((text: string) => ({ width: text.length * 7 })),
    globalAlpha: 1,
    strokeStyle: "",
    fillStyle: "",
    lineWidth: 1,
    font: "",
  } as unknown as CanvasRenderingContext2D;
}

function savedDrawing(
  input: Pick<NormalizedDrawing, "id" | "tool" | "anchors"> &
    Partial<NormalizedDrawing>,
): NormalizedDrawing {
  return {
    version: 2,
    episodeId: "episode-1",
    name: input.tool,
    style: { color: "#2f80ed", lineWidth: 1.5, opacity: 1 },
    hidden: false,
    locked: false,
    visibleOn: "all",
    stage: "during-replay",
    zIndex: 0,
    createdAtCursor: candles[1].time,
    ...input,
  };
}

function renderCanvas(
  overrides: Record<string, unknown> = {},
  ref?: Ref<DrawingCanvasHandle>,
  dimensions = { width: 100, height: 100 },
) {
  const context = fakeContext();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(private readonly callback: ResizeObserverCallback) {}

      observe(target: Element) {
        this.callback(
          [
            {
              target,
              contentRect: dimensions,
            } as ResizeObserverEntry,
          ],
          this as unknown as ResizeObserver,
        );
      }

      disconnect() {}
    },
  );

  const props = {
    episodeId: "episode-1",
    candles,
    cursor: candles[1].time,
    drawings: [] as NormalizedDrawing[],
    selectedDrawingId: null,
    activeTool: "text" as const,
    plannedRiskAmount: undefined,
    currency: "HKD",
    onSelectDrawing: vi.fn(),
    onCommand: vi.fn(),
    coordinateAdapter: adapter,
    // Keep the legacy editor tests on the compatibility path. ReplayChart's
    // real v1 caller opts into the staged anchor -> preview -> editor flow.
    multilineText: false,
    ...overrides,
  };
  render(
    <div className="chart-stage" data-testid="chart-stage">
      <DrawingCanvas ref={ref} {...(props as Parameters<typeof DrawingCanvas>[0])} />
    </div>,
  );
  const canvas = screen.getByRole("img", { name: "绘图画布" });
  const stage = screen.getByTestId("chart-stage");
  vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
    x: 0,
    y: 0,
    width: dimensions.width,
    height: dimensions.height,
    top: 0,
    left: 0,
    right: dimensions.width,
    bottom: dimensions.height,
    toJSON: () => ({}),
  });
  return { canvas, stage, props, context };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("recall chart Text review", () => {
  it("shows the exact revealed source price and Beijing bar time for selected anchored text", () => {
    const drawing = savedDrawing({
      id: "source-readout",
      tool: "text",
      anchors: [{ time: candles[0].time, price: 101.25 }],
      placement: "anchor",
      canvasX: 0.3,
      canvasY: 0.2,
      text: "精确来源",
    });

    renderCanvas({
      activeTool: "cursor",
      drawings: [drawing],
      selectedDrawingId: drawing.id,
    });

    const readout = screen.getByRole("status", { name: `文字锚点 ${drawing.id}` });
    expect(readout).toHaveTextContent("101.25");
    expect(readout).toHaveTextContent("北京时间");
    expect(readout).toHaveTextContent("2026-01-01 08:00:00");
  });

  it("keeps the selected source readout clear of Text operation controls", () => {
    const drawing = savedDrawing({
      id: "source-readout-controls",
      tool: "text",
      anchors: [{ time: candles[0].time, price: 101.25 }],
      placement: "anchor",
      canvasX: 0.4,
      canvasY: 0.5,
      textWidth: 300,
      text: "完整原文第一行\n完整原文第二行\n完整原文第三行\n完整原文第四行",
    });

    renderCanvas({ activeTool: "cursor", drawings: [drawing], selectedDrawingId: drawing.id }, undefined, { width: 800, height: 600 });

    const rect = (element: HTMLElement, fallbackWidth = 24, fallbackHeight = 24) => {
      const left = Number.parseFloat(element.style.left);
      const top = Number.parseFloat(element.style.top);
      const width = Number.parseFloat(element.style.width) || fallbackWidth;
      const height = Number.parseFloat(element.style.height) || fallbackHeight;
      return { left, top, right: left + width, bottom: top + height };
    };
    const readout = screen.getByRole("status", { name: `文字锚点 ${drawing.id}` });
    const readoutRect = rect(readout, 190, Number.parseFloat(readout.style.minHeight));
    const overlaps = (left: ReturnType<typeof rect>, right: ReturnType<typeof rect>) =>
      left.left < right.right && right.left < left.right && left.top < right.bottom && right.top < left.bottom;
    for (const control of [
      screen.getByRole("button", { name: `移动文字 ${drawing.id}` }),
      screen.getByRole("button", { name: `移动市场锚点 ${drawing.id}` }),
      screen.getByRole("button", { name: `编辑文字 ${drawing.id}` }),
      screen.getByRole("button", { name: /展开文字/ }),
    ]) {
      expect(overlaps(readoutRect, rect(control, 64))).toBe(false);
    }
  });

  it("keeps the narrow expanded readout away from the bottom edit fallback", () => {
    const drawing = savedDrawing({
      id: "narrow-source-readout-controls",
      tool: "text",
      anchors: [{ time: candles[0].time, price: 101.25 }],
      placement: "anchor",
      canvasX: 0.4,
      canvasY: 0.5,
      textWidth: 300,
      text: "原文第一行。原文第二行。原文第三行。原文第四行。原文第五行。",
    });
    renderCanvas({ activeTool: "cursor", drawings: [drawing], selectedDrawingId: drawing.id }, undefined, { width: 244, height: 231 });

    const rect = (element: HTMLElement, fallbackWidth = 24, fallbackHeight = 24) => {
      const left = Number.parseFloat(element.style.left);
      const top = Number.parseFloat(element.style.top);
      const width = Number.parseFloat(element.style.width) || fallbackWidth;
      const height = Number.parseFloat(element.style.height) || fallbackHeight;
      return { left, top, right: left + width, bottom: top + height };
    };
    const readout = screen.getByRole("status", { name: `文字锚点 ${drawing.id}` });
    const edit = screen.getByRole("button", { name: `编辑文字 ${drawing.id}` });
    const readoutRect = rect(readout, 190, Number.parseFloat(readout.style.minHeight));
    const editRect = rect(edit, 64, 22);
    expect(readoutRect.right <= editRect.left || editRect.right <= readoutRect.left || readoutRect.bottom <= editRect.top || editRect.bottom <= readoutRect.top).toBe(true);
    expect(Number.parseFloat(edit.style.top)).toBeGreaterThan(Number.parseFloat(readout.style.top));
  });

  it("updates the revealed source readout while moving the text anchor and after commit", () => {
    const onCommand = vi.fn();
    const drawing = savedDrawing({
      id: "source-readout-drag",
      tool: "text",
      anchors: [{ time: candles[0].time, price: 100 }],
      placement: "anchor",
      canvasX: 0.3,
      canvasY: 0.2,
      text: "随锚点更新",
    });
    const { stage } = renderCanvas({
      activeTool: "cursor",
      drawings: [drawing],
      selectedDrawingId: drawing.id,
      onCommand,
    });

    const anchor = screen.getByRole("button", { name: `移动市场锚点 ${drawing.id}` });
    fireEvent.pointerDown(anchor, { pointerId: 88, clientX: 10, clientY: 100 });
    fireEvent.pointerMove(stage, { pointerId: 88, clientX: 80, clientY: 90 });
    expect(screen.getByRole("status", { name: `文字锚点 ${drawing.id}` })).toHaveTextContent("110.00");
    fireEvent.pointerUp(stage, { pointerId: 88, clientX: 80, clientY: 90 });

    expect(onCommand).toHaveBeenCalledWith(expect.objectContaining({
      type: "replace",
      drawing: expect.objectContaining({
        id: drawing.id,
        anchors: [expect.objectContaining({ time: candles[1].time, price: 110 })],
      }),
    }));
  });

  it("keeps the Text anchor handle in the live preview and restores it on Escape", () => {
    const onCommand = vi.fn();
    const drawing = savedDrawing({
      id: "source-readout-live-handle",
      tool: "text",
      anchors: [{ time: candles[0].time, price: 100 }],
      placement: "anchor",
      canvasX: 0.3,
      canvasY: 0.2,
      text: "拖动中同步",
    });
    const { stage } = renderCanvas({
      activeTool: "cursor",
      drawings: [drawing],
      selectedDrawingId: drawing.id,
      onCommand,
    });

    const anchor = screen.getByRole("button", { name: `移动市场锚点 ${drawing.id}` });
    const initialLeft = Number.parseFloat(anchor.style.left);
    const initialTop = Number.parseFloat(anchor.style.top);
    fireEvent.pointerDown(anchor, { pointerId: 89, clientX: 10, clientY: 100 });
    fireEvent.pointerMove(stage, { pointerId: 89, clientX: 80, clientY: 90 });

    const liveAnchor = screen.getByRole("button", { name: `移动市场锚点 ${drawing.id}` });
    expect(Number.parseFloat(liveAnchor.style.left)).toBeCloseTo(68, 5);
    expect(Number.parseFloat(liveAnchor.style.top)).toBeCloseTo(78, 5);
    expect(screen.getByRole("status", { name: `文字锚点 ${drawing.id}` })).toHaveTextContent("110.00");

    fireEvent.keyDown(window, { key: "Escape" });

    const restoredAnchor = screen.getByRole("button", { name: `移动市场锚点 ${drawing.id}` });
    expect(Number.parseFloat(restoredAnchor.style.left)).toBeCloseTo(initialLeft, 5);
    expect(Number.parseFloat(restoredAnchor.style.top)).toBeCloseTo(initialTop, 5);
    expect(screen.getByRole("status", { name: `文字锚点 ${drawing.id}` })).toHaveTextContent("100.00");
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("paints Text with a real canvas font family and a numbered anchor card", () => {
    const context = fakeContext();
    const drawing = savedDrawing({
      id: "numbered-card",
      tool: "text",
      anchors: [{ time: candles[0].time, price: 100 }],
      placement: "anchor",
      canvasX: 0.3,
      canvasY: 0.2,
      text: "第一行",
    });

    paintDrawingScene(context, {
      width: 100,
      height: 100,
      drawings: [drawing],
      pointFor: () => ({ x: 10, y: 40 }),
      pointForDrawing: () => ({ x: 30, y: 20 }),
      currency: "HKD",
    });

    expect(context.font).toContain("14px");
    expect(context.font).not.toContain("var(");
    expect(context.fillText).toHaveBeenCalledWith("1", expect.any(Number), expect.any(Number));
  });

  it("keeps expanded Text content in canvas capture output", () => {
    const context = fakeContext();
    const drawing = savedDrawing({
      id: "expanded-capture",
      tool: "text",
      anchors: [{ time: candles[0].time, price: 100 }],
      placement: "anchor",
      canvasX: 0.2,
      canvasY: 0.2,
      text: "第一行\n第二行\n第三行",
    });

    paintDrawingScene(context, {
      width: 100,
      height: 100,
      drawings: [drawing],
      pointFor: () => ({ x: 10, y: 40 }),
      pointForDrawing: () => ({ x: 30, y: 20 }),
      currency: "HKD",
      expandedTextIds: new Set([drawing.id]),
      plotWidth: 100,
      plotHeight: 100,
    }, false);

    expect(context.fillText).toHaveBeenCalledWith(expect.stringMatching(/^第一/), expect.any(Number), expect.any(Number));
  });

  it("keeps a visible connector when the anchor starts inside its card", () => {
    const context = fakeContext();
    const drawing = savedDrawing({
      id: "same-point-card",
      tool: "text",
      anchors: [{ time: candles[0].time, price: 180 }],
      placement: "anchor",
      canvasX: 0.1,
      canvasY: 0.2,
      text: "同点连线",
      background: "#101722",
    });
    paintDrawingScene(context, {
      width: 100,
      height: 100,
      drawings: [drawing],
      pointFor: () => ({ x: 10, y: 20 }),
      pointForDrawing: () => ({ x: 10, y: 20 }),
      currency: "HKD",
    });
    expect(context.lineTo).toHaveBeenCalledWith(10, 20);
    const lineToMock = context.lineTo as unknown as { mock: { invocationCallOrder: number[] } };
    const fillRectMock = context.fillRect as unknown as { mock: { invocationCallOrder: number[] } };
    expect(lineToMock.mock.invocationCallOrder[0]).toBeGreaterThan(fillRectMock.mock.invocationCallOrder[0]);
  });

  it("selects an anchored text card when its connector is clicked", () => {
    const onSelectDrawing = vi.fn();
    const drawing = savedDrawing({
      id: "connector-hit",
      tool: "text",
      anchors: [{ time: candles[0].time, price: 180 }],
      placement: "anchor",
      canvasX: 0.7,
      canvasY: 0.2,
      text: "连线命中",
    });
    const { canvas } = renderCanvas({ activeTool: "cursor", drawings: [drawing], onSelectDrawing });
    fireEvent.pointerDown(canvas, { pointerId: 30, clientX: 23, clientY: 20 });
    expect(onSelectDrawing).toHaveBeenCalledWith("connector-hit");
  });

  it("selects Text without opening the editor and exposes an explicit edit entry", () => {
    const onSelectDrawing = vi.fn();
    const onDrawingInteractionStart = vi.fn();
    const drawing = savedDrawing({
      id: "select-before-edit",
      tool: "text",
      anchors: [{ time: candles[0].time, price: 180 }],
      placement: "anchor",
      canvasX: 0.7,
      canvasY: 0.2,
      text: "只读选择",
    });
    const { canvas } = renderCanvas({
      activeTool: "cursor",
      drawings: [drawing],
      selectedDrawingId: drawing.id,
      onSelectDrawing,
      onDrawingInteractionStart,
    });

    fireEvent.pointerDown(canvas, { pointerId: 31, clientX: 23, clientY: 20 });
    expect(onSelectDrawing).toHaveBeenCalledWith("select-before-edit");
    expect(screen.queryByRole("textbox", { name: "文字标注" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /编辑文字 select-before-edit/ })).toBeInTheDocument();
    expect(onDrawingInteractionStart).not.toHaveBeenCalled();
  });

  it("leaves replay toolbar buttons outside Canvas ownership", () => {
    const onSelectDrawing = vi.fn();
    const onDrawingInteractionStart = vi.fn();
    const drawing = savedDrawing({
      id: "toolbar-overlap-risk",
      tool: "long-risk-reward",
      anchors: [
        { time: candles[0].time, price: 100 },
        { time: candles[1].time, price: 90 },
        { time: candles[1].time, price: 110 },
      ],
    });
    const { stage } = renderCanvas({
      activeTool: "cursor",
      drawings: [drawing],
      onSelectDrawing,
      onDrawingInteractionStart,
    });
    const toolbar = document.createElement("div");
    toolbar.className = "replay-chart-compact-controls";
    const button = document.createElement("button");
    button.className = "replay-chart-plan-hit";
    button.textContent = "显示计划价格";
    toolbar.appendChild(button);
    stage.appendChild(toolbar);

    fireEvent.pointerDown(button, { pointerId: 32, clientX: 20, clientY: 20 });

    expect(onSelectDrawing).not.toHaveBeenCalled();
    expect(onDrawingInteractionStart).not.toHaveBeenCalled();
  });

  it("keeps Text edit controls clickable when the Canvas layer is pointer-transparent", () => {
    const onSelectDrawing = vi.fn();
    const onDrawingInteractionStart = vi.fn();
    const drawing = savedDrawing({
      id: "pointer-transparent-text",
      tool: "text",
      anchors: [{ time: candles[0].time, price: 180 }],
      placement: "anchor",
      canvasX: 0.7,
      canvasY: 0.2,
      text: "可编辑正文",
    });
    const { canvas } = renderCanvas({
      activeTool: "cursor",
      drawings: [drawing],
      selectedDrawingId: drawing.id,
      onSelectDrawing,
      onDrawingInteractionStart,
    });
    const layer = canvas.parentElement as HTMLElement;
    layer.style.pointerEvents = "none";

    const edit = screen.getByRole("button", { name: `编辑文字 ${drawing.id}` });
    expect(edit).toHaveStyle({ pointerEvents: "auto" });
    fireEvent.click(edit);

    expect(screen.getByRole("textbox", { name: "文字标注" })).toBeInTheDocument();
    expect(onDrawingInteractionStart).toHaveBeenCalledTimes(1);
    expect(onSelectDrawing).not.toHaveBeenCalled();
  });

  it("keeps the transparent Canvas root above plan hits while selected Text controls stay reachable", () => {
    const drawing = savedDrawing({
      id: "plan-overlap-text",
      tool: "text",
      anchors: [{ time: candles[0].time, price: 180 }],
      placement: "anchor",
      canvasX: 0.7,
      canvasY: 0.2,
      text: "计划价格重叠",
    });
    const { canvas, stage } = renderCanvas({
      activeTool: "cursor",
      drawings: [drawing],
      selectedDrawingId: drawing.id,
    });
    const planHit = document.createElement("button");
    planHit.className = "replay-chart-plan-hit";
    planHit.style.position = "absolute";
    planHit.style.zIndex = "8";
    stage.insertBefore(planHit, canvas.parentElement);

    expect(canvas.parentElement).toHaveStyle({ zIndex: "9", pointerEvents: "none" });
    for (const name of [
      `移动文字 ${drawing.id}`,
      `移动市场锚点 ${drawing.id}`,
      `编辑文字 ${drawing.id}`,
    ]) {
      const control = screen.getByRole("button", { name });
      expect(control).toHaveStyle({ zIndex: "9", pointerEvents: "auto" });
      expect(Number(control.style.zIndex)).toBeGreaterThan(Number(planHit.style.zIndex));
    }
  });

  it("provides an expand control while keeping the full text in the editor", () => {
    const drawing = savedDrawing({
      id: "long-card",
      tool: "text",
      anchors: [{ time: candles[0].time, price: 100 }],
      placement: "anchor",
      canvasX: 0.2,
      canvasY: 0.2,
      text: "第一行\n第二行\n第三行\n第四行",
    });
    const { stage } = renderCanvas({ activeTool: "cursor", drawings: [drawing], selectedDrawingId: drawing.id });

    const toggle = screen.getByRole("button", { name: /展开文字/ });
    expect(toggle).toBeInTheDocument();
    expect(toggle).toHaveStyle({ minWidth: "24px", minHeight: "24px", fontSize: "10px" });
    fireEvent.click(toggle);
    expect(screen.getByLabelText(`文字内容 ${drawing.id}`)).toHaveTextContent("第四行");
    fireEvent.click(screen.getByRole("button", { name: `编辑文字 ${drawing.id}` }));

    expect(screen.getByRole("textbox", { name: "文字标注" })).toHaveValue(
      "第一行\n第二行\n第三行\n第四行",
    );
  });

  it("keeps expanded text readable before and after selection", () => {
    const drawing = savedDrawing({
      id: "expanded-unselected",
      tool: "text",
      anchors: [{ time: candles[0].time, price: 100 }],
      placement: "anchor",
      canvasX: 0.2,
      canvasY: 0.2,
      text: "第一行\n第二行\n第三行\n第四行",
    });
    renderCanvas({ activeTool: "cursor", drawings: [drawing] });
    const toggle = screen.getByRole("button", { name: /展开文字/ });
    fireEvent.click(toggle);
    const layer = screen.getByLabelText(`文字内容 ${drawing.id}`);
    expect(layer).toHaveTextContent("第四行");
    expect(layer).toHaveStyle({ opacity: "1", pointerEvents: "auto" });

    cleanup();
    renderCanvas({ activeTool: "cursor", drawings: [drawing], selectedDrawingId: drawing.id });
    fireEvent.click(screen.getByRole("button", { name: /展开文字/ }));
    const selectedLayer = screen.getByLabelText(`文字内容 ${drawing.id}`);
    expect(selectedLayer).toHaveTextContent("第四行");
    expect(selectedLayer).toHaveStyle({ opacity: "1", pointerEvents: "auto" });
  });

  it("reserves the bottom operation lane when expanded text is scrolled to its last line", () => {
    const drawing = savedDrawing({
      id: "expanded-bottom-lane",
      tool: "text",
      anchors: [{ time: candles[0].time, price: 100 }],
      placement: "anchor",
      canvasX: 0.2,
      canvasY: 0.2,
      textWidth: 300,
      text: Array.from({ length: 40 }, (_, index) => `第${index + 1}行完整原文`).join("\n"),
    });

    renderCanvas({ activeTool: "cursor", drawings: [drawing] }, undefined, { width: 800, height: 600 });
    fireEvent.click(screen.getByRole("button", { name: /展开文字/ }));
    const ordinaryLayer = screen.getByLabelText(`文字内容 ${drawing.id}`);
    expect(ordinaryLayer).toHaveStyle({
      overflow: "auto",
      padding: "4px 4px 48px",
    });
    expect(ordinaryLayer.textContent).toContain("第40行完整原文");

    cleanup();
    renderCanvas({ activeTool: "cursor", drawings: [drawing], selectedDrawingId: drawing.id }, undefined, { width: 800, height: 600 });
    fireEvent.click(screen.getByRole("button", { name: /展开文字/ }));
    const selectedLayer = screen.getByLabelText(`文字内容 ${drawing.id}`);
    expect(selectedLayer).toHaveStyle({
      overflow: "auto",
      padding: "4px 4px 48px",
    });
    expect(selectedLayer.textContent).toContain("第40行完整原文");
  });

  it("keeps a selected Text surface above an opaque risk label fallback", async () => {
    const risk = savedDrawing({
      id: "overlapping-risk-label",
      tool: "long-risk-reward",
      anchors: [
        { time: candles[0].time, price: 100 },
        { time: candles[1].time, price: 90 },
        { time: candles[1].time, price: 120 },
      ],
    });
    const text = savedDrawing({
      id: "foreground-text-card",
      tool: "text",
      anchors: [{ time: candles[0].time, price: 100 }],
      placement: "anchor",
      canvasX: 0.2,
      canvasY: 0.2,
      text: "选中文字应保持可读\n第二行正文\n第三行正文",
    });
    renderCanvas({
      activeTool: "cursor",
      drawings: [risk, text],
      selectedDrawingId: text.id,
      plannedRiskAmount: "1000",
    }, undefined, { width: 180, height: 150 });

    const fallback = await waitFor(() => screen.findByRole("status", { name: "绘图标签 overlapping-risk-label" }));
    const layer = screen.getByLabelText(`文字内容 ${text.id}`);
    expect(Number(layer.style.zIndex)).toBeGreaterThan(Number(fallback.style.zIndex));
    expect(layer).toHaveStyle({ zIndex: "7" });
    expect(layer).toHaveStyle({ background: "#101722" });
    expect(screen.getByRole("button", { name: `展开文字 ${text.id}` })).toHaveStyle({ zIndex: "8" });
  });

  it("moves a new anchored card without changing its time-price anchor", () => {
    const onCommand = vi.fn();
    const drawing = savedDrawing({
      id: "anchored-card-drag",
      tool: "text",
      anchors: [{ time: candles[0].time, price: 100 }],
      placement: "anchor",
      canvasX: 0.2,
      canvasY: 0.2,
      textWidth: 80,
      text: "固定",
    });
    const { stage } = renderCanvas({
      activeTool: "cursor",
      drawings: [drawing],
      selectedDrawingId: drawing.id,
      onCommand,
    });

    const move = screen.getByRole("button", { name: `移动文字 ${drawing.id}` });
    expect(move).toHaveStyle({ cursor: "move" });
    fireEvent.pointerDown(move, { pointerId: 17, clientX: 14, clientY: 14 });
    expect(move).toHaveStyle({ cursor: "grabbing" });
    expect(stage).toHaveStyle({ cursor: "grabbing" });
    fireEvent.pointerMove(stage, { pointerId: 17, clientX: 40, clientY: 30 });
    expect(move).toHaveStyle({ cursor: "grabbing" });
    fireEvent.pointerUp(stage, { pointerId: 17, clientX: 40, clientY: 30 });
    expect(screen.getByRole("button", { name: `移动文字 ${drawing.id}` })).toHaveStyle({ cursor: "move" });

    expect(onCommand).toHaveBeenCalledWith(expect.objectContaining({
      type: "replace",
      drawing: expect.objectContaining({
        id: drawing.id,
        anchors: drawing.anchors,
        canvasX: expect.closeTo(0.42, 5),
        canvasY: expect.closeTo(0.36, 5),
      }),
    }));
  });

  it("moves only the real market anchor from the anchor grip", () => {
    const onCommand = vi.fn();
    const drawing = savedDrawing({
      id: "anchored-card-anchor-drag",
      tool: "text",
      anchors: [{ time: candles[0].time, price: 100 }],
      placement: "anchor",
      canvasX: 0.2,
      canvasY: 0.2,
      textWidth: 80,
      text: "锚点",
    });
    const { stage } = renderCanvas({
      activeTool: "cursor",
      drawings: [drawing],
      selectedDrawingId: drawing.id,
      onCommand,
    });

    const anchor = screen.getByRole("button", { name: `移动市场锚点 ${drawing.id}` });
    expect(anchor).toHaveStyle({ cursor: "move" });
    fireEvent.pointerDown(anchor, { pointerId: 18, clientX: 10, clientY: 40 });
    expect(anchor).toHaveStyle({ cursor: "grabbing" });
    expect(stage).toHaveStyle({ cursor: "grabbing" });
    fireEvent.pointerMove(stage, { pointerId: 18, clientX: 40, clientY: 30 });
    expect(anchor).toHaveStyle({ cursor: "grabbing" });
    fireEvent.pointerUp(stage, { pointerId: 18, clientX: 40, clientY: 30 });
    expect(screen.getByRole("button", { name: `移动市场锚点 ${drawing.id}` })).toHaveStyle({ cursor: "move" });

    expect(onCommand).toHaveBeenCalledWith(expect.objectContaining({
      type: "replace",
      drawing: expect.objectContaining({
        id: drawing.id,
        canvasX: drawing.canvasX,
        canvasY: drawing.canvasY,
        anchors: [expect.objectContaining({ time: candles[0].time, price: 110 })],
      }),
    }));
  });

  it("keeps Text anchor drags on revealed bars", () => {
    const onCommand = vi.fn();
    const drawing = savedDrawing({
      id: "revealed-anchor-drag",
      tool: "text",
      anchors: [{ time: candles[0].time, price: 100 }],
      placement: "anchor",
      canvasX: 0.2,
      canvasY: 0.2,
      text: "仅可见行情",
    });
    const { stage } = renderCanvas({
      activeTool: "cursor",
      cursor: candles[0].time,
      drawings: [drawing],
      selectedDrawingId: drawing.id,
      onCommand,
    });
    const anchor = screen.getByRole("button", { name: `移动市场锚点 ${drawing.id}` });
    fireEvent.pointerDown(anchor, { pointerId: 19, clientX: 10, clientY: 40 });
    fireEvent.pointerMove(stage, { pointerId: 19, clientX: 100, clientY: 30 });
    fireEvent.pointerUp(stage, { pointerId: 19, clientX: 100, clientY: 30 });

    expect(onCommand).toHaveBeenCalledWith(expect.objectContaining({
      type: "replace",
      drawing: expect.objectContaining({
        anchors: [expect.objectContaining({ time: candles[0].time })],
      }),
    }));
  });

  it("keeps a legacy anchored Text market anchor when its frame is first moved", () => {
    const onCommand = vi.fn();
    const drawing = savedDrawing({
      id: "design-system-original-note",
      tool: "text",
      anchors: [{ time: candles[0].time, price: 100 }],
      placement: "anchor",
      textWidth: 300,
      text: "历史原文保持完整尺寸",
    });
    const { stage } = renderCanvas({
      activeTool: "cursor",
      drawings: [drawing],
      selectedDrawingId: drawing.id,
      onCommand,
    });

    const move = screen.getByRole("button", { name: `移动文字 ${drawing.id}` });
    fireEvent.pointerDown(move, { pointerId: 23, clientX: 14, clientY: 14 });
    fireEvent.pointerMove(stage, { pointerId: 23, clientX: 40, clientY: 30 });
    fireEvent.pointerUp(stage, { pointerId: 23, clientX: 40, clientY: 30 });

    expect(onCommand).toHaveBeenCalledWith(expect.objectContaining({
      type: "replace",
      drawing: expect.objectContaining({
        id: drawing.id,
        anchors: drawing.anchors,
        textWidth: 300,
        canvasX: expect.any(Number),
        canvasY: expect.any(Number),
      }),
    }));
  });

  it("keeps legacy Text frame and market-anchor hit rectangles distinct at fine size", () => {
    const drawing = savedDrawing({
      id: "design-system-original-note",
      tool: "text",
      anchors: [{ time: candles[0].time, price: 100 }],
      placement: "anchor",
      textWidth: 300,
      text: "历史原文保持完整尺寸",
    });
    renderCanvas({ activeTool: "cursor", drawings: [drawing], selectedDrawingId: drawing.id });
    const move = screen.getByRole("button", { name: `移动文字 ${drawing.id}` });
    const anchor = screen.getByRole("button", { name: `移动市场锚点 ${drawing.id}` });
    const rect = (button: HTMLElement) => ({
      left: Number.parseFloat(button.style.left),
      top: Number.parseFloat(button.style.top),
      right: Number.parseFloat(button.style.left) + Number.parseFloat(button.style.width),
      bottom: Number.parseFloat(button.style.top) + Number.parseFloat(button.style.height),
    });
    const moveRect = rect(move);
    const anchorRect = rect(anchor);
    expect(moveRect.right <= anchorRect.left || anchorRect.right <= moveRect.left || moveRect.bottom <= anchorRect.top || anchorRect.bottom <= moveRect.top).toBe(true);
  });

  it.each([false, true])("keeps Text movement hitboxes clear of anchor and card controls (coarse=%s)", (coarse) => {
    vi.stubGlobal("matchMedia", vi.fn((query: string) => ({
      matches: coarse && query === "(pointer: coarse)",
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })));
    const drawing = savedDrawing({
      id: `long-card-${coarse}`,
      tool: "text",
      anchors: [{ time: candles[0].time, price: 100 }],
      placement: "anchor",
      canvasX: 0.4,
      canvasY: 0.4,
      textWidth: 180,
      text: "第一行\n第二行\n第三行\n第四行",
    });
    renderCanvas({ activeTool: "cursor", drawings: [drawing], selectedDrawingId: drawing.id });
    const move = screen.getByRole("button", { name: `移动文字 ${drawing.id}` });
    const anchor = screen.getByRole("button", { name: `移动市场锚点 ${drawing.id}` });
    const edit = screen.getByRole("button", { name: `编辑文字 ${drawing.id}` });
    const toggle = screen.queryByRole("button", { name: /展开文字/ });
    const rect = (button: HTMLElement) => ({
      left: Number.parseFloat(button.style.left), top: Number.parseFloat(button.style.top),
      right: Number.parseFloat(button.style.left) + Number.parseFloat(button.style.width),
      bottom: Number.parseFloat(button.style.top) + Number.parseFloat(button.style.height),
    });
    const moveRect = rect(move);
    const overlaps = (left: ReturnType<typeof rect>, right: ReturnType<typeof rect>) =>
      left.left < right.right && right.left < left.right && left.top < right.bottom && right.top < left.bottom;
    expect(move.style.width).toBe(coarse ? "44px" : "24px");
    expect(overlaps(moveRect, rect(anchor))).toBe(false);
    expect(overlaps(moveRect, rect(edit))).toBe(false);
    if (toggle) expect(overlaps(moveRect, rect(toggle))).toBe(false);
  });

  it("moves only the selected real endpoint of a trend line", () => {
    const onCommand = vi.fn();
    const drawing = savedDrawing({
      id: "trend-endpoint",
      tool: "trend-line",
      anchors: [
        { time: candles[0].time, price: 100 },
        { time: candles[1].time, price: 120 },
      ],
    });
    const { stage } = renderCanvas({ activeTool: "cursor", drawings: [drawing], selectedDrawingId: drawing.id, onCommand });
    const endpoint = screen.getByRole("button", { name: `移动trend-line端点 1` });
    fireEvent.pointerDown(endpoint, { pointerId: 24, clientX: 10, clientY: 100 });
    fireEvent.pointerMove(stage, { pointerId: 24, clientX: 20, clientY: 90 });
    fireEvent.pointerUp(stage, { pointerId: 24, clientX: 20, clientY: 90 });
    expect(onCommand).toHaveBeenCalledWith(expect.objectContaining({
      type: "replace",
      drawing: expect.objectContaining({
        id: drawing.id,
        anchors: [expect.objectContaining({ time: candles[0].time, price: 110 }), drawing.anchors[1]],
      }),
    }));
  });

  it("keeps an endpoint edge hit bound to its explicit real anchor index", () => {
    const onCommand = vi.fn();
    const drawing = savedDrawing({
      id: "trend-edge-endpoint",
      tool: "trend-line",
      anchors: [
        { time: candles[0].time, price: 100 },
        { time: candles[1].time, price: 120 },
      ],
    });
    const { stage } = renderCanvas({ activeTool: "cursor", drawings: [drawing], selectedDrawingId: drawing.id, onCommand });
    const endpoint = screen.getByRole("button", { name: `移动trend-line端点 2` });
    const edgeX = Number.parseFloat(endpoint.style.left) + 1;
    const centerY = Number.parseFloat(endpoint.style.top) + Number.parseFloat(endpoint.style.height) / 2;
    fireEvent.pointerDown(endpoint, { pointerId: 28, clientX: edgeX, clientY: centerY });
    fireEvent.pointerMove(stage, { pointerId: 28, clientX: edgeX + 10, clientY: centerY - 10 });
    fireEvent.pointerUp(stage, { pointerId: 28, clientX: edgeX + 10, clientY: centerY - 10 });
    expect(onCommand).toHaveBeenCalledWith(expect.objectContaining({
      type: "replace",
      drawing: expect.objectContaining({
        id: drawing.id,
        anchors: [drawing.anchors[0], expect.objectContaining({ time: candles[1].time, price: 130 })],
      }),
    }));
  });

  it("moves only the price of a horizontal line", () => {
    const onCommand = vi.fn();
    const drawing = savedDrawing({
      id: "horizontal-price",
      tool: "horizontal-line",
      anchors: [{ time: candles[0].time, price: 100 }],
    });
    const { stage } = renderCanvas({ activeTool: "cursor", drawings: [drawing], selectedDrawingId: drawing.id, onCommand });
    const endpoint = screen.getByRole("button", { name: `移动horizontal-line端点 1` });
    fireEvent.pointerDown(endpoint, { pointerId: 25, clientX: 10, clientY: 100 });
    fireEvent.pointerMove(stage, { pointerId: 25, clientX: 40, clientY: 90 });
    fireEvent.pointerUp(stage, { pointerId: 25, clientX: 40, clientY: 90 });
    expect(onCommand).toHaveBeenCalledWith(expect.objectContaining({
      type: "replace",
      drawing: expect.objectContaining({
        id: drawing.id,
        anchors: [expect.objectContaining({ time: candles[0].time, price: 110 })],
      }),
    }));
  });

  it("exposes a keyboard selection entry before selection and all three channel endpoints after selection", () => {
    const onCommand = vi.fn();
    const onSelectDrawing = vi.fn();
    const drawing = savedDrawing({
      id: "channel-controls",
      tool: "parallel-channel",
      anchors: [
        { time: candles[0].time, price: 100 },
        { time: candles[1].time, price: 120 },
        { time: candles[0].time, price: 80 },
      ],
    });
    renderCanvas({ activeTool: "cursor", drawings: [drawing], onCommand, onSelectDrawing });
    const object = screen.getByRole("button", { name: "选择绘图 parallel-channel" });
    fireEvent.keyDown(object, { key: "Enter" });
    expect(onSelectDrawing).toHaveBeenCalledWith(drawing.id);
    cleanup();
    renderCanvas({ activeTool: "cursor", drawings: [drawing], selectedDrawingId: drawing.id, onCommand, onSelectDrawing });
    expect(screen.getAllByRole("button", { name: /移动parallel-channel端点/ })).toHaveLength(3);
  });

  it("keeps the keyboard focus proxy clear of a short arrow terminal", () => {
    const drawing = savedDrawing({
      id: "short-arrow-focus-proxy",
      name: "箭头",
      tool: "arrow",
      anchors: [
        { time: candles[0].time, price: 100 },
        { time: candles[1].time, price: 98 },
      ],
    });
    const shortAdapter = {
      ...adapter,
      timeToX: (time: string) => (time === candles[0].time ? 120 : 145),
    };
    renderCanvas({
      activeTool: "cursor",
      coordinateAdapter: shortAdapter,
      drawings: [drawing],
      selectedDrawingId: drawing.id,
    }, undefined, { width: 300, height: 200 });

    const proxy = screen.getByRole("button", { name: "选择绘图 箭头" });
    fireEvent.focus(proxy);
    expect(proxy.style.opacity).toBe("1");

    // The proxy must remain outside the whole short vector's endpoint/
    // arrowhead exclusion bounds; this checks geometry rather than one
    // hand-picked left coordinate.
    const proxyLeft = Number.parseFloat(proxy.style.left);
    const proxyTop = Number.parseFloat(proxy.style.top);
    const intersectsDrawingBounds =
      proxyLeft < 145 + 8 && proxyLeft + 96 > 120 - 8 &&
      proxyTop < 102 + 8 && proxyTop + 24 > 100 - 8;
    expect(intersectsDrawingBounds).toBe(false);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(proxy.style.opacity).toBe("0");
    expect(proxy.style.pointerEvents).toBe("none");
  });

  it("places a generic keyboard focus proxy in free space for a longer drawing", () => {
    const drawing = savedDrawing({
      id: "trend-focus-proxy",
      tool: "trend-line",
      anchors: [
        { time: candles[0].time, price: 120 },
        { time: candles[1].time, price: 80 },
      ],
    });
    renderCanvas({
      activeTool: "cursor",
      drawings: [drawing],
      selectedDrawingId: drawing.id,
    }, undefined, { width: 300, height: 240 });

    const proxy = screen.getByRole("button", { name: "选择绘图 trend-line" });
    fireEvent.focus(proxy);
    const left = Number.parseFloat(proxy.style.left);
    const top = Number.parseFloat(proxy.style.top);
    // Projected points are (10,80) and (80,120); an 8px safety gap keeps the
    // identity proxy away from both the line and its real endpoint handles.
    expect(left < 80 + 8 && left + 96 > 10 - 8 && top < 120 + 8 && top + 24 > 80 - 8).toBe(false);
    expect(proxy.style.opacity).toBe("1");
  });

  it("keeps an edge drawing proxy clamped inside the stage", () => {
    const drawing = savedDrawing({
      id: "edge-focus-proxy",
      tool: "trend-line",
      anchors: [
        { time: candles[0].time, price: 198 },
        { time: candles[1].time, price: 196 },
      ],
    });
    const edgeAdapter = {
      ...adapter,
      timeToX: (time: string) => (time === candles[0].time ? 2 : 8),
    };
    renderCanvas({
      activeTool: "cursor",
      coordinateAdapter: edgeAdapter,
      drawings: [drawing],
      selectedDrawingId: drawing.id,
    }, undefined, { width: 120, height: 100 });

    const proxy = screen.getByRole("button", { name: "选择绘图 trend-line" });
    fireEvent.focus(proxy);
    expect(Number.parseFloat(proxy.style.left)).toBeGreaterThanOrEqual(0);
    expect(Number.parseFloat(proxy.style.left)).toBeLessThanOrEqual(24);
    expect(Number.parseFloat(proxy.style.top)).toBeGreaterThanOrEqual(0);
    expect(Number.parseFloat(proxy.style.top)).toBeLessThanOrEqual(76);
    expect(proxy.style.opacity).toBe("1");
  });

  it("previews a line hover with an axis cursor without showing handles", () => {
    const drawing = savedDrawing({
      id: "horizontal-hover",
      tool: "horizontal-line",
      anchors: [{ time: candles[0].time, price: 100 }],
    });
    const { stage } = renderCanvas({ activeTool: "cursor", drawings: [drawing] });
    fireEvent.pointerMove(stage, { pointerId: 27, clientX: 40, clientY: 100 });
    expect(stage.style.cursor).toBe("ns-resize");
    expect(screen.queryAllByRole("button", { name: /端点/ })).toHaveLength(0);
  });

  it("switches a two-dimensional endpoint grip to grabbing while held", () => {
    const drawing = savedDrawing({
      id: "trend-endpoint-cursor",
      tool: "trend-line",
      anchors: [
        { time: candles[0].time, price: 100 },
        { time: candles[1].time, price: 120 },
      ],
    });
    const { stage } = renderCanvas({ activeTool: "cursor", drawings: [drawing], selectedDrawingId: drawing.id });
    const endpoint = screen.getByRole("button", { name: "移动trend-line端点 1" });
    expect(endpoint).toHaveStyle({ cursor: "move" });
    fireEvent.pointerDown(endpoint, { pointerId: 41, clientX: 10, clientY: 100 });
    expect(endpoint).toHaveStyle({ cursor: "grabbing" });
    expect(stage).toHaveStyle({ cursor: "grabbing" });
    fireEvent.pointerUp(stage, { pointerId: 41, clientX: 12, clientY: 102 });
    expect(screen.getByRole("button", { name: "移动trend-line端点 1" })).toHaveStyle({ cursor: "move" });
  });

  it("keeps the stage cursor through captured leave until release or Escape", () => {
    const drawing = savedDrawing({
      id: "captured-leave-cursor",
      tool: "trend-line",
      anchors: [
        { time: candles[0].time, price: 100 },
        { time: candles[1].time, price: 120 },
      ],
    });
    const { canvas, stage } = renderCanvas({ activeTool: "cursor", drawings: [drawing], selectedDrawingId: drawing.id });
    const endpoint = screen.getByRole("button", { name: "移动trend-line端点 1" });

    fireEvent.pointerDown(endpoint, { pointerId: 42, clientX: 10, clientY: 100 });
    fireEvent.pointerLeave(canvas);
    expect(endpoint).toHaveStyle({ cursor: "grabbing" });
    expect(stage).toHaveStyle({ cursor: "grabbing" });
    fireEvent.pointerUp(stage, { pointerId: 42, clientX: 12, clientY: 102 });
    expect(screen.getByRole("button", { name: "移动trend-line端点 1" })).toHaveStyle({ cursor: "move" });

    const nextEndpoint = screen.getByRole("button", { name: "移动trend-line端点 1" });
    fireEvent.pointerDown(nextEndpoint, { pointerId: 43, clientX: 10, clientY: 100 });
    fireEvent.pointerLeave(canvas);
    expect(stage).toHaveStyle({ cursor: "grabbing" });
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.getByRole("button", { name: "移动trend-line端点 1" })).toHaveStyle({ cursor: "move" });
    expect(stage).not.toHaveStyle({ cursor: "grabbing" });
  });

  it("keeps a horizontal line body drag on its price axis", () => {
    const onCommand = vi.fn();
    const drawing = savedDrawing({
      id: "horizontal-body",
      tool: "horizontal-line",
      anchors: [{ time: candles[0].time, price: 100 }],
    });
    const { canvas } = renderCanvas({ activeTool: "cursor", drawings: [drawing], selectedDrawingId: drawing.id, onCommand });
    fireEvent.pointerDown(canvas, { pointerId: 26, clientX: 40, clientY: 100 });
    fireEvent.pointerMove(canvas, { pointerId: 26, clientX: 60, clientY: 90 });
    fireEvent.pointerUp(canvas, { pointerId: 26, clientX: 60, clientY: 90 });
    expect(onCommand).toHaveBeenCalledWith(expect.objectContaining({
      type: "replace",
      drawing: expect.objectContaining({
        id: drawing.id,
        anchors: [expect.objectContaining({ time: candles[0].time, price: 110 })],
      }),
    }));
  });

  it("keeps a real pointer click on the style bar inside the live editor", async () => {
    const user = userEvent.setup();
    const { canvas } = renderCanvas();

    fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 10, clientY: 100 });
    const editor = screen.getByRole("textbox", { name: "文字标注" });
    const toggle = screen.getByRole("button", { name: "改为自由文字" });

    await user.click(toggle);

    expect(screen.getByRole("textbox", { name: "文字标注" })).toBe(editor);
    expect(screen.getByRole("button", { name: "改为锚定文字" })).toBeInTheDocument();
  });

  it("keeps the style bar above the textarea despite legacy editor CSS", () => {
    const { canvas } = renderCanvas();

    fireEvent.pointerDown(canvas, { pointerId: 7, clientX: 10, clientY: 100 });
    const editor = screen.getByRole("textbox", { name: "文字标注" });
    const styleBar = screen.getByLabelText("文字样式");
    const shell = document.querySelector<HTMLElement>(".drawing-text-editor-shell");
    const colorInput = document.querySelector<HTMLInputElement>('input[type="color"]');

    expect(editor.style.position).toBe("static");
    expect(styleBar.style.position).toBe("relative");
    expect(styleBar.style.zIndex).toBe("7");
    expect(styleBar.style.flexWrap).toBe("wrap");
    expect(styleBar.style.overflowX).toBe("hidden");
    expect(styleBar.style.overflowY).toBe("auto");
    expect(canvas.parentElement).toHaveStyle({ zIndex: "9" });
    expect(shell).toHaveStyle({
      zIndex: "10",
      background: "var(--surface-elevated)",
      borderRadius: "6px",
      boxShadow: "0 0 0 1px var(--line-soft)",
    });
    expect(styleBar).toHaveStyle({
      background: "var(--surface)",
      boxShadow: "inset 0 0 0 1px var(--line-soft)",
      borderRadius: "4px",
    });
    expect(colorInput).toHaveStyle({
      background: "var(--surface)",
      borderRadius: "4px",
      boxShadow: "0 0 0 1px var(--line-soft)",
    });
  });

  it("ignores a cross-realm editor-control pointer event", () => {
    const onSelectDrawing = vi.fn();
    const drawing = savedDrawing({
      id: "cross-realm-text",
      tool: "text",
      text: "原注释",
      anchors: [{ time: candles[0].time, price: 100 }],
    });
    const { stage } = renderCanvas({
      activeTool: "cursor",
      drawings: [drawing],
      selectedDrawingId: drawing.id,
      onSelectDrawing,
    });

    fireEvent.click(screen.getByRole("button", { name: `编辑文字 ${drawing.id}` }));
    const editor = screen.getByRole("textbox", { name: "文字标注" });
    const shell = editor.parentElement;
    expect(shell).not.toBeNull();

    const foreignDocument = document.implementation.createHTMLDocument();
    foreignDocument.body.innerHTML = "<button></button>";
    const foreignButton = foreignDocument.querySelector("button")!;
    shell!.appendChild(foreignButton);
    const selectionsBeforeControl = onSelectDrawing.mock.calls.length;
    foreignButton.dispatchEvent(new MouseEvent("pointerdown", {
      bubbles: true,
      clientX: 10,
      clientY: 100,
    }));

    expect(onSelectDrawing).toHaveBeenCalledTimes(selectionsBeforeControl);
    expect(screen.getByRole("textbox", { name: "文字标注" })).toBe(editor);
  });

  it("keeps shared text geometry consistent when desired width exceeds the canvas", () => {
    const layout = textLayout("一二三四五六", 999, 14, 100);
    const wrapped = textLayout("一二三四五六", 36, 14, 100);

    expect(layout.width).toBe(100);
    expect(wrapped.width).toBe(36);
    expect(wrapped.lines).toHaveLength(3);
    expect(wrapped.height).toBe(71);
  });

  it("clamps a committed text width to the current canvas width", () => {
    const onCommand = vi.fn();
    const { canvas } = renderCanvas({ onCommand });

    fireEvent.pointerDown(canvas, { pointerId: 2, clientX: 10, clientY: 40 });
    const editor = screen.getByRole("textbox", { name: "文字标注" });
    fireEvent.change(editor, { target: { value: "宽度超出画布" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "文字宽度" }), {
      target: { value: "999" },
    });
    fireEvent.keyDown(editor, { key: "Enter", ctrlKey: true });

    const command = onCommand.mock.calls[0]?.[0] as { drawing?: { textWidth?: number } } | undefined;
    expect(command?.drawing?.textWidth).toBeLessThanOrEqual(100);
  });

  it("uses the same wrapped text height for hit testing as the renderer", () => {
    const onSelectDrawing = vi.fn();
    const drawing = savedDrawing({
      id: "wrapped-text",
      tool: "text",
      anchors: [],
      placement: "canvas",
      canvasX: 0.1,
      canvasY: 0.1,
      textWidth: 36,
      fontSize: 14,
      text: "一二三四五六",
    });
    const { stage } = renderCanvas({
      activeTool: "cursor",
      drawings: [drawing],
      selectedDrawingId: drawing.id,
      onSelectDrawing,
    });

    // With a 36px box, the renderer wraps this into multiple lines. The
    // second line is still part of the visible/editor hit target.
    fireEvent.pointerDown(stage, { pointerId: 3, clientX: 12, clientY: 45 });

    expect(onSelectDrawing).toHaveBeenCalledWith("wrapped-text");
    expect(screen.queryByRole("textbox", { name: "文字标注" })).not.toBeInTheDocument();
  });

  it("commits multiline input through the imperative handle without dropping raw text", () => {
    const onCommand = vi.fn();
    const ref = createRef<DrawingCanvasHandle>();
    const { canvas } = renderCanvas({ onCommand }, ref);

    fireEvent.pointerDown(canvas, { pointerId: 4, clientX: 10, clientY: 40 });
    const editor = screen.getByRole("textbox", { name: "文字标注" });
    fireEvent.change(editor, { target: { value: "第一行\n第二行" } });

    act(() => ref.current?.commitText());

    expect(onCommand).toHaveBeenCalledWith(expect.objectContaining({
      type: "add",
      drawing: expect.objectContaining({
        text: "第一行\n第二行",
        placement: "anchor",
        style: expect.objectContaining({ color: "#e7edf6" }),
      }),
    }));
  });

  it("preserves recall identity and style fields when editing an existing Text", () => {
    const onCommand = vi.fn();
    const drawing = savedDrawing({
      id: "stable-text",
      tool: "text",
      anchors: [{ time: candles[0].time, price: 100 }],
      text: "旧内容",
      placement: "anchor",
      textWidth: 144,
      fontSize: 18,
      background: "rgba(16, 23, 34, 0.86)",
      recallOwnerId: "decision-1",
      textRevision: 7,
    });
    const { stage } = renderCanvas({
      activeTool: "cursor",
      drawings: [drawing],
      selectedDrawingId: drawing.id,
      onCommand,
    });

    fireEvent.click(screen.getByRole("button", { name: `编辑文字 ${drawing.id}` }));
    const editor = screen.getByRole("textbox", { name: "文字标注" });
    fireEvent.change(editor, { target: { value: "新内容" } });
    fireEvent.keyDown(editor, { key: "Enter", ctrlKey: true });

    expect(onCommand).toHaveBeenCalledWith(expect.objectContaining({
      type: "replace",
      drawing: expect.objectContaining({
        id: drawing.id,
        text: "新内容",
        textWidth: 144,
        fontSize: 18,
        background: drawing.background,
        recallOwnerId: "decision-1",
        textRevision: 7,
      }),
    }));
  });

  it("keeps legacy anchored Text coordinates absent when only its text is edited", () => {
    const onCommand = vi.fn();
    const drawing = savedDrawing({
      id: "legacy-text",
      tool: "text",
      anchors: [{ time: candles[0].time, price: 100 }],
      text: "旧锚定位置",
      placement: "anchor",
      canvasX: undefined,
      canvasY: undefined,
    });
    const { stage } = renderCanvas({
      activeTool: "cursor",
      drawings: [drawing],
      selectedDrawingId: drawing.id,
      onCommand,
    });

    fireEvent.click(screen.getByRole("button", { name: `编辑文字 ${drawing.id}` }));
    const editor = screen.getByRole("textbox", { name: "文字标注" });
    fireEvent.change(editor, { target: { value: "只改文字" } });
    fireEvent.keyDown(editor, { key: "Enter", ctrlKey: true });

    const command = onCommand.mock.calls[0]?.[0] as { drawing?: Record<string, unknown> } | undefined;
    expect(command?.drawing).toEqual(expect.objectContaining({
      id: drawing.id,
      text: "只改文字",
      placement: "anchor",
    }));
    expect(command?.drawing).not.toHaveProperty("canvasX");
    expect(command?.drawing).not.toHaveProperty("canvasY");
  });

  it("keeps the multiline editor inside the plot at the right and bottom edge", () => {
    const drawing = savedDrawing({
      id: "edge-card",
      tool: "text",
      anchors: [{ time: candles[1].time, price: 100 }],
      placement: "anchor",
      canvasX: 0.96,
      canvasY: 0.96,
      text: "第一行\n第二行\n第三行",
    });
    const { stage } = renderCanvas({
      activeTool: "cursor",
      drawings: [drawing],
      selectedDrawingId: drawing.id,
    });

    fireEvent.click(screen.getByRole("button", { name: `编辑文字 ${drawing.id}` }));

    const shell = document.querySelector<HTMLElement>(".drawing-text-editor-shell");
    expect(shell).not.toBeNull();
    const left = Number.parseFloat(shell?.style.left ?? "0");
    const width = Number.parseFloat(shell?.style.width ?? "0");
    expect(width).toBeGreaterThanOrEqual(220);
    expect(left).toBeGreaterThanOrEqual(2);
    const top = Number.parseFloat(shell?.style.top ?? "0");
    const maxHeight = Number.parseFloat(shell?.style.maxHeight ?? "0");
    expect(top).toBeGreaterThanOrEqual(2);
    expect(maxHeight).toBeLessThanOrEqual(96);
    expect(top + maxHeight).toBeLessThanOrEqual(98);
    expect(screen.getByRole("textbox", { name: "文字标注" })).toHaveStyle({ minWidth: "0px", boxSizing: "border-box" });
  });

  it("bounds the editor to the real plot pane while keeping its textarea scrollable", () => {
    const drawing = savedDrawing({
      id: "plot-edge-card",
      tool: "text",
      anchors: [{ time: candles[1].time, price: 100 }],
      placement: "anchor",
      canvasX: 0.96,
      canvasY: 0.96,
      text: "边界文本\n第二行\n第三行",
      fontSize: 32,
      textWidth: 36,
    });
    const { stage } = renderCanvas({
      activeTool: "cursor",
      drawings: [drawing],
      selectedDrawingId: drawing.id,
      plotBounds: { width: 78, height: 70 },
    });

    fireEvent.click(screen.getByRole("button", { name: `编辑文字 ${drawing.id}` }));

    const shell = document.querySelector<HTMLElement>(".drawing-text-editor-shell");
    expect(shell).not.toBeNull();
    const left = Number.parseFloat(shell?.style.left ?? "0");
    const width = Number.parseFloat(shell?.style.width ?? "0");
    const top = Number.parseFloat(shell?.style.top ?? "0");
    const maxHeight = Number.parseFloat(shell?.style.maxHeight ?? "0");
    expect(width).toBeGreaterThanOrEqual(220);
    expect(left).toBeGreaterThanOrEqual(2);
    expect(top + maxHeight).toBeLessThanOrEqual(68);
    expect(shell).toHaveStyle({ overflowY: "hidden" });
    expect(screen.getByRole("textbox", { name: "文字标注" })).toHaveStyle({ overflowY: "auto" });
  });

  it("keeps the editor compact when the click has enough pane height", () => {
    const drawing = savedDrawing({
      id: "compact-editor-card",
      tool: "text",
      anchors: [{ time: candles[1].time, price: 100 }],
      placement: "anchor",
      canvasX: 0.3,
      canvasY: 0.2,
      text: "短文本",
    });
    const { stage } = renderCanvas(
      { activeTool: "cursor", drawings: [drawing], selectedDrawingId: drawing.id, plotBounds: { width: 560, height: 360 } },
      undefined,
      { width: 640, height: 400 },
    );

    fireEvent.click(screen.getByRole("button", { name: `编辑文字 ${drawing.id}` }));

    const shell = document.querySelector<HTMLElement>(".drawing-text-editor-shell");
    expect(shell).not.toBeNull();
    const height = Number.parseFloat(shell?.style.height ?? "0");
    const maxHeight = Number.parseFloat(shell?.style.maxHeight ?? "0");
    expect(height).toBeLessThan(maxHeight);
    expect(height).toBeLessThanOrEqual(120);
  });

  it("allocates font-aware editor space and preserves a narrow stored card width", () => {
    const onCommand = vi.fn();
    const drawing = savedDrawing({
      id: "font-aware-edge-card",
      tool: "text",
      anchors: [{ time: candles[1].time, price: 100 }],
      placement: "anchor",
      canvasX: 0.96,
      canvasY: 0.76,
      text: "第一行\n第二行\n第三行",
      fontSize: 32,
      textWidth: 36,
    });
    const { stage } = renderCanvas(
      {
        activeTool: "cursor",
        drawings: [drawing],
        selectedDrawingId: drawing.id,
        onCommand,
        plotBounds: { width: 1200, height: 626 },
      },
      undefined,
      { width: 1440, height: 900 },
    );

    fireEvent.click(screen.getByRole("button", { name: `编辑文字 ${drawing.id}` }));

    const shell = document.querySelector<HTMLElement>(".drawing-text-editor-shell");
    expect(shell).not.toBeNull();
    expect(Number.parseFloat(shell?.style.width ?? "0")).toBeGreaterThanOrEqual(500);
    const shellHeight = Number.parseFloat(shell?.style.height ?? "0");
    const shellMaxHeight = Number.parseFloat(shell?.style.maxHeight ?? "0");
    const textarea = screen.getByRole("textbox", { name: "文字标注" });
    const hint = document.querySelector<HTMLElement>(".drawing-text-editor-hint");
    const styleBar = screen.getByLabelText("文字样式");
    const styleButton = screen.getByRole("button", { name: "改为自由文字" });
    const widthInput = screen.getByRole("spinbutton", { name: "文字宽度" });

    expect(shellHeight).toBeGreaterThanOrEqual(200);
    expect(shellHeight).toBeLessThanOrEqual(shellMaxHeight);
    expect(textarea).toHaveStyle({
      lineHeight: "48px",
      minHeight: "56px",
      overflowY: "auto",
    });
    expect(styleBar).toHaveStyle({
      minHeight: "0px",
      maxHeight: "36px",
      height: "36px",
      whiteSpace: "nowrap",
      flexWrap: "wrap",
      overflowX: "hidden",
      overflowY: "auto",
    });
    expect(styleButton).toHaveStyle({
      minHeight: "36px",
      flexShrink: "0",
      whiteSpace: "nowrap",
    });
    expect(hint).toHaveStyle({
      fontSize: "12px",
      lineHeight: "18px",
      whiteSpace: "nowrap",
    });
    expect(widthInput).toHaveValue(36);

    fireEvent.change(textarea, { target: { value: "保留窄卡宽度" } });
    fireEvent.keyDown(textarea, { key: "Enter", ctrlKey: true });

    expect(onCommand).toHaveBeenCalledWith(expect.objectContaining({
      type: "replace",
      drawing: expect.objectContaining({ textWidth: 36 }),
    }));
  });

  it("raises style controls to touch targets without allowing them to shrink", () => {
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    vi.stubGlobal("matchMedia", vi.fn(() => ({
      matches: true,
      media: "(pointer: coarse)",
      addEventListener,
      removeEventListener,
    })));
    const { canvas } = renderCanvas();

    fireEvent.pointerDown(canvas, { pointerId: 19, clientX: 10, clientY: 40 });

    const styleBar = screen.getByLabelText("文字样式");
    expect(Number.parseFloat((styleBar as HTMLElement).style.minHeight)).toBe(0);
    expect(Number.parseFloat((styleBar as HTMLElement).style.maxHeight)).toBeGreaterThanOrEqual(44);
    for (const control of Array.from(styleBar.children)) {
      expect(control).toHaveStyle({ flexShrink: "0", minHeight: "44px" });
    }
  });

  it("wraps the editor controls when the plot is narrower than the desktop editor", () => {
    const drawing = savedDrawing({
      id: "narrow-editor-controls",
      tool: "text",
      anchors: [{ time: candles[1].time, price: 100 }],
      placement: "anchor",
      canvasX: 0.3,
      canvasY: 0.2,
      text: "窄屏编辑",
    });
    renderCanvas(
      {
        activeTool: "cursor",
        drawings: [drawing],
        selectedDrawingId: drawing.id,
        plotBounds: { width: 320, height: 240 },
      },
      undefined,
      { width: 360, height: 260 },
    );

    fireEvent.click(screen.getByRole("button", { name: `编辑文字 ${drawing.id}` }));

    const shell = document.querySelector<HTMLElement>(".drawing-text-editor-shell");
    const styleBar = screen.getByLabelText("文字样式");
    expect(Number.parseFloat(shell?.style.width ?? "0")).toBe(316);
    expect(styleBar).toHaveStyle({
      flexWrap: "wrap",
      overflowY: "auto",
      minHeight: "0px",
      maxHeight: "108px",
      height: "108px",
    });
    expect(screen.getByRole("combobox", { name: "文字字号" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "切换文字背景" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "完成文字编辑" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "取消文字编辑" })).toBeInTheDocument();
  });

  it("keeps every narrow style control in a bounded scroll viewport beside actions", () => {
    vi.stubGlobal("matchMedia", vi.fn((query: string) => ({
      matches: query === "(max-width: 640px)",
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })));
    const drawing = savedDrawing({
      id: "narrow-style-scroll-viewport",
      tool: "text",
      anchors: [{ time: candles[1].time, price: 100 }],
      placement: "anchor",
      canvasX: 0.3,
      canvasY: 0.2,
      text: "窄屏样式滚动",
    });
    renderCanvas({
      activeTool: "cursor",
      drawings: [drawing],
      selectedDrawingId: drawing.id,
      plotBounds: { width: 244, height: 230 },
    }, undefined, { width: 390, height: 844 });

    fireEvent.click(screen.getByRole("button", { name: `编辑文字 ${drawing.id}` }));

    const shell = document.querySelector<HTMLElement>(".drawing-text-editor-shell");
    const controls = document.querySelector<HTMLElement>(".drawing-text-editor-controls");
    const styleBar = screen.getByLabelText("文字样式");
    const colorInput = screen.getByLabelText("文字颜色");
    expect(Number.parseFloat(shell?.style.width ?? "0")).toBe(240);
    expect(controls).toHaveStyle({
      minHeight: "0px",
      maxHeight: "132px",
      height: "132px",
      overflow: "hidden",
    });
    expect(styleBar).toHaveStyle({
      minHeight: "0px",
      maxHeight: "132px",
      height: "132px",
      overflowY: "auto",
      boxSizing: "border-box",
    });
    expect(colorInput).toHaveStyle({
      width: "44px",
      minWidth: "44px",
      height: "44px",
    });
    expect(screen.getByRole("spinbutton", { name: "文字宽度" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "切换文字背景" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "完成文字编辑" })).toBeVisible();
    expect(screen.getByRole("button", { name: "取消文字编辑" })).toBeVisible();
    expect(screen.getByRole("textbox", { name: "文字标注" })).toBeVisible();
  });

  it("keeps editor actions at coarse height in a narrow viewport", () => {
    vi.stubGlobal("matchMedia", vi.fn((query: string) => ({
      matches: query === "(max-width: 640px)",
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })));
    const { canvas } = renderCanvas();
    fireEvent.pointerDown(canvas, { pointerId: 26, clientX: 10, clientY: 40 });
    expect(Number.parseFloat((screen.getByLabelText("文字样式") as HTMLElement).style.minHeight)).toBe(0);
    expect(Number.parseFloat((screen.getByLabelText("文字样式") as HTMLElement).style.maxHeight)).toBeGreaterThanOrEqual(44);
    expect(screen.getByRole("button", { name: "完成文字编辑" })).toHaveStyle({ minHeight: "44px", minWidth: "44px", width: "44px" });
  });

  it("keeps a new long-card expand control inside the real plot pane", () => {
    const drawing = savedDrawing({
      id: "plot-edge-long-card",
      tool: "text",
      anchors: [{ time: candles[1].time, price: 100 }],
      placement: "anchor",
      canvasX: 0.96,
      canvasY: 0.2,
      text: "第一行\n第二行\n第三行",
      textWidth: 180,
    });
    renderCanvas({
      activeTool: "cursor",
      drawings: [drawing],
      plotBounds: { width: 78, height: 100 },
    });

    const toggle = screen.getByRole("button", { name: /展开文字/ });
    const left = Number.parseFloat(toggle.style.left);
    expect(left + 16).toBeLessThanOrEqual(78);
  });

  it("exposes explicit completion and cancellation without committing on cancel", () => {
    const onCommand = vi.fn();
    const { canvas } = renderCanvas({ onCommand });
    fireEvent.pointerDown(canvas, { pointerId: 20, clientX: 10, clientY: 40 });
    const editor = screen.getByRole("textbox", { name: "文字标注" });
    fireEvent.change(editor, { target: { value: "草稿" } });
    expect(screen.getByRole("button", { name: "完成文字编辑" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "取消文字编辑" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "取消文字编辑" }));
    expect(onCommand).not.toHaveBeenCalled();
    expect(screen.queryByRole("textbox", { name: "文字标注" })).not.toBeInTheDocument();
  });

  it("cancels from a style control without committing a draft", () => {
    const onCommand = vi.fn();
    const { canvas } = renderCanvas({ onCommand });
    fireEvent.pointerDown(canvas, { pointerId: 21, clientX: 10, clientY: 40 });
    const editor = screen.getByRole("textbox", { name: "文字标注" });
    fireEvent.change(editor, { target: { value: "不要保存" } });
    fireEvent.keyDown(screen.getByRole("combobox", { name: "文字字号" }), { key: "Escape" });
    expect(onCommand).not.toHaveBeenCalled();
    expect(screen.queryByRole("textbox", { name: "文字标注" })).not.toBeInTheDocument();
  });

  it("protects a non-empty editor draft when an undo control takes focus", () => {
    const onCommand = vi.fn();
    const { canvas, stage } = renderCanvas({ onCommand });
    fireEvent.pointerDown(canvas, { pointerId: 30, clientX: 10, clientY: 40 });
    const editor = screen.getByRole("textbox", { name: "文字标注" });
    fireEvent.change(editor, { target: { value: "非空草稿" } });
    const undo = document.createElement("button");
    undo.type = "button";
    undo.setAttribute("data-replay-control", "true");
    undo.textContent = "撤销绘图";
    const onUndo = vi.fn();
    undo.addEventListener("click", onUndo);
    stage.appendChild(undo);

    // Match the browser's pointerdown -> focus/blur -> click ordering. The
    // control marker is the shared contract used by replay/toolbar controls;
    // it must not make textarea blur commit the draft before Undo runs.
    fireEvent.pointerDown(undo, { pointerId: 31, clientX: 12, clientY: 42 });
    fireEvent.blur(editor, { relatedTarget: undo });
    fireEvent.click(undo);

    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(onCommand).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox", { name: "文字标注" })).toHaveValue("非空草稿");
  });

  it("protects a draft when a replay control receives keyboard focus", () => {
    const onCommand = vi.fn();
    const { canvas, stage } = renderCanvas({ onCommand });
    fireEvent.pointerDown(canvas, { pointerId: 32, clientX: 10, clientY: 40 });
    const editor = screen.getByRole("textbox", { name: "文字标注" });
    fireEvent.change(editor, { target: { value: "键盘草稿" } });
    const redo = document.createElement("button");
    redo.type = "button";
    redo.setAttribute("data-replay-control", "true");
    stage.appendChild(redo);

    fireEvent.blur(editor, { relatedTarget: redo });

    expect(onCommand).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox", { name: "文字标注" })).toHaveValue("键盘草稿");
  });

  it("does not cancel while Escape belongs to an active IME composition", () => {
    const { canvas } = renderCanvas();
    fireEvent.pointerDown(canvas, { pointerId: 27, clientX: 10, clientY: 40 });
    const editor = screen.getByRole("textbox", { name: "文字标注" });
    fireEvent.keyDown(editor, { key: "Escape", isComposing: true, keyCode: 229 });
    expect(screen.getByRole("textbox", { name: "文字标注" })).toBe(editor);
  });

  it("links a draft to the nearest revealed bar and preserves its card position", () => {
    const onCommand = vi.fn();
    const { canvas } = renderCanvas({ onCommand, activeTool: "text" });
    fireEvent.pointerDown(canvas, { pointerId: 22, clientX: 30, clientY: 40 });
    const editor = screen.getByRole("textbox", { name: "文字标注" });
    fireEvent.change(editor, { target: { value: "关联" } });
    fireEvent.click(screen.getByRole("button", { name: "关联价格 / K线" }));
    expect(screen.getByRole("button", { name: "取消关联取点" })).toBeInTheDocument();
    fireEvent.pointerDown(canvas, { pointerId: 23, clientX: 79, clientY: 95 });
    fireEvent.pointerUp(canvas, { pointerId: 23, clientX: 79, clientY: 95 });
    expect(screen.getByRole("textbox", { name: "文字标注" })).toHaveValue("关联");
    fireEvent.click(screen.getByRole("button", { name: "完成文字编辑" }));
    expect(onCommand).toHaveBeenCalledWith(expect.objectContaining({
      type: "add",
      drawing: expect.objectContaining({
        text: "关联",
        placement: "anchor",
        anchors: [{ time: candles[1].time, price: 105 }],
        canvasX: expect.any(Number),
        canvasY: expect.any(Number),
      }),
    }));
  });

  it("keeps association picking active when the pointer is outside the plot bounds", () => {
    const { canvas } = renderCanvas({ plotBounds: { width: 78, height: 70 } });
    fireEvent.pointerDown(canvas, { pointerId: 28, clientX: 10, clientY: 40 });
    fireEvent.click(screen.getByRole("button", { name: "关联价格 / K线" }));
    fireEvent.pointerDown(canvas, { pointerId: 29, clientX: 90, clientY: 80 });
    expect(screen.getByRole("button", { name: "取消关联取点" })).toBeInTheDocument();
  });

  it("commits once when a draft is completed while the textarea loses focus", () => {
    const onCommand = vi.fn();
    const { canvas } = renderCanvas({ onCommand });
    fireEvent.pointerDown(canvas, { pointerId: 24, clientX: 10, clientY: 40 });
    const editor = screen.getByRole("textbox", { name: "文字标注" });
    fireEvent.change(editor, { target: { value: "一次" } });
    fireEvent.click(screen.getByRole("button", { name: "完成文字编辑" }));
    fireEvent.blur(editor);
    expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("cancels an in-progress chart pick before allowing editor completion", () => {
    const onCommand = vi.fn();
    const { canvas } = renderCanvas({ onCommand });
    fireEvent.pointerDown(canvas, { pointerId: 25, clientX: 10, clientY: 40 });
    const editor = screen.getByRole("textbox", { name: "文字标注" });
    fireEvent.change(editor, { target: { value: "保留草稿" } });
    fireEvent.click(screen.getByRole("button", { name: "关联价格 / K线" }));
    fireEvent.click(screen.getByRole("button", { name: "取消关联取点" }));
    expect(screen.getByRole("textbox", { name: "文字标注" })).toHaveValue("保留草稿");
    fireEvent.click(screen.getByRole("button", { name: "完成文字编辑" }));
    expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("reports idle capture ready without producing a drawing", () => {
    const ref = createRef<DrawingCanvasHandle>();
    const { props } = renderCanvas({}, ref);
    expect(ref.current?.commitText()).toBe(true);
    expect(props.onCommand).not.toHaveBeenCalled();
  });

  it("retains an empty edit instead of marking an incomplete draft capture ready", () => {
    const ref = createRef<DrawingCanvasHandle>();
    const { canvas, props } = renderCanvas({}, ref);
    fireEvent.pointerDown(canvas, { pointerId: 37, clientX: 10, clientY: 40 });
    let ready: boolean | undefined;
    act(() => { ready = ref.current?.commitText(); });
    expect(ready).toBe(false);
    expect(screen.getByRole("textbox", { name: "文字标注" })).toHaveValue("");
    expect(screen.getByRole("alert")).toHaveTextContent("请输入文字后再完成编辑");
    expect(props.onCommand).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "取消文字编辑" }));
    expect(ref.current?.commitText()).toBe(true);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("keeps a pending association draft and resumes a single commit after cancelling the pick", () => {
    const ref = createRef<DrawingCanvasHandle>();
    const { canvas, props } = renderCanvas({}, ref);
    fireEvent.pointerDown(canvas, { pointerId: 31, clientX: 10, clientY: 40 });
    fireEvent.change(screen.getByRole("textbox", { name: "文字标注" }), { target: { value: "未完成取点的中文草稿" } });
    fireEvent.click(screen.getByRole("button", { name: "关联价格 / K线" }));
    let ready: boolean | undefined;
    act(() => { ready = ref.current?.commitText(); });
    expect(ready).toBe(false);
    expect(props.onCommand).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox", { name: "文字标注" })).toHaveValue("未完成取点的中文草稿");
    fireEvent.click(screen.getByRole("button", { name: "取消关联取点" }));
    act(() => { ready = ref.current?.commitText(); });
    expect(ready).toBe(true);
    expect(props.onCommand).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("textbox", { name: "文字标注" })).not.toBeInTheDocument();
    expect(ref.current?.commitText()).toBe(true);
    expect(props.onCommand).toHaveBeenCalledTimes(1);
  });

  it("preserves the editor when Escape arrives during composition without event composition flags", () => {
    const { canvas, props } = renderCanvas();
    fireEvent.pointerDown(canvas, { pointerId: 32, clientX: 10, clientY: 40 });
    const editor = screen.getByRole("textbox", { name: "文字标注" });
    fireEvent.compositionStart(editor);
    fireEvent.keyDown(editor, { key: "Escape", isComposing: false, keyCode: 27 });
    expect(screen.getByRole("textbox", { name: "文字标注" })).toBe(editor);
    fireEvent.compositionEnd(editor);
    fireEvent.keyDown(editor, { key: "Escape" });
    expect(screen.queryByRole("textbox", { name: "文字标注" })).not.toBeInTheDocument();
    expect(props.onCommand).not.toHaveBeenCalled();
  });

  it.each([
    { name: "same point", draftX: 100, draftY: 150, barX: 100, barY: 150 },
    { name: "card boundary", draftX: 620, draftY: 380, barX: 600, barY: 380 },
  ])("keeps a 640px linked card outside its $name price anchor with a visible connector", ({ draftX, draftY, barX, barY }) => {
    const text = "原始判断：回撤后观察承接。\n站回56再考虑做多，跌破52则结构失效。\n当前补充：先按原计划持有。";
    const { canvas, props } = renderCanvas({ coordinateAdapter: {
      timeToX: (time: string) => time === candles[0].time ? 100 : 600,
      priceToY: (price: number) => 400 - price,
      xToTime: (x: number) => x < 350 ? candles[0].time : candles[1].time,
      yToPrice: (y: number) => 400 - y,
    } }, undefined, { width: 640, height: 400 });
    fireEvent.pointerDown(canvas, { pointerId: 33, clientX: draftX, clientY: draftY });
    fireEvent.change(screen.getByRole("textbox", { name: "文字标注" }), { target: { value: text } });
    fireEvent.click(screen.getByRole("button", { name: "关联价格 / K线" }));
    fireEvent.pointerDown(canvas, { pointerId: 34, clientX: barX, clientY: barY });
    fireEvent.pointerUp(canvas, { pointerId: 34, clientX: barX, clientY: barY });
    expect(screen.queryByRole("button", { name: "取消关联取点" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "完成文字编辑" }));
    expect(props.onCommand).toHaveBeenCalledTimes(1);
    const drawing = savedDrawing(props.onCommand.mock.calls[0][0].drawing);
    expect(drawing.text).toBe(text);
    expect(drawing.anchors).toEqual([{ time: barX === 100 ? candles[0].time : candles[1].time, price: 400 - barY }]);
    const context = fakeContext();
    paintDrawingScene(context, {
      width: 640, height: 400, drawings: [drawing], currency: "HKD",
      pointFor: () => ({ x: barX, y: barY }),
      pointForDrawing: () => ({ x: drawing.canvasX! * 640, y: drawing.canvasY! * 400 }),
    });
    const [left, top, width, height] = vi.mocked(context.strokeRect).mock.calls[0];
    expect(barX < left || barX > left + width || barY < top || barY > top + height).toBe(true);
    const start = vi.mocked(context.moveTo).mock.calls.at(-1)!;
    const end = vi.mocked(context.lineTo).mock.calls.at(-1)!;
    expect(Math.hypot(start[0] - end[0], start[1] - end[1])).toBeGreaterThanOrEqual(12);
    expect(left).toBeGreaterThanOrEqual(0);
    expect(top).toBeGreaterThanOrEqual(0);
    expect(left + width).toBeLessThanOrEqual(640);
    expect(top + height).toBeLessThanOrEqual(400);
  });

  it("keeps draft and pending pick when a large card has no space for an external connector", () => {
    const ref = createRef<DrawingCanvasHandle>();
    const { canvas, props } = renderCanvas({ coordinateAdapter: {
      timeToX: () => 50, priceToY: (price: number) => 200 - price,
      xToTime: () => candles[0].time, yToPrice: (y: number) => 200 - y,
    } }, ref);
    fireEvent.pointerDown(canvas, { pointerId: 35, clientX: 50, clientY: 50 });
    const text = "完整中文判断不能为排版删减\n第二行继续保留原有事实\n第三行保留后续观察";
    fireEvent.change(screen.getByRole("textbox", { name: "文字标注" }), { target: { value: text } });
    fireEvent.change(screen.getByRole("combobox", { name: "文字字号" }), { target: { value: "32" } });
    fireEvent.click(screen.getByRole("button", { name: "关联价格 / K线" }));
    fireEvent.pointerDown(canvas, { pointerId: 36, clientX: 50, clientY: 50 });
    expect(screen.getByRole("alert")).toHaveTextContent("关联点与文字卡片空间不足");
    expect(screen.getByRole("textbox", { name: "文字标注" })).toHaveValue(text);
    expect(screen.getByRole("button", { name: "取消关联取点" })).toBeInTheDocument();
    expect(ref.current?.commitText()).toBe(false);
    expect(props.onCommand).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "取消关联取点" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "文字标注" })).toHaveValue(text);
  });
});
