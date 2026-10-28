import { homepageTestSnapshot } from "../../lib/storage/homepage-source-fixture.test-support";
import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import type { MonthlyStatement, StatementPosition } from "../../lib/import/monthly-statement";
import { encodeHomepageSourceBinding, type HomepageStoredCollection } from "../../lib/storage/homepage-source-contract";
import { buildCachedTradeLibraryEntries } from "../../lib/reviews/trade-library-entry-cache";
import type { FxState } from "../../lib/fx/room-contracts";
import type { ImportHistoryEntry } from "../../lib/storage/import-history";
import type { TradeExecution } from "../../lib/trades/types";
import { buildInstrumentTradeSummaries } from "../../lib/trades/instruments";
import { buildTradeLibraryEntries } from "../../lib/trades/library";
import { projectHomepageV25Boundaries } from "../../lib/reviews/homepage-v25-performance";
import { createEmptyEpisodeReviewRecord } from "../../lib/reviews/review-metrics";
import { ownHomepageFinancialSource } from "./financial-source-model";
import { buildHomepageFinancialAcquisition, prepareHomepageFinancialAcquisition, type HomepageFinancialAcquisitionInput } from "./financial-acquisition";

const requestedAt = "2026-10-23T12:00:00Z";
const observedAt = "2026-10-23T12:00:02Z";
const completedAt = "2026-10-23T12:00:03Z";
const publishedAt = "2026-10-23T11:30:00Z";
function fx(): FxState {
  return { id: "boc:attempt-at-noon", baseCurrency: "CNY", source: "BOC", status: "complete",
    publishedAt, publishedAtByCurrency: { USD: publishedAt, HKD: "2026-10-23T11:29:00Z" },
    fetchedAt: requestedAt, rates: { USD: "7.2", HKD: "0.9" }, lastAttemptDay: "2026-10-23", error: null };
}
function input(): HomepageFinancialAcquisitionInput {
  return { requestedAt, completedAt, fx: { state: fx(), observedAt }, entries: [], instrumentMetadata: new Map(),
    candlesByInstrument: {}, marketDataStatuses: {}, reviewSummariesComplete: true,
    provenance: { importHistory: [], reviews: [], reviewSummaries: [], storedInstruments: [], dailyCoverageByInstrument: {} } };
}
function fill(accountId = "A", symbol = "X", executedAt = "2026-10-01T01:00:00Z"): TradeExecution {
  return { id: `${accountId}-${symbol}-${executedAt}`, accountId, accountLabel: accountId,
    instrument: { id: symbol, symbol, name: symbol, market: "HK", currency: "HKD" },
    executedAt, side: "buy", price: "100", quantity: "1", fee: "0", source: { platform: "futu", row: 1, tradeNature: "live" } };
}
function withEntries(fills = [fill()]): HomepageFinancialAcquisitionInput {
  return { ...input(), entries: buildTradeLibraryEntries(buildInstrumentTradeSummaries(fills), {}, {}),
    instrumentMetadata: new Map([["X", { market: "HK", symbol: "X", assetType: "stock" }]]),
    candlesByInstrument: { X: [{ instrumentId: "X", tradingDate: "2026-10-23", open: "110", high: "110", low: "110", close: "110",
      volume: "1", currency: "HKD", adjustmentMode: "raw", provider: "eastmoney", providerSymbol: "X", fetchedAt: requestedAt }] } };
}
function project(candidate: HomepageFinancialAcquisitionInput) {
  const acquisition = buildHomepageFinancialAcquisition(candidate);
  const source = ownHomepageFinancialSource(acquisition.raw, {
    scope: { live: true, market: "all", accounts: ["*"], rangeMode: "all" },
    attachments: { categories: [], openOnly: false, pendingReview: [] },
  });
  return { acquisition, source, result: projectHomepageV25Boundaries(source.prepared, {
    periodStart: "2026-10-01", asOf: source.asOf, endpoints: [{ key: "day", at: "2026-10-23" }], targetCurrency: "CNY",
  }) };
}

