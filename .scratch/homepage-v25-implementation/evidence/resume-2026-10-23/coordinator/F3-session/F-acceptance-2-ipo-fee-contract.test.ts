import { writeFileSync } from "node:fs";
import { afterAll, expect, it } from "vitest";
import { buildHomepageV25PerformanceFromEntries } from "../../../../../../app/lib/reviews/homepage-v25-performance";
import { buildInstrumentTradeSummaries } from "../../../../../../app/lib/trades/instruments";
import { buildTradeLibraryEntries } from "../../../../../../app/lib/trades/library";
import { replayPositionAtPrice } from "../../../../../../app/lib/replay/position-ledger";
import type { StatementEvent } from "../../../../../../app/lib/import/monthly-statement";
import type { TradeExecution } from "../../../../../../app/lib/trades/types";
import type { DailyCandleRecord } from "../../../../../../app/lib/market/contracts";

const instrument = { id: "US:AAPL", symbol: "AAPL", name: "Apple", market: "US", currency: "USD" };
const common = { accountId: "a", market: "US", symbol: "AAPL", currency: "USD", source: [{ page: 1, row: 1 }] };
const fill = (id: string, date: string, side: "buy" | "sell", quantity = "1", price = "120", fee = "0", short = false): TradeExecution => ({ id, executedAt: `${date}T05:00:00Z`, instrument, accountId: "a", accountLabel: "A", side, quantity, price, fee, source: { platform: "statement", row: 1, tradeNature: "live", ...(short ? { positionEffect: "open-short" as const } : {}) } });
const candle = (tradingDate: string, close: string): DailyCandleRecord => ({ instrumentId: instrument.id, tradingDate, open: close, high: close, low: close, close, currency: "USD", volume: "1", provider: "eastmoney", providerSymbol: "AAPL", adjustmentMode: "raw", fetchedAt: `${tradingDate}T23:00:00Z` });
const events = (quantity: string): StatementEvent[] => [
  { ...common, id: "application", kind: "ipo", date: "2026-01-08", amount: `-${Number(quantity) * 100 + 20}`, description: "IPO application" },
  { ...common, id: "refund", kind: "ipo", date: "2026-01-10", amount: "20", description: "IPO refund" },
  { ...common, id: "ipo-fee", kind: "fee", date: "2026-01-08", amount: "-2", description: "IPO fee" },
  { ...common, id: "allocation", kind: "ipo", date: "2026-01-10", quantity, displayTimePolicy: "session-open", description: "IPO allotment" },
];
const cases = [
  { name: "opens IPO inventory", quantity: "2", fills: [], realized: "0", uf: "18", net: "18", mv: "220", pool: "2", canonical: ["2", "0", "20", "2", "18"] },
  { name: "covers an entire short", quantity: "1", fills: [fill("short", "2026-01-05", "sell", "1", "120", "0", true)], realized: "18", uf: "0", net: "18", mv: "0", pool: "0", canonical: ["0", "20", "0", "2", "18"] },
  { name: "covers part of a short and releases its entry fee", quantity: "1", fills: [fill("short", "2026-01-05", "sell", "2", "120", "4", true)], realized: "16", uf: "8", net: "24", mv: "-110", pool: "2", canonical: ["-1", "20", "10", "6", "24"] },
  { name: "reverses a short into IPO long inventory", quantity: "2", fills: [fill("short", "2026-01-05", "sell", "1", "120", "2", true)], realized: "17", uf: "9", net: "26", mv: "110", pool: "1", canonical: ["1", "20", "10", "4", "26"] },
  { name: "sells part of IPO inventory", quantity: "2", fills: [fill("sale", "2026-01-15", "sell", "1", "120", "1")], realized: "18", uf: "9", net: "27", mv: "110", pool: "1", canonical: ["1", "20", "10", "3", "27"] },
  { name: "sells all IPO inventory", quantity: "2", fills: [fill("sale", "2026-01-15", "sell", "2", "120", "1")], realized: "37", uf: "0", net: "37", mv: "0", pool: "0", canonical: ["0", "40", "0", "3", "37"] },
];
const traces: unknown[] = [];
afterAll(() => writeFileSync(`.scratch/homepage-v25-implementation/evidence/resume-2026-10-23/coordinator/F3-session/traces/ipo-traces-${process.env.F_TRACE_PHASE ?? "green"}.json`, JSON.stringify(traces, null, 2) + "\n"));
it.each([...cases.map(row => ({ ...row, refund: "2026-01-10", start: "2026-01-01", opening: "0" })),
  ...cases.slice(4).map(row => ({ ...row, name: `${row.name} before the refund becomes known`, refund: "2026-01-20", start: "2026-01-01", opening: "0" })),
  { ...cases[2], name: "covers a cross-period short", refund: "2026-01-10", start: "2026-01-09", opening: "16", net: "8" },
])("projects attributable canonical fees when it $name", (row) => {
  const executions = [...row.fills, fill("future-carrier", "2026-02-05", "buy", "1", "100")].map((execution, index) => index === 0 ? { ...execution, source: { ...execution.source, positionEvents: events(row.quantity).map(event => event.id === "refund" ? { ...event, date: row.refund } : event) } } : execution);
  const candlesByInstrument = { [instrument.id]: [candle("2025-12-31", "100"), candle("2026-01-07", "110"), candle("2026-01-30", "110")] };
  const summaries = buildInstrumentTradeSummaries(executions);
  const entries = buildTradeLibraryEntries(summaries, candlesByInstrument, { [instrument.id]: "ready" });
  const input = { entries, candlesByInstrument, period: { start: row.start, end: "2026-01-31" }, asOf: "2026-01-31" };
  const output = buildHomepageV25PerformanceFromEntries(input);
  const canonical = replayPositionAtPrice({ executions, markPrice: "110", cursor: "2026-01-31T15:59:59.999Z", visibleExecutionIds: executions.filter(e => e.id !== "future-carrier").map(e => e.id) });
  traces.push({ name: row.name, executions, summaries, input, canonical, output });
  expect([canonical.quantity, canonical.realizedPnl, canonical.unrealizedPnl, canonical.fees, canonical.netPnl]).toEqual(row.canonical);
  expect([output.periodRealized.value, output.openingUnrealized.value, output.closingUnrealized.value, output.net.value, output.currentMarketValue.value, output.instruments[0].evidence.current.openFees]).toEqual([row.realized, row.opening, row.uf, row.net, row.mv, row.pool]);
});
it("does not charge execution-backed IPO evidence again when its real buy covers a short", () => {
  const evidence = events("1").map(event => event.id === "allocation" ? { ...event, amount: "100" } : event);
  const executions = [fill("short", "2026-01-05", "sell", "1", "120", "2", true), fill("broker-ipo-buy", "2026-01-10", "buy", "1", "100", "3")].map((e, index) => index === 0 ? { ...e, source: { ...e.source, positionEvents: evidence } } : e);
  const entries = buildTradeLibraryEntries(buildInstrumentTradeSummaries(executions), {}, {});
  const output = buildHomepageV25PerformanceFromEntries({ entries, period: { start: "2026-01-01", end: "2026-01-31" }, asOf: "2026-01-31" });
  const canonical = replayPositionAtPrice({ executions, markPrice: "0", cursor: "2026-01-31T15:59:59.999Z" });
  traces.push({ name: "execution-backed short cover", executions, entries, canonical, output });
  expect([canonical.quantity, canonical.realizedPnl, canonical.fees, canonical.netPnl]).toEqual(["0", "20", "5", "15"]);
  expect([output.periodRealized.value, output.net.value, output.instruments[0].evidence.current.openFees]).toEqual(["15", "15", "0"]);
});
