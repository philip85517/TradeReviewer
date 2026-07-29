import { describe, expect, it } from "vitest";

import {
  isPointNearAnchorHandle,
  isPointNearRectangleEdge,
  isPointNearSegment,
} from "./drawing-geometry";

describe("drawing hit-test geometry", () => {
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