describe("financial acquisition evidence Seam", () => {
  it("binds asOf to full completion, current knowledge to actual body observation, and retains provider attempt separately", () => {
    const candidate = input();
    const { raw, receipt } = buildHomepageFinancialAcquisition(candidate);
    expect(raw.asOf).toBe("2026-10-23T12:00:03Z");
    expect(raw.currentFxSnapshot).toMatchObject({ fetchedAt: "2026-10-23T12:00:02Z", snapshot: {
      id: "boc:attempt-at-noon", source: "BOC", baseCurrency: "CNY", asOf: "2026-10-23T11:30:00Z", status: "complete",
      rates: { "USD/CNY": "7.2", "HKD/CNY": "0.9" },
    }, publishedAtByPair: { "USD/CNY": "2026-10-23T11:30:00Z", "HKD/CNY": "2026-10-23T11:29:00Z" } });
    expect(receipt).toMatchObject({ policy: "acquisition-completed-v1", requestedAt, completedAt, fx: {
      observedAt, knowledgePolicy: "client-body-observed", upstreamFetchedAtSemantics: "provider-attempt-start",
      snapshotAsOfOrigin: "provider-published", reasons: [], state: fx(),
    } });
    expect(raw.currentFxSnapshot?.sourceRevision).toBe(receipt.fx?.sourceRevision);
    expect(raw.currentFxSnapshot?.evidenceIds).toEqual([receipt.fx?.evidenceId]);
    expect(raw.currentFxSnapshot?.evidenceIds[0]).toMatch(/^homepage-fx-observation-v1:[a-f0-9]{64}$/);
  });

  it("keeps the original FX body detached without freezing or mutating the caller", () => {
    const rates = { USD: "7.2", HKD: "0.9" };
    const publications = { USD: publishedAt, HKD: "2026-10-23T11:29:00Z" };
    const state = { ...fx(), rates, publishedAtByCurrency: publications };
    const original = structuredClone(state);
    const { raw, receipt } = buildHomepageFinancialAcquisition({ ...input(), fx: { state, observedAt } });
    expect(state).toEqual(original);
    expect(Object.isFrozen(state)).toBe(false);
    rates.USD = "999"; publications.HKD = completedAt;
    state.publishedAt = completedAt; state.error = "mutated later";
    expect(receipt.fx?.state).toEqual(original);
    expect(raw.currentFxSnapshot?.snapshot.rates).toEqual({ "USD/CNY": "7.2", "HKD/CNY": "0.9" });
  });

  it("never infers history, inception or a complete universe from a successful empty acquisition", () => {
    const { raw, receipt } = buildHomepageFinancialAcquisition({ ...input(), fx: null });
    expect(raw.entries).toEqual([]);
    expect(raw.currentFxSnapshot).toBeNull(); expect(receipt.fx).toBeNull();
    expect(raw.fxObservations).toEqual([]); expect(raw.lifetimeSourceCoverage).toEqual([]);
    expect(raw.universeCoverage).toEqual({ state: "unknown", knownAt: null, evidenceIds: [], reasons: ["stored-universe-coverage-unproved"] });
  });

  it("retains unknown universe/inception for standalone opening statements and explicit history gaps", () => {
    const candidate = input();
    const standalone: ImportHistoryEntry = {
      id: "statement-only", fileName: "opening.pdf", sourceLabel: "broker", sourceKind: "statement", importedAt: requestedAt,
      tradeCount: 0, instrumentCount: 1, excludedInstrumentCount: 0, excludedRecordCount: 0, duplicateTradeCount: 0, unresolvedInstrumentCount: 0,
      monthly: { documentId: "monthly", templateIds: ["broker-v1"], month: "2026-10", accountId: "A", reviewRequired: false,
        positions: [{ accountId: "A", market: "HK", symbol: "X", phase: "opening", date: "2026-10-01", quantity: "5", cost: "20", source: [{ page: 1, row: 1 }] }], events: [] },
    };
    const original = structuredClone(standalone);
    const absent = buildHomepageFinancialAcquisition(candidate).raw.revisions.trades;
    for (const monthly of [standalone.monthly, { ...standalone.monthly!, historyIncomplete: true, incompleteInstruments: [{ market: "HK", symbol: "X" }] }]) {
      const raw = buildHomepageFinancialAcquisition({ ...candidate, provenance: { ...candidate.provenance, importHistory: [{ ...standalone, monthly }] } }).raw;
      expect(raw.entries).toEqual([]); expect(raw.lifetimeSourceCoverage).toEqual([]);
      expect(raw.universeCoverage).toEqual({ state: "unknown", knownAt: null, evidenceIds: [], reasons: ["stored-universe-coverage-unproved"] });
      expect(raw.revisions.trades).not.toBe(absent);
    }
    expect(standalone).toEqual(original);
  });

  it("preserves original future carriers, initial positions and events for downstream ownership", () => {
    const carrier = fill("A", "X", "2026-11-01T01:00:00Z");
    carrier.source.statementPositions = [{ accountId: "A", market: "HK", symbol: "X", phase: "opening", date: "2026-10-01", quantity: "5", cost: "20", source: [{ page: 1, row: 1 }] }];
    const candidate = withEntries([carrier, fill("B", "Y")]);
    candidate.entries[0].episodes[0].episode.initialPosition = carrier.source.statementPositions[0];
    candidate.entries[0].episodes[0].episode.positionEvents = [{ id: "event", accountId: "A", market: "HK", symbol: "X", date: "2026-09", kind: "ipo", quantity: "5", description: "source", source: [{ page: 1, row: 2 }] }];
    const before = structuredClone(candidate.entries);
    const { raw } = buildHomepageFinancialAcquisition(candidate);
    expect(raw.entries).toBe(candidate.entries); expect(raw.entries).toEqual(before);
    expect(Object.isFrozen(candidate.entries[0])).toBe(false);
    const selected = ownHomepageFinancialSource(raw, { scope: { live: true, market: "all", accounts: ["A"], rangeMode: "all" }, attachments: { categories: [], openOnly: false, pendingReview: [] } });
    expect(selected.receipt.eligibleGroupKeys).toEqual(['["A","X","live",null]']);
    expect(selected.selectedEntries[0].executions[0].executedAt).toBe("2026-11-01T01:00:00Z");
    expect(selected.periodAllBounds.state).toBe("unknown"); expect(selected.historyAllBounds.state).toBe("unknown");
  });

  it.each(["", "2026-10-23", "2026-10-23T12:00:00", "2026-02-30T12:00:00Z", "2026-10-23T24:00:00Z", "2026-10-23T12:00:60Z", "2026-10-23T12:00:00+25:00"])("rejects invalid explicit acquisition time %s", bad => {
    expect(() => buildHomepageFinancialAcquisition({ ...input(), requestedAt: bad })).toThrow(/requestedAt/);
    expect(() => buildHomepageFinancialAcquisition({ ...input(), completedAt: bad })).toThrow(/completedAt/);
    expect(() => buildHomepageFinancialAcquisition({ ...input(), fx: { state: fx(), observedAt: bad } })).toThrow(/observedAt/);
  });

  it("accepts equal instants across explicit timezone offsets", () => {
    const { raw } = buildHomepageFinancialAcquisition({ ...input(), requestedAt: "2026-10-23T20:00:02+08:00", completedAt: observedAt });
    expect(raw.asOf).toBe(observedAt);
  });

  it("rejects reversed acquisition clocks without clipping any clock earlier", () => {
    expect(() => buildHomepageFinancialAcquisition({ ...input(), requestedAt: completedAt })).toThrow(/requestedAt.*observedAt/);
    expect(() => buildHomepageFinancialAcquisition({ ...input(), completedAt: requestedAt })).toThrow(/observedAt.*completedAt/);
    expect(() => buildHomepageFinancialAcquisition({ ...input(), fx: null, completedAt: "2026-10-22T12:00:00Z" })).toThrow(/requestedAt.*completedAt/);
  });

  it("labels snapshot fallback as client observation while leaving pair publication missing", () => {
    const state = { ...fx(), publishedAt: null, publishedAtByCurrency: { USD: publishedAt } };
    const { raw, receipt } = buildHomepageFinancialAcquisition({ ...input(), fx: { state, observedAt } });
    expect(raw.currentFxSnapshot?.snapshot.asOf).toBe(observedAt);
    expect(receipt.fx?.snapshotAsOfOrigin).toBe("client-observed");
    expect(receipt.fx?.state.publishedAt).toBeNull();
    expect(raw.currentFxSnapshot?.publishedAtByPair).toEqual({ "USD/CNY": publishedAt });
    expect(receipt.fx?.reasons).toContain("fx-pair-publication-missing:HKD/CNY");
  });

  it.each(["2026-10-23T12:00:02.001Z", "2026-02-30T12:00:00Z", "2026-10-23"])("keeps invalid/future provider snapshot time unknown: %s", at => {
    const state = { ...fx(), publishedAt: at };
    const { raw, receipt } = buildHomepageFinancialAcquisition({ ...input(), fx: { state, observedAt } });
    expect(raw.currentFxSnapshot).toBeNull(); expect(receipt.fx?.state.publishedAt).toBe(at);
    expect(receipt.fx?.reasons).toContain("fx-snapshot-publication-unusable");
  });

  it.each(["2026-10-23T12:00:02.001Z", "2026-02-30T12:00:00Z", "2026-10-23T11:30:00"])("does not let completion legalize pair publication unobserved at body capture: %s", at => {
    const state = { ...fx(), publishedAtByCurrency: { USD: publishedAt, HKD: at } };
    const { raw, receipt } = buildHomepageFinancialAcquisition({ ...input(), fx: { state, observedAt } });
    expect(raw.currentFxSnapshot?.publishedAtByPair).toEqual({ "USD/CNY": publishedAt });
    expect(receipt.fx?.state.publishedAtByCurrency.HKD).toBe(at);
    expect(receipt.fx?.reasons).toContain("fx-pair-publication-unusable:HKD/CNY");
  });

  it.each(["2026-10-23T12:00:02.001Z", "2026-02-30T12:00:00Z", "2026-10-23T11:30:00"])("preserves an unusable provider attempt clock without laundering it through client observation: %s", at => {
    const state = { ...fx(), fetchedAt: at };
    const { raw, receipt } = buildHomepageFinancialAcquisition({ ...input(), fx: { state, observedAt } });
    expect(raw.currentFxSnapshot).toBeNull(); expect(receipt.fx?.state.fetchedAt).toBe(at);
    expect(receipt.fx?.reasons).toContain("fx-provider-attempt-unusable");
  });

  it("rejects submillisecond observation beyond completion rather than truncating it to milliseconds", () => {
    expect(() => buildHomepageFinancialAcquisition({ ...input(), completedAt: "2026-10-23T12:00:02.000000001Z",
      fx: { state: fx(), observedAt: "2026-10-23T12:00:02.000000002Z" } })).toThrow(/observedAt.*completedAt/);
  });

  it("preserves partial/missing state and never inserts absent rates", () => {
    const state: FxState = { ...fx(), status: "partial", rates: { USD: "7.2" }, publishedAtByCurrency: { USD: publishedAt } };
    const partial = buildHomepageFinancialAcquisition({ ...input(), fx: { state, observedAt } });
    expect(partial.raw.currentFxSnapshot?.snapshot.status).toBe("partial");
    expect(partial.raw.currentFxSnapshot?.snapshot.rates).toEqual({ "USD/CNY": "7.2" });
    const absent = buildHomepageFinancialAcquisition({ ...input(), fx: { state: { ...state, status: "missing", rates: {} }, observedAt } });
    expect(absent.raw.currentFxSnapshot?.snapshot.status).toBe("missing");
    expect(absent.raw.currentFxSnapshot?.snapshot.rates).toEqual({});
  });

  it("retains failed-refresh old rates and original timestamps while identifying this observation as current only", () => {
    const state = { ...fx(), fetchedAt: "2026-10-22T10:00:00Z", lastAttemptDay: "2026-10-23", error: "provider timeout" };
    const { raw, receipt } = buildHomepageFinancialAcquisition({ ...input(), fx: { state, observedAt } });
    expect(receipt.fx?.state).toEqual(state);
    expect(raw.currentFxSnapshot?.fetchedAt).toBe(observedAt);
    expect(raw.currentFxSnapshot?.snapshot.rates).toEqual({ "USD/CNY": "7.2", "HKD/CNY": "0.9" });
    expect(raw.fxObservations).toEqual([]);
  });

  it("maps existing pair keys without inventing another pair or resolving conflicting aliases", () => {
    const state = { ...fx(), rates: { "USD/CNY": "7.2" }, publishedAtByCurrency: { "USD/CNY": publishedAt } };
    const mapped = buildHomepageFinancialAcquisition({ ...input(), fx: { state, observedAt } });
    expect(mapped.raw.currentFxSnapshot?.snapshot.rates).toEqual({ "USD/CNY": "7.2" });
    expect(mapped.raw.currentFxSnapshot?.publishedAtByPair).toEqual({ "USD/CNY": publishedAt });
    const conflict = { ...state, rates: { ...state.rates, USD: "7.3" } };
    const failed = buildHomepageFinancialAcquisition({ ...input(), fx: { state: conflict, observedAt } });
    expect(failed.raw.currentFxSnapshot).toBeNull();
    expect(failed.receipt.fx?.reasons).toContain("fx-pair-alias-conflict:USD/CNY");
  });

  it("uses literal current HKD conversion yet leaves historical FX and all-source coverage unknown", () => {
    const { source, result } = project(withEntries());
    expect(source.asOf).toBe(completedAt);
    expect(result.current.currentMarketValue.value).toBe("99");
    expect(result.current.currentUnrealized.value).toBe("9");
    expect(result.current.fxCoverage.pairKnowledge["HKD/CNY"]).toEqual({ publishedAt: "2026-10-23T11:29:00Z", knownAt: observedAt, fetchedAt: observedAt, source: "BOC" });
    expect(result.points[0].fxCoverage.state).toBe("missing");
    expect(result.points[0].marketValue.value).toBeNull();
    expect(source.periodAllBounds.state).toBe("unknown");
  });

  it("does not turn an eligible missing pair publication or partial snapshot into zero", () => {
    const candidate = withEntries();
    const missing = project({ ...candidate, fx: { state: { ...fx(), publishedAtByCurrency: { USD: publishedAt } }, observedAt } });
    expect(missing.result.current.currentMarketValue.value).toBeNull();
    const partial = project({ ...candidate, fx: { state: { ...fx(), status: "partial" }, observedAt } });
    expect(partial.result.current.currentMarketValue.value).toBeNull();
  });

  it("does not claim review-summary completeness when the actual summary response is absent", () => {
    const candidate = input();
    expect(() => buildHomepageFinancialAcquisition({ ...candidate, provenance: { ...candidate.provenance, reviewSummaries: null } })).toThrow(/reviewSummaries/);
    const raw = buildHomepageFinancialAcquisition({ ...candidate, reviewSummariesComplete: false, provenance: { ...candidate.provenance, reviewSummaries: null } }).raw;
    expect(raw.reviewSummariesComplete).toBe(false);
  });
});

