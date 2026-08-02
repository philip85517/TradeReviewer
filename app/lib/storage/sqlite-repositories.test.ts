import { describe, expect, it, vi } from "vitest";

import type { SqliteHttpClient } from "./sqlite-http-client";
import {
  ApiEpisodeReviewRepository,
  ApiInstrumentMetadataRepository,
  ApiMarketDataRepository,
  ApiTagSuggestionRepository,
} from "./sqlite-repositories";

const client = (overrides: Partial<SqliteHttpClient> = {}) => ({
  getStatus: vi.fn(),
  getBootstrap: vi.fn(),
  migrate: vi.fn(),
  mergeExecutions: vi.fn(),
  putReview: vi.fn(),
  putTagSuggestion: vi.fn(),
  getMarketData: vi.fn(),
  putMarketData: vi.fn(),
  getSettings: vi.fn(),
  putSettings: vi.fn(),
  ...overrides,
}) as unknown as SqliteHttpClient;

describe("SQLite API repository adapters", () => {
  it("maps daily and interval sync operations to distinct market-data writes", async () => {
    const putMarketData = vi.fn().mockResolvedValue({ ok: true });
    const repository = new ApiMarketDataRepository(client({ putMarketData }));

    await repository.commitSyncResult({
      instrumentId: "HK:700",
      candles: [],
      coverage: [],
      providerSymbol: { provider: "tencent", symbol: "700" },
    });
    await repository.commitIntervalSyncResult({
      instrumentId: "HK:700",
      interval: "15m",
      candles: [],
      coverage: [],
    });

    expect(putMarketData).toHaveBeenNthCalledWith(1, {
      kind: "daily",
      result: {
        instrumentId: "HK:700",
        candles: [],
        coverage: [],
        providerSymbol: { provider: "tencent", symbol: "700" },
      },
    });
    expect(putMarketData).toHaveBeenNthCalledWith(2, {
      kind: "interval",
      result: { instrumentId: "HK:700", interval: "15m", candles: [], coverage: [] },
    });
  });

  it("maps API reads to existing market-data repository return shapes", async () => {
    const getMarketData = vi.fn().mockResolvedValue({
      candles: [{ timestamp: "2025-01-02T00:00:00.000Z" }],
      intervalCoverage: [{ interval: "1D" }],
      coverage: [{ startDate: "2025-01-01" }],
    });
    const repository = new ApiMarketDataRepository(client({ getMarketData }));

    await expect(
      repository.getCandles("HK:700", "1D", "2025-01-01T00:00:00.000Z", "2025-01-31T23:59:59.999Z"),
    ).resolves.toEqual([{ timestamp: "2025-01-02T00:00:00.000Z" }]);
    await expect(repository.getCoverage("HK:700")).resolves.toEqual([
      { startDate: "2025-01-01" },
    ]);
    expect(getMarketData).toHaveBeenCalledWith({
      instrumentId: "HK:700",
      interval: "1D",
      start: "2025-01-01T00:00:00.000Z",
      end: "2025-01-31T23:59:59.999Z",
    });
  });

  it("maps review and tag repository calls to the review endpoint client", async () => {
    const record = {
      version: 1 as const,
      episodeId: "episode-1",
      instrumentId: "HK:700",
      updatedAt: "2025-01-01T00:00:00.000Z",
      plan: { thesis: "breakout", expectedPath: "up", invalidationCondition: "down", targetRange: "10", plannedRiskAmount: "1", confidence: 3 as const },
      review: { decisionQuality: 3 as const, executionQuality: 3 as const, riskManagement: "ok", psychology: "calm", reusableRule: "wait", completed: true },
      confirmedTagIds: [],
    };
    const suggestion = {
      version: 1 as const,
      tagDictionaryVersion: 1,
      id: "tag-1",
      episodeId: "episode-1",
      instrumentId: "HK:700",
      tagId: "entry-20d-breakout",
      finalTagId: null,
      ruleId: "entry-20d-breakout" as const,
      ruleVersion: 1 as const,
      status: "suggested" as const,
      suggestedAt: "2025-01-01T00:00:00.000Z",
      decidedAt: null,
      evidence: [],
    };
    const getBootstrap = vi.fn().mockResolvedValue({ reviews: [record], tagSuggestions: [suggestion], instruments: [] });
    const putReview = vi.fn().mockResolvedValue(record);
    const putTagSuggestion = vi.fn().mockResolvedValue(suggestion);
    const api = client({ getBootstrap, putReview, putTagSuggestion });

    await expect(new ApiEpisodeReviewRepository(api).get("episode-1")).resolves.toBe(record);
    await expect(new ApiEpisodeReviewRepository(api).put(record)).resolves.toBe(true);
    await expect(new ApiTagSuggestionRepository(api).getAll()).resolves.toEqual([suggestion]);
    await new ApiTagSuggestionRepository(api).put(suggestion);
    expect(putReview).toHaveBeenCalledWith({ ...record, tagDictionaryVersion: 1 });
    expect(putTagSuggestion).toHaveBeenCalledWith(suggestion);
  });

  it("derives statement metadata from persisted instruments and writes it through trades", async () => {
    const mergeExecutions = vi.fn().mockResolvedValue({ inserted: 0, duplicate: 0, conflict: 0 });
    const getBootstrap = vi.fn().mockResolvedValue({
      instruments: [{ id: "HK:700", market: "HK", symbol: "700", name: "腾讯", currency: "HKD" }],
    });
    const repository = new ApiInstrumentMetadataRepository(client({ getBootstrap, mergeExecutions }));

    await expect(repository.get("HK:700")).resolves.toMatchObject({
      market: "HK", symbol: "700", name: "腾讯", source: "statement", confidence: "statement",
    });
    await repository.put({
      market: "US", symbol: "SPY", name: "SPDR S&P 500 ETF Trust", assetType: "etf", source: "nasdaq", confidence: "official", resolvedAt: "2025-01-01T00:00:00.000Z",
    });
    expect(mergeExecutions).toHaveBeenCalledWith({
      instruments: [{ id: "US:SPY", market: "US", symbol: "SPY", name: "SPDR S&P 500 ETF Trust", currency: "USD" }],
      executions: [],
    });
  });
});
