import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { openSqliteDatabase } from "../../../db/sqlite";
import type { BrowserStatePayload } from "./sqlite-contracts";
import { SqliteStore } from "./sqlite-store";

const directories: string[] = [];

function createStore() {
  const directory = mkdtempSync(join(tmpdir(), "tradereview-store-"));
  directories.push(directory);
  return new SqliteStore(openSqliteDatabase(join(directory, "store.sqlite")));
}

function databaseFor(store: SqliteStore) {
  return (store as unknown as {
    database: ReturnType<typeof openSqliteDatabase>;
  }).database;
}

function snapshotAllTables(store: SqliteStore) {
  const database = databaseFor(store);
  const tables = database.prepare(
    "select name from sqlite_master where type = 'table' and name not like 'sqlite_%' order by name",
  ).all() as Array<{ name: string }>;

  return Object.fromEntries(
    tables.map(({ name }) => [
      name,
      database.prepare(`select * from "${name}" order by rowid`).all(),
    ]),
  );
}

function expectBrowserStateRejectionBeforeTransaction(
  store: SqliteStore,
  browserState: BrowserStatePayload,
) {
  const database = databaseFor(store);
  const before = snapshotAllTables(store);
  const exec = vi.spyOn(database, "exec");

  expect(() => store.mergeBrowserState(browserState)).toThrow();
  expect(exec).not.toHaveBeenCalledWith("begin immediate");
  expect(snapshotAllTables(store)).toEqual(before);
}

const instrument = {
  id: "HK:700",
  symbol: "700",
  name: "腾讯控股",
  market: "HK",
  currency: "HKD",
};

const execution = {
  id: "execution-1",
  source: { platform: "broker", row: 1, fileName: "trades.csv" },
  accountId: "account-1",
  accountLabel: "主账户",
  instrument,
  side: "buy" as const,
  executedAt: "2026-01-02T03:04:05.000Z",
  quantity: "100.000000000000000001",
  price: "123.450000000000000001",
  fee: "0.01",
};

