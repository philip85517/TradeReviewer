import { describe, expect, it } from "vitest";
import type { DailyCandleRecord } from "../../lib/market/contracts";
import { buildInstrumentTradeSummaries } from "../../lib/trades/instruments";
import { buildTradeLibraryEntries } from "../../lib/trades/library";
import type { TradeExecution } from "../../lib/trades/types";
import { inspectHomepageV25PreparedSource, projectHomepageV25Boundaries } from "../../lib/reviews/homepage-v25-performance";
import {
  beginHomepagePeriodApply, beginHomepageRead, createHomepageState,
  type HomepageAttachments, type HomepagePeriod, type HomepageScope, type HomepageSnapshot,
} from "../../lib/reviews/homepage-v25-state";
import { ownHomepageFinancialSource } from "./financial-source-model";
import { homepageProducerRequestKey, type HomepageFinancialRawSource, type HomepageOwnedFinancialSource } from "./source-contract";
import { projectHomepageFinancialView } from "./financial-view-model";

const instrument = { id: "US:AAPL", symbol: "AAPL", name: "Apple", market: "US", currency: "USD" };
const emptyAttachments = (): HomepageAttachments => ({ categories: [], openOnly: false, pendingReview: [] });
const all = (): HomepagePeriod => ({ preset: "all", from: null, to: null });
const period = (from = "2026-01-05", to = "2026-01-07"): HomepagePeriod => ({ preset: "custom", from, to });
const fill = (id = "buy", executedAt = "2025-12-15T15:00:00Z", overrides: Partial<TradeExecution> = {}): TradeExecution => ({
  id, executedAt, instrument, accountId: "a", accountLabel: "A", side: "buy", quantity: "1", price: "100", fee: "0",
  ...overrides, source: { platform: "statement", row: 1, tradeNature: "live", ...overrides.source },
});
const quote = (tradingDate: string, close: string, security = instrument): DailyCandleRecord => ({
  instrumentId: security.id, tradingDate, open: close, high: close, low: close, close, volume: "1", currency: security.currency,
  adjustmentMode: "raw", provider: "eastmoney", providerSymbol: security.symbol, fetchedAt: `${tradingDate}T23:00:00Z`,
});
function raw(fills = [fill()], quotes = [quote("2026-01-02", "120"), quote("2026-01-05", "125"), quote("2026-01-06", "130")], extra: Partial<HomepageFinancialRawSource> = {}): HomepageFinancialRawSource {
  const candlesByInstrument: Record<string, DailyCandleRecord[]> = {};
  for (const row of quotes) (candlesByInstrument[row.instrumentId] ??= []).push(row);
  const entries = buildTradeLibraryEntries(buildInstrumentTradeSummaries(fills), candlesByInstrument, {});
  return { entries, asOf: "2026-01-07T08:00:00Z", reviewSummariesComplete: true,
    instrumentMetadata: Object.fromEntries(fills.map(row => [row.instrument.id, { market: row.instrument.market, symbol: row.instrument.symbol, assetType: "stock" as const }])),
    candlesByInstrument, marketDataStatuses: {}, fxObservations: [], currentFxSnapshot: null,
    lifetimeSourceCoverage: fills.slice(0, 1).map(row => ({ accountId: row.accountId, instrumentId: row.instrument.id, nature: "live" as const, simulationRunId: null,
      state: "complete" as const, coversInception: true, through: "2026-02-02T10:00:00Z", knownAt: "2025-01-01T00:00:00Z", evidenceIds: ["statement-inception"], reasons: [] })),
    revisions: { trades: "t1", metadata: "m1", quotes: "q1", fx: "f1" },
    universeCoverage: { state: "complete", knownAt: "2025-01-01T00:00:00Z", evidenceIds: ["stored-collection-read"], reasons: [] }, ...extra };
}
function snapshot(range = all(), scope: Partial<HomepageScope> = {}, attachments = emptyAttachments()): HomepageSnapshot {
  const rangeScope: HomepageScope = range.preset === "all"
    ? { live: true, market: "us", accounts: ["*"], rangeMode: "all" }
    : { live: true, market: "us", accounts: ["*"], rangeMode: "custom", from: range.from, to: range.to };
  return { ...createHomepageState({ ...rangeScope, ...scope }).snapshot, period: range, attachments };
}
function own(input = raw(), applied = snapshot()): HomepageOwnedFinancialSource {
  return ownHomepageFinancialSource(input, { scope: applied.scope, attachments: applied.attachments });
}
function local(source: HomepageOwnedFinancialSource, range = period(), startedAt = 100) {
  const state = createHomepageState(source.selection.scope);
  state.snapshot.attachments = structuredClone(source.selection.attachments);
  return { domain: "period" as const, request: beginHomepagePeriodApply(state, range, startedAt).requests.period! };
}
function global(acceptedSnapshot: HomepageSnapshot, original = acceptedSnapshot) {
  const state = createHomepageState(original.scope);
  state.snapshot = structuredClone(original);
  return { domain: "global" as const, request: beginHomepageRead(state, { purpose: "refresh" }, 100).requests.global!, acceptedSnapshot };
}

