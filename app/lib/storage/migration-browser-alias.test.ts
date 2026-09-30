import { describe, expect, it } from "vitest";

import {
  mergeAuthoritativeReviewStates,
  readAliasedReviewStates,
  resolveSharedScopeWithAliases,
  writeCanonicalSharedScope,
} from "./migration-browser-alias";
import { sharedScopeStorageKey, sharedScopeV2StorageKey, type SharedScope } from "../reviews/shared-scope";
import { TRADINGVIEW_CANONICAL_ACCOUNT_ID } from "../trades/tradingview-account-identity";
import type { TradeExecution } from "../trades/types";
import type { EpisodeReviewState } from "./review-storage";
import type { TradingViewAccountMigrationAlias } from "./tradingview-account-migration-client";

const accountAlias = (oldId: string): TradingViewAccountMigrationAlias => ({
  operationId: "migration-1",
  kind: "account",
  oldId,
  newId: TRADINGVIEW_CANONICAL_ACCOUNT_ID,
});

const episodeAlias = (oldId: string, newId: string): TradingViewAccountMigrationAlias => ({
  operationId: "migration-1",
  kind: "episode",
  oldId,
  newId,
});

function execution(id: string, accountId: string, run: string, platform = "tradingview"): TradeExecution {
  return {
    id,
    accountId,
    accountLabel: accountId,
    instrument: { id: "US:SPY", symbol: "SPY", name: "SPY", market: "US", currency: "USD" },
    side: "buy",
    executedAt: "2026-09-01T00:00:00Z",
    quantity: "1",
    price: "10",
    fee: "0",
    source: { platform, row: 1, tradeNature: "simulation", simulationRunId: run },
  };
}

function reviewState(episodeId: string, replayCursor: string): EpisodeReviewState {
  return { version: 2, episodeId, replayCursor, timeframe: "1D", activePanelTab: "notes", drawings: [] };
}

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const values = new Map(Object.entries(initial));
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: key => values.get(key) ?? null,
    key: index => [...values.keys()][index] ?? null,
    removeItem: key => { values.delete(key); },
    setItem: (key, value) => { values.set(key, value); },
  } as Storage;
}