function payload(overrides: Partial<BrowserStatePayload> = {}): BrowserStatePayload {
  return {
    version: 1,
    sourceClientId: "browser-a",
    sourceFingerprint: "migration-1",
    executions: [execution],
    importHistory: [],
    instruments: [instrument],
    reviews: [],
    reviewStates: [],
    tagSuggestions: [],
    marketDataJobs: [],
    settings: { version: 1, showGrid: true, showVolume: true, showExecutions: true, showAverageCost: true, colorScheme: "teal-red" },
    dailyCandles: [],
    marketCandles: [],
    coverage: [],
    intervalCoverage: [],
    providerSymbols: [],
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("SqliteStore", () => {
  it("returns a complete bootstrap with empty production data", () => {
    const bootstrap = createStore().getBootstrap();

    expect(bootstrap).toMatchObject({
      schemaVersion: 3,
      executions: [], importHistory: [], instruments: [], reviews: [],
      tagSuggestions: [], marketDataJobs: [], settings: {},
    });
    expect(bootstrap.migration).toBeNull();
  });

  it("upserts an instrument and execution in one transaction", () => {
    const store = createStore();
    expect(store.mergeExecutions([execution])).toEqual({ inserted: 1, duplicate: 0, conflict: 0 });
    expect(store.getExecutions()).toEqual([execution]);
    expect(store.getInstruments()).toEqual([instrument]);
  });

  it("preserves resolved instrument metadata when later executions upsert the core instrument", () => {
    const store = createStore();
    const metadata = {
      market: "HK" as const,
      symbol: "700",
      name: "腾讯控股",
      assetType: "stock" as const,
      source: "hkex" as const,
      confidence: "official" as const,
      resolvedAt: "2026-01-01T00:00:00.000Z",
    };

    store.mergeTradeData({ instruments: [{ ...instrument, metadata }], executions: [] });
    store.mergeExecutions([execution]);

    expect(store.getInstruments()).toEqual([{ ...instrument, metadata }]);
    expect(store.getBootstrap().instruments).toEqual([{ ...instrument, metadata }]);
  });

  it("preserves an incoming screenshot replacement when the old conflicting id is removed atomically", () => {
    const store = createStore();
    const existing = { ...execution, id: "existing-conflict" };
    const incoming = { ...execution, id: "incoming-conflict", price: "999" };
    store.mergeExecutions([existing]);

    expect(store.mergeTradeData({ executions: [incoming], replaceExecutionIds: [existing.id] })).toEqual({ inserted: 1, duplicate: 0, conflict: 0 });
    expect(store.getExecutions().map((item) => item.id)).toEqual([incoming.id]);
    expect(store.getExecutions()[0]?.price).toBe("999");
  });

  it("creates a placeholder review for a suggestion-only migration payload", () => {
    const store = createStore();
    const suggestion = {
      version: 1 as const, tagDictionaryVersion: 1, id: "orphan-suggestion", episodeId: "orphan-episode", instrumentId: instrument.id,
      tagId: "entry-20d-breakout" as const, finalTagId: null, ruleId: "entry-20d-breakout" as const, ruleVersion: 1 as const,
      status: "suggested" as const, suggestedAt: "2026-01-02T03:04:05.000Z", decidedAt: null, evidence: [],
    };

    expect(() => store.mergeBrowserState(payload({ sourceFingerprint: "suggestion-only", executions: [], tagSuggestions: [suggestion] }))).not.toThrow();
    expect(store.getTagSuggestions()).toEqual([suggestion]);
    expect(store.getReview("orphan-episode")).toMatchObject({ episodeId: "orphan-episode", instrumentId: instrument.id });
  });

  it("does not persist a suggestion when its combined review decision conflicts", () => {
    const store = createStore();
    store.mergeTradeData({ instruments: [instrument], executions: [] });
    const newerReview = {
      version: 1 as const, tagDictionaryVersion: 1, episodeId: "decision-episode", instrumentId: instrument.id, updatedAt: "2026-02-01T00:00:00.000Z",
      plan: { thesis: "new", expectedPath: "", invalidationCondition: "", targetRange: "", plannedRiskAmount: "", confidence: null },
      review: { decisionQuality: null, executionQuality: null, riskManagement: "", psychology: "", reusableRule: "", completed: false }, confirmedTagIds: [],
    };
    store.putReview(newerReview);
    const staleReview = { ...newerReview, updatedAt: "2026-01-01T00:00:00.000Z", confirmedTagIds: ["entry-20d-breakout"] };
    const suggestion = { version: 1 as const, tagDictionaryVersion: 1, id: "atomic-suggestion", episodeId: "decision-episode", instrumentId: instrument.id, tagId: "entry-20d-breakout" as const, finalTagId: "entry-20d-breakout" as const, ruleId: "entry-20d-breakout" as const, ruleVersion: 1 as const, status: "confirmed" as const, suggestedAt: "2026-01-01T00:00:00.000Z", decidedAt: "2026-01-01T00:00:00.000Z", evidence: [] };

    expect(store.putSuggestionDecision({ suggestion, review: staleReview })).toBe(false);
    expect(store.getTagSuggestions()).toEqual([]);
    expect(store.getReview("decision-episode")?.plan.thesis).toBe("new");
  });

  it("migrates resolved instrument metadata from browser state into bootstrap", () => {
    const store = createStore();
    const metadata = {
      market: "HK" as const,
      symbol: "700",
      name: "腾讯控股",
      assetType: "stock" as const,
      source: "hkex" as const,
      confidence: "official" as const,
      resolvedAt: "2026-01-01T00:00:00.000Z",
    };

    store.mergeBrowserState(payload({
      sourceFingerprint: "metadata-migration",
      instruments: [{ ...instrument, metadata }],
    }));

    expect(store.getBootstrap().instruments).toEqual([{ ...instrument, metadata }]);
  });

  it("deduplicates a repeated browser migration by source fingerprint", () => {
    const store = createStore();
    expect(store.mergeBrowserState(payload())).toMatchObject({ inserted: 8, duplicate: 0, conflict: 0, failed: 0 });
    expect(store.mergeBrowserState(payload())).toMatchObject({ inserted: 0, duplicate: 8, conflict: 0, failed: 0 });
    expect(store.getExecutions()).toEqual([execution]);
  });

  it("reports duplicates for an overlapping migration with a new fingerprint", () => {
    const store = createStore();
    store.mergeBrowserState(payload());

    expect(store.mergeBrowserState(payload({ sourceFingerprint: "migration-2" }))).toMatchObject({ inserted: 0, duplicate: 8, conflict: 0 });
  });

  it("preserves a newer review when an older payload is retried", () => {
    const store = createStore();
    store.mergeExecutions([execution]);
    const newer = {
      version: 1 as const, episodeId: "episode-1", instrumentId: instrument.id,
      updatedAt: "2026-02-01T00:00:00.000Z",
      plan: { thesis: "new", expectedPath: "up", invalidationCondition: "down", targetRange: "200", plannedRiskAmount: "10", confidence: 4 as const },
      review: { decisionQuality: 4 as const, executionQuality: 4 as const, riskManagement: "ok", psychology: "ok", reusableRule: "wait", completed: true },
      confirmedTagIds: [],
    };
    const older = { ...newer, updatedAt: "2026-01-01T00:00:00.000Z", plan: { ...newer.plan, thesis: "old" } };

    expect(store.putReview(newer)).toBe(true);
    expect(store.mergeBrowserState(payload({ sourceFingerprint: "migration-old", reviews: [older] }))).toMatchObject({ conflict: 1 });
    expect(store.getReview("episode-1")?.plan.thesis).toBe("new");
  });

  it("round-trips review UI state including drawings", () => {
    const store = createStore();
    const state = {
      version: 2 as const,
      episodeId: "episode-state",
      replayCursor: "2026-01-02T00:00:00.000Z",
      timeframe: "1D" as const,
      activePanelTab: "notes" as const,
      drawings: [{ version: 2 as const, id: "drawing-1", episodeId: "episode-state", name: "Line", tool: "horizontal-line" as const, anchors: [{ time: "2026-01-02T00:00:00.000Z", price: 1 }], style: { color: "#fff", lineWidth: 1, opacity: 1 }, zIndex: 0, hidden: false, locked: false, visibleOn: "all" as const, stage: "during-replay" as const, createdAtCursor: "2026-01-02T00:00:00.000Z" }],
    };

    store.mergeBrowserState(payload({ sourceFingerprint: "migration-state", reviewStates: [state] }));

    expect(store.getReviewStates()).toEqual([state]);
    expect(store.getBootstrap().reviewStates).toEqual([state]);
  });

  it("stores and reads decimal fields without numeric coercion", () => {
    const store = createStore();
    store.mergeExecutions([execution]);
    const [stored] = store.getExecutions();

    expect(stored.quantity).toBe("100.000000000000000001");
    expect(stored.price).toBe("123.450000000000000001");
  });

  it("round-trips candle provenance and full interval coverage without provider joins", () => {
    const store = createStore();
    const daily = { instrumentId: instrument.id, tradingDate: "2026-01-02", open: "1.01", high: "2.02", low: "1.00", close: "2.00", volume: "3", currency: "HKD", provider: "yahoo" as const, providerSymbol: "0700.HK", adjustmentMode: "raw" as const, fetchedAt: "2026-01-03T00:00:00.000Z" };
    const intervalCoverage = { instrumentId: instrument.id, interval: "15m" as const, requestedStart: "2026-01-02T00:00:00.000Z", requestedEnd: "2026-01-02T04:00:00.000Z", actualStart: "2026-01-02T00:15:00.000Z", actualEnd: "2026-01-02T03:45:00.000Z", status: "partial" as const, provider: "yahoo" as const, fetchedAt: "2026-01-03T00:00:00.000Z", reason: "holiday" };

    store.mergeBrowserState(payload({ sourceFingerprint: "market-state", executions: [], instruments: [instrument], dailyCandles: [daily], intervalCoverage: [intervalCoverage], providerSymbols: [{ instrumentId: instrument.id, provider: "tencent", providerSymbol: "hk00700" }] }));

    expect(store.getDailyCandles()).toEqual([daily]);
    expect(store.getIntervalCoverage()).toEqual([{ ...intervalCoverage, adjustmentMode: "raw" }]);
    expect(store.mergeBrowserState(payload({ sourceFingerprint: "market-state-repeat", executions: [], instruments: [instrument], dailyCandles: [daily], intervalCoverage: [intervalCoverage], providerSymbols: [{ instrumentId: instrument.id, provider: "tencent", providerSymbol: "hk00700" }] }))).toMatchObject({ inserted: 0, duplicate: 10, conflict: 0 });
  });

  it("preserves complete daily coverage evidence from a browser-state migration", () => {
    const store = createStore();
    const segments = [{ startDate: "2026-01-02", endDate: "2026-01-04", status: "partial" as const, provider: "tencent" as const, fetchedAt: "2026-01-05T00:00:00.000Z", missingTradingDates: ["2026-01-03"], reason: "market holiday" }];

    store.mergeBrowserState(payload({
      sourceFingerprint: "daily-coverage-state",
      executions: [],
      instruments: [instrument],
      coverage: [{ instrumentId: instrument.id, adjustmentMode: "raw", startDate: "2026-01-02", endDate: "2026-01-04", segments }],
    }));

    expect(store.getCoverage()).toEqual([{ instrumentId: instrument.id, adjustmentMode: "raw", startDate: "2026-01-02", endDate: "2026-01-04", segments }]);
    expect(store.getCoverageSegments(instrument.id)).toEqual(segments);
  });

  it("commits repository market-data contracts atomically and returns daily 1D candles", () => {
    const store = createStore();
    store.mergeExecutions([execution]);
    const daily = { instrumentId: instrument.id, tradingDate: "2026-01-02", open: "1", high: "2", low: "1", close: "2", volume: "3", currency: "HKD", provider: "tencent" as const, providerSymbol: "700", adjustmentMode: "raw" as const, fetchedAt: "2026-01-03T00:00:00.000Z" };
    store.commitMarketData({ instrumentId: instrument.id, candles: [daily], coverage: [{ startDate: "2026-01-02", endDate: "2026-01-02", status: "complete", missingTradingDates: [] }], providerSymbol: { provider: "tencent", symbol: "700" } });
    expect(store.getCandles(instrument.id, "1D", "2026-01-01T00:00:00.000Z", "2026-01-03T00:00:00.000Z")).toMatchObject([{ interval: "1D", timestamp: "2026-01-02T00:00:00.000Z", close: "2" }]);
    expect(store.getCoverageSegments(instrument.id)).toHaveLength(1);
    expect(() => store.commitMarketData({ instrumentId: instrument.id, candles: [daily], coverage: [{ startDate: "bad", endDate: "bad", status: "complete", missingTradingDates: "bad" as never }], providerSymbol: { provider: "tencent", symbol: "700" } })).toThrow("Invalid coverage");
    expect(store.getDailyCandles(instrument.id)).toEqual([daily]);
  });

  it("rejects malformed API market-data batches without partial writes", () => {
    const store = createStore();
    store.mergeExecutions([execution]);
    const candle = { instrumentId: instrument.id, interval: "15m" as const, timestamp: "2026-01-02T01:00:00.000Z", open: "1", high: "2", low: "1", close: "2", volume: "3", currency: "HKD", provider: "tencent" as const, providerSymbol: "700", adjustmentMode: "raw" as const, fetchedAt: "2026-01-03T00:00:00.000Z" };
    const intervalCoverage = { interval: "15m" as const, requestedStart: "2026-01-02T00:00:00.000Z", requestedEnd: "2026-01-02T02:00:00.000Z", status: "complete" as const };
    store.commitIntervalMarketData({ instrumentId: instrument.id, interval: "15m", candles: [candle], coverage: [intervalCoverage], providerSymbol: { provider: "tencent", symbol: "700" } });
    store.commitIntervalMarketData({ instrumentId: instrument.id, interval: "15m", candles: [candle], coverage: [intervalCoverage], providerSymbol: { provider: "tencent", symbol: "700" } });
    expect(store.getCandles(instrument.id, "15m", "2026-01-02T00:00:00.000Z", "2026-01-02T02:00:00.000Z")).toHaveLength(1);
    expect(() => store.commitIntervalMarketData({ instrumentId: instrument.id, interval: "1D", candles: [candle], coverage: [intervalCoverage], providerSymbol: { provider: "tencent", symbol: "700" } })).toThrow("Invalid market data");
    expect(() => store.commitIntervalMarketData({ instrumentId: instrument.id, interval: "15m", candles: [candle], coverage: [{ ...intervalCoverage, interval: "1D" }], providerSymbol: { provider: "tencent", symbol: "700" } })).toThrow("Invalid market data");
    expect(() => store.commitMarketData({ instrumentId: "missing", candles: [], coverage: [], providerSymbol: { provider: "tencent", symbol: "missing" } })).toThrow("Unknown instrument: missing");
    const before = snapshotAllTables(store);
    expect(() => store.commitIntervalMarketData({ instrumentId: instrument.id, interval: "15m", candles: [candle, { ...candle, instrumentId: "other" }], coverage: [intervalCoverage], providerSymbol: { provider: "tencent", symbol: "700" } })).toThrow("Invalid market data");
    expect(snapshotAllTables(store)).toEqual(before);
  });

  it("rolls back all tables when one browser-state record is invalid", () => {
    const store = createStore();
    expect(() => store.mergeBrowserState(payload({ reviews: [{ episodeId: "invalid" } as never] }))).toThrow("Invalid review");

    expect(store.getBootstrap()).toMatchObject({ executions: [], instruments: [], reviews: [] });
  });

  it("rolls back data when recording the migration marker fails", () => {
    const store = createStore();
    const database = (store as unknown as { database: ReturnType<typeof openSqliteDatabase> }).database;
    database.exec("create trigger fail_marker before insert on data_migrations begin select raise(abort, 'marker failed'); end");

    expect(() => store.mergeBrowserState(payload())).toThrow("marker failed");
    expect(store.getBootstrap()).toMatchObject({ executions: [], instruments: [] });
  });

  it("rejects invalid nested browser state before any table is written", () => {
    const store = createStore();
    const invalidJob = { instrumentId: instrument.id, symbol: "700", market: "HK", requestedAt: "2026-01-01T00:00:00.000Z", status: "complete", intervals: [{ interval: "15m", status: 42 }] };

    expect(() => store.mergeBrowserState(payload({ marketDataJobs: [invalidJob as never] }))).toThrow("Invalid market data job");
    expect(store.getStatus().counts).toMatchObject({ instruments: 0, executions: 0, market_data_jobs: 0 });
  });

  it("rejects an unknown market-data job status before migration", () => {
    const store = createStore();
    const job = { instrumentId: instrument.id, symbol: "700", market: "HK", requestedAt: "2026-01-01T00:00:00.000Z", status: "unknown", intervals: [] };

    expect(() => store.mergeBrowserState(payload({ marketDataJobs: [job as never] }))).toThrow("Invalid market data job");
    expect(store.getStatus().counts.instruments).toBe(0);
  });

  it("rejects an unknown market-data interval status before migration", () => {
    const store = createStore();
    const job = { instrumentId: instrument.id, symbol: "700", market: "HK", requestedAt: "2026-01-01T00:00:00.000Z", status: "complete", intervals: [{ interval: "15m", status: "unknown" }] };

    expect(() => store.mergeBrowserState(payload({ marketDataJobs: [job as never] }))).toThrow("Invalid market data job");
    expect(store.getStatus().counts.instruments).toBe(0);
  });

  it("rejects malformed drawing anchors and nested undefined JSON values", () => {
    const store = createStore();
    const drawing = { version: 2, id: "drawing", episodeId: "episode", name: "bad", tool: "horizontal-line", anchors: [{ time: "", price: Number.NaN }], style: { color: "#fff", lineWidth: 1, opacity: 1 }, zIndex: 0, hidden: false, locked: false, visibleOn: "all", stage: "during-replay", createdAtCursor: "2026-01-01T00:00:00.000Z" };
    const state = { version: 2, episodeId: "episode", replayCursor: "2026-01-01T00:00:00.000Z", timeframe: "1D", activePanelTab: "notes", drawings: [drawing] };

    expect(() => store.mergeBrowserState(payload({ reviewStates: [state as never] }))).toThrow();
    expect(() => store.mergeBrowserState(payload({ sourceFingerprint: "nested-undefined", providerSymbols: [{ instrumentId: instrument.id, provider: "yahoo", providerSymbol: "700", metadata: { invalid: undefined } }] }))).toThrow("Invalid provider metadata");
    expect(store.getStatus().counts.instruments).toBe(0);
  });

  it("rejects nested undefined in a market-data job before any table changes", () => {
    const store = createStore();
    const job = {
      instrumentId: instrument.id,
      symbol: instrument.symbol,
      market: instrument.market,
      requestedAt: "2026-01-01T00:00:00.000Z",
      status: "complete",
      intervals: [{
        interval: "15m",
        status: "complete",
        metadata: { invalid: undefined },
      }],
    };

    expectBrowserStateRejectionBeforeTransaction(
      store,
      payload({ marketDataJobs: [job as never] }),
    );
  });

  it("rejects nested undefined in settings before any table changes", () => {
    const store = createStore();

    expectBrowserStateRejectionBeforeTransaction(
      store,
      payload({ settings: { nested: { invalid: undefined } } }),
    );
  });

  it("rejects nested undefined in coverage before any table changes", () => {
    const store = createStore();
    const coverage = {
      instrumentId: instrument.id,
      adjustmentMode: "raw",
      metadata: { invalid: undefined },
    };

    expectBrowserStateRejectionBeforeTransaction(
      store,
      payload({ coverage: [coverage as never] }),
    );
  });
});
