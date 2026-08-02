import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { openSqliteDatabase } from "../../../db/sqlite";
import type { BrowserStatePayload } from "./sqlite-contracts";
import { SqliteStore } from "./sqlite-store";

const directories: string[] = [];

function createStore() {
  const directory = mkdtempSync(join(tmpdir(), "tradereview-store-"));
  directories.push(directory);
  return new SqliteStore(openSqliteDatabase(join(directory, "store.sqlite")));
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
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("SqliteStore", () => {
  it("returns a complete bootstrap with empty production data", () => {
    const bootstrap = createStore().getBootstrap();

    expect(bootstrap).toMatchObject({
      schemaVersion: 1,
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

  it("deduplicates a repeated browser migration by source fingerprint", () => {
    const store = createStore();
    expect(store.mergeBrowserState(payload())).toMatchObject({ inserted: 8, duplicate: 0, conflict: 0, failed: 0 });
    expect(store.mergeBrowserState(payload())).toMatchObject({ inserted: 0, duplicate: 8, conflict: 0, failed: 0 });
    expect(store.getExecutions()).toEqual([execution]);
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

  it("stores and reads decimal fields without numeric coercion", () => {
    const store = createStore();
    store.mergeExecutions([execution]);
    const [stored] = store.getExecutions();

    expect(stored.quantity).toBe("100.000000000000000001");
    expect(stored.price).toBe("123.450000000000000001");
  });

  it("rolls back all tables when one browser-state record is invalid", () => {
    const store = createStore();
    expect(() => store.mergeBrowserState(payload({ reviews: [{ episodeId: "invalid" } as never] }))).toThrow("Invalid review");

    expect(store.getBootstrap()).toMatchObject({ executions: [], instruments: [], reviews: [] });
  });
});
