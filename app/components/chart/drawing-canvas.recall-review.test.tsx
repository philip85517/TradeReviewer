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

function renderCanvas(overrides: Record<string, unknown> = {}, ref?: Ref<DrawingCanvasHandle>) {
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
              contentRect: { width: 100, height: 100 },
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
    width: 100,
    height: 100,
    top: 0,
    left: 0,
    right: 100,
    bottom: 100,
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

    expect(editor.style.position).toBe("static");
    expect(styleBar.style.position).toBe("relative");
    expect(styleBar.style.zIndex).toBe("7");
    expect(styleBar.style.flexWrap).toBe("wrap");
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
      drawing: expect.objectContaining({ text: "第一行\n第二行", placement: "anchor" }),
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
});
