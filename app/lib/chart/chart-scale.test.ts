import { describe, expect, it } from "vitest";

import { priceRangeForCandles } from "./chart-scale";

describe("priceRangeForCandles", () => {
  it("uses the visible candle range instead of forcing the scale to include zero", () => {
    const range = priceRangeForCandles([
      {
        time: "2026-07-24T09:30:00.000Z",
        open: 318,
        high: 322,
        low: 316,
        close: 321,
        volume: 1_000,
      },
      {
        time: "2026-07-24T09:45:00.000Z",
        open: 321,
        high: 326,
        low: 320,
        close: 325,
        volume: 1_200,
      },
    ]);

    expect(range).toEqual({ minPrice: 316, maxPrice: 326, priceRange: 10 });
  });

  it("returns a safe default for an empty candle set", () => {
    expect(priceRangeForCandles([])).toEqual({
      minPrice: 0,
      maxPrice: 1,
      priceRange: 1,
    });
  });
});