describe("homepage financial PeriodView producer", () => {
  it("P01 composes the literal CNY 30/-20/10 period from F without a second ledger", () => {
    const cny = { id: "CN-SH:600000", symbol: "600000", name: "Bank", market: "CN-SH", currency: "CNY" };
    const applied = snapshot(period("2026-01-06", "2026-01-30"), { market: "a" });
    const source = own(raw([fill("buy", "2025-12-15T02:00:00Z", { instrument: cny }), fill("sale", "2026-01-15T02:00:00Z", { instrument: cny, side: "sell", price: "130" })],
      [quote("2026-01-05", "120", cny)], { asOf: "2026-02-02T10:00:00Z" }), applied);
    const view = projectHomepageFinancialView(source, global(applied));
    expect(view.series?.periodSummary).toMatchObject({ periodRealized: { value: "30" }, unrealizedChange: { value: "-20" }, net: { value: "10" } });
    expect(view.current.currentMarketValue).toMatchObject({ value: "0", money: { targetCurrency: "CNY" } });
    expect(view.current).toBe(view.series?.current);
    expect(view.stamp).toMatchObject({ sourceId: source.prepared.sourceId, selectionKey: source.receipt.selectionKey, reportCurrency: "CNY" });
  });

  it("P03 keeps current and finite periods usable when only inception evidence is absent", () => {
    const source = own(raw(undefined, undefined, { lifetimeSourceCoverage: [] }));
    const view = projectHomepageFinancialView(source, local(source, all()));
    expect(view.bounds).toMatchObject({ state: "unknown", start: null, end: null });
    expect(view.series).toBeNull();
    expect(view.current.currentMarketValue.value).toBe("130");
    expect(view.reasons).toContain('group:["a","US:AAPL","live",null]:lifetime-coverage-missing-or-conflicting');
    const finite = projectHomepageFinancialView(source, local(source));
    expect(finite.series?.periodSummary?.net.value).toBe("10");
    expect(finite.current).toBe(view.current);
  });

  it("P04 distinguishes proven empty all/current zero from an unknown universe", () => {
    const empty = own(raw([], []));
    const known = projectHomepageFinancialView(empty, local(empty, all()));
    expect(known.bounds.state).toBe("empty"); expect(known.series).toBeNull();
    expect(known.current.currentMarketValue).toMatchObject({ value: "0", available: true });
    const unknown = own(raw([], [], { universeCoverage: { state: "unknown", knownAt: null, evidenceIds: [], reasons: ["collection-receipt-missing"] } }));
    const missing = projectHomepageFinancialView(unknown, local(unknown, all()));
    expect(missing.bounds.state).toBe("unknown"); expect(missing.series).toBeNull();
    expect(missing.current.currentMarketValue).toMatchObject({ value: null, available: false });
    expect(missing.current.currentUnrealized.value).toBeNull(); expect(missing.current.currentOpenFees.value).toBeNull();
    expect(missing.reasons).toContain("universe:unknown");
  });

  it("P04 never publishes the observed subset as a complete finite period", () => {
    const source = own(raw(undefined, undefined, { universeCoverage: { state: "partial", knownAt: "2025-01-01T00:00:00Z", evidenceIds: ["page-1"], reasons: ["page-2-unread"] } }));
    const view = projectHomepageFinancialView(source, local(source));
    expect(view.bounds).toEqual({ state: "known", start: "2026-01-05", end: "2026-01-07", reasons: [] });
    expect(view.series).toBeNull();
    expect(view.current.currentMarketValue).toMatchObject({ value: null, available: false, money: { originalByCurrency: { USD: "130" } }, coverage: { total: 1, available: 1 } });
    expect(view.current.instruments[0].currentMarketValue.value).toBe("130");
    expect(view.current.currentMarketValue.reasons).toContain("universe:partial");
  });

  it("P06 uses only the accepted snapshot range, including an authorized account fallback", () => {
    const accepted = snapshot(period());
    const original = snapshot(period("2025-12-15", "2026-01-06"), { accounts: ["removed-account"] });
    const source = own(raw(), accepted), query = global(accepted, original);
    const view = projectHomepageFinancialView(source, query);
    expect(view.range).toEqual(accepted.period);
    expect(view.series?.points.map(point => point.key)).toEqual(["2026-01-05", "2026-01-06", "2026-01-07"]);
    expect(view.series?.periodSummary?.net.value).toBe("10");
    expect(view.stamp.requestGeneration).toBe(homepageProducerRequestKey(query.request));
  });

  it("P07 explicitly reuses the same source across periods, ignoring its old route dates", () => {
    const source = own(raw(), snapshot(period("2025-12-15", "2025-12-16")));
    const first = projectHomepageFinancialView(source, local(source));
    const second = projectHomepageFinancialView(source, local(source, period("2026-01-07", "2026-01-07"), 200));
    expect(first.current).toBe(second.current);
    expect(first.current.currentMarketValue.value).toBe("130");
    expect([first.series?.periodSummary?.net.value, second.series?.periodSummary?.net.value]).toEqual(["10", "5"]);
    expect(second.stamp).toEqual({ ...first.stamp, requestGeneration: second.stamp.requestGeneration });
    expect(second.stamp.requestGeneration).not.toBe(first.stamp.requestGeneration);
  });

  it("P02 retains inclusive real dates, future nulls, and independently current 130", () => {
    const source = own(), query = local(source, period("2026-01-05", "2026-01-09"));
    const view = projectHomepageFinancialView(source, query);
    expect(view.series?.points.map(point => [point.key, point.net.value, point.state, point.plottable])).toEqual([
      ["2026-01-05", "0", "value", true], ["2026-01-06", "5", "value", true], ["2026-01-07", "10", "value", true],
      ["2026-01-08", null, "future", false], ["2026-01-09", null, "future", false],
    ]);
    expect(view.bounds).toEqual({ state: "known", start: "2026-01-05", end: "2026-01-09", reasons: [] });
    expect(view.series?.boundary).toMatchObject({ requestedEnd: "2026-01-09", effectiveEnd: "2026-01-07" });
    expect(view.current.currentMarketValue.value).toBe("130");
    expect(view.stamp.requestGeneration).toBe(view.series?.requestGeneration);
  });

  it("P02 uses real all bounds through asOf, never through the last trade", () => {
    const source = own(), view = projectHomepageFinancialView(source, local(source, all()));
    expect(view.bounds).toEqual({ state: "known", start: "2025-12-15", end: "2026-01-07", reasons: [] });
    expect(view.series?.points[0].key).toBe("2025-12-15");
    expect(view.series?.points.at(-1)?.key).toBe("2026-01-07");
    expect(view.current.currentMarketValue.value).toBe("130");
  });

  it("P04 keeps true empty finite zero while future remains null", () => {
    const source = own(raw([], [])), view = projectHomepageFinancialView(source, local(source, period("2026-01-07", "2026-01-08")));
    expect(view.series?.points.map(point => [point.net.value, point.state])).toEqual([["0", "value"], [null, "future"]]);
    expect(view.current.currentMarketValue.value).toBe("0");
    const unknown = own(raw([], [], { universeCoverage: { state: "unknown", knownAt: null, evidenceIds: [], reasons: [] } }));
    const missing = projectHomepageFinancialView(unknown, local(unknown));
    expect(missing.series).toBeNull(); expect(missing.current.currentMarketValue.value).toBeNull();
  });

  it("P05 distinguishes known category exclusion from unknown qualification", () => {
    const applied = snapshot(all(), {}, { ...emptyAttachments(), categories: ["etf"] });
    const excluded = own(raw(), applied), known = projectHomepageFinancialView(excluded, local(excluded, all()));
    expect(excluded.receipt.reasons).toContain('group:["a","US:AAPL","live",null]:category-mismatch');
    expect(known.bounds.state).toBe("empty"); expect(known.current.currentMarketValue.value).toBe("0");
    const unqualified = own(raw(undefined, undefined, { instrumentMetadata: {} }), applied);
    expect(unqualified.receipt.reasons).toContain('group:["a","US:AAPL","live",null]:category-unknown');
    const missing = projectHomepageFinancialView(unqualified, local(unqualified));
    expect(missing.series).toBeNull(); expect(missing.current.currentMarketValue.value).toBeNull();
    expect(missing.reasons).toContain('group:["a","US:AAPL","live",null]:category-unknown');
  });

  it("P05 also fails closed for pending-review and open qualification unknown", () => {
    const pendingRaw = raw(undefined, undefined, { reviewSummariesComplete: false });
    pendingRaw.entries[0].episodes = [];
    const pending = own(pendingRaw, snapshot(all(), {}, { ...emptyAttachments(), pendingReview: [true] }));
    const pendingView = projectHomepageFinancialView(pending, local(pending));
    expect(pendingView.series).toBeNull(); expect(pendingView.current.currentMarketValue.value).toBeNull();
    expect(pendingView.reasons).toContain('group:["a","US:AAPL","live",null]:pending-review-unknown');
    const input = raw();
    input.entries[0].executions.push({ ...input.entries[0].executions[0], quantity: "2" });
    const open = own(input, snapshot(all(), {}, { ...emptyAttachments(), openOnly: true }));
    const openView = projectHomepageFinancialView(open, local(open));
    expect(openView.series).toBeNull(); expect(openView.current.currentMarketValue.value).toBeNull();
    expect(openView.reasons).toContain('group:["a","US:AAPL","live",null]:open-unknown');
  });

  it("P05 preserves a positive pending witness even when the rest of the review summaries are incomplete", () => {
    const source = own(raw(undefined, undefined, { reviewSummariesComplete: false }), snapshot(all(), {}, { ...emptyAttachments(), pendingReview: [true] }));
    const view = projectHomepageFinancialView(source, local(source));
    expect(view.series?.periodSummary?.net.value).toBe("10");
    expect(view.current.currentMarketValue.value).toBe("130");
  });

  it("P08 stamps every original request field rather than only its generation", () => {
    const accepted = snapshot(period()), source = own(raw(), accepted), query = global(accepted);
    const requests = [query.request,
      { ...query.request, generation: query.request.generation + 1 },
      { ...query.request, startedAt: query.request.startedAt + 1 },
      { ...query.request, scopeKey: `${query.request.scopeKey}:different-host-token` },
      { ...query.request, target: { ...query.request.target, accounts: ["removed"] } },
      { ...query.request, purpose: "apply" as const },
    ];
    const stamps = requests.map(request => projectHomepageFinancialView(source, { ...query, request }).stamp.requestGeneration);
    expect(stamps).toEqual(requests.map(homepageProducerRequestKey));
    const localQuery = local(source, accepted.period);
    stamps.push(projectHomepageFinancialView(source, localQuery).stamp.requestGeneration);
    expect(new Set(stamps).size).toBe(7);
    expect(localQuery.request.generation).toBe(query.request.generation);
  });

  it.each([
    ["domain", { domain: "history" }], ["zero generation", { generation: 0 }], ["negative generation", { generation: -1 }],
    ["fractional generation", { generation: 1.5 }], ["unsafe generation", { generation: Number.MAX_SAFE_INTEGER + 1 }],
    ["NaN time", { startedAt: NaN }], ["infinite time", { startedAt: Infinity }], ["empty key", { scopeKey: " " }],
    ["invalid purpose", { purpose: "history" }], ["invalid target", { target: { market: "us" } }],
  ])("P08 rejects invalid global request %s", (_name, patch) => {
    const accepted = snapshot(), source = own(), query = global(accepted);
    const request = Object.assign({}, query.request, patch);
    expect(() => projectHomepageFinancialView(source, { ...query, request })).toThrow(expect.objectContaining({ code: "financial-view-request-invalid" }));
  });

  it.each([
    { preset: "custom", from: "2026-02-30", to: "2026-03-01" },
    { preset: "custom", from: "2026-01-09", to: "2026-01-05" },
    { preset: "all", from: "2026-01-05", to: null },
    { preset: "other", from: "2026-01-05", to: "2026-01-07" },
  ])("P08 rejects an invalid local range %j through S", target => {
    const source = own(), query = local(source);
    expect(() => projectHomepageFinancialView(source, { ...query, request: Object.assign({}, query.request, { target }) }))
      .toThrow(expect.objectContaining({ code: "financial-view-range-invalid" }));
  });

  it("P08 rejects a local foreign selection key and global purpose on a local token", () => {
    const source = own(), query = local(source);
    expect(() => projectHomepageFinancialView(source, { ...query, request: { ...query.request, scopeKey: "another-selection" } }))
      .toThrow(expect.objectContaining({ code: "financial-view-selection-mismatch" }));
    expect(() => projectHomepageFinancialView(source, { ...query, request: { ...query.request, purpose: "refresh" } }))
      .toThrow(expect.objectContaining({ code: "financial-view-request-invalid" }));
    const other = own(raw(), snapshot(all(), { accounts: ["a"] }));
    expect(() => projectHomepageFinancialView(source, local(other)))
      .toThrow(expect.objectContaining({ code: "financial-view-selection-mismatch" }));
  });

  it.each(["trades", "metadata", "quotes", "fx"] as const)("P09 rejects source %s revision mismatch", key => {
    const source = own(), query = local(source);
    expect(() => projectHomepageFinancialView({ ...source, revisions: { ...source.revisions, [key]: "different" } }, query))
      .toThrow(expect.objectContaining({ code: "financial-view-revisions-mismatch" }));
  });

  it("P09 rejects source ID, currency, selection, invalid snapshot, and a forged F handle", () => {
    const source = own(), query = local(source);
    expect(() => projectHomepageFinancialView({ ...source, receipt: { ...source.receipt, sourceId: "other" } }, query))
      .toThrow(expect.objectContaining({ code: "financial-view-source-mismatch" }));
    expect(() => projectHomepageFinancialView({ ...source, reportCurrency: "CNY" }, query))
      .toThrow(expect.objectContaining({ code: "financial-view-currency-mismatch" }));
    expect(() => projectHomepageFinancialView(source, global(snapshot(all(), { accounts: ["a"] }))))
      .toThrow(expect.objectContaining({ code: "financial-view-selection-mismatch" }));
    expect(() => projectHomepageFinancialView(source, global(snapshot(all(), {}, { ...emptyAttachments(), categories: ["stock"] }))))
      .toThrow(expect.objectContaining({ code: "financial-view-selection-mismatch" }));
    const invalidSnapshot = { ...snapshot(), period: period() };
    expect(() => projectHomepageFinancialView(source, { ...global(snapshot()), acceptedSnapshot: invalidSnapshot }))
      .toThrow(expect.objectContaining({ code: "financial-view-snapshot-invalid" }));
    expect(() => projectHomepageFinancialView({ ...source, prepared: { ...source.prepared } }, query))
      .toThrow(expect.objectContaining({ code: "prepared-source-invalid" }));
  });

  it("P09 stamps only the actual F policies and one actual batch, with no policy injection", () => {
    const source = own(), query = local(source);
    expect(inspectHomepageV25PreparedSource(source.prepared).batchEntries).toBe(0);
    const view = projectHomepageFinancialView(source, query);
    expect(inspectHomepageV25PreparedSource(source.prepared).batchEntries).toBe(1);
    const batch = projectHomepageV25Boundaries(source.prepared, { periodStart: "2026-01-05", asOf: view.stamp.asOf,
      endpoints: ["2026-01-05", "2026-01-06", "2026-01-07"].map(key => ({ key, at: key })), targetCurrency: "USD" });
    expect(view.series?.points).toBe(batch.points); expect(view.current).toBe(batch.current);
    expect(view.stamp.policies).toBe(batch.policies); expect(view.stamp.revisions).toBe(batch.revisions);
    const injected = projectHomepageFinancialView(Object.assign({}, source, { policies: { finance: "obsolete" } }), query);
    expect(injected.stamp.policies).toBe(batch.policies);
    expect(Object.isFrozen(view.stamp.policies)).toBe(true);
    expect(() => Object.assign(view.stamp.policies, { finance: "obsolete" })).toThrow(TypeError);
  });

  it.each([
    ["2026-01-06", "2026-01-06T15:59:59.999Z", "2026-01-06"],
    ["2026-01-06T15:59:59.999Z", "2026-01-06T15:59:59.999Z", "2026-01-06"],
    ["2026-01-06T16:00:00Z", "2026-01-06T16:00:00.000Z", "2026-01-07"],
    ["2026-01-07T00:00:00+08:00", "2026-01-06T16:00:00.000Z", "2026-01-07"],
  ])("P10 preserves the explicit source clock %s", (asOf, instant, businessDay) => {
    const source = own(raw(undefined, undefined, { asOf }));
    const view = projectHomepageFinancialView(source, local(source, all()));
    expect(view.stamp.asOf).toBe(instant); expect(view.current.asOf).toBe(instant);
    expect(view.bounds.end).toBe(businessDay); expect(source.asOf).toBe(asOf);
    const unknown = own(raw(undefined, undefined, { asOf, lifetimeSourceCoverage: [] }));
    const currentOnly = projectHomepageFinancialView(unknown, local(unknown, all()));
    expect(currentOnly.series).toBeNull(); expect(currentOnly.bounds.start).toBeNull();
    expect(currentOnly.stamp.asOf).toBe(instant); expect(currentOnly.current).toEqual(view.current);
    expect(inspectHomepageV25PreparedSource(unknown.prepared).batchEntries).toBe(1);
  });

  it.each(["", "2026-02-30", "2026-01", "2026-01-06T08:00:00", "2026-02-30T08:00:00Z", "2026-01-06T24:00:00Z", "2026-01-06T25:00:00Z"])("P10 rejects a corrupted source clock %s", asOf => {
    const source = own();
    expect(() => projectHomepageFinancialView({ ...source, asOf }, local(source)))
      .toThrow(expect.objectContaining({ code: "financial-view-as-of-invalid" }));
  });

  it("P11 preserves native historical money when FX is unknown, independently of known current FX", () => {
    const applied = snapshot(period("2026-01-01", "2026-01-30"), { market: "all" });
    const source = own(raw([fill("buy", "2026-01-05T15:00:00Z")], [quote("2026-01-29", "110"), quote("2026-01-30", "120")], {
      asOf: "2026-02-02T10:00:00Z", currentFxSnapshot: {
        snapshot: { id: "latest", baseCurrency: "CNY", source: "broker", asOf: "2026-02-02T00:00:00Z", status: "complete", rates: { "USD/CNY": "7" } },
        fetchedAt: "2026-02-02T00:01:00Z", publishedAtByPair: { "USD/CNY": "2026-02-02T00:00:00Z" }, sourceRevision: "f1", evidenceIds: ["actual-latest-fetch"],
      },
    }), applied);
    const view = projectHomepageFinancialView(source, global(applied));
    expect(view.series?.periodSummary?.net).toMatchObject({ value: null, available: false, money: { originalByCurrency: { USD: "10" }, conversion: "missing" } });
    expect(view.series?.periodSummary?.fxCoverage.state).toBe("missing");
    expect(view.current.currentMarketValue).toMatchObject({ value: "840", money: { originalByCurrency: { USD: "120" }, fx: { id: "latest" } } });
    expect(view.current.currentUnrealized.value).toBe("140");
    expect(view.current).toBe(projectHomepageFinancialView(source, local(source, period("2026-01-31", "2026-02-01"))).current);
  });

  it("P12 retains the final missing point as summary instead of an earlier value", () => {
    const source = own(raw(undefined, [quote("2026-01-02", "120"), quote("2026-01-05", "125")]));
    const view = projectHomepageFinancialView(source, local(source, period("2026-01-05", "2026-01-09")));
    expect(view.series?.points[1].net.value).toBe("5");
    expect(view.series?.periodSummary).toBe(view.series?.points[2]);
    expect(view.series?.periodSummary).toMatchObject({ businessDate: "2026-01-07", state: "source-missing", net: { value: null } });
    expect(view.current.currentMarketValue.value).toBe("125");
    const future = projectHomepageFinancialView(source, local(source, period("2026-01-08", "2026-01-09")));
    expect(future.series?.periodSummary).toBeNull(); expect(future.series?.summaryState).toBe("future");
    expect(future.current).toBe(view.current);
  });

  it("P13 isolates requests and snapshots, freezes only owned output, and reuses F without a producer cache", () => {
    const accepted = snapshot(period()), source = own(raw(), accepted), query = global(accepted);
    const view = projectHomepageFinancialView(source, query), before = JSON.stringify(view);
    expect(Object.isFrozen(query.request)).toBe(false); expect(Object.isFrozen(accepted)).toBe(false);
    query.request.target.accounts.push("later"); query.request.startedAt = 999; accepted.period = all();
    expect(JSON.stringify(view)).toBe(before);
    for (const value of [view, view.range, view.bounds, view.bounds.reasons, view.stamp, view.reasons]) expect(Object.isFrozen(value)).toBe(true);
    expect(() => Object.assign(view.range, { from: "2000-01-01" })).toThrow(TypeError);
    expect(() => Object.assign(view.current.currentMarketValue, { value: "999" })).toThrow(TypeError);
    const first = projectHomepageFinancialView(source, local(source));
    const second = projectHomepageFinancialView(source, local(source));
    expect(first).not.toBe(second); expect(first).toEqual(second);
    expect(first.series?.points).toBe(second.series?.points); expect(first.current).toBe(second.current);
    const partial = own(raw(undefined, undefined, { universeCoverage: { state: "partial", knownAt: "2025-01-01T00:00:00Z", evidenceIds: ["page-1"], reasons: [] } }));
    const unknown = projectHomepageFinancialView(partial, local(partial));
    expect(Object.isFrozen(unknown.current)).toBe(true); expect(Object.isFrozen(unknown.current.currentMarketValue.reasons)).toBe(true);
    expect(() => unknown.current.currentMarketValue.reasons.push("late")).toThrow(TypeError);
    const original = projectHomepageV25Boundaries(partial.prepared, { periodStart: "2026-01-07", asOf: unknown.stamp.asOf, endpoints: [], targetCurrency: "USD" });
    expect(original.current.currentMarketValue.value).toBe("130");
    expect(unknown.current.instruments).toBe(original.current.instruments);
    expect(unknown.current.currentMarketValue.money).toBe(original.current.currentMarketValue.money);
  });
});
