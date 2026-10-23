import { describe, expect, it } from "vitest";
import { buildHomepageV25Performance, buildHomepageV25PerformanceFromEntries, type HomepageV25Input } from "./homepage-v25-performance";
import type { TradeExecution } from "../trades/types";
import { buildTradeLibraryEntries } from "../trades/library";
import { buildInstrumentTradeSummaries } from "../trades/instruments";
import type { DailyCandleRecord } from "../market/contracts";

const execution = (overrides: Partial<TradeExecution> & Pick<TradeExecution, "id" | "side" | "quantity" | "price" | "fee" | "executedAt">): TradeExecution => ({
  id: overrides.id,
  accountId: "account-a",
  accountLabel: "A",
  instrument: overrides.instrument ?? { id: "CN:AAA", symbol: "AAA", name: "AAA", market: "CN", currency: "CNY" },
  side: overrides.side,
  quantity: overrides.quantity,
  price: overrides.price,
  fee: overrides.fee,
  executedAt: overrides.executedAt,
  source: { platform: "statement", row: 1, tradeNature: "live", ...overrides.source },
});

const usdInstrument = { id: "US:AAPL", symbol: "AAPL", name: "Apple", market: "US", currency: "USD" };
const fill = (id: string, executedAt: string, overrides: Partial<TradeExecution> = {}): TradeExecution => ({
  id, accountId: "a", accountLabel: "A", instrument: usdInstrument, side: "buy", quantity: "1", price: "100", fee: "0", executedAt,
  ...overrides, source: { platform: "statement", row: 1, tradeNature: "live", ...overrides.source },
});
const raw = (date: string, close: string, instrument = usdInstrument): DailyCandleRecord => ({
  instrumentId: instrument.id, tradingDate: date, open: close, high: close, low: close, close, volume: "1", currency: instrument.currency,
  adjustmentMode: "raw", provider: "eastmoney", providerSymbol: instrument.symbol, fetchedAt: `${date}T23:00:00Z`,
});
function real(executions: TradeExecution[], overrides: Partial<HomepageV25Input> = {}, quotes = [raw("2025-12-31", "100"), raw("2026-01-30", "110")]) {
  const candlesByInstrument = Object.fromEntries([...new Set(quotes.map(item => item.instrumentId))].map(id => [id, quotes.filter(item => item.instrumentId === id)]));
  return buildHomepageV25Performance(base({ period: { start: "2026-01-01", end: "2026-01-31" }, asOf: "2026-01-31",
    entries: buildTradeLibraryEntries(buildInstrumentTradeSummaries(executions), candlesByInstrument, Object.fromEntries(executions.map(item => [item.instrument.id, "ready" as const]))),
    candlesByInstrument, ...overrides,
  }));
}

describe("homepage current projection contract", () => {
  it("publishes current net unrealized and open fees independently of the selected historical period", () => {
    const result = real([fill("buy", "2026-01-05T05:00:00Z", { quantity: "2", fee: "2" }), fill("future", "2026-02-05T05:00:00Z")], { period: { start: "2025-12-01", end: "2025-12-31" } });
    expect(result.currentUnrealized).toMatchObject({ value: "18", available: true, coverage: { total: 1, available: 1 } });
    expect(result.currentOpenFees).toMatchObject({ value: "2", available: true });
    expect(result.closingUnrealized.value).toBe("0");
    expect(result.instruments[0]).toMatchObject({ identity: { accountId: "a", instrumentId: "US:AAPL", nature: "live", simulationRunId: null },
      currentMarketValue: { value: "220" }, currentUnrealized: { value: "18" }, currentOpenFees: { value: "2" },
      evidence: { current: { executionIds: ["buy"], quantity: "2", feesKnown: true, openFees: "2", knowledgeCursor: "2026-01-31T15:59:59.999Z" } } });
  });
  it("exposes only the remaining fee pool after a partial close", () => {
    const result = real([fill("buy", "2026-01-05T05:00:00Z", { quantity: "2", fee: "2" }), fill("sell", "2026-01-10T05:00:00Z", { side: "sell", price: "120", fee: "1" })]);
    expect(result.currentUnrealized).toMatchObject({ value: "9" });
    expect(result.currentOpenFees).toMatchObject({ value: "1" });
    expect(result.instruments[0]).toMatchObject({ currentMarketValue: { value: "110" }, currentUnrealized: { value: "9" }, currentOpenFees: { value: "1" } });
    expect(result.periodRealized.value).toBe("18");
  });
  it("keeps trusted current market value when current fees are unavailable", () => {
    const result = real([fill("unknown-fees", "2026-01-05T05:00:00Z", { source: { platform: "statement", row: 1, feeStatus: "unknown" } })]);
    expect(result.currentUnrealized).toMatchObject({ value: null, available: false, reasons: expect.arrayContaining(["unknown-fees"]) });
    expect(result.currentOpenFees).toMatchObject({ value: null, available: false });
    expect(result.instruments[0]).toMatchObject({ currentMarketValue: { value: "110" }, currentUnrealized: { value: null }, currentOpenFees: { value: null } });
  });
  it("keeps per-account original money and the same production FX provenance for current metrics", () => {
    const fxSnapshot = { id: "current-fx", baseCurrency: "CNY" as const, asOf: "2026-01-31", source: "broker", status: "complete" as const, rates: { "USD:CNY": "7" } };
    const result = real([fill("a-buy", "2026-01-05T05:00:00Z", { fee: "1" }), fill("b-buy", "2026-01-05T05:00:00Z", { accountId: "b", fee: "2" })], { targetCurrency: "CNY", fxSnapshot });
    expect(result.currentUnrealized).toMatchObject({ value: "119", money: { originalByCurrency: { USD: "17" }, targetCurrency: "CNY", conversion: "complete", fx: { id: fxSnapshot.id, asOf: fxSnapshot.asOf, source: fxSnapshot.source, status: fxSnapshot.status } } });
    expect(result.currentOpenFees).toMatchObject({ value: "21", money: { originalByCurrency: { USD: "3" } } });
    expect(result.instruments.map(row => [row.identity.accountId, row.currentMarketValue.value, row.currentUnrealized.value, row.currentOpenFees.value])).toEqual([["a", "770", "63", "7"], ["b", "770", "56", "14"]]);
  });
  it("returns trusted current zero for truly flat inventory without requiring a quote", () => {
    const result = real([fill("buy", "2026-01-05T05:00:00Z", { fee: "2" }), fill("sell", "2026-01-10T05:00:00Z", { side: "sell", price: "120", fee: "1" })], {}, []);
    expect(result.currentUnrealized).toMatchObject({ value: "0", available: true });
    expect(result.currentOpenFees).toMatchObject({ value: "0", available: true });
    expect(result.instruments[0]).toMatchObject({ currentMarketValue: { value: "0" }, currentUnrealized: { value: "0" }, currentOpenFees: { value: "0" } });
  });
  it("classifies a missing current cutoff on every additive current metric", () => {
    const result = real([fill("buy", "2026-01-05T05:00:00Z")], { asOf: undefined });
    expect(result.currentUnrealized).toMatchObject({ value: null, reasons: ["as-of-required"] });
    expect(result.currentOpenFees).toMatchObject({ value: null, reasons: ["as-of-required"] });
  });
});

