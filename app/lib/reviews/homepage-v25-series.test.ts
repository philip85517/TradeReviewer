import { describe, expect, it } from "vitest";
import { buildInstrumentTradeSummaries } from "../trades/instruments";
import { buildTradeLibraryEntries } from "../trades/library";
import type { TradeExecution } from "../trades/types";
import type { DailyCandleRecord } from "../market/contracts";
import {
  inspectHomepageV25PreparedSource,
  prepareHomepageV25Source,
  projectHomepageV25Boundaries,
  type HistoricalFxObservation,
  type HomepageV25PrepareInput,
  type LifetimeSourceCoverage,
} from "./homepage-v25-performance";
import { buildHomepageV25Series, HOMEPAGE_V25_TOOLTIP_FIELDS } from "./homepage-v25-series";

const instrument = { id: "US:AAPL", symbol: "AAPL", name: "Apple", market: "US", currency: "USD" };
const fill = (id: string, executedAt: string, overrides: Partial<TradeExecution> = {}): TradeExecution => ({
  id, accountId: "a", accountLabel: "A", instrument, side: "buy", quantity: "1", price: "100", fee: "0", executedAt,
  ...overrides, source: { platform: "statement", row: 1, tradeNature: "live", ...overrides.source },
});
const raw = (tradingDate: string, close: string): DailyCandleRecord => ({
  instrumentId: instrument.id, tradingDate, open: close, high: close, low: close, close, volume: "1", currency: "USD",
  adjustmentMode: "raw", provider: "eastmoney", providerSymbol: "AAPL", fetchedAt: `${tradingDate}T23:00:00Z`,
});
const fullLifetime = (): LifetimeSourceCoverage => ({
  accountId: "a", instrumentId: instrument.id, nature: "live", simulationRunId: null, state: "complete", coversInception: true,
  through: "2026-02-02T10:00:00Z", knownAt: "2025-01-01T00:00:00Z", evidenceIds: ["import-complete"], reasons: [],
});
const observation = (businessDate: string, rate: string): HistoricalFxObservation => ({
  id: `fx-${businessDate}`, source: "broker-history", sourceRevision: "f1", businessDate, rates: { "USD/CNY": rate }, status: "complete",
  publishedAtByPair: { "USD/CNY": `${businessDate}T00:00:00Z` }, knownAtByPair: { "USD/CNY": `${businessDate}T00:00:00Z` },
  fetchedAt: `${businessDate}T00:00:00Z`, evidenceIds: [`fx-evidence-${businessDate}`],
});
function prepared(executions: TradeExecution[] = [], quotes: DailyCandleRecord[] = [], extra: Partial<HomepageV25PrepareInput> = {}) {
  const candlesByInstrument = { [instrument.id]: quotes };
  const summaries = buildInstrumentTradeSummaries(executions);
  const entries = buildTradeLibraryEntries(summaries, candlesByInstrument, { [instrument.id]: "ready" });
  return prepareHomepageV25Source({ entries, candlesByInstrument, fxObservations: [], currentFxSnapshot: null,
    lifetimeSourceCoverage: [fullLifetime()], revisions: { trades: "t1", metadata: "m1", quotes: "q1", fx: "f1" }, ...extra });
}
const query = { period: { start: "2026-01-06", end: "2026-01-30" }, asOf: "2026-02-02T10:00:00Z", requestGeneration: "g01" };
const closedFills = () => [fill("old-buy", "2025-12-15T15:00:00Z"), fill("sale", "2026-01-15T15:00:00Z", { side: "sell", price: "130" })];

