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

// P2-A additive tests. All F3 tests above are retained byte-for-byte.
import { vi } from "vitest";
import { prepareHomepageV25Source, projectHomepageV25Boundaries, type HistoricalFxObservation, type LifetimeSourceCoverage } from "./homepage-v25-performance";
function preparedFixture(executions: TradeExecution[], quotes: DailyCandleRecord[], extra: Partial<Parameters<typeof prepareHomepageV25Source>[0]> = {}) {
  expect(prepareHomepageV25Source).toBeTypeOf("function");
  const candlesByInstrument = Object.fromEntries([...new Set(quotes.map(q => q.instrumentId))].map(id => [id, quotes.filter(q => q.instrumentId === id)]));
  return prepareHomepageV25Source({ entries: buildTradeLibraryEntries(buildInstrumentTradeSummaries(executions), candlesByInstrument, Object.fromEntries(executions.map(e => [e.instrument.id, "ready" as const]))), candlesByInstrument,
    fxObservations: [], currentFxSnapshot: null, lifetimeSourceCoverage: [], revisions: { trades: "t1", metadata: "m1", quotes: "q1", fx: "f1" }, ...extra });
}
const fullLifetime = (through = "2026-02-02T10:00:00Z"): LifetimeSourceCoverage => ({ accountId: "a", instrumentId: "US:AAPL", nature: "live", simulationRunId: null, state: "complete", coversInception: true, through, knownAt: "2025-01-01T00:00:00Z", evidenceIds: ["import-complete"], reasons: [] });
const observation = (businessDate: string, rate: string, knownAt = `${businessDate}T00:00:00Z`): HistoricalFxObservation => ({ id: `fx-${businessDate}`, source: "broker-history", sourceRevision: "f1", businessDate, rates: { "USD/CNY": rate }, status: "complete", publishedAtByPair: { "USD/CNY": knownAt }, knownAtByPair: { "USD/CNY": knownAt }, fetchedAt: knownAt, evidenceIds: [`fx-evidence-${businessDate}`] });
const batchQuery = { periodStart: "2026-01-01", asOf: "2026-02-02T10:00:00Z", endpoints: [{ key: "jan", at: "2026-01-30" }] };
describe("P2 prepared boundary contract", () => {
  it("separates lifetime net from selected-period net using canonical endpoint states", () => {
    const source = preparedFixture([fill("old", "2025-12-15T15:00:00Z"), fill("sale", "2026-01-15T15:00:00Z", { side: "sell", price: "130" })], [raw("2026-01-02", "120")], { lifetimeSourceCoverage: [fullLifetime()] });
    const point = projectHomepageV25Boundaries(source, { ...batchQuery, periodStart: "2026-01-06" }).points[0];
    expect([point.periodRealized.value, point.openingUnrealized.value, point.closingUnrealized.value, point.unrealizedChange.value, point.net.value, point.lifetimeRealizedNet.value, point.lifetimeNet.value, point.periodFees.value]).toEqual(["30", "20", "0", "-20", "10", "30", "30", "0"]);
  });
  it("keeps cumulative amounts unknown without inception coverage while period and market value remain known", () => {
    const source = preparedFixture([fill("buy", "2026-01-05T15:00:00Z")], [raw("2026-01-29", "110")]);
    const point = projectHomepageV25Boundaries(source, { ...batchQuery, endpoints: [{ key: "p", at: "2026-01-30T10:00:00Z" }] }).points[0];
    expect([point.net.value, point.marketValue.value, point.lifetimeNet.value]).toEqual(["10", "110", null]);
    expect(point.lifetimeNet.reasons).toContain("lifetime-source-incomplete");
  });
  it("computes native period differences before applying one endpoint FX", () => {
    const source = preparedFixture([fill("old", "2025-12-15T15:00:00Z"), fill("sale", "2026-01-15T15:00:00Z", { side: "sell", price: "130" })], [raw("2026-01-02", "120")], { fxObservations: [observation("2025-12-31", "7"), observation("2026-01-30", "8")], lifetimeSourceCoverage: [fullLifetime()] });
    const point = projectHomepageV25Boundaries(source, { ...batchQuery, periodStart: "2026-01-06", targetCurrency: "CNY" }).points[0];
    expect([point.periodRealized.value, point.unrealizedChange.value, point.net.value, point.lifetimeNet.value]).toEqual(["240", "-160", "80", "240"]);
    expect(point.net.money.originalByCurrency).toEqual({ USD: "10" });
  });
  it("does not backfill historical FX from the independent latest current snapshot", () => {
    const fx = { snapshot: { id: "latest", baseCurrency: "CNY" as const, source: "broker", asOf: "2026-02-02T00:00:00Z", status: "complete" as const, rates: { "USD/CNY": "7" } }, fetchedAt: "2026-02-02T00:01:00Z", publishedAtByPair: { "USD/CNY": "2026-02-02T00:00:00Z" }, sourceRevision: "f1", evidenceIds: ["latest-fetch"] };
    const source = preparedFixture([fill("buy", "2026-01-05T15:00:00Z")], [raw("2026-01-29", "110"), raw("2026-01-30", "120")], { currentFxSnapshot: fx });
    const batch = projectHomepageV25Boundaries(source, { ...batchQuery, endpoints: [{ key: "past", at: "2026-01-30T10:00:00Z" }], targetCurrency: "CNY" });
    expect([batch.points[0].net.value, batch.current.currentMarketValue.value]).toEqual([null, "840"]);
    expect(batch.points[0].net.money.originalByCurrency).toEqual({ USD: "10" });
    expect(batch.points[0].fxCoverage.state).toBe("missing");
  });
  it("rejects historical pair knowledge after the endpoint without erasing native amounts", () => {
    const source = preparedFixture([fill("buy", "2026-01-05T15:00:00Z")], [raw("2026-01-29", "110")], { fxObservations: [observation("2026-01-30", "7", "2026-01-31T00:00:00Z")] });
    const point = projectHomepageV25Boundaries(source, { ...batchQuery, targetCurrency: "CNY", endpoints: [{ key: "p", at: "2026-01-30T10:00:00Z" }] }).points[0];
    expect(point.net.value).toBeNull(); expect(point.net.money.originalByCurrency).toEqual({ USD: "10" }); expect(point.fxCoverage.reasons).toContain("fx-knowledge-unavailable");
  });
  it("uses strict completed-session gaps only for daily metrics and retains the F3 current fallback", () => {
    const source = preparedFixture([fill("buy", "2026-01-05T15:00:00Z", { fee: "2" })], [raw("2026-01-28", "110")]);
    const batch = projectHomepageV25Boundaries(source, { ...batchQuery, endpoints: [{ key: "gap", at: "2026-01-30T10:00:00Z" }] });
    const point = batch.points[0], group = point.instruments[0];
    expect([point.net.value, point.periodRealized.value, point.marketValue.value, point.periodFees.value, batch.current.currentMarketValue.value]).toEqual([null, "0", null, "2", "110"]);
    expect(point.plottable).toBe(false);
    expect(group.quoteCoverage.endpoint).toMatchObject({ state: "missing-completed-session", requiredCompletedSession: "2026-01-29", selectedDate: "2026-01-28", missingSessions: ["2026-01-29"] });
    expect(group.evidence.endpoint.quote?.date).toBe("2026-01-28");
  });
  it("allows legal US in-progress and weekend carry without a false missing-session gap", () => {
    const source = preparedFixture([fill("buy", "2026-01-05T15:00:00Z")], [raw("2026-01-29", "110"), raw("2026-01-30", "120")]);
    const batch = projectHomepageV25Boundaries(source, { ...batchQuery, endpoints: [{ key: "progress", at: "2026-01-30T20:00:00Z" }, { key: "weekend", at: "2026-02-01" }] });
    expect(batch.points.map(p => p.net.value)).toEqual(["10", "20"]);
    expect(batch.points[0].instruments[0].quoteCoverage.endpoint.state).toBe("session-in-progress-carry");
    expect(batch.points[1].instruments[0].quoteCoverage.endpoint.state).toBe("market-closed-carry");
  });
  it("keeps current independent and future points null without leaking future fills", () => {
    const source = preparedFixture([fill("buy", "2026-01-05T15:00:00Z"), fill("future", "2026-03-05T15:00:00Z")], [raw("2026-01-30", "110")]);
    const batch = projectHomepageV25Boundaries(source, { ...batchQuery, periodStart: "2026-03-01", endpoints: [{ key: "future", at: "2026-03-20" }] });
    expect(batch.points[0]).toMatchObject({ state: "future", plottable: false, effectiveCursor: null, net: { value: null } });
    expect(batch.current.currentMarketValue.value).toBe("110");
    expect(batch.current.instruments[0].evidence.current.executionIds).toEqual(["buy"]);
  });
  it("captures immutable evidence and invalidates content despite unchanged caller revisions", () => {
    const quotes = [raw("2026-01-29", "110")], fills = [fill("buy", "2026-01-05T15:00:00Z")];
    const first = preparedFixture(fills, quotes); quotes[0].close = "150";
    const second = preparedFixture(fills, quotes);
    expect(first.sourceId).not.toBe(second.sourceId);
    const query = { ...batchQuery, endpoints: [{ key: "p", at: "2026-01-30T10:00:00Z" }] };
    expect(projectHomepageV25Boundaries(first, query).points[0].net.value).toBe("10");
    expect(projectHomepageV25Boundaries(second, query).points[0].net.value).toBe("50");
    expect(Object.isFrozen(projectHomepageV25Boundaries(first, query))).toBe(true);
  });
  it("rejects a whole invalid boundary request with a structured code", () => {
    const source = preparedFixture([], []);
    expect(() => projectHomepageV25Boundaries(source, { ...batchQuery, endpoints: [{ key: "same", at: "2026-01-10" }, { key: "same", at: "2026-01-11" }] })).toThrow(expect.objectContaining({ code: "endpoint-key-duplicate" }));
    expect(() => projectHomepageV25Boundaries(source, { ...batchQuery, asOf: "2026-02-02" })).toThrow(expect.objectContaining({ code: "as-of-instant-required" }));
  });
});

