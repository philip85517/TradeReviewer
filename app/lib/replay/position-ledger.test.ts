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
  it("keeps same-day transfer quantity unknown intraday and reconciles it at day end", () => {
    const sale = fill("sell", "2025-01-03T14:30:00Z", "100", "10", "0");
    sale.source.positionEvents = [{ id: "in", accountId: "account-1", market: "US", symbol: "TEST", date: "2025-01-03", kind: "transfer-in", quantity: "100", description: "transfer", source: [] }];
    const during = replayPositionAtPrice({ executions: [sale], markPrice: "11", cursor: "2025-01-03T15:00:00Z" });
    expect(during).toMatchObject({ quantityKnown: false, quantity: "0", accuracy: { reasons: expect.arrayContaining(["ambiguous-event-order"]) } });
    const after = replayPositionAtPrice({ executions: [sale], markPrice: "11", cursor: "2025-01-04T00:00:00Z" });
    expect(after.quantity).toBe("0");
    expect(after.quantityKnown).toBeUndefined();
  });
  it("does not certify a monthly first sale with no initial inventory or short-opening evidence", () => {
    const sale = fill("sell", "2025-01-03T14:30:00Z", "2", "10", "0");
    sale.source.templateId = "monthly";
    expect(replayPositionAtPrice({ executions: [sale], markPrice: "9" }).accuracy?.reasons).toContain("ambiguous-opening");
    sale.source.positionEffect = "open-short";
    expect(replayPositionAtPrice({ executions: [sale], markPrice: "9" }).accuracy).toBeUndefined();
  });
  it("marks unknown fees unavailable even when quantity and entry price are known", () => {
    const buy = fill("buy", "2025-01-03T14:30:00Z", "2", "10", "0");
    buy.source.feeStatus = "unknown";
    expect(replayPositionAtPrice({ executions: [buy], markPrice: "11" })).toMatchObject({ accuracy: { pnl: "unavailable", reasons: ["unknown-fees"] }, netPnl: "0" });
  });
  it("uses initial inventory and returns unavailable accuracy rather than false zero-cost profit", () => {
    const sale = fill("sell", "2025-01-03T14:30:00Z", "40", "12", "1");
    sale.source.openingPosition = { accountId: "account-1", market: "US", symbol: "TEST", phase: "opening", date: "2025-01-01", quantity: "100", source: [] };
    expect(replayPositionAtPrice({ executions: [sale], markPrice: "11" })).toMatchObject({ quantity: "60", costKnown: false, accuracy: { pnl: "unavailable", reasons: expect.arrayContaining(["unknown-cost"]) }, realizedPnl: "0", netPnl: "0" });
  });

  it("deduplicates source transfers and reconciles later opening snapshots", () => {
    const first = fill("sell", "2025-01-03T14:30:00Z", "1", "12", "0");
    const second = fill("sell", "2025-02-03T14:30:00Z", "1", "12", "0");
    first.source.positionEvents = [{ id: "transfer", accountId: "account-1", market: "US", symbol: "TEST", kind: "transfer-in", date: "2025-01-02", quantity: "2", description: "transfer", source: [] }];
    second.source.positionEvents = first.source.positionEvents;
    second.source.openingPosition = { accountId: "account-1", market: "US", symbol: "TEST", phase: "opening", date: "2025-02-01", quantity: "1", source: [] };
    expect(replayPositionAtPrice({ executions: [first, second], markPrice: "11" })).toMatchObject({ quantity: "0", costKnown: false });
    second.source.openingPosition.quantity = "3";
    expect(replayPositionAtPrice({ executions: [first, second], markPrice: "11" })).toMatchObject({ quantity: "2", accuracy: { reasons: expect.arrayContaining(["position-gap"]) } });
  });

  it("flags date-only same-day transfers and excludes another account's evidence", () => {
    const sale = fill("sell", "2025-01-03T14:30:00Z", "2", "12", "0");
    sale.source.positionEvents = [{ id: "transfer", accountId: "account-1", market: "US", symbol: "TEST", kind: "transfer-in", date: "2025-01-03", quantity: "2", description: "transfer", source: [] }];
    expect(replayPositionAtPrice({ executions: [sale], markPrice: "11" }).accuracy?.reasons).toContain("ambiguous-event-order");
    sale.source.positionEvents[0].accountId = "other";
    expect(replayPositionAtPrice({ executions: [sale], markPrice: "11" })).toMatchObject({ quantity: "-2", averageCost: "12" });
    expect(replayPositionAtPrice({ executions: [sale], markPrice: "11" }).accuracy).toBeUndefined();
  });
  it("does not certify cost across missing months even if inventory matches", () => {
    const buy = fill("buy", "2025-01-03T14:30:00Z", "2", "10", "0");
    const sale = fill("sell", "2025-03-03T14:30:00Z", "2", "12", "0");
    buy.source.statementMonth = "2025-01";
    sale.source.openingPosition = { accountId: "account-1", market: "US", symbol: "TEST", phase: "opening", date: "2025-03-01", quantity: "2", source: [] };
    expect(replayPositionAtPrice({ executions: [buy, sale], markPrice: "11" }).accuracy?.reasons).toContain("position-gap");
  });
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
