import { describe, expect, it, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";

import { initializeSqlite } from "../../../db/sqlite";
import type { SqliteHttpClient } from "./sqlite-http-client";
import { instrumentPresentation } from "../instruments/instrument-presentation";
import {
  ApiEpisodeReviewRepository,
  ApiInstrumentMetadataRepository,
  ApiMarketDataRepository,
  ApiTagSuggestionRepository,
} from "./sqlite-repositories";
import { SqliteStore } from "./sqlite-store";

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

  it("keeps daily-only candles and provider-symbol lookups distinct from generic candles", async () => {
    const getMarketData = vi.fn().mockResolvedValue({
      candles: [{ interval: "1D", timestamp: "2025-01-02T00:00:00.000Z", close: "99" }],
      dailyCandles: [{ tradingDate: "2025-01-02", close: "10" }],
      intervalCoverage: [],
    });
    const getProviderSymbol = vi.fn().mockResolvedValue("hk00700");
    const repository = new ApiMarketDataRepository(client({ getMarketData, getProviderSymbol }));

    await expect(repository.getDailyCandles("HK:700", "2025-01-01", "2025-01-31")).resolves.toEqual([
      { tradingDate: "2025-01-02", close: "10" },
    ]);
    await expect(repository.getProviderSymbol("HK:700", "tencent")).resolves.toBe("hk00700");
    expect(getMarketData).toHaveBeenCalledWith({
      instrumentId: "HK:700", interval: "1D", start: "2025-01-01T00:00:00.000Z", end: "2025-01-31T23:59:59.999Z", dailyOnly: true,
    });
    expect(getProviderSymbol).toHaveBeenCalledWith("HK:700", "tencent");
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

  it("round-trips complete resolved metadata through persisted instruments", async () => {
    const mergeExecutions = vi.fn().mockResolvedValue({ inserted: 0, duplicate: 0, conflict: 0 });
    const getBootstrap = vi.fn().mockResolvedValue({
      instruments: [{
        id: "HK:700", market: "HK", symbol: "700", name: "腾讯", currency: "HKD",
        metadata: { market: "HK", symbol: "700", name: "腾讯", assetType: "stock", source: "hkex", confidence: "official", resolvedAt: "2025-01-01T00:00:00.000Z" },
      }],
    });
    const repository = new ApiInstrumentMetadataRepository(client({ getBootstrap, mergeExecutions }));

    await expect(repository.get("HK:700")).resolves.toMatchObject({
      market: "HK", symbol: "700", name: "腾讯", source: "hkex", confidence: "official", resolvedAt: "2025-01-01T00:00:00.000Z",
    });
    await repository.put({
      market: "US", symbol: "SPY", name: "SPDR S&P 500 ETF Trust", assetType: "etf", source: "nasdaq", confidence: "official", resolvedAt: "2025-01-01T00:00:00.000Z",
    });
    expect(mergeExecutions).toHaveBeenCalledWith({
      instruments: [{ id: "US:SPY", market: "US", symbol: "SPY", name: "SPDR S&P 500 ETF Trust", currency: "USD", metadata: { market: "US", symbol: "SPY", name: "SPDR S&P 500 ETF Trust", assetType: "etf", source: "nasdaq", confidence: "official", resolvedAt: "2025-01-01T00:00:00.000Z" } }],
      executions: [],
    });
  });

  it("keeps an existing instrument name and localized overlay during metadata refresh", async () => {
    const mergeExecutions = vi.fn().mockResolvedValue({ inserted: 0, duplicate: 0, conflict: 0 });
    const localizedName = {
      name: "旧中文名",
      locale: "zh-CN" as const,
      source: "tencent",
      resolvedAt: "2025-01-01T00:00:00.000Z",
    };
    const getBootstrap = vi.fn().mockResolvedValue({
      instruments: [{
        id: "US:AAPL",
        market: "US",
        symbol: "AAPL",
        name: "历史名称",
        currency: "USD",
        localizedName,
        metadata: {
          market: "US",
          symbol: "AAPL",
          name: "历史名称",
          localizedName,
          assetType: "stock",
          source: "nasdaq",
          confidence: "official",
          resolvedAt: "2025-01-01T00:00:00.000Z",
        },
      }],
    });
    const repository = new ApiInstrumentMetadataRepository(client({ getBootstrap, mergeExecutions }));

    await repository.put({
      market: "US",
      symbol: "AAPL",
      name: "Apple Inc.",
      assetType: "stock",
      source: "nasdaq",
      confidence: "official",
      resolvedAt: "2025-02-01T00:00:00.000Z",
    });

    expect(mergeExecutions).toHaveBeenCalledWith({
      instruments: [{
        id: "US:AAPL",
        market: "US",
        symbol: "AAPL",
        name: "历史名称",
        currency: "USD",
        localizedName,
        metadata: {
          market: "US",
          symbol: "AAPL",
          name: "Apple Inc.",
          localizedName,
          assetType: "stock",
          source: "nasdaq",
          confidence: "official",
          resolvedAt: "2025-02-01T00:00:00.000Z",
        },
      }],
      executions: [],
    });
  });

  it("replaces the persisted overlay consistently on successive metadata refreshes", async () => {
    const database = new DatabaseSync(":memory:");
    initializeSqlite(database);
    const store = new SqliteStore(database);
    const original = {
      id: "US:AAPL",
      market: "US",
      symbol: "AAPL",
      name: "Historical Apple",
      currency: "USD",
    };
    store.mergeTradeData({ instruments: [original], executions: [] });
    const api = client({
      getBootstrap: vi.fn(async () => store.getBootstrap()),
      mergeExecutions: vi.fn(async (input) => store.mergeTradeData(input)),
    });
    const repository = new ApiInstrumentMetadataRepository(api);
    const first = {
      market: "US" as const,
      symbol: "AAPL",
      name: "Apple Inc.",
      localizedName: {
        name: "旧中文名",
        locale: "zh-CN" as const,
        source: "tencent",
        resolvedAt: "2026-01-01T00:00:00.000Z",
      },
      assetType: "stock" as const,
      source: "nasdaq" as const,
      confidence: "official" as const,
      resolvedAt: "2026-01-01T00:00:00.000Z",
    };
    const second = {
      ...first,
      localizedName: {
        name: "新中文名",
        locale: "zh-CN" as const,
        source: "tencent-refresh",
        resolvedAt: "2026-02-01T00:00:00.000Z",
      },
      resolvedAt: "2026-02-01T00:00:00.000Z",
    };

    await repository.put(first);
    await repository.put(second);

    const persisted = store.getBootstrap().instruments[0];
    expect(persisted).toMatchObject({
      name: "Historical Apple",
      localizedName: second.localizedName,
      metadata: {
        name: "Apple Inc.",
        localizedName: second.localizedName,
        resolvedAt: "2026-02-01T00:00:00.000Z",
      },
    });
    expect(instrumentPresentation(persisted!).primaryName).toBe("新中文名");
    database.close();
  });

  it("preserves the latest overlay when saving an economic edit from an old display snapshot", async () => {
    const database = new DatabaseSync(":memory:");
    initializeSqlite(database);
    const store = new SqliteStore(database);
    const original = {
      id: "US:AAPL",
      market: "US" as const,
      symbol: "AAPL",
      name: "Historical Apple",
      currency: "USD",
    };
    const execution = {
      id: "trade-1",
      instrument: original,
      accountId: "account-1",
      accountLabel: "账户",
      source: { platform: "tiger", row: 1 },
      side: "buy" as const,
      executedAt: "2026-01-02T00:00:00.000Z",
      quantity: "10",
      price: "88",
      fee: "0",
    };
    store.mergeTradeData({ instruments: [original], executions: [execution] });
    const api = client({
      getBootstrap: vi.fn(async () => store.getBootstrap()),
      mergeExecutions: vi.fn(async (input) => store.mergeTradeData(input)),
    });
    const repository = new ApiInstrumentMetadataRepository(api);
    const oldMetadata = {
      market: "US" as const,
      symbol: "AAPL",
      name: "Apple Inc.",
      localizedName: {
        name: "旧中文名",
        locale: "zh-CN" as const,
        source: "tencent",
        resolvedAt: "2026-01-01T00:00:00.000Z",
      },
      assetType: "stock" as const,
      source: "nasdaq" as const,
      confidence: "official" as const,
      resolvedAt: "2026-01-01T00:00:00.000Z",
    };
    const latestMetadata = {
      ...oldMetadata,
      localizedName: {
        name: "最新中文名称",
        locale: "zh-CN" as const,
        source: "tencent-refresh",
        resolvedAt: "2026-02-01T00:00:00.000Z",
      },
      resolvedAt: "2026-02-01T00:00:00.000Z",
    };

    await repository.put(oldMetadata);
    const before = store.getExecutions()[0]!;
    await repository.put(latestMetadata);
    store.reviseTrades({
      id: "save-after-refresh",
      instrumentId: original.id,
      accountId: execution.accountId,
      reason: "修正成交价",
      changes: [{
        before,
        after: { ...before, price: "90" },
      }],
    });

    const persisted = store.getBootstrap().instruments[0]!;
    expect(store.getExecutions()[0]?.price).toBe("90");
    expect(persisted.localizedName).toEqual(latestMetadata.localizedName);
    expect(persisted.metadata?.localizedName).toEqual(latestMetadata.localizedName);
    database.close();
  });
});
