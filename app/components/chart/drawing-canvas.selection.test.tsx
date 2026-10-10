import { createRef, useState } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NormalizedDrawing } from "../../lib/chart/drawings";
import { DrawingCanvas, paintDrawingScene, type DrawingCanvasHandle } from "./drawing-canvas";

type PaintCall = { op: string; args: unknown[]; fill: string; stroke: string; width: number; alpha: number };
let calls: PaintCall[];
let rafs: Map<number, FrameRequestCallback>;
let reduced: MediaQueryList & { change: () => void };
function recordingContext() {
  const context: Record<string, unknown> = { globalAlpha: 1, strokeStyle: "", fillStyle: "", lineWidth: 1, font: "" };
  for (const op of ["setTransform", "clearRect", "setLineDash", "beginPath", "moveTo", "lineTo", "stroke", "fill", "fillRect", "strokeRect", "fillText", "save", "restore", "arc"]) {
    context[op] = (...args: unknown[]) => calls.push({ op, args, fill: String(context.fillStyle), stroke: String(context.strokeStyle), width: Number(context.lineWidth), alpha: Number(context.globalAlpha) });
  }
  context.measureText = (value: string) => ({ width: value.length * 7 });
  return context as unknown as CanvasRenderingContext2D;
}
beforeEach(() => {
  calls = []; rafs = new Map();
  let rafId = 0;
  vi.stubGlobal("requestAnimationFrame", (frame: FrameRequestCallback) => { rafs.set(++rafId, frame); return rafId; });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => rafs.delete(id));
  const listeners = new Set<() => void>();
  reduced = { matches: false, media: "(prefers-reduced-motion: reduce)", onchange: null, addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
    addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener), change: () => listeners.forEach((listener) => listener()),
  } as unknown as typeof reduced;
  vi.stubGlobal("matchMedia", (query: string) => query.includes("reduced-motion") ? reduced : { ...reduced, matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  vi.stubGlobal("ResizeObserver", class {
    constructor(private callback: ResizeObserverCallback) {}
    observe(target: Element) { this.callback([{ contentRect: { width: 300, height: 200 }, target } as ResizeObserverEntry], this as unknown as ResizeObserver); }
    disconnect() {} unobserve() {}
  });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => recordingContext() as never);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function pointer(target: Element, type: string, values: { pointerId: number; clientX?: number; clientY?: number }) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, { clientX: 0, clientY: 0, ...values });
  act(() => { target.dispatchEvent(event); });
  return event;
}


const candles = [
  { time: "2026-01-01T00:00:00.000Z", open: 100, high: 105, low: 95, close: 102, volume: 1 },
  { time: "2026-01-02T00:00:00.000Z", open: 102, high: 105, low: 95, close: 103, volume: 1 },
  { time: "2026-01-03T00:00:00.000Z", open: 103, high: 106, low: 96, close: 104, volume: 1 },
];
const adapter = {
  timeToX: (time: string) => candles.findIndex((candle) => candle.time === time) * 40 + 10,
  priceToY: (price: number) => 200 - price,
  xToTime: (x: number) => candles[Math.max(0, Math.min(candles.length - 1, Math.round((x - 10) / 40)))]?.time ?? candles[0].time,
  yToPrice: (y: number) => 200 - y,
};
function drawing(): NormalizedDrawing {
  return {
    version: 2, episodeId: "e", id: "risk", name: "risk", tool: "long-risk-reward",
    anchors: [
      { time: candles[0].time, price: 100 },
      { time: candles[1].time, price: 90 },
      { time: candles[1].time, price: 120 },
    ], style: { color: "#2f80ed", lineWidth: 1.5, opacity: 1 }, hidden: false, locked: false,
    visibleOn: "all", stage: "during-replay", zIndex: 0, createdAtCursor: candles[2].time,
  };
}
function renderRisk(overrides: Record<string, unknown> = {}) {
  const props = {
    episodeId: "e", candles, cursor: candles[2].time, drawings: [drawing()], selectedDrawingId: "risk",
    activeTool: "cursor" as const, plannedRiskAmount: undefined, currency: "HKD",
    onSelectDrawing: vi.fn(), onCommand: vi.fn(), coordinateAdapter: adapter, ...overrides,
  };
  function Harness() {
    const [selected, setSelected] = useState(props.selectedDrawingId as string | null);
    return <div className="chart-stage"><output data-testid="selected">{selected ?? "none"}</output><DrawingCanvas {...props} selectedDrawingId={selected} onSelectDrawing={(id) => { props.onSelectDrawing(id); setSelected(id); }} /></div>;
  }
  const view = render(<Harness />);
  const stage = document.querySelector(".chart-stage") as HTMLElement;
  const canvas = screen.getByRole("img", { name: "绘图画布" });
  vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({ x: 0, y: 0, width: 180, height: 150, top: 0, left: 0, right: 180, bottom: 150, toJSON: () => ({}) });
  return { stage, props, view };
}

