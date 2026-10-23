import { describe, expect, it } from "vitest";
import { buildInstrumentTradeSummaries } from "../../lib/trades/instruments";
import { buildTradeLibraryEntries } from "../../lib/trades/library";
import type { TradeExecution } from "../../lib/trades/types";
import type { TradingRoomQuote } from "../../lib/reviews/trading-room-holdings";
import { buildHomepageHoldings, filterHomepageHoldings, holdingsCsv } from "./holdings-model";

function execution(id: string, accountId: string, nature?: "live" | "simulation"): TradeExecution {
  return { id, accountId, accountLabel: accountId, source: { platform: "futu", row: 1, ...(nature ? { tradeNature: nature } : {}) },
    instrument: { id: "CN-SH:600519", symbol: "600519", name: "贵州茅台", market: "CN-SH", currency: "CNY" },
    side: "buy", executedAt: "2026-10-21T16:30:00.000Z", quantity: "2.125", price: "100", fee: "0" };
}
function entries(executions: TradeExecution[]) { return buildTradeLibraryEntries(buildInstrumentTradeSummaries(executions), {}, {}); }
const scope = { live: true as const, market: "all" as const, accounts: ["*"], rangeMode: "all" as const };
const quotes = { "CN-SH:600519": { price: "110", currency: "CNY", quoteDate: "2026-10-23", fetchedAt: "2026-10-23T08:00:00Z", provider: "tencent", freshness: "current" as const } };
function candlesFromQuotes(source: Record<string, TradingRoomQuote>) {
  return Object.fromEntries(Object.entries(source).map(([instrumentId, quote]) => [instrumentId, [{ instrumentId, tradingDate: quote.quoteDate!, open: quote.price!, high: quote.price!, low: quote.price!, close: quote.price!, volume: "0", currency: quote.currency!, provider: "tencent" as const, providerSymbol: instrumentId, adjustmentMode: "raw" as const, fetchedAt: quote.fetchedAt! }]]));
}

