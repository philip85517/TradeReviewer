import "fake-indexeddb/auto";

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { DemoReplayFrame } from "../lib/demo/replay-frame";
import { sharedScopeStorageKey, sharedScopeV2StorageKey } from "../lib/reviews/shared-scope";
import type { StorageBootstrap } from "../lib/storage/sqlite-contracts";
import type { SqliteHttpClient } from "../lib/storage/sqlite-http-client";
import type { TradingViewAccountMigrationAlias } from "../lib/storage/tradingview-account-migration-client";
import type { TradingViewMigrationPreview } from "../lib/storage/tradingview-account-migration-contracts";
import type { TradeExecution } from "../lib/trades/types";
import { TradeReviewWorkspace } from "./trade-review-workspace";

const migrationClient = vi.hoisted(() => ({
  preview: vi.fn(),
  retryPreview: vi.fn(),
  commit: vi.fn(),
  retryCommit: vi.fn(),
  rollbackPreview: vi.fn(),
  retryRollbackPreview: vi.fn(),
  getActiveAliases: vi.fn(),
}));
vi.mock("../lib/storage/tradingview-account-migration-client", () => ({
  createTradingViewAccountMigrationClient: () => migrationClient,
}));

const frame: DemoReplayFrame = {
  cursorIndex: 0,
  cursor: "2026-09-18T14:30:00Z",
  candles15m: [{ time: "2026-09-18T14:30:00Z", open: 10, high: 11, low: 9, close: 10, volume: 100 }],
  executions: [],
  canGoBack: false,
  canGoForward: false,
};

const canonicalExecution: TradeExecution = {
  id: "tv-canonical-buy",
  source: { platform: "tradingview", row: 1, tradeNature: "simulation", simulationRunId: "source-run-1" },
  accountId: "tradingview:simulation:default",
  accountLabel: "TradingView · 模拟盘",
  instrument: { id: "US:SPY", symbol: "SPY", name: "SPY", market: "US", currency: "USD" },
  side: "buy",
  executedAt: "2026-09-18T14:30:00Z",
  quantity: "1",
  price: "10",
  fee: "0",
};

function bootstrap(): StorageBootstrap {
  return {
    schemaVersion: 1,
    migration: { sourceFingerprint: "sqlite", inserted: 0, duplicate: 0, conflict: 0, failed: 0, validationDigest: "digest" },
    executions: [canonicalExecution],
    importHistory: [],
    instruments: [],
    reviews: [],
    reviewStates: [],
    tagSuggestions: [],
    marketDataJobs: [],
    settings: {},
  };
}

function storageClient(): SqliteHttpClient {
  const value = bootstrap();
  return {
    getStatus: async () => ({ schemaVersion: value.schemaVersion, migration: value.migration, counts: {} }),
    getBootstrap: async () => value,
    migrate: async () => value.migration!,
    mergeExecutions: async () => ({ inserted: 0, duplicate: 0, conflict: 0 }),
    putReview: async record => record,
    putReviewState: async record => record,
    putTagSuggestion: async record => record,
    putSuggestionDecision: async input => input,
    getProviderSymbol: async () => undefined,
    getMarketData: async () => ({ candles: [], dailyCandles: [], intervalCoverage: [], coverage: [] }),
    putMarketData: async () => ({ ok: true }),
    putMarketDataJob: async job => job,
    getSettings: async () => ({ version: 1, showGrid: true, showVolume: true, showExecutions: true, showAverageCost: true, colorScheme: "teal-red" as const }),
    putSettings: async settings => settings,
  };
}

function aliases(): TradingViewAccountMigrationAlias[] {
  return [{ operationId: "migration-1", kind: "account", oldId: "tv-old", newId: "tradingview:simulation:default" }];
}

const migrationPreview = {
  operationId: "migration-1",
  status: "ready",
  canonicalAccountId: "tradingview:simulation:default",
  canonicalAccountLabel: "TradingView · 模拟盘",
  snapshotDigest: "snapshot",
  baseSnapshotDigest: "base",
  planDigest: "plan",
  counts: { executions: 1, oldAccounts: 1, sourceRuns: 1, instruments: 1, reviews: 0, recallRows: 0, settingsRows: 0, quantity: "1", fee: "0" },
  executionPlan: [],
  episodeMap: [],
  referencePlan: [],
  browserStatePlan: [],
  provisionalPrincipal: { action: "no-op", accountId: "tradingview:simulation:default", currency: "CNY", amount: "100000", asOf: null, status: "provisional", source: "user-default" },
  blockers: [],
  adapterBlockers: [],
  conservation: { executionIdsBefore: [], executionIdsAfter: [], executionIdsPreserved: true, sourceRunsBefore: [], sourceRunsAfter: [], sourceRunsPreserved: true, quantityBefore: "1", quantityAfter: "1", feeBefore: "0", feeAfter: "0" },
} as TradingViewMigrationPreview;

