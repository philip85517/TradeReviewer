import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type { DailyCandleRecord } from "../../lib/market/contracts";
import type { TradingRoomInstrumentMetadata } from "../../lib/reviews/trading-room-scope";
import { beginHomepagePeriodApply, createHomepageState } from "../../lib/reviews/homepage-v25-state";
import { buildInstrumentTradeSummaries } from "../../lib/trades/instruments";
import { buildTradeLibraryEntries, type TradeLibraryEntry } from "../../lib/trades/library";
import type { TradeExecution } from "../../lib/trades/types";
import { projectHomepageV25Boundaries, readHomepageV25FinancialFacts, type LifetimeSourceCoverage } from "../../lib/reviews/homepage-v25-performance";
import { createEmptyEpisodeReviewRecord } from "../../lib/reviews/review-metrics";
import { ownHomepageFinancialSource } from "./financial-source-model";
import { projectHomepageFinancialView } from "./financial-view-model";
import { buildHomepageHoldings } from "./holdings-model";
import type { HomepageFinancialRawSource, HomepageFinancialSelection } from "./source-contract";

const asOf = "2026-10-23T12:00:00Z";
function fill(accountId = "A", instrumentId = "X", id = `${accountId}-${instrumentId}-buy`, at = "2026-10-01T01:00:00Z"): TradeExecution {
  return { id, accountId, accountLabel: accountId,
    instrument: { id: instrumentId, symbol: instrumentId, name: instrumentId, market: "HK", currency: "HKD" },
    side: "buy", executedAt: at, quantity: "1", price: "100", fee: "0",
    source: { platform: "futu", row: 1, tradeNature: "live" } };
}
function entries(fills: TradeExecution[]): TradeLibraryEntry[] {
  return buildTradeLibraryEntries(buildInstrumentTradeSummaries(fills), {}, {});
}
function selection(): HomepageFinancialSelection {
  return { scope: { live: true, market: "all", accounts: ["*"], rangeMode: "all" },
    attachments: { categories: [], openOnly: false, pendingReview: [] } };
}
function raw(source = entries([fill()])): HomepageFinancialRawSource {
  const coverage = new Map<string, LifetimeSourceCoverage>();
  for (const execution of source.flatMap(entry => entry.executions)) {
    const row: LifetimeSourceCoverage = { accountId: execution.accountId, instrumentId: execution.instrument.id,
      nature: execution.source.tradeNature ?? "unknown", simulationRunId: execution.source.simulationRunId ?? null,
      state: "complete", coversInception: true, through: asOf, knownAt: "2026-01-01T00:00:00Z",
      evidenceIds: ["complete-import"], reasons: [] };
    coverage.set(JSON.stringify([row.accountId, row.instrumentId, row.nature, row.simulationRunId]), row);
  }
  return { entries: source, asOf, reviewSummariesComplete: true, instrumentMetadata: {
    X: { market: "HK", symbol: "X", assetType: "stock" }, Y: { market: "HK", symbol: "Y", assetType: "etf" } },
    candlesByInstrument: {}, marketDataStatuses: {}, fxObservations: [], currentFxSnapshot: null,
    lifetimeSourceCoverage: [...coverage.values()], revisions: { trades: "t1", metadata: "m1", quotes: "q1", fx: "f1" },
    universeCoverage: { state: "complete", knownAt: "2026-01-01T00:00:00Z", evidenceIds: ["all-imports-read"], reasons: [] } };
}
function completeReview(source: TradeLibraryEntry[], account: string, instrument: string) {
  const item = source.flatMap(entry => entry.episodes).find(item => item.episode.accountId === account && item.episode.instrument.id === instrument)!;
  const record = createEmptyEpisodeReviewRecord(item.episode.id, instrument);
  item.review = { ...record, review: { ...record.review, completed: true } };
}
function current(source: ReturnType<typeof ownHomepageFinancialSource>) {
  return projectHomepageV25Boundaries(source.prepared, {
    periodStart: "2026-10-01", asOf: source.asOf.length === 10 ? `${source.asOf}T23:59:59.999+08:00` : source.asOf,
    endpoints: [], targetCurrency: source.reportCurrency,
  }).current;
}

