import { describe, expect, it } from "vitest";
import { buildInstrumentTradeSummaries } from "./instruments";
import { buildTradeEpisodes } from "./episodes";
import { summarizeTradeEpisode } from "./episode-metrics";
import type { TradeEpisode, TradeExecution } from "./types";
import { buildCachedTradeLibraryEntries } from "../reviews/trade-library-entry-cache";
import { ownHomepageFinancialSource } from "../../components/homepage-v25/financial-source-model";
import { projectHomepageV25Boundaries } from "../reviews/homepage-v25-performance";
import type { CanonicalFactResult, CanonicalStateFact } from "../replay/position-ledger";
import { buildDashboardModel, dashboardRowExclusionReason, dashboardRowIsTrustedClosed } from "../reviews/dashboard";
import { createRecallDocument } from "../recall/document";
import { canonicalRecallJson, captureRecallExecutionEvidence, freezeRecallSnapshotBundle } from "../recall/retained-bundles";
import { calculateRecallActualMetrics } from "../recall/actual-metrics";
import { sha256 } from "../recall/retained-digest";
import type { RecallRetainedBundle, RecallSnapshot } from "../recall/types";
import { preparePositionLedger, readPreparedPositionFacts, replayPositionAtPrice, replayPreparedPositionBoundaries } from "../replay/position-ledger";

const instrument = { id: "US:X", symbol: "X", name: "X", market: "US", currency: "USD" };
function fill(id: string, side: TradeExecution["side"], quantity: string, price: string, fee: string, day = "01"): TradeExecution {
  return { id, side, quantity, price, fee, instrument, accountId: "A", accountLabel: "A", executedAt: `2026-10-${day}T01:00:00Z`, source: { platform: "futu", row: Number(day), tradeNature: "live", ...(side === "sell" ? { positionEffect: "open-short" as const } : {}) } };
}

