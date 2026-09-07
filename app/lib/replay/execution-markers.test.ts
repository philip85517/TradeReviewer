import { describe, expect, it } from "vitest";

import type { Candle } from "../market/types";
import type { TradeExecution } from "../trades/types";
import { mapExecutionsToCandles } from "./execution-markers";
import { dailyRecordToChartCandle } from "../market/types";

const candles: Candle[] = [
  {
    time: "2025-01-02T10:00:00.000Z",
    open: 1,
    high: 2,
    low: 1,
    close: 2,
    volume: 1,
  },
  {
    time: "2025-01-02T11:00:00.000Z",
    open: 2,
    high: 3,
    low: 2,
    close: 3,
    volume: 1,
  },
];

function execution(id: string, executedAt: string): TradeExecution {
  return {
    id,
    source: { platform: "fixture", row: 1 },
    accountId: "account",
    accountLabel: "账户",
    instrument: {
      id: "US:TEST",
      symbol: "TEST",
      name: "Test",
      market: "US",
      currency: "USD",
    },
    side: "buy",
    executedAt,
    quantity: "1",
    price: "1",
    fee: "0",
  };
}

describe("mapExecutionsToCandles", () => {
  it("never maps confirmed grey-market fills onto regular-market candles", () => {
    const fill = execution("grey", "2025-01-02T10:12:00.000Z");
    const grey = { ...fill, source: { ...fill.source, tradingSession: "grey-market" as const } };
    expect(mapExecutionsToCandles(candles, [grey])).toEqual([]);
    expect(mapExecutionsToCandles([{ ...candles[0], tradingDates: ["2025-01-02"] }], [grey])).toEqual([]);
    expect(mapExecutionsToCandles(candles, [fill])).toHaveLength(1);
  });
  it("maps after-hours trades by exchange trading date, without borrowing a missing day", () => {
    const daily = dailyRecordToChartCandle({ instrumentId: "US:TEST", tradingDate: "2026-01-22", open: "1", high: "2", low: "1", close: "2", volume: "1", currency: "USD", provider: "tiger", providerSymbol: "TEST", adjustmentMode: "raw", fetchedAt: "2026-01-23T00:00:00Z" });
    expect(mapExecutionsToCandles([daily], [
      execution("post-market", "2026-01-23T00:40:00Z"),
      execution("missing-next-day", "2026-01-23T15:00:00Z"),
    ])).toEqual([{ executionId: "post-market", candleTime: "2026-01-22T00:00:00.000Z" }]);
  });
  it("does not attach a missing-session execution to the previous bar", () => {
    const known = candles.map(candle => ({ ...candle, knowledgeAt: new Date(Date.parse(candle.time) + 3600000).toISOString() }));
    expect(mapExecutionsToCandles(known, [execution("after-window", "2025-01-03T10:12:00.000Z")])).toEqual([]);
  });
  it("maps an execution to the candle interval containing its instant", () => {
    expect(
      mapExecutionsToCandles(candles, [
        execution("first", "2025-01-02T10:12:00.000Z"),
        execution("boundary", "2025-01-02T11:00:00.000Z"),
      ]),
    ).toEqual([
      {
        executionId: "first",
        candleTime: "2025-01-02T10:00:00.000Z",
      },
      {
        executionId: "boundary",
        candleTime: "2025-01-02T11:00:00.000Z",
      },
    ]);
  });

  it("does not silently pin executions outside the loaded candle window", () => {
    expect(
      mapExecutionsToCandles(candles, [
        execution("before-window", "2025-01-02T09:59:59.000Z"),
      ]),
    ).toEqual([]);
  });
});
