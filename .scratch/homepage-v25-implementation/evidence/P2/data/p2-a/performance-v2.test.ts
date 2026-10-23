import { expect, it, vi } from "vitest";
import { writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { prepareHomepageV25Source, projectHomepageV25Boundaries } from "../../../../../../app/lib/reviews/homepage-v25-performance";
import * as canonical from "../../../../../../app/lib/replay/position-ledger";
import { expectedTradingDates } from "../../../../../../app/lib/market/calendar";
import { buildInstrumentTradeSummaries } from "../../../../../../app/lib/trades/instruments";
import { buildTradeLibraryEntries } from "../../../../../../app/lib/trades/library";
import type { TradeExecution } from "../../../../../../app/lib/trades/types";

const path = ".scratch/homepage-v25-implementation/evidence/P2/data/p2-a/08-performance-v2.json";
it("measures ordered explicit-live 1866 fills and 365 batch endpoints", () => {
  const started = performance.now();
  const report: Record<string, unknown> = { runtime: process.version, fixture: { fills: 1866, groups: 1, endpoints: 365, nature: "controlled explicit live; no database read or rewritten" }, stage: "fixture", stageStartedAt: Date.now() };
  const stage = (name: string, extra: Record<string, unknown> = {}) => { Object.assign(report, extra, { stage: name, stageStartedAt: Date.now(), elapsedMs: performance.now() - started }); writeFileSync(path, JSON.stringify(report, null, 2)); };
  const instrument = { id: "US:AAPL", market: "US", symbol: "AAPL", name: "Apple", currency: "USD" };
  const day = (i: number) => new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10);
  const executions: TradeExecution[] = Array.from({ length: 1866 }, (_, i) => ({ id: `controlled-fill-${i}`, accountId: "a", accountLabel: "A", instrument, side: i % 2 ? "sell" : "buy", quantity: "1", price: i % 2 ? "101" : "100", fee: "0", executedAt: new Date(Date.parse(`${day(Math.floor(i * 365 / 1866))}T14:00:00Z`) + i).toISOString(), source: { platform: "controlled-scaling", row: i, tradeNature: "live", positionEffect: i % 2 ? "close-long" : "open-long" } }));
  expect(executions.every((e, i) => !i || e.executedAt > executions[i - 1].executedAt)).toBe(true);
  const dates = expectedTradingDates("US", "2025-12-31", "2026-12-31");
  const quotes = { "US:AAPL": dates.map(tradingDate => ({ instrumentId: instrument.id, tradingDate, open: "110", high: "110", low: "110", close: "110", volume: "1", currency: "USD", adjustmentMode: "raw" as const, provider: "controlled", providerSymbol: "AAPL", fetchedAt: `${tradingDate}T23:00:00Z` })) };
  stage("upstream");
  const upstreamStart = performance.now();
  const entries = buildTradeLibraryEntries(buildInstrumentTradeSummaries(executions), quotes, { "US:AAPL": "ready" });
  const upstreamMs = performance.now() - upstreamStart;
  const input = { entries, candlesByInstrument: quotes, fxObservations: [], currentFxSnapshot: null, lifetimeSourceCoverage: [], revisions: { trades: "controlled1866-ordered", metadata: "none", quotes: "all-sessions", fx: "none" } };
  const query = { periodStart: "2026-01-01", asOf: "2027-01-01T23:00:00Z", endpoints: Array.from({ length: 365 }, (_, i) => ({ key: day(i), at: day(i) })) };
  stage("prepare", { upstreamMs, entries: entries.length, rawFillsInEntries: entries.reduce((sum, entry) => sum + entry.executions.length, 0), quotes: dates.length });
  const prepareStart = performance.now(), source = prepareHomepageV25Source(input), prepareMs = performance.now() - prepareStart;
  let calls = 0, prefixMembers = 0;
  const original = canonical.replayPositionAtPrice;
  const batchStart = performance.now();
  const spy = vi.spyOn(canonical, "replayPositionAtPrice").mockImplementation(input => {
    calls++; prefixMembers += input.visibleExecutionIds?.length ?? 0;
    if (calls % 100 === 0) Object.assign(report, { canonicalCalls: calls, selectedPrefixMembers: prefixMembers, batchElapsedMs: performance.now() - batchStart }), writeFileSync(path, JSON.stringify(report, null, 2));
    return original(input);
  });
  stage("batch", { prepareMs, heapBeforeBatch: process.memoryUsage().heapUsed });
  try {
    const batch = projectHomepageV25Boundaries(source, query), batchMs = performance.now() - batchStart, coldMs = prepareMs + batchMs, canonicalCalls = calls;
    stage("repeat", { batchMs, coldMs, canonicalCalls, selectedPrefixMembers: prefixMembers, diagnostics: batch.diagnostics, heapAfterBatch: process.memoryUsage().heapUsed, lastNet: batch.points.at(-1)?.net.value, currentMV: batch.current.currentMarketValue.value });
    const repeatStart = performance.now(), repeated = projectHomepageV25Boundaries(source, query), repeatMs = performance.now() - repeatStart;
    stage("complete", { repeatMs, repeatAdditionalCanonicalCalls: calls - canonicalCalls });
    expect(repeated).toBe(batch); expect(batch.points.at(-1)?.net.value).toBe("933"); expect(batch.current.currentMarketValue.value).toBe("0");
  } finally { spy.mockRestore(); }
}, 180000);