describe("acquisition content revisions", () => {
  it("is stable across request clocks, object keys and Map insertion order", () => {
    const metadata = { market: "HK", symbol: "X", assetType: "stock" as const };
    const a = { ...input(), instrumentMetadata: new Map([["X", metadata], ["Y", { ...metadata, symbol: "Y" }]]) };
    const b = { ...a, requestedAt: "2026-10-23T11:59:59Z", completedAt: "2026-10-23T12:00:04Z",
      instrumentMetadata: new Map([["Y", { symbol: "Y", assetType: "stock" as const, market: "HK" }], ["X", { assetType: "stock" as const, symbol: "X", market: "HK" }]]) };
    expect(buildHomepageFinancialAcquisition(a).raw.revisions).toEqual(buildHomepageFinancialAcquisition(b).raw.revisions);
    expect(buildHomepageFinancialAcquisition(a).raw.revisions.metadata).not.toBe(buildHomepageFinancialAcquisition(input()).raw.revisions.metadata);
    const changed = { ...b, instrumentMetadata: new Map([["X", { ...metadata, assetType: "etf" as const }], ["Y", { ...metadata, symbol: "Y" }]]) };
    expect(buildHomepageFinancialAcquisition(changed).raw.revisions.metadata).not.toBe(buildHomepageFinancialAcquisition(a).raw.revisions.metadata);
  });

  it("versions original episode statements/events, reviews and imports even when fill IDs/counts do not change", () => {
    const original = withEntries();
    const revisions = buildHomepageFinancialAcquisition(original).raw.revisions;
    const position = { accountId: "A", market: "HK" as const, symbol: "X", phase: "opening" as const, date: "2026-10-01", quantity: "5", cost: "20", source: [{ page: 1, row: 1 }] };
    const statement = structuredClone(original);
    statement.entries[0].executions[0].source.statementPositions = [position];
    const event = structuredClone(original);
    event.entries[0].episodes[0].episode.positionEvents = [{ id: "event", accountId: "A", market: "HK", symbol: "X", date: "2026-10", kind: "ipo", quantity: "5", description: "original", source: [{ page: 1, row: 2 }] }];
    const initial = structuredClone(original); initial.entries[0].episodes[0].episode.initialPosition = position;
    const review = createEmptyEpisodeReviewRecord("episode", "X");
    const imports = { id: "import", fileName: "statement.pdf", sourceLabel: "broker", importedAt: requestedAt,
      tradeCount: 0, instrumentCount: 1, excludedInstrumentCount: 0, excludedRecordCount: 0, duplicateTradeCount: 0, unresolvedInstrumentCount: 0 };
    const candidates = [statement, event, initial,
      { ...original, provenance: { ...original.provenance, reviews: [review] } },
      { ...original, provenance: { ...original.provenance, importHistory: [imports] } },
      { ...original, provenance: { ...original.provenance, reviewSummaries: [{ episodeId: "episode", status: "in-progress" as const, updatedAt: requestedAt, text: "source note", snapshotCount: 0 }] } },
      { ...original, reviewSummariesComplete: false },
    ];
    for (const candidate of candidates) {
      const changed = buildHomepageFinancialAcquisition(candidate).raw.revisions;
      expect(changed.trades).not.toBe(revisions.trades);
      expect({ ...changed, trades: revisions.trades }).toEqual(revisions);
    }
  });

  it("versions full stored metadata and raw quote coverage without pretending either proves inception", () => {
    const original = withEntries();
    const revisions = buildHomepageFinancialAcquisition(original).raw.revisions;
    const stored = { ...fill().instrument, metadata: { market: "HK" as const, symbol: "X", name: "X", assetType: "stock" as const, source: "hkex" as const, confidence: "official" as const, resolvedAt: requestedAt } };
    const metadata = buildHomepageFinancialAcquisition({ ...original, provenance: { ...original.provenance, storedInstruments: [stored] } }).raw;
    expect(metadata.revisions.metadata).not.toBe(revisions.metadata);
    expect({ ...metadata.revisions, metadata: revisions.metadata }).toEqual(revisions);
    const coverage = buildHomepageFinancialAcquisition({ ...original, provenance: { ...original.provenance,
      dailyCoverageByInstrument: { X: [{ startDate: "2026-10-01", endDate: "2026-10-23", status: "complete", missingTradingDates: [], fetchedAt: requestedAt }] } } }).raw;
    expect(coverage.revisions.quotes).not.toBe(revisions.quotes);
    expect({ ...coverage.revisions, quotes: revisions.quotes }).toEqual(revisions);
    expect(coverage.lifetimeSourceCoverage).toEqual([]); expect(coverage.universeCoverage.state).toBe("unknown");
    const newClose = structuredClone(original); newClose.candlesByInstrument.X![0].close = "111";
    const status = { ...original, marketDataStatuses: { X: "source-unavailable" as const } };
    for (const changed of [newClose, status]) {
      const actual = buildHomepageFinancialAcquisition(changed).raw.revisions;
      expect(actual.quotes).not.toBe(revisions.quotes); expect({ ...actual, quotes: revisions.quotes }).toEqual(revisions);
    }
    const resolvedLater = { ...stored, metadata: { ...stored.metadata, resolvedAt: completedAt } };
    const actual = buildHomepageFinancialAcquisition({ ...original, provenance: { ...original.provenance, storedInstruments: [resolvedLater] } }).raw.revisions;
    expect(actual.metadata).not.toBe(metadata.revisions.metadata);
  });

  it("versions full FX original provenance and observation without contaminating other content versions", () => {
    const original = input();
    const revisions = buildHomepageFinancialAcquisition(original).raw.revisions;
    for (const state of [{ ...fx(), error: "failed refresh" }, { ...fx(), fetchedAt: null }, { ...fx(), lastAttemptDay: "2026-10-22" },
      { ...fx(), publishedAtByCurrency: { USD: publishedAt, HKD: "2026-10-23T11:28:00Z" } }]) {
      const changed = buildHomepageFinancialAcquisition({ ...original, fx: { state, observedAt } }).raw.revisions;
      expect(changed.fx).not.toBe(revisions.fx); expect({ ...changed, fx: revisions.fx }).toEqual(revisions);
    }
    const observedLater = buildHomepageFinancialAcquisition({ ...original, fx: { state: fx(), observedAt: completedAt } }).raw.revisions;
    expect(observedLater.fx).not.toBe(revisions.fx); expect({ ...observedLater, fx: revisions.fx }).toEqual(revisions);
  });
});


