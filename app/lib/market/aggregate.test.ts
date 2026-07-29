import { describe, expect, it } from "vitest";

import { aggregateCandles } from "./aggregate";
import type { MarketCandleRecord } from "./contracts";
import { marketRecordToChartCandle, type Candle } from "./types";

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

const intradayRecord: MarketCandleRecord = {
  instrumentId: "instrument-1",
  interval: "15m",
  timestamp: "2025-01-02T14:30:00.000Z",
  open: "10",
  high: "11",
  low: "9",
  close: "10.5",
  volume: "100",
  currency: "USD",
  provider: "yahoo",
  providerSymbol: "TEST",
  adjustmentMode: "raw",
  fetchedAt: "2025-01-02T15:30:00.000Z",
};

const marketFifteenMinuteCandles: Candle[] = [
  marketRecordToChartCandle(intradayRecord),
  {
    time: "2025-01-02T14:45:00.000Z",
    open: 10.5,
    high: 12,
    low: 10,
    close: 11,
    volume: 120,
  },
  {
    time: "2025-01-02T15:00:00.000Z",
    open: 11,
    high: 11.8,
    low: 10.4,
    close: 11.2,
    volume: 80,
  },
  {
    time: "2025-01-02T15:15:00.000Z",
    open: 11.2,
    high: 11.7,
    low: 10.8,
    close: 11.5,
    volume: 160,
  },
];

const dailyCandles: Candle[] = [
  {
    time: "2025-01-02T00:00:00.000Z",
    open: 10,
    high: 12,
    low: 9,
    close: 11.5,
    volume: 460,
  },
];

describe("aggregateCandles", () => {
  it("converts a native market record without changing its timestamp", () => {
    expect(marketRecordToChartCandle(intradayRecord)).toEqual({
      time: "2025-01-02T14:30:00.000Z",
      open: 10,
      high: 11,
      low: 9,
      close: 10.5,
      volume: 100,
    });
  });

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

  it("aggregates native 15m candles into 1h without crossing a market date", () => {
    const hourly = aggregateCandles(marketFifteenMinuteCandles, "1h", {
      sourceInterval: "15m",
      market: "US",
    });

    expect(hourly).toEqual([
      {
        time: "2025-01-02T14:30:00.000Z",
        open: 10,
        high: 12,
        low: 9,
        close: 11.5,
        volume: 460,
      },
    ]);
  });

  it("starts a new intraday bucket when the US market date changes", () => {
    const hourly = aggregateCandles(
      [
        {
          time: "2025-01-03T04:30:00.000Z",
          open: 10,
          high: 11,
          low: 9,
          close: 10.5,
          volume: 100,
        },
        {
          time: "2025-01-03T04:45:00.000Z",
          open: 10.5,
          high: 12,
          low: 10,
          close: 11,
          volume: 120,
        },
        {
          time: "2025-01-03T05:00:00.000Z",
          open: 11,
          high: 11.8,
          low: 10.4,
          close: 11.2,
          volume: 80,
        },
        {
          time: "2025-01-03T05:15:00.000Z",
          open: 11.2,
          high: 11.7,
          low: 10.8,
          close: 11.5,
          volume: 90,
        },
      ],
      "1h",
      { sourceInterval: "15m", market: "US" },
    );

    expect(hourly).toEqual([
      {
        time: "2025-01-03T04:30:00.000Z",
        open: 10,
        high: 12,
        low: 9,
        close: 11,
        volume: 220,
      },
      {
        time: "2025-01-03T05:00:00.000Z",
        open: 11,
        high: 11.8,
        low: 10.4,
        close: 11.5,
        volume: 170,
      },
    ]);
  });

  it("aggregates sixteen native 15m candles into a 4h candle", () => {
    const fourHour = aggregateCandles(
      Array.from({ length: 16 }, (_, index) => ({
        time: new Date(
          Date.UTC(2025, 0, 2, 14, 30 + index * 15),
        ).toISOString(),
        open: 10 + index,
        high: 10 + index,
        low: 9 + index,
        close: 10 + index,
        volume: 10,
      })),
      "4h",
      { sourceInterval: "15m", market: "US" },
    );

    expect(fourHour).toEqual([
      {
        time: "2025-01-02T14:30:00.000Z",
        open: 10,
        high: 25,
        low: 9,
        close: 25,
        volume: 160,
      },
    ]);
  });

  it("rejects an attempt to derive 15m candles from daily candles", () => {
    expect(() =>
      aggregateCandles(dailyCandles, "15m", {
        sourceInterval: "1D",
        market: "US",
      }),
    ).toThrow("不能从 1D 生成 15m");
  });

  it("rejects an attempt to derive weekly candles from native 15m candles", () => {
    expect(() =>
      aggregateCandles(fifteenMinuteCandles, "1W", {
        sourceInterval: "15m",
        market: "US",
      }),
    ).toThrow("不能从 15m 生成 1W");
  });
});