describe("F07 original malformed fee journeys", () => {
  it.each(["invalid", "", "   ", "-1", "NaN", "Infinity"])("keeps raw %j through first library construction and owned source", fee => {
    const executions = [fill("first", "buy", "2.125", "100", fee)];
    const before = structuredClone(executions);
    const entries = buildCachedTradeLibraryEntries(undefined, buildInstrumentTradeSummaries(executions), {}, {}, {}, {}).entries;
    expect(entries).toHaveLength(1);
    expect(entries[0].executions[0].fee).toBe(fee);
    expect(entries[0].episodes[0].metrics).toMatchObject({ fees: null, netPnl: null, pnlAvailable: false });
    const source = ownHomepageFinancialSource({ entries, asOf: "2026-10-23T12:00:00Z", reviewSummariesComplete: true,
      instrumentMetadata: { "US:X": { market: "US", symbol: "X", assetType: "stock" } },
      candlesByInstrument: { "US:X": [{ instrumentId: "US:X", tradingDate: "2026-10-22", open: "110", high: "110", low: "110", close: "110", volume: "1", currency: "USD", adjustmentMode: "raw", provider: "eastmoney", providerSymbol: "X", fetchedAt: "2026-10-22T21:00:00Z" }] },
      marketDataStatuses: {}, fxObservations: [], currentFxSnapshot: null, lifetimeSourceCoverage: [],
      revisions: { trades: "t1", metadata: "m1", quotes: "q1", fx: "f1" },
      universeCoverage: { state: "complete", knownAt: "2026-01-01T00:00:00Z", evidenceIds: ["enumeration"], reasons: [] } },
    { scope: { live: true, market: "all", accounts: ["*"], rangeMode: "all" }, attachments: { categories: [], openOnly: false, pendingReview: [] } });
    const current = projectHomepageV25Boundaries(source.prepared, { periodStart: "2026-10-01", asOf: source.asOf, endpoints: [], targetCurrency: "USD" }).current;
    expect(current.instruments[0].evidence.current).toMatchObject({ quantity: "2.125", costKnown: true });
    expect(current.currentMarketValue.value).toBe("233.75");
    expect(current.currentUnrealized.value).toBeNull();
    expect(current.currentOpenFees.value).toBeNull();
    expect(executions).toEqual(before);
  });

  it("preserves gross realization and full precision facts across a malformed partial close", () => {
    const executions = [fill("buy", "buy", "2", "100", "1"), fill("sell", "sell", "1", "120", "invalid", "02")];
    const snapshot = replayPositionAtPrice({ executions, markPrice: "110" });
    expect(snapshot).toMatchObject({ quantity: "1", averageCost: "100", realizedPnl: "20", unrealizedPnl: "10", fees: null, netPnl: null, returnPercent: null });
    expect(snapshot.costKnown).not.toBe(false);
    const prepared = preparePositionLedger({ executions });
    const result = readPreparedPositionFacts(prepared, [{}]).results[0];
    expect(result.terminal.averageCost).toMatchObject({ value: "100", available: true });
    expect(result.terminal.fees).toMatchObject({ value: null, available: false, reasons: ["fees-invalid"] });
    expect(result.facts[1].realizedDelta).toMatchObject({ value: "20", available: true });
    expect(summarizeTradeEpisode(buildTradeEpisodes(executions)[0], "110")).toMatchObject({ realizedPnl: "20", fees: null, netPnl: null });
  });

  it("preserves reversal lineage without assigning a fake fee to either leg", () => {
    const executions = [fill("buy", "buy", "2", "100", "1"), fill("reverse", "sell", "5", "120", "invalid", "02")];
    const episodes = buildTradeEpisodes(executions);
    const legal = buildTradeEpisodes([executions[0], { ...executions[1], fee: "2.5" }]);
    expect(episodes.map(e => e.id)).toEqual(legal.map(e => e.id));
    expect(episodes.map(e => [e.status, e.remainingQuantity, e.executions.at(-1)?.fee])).toEqual([["closed", "0", "invalid"], ["open", "3", "invalid"]]);
    expect(episodes.every(e => e.accuracy?.reasons.includes("fees-invalid"))).toBe(true);
    expect(episodes.map(e => summarizeTradeEpisode(e, "110").fees)).toEqual([null, null]);
    expect(replayPositionAtPrice({ executions, markPrice: "110" })).toMatchObject({ quantity: "-3", averageCost: "120", realizedPnl: "40", unrealizedPnl: "30", fees: null, netPnl: null });
    expect(legal.map(e => [e.executions.at(-1)?.fee, summarizeTradeEpisode(e, "110").netPnl])).toEqual([["1", "38"], ["1.5", "28.5"]]);
    expect(replayPositionAtPrice({ executions: [executions[0], { ...executions[1], fee: "2.5" }], markPrice: "110" }).netPnl).toBe("66.5");
    expect(executions[1].fee).toBe("invalid");
  });

  it("reveals invalid fees only at the selected execution and rewinds prepared prefixes", () => {
    const executions = [fill("buy", "buy", "2", "100", "1"), fill("bad", "sell", "1", "120", "invalid", "02"), fill("good", "sell", "1", "120", "1", "03")];
    const prepared = preparePositionLedger({ executions });
    const queries = ["2026-10-01T12:00:00Z", "2026-10-02T12:00:00Z", "2026-10-01T12:00:00Z"].map(cursor => ({ cursor, markPrice: "110" }));
    expect(replayPreparedPositionBoundaries(prepared, queries).results.map(r => [r.snapshot.fees, r.snapshot.netPnl])).toEqual([["1", "19"], [null, null], ["1", "19"]]);
    const selected = replayPreparedPositionBoundaries(prepared, [{ markPrice: "110", cursor: "2026-10-01", visibleExecutionIds: ["buy", "good"] }]);
    expect(selected.results[0]).toMatchObject({ mode: "exact-context-fallback", snapshot: { fees: "2", netPnl: "28" } });
  });

  it.each([["0", "10"], ["-0", "10"], ["1e-3", "9.999"], ["0.125", "9.875"]])("retains legal fee %s arithmetic", (fee, net) => {
    const executions = [fill("first", "buy", "1", "100", fee)];
    expect(summarizeTradeEpisode(buildTradeEpisodes(executions)[0], "110").netPnl).toBe(net);
    expect(replayPositionAtPrice({ executions, markPrice: "110" }).netPnl).toBe(net);
  });
  it("does not clear earlier non-fee uncertainty or leak fee failure into a new flat episode", () => {
    const first = fill("first", "buy", "1", "100", "invalid");
    first.source.historyIncomplete = ["missing"];
    expect(replayPositionAtPrice({ executions: [first], markPrice: "110" })).toMatchObject({ quantityKnown: false, costKnown: false, fees: null, netPnl: null });
    const clean = fill("clean", "buy", "1", "100", "1", "03");
    const episodes = buildTradeEpisodes([{ ...first, source: { ...first.source, historyIncomplete: undefined } }, fill("flat", "sell", "1", "120", "1", "02"), clean]);
    expect(summarizeTradeEpisode(episodes[1], "110")).toMatchObject({ fees: "1", netPnl: "9" });
  });
});