describe("P2 actual incurred fees and cache boundaries", () => {
  const ipoFills = () => {
    const common = { accountId: "a", market: "US", symbol: "AAPL", currency: "USD", source: [{ page: 1, row: 2 }] };
    return [fill("sale", "2026-01-15T15:00:00Z", { side: "sell", price: "120", fee: "1", source: { platform: "statement", row: 1, positionEvents: [
      { ...common, id: "application", kind: "ipo", date: "2026-01-08", amount: "-220", description: "IPO application" },
      { ...common, id: "fee", kind: "fee", date: "2026-01-08", amount: "-2", description: "IPO fee" },
      { ...common, id: "allocation", kind: "ipo", date: "2026-01-10", quantity: "2", displayTimePolicy: "session-open", description: "IPO allocation" },
      { ...common, id: "refund", kind: "ipo", date: "2026-01-20", amount: "20", description: "IPO refund" },
    ] } })];
  };
  it("keeps actual Jan8 fees independent of cost knowledge and the Jan20 refund", () => {
    const source = preparedFixture(ipoFills(), [raw("2026-01-16", "110"), raw("2026-01-21", "110"), raw("2026-01-30", "110")]);
    const first = projectHomepageV25Boundaries(source, { ...batchQuery, endpoints: [{ key: "early", at: "2026-01-18" }, { key: "late", at: "2026-01-22T10:00:00Z" }] });
    const [early, late] = first.points;
    expect([early.periodFees.value, early.net.value, early.instruments[0].canonicalKnownFees.value]).toEqual(["3", null, "1"]);
    expect([late.periodFees.value, late.periodRealized.value, late.unrealizedNet.value, late.net.value, late.openFees.value, late.instruments[0].canonicalKnownFees.value]).toEqual(["3", "18", "9", "27", "1", "3"]);
    const narrow = projectHomepageV25Boundaries(source, { ...batchQuery, periodStart: "2026-01-12", endpoints: [{ key: "late", at: "2026-01-22T10:00:00Z" }] });
    expect(narrow.points[0].periodFees.value).toBe("1");
    const fee = first.feeFacts.find(f => f.lineage.eventIds.includes("fee"));
    expect(fee).toMatchObject({ expense: "2", incurred: { businessDate: "2026-01-08", precision: "day" }, knowledge: { availableAt: "2026-01-08T23:59:59.999Z" } });
    expect(first.points[0].net.value).toBeNull();
  });
  it("does not assign an unlinked statement fee to a guessed instrument or turn it into zero", () => {
    const fills = ipoFills();
    fills[0].source.positionEvents = fills[0].source.positionEvents!.map(e => e.id === "fee" ? { ...e, symbol: undefined, market: undefined } : e);
    const source = preparedFixture(fills, [raw("2026-01-21", "110")]);
    const batch = projectHomepageV25Boundaries(source, { ...batchQuery, endpoints: [{ key: "p", at: "2026-01-22T10:00:00Z" }] });
    expect(batch.points[0].periodFees.value).toBeNull();
    expect(batch.points[0].periodFees.reasons).toContain("fee-attribution-unavailable");
    expect(batch.feeFacts.find(f => f.kind === "statement-fee")).toMatchObject({ expense: null, instrumentId: null, coverage: "unknown" });
  });
  it("reuses exact ordinary prefixes while different ranges share an independent current object", () => {
    const fills = [fill("one", "2026-01-05T15:00:00Z", { quantity: "2", fee: "2" }), fill("two", "2026-01-15T15:00:00Z", { side: "sell", price: "120", fee: "1" })];
    const source = preparedFixture(fills, [raw("2026-01-29", "110"), raw("2026-01-30", "115")]);
    const first = projectHomepageV25Boundaries(source, { ...batchQuery, endpoints: [{ key: "a", at: "2026-01-30T10:00:00Z" }, { key: "same", at: "2026-01-30T10:00:00Z" }] });
    const repeat = projectHomepageV25Boundaries(source, { ...batchQuery, endpoints: [{ key: "a", at: "2026-01-30T10:00:00Z" }, { key: "same", at: "2026-01-30T10:00:00Z" }] });
    const second = projectHomepageV25Boundaries(source, { ...batchQuery, periodStart: "2026-01-12", endpoints: [{ key: "b", at: "2026-01-30T10:00:00Z" }] });
    expect(repeat).toBe(first); expect(second.current).toBe(first.current);
    expect(first.points.map(p => p.net.value)).toEqual(["27", "27"]);
    expect(first.current.currentUnrealized.value).toBe("14");
    expect(first.diagnostics.canonicalCalls).toBeLessThanOrEqual(5);
    expect(first.diagnostics.cacheEntries).toBeLessThanOrEqual(8192);
    expect(first.diagnostics.cacheEstimatedBytes).toBeLessThanOrEqual(64 * 1024 * 1024);
  });
});

import * as preparedPerformance from "./homepage-v25-performance";
describe("P2 sweep and current compatibility",()=>{
  it("uses one canonical traversal and one fee projection for many ordinary prefixes",()=>{
    expect(preparedPerformance.inspectHomepageV25PreparedSource).toBeTypeOf("function");
    const fills=Array.from({length:40},(_,i)=>fill(`s${i}`,new Date(Date.parse("2026-01-05T15:00:00Z")+i*86400000).toISOString(),{side:i%2?"sell":"buy",price:i%2?"120":"100",fee:"1",source:{platform:"manual",row:i,positionEffect:i%2?"close-long":"open-long"}}));
    const source=preparedFixture(fills,[raw("2026-01-29","110"),raw("2026-01-30","110")]);
    const batch=projectHomepageV25Boundaries(source,{...batchQuery,endpoints:Array.from({length:20},(_,i)=>({key:`p${i}`,at:new Date(Date.parse("2026-01-05T10:00:00Z")+i*86400000).toISOString()}))});
    const stats=preparedPerformance.inspectHomepageV25PreparedSource(source);
    expect(stats.canonicalSweeps).toBe(1); expect(stats.canonicalTransitions).toBe(40); expect(stats.canonicalCalls).toBe(0); expect(stats.feeSteps).toBe(40);
    expect(batch.points).toHaveLength(20);
    const before=stats.batchCacheHits; projectHomepageV25Boundaries(source,{...batchQuery,endpoints:Array.from({length:20},(_,i)=>({key:`p${i}`,at:new Date(Date.parse("2026-01-05T10:00:00Z")+i*86400000).toISOString()}))});
    expect(preparedPerformance.inspectHomepageV25PreparedSource(source).batchCacheHits).toBe(before+1);
  });
  it("preserves every F3 current metric/evidence under raw quote edge cases",()=>{
    const scenarios=[
      {name:"duplicates",quotes:[raw("2026-01-30","111"),raw("2026-01-30","222")]},
      {name:"malformed",quotes:[raw("2026-01-30","bad")]},
      {name:"negative",quotes:[raw("2026-01-30","-1")]},
      {name:"currency",quotes:[{...raw("2026-01-30","110"),currency:"HKD"}]},
      {name:"wrong-id",quotes:[{...raw("2026-01-30","110"),instrumentId:"US:OTHER"}]},
      {name:"future",quotes:[raw("2026-03-02","900"),raw("2026-01-30","110")]},
      {name:"weekend",quotes:[raw("2026-02-01","999"),raw("2026-01-30","110")]},
      {name:"in-progress",quotes:[raw("2026-01-30","999"),raw("2026-01-29","110")],asOf:"2026-01-30T20:00:00Z"},
      {name:"old-range",quotes:[raw("2009-12-31","999")]},
      {name:"unsupported",quotes:[raw("2026-01-30","110")],market:"OTHER"},
    ];
    for(const scenario of scenarios){
      const e=fill(scenario.name,"2026-01-05T15:00:00Z",{fee:"2"}); if(scenario.market)e.instrument={...e.instrument,market:scenario.market};
      const candlesByInstrument={"US:AAPL":scenario.quotes};
      // Entries can predate a raw-provider refresh. Invalid refreshed prices
      // must reach F directly rather than fail upstream episode metrics first.
      const entries=buildTradeLibraryEntries(buildInstrumentTradeSummaries([e]),{},{});
      const asOf=scenario.asOf??batchQuery.asOf;
      const legacy=buildHomepageV25PerformanceFromEntries({entries,candlesByInstrument,asOf,period:{start:"2026-01-01",end:"2026-01-30"}});
      const source=prepareHomepageV25Source({entries,candlesByInstrument,fxObservations:[],currentFxSnapshot:null,lifetimeSourceCoverage:[],revisions:{trades:"t",quotes:"q",metadata:"m",fx:"f"}});
      const current=projectHomepageV25Boundaries(source,{...batchQuery,asOf}).current;
      expect([current.currentMarketValue,current.currentUnrealized,current.currentOpenFees,current.instruments.map(i=>i.evidence.current)],scenario.name).toEqual([legacy.currentMarketValue,legacy.currentUnrealized,legacy.currentOpenFees,legacy.instruments.map(i=>i.evidence.current)]);
    }
  });
  it("enforces four full batches as actual LRU with live bounded diagnostics",()=>{
    expect(preparedPerformance.inspectHomepageV25PreparedSource).toBeTypeOf("function");
    const source=preparedFixture([fill("buy","2026-01-05T15:00:00Z")],[raw("2026-01-29","110")]);
    const q=(key:string)=>({...batchQuery,endpoints:[{key,at:"2026-01-30T10:00:00Z"}]});
    const first=projectHomepageV25Boundaries(source,q("a")), second=projectHomepageV25Boundaries(source,q("b"));
    projectHomepageV25Boundaries(source,q("c"));projectHomepageV25Boundaries(source,q("d"));
    expect(projectHomepageV25Boundaries(source,q("a"))).toBe(first);
    projectHomepageV25Boundaries(source,q("e"));
    expect(projectHomepageV25Boundaries(source,q("a"))).toBe(first);
    expect(projectHomepageV25Boundaries(source,q("b"))).not.toBe(second);
    const stats=preparedPerformance.inspectHomepageV25PreparedSource(source);
    expect(stats.batchEntries).toBe(4);expect(stats.cacheEntries).toBeLessThanOrEqual(8192);expect(stats.cacheEstimatedBytes).toBeLessThanOrEqual(64*1024*1024);
    expect(Object.isFrozen(stats)).toBe(true);
  });
});