const migrationCommitResult = {
  operationId: "migration-1",
  status: "committed",
  affectedRows: 1,
  executionCount: 1,
  quantity: "1",
  fee: "0",
  episodeMap: [],
  idempotent: false,
} as const;

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("TradeReviewWorkspace alias recovery", () => {
  it("waits for aliases before restoring old scope and writes only the canonical preference key", async () => {
    let resolve!: (value: readonly TradingViewAccountMigrationAlias[]) => void;
    const loader = vi.fn(() => new Promise<readonly TradingViewAccountMigrationAlias[]>(done => { resolve = done; }));
    window.localStorage.setItem(sharedScopeStorageKey(), JSON.stringify({ nature: "simulation", accountIds: ["tv-old"], reportCurrency: "CNY", simulationRunId: "source-run-1" }));

    render(<TradeReviewWorkspace
      initialFrame={frame}
      showDemo={false}
      storageClient={storageClient()}
      legacyStateExporter={async () => null}
      activeAliasLoader={loader}
    />);

    await waitFor(() => expect(loader).toHaveBeenCalledOnce());
    expect(window.localStorage.getItem(sharedScopeV2StorageKey())).toBeNull();
    resolve(aliases());
    await waitFor(() => {
      expect(screen.getByRole("combobox", { name: "交易性质" })).toHaveValue("simulation");
      expect(screen.getByRole("combobox", { name: "账户范围" })).toHaveValue("tradingview:simulation:default");
      expect(screen.getByRole("combobox", { name: "报告计价" })).toHaveValue("CNY");
      expect(JSON.parse(window.localStorage.getItem(sharedScopeV2StorageKey())!)).toEqual({ nature: "simulation", accountIds: ["tradingview:simulation:default"], reportCurrency: "CNY", simulationRunId: null });
    });
    expect(window.localStorage.getItem(sharedScopeStorageKey())).toContain("tv-old");
  });

  it("keeps the old preference on alias failure and retries without treating failure as an empty alias response", async () => {
    const loader = vi.fn()
      .mockRejectedValueOnce(new Error("alias service offline"))
      .mockResolvedValueOnce(aliases());
    const oldPreference = JSON.stringify({ nature: "simulation", accountIds: ["tv-old"], reportCurrency: "original", simulationRunId: "source-run-1" });
    window.localStorage.setItem(sharedScopeStorageKey(), oldPreference);

    render(<TradeReviewWorkspace
      initialFrame={frame}
      showDemo={false}
      storageClient={storageClient()}
      legacyStateExporter={async () => null}
      activeAliasLoader={loader}
    />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("alias service offline");
    expect(window.localStorage.getItem(sharedScopeStorageKey())).toBe(oldPreference);
    expect(window.localStorage.getItem(sharedScopeV2StorageKey())).toBeNull();
    await screen.findByRole("button", { name: "重试账户范围恢复" });
  });

  it("passes a committed migration callback that reloads SQLite and active aliases", async () => {
    const client = storageClient();
    const getBootstrap = vi.spyOn(client, "getBootstrap");
    const loader = vi.fn().mockResolvedValue(aliases());
    migrationClient.getActiveAliases.mockResolvedValue({ aliases: [] });
    migrationClient.preview.mockResolvedValue(migrationPreview);
    migrationClient.commit.mockResolvedValue(migrationCommitResult);
    render(<TradeReviewWorkspace
      initialFrame={frame}
      showDemo={false}
      storageClient={client}
      legacyStateExporter={async () => null}
      activeAliasLoader={loader}
    />);

    await waitFor(() => expect(getBootstrap).toHaveBeenCalledOnce());
    await screen.getByText("读取只读预览", { selector: "button" }).click();
    await waitFor(() => expect(screen.getByText("1 条成交")).toBeInTheDocument());
    await screen.getByText("查看提交守卫", { selector: "button" }).click();
    await screen.getByText("确认提交归并", { selector: "button" }).click();
    await waitFor(() => {
      expect(getBootstrap).toHaveBeenCalledTimes(2);
      expect(loader).toHaveBeenCalledTimes(2);
    });
    expect(screen.getByText("归并已提交，页面数据已重新读取")).toBeInTheDocument();
  });

  it("keeps SQLite hydration available when private browser storage throws", async () => {
    const descriptor = Object.getOwnPropertyDescriptor(window, "localStorage");
    Object.defineProperty(window, "localStorage", { configurable: true, get: () => { throw new Error("storage disabled"); } });
    try {
      render(<TradeReviewWorkspace
        initialFrame={frame}
        showDemo={false}
        storageClient={storageClient()}
        legacyStateExporter={async () => null}
        activeAliasLoader={async () => []}
      />);
      await waitFor(() => expect(screen.getByRole("navigation", { name: "主导航" })).toBeInTheDocument());
    } finally {
      if (descriptor) Object.defineProperty(window, "localStorage", descriptor);
    }
  });
});