// U06: literals captured from pre-F07 58bf0d9 before executing this candidate.
// Independent arithmetic: reversal 10 + 20 - 1 = 29; large close 10^18 - 2.
// Each interface retains its original precision; facts are never rounded to public snapshots.
const legalFeeCases = [
  {
    name: "thirds",
    input: [{"quantity": "1", "price": "100", "fee": "0"}, {"quantity": "3", "price": "110", "fee": "1"}, {"quantity": "1", "price": "90", "fee": "2"}],
    snapshots: [
      {"quantity": "1", "averageCost": "100", "realizedPnl": "0", "unrealizedPnl": "0", "netPnl": "0", "fees": "0", "grossCapitalDeployed": "100", "returnPercent": "0"},
      {"quantity": "-2", "averageCost": "110", "realizedPnl": "10", "unrealizedPnl": "20", "netPnl": "29", "fees": "1", "grossCapitalDeployed": "320", "returnPercent": "9.0625"},
      {"quantity": "2", "averageCost": "95", "realizedPnl": "0", "unrealizedPnl": "10", "netPnl": "8", "fees": "2", "grossCapitalDeployed": "190", "returnPercent": "4.21052632"},
    ],
    states: [["1", "100", "0", "0", "100"], ["-2", "110", "10", "1", "320"], ["2", "95", "0", "2", "190"]],
    movements: [
      [
        {"executionId": "buy", "time": {"at": "2026-10-01T01:00:00.000Z", "sourceDate": "2026-10-01T01:00:00Z", "precision": "instant"}, "before": ["0", "0", "0", "0", "0"], "after": ["1", "100", "0", "0", "100"], "closed": "0", "opened": "1", "delta": "0"},
      ],
      [
        {"executionId": "buy", "time": {"at": "2026-10-01T01:00:00.000Z", "sourceDate": "2026-10-01T01:00:00Z", "precision": "instant"}, "before": ["0", "0", "0", "0", "0"], "after": ["1", "100", "0", "0", "100"], "closed": "0", "opened": "1", "delta": "0"},
        {"executionId": "sell", "time": {"at": "2026-10-02T01:00:00.000Z", "sourceDate": "2026-10-02T01:00:00Z", "precision": "instant"}, "before": ["1", "100", "0", "0", "100"], "after": ["-2", "110", "10", "1", "320"], "closed": "1", "opened": "2", "delta": "10"},
      ],
      [
        {"executionId": "buy", "time": {"at": "2026-10-01T01:00:00.000Z", "sourceDate": "2026-10-01T01:00:00Z", "precision": "instant"}, "before": ["0", "0", "0", "0", "0"], "after": ["1", "100", "0", "0", "100"], "closed": "0", "opened": "1", "delta": "0"},
        {"executionId": "cover", "time": {"at": "2026-10-03T01:00:00.000Z", "sourceDate": "2026-10-03T01:00:00Z", "precision": "instant"}, "before": ["1", "100", "0", "0", "100"], "after": ["2", "95", "0", "2", "190"], "closed": "0", "opened": "1", "delta": "0"},
      ],
    ],
    episodes: [
      {
        status: "closed", remainingQuantity: "0", legFees: ["0", "0.33333333333333333333"],
        metrics: {"buyCount": 1, "sellCount": 1, "boughtQuantity": "1", "soldQuantity": "1", "grossExposure": "100", "fees": "0.33333333333333333333", "realizedPnl": "10", "unrealizedPnl": "0", "netPnl": "9.6666666666666666667", "returnPercent": "9.6666666666666666667", "holdingMilliseconds": 86400000},
        ledger: {"quantity": "0", "averageCost": "0", "realizedPnl": "10", "unrealizedPnl": "0", "netPnl": "9.66666667", "fees": "0.33333333", "grossCapitalDeployed": "100", "returnPercent": "9.66666667"},
        facts: ["0", "0", "10", "0.33333333333333333333", "100"],
      },
      {
        status: "open", remainingQuantity: "2", legFees: ["0.66666666666666666667"],
        metrics: {"buyCount": 0, "sellCount": 1, "boughtQuantity": "0", "soldQuantity": "2", "grossExposure": "220", "fees": "0.66666666666666666667", "realizedPnl": "0", "unrealizedPnl": "20", "netPnl": "19.333333333333333333", "returnPercent": "8.7878787878787878786", "holdingMilliseconds": null},
        ledger: {"quantity": "-2", "averageCost": "110", "realizedPnl": "0", "unrealizedPnl": "20", "netPnl": "19.33333333", "fees": "0.66666667", "grossCapitalDeployed": "220", "returnPercent": "8.78787879"},
        facts: ["-2", "110", "0", "0.66666666666666666667", "220"],
      },
    ],
  },
  {
    name: "large-quantity",
    input: [{"quantity": "1000000000000000000", "price": "100", "fee": "1"}, {"quantity": "1000000000000000000", "price": "101", "fee": "1"}, {"quantity": "1", "price": "90", "fee": "0.125"}],
    snapshots: [
      {"quantity": "1000000000000000000", "averageCost": "100", "realizedPnl": "0", "unrealizedPnl": "0", "netPnl": "-1", "fees": "1", "grossCapitalDeployed": "100000000000000000000", "returnPercent": "0"},
      {"quantity": "0", "averageCost": "0", "realizedPnl": "1000000000000000000", "unrealizedPnl": "0", "netPnl": "999999999999999998", "fees": "2", "grossCapitalDeployed": "100000000000000000000", "returnPercent": "1"},
      {"quantity": "1000000000000000001", "averageCost": "100", "realizedPnl": "0", "unrealizedPnl": "10", "netPnl": "8.875", "fees": "1.125", "grossCapitalDeployed": "100000000000000000090", "returnPercent": "0"},
    ],
    states: [["1000000000000000000", "100", "0", "1", "100000000000000000000"], ["0", "0", "1000000000000000000", "2", "100000000000000000000"], ["1000000000000000001", "99.99999999999999999", "0", "1.125", "100000000000000000090"]],
    movements: [
      [
        {"executionId": "buy", "time": {"at": "2026-10-01T01:00:00.000Z", "sourceDate": "2026-10-01T01:00:00Z", "precision": "instant"}, "before": ["0", "0", "0", "0", "0"], "after": ["1000000000000000000", "100", "0", "1", "100000000000000000000"], "closed": "0", "opened": "1000000000000000000", "delta": "0"},
      ],
      [
        {"executionId": "buy", "time": {"at": "2026-10-01T01:00:00.000Z", "sourceDate": "2026-10-01T01:00:00Z", "precision": "instant"}, "before": ["0", "0", "0", "0", "0"], "after": ["1000000000000000000", "100", "0", "1", "100000000000000000000"], "closed": "0", "opened": "1000000000000000000", "delta": "0"},
        {"executionId": "sell", "time": {"at": "2026-10-02T01:00:00.000Z", "sourceDate": "2026-10-02T01:00:00Z", "precision": "instant"}, "before": ["1000000000000000000", "100", "0", "1", "100000000000000000000"], "after": ["0", "0", "1000000000000000000", "2", "100000000000000000000"], "closed": "1000000000000000000", "opened": "0", "delta": "1000000000000000000"},
      ],
      [
        {"executionId": "buy", "time": {"at": "2026-10-01T01:00:00.000Z", "sourceDate": "2026-10-01T01:00:00Z", "precision": "instant"}, "before": ["0", "0", "0", "0", "0"], "after": ["1000000000000000000", "100", "0", "1", "100000000000000000000"], "closed": "0", "opened": "1000000000000000000", "delta": "0"},
        {"executionId": "cover", "time": {"at": "2026-10-03T01:00:00.000Z", "sourceDate": "2026-10-03T01:00:00Z", "precision": "instant"}, "before": ["1000000000000000000", "100", "0", "1", "100000000000000000000"], "after": ["1000000000000000001", "99.99999999999999999", "0", "1.125", "100000000000000000090"], "closed": "0", "opened": "1", "delta": "0"},
      ],
    ],
    episodes: [
      {
        status: "closed", remainingQuantity: "0", legFees: ["1", "1"],
        metrics: {"buyCount": 1, "sellCount": 1, "boughtQuantity": "1000000000000000000", "soldQuantity": "1000000000000000000", "grossExposure": "100000000000000000000", "fees": "2", "realizedPnl": "1000000000000000000", "unrealizedPnl": "0", "netPnl": "999999999999999998", "returnPercent": "0.999999999999999998", "holdingMilliseconds": 86400000},
        ledger: {"quantity": "0", "averageCost": "0", "realizedPnl": "1000000000000000000", "unrealizedPnl": "0", "netPnl": "999999999999999998", "fees": "2", "grossCapitalDeployed": "100000000000000000000", "returnPercent": "1"},
        facts: ["0", "0", "1000000000000000000", "2", "100000000000000000000"],
      },
    ],
  },
  {
    name: "large-fee",
    input: [{"quantity": "1000000000000000000", "price": "100", "fee": "100000000000000000"}, {"quantity": "1000000000000000000", "price": "101", "fee": "100000000000000000"}, {"quantity": "1", "price": "90", "fee": "0.125"}],
    snapshots: [
      {"quantity": "1000000000000000000", "averageCost": "100", "realizedPnl": "0", "unrealizedPnl": "0", "netPnl": "-100000000000000000", "fees": "100000000000000000", "grossCapitalDeployed": "100000000000000000000", "returnPercent": "-0.1"},
      {"quantity": "0", "averageCost": "0", "realizedPnl": "1000000000000000000", "unrealizedPnl": "0", "netPnl": "800000000000000000", "fees": "200000000000000000", "grossCapitalDeployed": "100000000000000000000", "returnPercent": "0.8"},
      {"quantity": "1000000000000000001", "averageCost": "100", "realizedPnl": "0", "unrealizedPnl": "10", "netPnl": "-99999999999999990.13", "fees": "100000000000000000.13", "grossCapitalDeployed": "100000000000000000090", "returnPercent": "-0.1"},
    ],
    states: [["1000000000000000000", "100", "0", "100000000000000000", "100000000000000000000"], ["0", "0", "1000000000000000000", "200000000000000000", "100000000000000000000"], ["1000000000000000001", "99.99999999999999999", "0", "100000000000000000.13", "100000000000000000090"]],
    movements: [
      [
        {"executionId": "buy", "time": {"at": "2026-10-01T01:00:00.000Z", "sourceDate": "2026-10-01T01:00:00Z", "precision": "instant"}, "before": ["0", "0", "0", "0", "0"], "after": ["1000000000000000000", "100", "0", "100000000000000000", "100000000000000000000"], "closed": "0", "opened": "1000000000000000000", "delta": "0"},
      ],
      [
        {"executionId": "buy", "time": {"at": "2026-10-01T01:00:00.000Z", "sourceDate": "2026-10-01T01:00:00Z", "precision": "instant"}, "before": ["0", "0", "0", "0", "0"], "after": ["1000000000000000000", "100", "0", "100000000000000000", "100000000000000000000"], "closed": "0", "opened": "1000000000000000000", "delta": "0"},
        {"executionId": "sell", "time": {"at": "2026-10-02T01:00:00.000Z", "sourceDate": "2026-10-02T01:00:00Z", "precision": "instant"}, "before": ["1000000000000000000", "100", "0", "100000000000000000", "100000000000000000000"], "after": ["0", "0", "1000000000000000000", "200000000000000000", "100000000000000000000"], "closed": "1000000000000000000", "opened": "0", "delta": "1000000000000000000"},
      ],
      [
        {"executionId": "buy", "time": {"at": "2026-10-01T01:00:00.000Z", "sourceDate": "2026-10-01T01:00:00Z", "precision": "instant"}, "before": ["0", "0", "0", "0", "0"], "after": ["1000000000000000000", "100", "0", "100000000000000000", "100000000000000000000"], "closed": "0", "opened": "1000000000000000000", "delta": "0"},
        {"executionId": "cover", "time": {"at": "2026-10-03T01:00:00.000Z", "sourceDate": "2026-10-03T01:00:00Z", "precision": "instant"}, "before": ["1000000000000000000", "100", "0", "100000000000000000", "100000000000000000000"], "after": ["1000000000000000001", "99.99999999999999999", "0", "100000000000000000.13", "100000000000000000090"], "closed": "0", "opened": "1", "delta": "0"},
      ],
    ],
    episodes: [
      {
        status: "closed", remainingQuantity: "0", legFees: ["100000000000000000", "100000000000000000"],
        metrics: {"buyCount": 1, "sellCount": 1, "boughtQuantity": "1000000000000000000", "soldQuantity": "1000000000000000000", "grossExposure": "100000000000000000000", "fees": "200000000000000000", "realizedPnl": "1000000000000000000", "unrealizedPnl": "0", "netPnl": "800000000000000000", "returnPercent": "0.8", "holdingMilliseconds": 86400000},
        ledger: {"quantity": "0", "averageCost": "0", "realizedPnl": "1000000000000000000", "unrealizedPnl": "0", "netPnl": "800000000000000000", "fees": "200000000000000000", "grossCapitalDeployed": "100000000000000000000", "returnPercent": "0.8"},
        facts: ["0", "0", "1000000000000000000", "200000000000000000", "100000000000000000000"],
      },
    ],
  },
];
const factFields = ["quantity", "averageCost", "realizedPnl", "fees", "grossCapitalDeployed"] as const;
function expectKnownFactState(actual: CanonicalStateFact, values: readonly string[]) {
  expect(values).toHaveLength(5);
  factFields.forEach((field, index) => expect(actual[field]).toEqual({ value: values[index], available: true, reasons: [] }));
  expect(actual.reasons).toEqual([]);
  expect(actual.warnings).toEqual([]);
}
function expectLegalFacts(actual: CanonicalFactResult, expected: typeof legalFeeCases[number], queryIndex: number) {
  expectKnownFactState(actual.terminal, expected.states[queryIndex]);
  expect(actual.coverage).toEqual({ quantity: { available: true, reasons: [] }, chronology: { available: true, reasons: [] }, costAndRealized: { available: true, reasons: [] } });
  const movements = expected.movements[queryIndex];
  expect(actual.selectedExecutionIds).toEqual(movements.map(m => m.executionId));
  expect(actual.facts).toHaveLength(movements.length);
  movements.forEach((literal, index) => {
    const movement = actual.facts[index];
    expect(movement).toMatchObject({ executionId: literal.executionId, kind: "execution", effect: "applied", time: literal.time });
    expectKnownFactState(movement.before, literal.before);
    expectKnownFactState(movement.after, literal.after);
    expect(movement.matchedClosedQuantity).toEqual({ value: literal.closed, available: true, reasons: [] });
    expect(movement.openedQuantity).toEqual({ value: literal.opened, available: true, reasons: [] });
    expect(movement.realizedDelta).toEqual({ value: literal.delta, available: true, reasons: [] });
  });
}
function libraryFromRaw(raw: TradeExecution[]) {
  return buildCachedTradeLibraryEntries(undefined, buildInstrumentTradeSummaries(raw), {}, {}, {}, {}).entries;
}
const correctionAsOf = "2026-10-23T12:00:00Z";
function ownLiteralSource(entries: ReturnType<typeof libraryFromRaw>, trades: string, accounts = ["*"]) {
  return ownHomepageFinancialSource({ entries, asOf: correctionAsOf, reviewSummariesComplete: true,
    instrumentMetadata: { "US:X": { market: "US", symbol: "X", assetType: "stock" } },
    candlesByInstrument: { "US:X": [{ instrumentId: "US:X", tradingDate: "2026-10-22", open: "110", high: "110", low: "110", close: "110", volume: "1", currency: "USD", adjustmentMode: "raw", provider: "eastmoney", providerSymbol: "X", fetchedAt: "2026-10-22T21:00:00Z" }] },
    marketDataStatuses: {}, fxObservations: [], currentFxSnapshot: null, lifetimeSourceCoverage: [],
    revisions: { trades, metadata: "m1", quotes: "q1", fx: "f1" },
    universeCoverage: { state: "complete", knownAt: "2026-01-01T00:00:00Z", evidenceIds: ["enumeration"], reasons: [] } },
  { scope: { live: true, market: "all", accounts, rangeMode: "all" }, attachments: { categories: [], openOnly: false, pendingReview: [] } });
}
function projectLiteralSource(source: ReturnType<typeof ownLiteralSource>) {
  return projectHomepageV25Boundaries(source.prepared, { periodStart: "2026-10-01", asOf: source.asOf, endpoints: [], targetCurrency: "USD" });
}
function freezeTestInput<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freezeTestInput);
    Object.freeze(value);
  }
  return value;
}
// Structural snapshot carrier only: no rendered chart or stored financial amounts are fabricated.
// Actual persistence and screenshot acceptance remain the independent browser gate.
function correctionSnapshot(id: string): RecallSnapshot {
  return { id, decisionId: "global", phase: "holding", timeframe: "1D", cursor: correctionAsOf, executionCursor: "sell",
    candles: [], drawings: [], viewport: { version: 1, logicalRange: null, barSpacing: 8, rightOffset: 4, width: 800, height: 400 },
    imageDataUrl: "data:image/png;base64,AAAA", createdAt: correctionAsOf, updatedAt: correctionAsOf };
}
function recallFromRetained(bundle: RecallRetainedBundle) {
  const evidence = bundle.executionEvidence;
  // Restore only omitted presentation labels; every financial/source field comes from captured evidence.
  const episode: TradeEpisode = { ...evidence.payload.episode, accountLabel: evidence.payload.episode.accountId,
    instrument: { ...evidence.payload.episode.instrument, name: evidence.payload.episode.instrument.symbol },
    executions: evidence.payload.executions.map(e => ({ ...e, accountLabel: e.accountId, instrument: { ...e.instrument, name: e.instrument.symbol } })) };
  const phase = bundle.captureContext.phase;
  if (!phase) throw new Error("fixture must retain an explicit phase");
  return calculateRecallActualMetrics({ episode, decisions: bundle.decisions, planVersions: [], riskBaselines: [],
    context: { phase, cursor: bundle.captureContext.cursor, executionCursor: bundle.captureContext.executionCursor },
    mark: { price: "110", time: "2026-10-22T21:00:00Z", priceBasis: "raw" },
    source: { documentRevision: bundle.documentRevision, evidenceDigest: evidence.digest, bundleId: bundle.id, computedAt: correctionAsOf } });
}