// These fixtures cross the real stored → statement authority → summaries → entries seam.
function storedFixture(executions: TradeExecution[] = [], monthly: MonthlyStatement[] = []): HomepageStoredCollection {
  const importHistory = monthly.map((item, index): ImportHistoryEntry => ({
    id: `import-${index}`, fileName: "statement.pdf", sourceLabel: "broker", sourceKind: "statement",
    importedAt: `2026-10-${String(10 + index).padStart(2, "0")}T12:00:00Z`, tradeCount: 0, instrumentCount: 1,
    excludedInstrumentCount: 0, excludedRecordCount: 0, duplicateTradeCount: 0, unresolvedInstrumentCount: 0, monthly: item,
  }));
  const instruments = [...new Map(executions.map(execution => [execution.instrument.id, execution.instrument])).values()];
  return bindStored({ bootstrap: { schemaVersion: 1, migration: null, executions, instruments, importHistory,
    reviews: [], reviewStates: [], tagSuggestions: [], marketDataJobs: [], settings: {} }, recallSummaries: [], receipt: {
    policy: "homepage-stored-collection-v1", scope: "all-persisted-records", enumeration: "complete", receiptId: "read-1",
    knownAt: "2026-10-23T12:00:01.000Z", counts: { executions: executions.length, instruments: instruments.length,
      importHistory: importHistory.length, legacyReviewRows: 0, recallDocuments: 0 }, projectionGaps: [], payloadDigest: "",
  } });
}
function bindStored(value: Omit<HomepageStoredCollection, "bookVersion" | "tradeReadPages">): HomepageStoredCollection {
  const bound = { ...value, ...homepageTestSnapshot(value.bootstrap) };
  return { ...bound, receipt: { ...bound.receipt, payloadDigest: `sha256:${createHash("sha256").update(encodeHomepageSourceBinding(bound)).digest("hex")}` } };
}
function monthlyPosition(symbol = "X", cost = "20"): StatementPosition {
  return { accountId: "A", market: "US", symbol, phase: "opening", date: "2026-10-01", quantity: "5", cost, source: [{ page: 1, row: 1 }] };
}
function monthlyFixture(positions: StatementPosition[] = [monthlyPosition()]): MonthlyStatement {
  return { documentId: "monthly", accountId: "A", month: "2026-10", templateIds: [], positions, events: [], reviewRequired: false };
}
function storedFill(symbol = "X"): TradeExecution {
  const execution = fill("A", symbol);
  return { ...execution, instrument: { id: `US:${symbol}`, market: "US", symbol, name: symbol, currency: "USD" } };
}
function completion(executions: readonly TradeExecution[], stored: HomepageStoredCollection) {
  const entries = buildCachedTradeLibraryEntries(undefined, buildInstrumentTradeSummaries([...executions]), {}, {},
    Object.fromEntries(stored.bootstrap.reviews.map(review => [review.episodeId, review])),
    Object.fromEntries(stored.recallSummaries.map(summary => [summary.episodeId, summary]))).entries;
  return { requestedAt, completedAt, fx: null, entries, instrumentMetadata: new Map(), candlesByInstrument: {},
    marketDataStatuses: {}, dailyCoverageByInstrument: {} };
}
function acquireStored(stored: HomepageStoredCollection) {
  const prepared = prepareHomepageFinancialAcquisition(stored);
  return prepared.complete(completion(prepared.executions, stored));
}