describe("owned homepage financial source", () => {
  it("keeps A/X and B/Y complete pending lineages without admitting A/Y or B/X", () => {
    const source = entries([fill("A", "X"), fill("A", "Y"), fill("B", "X"), fill("B", "Y")]);
    completeReview(source, "A", "Y"); completeReview(source, "B", "X");
    const choice = selection(); choice.attachments.pendingReview = [true];
    const owned = ownHomepageFinancialSource(raw(source), choice);
    expect(owned.receipt.eligibleGroupKeys).toEqual(['["A","X","live",null]', '["B","Y","live",null]']);
    expect(owned.selectedEntries.flatMap(entry => entry.executions).map(item => item.id).sort()).toEqual(["A-X-buy", "B-Y-buy"]);
    expect(current(owned).instruments.map(item => [item.identity.accountId, item.identity.instrumentId])).toEqual([["A", "X"], ["B", "Y"]]);
    expect(owned.receipt.sourceId).toBe(owned.prepared.sourceId);
  });

  it("qualifies openOnly through F quantity, including shorts and missing-quote exposure", () => {
    const open = fill("A"), buy = fill("B"), sold = { ...fill("B", "X", "B-X-sell", "2026-10-02T01:00:00Z"), side: "sell" as const };
    const short = fill("C"); short.side = "sell"; short.source.positionEffect = "open-short";
    const uncertain = fill("D"), conflict = structuredClone(uncertain); conflict.quantity = "2";
    const source = entries([open, buy, sold, short, uncertain]);
    source.find(entry => entry.executions.some(item => item.accountId === "D"))!.executions.push(conflict);
    const choice = selection(); choice.attachments.openOnly = true;
    const owned = ownHomepageFinancialSource(raw(source), choice);
    expect(owned.selectedEntries.flatMap(entry => entry.executions).map(item => item.accountId)).toEqual(["A", "C"]);
    expect(current(owned).instruments.map(item => item.evidence.current.quantity)).toEqual(["1", "-1"]);
    expect(owned.receipt.reasons).toContain('group:["D","X","live",null]:open-unknown');
    expect(owned.periodAllBounds.state).toBe("unknown");
  });

  it("keeps a literal zero-unrealized position when openOnly uses nonzero F quantity", () => {
    const source = raw();
    const choice = selection(); choice.scope.market = "hk"; choice.attachments.openOnly = true;
    const owned = ownHomepageFinancialSource({ ...source, candlesByInstrument: { X: [{
      instrumentId: "X", tradingDate: "2026-10-23", open: "100", high: "100", low: "100", close: "100", volume: "1", currency: "HKD",
      adjustmentMode: "raw", provider: "eastmoney", providerSymbol: "X", fetchedAt: asOf,
    }] } }, choice);
    expect(owned.selectedEntries).toHaveLength(1);
    expect(current(owned).instruments[0].evidence.current.quantity).toBe("1");
    expect(current(owned).currentUnrealized.value).toBe("0");
  });

  it("does not infer pending=no from missing owned summary lineage", () => {
    const source = entries([fill()]); completeReview(source, "A", "X");
    const choice = selection(); choice.attachments.pendingReview = [false];
    expect(ownHomepageFinancialSource(raw(source), choice).selectedEntries).toHaveLength(1);
    const incomplete = ownHomepageFinancialSource({ ...raw(source), reviewSummariesComplete: false }, choice);
    expect(incomplete.selectedEntries).toEqual([]);
    expect(incomplete.periodAllBounds.state).toBe("unknown");
    expect(incomplete.receipt.reasons).toContain('group:["A","X","live",null]:pending-review-unknown');
  });

  it("combines category and resolved symbol predicates while retaining whole original groups", () => {
    const choice = { ...selection(), symbolInstrumentIds: ["Y"] }; choice.scope.symbolIdentity = "external:Y";
    choice.attachments.categories = ["etf"];
    const owned = ownHomepageFinancialSource(raw(entries([fill("A", "X"), fill("A", "Y"), fill("B", "Y")])), choice);
    expect(owned.receipt.eligibleGroupKeys).toEqual(['["A","Y","live",null]', '["B","Y","live",null]']);
    expect(owned.selectedEntries.flatMap(entry => entry.executions).map(item => item.id).sort()).toEqual(["A-Y-buy", "B-Y-buy"]);
  });

  it("preserves conflicting raw duplicates and episode-owned events, statements, IPO evidence, and metadata", () => {
    const source = entries([fill()]);
    const duplicate = structuredClone(source[0].executions[0]); duplicate.fee = "9";
    source[0].executions.push(duplicate); source[0].tradingLabel = "original imported lineage";
    const episode = source[0].episodes[0].episode;
    episode.initialPosition = { accountId: "A", market: "HK", symbol: "X", phase: "opening", date: "2026-09-30", quantity: "3", cost: "90", source: [{ page: 1, row: 2 }] };
    episode.positionEvents = [{ id: "allocation", accountId: "A", market: "HK", symbol: "X", date: "2026-09", kind: "ipo", quantity: "3", description: "original month evidence", source: [{ page: 1, row: 3 }] }];
    episode.ipoCostEvidence = [{ allocationId: "allocation", evidenceIds: ["cash-debit", "refund"] }];
    episode.executions[0].source.statementPositions = [episode.initialPosition];
    const owned = ownHomepageFinancialSource(raw(source), selection());
    expect(owned.selectedEntries).toEqual(source);
    expect(owned.selectedEntries[0]).not.toBe(source[0]);
    expect(owned.selectedEntries[0].executions.map(item => item.fee)).toEqual(["0", "9"]);
    expect(owned.selectedEntries[0].episodes[0].episode.ipoCostEvidence).toEqual([{ allocationId: "allocation", evidenceIds: ["cash-debit", "refund"] }]);
    expect(owned.periodAllBounds.state).toBe("unknown");
    expect(owned.historyAllBounds.state).toBe("unknown");
  });

  it("retains an episode with absent raw lineage without manufacturing raw fills from its parts", () => {
    const source = entries([fill()]); source[0].executions = [];
    const owned = ownHomepageFinancialSource(raw(source), selection());
    expect(owned.selectedEntries[0].executions).toEqual([]);
    expect(owned.selectedEntries[0].episodes).toEqual(source[0].episodes);
    expect(owned.periodAllBounds.state).toBe("unknown");
    expect(current(owned).instruments[0].evidence.current.reasons).toContain("execution-lineage-unavailable");
  });

  it("retains future evidence carriers and leaves their early attached evidence to F knowledge rules", () => {
    const carrier = fill("A", "X", "future-carrier", "2026-11-01T01:00:00Z");
    carrier.source.statementPositions = [{ accountId: "A", market: "HK", symbol: "X", phase: "opening", date: "2026-10-01", quantity: "5", cost: "20", source: [{ page: 1, row: 1 }] }];
    const source = raw(entries([carrier]));
    const choice = selection(); choice.scope.rangeMode = "date"; choice.scope.date = "2026-10-23";
    const owned = ownHomepageFinancialSource(source, choice);
    expect(owned.selectedEntries[0].executions.map(item => item.id)).toEqual(["future-carrier"]);
    expect(current(owned).instruments[0].evidence.current.quantity).toBe("5");
    expect(owned.periodAllBounds.state).toBe("unknown");
  });

  it("derives complete all bounds from raw Shanghai business days and covered asOf rather than last fill", () => {
    const source = raw(entries([fill("A", "X", "night", "2026-09-30T16:30:00Z")]));
    const owned = ownHomepageFinancialSource(source, selection());
    expect(owned.periodAllBounds).toEqual({ state: "known", start: "2026-10-01", end: "2026-10-23", reasons: [] });
    expect(owned.historyAllBounds).toEqual(owned.periodAllBounds);
  });

  it.each([["B", "X"], ["A", "Y"]])("does not use an attached event from %s/%s to widen A/X bounds", (accountId, symbol) => {
    const source = raw();
    source.entries[0].executions[0].source.positionEvents = [{ id: "other-lineage", accountId, market: "HK", symbol,
      date: "2026-08-01", kind: "fee", amount: "1", currency: "HKD", description: "other account or instrument", source: [{ page: 2, row: 8 }] }];
    const owned = ownHomepageFinancialSource(source, selection());
    expect(owned.periodAllBounds).toEqual({ state: "known", start: "2026-10-01", end: "2026-10-23", reasons: [] });
    expect(owned.selectedEntries[0].executions[0].source.positionEvents).toEqual(source.entries[0].executions[0].source.positionEvents);
  });

  it("preserves the day of date-precision fills", () => {
    const execution = fill("A", "X", "date-only", "2026-10-01"); execution.source.timePrecision = "date-only";
    execution.source.tradingDate = "2026-10-01";
    expect(ownHomepageFinancialSource(raw(entries([execution])), selection()).periodAllBounds.start).toBe("2026-10-01");
  });

  it.each(["execution-month", "calendar-month"])("does not promote %s date-only evidence into an exact inception day", kind => {
    const source = raw();
    const execution = source.entries[0].executions[0];
    execution.source.timePrecision = "date-only";
    if (kind === "execution-month") execution.executedAt = "2026-10";
    else execution.source.marketCalendarDate = "2026-10";
    const owned = ownHomepageFinancialSource(source, selection());
    expect(owned.periodAllBounds.state).toBe("unknown");
    expect(owned.periodAllBounds.start).toBeNull();
    expect(owned.periodAllBounds.reasons).toContain('group:["A","X","live",null]:execution-business-day-unproved');
    expect(owned.selectedEntries).toEqual(source.entries);
  });

  it.each([null, "2026-10-01", "2026-10-01T12:00:00", "2026-02-30T12:00:00Z"])("requires explicit legal knowledge instants rather than %s to certify source coverage", knownAt => {
    const source = raw();
    const universe = ownHomepageFinancialSource({ ...source, universeCoverage: { ...source.universeCoverage, knownAt } }, selection());
    expect(universe.receipt.universeComplete).toBe(false);
    expect(universe.periodAllBounds.state).toBe("unknown");
    const lifetime = ownHomepageFinancialSource({ ...source, lifetimeSourceCoverage: source.lifetimeSourceCoverage.map(row => ({ ...row, knownAt })) }, selection());
    expect(lifetime.periodAllBounds.state).toBe("unknown");
    expect(lifetime.periodAllBounds.reasons).toContain('group:["A","X","live",null]:lifetime-knowledge-unavailable');
  });

  it.each([{ symbol: "Y" }, { market: "US" }, {}])("does not certify an exact range from incompletely identified event %j", identity => {
    const source = raw();
    source.entries[0].executions[0].source.positionEvents = [{ id: "unattributed", accountId: "A", ...identity,
      date: "2026-08-01", kind: "fee", amount: "1", currency: "HKD", description: "unresolved instrument", source: [{ page: 2, row: 8 }] }];
    const owned = ownHomepageFinancialSource(source, selection());
    expect(owned.periodAllBounds.state).toBe("unknown");
    expect(owned.periodAllBounds.start).toBeNull();
    expect(owned.periodAllBounds.reasons).toContain('group:["A","X","live",null]:event-identity-unproved');
    expect(owned.selectedEntries).toEqual(source.entries);
  });

  it.each([
    ["partial universe", (source: HomepageFinancialRawSource) => ({ ...source, universeCoverage: { ...source.universeCoverage, state: "partial" as const } })],
    ["late universe knowledge", (source: HomepageFinancialRawSource) => ({ ...source, universeCoverage: { ...source.universeCoverage, knownAt: "2026-10-24T00:00:00Z" } })],
    ["missing universe provenance", (source: HomepageFinancialRawSource) => ({ ...source, universeCoverage: { ...source.universeCoverage, evidenceIds: [] } })],
    ["unknown lifetime", (source: HomepageFinancialRawSource) => ({ ...source, lifetimeSourceCoverage: source.lifetimeSourceCoverage.map(row => ({ ...row, state: "unknown" as const })) })],
    ["missing inception", (source: HomepageFinancialRawSource) => ({ ...source, lifetimeSourceCoverage: source.lifetimeSourceCoverage.map(row => ({ ...row, coversInception: false })) })],
    ["late lifetime knowledge", (source: HomepageFinancialRawSource) => ({ ...source, lifetimeSourceCoverage: source.lifetimeSourceCoverage.map(row => ({ ...row, knownAt: "2026-10-24T00:00:00Z" })) })],
    ["short coverage", (source: HomepageFinancialRawSource) => ({ ...source, lifetimeSourceCoverage: source.lifetimeSourceCoverage.map(row => ({ ...row, through: "2026-10-22" })) })],
    ["missing lifetime provenance", (source: HomepageFinancialRawSource) => ({ ...source, lifetimeSourceCoverage: source.lifetimeSourceCoverage.map(row => ({ ...row, evidenceIds: [] })) })],
    ["conflicting lifetime declarations", (source: HomepageFinancialRawSource) => ({ ...source, lifetimeSourceCoverage: [...source.lifetimeSourceCoverage, ...source.lifetimeSourceCoverage] })],
  ] as const)("keeps all bounds unknown for %s", (_label, change) => {
    const owned = ownHomepageFinancialSource(change(raw()), selection());
    expect(owned.periodAllBounds.state).toBe("unknown");
    expect(owned.periodAllBounds.start).toBeNull(); expect(owned.periodAllBounds.end).toBeNull();
    expect(owned.periodAllBounds.reasons.length).toBeGreaterThan(0);
    expect(owned.historyAllBounds).toEqual(owned.periodAllBounds);
  });

  it.each(["history-gap", "month-time", "invalid-day"])("does not manufacture inception for raw %s evidence", kind => {
    const source = raw(); const execution = source.entries[0].executions[0];
    if (kind === "history-gap") execution.source.historyIncomplete = ["statement-42"];
    if (kind === "month-time") execution.executedAt = "2026-10";
    if (kind === "invalid-day") execution.executedAt = "2026-02-30";
    const owned = ownHomepageFinancialSource(source, selection());
    expect(owned.periodAllBounds.state).toBe("unknown");
    expect(owned.periodAllBounds.start).toBeNull(); expect(owned.periodAllBounds.end).toBeNull();
  });

  it.each(["raw", "episode-part"])("keeps inception unknown for an opening statement owned by %s evidence", owner => {
    const source = raw();
    const opening = { accountId: "A", market: "HK", symbol: "X", phase: "opening" as const,
      date: "2026-09-30", quantity: "3", cost: "90", source: [{ page: 1, row: 2 }] };
    if (owner === "raw") source.entries[0].executions[0].source.statementPositions = [opening];
    else source.entries[0].episodes[0].episode.executions[0].source.openingPosition = opening;
    const owned = ownHomepageFinancialSource(source, selection());
    expect(owned.periodAllBounds.state).toBe("unknown");
    expect(owned.periodAllBounds.start).toBeNull(); expect(owned.historyAllBounds.start).toBeNull();
    expect(owned.selectedEntries).toEqual(source.entries);
  });

  it("distinguishes proved empty source and known-empty filters from incomplete or unknown-empty selection", () => {
    expect(ownHomepageFinancialSource(raw([]), selection()).periodAllBounds).toEqual({ state: "empty", start: null, end: null, reasons: [] });
    expect(ownHomepageFinancialSource({ ...raw([]), universeCoverage: { state: "unknown", knownAt: null, evidenceIds: [], reasons: ["read-incomplete"] } }, selection()).periodAllBounds.state).toBe("unknown");
    const filtered = selection(); filtered.attachments.categories = ["etf"];
    expect(ownHomepageFinancialSource(raw(), filtered).periodAllBounds.state).toBe("empty");
    const missing = ownHomepageFinancialSource({ ...raw(), instrumentMetadata: {} }, filtered);
    expect(missing.periodAllBounds.state).toBe("unknown");
    expect(missing.receipt.reasons).toContain('group:["A","X","live",null]:category-unknown');
  });

  it("accepts an explicit business-day asOf at Shanghai day close and retains the caller's date", () => {
    const source = raw(entries([fill("A", "X", "same-day", "2026-10-23T12:00:00Z")]));
    const choice = selection(); choice.attachments.openOnly = true;
    const owned = ownHomepageFinancialSource({ ...source, asOf: "2026-10-23", lifetimeSourceCoverage: source.lifetimeSourceCoverage.map(row => ({ ...row, through: "2026-10-23" })) }, choice);
    expect(owned.asOf).toBe("2026-10-23");
    expect(owned.selectedEntries).toHaveLength(1);
    expect(owned.periodAllBounds).toEqual({ state: "known", start: "2026-10-23", end: "2026-10-23", reasons: [] });
  });

  it.each(["", "2026-02-30", "2026-10", "2026-10-23T12:00:00", "2026-02-30T12:00:00Z", "2026-10-23T25:00:00Z"])("rejects invalid or unzoned asOf %s", value => {
    expect(() => ownHomepageFinancialSource({ ...raw(), asOf: value }, selection())).toThrow("as-of-invalid");
  });

  it("isolates all retained evidence, selection, receipt, coverage, and revisions without freezing callers", () => {
    const source = raw(); const choice = selection(); const revisions = { trades: "t1", metadata: "m1", quotes: "q1", fx: "f1" };
    const universeEvidence = ["all-imports-read"];
    const owned = ownHomepageFinancialSource({ ...source, revisions, universeCoverage: { ...source.universeCoverage, evidenceIds: universeEvidence } }, choice);
    const originalId = owned.prepared.sourceId; const originalSelectionKey = owned.receipt.selectionKey;
    source.entries[0].executions[0].quantity = "999";
    source.entries[0].episodes[0].episode.executions[0].source.historyIncomplete = ["caller-change"];
    choice.scope.accounts.push("B"); choice.attachments.categories.push("etf");
    revisions.trades = "t2"; universeEvidence.push("caller-added");
    expect(Object.isFrozen(source.entries[0])).toBe(false);
    expect(owned.selectedEntries[0].executions[0].quantity).toBe("1");
    expect(owned.selection.scope.accounts).toEqual(["*"]);
    expect(owned.coverage.universe.evidenceIds).toEqual(["all-imports-read"]);
    expect(owned.revisions.trades).toBe("t1");
    expect(owned.receipt.selectionKey).toBe(originalSelectionKey);
    expect(owned.prepared.sourceId).toBe(originalId);
    expect(() => { owned.selectedEntries[0].executions[0].quantity = "123"; }).toThrow(TypeError);
    expect(Object.isFrozen(owned.receipt.eligibleGroupKeys)).toBe(true);
    expect(Object.isFrozen(owned.periodAllBounds)).toBe(true);
    expect(current(owned).instruments[0].evidence.current.quantity).toBe("1");
  });

  it("binds receipt to F source and includes all selection predicates, symbol mapping, and source revisions", () => {
    const source = raw(); const base = ownHomepageFinancialSource(source, selection());
    const custom = selection(); custom.scope.rangeMode = "custom"; custom.scope.from = "2026-10-22"; custom.scope.to = "2026-10-23";
    const scoped = ownHomepageFinancialSource(source, custom);
    expect(scoped.selectedEntries[0].executions).toEqual(source.entries[0].executions);
    expect(scoped.receipt.selectionKey).not.toBe(base.receipt.selectionKey);
    expect(scoped.receipt.sourceId).toBe(scoped.prepared.sourceId);
    const mapping = { ...selection(), symbolInstrumentIds: ["X"] };
    expect(ownHomepageFinancialSource(source, mapping).receipt.selectionKey).not.toBe(base.receipt.selectionKey);
    const changed = ownHomepageFinancialSource({ ...source, revisions: { ...source.revisions, trades: "t2" } }, selection());
    expect(changed.prepared.sourceId).not.toBe(base.prepared.sourceId);
    expect(changed.receipt.sourceId).toBe(changed.prepared.sourceId);
  });

  it.each([["all", "CNY"], ["a", "CNY"], ["hk", "HKD"], ["us", "USD"]] as const)("uses %s report currency %s without creating FX evidence", (market, expected) => {
    const choice = selection(); choice.scope.market = market;
    const source = raw([]); const owned = ownHomepageFinancialSource(source, choice);
    expect(owned.reportCurrency).toBe(expected);
    expect(source.fxObservations).toEqual([]); expect(source.currentFxSnapshot).toBeNull();
  });

  it.each([
    ["all", ['["A","CNX","live",null]', '["A","HKX","live",null]', '["A","USX","live",null]']],
    ["a", ['["A","CNX","live",null]']],
    ["hk", ['["A","HKX","live",null]']],
    ["us", ['["A","USX","live",null]']],
  ] as const)("retains complete live group identities for %s scope and never admits foreign accounts or simulation runs", (market, expectedKeys) => {
    const cn = fill("A", "CNX"), hk = fill("A", "HKX"), us = fill("A", "USX");
    cn.instrument.market = "CN-SH"; cn.instrument.currency = "CNY";
    us.instrument.market = "US"; us.instrument.currency = "USD";
    const simulation = structuredClone(hk), secondRun = structuredClone(hk), unknown = structuredClone(hk);
    simulation.id = "sim-1"; simulation.source.tradeNature = "simulation"; simulation.source.simulationRunId = "run-1";
    secondRun.id = "sim-2"; secondRun.source.tradeNature = "simulation"; secondRun.source.simulationRunId = "run-2";
    unknown.id = "unknown"; unknown.source.tradeNature = "unknown";
    const choice = selection(); choice.scope.market = market; choice.scope.accounts = ["A"];
    const owned = ownHomepageFinancialSource(raw(entries([cn, hk, us, fill("B", "HKX"), simulation, secondRun, unknown])), choice);
    expect(owned.receipt.eligibleGroupKeys).toEqual(expectedKeys);
    expect(owned.selectedEntries.flatMap(entry => entry.executions).every(item => item.accountId === "A" && item.source.tradeNature === "live")).toBe(true);
    expect(current(owned).instruments.map(item => [item.identity.accountId, item.identity.instrumentId, item.identity.nature, item.identity.simulationRunId])).toEqual(expectedKeys.map(key => JSON.parse(key)));
  });

  it("retains unknown current valuation instead of converting missing quotes to zero", () => {
    const choice = selection(); choice.scope.market = "hk";
    const owned = ownHomepageFinancialSource(raw(), choice);
    const projection = current(owned);
    expect(projection.instruments[0].evidence.current.quantity).toBe("1");
    expect(projection.currentMarketValue.value).toBeNull();
    expect(projection.currentUnrealized.value).toBeNull();
    expect(projection.currentMarketValue.reasons.length).toBeGreaterThan(0);
  });
});

