import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { readFileSync, statSync, writeFileSync } from "node:fs";
import { expect, it, vi } from "vitest";
import { SqliteStore } from "../../../../../app/lib/storage/sqlite-store";
import { buildInstrumentTradeSummaries } from "../../../../../app/lib/trades/instruments";
import { buildTradeLibraryEntries } from "../../../../../app/lib/trades/library";
import { buildHomepageV25PerformanceFromEntries } from "../../../../../app/lib/reviews/homepage-v25-performance";
import { tradeNatureOf } from "../../../../../app/lib/trades/types";
import type { DailyCandleRecord } from "../../../../../app/lib/market/contracts";

const count = vi.hoisted(() => ({ calls: 0, selectedPrefixMembers: 0 }));
vi.mock("../../../../../app/lib/replay/position-ledger", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../../../../app/lib/replay/position-ledger")>();
  return { ...original, replayPositionAtPrice(input: Parameters<typeof original.replayPositionAtPrice>[0]) {
    count.calls += 1;
    count.selectedPrefixMembers += input.visibleExecutionIds?.length ?? 0;
    return original.replayPositionAtPrice(input);
  } };
});

it("measures one projection from the isolated backup using read-only SQLite", () => {
  const path = ".data/tradereview-test.sqlite";
  const database = new DatabaseSync(path, { readOnly: true });
  try {
    const store = new SqliteStore(database);
    const readStart = performance.now();
    const bootstrap = store.getBootstrap();
    const candles = store.getDailyCandles();
    const readMs = performance.now() - readStart;
    const candlesByInstrument: Record<string, DailyCandleRecord[]> = {};
    for (const candle of candles) (candlesByInstrument[candle.instrumentId] ??= []).push(candle);
    const natureCounts: Record<string, number> = {};
    for (const execution of bootstrap.executions) {
      const nature = tradeNatureOf(execution);
      natureCounts[nature] = (natureCounts[nature] ?? 0) + 1;
    }
    const started = performance.now();
    const summaries = buildInstrumentTradeSummaries(bootstrap.executions);
    const entries = buildTradeLibraryEntries(summaries, candlesByInstrument, Object.fromEntries(Object.keys(candlesByInstrument).map(id => [id, "ready" as const])));
    const preparationMs = performance.now() - started;
    const preparationCanonicalCalls = count.calls;
    count.calls = 0;
    count.selectedPrefixMembers = 0;
    const projectionStart = performance.now();
    const output = buildHomepageV25PerformanceFromEntries({ entries, candlesByInstrument, period: { start: "2026-01-01", end: "2026-10-23" }, asOf: "2026-10-23T05:00:00.000Z" });
    const projectionMs = performance.now() - projectionStart;
    const summary = (metric: typeof output.net) => ({ available: metric.available, coverage: metric.coverage, reasons: metric.reasons, currencies: Object.keys(metric.money.originalByCurrency) });
    writeFileSync(".scratch/homepage-v25-implementation/evidence/resume-2026-10-23/F-data-prep/isolated-single-projection.json", JSON.stringify({
      database: { path, openedWith: "new DatabaseSync(path, { readOnly: true })", bytes: statSync(path).size, sha256: createHash("sha256").update(readFileSync(path)).digest("hex") },
      source: { executions: bootstrap.executions.length, natureCounts, instruments: bootstrap.instruments.length, dailyCandles: candles.length, summaries: summaries.length, entries: entries.length, resultGroups: output.instruments.length },
      request: { period: { start: "2026-01-01", end: "2026-10-23" }, asOf: "2026-10-23T05:00:00.000Z", scope: "default live", fx: "not supplied: original-currency coverage only" },
      timing: { readMs, preparationMs, preparationCanonicalCalls, singleProjectionMs: projectionMs, canonicalCalls: count.calls, selectedPrefixMembers: count.selectedPrefixMembers },
      coverage: { scope: output.scope, net: summary(output.net), currentMarketValue: summary(output.currentMarketValue), currentUnrealized: summary(output.currentUnrealized) },
      note: "One full F call only. Actual isolated backup, not the separate 83-fill browser seed. No provider/network/service or business database access; no fills, symbols, account identities or financial amounts exported. This is not a 365-day benchmark.",
    }, null, 2) + "\n");
    expect(bootstrap.executions.length).toBeGreaterThan(0);
    expect(count.calls).toBeGreaterThan(0);
  } finally { database.close(); }
}, 180_000);
