import { describe, expect, it, vi } from "vitest";

import { fibonacciLevels } from "../../lib/chart/drawing-geometry";
import type { CanonicalDrawingTool, DrawingAnchor, NormalizedDrawing } from "../../lib/chart/drawings";
import { paintDrawingScene } from "./drawing-canvas";

type Call = { op: string; args: unknown[] };

function recordingContext() {
  const calls: Call[] = [];
  const context: Record<string, unknown> = {
    globalAlpha: 1,
    strokeStyle: "",
    fillStyle: "",
    lineWidth: 1,
    font: "",
  };
  for (const op of [
    "setLineDash", "fillRect", "strokeRect", "beginPath", "moveTo", "lineTo",
    "stroke", "arc", "fill", "closePath", "save", "restore", "fillText",
  ]) {
    context[op] = vi.fn((...args: unknown[]) => calls.push({ op, args }));
  }
  context.measureText = vi.fn((value: string) => ({ width: value.length * 5 }));
  return { context: context as unknown as CanvasRenderingContext2D, calls };
}

function drawing(tool: CanonicalDrawingTool, id: string, anchors: NormalizedDrawing["anchors"], extra: Partial<NormalizedDrawing> = {}): NormalizedDrawing {
  return {
    version: 2,
    episodeId: "episode-1",
    id,
    name: tool,
    tool,
    anchors,
    style: { color: "#2f80ed", lineWidth: 2, opacity: 1 },
    hidden: false,
    locked: false,
    visibleOn: "all",
    stage: "during-replay",
    zIndex: 0,
    createdAtCursor: "c",
    ...extra,
  };
}

function pointMap(points: Record<string, { x: number; y: number }>) {
  return (anchor: DrawingAnchor) => points[anchor.time] ?? { x: Number.NaN, y: Number.NaN };
}

function paint(
  item: NormalizedDrawing,
  points: Record<string, { x: number; y: number }>,
  includeSelection = false,
  dimensions = { width: 420, height: 280 },
  plannedRiskAmount?: string,
) {
  const recorded = recordingContext();
  const pointFor = pointMap(points);
  paintDrawingScene(recorded.context, {
    width: dimensions.width,
    height: dimensions.height,
    plotWidth: dimensions.width - 44,
    plotHeight: dimensions.height,
    drawings: [item],
    pointFor,
    pointForDrawing: (item) => pointFor(item.anchors[0] ?? { time: "", price: 0 }),
    currency: "HKD",
    plannedRiskAmount,
    selectedDrawingId: includeSelection ? item.id : null,
  }, includeSelection);
  return recorded;
}

function numericArgs(calls: Call[]) {
  return calls.flatMap(({ args }) => args.filter((arg): arg is number => typeof arg === "number"));
}