describe("homepage evidence-preserving financial contract", () => {
  // Each literal catches a boundary, evidence, accounting or money mutation;
  // all fixtures use the real library pipeline and no test doubles.
  it("uses Shanghai dates for precise fills even if a market-date label differs", () => {
    const result = real([fill("first", "2025-12-31T16:30:00Z", { source: { platform: "statement", row: 1, tradingDate: "2025-12-31" } })]);
    expect([result.openingUnrealized.value, result.net.value]).toEqual(["0", "10"]);
  });
  it("clamps the period and exposes its effective knowledge boundary", () => {
    const result = real([fill("known", "2026-01-15T15:00:00Z"), fill("future", "2026-02-02T15:00:00Z")], { period: { start: "2026-01-01", end: "2026-12-31" } });
    expect(result.net.value).toBe("10");
    expect(result.boundary).toMatchObject({ asOf: "2026-01-31", effectiveEnd: "2026-01-31", businessTimezone: "Asia/Shanghai" });
  });
  it("keeps current inventory at its own cutoff with a historical period", () => {
    const result = real([fill("known", "2026-01-15T15:00:00Z"), fill("future", "2026-02-02T15:00:00Z")], { period: { start: "2025-12-01", end: "2025-12-31" } });
    expect([result.net.value, result.currentMarketValue.value]).toEqual(["0", "110"]);
  });
  it("selects an eligible raw quote before considering later bars", () => {
    const result = real([fill("known", "2026-01-15T15:00:00Z")], {}, [raw("2026-01-30", "110"), raw("2026-02-02", "999")]);
    expect(result.currentMarketValue.value).toBe("110");
  });
  it("uses the pre-period mark so the first day's gain remains in the period", () => {
    const result = real([fill("old", "2025-12-15T15:00:00Z")], { period: { start: "2026-01-02", end: "2026-01-31" } }, [raw("2025-12-31", "100"), raw("2026-01-02", "120"), raw("2026-01-30", "130")]);
    expect([result.openingUnrealized.value, result.closingUnrealized.value, result.net.value]).toEqual(["0", "30", "30"]);
  });
  it("preserves date-only knowledge instead of inventing an intraday fill", () => {
    const dated = fill("dated", "2026-01-31", { source: { platform: "statement", row: 1, timePrecision: "date-only", tradingDate: "2026-01-31" } });
    expect(real([dated]).net.value).toBe("10");
    expect(real([dated], { asOf: "2026-01-31T12:00:00Z" }).currentMarketValue.value).toBe("0");
  });
  it("classifies a missing asOf instead of deriving current from the period", () => {
    const result = real([fill("known", "2026-01-15T15:00:00Z")], { asOf: undefined });
    expect(result.currentMarketValue.value).toBeNull();
    expect(result.currentMarketValue.reasons).toContain("as-of-required");
  });
  it("keeps a known current value usable when opening fees are unknown", () => {
    const result = real([fill("unknown-fees", "2026-01-15T15:00:00Z", { source: { platform: "statement", row: 1, feeStatus: "unknown" } })]);
    expect(result.net.value).toBeNull();
    expect(result.net.reasons).toContain("unknown-fees");
    expect(result.currentMarketValue.value).toBe("110");
  });
  it("exposes unavailable fee evidence rather than a numeric zero fee pool", () => {
    const result = real([fill("unknown-fees", "2026-01-15T15:00:00Z", { source: { platform: "statement", row: 1, feeStatus: "unknown" } })]);
    expect(result.instruments[0].evidence.current.openFees).toBeNull();
    expect(result.instruments[0].evidence.current.feesKnown).toBe(false);
    expect(result.instruments[0].evidence.current.knowledgeCursor).toBe("2026-01-31T15:59:59.999Z");
  });
  it.each([
    { label: "invalid", fee: "0", settlementFees: { commission: "unavailable" } },
    { label: "conflicting", fee: "2", settlementFees: { commission: "0" } },
  ])("preserves known canonical cost when only $label fees are unavailable", ({ fee, settlementFees }) => {
    const result = real([fill("fee-evidence", "2026-01-15T05:00:00Z", { fee, source: { platform: "statement", row: 1,
      settlement: { currency: "USD", quantity: "1", grossAmount: "100", netAmount: "100", fees: settlementFees },
    } })]);
    expect(result.instruments[0].evidence.current).toMatchObject({ quantity: "1", costKnown: true, feesKnown: false, openFees: null });
    expect(result.currentMarketValue.value).toBe("110");
    expect(result.net.value).toBeNull();
  });
  it.each([
    { label: "quantity", change: { quantity: "2" } },
    { label: "direction", change: { side: "sell" as const } },
    { label: "time", change: { executedAt: "2026-02-02T05:00:00Z" } },
  ])("does not publish arbitrary inventory from duplicate $label conflicts", ({ change }) => {
    const original = fill("same", "2026-01-15T05:00:00Z");
    const result = real([original, { ...original, ...change }]);
    expect(result.net.value).toBeNull();
    expect(result.currentMarketValue.value).toBeNull();
    expect(result.currentMarketValue.reasons).toContain("duplicate-execution-conflict");
    expect(result.instruments[0].evidence.current.quantity).toBeNull();
  });
  it.each([{ fee: "2" }, { price: "120" }, {}])("preserves known inventory for identical or money-only duplicate differences %j", change => {
    const original = fill("same", "2026-01-15T05:00:00Z");
    expect(real([original, { ...original, ...change }]).currentMarketValue.value).toBe("110");
  });
  it("preserves uncertain quantity and its original reason", () => {
    const result = real([fill("unknown", "2026-01-15T15:00:00Z", { source: { platform: "statement", row: 1, historyIncomplete: ["statement-1"] } })]);
    expect(result.currentMarketValue.value).toBeNull();
    expect(result.currentMarketValue.reasons).toContain("history-incomplete");
    expect(result.currentMarketValue.coverage).toEqual({ total: 1, available: 0 });
  });
  it("does not treat a statement mark as acquisition cost", () => {
    const result = real([fill("close", "2026-01-15T15:00:00Z", { side: "sell", source: { platform: "statement", row: 1,
      openingPosition: { accountId: "a", market: "US", symbol: "AAPL", phase: "opening", date: "2026-01-01", quantity: "2", cost: "100", source: [{ page: 1, row: 1 }] },
    } })]);
    expect(result.net.value).toBeNull();
    expect(result.net.reasons).toContain("unknown-cost");
    expect(result.currentMarketValue.value).toBe("110");
    expect(result.instruments[0].evidence.current.costKnown).toBe(false);
  });
  it("makes a genuine closed inventory zero without requiring a closing quote", () => {
    const result = real([fill("buy", "2026-01-05T15:00:00Z"), fill("sell", "2026-01-10T15:00:00Z", { side: "sell", price: "120" })], {}, []);
    expect([result.periodRealized.value, result.closingUnrealized.value, result.currentMarketValue.value]).toEqual(["20", "0", "0"]);
  });
  it("allocates carried opening fees to the same close under either period", () => {
    const executions = [fill("open", "2025-12-15T15:00:00Z", { fee: "2" }), fill("close", "2026-01-20T15:00:00Z", { side: "sell", price: "120", fee: "1" })];
    const jan = real(executions, { period: { start: "2026-01-02", end: "2026-01-31" } }), full = real(executions, { period: { start: "2025-12-01", end: "2026-01-31" } });
    expect([jan.periodRealized.value, jan.openingUnrealized.value, jan.closingUnrealized.value, jan.net.value]).toEqual(["17", "-2", "0", "19"]);
    expect([full.periodRealized.value, full.net.value]).toEqual(["17", "17"]);
  });
  it("uses average cost in realized and unrealized components independently", () => {
    const result = real([fill("old100", "2025-12-15T15:00:00Z"), fill("old200", "2025-12-16T15:00:00Z", { price: "200" }), fill("new300", "2026-01-15T15:00:00Z", { price: "300" }), fill("close400", "2026-01-20T15:00:00Z", { side: "sell", price: "400" })], { period: { start: "2026-01-02", end: "2026-01-31" } }, [raw("2025-12-31", "200"), raw("2026-01-30", "350")]);
    expect([result.periodRealized.value, result.openingUnrealized.value, result.closingUnrealized.value, result.net.value]).toEqual(["200", "100", "300", "400"]);
  });
  it("allocates opening and closing fees proportionally on a partial close", () => {
    const result = real([fill("buy2", "2026-01-05T15:00:00Z", { quantity: "2", fee: "4" }), fill("sell1", "2026-01-10T15:00:00Z", { side: "sell", price: "120", fee: "1" })]);
    expect([result.periodRealized.value, result.closingUnrealized.value, result.net.value]).toEqual(["17", "8", "25"]);
  });
  it("uses the raw reverse fill once, retaining its whole settlement lineage", () => {
    const result = real([fill("buy", "2026-01-05T15:00:00Z"), fill("reverse", "2026-01-10T15:00:00Z", { side: "sell", quantity: "2", price: "120", fee: "2", source: { platform: "statement", row: 2, positionEffect: "open-short", positionEffectEvidence: { kind: "explicit", confidence: "high", reason: "broker short sale" }, settlement: { currency: "USD", quantity: "2", grossAmount: "240", netAmount: "238", fees: { commission: "2" } } } })]);
    expect([result.periodRealized.value, result.closingUnrealized.value, result.net.value, result.currentMarketValue.value]).toEqual(["19", "9", "28", "-110"]);
    expect(result.instruments[0].evidence.executionIds).toEqual(["buy", "reverse"]);
  });
  it("rejects an unproven short while keeping a later valid opening from hiding it", () => {
    const result = real([fill("sell", "2026-01-05T15:00:00Z", { side: "sell" }), fill("buy", "2026-01-10T15:00:00Z")]);
    expect(result.periodRealized.value).toBeNull();
    expect(result.periodRealized.reasons).toContain("execution-direction-unavailable");
  });
  it("does not let an unseen future short episode change the historical long direction", () => {
    const executions = [fill("old", "2025-12-15T15:00:00Z"), fill("close", "2026-01-20T15:00:00Z", { side: "sell", price: "120" }), fill("future", "2026-02-02T15:00:00Z", { side: "sell", source: { platform: "statement", row: 1, positionEffect: "open-short" } })];
    expect(real(executions, { period: { start: "2026-01-02", end: "2026-01-31" } }).net.value).toBe("20");
  });
  it("defaults the real source to live and reports excluded simulation and unknown scope", () => {
    const result = real([fill("live", "2026-01-15T15:00:00Z"), fill("sim", "2026-01-15T15:00:00Z", { source: { platform: "tradingview", row: 1, tradeNature: "simulation", simulationRunId: "r1" } }), fill("unknown", "2026-01-15T15:00:00Z", { source: { platform: "statement", row: 1, tradeNature: "unknown" } })]);
    expect(result.currentMarketValue.value).toBe("110");
    expect(result.scope).toMatchObject({ nature: "live", includedExecutions: 1, excludedExecutions: 2 });
  });
  it("isolates one simulation run and its account and market filters", () => {
    const executions = ["r1", "r2"].map(run => fill(run, "2026-01-15T15:00:00Z", { source: { platform: "tradingview", row: 1, tradeNature: "simulation", simulationRunId: run } }));
    const result = real(executions, { scope: { nature: "simulation", simulationRunId: "r1", accountIds: ["a"], markets: ["US"] } });
    expect(result.currentMarketValue.value).toBe("110");
    expect(result.instruments[0].identity).toMatchObject({ nature: "simulation", simulationRunId: "r1" });
    expect(real(executions, { scope: { nature: "simulation", simulationRunId: "r1", accountIds: ["other"] } }).currentMarketValue.value).toBe("0");
  });
  it("converts through production pair keys and publishes source amounts and provenance", () => {
    const result = real([fill("buy", "2026-01-15T15:00:00Z")], { targetCurrency: "CNY", fxSnapshot: { id: "fx-real", baseCurrency: "CNY", asOf: "2026-01-31", source: "broker", status: "complete", rates: { "USD:CNY": "7" } } });
    expect(result.currentMarketValue.value).toBe("770");
    expect(result.currentMarketValue.money).toMatchObject({ originalByCurrency: { USD: "110" }, targetCurrency: "CNY", conversion: "complete", fx: { id: "fx-real", source: "broker", asOf: "2026-01-31", status: "complete" } });
  });
  it.each(["missing", "partial"] as const)("keeps original money with a %s FX snapshot", status => {
    const result = real([fill("buy", "2026-01-15T15:00:00Z")], { targetCurrency: "CNY", fxSnapshot: { id: "fx", baseCurrency: "CNY", asOf: "2026-01-31", source: "broker", status, rates: { "USD/CNY": "7" } } });
    expect(result.currentMarketValue.value).toBeNull();
    expect(result.currentMarketValue.money.originalByCurrency).toEqual({ USD: "110" });
    expect(result.currentMarketValue.money.fx?.status).toBe(status);
  });
  it("rejects bare FX keys, zero rates and future FX knowledge", () => {
    for (const [rates, asOf] of [[{ USD: "7" }, "2026-01-31"], [{ "USD/CNY": "0" }, "2026-01-31"], [{ "USD/CNY": "7" }, "2026-02-01"]] as const) {
      expect(real([fill("buy", "2026-01-15T15:00:00Z")], { targetCurrency: "CNY", fxSnapshot: { id: "fx", baseCurrency: "CNY", asOf, source: "broker", status: "complete", rates } }).currentMarketValue.value).toBeNull();
    }
  });
  it("needs no FX when the known source already equals the target", () => {
    expect(real([fill("buy", "2026-01-15T15:00:00Z")], { targetCurrency: "USD" }).currentMarketValue.value).toBe("110");
  });
  it("preserves original subtotals instead of summing different currencies", () => {
    const cny = { ...usdInstrument, id: "CN-SH:BBB", symbol: "BBB", market: "CN-SH", currency: "CNY" };
    const result = real([fill("usd", "2026-01-15T15:00:00Z"), fill("cny", "2026-01-15T15:00:00Z", { instrument: cny })], {}, [raw("2026-01-30", "110"), raw("2026-01-30", "120", cny)]);
    expect(result.currentMarketValue.value).toBeNull();
    expect(result.currentMarketValue.money.originalByCurrency).toEqual({ USD: "110", CNY: "120" });
    expect(result.currentMarketValue.reasons).toContain("target-currency-required");
  });
  it("rejects quote/settlement currency mismatches without losing trusted quantity", () => {
    const result = real([fill("buy", "2026-01-15T15:00:00Z", { source: { platform: "statement", row: 1, settlement: { currency: "CNY", quantity: "1", grossAmount: "700", netAmount: "700", fees: {} } } })]);
    expect(result.net.value).toBeNull();
    expect(result.net.reasons).toContain("settlement-currency-mismatch");
    expect(result.currentMarketValue.value).toBe("110");
  });
  it("classifies malformed compatibility quantities without throwing", () => {
    const result = buildHomepageV25Performance(base({ valuations: [{ date: "2026-12-31", accountId: "a", instrumentId: usdInstrument.id, quantity: "unknown", price: "110", currency: "USD", kind: "current" }] }));
    expect(result.currentMarketValue.value).toBeNull();
    expect(result.currentMarketValue.reasons).toContain("quantity-invalid");
  });
  it("requires the explicit production entry cutoff while preserving the same result", () => {
    const executions = [fill("buy", "2026-01-15T15:00:00Z")];
    const candlesByInstrument = { [usdInstrument.id]: [raw("2026-01-30", "110")] };
    const result = buildHomepageV25PerformanceFromEntries({ entries: buildTradeLibraryEntries(buildInstrumentTradeSummaries(executions), candlesByInstrument, { [usdInstrument.id]: "ready" }), candlesByInstrument, period: { start: "2026-01-01", end: "2026-01-31" }, asOf: "2026-01-31" });
    expect(result.currentMarketValue.value).toBe("110");
    expect(result.instruments[0].evidence.current.quantity).toBe("1");
  });
  it("excludes precise fills after an intraday asOf on the same Shanghai day", () => {
    const result = real([fill("known", "2026-01-31T01:00:00Z"), fill("later", "2026-01-31T08:00:00Z")], { asOf: "2026-01-31T02:00:00Z" }, [raw("2026-01-30", "110")]);
    expect(result.currentMarketValue.value).toBe("110");
    expect(result.instruments[0].evidence.current.executionIds).toEqual(["known"]);
  });
  it("uses the completed US session and rejects an unfinished or weekend raw bar", () => {
    const result = real([fill("known", "2026-01-15T15:00:00Z")], { asOf: "2026-01-31T02:00:00Z" }, [raw("2026-01-30", "110"), raw("2026-01-31", "999")]);
    expect(result.currentMarketValue.value).toBe("110");
  });
  it("marks an entirely future period unavailable even when the scoped book is empty", () => {
    const result = real([], { period: { start: "2026-02-01", end: "2026-02-28" } });
    expect(result.net.value).toBeNull();
    expect(result.net.reasons).toContain("period-not-started");
    expect(result.currentMarketValue.value).toBe("0");
  });
  it("classifies malformed statement quantity instead of throwing or publishing zero", () => {
    const quotes = { [usdInstrument.id]: [raw("2026-01-30", "110")] };
    const entries = buildTradeLibraryEntries(buildInstrumentTradeSummaries([fill("known", "2026-01-15T15:00:00Z")]), quotes, { [usdInstrument.id]: "ready" });
    const malformedEntries = entries.map(entry => ({ ...entry, executions: entry.executions.map(e => ({ ...e, source: { ...e.source, openingPosition: { accountId: "a", market: "US", symbol: "AAPL", phase: "opening" as const, date: "2026-01-01", quantity: "unavailable", source: [{ page: 1, row: 1 }] } } })) }));
    const result = buildHomepageV25PerformanceFromEntries({ entries: malformedEntries, candlesByInstrument: quotes, period: { start: "2026-01-01", end: "2026-01-31" }, asOf: "2026-01-31" });
    expect(result.currentMarketValue.value).toBeNull();
    expect(result.currentMarketValue.reasons).toContain("evidence-invalid");
  });
  it("does not turn absent original lineage into a complete empty book", () => {
    const quotes = { [usdInstrument.id]: [raw("2026-01-30", "110")] };
    const entries = buildTradeLibraryEntries(buildInstrumentTradeSummaries([fill("buy", "2026-01-15T15:00:00Z")]), quotes, { [usdInstrument.id]: "ready" });
    const result = buildHomepageV25PerformanceFromEntries({ entries: entries.map(entry => ({ ...entry, executions: [] })), candlesByInstrument: quotes, period: { start: "2026-01-01", end: "2026-01-31" }, asOf: "2026-01-31" });
    expect(result.currentMarketValue.value).toBeNull();
    expect(result.currentMarketValue.reasons).toContain("execution-lineage-unavailable");
  });
  it("keeps zero remaining unrealized and current exposure known after an unknown-fee close", () => {
    const result = real([fill("buy", "2026-01-05T15:00:00Z", { source: { platform: "statement", row: 1, feeStatus: "unknown" } }), fill("close", "2026-01-15T15:00:00Z", { side: "sell", price: "120" })], {}, []);
    expect([result.periodRealized.value, result.closingUnrealized.value, result.currentMarketValue.value]).toEqual([null, "0", "0"]);
  });
  it("does not silently replace a reported fee with a conflicting settlement fee", () => {
    const result = real([fill("buy", "2026-01-15T15:00:00Z", { fee: "2", source: { platform: "statement", row: 1, settlement: { currency: "USD", quantity: "1", grossAmount: "100", netAmount: "100", fees: {} } } })]);
    expect(result.net.value).toBeNull();
    expect(result.net.reasons).toContain("fees-conflict");
    expect(result.currentMarketValue.value).toBe("110");
  });
  it("retains partial conversion status when only one source currency has a usable rate", () => {
    const hkd = { ...usdInstrument, id: "HK:00005", symbol: "00005", market: "HK", currency: "HKD" };
    const result = real([fill("hkd", "2026-01-15T15:00:00Z", { instrument: hkd }), fill("usd", "2026-01-15T15:00:00Z")], { targetCurrency: "CNY", fxSnapshot: { id: "fx", baseCurrency: "CNY", asOf: "2026-01-31", source: "broker", status: "complete", rates: { "USD/CNY": "7" } } }, [raw("2026-01-30", "110", hkd), raw("2026-01-30", "110")]);
    expect(result.currentMarketValue.value).toBeNull();
    expect(result.currentMarketValue.money.conversion).toBe("partial");
    expect(result.currentMarketValue.coverage).toEqual({ total: 2, available: 1 });
  });
  it("requires real FX even for a zero PnL amount in a different source currency", () => {
    const result = real([fill("buy", "2026-01-15T15:00:00Z")], { targetCurrency: "CNY" }, [raw("2026-01-30", "100")]);
    expect(result.net.value).toBeNull();
    expect(result.net.money.originalByCurrency).toEqual({ USD: "0" });
    expect(result.net.reasons).toContain("fx-missing");
  });
  it("does not include Shanghai-next-day statement closing knowledge in current inventory", () => {
    const executions = [fill("known", "2026-01-15T15:00:00Z", { source: { platform: "statement", row: 1, statementPositions: [{ accountId: "a", market: "US", symbol: "AAPL", phase: "closing", date: "2026-01-31", quantity: "9", source: [{ page: 1, row: 1 }] }] } })];
    const today = real(executions), nextDay = real(executions, { asOf: "2026-02-01" });
    expect([today.currentMarketValue.value, today.instruments[0].evidence.current.quantity]).toEqual(["110", "1"]);
    expect([nextDay.currentMarketValue.value, nextDay.instruments[0].evidence.current.quantity]).toEqual(["990", "9"]);
  });
  it("uses a Shanghai opening cutoff for attached statement knowledge", () => {
    const result = real([fill("old", "2025-12-15T15:00:00Z", { source: { platform: "statement", row: 1, statementPositions: [{ accountId: "a", market: "US", symbol: "AAPL", phase: "closing", date: "2025-12-31", quantity: "9", source: [{ page: 1, row: 1 }] }] } })]);
    expect(result.instruments[0].evidence.opening.quantity).toBe("1");
    expect(result.instruments[0].evidence.current.quantity).toBe("9");
  });
  it("keeps statement period-end and current knowledge cutoffs independent", () => {
    const result = real([fill("known", "2026-01-15T15:00:00Z", { source: { platform: "statement", row: 1, statementPositions: [{ accountId: "a", market: "US", symbol: "AAPL", phase: "closing", date: "2026-01-31", quantity: "9", source: [{ page: 1, row: 1 }] }] } })], { asOf: "2026-02-15" });
    expect([result.instruments[0].evidence.closing.quantity, result.instruments[0].evidence.current.quantity]).toEqual(["1", "9"]);
  });
  it("does not reveal a date-only stock event before its real knowledge cursor", () => {
    const executions = [fill("known", "2026-01-15T15:00:00Z", { source: { platform: "statement", row: 1, positionEvents: [{ id: "allotment", accountId: "a", market: "US", symbol: "AAPL", kind: "ipo", date: "2026-01-31", quantity: "2", currency: "USD", description: "allotment", source: [{ page: 1, row: 2 }] }] } })];
    expect(real(executions).currentMarketValue.value).toBe("110");
    expect(real(executions, { asOf: "2026-02-01" }).currentMarketValue.value).toBe("330");
  });
  it("does not borrow next-Shanghai-day cash to certify an IPO acquisition cost", () => {
    const common = { accountId: "a", market: "US", symbol: "AAPL", currency: "USD", source: [{ page: 1, row: 2 }] };
    const executions = [fill("known", "2026-01-15T15:00:00Z", { source: { platform: "statement", row: 1, positionEvents: [
      { ...common, id: "allotment", kind: "ipo", date: "2026-01-31", quantity: "2", displayTimePolicy: "session-open", description: "allotment" },
      { ...common, id: "application", kind: "ipo", date: "2026-01-30", amount: "-220", description: "IPO application" },
      { ...common, id: "refund", kind: "ipo", date: "2026-01-31", amount: "20", description: "IPO refund" },
    ] } })];
    const today = real(executions), nextDay = real(executions, { asOf: "2026-02-01", period: { start: "2026-01-01", end: "2026-02-01" } });
    expect(today.net.value).toBeNull();
    expect(today.instruments[0].evidence.current.costKnown).toBe(false);
    expect(today.currentMarketValue.value).toBe("330");
    expect(nextDay.net.value).toBe("30");
  });
  it("does not invent a long inventory from an uncovered explicit short close", () => {
    const result = real([fill("uncovered-close", "2026-01-15T15:00:00Z", { source: { platform: "statement", row: 1, positionEffect: "close-short" } })]);
    expect(result.periodRealized.value).toBeNull();
    expect(result.currentMarketValue.value).toBeNull();
    expect(result.currentMarketValue.reasons).toContain("position-coverage-missing");
  });
  it("does not make an uncovered close trustworthy after a later generic buy", () => {
    const result = real([fill("uncovered-close", "2026-01-15T15:00:00Z", { source: { platform: "statement", row: 1, positionEffect: "close-short" } }), fill("later", "2026-01-16T15:00:00Z")]);
    expect(result.currentMarketValue.value).toBeNull();
    expect(result.currentMarketValue.reasons).toContain("position-coverage-missing");
  });
  it("does not certify intraday conversion using a day-end FX snapshot", () => {
    const result = real([fill("known", "2026-01-15T15:00:00Z")], { asOf: "2026-01-31T02:00:00Z", targetCurrency: "CNY", fxSnapshot: { id: "fx", baseCurrency: "CNY", source: "broker", asOf: "2026-01-31", status: "complete", rates: { "USD/CNY": "7" } } }, [raw("2026-01-30", "110")]);
    expect(result.currentMarketValue.value).toBeNull();
    expect(result.currentMarketValue.reasons).toContain("fx-future");
  });
  it("retains a real live multiple-episode aggregate before valuation", () => {
    const result = real([fill("old-buy", "2025-12-01T02:00:00Z", { price: "50" }), fill("old-sell", "2025-12-02T02:00:00Z", { side: "sell", price: "60" }), fill("new-buy", "2026-01-15T02:00:00Z")], {}, [raw("2025-12-31", "70"), raw("2026-01-30", "110")]);
    expect([result.net.value, result.currentMarketValue.value]).toEqual(["10", "110"]);
    expect(result.instruments[0].evidence.current.executionIds).toEqual(["old-buy", "old-sell", "new-buy"]);
  });
});

