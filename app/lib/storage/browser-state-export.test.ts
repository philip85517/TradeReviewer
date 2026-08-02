import "fake-indexeddb/auto";

import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { TradeExecution } from "../trades/types";
import { openSqliteDatabase } from "../../../db/sqlite";

import {
  calculateBrowserStateFingerprint,
  exportLegacyBrowserState,
} from "./browser-state-export";
import {
  COVERAGE,
  DAILY_CANDLES,
  INSTRUMENT_METADATA,
  INTERVAL_COVERAGE,
  MARKET_CANDLES,
  openTradeReviewDatabase,
  PROVIDER_SYMBOLS,
  REVIEWS,
  TAG_SUGGESTIONS,
  transactionDone,
} from "./indexeddb-schema";
import { SqliteStore } from "./sqlite-store";

const DATABASE = "trade-reviewer";

async function seedStore(name: string, value: unknown) {
  const database = await openTradeReviewDatabase(DATABASE);
  try {
    const transaction = database.transaction(name, "readwrite");
    transaction.objectStore(name).put(value);
    await transactionDone(transaction);
  } finally {
    database.close();
  }
}

async function deleteDatabase() {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DATABASE);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

const execution: TradeExecution = {
  id: "execution-1", accountId: "account-1", accountLabel: "Primary", side: "buy",
  executedAt: "2025-01-02T03:04:05.000Z", quantity: "10", price: "12.3", fee: "0",
  source: { platform: "broker", row: 1 },
  instrument: { id: "HK:700", symbol: "700", name: "腾讯控股", market: "HK", currency: "HKD" },
};

beforeEach(() => localStorage.clear());
afterEach(async () => { localStorage.clear(); await deleteDatabase(); });

