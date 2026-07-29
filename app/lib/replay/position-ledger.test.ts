import { describe, expect, it } from "vitest";

import type { TradeExecution } from "../trades/types";
import { replayPositionAtPrice } from "./position-ledger";

function fill(
  side: TradeExecution["side"],
  executedAt: string,
  quantity: string,
  price: string,
  fee: string,
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

describe("replayPositionAtPrice", () => {
  it("calculates a partially closed long position including fees and cumulative opening exposure", () => {
    expect(
      replayPositionAtPrice({
        executions: [
          fill("buy", "2025-01-02T14:30:00Z", "100", "10", "2"),
          fill("sell", "2025-01-03T14:30:00Z", "40", "12", "1"),
        ],
        markPrice: "11",
      }),
    ).toEqual({
      quantity: "60",
      averageCost: "10",
      realizedPnl: "80",
      unrealizedPnl: "60",
      netPnl: "137",
      fees: "3",
      grossCapitalDeployed: "1000",
      returnPercent: "13.7",
    });
  });

  it("calculates a partially covered short position", () => {
    expect(
      replayPositionAtPrice({
        executions: [
          fill("sell", "2025-01-02T14:30:00Z", "100", "10", "2"),
          fill("buy", "2025-01-03T14:30:00Z", "40", "8", "1"),
        ],
        markPrice: "9",
      }),
    ).toMatchObject({
      quantity: "-60",
      averageCost: "10",
      realizedPnl: "80",
      unrealizedPnl: "60",
      netPnl: "137",
      fees: "3",
      grossCapitalDeployed: "1000",
      returnPercent: "13.7",
    });
  });

  it("counts only the excess reversing fill as new capital deployment", () => {
    expect(
      replayPositionAtPrice({
        executions: [
          fill("buy", "2025-01-02T14:30:00Z", "100", "10", "1"),
          fill("sell", "2025-01-03T14:30:00Z", "150", "12", "2"),
        ],
        markPrice: "11",
      }),
    ).toMatchObject({
      quantity: "-50",
      averageCost: "12",
      realizedPnl: "200",
      unrealizedPnl: "50",
      netPnl: "247",
      fees: "3",
      grossCapitalDeployed: "1600",
      returnPercent: "15.4375",
    });
  });
});
