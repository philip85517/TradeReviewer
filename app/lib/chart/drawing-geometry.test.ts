import { describe, expect, it } from "vitest";

import {
  fibonacciLevels,
  isPointNearAnchorHandle,
  isPointNearRectangleEdge,
  isPointNearSegment,
  parallelChannelGeometry,
} from "./drawing-geometry";

describe("drawing hit-test geometry", () => {
  it("projects a three point parallel channel without changing its base", () => {
    expect(
      parallelChannelGeometry(
        { x: 10, y: 20 },
        { x: 50, y: 40 },
        { x: 15, y: 60 },
      ),
    ).toEqual({
      base: [{ x: 10, y: 20 }, { x: 50, y: 40 }],
      parallel: [{ x: 15, y: 60 }, { x: 55, y: 80 }],
    });
  });

  it("returns the standard fibonacci retracement levels", () => {
    expect(fibonacciLevels({ x: 0, y: 100 }, { x: 0, y: 0 }).map((level) => level.ratio)).toEqual([
      0, 0.236, 0.382, 0.5, 0.618, 0.786, 1,
    ]);
    expect(fibonacciLevels({ x: 0, y: 100 }, { x: 0, y: 0 })[3]?.y).toBe(50);
  });

  it("hits a segment within six pixels", () => {
    expect(
      isPointNearSegment({ x: 50, y: 5 }, { x: 0, y: 0 }, { x: 100, y: 0 }),
    ).toBe(true);
    expect(
      isPointNearSegment({ x: 50, y: 7 }, { x: 0, y: 0 }, { x: 100, y: 0 }),
    ).toBe(false);
  });

  it("hits only rectangle edges within six pixels", () => {
    expect(
      isPointNearRectangleEdge({ x: 50, y: 5 }, { x: 0, y: 0 }, { x: 100, y: 100 }),
    ).toBe(true);
    expect(
      isPointNearRectangleEdge({ x: 50, y: 50 }, { x: 0, y: 0 }, { x: 100, y: 100 }),
    ).toBe(false);
  });

  it("hits an anchor handle within six pixels", () => {
    expect(isPointNearAnchorHandle({ x: 104, y: 103 }, { x: 100, y: 100 })).toBe(true);
    expect(isPointNearAnchorHandle({ x: 107, y: 100 }, { x: 100, y: 100 })).toBe(false);
  });
});