describe("qualification preserves unknown fees for the sole financial authority", () => {
  function quoted(source: TradeLibraryEntry[]): HomepageFinancialRawSource {
    return { ...raw(source), candlesByInstrument: { X: [{
      instrumentId: "X", tradingDate: "2026-10-23", open: "110", high: "110", low: "110", close: "110", volume: "1", currency: "HKD",
      adjustmentMode: "raw", provider: "eastmoney", providerSymbol: "X", fetchedAt: asOf,
    }] } };
  }
  function hkChoice(openOnly = false) {
    const choice = selection(); choice.scope.market = "hk"; choice.attachments.openOnly = openOnly;
    return choice;
  }
  function facts(source: ReturnType<typeof ownHomepageFinancialSource>) {
    return readHomepageV25FinancialFacts(source.prepared, { asOf: source.asOf, targetCurrency: source.reportCurrency });
  }

  it.each([
    ["invalid", false], ["invalid", true], ["-1", false], ["-1", true], ["NaN", false], ["NaN", true],
  ] as const)("keeps literal quantity, cost and value with raw fee %s and openOnly=%s", (fee, openOnly) => {
    const source = entries([{ ...fill(), quantity: "2.125" }]); source[0].executions[0].fee = fee;
    const owned = ownHomepageFinancialSource(quoted(source), hkChoice(openOnly));
    expect(owned.selectedEntries).toEqual(source);
    expect(owned.receipt.eligibleGroupKeys).toEqual(['["A","X","live",null]']);
    const result = current(owned), evidence = result.instruments[0].evidence.current;
    expect(evidence).toMatchObject({ quantity: "2.125", costKnown: true, feesKnown: false, openFees: null, reasons: expect.arrayContaining(["fees-invalid"]) });
    expect(result.currentMarketValue.value).toBe("233.75");
    expect(result.currentOpenFees.value).toBeNull(); expect(result.currentUnrealized.value).toBeNull();
    expect(facts(owned).groups[0].canonical.terminal.averageCost).toMatchObject({ available: true, value: "100" });
    expect(source[0].executions[0].fee).toBe(fee);
  });

  it("does not reinterpret canonical feeStatus unknown as an adapter-only fee error", () => {
    const execution = { ...fill(), quantity: "2.125" }; execution.source.feeStatus = "unknown";
    const owned = ownHomepageFinancialSource(quoted(entries([execution])), hkChoice(true));
    const result = current(owned);
    expect(result.instruments[0].evidence.current).toMatchObject({ quantity: "2.125", costKnown: false, feesKnown: false, reasons: expect.arrayContaining(["unknown-fees"]) });
    expect(result.currentMarketValue.value).toBe("233.75"); expect(result.currentUnrealized.value).toBeNull();
    expect(facts(owned).groups[0].canonical.terminal.averageCost).toMatchObject({ available: false, value: null });
    expect(owned.selectedEntries[0].executions[0].source.feeStatus).toBe("unknown");
  });

  it("leaves malformed reversal fees on original fills while F proves the current short quantity and cost", () => {
    const buy = { ...fill(), quantity: "2" };
    const reverse = { ...fill("A", "X", "reverse", "2026-10-02T01:00:00Z"), side: "sell" as const, quantity: "5", price: "120", fee: "5" };
    reverse.source.positionEffect = "open-short";
    const source = entries([buy, reverse]); reverse.fee = "invalid";
    const owned = ownHomepageFinancialSource(quoted(source), hkChoice(true));
    expect(owned.selectedEntries).toEqual(source);
    expect(owned.selectedEntries[0].executions.map(execution => [execution.id, execution.fee])).toEqual([[buy.id, "0"], ["reverse", "invalid"]]);
    expect(current(owned).instruments[0].evidence.current).toMatchObject({ quantity: "-3", costKnown: true, feesKnown: false, reasons: expect.arrayContaining(["fees-invalid"]) });
    expect(current(owned).currentUnrealized.value).toBeNull();
    expect(facts(owned).groups[0].canonical.terminal.averageCost).toMatchObject({ available: true, value: "120" });
  });

  it.each([["invalid", "fees-invalid"], ["2", "fees-conflict"]] as const)("preserves settlement fee %s and isolates its %s from a healthy account", (commission, reason) => {
    const source = entries([fill("A"), fill("B")]);
    source[0].executions[0].source.settlement = { currency: "HKD", quantity: "1", grossAmount: "100", netAmount: "102", fees: { commission } };
    const owned = ownHomepageFinancialSource(quoted(source), hkChoice());
    expect(owned.selectedEntries).toEqual(source);
    const result = current(owned);
    const affected = result.instruments.find(item => item.identity.accountId === "A")!;
    const healthy = result.instruments.find(item => item.identity.accountId === "B")!;
    expect(affected.evidence.current).toMatchObject({ quantity: "1", costKnown: true, feesKnown: false, reasons: expect.arrayContaining([reason]) });
    expect(affected.currentUnrealized.value).toBeNull(); expect(healthy.currentUnrealized.value).toBe("10");
    expect(result.currentMarketValue.value).toBe("220"); expect(result.currentUnrealized.value).toBeNull();
    expect(facts(owned).groups.map(group => group.canonical.terminal.averageCost.value)).toEqual(["100", "100"]);
  });

  it("retains malformed data under full-key selection and freezes its source stamp independently of caller mutation", () => {
    const simulation = fill("A", "X", "simulation"); simulation.source.tradeNature = "simulation"; simulation.source.simulationRunId = "run-1";
    const source = quoted(entries([fill("A"), fill("B"), simulation]));
    const revisions = { ...source.revisions };
    source.entries.find(entry => entry.executions.some(execution => execution.id === "A-X-buy"))!.executions[0].fee = "invalid";
    const choice = hkChoice(true); choice.scope.accounts = ["A"];
    const owned = ownHomepageFinancialSource({ ...source, revisions }, choice), observation = facts(owned), before = structuredClone(owned.selectedEntries);
    expect(owned.receipt.eligibleGroupKeys).toEqual(['["A","X","live",null]']);
    expect(owned.selectedEntries.flatMap(entry => entry.executions).map(execution => execution.id)).toEqual(["A-X-buy"]);
    expect(observation.sourceId).toBe(owned.receipt.sourceId); expect(observation.sourceId).toBe(owned.prepared.sourceId);
    expect(observation.revisions).toEqual(owned.revisions);
    const receipt = structuredClone(owned.receipt);
    source.entries.forEach(entry => entry.executions.forEach(execution => { execution.fee = "999"; }));
    revisions.trades = "caller-change"; choice.scope.accounts.push("B"); choice.attachments.openOnly = false;
    expect(owned.selectedEntries).toEqual(before); expect(owned.receipt).toEqual(receipt);
    expect(owned.revisions.trades).toBe("t1"); expect(Object.isFrozen(source.entries[0].executions[0])).toBe(false);
    expect(Object.isFrozen(owned.selectedEntries[0].executions[0])).toBe(true);
    expect(() => { owned.selectedEntries[0].executions[0].fee = "0"; }).toThrow(TypeError);
    expect(current(owned).currentUnrealized.value).toBeNull();
  });

  it("preserves valid partial-close fees and original full history under pending/category selection", () => {
    const buy = { ...fill(), quantity: "2", fee: "2" };
    const sell = { ...fill("A", "X", "sell", "2026-10-02T01:00:00Z"), side: "sell" as const, price: "120", fee: "1" };
    const source = quoted(entries([buy, sell])); const choice = hkChoice(true);
    choice.attachments.categories = ["stock"]; choice.attachments.pendingReview = [true];
    const owned = ownHomepageFinancialSource(source, choice), result = current(owned);
    expect(owned.selectedEntries).toEqual(source.entries);
    expect(result.instruments[0].evidence.current).toMatchObject({ quantity: "1", costKnown: true, feesKnown: true, openFees: "1" });
    expect(result.currentMarketValue.value).toBe("110"); expect(result.currentUnrealized.value).toBe("9");
    expect(facts(owned).groups[0].canonical.terminal.averageCost).toMatchObject({ available: true, value: "100" });
    expect(owned.receipt.selectionKey).toContain('"pendingReview":[true]');
  });
});