describe("stored representation real chain", () => {
  it("R01 proves a stored empty collection independently of inception", () => {
    const { raw, receipt } = acquireStored(storedFixture());
    expect(raw.entries).toEqual([]);
    expect(raw.universeCoverage.state).toBe("complete");
    expect(receipt.representation).toMatchObject({ state: "complete", gapCount: 0, gaps: [] });
    expect(raw.lifetimeSourceCoverage).toEqual([]);
    expect(raw.fxObservations).toEqual([]);
  });

  it("R02 retains a statement-only position5 gap instead of certifying empty inventory", () => {
    const { raw, receipt } = acquireStored(storedFixture([], [monthlyFixture()]));
    expect(raw.entries).toEqual([]);
    expect(raw.universeCoverage.state).toBe("unknown");
    expect(receipt.representation).toMatchObject({ state: "unknown", gapCount: 1 });
    expect(receipt.representation?.gaps).toEqual([expect.objectContaining({ reason: "no-original-carrier" })]);
  });

  it("R05 accepts actual scoped empty X replacement while retaining full Y evidence", () => {
    const full = monthlyFixture([monthlyPosition(), monthlyPosition("Y")]);
    const scoped = { ...monthlyFixture([]), evidenceScope: { accountId: "A", instrumentId: "US:X" } };
    const { raw, receipt } = acquireStored(storedFixture([storedFill(), storedFill("Y")], [full, scoped]));
    expect(receipt.representation?.state).toBe("complete");
    expect(raw.universeCoverage.state).toBe("complete");
    expect(raw.entries.find(entry => entry.instrument.id === "US:X")?.executions[0].source.statementPositions).toBeUndefined();
    expect(raw.entries.find(entry => entry.instrument.id === "US:Y")?.executions[0].source.statementPositions?.[0].cost).toBe("20");
  });

  it("R09 observes active equal-key different-cost positions before Map collapse", () => {
    const { raw, receipt } = acquireStored(storedFixture([storedFill()], [monthlyFixture([monthlyPosition(), monthlyPosition("X", "999")])]));
    expect(raw.universeCoverage.state).toBe("unknown");
    expect(receipt.representation?.state).toBe("unknown");
    expect(receipt.representation?.gaps).toContainEqual(expect.objectContaining({ reason: "active-payload-conflict" }));
  });

  it("R11 refuses assembly that loses an authority-produced attachment", () => {
    const stored = storedFixture([storedFill()], [monthlyFixture()]);
    const prepared = prepareHomepageFinancialAcquisition(stored);
    const final = completion(prepared.executions, stored);
    delete final.entries[0].executions[0].source.statementPositions;
    expect(() => prepared.complete(final)).toThrow(/assembly mismatch/i);
    expect(() => prepared.complete(final)).toThrow(/closed/i);
  });

  it("R14 refuses source mutation across the real summaries/IO seam", () => {
    const stored = storedFixture([storedFill()]);
    const prepared = prepareHomepageFinancialAcquisition(stored);
    const final = completion(prepared.executions, stored);
    stored.bootstrap.settings.changedDuringIo = true;
    expect(() => prepared.complete(final)).toThrow(/binding/i);
    expect(() => prepared.executions).toThrow(/closed/i);
  });
});