describe("migration browser aliases", () => {
  it("maps old TradingView accounts to one canonical account and clears only a proven source run", () => {
    const scope: SharedScope = {
      nature: "simulation",
      accountIds: ["tv-a", "tv-b", "tv-c", "tv-a"],
      reportCurrency: "CNY",
      simulationRunId: "run-1",
    };
    const aliases = [accountAlias("tv-a"), accountAlias("tv-b"), accountAlias("tv-c")];
    const resolved = resolveSharedScopeWithAliases(scope, aliases, [
      execution("a-1", "tv-a", "run-1"),
      execution("b-1", "tv-b", "run-2"),
      execution("c-1", "tv-c", "run-1"),
    ]);
    expect(resolved).toEqual({
      nature: "simulation",
      accountIds: [TRADINGVIEW_CANONICAL_ACCOUNT_ID],
      reportCurrency: "CNY",
      simulationRunId: null,
    });
  });

  it("preserves a legacy non-TradingView run when aliases do not prove it canonical", () => {
    const scope: SharedScope = { nature: "simulation", accountIds: ["futu"], reportCurrency: "original", simulationRunId: "legacy-run" };
    expect(resolveSharedScopeWithAliases(scope, [accountAlias("tv-a")], [execution("futu-1", "futu", "legacy-run", "futu")])).toEqual(scope);
  });

  it("keeps a shared run when the selected scope mixes a canonicalizable account with another legacy account", () => {
    const scope: SharedScope = { nature: "simulation", accountIds: ["tv-a", "legacy"], reportCurrency: "original", simulationRunId: "run-1" };
    expect(resolveSharedScopeWithAliases(scope, [accountAlias("tv-a")], [execution("tv-1", "tv-a", "run-1")])).toEqual({
      ...scope,
      accountIds: [TRADINGVIEW_CANONICAL_ACCOUNT_ID, "legacy"],
    });
  });

  it("maps an all-account TradingView run to the canonical account only when run provenance proves it", () => {
    const scope: SharedScope = { nature: "simulation", accountIds: [], reportCurrency: "original", simulationRunId: "run-1" };
    expect(resolveSharedScopeWithAliases(scope, [accountAlias("tv-a")], [execution("tv-1", "tv-a", "run-1")])).toEqual({
      nature: "simulation",
      accountIds: [TRADINGVIEW_CANONICAL_ACCOUNT_ID],
      reportCurrency: "original",
      simulationRunId: null,
    });
    expect(resolveSharedScopeWithAliases(scope, [accountAlias("tv-a")], [execution("legacy-1", "legacy", "run-1", "futu")])).toEqual(scope);
  });

  it("leaves the old scope untouched when the active alias response is empty", () => {
    const scope: SharedScope = { nature: "simulation", accountIds: ["tv-a"], reportCurrency: "HKD", simulationRunId: "run-1" };
    expect(resolveSharedScopeWithAliases(scope, [], [execution("a-1", "tv-a", "run-1")])).toEqual(scope);
  });

  it("maps browser review state by episode alias without replacing authoritative SQLite state", () => {
    const oldKey = "trade-reviewer:review:v2:old-episode";
    const storage = memoryStorage({
      "trade-reviewer:review:v1:old-episode": JSON.stringify(reviewState("old-episode", "legacy-browser-cursor")),
      [oldKey]: JSON.stringify(reviewState("old-episode", "browser-cursor")),
    });
    const browser = readAliasedReviewStates(storage, [episodeAlias("old-episode", "canonical-episode")]);
    expect(browser).toEqual([reviewState("canonical-episode", "browser-cursor")]);
    const merged = mergeAuthoritativeReviewStates(
      { "canonical-episode": reviewState("canonical-episode", "sqlite-cursor") },
      browser,
    );
    expect(merged["canonical-episode"]?.replayCursor).toBe("sqlite-cursor");
    expect(storage.getItem(oldKey)).not.toBeNull();
  });

  it("does not rehydrate unrelated browser review keys without an active episode alias", () => {
    const storage = memoryStorage({
      "trade-reviewer:review:v1:retired-v1": JSON.stringify(reviewState("retired-v1", "retired-v1-cursor")),
      "trade-reviewer:review:v2:retired-episode": JSON.stringify(reviewState("retired-episode", "retired-cursor")),
    });
    expect(readAliasedReviewStates(storage, [])).toEqual([]);
    expect(readAliasedReviewStates(storage, [episodeAlias("other-episode", "canonical-other")])).toEqual([]);
  });

  it("writes a separate canonical scope key and keeps the legacy key intact", () => {
    const storage = memoryStorage({ [sharedScopeStorageKey()]: JSON.stringify({ nature: "simulation", accountIds: ["tv-a"], simulationRunId: "run-1" }) });
    const scope: SharedScope = { nature: "simulation", accountIds: [TRADINGVIEW_CANONICAL_ACCOUNT_ID], reportCurrency: "original", simulationRunId: null };
    expect(writeCanonicalSharedScope(storage, scope)).toBe(true);
    expect(storage.getItem(sharedScopeStorageKey())).toContain("tv-a");
    expect(JSON.parse(storage.getItem(sharedScopeV2StorageKey())!)).toEqual(scope);
  });

  it("does not make SQLite hydration depend on a refused browser write", () => {
    const legacyKey = sharedScopeStorageKey();
    const storage = memoryStorage({ [legacyKey]: "legacy" });
    storage.setItem = () => { throw new Error("quota"); };
    expect(writeCanonicalSharedScope(storage, {
      nature: "simulation",
      accountIds: [TRADINGVIEW_CANONICAL_ACCOUNT_ID],
      reportCurrency: "original",
      simulationRunId: null,
    })).toBe(false);
    expect(storage.getItem(legacyKey)).toBe("legacy");
  });
});