const base = (overrides: Partial<HomepageV25Input> = {}): HomepageV25Input => ({
  period: { start: "2026-01-01", end: "2026-12-31" },
  asOf: "2026-12-31",
  executions: [],
  openingPositions: [],
  valuations: [],
  ...overrides,
});

describe("homepage completed exchange session quote contract", () => {
  function sessionProjection(market: string, asOf: string, dates: string[], overrides: Partial<HomepageV25Input> = {}) {
    const instrument = { id: `${market}:SESSION`, symbol: "SESSION", name: "Session", market, currency: market === "US" ? "USD" : market === "HK" ? "HKD" : "CNY" };
    return real([fill("session-buy", "2025-12-01T05:00:00Z", { instrument, fee: "2" })], {
      period: { start: "2026-01-01", end: "2031-12-31" }, asOf, ...overrides,
    }, dates.map((day, index) => raw(day, ["100", "110", "999"][index], instrument)));
  }
  it.each([
    { market: "US", label: "summer intraday across Shanghai midnight", asOf: "2026-10-22T17:30:00Z", dates: ["2026-10-20", "2026-10-21", "2026-10-22"], expected: "2026-10-21", price: "110" },
    { market: "US", label: "summer close", asOf: "2026-10-22T20:00:00Z", dates: ["2026-10-20", "2026-10-21", "2026-10-22"], expected: "2026-10-22", price: "999" },
    { market: "US", label: "winter before close", asOf: "2026-11-03T20:30:00Z", dates: ["2026-10-30", "2026-11-02", "2026-11-03"], expected: "2026-11-02", price: "110" },
    { market: "US", label: "winter close", asOf: "2026-11-03T21:00:00Z", dates: ["2026-10-30", "2026-11-02", "2026-11-03"], expected: "2026-11-03", price: "999" },
    { market: "US", label: "before verified half-day close", asOf: "2026-11-27T17:59:59Z", dates: ["2026-11-24", "2026-11-25", "2026-11-27"], expected: "2026-11-25", price: "110" },
    { market: "US", label: "verified half-day close", asOf: "2026-11-27T18:00:00Z", dates: ["2026-11-24", "2026-11-25", "2026-11-27"], expected: "2026-11-27", price: "999" },
    { market: "HK", label: "before conservative auction close", asOf: "2026-10-22T08:09:59Z", dates: ["2026-10-20", "2026-10-21", "2026-10-22"], expected: "2026-10-21", price: "110" },
    { market: "HK", label: "auction close", asOf: "2026-10-22T08:10:00Z", dates: ["2026-10-20", "2026-10-21", "2026-10-22"], expected: "2026-10-22", price: "999" },
    { market: "HK", label: "before verified half-day auction close", asOf: "2026-12-24T04:09:59Z", dates: ["2026-12-22", "2026-12-23", "2026-12-24"], expected: "2026-12-23", price: "110" },
    { market: "HK", label: "verified half-day auction close", asOf: "2026-12-24T04:10:00Z", dates: ["2026-12-22", "2026-12-23", "2026-12-24"], expected: "2026-12-24", price: "999" },
    { market: "CN-SH", label: "before close", asOf: "2026-10-22T06:59:59Z", dates: ["2026-10-20", "2026-10-21", "2026-10-22"], expected: "2026-10-21", price: "110" },
    { market: "CN-SH", label: "close", asOf: "2026-10-22T07:00:00Z", dates: ["2026-10-20", "2026-10-21", "2026-10-22"], expected: "2026-10-22", price: "999" },
    { market: "CN-SZ", label: "before close", asOf: "2026-10-22T06:59:59Z", dates: ["2026-10-20", "2026-10-21", "2026-10-22"], expected: "2026-10-21", price: "110" },
    { market: "CN-SZ", label: "close", asOf: "2026-10-22T07:00:00Z", dates: ["2026-10-20", "2026-10-21", "2026-10-22"], expected: "2026-10-22", price: "999" },
    { market: "US", label: "Shanghai date-only boundary before US close", asOf: "2026-10-22", dates: ["2026-10-20", "2026-10-21", "2026-10-22"], expected: "2026-10-21", price: "110" },
    { market: "CN-SH", label: "Shanghai date-only boundary after close", asOf: "2026-10-22", dates: ["2026-10-20", "2026-10-21", "2026-10-22"], expected: "2026-10-22", price: "999" },
    { market: "US", label: "weekend raw fallback", asOf: "2026-10-25", dates: ["2026-10-22", "2026-10-23", "2026-10-24"], expected: "2026-10-23", price: "110" },
    { market: "HK", label: "weekend raw fallback", asOf: "2026-10-25", dates: ["2026-10-22", "2026-10-23", "2026-10-24"], expected: "2026-10-23", price: "110" },
    { market: "US", label: "old weekend raw rejected even below cutoff", asOf: "2026-10-28", dates: ["2026-10-22", "2026-10-23", "2026-10-24"], expected: "2026-10-23", price: "110" },
    { market: "CN-SH", label: "holiday raw rejected", asOf: "2026-10-08", dates: ["2026-09-29", "2026-09-30", "2026-10-01"], expected: "2026-09-30", price: "110" },
  ])("$market $label", ({ market, asOf, dates, expected, price }) => {
    const result = sessionProjection(market, asOf, dates);
    expect(result.instruments[0].evidence.current.quote?.date).toBe(expected);
    expect(result.currentMarketValue.value).toBe(price);
    expect(result.currentUnrealized.value).toBe(String(Number(price) - 102));
    expect(result.currentOpenFees.value).toBe("2");
  });
  it.each([
    { market: "CN", asOf: "2026-10-22T08:30:00Z", reason: "quote-market-unsupported", dates: ["2026-10-21"] },
    { market: "US", asOf: "2031-10-22T22:00:00Z", reason: "quote-session-unavailable", dates: ["2031-10-21"] },
    { market: "US", asOf: "2025-12-31T15:00:00Z", reason: "quote-session-unavailable", dates: ["2025-12-30"] },
  ])("classifies $market/$asOf session uncertainty without erasing inventory or fees", ({ market, asOf, reason, dates }) => {
    const result = sessionProjection(market, asOf, dates);
    expect(result.currentMarketValue).toMatchObject({ value: null, reasons: expect.arrayContaining([reason]) });
    expect(result.currentUnrealized).toMatchObject({ value: null, reasons: expect.arrayContaining([reason]) });
    expect(result.currentOpenFees.value).toBe("2");
    expect(result.instruments[0].evidence.current).toMatchObject({ quantity: "1", costKnown: true, feesKnown: true, openFees: "2", quote: null, reasons: expect.arrayContaining([reason]) });
  });
  it("rejects a weekend-only raw quote without manufacturing zero value", () => {
    const result = sessionProjection("US", "2026-10-28", ["2026-10-24"]);
    expect(result.currentMarketValue).toMatchObject({ value: null, reasons: expect.arrayContaining(["quote-missing"]) });
    expect(result.instruments[0].evidence.current.quote).toBeNull();
  });
  it("resolves opening, historical closing and independent current sessions separately", () => {
    const result = sessionProjection("US", "2026-10-24T02:00:00Z", ["2026-10-20", "2026-10-21", "2026-10-23"], { period: { start: "2026-10-22", end: "2026-10-22" } });
    expect(result.instruments[0].evidence.opening.quote?.date).toBe("2026-10-20");
    expect(result.instruments[0].evidence.closing.quote?.date).toBe("2026-10-21");
    expect(result.instruments[0].evidence.current.quote?.date).toBe("2026-10-23");
    expect([result.openingUnrealized.value, result.closingUnrealized.value, result.net.value, result.currentMarketValue.value, result.currentUnrealized.value]).toEqual(["-2", "8", "10", "999", "897"]);
  });
});