describe("F07 U06/U11/U14 literal completion", () => {
  it.each(legalFeeCases)("U06 preserves pre-F07 $name direct/prefix/fallback/facts and split precision", expected => {
    const [buy, sell, cover] = expected.input;
    const raw = freezeTestInput([fill("buy", "buy", buy.quantity, buy.price, buy.fee, "01"), fill("sell", "sell", sell.quantity, sell.price, sell.fee, "02"), fill("cover", "buy", cover.quantity, cover.price, cover.fee, "03")]);
    const before = canonicalRecallJson(raw);
    const queries = [{ markPrice: "100", visibleExecutionIds: ["buy"] }, { markPrice: "100", visibleExecutionIds: ["buy", "sell"] }, { markPrice: "100", cursor: "2026-09-01", visibleExecutionIds: ["buy", "cover"] }];
    const prepared = preparePositionLedger({ executions: raw });
    queries.forEach((query, index) => expect(replayPositionAtPrice({ executions: raw, ...query })).toEqual(expected.snapshots[index]));
    const batch = replayPreparedPositionBoundaries(prepared, [queries[0], queries[1], queries[0], queries[2]]);
    expect(batch.results.map(r => r.snapshot)).toEqual([expected.snapshots[0], expected.snapshots[1], expected.snapshots[0], expected.snapshots[2]]);
    expect(batch.results.map(r => r.mode)).toEqual(["ordinary-sweep", "ordinary-sweep", "ordinary-sweep", "exact-context-fallback"]);
    const facts = readPreparedPositionFacts(prepared, [queries[0], queries[1], queries[0], queries[2]]);
    expect(facts.results.map(r => r.mode)).toEqual(["ordinary-sweep", "ordinary-sweep", "ordinary-sweep", "exact-context-fallback"]);
    [0, 1, 0, 2].forEach((queryIndex, index) => expectLegalFacts(facts.results[index], expected, queryIndex));

    const distractor = { ...fill("distractor", "buy", "1", "999", "7", "01"), executedAt: "2026-10-01T12:00:00Z" };
    const fallbackRaw = freezeTestInput([raw[0], distractor, raw[1]]);
    const fallbackBefore = canonicalRecallJson(fallbackRaw);
    const fallback = preparePositionLedger({ executions: fallbackRaw });
    const query = { markPrice: "100", cursor: "2026-09-01", visibleExecutionIds: ["buy", "sell"] };
    expect(replayPositionAtPrice({ executions: fallbackRaw, ...query })).toEqual(expected.snapshots[1]);
    expect(replayPreparedPositionBoundaries(fallback, [query]).results[0]).toEqual({ snapshot: expected.snapshots[1], mode: "exact-context-fallback" });
    const fallbackFacts = readPreparedPositionFacts(fallback, [query]).results[0];
    expect(fallbackFacts.mode).toBe("exact-context-fallback");
    expectLegalFacts(fallbackFacts, expected, 1);

    const episodes = buildTradeEpisodes(raw.slice(0, 2));
    expect(episodes).toHaveLength(expected.episodes.length);
    expected.episodes.forEach((literal, index) => {
      const episode = episodes[index];
      expect(episode).toMatchObject({ status: literal.status, remainingQuantity: literal.remainingQuantity });
      expect(episode.executions.map(e => e.fee)).toEqual(literal.legFees);
      expect(summarizeTradeEpisode(episode, "100")).toEqual(literal.metrics);
      expect(replayPositionAtPrice({ executions: episode.executions, markPrice: "100" })).toEqual(literal.ledger);
      const splitFacts = readPreparedPositionFacts(preparePositionLedger({ executions: episode.executions }), [{}]).results[0];
      expectKnownFactState(splitFacts.terminal, literal.facts);
    });
    expect(canonicalRecallJson(raw)).toBe(before);
    expect(canonicalRecallJson(fallbackRaw)).toBe(fallbackBefore);
  });

  it("U11 isolates malformed A/live from B/live and two A/simulation runs in one real population", () => {
    const identities = [
      { account: "A", nature: "live", run: undefined, buyFee: "invalid", sellPrice: "120" },
      { account: "B", nature: "live", run: undefined, buyFee: "1", sellPrice: "120" },
      { account: "A", nature: "simulation", run: "run-a", buyFee: "1", sellPrice: "130" },
      { account: "A", nature: "simulation", run: "run-b", buyFee: "1", sellPrice: "140" },
    ] as const;
    const raw = freezeTestInput(identities.flatMap(identity => {
      const prefix = `${identity.account}-${identity.nature}-${identity.run ?? "none"}`;
      return [fill(`${prefix}-buy`, "buy", "1", "100", identity.buyFee, "01"), fill(`${prefix}-sell`, "sell", "1", identity.sellPrice, "1", "02")]
        .map(e => ({ ...e, accountId: identity.account, accountLabel: identity.account, source: { ...e.source, tradeNature: identity.nature, simulationRunId: identity.run } }));
    }));
    const before = canonicalRecallJson(raw);
    const entries = libraryFromRaw(raw);
    expect(entries.flatMap(e => e.executions).map(e => e.id).sort()).toEqual(raw.map(e => e.id).sort());
    const all = buildDashboardModel(entries, { nature: "all", currency: "USD" });
    expect(all.rows).toHaveLength(4);
    expect(all.rows.map(r => [r.item.episode.accountId, r.item.episode.tradeNature, r.item.episode.simulationRunId ?? null, r.item.metrics.realizedPnl, r.item.metrics.fees, r.item.metrics.netPnl])
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))))
      .toEqual([["A", "live", null, "20", null, null], ["A", "simulation", "run-a", "30", "2", "28"], ["A", "simulation", "run-b", "40", "2", "38"], ["B", "live", null, "20", "2", "18"]]);
    const live = buildDashboardModel(entries, { nature: "live", currency: "USD" });
    expect(live.stats).toMatchObject({ sampleCount: 2, closedCount: 2, trustedClosedCount: 1, excludedCount: 1, netPnl: "18", fees: "2", exclusionReasons: { accuracy: 1 } });
    expect(live.rows.map(row => [row.item.episode.accountId, dashboardRowIsTrustedClosed(row), dashboardRowExclusionReason(row)]).sort())
      .toEqual([["A", false, "accuracy"], ["B", true, null]]);
    expect(buildDashboardModel(entries, { nature: "live", account: "A", currency: "USD" }).stats)
      .toMatchObject({ sampleCount: 1, trustedClosedCount: 0, excludedCount: 1, netPnl: null, fees: null });
    expect(buildDashboardModel(entries, { nature: "live", account: "B", currency: "USD" }).stats)
      .toMatchObject({ sampleCount: 1, trustedClosedCount: 1, excludedCount: 0, netPnl: "18", fees: "2" });
    for (const [run, net] of [["run-a", "28"], ["run-b", "38"]]) {
      const selected = buildDashboardModel(entries, { nature: "simulation", account: "A", simulationRunId: run, currency: "USD" });
      expect(selected.stats).toMatchObject({ sampleCount: 1, closedCount: 1, trustedClosedCount: 1, excludedCount: 0, netPnl: net, fees: "2" });
      expect(selected.rows[0].item.episode.simulationRunId).toBe(run);
      expect(dashboardRowIsTrustedClosed(selected.rows[0])).toBe(true);
      expect(dashboardRowExclusionReason(selected.rows[0])).toBeNull();
    }
    const sourceAll = ownLiteralSource(entries, "population");
    expect(sourceAll.selectedEntries.flatMap(e => e.executions).map(e => e.id).sort()).toEqual(raw.filter(e => e.source.tradeNature === "live").map(e => e.id).sort());
    for (const account of ["A", "B"]) {
      const selected = ownLiteralSource(entries, "population", [account]);
      expect(selected.receipt.eligibleGroupKeys).toHaveLength(1);
      expect(selected.selectedEntries.flatMap(e => e.executions).map(e => e.id).sort()).toEqual(raw.filter(e => e.accountId === account && e.source.tradeNature === "live").map(e => e.id).sort());
      expect(selected.selectedEntries.flatMap(e => e.episodes).map(e => e.metrics.netPnl)).toEqual([account === "A" ? null : "18"]);
    }
    expect(canonicalRecallJson(raw)).toBe(before);
  });

  it("U14 owns immutable correction revisions while old retained evidence remains financially unknown", () => {
    const oldRaw = freezeTestInput([fill("buy", "buy", "2", "100", "1", "01"), fill("sell", "sell", "1", "120", "invalid", "02")]);
    const newRaw = freezeTestInput(oldRaw.map(e => e.id === "sell" ? { ...structuredClone(e), fee: "2" } : structuredClone(e)));
    const oldBytes = canonicalRecallJson(oldRaw), newBytes = canonicalRecallJson(newRaw);
    expect(newRaw.map(e => ({ ...e, fee: e.id === "sell" ? "invalid" : e.fee }))).toEqual(oldRaw);
    const oldEntries = libraryFromRaw(oldRaw), newEntries = libraryFromRaw(newRaw);
    const oldSource = ownLiteralSource(oldEntries, "t1"), newSource = ownLiteralSource(newEntries, "t2");
    const oldSourceBytes = canonicalRecallJson(oldSource);
    const oldEpisode = oldEntries[0].episodes[0].episode, newEpisode = newEntries[0].episodes[0].episode;
    expect(newEpisode.id).toBe(oldEpisode.id);
    expect(replayPositionAtPrice({ executions: oldRaw, markPrice: "110" })).toMatchObject({ quantity: "1", averageCost: "100", realizedPnl: "20", unrealizedPnl: "10", fees: null, netPnl: null });
    expect(replayPositionAtPrice({ executions: newRaw, markPrice: "110" })).toEqual({ quantity: "1", averageCost: "100", realizedPnl: "20", unrealizedPnl: "10", fees: "3", netPnl: "27", grossCapitalDeployed: "200", returnPercent: "13.5" });
    expect(oldSource.receipt.sourceId).not.toBe(newSource.receipt.sourceId);
    expect(oldSource.receipt.selectionKey).toBe(newSource.receipt.selectionKey);
    for (const [source, revision, openFee, net] of [[newSource, "t2", "0.5", "9.5"], [oldSource, "t1", null, null], [newSource, "t2", "0.5", "9.5"]] as const) {
      const projection = projectLiteralSource(source);
      expect(projection.sourceId).toBe(source.receipt.sourceId);
      expect(projection.revisions).toEqual({ trades: revision, metadata: "m1", quotes: "q1", fx: "f1" });
      expect(projection.policies).toEqual({ finance: "F3-2026-10-23", feePool: "F3-canonical-prefix", feeFacts: "P2-incurred-knowledge-1", calendar: "exchange-2010-2030-F3", dailyCoverage: "P2-strict-completed-1", fx: "P2-historical-pair-knowledge-1", quoteKnowledgeMode: "retrospective-completed-session" });
      expect(projection.scope).toEqual({ nature: "live", simulationRunId: null, includedExecutions: 2, excludedExecutions: 0, excludedByReason: {} });
      expect(projection.asOf).toBe("2026-10-23T12:00:00.000Z");
      expect(projection.current.currentMarketValue.value).toBe("110");
      expect(projection.current.currentOpenFees.value).toBe(openFee);
      expect(projection.current.currentUnrealized.value).toBe(net);
      expect(Object.isFrozen(source)).toBe(true);
      expect(Object.isFrozen(source.prepared)).toBe(true);
      expect(Object.isFrozen(source.selectedEntries[0].executions[1])).toBe(true);
      expect(Object.isFrozen(projection)).toBe(true);
    }

    const document = createRecallDocument(oldEpisode, correctionAsOf);
    document.snapshots = [correctionSnapshot("snapshot-old")];
    const oldDocument = freezeRecallSnapshotBundle(document, "snapshot-old", { bundleId: "bundle-old", retainedAt: correctionAsOf, episode: oldEpisode });
    const oldBundle = oldDocument.retainedBundles?.[0];
    if (!oldBundle) throw new Error("real builder must return the old retained bundle");
    freezeTestInput(oldDocument);
    const bundleBytes = canonicalRecallJson(oldBundle), documentBytes = canonicalRecallJson(oldDocument);
    const draft = structuredClone(oldDocument);
    draft.snapshots.push(correctionSnapshot("snapshot-new"));
    const newDocument = freezeRecallSnapshotBundle(draft, "snapshot-new", { bundleId: "bundle-new", retainedAt: correctionAsOf, episode: newEpisode });
    expect(newDocument.retainedBundles).toHaveLength(2);
    const retainedOld = newDocument.retainedBundles?.find(b => b.id === "bundle-old");
    const newBundle = newDocument.retainedBundles?.find(b => b.id === "bundle-new");
    if (!retainedOld || !newBundle) throw new Error("both bound snapshots must retain their own evidence");
    expect(canonicalRecallJson(retainedOld)).toBe(bundleBytes);
    expect(oldBundle.executionEvidence).toEqual(captureRecallExecutionEvidence(oldEpisode));
    expect(newBundle.executionEvidence).toEqual(captureRecallExecutionEvidence(newEpisode));
    expect(newBundle.executionEvidence.digest).not.toBe(oldBundle.executionEvidence.digest);
    expect(oldBundle.executionEvidence.payload.executions[1].fee).toBe("invalid");
    expect(newBundle.executionEvidence.payload.executions[1].fee).toBe("2");
    for (const [bundle, fees, realizedNet, entryFee] of [[newBundle, "3", "17.5", "0.5"], [retainedOld, null, null, null], [newBundle, "3", "17.5", "0.5"]] as const) {
      expect(bundle.documentRevision).toBe(0); // Transient builder test, not a fabricated persisted acceptance.
      expect(bundle).not.toHaveProperty("actualMetrics");
      expect(bundle.executionEvidence.digest).toBe(sha256(canonicalRecallJson(bundle.executionEvidence.payload)));
      const actual = recallFromRetained(bundle);
      expect(actual.executionIds).toEqual(["buy", "sell"]);
      expect(actual.source).toEqual({ documentRevision: 0, evidenceDigest: bundle.executionEvidence.digest, bundleId: bundle.id, computedAt: correctionAsOf });
      expect(actual.metrics.remainingQuantity.value).toBe("1");
      expect(actual.metrics.averageEntryPrice.value).toBe("100");
      expect(actual.metrics.realizedGross.value).toBe("20");
      expect(actual.metrics.unrealizedGross.value).toBe("10");
      expect(actual.metrics.totalFees).toMatchObject({ value: fees, reason: fees === null ? "unknown-fees" : null });
      expect(actual.metrics.realizedNet).toMatchObject({ value: realizedNet, reason: realizedNet === null ? "unknown-fees" : null });
      expect(actual.metrics.remainingEntryFee).toMatchObject({ value: entryFee, reason: entryFee === null ? "unknown-fees" : null });
      expect(actual.metrics.netPnl).toMatchObject({ value: null, reason: "episode-open" });
    }
    expect(canonicalRecallJson(oldSource)).toBe(oldSourceBytes);
    expect(canonicalRecallJson(oldDocument)).toBe(documentBytes);
    expect(canonicalRecallJson(oldBundle)).toBe(bundleBytes);
    expect(canonicalRecallJson(oldRaw)).toBe(oldBytes);
    expect(canonicalRecallJson(newRaw)).toBe(newBytes);
  });
});