describe("P2 canonical/F3 complete endpoint equivalence",()=>{
  const opening=fill("opening","2025-12-15T15:00:00Z",{quantity:"2",fee:"2"});
  const sell=fill("sale","2026-01-15T15:00:00Z",{side:"sell",price:"130",fee:"1",source:{platform:"manual",row:2,positionEffect:"close-long"}});
  const cases: {name:string; fills:TradeExecution[]}[]=[
    {name:"partial-long",fills:[opening,sell]},
    {name:"average-cost",fills:[opening,fill("higher","2025-12-16T15:00:00Z",{price:"200",fee:"3"}),sell]},
    {name:"short-partial",fills:[fill("short","2025-12-15T15:00:00Z",{side:"sell",quantity:"2",price:"130",fee:"2",source:{platform:"manual",row:1,positionEffect:"open-short"}}),fill("cover","2026-01-15T15:00:00Z",{price:"100",fee:"1",source:{platform:"manual",row:2,positionEffect:"close-short"}})]},
    {name:"reverse",fills:[opening,{...sell,quantity:"3",source:{...sell.source,positionEffect:"open-short"}},fill("cover","2026-01-20T15:00:00Z",{price:"110",fee:"1",source:{platform:"manual",row:3,positionEffect:"close-short"}})]},
    {name:"unknown-fees",fills:[{...opening,source:{...opening.source,feeStatus:"unknown"}},sell]},
    {name:"malformed-price",fills:[{...opening,price:"bad"},sell]},
    {name:"malformed-fee",fills:[{...opening,fee:"bad"},sell]},
    {name:"unknown-history",fills:[{...opening,source:{...opening.source,historyIncomplete:["prior"]}},sell]},
    {name:"duplicate-identical",fills:[opening,structuredClone(opening),sell]},
    {name:"duplicate-quantity",fills:[opening,{...opening,quantity:"3"},sell]},
    {name:"timestamp-tie",fills:[opening,{...sell,executedAt:opening.executedAt}]},
    {name:"date-only-nonprefix",fills:[{...opening,executedAt:"2026-01-05",source:{...opening.source,timePrecision:"date-only",tradingDate:"2026-01-05"}},fill("earlier-clock","2026-01-05T10:00:00Z"),sell]},
  ];
  for(const item of cases)it(`matches original wrapper complete finance/evidence for ${item.name}`,()=>{
    const quotes=[raw("2026-01-02","120"),raw("2026-01-29","115"),raw("2026-01-30","118")],candlesByInstrument={"US:AAPL":quotes};
    const entries=buildTradeLibraryEntries(buildInstrumentTradeSummaries(item.fills.map(e=>({...e,price:e.price==="bad"?"0":e.price,fee:e.fee==="bad"?"0":e.fee}))),{},{});
    // Preserve the exact original raw lineage, including intentionally malformed
    // values, after upstream creates the real episode/entry identity.
    entries[0].executions=structuredClone(item.fills);
    const legacy=buildHomepageV25PerformanceFromEntries({entries,candlesByInstrument,asOf:batchQuery.asOf,period:{start:"2026-01-06",end:"2026-01-30"}});
    const source=prepareHomepageV25Source({entries,candlesByInstrument,fxObservations:[],currentFxSnapshot:null,lifetimeSourceCoverage:[],revisions:{trades:item.name,quotes:"q",fx:"f",metadata:"m"}});
    const point=projectHomepageV25Boundaries(source,{...batchQuery,periodStart:"2026-01-06",endpoints:[{key:"p",at:"2026-01-30"}]}).points[0];
    expect([point.periodRealized,point.openingUnrealized,point.closingUnrealized,point.net]).toEqual([legacy.periodRealized,legacy.openingUnrealized,legacy.closingUnrealized,legacy.net]);
    expect(point.instruments.map(i=>i.evidence)).toEqual(legacy.instruments.map(i=>({opening:i.evidence.opening,endpoint:i.evidence.closing})));
  });
});

describe("P2 evidence completeness beyond held exposure",()=>{
  it("counts known actual fees before an allocation establishes any stock exposure",()=>{
    const common={accountId:"a",market:"US",symbol:"AAPL",currency:"USD",source:[{page:1,row:1}]};
    const e=fill("future-sale","2026-01-15T15:00:00Z",{side:"sell",price:"120",source:{platform:"statement",row:1,positionEvents:[
      {...common,id:"application",kind:"ipo",date:"2026-01-08",amount:"-220",description:"IPO application"},
      {...common,id:"fee",kind:"fee",date:"2026-01-08",amount:"-2",description:"IPO fee"},
      {...common,id:"allocation",kind:"ipo",date:"2026-01-10",quantity:"2",displayTimePolicy:"session-open",description:"IPO allocation"},
      {...common,id:"refund",kind:"ipo",date:"2026-01-20",amount:"20",description:"IPO refund"},
    ]}});
    const source=preparedFixture([e],[]),point=projectHomepageV25Boundaries(source,{...batchQuery,endpoints:[{key:"pre-allocation",at:"2026-01-09"}]}).points[0];
    expect(point.periodFees.value).toBe("2");expect(point.instruments[0].feeFactIds).toHaveLength(1);expect(point.marketValue.value).toBe("0");
  });
  it("rejects conflicting historical observation IDs in both orders, with native money retained",()=>{
    const first=observation("2026-01-30","7"),conflict={...first,rates:{"USD/CNY":"8"}};
    for(const fxObservations of [[first,conflict],[conflict,first]]){
      const source=preparedFixture([fill("buy","2026-01-05T15:00:00Z")],[raw("2026-01-29","110")],{fxObservations});
      const point=projectHomepageV25Boundaries(source,{...batchQuery,targetCurrency:"CNY",endpoints:[{key:"p",at:"2026-01-30T10:00:00Z"}]}).points[0];
      expect(point.net.value).toBeNull();expect(point.net.money.originalByCurrency).toEqual({USD:"10"});expect(point.fxCoverage.reasons).toContain("fx-evidence-conflict");
    }
  });
  it("preserves the actual current FX snapshot metadata and F3 metric/evidence values",()=>{
    const snapshot={id:"latest-original-id",source:"real-source",asOf:"2026-02-02T00:00:00Z",status:"complete" as const,baseCurrency:"CNY" as const,rates:{"USD/CNY":"7"}};
    const candlesByInstrument={"US:AAPL":[raw("2026-01-30","110")]},entries=buildTradeLibraryEntries(buildInstrumentTradeSummaries([fill("buy","2026-01-05T15:00:00Z",{fee:"2"})]),{},{});
    const source=prepareHomepageV25Source({entries,candlesByInstrument,fxObservations:[],currentFxSnapshot:{snapshot,fetchedAt:"2026-02-02T00:01:00Z",publishedAtByPair:{"USD/CNY":"2026-02-02T00:00:00Z"},sourceRevision:"real-revision",evidenceIds:["actual-fetch"]},lifetimeSourceCoverage:[],revisions:{trades:"t",quotes:"q",metadata:"m",fx:"f"}});
    const current=projectHomepageV25Boundaries(source,{...batchQuery,targetCurrency:"CNY"}).current;
    const legacy=buildHomepageV25PerformanceFromEntries({entries,candlesByInstrument,period:{start:"2026-01-01",end:"2026-01-30"},asOf:batchQuery.asOf,targetCurrency:"CNY",fxSnapshot:snapshot});
    expect([current.currentMarketValue,current.currentUnrealized,current.currentOpenFees]).toEqual([legacy.currentMarketValue,legacy.currentUnrealized,legacy.currentOpenFees]);
  });
});