describe("exportLegacyBrowserState", () => {
  it("exports every legacy browser store and leaves rollback data untouched", async () => {
    localStorage.setItem("trade-reviewer:executions:v1", JSON.stringify({ version: 1, executions: [execution] }));
    localStorage.setItem("trade-reviewer:import-history:v1", JSON.stringify([{ id: "batch-1", fileName: "trades.csv", sourceLabel: "Broker", importedAt: "2025-01-02T03:04:05.000Z", tradeCount: 1, instrumentCount: 1, excludedInstrumentCount: 0 }]));
    localStorage.setItem("trade-reviewer:market-data-jobs:v1", JSON.stringify({ version: 2, jobs: [{ instrumentId: "HK:700", symbol: "700", market: "HK", requestedAt: "2025-01-02T03:04:05.000Z", status: "complete", intervals: [{ interval: "1D", status: "complete" }] }] }));
    localStorage.setItem("trade-reviewer:chart-settings:v1", JSON.stringify({ version: 1, showGrid: true, showVolume: true, showExecutions: true, showAverageCost: true, colorScheme: "teal-red" }));
    localStorage.setItem("trade-reviewer:review:v2:episode-1", JSON.stringify({ version: 2, episodeId: "episode-1", replayCursor: "2025-01-02T00:00:00.000Z", timeframe: "1D", activePanelTab: "notes", drawings: [] }));

    await seedStore(REVIEWS, { version: 1, episodeId: "episode-1", instrumentId: "HK:700", updatedAt: "2025-01-02T03:04:05.000Z", plan: { thesis: "", expectedPath: "", invalidationCondition: "", targetRange: "", plannedRiskAmount: "", confidence: null }, review: { decisionQuality: null, executionQuality: null, riskManagement: "", psychology: "", reusableRule: "", completed: false }, confirmedTagIds: [] });
    await seedStore(TAG_SUGGESTIONS, { version: 1, tagDictionaryVersion: 1, id: "suggestion-1", episodeId: "episode-1", instrumentId: "HK:700", tagId: "entry-20d-breakout", finalTagId: null, ruleId: "entry-20d-breakout", ruleVersion: 1, status: "suggested", suggestedAt: "2025-01-02T03:04:05.000Z", decidedAt: null, evidence: [] });
    await seedStore(INSTRUMENT_METADATA, { instrumentId: "HK:700", market: "HK", symbol: "700", name: "腾讯控股", assetType: "stock", source: "hkex", confidence: "official", resolvedAt: "2025-01-02T03:04:05.000Z" });
    await seedStore(DAILY_CANDLES, { instrumentId: "HK:700", tradingDate: "2025-01-02", open: "1", high: "2", low: "0.5", close: "1.5", volume: "10", currency: "HKD", provider: "tencent", providerSymbol: "700", adjustmentMode: "raw", fetchedAt: "2025-01-02T03:04:05.000Z" });
    await seedStore(MARKET_CANDLES, { instrumentId: "HK:700", interval: "15m", timestamp: "2025-01-02T03:00:00.000Z", open: "1", high: "2", low: "0.5", close: "1.5", volume: "10", currency: "HKD", provider: "tencent", providerSymbol: "700", adjustmentMode: "raw", fetchedAt: "2025-01-02T03:04:05.000Z" });
    const coverageSegments = [{ startDate: "2025-01-01", endDate: "2025-01-02", status: "partial", provider: "tencent", fetchedAt: "2025-01-02T03:04:05.000Z", missingTradingDates: ["2025-01-01"], reason: "missing source data" }];
    await seedStore(COVERAGE, { instrumentId: "HK:700", segments: coverageSegments });
    await seedStore(INTERVAL_COVERAGE, { instrumentId: "HK:700", interval: "15m", segments: [{ interval: "15m", requestedStart: "2025-01-02T03:00:00.000Z", requestedEnd: "2025-01-02T03:15:00.000Z", status: "complete" }] });
    await seedStore(PROVIDER_SYMBOLS, { instrumentId: "HK:700", provider: "tencent", symbol: "700" });

    const payload = await exportLegacyBrowserState();

    expect(payload).toMatchObject({ executions: [execution], importHistory: [expect.objectContaining({ id: "batch-1" })], instruments: [expect.objectContaining({ id: "HK:700", metadata: expect.objectContaining({ assetType: "stock" }) })], reviews: [expect.objectContaining({ episodeId: "episode-1" })], reviewStates: [expect.objectContaining({ episodeId: "episode-1" })], tagSuggestions: [expect.objectContaining({ id: "suggestion-1" })], marketDataJobs: [expect.objectContaining({ instrumentId: "HK:700" })], dailyCandles: [expect.objectContaining({ tradingDate: "2025-01-02" })], marketCandles: [expect.objectContaining({ interval: "15m" })], coverage: [expect.objectContaining({ instrumentId: "HK:700", segments: coverageSegments })], intervalCoverage: [expect.objectContaining({ instrumentId: "HK:700", interval: "15m" })], providerSymbols: [expect.objectContaining({ providerSymbol: "700" })] });
    const directory = mkdtempSync(join(tmpdir(), "tradereview-browser-export-"));
    try {
      const store = new SqliteStore(openSqliteDatabase(join(directory, "store.sqlite")));
      store.mergeBrowserState(payload!);
      expect(store.getCoverageSegments("HK:700")).toEqual(coverageSegments);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
    expect(localStorage.getItem("trade-reviewer:executions:v1")).not.toBeNull();
    expect(localStorage.getItem("trade-reviewer:review:v2:episode-1")).not.toBeNull();
  });

  it("hashes semantically identical payloads independently of record order", async () => {
    const payload = await exportLegacyBrowserState();
    expect(payload).toBeNull();
    const base = { version: 1 as const, sourceClientId: "browser", sourceFingerprint: "", executions: [execution, { ...execution, id: "execution-2" }], importHistory: [], instruments: [], reviews: [], reviewStates: [], tagSuggestions: [], marketDataJobs: [], settings: {}, dailyCandles: [], marketCandles: [], coverage: [], intervalCoverage: [], providerSymbols: [] };
    const reordered = { ...base, executions: [...base.executions].reverse() };
    expect(calculateBrowserStateFingerprint(base)).toBe(calculateBrowserStateFingerprint(reordered));
    const canonicalize = (value: unknown): string => {
      if (value === null || ["boolean", "number", "string"].includes(typeof value)) return JSON.stringify(value);
      if (Array.isArray(value)) return `[${value.map(canonicalize).sort().join(",")}]`;
      return `{${Object.keys(value as Record<string, unknown>).sort().map((key) => `${JSON.stringify(key)}:${canonicalize((value as Record<string, unknown>)[key])}`).join(",")}}`;
    };
    const { sourceFingerprint, ...state } = base;
    void sourceFingerprint;
    expect(calculateBrowserStateFingerprint(base)).toBe(createHash("sha256").update(canonicalize(state)).digest("hex"));
  });

  it("infers instruments referenced only by market data and reviews", async () => {
    await seedStore(DAILY_CANDLES, { instrumentId: "US:ORPH", tradingDate: "2025-01-02", open: "1", high: "2", low: "0.5", close: "1.5", volume: "10", currency: "USD", provider: "yahoo", providerSymbol: "ORPH", adjustmentMode: "raw", fetchedAt: "2025-01-02T03:04:05.000Z" });
    await seedStore(REVIEWS, { version: 1, episodeId: "episode-orphan", instrumentId: "US:ORPH", updatedAt: "2025-01-02T03:04:05.000Z", plan: { thesis: "", expectedPath: "", invalidationCondition: "", targetRange: "", plannedRiskAmount: "", confidence: null }, review: { decisionQuality: null, executionQuality: null, riskManagement: "", psychology: "", reusableRule: "", completed: false }, confirmedTagIds: [] });

    const payload = await exportLegacyBrowserState();

    expect(payload?.instruments).toContainEqual(expect.objectContaining({ id: "US:ORPH", symbol: "ORPH", market: "US", currency: "USD" }));
    const directory = mkdtempSync(join(tmpdir(), "tradereview-inferred-instrument-"));
    try {
      const store = new SqliteStore(openSqliteDatabase(join(directory, "store.sqlite")));
      expect(() => store.mergeBrowserState(payload!)).not.toThrow();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("filters malformed legacy records and does not rewrite v1 review state", async () => {
    localStorage.setItem("trade-reviewer:review:v1:legacy", JSON.stringify({ version: 1, replayCursor: "2025-01-02T00:00:00.000Z", timeframe: "1D", thesis: "", drawings: [] }));
    await seedStore(DAILY_CANDLES, { instrumentId: "HK:700", tradingDate: "2025-01-02", open: "1", high: "2", low: "0.5", close: "1.5", volume: "10", currency: "HKD", provider: "tencent", providerSymbol: "700", adjustmentMode: "raw", fetchedAt: "2025-01-02T03:04:05.000Z" });
    await seedStore(REVIEWS, { episodeId: "broken" });

    const payload = await exportLegacyBrowserState();

    expect(payload?.reviews).toEqual([]);
    expect(payload?.reviewStates).toEqual([expect.objectContaining({ episodeId: "legacy", version: 2 })]);
    expect(localStorage.getItem("trade-reviewer:review:v2:legacy")).toBeNull();
    expect(localStorage.getItem("trade-reviewer:review:v1:legacy")).not.toBeNull();
  });

  it("filters invalid coverage and tag optionals while keeping valid sibling records", async () => {
    await seedStore(COVERAGE, { instrumentId: "HK:700", segments: [
      { startDate: "2025-01-01", endDate: "2025-01-02", status: "unexpected", missingTradingDates: [] },
      { startDate: "2025-01-03", endDate: "2025-01-04", status: "partial", provider: "tencent", fetchedAt: "2025-01-04T00:00:00.000Z", missingTradingDates: [], reason: "late source" },
    ] });
    await seedStore(INTERVAL_COVERAGE, { instrumentId: "HK:700", interval: "15m", segments: [
      { interval: "15m", requestedStart: "2025-01-01T00:00:00.000Z", requestedEnd: "2025-01-01T00:15:00.000Z", status: "complete", provider: 1 },
      { interval: "15m", requestedStart: "2025-01-02T00:00:00.000Z", requestedEnd: "2025-01-02T00:15:00.000Z", status: "complete", actualStart: "2025-01-02T00:00:00.000Z" },
    ] });
    const validTag = { version: 1, tagDictionaryVersion: 1, id: "valid-tag", episodeId: "episode", instrumentId: "HK:700", tagId: "entry-20d-breakout", finalTagId: null, ruleId: "entry-20d-breakout", ruleVersion: 1, status: "suggested", suggestedAt: "2025-01-02T00:00:00.000Z", decidedAt: null, evidence: [] };
    await seedStore(TAG_SUGGESTIONS, { ...validTag, id: "bad-tag", finalTagId: 1 });
    await seedStore(TAG_SUGGESTIONS, validTag);

    const payload = await exportLegacyBrowserState();

    expect(payload?.coverage).toEqual([expect.objectContaining({ segments: [expect.objectContaining({ startDate: "2025-01-03" })] })]);
    expect(payload?.intervalCoverage).toEqual([expect.objectContaining({ requestedStart: "2025-01-02T00:00:00.000Z" })]);
    expect(payload?.tagSuggestions).toEqual([validTag]);
  });
});
