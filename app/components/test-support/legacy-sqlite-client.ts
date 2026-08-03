import { loadChartSettings, saveChartSettings } from "../../lib/storage/chart-settings";
import { exportLegacyBrowserState } from "../../lib/storage/browser-state-export";
import { IndexedDbEpisodeReviewRepository } from "../../lib/storage/indexeddb-episode-review-repository";
import { IndexedDbMarketDataRepository } from "../../lib/storage/indexeddb-market-data-repository";
import { IndexedDbTagSuggestionRepository } from "../../lib/storage/indexeddb-tag-suggestion-repository";
import { saveImportHistoryEntry } from "../../lib/storage/import-history";
import { saveImportedExecutions } from "../../lib/storage/import-library";
import { saveMarketDataJob, type MarketDataJob } from "../../lib/storage/market-data-jobs";
import { saveReviewState } from "../../lib/storage/review-storage";
import type { SqliteHttpClient } from "../../lib/storage/sqlite-http-client";
import type { BrowserStatePayload, StorageBootstrap } from "../../lib/storage/sqlite-contracts";

/** Test-only adapter that lets legacy fixture setup exercise the API workspace seam. */
export function createLegacySqliteClient(): SqliteHttpClient {
  let state: BrowserStatePayload | null = null;
  const market = new IndexedDbMarketDataRepository();
  const reviews = new IndexedDbEpisodeReviewRepository();
  const suggestions = new IndexedDbTagSuggestionRepository();
  const snapshot = async () => state ?? await exportLegacyBrowserState();
  const bootstrap = async (): Promise<StorageBootstrap> => {
    const source = await snapshot();
    return source ? {
      schemaVersion: 1,
      migration: null,
      executions: source.executions,
      importHistory: source.importHistory,
      instruments: source.instruments,
      reviews: source.reviews,
      reviewStates: source.reviewStates,
      tagSuggestions: source.tagSuggestions,
      marketDataJobs: source.marketDataJobs,
      settings: source.settings,
    } : {
      schemaVersion: 1, migration: null, executions: [], importHistory: [], instruments: [],
      reviews: [], reviewStates: [], tagSuggestions: [], marketDataJobs: [], settings: loadChartSettings(),
    };
  };
  return {
    async getStatus() { return { schemaVersion: 1, migration: null, counts: {} }; },
    getBootstrap: bootstrap,
    async migrate(payload) {
      state = payload;
      return { sourceFingerprint: payload.sourceFingerprint, inserted: 0, duplicate: 0, conflict: 0, failed: 0, validationDigest: "test" };
    },
    mergeExecutions(input) {
      const source = state;
      const current = source ? {
        executions: source.executions,
        importHistory: source.importHistory,
        instruments: source.instruments,
      } : { executions: [], importHistory: [], instruments: [] };
      const executions = input.executions;
      const importHistory = input.importHistory
        ? [...input.importHistory, ...current.importHistory.filter((entry) => !input.importHistory?.some((next) => next.id === entry.id))]
        : current.importHistory;
      for (const entry of input.importHistory ?? []) saveImportHistoryEntry(entry);
      saveImportedExecutions(executions);
      if (source) {
        state = {
          ...source,
          executions,
          importHistory,
          instruments: input.instruments ?? current.instruments,
        };
      }
      return Promise.resolve({ inserted: 0, duplicate: 0, conflict: 0 });
    },
    async putReview(record) { await reviews.put(record); state = null; return record; },
    async putReviewState(record) { saveReviewState(record.episodeId, record); state = null; return record; },
    async putTagSuggestion(record) { await suggestions.put(record); state = null; return record; },
    async putSuggestionDecision(input) { await suggestions.put(input.suggestion); await reviews.put(input.review); state = null; return input; },
    async getProviderSymbol(instrumentId, provider) { return market.getProviderSymbol(instrumentId, provider as never); },
    async getMarketData(input) {
      const start = input.start ?? "0000-01-01T00:00:00.000Z";
      const end = input.end ?? "9999-12-31T23:59:59.999Z";
      const intervalCoverage = await market.getIntervalCoverage(input.instrumentId, input.interval);
      if (input.dailyOnly) return {
        candles: [], dailyCandles: await market.getDailyCandles(input.instrumentId, start.slice(0, 10), end.slice(0, 10)), intervalCoverage,
        coverage: await market.getCoverage(input.instrumentId),
      };
      return { candles: await market.getCandles(input.instrumentId, input.interval, start, end), intervalCoverage,
        ...(input.interval === "1D" ? { coverage: await market.getCoverage(input.instrumentId) } : {}),
      };
    },
    async putMarketData(input) {
      if (input.kind === "daily") await market.commitSyncResult(input.result);
      else await market.commitIntervalSyncResult(input.result);
      return { ok: true };
    },
    async putMarketDataJob(job: MarketDataJob) { saveMarketDataJob(job); state = null; return job; },
    async getSettings() { return loadChartSettings(); },
    async putSettings(settings) { saveChartSettings(settings); state = null; return settings; },
  };
}