describe("P2 per-market and evidence isolation",()=>{
  it("keeps the fee prefix bounded by both actual period start and exact endpoint knowledge",()=>{
    const source=preparedFixture([fill("before-period","2026-01-05T15:00:00Z",{fee:"2"}),fill("in-period","2026-01-06T15:00:00Z",{fee:"3"}),fill("later","2026-01-07T15:00:00Z",{fee:"4"})],[raw("2026-01-30","110")]);
    const points=projectHomepageV25Boundaries(source,{...batchQuery,periodStart:"2026-01-06",endpoints:[{key:"before",at:"2026-01-06T14:59:59Z"},{key:"at",at:"2026-01-06T15:00:00Z"},{key:"after",at:"2026-01-08"}]}).points;
    expect(points.map(p=>p.periodFees.value)).toEqual(["0","3","7"]);
    expect(points.map(p=>p.instruments[0].feeFactIds.length)).toEqual([0,1,2]);
  });
  it("keeps month, coarse-day, and unknown fee evidence outside the ordinary prefix",()=>{
    const common={accountId:"a",market:"US",symbol:"AAPL",currency:"USD",source:[{page:1,row:1}]};
    const monthly=preparedFixture([fill("month-carrier","2026-01-05T15:00:00Z",{fee:"0",source:{platform:"statement",row:1,positionEvents:[{...common,id:"monthly-fee",kind:"fee",date:"2026-01",amount:"-5",description:"monthly fee"}]}})],[raw("2026-01-30","110")]);
    expect(projectHomepageV25Boundaries(monthly,{...batchQuery,endpoints:[{key:"whole",at:"2026-02-02T10:00:00Z"}]}).points[0].periodFees.value).toBe("5");
    const partial=projectHomepageV25Boundaries(monthly,{...batchQuery,periodStart:"2026-01-12",endpoints:[{key:"partial",at:"2026-02-02T10:00:00Z"}]}).points[0].periodFees;
    expect(partial.value).toBeNull();expect(partial.reasons).toContain("fee-incurred-boundary-ambiguous");
    const coarse=preparedFixture([fill("day-fee","2026-01-05",{fee:"2",source:{platform:"statement",row:1,timePrecision:"date-only",tradingDate:"2026-01-05"}})],[raw("2026-01-30","110")]);
    expect(projectHomepageV25Boundaries(coarse,{...batchQuery,endpoints:[{key:"before-known",at:"2026-01-05"},{key:"known",at:"2026-01-06"}]}).points.map(p=>p.periodFees.value)).toEqual(["0","2"]);
    const unknown=preparedFixture([fill("unknown-fee","2026-01-05T15:00:00Z",{fee:"2",source:{platform:"statement",row:1,feeStatus:"unknown"}})],[raw("2026-01-30","110")]);
    expect(projectHomepageV25Boundaries(unknown,batchQuery).points[0].periodFees.value).toBeNull();
  });
  it("indexes ordinary incurred fee knowledge once instead of reparsing it at every endpoint",()=>{
    const fills=[fill("known-fee-a","2026-01-05T15:00:00Z",{fee:"2"}),fill("known-fee-b","2026-01-06T15:00:00Z",{fee:"3"})];
    const source=preparedFixture(fills,[raw("2026-01-30","110")]);
    const parse=vi.spyOn(Date,"parse");
    try{
      const result=projectHomepageV25Boundaries(source,{...batchQuery,endpoints:Array.from({length:20},(_,i)=>({key:`f${i}`,at:`2026-01-${String(7+i).padStart(2,"0")}`}))});
      expect(result.points.map(p=>p.periodFees.value)).toEqual(Array(20).fill("5"));
      // The final feeFacts evidence pass still validates this timestamp three
      // times; historical endpoint count must add no more parsing of this fee.
      expect(parse.mock.calls.filter(([value])=>value===new Date(fills[0].executedAt).toISOString()).length).toBeLessThanOrEqual(3);
    }finally{parse.mockRestore();}
  });
  it("accounts shared retained memo objects without serializing original execution prefixes",()=>{
    const fills=Array.from({length:40},(_,i)=>fill(`memory-${i}`,`2026-01-${String(5+Math.floor(i/2)).padStart(2,"0")}T${i%2?"15:01":"15:00"}:00Z`,{side:i%2?"sell":"buy",price:i%2?"101":"100"}));
    const source=preparedFixture(fills,[raw("2026-01-30","110")]);
    const stringify=vi.spyOn(JSON,"stringify");
    try{
      const batch=projectHomepageV25Boundaries(source,{...batchQuery,endpoints:Array.from({length:25},(_,i)=>({key:`m${i}`,at:`2026-01-${String(5+i).padStart(2,"0")}`}))});
      const serializedStates=stringify.mock.calls.filter(([value])=>value&&typeof value==="object"&&"executions" in value);
      expect(serializedStates).toHaveLength(0);
      const live=preparedPerformance.inspectHomepageV25PreparedSource(source);
      // A graph estimate is not a JSON-size proxy: source IDs are shared,
      // while every new point/metric object and array slot still counts.
      expect(live.cacheEstimatedBytes).toBeGreaterThan(batch.points.length*4096);
      expect(live.cacheEstimatedBytes).toBeLessThanOrEqual(64*1024*1024);
      expect(live.sourceEstimatedBytes).toBeGreaterThan(0);expect(live.indexEstimatedBytes).toBeGreaterThan(0);
    }finally{stringify.mockRestore();}
  });
  it("retains every native subtotal while gating only the missing instrument quote",()=>{
    const instruments=[{id:"US:AAPL",symbol:"AAPL",name:"A",market:"US",currency:"USD"},{id:"HK:00700",symbol:"00700",name:"H",market:"HK",currency:"HKD"},{id:"CN-SH:600000",symbol:"600000",name:"C",market:"CN-SH",currency:"CNY"}];
    const fills=instruments.map((instrument,i)=>fill(`m${i}`,"2026-01-05T10:00:00Z",{instrument}));
    const quotes=[raw("2026-01-29","110",instruments[0]),raw("2026-01-30","110",instruments[1]),raw("2026-01-29","110",instruments[2])];
    const fx={...observation("2026-01-30","7"),rates:{"USD/CNY":"7","HKD/CNY":"0.9"},publishedAtByPair:{"USD/CNY":"2026-01-30T00:00:00Z","HKD/CNY":"2026-01-30T00:00:00Z"},knownAtByPair:{"USD/CNY":"2026-01-30T00:00:00Z","HKD/CNY":"2026-01-30T00:00:00Z"}};
    const source=preparedFixture(fills,quotes,{fxObservations:[fx]});
    const point=projectHomepageV25Boundaries(source,{...batchQuery,targetCurrency:"CNY",endpoints:[{key:"p",at:"2026-01-30T10:00:00Z"}]}).points[0];
    expect(point.net.value).toBeNull();expect(point.net.money.originalByCurrency).toEqual({USD:"10",HKD:"10"});
    expect(point.instruments.map(i=>[i.identity.instrumentId,i.net.value,i.quoteCoverage.endpoint.state])).toEqual([["CN-SH:600000",null,"missing-completed-session"],["HK:00700","9","complete"],["US:AAPL","70","session-in-progress-carry"]]);
    expect(point.periodRealized.value).toBe("0");expect(point.periodFees.value).toBe("0");
  });
  it("retains day precision for date-only fills while exact asOf remains knowledge-bounded",()=>{
    const e=fill("date-only","2026-01-05",{source:{platform:"statement",row:1,timePrecision:"date-only",tradingDate:"2026-01-05",positionEffect:"open-long"}});
    const source=preparedFixture([e],[raw("2026-01-02","110")]);
    const batch=projectHomepageV25Boundaries(source,{...batchQuery,endpoints:[{key:"day",at:"2026-01-05"},{key:"instant",at:"2026-01-05T15:59:59.999Z"}]});
    expect(batch.points.map(p=>p.instruments[0].evidence.endpoint.executionIds)).toEqual([["date-only"],[]]);
    expect(batch.points.map(p=>p.marketValue.value)).toEqual(["110","0"]);
  });
  it("does not let mutation of returned evidence poison a cached result",()=>{
    const source=preparedFixture([fill("buy","2026-01-05T15:00:00Z")],[raw("2026-01-29","110")]);
    const query={...batchQuery,endpoints:[{key:"p",at:"2026-01-30T10:00:00Z"}]},first=projectHomepageV25Boundaries(source,query);
    expect(Reflect.set(first.points[0].net.money.originalByCurrency,"USD","999")).toBe(false);
    expect(()=>{first.current.instruments[0].evidence.current.executionIds.push("future");}).toThrow();
    expect(projectHomepageV25Boundaries(source,query).points[0].net.value).toBe("10");
    expect(first.diagnostics.batchCacheHits).toBe(0);expect(preparedPerformance.inspectHomepageV25PreparedSource(source).batchCacheHits).toBe(1);
  });
});