describe("P2-B real prepared-source daily series", () => {
  it("O01 preserves historical day precision and clamps only today's point to the actual instant", () => {
    const source = prepared([
      fill("dated", "2026-01-05", { source: { platform: "statement", row: 1, timePrecision: "date-only", tradingDate: "2026-01-05" } }),
      fill("early", "2026-01-05T07:00:00Z"), fill("later", "2026-01-05T09:00:00Z"),
    ], [raw("2026-01-02", "110"), raw("2026-01-05", "120")]);
    const period = { start: "2026-01-05", end: "2026-01-05" };
    const historical = buildHomepageV25Series(source, { ...query, period, asOf: "2026-01-06T08:00:00Z" }).points[0];
    expect(historical).toMatchObject({ key: "2026-01-05", requestedAt: "2026-01-05", boundaryPrecision: "day", effectiveCursor: "2026-01-05T15:59:59.999Z" });
    expect(historical.instruments[0].evidence.endpoint.executionIds).toEqual(["early", "later", "dated"]);
    const current = buildHomepageV25Series(source, { ...query, period, asOf: "2026-01-05T08:00:00Z" });
    expect(current.points[0]).toMatchObject({ boundaryPrecision: "instant", effectiveCursor: "2026-01-05T08:00:00.000Z" });
    expect(current.points[0].instruments[0].evidence.endpoint.executionIds).toEqual(["early"]);
    expect(current.current.instruments[0].evidence.current.executionIds).toEqual(["early"]);
  });

  it("O02 includes the first Shanghai instant and changes the cutoff across one millisecond", () => {
    const source = prepared([fill("opening", "2026-01-04T15:59:59.999Z"), fill("first-day", "2026-01-04T16:00:00Z")]);
    const period = { start: "2026-01-04", end: "2026-01-05" };
    const before = buildHomepageV25Series(source, { ...query, period, asOf: "2026-01-04T15:59:59.999Z" });
    const at = buildHomepageV25Series(source, { ...query, period, asOf: "2026-01-04T16:00:00Z" });
    expect(before.boundary.effectiveEnd).toBe("2026-01-04");
    expect(before.points[1].state).toBe("future");
    expect(before.current.instruments[0].evidence.current.executionIds).toEqual(["opening"]);
    expect(at.boundary.effectiveEnd).toBe("2026-01-05");
    expect(at.points[1].effectiveCursor).toBe("2026-01-04T16:00:00.000Z");
    expect(at.points[1].instruments[0].evidence.endpoint.executionIds).toEqual(["opening", "first-day"]);
    const firstDay = buildHomepageV25Series(source, { ...query, period: { start: "2026-01-05", end: "2026-01-05" }, asOf: "2026-01-04T16:00:00Z" }).points[0];
    expect(firstDay.instruments[0].evidence.opening.executionIds).toEqual(["opening"]);
  });

  it("O03 enumerates inclusive cross-year days and exact common/leap years without presets", () => {
    const source = prepared();
    const week = buildHomepageV25Series(source, { ...query, period: { start: "2025-12-29", end: "2026-01-04" } });
    expect(week.points.map(point => point.businessDate)).toEqual(["2025-12-29", "2025-12-30", "2025-12-31", "2026-01-01", "2026-01-02", "2026-01-03", "2026-01-04"]);
    const common = buildHomepageV25Series(source, { ...query, period: { start: "2025-01-01", end: "2025-12-31" } });
    const leap = buildHomepageV25Series(source, { ...query, period: { start: "2024-01-01", end: "2024-12-31" } });
    expect(common.points).toHaveLength(365);
    expect([common.points[0].key, common.points[364].key]).toEqual(["2025-01-01", "2025-12-31"]);
    expect(leap.points).toHaveLength(366);
    expect(leap.points.filter(point => point.key === "2024-02-29")).toHaveLength(1);
    expect([leap.points[0].key, leap.points[365].key]).toEqual(["2024-01-01", "2024-12-31"]);
  });

  it.each([
    { start: "2026-02-29", end: "2026-03-01" },
    { start: "2026-01-01", end: "2026-02-30" },
    { start: "2026-1-01", end: "2026-01-02" },
    { start: "2026-01-02", end: "2026-01-01" },
  ])("O03 rejects invalid ranges atomically: $start → $end", period => {
    expect(() => buildHomepageV25Series(prepared(), { ...query, period })).toThrow(expect.objectContaining({ name: "HomepageV25ProjectionInputError", code: "period-invalid" }));
  });

  it("O03 retains the public A error when the required actual asOf is not an instant", () => {
    expect(() => buildHomepageV25Series(prepared(), { ...query, asOf: "2026-02-02" })).toThrow(expect.objectContaining({ code: "as-of-instant-required" }));
  });

  it("O04 retains future daily placeholders and a separately usable current projection", () => {
    const source = prepared([fill("old", "2025-12-15T15:00:00Z")], [raw("2026-01-02", "120"), raw("2026-01-05", "125"), raw("2026-01-06", "130")]);
    const input = { ...query, period: { start: "2026-01-05", end: "2026-01-09" }, asOf: "2026-01-07T08:00:00Z" };
    const result = buildHomepageV25Series(source, input);
    expect(result.boundary).toEqual({ businessTimezone: "Asia/Shanghai", asOf: "2026-01-07T08:00:00.000Z", periodStart: "2026-01-05", requestedEnd: "2026-01-09", effectiveEnd: "2026-01-07" });
    expect(result.points.map(point => [point.key, point.net.value, point.state, point.plottable])).toEqual([
      ["2026-01-05", "0", "value", true], ["2026-01-06", "5", "value", true], ["2026-01-07", "10", "value", true],
      ["2026-01-08", null, "future", false], ["2026-01-09", null, "future", false],
    ]);
    expect(result.periodSummary).toBe(result.points[2]);
    expect(result.summaryState).toBe("value");
    expect(result.points[2].effectiveCursor).toBe("2026-01-07T08:00:00.000Z");
    for (const point of result.points.slice(3)) {
      expect(point.effectiveCursor).toBeNull();
      for (const field of HOMEPAGE_V25_TOOLTIP_FIELDS) expect(point[field]).toMatchObject({ value: null, available: false, reasons: ["endpoint-future"] });
    }
    const future = buildHomepageV25Series(source, { ...input, period: { start: "2026-01-08", end: "2026-01-09" } });
    expect(future.boundary.effectiveEnd).toBeNull();
    expect(future.periodSummary).toBeNull();
    expect(future.summaryState).toBe("future");
    expect(future.current).toEqual(result.current);
    expect(future.current.currentMarketValue.value).toBe("130");
  });

  it("O04 uses the final nonfuture missing point as summary instead of an earlier plottable point", () => {
    const source = prepared([fill("old", "2025-12-15T15:00:00Z")], [raw("2026-01-02", "120"), raw("2026-01-05", "125")]);
    const result = buildHomepageV25Series(source, { ...query, period: { start: "2026-01-05", end: "2026-01-09" }, asOf: "2026-01-07T08:00:00Z" });
    expect(result.points[1].net.value).toBe("5");
    expect(result.periodSummary).toBe(result.points[2]);
    expect(result.summaryState).toBe("source-missing");
    expect(result.periodSummary).toMatchObject({ businessDate: "2026-01-07", state: "source-missing", plottable: false, net: { value: null } });
    expect(result.periodSummary?.instruments[0].quoteCoverage.endpoint).toMatchObject({ state: "missing-completed-session", selectedDate: "2026-01-05", requiredCompletedSession: "2026-01-06", missingSessions: ["2026-01-06"] });
    expect(result.current.currentMarketValue.value).toBe("125");
  });

  it("O05 publishes six distinct precise fields with original metric coverage and lifetime provenance", () => {
    const source = prepared(closedFills(), [raw("2026-01-02", "120")]);
    const result = buildHomepageV25Series(source, query), point = result.periodSummary!;
    expect(HOMEPAGE_V25_TOOLTIP_FIELDS).toEqual(["marketValue", "unrealizedNet", "lifetimeRealizedNet", "lifetimeNet", "net", "periodFees"]);
    expect(Object.isFrozen(HOMEPAGE_V25_TOOLTIP_FIELDS)).toBe(true);
    expect(result.tooltipFields).toBe(HOMEPAGE_V25_TOOLTIP_FIELDS);
    expect(result.tooltipFields.map(field => point[field].value)).toEqual(["0", "0", "30", "30", "10", "0"]);
    expect([point.periodRealized.value, point.openingUnrealized.value, point.closingUnrealized.value, point.unrealizedChange.value, point.net.value]).toEqual(["30", "20", "0", "-20", "10"]);
    for (const field of result.tooltipFields) expect(point[field]).toMatchObject({ available: true, coverage: { total: 1, available: 1 }, reasons: [], money: { targetCurrency: null } });
    expect(point.net.money.originalByCurrency).toEqual({ USD: "10" });
    expect(point.instruments[0].evidence.endpoint.executionIds).toEqual(["old-buy", "sale"]);
    expect(point.lifetimeCoverage[0].evidenceIds).toEqual(["import-complete"]);
    const changedStart = buildHomepageV25Series(source, { ...query, period: { start: "2026-01-16", end: "2026-01-30" } }).periodSummary!;
    expect([changedStart.lifetimeRealizedNet.value, changedStart.lifetimeNet.value, changedStart.net.value]).toEqual(["30", "30", "0"]);
  });

  it("O05 does not manufacture lifetime amounts from a complete selected-period result", () => {
    const point = buildHomepageV25Series(prepared(closedFills(), [raw("2026-01-02", "120")], { lifetimeSourceCoverage: [] }), query).periodSummary!;
    expect([point.lifetimeRealizedNet.value, point.lifetimeNet.value, point.net.value]).toEqual([null, null, "10"]);
    expect(point.lifetimeRealizedNet.reasons).toContain("lifetime-source-incomplete");
    expect(point.lifetimeNet.coverage).toEqual({ total: 1, available: 0 });
    expect(point.lifetimeCoverage[0].state).toBe("unknown");
  });

  it("O06 preserves partial-close fee allocation and actual period expenses without new arithmetic", () => {
    const source = prepared([fill("old", "2025-12-15T15:00:00Z", { quantity: "2", fee: "2" }), fill("partial", "2026-01-15T15:00:00Z", { side: "sell", price: "120", fee: "3" })], [raw("2026-01-02", "110"), raw("2026-01-29", "115")]);
    const result = buildHomepageV25Series(source, query), point = result.periodSummary!;
    expect([point.openingUnrealized.value, point.periodRealized.value, point.closingUnrealized.value, point.unrealizedChange.value, point.net.value, point.periodFees.value, point.openFees.value]).toEqual(["18", "16", "14", "-4", "12", "3", "1"]);
    expect(point.instruments[0].evidence.endpoint).toMatchObject({ executionIds: ["old", "partial"], quantity: "1", feesKnown: true, openFees: "1" });
    expect(result.feeFacts.find(fact => fact.lineage.executionIds.includes("partial"))).toMatchObject({ expense: "3", incurred: { businessDate: "2026-01-15" }, coverage: "complete" });
    const gapSource = prepared([fill("old", "2025-12-15T15:00:00Z", { quantity: "2", fee: "2" }), fill("partial", "2026-01-15T15:00:00Z", { side: "sell", price: "120", fee: "3" })], [raw("2026-01-02", "110"), raw("2026-01-28", "115")]);
    const gap = buildHomepageV25Series(gapSource, query).periodSummary!;
    expect([gap.marketValue.value, gap.unrealizedNet.value, gap.net.value, gap.periodRealized.value, gap.periodFees.value]).toEqual([null, null, null, "16", "3"]);
    expect(gap).toMatchObject({ state: "source-missing", plottable: false });
    expect(gap.instruments[0].evidence.endpoint.quote).toMatchObject({ date: "2026-01-28", price: "115", source: "eastmoney" });
  });

  it("O06 keeps genuine zero plottable and excludes future placeholders from arithmetic", () => {
    const source = prepared([fill("buy", "2026-01-05T15:00:00Z")], [raw("2026-01-29", "100")]);
    const result = buildHomepageV25Series(source, { ...query, period: { start: "2026-01-01", end: "2026-02-03" } });
    const zero = result.points.find(point => point.key === "2026-01-30")!;
    expect(zero).toMatchObject({ state: "value", plottable: true, net: { value: "0", available: true } });
    expect(result.points[result.points.length - 1]).toMatchObject({ state: "future", plottable: false, net: { value: null, available: false } });
  });

  it("O07 preserves native-first endpoint FX and its exact dated source", () => {
    const source = prepared(closedFills(), [raw("2026-01-02", "120")], { fxObservations: [observation("2026-01-05", "7"), observation("2026-01-30", "8")] });
    const point = buildHomepageV25Series(source, { ...query, targetCurrency: "CNY" }).periodSummary!;
    expect([point.periodRealized.value, point.openingUnrealized.value, point.closingUnrealized.value, point.unrealizedChange.value, point.net.value]).toEqual(["240", "160", "0", "-160", "80"]);
    expect(point.net.money.originalByCurrency).toEqual({ USD: "10" });
    expect(point.net.money).toMatchObject({ targetCurrency: "CNY", conversion: "complete", fx: { source: "broker-history", asOf: "2026-01-30T15:59:59.999Z" } });
    expect(point.fxCoverage).toMatchObject({ state: "complete", observationIds: ["fx-2026-01-30"], pairKnowledge: { "USD/CNY": { source: "broker-history", publishedAt: "2026-01-30T00:00:00Z", knownAt: "2026-01-30T00:00:00Z" } } });
  });

  it("O07 leaves latest-only historical FX unknown while current remains independent across periods", () => {
    const source = prepared([fill("buy", "2026-01-05T15:00:00Z")], [raw("2026-01-29", "110"), raw("2026-01-30", "120")], { currentFxSnapshot: {
      snapshot: { id: "latest", baseCurrency: "CNY", source: "broker", asOf: "2026-02-02T00:00:00Z", status: "complete", rates: { "USD/CNY": "7" } },
      fetchedAt: "2026-02-02T00:01:00Z", publishedAtByPair: { "USD/CNY": "2026-02-02T00:00:00Z" }, sourceRevision: "f1", evidenceIds: ["latest-fetch"],
    } });
    const first = buildHomepageV25Series(source, { ...query, period: { start: "2026-01-01", end: "2026-01-30" }, targetCurrency: "CNY" });
    const second = buildHomepageV25Series(source, { ...query, period: { start: "2026-01-31", end: "2026-02-01" }, targetCurrency: "CNY" });
    expect(first.periodSummary?.net).toMatchObject({ value: null, available: false, money: { originalByCurrency: { USD: "10" }, conversion: "missing" } });
    expect(first.periodSummary?.fxCoverage.state).toBe("missing");
    expect(first.current).toEqual(second.current);
    expect(first.current.currentMarketValue).toMatchObject({ value: "840", money: { originalByCurrency: { USD: "120" }, fx: { id: "latest", source: "broker" } } });
    expect(first.current.currentUnrealized.value).toBe("140");
    expect(first.current.instruments[0].evidence.current.quote?.date).toBe("2026-01-30");
  });

  it("O08 uses one real batch and wraps each generation without mutating the memoized authority", () => {
    const source = prepared(closedFills(), [raw("2026-01-02", "120")]);
    expect(inspectHomepageV25PreparedSource(source).batchEntries).toBe(0);
    const first = buildHomepageV25Series(source, query);
    expect(inspectHomepageV25PreparedSource(source).batchEntries).toBe(1);
    const second = buildHomepageV25Series(source, { ...query, requestGeneration: "g02" });
    const batch = projectHomepageV25Boundaries(source, { periodStart: query.period.start, asOf: query.asOf, endpoints: first.points.map(point => ({ key: point.key, at: point.key })) });
    expect(second).not.toBe(first);
    expect([first.requestGeneration, second.requestGeneration]).toEqual(["g01", "g02"]);
    expect(first.points).toBe(batch.points);
    expect(second.points).toBe(batch.points);
    expect(first.current).toBe(batch.current);
    expect(first.feeFacts).toBe(batch.feeFacts);
    expect(first.revisions).toBe(batch.revisions);
    expect(first.policies).toBe(batch.policies);
    expect(first.scope).toBe(batch.scope);
    expect(first.periodSummary).toBe(batch.points[batch.points.length - 1]);
    expect(batch).not.toHaveProperty("requestGeneration");
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.boundary)).toBe(true);
    expect(Object.isFrozen(first.periodSummary!.net.money.originalByCurrency)).toBe(true);
    expect(() => Object.assign(first, { requestGeneration: "late" })).toThrow(TypeError);
    expect(first.requestGeneration).toBe("g01");
    expect(second).toEqual({ ...first, requestGeneration: "g02" });
  });

  it("O08 preserves source identity invalidation despite unchanged caller revision strings", () => {
    const fills = [fill("buy", "2026-01-05T15:00:00Z")], quotes = [raw("2026-01-29", "110")];
    const firstSource = prepared(fills, quotes);
    quotes[0].close = "150";
    const secondSource = prepared(fills, quotes);
    const input = { ...query, period: { start: "2026-01-01", end: "2026-01-30" } };
    const first = buildHomepageV25Series(firstSource, input), second = buildHomepageV25Series(secondSource, { ...input, requestGeneration: "g02" });
    expect(first.revisions).toEqual(second.revisions);
    expect(first.sourceId).not.toBe(second.sourceId);
    expect([first.periodSummary?.net.value, second.periodSummary?.net.value]).toEqual(["10", "50"]);
    expect(buildHomepageV25Series(firstSource, input).periodSummary?.net.value).toBe("10");
  });
});
