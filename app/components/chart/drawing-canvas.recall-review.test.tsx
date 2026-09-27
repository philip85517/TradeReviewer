import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
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
    multilineText: true,
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
    const { stage } = renderCanvas({ activeTool: "cursor", drawings: [drawing] });

    const toggle = screen.getByRole("button", { name: /展开文字/ });
    expect(toggle).toBeInTheDocument();
    expect(toggle).toHaveStyle({ minWidth: "44px", minHeight: "44px", fontSize: "12px" });
    fireEvent.click(toggle);
    fireEvent.pointerDown(stage, { pointerId: 16, clientX: 20, clientY: 20 });

    expect(screen.getByRole("textbox", { name: "文字标注" })).toHaveValue(
      "第一行\n第二行\n第三行\n第四行",
    );
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
      onCommand,
    });

    fireEvent.pointerDown(stage, { pointerId: 17, clientX: 20, clientY: 20 });
    fireEvent.pointerMove(stage, { pointerId: 17, clientX: 40, clientY: 30 });
    fireEvent.pointerUp(stage, { pointerId: 17, clientX: 40, clientY: 30 });

    expect(onCommand).toHaveBeenCalledWith(expect.objectContaining({
      type: "replace",
      drawing: expect.objectContaining({
        id: drawing.id,
        anchors: drawing.anchors,
        canvasX: expect.closeTo(0.36, 5),
        canvasY: expect.closeTo(0.3, 5),
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
    expect(styleBar.style.flexWrap).toBe("nowrap");
    expect(styleBar.style.overflowX).toBe("auto");
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
      onSelectDrawing,
    });

    fireEvent.pointerDown(stage, { pointerId: 6, clientX: 10, clientY: 100 });
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
      onSelectDrawing,
    });

    // With a 36px box, the renderer wraps this into multiple lines. The
    // second line is still part of the visible/editor hit target.
    fireEvent.pointerDown(stage, { pointerId: 3, clientX: 12, clientY: 45 });

    expect(onSelectDrawing).toHaveBeenCalledWith("wrapped-text");
    expect(screen.getByRole("textbox", { name: "文字标注" })).toBeInTheDocument();
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
      onCommand,
    });

    fireEvent.pointerDown(stage, { pointerId: 5, clientX: 10, clientY: 100 });
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
      onCommand,
    });

    fireEvent.pointerDown(stage, { pointerId: 6, clientX: 10, clientY: 100 });
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
    });

    fireEvent.pointerDown(stage, { pointerId: 7, clientX: 96, clientY: 96 });

    const shell = document.querySelector<HTMLElement>(".drawing-text-editor-shell");
    expect(shell).not.toBeNull();
    const left = Number.parseFloat(shell?.style.left ?? "0");
    const width = Number.parseFloat(shell?.style.width ?? "0");
    expect(left + width).toBeLessThanOrEqual(100);
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
      plotBounds: { width: 78, height: 70 },
    });

    fireEvent.pointerDown(stage, { pointerId: 8, clientX: 40, clientY: 30 });

    const shell = document.querySelector<HTMLElement>(".drawing-text-editor-shell");
    expect(shell).not.toBeNull();
    const left = Number.parseFloat(shell?.style.left ?? "0");
    const width = Number.parseFloat(shell?.style.width ?? "0");
    const top = Number.parseFloat(shell?.style.top ?? "0");
    const maxHeight = Number.parseFloat(shell?.style.maxHeight ?? "0");
    expect(left + width).toBeLessThanOrEqual(76);
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
      { activeTool: "cursor", drawings: [drawing], plotBounds: { width: 560, height: 360 } },
      undefined,
      { width: 640, height: 400 },
    );

    fireEvent.pointerDown(stage, { pointerId: 9, clientX: 200, clientY: 80 });

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
        onCommand,
        plotBounds: { width: 1200, height: 626 },
      },
      undefined,
      { width: 1440, height: 900 },
    );

    fireEvent.pointerDown(stage, { pointerId: 18, clientX: 1170, clientY: 610 });

    const shell = document.querySelector<HTMLElement>(".drawing-text-editor-shell");
    expect(shell).not.toBeNull();
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
      minHeight: "36px",
      whiteSpace: "nowrap",
      overflowX: "auto",
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
    expect(styleBar).toHaveStyle({ minHeight: "44px" });
    for (const control of Array.from(styleBar.children)) {
      expect(control).toHaveStyle({ flexShrink: "0", minHeight: "44px" });
    }
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
    expect(left + 44).toBeLessThanOrEqual(78);
  });
});
