import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";

import { buildTradeEpisodes } from "./episodes";
import { summarizeTradeEpisode } from "./episode-metrics";
import type { TradeExecution } from "./types";
import type { StatementEvent, StatementPosition } from "../import/monthly-statement";
import { applyMonthlyHistoryEvidence } from "../import/statement-evidence";

function execution(
  side: "buy" | "sell",
  executedAt: string,
  quantity: string,
  price: string,
): TradeExecution {
  return {
    id: `${side}-${executedAt}`,
    source: { platform: "demo", row: 1 },
    accountId: "acct-1",
    accountLabel: "演示账户",
    instrument: {
      id: "US:XPEV",
      symbol: "XPEV",
      name: "XPeng",
      market: "US",
      currency: "USD",
    },
    side,
    executedAt,
    quantity,
    price,
    fee: "0",
  };
}

function sumAllocatedFees(episodes: ReturnType<typeof buildTradeEpisodes>) {
  return episodes
    .flatMap((episode) => episode.executions)
    .reduce(
      (total, item) => total + Number(item.fee),
      0,
    );
}

describe("core review R1–R5", () => {
  const cashChain = (): StatementEvent[] => [
    { id: "allocation", date: "2025-06-19", quantity: "500", amount: "11265", displayTimePolicy: "session-open", description: "IPO allotment" },
    { id: "application", date: "2025-05-20", amount: "-68271.65", description: "IPO Application" },
    { id: "refund", date: "2025-06-19", amount: "56893.04", description: "IPO Refund" },
    { id: "fee", date: "2025-05-20", amount: "-100", kind: "fee", description: "IPO fee" },
  ].map(event => ({ accountId: "acct-1", market: "US", symbol: "XPEV", currency: "USD", kind: "ipo", source: [], ...event }) as StatementEvent);
  const sale = () => execution("sell", "2025-06-19T05:00:00Z", "500", "24");
  const run = (events: StatementEvent[], fills = [sale()]) => buildTradeEpisodes(fills, [{ accountId: "acct-1", events, positions: [] }]);

  it.each(["新股手续费", "新股認購手續費"])("B1 rejects unassigned %s propagated by monthly history", description => {
    const events = cashChain().map(event => event.id === "fee" ? { ...event, symbol: undefined, market: undefined, description } : event);
    const attached = applyMonthlyHistoryEvidence([sale()], [{ documentId: "chinese-fee", templateIds: [], accountId: "acct-1", month: "2025-06", positions: [], events, reviewRequired: false }]);
    expect(attached[0].source.positionEvents).toContainEqual(expect.objectContaining({ id: "fee", description, symbol: undefined, market: undefined }));
    expect(summarizeTradeEpisode(buildTradeEpisodes(attached)[0])).toMatchObject({ pnlAvailable: false, netPnl: null });
  });

  it.each(["month-only", "day-without-order"])("B2 limits future %s ambiguity to affected rounds", variant => {
    const events = cashChain().map(event => event.id === "allocation" ? { ...event, date: variant === "month-only" ? "2025-06" : event.date, displayTimePolicy: variant === "month-only" ? "session-open" as const : undefined } : event.id === "refund" && variant === "month-only" ? { ...event, date: "2025-06-01" } : event);
    const episodes = run(events, [execution("buy", "2025-01-10T05:00:00Z", "100", "10"), execution("sell", "2025-01-11T05:00:00Z", "100", "12"), sale()]);
    expect(episodes[0].accuracy).toBeUndefined();
    expect(summarizeTradeEpisode(episodes[0]).netPnl).toBe("200");
    expect(episodes.slice(1).length).toBeGreaterThan(0);
    for (const episode of episodes.slice(1)) {
      expect(episode.accuracy?.reasons).toContain("ambiguous-event-order");
      expect(summarizeTradeEpisode(episode).pnlAvailable).toBe(false);
    }
  });

  it.each(["refund", "fee"])("R1 binds late %s to the closed acquisition episode", id => {
    const chain = cashChain().map(event => event.id === id ? { ...event, date: "2025-07-01" } : event);
    const [episode] = run(chain);
    expect(episode.positionEvents).toEqual(expect.arrayContaining(chain));
    expect(summarizeTradeEpisode(episode)).toMatchObject({ netPnl: "521.39", fees: "100", grossExposure: "11378.61" });
  });
  it("R1 binds an application during a previous round to its IPO round", () => {
    const episodes = run(cashChain(), [execution("buy", "2025-05-10T05:00:00Z", "100", "10"), execution("sell", "2025-05-25T05:00:00Z", "100", "12"), sale()]);
    expect(summarizeTradeEpisode(episodes[0]).netPnl).toBe("200");
    expect(summarizeTradeEpisode(episodes[1]).netPnl).toBe("521.39");
    expect(episodes[0].positionEvents ?? []).toHaveLength(0);
  });
  it("R1 keeps late cash out of a reversed short round", () => {
    const chain = cashChain().map(event => event.id === "refund" ? { ...event, date: "2025-07-01" } : event);
    const sell = sale();
    sell.source.positionEvents = chain;
    const [long, short] = run(chain, [{ ...sell, quantity: "700" }]);
    expect(summarizeTradeEpisode(long).netPnl).toBe("521.39");
    expect(short.positionEvents ?? []).toHaveLength(0);
    expect(short.executions.flatMap(fill => fill.source.positionEvents ?? []).some(event => event.id === "refund")).toBe(false);
    expect(long.executions[0].source.positionEvents).toContainEqual(expect.objectContaining({ id: "refund", date: "2025-07-01" }));
  });
  it.each(["refund", "fee", "allocation"])("R1 fails closed when an otherwise trusted episode loses %s", missingId => {
    const [episode] = run(cashChain());
    episode.positionEvents = episode.positionEvents?.filter(event => event.id !== missingId);
    expect(summarizeTradeEpisode(episode)).toMatchObject({ pnlAvailable: false, netPnl: null });
  });
  it.each(["month-only", "day-without-order"])("R2 preserves known-cost %s ambiguity", variant => {
    const chain = cashChain().map(event => event.id === "allocation" ? { ...event, date: variant === "month-only" ? "2025-06" : event.date, displayTimePolicy: variant === "month-only" ? "session-open" as const : undefined } : event.id === "refund" && variant === "month-only" ? { ...event, date: "2025-06-01" } : event);
    const episodes = run(chain, [{ ...sale(), quantity: "200" }]);
    expect(episodes.every(episode => episode.accuracy?.reasons.includes("ambiguous-event-order"))).toBe(true);
    expect(episodes.every(episode => summarizeTradeEpisode(episode, "24").pnlAvailable === false)).toBe(true);
  });
  it("R3 excludes simulation from currency lookup regardless of input order", () => {
    const simulated = execution("buy", "2025-06-18T05:00:00Z", "2", "10");
    simulated.instrument = { ...simulated.instrument, currency: "HKD" };
    simulated.source.tradeNature = "simulation";
    simulated.source.simulationRunId = "sim";
    for (const fills of [[simulated, sale()], [sale(), simulated]]) {
      const live = run(cashChain(), fills).find(episode => episode.tradeNature !== "simulation")!;
      expect(summarizeTradeEpisode(live).netPnl).toBe("521.39");
    }
  });
  it("R3 refuses conflicting actual instrument currencies in either input order", () => {
    const conflict = { ...sale(), id: "currency-conflict", instrument: { ...sale().instrument, currency: "HKD" } };
    for (const fills of [[sale(), conflict], [conflict, sale()]]) {
      expect(run(cashChain(), fills).every(episode => summarizeTradeEpisode(episode).pnlAvailable === false)).toBe(true);
    }
  });
  it("R4 blocks a single allocation with an unscoped IPO fee", () => {
    const chain = cashChain().map(event => event.id === "fee" ? { ...event, symbol: undefined, market: undefined } : event);
    expect(summarizeTradeEpisode(run(chain)[0])).toMatchObject({ pnlAvailable: false, netPnl: null });
  });
  it.each(["US-only", "empty"])("R5 does not use %s documents as HK coverage", kind => {
    const buy = execution("buy", "2024-12-09T05:00:00Z", "10", "10");
    buy.instrument = { ...buy.instrument, market: "HK", symbol: "2050", currency: "HKD" };
    const sell = { ...buy, id: "hk-sale", side: "sell" as const, executedAt: "2025-02-09T05:00:00Z" };
    const position: StatementPosition = { accountId: "acct-1", market: "HK", symbol: "2050", phase: "opening", date: "2025-02-01", quantity: "10", source: [] };
    const [episode] = buildTradeEpisodes([buy, sell], [
      { accountId: "acct-1", month: "2025-02", events: [], positions: [position] },
      { accountId: "acct-1", month: "2025-01", events: [], positions: kind === "empty" ? [] : [{ ...position, market: "US", symbol: "AAPL", date: "2025-01-01", quantity: "0" }] },
    ]);
    expect(episode.warnings).toContainEqual({ code: "statement-coverage-gap", from: "2025-01", to: "2025-01" });
    expect(episode.accuracy).toBeUndefined();
  });
});