describe("P2 exact immutable public graph sharing", () => {
  it("shares identical complete metric content and common metadata without dropping public fields", () => {
    // A factory that only returns equal newly allocated metadata or repeats the
    // closing-unrealized calculation breaks the retained-graph contract.
    const source = preparedFixture([fill("shared-buy", "2026-01-05T15:00:00Z")], [raw("2026-01-29", "110")], { fxObservations: [observation("2026-01-30", "7")] });
    const query = { ...batchQuery, targetCurrency: "CNY", endpoints: [{ key: "a", at: "2026-01-30T10:00:00Z" }, { key: "b", at: "2026-01-30T10:00:00Z" }] };
    const batch = projectHomepageV25Boundaries(source, query), [first, second] = batch.points, group = first.instruments[0];
    expect(group.net).toEqual({ value: "70", available: true, coverage: { total: 1, available: 1 }, reasons: [], money: { originalByCurrency: { USD: "10" }, targetCurrency: "CNY", conversion: "complete", fx: { id: "fx-2026-01-30", source: "broker-history", asOf: "2026-01-30T10:00:00.000Z", status: "complete" } } });
    expect(group.closingUnrealized).toBe(group.unrealizedNet);
    expect(second.instruments[0].net).toBe(group.net);
    expect(first.net).toBe(group.net);
    expect(group.net.coverage).toBe(group.marketValue.coverage);
    expect(group.net.reasons).toBe(group.marketValue.reasons);
    expect(group.net.money.fx).toBe(group.marketValue.money.fx);
    expect(group.net.money.originalByCurrency).toBe(group.closingUnrealized.money.originalByCurrency);
    expect(Object.keys(first)).toEqual(["periodRealized", "openingUnrealized", "closingUnrealized", "unrealizedChange", "net", "lifetimeRealizedNet", "lifetimeNet", "marketValue", "unrealizedNet", "openFees", "periodFees", "key", "requestedAt", "businessDate", "effectiveCursor", "boundaryPrecision", "state", "plottable", "instruments", "quoteCoverage", "fxCoverage", "lifetimeCoverage", "reasons"]);
    const seen = new Set<object>();
    const checkFrozen = (value: unknown) => { if (value && typeof value === "object" && !seen.has(value)) { seen.add(value); expect(Object.isFrozen(value)).toBe(true); Object.values(value).forEach(checkFrozen); } };
    checkFrozen(batch);
    expect(Reflect.set(group.net.coverage, "available", 0)).toBe(false);
    expect(Reflect.set(group.net.money.fx!, "asOf", "2099-01-01")).toBe(false);
    expect(projectHomepageV25Boundaries(source, query)).toBe(batch);
  });

  it("keeps equal numbers with different exposure coverage and endpoint FX evidence distinct", () => {
    // Numeric-only keys would merge zero/empty scopes or erase dated FX clocks.
    const source = preparedFixture([fill("covered-zero", "2026-01-05T15:00:00Z")], [raw("2026-01-29", "110"), raw("2026-01-30", "110")], { fxObservations: [observation("2026-01-30", "7"), observation("2026-01-31", "7")] });
    const points = projectHomepageV25Boundaries(source, { ...batchQuery, targetCurrency: "CNY", endpoints: [{ key: "empty", at: "2026-01-02" }, { key: "a", at: "2026-01-30T10:00:00Z" }, { key: "b", at: "2026-01-31T10:00:00Z" }] }).points;
    expect(points.map(p => p.periodFees.value)).toEqual(["0", "0", "0"]);
    expect(points[0].periodFees.coverage).toEqual({ total: 0, available: 0 });
    expect(points[1].periodFees.coverage).toEqual({ total: 1, available: 1 });
    expect(points[0].periodFees).not.toBe(points[1].periodFees);
    expect(points[1].net.value).toBe("70"); expect(points[2].net.value).toBe("70");
    expect(points[1].net.money.fx).not.toBe(points[2].net.money.fx);
    expect(points[1].net.money.fx?.id).toBe("fx-2026-01-30");
    expect(points[2].net.money.fx?.id).toBe("fx-2026-01-31");
    expect(points[1].net).not.toBe(points[2].net);
    expect(points[1].lifetimeNet.value).toBeNull();
    expect(points[1].lifetimeNet.reasons).toEqual(["lifetime-source-incomplete"]);
    expect(points[1].lifetimeNet.reasons).not.toBe(points[1].net.reasons);
  });

  it("rejects an oversized candidate without evicting the existing admitted batch", () => {
    // Entry-key and public-key retention together exceed the unchanged 64MiB
    // estimate; returning the complete oversized result remains valid.
    const source = preparedFixture([fill("admitted-buy", "2026-01-05T15:00:00Z")], [raw("2026-01-29", "110")]);
    const query = { ...batchQuery, endpoints: [{ key: "small", at: "2026-01-30T10:00:00Z" }] };
    const first = projectHomepageV25Boundaries(source, query), before = preparedPerformance.inspectHomepageV25PreparedSource(source);
    const hugeKey = "oversized-" + "x".repeat(17 * 1024 * 1024);
    const rejected = projectHomepageV25Boundaries(source, { ...query, endpoints: [{ key: hugeKey, at: "2026-01-30T10:00:00Z" }] });
    expect(rejected.points[0].key).toBe(hugeKey); expect(rejected.points[0].net.value).toBe("10");
    const after = preparedPerformance.inspectHomepageV25PreparedSource(source);
    expect(after.batchEntries).toBe(before.batchEntries);
    expect(after.evictions).toBe(before.evictions);
    expect(after.cacheEstimatedBytes).toBe(before.cacheEstimatedBytes);
    expect(projectHomepageV25Boundaries(source, query)).toBe(first);
  });
});

// Calendar-resume candidate 1: additive FX eligibility regressions.
describe("P2 boundary FX eligibility follows native dependencies", () => {
  const hkd = { id: "HK:00005", symbol: "00005", name: "HSBC", market: "HK", currency: "HKD" };
  const currentUsd = { snapshot: { id: "current-usd", baseCurrency: "CNY" as const, source: "broker", asOf: "2026-02-02T00:00:00Z", status: "complete" as const, rates: { "USD/CNY": "7" } }, fetchedAt: "2026-02-02T00:01:00Z", publishedAtByPair: { "USD/CNY": "2026-02-02T00:00:00Z" }, sourceRevision: "f1", evidenceIds: ["current-fetch"] };
  const query = { ...batchQuery, periodStart: "2026-01-30", targetCurrency: "CNY" };
  const usdBuy = () => fill("eligible-usd", "2026-01-05T15:00:00Z");
  const futureHkd = (source: TradeExecution["source"] = { platform: "statement", row: 2 }) => fill("future-hkd", "2026-03-05T05:00:00Z", { instrument: hkd, source });
  const quotes = () => [raw("2026-01-28", "110"), raw("2026-01-29", "110"), raw("2026-01-30", "120"), raw("2026-01-30", "110", hkd)];
  it("does not require future-only HKD to convert independent endpoint and current USD", () => {
    const source = preparedFixture([usdBuy(), futureHkd()], quotes(), { fxObservations: [observation("2026-01-30", "7")], currentFxSnapshot: currentUsd });
    const batch = projectHomepageV25Boundaries(source, query), point = batch.points[0];
    expect([point.net.value, point.marketValue.value, batch.current.currentMarketValue.value, batch.current.currentUnrealized.value]).toEqual(["0", "770", "840", "140"]);
    expect(point.fxCoverage.requiredPairs).toEqual(["USD/CNY"]);
    expect(batch.current.fxCoverage.requiredPairs).toEqual(["USD/CNY"]);
    expect(point.instruments.find(i => i.identity.instrumentId === hkd.id)?.evidence.endpoint.executionIds).toEqual([]);
    expect(point.marketValue.money.originalByCurrency).toEqual({ USD: "110" });
  });
  it("keeps an actual HKD exposure unavailable without its own rate", () => {
    const source = preparedFixture([usdBuy(), fill("active-hkd", "2026-01-05T05:00:00Z", { instrument: hkd })], quotes(), { fxObservations: [observation("2026-01-30", "7")], currentFxSnapshot: currentUsd });
    const batch = projectHomepageV25Boundaries(source, query);
    expect(batch.points[0].fxCoverage).toMatchObject({ state: "partial", requiredPairs: ["USD/CNY", "HKD/CNY"] });
    expect(batch.points[0].marketValue.value).toBeNull(); expect(batch.current.currentMarketValue.value).toBeNull();
    expect(batch.points[0].marketValue.money.originalByCurrency).toEqual({ HKD: "110", USD: "110" });
  });
  it("retains closed-period realized HKD while independent flat current needs no HKD", () => {
    const source = preparedFixture([usdBuy(), fill("hkd-buy", "2026-01-05T05:00:00Z", { instrument: hkd }), fill("hkd-close", "2026-01-15T05:00:00Z", { instrument: hkd, side: "sell", price: "130" })], quotes(), { fxObservations: [observation("2026-01-30", "7")], currentFxSnapshot: currentUsd });
    const batch = projectHomepageV25Boundaries(source, { ...query, periodStart: "2026-01-01" });
    expect(batch.points[0].periodRealized.money.originalByCurrency).toEqual({ HKD: "30", USD: "0" });
    expect(batch.points[0].periodRealized.value).toBeNull();
    expect(batch.points[0].fxCoverage.requiredPairs).toEqual(["HKD/CNY", "USD/CNY"]);
    expect(batch.current.fxCoverage.requiredPairs).toEqual(["USD/CNY"]);
    expect(batch.current.currentMarketValue.value).toBe("840");
  });
  it("retains unknown-quantity FX dependencies instead of treating them as flat", () => {
    const e = fill("unknown-hkd", "2026-01-05T05:00:00Z", { instrument: hkd });
    const candlesByInstrument = { [hkd.id]: [raw("2026-01-30", "110", hkd)] };
    const entries = buildTradeLibraryEntries(buildInstrumentTradeSummaries([e]), {}, {});
    entries[0].executions[0].quantity = "unavailable";
    const source = prepareHomepageV25Source({ entries, candlesByInstrument, fxObservations: [observation("2026-01-30", "7")], currentFxSnapshot: currentUsd, lifetimeSourceCoverage: [], revisions: { trades: "unknown", quotes: "q", metadata: "m", fx: "f" } });
    const batch = projectHomepageV25Boundaries(source, query);
    expect(batch.points[0].instruments[0].evidence.endpoint.quantity).toBeNull();
    expect(batch.points[0].fxCoverage.requiredPairs).toEqual(["HKD/CNY"]);
    expect(batch.current.fxCoverage.requiredPairs).toEqual(["HKD/CNY"]);
    expect(batch.current.currentMarketValue.value).toBeNull();
  });
  it("requires FX for an early fee attached to a future carrier even without stock exposure", () => {
    const event = { id: "early-fee", accountId: "a", market: "HK", symbol: "00005", currency: "HKD", kind: "fee" as const, date: "2026-01-08", amount: "-2", description: "statement fee", source: [{ page: 1, row: 1 }] };
    const known = "2026-01-30T00:00:00Z", fx = { ...observation("2026-01-30", "7"), rates: { "HKD/CNY": "0.9" }, publishedAtByPair: { "HKD/CNY": known }, knownAtByPair: { "HKD/CNY": known } };
    const source = preparedFixture([futureHkd({ platform: "statement", row: 2, positionEvents: [event] })], quotes(), { fxObservations: [fx] });
    const batch = projectHomepageV25Boundaries(source, { ...query, periodStart: "2026-01-01" });
    expect(batch.points[0].periodFees).toMatchObject({ value: "1.8", coverage: { total: 1, available: 1 }, money: { originalByCurrency: { HKD: "2" } } });
    expect(batch.points[0].fxCoverage.requiredPairs).toEqual(["HKD/CNY"]);
    expect(batch.points[0].instruments[0].evidence.endpoint.executionIds).toEqual([]);
    expect(batch.points[0].instruments[0].feeFactIds).toHaveLength(1);
    expect(batch.current.fxCoverage.state).toBe("not-required");
  });
  it("keeps early statement inventory attached to a future carrier eligible", () => {
    const position = { accountId: "a", market: "HK", symbol: "00005", phase: "opening" as const, date: "2026-01-01", quantity: "2", source: [{ page: 1, row: 1 }] };
    const source = preparedFixture([futureHkd({ platform: "statement", row: 2, statementPositions: [position] })], quotes(), { fxObservations: [observation("2026-01-30", "7")], currentFxSnapshot: currentUsd });
    const batch = projectHomepageV25Boundaries(source, query);
    expect(batch.points[0].instruments[0].evidence.endpoint).toMatchObject({ executionIds: [], quantity: "2" });
    expect(batch.points[0].marketValue.money.originalByCurrency).toEqual({ HKD: "220" });
    expect(batch.points[0].fxCoverage.requiredPairs).toEqual(["HKD/CNY"]);
    expect(batch.current.fxCoverage.requiredPairs).toEqual(["HKD/CNY"]);
    expect(batch.current.currentMarketValue.value).toBeNull();
  });
});

