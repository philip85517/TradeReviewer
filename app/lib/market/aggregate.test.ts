import { describe, expect, it } from "vitest";

import { aggregateCandles } from "./aggregate";
import type { Candle } from "./types";

const fifteenMinuteCandles: Candle[] = [
  {
    time: "2025-01-02T10:00:00.000Z",
    open: 10,
    high: 11,
    low: 9,
    close: 10.5,
    volume: 100,
  },
  {
    time: "2025-01-02T10:15:00.000Z",
    open: 10.5,
    high: 12,
    low: 10,
    close: 11,
    volume: 120,
  },
  {
    time: "2025-01-02T10:30:00.000Z",
    open: 11,
    high: 11.8,
    low: 10.4,
    close: 11.2,
    volume: 80,
  },
  {
    time: "2025-01-02T10:45:00.000Z",
    open: 11.2,
    high: 11.7,
    low: 10.8,
    close: 11.5,
    volume: 90,
  },
  {
    time: "2025-01-02T11:00:00.000Z",
    open: 11.5,
    high: 12.2,
    low: 11.4,
    close: 12,
    volume: 75,
  },
];

describe("aggregateCandles", () => {
  it("aggregates intraday candles without crossing an hourly boundary", () => {
    const hourly = aggregateCandles(fifteenMinuteCandles, "1h");

    expect(hourly).toHaveLength(2);
    expect(hourly[0]).toEqual({
      time: "2025-01-02T10:00:00.000Z",
      open: 10,
      high: 12,
      low: 9,
      close: 11.5,
      volume: 390,
    });
    expect(hourly[1].open).toBe(11.5);
  });
});
