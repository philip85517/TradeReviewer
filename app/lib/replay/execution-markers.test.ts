import { describe, expect, it } from "vitest";

import type { Candle } from "../market/types";
import type { TradeExecution } from "../trades/types";
import { groupExecutionsByCandle, mapExecutionsToCandles } from "./execution-markers";
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
  it("does not borrow the previous hourly bar when the boundary bar is missing", () => {
    const hourlyWithGap: Candle[] = [
      {
        ...candles[0],
        time: "2025-01-02T13:30:00.000Z",
        knowledgeAt: "2025-01-02T14:30:00.000Z",
      },
      {
        ...candles[1],
        time: "2025-01-02T15:30:00.000Z",
        knowledgeAt: "2025-01-02T16:30:00.000Z",
      },
    ];
    expect(
      mapExecutionsToCandles(hourlyWithGap, [execution("missing-boundary", "2025-01-02T14:30:00.000Z")]),
    ).toEqual([]);
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

  it("anchors date-only fills to their source market date and leaves a missing day unmatched", () => {
    const daily = dailyRecordToChartCandle({ instrumentId: "HK:TEST", tradingDate: "2025-01-03", open: "1", high: "2", low: "1", close: "2", volume: "1", currency: "HKD", provider: "tencent", providerSymbol: "TEST", adjustmentMode: "raw", fetchedAt: "2025-01-04T00:00:00Z" });
    const dateOnly = { ...execution("date-only", "2025-01-03"), instrument: { ...execution("date-only", "2025-01-03").instrument, id: "HK:TEST", market: "HK", currency: "HKD" }, source: { platform: "fixture", row: 1, timePrecision: "date-only" as const, tradingDate: "2025-01-03", sourceTimestampText: "2025-01-03" } };
    expect(mapExecutionsToCandles([daily], [dateOnly])).toEqual([{ executionId: "date-only", candleTime: daily.time }]);
    expect(mapExecutionsToCandles([daily], [{ ...dateOnly, id: "missing", source: { ...dateOnly.source, tradingDate: "2025-01-02" } }])).toEqual([]);
    const hourlySameDay = [
      { ...candles[0], time: "2025-01-03T10:00:00.000Z" },
      { ...candles[1], time: "2025-01-03T11:00:00.000Z" },
    ];
    expect(mapExecutionsToCandles(hourlySameDay, [dateOnly])).toEqual([]);
  });

  it("does not reinterpret a US date-only source date as the prior UTC trading day", () => {
    const daily = dailyRecordToChartCandle({ instrumentId: "US:TEST", tradingDate: "2025-01-02", open: "1", high: "2", low: "1", close: "2", volume: "1", currency: "USD", provider: "yahoo", providerSymbol: "TEST", adjustmentMode: "raw", fetchedAt: "2025-01-03T00:00:00Z" });
    const dateOnly = execution("us-date-only", "2025-01-02");
    dateOnly.instrument = { ...dateOnly.instrument, market: "US", currency: "USD" };
    dateOnly.source = { ...dateOnly.source, timePrecision: "date-only", sourceTimestampText: "2025/01/02" };
    expect(mapExecutionsToCandles([daily], [dateOnly])).toEqual([{ executionId: "us-date-only", candleTime: daily.time }]);
  });

  it("groups same-candle fills by direction while retaining every source fill", () => {
    const first = execution("buy-1", "2025-01-02T10:05:00.000Z");
    const second = { ...execution("buy-2", "2025-01-02T10:10:00.000Z"), quantity: "2" };
    const sell = { ...execution("sell", "2025-01-02T10:12:00.000Z"), side: "sell" as const };
    const groups = groupExecutionsByCandle(candles, [first, second, sell]);
    expect(groups).toHaveLength(2);
    expect(groups.find(group => group.side === "buy")).toMatchObject({ fillCount: 2, executionIds: ["buy-1", "buy-2"] });
    expect(groups.find(group => group.side === "sell")).toMatchObject({ fillCount: 1, executionIds: ["sell"] });
  });

  it("does not group fills from different accounts or simulation scopes", () => {
    const live = execution("live", "2025-01-02T10:05:00.000Z");
    const otherAccount = { ...execution("other-account", "2025-01-02T10:10:00.000Z"), accountId: "other" };
    const simulation = { ...execution("simulation", "2025-01-02T10:12:00.000Z"), source: { ...execution("simulation", "2025-01-02T10:12:00.000Z").source, tradeNature: "simulation" as const, simulationRunId: "run-1" } };
    expect(groupExecutionsByCandle(candles, [live, otherAccount, simulation])).toHaveLength(3);
  });
});