import * as marketCalendar from "../market/calendar";
import * as marketSyncRange from "../market/sync-range";
describe("P2 batch-local market calendar sharing", () => {
  it("resolves each exact market/cursor once per batch while quotes stay instrument-specific", () => {
    const markets = ["US", "HK", "CN-SH", "CN-SZ"] as const;
    const instruments = markets.flatMap(market => [0, 1].map(i => ({ id: `${market}:CAL${i}`, market, symbol: `CAL${i}`, name: `Calendar ${i}`, currency: market === "US" ? "USD" : market === "HK" ? "HKD" : "CNY" })));
    const dates = ["2026-10-20", "2026-10-21", "2026-10-22", "2026-11-02", "2026-11-03", "2026-11-25", "2026-11-27"];
    const source = preparedFixture(instruments.map((instrument, i) => fill(`calendar-${i}`, "2026-01-05T05:00:00Z", { instrument })), instruments.flatMap((instrument, i) => dates.map(date => raw(date, String(110 + i), instrument))));
    const instants = ["2026-10-22T06:59:59Z", "2026-10-22T07:00:00Z", "2026-10-22T08:09:59Z", "2026-10-22T08:10:00Z", "2026-10-22T17:30:00Z", "2026-10-22T20:00:00Z", "2026-11-03T20:30:00Z", "2026-11-03T21:00:00Z", "2026-11-27T17:59:59Z", "2026-11-27T18:00:00Z"];
    const query = { periodStart: "2026-10-22", asOf: "2026-11-30T10:00:00Z", endpoints: instants.map((at, i) => ({ key: `session-${i}`, at })) };
    const range = vi.spyOn(marketSyncRange, "requiredMarketDataRange");
    try {
      const first = projectHomepageV25Boundaries(source, query);
      const byMarket = (point: (typeof first.points)[number], market: string) => point.instruments.filter(i => i.identity.instrumentId.startsWith(`${market}:`));
      expect(byMarket(first.points[0], "CN-SH")[0].quoteCoverage.endpoint.requiredCompletedSession).toBe("2026-10-21");
      expect(byMarket(first.points[1], "CN-SH")[0].quoteCoverage.endpoint.requiredCompletedSession).toBe("2026-10-22");
      expect(byMarket(first.points[2], "HK")[0].quoteCoverage.endpoint.requiredCompletedSession).toBe("2026-10-21");
      expect(byMarket(first.points[3], "HK")[0].quoteCoverage.endpoint.requiredCompletedSession).toBe("2026-10-22");
      expect(byMarket(first.points[4], "US")[0].quoteCoverage.endpoint.requiredCompletedSession).toBe("2026-10-21");
      expect(byMarket(first.points[5], "US")[0].quoteCoverage.endpoint.requiredCompletedSession).toBe("2026-10-22");
      expect(byMarket(first.points[6], "US")[0].quoteCoverage.endpoint.requiredCompletedSession).toBe("2026-11-02");
      expect(byMarket(first.points[7], "US")[0].quoteCoverage.endpoint.requiredCompletedSession).toBe("2026-11-03");
      expect(byMarket(first.points[8], "US")[0].quoteCoverage.endpoint.requiredCompletedSession).toBe("2026-11-25");
      expect(byMarket(first.points[9], "US")[0].quoteCoverage.endpoint.requiredCompletedSession).toBe("2026-11-27");
      expect(byMarket(first.points[5], "US").map(i => i.marketValue.value)).toEqual(["110", "111"]);
      const keys = range.mock.calls.map(([start, end, options]) => `${options?.market}|${start}|${end}`);
      expect(keys).toHaveLength(new Set(keys).size);
      expect(keys).toHaveLength(markets.length * (instants.length + 2));
      range.mockClear();
      // A different batch must recalculate calendar facts; no retained source
      // cache may bypass the existing graph/memo budget.
      projectHomepageV25Boundaries(source, { ...query, endpoints: query.endpoints.map(e => ({ ...e, key: `second-${e.key}` })) });
      expect(range.mock.calls).toHaveLength(markets.length * (instants.length + 1));
    } finally { range.mockRestore(); }
  });
  it("shares completed-session failures only within the exact market/cursor", () => {
    const instruments = [0, 1].map(i => ({ ...usdInstrument, id: `US:UNAVAILABLE${i}`, symbol: `UNAVAILABLE${i}` }));
    const source = preparedFixture(instruments.map((instrument, i) => fill(`range-${i}`, "2026-01-05T15:00:00Z", { instrument })), instruments.map(instrument => raw("2026-01-30", "110", instrument)));
    const range = vi.spyOn(marketSyncRange, "requiredMarketDataRange");
    try {
      const batch = projectHomepageV25Boundaries(source, { periodStart: "2031-01-02", asOf: "2031-01-03T22:00:00Z", endpoints: [{ key: "range", at: "2031-01-02T22:00:00Z" }] });
      expect(batch.points[0].instruments.map(i => i.quoteCoverage.endpoint.state)).toEqual(["calendar-unavailable", "calendar-unavailable"]);
      expect(batch.current.instruments.map(i => i.currentMarketValue.reasons)).toEqual([["quote-session-unavailable"], ["quote-session-unavailable"]]);
      expect(range.mock.calls).toHaveLength(3);
    } finally { range.mockRestore(); }
  });
  it("keeps a missing instrument session independent from a complete peer", () => {
    const peer = { ...usdInstrument, id: "US:PEER", symbol: "PEER" };
    const source = preparedFixture([fill("gap-original", "2026-01-05T15:00:00Z"), fill("complete-peer", "2026-01-05T15:00:00Z", { instrument: peer })], [raw("2026-01-28", "110"), raw("2026-01-29", "120", peer)]);
    const dates = vi.spyOn(marketCalendar, "expectedTradingDates");
    try {
      const point = projectHomepageV25Boundaries(source, { ...batchQuery, endpoints: [{ key: "gap-peer", at: "2026-01-30T10:00:00Z" }] }).points[0];
      expect(point.instruments.map(i => [i.identity.instrumentId, i.marketValue.value, i.quoteCoverage.endpoint.state])).toEqual([["US:AAPL", null, "missing-completed-session"], ["US:PEER", "120", "session-in-progress-carry"]]);
      expect(point.instruments[0].quoteCoverage.endpoint.missingSessions).toEqual(["2026-01-29"]);
      expect(dates.mock.calls.length).toBeGreaterThan(0);
    } finally { dates.mockRestore(); }
  });
});


