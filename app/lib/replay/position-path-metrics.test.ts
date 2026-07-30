import { describe, expect, it } from "vitest";

import type { Candle } from "../market/types";
import type { TradeExecution } from "../trades/types";
import { calculatePositionPathMetrics } from "./position-path-metrics";

function candle(
  time: string,
  open: number,
  high: number,
  low: number,
  close: number,
): Candle {
  return { time, open, high, low, close, volume: 100 };
}

function fill(
  side: TradeExecution["side"],
  executedAt: string,
  quantity: string,
  price: string,
  fee = "0",
): TradeExecution {
  return {
    id: `${side}-${executedAt}-${quantity}`,
    source: { platform: "test", row: 1 },
    accountId: "account-1",
    accountLabel: "Test account",
    instrument: {
      id: "US:TEST",
      symbol: "TEST",
      name: "Test",
      market: "US",
      currency: "USD",
    },
    side,
    executedAt,
    quantity,
    price,
    fee,
  };
}

describe("calculatePositionPathMetrics", () => {
  it("calculates long MFE, MAE, drawdown, giveback, and R multiple through the cursor", () => {
    const metrics = calculatePositionPathMetrics({
      candles: [
        candle("2025-01-02T14:30:00Z", 10, 11, 9, 10),
        candle("2025-01-02T14:45:00Z", 10, 15, 8, 14),
        candle("2025-01-02T15:00:00Z", 14, 14, 11, 12),
      ],
      executions: [
        fill("buy", "2025-01-02T14:30:00Z", "10", "10"),
      ],
      cursor: "2025-01-02T15:00:00Z",
      episodeStartedAt: "2025-01-02T14:30:00Z",
      plannedRiskAmount: "20",
    });

    expect(metrics).toMatchObject({
      current: expect.objectContaining({ netPnl: "20" }),
      holdingMilliseconds: 1_800_000,
      mfe: { amount: "50", percent: "50" },
      mae: { amount: "-20", percent: "-20" },
      maximumDrawdown: { amount: "20", percent: "20" },
      profitGiveback: { amount: "30", percent: "30" },
      rMultiple: "1",
    });
  });

  it("uses low prices for short MFE and high prices for short MAE", () => {
    const metrics = calculatePositionPathMetrics({
      candles: [
        candle("2025-01-02T14:30:00Z", 10, 11, 9, 10),
        candle("2025-01-02T14:45:00Z", 10, 12, 5, 6),
        candle("2025-01-02T15:00:00Z", 6, 9, 6, 8),
      ],
      executions: [
        fill("sell", "2025-01-02T14:30:00Z", "10", "10"),
      ],
      cursor: "2025-01-02T15:00:00Z",
      episodeStartedAt: "2025-01-02T14:30:00Z",
      plannedRiskAmount: "20",
    });

    expect(metrics).toMatchObject({
      mfe: { amount: "50", percent: "50" },
      mae: { amount: "-20", percent: "-20" },
      maximumDrawdown: { amount: "20", percent: "20" },
      profitGiveback: { amount: "30", percent: "30" },
      rMultiple: "1",
    });
  });

  it("replays scaled entries and partial exits without exposing future data", () => {
    const metrics = calculatePositionPathMetrics({
      candles: [
        candle("2025-01-02T14:30:00Z", 10, 11, 9, 10),
        candle("2025-01-02T14:45:00Z", 10, 13, 11, 12),
        candle("2025-01-02T15:00:00Z", 12, 15, 12, 13),
        candle("2025-01-02T15:15:00Z", 13, 20, 10, 19),
      ],
      executions: [
        fill("buy", "2025-01-02T14:30:00Z", "5", "10"),
        fill("buy", "2025-01-02T14:45:00Z", "5", "12"),
        fill("sell", "2025-01-02T15:00:00Z", "2", "14"),
        fill("sell", "2025-01-02T15:15:00Z", "8", "19"),
      ],
      cursor: "2025-01-02T15:00:00Z",
      episodeStartedAt: "2025-01-02T14:30:00Z",
    });

    expect(metrics.current).toMatchObject({
      quantity: "8",
      averageCost: "11",
      realizedPnl: "6",
      unrealizedPnl: "16",
      netPnl: "22",
      grossCapitalDeployed: "110",
    });
    expect(JSON.stringify(metrics)).not.toContain("2025-01-02T15:15:00Z");
  });

  it("reports that metrics are unavailable before the first entry", () => {
    const metrics = calculatePositionPathMetrics({
      candles: [candle("2025-01-02T14:30:00Z", 10, 11, 9, 10)],
      executions: [fill("buy", "2025-01-02T14:45:00Z", "10", "10")],
      cursor: "2025-01-02T14:30:00Z",
      episodeStartedAt: "2025-01-02T14:30:00Z",
    });

    expect(metrics).toMatchObject({
      mfe: null,
      mae: null,
      maximumDrawdown: null,
      profitGiveback: null,
      rMultiple: null,
      unavailableReason: "No execution has occurred at or before the replay cursor.",
    });
  });

  it("does not use a pre-entry candle when no candle is available after entry", () => {
    const metrics = calculatePositionPathMetrics({
      candles: [candle("2025-01-02T14:30:00Z", 10, 11, 9, 10)],
      executions: [
        fill("buy", "2025-01-02T14:45:00Z", "10", "12"),
      ],
      cursor: "2025-01-02T15:00:00Z",
      episodeStartedAt: "2025-01-02T14:45:00Z",
      plannedRiskAmount: "20",
    });

    expect(metrics.current).toMatchObject({
      quantity: "10",
      averageCost: "12",
      unrealizedPnl: "0",
    });
    expect(metrics).toMatchObject({
      holdingMilliseconds: null,
      mfe: null,
      mae: null,
      maximumDrawdown: null,
      profitGiveback: null,
      rMultiple: null,
      unavailableReason:
        "No candle is available at or after the first execution through the replay cursor.",
    });
  });

  it("clamps profit giveback to zero when current net P&L exceeds candle MFE", () => {
    const metrics = calculatePositionPathMetrics({
      candles: [candle("2025-01-02T14:30:00Z", 10, 11, 9, 10)],
      executions: [
        fill("buy", "2025-01-02T14:30:00Z", "10", "10"),
        fill("sell", "2025-01-02T14:45:00Z", "10", "20"),
      ],
      cursor: "2025-01-02T15:00:00Z",
      episodeStartedAt: "2025-01-02T14:30:00Z",
    });

    expect(metrics.current.netPnl).toBe("100");
    expect(metrics.mfe).toEqual({ amount: "10", percent: "10" });
    expect(metrics.profitGiveback).toEqual({ amount: "0", percent: "0" });
  });

  it("retains the revealed execution ledger when path candles are unavailable", () => {
    const metrics = calculatePositionPathMetrics({
      candles: [],
      executions: [
        fill("buy", "2025-01-02T14:30:00Z", "10", "10", "1"),
        fill("sell", "2025-01-02T15:00:00Z", "10", "12", "1"),
      ],
      cursor: "2025-01-02T15:00:00Z",
      episodeStartedAt: "2025-01-02T14:30:00Z",
    });

    expect(metrics.current).toMatchObject({
      quantity: "0",
      realizedPnl: "20",
      unrealizedPnl: "0",
      fees: "2",
      netPnl: "18",
    });
    expect(metrics.mfe).toBeNull();
    expect(metrics.unavailableReason).toBe(
      "No candle is available at or before the replay cursor.",
    );
  });

  it("keeps a 10:00-10:15 bar out of path metrics until 10:15", () => {
    const bar = {
      ...candle("2025-01-02T10:00:00.000Z", 10, 12, 9, 11),
      knowledgeAt: "2025-01-02T10:15:00.000Z",
    };
    const execution = fill(
      "buy",
      "2025-01-02T10:07:00.000Z",
      "10",
      "10",
    );

    expect(
      calculatePositionPathMetrics({
        candles: [bar],
        executions: [execution],
        cursor: "2025-01-02T10:07:00.000Z",
        episodeStartedAt: execution.executedAt,
      }).mfe,
    ).toBeNull();
    expect(
      calculatePositionPathMetrics({
        candles: [bar],
        executions: [execution],
        cursor: "2025-01-02T10:15:00.000Z",
        episodeStartedAt: execution.executedAt,
      }).mfe,
    ).toEqual({ amount: "20", percent: "20" });
  });
});
