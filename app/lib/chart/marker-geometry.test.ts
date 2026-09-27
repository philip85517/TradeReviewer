import { describe, expect, it } from "vitest";
import { markerDisplayGeometry, markerLogicalPosition, markerTimelineTimes } from "./marker-geometry";

const seconds = (value: string) => Date.parse(value) / 1000;

describe("marker timeline geometry", () => {
  it("uses an explicitly registered real time after a calendar gap", () => {
    const candles = [
      seconds("2026-09-03T00:00:00Z"),
      seconds("2026-09-04T00:00:00Z"),
      seconds("2026-09-07T00:00:00Z"),
      seconds("2026-09-08T00:00:00Z"),
    ];

    expect(markerLogicalPosition(candles, seconds("2026-09-08T00:00:00Z"))).toBe(3);
  });

  it("keeps an exact single candle addressable but does not invent a future slot", () => {
    const candle = seconds("2026-09-07T00:00:00Z");

    expect(markerLogicalPosition([candle], candle)).toBe(0);
    expect(markerLogicalPosition([candle], seconds("2026-09-08T00:00:00Z"))).toBeNull();
  });

  it("interpolates only inside a real pair of known candle times", () => {
    const candles = [
      seconds("2026-09-03T00:00:00Z"),
      seconds("2026-09-04T00:00:00Z"),
      seconds("2026-09-07T00:00:00Z"),
    ];

    expect(markerLogicalPosition(candles, seconds("2026-09-05T12:00:00Z"))).toBe(1.5);
  });

  it("sorts and de-duplicates candle and whitespace times for both renderers", () => {
    expect(markerTimelineTimes([3, 1, 2], [2, 4, 1])).toEqual([1, 2, 3, 4]);
  });

  it("clamps an in-pane lane offset so the diamond stays inside the plot", () => {
    expect(markerDisplayGeometry({
      anchorX: 100,
      anchorY: 200,
      position: "aboveBar",
      offsetX: 18,
      maxX: 110,
    })).toEqual({ x: 104, y: 190, radius: 6 });
  });

  it("does not pull an off-screen anchor back onto the pane edge", () => {
    expect(markerDisplayGeometry({
      anchorX: 140,
      anchorY: 200,
      position: "belowBar",
      offsetX: 18,
      maxX: 110,
    }).x).toBe(158);
  });
});