describe("buildTradeEpisodes", () => {
  it("orders an opening snapshot before a same-day date-only sale", () => {
    const sale = execution("sell", "2025-01-01", "100", "12");
    sale.source.openingPosition = { accountId: "acct-1", market: "US", symbol: "XPEV", phase: "opening", date: "2025-01-01", quantity: "100", source: [] };
    const episodes = buildTradeEpisodes([sale]);
    expect(episodes).toHaveLength(1);
    expect(episodes[0]).toMatchObject({ direction: "long", status: "closed", remainingQuantity: "0" });
  });
  it("treats a monthly first sell as provisional unless explicitly opening short", () => {
    const sale = execution("sell", "2025-01-09T14:30:00Z", "10", "12");
    sale.source.statementMonth = "2025-01";
    expect(buildTradeEpisodes([sale])[0].accuracy?.reasons).toContain("ambiguous-opening");
    sale.source.positionEffect = "open-short";
    expect(buildTradeEpisodes([sale])[0].accuracy).toBeUndefined();
    expect(buildTradeEpisodes([sale])[0].direction).toBe("short");
  });
  it("preserves incomplete-history accuracy when an execution reverses direction", () => {
    const buy = execution("buy", "2025-01-08T14:30:00Z", "10", "11");
    const sale = execution("sell", "2025-01-09T14:30:00Z", "20", "12");
    sale.source.historyIncomplete = ["statement"];
    expect(buildTradeEpisodes([buy, sale]).every(e => e.accuracy?.reasons.includes("history-incomplete"))).toBe(true);
  });
  it("closes documented initial inventory without inventing a buy", () => {
    const sale = execution("sell", "2025-01-09T14:30:00Z", "100", "12");
    sale.source.openingPosition = { accountId: "acct-1", market: "US", symbol: "XPEV", phase: "opening", date: "2025-01-01", quantity: "100", source: [] };
    const [episode] = buildTradeEpisodes([sale]);
    expect(episode).toMatchObject({ direction: "long", status: "closed", remainingQuantity: "0", accuracy: { pnl: "unavailable" } });
    expect(episode.executions).toHaveLength(1);
    expect(episode.executions[0]).toMatchObject(sale);
  });

  it("applies a transfer once before sales and flags same-day uncertainty", () => {
    const sale = execution("sell", "2025-01-09T14:30:00Z", "2", "12");
    sale.source.positionEvents = [{ id: "transfer", accountId: "acct-1", market: "US", symbol: "XPEV", date: "2025-01-08", kind: "transfer-in", quantity: "2", description: "transfer", source: [] }];
    expect(buildTradeEpisodes([sale])[0]).toMatchObject({ direction: "long", status: "closed" });
    sale.source.positionEvents[0].date = "2025-01-09";
    expect(buildTradeEpisodes([sale])[0].accuracy?.reasons).toContain("ambiguous-event-order");
    expect(buildTradeEpisodes([sale])[0]).toMatchObject({ directionKnown: false, remainingQuantity: "0", status: "closed" });
  });

  it("attaches an IPO allotment event that predates the first execution to the episode", () => {
    const buy = execution("buy", "2025-01-20T14:30:00Z", "100", "10");
    buy.source.positionEvents = [{ id: "ipo", accountId: "acct-1", market: "US", symbol: "XPEV", date: "2025-01-10", kind: "ipo", quantity: "100", description: "IPO allotment", displayTimePolicy: "session-open", source: [] }];
    const [episode] = buildTradeEpisodes([buy]);
    expect(episode.positionEvents).toContainEqual(expect.objectContaining({ id: "ipo", kind: "ipo", displayTimePolicy: "session-open" }));
    expect(episode.executions[0].source.positionEvents).toContainEqual(expect.objectContaining({ id: "ipo", kind: "ipo" }));
  });

  it("opens a long episode from a dated IPO allotment before its first sale", () => {
    const sale = execution("sell", "2025-06-24T05:20:12.000Z", "500", "24");
    sale.source.statementMonth = "2025-06";
    sale.source.positionEvents = [{
      id: "ipo-allotment",
      accountId: "acct-1",
      market: "US",
      symbol: "XPEV",
      date: "2025-06-19",
      kind: "ipo",
      quantity: "500",
      amount: "11265",
      displayTimePolicy: "session-open",
      description: "IPO allotment",
      source: [],
    }];

    expect(buildTradeEpisodes([sale])[0]).toMatchObject({
      direction: "long",
      status: "closed",
      openingQuantity: "500",
      remainingQuantity: "0",
    });
    expect(buildTradeEpisodes([sale])[0].accuracy?.reasons).not.toContain(
      "ambiguous-opening",
    );
  });

  it("keeps month-only session-open IPO order ambiguity", () => {
    const sale = execution("sell", "2025-06-19T05:20:12.000Z", "500", "24");
    sale.source.statementMonth = "2025-06";
    sale.source.positionEvents = [{
      id: "month-only-ipo",
      accountId: "acct-1",
      market: "US",
      symbol: "XPEV",
      date: "2025-06",
      kind: "ipo",
      quantity: "500",
      amount: "11265",
      displayTimePolicy: "session-open",
      description: "IPO allotment",
      source: [],
    }];

    expect(buildTradeEpisodes([sale])[0].accuracy?.reasons).toContain("ambiguous-event-order");
  });

  it("uses uniquely attributable cross-month IPO cash evidence without blocking PnL", () => {
    const sale = execution("sell", "2025-06-19T05:20:12.000Z", "500", "24");
    sale.source.statementMonth = "2025-06";
    sale.source.positionEvents = [
      { id: "application", accountId: "acct-1", market: "US", symbol: "XPEV", date: "2025-05-20", kind: "ipo", amount: "-68271.65", currency: "USD", description: "Dr. IPO Application Amount - #XPEV", source: [] },
      { id: "fee", accountId: "acct-1", market: "US", symbol: "XPEV", date: "2025-05-20", kind: "fee", amount: "-100", currency: "USD", description: "Dr. IPO Application Handling Fee - #XPEV", source: [] },
      { id: "refund", accountId: "acct-1", market: "US", symbol: "XPEV", date: "2025-06-19", kind: "ipo", amount: "56893.04", currency: "USD", description: "Cr. IPO Refund Amount - #XPEV", source: [] },
      { id: "allocation", accountId: "acct-1", market: "US", symbol: "XPEV", date: "2025-06-19", kind: "ipo", quantity: "500", amount: "11265", currency: "USD", displayTimePolicy: "session-open", description: "IPO allotment", source: [] },
    ];

    const [episode] = buildTradeEpisodes([sale]);

    expect(episode).toMatchObject({ direction: "long", status: "closed", openingQuantity: "500", remainingQuantity: "0" });
    expect(episode.accuracy).toBeUndefined();
    expect(episode.positionEvents).toHaveLength(4);
    expect(summarizeTradeEpisode(episode)).toMatchObject({ netPnl: "521.39" });
    expect(summarizeTradeEpisode(episode)).not.toHaveProperty("pnlAvailable");
  });

  it("does not infer IPO cost from an unscoped fee or ambiguous same-symbol allocation", () => {
    const sale = execution("sell", "2025-06-19T05:20:12.000Z", "500", "24");
    sale.source.positionEvents = [
      { id: "allocation-a", accountId: "acct-1", market: "US", symbol: "XPEV", date: "2025-06-19", kind: "ipo", quantity: "500", amount: "11265", currency: "USD", displayTimePolicy: "session-open", description: "IPO allotment A", source: [] },
      { id: "allocation-b", accountId: "acct-1", market: "US", symbol: "XPEV", date: "2025-06-20", kind: "ipo", quantity: "100", amount: "2300", currency: "USD", displayTimePolicy: "session-open", description: "IPO allotment B", source: [] },
      { id: "application", accountId: "acct-1", market: "US", symbol: "XPEV", date: "2025-06-01", kind: "ipo", amount: "-10000", currency: "USD", description: "IPO Application Amount - #XPEV", source: [] },
      { id: "refund", accountId: "acct-1", market: "US", symbol: "XPEV", date: "2025-06-19", kind: "ipo", amount: "5000", currency: "USD", description: "IPO Refund Amount - #XPEV", source: [] },
      { id: "unscoped-fee", accountId: "acct-1", date: "2025-06-19", kind: "fee", amount: "-100", currency: "USD", description: "IPO Application Handling Fee", source: [] },
    ];

    const [episode] = buildTradeEpisodes([sale]);

    expect(episode.accuracy?.reasons).toEqual(expect.arrayContaining(["initial-position", "unknown-cost"]));
    expect(summarizeTradeEpisode(episode)).toMatchObject({ pnlAvailable: false, netPnl: null });
  });

  it("retains a zero-allotment result without contaminating a later ordinary episode", () => {
    const zeroAllotment = {
      id: "zero-ipo-result",
      accountId: "acct-1",
      market: "HK",
      symbol: "01024",
      date: "2021-02",
      kind: "ipo" as const,
      quantity: "0",
      amount: "0.00",
      currency: "HKD",
      description: "0 HKD 0.00 -100.00 7 -898.94",
      source: [],
    };
    const buy = execution("buy", "2022-01-03T01:00:00Z", "100", "10");
    buy.instrument = { ...buy.instrument, id: "HK:1024", market: "HK", symbol: "1024", currency: "HKD" };
    buy.source.positionEvents = [zeroAllotment];
    const sell = { ...buy, id: "ordinary-sale", side: "sell" as const, executedAt: "2022-01-04T01:00:00Z", source: { ...buy.source, positionEvents: [zeroAllotment] } };

    const [episode] = buildTradeEpisodes([buy, sell]);

    expect(episode).toMatchObject({ status: "closed", direction: "long", remainingQuantity: "0" });
    expect(episode.accuracy).toBeUndefined();
    expect(episode.positionEvents).toContainEqual(expect.objectContaining({ id: "zero-ipo-result", quantity: "0" }));
  });

  it("does not turn a negative IPO quantity into a positive inventory lot", () => {
    const cancelledAllotment = {
      id: "negative-ipo-result",
      accountId: "acct-1",
      market: "US",
      symbol: "XPEV",
      date: "2025-06-19",
      kind: "ipo" as const,
      quantity: "-100",
      amount: "0",
      currency: "USD",
      description: "IPO allotment cancelled",
      source: [],
    };
    const buy = execution("buy", "2025-06-20T01:00:00Z", "100", "10");
    buy.source.positionEvents = [cancelledAllotment];
    const sell = { ...buy, id: "ordinary-sale-after-negative-ipo", side: "sell" as const, executedAt: "2025-06-21T01:00:00Z", source: { ...buy.source, positionEvents: [cancelledAllotment] } };

    const [episode] = buildTradeEpisodes([buy, sell]);

    expect(episode).toMatchObject({ status: "closed", remainingQuantity: "0" });
    expect(episode.accuracy?.reasons).toContain("position-event");
    expect(episode.positionEvents).toContainEqual(expect.objectContaining({ id: "negative-ipo-result", quantity: "-100" }));
  });

  it("keeps an IPO allotment evidence row from duplicating its matching buy fill", () => {
    const buy = execution("buy", "2025-06-10T01:00:00.000Z", "100", "10");
    const sale = execution("sell", "2025-06-12T01:00:00.000Z", "100", "12");
    const allotment = {
      id: "ipo-allotment",
      accountId: "acct-1",
      market: "US" as const,
      symbol: "XPEV",
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

    expect(buildTradeEpisodes([buy, sale])).toMatchObject([
      { status: "closed", openingQuantity: "100", remainingQuantity: "0" },
    ]);
  });

  it("reconciles repeated monthly snapshots without adding inventory twice", () => {
    const first = execution("sell", "2025-01-09T14:30:00Z", "40", "12");
    const second = execution("sell", "2025-02-09T14:30:00Z", "60", "12");
    first.source.openingPosition = { accountId: "acct-1", market: "US", symbol: "XPEV", phase: "opening", date: "2025-01-01", quantity: "100", source: [] };
    second.source.openingPosition = { ...first.source.openingPosition, date: "2025-02-01", quantity: "60" };
    const episodes = buildTradeEpisodes([first, second, { ...second, id: "zero", quantity: "0" }]);
    expect(episodes).toHaveLength(1);
    expect(episodes[0]).toMatchObject({ direction: "long", status: "closed", openingQuantity: "100" });
    second.source.openingPosition.quantity = "90";
    expect(buildTradeEpisodes([first, second])[0].accuracy?.reasons).toContain("position-gap");
  });

  it("keeps genuinely short initial inventory short", () => {
    const cover = execution("buy", "2025-01-09T14:30:00Z", "10", "12");
    cover.source.openingPosition = { accountId: "acct-1", market: "US", symbol: "XPEV", phase: "opening", date: "2025-01-01", quantity: "-10", source: [] };
    expect(buildTradeEpisodes([cover])[0]).toMatchObject({ direction: "short", status: "closed" });
  });
  it("reports a missing statement month as coverage when the later quantity reconciles", () => {
    const buy = execution("buy", "2025-01-09T14:30:00Z", "10", "12");
    const sale = execution("sell", "2025-03-09T14:30:00Z", "10", "13");
    buy.source.statementMonth = "2025-01";
    sale.source.openingPosition = { accountId: "acct-1", market: "US", symbol: "XPEV", phase: "opening", date: "2025-03-01", quantity: "10", source: [] };
    const [episode] = buildTradeEpisodes([buy, sale]);
    expect(episode.accuracy).toBeUndefined();
    expect(episode.positionEvents).toBeUndefined();
    expect(episode.warnings).toEqual([{ code: "statement-coverage-gap", from: "2025-02", to: "2025-02" }]);
    expect(summarizeTradeEpisode(episode).netPnl).toBe("10");
  });
  it("groups partial buys and sells until the position returns to zero", () => {
    const episodes = buildTradeEpisodes([
      execution("buy", "2025-01-02T14:30:00Z", "100", "10"),
      execution("buy", "2025-01-03T14:30:00Z", "50", "11"),
      execution("sell", "2025-01-08T14:30:00Z", "75", "12"),
      execution("sell", "2025-01-09T14:30:00Z", "75", "13"),
    ]);

    expect(episodes).toHaveLength(1);
    expect(episodes[0]).toMatchObject({
      status: "closed",
      openingQuantity: "150",
      remainingQuantity: "0",
      startedAt: "2025-01-02T14:30:00Z",
      endedAt: "2025-01-09T14:30:00Z",
    });
    expect(episodes[0].executions).toHaveLength(4);
  });

  it("keeps live and simulated positions in separate episodes", () => {
    const liveEntry = execution(
      "buy",
      "2025-01-02T14:30:00Z",
      "100",
      "10",
    );
    liveEntry.source = {
      ...liveEntry.source,
      tradeNature: "live",
    };
    const liveExit = execution(
      "sell",
      "2025-01-03T14:30:00Z",
      "100",
      "11",
    );
    liveExit.source = {
      ...liveExit.source,
      tradeNature: "live",
    };
    const simulatedEntry = {
      ...execution("buy", "2025-01-02T14:30:00Z", "100", "10"),
      id: "simulation-entry",
      source: {
        platform: "tradingview",
        row: 2,
        tradeNature: "simulation" as const,
        simulationRunId: "tradingview:run-a",
      },
    };
    const simulatedExit = {
      ...execution("sell", "2025-01-03T14:30:00Z", "100", "11"),
      id: "simulation-exit",
      source: {
        platform: "tradingview",
        row: 3,
        tradeNature: "simulation" as const,
        simulationRunId: "tradingview:run-a",
      },
    };

    const episodes = buildTradeEpisodes([
      liveEntry,
      liveExit,
      simulatedEntry,
      simulatedExit,
    ]);

    expect(episodes).toHaveLength(2);
    expect(episodes.map((episode) => episode.tradeNature)).toEqual([
      "live",
      "simulation",
    ]);
    expect(episodes.map((episode) => episode.simulationRunId)).toEqual([
      undefined,
      "tradingview:run-a",
    ]);
  });

  it("closes a long and opens a short when one sell crosses through zero", () => {
    const episodes = buildTradeEpisodes([
      execution("buy", "2025-01-02T14:30:00Z", "100", "10"),
      execution("sell", "2025-01-03T14:30:00Z", "150", "9"),
    ]);

    expect(episodes).toHaveLength(2);
    expect(episodes[0]).toMatchObject({
      direction: "long",
      status: "closed",
      remainingQuantity: "0",
    });
    expect(episodes[0].executions.at(-1)?.quantity).toBe("100");
    expect(episodes[1]).toMatchObject({
      direction: "short",
      status: "open",
      openingQuantity: "50",
      remainingQuantity: "50",
    });
    expect(episodes[1].executions[0].quantity).toBe("50");
  });

  it("uses source fingerprint, row, and id to stabilize equal-time executions", () => {
    const timestamp = "2025-01-02T14:30:00Z";
    const later = execution("buy", timestamp, "20", "11");
    later.id = "fill-z";
    later.source = {
      platform: "futu",
      fileFingerprint: "file-b",
      row: 1,
    };
    const first = execution("buy", timestamp, "10", "10");
    first.id = "fill-b";
    first.source = {
      platform: "futu",
      fileFingerprint: "file-a",
      row: 2,
    };
    const second = execution("buy", timestamp, "30", "12");
    second.id = "fill-a";
    second.source = {
      platform: "futu",
      fileFingerprint: "file-a",
      row: 2,
    };

    const [episode] = buildTradeEpisodes([later, first, second]);

    expect(episode.executions.map((item) => item.id)).toEqual([
      "fill-a",
      "fill-b",
      "fill-z",
    ]);
  });

  it("orders source rows before sheet names at the same timestamp", () => {
    const timestamp = "2025-01-02T14:30:00Z";
    const rowTwo = execution("buy", timestamp, "10", "10");
    rowTwo.id = "row-two";
    rowTwo.source = {
      platform: "futu",
      fileFingerprint: "same-file",
      sheet: "A",
      row: 2,
    };
    const rowOne = execution("buy", timestamp, "20", "10");
    rowOne.id = "row-one";
    rowOne.source = {
      platform: "futu",
      fileFingerprint: "same-file",
      sheet: "Z",
      row: 1,
    };

    const [episode] = buildTradeEpisodes([rowTwo, rowOne]);

    expect(episode.executions.map((item) => item.id)).toEqual([
      "row-one",
      "row-two",
    ]);
  });

  it("pairs canonical symbol aliases inside one account episode", () => {
    const buy = execution(
      "buy",
      "2025-01-02T14:30:00Z",
      "100",
      "300",
    );
    buy.instrument = {
      ...buy.instrument,
      id: "HK:0700",
      symbol: "0700",
      market: "HK",
    };
    const sell = execution(
      "sell",
      "2025-01-03T14:30:00Z",
      "100",
      "320",
    );
    sell.instrument = {
      ...sell.instrument,
      id: "HK:700",
      symbol: "700",
      market: "HK",
    };

    const episodes = buildTradeEpisodes([buy, sell]);

    expect(episodes).toHaveLength(1);
    expect(episodes[0]).toMatchObject({
      status: "closed",
      remainingQuantity: "0",
    });
  });

  it("keeps episode IDs unique across same-time reversals", () => {
    const timestamp = "2025-01-02T14:30:00Z";
    const first = execution("buy", timestamp, "100", "10");
    first.id = "a-long";
    const reverseShort = execution("sell", timestamp, "200", "10");
    reverseShort.id = "b-short";
    const reverseLong = execution("buy", timestamp, "200", "10");
    reverseLong.id = "c-long";

    const episodes = buildTradeEpisodes([
      first,
      reverseShort,
      reverseLong,
    ]);

    expect(new Set(episodes.map((episode) => episode.id)).size).toBe(
      episodes.length,
    );
  });

  it("keeps an episode ID stable when an overlapping export replaces source identity", () => {
    const original = execution(
      "buy",
      "2025-01-02T14:30:00Z",
      "100",
      "10",
    );
    original.id = "export-a-row-2";
    original.source = {
      platform: "futu",
      fileFingerprint: "export-a",
      row: 2,
    };
    const replacement = {
      ...original,
      id: "export-b-row-9",
      source: {
        platform: "futu",
        fileFingerprint: "export-b",
        row: 9,
      },
    };

    expect(buildTradeEpisodes([original])[0].id).toBe(
      buildTradeEpisodes([replacement])[0].id,
    );
  });

  it("preserves the original fee exactly when a reversal fill is allocated", () => {
    const buy = execution(
      "buy",
      "2025-01-02T14:30:00Z",
      "1",
      "10",
    );
    const reverse = execution(
      "sell",
      "2025-01-03T14:30:00Z",
      "2",
      "10",
    );
    reverse.fee = "0.00000001";

    const episodes = buildTradeEpisodes([buy, reverse]);

    expect(sumAllocatedFees(episodes)).toBe(0.00000001);
  });

  it("keeps sub-cent reversal fee parts non-negative and Decimal-exact", () => {
    const buy = execution(
      "buy",
      "2025-01-02T14:30:00Z",
      "9",
      "10",
    );
    const reverse = execution(
      "sell",
      "2025-01-03T14:30:00Z",
      "10",
      "10",
    );
    reverse.fee = "0.000000009";

    const episodes = buildTradeEpisodes([buy, reverse]);
    const allocated = episodes.flatMap((episode) =>
      episode.executions
        .filter((item) => item.id.startsWith(reverse.id))
        .map((item) => new Decimal(item.fee)),
    );

    expect(
      allocated.every((fee) => fee.isPositive() || fee.isZero()),
    ).toBe(true);
    expect(
      allocated.reduce((total, fee) => total.plus(fee), new Decimal(0))
        .equals(reverse.fee),
    ).toBe(true);
  });
});


describe("statement evidence with simulation scopes", () => {
  it("keeps broker opening inventory out of a simulation with the same account and symbol", () => {
    const live = execution("sell", "2025-01-03T14:30:00Z", "100", "12");
    live.source.tradeNature = "live";
    const simulated = { ...live, id: "simulation-sale", source: { ...live.source, tradeNature: "simulation" as const, simulationRunId: "run-a" } };
    const episodes = buildTradeEpisodes([simulated, live], [{ accountId: live.accountId, month: "2025-01", events: [], positions: [{ accountId: live.accountId, market: live.instrument.market, symbol: live.instrument.symbol, phase: "opening", date: "2025-01-01", quantity: "100", source: [] }] }]);
    const actualEpisode = episodes.find(episode => episode.tradeNature === "live")!;
    const simulationEpisode = episodes.find(episode => episode.tradeNature === "simulation")!;
    expect(actualEpisode).toMatchObject({ direction: "long", status: "closed", accuracy: { pnl: "unavailable" } });
    expect(simulationEpisode).toMatchObject({ direction: "short", status: "open", remainingQuantity: "100" });
    expect(simulationEpisode.accuracy).toBeUndefined();
    expect(simulationEpisode.executions[0].source.statementPositions).toBeUndefined();
  });

  it("normalizes legacy simulated evidence into the same scope as the new simulation API", () => {
    const entry = execution("buy", "2025-01-02T14:30:00Z", "1", "10");
    entry.source = { ...entry.source, tradingNature: "simulated", simulationRunId: "same-run" };
    const exit = execution("sell", "2025-01-03T14:30:00Z", "1", "12");
    exit.source = { ...exit.source, tradeNature: "simulation", simulationRunId: "same-run" };
    expect(buildTradeEpisodes([entry, exit])).toMatchObject([{ tradeNature: "simulation", status: "closed", remainingQuantity: "0" }]);
  });
});


it("preserves saved legacy simulation episode IDs and their review association", () => {
  const entry = execution("buy", "2025-01-02T07:00:00.000Z", "1", "10");
  entry.source = { ...entry.source, platform: "tradingview", tradingNature: "simulated", simulationRunId: "legacy-run", simulationRole: "entry" };
  const savedId = `episode:${encodeURIComponent(JSON.stringify(["simulation:legacy-run:acct-1:US:XPEV", "2025-01-02T07:00:00.000Z", "buy", "1", "10"]))}:1`;
  const savedReviews = { [savedId]: { note: "Existing review" } };
  const [episode] = buildTradeEpisodes([entry]);
  expect(episode.id).toBe(savedId);
  expect(savedReviews[episode.id]).toEqual({ note: "Existing review" });
  const modernEntry = { ...entry, source: { platform: "tradingview", row: 1, tradeNature: "simulation" as const, simulationRunId: "legacy-run" } };
  expect(buildTradeEpisodes([modernEntry])[0].id).not.toBe(savedId);
});