describe("homepage v2.5 financial projection", () => {
  it("classifies valuation inventory mismatch with an explicit current cutoff", () => {
    const result = buildHomepageV25Performance(base({ openingPositions: [{ accountId: "account-a", instrumentId: "CN:AAA", direction: "long", quantity: "1", unitCost: "100", currency: "CNY" }], valuations: [{ date: "2026-12-31", accountId: "account-a", instrumentId: "CN:AAA", kind: "period-end", quantity: "0", price: "120", currency: "CNY" }] }));
    expect(result.net.value).toBeNull();
    expect(result.net.reasons).toContain("valuation-quantity-mismatch");
  });
  it("classifies unavailable opening cost with a valid asOf", () => {
    const result = buildHomepageV25Performance(base({ openingPositions: [{ accountId: "account-a", instrumentId: "CN:AAA", direction: "long", quantity: "1", unitCost: "unavailable", currency: "CNY" }] }));
    expect(result.net.value).toBeNull();
    expect(result.net.reasons).toContain("execution-price-invalid");
  });
  it("classifies invalid settlement fee text with a valid asOf", () => {
    const result = buildHomepageV25Performance(base({ executions: [execution({ id: "bad-fee", side: "buy", quantity: "1", price: "100", fee: "0", executedAt: "2026-01-05T00:00:00Z", source: { platform: "statement", row: 1, settlement: { currency: "CNY", quantity: "1", grossAmount: "100", netAmount: "100", fees: { commission: "unavailable" } } } })] }));
    expect(result.net.value).toBeNull();
    expect(result.net.reasons).toContain("fees-invalid");
  });
  it("keeps partial current quote coverage in the caller-scoped compatibility input", () => {
    const result = buildHomepageV25Performance(base({ openingPositions: ["CN:AAA", "CN:BBB"].map(instrumentId => ({ accountId: "account-a", instrumentId, direction: "long" as const, quantity: "1", unitCost: "100", currency: "CNY" })), valuations: ["CN:AAA", "CN:BBB"].map(instrumentId => ({ date: "2026-12-31", accountId: "account-a", instrumentId, kind: "current" as const, quantity: "1", price: instrumentId === "CN:AAA" ? "110" : null, currency: "CNY" })) }));
    expect(result.currentMarketValue.value).toBeNull();
    expect(result.currentMarketValue.coverage).toEqual({ total: 2, available: 1 });
  });
  it("uses opening and closing unrealized values for a cross-year period", () => {
    const result = buildHomepageV25Performance(base({
      openingPositions: [{ accountId: "account-a", instrumentId: "CN:AAA", direction: "long", quantity: "1", unitCost: "100", currency: "CNY" }],
      valuations: [
        { date: "2026-01-01", accountId: "account-a", instrumentId: "CN:AAA", quantity: "1", price: "120", currency: "CNY", kind: "period-start" },
        { date: "2026-12-31", accountId: "account-a", instrumentId: "CN:AAA", quantity: "1", price: "100", currency: "CNY", kind: "period-end" },
      ],
    }));
    expect(result.periodRealized.value).toBe("0");
    expect(result.openingUnrealized.value).toBe("20");
    expect(result.closingUnrealized.value).toBe("0");
    expect(result.net.value).toBe("-20");
  });

  it("realizes only the matched quantity for a partial close and charges each fee once", () => {
    const result = buildHomepageV25Performance(base({
      openingPositions: [{ accountId: "account-a", instrumentId: "CN:AAA", direction: "long", quantity: "2", unitCost: "100", currency: "CNY" }],
      executions: [execution({ id: "sell-1", side: "sell", quantity: "1", price: "180", fee: "0", executedAt: "2026-06-01T00:00:00Z", source: { platform: "statement", row: 1, positionEffect: "close-long" } })],
      valuations: [
        { date: "2026-01-01", accountId: "account-a", instrumentId: "CN:AAA", quantity: "2", price: "150", currency: "CNY", kind: "period-start" },
        { date: "2026-12-31", accountId: "account-a", instrumentId: "CN:AAA", quantity: "1", price: "160", currency: "CNY", kind: "period-end" },
      ],
    }));
    expect(result.periodRealized.value).toBe("80");
    expect(result.openingUnrealized.value).toBe("100");
    expect(result.closingUnrealized.value).toBe("60");
    expect(result.net.value).toBe("40");
  });

  it("covers the real cross-year execution path: 100 cost, 150 close, zero closing float", () => {
    const result = buildHomepageV25Performance(base({
      openingPositions: [{ accountId: "account-a", instrumentId: "CN:AAA", direction: "long", quantity: "1", unitCost: "100", currency: "CNY" }],
      executions: [execution({ id: "year-close", side: "sell", quantity: "1", price: "150", fee: "0", executedAt: "2026-06-01T00:00:00Z", source: { platform: "statement", row: 1, positionEffect: "close-long" } })],
      valuations: [
        { date: "2026-01-01", accountId: "account-a", instrumentId: "CN:AAA", quantity: "1", price: "100", currency: "CNY", kind: "period-start" },
        { date: "2026-12-31", accountId: "account-a", instrumentId: "CN:AAA", quantity: "0", price: "150", currency: "CNY", kind: "period-end" },
      ],
    }));
    expect(result.periodRealized.value).toBe("50");
    expect(result.openingUnrealized.value).toBe("0");
    expect(result.closingUnrealized.value).toBe("0");
    expect(result.net.value).toBe("50");
  });

  it("supports short executions without turning an unproven generic sell into a short", () => {
    const result = buildHomepageV25Performance(base({
      executions: [
        execution({ id: "open", side: "sell", quantity: "2", price: "200", fee: "2", executedAt: "2026-02-01T00:00:00Z", source: { platform: "statement", row: 1, positionEffect: "open-short" } }),
        execution({ id: "close", side: "buy", quantity: "1", price: "150", fee: "1", executedAt: "2026-03-01T00:00:00Z", source: { platform: "statement", row: 2, positionEffect: "close-short" } }),
      ],
      valuations: [{ date: "2026-12-31", accountId: "account-a", instrumentId: "CN:AAA", quantity: "-1", price: "140", currency: "CNY", kind: "period-end" }],
    }));
    expect(result.periodRealized.value).toBe("48");
    expect(result.closingUnrealized.value).toBe("59");
    expect(result.net.value).toBe("107");

    const ambiguous = buildHomepageV25Performance(base({
      executions: [execution({ id: "sell", side: "sell", quantity: "1", price: "200", fee: "0", executedAt: "2026-02-01T00:00:00Z" })],
    }));
    expect(ambiguous.periodRealized.available).toBe(false);
    expect(ambiguous.reasons).toContain("execution-direction-unavailable");
  });

  it("keeps current market value independent from period selection", () => {
    const input = base({
      valuations: [
        { date: "2026-01-31", accountId: "account-a", instrumentId: "CN:AAA", quantity: "1", price: "100", currency: "CNY", kind: "period-end" },
        { date: "2026-10-22", accountId: "account-a", instrumentId: "CN:AAA", quantity: "1", price: "130", currency: "CNY", kind: "current" },
      ],
    });
    const result = buildHomepageV25Performance(input);
    expect(result.currentMarketValue.value).toBe("130");
  });

  it("reports missing market data and FX instead of manufacturing zero", () => {
    const result = buildHomepageV25Performance(base({
      valuations: [{ date: "2026-12-31", accountId: "account-a", instrumentId: "CN:AAA", quantity: "1", price: null, currency: "USD", kind: "period-end", reason: "quote-missing" }],
      targetCurrency: "CNY",
      fxSnapshot: { id: "fx", baseCurrency: "CNY", asOf: "2026-12-31", source: "test", status: "complete", rates: { "USD/CNY": "7", "HKD/CNY": "0.9" } },
    }));
    expect(result.closingUnrealized.value).toBeNull();
    expect(result.closingUnrealized.available).toBe(false);
    expect(result.currentMarketValue.value).toBeNull();
    expect(result.reasons).toEqual(expect.arrayContaining(["quote-missing"]));
  });

  it("keeps opening mark, realized sale, and zero closing inventory in the net bridge", () => {
    const result = buildHomepageV25Performance(base({
      openingPositions: [{ accountId: "account-a", instrumentId: "CN:AAA", direction: "long", quantity: "1", unitCost: "100", currency: "CNY" }],
      executions: [execution({ id: "cross-year-sale", side: "sell", quantity: "1", price: "250", fee: "0", executedAt: "2026-06-01T00:00:00Z", source: { platform: "statement", row: 1, positionEffect: "close-long" } })],
      valuations: [
        { date: "2026-01-01", accountId: "account-a", instrumentId: "CN:AAA", quantity: "1", price: "200", currency: "CNY", kind: "period-start" },
        { date: "2026-12-31", accountId: "account-a", instrumentId: "CN:AAA", quantity: "0", price: "0", currency: "CNY", kind: "period-end" },
      ],
    }));
    expect(result.openingUnrealized.value).toBe("100");
    expect(result.periodRealized.value).toBe("150");
    expect(result.closingUnrealized.value).toBe("0");
    expect(result.net.value).toBe("50");
  });

  it("assigns executions without an explicit trading date in Shanghai business time", () => {
    const result = buildHomepageV25Performance(base({
      openingPositions: [{ accountId: "account-a", instrumentId: "CN:AAA", direction: "long", quantity: "1", unitCost: "100", currency: "CNY" }],
      executions: [execution({ id: "shanghai-midnight", side: "sell", quantity: "1", price: "150", fee: "0", executedAt: "2025-12-31T16:30:00Z", source: { platform: "statement", row: 1, positionEffect: "close-long" } })],
      valuations: [
        { date: "2026-01-01", accountId: "account-a", instrumentId: "CN:AAA", quantity: "1", price: "100", currency: "CNY", kind: "period-start" },
        { date: "2026-12-31", accountId: "account-a", instrumentId: "CN:AAA", quantity: "0", price: "0", currency: "CNY", kind: "period-end" },
      ],
    }));
    expect(result.periodRealized.value).toBe("50");
  });

  it("converts settlement realized PnL into the selected target currency", () => {
    const result = buildHomepageV25Performance(base({
      targetCurrency: "CNY",
      fxSnapshot: { id: "fx", baseCurrency: "CNY", asOf: "2026-12-31", source: "test", status: "complete", rates: { "USD/CNY": "7", "HKD/CNY": "0.9" } },
      openingPositions: [{ accountId: "account-a", instrumentId: "CN:AAA", direction: "long", quantity: "1", unitCost: "100", currency: "USD" }],
      executions: [execution({ id: "usd-sell", instrument: { id: "CN:AAA", symbol: "AAA", name: "AAA", market: "CN", currency: "USD" }, side: "sell", quantity: "1", price: "120", fee: "0", executedAt: "2026-02-01T00:00:00Z", source: { platform: "statement", row: 1, positionEffect: "close-long", settlement: { currency: "USD", quantity: "1", grossAmount: "120", netAmount: "120", fees: {} } } })],
      valuations: [
        { date: "2026-01-01", accountId: "account-a", instrumentId: "CN:AAA", quantity: "1", price: "100", currency: "USD", kind: "period-start", fxRateToTarget: "7" },
        { date: "2026-12-31", accountId: "account-a", instrumentId: "CN:AAA", quantity: "0", price: "0", currency: "USD", kind: "period-end", fxRateToTarget: "7" },
      ],
    }));
    expect(result.periodRealized.value).toBe("140");
    expect(result.net.value).toBe("140");
  });

  it("derives a real entry and candle ledger, while current value survives an earlier coverage gap", () => {
    const instrument = { id: "CN-SH:AAA", symbol: "AAA", name: "AAA", market: "CN-SH", currency: "CNY" };
    const buy = execution({ id: "buy", instrument, side: "buy", quantity: "1", price: "100", fee: "0", executedAt: "2026-01-05T02:00:00Z" });
    const candlesByInstrument = { [instrument.id]: [raw("2026-10-22", "130", instrument)] };
    const entries = buildTradeLibraryEntries(buildInstrumentTradeSummaries([buy]), candlesByInstrument, { [instrument.id]: "ready" });
    const result = buildHomepageV25Performance(base({ entries, candlesByInstrument }));
    expect(result.currentMarketValue.value).toBe("130");
    expect(result.currentMarketValue.available).toBe(true);
  });
});