describe("risk selection slice", () => {
  it("uses the pointerup coordinate for one replacement and pauses only on actual movement", () => {
    const onCommand = vi.fn();
    const onStart = vi.fn();
    const { stage } = renderRisk({ onCommand, onDrawingInteractionStart: onStart });
    pointer(stage, "pointerdown", { pointerId: 1, clientX: 50, clientY: 110 });
    pointer(stage, "pointerup", { pointerId: 1, clientX: 50, clientY: 110 });
    expect(onStart).not.toHaveBeenCalled();
    expect(onCommand).not.toHaveBeenCalled();

    pointer(stage, "pointerdown", { pointerId: 2, clientX: 50, clientY: 110 });
    pointer(stage, "pointermove", { pointerId: 2, clientX: 50, clientY: 100 });
    pointer(stage, "pointerup", { pointerId: 2, clientX: 50, clientY: 115 });
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onCommand).toHaveBeenCalledTimes(1);
    expect(onCommand.mock.calls[0][0].drawing.anchors[1].price).toBe(85);
  });

  it("moves only the original rightmost time group with the width handle", () => {
    const onCommand = vi.fn();
    const { stage } = renderRisk({ onCommand });
    // virtual right edge is left + 110 = 120; price handles are x 10/50.
    pointer(stage, "pointerdown", { pointerId: 3, clientX: 120, clientY: 95 });
    pointer(stage, "pointermove", { pointerId: 3, clientX: 90, clientY: 95 });
    pointer(stage, "pointerup", { pointerId: 3, clientX: 90, clientY: 95 });
    expect(onCommand).toHaveBeenCalledTimes(1);
    const anchors = onCommand.mock.calls[0][0].drawing.anchors;
    expect(anchors[0].price).toBe(100);
    expect(anchors[1].price).toBe(90);
    expect(anchors[2].price).toBe(120);
    expect(anchors[1].time).toBe(candles[2].time);
    expect(anchors[2].time).toBe(candles[2].time);
  });

  it("keeps entry time fixed when all three handles share one x pixel", () => {
    const onCommand = vi.fn();
    const sameX = { ...drawing(), anchors: [
      { time: candles[0].time, price: 100 },
      { time: candles[0].time, price: 90 },
      { time: candles[0].time, price: 120 },
    ] };
    const { stage } = renderRisk({ drawings: [sameX], onCommand });
    pointer(stage, "pointerdown", { pointerId: 4, clientX: 120, clientY: 95 });
    pointer(stage, "pointerup", { pointerId: 4, clientX: 160, clientY: 95 });
    expect(onCommand).toHaveBeenCalledTimes(1);
    const anchors = onCommand.mock.calls[0][0].drawing.anchors;
    expect(anchors[0].time).toBe(candles[0].time);
    expect(anchors[1].time).toBe(candles[2].time);
    expect(anchors[2].time).toBe(candles[2].time);
  });

  it("does not write for axis-only handle movement or a width-only vertical move", () => {
    const onCommand = vi.fn();
    const onStart = vi.fn();
    const precise = { ...drawing(), anchors: drawing().anchors.map((anchor, index) => index === 1 ? { ...anchor, price: 90.1234 } : anchor) };
    const { stage } = renderRisk({ drawings: [precise], onCommand, onDrawingInteractionStart: onStart });

    // The original stop has sub-tick precision; moving only horizontally must
    // preserve its price and time instead of rounding it through the adapter.
    pointer(stage, "pointerdown", { pointerId: 41, clientX: 50, clientY: 110 });
    pointer(stage, "pointermove", { pointerId: 41, clientX: 80, clientY: 110 });
    pointer(stage, "pointerup", { pointerId: 41, clientX: 80, clientY: 110 });
    expect(onCommand).not.toHaveBeenCalled();
    expect(onStart).not.toHaveBeenCalled();

    // Width is horizontal-only: changing y while keeping x fixed cannot move
    // the right time group, including at the virtual min-width edge.
    pointer(stage, "pointerdown", { pointerId: 42, clientX: 120, clientY: 95 });
    pointer(stage, "pointermove", { pointerId: 42, clientX: 120, clientY: 135 });
    pointer(stage, "pointerup", { pointerId: 42, clientX: 120, clientY: 135 });
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("caps width edits at the replay cursor when future anchors are hidden", () => {
    const onCommand = vi.fn();
    const oldRight = { ...drawing(), anchors: [
      { time: candles[0].time, price: 100 },
      { time: candles[0].time, price: 90 },
      { time: candles[0].time, price: 120 },
    ] };
    const { stage } = renderRisk({ drawings: [oldRight], cursor: candles[1].time, onCommand, allowFutureAnchors: false });
    pointer(stage, "pointerdown", { pointerId: 43, clientX: 120, clientY: 95 });
    pointer(stage, "pointermove", { pointerId: 43, clientX: 220, clientY: 95 });
    pointer(stage, "pointerup", { pointerId: 43, clientX: 220, clientY: 95 });
    expect(onCommand).toHaveBeenCalledTimes(1);
    const anchors = onCommand.mock.calls[0][0].drawing.anchors;
    expect(anchors[1].time).toBe(candles[1].time);
    expect(anchors[2].time).toBe(candles[1].time);
  });

  it("restores the prior selection on cancel without replacing or replaying it", () => {
    const onCommand = vi.fn();
    const onSelectDrawing = vi.fn();
    const second = { ...drawing(), id: "risk-b", name: "risk-b", zIndex: 1 };
    const { stage } = renderRisk({
      drawings: [drawing(), second], selectedDrawingId: "risk-a", onCommand, onSelectDrawing,
    });
    pointer(stage, "pointerdown", { pointerId: 5, clientX: 50, clientY: 110 });
    pointer(stage, "pointermove", { pointerId: 5, clientX: 50, clientY: 100 });
    pointer(stage, "pointercancel", { pointerId: 5 });
    expect(onCommand).not.toHaveBeenCalled();
    expect(onSelectDrawing).toHaveBeenLastCalledWith("risk-a");
    expect(screen.getByTestId("selected")).toHaveTextContent("risk-a");
  });


  it("exposes independent keyboard price candidates without starting a drag", () => {
    const onCommand = vi.fn();
    const onSelectDrawing = vi.fn();
    renderRisk({ onCommand, onSelectDrawing });
    const hotspot = screen.getByRole("button", { name: /入场价柄/ });
    fireEvent.keyDown(hotspot, { key: "Enter" });
    fireEvent.keyDown(hotspot, { key: " " });
    expect(onSelectDrawing).toHaveBeenCalledWith("risk");
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("has no draggable hotspots before selection or while locked", () => {
    renderRisk({ selectedDrawingId: null, drawings: [drawing(), { ...drawing(), id: "locked", locked: true }] });
    expect(screen.queryAllByRole("button", { name: /价柄|时间柄/ })).toHaveLength(0);
    const object = screen.getByRole("button", { name: "选择绘图 risk" });
    fireEvent.focus(object);
    expect(object.style.outline).toContain("2px");
    expect(screen.getByTestId("selected")).toHaveTextContent("none");
    fireEvent.keyDown(object, { key: " " });
    expect(screen.getByTestId("selected")).toHaveTextContent("risk");
    expect(screen.getAllByRole("button", { name: /risk .*价柄/ })).toHaveLength(3);
    const locked = screen.getByRole("button", { name: /选择绘图 risk.*只读/ });
    fireEvent.keyDown(locked, { key: "Enter" });
    expect(screen.queryAllByRole("button", { name: /价柄|时间柄/ })).toHaveLength(0);
  });

  it.each([0, 1, 2])("gives same-pixel price candidate %i its own intent and delta origin", (index) => {
    const compact = { ...drawing(), anchors: [100, 99.97, 100.03].map((price) => ({ time: candles[0].time, price })) };
    const rounded = { ...adapter, priceToY: () => 100, yToPrice: (y: number) => 100 - (y - 100) * 0.001 };
    const { stage, props } = renderRisk({ drawings: [compact], coordinateAdapter: rounded });
    const names = ["入场", "止损", "目标"];
    const button = screen.getByRole("button", { name: new RegExp(names[index] + "价柄") });
    // Candidate controls can be offset from the real anchor: only pointer delta changes the price.
    pointer(button, "pointerdown", { pointerId: 61, clientX: 85, clientY: 130 });
    pointer(stage, "pointerup", { pointerId: 61, clientX: 85, clientY: index === 1 ? 140 : 120 });
    expect(props.onCommand).toHaveBeenCalledTimes(1);
    const anchors = props.onCommand.mock.calls[0][0].drawing.anchors;
    expect(anchors[index].price).toBe(index === 1 ? 99.96 : index === 0 ? 100.01 : 100.04);
    for (let other = 0; other < 3; other++) if (other !== index) expect(anchors[other]).toEqual(compact.anchors[other]);
    const tops = screen.getAllByRole("button", { name: /价柄/ }).map((item) => item.style.top);
    expect(new Set(tops).size).toBe(3);
  });

  it.each([false, true])("restores selection after DOM candidate cancel (moved=%s)", (moved) => {
    const { stage, props } = renderRisk();
    const button = screen.getByRole("button", { name: /止损价柄/ });
    pointer(button, "pointerdown", { pointerId: 71, clientX: 50, clientY: 114 });
    if (moved) pointer(stage, "pointermove", { pointerId: 71, clientX: 50, clientY: 119 });
    pointer(stage, "pointercancel", { pointerId: 71 });
    expect(screen.getByTestId("selected")).toHaveTextContent("risk");
    expect(props.onCommand).not.toHaveBeenCalled();
  });

  it("uses current stage hover after drawings are rerendered without blocking the event", () => {
    const props = { episodeId: "e", candles, cursor: candles[2].time, drawings: [] as NormalizedDrawing[], selectedDrawingId: null, activeTool: "cursor" as const, plannedRiskAmount: undefined, currency: "HKD", onSelectDrawing: vi.fn(), onCommand: vi.fn(), coordinateAdapter: adapter };
    const view = render(<div className="chart-stage"><DrawingCanvas {...props} /></div>);
    const stage = document.querySelector(".chart-stage")!;
    vi.spyOn(screen.getByRole("img"), "getBoundingClientRect").mockReturnValue({ x: 0, y: 0, width: 300, height: 200, top: 0, left: 0, right: 300, bottom: 200, toJSON: () => ({}) });
    view.rerender(<div className="chart-stage"><DrawingCanvas {...props} drawings={[drawing()]} /></div>);
    calls.length = 0;
    expect(pointer(stage, "pointermove", { pointerId: 81, clientX: 75, clientY: 100 }).defaultPrevented).toBe(false);
    expect(calls.some((call) => call.op === "strokeRect" && call.width === 1 && call.alpha === 0.55)).toBe(true);
    calls.length = 0;
    pointer(stage, "pointerleave", { pointerId: 81 });
    expect(calls.some((call) => call.op === "strokeRect" && call.alpha === 0.55)).toBe(false);
  });

  it("paints dark 8px price handles with 2px edges, distinct width hints, and a read-only identity", () => {
    const item = drawing();
    const paint = (locked: boolean) => paintDrawingScene(recordingContext(), { width: 300, height: 200, drawings: [{ ...item, locked }], pointFor: (anchor) => ({ x: adapter.timeToX(anchor.time), y: adapter.priceToY(anchor.price) }), pointForDrawing: () => ({ x: 10, y: 100 }), currency: "HKD", selectedDrawingId: "risk" }, true);
    paint(false);
    const fills = calls.filter((call) => call.op === "fill");
    expect(fills).toHaveLength(3);
    expect(fills.every((call) => call.fill === "#17202b")).toBe(true);
    expect(calls.filter((call) => call.op === "stroke" && call.width === 2).length).toBeGreaterThanOrEqual(4);
    calls.length = 0; paint(true);
    expect(calls.some((call) => call.op === "arc")).toBe(false);
    expect(calls.some((call) => call.op === "fillText" && call.args[0] === "只读")).toBe(true);
  });

  it("paints non-risk endpoints as durable dark handles and excludes selection from capture painting", () => {
    const item = { ...drawing(), tool: "trend-line" as const, anchors: drawing().anchors.slice(0, 2) };
    const options = { width: 300, height: 200, drawings: [item], pointFor: (anchor: NormalizedDrawing["anchors"][number]) => ({ x: adapter.timeToX(anchor.time), y: adapter.priceToY(anchor.price) }), pointForDrawing: () => ({ x: 10, y: 100 }), currency: "HKD", selectedDrawingId: "risk" };
    paintDrawingScene(recordingContext(), options, true);
    expect(calls.filter((call) => call.op === "fill" && call.fill === "#17202b")).toHaveLength(2);
    expect(calls.filter((call) => call.op === "stroke" && call.width === 2)).toHaveLength(2);
    calls.length = 0;
    paintDrawingScene(recordingContext(), options, false);
    expect(calls.some((call) => call.fill === "#ffffff")).toBe(false);
  });

  it.each([false, true])("restores A after an object DOM gesture selects B and is cancelled (moved=%s)", (moved) => {
    const second = { ...drawing(), id: "b", name: "B", anchors: drawing().anchors.map((anchor) => ({ ...anchor, price: anchor.price + 30 })) };
    const { stage, props } = renderRisk({ drawings: [drawing(), second] });
    const button = screen.getByRole("button", { name: "选择绘图 B" });
    pointer(button, "pointerdown", { pointerId: 91, clientX: 80, clientY: 70 });
    expect(screen.getByTestId("selected")).toHaveTextContent("b");
    if (moved) pointer(stage, "pointermove", { pointerId: 91, clientX: 80, clientY: 65 });
    const scheduledBefore = rafs.size;
    pointer(stage, "pointercancel", { pointerId: 91 });
    expect(props.onSelectDrawing).toHaveBeenLastCalledWith("risk");
    expect(screen.getByTestId("selected")).toHaveTextContent("risk");
    expect(props.onCommand).not.toHaveBeenCalled();
    expect(rafs.size).toBeLessThanOrEqual(scheduledBefore);
    expect(rafs.size).toBe(0);
  });

  it("paints only the active price handle solid and resets it after Escape without committing", () => {
    const { stage, props } = renderRisk();
    pointer(screen.getByRole("button", { name: /止损价柄/ }), "pointerdown", { pointerId: 92, clientX: 50, clientY: 110 });
    pointer(stage, "pointermove", { pointerId: 92, clientX: 50, clientY: 115 });
    const lastClear = calls.map((call) => call.op).lastIndexOf("clearRect");
    const fills = calls.slice(lastClear).filter((call) => call.op === "fill");
    expect(fills.map((call) => call.fill)).toEqual(["#17202b", "#8cbdff", "#17202b"]);
    const esc = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
    act(() => stage.dispatchEvent(esc));
    expect(esc.defaultPrevented).toBe(true);
    expect(props.onCommand).not.toHaveBeenCalled();
    pointer(stage, "pointerup", { pointerId: 92, clientX: 50, clientY: 115 });
    expect(props.onCommand).not.toHaveBeenCalled();
    const resetClear = calls.map((call) => call.op).lastIndexOf("clearRect");
    expect(calls.slice(resetClear).filter((call) => call.op === "fill").every((call) => call.fill === "#17202b")).toBe(true);
  });

  it("prefers a legal low-z handle over a high-z body or locked handle and locks identity through release", () => {
    const top = { ...drawing(), id: "top", zIndex: 20, anchors: drawing().anchors.map((anchor) => ({ ...anchor, price: anchor.price - 5 })) };
    const locked = { ...drawing(), id: "locked", locked: true, zIndex: 30 };
    const { stage, props } = renderRisk({ drawings: [drawing(), top, locked] });
    pointer(stage, "pointerdown", { pointerId: 93, clientX: 50, clientY: 110 });
    expect(screen.getByTestId("selected")).toHaveTextContent("risk");
    pointer(stage, "pointermove", { pointerId: 93, clientX: 50, clientY: 115 });
    pointer(stage, "pointerup", { pointerId: 93, clientX: 50, clientY: 116 });
    expect(props.onCommand).toHaveBeenCalledTimes(1);
    expect(props.onCommand.mock.calls[0][0].drawing.id).toBe("risk");
    expect(props.onCommand.mock.calls[0][0].drawing.anchors[1].price).toBe(84);
  });

  it("chooses a closer price handle over another object's vertically farther width handle", () => {
    const far = { ...drawing(), id: "far-width", zIndex: 20 };
    const near = { ...drawing(), id: "near-price", anchors: [
      { time: candles[0].time, price: 100 },
      { time: candles[2].time, price: 80 },
      { time: candles[2].time, price: 111 },
    ] };
    const { stage, props } = renderRisk({ drawings: [far, near], selectedDrawingId: null, coordinateAdapter: { ...adapter, timeToX: (time: string) => time === candles[0].time ? 10 : time === candles[1].time ? 50 : 120 } });
    // Pointer is 1px from near's target (120,89), 7px from far's width (120,95).
    pointer(stage, "pointerdown", { pointerId: 109, clientX: 120, clientY: 88 });
    expect(screen.getByTestId("selected")).toHaveTextContent("near-price");
    pointer(stage, "pointerup", { pointerId: 109, clientX: 120, clientY: 87 });
    expect(props.onCommand).toHaveBeenCalledTimes(1);
    expect(props.onCommand.mock.calls[0][0].drawing.id).toBe("near-price");
    expect(props.onCommand.mock.calls[0][0].drawing.anchors).toEqual([
      near.anchors[0], near.anchors[1], { ...near.anchors[2], price: 112 },
    ]);
  });

  it("chooses the vertically closer width handle before z order across objects", () => {
    const far = { ...drawing(), id: "far-width", zIndex: 20 };
    const near = { ...drawing(), id: "near-width", anchors: drawing().anchors.map((anchor) => ({ ...anchor, price: anchor.price + 6 })) };
    const { stage, props } = renderRisk({ drawings: [far, near], selectedDrawingId: null });
    // Both width centers are x120; y89 is 1px away, y95 is 7px away.
    pointer(stage, "pointerdown", { pointerId: 110, clientX: 120, clientY: 88 });
    expect(screen.getByTestId("selected")).toHaveTextContent("near-width");
    pointer(stage, "pointerup", { pointerId: 110, clientX: 160, clientY: 88 });
    expect(props.onCommand).toHaveBeenCalledTimes(1);
    expect(props.onCommand.mock.calls[0][0].drawing.id).toBe("near-width");
    expect(props.onCommand.mock.calls[0][0].drawing.anchors).toEqual([
      near.anchors[0], ...near.anchors.slice(1).map((anchor) => ({ ...anchor, time: candles[2].time })),
    ]);
  });

  it("clears mismatched restoration suppression before a later genuine identity switch", () => {
    const second = { ...drawing(), id: "b", zIndex: 1 };
    const props = { episodeId: "e", candles, cursor: candles[2].time, drawings: [drawing(), second], selectedDrawingId: "risk", activeTool: "cursor" as const, currency: "HKD", plannedRiskAmount: undefined, onSelectDrawing: vi.fn(), onCommand: vi.fn(), coordinateAdapter: adapter };
    const view = render(<div className="chart-stage"><DrawingCanvas {...props} /></div>);
    const stage = document.querySelector(".chart-stage")!;
    vi.spyOn(screen.getByRole("img"), "getBoundingClientRect").mockReturnValue({ x: 0, y: 0, width: 300, height: 200, top: 0, left: 0, right: 300, bottom: 200, toJSON: () => ({}) });
    pointer(stage, "pointerdown", { pointerId: 94, clientX: 50, clientY: 110 });
    view.rerender(<div className="chart-stage"><DrawingCanvas {...props} selectedDrawingId="b" /></div>);
    pointer(stage, "pointercancel", { pointerId: 94 });
    // Parent chooses another identity while processing cancel: the old suppression must expire.
    view.rerender(<div className="chart-stage"><DrawingCanvas {...props} selectedDrawingId="other" /></div>);
    view.rerender(<div className="chart-stage"><DrawingCanvas {...props} /></div>);
    expect(rafs.size).toBe(1);
  });

  it("clears the pulse immediately when reduced motion changes during confirmation", () => {
    renderRisk();
    const frame = [...rafs.values()][0];
    act(() => { rafs.clear(); frame(performance.now() + 80); });
    expect(calls.some((call) => call.op === "arc" && Number(call.args[2]) > 6)).toBe(true);
    calls.length = 0;
    act(() => { Object.defineProperty(reduced, "matches", { value: true, configurable: true }); reduced.change(); });
    expect(rafs.size).toBe(0);
    expect(calls.some((call) => call.op === "arc" && Number(call.args[2]) > 3)).toBe(false);
  });

  it("keeps DOM price hit geometry on the preview and handles captured button moves and release", () => {
    const { props } = renderRisk();
    const button = screen.getByRole("button", { name: /止损价柄/ });
    pointer(button, "pointerdown", { pointerId: 101, clientX: 50, clientY: 110 });
    pointer(button, "pointermove", { pointerId: 101, clientX: 50, clientY: 115 });
    expect(button.style.top).toBe("107px");
    pointer(button, "pointerup", { pointerId: 101, clientX: 50, clientY: 116 });
    expect(props.onCommand).toHaveBeenCalledTimes(1);
    expect(props.onCommand.mock.calls[0][0].drawing.anchors[1].price).toBe(84);
  });

  it("keeps explicit width intent when its grip overlaps a price handle", () => {
    const wideAdapter = { ...adapter, timeToX: (time: string) => time === candles[0].time ? 10 : time === candles[1].time ? 120 : 160, xToTime: (x: number) => x < 140 ? candles[1].time : candles[2].time };
    const wide = { ...drawing(), anchors: [{ time: candles[1].time, price: 100 }, { time: candles[0].time, price: 90 }, { time: candles[0].time, price: 120 }] };
    const { props } = renderRisk({ drawings: [wide], coordinateAdapter: wideAdapter });
    const button = screen.getByRole("button", { name: /宽度时间柄/ });
    expect(button.style.width).toBe("16px");
    pointer(button, "pointerdown", { pointerId: 102, clientX: 120, clientY: 100 });
    pointer(button, "pointerup", { pointerId: 102, clientX: 160, clientY: 100 });
    expect(props.onCommand).toHaveBeenCalledTimes(1);
    expect(props.onCommand.mock.calls[0][0].drawing.anchors).toEqual([{ time: candles[2].time, price: 100 }, { time: candles[0].time, price: 90 }, { time: candles[0].time, price: 120 }]);
  });

  it("uses 44px DOM targets on coarse pointers without enlarging 8px visible price handles", () => {
    const previous = window.matchMedia;
    vi.stubGlobal("matchMedia", (query: string) => query === "(pointer: coarse)" ? { ...reduced, matches: true } : previous(query));
    renderRisk();
    for (const button of screen.getAllByRole("button", { name: /价柄|时间柄/ })) {
      expect(button.style.width).toBe("44px"); expect(button.style.height).toBe("44px");
    }
    expect(calls.filter((call) => call.op === "arc").every((call) => call.args[2] === 3)).toBe(true);
  });

  it("draws selected risk feedback last while captureOverlay excludes the live preview and all feedback", async () => {
    const ref = createRef<DrawingCanvasHandle>();
    const top = { ...drawing(), id: "line", tool: "trend-line" as const, zIndex: 10, anchors: drawing().anchors.slice(0, 2) };
    render(<div className="chart-stage"><DrawingCanvas ref={ref} episodeId="e" candles={candles} cursor={candles[2].time} drawings={[drawing(), top]} selectedDrawingId="risk" activeTool="cursor" currency="HKD" plannedRiskAmount={undefined} onSelectDrawing={vi.fn()} onCommand={vi.fn()} coordinateAdapter={adapter} /></div>);
    vi.spyOn(screen.getByRole("img"), "getBoundingClientRect").mockReturnValue({ x: 0, y: 0, width: 300, height: 200, top: 0, left: 0, right: 300, bottom: 200, toJSON: () => ({}) });
    const lastBodyStroke = calls.findLastIndex((call) => call.op === "stroke" && call.stroke === "#2f80ed");
    const firstSelectedStroke = calls.findIndex((call) => call.op === "strokeRect" && call.stroke === "#8cbdff");
    expect(firstSelectedStroke).toBeGreaterThan(lastBodyStroke);
    const button = screen.getByRole("button", { name: /止损价柄/ });
    pointer(button, "pointerdown", { pointerId: 103, clientX: 50, clientY: 110 });
    pointer(button, "pointermove", { pointerId: 103, clientX: 50, clientY: 115 });
    calls.length = 0;
    await ref.current!.captureOverlay();
    expect(calls.some((call) => call.op === "arc" || call.stroke === "#8cbdff")).toBe(false);
    expect(calls.filter((call) => call.op === "fillRect" && call.fill === "#ef5350").map((call) => call.args)).toEqual([[10, 100, 110, 10]]);
  });

  it("gives stage hover the appropriate unlocked cursor and never a movement cursor for locked drawings", () => {
    const { stage } = renderRisk();
    pointer(stage, "pointermove", { pointerId: 104, clientX: 50, clientY: 110 });
    expect(stage.style.cursor).toBe("ns-resize");
    pointer(stage, "pointerleave", { pointerId: 104 });
    expect(stage.style.cursor).toBe("");
  });

  it("keeps the 2px border inside the visible 8px handle diameter", () => {
    renderRisk();
    const priceArcs = calls.filter((call) => call.op === "arc");
    expect(priceArcs).toHaveLength(3);
    expect(priceArcs.every((call) => Number(call.args[2]) * 2 + call.width === 8)).toBe(true);
  });

  it("allows future width edits only with the explicit policy override", () => {
    const { stage, props } = renderRisk({ cursor: candles[1].time, allowFutureAnchors: true });
    pointer(stage, "pointerdown", { pointerId: 105, clientX: 120, clientY: 95 });
    pointer(stage, "pointerup", { pointerId: 105, clientX: 220, clientY: 95 });
    expect(props.onCommand).toHaveBeenCalledTimes(1);
    expect(props.onCommand.mock.calls[0][0].drawing.anchors[1].time).toBe(candles[2].time);
  });

  it("chooses the closer risk body before z order and preserves legacy values on pure selection", () => {
    const wider = { ...drawing(), id: "far", zIndex: 20, anchors: drawing().anchors.map((anchor) => ({ ...anchor, price: anchor.price + 5 })) };
    const { stage, props } = renderRisk({ drawings: [drawing(), wider], selectedDrawingId: null });
    pointer(stage, "pointerdown", { pointerId: 106, clientX: 75, clientY: 98 });
    pointer(stage, "pointerup", { pointerId: 106, clientX: 75, clientY: 98 });
    expect(screen.getByTestId("selected")).toHaveTextContent("risk");
    expect(props.onCommand).not.toHaveBeenCalled();
    expect(props.drawings[0].anchors[2].price).toBe(120);
  });

  it("never gives locked risk hover a movement cursor and cancels native capture loss", () => {
    const { stage, props } = renderRisk();
    pointer(stage, "pointerdown", { pointerId: 107, clientX: 50, clientY: 110 });
    pointer(stage, "lostpointercapture", { pointerId: 107 });
    expect(props.onCommand).not.toHaveBeenCalled();
    expect(screen.getByTestId("selected")).toHaveTextContent("risk");
    cleanup();
    const lockedView = renderRisk({ drawings: [{ ...drawing(), locked: true }] });
    pointer(lockedView.stage, "pointermove", { pointerId: 108, clientX: 50, clientY: 110 });
    expect(lockedView.stage.style.cursor).toBe("default");
  });

  it("renders an invalid risk preview as a safe label instead of throwing", () => {
    const invalid = { ...drawing(), anchors: [
      { time: candles[0].time, price: 100 },
      { time: candles[1].time, price: 110 },
      { time: candles[1].time, price: 90 },
    ] };
    const context = {
      globalAlpha: 1, strokeStyle: "", fillStyle: "", lineWidth: 1, font: "",
      setLineDash: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(),
      fillRect: vi.fn(), strokeRect: vi.fn(), fillText: vi.fn(), measureText: (value: string) => ({ width: value.length * 7 }),
      save: vi.fn(), restore: vi.fn(), arc: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
    expect(() => paintDrawingScene(context, {
      width: 180, height: 150, drawings: [invalid], pointFor: (anchor) => ({ x: anchor.time === candles[0].time ? 10 : 50, y: 200 - anchor.price }),
      pointForDrawing: () => ({ x: 10, y: 100 }), plannedRiskAmount: undefined, currency: "USD", preview: invalid,
    }, true, true)).not.toThrow();
  });
});