describe("S1 selective retained capture", () => {
  function captureFixture(openOnly = false) {
    const a = fill("A", "HK:00700"), b = fill("B", "HK:700");
    a.instrument.symbol = "00700"; a.instrument.name = "Tencent"; a.quantity = "2"; a.fee = "1";
    b.instrument.symbol = "700"; b.instrument.name = "Tencent"; b.quantity = "3"; b.price = "120"; b.fee = "2";
    const future = structuredClone(a); future.id = "future-carrier"; future.executedAt = "2026-11-02T01:00:00Z";
    const source = raw(entries([a, b, future, fill("C", "Y")]));
    const metadata = new Map<string, TradingRoomInstrumentMetadata>([
      [a.instrument.id, { market: "HK", symbol: "00700", assetType: "stock" }],
      [b.instrument.id, { market: "HK", symbol: "700", assetType: "stock" }],
      ["Y", { market: "HK", symbol: "Y", assetType: "etf" }],
    ]);
    const candles: Record<string, DailyCandleRecord[]> = {};
    for (const instrumentId of [a.instrument.id, b.instrument.id, "Y"]) candles[instrumentId] = [
      ["2026-10-21", "108"], ["2026-10-22", "109"], ["2026-10-23", "110"], ["2026-11-02", "999"],
    ].map(([tradingDate, close]) => ({ instrumentId, tradingDate, open: close, high: close, low: close, close,
      volume: "1", currency: "HKD", adjustmentMode: "raw", provider: "eastmoney", providerSymbol: instrumentId,
      fetchedAt: `${tradingDate}T10:00:00Z` }));
    const fx = {
      snapshot: { id: "current-fx", baseCurrency: "CNY" as const, asOf: "2026-10-23T11:00:00Z", source: "fixture",
        status: "complete" as const, rates: { "HKD/CNY": "0.9" } },
      fetchedAt: "2026-10-23T11:00:00Z", publishedAtByPair: { "HKD/CNY": "2026-10-23T10:00:00Z" },
      sourceRevision: "current-fx-v1", evidenceIds: ["observed-current-body"],
    };
    const historyFx = ["2026-10-21", "2026-10-22", "2026-10-23"].map(businessDate => ({
      id: `fx-${businessDate}`, source: "fixture", sourceRevision: "history-fx-v1", businessDate,
      rates: { "HKD/CNY": "0.9" }, status: "complete" as const,
      publishedAtByPair: { "HKD/CNY": `${businessDate}T10:00:00Z` },
      knownAtByPair: { "HKD/CNY": `${businessDate}T11:00:00Z` }, fetchedAt: `${businessDate}T11:00:00Z`, evidenceIds: ["history-body"],
    }));
    const lifetime = source.lifetimeSourceCoverage.map(row => ({ ...row, evidenceIds: [...row.evidenceIds], reasons: [...row.reasons] }));
    const universe = { ...source.universeCoverage, evidenceIds: [...source.universeCoverage.evidenceIds], reasons: [...source.universeCoverage.reasons] };
    const revisions = { ...source.revisions };
    const input: HomepageFinancialRawSource = { ...source, instrumentMetadata: metadata, candlesByInstrument: candles,
      currentFxSnapshot: fx, fxObservations: historyFx, lifetimeSourceCoverage: lifetime, universeCoverage: universe, revisions };
    const choice = selection(); choice.scope.accounts = ["A", "B"];
    choice.attachments.openOnly = openOnly;
    return { input, choice, metadata, candles, fx, historyFx, lifetime, universe, revisions };
  }

  function publicReadings(source: ReturnType<typeof ownHomepageFinancialSource>) {
    const state = createHomepageState(source.selection.scope); state.snapshot.attachments = structuredClone(source.selection.attachments);
    const request = beginHomepagePeriodApply(state, { preset: "custom", from: "2026-10-22", to: "2026-10-23" }, 1).requests.period!;
    const view = projectHomepageFinancialView(source, { domain: "period", request });
    const facts = readHomepageV25FinancialFacts(source.prepared, { asOf: view.current.asOf, targetCurrency: source.reportCurrency });
    return { source: { ...source, prepared: { sourceId: source.prepared.sourceId, revisions: source.prepared.revisions } },
      current: current(source), view, facts, holdings: buildHomepageHoldings(source, view, facts) };
  }

  it.each([false, true])("captures the complete candle graph only at F's required prepare calls, openOnly=%s", openOnly => {
    const { input, choice } = captureFixture(openOnly);
    const clone = vi.spyOn(globalThis, "structuredClone");
    try {
      const owned = ownHomepageFinancialSource(input, choice);
      const fullCaptures = clone.mock.calls.map(([value]) => value).filter(value => value && typeof value === "object" && "candlesByInstrument" in value);
      // A read-only call-through spy measures actual copying, without a clock or a fake F.
      expect(fullCaptures).toHaveLength(openOnly ? 2 : 1);
      expect(fullCaptures.every(value => value !== input)).toBe(true);
      for (const value of fullCaptures) expect(value).toMatchObject({ candlesByInstrument: input.candlesByInstrument,
        instrumentMetadata: input.instrumentMetadata, currentFxSnapshot: input.currentFxSnapshot, fxObservations: input.fxObservations });
      expect(owned.selectedEntries.flatMap(entry => entry.executions).map(row => row.id)).toContain("future-carrier");
      expect(owned.receipt.eligibleGroupKeys).toEqual(['["A","HK:00700","live",null]', '["B","HK:700","live",null]']);
      expect(current(owned).currentMarketValue.value).toBe("495");
    } finally { clone.mockRestore(); }
  });

  it.each([false, true])("preserves the complete pre-A1 public result with raw aliases, Map metadata and FX, openOnly=%s", openOnly => {
    const { input, choice } = captureFixture(openOnly);
    const readings = publicReadings(ownHomepageFinancialSource(input, choice));
    expect(readings.current.currentMarketValue.value).toBe("495");
    expect(readings.current.currentUnrealized.value).toBe("-11.7");
    expect(readings.holdings.rows.map(row => [row.accountId, row.instrumentId, row.quantity, row.averageCost]))
      .toEqual([["A", "HK:00700", "2", "100"], ["B", "HK:700", "3", "120"]]);
    // Full pre-A1 public graphs are retained with the RED evidence; this compatibility
    // digest includes every field, including F sourceId, Map-derived identity and diagnostics.
    expect(readings.source.prepared.sourceId).toBe("sha256:748090d19abd1561c3a34f5dc402b86eda5a24bba687d7f7b0d8b87f56277a8f");
    const digest = createHash("sha256").update(JSON.stringify(readings)).digest("hex");
    expect(digest).toBe(openOnly ? "4762ac9f4ace4c2e02ff7a8c28c9efe1a5d107c0c7391f47244a838c37ce6631" : "967a3302062236ef781f5aa9e076eed06d901a5e20898d9daecb3bf9f9bbe303");
  });

  it.each([false, true])("detaches every retained carrier and leaves cold prepared reads isolated from caller mutation, openOnly=%s", openOnly => {
    const fixture = captureFixture(openOnly), { input, choice, metadata, candles, fx, historyFx, lifetime, universe, revisions } = fixture;
    const execution = input.entries.flatMap(entry => entry.executions).find(row => row.id === "A-HK:00700-buy")!;
    const episode = input.entries.flatMap(entry => entry.episodes).find(row => row.episode.accountId === "A")!.episode;
    const position = { accountId: "A", market: "HK", symbol: "00700", phase: "opening" as const,
      date: "2026-09-30", quantity: "1", cost: "90", source: [{ page: 1, row: 1 }] };
    const event = { id: "foreign-evidence", accountId: "Other", market: "HK", symbol: "Y", date: "2026-09-30",
      kind: "fee" as const, amount: "3", currency: "HKD", description: "Retained foreign evidence", source: [{ page: 2, row: 1 }] };
    execution.source.statementPositions = [position]; execution.source.positionEvents = [event];
    execution.source.openingPosition = position; episode.initialPosition = position; episode.positionEvents = [event];
    episode.ipoCostEvidence = [{ allocationId: "allocation", evidenceIds: ["cash-debit"] }];
    const control = ownHomepageFinancialSource(input, choice), subject = ownHomepageFinancialSource(input, choice);
    // Subject's prepared handle is intentionally cold: caches cannot conceal an escaped caller reference.
    const before = publicReadings(control);
    for (const entry of input.entries) for (const row of entry.executions) { row.quantity = "999"; row.fee = "777"; }
    episode.executions[0].source.historyIncomplete = ["caller-change"];
    episode.ipoCostEvidence[0].evidenceIds.push("caller-added");
    position.quantity = "500"; position.source[0].page = 99; event.amount = "999";
    for (const rows of Object.values(candles)) for (const row of rows) {
      row.open = "999"; row.high = "999"; row.low = "999"; row.close = "999"; row.fetchedAt = "2099-01-01T00:00:00Z";
    }
    metadata.get("HK:00700")!.assetType = "etf"; metadata.clear();
    fx.snapshot.rates["HKD/CNY"] = "9"; fx.snapshot.asOf = "2099-01-01T00:00:00Z";
    fx.publishedAtByPair["HKD/CNY"] = "2099-01-01T00:00:00Z"; fx.fetchedAt = "2099-01-01T00:00:00Z";
    for (const row of historyFx) { row.rates["HKD/CNY"] = "9"; row.knownAtByPair["HKD/CNY"] = "2099-01-01T00:00:00Z"; }
    lifetime[0].evidenceIds.push("caller-added"); universe.evidenceIds.push("caller-added"); revisions.trades = "caller-change";
    choice.scope.accounts.push("C"); choice.attachments.categories.push("etf"); choice.attachments.openOnly = !openOnly;
    expect(publicReadings(subject)).toEqual(before);
    expect(subject.selectedEntries.flatMap(entry => entry.executions).find(row => row.id === execution.id)?.source.statementPositions?.[0]).toEqual({
      accountId: "A", market: "HK", symbol: "00700", phase: "opening", date: "2026-09-30", quantity: "1", cost: "90", source: [{ page: 1, row: 1 }],
    });
    expect(Object.isFrozen(execution)).toBe(false); expect(Object.isFrozen(position)).toBe(false);
    expect(Object.isFrozen(candles["HK:00700"][0])).toBe(false); expect(Object.isFrozen(metadata)).toBe(false);
    expect(Object.isFrozen(subject.selectedEntries[0].executions[0])).toBe(true);
    expect(Object.isFrozen(subject.coverage.universe.evidenceIds)).toBe(true);
  });
});