describe("homepage holdings projection", () => {
  it.each([
    { code: "US", source: "sec", resolvedAt: "2026-10-22T00:00:00Z" },
    { code: "NASDAQ", source: "tencent", resolvedAt: "2026-10-22T00:00:00Z" },
    { code: "NASDAQ", source: "sec", resolvedAt: "invalid-date" },
  ])("fails closed on historical bootstrap exchange metadata %j without changing the stored trade", exchange => {
    const bootstrap = JSON.parse(JSON.stringify({ instruments: [{ id: "US:AAPL", metadata: { exchange } }] }));
    const us = { ...execution("us", "one", "live"), instrument: { id: "US:AAPL", symbol: "AAPL", name: "Apple", market: "US", currency: "USD" } };
    const row = buildHomepageHoldings(entries([us]), { scope, asOf: "2026-10-23", exchangeByInstrument: { "US:AAPL": bootstrap.instruments[0].metadata.exchange } }).rows[0];
    expect(row.identity).toBeNull();
    expect(row.identityReason).toContain("尚未解析");
    expect(us.instrument.id).toBe("US:AAPL");
    expect(bootstrap.instruments[0].metadata.exchange).toEqual(exchange);
  });
  it("requires explicit US exchange evidence and labels historical quote age instead of claiming current", () => {
    const us = { ...execution("us", "one", "live"), instrument: { id: "US:AAPL", symbol: "AAPL", name: "Apple", market: "US", currency: "USD" } };
    const raw = { "US:AAPL": { ...quotes["CN-SH:600519"], currency: "USD", quoteDate: "2026-10-15" } };
    const input = { scope: { ...scope, market: "us" as const }, asOf: "2026-10-23", candlesByInstrument: candlesFromQuotes(raw) };
    expect(buildHomepageHoldings(entries([us]), input).rows[0].identity).toBeNull();
    const row = buildHomepageHoldings(entries([us]), { ...input, exchangeByInstrument: { "US:AAPL": { code: "NASDAQ", source: "sec", resolvedAt: "2026-10-22T00:00:00Z" } } }).rows[0];
    expect(row.identity).toBe("NASDAQ:AAPL");
    expect(row.quote?.freshness).toBe("stale");
    expect(row.statusReason).toContain("陈旧");
  });
  it("uses the accepted current net UF after open fees, with partial closes keeping only remaining fees", () => {
    const buy = { ...execution("buy", "one", "live"), quantity: "2", fee: "2" };
    const opened = buildHomepageHoldings(entries([buy]), { scope, asOf: "2026-10-23", quotesByInstrument: quotes, candlesByInstrument: candlesFromQuotes(quotes) });
    expect(opened.rows[0].reportPnl).toBe("18");
    const sell = { ...buy, id: "sell", side: "sell" as const, quantity: "1", price: "120", fee: "1", executedAt: "2026-10-23T01:00:00Z" };
    const partial = buildHomepageHoldings(entries([buy, sell]), { scope, asOf: "2026-10-23", quotesByInstrument: quotes, candlesByInstrument: candlesFromQuotes(quotes) });
    expect(partial.rows[0].reportPnl).toBe("9");
    expect(partial.totalUnrealizedPnl).toBe("9");
  });
  it("keeps partial or future FX unknown and accepts production colon rates from complete timely evidence", () => {
    const us = { ...execution("us", "one", "live"), instrument: { id: "US:TEST", symbol: "TEST", name: "Test", market: "US", currency: "USD" } };
    const marketQuotes = { "US:TEST": { ...quotes["CN-SH:600519"], currency: "USD", quoteDate: "2026-10-22" } };
    const input = { scope, asOf: "2026-10-23", quotesByInstrument: marketQuotes, candlesByInstrument: candlesFromQuotes(marketQuotes) };
    const fx = { id: "fx", baseCurrency: "CNY" as const, asOf: "2026-10-23", source: "BOC", status: "complete" as const, rates: { "USD:CNY": "7" } };
    expect(buildHomepageHoldings(entries([us]), { ...input, fxSnapshot: { ...fx, status: "partial", rates: { "USD/CNY": "7" } } }).totalMarketValue).toBeNull();
    expect(buildHomepageHoldings(entries([us]), { ...input, fxSnapshot: { ...fx, asOf: "2026-10-24", rates: { "USD/CNY": "7" } } }).totalMarketValue).toBeNull();
    expect(buildHomepageHoldings(entries([us]), { ...input, fxSnapshot: fx }).totalMarketValue).toBe("1636.25");
  });
  it("builds current episodes before same-day and next-day future fills can change quantity or close status", () => {
    const buy = { ...execution("past", "one", "live"), quantity: "2", executedAt: "2026-10-22T01:00:00Z" };
    const laterBuy = { ...buy, id: "later", quantity: "3", executedAt: "2026-10-23T06:00:00Z" };
    const futureClose = { ...buy, id: "tomorrow-close", side: "sell" as const, quantity: "5", executedAt: "2026-10-24T01:00:00Z" };
    const model = buildHomepageHoldings(entries([buy, laterBuy, futureClose]), { scope, asOf: "2026-10-23T02:00:00Z", quotesByInstrument: quotes, candlesByInstrument: candlesFromQuotes(quotes) });
    expect(model.rows).toHaveLength(1);
    expect(model.rows[0].quantity).toBe("2");
    expect(model.rows[0].row.item.episode.executions.map(fill => fill.id)).toEqual(["past"]);
  });
  it("keeps account plus episode identity and excludes a legacy broker row without explicit live nature", () => {
    const model = buildHomepageHoldings(entries([execution("a", "one", "live"), execution("b", "two", "live"), execution("u", "legacy")]), { scope, asOf: "2026-10-23", quotesByInstrument: quotes, candlesByInstrument: candlesFromQuotes(quotes) });
    expect(model.rows.map(row => row.accountId).sort()).toEqual(["one", "two"]);
    expect(new Set(model.rows.map(row => row.id)).size).toBe(2);
    expect(model.uniqueInstrumentCount).toBe(1);
    expect(model.rows[0]).toMatchObject({ identity: "SSE:600519", days: 1, quantity: "2.125", marketValue: "233.75", unrealizedPnl: "21.25" });
    expect(model.totalMarketValue).toBe("467.5");
  });

  it("does not derive continuous holding age from the latest fill or incomplete statement history", () => {
    const first = execution("a", "one", "live");
    const latest = { ...first, id: "b", executedAt: "2026-10-23T01:00:00Z" };
    const model = buildHomepageHoldings(entries([first, latest]), { scope, asOf: "2026-10-23", quotesByInstrument: quotes, candlesByInstrument: candlesFromQuotes(quotes) });
    expect(model.rows[0].days).toBe(1);
    const incomplete = buildHomepageHoldings(entries([{ ...first, source: { ...first.source, historyIncomplete: ["statement-gap"] } }]), { scope, asOf: "2026-10-23", quotesByInstrument: quotes, candlesByInstrument: candlesFromQuotes(quotes) });
    expect(incomplete.rows[0].days).toBeNull();
    expect(incomplete.rows[0].daysReason).toContain("起点");
  });

  it("keeps unknown quote values unknown and refuses financial sorting with incomplete coverage", () => {
    const model = buildHomepageHoldings(entries([execution("a", "one", "live")]), { scope, asOf: "2026-10-23" });
    expect(model.rows[0].marketValue).toBeNull();
    expect(model.totalMarketValue).toBeNull();
    expect(model.canSortMoney).toBe(false);
  });

  it("reconciles signed short and reversal exposure with canonical quantity times raw quote", () => {
    const sell = { ...execution("short", "short", "live"), side: "sell" as const, quantity: "1", source: { ...execution("short", "short", "live").source, positionEffect: "open-short" as const } };
    const buy = { ...execution("open", "reversal", "live"), quantity: "1" };
    const reverse = { ...execution("reverse", "reversal", "live"), side: "sell" as const, quantity: "2", source: { ...execution("reverse", "reversal", "live").source, positionEffect: "open-short" as const }, executedAt: "2026-10-23T01:00:00Z" };
    const model = buildHomepageHoldings(entries([sell, buy, reverse]), { scope, asOf: "2026-10-23", quotesByInstrument: quotes, candlesByInstrument: candlesFromQuotes(quotes) });
    expect(model.rows.map(row => row.quantity)).toEqual(["-1", "-1"]);
    expect(model.rows.map(row => row.marketValue)).toEqual(["-110", "-110"]);
    expect(model.totalMarketValue).toBe("-220");
  });

  it("reports US in USD without needing FX for USD, converting other settlement currencies only with evidence", () => {
    const us = { ...execution("us", "one", "live"), instrument: { id: "US:TEST", symbol: "TEST", name: "Test", market: "US", currency: "USD" } };
    const usQuote = { "US:TEST": { ...quotes["CN-SH:600519"], currency: "USD", quoteDate: "2026-10-22" } };
    const usd = buildHomepageHoldings(entries([us]), { scope: { ...scope, market: "us" }, asOf: "2026-10-23", quotesByInstrument: usQuote, candlesByInstrument: candlesFromQuotes(usQuote) });
    expect(usd.reportCurrency).toBe("USD");
    expect(usd.rows[0].marketValue).toBe("233.75");
    const foreign = { ...us, id: "foreign", accountId: "two", instrument: { ...us.instrument, id: "US:FOREIGN", symbol: "FOREIGN", currency: "HKD" } };
    const bothQuotes = { ...usQuote, "US:FOREIGN": { ...quotes["CN-SH:600519"], currency: "HKD", quoteDate: "2026-10-22" } };
    const missing = buildHomepageHoldings(entries([us, foreign]), { scope: { ...scope, market: "us" }, asOf: "2026-10-23", quotesByInstrument: bothQuotes, candlesByInstrument: candlesFromQuotes(bothQuotes) });
    expect(missing.totalMarketValue).toBeNull();
    expect(missing.canSortMoney).toBe(false);
    expect(missing.rows.find(row => row.accountId === "two")?.conversionReason).toContain("汇率");
    const converted = buildHomepageHoldings(entries([us, foreign]), { scope: { ...scope, market: "us" }, asOf: "2026-10-23", quotesByInstrument: bothQuotes, candlesByInstrument: candlesFromQuotes(bothQuotes),
      fxSnapshot: { id: "fx", baseCurrency: "CNY", asOf: "2026-10-23", source: "test evidence", status: "complete", rates: { "USD/CNY": "7", "HKD/CNY": "0.875" } } });
    expect(converted.rows.find(row => row.accountId === "two")?.marketValue).toBe("29.21875");
    expect(converted.totalMarketValue).toBe("262.96875");
  });

  it("exports the whole filtered result at original precision and neutralizes spreadsheet formulas", () => {
    const records = [execution("a", "=account", "live"), execution("b", "two", "live")];
    const model = buildHomepageHoldings(entries(records), { scope, asOf: "2026-10-23", quotesByInstrument: quotes, candlesByInstrument: candlesFromQuotes(quotes) });
    expect(filterHomepageHoldings(model.rows, "茅台", "name-desc")).toHaveLength(2);
    const csv = holdingsCsv(model.rows);
    expect(csv).toContain("'=account");
    expect(csv).toContain("2.125");
    expect(csv.split("\r\n")).toHaveLength(3);
  });
});