describe("stored representation completion boundaries", () => {
  it("R03 cannot represent an X IPO on the only Y carrier", () => {
    const monthly = { ...monthlyFixture([]), events: [{ id: "ipo", accountId: "A", market: "US", symbol: "X", date: "2026-10-01",
      kind: "ipo" as const, quantity: "2", amount: "-40", currency: "USD", description: "IPO", source: [] }] };
    const { raw, receipt } = acquireStored(storedFixture([storedFill("Y")], [monthly]));
    expect(raw.entries.map(entry => entry.instrument.id)).toEqual(["US:Y"]);
    expect(raw.entries[0].executions[0].source.positionEvents).toBeUndefined();
    expect(receipt.representation?.state).toBe("unknown");
    expect(raw.universeCoverage.state).toBe("unknown");
  });

  it.each(["account", "simulation", "unknown"])("R04 refuses a %s substitute for a live monthly carrier", variant => {
    const execution = storedFill();
    if (variant === "account") execution.accountId = "B";
    if (variant === "simulation") { execution.source.tradeNature = "simulation"; execution.source.simulationRunId = "run-1"; }
    if (variant === "unknown") delete execution.source.tradeNature;
    expect(acquireStored(storedFixture([execution], [monthlyFixture()])).raw.universeCoverage.state).toBe("unknown");
  });

  it("R06 honors newer full authority while preserving original fill identity", () => {
    const old = { ...monthlyFixture(), evidenceScope: { accountId: "A", instrumentId: "US:X" } };
    const execution = storedFill(); execution.source.statementPositions = old.positions.map(item => ({ ...item, documentId: "monthly" }));
    const { raw, receipt } = acquireStored(storedFixture([execution], [old, monthlyFixture([])]));
    expect(raw.entries[0].executions[0].id).toBe(execution.id);
    expect(raw.entries[0].executions[0].source.statementPositions).toBeUndefined();
    expect(receipt.representation?.state).toBe("complete");
  });

  it.each(["IPO subscription fee", "ordinary fee"])("R07/R08 preserves uncertainty for unassigned %s", description => {
    const monthly = { ...monthlyFixture([]), events: [{ id: "fee", accountId: "A", currency: "USD", date: "2026-10-01",
      kind: "fee" as const, amount: "-3", description, source: [] }] };
    const { raw, receipt } = acquireStored(storedFixture([storedFill()], [monthly]));
    expect(raw.universeCoverage.state).toBe("unknown");
    expect(raw.universeCoverage.reasons).toContain("unassigned-evidence-scope");
    expect(receipt.representation?.state).toBe(description.startsWith("IPO") ? "complete" : "unknown");
    if (description.startsWith("IPO")) expect(raw.entries[0].executions[0].source.positionEvents?.[0].amount).toBe("-3");
  });

  it("R10 distinguishes represented history flags from flags with no original carrier", () => {
    const monthly = { ...monthlyFixture([]), historyIncomplete: true };
    for (const executions of [[], [storedFill()]]) {
      const { raw, receipt } = acquireStored(storedFixture(executions, [monthly]));
      expect(raw.universeCoverage.state).toBe("unknown");
      expect(raw.universeCoverage.reasons).toContain("history-incomplete");
      expect(receipt.representation?.state).toBe(executions.length ? "complete" : "unknown");
    }
  });

  it.each(["delete", "replace", "duplicate", "episode-part"])("R11 rejects %s of original fills after real assembly", mutation => {
    const stored = storedFixture([storedFill()]); const prepared = prepareHomepageFinancialAcquisition(stored);
    const final = completion(prepared.executions, stored);
    if (mutation === "delete") final.entries[0].executions = [];
    if (mutation === "replace") final.entries[0].executions[0] = { ...final.entries[0].executions[0], id: "different-fill" };
    if (mutation === "duplicate") final.entries[0].executions.push(final.entries[0].executions[0]);
    if (mutation === "episode-part") final.entries[0].executions[0] = { ...final.entries[0].episodes[0].episode.executions[0], id: "original:part:0" };
    expect(() => prepared.complete(final)).toThrow(/assembly mismatch/i);
  });

  it("R12 keeps a future fill as carrier while F reveals only its earlier position evidence", () => {
    const execution = storedFill(); execution.executedAt = "2026-11-01T12:00:00Z"; execution.side = "sell";
    const stored = storedFixture([execution], [monthlyFixture()]); const prepared = prepareHomepageFinancialAcquisition(stored);
    const final = completion(prepared.executions, stored);
    final.instrumentMetadata.set("US:X", { market: "US", symbol: "X", assetType: "stock" });
    const { raw } = prepared.complete(final);
    const source = ownHomepageFinancialSource(raw, { scope: { live: true, market: "all", accounts: ["*"], rangeMode: "all" }, attachments: { categories: [], openOnly: false, pendingReview: [] } });
    const result = projectHomepageV25Boundaries(source.prepared, { periodStart: "2026-10-01", asOf: source.asOf, endpoints: [], targetCurrency: "USD" });
    expect(result.current.instruments[0].evidence.current.quantity).toBe("5");
    expect(result.current.instruments[0].evidence.current.executionIds).not.toContain(execution.id);
    expect(source.periodAllBounds.state).toBe("unknown");
  });

  it("R13 never certifies an apparently empty projected import as a true empty source", () => {
    const base = storedFixture([], [monthlyFixture([])]);
    const stored = bindStored({ ...base, receipt: { ...base.receipt, projectionGaps: ["import-0"] } });
    const { raw, receipt } = acquireStored(stored);
    expect(raw.universeCoverage.state).toBe("unknown");
    expect(receipt.representation?.gaps).toContainEqual({ sourceRef: "import:import-0", reason: "storage-projection-gap" });
  });

  it.each(["payload", "identity", "receipt"])("R14 rejects a pre-prepare %s change despite equal row counts", field => {
    const stored = storedFixture([storedFill()]);
    if (field === "payload") stored.bootstrap.executions[0].price = "999";
    if (field === "identity") stored.bootstrap.executions[0].id = "same-count-new-id";
    const altered = field === "receipt" ? { ...stored, receipt: { ...stored.receipt, receiptId: "new-read" } } : stored;
    expect(() => prepareHomepageFinancialAcquisition(altered)).toThrow(/binding/i);
  });

  it("R14 accepts object-key reordering but refuses a newly rehashed replacement during IO", () => {
    const base = storedFixture([storedFill()]);
    const reordered = { ...base, bootstrap: { ...base.bootstrap, settings: Object.fromEntries(Object.entries(base.bootstrap.settings).reverse()) } };
    const prepared = prepareHomepageFinancialAcquisition(reordered);
    const final = completion(prepared.executions, reordered);
    expect(prepared.complete(final).receipt.representation?.state).toBe("complete");
    const changed = storedFixture([storedFill()]); const handle = prepareHomepageFinancialAcquisition(changed);
    const next = completion(handle.executions, changed);
    changed.bootstrap.executions[0].price = "999";
    Object.assign(changed.receipt, bindStored(changed).receipt);
    expect(() => handle.complete(next)).toThrow(/binding/i);
  });

  it("R15 retains unsupported corporate-action evidence without certifying its universe", () => {
    const monthly = { ...monthlyFixture([]), events: [{ id: "action", accountId: "A", market: "US", symbol: "X", date: "2026-10-01",
      kind: "corporate-action" as const, description: "unknown action", source: [] }] };
    const { raw } = acquireStored(storedFixture([storedFill()], [monthly]));
    expect(raw.entries[0].executions[0].source.positionEvents?.[0].kind).toBe("corporate-action");
    expect(raw.universeCoverage.state).toBe("unknown");
    expect(raw.universeCoverage.reasons).toContain("unresolved-corporate-action");
  });

  it.each(["invalid-quantity", "invalid-date"])("R15 keeps %s visible to the existing assembler/F gate", variant => {
    const monthly = monthlyFixture();
    if (variant === "invalid-quantity") monthly.positions[0].quantity = "invalid";
    else monthly.positions[0].date = "invalid-date";
    const stored = storedFixture([storedFill()], [monthly]); const prepared = prepareHomepageFinancialAcquisition(stored);
    expect(prepared.executions[0].source.statementPositions?.[0]).toMatchObject(monthly.positions[0]);
    // The existing assembler explicitly rejects malformed raw arithmetic; preserve that gate.
    if (variant === "invalid-quantity") {
      expect(() => completion(prepared.executions, stored)).toThrow(/DecimalError.*Invalid argument/);
      prepared.dispose();
      expect(() => prepared.executions).toThrow(/closed/);
      return;
    }
    try {
      const final = completion(prepared.executions, stored);
      final.instrumentMetadata.set("US:X", { market: "US", symbol: "X", assetType: "stock" });
      const { raw } = prepared.complete({ ...final, candlesByInstrument: { "US:X": [{ instrumentId: "US:X",
        tradingDate: "2026-10-22", open: "110", high: "110", low: "110", close: "110", volume: "1",
        currency: "USD", adjustmentMode: "raw", provider: "eastmoney", providerSymbol: "X", fetchedAt: requestedAt }] } });
      const source = ownHomepageFinancialSource(raw, { scope: { live: true, market: "all", accounts: ["*"], rangeMode: "all" }, attachments: { categories: [], openOnly: false, pendingReview: [] } });
      const result = projectHomepageV25Boundaries(source.prepared, { periodStart: "2026-10-01", asOf: source.asOf, endpoints: [], targetCurrency: "USD" });
      expect(result.current.instruments[0].evidence.current.quote?.price).toBe("110");
      expect(result.current.currentMarketValue.value).toBeNull();
      expect(result.current.currentUnrealized.value).toBeNull();
      expect(result.current.instruments[0].evidence.current.quantity).toBeNull();
    } finally { prepared.dispose(); }
  });

  it("rejects zero-quantity-only input when the existing assembler has no original entry", () => {
    const execution = storedFill(); execution.quantity = "0";
    const stored = storedFixture([execution]); const prepared = prepareHomepageFinancialAcquisition(stored);
    const final = completion(prepared.executions, stored);
    expect(final.entries).toEqual([]);
    expect(() => prepared.complete(final)).toThrow(/assembly mismatch/i);
  });

  it("does not let demo exclusion dispose independent monthly evidence", () => {
    const execution = storedFill(); execution.source.platform = "demo";
    const stored = storedFixture([execution], [monthlyFixture()]); const prepared = prepareHomepageFinancialAcquisition(stored);
    expect(prepared.executions).toEqual([]);
    expect(prepared.complete(completion([], stored)).raw.universeCoverage.state).toBe("unknown");
    expect(acquireStored(storedFixture([execution])).raw.universeCoverage.state).toBe("complete");
  });

  it("keeps account and simulation-run originals distinct through the real assembler", () => {
    const a = storedFill(), b = { ...storedFill(), id: "B-X", accountId: "B" };
    const sim = { ...storedFill(), id: "sim-X", source: { ...a.source, tradeNature: "simulation" as const, simulationRunId: "run-1" } };
    const next = { ...sim, id: "sim-2-X", source: { ...sim.source, simulationRunId: "run-2" } };
    const { raw } = acquireStored(storedFixture([a, b, sim, next]));
    expect(raw.entries.flatMap(entry => entry.executions).map(execution => execution.id).sort()).toEqual([a.id, b.id, sim.id, next.id].sort());
    expect(raw.universeCoverage.state).toBe("complete");
  });

  it("bounds receipt diagnostics while retaining the full gap count and unknown state", () => {
    const positions = Array.from({ length: 100 }, (_, index) => monthlyPosition(`MISSING${index}`));
    const { receipt, raw } = acquireStored(storedFixture([], [monthlyFixture(positions)]));
    expect(receipt.representation).toMatchObject({ state: "unknown", gapCount: 100 });
    expect(receipt.representation?.gaps).toHaveLength(64);
    expect(raw.universeCoverage.reasons).toEqual(["no-original-carrier"]);
    expect(Object.keys(receipt.representation!).sort()).toEqual(["entriesRevision", "gapCount", "gaps", "payloadDigest", "policy", "state", "storedReceiptId"]);
  });

  it("closes after success, explicit cancellation, and clock/FX failures without changing borrowed executions", () => {
    const stored = storedFixture([storedFill()]);
    for (const mode of ["success", "cancel", "clock", "fx"] as const) {
      const prepared = prepareHomepageFinancialAcquisition(stored); const borrowed = prepared.executions;
      const before = structuredClone(borrowed); const final = completion(borrowed, stored);
      if (mode === "success") prepared.complete(final);
      if (mode === "cancel") prepared.dispose();
      if (mode === "clock") expect(() => prepared.complete({ ...final, completedAt: requestedAt })).toThrow(/knownAt/);
      if (mode === "fx") expect(() => prepared.complete({ ...final, fx: { state: fx(), observedAt: "2026-10-24T00:00:00Z" } })).toThrow(/observedAt/);
      prepared.dispose(); prepared.dispose();
      expect(borrowed).toEqual(before);
      expect(() => prepared.complete(final)).toThrow(/closed/i);
      expect(() => prepared.executions).toThrow(/closed/i);
    }
  });

  it("requires storage completion to lie inside actual acquisition clocks", () => {
    for (const knownAt of ["2026-10-23T11:59:59.999Z", "2026-10-23T12:00:03.001Z"]) {
      const base = storedFixture(); const stored = bindStored({ ...base, receipt: { ...base.receipt, knownAt } });
      expect(() => acquireStored(stored)).toThrow(/knownAt/);
    }
  });

  it("accepts actual clock equality and never borrows storage knownAt for missing FX publication", () => {
    const stored = storedFixture([storedFill()]); const prepared = prepareHomepageFinancialAcquisition(stored);
    const final = completion(prepared.executions, stored);
    const { raw, receipt } = prepared.complete({ ...final, requestedAt: stored.receipt.knownAt, completedAt: stored.receipt.knownAt,
      fx: { state: { ...fx(), publishedAt: null, publishedAtByCurrency: {} }, observedAt: stored.receipt.knownAt } });
    expect(raw.currentFxSnapshot?.publishedAtByPair).toEqual({});
    expect(receipt.fx?.snapshotAsOfOrigin).toBe("client-observed");
    expect(raw.fxObservations).toEqual([]);
    expect(raw.lifetimeSourceCoverage).toEqual([]);
  });

  it("rejects a missing receipt while preserving the legacy API's unknown behavior", () => {
    const stored = storedFixture(); const unproven = { bootstrap: stored.bootstrap, recallSummaries: [] };
    // Deliberately cross the runtime boundary without a receipt, as a legacy caller could.
    expect(() => Reflect.apply(prepareHomepageFinancialAcquisition, undefined, [unproven])).toThrow(/stored source/);
    expect(buildHomepageFinancialAcquisition(input()).raw.universeCoverage.state).toBe("unknown");
  });

  it("binds revision identity to the proof/read and obtains Recall provenance from that snapshot", () => {
    const a = storedFixture();
    const b = bindStored({ ...a, receipt: { ...a.receipt, receiptId: "read-2" } });
    const first = acquireStored(a), second = acquireStored(b);
    expect(first.raw.revisions.trades).not.toBe(second.raw.revisions.trades);
    expect(first.raw.revisions.trades).toBe(first.receipt.representation?.entriesRevision);
    expect(first.raw.reviewSummariesComplete).toBe(true);
    const recalled = bindStored({ ...a, recallSummaries: [{ episodeId: "episode", status: "completed", completedAt: requestedAt, updatedAt: requestedAt, text: "original review", snapshotCount: 1 }],
      receipt: { ...a.receipt, counts: { ...a.receipt.counts, recallDocuments: 1 } } });
    expect(acquireStored(recalled).raw.revisions.trades).not.toBe(first.raw.revisions.trades);
  });
});
