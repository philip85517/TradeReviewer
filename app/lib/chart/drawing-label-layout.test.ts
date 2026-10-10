import { describe, expect, it } from "vitest";

import {
  arrowheadGeometry,
  fibonacciLabelRows,
  layoutDrawingLabels,
  riskRewardLabelRows,
  type DrawingLabelRow,
  type LabelPoint,
  type LabelRect,
} from "./drawing-label-layout";

const measure = (value: string, fontSize = 12) =>
  Array.from(value).length * fontSize * 0.6;

function finitePoint(point: LabelPoint) {
  expect(Number.isFinite(point.x)).toBe(true);
  expect(Number.isFinite(point.y)).toBe(true);
}

function overlapArea(left: LabelRect, right: LabelRect) {
  const width = Math.max(
    0,
    Math.min(left.x + left.width, right.x + right.width) -
      Math.max(left.x, right.x),
  );
  const height = Math.max(
    0,
    Math.min(left.y + left.height, right.y + right.height) -
      Math.max(left.y, right.y),
  );
  return width * height;
}

describe("arrowheadGeometry", () => {
  it("orients a finite, non-zero head for horizontal, reverse, vertical, and diagonal vectors", () => {
    const vectors = [
      [{ x: 10, y: 20 }, { x: 100, y: 20 }],
      [{ x: 100, y: 20 }, { x: 10, y: 20 }],
      [{ x: 10, y: 80 }, { x: 10, y: 10 }],
      [{ x: 10, y: 10 }, { x: 70, y: 70 }],
    ] as const;

    for (const [start, end] of vectors) {
      const head = arrowheadGeometry(start, end);
      expect(head).not.toBeNull();
      if (!head) continue;
      finitePoint(head.tip);
      finitePoint(head.baseLeft);
      finitePoint(head.baseRight);
      expect(head.tip).toEqual(end);
      expect(Math.hypot(head.baseLeft.x - head.baseRight.x, head.baseLeft.y - head.baseRight.y)).toBeGreaterThan(0);
      const baseCenter = {
        x: (head.baseLeft.x + head.baseRight.x) / 2,
        y: (head.baseLeft.y + head.baseRight.y) / 2,
      };
      const direction = { x: end.x - start.x, y: end.y - start.y };
      const towardTip = { x: end.x - baseCenter.x, y: end.y - baseCenter.y };
      expect(direction.x * towardTip.x + direction.y * towardTip.y).toBeGreaterThan(0);
    }
  });

  it("keeps a very short vector finite and rejects a coincident vector", () => {
    const head = arrowheadGeometry({ x: 0, y: 0 }, { x: 1, y: 0 });
    expect(head).not.toBeNull();
    if (head) {
      expect(head.tip).toEqual({ x: 1, y: 0 });
      for (const point of [head.tip, head.baseLeft, head.baseRight]) finitePoint(point);
    }
    expect(arrowheadGeometry({ x: 3, y: 3 }, { x: 3, y: 3 })).toBeNull();
  });
});