describe("drawing canvas label integration", () => {
  it("paints a vector arrowhead for forward, reverse, vertical and short arrows without changing anchors", () => {
    const cases = [
      { id: "forward", points: { a: { x: 50, y: 180 }, b: { x: 260, y: 80 } } },
      { id: "reverse", points: { a: { x: 260, y: 80 }, b: { x: 50, y: 180 } } },
      { id: "vertical", points: { a: { x: 160, y: 220 }, b: { x: 160, y: 40 } } },
      { id: "short", points: { a: { x: 160, y: 100 }, b: { x: 164, y: 102 } } },
    ];
    for (const testCase of cases) {
      const anchors = [{ time: "a", price: 100 }, { time: "b", price: 90 }];
      const before = structuredClone(anchors);
      const { calls } = paint(drawing("arrow", testCase.id, anchors), testCase.points);
      expect(calls.filter((call) => call.op === "closePath")).toHaveLength(1);
      expect(calls.filter((call) => call.op === "fill")).toHaveLength(1);
      expect(anchors).toEqual(before);
      expect(numericArgs(calls).every(Number.isFinite)).toBe(true);
    }
  });

  it("renders all six RR rows with readable spacing while keeping selection handles separate", () => {
    const anchors = [
      { time: "entry", price: 100 },
      { time: "stop", price: 95 },
      { time: "target", price: 110 },
    ];
    const { context, calls } = paint(
      drawing("long-risk-reward", "rr", anchors),
      {
        entry: { x: 70, y: 140 },
        stop: { x: 70, y: 190 },
        target: { x: 250, y: 40 },
      },
      true,
    );
    const texts = (context.fillText as unknown as { mock: { calls: unknown[][] } }).mock.calls.map(([text]) => String(text));
    for (const expected of ["入场 100.00", "止损 95.00", "目标 110.00", "风险距离", "收益距离", "2.00R"]) {
      expect(texts.some((text) => text === expected || text.startsWith(expected))).toBe(true);
    }
    const coreBaselines = calls
      .filter((call) => call.op === "fillText" && /^(入场|止损|目标|风险距离|收益距离|2\.00R)/.test(String(call.args[0])))
      .map((call) => Number(call.args[2]));
    expect(coreBaselines).toHaveLength(6);
    expect(coreBaselines.slice(1).every((y, index) => y - coreBaselines[index] >= 18)).toBe(true);
    expect(calls.filter((call) => call.op === "arc").length).toBeGreaterThanOrEqual(3);
  });

  it("measures planned RR rows inside the same readable label surface", () => {
    const anchors = [
      { time: "entry", price: 100 },
      { time: "stop", price: 95 },
      { time: "target", price: 110 },
    ];
    const { context } = paint(
      drawing("long-risk-reward", "rr-planned", anchors),
      {
        entry: { x: 70, y: 140 },
        stop: { x: 70, y: 190 },
        target: { x: 250, y: 40 },
      },
      false,
      { width: 420, height: 280 },
      "1000",
    );
    const texts = (context.fillText as unknown as { mock: { calls: unknown[][] } }).mock.calls.map(([text]) => String(text));
    expect(texts.some((text) => text.startsWith("计划风险"))).toBe(true);
    expect(texts.some((text) => text.startsWith("潜在收益"))).toBe(true);
    expect(texts.some((text) => text.startsWith("建议数量"))).toBe(true);
    const plannedBaselines = (context.fillText as unknown as { mock: { calls: unknown[][] } }).mock.calls
      .filter(([text]) => /^(计划风险|潜在收益|建议数量)/.test(String(text)))
      .map(([, , y]) => Number(y));
    expect(plannedBaselines).toHaveLength(3);
    expect(plannedBaselines[1] - plannedBaselines[0]).toBeGreaterThanOrEqual(18);
    expect(plannedBaselines[2] - plannedBaselines[1]).toBeGreaterThanOrEqual(18);
  });

  it("reports a bounded fallback surface for an unreadable interactive label while keeping capture on canvas", () => {
    const anchors = [
      { time: "entry", price: 100 },
      { time: "stop", price: 95 },
      { time: "target", price: 110 },
    ];
    const item = drawing("long-risk-reward", "rr-fallback", anchors);
    const recorded = recordingContext();
    const fallback = vi.fn();
    const pointFor = pointMap({
      entry: { x: 8, y: 10 },
      stop: { x: 8, y: 18 },
      target: { x: 18, y: 28 },
    });
    paintDrawingScene(recorded.context, {
      width: 64,
      height: 64,
      plotWidth: 64,
      plotHeight: 64,
      drawings: [item],
      pointFor,
      pointForDrawing: (value) => pointFor(value.anchors[0]),
      currency: "HKD",
      selectedDrawingId: item.id,
      onLabelFallback: fallback,
    }, true);
    expect(fallback).toHaveBeenCalledTimes(1);
    expect(fallback.mock.calls[0][0].rows).toHaveLength(6);
    // The painter reports the full readable content height; the interactive
    // layer clamps that surface to the plot and exposes the rest by scrolling.
    expect(fallback.mock.calls[0][0].height).toBeGreaterThan(64);
    const interactiveTexts = (recorded.context.fillText as unknown as { mock: { calls: unknown[][] } }).mock.calls
      .map(([text]) => String(text));
    expect(interactiveTexts.some((text) => text.startsWith("入场"))).toBe(false);

    const capture = recordingContext();
    paintDrawingScene(capture.context, {
      width: 64,
      height: 64,
      plotWidth: 64,
      plotHeight: 64,
      drawings: [item],
      pointFor,
      pointForDrawing: (value) => pointFor(value.anchors[0]),
      currency: "HKD",
      selectedDrawingId: null,
    }, false);
    const capturedTexts = (capture.context.fillText as unknown as { mock: { calls: unknown[][] } }).mock.calls
      .map(([text]) => String(text));
    expect(capturedTexts.some((text) => text.startsWith("入场"))).toBe(true);
  });

  it("renders all seven fibonacci ratio and price rows for reverse and vertical geometry", () => {
    const anchors = [{ time: "a", price: 100 }, { time: "b", price: 52 }];
    const points = { a: { x: 300, y: 50 }, b: { x: 90, y: 230 } };
    const { context, calls } = paint(drawing("fibonacci", "fib", anchors), points);
    const texts = (context.fillText as unknown as { mock: { calls: unknown[][] } }).mock.calls.map(([text]) => String(text));
    const levels = fibonacciLevels(points.a, points.b);
    expect(levels).toHaveLength(7);
    for (const level of levels) {
      const ratio = `${(level.ratio * 100).toFixed(1)}%`;
      expect(texts.some((text) => text.includes(ratio))).toBe(true);
    }
    expect(texts.filter((text) => /%\s+/.test(text))).toHaveLength(7);
    expect(calls.filter((call) => call.op === "lineTo").some((call) => call.args[1] === points.a.y)).toBe(true);
    expect(numericArgs(calls).every(Number.isFinite)).toBe(true);
  });

  it("keeps invalid geometry finite and does not erase an existing anchor set", () => {
    const anchors = [{ time: "a", price: Number.NaN }, { time: "b", price: 52 }];
    const before = structuredClone(anchors);
    const { calls } = paint(drawing("fibonacci", "invalid-fib", anchors), {
      a: { x: Number.NaN, y: 20 },
      b: { x: 80, y: 120 },
    }, false, { width: 180, height: 140 });
    expect(numericArgs(calls).every(Number.isFinite)).toBe(true);
    expect(anchors).toEqual(before);
  });
});