describe("P4 F fact seam O01/O02", () => {
  it("distinguishes incurred fees from partial and final allocated fees", () => {
    const executions = [fill("b1", "2026-01-05T15:00:00Z", { fee: "2" }), fill("b2", "2026-01-06T15:00:00Z", { price: "200", fee: "4" }), fill("s1", "2026-01-07T15:00:00Z", { side: "sell", price: "180", fee: "2" }), fill("s2", "2026-01-08T15:00:00Z", { side: "sell", price: "190", fee: "2" })];
    const source = preparedFixture(executions, []);
    expect(preparedPerformance.readHomepageV25FinancialFacts).toBeTypeOf("function");
    const partial = preparedPerformance.readHomepageV25FinancialFacts(source, { asOf: "2026-01-07T16:00:00Z" }).groups[0];
    const final = preparedPerformance.readHomepageV25FinancialFacts(source, { asOf: "2026-01-08T16:00:00Z" }).groups[0];
    expect(partial.allocations.map(f => [f.openingPoolBefore.value, f.openingPoolAfter.value, f.releasedOpeningFee.value, f.movementFeeToClosing.value, f.movementFeeToOpening.value, f.realizedFeeDelta.value])).toEqual([["0", "2", "0", "0", "2", "0"], ["2", "6", "0", "0", "4", "0"], ["6", "3", "3", "2", "0", "5"]]);
    expect([partial.openFees.value, partial.realizedFees.value, partial.nativeRealizedNet.value]).toEqual(["3", "5", "25"]);
    expect([final.openFees.value, final.realizedFees.value, final.nativeRealizedNet.value]).toEqual(["0", "10", "60"]);
    expect(final.incurredFeeFacts.map(f => [f.expense, f.incurred.businessDate])).toEqual([["2", "2026-01-05"], ["4", "2026-01-06"], ["2", "2026-01-07"], ["2", "2026-01-08"]]);
    expect(final.allocations.every(f => final.canonical.facts.some(m => m.factId === f.movementFactId))).toBe(true);
  });
  it("splits a legal reversal fee once and retains illegal close direction uncertainty", () => {
    const executions = [fill("b", "2026-01-05T15:00:00Z", { fee: "2" }), fill("reverse", "2026-01-06T15:00:00Z", { side: "sell", quantity: "2", price: "120", fee: "4", source: { platform: "statement", row: 2, positionEffect: "open-short" } }), fill("cover", "2026-01-07T15:00:00Z", { price: "110", fee: "1", source: { platform: "statement", row: 3, positionEffect: "close-short" } })];
    expect(preparedPerformance.readHomepageV25FinancialFacts).toBeTypeOf("function");
    const group = preparedPerformance.readHomepageV25FinancialFacts(preparedFixture(executions, []), { asOf: "2026-01-08" }).groups[0];
    expect(group.allocations.map(f => [f.releasedOpeningFee.value, f.movementFeeToClosing.value, f.movementFeeToOpening.value, f.realizedFeeDelta.value, f.openingPoolAfter.value])).toEqual([["0", "0", "2", "0", "2"], ["2", "2", "2", "4", "2"], ["2", "1", "0", "3", "0"]]);
    expect([group.nativeRealizedNet.value, group.realizedFees.value, group.canonical.selectedExecutionIds]).toEqual(["23", "7", ["b", "reverse", "cover"]]);
    const illegal = executions.map(e => e.id === "reverse" ? { ...e, source: { ...e.source, positionEffect: "close-long" as const } } : e);
    const unknown = preparedPerformance.readHomepageV25FinancialFacts(preparedFixture(illegal, []), { asOf: "2026-01-08" }).groups[0];
    expect(unknown.nativeRealizedNet).toMatchObject({ value: null, available: false, reasons: expect.arrayContaining(["position-coverage-missing"]) });
  });
});

const seamIpoEvents = (quantity = "2", date = "2026-01-10"): NonNullable<TradeExecution["source"]["positionEvents"]> => {
  const common = { accountId: "a", market: "US", symbol: "AAPL", currency: "USD", source: [{ page: 1, row: 2 }] };
  return [
    { ...common, id: "application", kind: "ipo", date: "2026-01-08", amount: "-220", description: "IPO application" },
    { ...common, id: "fee", kind: "fee", date: "2026-01-08", amount: "-2", description: "IPO fee" },
    { ...common, id: "allocation", kind: "ipo", date, quantity, displayTimePolicy: "session-open", description: "IPO allocation" },
    { ...common, id: "refund", kind: "ipo", date: "2026-01-20", amount: "20", description: "IPO refund" },
  ];
};
const seamRead = (source: ReturnType<typeof prepareHomepageV25Source>, asOf = "2026-01-22T10:00:00Z") => preparedPerformance.readHomepageV25FinancialFacts(source, { asOf }).groups[0];
describe("P4 F fact seam O03–O08", () => {
  it("O03 keeps late IPO knowledge distinct without changing closing or incurred dates", () => {
    const source = preparedFixture([fill("s1", "2026-01-15T15:00:00Z", { side: "sell", price: "120", fee: "1", source: { platform: "statement", row: 1, positionEvents: seamIpoEvents() } }), fill("s2", "2026-01-16T15:00:00Z", { side: "sell", price: "130", fee: "1" })], []);
    const early = seamRead(source, "2026-01-18"), late = seamRead(source);
    expect([early.canonical.terminal.quantity.value, early.nativeRealizedNet.value, early.realizedFees.value]).toEqual(["0", null, null]);
    expect([late.canonical.terminal.quantity.value, late.canonical.terminal.realizedPnl.value, late.realizedFees.value, late.nativeRealizedNet.value]).toEqual(["0", "50", "4", "46"]);
    expect(late.canonical.facts.filter(f => f.executionId).map(f => [f.time.sourceDate, f.after.quantity.value])).toEqual([["2026-01-15T15:00:00Z", "1"], ["2026-01-16T15:00:00Z", "0"]]);
    expect([early, late].map(g => g.incurredFeeFacts.reduce((sum, fact) => sum + Number(fact.expense), 0))).toEqual([4, 4]);
    expect(late.incurredFeeFacts.find(f => f.lineage.eventIds.includes("fee"))?.incurred.businessDate).toBe("2026-01-08");
    expect(late.allocations.find(f => f.allocationEventId === "allocation")?.feeFactIds).toEqual([expect.stringContaining("fee")]);
    expect(early.canonical.contextId).not.toBe(late.canonical.contextId);
    expect(seamRead(source, "2026-01-18")).toEqual(early);
    expect(seamRead(source)).toEqual(late);
    expect(Object.isFrozen(early.allocations)).toBe(true);
  });
  it.each([["1", "-1", "-80", "3", "-83"], ["2", "0", "40", "4", "36"], ["3", "1", "106.66666666666666667", "3.3333333333333333333", "103.33333333333333334"]])("O04 records non-execution IPO cover of %s without fabricating fills", (allocation, quantity, gross, fees, net) => {
    const source = preparedFixture([fill("short", "2026-01-06T15:00:00Z", { side: "sell", quantity: "2", price: "120", fee: "2", source: { platform: "statement", row: 1, positionEffect: "open-short", positionEvents: seamIpoEvents(allocation, "2026-01-12") } })], []);
    const group = seamRead(source), movement = group.canonical.facts.find(f => f.kind === "ipo-allocation")!;
    expect([group.canonical.terminal.quantity.value, group.canonical.terminal.realizedPnl.value, group.realizedFees.value, group.nativeRealizedNet.value]).toEqual([quantity, gross, fees, net]);
    expect([movement.executionId, movement.matchedClosedQuantity.value, movement.openedQuantity.value, movement.time.sourceDate]).toEqual([null, allocation === "1" ? "1" : "2", allocation === "3" ? "1" : "0", "2026-01-12"]);
    expect(group.canonical.selectedExecutionIds).toEqual(["short"]);
    expect(group.allocations.map(f => [f.executionId, f.allocationEventId])).toEqual([["short", null], [null, "allocation"]]);
  });
  it("O06 does not trust episode dates over canonical facts and records conflicts", () => {
    const executions = [fill("b", "2026-01-05T15:00:00Z"), fill("s", "2026-01-06T15:00:00Z", { side: "sell", price: "110" })];
    const entries = buildTradeLibraryEntries(buildInstrumentTradeSummaries(executions), {}, {});
    entries[0].episodes[0].episode.status = "open";
    entries[0].episodes[0].episode.endedAt = "2027-01-06T15:00:00Z";
    const group = seamRead(preparedFixture(executions, [], { entries }));
    expect([group.canonical.terminal.quantity.value, group.canonical.facts.at(-1)?.time.sourceDate]).toEqual(["0", "2026-01-06T15:00:00Z"]);
    expect(group.episodeCoverage).toMatchObject({ available: false, reasons: expect.arrayContaining(["episode-canonical-conflict"]) });
  });
  it("O06 preserves duplicate inventory and monetary uncertainty separately", () => {
    const executions = [fill("b", "2026-01-05T15:00:00Z"), fill("s", "2026-01-06T15:00:00Z", { side: "sell", price: "110" })];
    const entries = buildTradeLibraryEntries(buildInstrumentTradeSummaries(executions), {}, {});
    entries[0].executions.push({ ...executions[0] });
    const same = seamRead(preparedFixture(executions, [], { entries }));
    expect([same.canonical.selectedExecutionIds, same.nativeRealizedNet.value]).toEqual([["b", "s"], "10"]);
    entries[0].executions.at(-1)!.price = "101";
    const monetary = seamRead(preparedFixture(executions, [], { entries }));
    expect([monetary.quantityCoverage.available, monetary.nativeRealizedNet.value]).toEqual([true, null]);
    entries[0].executions.at(-1)!.quantity = "2";
    const inventory = seamRead(preparedFixture(executions, [], { entries }));
    expect(inventory.quantityCoverage).toMatchObject({ available: false, reasons: expect.arrayContaining(["duplicate-execution-conflict"]) });
  });
  it("O07 exposes sub-cent native results and keeps historical FX and mixed provenance unknown", () => {
    const values = ["100.004", "100", "99.996"].map(price => seamRead(preparedFixture([fill("b", "2026-01-05T15:00:00Z"), fill("s", "2026-01-06T15:00:00Z", { side: "sell", price })], [])).nativeRealizedNet.value);
    expect(values).toEqual(["0.004", "0", "-0.004"]);
    expect(values.filter(value => Number(value) > 0)).toHaveLength(1);
    const source = preparedFixture([fill("manual", "2026-01-13T15:00:00Z", { price: "200", source: { platform: "statement", row: 1, positionEvents: seamIpoEvents("1") } }), fill("sell", "2026-01-15T15:00:00Z", { side: "sell", price: "180" })], []);
    const group = preparedPerformance.readHomepageV25FinancialFacts(source, { asOf: "2026-01-22T10:00:00Z", targetCurrency: "CNY" }).groups[0];
    expect(group.nativeRealizedNet.available).toBe(true);
    expect(group.fxCoverage).toMatchObject({ state: "missing", reasons: ["fx-knowledge-unavailable"] });
    expect(group.classificationCoverage).toMatchObject({ available: false, reasons: ["provenance-ambiguous"] });
    expect(group.classificationCoverage.sourceClasses).toEqual(["ipo", "long"]);
  });
  it("O08 collects facts only on request and retains no memo, source or index growth", () => {
    const executions = Array.from({ length: 200 }, (_, index) => fill(`e${index}`, new Date(Date.UTC(2026, 0, 5, 0, index)).toISOString(), { side: index % 2 ? "sell" : "buy", price: index % 2 ? "101" : "100", fee: "0.00000000001" }));
    const source = preparedFixture(executions, []), before = preparedPerformance.inspectHomepageV25PreparedSource(source);
    const first = seamRead(source), second = seamRead(source), after = preparedPerformance.inspectHomepageV25PreparedSource(source);
    expect(second).toEqual(first);
    expect(first.diagnostics).toEqual({ evaluations: 1, transitions: 200, indexProbes: 200, retainedFactBytes: 0, feeSteps: 200, mode: "ordinary-sweep" });
    expect([first.canonical.terminal.realizedPnl.value, first.realizedFees.value, first.nativeRealizedNet.value]).toEqual(["100", "0.000000002", "99.999999998"]);
    expect(after).toEqual(before);
  });
});