describe("drawing label layout", () => {
  it("retains all six risk/reward rows and all ratio/price fibonacci rows", () => {
    const riskRows = riskRewardLabelRows({
      entry: "入场 56.00",
      stop: "止损 52.00",
      target: "目标 68.00",
      risk: "风险距离 4.00 (7.14%)",
      reward: "收益距离 12.00 (21.43%)",
      ratio: "3.00R",
    });
    expect(riskRows).toHaveLength(6);
    expect(riskRows.map((row) => row.text)).toEqual([
      "入场 56.00",
      "止损 52.00",
      "目标 68.00",
      "风险距离 4.00 (7.14%)",
      "收益距离 12.00 (21.43%)",
      "3.00R",
    ]);

    const fibRows = fibonacciLabelRows([
      { ratio: 0, price: 68, y: 30 },
      { ratio: 0.236, price: 64, y: 42 },
      { ratio: 0.382, price: 62, y: 54 },
      { ratio: 0.5, price: 60, y: 66 },
      { ratio: 0.618, price: 58, y: 78 },
      { ratio: 0.786, price: 55, y: 90 },
      { ratio: 1, price: 52, y: 102 },
    ]);
    expect(fibRows).toHaveLength(7);
    expect(fibRows.map((row) => row.text)).toEqual([
      "0.0%  68.00",
      "23.6%  64.00",
      "38.2%  62.00",
      "50.0%  60.00",
      "61.8%  58.00",
      "78.6%  55.00",
      "100.0%  52.00",
    ]);
    expect(fibRows.map((row) => row.lineY)).toEqual([30, 42, 54, 66, 78, 90, 102]);
    expect(fibRows.every((row) => row.kind === "value")).toBe(true);

    const invalidPrice = fibonacciLabelRows([{ ratio: 0.5, price: Number.NaN, y: 66 }]);
    expect(invalidPrice).toEqual([
      expect.objectContaining({ text: "50.0%  Invalid price", lineY: 66 }),
    ]);
  });

  it("wraps complete rows into a bounded surface without changing true geometry", () => {
    const rows: DrawingLabelRow[] = [
      { id: "entry", text: "入场 56.000000" },
      { id: "stop", text: "止损 52.000000" },
      { id: "ratio", text: "收益风险比 3.000000R" },
    ];
    const geometry = { x: 120, y: 72, width: 36, height: 42 };
    const input = {
      rows,
      geometryBounds: geometry,
      plot: { x: 0, y: 0, width: 320, height: 180 },
      maxWidth: 100,
      measure,
    } as const;
    const result = layoutDrawingLabels(input);
    expect(result.bestPosition).not.toBeNull();
    expect(result.bestPosition?.surface).toBe("surface");
    expect(result.bestPosition?.x).toBeGreaterThanOrEqual(0);
    expect(result.bestPosition?.y).toBeGreaterThanOrEqual(0);
    expect((result.bestPosition?.x ?? 0) + (result.bestPosition?.width ?? 0)).toBeLessThanOrEqual(320);
    expect((result.bestPosition?.y ?? 0) + (result.bestPosition?.height ?? 0)).toBeLessThanOrEqual(180);
    expect(result.bestPosition?.rows.map((row) => row.text)).toEqual(rows.map((row) => row.text));
    expect(geometry).toEqual({ x: 120, y: 72, width: 36, height: 42 });
    expect(result.bestPosition?.rows.some((row) => row.lines.length > 1)).toBe(true);
  });

  it("chooses a non-overlapping candidate when one exists and exposes a leader target", () => {
    const avoid = { x: 170, y: 65, width: 90, height: 55 };
    const result = layoutDrawingLabels({
      rows: [
        { id: "risk", text: "风险距离 4.00" },
        { id: "reward", text: "收益距离 12.00" },
      ],
      geometryBounds: { x: 145, y: 75, width: 24, height: 24 },
      plot: { x: 0, y: 0, width: 280, height: 160 },
      avoidRects: [avoid],
      endpointTargets: [{ x: 150, y: 80 }],
      leaderTarget: { x: 157, y: 87 },
      measure,
    });
    expect(result.nonOverlapping).toBe(true);
    expect(result.bestPosition?.surface).toBe("surface");
    expect(result.bestPosition).not.toBeNull();
    if (result.bestPosition) {
      expect(overlapArea(result.bestPosition, avoid)).toBe(0);
      expect(result.bestPosition.leader).toEqual({ from: { x: 157, y: 87 }, to: expect.any(Object) });
    }
  });

  it("keeps a grouped surface clear of coarse handles and endpoint hit radii", () => {
    const bounds = { x: 96, y: 72, width: 52, height: 96 };
    const targets = [
      { x: bounds.x, y: bounds.y },
      { x: bounds.x, y: bounds.y + bounds.height / 2 },
      { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
      // RR's independent time-width handle must be avoided as well.
      { x: bounds.x + bounds.width, y: bounds.y + bounds.height / 2 },
    ];
    const result = layoutDrawingLabels({
      rows: riskRewardLabelRows({
        entry: "入场 56.00",
        stop: "止损 52.00",
        target: "目标 68.00",
        risk: "风险距离 4.00 (7.14%)",
        reward: "收益距离 12.00 (21.43%)",
        ratio: "3.00R",
      }),
      geometryBounds: bounds,
      plot: { x: 0, y: 0, width: 360, height: 240 },
      endpointTargets: targets,
      avoidRects: targets.map((point) => ({ x: point.x - 22, y: point.y - 22, width: 44, height: 44 })),
      measure,
    });
    expect(result.nonOverlapping).toBe(true);
    expect(result.bestPosition?.surface).toBe("surface");
    expect(result.bestPosition?.overlapArea).toBe(0);
    expect(result.bestPosition?.x).toBeGreaterThanOrEqual(bounds.x + bounds.width + 20);
  });

  it("keeps an overflow fallback inside a clear handle corridor", () => {
    const bounds = { x: 67, y: 94, width: 110, height: 64 };
    const targets = [
      { x: 67, y: 126 },
      { x: 67, y: 158 },
      { x: 120, y: 94 },
      { x: 177, y: 126 },
    ];
    const avoidRects = targets.map((point) => ({ x: point.x - 22, y: point.y - 22, width: 44, height: 44 }));
    const result = layoutDrawingLabels({
      rows: riskRewardLabelRows({
        entry: "入场 55.99",
        stop: "止损 52.24",
        target: "目标 59.74",
        risk: "风险距离 3.75 (6.70%)",
        reward: "收益距离 3.75 (6.70%)",
        ratio: "1.00R",
      }),
      geometryBounds: bounds,
      plot: { x: 0, y: 0, width: 244, height: 230 },
      maxWidth: 153,
      endpointTargets: targets,
      avoidRects,
      measure,
    });
    expect(result.bestPosition).not.toBeNull();
    expect(result.bestPosition?.width).toBeGreaterThanOrEqual(35);
    expect(result.bestPosition?.height).toBeGreaterThanOrEqual(35);
    expect(avoidRects.every((rect) => overlapArea(result.bestPosition!, rect) === 0)).toBe(true);
  });

  it("fits all seven fib rows in the real narrow chart geometry", () => {
    const levels = [
      { ratio: 0, price: 68, y: 80 },
      { ratio: 0.236, price: 64, y: 86 },
      { ratio: 0.382, price: 62, y: 92 },
      { ratio: 0.5, price: 60, y: 98 },
      { ratio: 0.618, price: 58, y: 104 },
      { ratio: 0.786, price: 55, y: 110 },
      { ratio: 1, price: 52, y: 116 },
    ];
    const rows = fibonacciLabelRows(levels);
    const result = layoutDrawingLabels({
      rows,
      geometryBounds: { x: 100, y: 90, width: 36, height: 50 },
      plot: { x: 0, y: 0, width: 244, height: 230 },
      maxWidth: 150,
      measure,
    });
    expect(rows).toHaveLength(7);
    expect(result.bestPosition?.surface).toBe("surface");
    expect(result.bestPosition?.rows).toHaveLength(7);
    expect(result.overflow.height).toBe(false);
    expect(result.bestPosition?.height).toBeLessThanOrEqual(230);
  });

  it("returns transparent metadata when no fitting non-overlap candidate exists", () => {
    const result = layoutDrawingLabels({
      rows: Array.from({ length: 6 }, (_, index) => ({ id: `row-${index}`, text: `完整数据 ${index} ${"超长值".repeat(12)}` })),
      geometryBounds: { x: 0, y: 0, width: 20, height: 20 },
      plot: { x: 0, y: 0, width: 24, height: 24 },
      avoidRects: [{ x: 0, y: 0, width: 24, height: 24 }],
      measure,
    });
    expect(result.nonOverlapping).toBe(false);
    expect(result.bestPosition).not.toBeNull();
    expect(result.bestPosition?.surface).toBe("transparent");
    expect(result.bestPosition?.rows).toHaveLength(6);
    expect(result.overflow.height).toBe(true);
  });
});
