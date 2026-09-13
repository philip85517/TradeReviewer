import { describe, expect, it } from "vitest";

import type { TradeExecution } from "../trades/types";
import type { StatementEvent, StatementPosition } from "../import/monthly-statement";
import { replayPositionAtPrice } from "./position-ledger";

const fixtureInstrument = { id: "HK:fixture-02050", symbol: "02050", name: "Fixture IPO", market: "HK", currency: "HKD" };

function fixtureEvent(
  event: Pick<StatementEvent, "id" | "date" | "kind" | "description"> & Partial<StatementEvent>,
): StatementEvent {
  const {
    documentId,
    accountId,
    market,
    symbol,
    date,
    kind,
    quantity,
    amount,
    currency,
    description,
    source,
    displayTimePolicy,
  } = event;
  return {
    documentId: documentId ?? "fixture-document",
    id: event.id,
    accountId: accountId ?? "fixture-account",
    market: market ?? fixtureInstrument.market,
    symbol: symbol ?? fixtureInstrument.symbol,
    date,
    kind,
    quantity,
    amount,
    currency: currency ?? fixtureInstrument.currency,
    displayTimePolicy,
    description,
    source: source ?? [{ page: 1, row: 1, role: "fixture" }],
  };
}

function fill(
  side: TradeExecution["side"],
  executedAt: string,
  quantity: string,
  price: string,
  fee: string,
  options: Partial<Pick<TradeExecution, "accountId" | "instrument">> = {},
): TradeExecution {
  return {
    id: `${side}-${executedAt}-${quantity}`,
    source: { platform: "test", row: 1 },
    accountId: options.accountId ?? "fixture-account",
    accountLabel: "Test account",
    instrument: options.instrument ?? { id: "US:fixture-test", symbol: "TEST", name: "Test", market: "US", currency: "USD" },
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
    sale.source.positionEvents = [{ id: "in", accountId: "fixture-account", market: "US", symbol: "TEST", date: "2025-01-03", kind: "transfer-in", quantity: "100", description: "transfer", source: [] }];
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
    sale.source.openingPosition = { accountId: "fixture-account", market: "US", symbol: "TEST", phase: "opening", date: "2025-01-01", quantity: "100", source: [] };
    expect(replayPositionAtPrice({ executions: [sale], markPrice: "11" })).toMatchObject({ quantity: "60", costKnown: false, accuracy: { pnl: "unavailable", reasons: expect.arrayContaining(["unknown-cost"]) }, realizedPnl: "0", netPnl: "0" });
  });

  it("keeps a stock-only IPO allotment cost unknown without a cash trail", () => {
    const sale = fill("sell", "2025-06-24T05:20:12.000Z", "500", "24", "0");
    sale.source.positionEvents = [{
      id: "ipo-allotment",
      accountId: "fixture-account",
      market: "US",
      symbol: "TEST",
      date: "2025-06-19",
      kind: "ipo",
      quantity: "500",
      amount: "11265",
      displayTimePolicy: "session-open",
      description: "IPO allotment",
      source: [],
    }];

    expect(replayPositionAtPrice({ executions: [sale], markPrice: "24" })).toMatchObject({
      quantity: "0",
      costKnown: false,
      accuracy: { reasons: expect.arrayContaining(["position-event", "initial-position", "unknown-cost"]) },
      realizedPnl: "0",
      netPnl: "0",
      grossCapitalDeployed: "0",
    });
  });

  it("uses only cursor-visible IPO cash evidence and separates cash cost from fees", () => {
    const events = [
      fixtureEvent({ id: "ipo-application", date: "2025-06-18", kind: "ipo", amount: "-68271.65", description: "2025/06/18 減少 港股IPO公開發售 HKD -68,271.65 Dr. - IPO Application Amount - #02050" }),
      fixtureEvent({ id: "ipo-fee", date: "2025-06-18", kind: "fee", amount: "-100", description: "IPO Application Handling Fee - #02050" }),
      fixtureEvent({ id: "ipo-refund", date: "2025-06-19", kind: "ipo", amount: "56893.04", description: "2025/06/19 增加 港股IPO公開發售 HKD 56,893.04 Cr. - IPO Refund - #02050" }),
      fixtureEvent({ id: "ipo-allotment", date: "2025-06-19", kind: "ipo", quantity: "500", amount: "11265", displayTimePolicy: "session-open", description: "IPO allotment - #02050" }),
    ];
    const sale = fill("sell", "2025-06-24T05:20:12.000Z", "500", "24", "3", {
      instrument: fixtureInstrument,
    });
    const evidence = [{ accountId: sale.accountId, month: "2025-06", events, positions: [] }];

    const beforeRefund = replayPositionAtPrice({
      executions: [sale],
      evidence,
      cursor: "2025-06-19T12:00:00.000Z",
      markPrice: "24",
    });
    expect(beforeRefund).toMatchObject({ quantity: "500", costKnown: false, accuracy: { reasons: expect.arrayContaining(["position-event", "initial-position", "unknown-cost"]) } });

    expect(replayPositionAtPrice({ executions: [sale], evidence, markPrice: "24" })).toMatchObject({
      quantity: "0",
      averageCost: "0",
      realizedPnl: "621.39",
      netPnl: "518.39",
      fees: "103",
      grossCapitalDeployed: "11378.61",
    });
  });
  it("does not let conflicting live currencies certify IPO cost by input order", () => {
    const allocation: StatementEvent = {
      documentId: "fixture-document",
      id: "currency-conflict-allocation",
      accountId: "fixture-account",
      market: "HK",
      symbol: "02050",
      date: "2025-06-19",
      kind: "ipo",
      quantity: "50",
      amount: "1000",
      displayTimePolicy: "session-open",
      description: "IPO allotment - #02050",
      source: [],
    };
    const events = [
      fixtureEvent({ id: "currency-conflict-application", date: "2025-06-18", kind: "ipo", amount: "-1500", description: "IPO Application Amount - #02050" }),
      fixtureEvent({ id: "currency-conflict-refund", date: "2025-06-19", kind: "ipo", amount: "500", description: "IPO Refund Amount - #02050" }),
      fixtureEvent({ id: "currency-conflict-fee", date: "2025-06-18", kind: "fee", amount: "-10", currency: "USD", description: "IPO Application Handling Fee - #02050" }),
      allocation,
    ];
    const hkdSale = fill("sell", "2025-06-24T05:20:12.000Z", "50", "24", "0", { instrument: fixtureInstrument });
    const usdSale = fill("sell", "2025-06-25T05:20:12.000Z", "50", "24", "0", {
      instrument: { ...fixtureInstrument, id: "HK:fixture-02050-usd", currency: "USD" },
    });
    const evidence = [{ accountId: "fixture-account", month: "2025-06", events, positions: [] }];
    const replay = (executions: TradeExecution[]) => replayPositionAtPrice({ executions, evidence, markPrice: "24" });

    expect(replay([hkdSale, usdSale])).toMatchObject({ costKnown: false, realizedPnl: "0", netPnl: "0", accuracy: { reasons: expect.arrayContaining(["unknown-cost"]) } });
    expect(replay([usdSale, hkdSale])).toMatchObject({ costKnown: false, realizedPnl: "0", netPnl: "0", accuracy: { reasons: expect.arrayContaining(["unknown-cost"]) } });
  });

  it("does not add an IPO evidence row twice when the allotment is also a buy fill", () => {
    const buy = fill("buy", "2025-06-10T01:00:00.000Z", "100", "10", "0");
    const sale = fill("sell", "2025-06-12T01:00:00.000Z", "100", "12", "0");
    const allotment = {
      id: "ipo-allotment",
      accountId: "fixture-account",
      market: "US" as const,
      symbol: "TEST",
      date: "2025-06",
      kind: "ipo" as const,
      quantity: "100",
      amount: "1000",
      displayTimePolicy: "session-open" as const,
      description: "IPO allotment repeated in the asset table",
      source: [],
    };
    buy.source.grossAmount = "1000";
    buy.source.positionEvents = [allotment];
    sale.source.positionEvents = [allotment];

    expect(replayPositionAtPrice({ executions: [buy, sale], markPrice: "12" })).toMatchObject({
      quantity: "0",
      averageCost: "0",
      realizedPnl: "200",
      netPnl: "200",
    });
  });

  it("does not mark an exact-date session-open IPO as ambiguously ordered", () => {
    const sale = fill("sell", "2025-06-19T12:00:00.000Z", "100", "12", "0");
    sale.source.positionEvents = [{
      id: "dated-ipo",
      accountId: "fixture-account",
      market: "US",
      symbol: "TEST",
      date: "2025-06-19",
      kind: "ipo",
      quantity: "100",
      amount: "1000",
      displayTimePolicy: "session-open",
      description: "IPO allotment",
      source: [],
    }];

    expect(replayPositionAtPrice({ executions: [sale], markPrice: "12" }).accuracy?.reasons).toEqual(expect.arrayContaining(["position-event", "initial-position", "unknown-cost"]));
  });

  it("keeps month-only session-open IPO evidence ambiguous", () => {
    const sale = fill("sell", "2025-06-19T12:00:00.000Z", "100", "12", "0");
    sale.source.statementMonth = "2025-06";
    sale.source.positionEvents = [{
      id: "month-only-ipo",
      accountId: "fixture-account",
      market: "US",
      symbol: "TEST",
      date: "2025-06",
      kind: "ipo",
      quantity: "100",
      amount: "1000",
      displayTimePolicy: "session-open",
      description: "IPO allotment",
      source: [],
    }];

    expect(replayPositionAtPrice({ executions: [sale], markPrice: "12" }).accuracy?.reasons).toEqual(expect.arrayContaining(["ambiguous-event-order"]));
  });

  it("does not let a future matching buy hide an IPO allocation from an earlier cursor", () => {
    const allocation = fixtureEvent({ id: "future-cursor-ipo", date: "2025-06-19", kind: "ipo", quantity: "500", amount: "11265", displayTimePolicy: "session-open", description: "IPO allotment - #02050" });
    const futureBuy = fill("buy", "2025-06-19T12:00:00.000Z", "500", "22.53", "0", {
      accountId: allocation.accountId,
      instrument: fixtureInstrument,
    });
    futureBuy.source.positionEffect = "open-long";
    futureBuy.source.displayTimePolicy = "execution-time";
    futureBuy.source.grossAmount = "11265";
    const beforeBuy = replayPositionAtPrice({
      executions: [futureBuy],
      evidence: [{ accountId: allocation.accountId, month: "2025-06", events: [allocation], positions: [] }],
      cursor: "2025-06-19T10:00:00.000Z",
      markPrice: "22.53",
    });

    expect(beforeBuy.quantity).toBe("500");
  });

  it("does not let a zero-allotment fixture row contaminate a later ordinary round", () => {
    const zeroAllotment = fixtureEvent({
      id: "zero-ipo",
      date: "2021-02",
      kind: "ipo",
      quantity: "0",
      amount: "0.00",
      description: "IPO allotment: 0 shares - #01024",
      market: "HK",
      symbol: "01024",
    });
    const buy = fill("buy", "2022-01-03T01:00:00Z", "100", "10", "0", {
      accountId: zeroAllotment.accountId,
      instrument: { id: "HK:fixture-01024", symbol: "01024", name: "Fixture ordinary", market: "HK", currency: "HKD" },
    });
    const sell = fill("sell", "2022-01-04T01:00:00Z", "100", "12", "0", {
      accountId: zeroAllotment.accountId,
      instrument: { id: "HK:fixture-01024", symbol: "01024", name: "Fixture ordinary", market: "HK", currency: "HKD" },
    });

    expect(replayPositionAtPrice({ executions: [buy, sell], evidence: [{ accountId: zeroAllotment.accountId, month: "2021-02", events: [zeroAllotment], positions: [] }], markPrice: "12" })).toMatchObject({
      quantity: "0",
      realizedPnl: "200",
      netPnl: "200",
    });
  });

  it("does not turn a negative IPO quantity into a positive inventory lot", () => {
    const negativeAllotment: StatementEvent = {
      id: "negative-ipo",
      accountId: "fixture-account",
      market: "US",
      symbol: "TEST",
      date: "2025-06-19",
      kind: "ipo",
      quantity: "-100",
      amount: "0",
      currency: "USD",
      description: "IPO allotment cancelled",
      source: [],
    };
    const buy = fill("buy", "2025-06-20T01:00:00Z", "100", "10", "0");
    const sell = fill("sell", "2025-06-21T01:00:00Z", "100", "12", "0");

    expect(replayPositionAtPrice({ executions: [buy, sell], evidence: [{ accountId: "fixture-account", month: "2025-06", events: [negativeAllotment], positions: [] }], markPrice: "12" })).toMatchObject({
      quantity: "0",
      costKnown: false,
      accuracy: { reasons: expect.arrayContaining(["position-event"]) },
    });
  });

  it("deduplicates source transfers and reconciles later opening snapshots", () => {
    const first = fill("sell", "2025-01-03T14:30:00Z", "1", "12", "0");
    const second = fill("sell", "2025-02-03T14:30:00Z", "1", "12", "0");
    first.source.positionEvents = [{ id: "transfer", accountId: "fixture-account", market: "US", symbol: "TEST", kind: "transfer-in", date: "2025-01-02", quantity: "2", description: "transfer", source: [] }];
    second.source.positionEvents = first.source.positionEvents;
    second.source.openingPosition = { accountId: "fixture-account", market: "US", symbol: "TEST", phase: "opening", date: "2025-02-01", quantity: "1", source: [] };
    expect(replayPositionAtPrice({ executions: [first, second], markPrice: "11" })).toMatchObject({ quantity: "0", costKnown: false });
    second.source.openingPosition.quantity = "3";
    expect(replayPositionAtPrice({ executions: [first, second], markPrice: "11" })).toMatchObject({ quantity: "2", costKnown: false, accuracy: { reasons: expect.arrayContaining(["position-gap"]) } });
  });

  it("flags date-only same-day transfers and excludes another account's evidence", () => {
    const sale = fill("sell", "2025-01-03T14:30:00Z", "2", "12", "0");
    sale.source.positionEvents = [{ id: "transfer", accountId: "fixture-account", market: "US", symbol: "TEST", kind: "transfer-in", date: "2025-01-03", quantity: "2", description: "transfer", source: [] }];
    expect(replayPositionAtPrice({ executions: [sale], markPrice: "11" }).accuracy?.reasons).toContain("ambiguous-event-order");
    sale.source.positionEvents[0].accountId = "other";
    expect(replayPositionAtPrice({ executions: [sale], markPrice: "11" })).toMatchObject({ quantity: "-2", averageCost: "12" });
    expect(replayPositionAtPrice({ executions: [sale], markPrice: "11" }).accuracy).toBeUndefined();
  });
  it("reports a missing month as a warning when the inventory snapshot matches", () => {
    const buy = fill("buy", "2025-01-03T14:30:00Z", "2", "10", "0");
    const sale = fill("sell", "2025-03-03T14:30:00Z", "2", "12", "0");
    buy.source.statementMonth = "2025-01";
    sale.source.openingPosition = { accountId: "fixture-account", market: "US", symbol: "TEST", phase: "opening", date: "2025-03-01", quantity: "2", source: [] };
    expect(replayPositionAtPrice({ executions: [buy, sale], markPrice: "11" })).toMatchObject({
      quantity: "0",
      warnings: [{ code: "statement-coverage-gap", from: "2025-02", to: "2025-02" }],
    });
    expect(replayPositionAtPrice({ executions: [buy, sale], markPrice: "11" }).accuracy).toBeUndefined();
  });
  it("does not let a same-account US snapshot cover a missing HK month", () => {
    const buy = fill("buy", "2024-12-03T14:30:00Z", "2", "10", "0", { instrument: fixtureInstrument });
    buy.source.statementMonth = "2024-12";
    const hkOpening: StatementPosition = {
      documentId: "fixture-document",
      accountId: "fixture-account",
      market: "HK",
      symbol: "02050",
      phase: "opening",
      date: "2025-02-01",
      quantity: "2",
      source: [{ page: 2, row: 1, role: "position" }],
    };
    const usJanuary: StatementPosition = {
      documentId: "fixture-document",
      accountId: "fixture-account",
      market: "US",
      symbol: "FIXTURE-US",
      phase: "closing",
      date: "2025-01-31",
      quantity: "1",
      source: [{ page: 1, row: 1, role: "position" }],
    };

    expect(replayPositionAtPrice({
      executions: [buy],
      evidence: [
        { accountId: "fixture-account", month: "2025-01", events: [], positions: [usJanuary] },
        { accountId: "fixture-account", month: "2025-02", events: [], positions: [hkOpening] },
      ],
      markPrice: "10",
    })).toMatchObject({
      quantity: "2",
      warnings: [{ code: "statement-coverage-gap", from: "2025-01", to: "2025-01" }],
    });
  });
  it("does not treat an unknown-market event without a trade document as coverage", () => {
    const buy = fill("buy", "2024-12-03T14:30:00Z", "2", "10", "0", { instrument: fixtureInstrument });
    buy.source.statementMonth = "2024-12";
    const hkOpening: StatementPosition = {
      documentId: "fixture-document",
      accountId: "fixture-account",
      market: "HK",
      symbol: "02050",
      phase: "opening",
      date: "2025-02-01",
      quantity: "2",
      source: [{ page: 2, row: 1, role: "position" }],
    };
    const unknownMarketEvent: StatementEvent = {
      documentId: "fixture-document",
      id: "unknown-market-january",
      accountId: "fixture-account",
      date: "2025-01",
      kind: "other",
      amount: "0",
      description: "Monthly statement row with no trusted market",
      source: [{ page: 1, row: 1, role: "other" }],
    };

    expect(replayPositionAtPrice({
      executions: [buy],
      evidence: [
        { accountId: "fixture-account", month: "2025-01", events: [unknownMarketEvent], positions: [] },
        { accountId: "fixture-account", month: "2025-02", events: [], positions: [hkOpening] },
      ],
      markPrice: "10",
    })).toMatchObject({
      quantity: "2",
      warnings: [{ code: "statement-coverage-gap", from: "2025-01", to: "2025-01" }],
    });
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