describe("P4 F fact seam coverage counterexamples", () => {
  it("retains event-only inventory and uncovered source as different facts", () => {
    const executions = [fill("seed", "2026-01-05T15:00:00Z", { quantity: "2" })];
    const entries = buildTradeLibraryEntries(buildInstrumentTradeSummaries(executions), {}, {});
    const episode = entries[0].episodes[0].episode;
    entries[0].executions = [];
    episode.executions = [];
    episode.initialPosition = { accountId: "a", symbol: "AAPL", market: "US", phase: "opening", date: "2026-01-01", quantity: "2", source: [] };
    episode.positionEvents = [{ accountId: "a", symbol: "AAPL", market: "US", currency: "USD", id: "out", kind: "transfer-out", date: "2026-01-08", quantity: "2", description: "stock out", source: [] }];
    const group = seamRead(preparedFixture(executions, [], { entries }));
    expect(group.canonical.selectedExecutionIds).toEqual([]);
    expect(group.canonical.facts.map(f => [f.kind, f.after.quantity.value])).toEqual([["position-reconciliation", "2"], ["evidence-status", null], ["transfer", "0"]]);
    expect(group.canonical.terminal.realizedPnl.value).toBeNull();
    expect(group.nativeRealizedNet).toMatchObject({ value: null, available: false, reasons: expect.arrayContaining(["execution-lineage-unavailable"]) });
    expect(group.sourceCoverage.state).toBe("unknown");
    expect(group.rawExecutions).toEqual([]);
  });
  it("retains future-carrier early evidence but blocks future knowledge and keeps account/run identity", () => {
    const future = fill("future", "2026-02-10T15:00:00Z", { side: "sell", source: { platform: "statement", row: 1, positionEvents: seamIpoEvents() } });
    const early = seamRead(preparedFixture([future], []), "2026-01-18");
    expect([early.canonical.selectedExecutionIds, early.canonical.terminal.quantity.value, early.nativeRealizedNet.value]).toEqual([[], "2", null]);
    expect(early.canonical.facts.map(f => f.eventId)).toEqual(["application", "fee", "allocation"]);
    const a = fill("a", "2026-01-05T15:00:00Z"), b = fill("b", "2026-01-05T15:00:00Z", { accountId: "b" });
    const sim = fill("sim", "2026-01-05T15:00:00Z", { source: { platform: "test", row: 1, tradeNature: "simulation", simulationRunId: "run1" } });
    const sim2 = { ...sim, id: "sim2", source: { ...sim.source, simulationRunId: "run2" } };
    const live = preparedPerformance.readHomepageV25FinancialFacts(preparedFixture([a, b, sim, sim2], []), { asOf: "2026-01-22" });
    expect(live.groups.map(g => [g.identity.accountId, g.identity.market, g.identity.currency, g.identity.nature, g.identity.simulationRunId])).toEqual([["a", "US", "USD", "live", null], ["b", "US", "USD", "live", null]]);
    const selected = preparedPerformance.readHomepageV25FinancialFacts(preparedFixture([a, b, sim, sim2], [], { scope: { nature: "simulation", simulationRunId: "run1" } }), { asOf: "2026-01-22" });
    expect(selected.groups.map(g => [g.identity.nature, g.identity.simulationRunId, g.canonical.selectedExecutionIds])).toEqual([["simulation", "run1", ["sim"]]]);
  });
  it("joins a fee allocation to the exact preceding evidence source and selected fill context", () => {
    const source = preparedFixture([fill("s1", "2026-01-15T15:00:00Z", { side: "sell", price: "120", fee: "1", source: { platform: "statement", row: 1, positionEvents: seamIpoEvents() } }), fill("s2", "2026-01-16T15:00:00Z", { side: "sell", price: "130", fee: "1" })], []);
    const group = seamRead(source), contexts = group.allocations.map(f => f.beforeContext);
    expect(contexts.map(c => [c.cursor, c.selectedExecutionIds, c.movementPrefix])).toEqual([["2026-01-22T10:00:00.000Z", [], []], ["2026-01-22T10:00:00.000Z", [], [["allocation", "allocation"]]], ["2026-01-22T10:00:00.000Z", ["s1"], [["allocation", "allocation"], ["execution", "s1"]]]]);
    expect(new Set(contexts.map(c => c.sourceId)).size).toBe(2);
    expect(contexts.every(c => c.evidencePolicy === "cash-knowledge-with-preceding-movements")).toBe(true);
    expect(group.allocations.map(f => f.evidenceIds)).toEqual(expect.arrayContaining([expect.arrayContaining(["allocation", "application", "refund", "fee"])]));
  });
});

describe("P4 F fact seam fee/source evidence", () => {
  it("preserves incurred event-only fees without creating fills or known allocated results", () => {
    const executions = [fill("seed", "2026-01-05T15:00:00Z")];
    const entries = buildTradeLibraryEntries(buildInstrumentTradeSummaries(executions), {}, {});
    entries[0].executions = [];
    const episode = entries[0].episodes[0].episode;
    episode.executions = [];
    episode.initialPosition = { accountId: "a", symbol: "AAPL", market: "US", phase: "opening", date: "2026-01-01", quantity: "1", source: [] };
    episode.positionEvents = [{ accountId: "a", symbol: "AAPL", market: "US", currency: "USD", id: "statement-fee", kind: "fee", date: "2026-01-08", amount: "-2", description: "custody fee", source: [{ page: 1, row: 4 }] }];
    const group = seamRead(preparedFixture(executions, [], { entries }));
    expect(group.incurredFeeFacts).toEqual([expect.objectContaining({ kind: "statement-fee", expense: "2", incurred: { businessDate: "2026-01-08", at: null, precision: "day" }, lineage: { executionIds: [], eventIds: ["statement-fee"], sourceRows: ["statement:1:4"] } })]);
    expect([group.rawExecutions, group.allocations, group.nativeRealizedNet.value]).toEqual([[], [], null]);
  });
  it("uses the existing suppression authority for IPO acquisition class without inventing disposal links", () => {
    const common = { accountId: "a", symbol: "AAPL", market: "US", currency: "USD", source: [] };
    const buy = fill("ipo-buy", "2026-01-10T15:00:00Z", { quantity: "2", price: "100", fee: "2", source: { platform: "statement", row: 1, positionEvents: [{ ...common, id: "allocation", kind: "ipo", date: "2026-01-10", quantity: "2", amount: "-200", description: "IPO allocation", displayTimePolicy: "session-open" }] } });
    const sale = fill("sale", "2026-01-16T15:00:00Z", { side: "sell", quantity: "2", price: "130", fee: "2" });
    const group = seamRead(preparedFixture([buy, sale], []));
    expect(group.classificationCoverage).toEqual({ available: true, reasons: [], sourceClasses: ["ipo"] });
    expect([group.canonical.terminal.realizedPnl.value, group.realizedFees.value, group.nativeRealizedNet.value]).toEqual(["60", "4", "56"]);
    expect(group.canonical.facts.filter(f => f.executionId)).toHaveLength(2);
  });
});

describe("P4 F fact seam precision boundary", () => {
  it("preserves native profit sign below the old eight-decimal display precision", () => {
    const results = ["100.000000000001", "100", "99.999999999999"].map(price => seamRead(preparedFixture([fill("b", "2026-01-05T15:00:00Z"), fill("s", "2026-01-06T15:00:00Z", { side: "sell", price })], [])).nativeRealizedNet.value);
    expect(results).toEqual(["0.000000000001", "0", "-0.000000000001"]);
  });
});

describe("P4 F fact seam fee unknown gates", () => {
  it("keeps conflicting raw fees and unknown-fee movements unavailable independently of quantity", () => {
    const buys = [fill("b", "2026-01-05T15:00:00Z", { fee: "2" }), fill("s", "2026-01-06T15:00:00Z", { side: "sell", price: "110", fee: "2" })];
    const entries = buildTradeLibraryEntries(buildInstrumentTradeSummaries(buys), {}, {});
    entries[0].executions.push({ ...buys[0], fee: "5" });
    const conflict = seamRead(preparedFixture(buys, [], { entries }));
    expect([conflict.quantityCoverage.available, conflict.realizedFees.value, conflict.openFees.value]).toEqual([true, null, null]);
    expect(conflict.realizedFees.reasons).toContain("duplicate-execution-conflict");
    const unknown = seamRead(preparedFixture([{ ...buys[0], source: { ...buys[0].source, feeStatus: "unknown" } }, buys[1]], []));
    expect(unknown.allocations.map(f => [f.movementFeeTotal.value, f.realizedFeeDelta.value])).toEqual([[null, null], [null, null]]);
    expect(unknown.allocations[0].movementFeeTotal.reasons).toContain("unknown-fees");
    expect(unknown.incurredFeeFacts[0].expense).toBeNull();
  });
});
