import { describe, expect, it } from "vitest";

import type { Candle } from "../market/types";
import type { TradeExecution } from "../trades/types";
import { createReplaySnapshot } from "./replay-engine";
import { mapExecutionsToCandles } from "./execution-markers";

const candles: Candle[] = [
  { time: "2025-01-02T00:00:00.000Z", open: 10, high: 11, low: 9, close: 10, volume: 100 },
  { time: "2025-01-03T00:00:00.000Z", open: 10, high: 12, low: 10, close: 11, volume: 120 },
  { time: "2025-01-06T00:00:00.000Z", open: 11, high: 13, low: 10, close: 12, volume: 140 },
  { time: "2025-01-07T00:00:00.000Z", open: 12, high: 15, low: 12, close: 14, volume: 160 },
];

const executions: TradeExecution[] = [
  {
    id: "buy-1",
    source: { platform: "demo", row: 1 },
    accountId: "acct-1",
    accountLabel: "演示账户",
    instrument: { id: "US:XPEV", symbol: "XPEV", name: "XPeng", market: "US", currency: "USD" },
    side: "buy",
    executedAt: "2025-01-03T00:00:00.000Z",
    quantity: "100",
    price: "10",
    fee: "2",
  },
  {
    id: "sell-1",
    source: { platform: "demo", row: 2 },
    accountId: "acct-1",
    accountLabel: "演示账户",
    instrument: { id: "US:XPEV", symbol: "XPEV", name: "XPeng", market: "US", currency: "USD" },
    side: "sell",
    executedAt: "2025-01-07T00:00:00.000Z",
    quantity: "100",
    price: "14",
    fee: "2",
  },
];

describe("createReplaySnapshot", () => {
  it("returns only candles and executions at or before the replay cursor", () => {
    const snapshot = createReplaySnapshot({
      candles,
      executions,
      cursor: candles[2].time,
    });

    expect(snapshot.candles).toEqual(candles.slice(0, 3));
    expect(snapshot.executions).toEqual([executions[0]]);
    expect(snapshot.position).toEqual({
      quantity: "100",
      averageCost: "10",
      realizedPnl: "0",
      unrealizedPnl: "200",
      netPnl: "198",
      fees: "2",
      grossCapitalDeployed: "1000",
      returnPercent: "19.8",
    });
    expect(JSON.stringify(snapshot)).not.toContain("2025-01-07");
  });

  it("reveals an execution ledger without inventing a candle mark", () => {
    const snapshot = createReplaySnapshot({
      candles: [],
      executions,
      cursor: "2025-01-07T00:00:00.000Z",
    });

    expect(snapshot.candles).toEqual([]);
    expect(snapshot.executions).toEqual(executions);
    expect(snapshot.position).toMatchObject({
      quantity: "0",
      realizedPnl: "400",
      unrealizedPnl: "0",
      fees: "4",
      netPnl: "396",
    });
  });

  it("withholds a filled candle until its provider completion boundary", () => {
    const providerBar: Candle = {
      time: "2025-01-02T10:00:00.000Z",
      knowledgeAt: "2025-01-02T10:15:00.000Z",
      open: 10,
      high: 12,
      low: 9,
      close: 11,
      volume: 100,
    };
    const fillAt1007 = {
      ...executions[0],
      executedAt: "2025-01-02T10:07:00.000Z",
    };

    expect(
      createReplaySnapshot({
        candles: [providerBar],
        executions: [fillAt1007],
        cursor: "2025-01-02T10:07:00.000Z",
      }).candles,
    ).toEqual([]);
    expect(
      createReplaySnapshot({
        candles: [providerBar],
        executions: [fillAt1007],
        cursor: "2025-01-02T10:14:59.999Z",
      }).candles,
    ).toEqual([]);
    expect(
      createReplaySnapshot({
        candles: [providerBar],
        executions: [fillAt1007],
        cursor: "2025-01-02T10:15:00.000Z",
      }).candles,
    ).toEqual([providerBar]);
  });

  it("preserves the fill immediately but defers its candle marker until completion", () => {
    const providerBar: Candle = {
      time: "2025-01-02T10:00:00.000Z",
      knowledgeAt: "2025-01-02T10:15:00.000Z",
      open: 10,
      high: 12,
      low: 9,
      close: 11,
      volume: 100,
    };
    const fillAt1007 = {
      ...executions[0],
      executedAt: "2025-01-02T10:07:00.000Z",
    };

    const snapshot = createReplaySnapshot({
      candles: [providerBar],
      executions: [fillAt1007],
      cursor: fillAt1007.executedAt,
    });

    expect(snapshot.candles).toEqual([]);
    expect(snapshot.executions).toEqual([fillAt1007]);
    expect(snapshot.position.unrealizedPnl).toBe("0");
    expect(mapExecutionsToCandles(snapshot.candles, snapshot.executions)).toEqual([]);
    const completed = createReplaySnapshot({ candles: [providerBar], executions: [fillAt1007], cursor: "2025-01-02T10:15:00.000Z" });
    expect(mapExecutionsToCandles(completed.candles, completed.executions)).toEqual([{ executionId: "buy-1", candleTime: "2025-01-02T10:00:00.000Z" }]);
  });
});
