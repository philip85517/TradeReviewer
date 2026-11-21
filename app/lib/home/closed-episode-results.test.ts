import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";

import { buildTradeEpisodes } from "../trades/episodes";
import { summarizeTradeEpisode } from "../trades/episode-metrics";
import type { TradeEpisode, TradeExecution } from "../trades/types";
import { buildClosedEpisodeResults } from "./closed-episode-results";

function fill(id: string, side: "buy" | "sell", executedAt: string, quantity = "1", price = "10", fee = "0"): TradeExecution {
  return {
    id, side, executedAt, quantity, price, fee,
    accountId: "account-a", accountLabel: "Fixture account",
    instrument: { id: "US:FIX", symbol: "FIX", name: "Fixture", market: "US", currency: "USD" },
    source: { platform: "fixture", row: 1, tradeNature: "live", feeStatus: "reported" },
  };
}

function round(): TradeEpisode {
  return buildTradeEpisodes([
    fill("buy", "buy", "2025-12-30T14:30:00Z", "100", "10", "2"),
    fill("sell", "sell", "2025-12-31T14:30:00Z", "100", "12", "3"),
  ])[0];
}
const asOf = "2026-01-02T00:00:00Z";

describe("buildClosedEpisodeResults", () => {
  it("keeps two rounds of one security separate and preserves the source identity after net recalculation", () => {
    const executions = [
      fill("a-buy", "buy", "2025-01-01T10:00:00Z"),
      fill("a-sell", "sell", "2025-01-02T10:00:00Z", "1", "12", "1"),
      fill("b-buy", "buy", "2025-12-30T10:00:00Z"),
      fill("b-sell", "sell", "2025-12-31T10:00:00Z", "1", "9", "1"),
    ];
    const episodes = buildTradeEpisodes(executions);
    const result = buildClosedEpisodeResults(episodes, { asOf });
    expect(result.rows.map(row => row.id)).toEqual(episodes.map(episode => episode.id));
    expect(result.rows.map(row => row.net.value)).toEqual(["1", "-2"]);
    expect(result.coverage).toEqual({ input: 2, included: 2, excluded: 0, netKnown: 2, feesKnown: 2 });
    executions[1].fee = "0.5";
    const updated = buildClosedEpisodeResults(buildTradeEpisodes(executions), { asOf });
    expect(updated.rows[0].id).toBe(result.rows[0].id);
    expect(updated.rows[0].net.value).toBe("1.5");
  });

  it("returns trusted fee-adjusted metrics and complete provenance without mutating its input", () => {
    const episode = round();
    const before = JSON.stringify(episode);
    expect(summarizeTradeEpisode(episode).netPnl).toBe("195");
    const result = buildClosedEpisodeResults([episode], { asOf });
    expect(result.rows[0]).toMatchObject({
      id: episode.id, accountId: "account-a", instrument: { id: "US:FIX" },
      direction: "long", directionKnown: true, tradeNature: "live",
      startedAt: "2025-12-30T14:30:00Z", endedAt: "2025-12-31T14:30:00Z",
      businessDate: "2025-12-31", businessTimeZone: "Asia/Shanghai", currency: "USD",
      net: { value: "195", reasons: [] },
      fees: [{ currency: "USD", value: "5", knownValue: "5", reasons: [], coverage: { known: 2, total: 2 } }],
      executionIds: ["buy", "sell"], contributionCategory: null,
    });
    expect(JSON.stringify(episode)).toBe(before);
  });

  it("assigns a cross-year close to the configured business timezone", () => {
    const [episode] = buildTradeEpisodes([
      fill("b", "buy", "2025-12-30T14:30:00Z"),
      fill("s", "sell", "2025-12-31T16:30:00Z", "1", "11"),
    ]);
    expect(buildClosedEpisodeResults([episode], { asOf }).rows[0].businessDate).toBe("2026-01-01");
    expect(buildClosedEpisodeResults([episode], { asOf, businessTimeZone: "America/New_York" }).rows[0].businessDate).toBe("2025-12-31");
    expect(buildClosedEpisodeResults([episode], { asOf: "2025-12-31" }).excluded[0].reasons).toContain("future-close");
  });

  it("does not count a partial exit as a historical closed round", () => {
    const [episode] = buildTradeEpisodes([
      fill("b", "buy", "2025-12-30T14:30:00Z", "2"),
      fill("s", "sell", "2025-12-31T14:30:00Z", "1", "12"),
    ]);
    expect(summarizeTradeEpisode(episode).realizedPnl).toBe("2");
    expect(buildClosedEpisodeResults([episode], { asOf })).toMatchObject({ rows: [], excluded: [{ id: episode.id, reasons: ["open"] }] });
  });

  it("keeps a real zero distinct from unavailable net", () => {
    const [episode] = buildTradeEpisodes([
      fill("b", "buy", "2025-12-30T14:30:00Z", "1", "10", "1"),
      fill("s", "sell", "2025-12-31T14:30:00Z", "1", "12", "1"),
    ]);
    expect(buildClosedEpisodeResults([episode], { asOf }).rows[0].net).toEqual({ value: "0", reasons: [] });
  });

  it("does not turn unknown fees into gross profit or zero fees", () => {
    const episode = round();
    episode.executions[0].source.feeStatus = "unknown";
    const result = buildClosedEpisodeResults([episode], { asOf });
    expect(result.rows[0].net).toEqual({ value: null, reasons: ["unknown-fees"] });
    expect(result.rows[0].fees).toEqual([{ currency: "USD", value: null, knownValue: "3", reasons: ["unknown-fees"], coverage: { known: 1, total: 2 } }]);
    expect(result.coverage).toMatchObject({ included: 1, netKnown: 0, feesKnown: 0 });
  });

  it("keeps incomplete history unknown and preserves its reason", () => {
    const buy = fill("b", "buy", "2025-12-30T14:30:00Z");
    buy.source.historyIncomplete = ["missing-statement"];
    const [episode] = buildTradeEpisodes([buy, fill("s", "sell", "2025-12-31T14:30:00Z", "1", "12")]);
    const row = buildClosedEpisodeResults([episode], { asOf }).rows[0];
    expect(row.net.value).toBeNull();
    expect(row.net.reasons).toContain("history-incomplete");
    expect(row.fees[0].value).toBeNull();
    expect(row.fees[0].reasons).toContain("history-incomplete");
  });

  it("does not infer live trading from a broker name or unknown source", () => {
    const unknown = round();
    for (const execution of unknown.executions) {
      execution.source = { platform: "futu", row: 1 };
    }
    const simulated = round();
    for (const execution of simulated.executions) execution.source.tradeNature = "simulation";
    const result = buildClosedEpisodeResults([unknown, simulated], { asOf });
    expect(result.rows).toEqual([]);
    expect(result.excluded.map(row => row.reasons[0])).toEqual(["trade-nature-unknown", "simulation"]);
  });

  it("uses supported legacy source contracts to prove live nature without rewriting the episode ID", () => {
    const episode = round();
    episode.tradeNature = "unknown";
    for (const execution of episode.executions) execution.source = { platform: "futu", row: 1, fileFingerprint: "verified-fixture", formatRuleId: "futu/xlsx/trades-v1" };
    const result = buildClosedEpisodeResults([episode], { asOf });
    expect(result.rows[0]).toMatchObject({ id: episode.id, tradeNature: "live" });
    expect(episode.tradeNature).toBe("unknown");
  });

  it("does not accept contradictory source nature or a live aggregate over unknown members", () => {
    const episode = round();
    episode.executions[0].source.tradingNature = "simulated";
    expect(buildClosedEpisodeResults([episode], { asOf }).excluded[0].reasons).toContain("trade-nature-unknown");
  });

  it("preserves exact decimals beyond Number precision within the trusted metrics precision", () => {
    const [episode] = buildTradeEpisodes([
      fill("b", "buy", "2025-12-30T14:30:00Z", "1", "90071992547409.01", "0.00001"),
      fill("s", "sell", "2025-12-31T14:30:00Z", "1", "90071992547409.13", "0.00002"),
    ]);
    expect(buildClosedEpisodeResults([episode], { asOf }).rows[0]).toMatchObject({ net: { value: "0.11997" }, fees: [{ value: "0.00003" }] });
  });

  it("fails closed when the legacy metrics precision cannot certify the cash arithmetic", () => {
    const [episode] = buildTradeEpisodes([
      fill("b", "buy", "2025-12-30T14:30:00Z", "1", "100000000000000000000", "0.00000001"),
      fill("s", "sell", "2025-12-31T14:30:00Z", "1", "100000000000000000001", "0.00000002"),
    ]);
    expect(buildClosedEpisodeResults([episode], { asOf }).rows[0]).toMatchObject({ net: { value: null, reasons: ["metrics-precision-unsupported"] }, fees: [{ value: "3e-8" }] });
  });

  it.each(["price", "quantity"])("rejects a %s tail beyond the reference precision before arithmetic can erase it", field => {
    const precision = Decimal.precision;
    const remoteTail = `1.${"0".repeat(1000)}1`;
    const [episode] = buildTradeEpisodes([
      fill("b", "buy", "2025-12-30T14:30:00Z", field === "quantity" ? remoteTail : "1", field === "price" ? remoteTail : "1"),
      fill("s", "sell", "2025-12-31T14:30:00Z", field === "quantity" ? remoteTail : "1", field === "price" ? "1" : "2"),
    ]);
    expect(episode.executions[0][field === "price" ? "price" : "quantity"]).toBe(remoteTail);
    // Exact net is -1e-1001 for price, or 1+1e-1001 for quantity.
    // Both the legacy precision20 kernel and a precision1000 reference erase it.
    expect(summarizeTradeEpisode(episode).netPnl).toBe(field === "price" ? "0" : "1");
    const result = buildClosedEpisodeResults([episode], { asOf });
    if (field === "quantity") expect(result).toMatchObject({ rows: [], excluded: [{ reasons: ["closure-unconfirmed"] }] });
    else expect(result.rows[0]).toMatchObject({ net: { value: null, reasons: ["metrics-precision-unsupported"] }, fees: [{ value: "0" }] });
    expect(Decimal.precision).toBe(precision);
  });

  it("keeps exact sparse exponents when their multiplication and cash arithmetic fit the metrics budget", () => {
    const [episode] = buildTradeEpisodes([
      fill("b", "buy", "2025-12-30T14:30:00Z", "1e1001", "1e-1001"),
      fill("s", "sell", "2025-12-31T14:30:00Z", "1e1001", "2e-1001"),
    ]);
    expect(buildClosedEpisodeResults([episode], { asOf }).rows[0].net).toEqual({ value: "1", reasons: [] });
  });

  it.each(["NaN", "Infinity", "-Infinity", "not-a-decimal"])("never publishes trusted net from malformed price %s", price => {
    const episode = round();
    episode.executions[1].price = price;
    expect(buildClosedEpisodeResults([episode], { asOf }).rows[0].net).toMatchObject({ value: null, reasons: ["invalid-financial-input"] });
  });

  it.each(["NaN", "Infinity", "", "-1"])("keeps an invalid fee %s unknown", fee => {
    const episode = round();
    episode.executions[1].fee = fee;
    expect(buildClosedEpisodeResults([episode], { asOf }).rows[0].fees[0]).toMatchObject({ value: null, reasons: ["invalid-fees"] });
  });

  it("keeps settlement fees in their own currency even when net cannot be computed", () => {
    const episode = round();
    episode.instrument = { ...episode.instrument, currency: "HKD", market: "HK", id: "HK:FIX" };
    for (const execution of episode.executions) {
      execution.instrument = { ...episode.instrument };
      execution.source.settlement = { currency: "USD", quantity: "100", grossAmount: execution.side === "buy" ? "1000" : "1200", netAmount: execution.side === "buy" ? "-1002" : "1197", fees: { commission: execution.fee } };
    }
    const row = buildClosedEpisodeResults([episode], { asOf }).rows[0];
    expect(row.net).toEqual({ value: null, reasons: ["currency-conversion"] });
    expect(row.fees).toEqual([{ currency: "USD", value: "5", knownValue: "5", reasons: [], coverage: { known: 2, total: 2 } }]);
  });

  it("does not certify rounded quote arithmetic when the metrics kernel cannot consume a settlement currency alias", () => {
    const episode = round();
    episode.executions[0].source.settlement = { currency: "usd", quantity: "100", grossAmount: "1001", netAmount: "-1003", fees: { commission: "2" } };
    // The legacy kernel compares raw currency strings and would silently use
    // quote price 10 instead of settlement gross 1001 in this case.
    const row = buildClosedEpisodeResults([episode], { asOf }).rows[0];
    expect(row.net).toEqual({ value: null, reasons: ["settlement-currency-alias-unsupported"] });
    expect(row.fees[0]).toMatchObject({ currency: "USD", value: "5" });
  });

  it("does not sum fees across source currencies", () => {
    const episode = round();
    episode.executions[1].source.settlement = { currency: "HKD", quantity: "100", grossAmount: "1200", netAmount: "1197", fees: { commission: "3" } };
    expect(buildClosedEpisodeResults([episode], { asOf }).rows[0].fees).toEqual([
      { currency: "HKD", value: "3", knownValue: "3", reasons: [], coverage: { known: 1, total: 1 } },
      { currency: "USD", value: "2", knownValue: "2", reasons: [], coverage: { known: 1, total: 1 } },
    ]);
  });

  it("does not trust a settlement whose component fees disagree with its reported fee", () => {
    const episode = round();
    episode.executions[0].source.settlement = { currency: "USD", quantity: "100", grossAmount: "1000", netAmount: "-1002", fees: { commission: "1" } };
    const row = buildClosedEpisodeResults([episode], { asOf }).rows[0];
    expect(row.net.value).toBeNull();
    expect(row.fees[0]).toMatchObject({ value: null, reasons: ["invalid-settlement"] });
  });

  it("keeps independently checkable fees when a legacy settlement omits its optional net amount", () => {
    const episode = round();
    episode.executions[0].source.settlement = { currency: "USD", quantity: "100", grossAmount: "1000", netAmount: "-1002", fees: { commission: "2" } };
    Reflect.deleteProperty(episode.executions[0].source.settlement, "netAmount");
    const row = buildClosedEpisodeResults([episode], { asOf }).rows[0];
    expect(row.net.value).toBe("195");
    expect(row.fees[0]).toMatchObject({ value: "5", reasons: [] });
  });

  it.each(["2025-02-30T14:30:00Z", "2025-12-31T14:30:00", "not-a-date"])("excludes an invalid or timezone-free close %s", endedAt => {
    const episode = round();
    episode.endedAt = endedAt;
    episode.executions[1].executedAt = endedAt;
    const result = buildClosedEpisodeResults([episode], { asOf });
    expect(result.rows).toEqual([]);
    expect(result.excluded[0].reasons).toContain("invalid-time");
  });

  it("does not publish a later intraday close merely because its business day matches", () => {
    const episode = round();
    const result = buildClosedEpisodeResults([episode], { asOf: "2025-12-31T14:00:00Z" });
    expect(result.excluded[0].reasons).toContain("future-close");
  });

  it("uses the existing market-day boundary for a dated-only US close without inventing intraday precision", () => {
    const buy = fill("b", "buy", "2025-12-30", "1");
    const sell = fill("s", "sell", "2025-12-31", "1", "12");
    for (const execution of [buy, sell]) execution.source.timePrecision = "date-only";
    const [episode] = buildTradeEpisodes([buy, sell]);
    const result = buildClosedEpisodeResults([episode], { asOf });
    expect(result.rows[0]).toMatchObject({ businessDate: "2026-01-01", endedAt: "2025-12-31", closeTimePrecision: "date-only" });
  });

  it.each(["CN-SH", "CN-SZ"])("admits a date-only %s round at the Shanghai knowledge boundary", market => {
    const buy = fill("b", "buy", "2025-12-30");
    const sell = fill("s", "sell", "2025-12-31", "1", "12");
    for (const execution of [buy, sell]) {
      execution.instrument = { ...execution.instrument, id: `${market}:FIX`, market, currency: "CNY" };
      execution.source.timePrecision = "date-only";
    }
    const [episode] = buildTradeEpisodes([buy, sell]);
    expect(episode.status).toBe("closed");
    expect(summarizeTradeEpisode(episode).netPnl).toBe("2");
    expect(buildClosedEpisodeResults([episode], { asOf: "2025-12-31" })).toMatchObject({
      rows: [{ businessDate: "2025-12-31", closeKnownAt: "2025-12-31T15:59:59.999Z", closeTimePrecision: "date-only", net: { value: "2", reasons: [] } }],
      excluded: [],
    });
  });

  it.each(["CN-SH", "CN-SZ", "UNKNOWN"])("validates builder-attached %s evidence with its known market boundary", market => {
    const buy = fill("b", "buy", "2025-12-29T14:30:00Z");
    const sell = fill("s", "sell", "2025-12-31T14:30:00Z", "1", "12");
    for (const execution of [buy, sell]) execution.instrument = { ...execution.instrument, id: `${market}:FIX`, market, currency: "CNY" };
    buy.source.positionEvents = [{ id: "failed-allocation", accountId: "account-a", market, symbol: "FIX", date: "2025-12-30", kind: "ipo", quantity: "0", amount: "0", currency: "CNY", description: "No allotment", source: [] }];
    const [episode] = buildTradeEpisodes([buy, sell]);
    expect(episode.positionEvents?.map(event => event.id)).toContain("failed-allocation");
    expect(summarizeTradeEpisode(episode).netPnl).toBe("2");
    expect(buildClosedEpisodeResults([episode], { asOf }).rows[0].net).toEqual(market === "UNKNOWN"
      ? { value: null, reasons: ["invalid-evidence-date"] }
      : { value: "2", reasons: [] });
  });

  it("still excludes a date-only close with an unknown market timezone", () => {
    const buy = fill("b", "buy", "2025-12-30");
    const sell = fill("s", "sell", "2025-12-31", "1", "12");
    for (const execution of [buy, sell]) {
      execution.instrument = { ...execution.instrument, market: "UNKNOWN" };
      execution.source.timePrecision = "date-only";
    }
    const [episode] = buildTradeEpisodes([buy, sell]);
    expect(buildClosedEpisodeResults([episode], { asOf })).toMatchObject({ rows: [], excluded: [{ reasons: ["invalid-time"] }] });
  });

  it("does not use a UTC placeholder date as a source calendar date for date-only fills", () => {
    const episode = round();
    episode.executions[1].source.timePrecision = "date-only";
    expect(buildClosedEpisodeResults([episode], { asOf }).excluded[0].reasons).toContain("invalid-time");
  });

  it("accepts a source-ordered round that opens and closes at the same exact instant", () => {
    const buy = fill("b", "buy", "2025-12-31T14:30:00Z", "1", "10");
    const sell = fill("s", "sell", "2025-12-31T14:30:00Z", "1", "12");
    sell.source.row = 2;
    const [episode] = buildTradeEpisodes([buy, sell]);
    expect(summarizeTradeEpisode(episode).netPnl).toBe("2");
    expect(buildClosedEpisodeResults([episode], { asOf }).rows[0].net.value).toBe("2");
  });

  it("retains actual round identity but withholds financial results backed by invalid evidence dates", () => {
    const episode = round();
    episode.positionEvents = [{ id: "bad-date", accountId: "account-a", market: "US", symbol: "FIX", date: "2025-02-30", kind: "ipo", amount: "0", currency: "USD", description: "Invalid dated evidence", source: [] }];
    expect(buildClosedEpisodeResults([episode], { asOf }).rows[0].net).toMatchObject({ value: null, reasons: ["invalid-evidence-date"] });
  });

  it("does not certify net with evidence posted after the result cutoff", () => {
    const episode = round();
    episode.positionEvents = [{ id: "future-cash", accountId: "account-a", market: "US", symbol: "FIX", date: "2026-02-01", kind: "ipo", amount: "0", currency: "USD", description: "Future evidence", source: [] }];
    expect(buildClosedEpisodeResults([episode], { asOf }).rows[0].net).toMatchObject({ value: null, reasons: ["future-evidence"] });
  });

  it("does not turn an inventory zero boundary after a partial sale into a real execution close", () => {
    const buy = fill("b", "buy", "2025-12-29T14:30:00Z", "2");
    const sale = fill("s", "sell", "2025-12-30T14:30:00Z", "1", "12");
    buy.source.statementPositions = [{ accountId: "account-a", market: "US", symbol: "FIX", date: "2025-12-31", phase: "closing", quantity: "0", source: [] }];
    const [episode] = buildTradeEpisodes([buy, sale]);
    expect(episode).toMatchObject({ status: "closed", remainingQuantity: "0" });
    expect(episode.accuracy?.reasons).toContain("position-gap");
    expect(buildClosedEpisodeResults([episode], { asOf }).excluded[0].reasons).toContain("closure-unconfirmed");
  });

  it.each([
    { label: "precision20 addition", first: "1", second: "1e-21", sold: "1" },
    { label: "remote source quantity tail", first: `1.${"0".repeat(1000)}1`, second: "1", sold: "2" },
  ])("does not count a false closed round caused by $label", ({ first, second, sold }) => {
    const [episode] = buildTradeEpisodes([
      fill("b1", "buy", "2025-12-29T14:30:00Z", first),
      fill("b2", "buy", "2025-12-30T14:30:00Z", second),
      fill("s", "sell", "2025-12-31T14:30:00Z", sold, "12"),
    ]);
    // The source quantities leave 1e-21 or 1e-1001 respectively. The existing
    // accumulator loses that residual on addition before its closing test.
    expect(episode).toMatchObject({ status: "closed", remainingQuantity: "0" });
    expect(episode.accuracy).toBeUndefined();
    expect(buildClosedEpisodeResults([episode], { asOf })).toMatchObject({
      rows: [], excluded: [{ reasons: ["closure-unconfirmed"] }], coverage: { included: 0, excluded: 1 },
    });
  });

  it.each(["1.000000000000000000001", "1"])("checks initial inventory quantity %s without treating unknown cost as an unclosed round", quantity => {
    const buy = fill("b", "buy", "2025-12-30T14:30:00Z");
    const sale = fill("s", "sell", "2025-12-31T14:30:00Z", "2", "12");
    buy.source.openingPosition = { accountId: "account-a", market: "US", symbol: "FIX", phase: "opening", date: "2025-12-29", quantity, source: [] };
    const [episode] = buildTradeEpisodes([buy, sale]);
    expect(episode).toMatchObject({ status: "closed", remainingQuantity: "0", initialPosition: { quantity } });
    expect(episode.accuracy?.reasons).toContain("unknown-cost");
    const result = buildClosedEpisodeResults([episode], { asOf });
    if (quantity === "1") {
      expect(result).toMatchObject({ rows: [{ id: episode.id, net: { value: null } }], excluded: [], coverage: { included: 1, netKnown: 0 } });
      expect(result.rows[0].net.reasons).toContain("unknown-cost");
    } else expect(result).toMatchObject({ rows: [], excluded: [{ id: episode.id, reasons: ["closure-unconfirmed"] }], coverage: { included: 0 } });
  });

  it("does not invent contribution classification for mixed IPO and ordinary acquisition", () => {
    const buy = fill("b", "buy", "2025-06-01T00:00:00Z", "100", "10", "1");
    const sale = fill("s", "sell", "2025-06-11T00:00:00Z", "150", "20", "1");
    buy.source.positionEvents = [
      { id: "application", accountId: "account-a", market: "US", symbol: "FIX", date: "2025-05-25", kind: "ipo", amount: "-1500", currency: "USD", description: "IPO Application Amount - #FIX", source: [] },
      { id: "refund", accountId: "account-a", market: "US", symbol: "FIX", date: "2025-06-10", kind: "ipo", amount: "500", currency: "USD", description: "IPO Refund Amount - #FIX", source: [] },
      { id: "allocation", accountId: "account-a", market: "US", symbol: "FIX", date: "2025-06-10", kind: "ipo", quantity: "50", amount: "1000", currency: "USD", displayTimePolicy: "session-open", description: "IPO allotment", source: [] },
    ];
    const [episode] = buildTradeEpisodes([buy, sale]);
    expect(summarizeTradeEpisode(episode).netPnl).toBe("998");
    const row = buildClosedEpisodeResults([episode], { asOf }).rows[0];
    expect(row).toMatchObject({ net: { value: "998" }, direction: "long", contributionCategory: null });
    expect(row.provenance.positionEventIds).toContain("allocation");
    expect(row.provenance.ipoCostEvidence[0].allocationId).toBe("allocation");
  });

  it.each(["future-evidence", "invalid-evidence-date"])("withholds the IPO fee part from knownValue for %s while retaining the actual sale fee", reason => {
    const sale = fill("sale", "sell", "2025-06-20T15:00:00Z", "500", "24", "3");
    sale.source.positionEvents = [
      { id: "application", accountId: "account-a", market: "US", symbol: "FIX", date: "2025-05-20", kind: "ipo", amount: "-68271.65", currency: "USD", description: "IPO Application Amount - #FIX", source: [] },
      { id: "ipo-fee", accountId: "account-a", market: "US", symbol: "FIX", date: "2025-06-25", kind: "fee", amount: "-100", currency: "USD", description: "IPO Application Handling Fee - #FIX", source: [] },
      { id: "refund", accountId: "account-a", market: "US", symbol: "FIX", date: "2025-06-19", kind: "ipo", amount: "56893.04", currency: "USD", description: "IPO Refund Amount - #FIX", source: [] },
      { id: "allocation", accountId: "account-a", market: "US", symbol: "FIX", date: "2025-06-19", kind: "ipo", quantity: "500", amount: "11265", currency: "USD", displayTimePolicy: "session-open", description: "IPO allotment", source: [] },
    ];
    const [episode] = buildTradeEpisodes([sale]);
    expect(summarizeTradeEpisode(episode).netPnl).toBe("518.39");
    expect(buildClosedEpisodeResults([episode], { asOf: "2025-07-02" }).rows[0].fees[0]).toMatchObject({ value: "103", knownValue: "103", coverage: { known: 2, total: 2 } });
    if (reason === "invalid-evidence-date") episode.positionEvents!.find(event => event.id === "ipo-fee")!.date = "2025-06-31";
    const row = buildClosedEpisodeResults([episode], { asOf: "2025-06-21" }).rows[0];
    expect(row.net.value).toBeNull();
    expect(row.fees).toEqual([{ currency: "USD", value: null, knownValue: "3", reasons: [reason], coverage: { known: 1, total: 2 } }]);
  });

  it.each(["2025-02-30", "2026-01-02T00:00:00", "not-a-date"])("rejects invalid asOf %s", invalid => {
    expect(() => buildClosedEpisodeResults([round()], { asOf: invalid })).toThrow();
  });

  it("rejects an invalid business timezone before producing any result", () => {
    expect(() => buildClosedEpisodeResults([round()], { asOf, businessTimeZone: "Unknown/Timezone" })).toThrow();
  });
});
