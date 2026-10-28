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
    const { states: browser } = readAliasedReviewStates(storage, [episodeAlias("old-episode", "canonical-episode")]);
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
    expect(readAliasedReviewStates(storage, [])).toEqual({ states: [], conflicts: [] });
    expect(readAliasedReviewStates(storage, [episodeAlias("other-episode", "canonical-other")])).toEqual({ states: [], conflicts: [] });
  });

  it.each([
    { name: "empty aliases", aliases: [] },
    { name: "account aliases only", aliases: [accountAlias("tv-a")] },
  ])("does not access browser storage without an active episode alias ($name)", ({ aliases }) => {
    const storage = {
      get length(): number { throw new Error("Browser key enumeration is forbidden"); },
      key: (): string | null => { throw new Error("Browser key enumeration is forbidden"); },
      getItem: (): string | null => { throw new Error("Uncovered browser review reads are forbidden"); },
    };
    expect(readAliasedReviewStates(storage, aliases)).toEqual({ states: [], conflicts: [] });
  });

  it("reads only exact alias-covered review keys without enumerating or changing legacy data", () => {
    const persisted = {
      "trade-reviewer:review:v1:old-v1": JSON.stringify(reviewState("old-v1", "v1-cursor")),
      "trade-reviewer:review:v1:old-v2": JSON.stringify(reviewState("old-v2", "superseded-cursor")),
      "trade-reviewer:review:v2:old-v2": JSON.stringify(reviewState("old-v2", "v2-cursor")),
      "trade-reviewer:review:v2:unrelated": "unrelated-poison",
    };
    const backing = memoryStorage(persisted);
    const coveredKeys = new Set([
      "trade-reviewer:review:v1:old-v1", "trade-reviewer:review:v2:old-v1",
      "trade-reviewer:review:v1:current-v1", "trade-reviewer:review:v2:current-v1",
      "trade-reviewer:review:v1:old-v2", "trade-reviewer:review:v2:old-v2",
      "trade-reviewer:review:v1:current-v2", "trade-reviewer:review:v2:current-v2",
    ]);
    const storage = {
      get length(): number { throw new Error("Browser key enumeration is forbidden"); },
      key: (): string | null => { throw new Error("Browser key enumeration is forbidden"); },
      getItem: (key: string): string | null => {
        if (!coveredKeys.has(key)) throw new Error("Uncovered browser review reads are forbidden");
        return backing.getItem(key);
      },
    };
    const { states: browser, conflicts } = readAliasedReviewStates(storage, [
      episodeAlias("old-v1", "current-v1"),
      episodeAlias("old-v2", "current-v2"),
    ]);
    expect(conflicts).toEqual([]);
    expect(browser).toEqual([
      reviewState("current-v1", "v1-cursor"),
      reviewState("current-v2", "v2-cursor"),
    ]);
    expect(mergeAuthoritativeReviewStates({ "current-v2": reviewState("current-v2", "sqlite-cursor") }, browser))
      .toEqual({ "current-v1": reviewState("current-v1", "v1-cursor"), "current-v2": reviewState("current-v2", "sqlite-cursor") });
    for (const [key, value] of Object.entries(persisted)) expect(backing.getItem(key)).toBe(value);
    expect(backing.length).toBe(Object.keys(persisted).length);
  });

  it("writes a separate canonical scope key and keeps the legacy key intact", () => {
    const storage = memoryStorage({ [sharedScopeStorageKey()]: JSON.stringify({ nature: "simulation", accountIds: ["tv-a"], simulationRunId: "run-1" }) });
    const scope: SharedScope = { nature: "simulation", accountIds: [TRADINGVIEW_CANONICAL_ACCOUNT_ID], reportCurrency: "original", simulationRunId: null };
    expect(writeCanonicalSharedScope(storage, scope)).toBe(true);
    expect(storage.getItem(sharedScopeStorageKey())).toContain("tv-a");
    expect(JSON.parse(storage.getItem(sharedScopeV2StorageKey())!)).toEqual(scope);
  });

  it("pauses only conflicting browser episodes, reports every source key, and preserves all bytes", () => {
    const persisted = {
      "trade-reviewer:review:v2:old-a": JSON.stringify(reviewState("old-a", "cursor-a")),
      "trade-reviewer:review:v2:old-b": JSON.stringify(reviewState("old-b", "cursor-b")),
      "trade-reviewer:review:v2:canonical": JSON.stringify(reviewState("canonical", "canonical-cursor")),
      "trade-reviewer:review:v2:other-old": JSON.stringify(reviewState("other-old", "other-cursor")),
      "trade-reviewer:review:v2:uncovered": "uncovered-poison",
    };
    const aliases = [episodeAlias("old-a", "canonical"), episodeAlias("old-b", "canonical"), episodeAlias("other-old", "other")];
    const storage = memoryStorage(persisted);
    const expected = {
      states: [reviewState("other", "other-cursor")],
      conflicts: [{ episodeId: "canonical", sourceKeys: [
        "trade-reviewer:review:v2:canonical", "trade-reviewer:review:v2:old-a", "trade-reviewer:review:v2:old-b",
      ] }],
    };
    expect(readAliasedReviewStates(storage, aliases)).toEqual(expected);
    expect(readAliasedReviewStates(storage, [...aliases].reverse())).toEqual(expected);
    for (const [key, value] of Object.entries(persisted)) expect(storage.getItem(key)).toBe(value);
    expect(storage.length).toBe(Object.keys(persisted).length);
  });

  it.each([[1, 2], [2, 1]] as const)("pauses different episode names across v%s/v%s instead of treating format as recency", (oldVersion, canonicalVersion) => {
    const bytes = (episodeId: string, cursor: string, version: 1 | 2) => JSON.stringify(version === 1
      ? { version: 1, replayCursor: cursor, timeframe: "1D", thesis: "", drawings: [] }
      : { ...reviewState(episodeId, cursor), activePanelTab: "stats" });
    const oldKey = `trade-reviewer:review:v${oldVersion}:old`;
    const canonicalKey = `trade-reviewer:review:v${canonicalVersion}:canonical`;
    const persisted = { [oldKey]: bytes("old", "A", oldVersion), [canonicalKey]: bytes("canonical", "B", canonicalVersion) };
    const storage = memoryStorage(persisted);
    const aliases = [episodeAlias("old", "canonical"), episodeAlias("other-old", "other")];
    const expected = { states: [], conflicts: [{ episodeId: "canonical", sourceKeys: [canonicalKey, oldKey].sort() }] };
    expect(readAliasedReviewStates(storage, aliases)).toEqual(expected);
    expect(readAliasedReviewStates(storage, [...aliases].reverse())).toEqual(expected);
    for (const [key, value] of Object.entries(persisted)) expect(storage.getItem(key)).toBe(value);
  });

  it.each([[1, 2], [2, 1]] as const)("accepts equal normalized business content across v%s/v%s names", (oldVersion, canonicalVersion) => {
    const bytes = (episodeId: string, version: 1 | 2) => JSON.stringify(version === 1
      ? { version: 1, replayCursor: "same", timeframe: "1D", thesis: "", drawings: [] }
      : { ...reviewState(episodeId, "same"), activePanelTab: "stats" });
    const storage = memoryStorage({
      [`trade-reviewer:review:v${oldVersion}:old`]: bytes("old", oldVersion),
      [`trade-reviewer:review:v${canonicalVersion}:canonical`]: bytes("canonical", canonicalVersion),
    });
    const result = readAliasedReviewStates(storage, [episodeAlias("old", "canonical")]);
    expect(result.conflicts).toEqual([]);
    expect(result.states).toHaveLength(1);
    expect(result.states[0]).toMatchObject({ ...reviewState("canonical", "same"), activePanelTab: "stats" });
  });

  it("restores identical same-version content without reporting a conflict", () => {
    const old = reviewState("old", "same-cursor");
    const canonical = reviewState("canonical", "same-cursor");
    const storage = memoryStorage({
      "trade-reviewer:review:v2:old": JSON.stringify(old),
      // JSON property order and the alias-owned episode identity are not user content differences.
      "trade-reviewer:review:v2:canonical": JSON.stringify(Object.fromEntries(Object.entries(canonical).reverse())),
    });
    expect(readAliasedReviewStates(storage, [episodeAlias("old", "canonical")]))
      .toEqual({ states: [canonical], conflicts: [] });
  });

  it("uses the same-name current-key compatibility copy and falls back only when it is invalid", () => {
    const legacy = JSON.stringify({ version: 1, replayCursor: "legacy", timeframe: "1D", thesis: "preserved legacy text", drawings: [] });
    const current = JSON.stringify({ ...reviewState("old", "current"), activePanelTab: "stats" });
    const storage = memoryStorage({ "trade-reviewer:review:v1:old": legacy, "trade-reviewer:review:v2:old": current });
    const aliases = [episodeAlias("old", "canonical")];
    expect(readAliasedReviewStates(storage, aliases)).toEqual({ states: [{ ...reviewState("canonical", "current"), activePanelTab: "stats" }], conflicts: [] });
    expect(storage.getItem("trade-reviewer:review:v1:old")).toBe(legacy);
    expect(storage.getItem("trade-reviewer:review:v2:old")).toBe(current);
    const invalidCurrent = memoryStorage({ "trade-reviewer:review:v1:old": legacy, "trade-reviewer:review:v2:old": "invalid JSON" });
    expect(readAliasedReviewStates(invalidCurrent, aliases)).toEqual({ states: [{ ...reviewState("canonical", "legacy"), activePanelTab: "stats", legacyThesis: "preserved legacy text" }], conflicts: [] });
    expect(invalidCurrent.getItem("trade-reviewer:review:v1:old")).toBe(legacy);
    expect(invalidCurrent.getItem("trade-reviewer:review:v2:old")).toBe("invalid JSON");
  });

  it("does not report browser conflicts for an episode with authoritative SQLite state", () => {
    const storage = memoryStorage({
      "trade-reviewer:review:v2:old": JSON.stringify(reviewState("old", "old-cursor")),
      "trade-reviewer:review:v2:canonical": JSON.stringify(reviewState("canonical", "canonical-cursor")),
    });
    const sqlite = { canonical: reviewState("canonical", "sqlite-cursor") };
    const resolved = readAliasedReviewStates(storage, [episodeAlias("old", "canonical")], sqlite);
    expect(resolved).toEqual({ states: [], conflicts: [] });
    expect(mergeAuthoritativeReviewStates(sqlite, resolved.states)).toEqual(sqlite);
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
