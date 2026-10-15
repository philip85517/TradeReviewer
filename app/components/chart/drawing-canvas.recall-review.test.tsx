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
import {
  textCardLayout,
  textCardLayoutOptions,
  textLayout,
} from "../../lib/chart/text-geometry";
import {
  DrawingCanvas,
  findLowerBoundTextWidth,
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

function surfaceRecordingContext() {
  const context = fakeContext();
  const fillCalls: Array<{ fillStyle: CanvasRenderingContext2D["fillStyle"]; globalAlpha: number; args: number[] }> = [];
  context.fillRect = vi.fn((...args: [number, number, number, number]) => {
    fillCalls.push({
      fillStyle: context.fillStyle,
      globalAlpha: context.globalAlpha,
      args,
    });
  }) as unknown as CanvasRenderingContext2D["fillRect"];
  return { context, fillCalls };
}

function strokeRecordingContext() {
  const context = fakeContext();
  const strokeCalls: Array<{
    strokeStyle: CanvasRenderingContext2D["strokeStyle"];
    globalAlpha: number;
    args: number[];
  }> = [];
  context.strokeRect = vi.fn((...args: [number, number, number, number]) => {
    strokeCalls.push({
      strokeStyle: context.strokeStyle,
      globalAlpha: context.globalAlpha,
      args,
    });
  }) as unknown as CanvasRenderingContext2D["strokeRect"];
  return { context, strokeCalls };
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
  const rendered = render(
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
  return { canvas, stage, props, context, rerender: rendered.rerender };
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

  it("keeps text controls outside a sibling card body in a narrow chart", () => {
    const first = savedDrawing({
      id: "narrow-sibling-first",
      tool: "text",
      anchors: [{ time: candles[0].time, price: 101.25 }],
      placement: "canvas",
      canvasX: 0.02,
      canvasY: 0.16,
      textWidth: 236,
      text: "第一行\n第二行",
    });
    const second = savedDrawing({
      id: "narrow-sibling-second",
      tool: "text",
      anchors: [{ time: candles[1].time, price: 101.25 }],
      placement: "canvas",
      canvasX: 0.02,
      canvasY: 0.35,
      textWidth: 236,
      text: "第三行\n第四行",
    });

    renderCanvas(
      { activeTool: "cursor", drawings: [first, second], selectedDrawingId: second.id },
      undefined,
      { width: 328, height: 270 },
    );

    const rect = (element: HTMLElement, fallbackWidth = 24, fallbackHeight = 24) => {
      const left = Number.parseFloat(element.style.left);
      const top = Number.parseFloat(element.style.top);
      const width = Number.parseFloat(element.style.width) || fallbackWidth;
      const height = Number.parseFloat(element.style.height) || fallbackHeight;
      return { left, top, right: left + width, bottom: top + height };
    };
    const overlaps = (left: ReturnType<typeof rect>, right: ReturnType<typeof rect>) =>
      left.left < right.right && right.left < left.right && left.top < right.bottom && right.top < left.bottom;
    const body = (id: string) => screen.getByLabelText(`文字内容 ${id}`);

    const firstBody = rect(body(first.id), 236, 94);
    const secondBody = rect(body(second.id), 236, 94);
    const firstFold = rect(screen.getByRole("button", { name: `收起文字 ${first.id}` }));
    const secondFold = rect(screen.getByRole("button", { name: `收起文字 ${second.id}` }));
    const secondEdit = rect(screen.getByRole("button", { name: `编辑文字 ${second.id}` }), 36, 36);
    const selectedMoveElement = screen.getByRole("button", { name: `移动文字 ${second.id}` });
    const selectedMove = rect(selectedMoveElement);
    expect(selectedMoveElement).toHaveStyle({ color: "var(--link, #8cbdff)" });

    for (const control of [
      screen.getByRole("button", { name: `收起文字 ${first.id}` }),
      screen.getByRole("button", { name: `收起文字 ${second.id}` }),
      screen.getByRole("button", { name: `编辑文字 ${second.id}` }),
      screen.getByRole("button", { name: `移动文字 ${second.id}` }),
    ]) {
      expect(control).toHaveStyle({ pointerEvents: "auto" });
    }

    expect(overlaps(firstFold, secondBody)).toBe(false);
    expect(overlaps(secondFold, firstBody)).toBe(false);
    expect(overlaps(secondEdit, firstBody)).toBe(false);
    expect(overlaps(selectedMove, firstBody)).toBe(false);
  });

  it("keeps controls adjacent when the first narrow card is fully expanded", () => {
    const first = savedDrawing({
      id: "expanded-first-sibling",
      tool: "text",
      anchors: [{ time: candles[0].time, price: 101.25 }],
      placement: "canvas",
      canvasX: 0.02,
      canvasY: 0.16,
      textWidth: 236,
      text: "第一行完整正文\n第二行完整正文\n第三行完整正文\n第四行完整正文",
    });
    const second = savedDrawing({
      id: "expanded-second-sibling",
      tool: "text",
      anchors: [{ time: candles[1].time, price: 101.25 }],
      placement: "canvas",
      canvasX: 0.02,
      canvasY: 0.35,
      textWidth: 236,
      text: "第五行完整正文\n第六行完整正文\n第七行完整正文\n第八行完整正文",
    });

    renderCanvas(
      {
        activeTool: "cursor",
        drawings: [first, second],
        selectedDrawingId: second.id,
      },
      undefined,
      { width: 328, height: 270 },
    );

    const rect = (element: HTMLElement, fallbackWidth = 24, fallbackHeight = 24) => {
      const left = Number.parseFloat(element.style.left);
      const top = Number.parseFloat(element.style.top);
      const width = Number.parseFloat(element.style.width) || fallbackWidth;
      const height = Number.parseFloat(element.style.height) || fallbackHeight;
      return { left, top, right: left + width, bottom: top + height };
    };
    const overlaps = (left: ReturnType<typeof rect>, right: ReturnType<typeof rect>) =>
      left.left < right.right && right.left < left.right && left.top < right.bottom && right.top < left.bottom;
    fireEvent.click(screen.getByRole("button", { name: `展开文字 ${first.id}` }));
    const firstBody = rect(screen.getByLabelText(`文字内容 ${first.id}`), 236, 94);
    const secondBody = rect(screen.getByLabelText(`文字内容 ${second.id}`), 236, 94);
    expect(screen.getByLabelText(`文字内容 ${first.id}`)).toHaveTextContent("第四行完整正文");
    for (const control of [
      screen.getByRole("button", { name: `编辑文字 ${second.id}` }),
      screen.getByRole("button", { name: `移动文字 ${second.id}` }),
    ]) {
      expect(overlaps(rect(control), firstBody)).toBe(false);
      expect(control).toHaveStyle({ pointerEvents: "auto" });
    }
    expect(overlaps(rect(screen.getByRole("button", { name: `收起文字 ${first.id}` })), secondBody)).toBe(false);
  });

  it("keeps the folded narrow card expand handle pointer reachable beside a sibling", () => {
    const first = savedDrawing({
      id: "folded-sibling-first",
      tool: "text",
      anchors: [{ time: candles[0].time, price: 101.25 }],
      placement: "canvas",
      canvasX: 0.02,
      canvasY: 0.16,
      textWidth: 236,
      text: "第一行\n第二行",
    });
    const second = savedDrawing({
      id: "folded-sibling-second",
      tool: "text",
      anchors: [{ time: candles[1].time, price: 101.25 }],
      placement: "canvas",
      canvasX: 0.02,
      canvasY: 0.35,
      textWidth: 236,
      text: "第三行\n第四行",
    });

    renderCanvas(
      { activeTool: "cursor", drawings: [first, second], selectedDrawingId: second.id },
      undefined,
      { width: 328, height: 270 },
    );

    fireEvent.click(screen.getByRole("button", { name: `收起文字 ${second.id}` }));

    const expand = screen.getByRole("button", { name: `展开文字 ${second.id}` });
    const rect = (element: HTMLElement, fallbackWidth = 24, fallbackHeight = 24) => {
      const left = Number.parseFloat(element.style.left);
      const top = Number.parseFloat(element.style.top);
      const width = Number.parseFloat(element.style.width) || fallbackWidth;
      const height = Number.parseFloat(element.style.height) || fallbackHeight;
      return { left, top, right: left + width, bottom: top + height };
    };
    const firstBody = rect(screen.getByLabelText(`文字内容 ${first.id}`), 236, 94);
    const expandRect = rect(expand);
    const selectedMove = rect(screen.getByRole("button", { name: `移动文字 ${second.id}` }));
    expect(expand).toHaveAttribute("data-control-placement", "plot");
    expect(expand).toHaveStyle({ pointerEvents: "auto" });
    expect(expandRect.left >= firstBody.right || expandRect.right <= firstBody.left || expandRect.top >= firstBody.bottom || expandRect.bottom <= firstBody.top).toBe(true);
    expect(expandRect.left >= selectedMove.right || expandRect.right <= selectedMove.left || expandRect.top >= selectedMove.bottom || expandRect.bottom <= selectedMove.top).toBe(true);
    expect(expandRect.left).toBeGreaterThanOrEqual(firstBody.right + 6);
  });

  it("keeps the narrow selected source readout clear of the first card body", () => {
    const first = savedDrawing({
      id: "narrow-readout-first",
      tool: "text",
      anchors: [{ time: candles[0].time, price: 101.25 }],
      placement: "canvas",
      canvasX: 0.02,
      canvasY: 0.16,
      textWidth: 236,
      text: "第一行\n第二行",
    });
    const second = savedDrawing({
      id: "narrow-readout-second",
      tool: "text",
      anchors: [{ time: candles[1].time, price: 101.25 }],
      placement: "canvas",
      canvasX: 0.02,
      canvasY: 0.35,
      textWidth: 236,
      text: "第三行\n第四行",
    });

    renderCanvas(
      { activeTool: "cursor", drawings: [first, second], selectedDrawingId: second.id },
      undefined,
      { width: 328, height: 270 },
    );

    const rect = (element: HTMLElement, fallbackWidth = 24, fallbackHeight = 24) => {
      const left = Number.parseFloat(element.style.left);
      const top = Number.parseFloat(element.style.top);
      const width = Number.parseFloat(element.style.width) || fallbackWidth;
      const height = Number.parseFloat(element.style.height) || fallbackHeight;
      return { left, top, right: left + width, bottom: top + height };
    };
    const readout = rect(screen.getByRole("status", { name: `文字锚点 ${second.id}` }), 190, 38);
    const firstBody = rect(screen.getByLabelText(`文字内容 ${first.id}`), 236, 94);
    expect(readout.right <= firstBody.left || firstBody.right <= readout.left || readout.bottom <= firstBody.top || firstBody.bottom <= readout.top).toBe(true);
  });

  it("keeps required Text controls and source readout reachable in the measured 244px plot", () => {
    const first = savedDrawing({
      id: "actual-bounds-first",
      tool: "text",
      anchors: [{ time: candles[0].time, price: 101.25 }],
      placement: "canvas",
      canvasX: 0.02,
      canvasY: 0.16,
      textWidth: 236,
      text: "第一张卡第一行\n第一张卡第二行\n第一张卡第三行",
    });
    const second = savedDrawing({
      id: "actual-bounds-second",
      tool: "text",
      anchors: [{ time: candles[1].time, price: 101.25 }],
      placement: "canvas",
      canvasX: 0.02,
      canvasY: 0.35,
      textWidth: 236,
      text: "第二张卡第一行\n第二张卡第二行\n第二张卡第三行",
    });

    renderCanvas(
      {
        activeTool: "cursor",
        drawings: [first, second],
        selectedDrawingId: second.id,
        plotBounds: { width: 244, height: 242 },
        controlObstacles: [{ id: "compact-toolbar", left: 84, top: 197, right: 160, bottom: 235 }],
      },
      undefined,
      { width: 328, height: 270 },
    );

    const expand = screen.getByRole("button", { name: `展开文字 ${second.id}` });
    const move = screen.getByRole("button", { name: `移动文字 ${second.id}` });
    expect(expand).toHaveAttribute("data-control-placement", "plot");
    expect(expand).toHaveStyle({ pointerEvents: "auto" });
    expect(move).toHaveStyle({ pointerEvents: "auto" });

    const readout = screen.getByRole("status", { name: `文字锚点 ${second.id}` });
    expect(readout).toBeVisible();
    const rect = (element: HTMLElement, fallbackWidth = 190, fallbackHeight = 38) => {
      const left = Number.parseFloat(element.style.left);
      const top = Number.parseFloat(element.style.top);
      const width = Number.parseFloat(element.style.width) || fallbackWidth;
      const height = Number.parseFloat(element.style.height) || fallbackHeight;
      return { left, top, right: left + width, bottom: top + height };
    };
    const readoutRect = rect(readout);
    expect(readoutRect.left).toBeGreaterThanOrEqual(0);
    expect(readoutRect.right).toBeLessThanOrEqual(244);
    expect(readoutRect.top).toBeGreaterThanOrEqual(0);
    expect(readoutRect.bottom).toBeLessThanOrEqual(242);
    const secondBody = rect(screen.getByLabelText(`文字内容 ${second.id}`), 236, 94);
    const overlaps = (left: ReturnType<typeof rect>, right: ReturnType<typeof rect>) =>
      left.left < right.right && right.left < left.right && left.top < right.bottom && right.top < left.bottom;
    expect(overlaps(readoutRect, secondBody)).toBe(false);
    expect(overlaps(readoutRect, rect(screen.getByLabelText(`文字内容 ${first.id}`), 236, 94))).toBe(false);
    expect(overlaps(readoutRect, { left: 84, top: 197, right: 160, bottom: 235 })).toBe(false);
  });

  it.each([false, true])("keeps a folded narrow card's side expand target clear with coarse hit size (coarse=%s)", (coarse) => {
    vi.stubGlobal("matchMedia", vi.fn((query: string) => ({
      matches: coarse && query === "(pointer: coarse)",
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })));
    const first = savedDrawing({
      id: `coarse-first-${coarse}`,
      tool: "text",
      anchors: [{ time: candles[0].time, price: 101.25 }],
      placement: "canvas",
      canvasX: 0.02,
      canvasY: 0.16,
      textWidth: 236,
      text: "第一行\n第二行",
    });
    const second = savedDrawing({
      id: `coarse-second-${coarse}`,
      tool: "text",
      anchors: [{ time: candles[1].time, price: 101.25 }],
      placement: "canvas",
      canvasX: 0.02,
      canvasY: 0.35,
      textWidth: 236,
      text: "第三行\n第四行",
    });

    renderCanvas(
      { activeTool: "cursor", drawings: [first, second], selectedDrawingId: second.id },
      undefined,
      { width: 328, height: 270 },
    );
    fireEvent.click(screen.getByRole("button", { name: `收起文字 ${second.id}` }));

    const expand = screen.getByRole("button", { name: `展开文字 ${second.id}` });
    const firstBody = screen.getByLabelText(`文字内容 ${first.id}`);
    const expandLeft = Number.parseFloat(expand.style.left);
    const firstRight = Number.parseFloat(firstBody.style.left) + Number.parseFloat(firstBody.style.width);
    expect(Number.parseFloat(expand.style.width)).toBe(coarse ? 44 : 24);
    expect(expandLeft).toBeGreaterThanOrEqual(firstRight + 6);
    expect(expand).toHaveStyle({ pointerEvents: "auto" });
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

    expect(context.font).toContain("400 14px");
    expect(context.font).not.toContain("var(");
    expect(context.fillText).toHaveBeenCalledWith("1", expect.any(Number), expect.any(Number));
  });

  it("keeps ordinary anchored Text free of the bright selection frame", () => {
    const drawing = savedDrawing({
      id: "ordinary-card-no-frame",
      tool: "text",
      anchors: [{ time: candles[0].time, price: 100 }],
      placement: "anchor",
      canvasX: 0.3,
      canvasY: 0.2,
      text: "普通卡片",
    });
    const scene = {
      width: 100,
      height: 100,
      drawings: [drawing],
      pointFor: () => ({ x: 10, y: 40 }),
      pointForDrawing: () => ({ x: 30, y: 20 }),
      currency: "HKD",
    };
    const { context, strokeCalls } = strokeRecordingContext();
    paintDrawingScene(context, scene, true);
    expect(strokeCalls).toHaveLength(1);
    expect(strokeCalls[0].strokeStyle).not.toBe("#2f80ed");
    expect(context.fillText).toHaveBeenCalledWith(expect.stringContaining("普通"), expect.any(Number), expect.any(Number));
  });

  it("paints exactly one persistent selected Text state layer", () => {
    const drawing = savedDrawing({
      id: "selected-card-one-layer",
      tool: "text",
      anchors: [{ time: candles[0].time, price: 100 }],
      placement: "anchor",
      canvasX: 0.3,
      canvasY: 0.2,
      text: "选中卡片",
    });
    const { context, strokeCalls } = strokeRecordingContext();
    paintDrawingScene(context, {
      width: 100,
      height: 100,
      drawings: [drawing],
      selectedDrawingId: drawing.id,
      pointFor: () => ({ x: 10, y: 40 }),
      pointForDrawing: () => ({ x: 30, y: 20 }),
      currency: "HKD",
    }, true);
    expect(strokeCalls).toHaveLength(1);
    expect(strokeCalls[0].strokeStyle).toBe("#8cbdff");
  });

  it.each([false, true])("exposes a selected unlocked Text width handle at fine/coarse size (coarse=%s)", (coarse) => {
    vi.stubGlobal("matchMedia", vi.fn((query: string) => ({
      matches: coarse && query === "(pointer: coarse)",
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })));
    const drawing = savedDrawing({
      id: `width-handle-${coarse}`,
      tool: "text",
      anchors: [{ time: candles[0].time, price: 100 }],
      placement: "anchor",
      canvasX: 0.25,
      canvasY: 0.25,
      textWidth: 180,
      text: "第一行完整正文\n第二行完整正文\n第三行完整正文",
    });
    const onCommand = vi.fn();
    renderCanvas({ activeTool: "cursor", drawings: [drawing], selectedDrawingId: drawing.id, onCommand }, undefined, { width: 800, height: 600 });
    const handle = screen.getByRole("button", { name: `调整文字宽度 ${drawing.id}` });
    const expectedSize = coarse ? 44 : 24;
    expect(Number.parseFloat(handle.style.width)).toBe(expectedSize);
    expect(Number.parseFloat(handle.style.height)).toBe(expectedSize);
    expect(handle).toHaveStyle({ cursor: "ew-resize" });
  });

  it("previews a width drag, commits once, preserves geometry, and rolls back on cancel", () => {
    const onCommand = vi.fn();
    const drawing = savedDrawing({
      id: "width-drag-lifecycle",
      tool: "text",
      anchors: [{ time: candles[0].time, price: 100 }],
      placement: "anchor",
      canvasX: 0.25,
      canvasY: 0.25,
      textWidth: 180,
      text: "第一行完整正文\n第二行完整正文\n第三行完整正文",
    });
    const { stage } = renderCanvas({
      activeTool: "cursor",
      drawings: [drawing],
      selectedDrawingId: drawing.id,
      onCommand,
    }, undefined, { width: 800, height: 600 });
    const handle = screen.getByRole("button", { name: `调整文字宽度 ${drawing.id}` });
    const originalLeft = Number.parseFloat(handle.style.left);
    const originalTop = Number.parseFloat(handle.style.top);
    fireEvent.pointerDown(handle, { pointerId: 90, clientX: originalLeft + 12, clientY: originalTop + 12 });
    fireEvent.pointerMove(stage, { pointerId: 90, clientX: originalLeft + 12, clientY: originalTop + 80 });
    expect(screen.getByLabelText(`文字内容 ${drawing.id}`)).toHaveStyle({ width: "180px" });
    fireEvent.pointerUp(stage, { pointerId: 90, clientX: originalLeft + 12, clientY: originalTop + 80 });
    expect(onCommand).not.toHaveBeenCalled();

    fireEvent.pointerDown(handle, { pointerId: 91, clientX: originalLeft + 12, clientY: originalTop + 12 });
    fireEvent.pointerMove(stage, { pointerId: 91, clientX: originalLeft + 72, clientY: originalTop + 12 });
    const previewHandle = screen.getByRole("button", { name: `调整文字宽度 ${drawing.id}` });
    expect(Number.parseFloat(previewHandle.style.left)).toBeGreaterThan(originalLeft);
    expect(screen.getByLabelText(`文字内容 ${drawing.id}`)).toHaveStyle({ width: "240px" });
    fireEvent.pointerUp(stage, { pointerId: 91, clientX: originalLeft + 72, clientY: originalTop + 12 });
    expect(onCommand).toHaveBeenCalledTimes(1);
    expect(onCommand).toHaveBeenCalledWith(expect.objectContaining({
      type: "replace",
      drawing: expect.objectContaining({
        id: drawing.id,
        textWidth: 240,
        anchors: drawing.anchors,
        canvasX: drawing.canvasX,
        canvasY: drawing.canvasY,
        text: drawing.text,
      }),
    }));
    const committed = screen.getByRole("button", { name: `调整文字宽度 ${drawing.id}` });
    const committedLeft = Number.parseFloat(committed.style.left);
    fireEvent.pointerDown(committed, { pointerId: 92, clientX: committedLeft + 12, clientY: originalTop + 12 });
    fireEvent.pointerMove(stage, { pointerId: 92, clientX: committedLeft - 24, clientY: originalTop + 12 });
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.getByRole("button", { name: `调整文字宽度 ${drawing.id}` })).toHaveStyle({ left: `${committedLeft}px` });
    expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("clamps right-edge Text width to remaining plot space without moving the card", () => {
    const onCommand = vi.fn();
    const drawing = savedDrawing({
      id: "width-drag-right-edge",
      tool: "text",
      anchors: [{ time: candles[0].time, price: 100 }],
      placement: "anchor",
      canvasX: 0.72,
      canvasY: 0.25,
      textWidth: 180,
      text: "右侧正文",
    });
    const { stage } = renderCanvas({
      activeTool: "cursor",
      drawings: [drawing],
      selectedDrawingId: drawing.id,
      onCommand,
    }, undefined, { width: 800, height: 600 });

    const body = screen.getByLabelText(`文字内容 ${drawing.id}`);
    const originalLeft = Number.parseFloat(body.style.left);
    const originalTop = Number.parseFloat(body.style.top);
    const handle = screen.getByRole("button", { name: `调整文字宽度 ${drawing.id}` });
    const handleLeft = Number.parseFloat(handle.style.left);
    const handleTop = Number.parseFloat(handle.style.top);
    fireEvent.pointerDown(handle, { pointerId: 94, clientX: handleLeft + 12, clientY: handleTop + 12 });
    fireEvent.pointerMove(stage, { pointerId: 94, clientX: handleLeft + 72, clientY: handleTop + 12 });

    const preview = screen.getByLabelText(`文字内容 ${drawing.id}`);
    const previewWidth = Number.parseFloat(preview.style.width);
    expect(Number.parseFloat(preview.style.left)).toBe(originalLeft);
    expect(Number.parseFloat(preview.style.top)).toBe(originalTop);
    expect(previewWidth).toBeLessThan(240);
    expect(originalLeft + previewWidth).toBeLessThanOrEqual(800 - 4);

    fireEvent.pointerUp(stage, { pointerId: 94, clientX: handleLeft + 72, clientY: handleTop + 12 });
    expect(onCommand).toHaveBeenCalledWith(expect.objectContaining({
      type: "replace",
      drawing: expect.objectContaining({ id: drawing.id, textWidth: previewWidth }),
    }));
  });

  it("keeps the visible left and top fixed when a right-edge width drag shrinks the stored card", () => {
    const onCommand = vi.fn();
    const drawing = savedDrawing({
      id: "width-drag-preserves-base-origin",
      tool: "text",
      anchors: [{ time: candles[0].time, price: 100 }],
      placement: "anchor",
      canvasX: 0.650216658485127,
      canvasY: 0.4409278325,
      textWidth: 180,
      text: "右边界缩窄仍保留完整位置",
    });
    const { stage, rerender } = renderCanvas({
      activeTool: "cursor",
      drawings: [drawing],
      selectedDrawingId: drawing.id,
      onCommand,
      plotBounds: { width: 662, height: 630 },
    }, undefined, { width: 748, height: 659 });

    const before = screen.getByLabelText(`文字内容 ${drawing.id}`);
    const originalLeft = Number.parseFloat(before.style.left);
    const originalTop = Number.parseFloat(before.style.top);
    const handle = screen.getByRole("button", { name: `调整文字宽度 ${drawing.id}` });
    const handleLeft = Number.parseFloat(handle.style.left);
    const handleTop = Number.parseFloat(handle.style.top);

    fireEvent.pointerDown(handle, {
      pointerId: 221,
      clientX: handleLeft + 12,
      clientY: handleTop + 12,
    });
    fireEvent.pointerMove(stage, {
      pointerId: 221,
      clientX: handleLeft - 16,
      clientY: handleTop + 12,
    });

    const during = screen.getByLabelText(`文字内容 ${drawing.id}`);
    expect(Number.parseFloat(during.style.width)).toBe(152);
    expect(Number.parseFloat(during.style.left)).toBeCloseTo(originalLeft, 5);
    expect(Number.parseFloat(during.style.top)).toBeCloseTo(originalTop, 5);

    fireEvent.pointerUp(stage, {
      pointerId: 221,
      clientX: handleLeft - 16,
      clientY: handleTop + 12,
    });

    expect(onCommand).toHaveBeenCalledWith(expect.objectContaining({
      type: "replace",
      drawing: expect.objectContaining({
        id: drawing.id,
        textWidth: 152,
      }),
    }));

    const committed = onCommand.mock.calls.at(-1)?.[0] as {
      drawing?: NormalizedDrawing;
    };
    expect(committed.drawing?.canvasX).toBeCloseTo(originalLeft / 748, 5);
    expect(committed.drawing?.canvasY).toBeCloseTo(originalTop / 659, 5);

    rerender(
      <div className="chart-stage" data-testid="chart-stage">
        <DrawingCanvas
          episodeId="episode-1"
          candles={candles}
          cursor={candles[1].time}
          drawings={[committed.drawing as NormalizedDrawing]}
          selectedDrawingId={drawing.id}
          activeTool="cursor"
          plannedRiskAmount={undefined}
          currency="HKD"
          onSelectDrawing={vi.fn()}
          onCommand={onCommand}
          coordinateAdapter={adapter}
          plotBounds={{ width: 662, height: 630 }}
          multilineText={false}
        />
      </div>,
    );
    const after = screen.getByLabelText(`文字内容 ${drawing.id}`);
    expect(Number.parseFloat(after.style.left)).toBeCloseTo(originalLeft, 5);
    expect(Number.parseFloat(after.style.top)).toBeCloseTo(originalTop, 5);
  });

  it("keeps the Text card top fixed when a narrow width would wrap beyond the bottom edge", () => {
    const onCommand = vi.fn();
    const drawing = savedDrawing({
      id: "width-drag-bottom-edge",
      tool: "text",
      anchors: [{ time: candles[0].time, price: 100 }],
      placement: "anchor",
      canvasX: 0.25,
      canvasY: 0.88,
      textWidth: 180,
      text: "一二三四五六",
    });
    const { stage } = renderCanvas({
      activeTool: "cursor",
      drawings: [drawing],
      selectedDrawingId: drawing.id,
      onCommand,
    }, undefined, { width: 800, height: 600 });

    const body = screen.getByLabelText(`文字内容 ${drawing.id}`);
    const originalTop = Number.parseFloat(body.style.top);
    const originalWidth = Number.parseFloat(body.style.width);
    const handle = screen.getByRole("button", { name: `调整文字宽度 ${drawing.id}` });
    const handleLeft = Number.parseFloat(handle.style.left);
    const handleTop = Number.parseFloat(handle.style.top);
    fireEvent.pointerDown(handle, { pointerId: 95, clientX: handleLeft + 12, clientY: handleTop + 12 });
    fireEvent.pointerMove(stage, { pointerId: 95, clientX: handleLeft - 140, clientY: handleTop + 12 });

    const preview = screen.getByLabelText(`文字内容 ${drawing.id}`);
    const previewWidth = Number.parseFloat(preview.style.width);
    expect(Number.parseFloat(preview.style.top)).toBe(originalTop);
    expect(previewWidth).toBeLessThan(originalWidth);

    fireEvent.pointerUp(stage, { pointerId: 95, clientX: handleLeft - 140, clientY: handleTop + 12 });
    expect(onCommand).toHaveBeenCalledWith(expect.objectContaining({
      type: "replace",
      drawing: expect.objectContaining({ id: drawing.id, textWidth: previewWidth }),
    }));
  });

  it("terminates lower-bound Text width search when adjacent bounds leave only the upper width fitting", () => {
    let calls = 0;
    expect(() => findLowerBoundTextWidth(83, 84, (width) => {
      calls += 1;
      if (calls > 8) throw new Error("non-converging lower-bound search");
      return width === 84;
    })).not.toThrow();
    expect(findLowerBoundTextWidth(83, 84, (width) => width === 84)).toBe(84);
    expect(calls).toBeLessThanOrEqual(2);
  });

  it("keeps the Text edit control compact while retaining its accessible hit target", () => {
    const drawing = savedDrawing({
      id: "edit-control-icon",
      tool: "text",
      anchors: [{ time: candles[0].time, price: 100 }],
      placement: "anchor",
      canvasX: 0.25,
      canvasY: 0.25,
      text: "编辑图标",
    });
    renderCanvas({ activeTool: "cursor", drawings: [drawing], selectedDrawingId: drawing.id }, undefined, { width: 800, height: 600 });

    const edit = screen.getByRole("button", { name: `编辑文字 ${drawing.id}` });
    expect(edit).toHaveAttribute("title", "编辑文字");
    expect(edit.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(edit).not.toHaveTextContent("编辑文字");
    expect(Number.parseFloat(edit.style.width)).toBe(36);
    expect(Number.parseFloat(edit.style.height)).toBe(36);
  });

  it("retains the coarse-pointer Text edit hit target with the compact icon", () => {
    vi.stubGlobal("matchMedia", vi.fn((query: string) => ({
      matches: query === "(pointer: coarse)",
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })));
    const drawing = savedDrawing({
      id: "edit-control-icon-coarse",
      tool: "text",
      anchors: [{ time: candles[0].time, price: 100 }],
      placement: "anchor",
      canvasX: 0.25,
      canvasY: 0.25,
      text: "编辑图标",
    });
    renderCanvas({ activeTool: "cursor", drawings: [drawing], selectedDrawingId: drawing.id }, undefined, { width: 800, height: 600 });

    const edit = screen.getByRole("button", { name: `编辑文字 ${drawing.id}` });
    expect(edit.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(Number.parseFloat(edit.style.width)).toBe(44);
    expect(Number.parseFloat(edit.style.height)).toBe(44);
  });

  it("keeps the edited Text buffer and width in sync while resizing", () => {
    const onCommand = vi.fn();
    const drawing = savedDrawing({
      id: "width-drag-editor-buffer",
      tool: "text",
      anchors: [{ time: candles[0].time, price: 100 }],
      placement: "anchor",
      canvasX: 0.25,
      canvasY: 0.25,
      textWidth: 180,
      text: "旧正文",
    });
    const { stage } = renderCanvas({
      activeTool: "cursor",
      drawings: [drawing],
      selectedDrawingId: drawing.id,
      onCommand,
    }, undefined, { width: 800, height: 600 });

    fireEvent.click(screen.getByRole("button", { name: `编辑文字 ${drawing.id}` }));
    const editor = screen.getByRole("textbox", { name: "文字标注" });
    fireEvent.change(editor, { target: { value: "宽度变化后仍保留" } });
    const handle = screen.getByRole("button", { name: `调整文字宽度 ${drawing.id}` });
    const left = Number.parseFloat(handle.style.left);
    const top = Number.parseFloat(handle.style.top);
    fireEvent.pointerDown(handle, { pointerId: 93, clientX: left + 12, clientY: top + 12 });
    fireEvent.pointerMove(stage, { pointerId: 93, clientX: left + 72, clientY: top + 12 });
    expect(screen.getByRole("textbox", { name: "文字标注" })).toHaveValue("宽度变化后仍保留");
    fireEvent.pointerUp(stage, { pointerId: 93, clientX: left + 72, clientY: top + 12 });
    fireEvent.click(screen.getByRole("button", { name: "完成文字编辑" }));

    const commands = onCommand.mock.calls.map(([command]) => command as { type: string; drawing?: NormalizedDrawing });
    expect(commands).toHaveLength(2);
    expect(commands[1]).toEqual(expect.objectContaining({
      type: "replace",
      drawing: expect.objectContaining({
        id: drawing.id,
        text: "宽度变化后仍保留",
        textWidth: 240,
      }),
    }));
  });

  it("keeps the width handle clear of transient control obstacles and hides it for locked Text", () => {
    const drawing = savedDrawing({
      id: "width-handle-obstacle",
      tool: "text",
      anchors: [{ time: candles[0].time, price: 100 }],
      placement: "anchor",
      canvasX: 0.25,
      canvasY: 0.25,
      textWidth: 180,
      text: "避让控件",
    });
    const obstacle = { id: "toolbar", left: 0, top: 0, right: 800, bottom: 44 };
    renderCanvas({ activeTool: "cursor", drawings: [drawing], selectedDrawingId: drawing.id, controlObstacles: [obstacle] }, undefined, { width: 800, height: 600 });
    const handle = screen.getByRole("button", { name: `调整文字宽度 ${drawing.id}` });
    const top = Number.parseFloat(handle.style.top);
    expect(top).toBeGreaterThanOrEqual(44);
    cleanup();
    renderCanvas({ activeTool: "cursor", drawings: [{ ...drawing, locked: true }], selectedDrawingId: drawing.id }, undefined, { width: 800, height: 600 });
    expect(screen.queryByRole("button", { name: `调整文字宽度 ${drawing.id}` })).not.toBeInTheDocument();
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

  it("provides a fold control for a complete two-line Text card without rewriting raw text", () => {
    const drawing = savedDrawing({
      id: "short-card-fold",
      tool: "text",
      anchors: [{ time: candles[0].time, price: 100 }],
      placement: "canvas",
      canvasX: 0.2,
      canvasY: 0.2,
      textWidth: 240,
      text: "第一行短正文\n第二行短正文",
    });

    const onCommand = vi.fn();
    renderCanvas({ activeTool: "cursor", drawings: [drawing], selectedDrawingId: drawing.id, onCommand }, undefined, { width: 800, height: 600 });

    const toggle = screen.getByRole("button", { name: `收起文字 ${drawing.id}` });
    expect(toggle).toBeInTheDocument();
    expect(screen.getByLabelText(`文字内容 ${drawing.id}`)).toHaveTextContent("第一行短正文");
    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: `展开文字 ${drawing.id}` })).toBeInTheDocument();
    expect(screen.getByLabelText(`文字内容 ${drawing.id}`)).not.toHaveTextContent("第二行短正文");
    fireEvent.click(screen.getByRole("button", { name: `展开文字 ${drawing.id}` }));
    expect(screen.getByRole("button", { name: `收起文字 ${drawing.id}` })).toBeInTheDocument();
    expect(screen.getByLabelText(`文字内容 ${drawing.id}`)).toHaveTextContent("第二行短正文");
    expect(drawing.text).toBe("第一行短正文\n第二行短正文");
    expect(onCommand).not.toHaveBeenCalled();
  });

  it.each([false, true])("renders the Text edit control at the required hit size (coarse=%s)", (coarse) => {
    vi.stubGlobal("matchMedia", vi.fn((query: string) => ({
      matches: coarse && query === "(pointer: coarse)",
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })));
    const drawing = savedDrawing({
      id: `edit-hit-size-${coarse}`,
      tool: "text",
      anchors: [{ time: candles[0].time, price: 100 }],
      placement: "anchor",
      canvasX: 0.25,
      canvasY: 0.25,
      text: "编辑命中尺寸",
    });

    renderCanvas({ activeTool: "cursor", drawings: [drawing], selectedDrawingId: drawing.id }, undefined, { width: 800, height: 600 });

    const edit = screen.getByRole("button", { name: `编辑文字 ${drawing.id}` });
    const expectedSize = coarse ? 44 : 36;
    expect(Number.parseFloat(edit.style.height)).toBeGreaterThanOrEqual(expectedSize);
    expect(Number.parseFloat(edit.style.minHeight)).toBeGreaterThanOrEqual(expectedSize);
  });

  it.each([false, true])("moves the Text expand control clear of a moved compact-toolbar obstacle without changing saved data (coarse=%s)", (coarse) => {
    vi.stubGlobal("matchMedia", vi.fn((query: string) => ({
      matches: coarse && query === "(pointer: coarse)",
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })));
    const drawing = savedDrawing({
      id: `compact-obstacle-${coarse}`,
      tool: "text",
      anchors: [{ time: candles[0].time, price: 100 }],
      placement: "anchor",
      canvasX: 0.4,
      canvasY: 0.7,
      textWidth: 180,
      text: "第一行完整正文\n第二行完整正文\n第三行完整正文",
      background: "rgba(16, 23, 34, 0.86)",
      style: { color: "#e7edf6", lineWidth: 1.5, opacity: 0.95 },
    });
    const saved = structuredClone(drawing);
    renderCanvas({ activeTool: "cursor", drawings: [drawing], selectedDrawingId: drawing.id }, undefined, { width: 800, height: 600 });
    const initial = screen.getByRole("button", { name: `展开文字 ${drawing.id}` });
    const rect = (button: HTMLElement) => ({
      left: Number.parseFloat(button.style.left),
      top: Number.parseFloat(button.style.top),
      right: Number.parseFloat(button.style.left) + Number.parseFloat(button.style.width),
      bottom: Number.parseFloat(button.style.top) + Number.parseFloat(button.style.height),
    });
    const blockedRect = rect(initial);

    cleanup();
    renderCanvas({
      activeTool: "cursor",
      drawings: [drawing],
      selectedDrawingId: drawing.id,
      controlObstacles: [{ id: "compact-toolbar", ...blockedRect }],
    }, undefined, { width: 800, height: 600 });
    const moved = screen.getByRole("button", { name: `展开文字 ${drawing.id}` });
    const movedRect = rect(moved);
    expect(movedRect.left === blockedRect.left && movedRect.top === blockedRect.top).toBe(false);
    expect(movedRect.right <= blockedRect.left || blockedRect.right <= movedRect.left || movedRect.bottom <= blockedRect.top || blockedRect.bottom <= movedRect.top).toBe(true);
    expect(moved).toHaveStyle({ pointerEvents: "auto" });

    cleanup();
    renderCanvas({
      activeTool: "cursor",
      drawings: [drawing],
      selectedDrawingId: drawing.id,
      controlObstacles: [{ id: "compact-toolbar-moved", ...movedRect }],
    }, undefined, { width: 800, height: 600 });
    const movedAgain = screen.getByRole("button", { name: `展开文字 ${drawing.id}` });
    const movedAgainRect = rect(movedAgain);
    expect(movedAgainRect.right <= movedRect.left || movedRect.right <= movedAgainRect.left || movedAgainRect.bottom <= movedRect.top || movedRect.bottom <= movedAgainRect.top).toBe(true);
    expect(movedAgain).toHaveStyle({ pointerEvents: "auto" });

    fireEvent.click(movedAgain);
    expect(screen.getByLabelText(`文字内容 ${drawing.id}`)).toHaveTextContent("第三行完整正文");
    expect(drawing).toEqual(saved);
  });

  it("marks a fully blocked Text expand control as keyboard fallback instead of claiming mouse reachability", () => {
    const drawing = savedDrawing({
      id: "blocked-expand-fallback",
      tool: "text",
      anchors: [{ time: candles[0].time, price: 100 }],
      placement: "anchor",
      canvasX: 0.4,
      canvasY: 0.7,
      text: "第一行\n第二行\n第三行",
    });
    renderCanvas({
      activeTool: "cursor",
      drawings: [drawing],
      selectedDrawingId: drawing.id,
      controlObstacles: [{ id: "compact-toolbar", left: 0, top: 0, right: 800, bottom: 600 }],
    }, undefined, { width: 800, height: 600 });

    const toggle = screen.getByRole("button", { name: `展开文字 ${drawing.id}` });
    expect(toggle).toHaveAttribute("data-control-placement", "keyboard-fallback");
    expect(toggle).toHaveStyle({ pointerEvents: "none" });
    fireEvent.click(toggle);
    expect(screen.getByLabelText(`文字内容 ${drawing.id}`)).toHaveTextContent("第一行");
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
      background: "#101722",
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

  it("preserves a selected Text card's saved surface and regular body style", () => {
    const drawing = savedDrawing({
      id: "selected-surface-contract",
      tool: "text",
      anchors: [{ time: candles[0].time, price: 100 }],
      placement: "anchor",
      canvasX: 0.2,
      canvasY: 0.2,
      fontSize: 18,
      background: "rgba(16, 23, 34, 0.86)",
      text: "保留已存背景",
    });

    renderCanvas({ activeTool: "cursor", drawings: [drawing], selectedDrawingId: drawing.id });

    const layer = screen.getByLabelText(`文字内容 ${drawing.id}`);
    expect(layer).toHaveStyle({
      background: drawing.background,
      fontSize: "18px",
      fontWeight: "400",
      padding: "4px 4px",
    });
  });

  it("keeps a selected transparent Text card transparent", () => {
    const drawing = savedDrawing({
      id: "selected-transparent-surface",
      tool: "text",
      anchors: [{ time: candles[0].time, price: 100 }],
      placement: "anchor",
      canvasX: 0.2,
      canvasY: 0.2,
      background: "transparent",
      text: "透明背景",
    });

    renderCanvas({ activeTool: "cursor", drawings: [drawing], selectedDrawingId: drawing.id });

    expect(screen.getByLabelText(`文字内容 ${drawing.id}`)).toHaveStyle({
      background: "transparent",
    });
  });

  it("keeps the interactive Text surface single-painted while preserving capture painting", () => {
    const drawing = savedDrawing({
      id: "single-painted-surface",
      tool: "text",
      anchors: [{ time: candles[0].time, price: 100 }],
      placement: "anchor",
      canvasX: 0.2,
      canvasY: 0.2,
      background: "rgba(16, 23, 34, 0.86)",
      text: "单表面背景",
    });
    const scene = {
      width: 100,
      height: 100,
      drawings: [drawing],
      pointFor: () => ({ x: 10, y: 40 }),
      pointForDrawing: () => ({ x: 30, y: 20 }),
      currency: "HKD",
    };

    const ordinary = surfaceRecordingContext();
    paintDrawingScene(ordinary.context, scene, true);
    expect(ordinary.fillCalls).toEqual([
      expect.objectContaining({ fillStyle: drawing.background, globalAlpha: 1 }),
    ]);

    const selected = surfaceRecordingContext();
    paintDrawingScene(selected.context, { ...scene, selectedDrawingId: drawing.id }, true);
    expect(selected.fillCalls).toHaveLength(0);

    const capture = surfaceRecordingContext();
    paintDrawingScene(capture.context, { ...scene, selectedDrawingId: drawing.id }, false);
    expect(capture.fillCalls).toEqual([
      expect.objectContaining({ fillStyle: drawing.background, globalAlpha: 1 }),
    ]);
  });

  it("delegates an ordinary expanded body to the DOM while capture and selected states stay single-painted", () => {
    const drawing = savedDrawing({
      id: "expanded-body-paint-ownership",
      tool: "text",
      anchors: [{ time: candles[0].time, price: 100 }],
      placement: "anchor",
      canvasX: 0.2,
      canvasY: 0.2,
      text: "第一行\n第二行\n第三行",
    });
    const scene = {
      width: 100,
      height: 100,
      drawings: [drawing],
      pointFor: () => ({ x: 10, y: 40 }),
      pointForDrawing: () => ({ x: 30, y: 20 }),
      currency: "HKD",
      expandedTextIds: new Set([drawing.id]),
    };
    const bodyLine = (value: unknown) => String(value).startsWith("第一行");

    const ordinary = fakeContext();
    paintDrawingScene(ordinary, scene, true);
    expect(vi.mocked(ordinary.fillText).mock.calls.filter(([value]) => bodyLine(value))).toHaveLength(0);

    const selected = fakeContext();
    paintDrawingScene(selected, { ...scene, selectedDrawingId: drawing.id }, true);
    expect(vi.mocked(selected.fillText).mock.calls.filter(([value]) => bodyLine(value))).toHaveLength(0);

    const capture = fakeContext();
    paintDrawingScene(capture, scene, false);
    expect(vi.mocked(capture.fillText).mock.calls.filter(([value]) => bodyLine(value))).toHaveLength(1);
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
    expect(move.querySelector("svg")).toHaveClass("lucide-move");
    expect(move.querySelector("svg")).toHaveAttribute("width", "16");
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

  it("uses the frozen card origin for every Text move preview and commits once", () => {
    const runDrag = (moveCount: number) => {
      const onCommand = vi.fn();
      const drawing = savedDrawing({
        id: `text-origin-${moveCount}`,
        tool: "text",
        anchors: [{ time: candles[0].time, price: 100 }],
        placement: "anchor",
        canvasX: 0.2,
        canvasY: 0.2,
        textWidth: 180,
        text: "需要避让的文字卡片",
      });
      const sibling = savedDrawing({
        id: `text-sibling-${moveCount}`,
        tool: "text",
        anchors: [{ time: candles[1].time, price: 100 }],
        placement: "anchor",
        canvasX: 0.2,
        canvasY: 0.2,
        textWidth: 180,
        text: "占用布局空间的文字卡片",
      });
      const { stage } = renderCanvas({
        activeTool: "cursor",
        drawings: [drawing, sibling],
        selectedDrawingId: drawing.id,
        controlObstacles: [{ id: "toolbar", left: 0, top: 0, right: 40, bottom: 40 }],
        onCommand,
      }, undefined, { width: 800, height: 600 });
      const move = screen.getByRole("button", { name: `移动文字 ${drawing.id}` });
      const startX = Number.parseFloat(move.style.left) + 12;
      const startY = Number.parseFloat(move.style.top) + 12;
      fireEvent.pointerDown(move, { pointerId: 300 + moveCount, clientX: startX, clientY: startY });
      for (let index = 1; index <= moveCount; index += 1) {
        fireEvent.pointerMove(stage, {
          pointerId: 300 + moveCount,
          clientX: startX + 120 * index / moveCount,
          clientY: startY + 60 * index / moveCount,
        });
      }
      const previewBody = screen.getByLabelText(`文字内容 ${drawing.id}`);
      const previewPosition = {
        left: Number.parseFloat(previewBody.style.left),
        top: Number.parseFloat(previewBody.style.top),
      };
      fireEvent.pointerUp(stage, { pointerId: 300 + moveCount, clientX: startX + 120, clientY: startY + 60 });
      const command = onCommand.mock.calls.at(-1)?.[0] as { type: string; drawing?: NormalizedDrawing } | undefined;
      expect(onCommand).toHaveBeenCalledTimes(1);
      cleanup();
      return { command, previewPosition, originalAnchors: drawing.anchors };
    };

    const oneMove = runDrag(1);
    const fiveMoves = runDrag(5);
    const twentyMoves = runDrag(20);
    expect(oneMove.command?.type).toBe("replace");
    expect(fiveMoves.command?.type).toBe("replace");
    expect(twentyMoves.command?.type).toBe("replace");
    expect(oneMove.command?.drawing?.anchors).toEqual(oneMove.originalAnchors);
    expect(fiveMoves.command?.drawing?.anchors).toEqual(fiveMoves.originalAnchors);
    expect(twentyMoves.command?.drawing?.anchors).toEqual(twentyMoves.originalAnchors);
    expect(oneMove.command?.drawing?.anchors).toEqual(fiveMoves.command?.drawing?.anchors);
    expect(oneMove.command?.drawing?.anchors).toEqual(twentyMoves.command?.drawing?.anchors);
    expect(oneMove.command?.drawing?.canvasX).toBeCloseTo(fiveMoves.command?.drawing?.canvasX ?? NaN, 6);
    expect(oneMove.command?.drawing?.canvasY).toBeCloseTo(fiveMoves.command?.drawing?.canvasY ?? NaN, 6);
    expect(oneMove.command?.drawing?.canvasX).toBeCloseTo(twentyMoves.command?.drawing?.canvasX ?? NaN, 6);
    expect(oneMove.command?.drawing?.canvasY).toBeCloseTo(twentyMoves.command?.drawing?.canvasY ?? NaN, 6);
    expect(oneMove.previewPosition.left).toBeCloseTo(fiveMoves.previewPosition.left, 6);
    expect(oneMove.previewPosition.top).toBeCloseTo(fiveMoves.previewPosition.top, 6);
    expect(oneMove.previewPosition.left).toBeCloseTo(twentyMoves.previewPosition.left, 6);
    expect(oneMove.previewPosition.top).toBeCloseTo(twentyMoves.previewPosition.top, 6);
  });

  it("does not commit a zero-distance or cancelled Text move", () => {
    const onCommand = vi.fn();
    const drawing = savedDrawing({
      id: "text-move-cancel",
      tool: "text",
      anchors: [{ time: candles[0].time, price: 100 }],
      placement: "anchor",
      canvasX: 0.2,
      canvasY: 0.2,
      text: "取消移动",
    });
    const { stage } = renderCanvas({
      activeTool: "cursor",
      drawings: [drawing],
      selectedDrawingId: drawing.id,
      onCommand,
    });
    const move = screen.getByRole("button", { name: `移动文字 ${drawing.id}` });
    const startX = Number.parseFloat(move.style.left) + 12;
    const startY = Number.parseFloat(move.style.top) + 12;
    const body = screen.getByLabelText(`文字内容 ${drawing.id}`);
    const initialPosition = { left: body.style.left, top: body.style.top };
    fireEvent.pointerDown(move, { pointerId: 410, clientX: startX, clientY: startY });
    fireEvent.pointerUp(stage, { pointerId: 410, clientX: startX, clientY: startY });
    expect(onCommand).not.toHaveBeenCalled();

    fireEvent.pointerDown(move, { pointerId: 411, clientX: startX, clientY: startY });
    fireEvent.pointerMove(stage, { pointerId: 411, clientX: startX + 50, clientY: startY + 25 });
    expect({ left: body.style.left, top: body.style.top }).not.toEqual(initialPosition);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onCommand).not.toHaveBeenCalled();
    expect(body.style.left).toBe(initialPosition.left);
    expect(body.style.top).toBe(initialPosition.top);
  });

  it("merges a committed Text drag back into the open editor without losing its buffer or style", () => {
    const onCommand = vi.fn();
    const drawing = savedDrawing({
      id: "editing-card-drag",
      tool: "text",
      anchors: [{ time: candles[0].time, price: 100 }],
      placement: "anchor",
      canvasX: 0.2,
      canvasY: 0.2,
      textWidth: 80,
      fontSize: 18,
      text: "旧内容",
    });
    const { stage } = renderCanvas({
      activeTool: "cursor",
      drawings: [drawing],
      selectedDrawingId: drawing.id,
      onCommand,
    });

    fireEvent.click(screen.getByRole("button", { name: `编辑文字 ${drawing.id}` }));
    const editor = screen.getByRole("textbox", { name: "文字标注" });
    fireEvent.change(editor, { target: { value: "拖动后仍保留" } });
    fireEvent.click(screen.getByRole("button", { name: "样式" }));
    fireEvent.change(screen.getByRole("spinbutton", { name: "文字宽度" }), { target: { value: "72" } });
    fireEvent.change(screen.getByRole("combobox", { name: "文字字号" }), { target: { value: "24" } });
    fireEvent.change(screen.getByLabelText("文字颜色"), { target: { value: "#ff00aa" } });

    const move = screen.getByRole("button", { name: `移动文字 ${drawing.id}` });
    fireEvent.pointerDown(move, { pointerId: 201, clientX: 14, clientY: 14 });
    fireEvent.pointerMove(stage, { pointerId: 201, clientX: 40, clientY: 30 });
    fireEvent.pointerUp(stage, { pointerId: 201, clientX: 40, clientY: 30 });

    fireEvent.click(screen.getByRole("button", { name: "完成文字编辑" }));

    const commands = onCommand.mock.calls.map(([command]) => command as { type: string; drawing?: NormalizedDrawing });
    expect(commands).toHaveLength(2);
    const dragDrawing = commands[0].drawing;
    expect(dragDrawing).toBeDefined();
    expect(commands[1]).toEqual(expect.objectContaining({
      type: "replace",
      drawing: expect.objectContaining({
        id: drawing.id,
        text: "拖动后仍保留",
        canvasX: expect.closeTo(dragDrawing!.canvasX!, 5),
        canvasY: expect.closeTo(dragDrawing!.canvasY!, 5),
        textWidth: 72,
        fontSize: 24,
        style: expect.objectContaining({ color: "#ff00aa" }),
      }),
    }));
  });

  it("executes a queued Text selection after the draft decision exactly once", async () => {
    const onCommand = vi.fn();
    const onSelectDrawing = vi.fn();
    const first = savedDrawing({
      id: "editing-first",
      tool: "text",
      anchors: [{ time: candles[0].time, price: 100 }],
      placement: "anchor",
      canvasX: 0.2,
      canvasY: 0.2,
      text: "第一条",
    });
    const second = savedDrawing({
      id: "editing-second",
      tool: "text",
      anchors: [{ time: candles[1].time, price: 106 }],
      placement: "anchor",
      canvasX: 0.7,
      canvasY: 0.2,
      text: "第二条",
    });
    renderCanvas({
      activeTool: "cursor",
      drawings: [first, second],
      selectedDrawingId: first.id,
      onCommand,
      onSelectDrawing,
    });

    fireEvent.click(screen.getByRole("button", { name: `编辑文字 ${first.id}` }));
    fireEvent.change(screen.getByRole("textbox", { name: "文字标注" }), { target: { value: "第一条草稿" } });
    const selectSecond = screen.getByRole("button", { name: `选择文字 ${second.id}` });
    fireEvent.pointerDown(selectSecond, { pointerId: 202 });
    fireEvent.pointerDown(selectSecond, { pointerId: 203 });

    expect(screen.getByRole("dialog", { name: "文字草稿待决议" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "完成文字草稿" }));

    await waitFor(() => expect(onSelectDrawing).toHaveBeenCalledWith(second.id));
    expect(onSelectDrawing.mock.calls.filter(([id]) => id === second.id)).toHaveLength(1);
    expect(onCommand).toHaveBeenCalledWith(expect.objectContaining({
      type: "replace",
      drawing: expect.objectContaining({ id: first.id, text: "第一条草稿" }),
    }));
  });

  it("does not show an editor source readout for free canvas Text", () => {
    const drawing = savedDrawing({
      id: "free-editor-readout",
      tool: "text",
      anchors: [],
      placement: "canvas",
      canvasX: 0.3,
      canvasY: 0.2,
      text: "自由文字",
    });
    renderCanvas({ activeTool: "cursor", drawings: [drawing], selectedDrawingId: drawing.id });

    fireEvent.click(screen.getByRole("button", { name: `编辑文字 ${drawing.id}` }));

    expect(screen.queryByRole("status", { name: "文字编辑锚点" })).not.toBeInTheDocument();
  });

  it("keeps a future planned anchor editable without showing an unrevealed source readout", () => {
    const drawing = savedDrawing({
      id: "future-planned-editor-readout",
      tool: "text",
      anchors: [{ time: candles[1].time, price: 106.75 }],
      placement: "anchor",
      createdAtCursor: candles[0].time,
      text: "未来布局计划",
    });
    renderCanvas({
      activeTool: "cursor",
      cursor: candles[0].time,
      drawings: [drawing],
      selectedDrawingId: drawing.id,
      allowFutureAnchors: true,
    });

    fireEvent.click(screen.getByRole("button", { name: `编辑文字 ${drawing.id}` }));

    expect(screen.getByRole("textbox", { name: "文字标注" })).toBeInTheDocument();
    expect(screen.queryByRole("status", { name: "文字编辑锚点" })).not.toBeInTheDocument();
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
    fireEvent.click(screen.getByRole("button", { name: "样式" }));
    const toggle = screen.getByRole("button", { name: "改为自由文字" });

    await user.click(toggle);

    expect(screen.getByRole("textbox", { name: "文字标注" })).toBe(editor);
    expect(screen.getByRole("button", { name: "改为锚定文字" })).toBeInTheDocument();
  });

  it("rolls back a Text anchor drag before opening the draft decision", () => {
    const onCommand = vi.fn();
    const drawing = savedDrawing({
      id: "text-anchor-escape",
      tool: "text",
      text: "原文",
      anchors: [{ time: candles[0].time, price: 100 }],
    });
    const { stage } = renderCanvas({
      activeTool: "cursor",
      drawings: [drawing],
      selectedDrawingId: drawing.id,
      onCommand,
    });

    fireEvent.click(screen.getByRole("button", { name: `编辑文字 ${drawing.id}` }));
    const editor = screen.getByRole("textbox", { name: "文字标注" });
    fireEvent.change(editor, { target: { value: "保留编辑缓冲" } });
    const anchor = screen.getByRole("button", { name: `移动市场锚点 ${drawing.id}` });
    fireEvent.pointerDown(anchor, { pointerId: 46, clientX: 10, clientY: 100 });
    fireEvent.pointerMove(stage, { pointerId: 46, clientX: 30, clientY: 90 });
    fireEvent.keyDown(window, { key: "Escape" });

    expect(screen.queryByRole("dialog", { name: "文字草稿待决议" })).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "文字标注" })).toHaveValue("保留编辑缓冲");
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("keeps the editor body primary and exposes advanced style controls by disclosure", () => {
    const drawing = savedDrawing({
      id: "body-first-editor",
      tool: "text",
      text: "正文优先的编辑注释",
      textWidth: 36,
      fontSize: 24,
      anchors: [{ time: candles[0].time, price: 100 }],
      placement: "anchor",
    });
    renderCanvas(
      {
        activeTool: "cursor",
        drawings: [drawing],
        selectedDrawingId: drawing.id,
        plotBounds: { width: 700, height: 500 },
      },
      undefined,
      { width: 720, height: 520 },
    );

    fireEvent.click(screen.getByRole("button", { name: `编辑文字 ${drawing.id}` }));
    const shell = document.querySelector<HTMLElement>(".drawing-text-editor-shell");
    const header = document.querySelector<HTMLElement>(".drawing-text-editor-header");
    const textarea = screen.getByRole("textbox", { name: "文字标注" });
    expect(textarea).toHaveStyle({
      fontWeight: "400",
      padding: "4px 4px 48px",
    });
    const styleBar = screen.getByLabelText("文字样式");
    const actions = document.querySelector<HTMLElement>(".drawing-text-editor-actions");
    const styleDisclosure = screen.getByRole("button", { name: "样式" });

    expect(shell).not.toBeNull();
    expect(header).not.toBeNull();
    expect(screen.getByRole("button", { name: "移动文字编辑器" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "关闭文字编辑" })).toBeInTheDocument();
    expect(styleDisclosure).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("spinbutton", { name: "文字宽度" })).not.toBeInTheDocument();
    expect(shell ? shell.compareDocumentPosition(textarea) & Node.DOCUMENT_POSITION_CONTAINED_BY : 0).toBeTruthy();
    expect(header ? header.compareDocumentPosition(textarea) & Node.DOCUMENT_POSITION_FOLLOWING : 0).toBeTruthy();
    expect(textarea.compareDocumentPosition(styleBar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(styleBar.compareDocumentPosition(actions as Node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(Number.parseFloat(shell?.style.width ?? "500")).toBeLessThan(500);

    fireEvent.click(styleDisclosure);

    expect(styleDisclosure).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("spinbutton", { name: "文字宽度" })).toBeInTheDocument();
    expect(screen.getByLabelText("文字颜色")).toBeInTheDocument();
  });

  it("keeps the style bar above the textarea despite legacy editor CSS", () => {
    const { canvas } = renderCanvas();

    fireEvent.pointerDown(canvas, { pointerId: 7, clientX: 10, clientY: 100 });
    const editor = screen.getByRole("textbox", { name: "文字标注" });
    const styleBar = screen.getByLabelText("文字样式");
    const shell = document.querySelector<HTMLElement>(".drawing-text-editor-shell");
    fireEvent.click(screen.getByRole("button", { name: "样式" }));
    const colorInput = document.querySelector<HTMLInputElement>('input[type="color"]');

    expect(editor.style.position).toBe("static");
    expect(styleBar.style.position).toBe("relative");
    expect(styleBar.style.zIndex).toBe("7");
    expect(styleBar.style.flexWrap).toBe("");
    expect(styleBar.style.overflow).toBe("hidden");
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
    fireEvent.click(screen.getByRole("button", { name: "样式" }));
    fireEvent.change(screen.getByRole("spinbutton", { name: "文字宽度" }), {
      target: { value: "999" },
    });
    fireEvent.keyDown(editor, { key: "Enter", ctrlKey: true });

    const command = onCommand.mock.calls[0]?.[0] as { drawing?: { textWidth?: number } } | undefined;
    expect(command?.drawing?.textWidth).toBeLessThanOrEqual(100);
  });

  it("clamps numeric Text width to the remaining right-edge space", () => {
    const onCommand = vi.fn();
    const drawing = savedDrawing({
      id: "numeric-width-right-edge",
      tool: "text",
      anchors: [{ time: candles[0].time, price: 100 }],
      placement: "anchor",
      canvasX: 0.72,
      canvasY: 0.25,
      textWidth: 180,
      text: "右侧数字宽度",
    });
    renderCanvas({
      activeTool: "cursor",
      drawings: [drawing],
      selectedDrawingId: drawing.id,
      onCommand,
    }, undefined, { width: 800, height: 600 });

    fireEvent.click(screen.getByRole("button", { name: `编辑文字 ${drawing.id}` }));
    fireEvent.click(screen.getByRole("button", { name: "样式" }));
    const widthInput = screen.getByRole("spinbutton", { name: "文字宽度" });
    expect(widthInput).toHaveAttribute("max", "220");
    fireEvent.change(widthInput, { target: { value: "240" } });
    expect(widthInput).toHaveValue(220);

    fireEvent.click(screen.getByRole("button", { name: "完成文字编辑" }));
    expect(onCommand).toHaveBeenCalledWith(expect.objectContaining({
      type: "replace",
      drawing: expect.objectContaining({ id: drawing.id, textWidth: 220 }),
    }));
  });

  it("keeps the anchored Text card top fixed when numeric width shrinks a bottom-edge card", () => {
    const onCommand = vi.fn();
    const drawing = savedDrawing({
      id: "numeric-width-bottom-edge",
      tool: "text",
      anchors: [{ time: candles[0].time, price: 100 }],
      placement: "anchor",
      canvasX: 0.28,
      canvasY: 0.88,
      textWidth: 300,
      text: "底边数值调宽必须保持左上角。第一句完整保留。第二句完整保留。第三句完整保留。第四句完整保留。",
    });
    const { rerender } = renderCanvas({
      activeTool: "cursor",
      drawings: [drawing],
      selectedDrawingId: drawing.id,
      onCommand,
    }, undefined, { width: 800, height: 600 });

    fireEvent.click(screen.getByRole("button", { name: `展开文字 ${drawing.id}` }));
    const before = screen.getByLabelText(`文字内容 ${drawing.id}`);
    const originalLeft = Number.parseFloat(before.style.left);
    const originalTop = Number.parseFloat(before.style.top);
    const originalCanvasY = drawing.canvasY;

    fireEvent.click(screen.getByRole("button", { name: `编辑文字 ${drawing.id}` }));
    fireEvent.click(screen.getByRole("button", { name: "样式" }));
    fireEvent.change(screen.getByRole("spinbutton", { name: "文字宽度" }), { target: { value: "180" } });
    fireEvent.click(screen.getByRole("button", { name: "完成文字编辑" }));

    expect(onCommand).toHaveBeenCalledWith(expect.objectContaining({
      type: "replace",
      drawing: expect.objectContaining({
        id: drawing.id,
        textWidth: expect.any(Number),
        canvasX: drawing.canvasX,
      }),
    }));
    const committed = onCommand.mock.calls.at(-1)?.[0] as {
      drawing?: { canvasY?: number; textWidth?: number; text?: string; fontSize?: 12 | 14 | 16 | 18 | 24 | 32 };
    };
    const committedWidth = committed.drawing?.textWidth ?? 0;
    expect(committedWidth).toBeGreaterThan(180);
    expect(committedWidth).toBeLessThanOrEqual(300);
    expect(committed.drawing?.canvasY).not.toBe(originalCanvasY);
    expect(committed.drawing?.canvasY).toBeCloseTo(originalTop / 600, 5);
    expect(originalLeft).toBe(Number.parseFloat(before.style.left));

    rerender(
      <div className="chart-stage" data-testid="chart-stage">
        <DrawingCanvas
          {...(drawing && {
            episodeId: "episode-1",
            candles,
            cursor: candles[1].time,
            drawings: [committed.drawing as NormalizedDrawing],
            selectedDrawingId: drawing.id,
            activeTool: "cursor" as const,
            plannedRiskAmount: undefined,
            currency: "HKD",
            onSelectDrawing: vi.fn(),
            onCommand,
            coordinateAdapter: adapter,
            multilineText: false,
          })}
        />
      </div>,
    );
    const after = screen.getByLabelText(`文字内容 ${drawing.id}`);
    expect(Number.parseFloat(after.style.left)).toBe(originalLeft);
    expect(Number.parseFloat(after.style.top)).toBe(originalTop);
    expect(Number.parseFloat(after.style.width)).toBe(committedWidth);
    const fullLayout = textCardLayout(
      drawing.text ?? "",
      committedWidth,
      committed.drawing?.fontSize ?? 14,
      800,
      true,
      Number.POSITIVE_INFINITY,
      textCardLayoutOptions.controlWidth,
      textCardLayoutOptions.controlHeight,
    );
    expect(after.textContent?.replace(/\n/g, "")).toBe(drawing.text);
    expect(Number.parseFloat(after.style.height)).toBeGreaterThanOrEqual(fullLayout.fullHeight);
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
    fireEvent.click(screen.getByRole("button", { name: "样式" }));

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
    fireEvent.click(screen.getByRole("button", { name: "样式" }));

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
    fireEvent.click(screen.getByRole("button", { name: "样式" }));

    const shell = document.querySelector<HTMLElement>(".drawing-text-editor-shell");
    expect(shell).not.toBeNull();
    const height = Number.parseFloat(shell?.style.height ?? "0");
    const maxHeight = Number.parseFloat(shell?.style.maxHeight ?? "0");
    expect(height).toBeGreaterThanOrEqual(200);
    expect(height).toBeLessThanOrEqual(maxHeight);
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
    fireEvent.click(screen.getByRole("button", { name: "样式" }));

    const shell = document.querySelector<HTMLElement>(".drawing-text-editor-shell");
    expect(shell).not.toBeNull();
    expect(Number.parseFloat(shell?.style.width ?? "0")).toBeGreaterThanOrEqual(340);
    const shellHeight = Number.parseFloat(shell?.style.height ?? "0");
    const shellMaxHeight = Number.parseFloat(shell?.style.maxHeight ?? "0");
    const textarea = screen.getByRole("textbox", { name: "文字标注" });
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
    expect(styleBar.style.minHeight).toBe("36px");
    expect(styleBar.style.maxHeight).toBe("36px");
    expect(styleBar.style.height).toBe("36px");
    expect(styleBar.style.whiteSpace).toBe("nowrap");
    expect(styleBar.style.overflow).toBe("hidden");
    expect(styleButton).toHaveStyle({
      minHeight: "36px",
      flexShrink: "0",
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
    expect(Number.parseFloat((styleBar as HTMLElement).style.minHeight)).toBeGreaterThanOrEqual(44);
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
    fireEvent.click(screen.getByRole("button", { name: "样式" }));

    const shell = document.querySelector<HTMLElement>(".drawing-text-editor-shell");
    const styleBar = screen.getByLabelText("文字样式");
    expect(Number.parseFloat(shell?.style.width ?? "0")).toBe(316);
    expect(styleBar.style.overflow).toBe("hidden");
    expect(styleBar.style.minHeight).toBe("36px");
    expect(styleBar.style.maxHeight).toBe("36px");
    expect(styleBar.style.height).toBe("36px");
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
    fireEvent.click(screen.getByRole("button", { name: "样式" }));

    const shell = document.querySelector<HTMLElement>(".drawing-text-editor-shell");
    const controls = document.querySelector<HTMLElement>(".drawing-text-editor-controls");
    const styleBar = screen.getByLabelText("文字样式");
    const colorInput = screen.getByLabelText("文字颜色");
    expect(Number.parseFloat(shell?.style.width ?? "0")).toBe(240);
    expect(controls?.style.minHeight).toBe("44px");
    expect(controls?.style.height).toBe("44px");
    expect(controls?.style.overflow).toBe("hidden");
    expect(styleBar.style.minHeight).toBe("44px");
    expect(styleBar.style.maxHeight).toBe("44px");
    expect(styleBar.style.height).toBe("44px");
    expect(styleBar.style.overflow).toBe("hidden");
    expect(styleBar.style.boxSizing).toBe("border-box");
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
    expect(Number.parseFloat((screen.getByLabelText("文字样式") as HTMLElement).style.minHeight)).toBeGreaterThanOrEqual(44);
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
    expect(screen.getByRole("textbox", { name: "文字标注" })).toHaveValue("草稿");
    expect(screen.getByRole("dialog", { name: "文字草稿待决议" })).toBeInTheDocument();
  });

  it("cancels from a style control without committing a draft", () => {
    const onCommand = vi.fn();
    const { canvas } = renderCanvas({ onCommand });
    fireEvent.pointerDown(canvas, { pointerId: 21, clientX: 10, clientY: 40 });
    const editor = screen.getByRole("textbox", { name: "文字标注" });
    fireEvent.change(editor, { target: { value: "不要保存" } });
    fireEvent.keyDown(screen.getByRole("combobox", { name: "文字字号" }), { key: "Escape" });
    expect(onCommand).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox", { name: "文字标注" })).toHaveValue("不要保存");
    expect(screen.getByRole("dialog", { name: "文字草稿待决议" })).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole("button", { name: "样式" }));
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
    fireEvent.click(screen.getByRole("button", { name: "样式" }));
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
    fireEvent.click(screen.getByRole("button", { name: "样式" }));
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
    fireEvent.click(screen.getByRole("button", { name: "样式" }));
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
    fireEvent.click(screen.getByRole("button", { name: "样式" }));
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
    fireEvent.click(screen.getByRole("button", { name: "样式" }));
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
