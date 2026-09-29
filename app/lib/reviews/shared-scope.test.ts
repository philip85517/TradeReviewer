import { describe, expect, it } from "vitest";

import { filterEntriesBySharedScope, filterExecutionHistoryForEpisode, isCanonicalTradingViewSharedScope, normalizeSharedScope } from "./shared-scope";
import type { TradeLibraryEntry } from "../trades/library";
import type { TradeEpisode, TradeExecution } from "../trades/types";
import { TRADINGVIEW_CANONICAL_ACCOUNT_ID } from "../trades/tradingview-account-identity";

function entry(id: string, nature: "live" | "simulation" = "live", accountId = "a"): TradeLibraryEntry {
  const instrument = { id: `US:${id}`, symbol: id, name: id, market: "US", currency: "USD" };
  return {
    groupId: instrument.id, scopeKey: nature, tradeNature: nature, instrument, executions: [],
    episodes: [{ episode: { id, accountId, accountLabel: accountId, instrument, tradeNature: nature, direction: "long", status: "closed", startedAt: "2026-01-01T00:00:00Z", endedAt: "2026-01-02T00:00:00Z", openingQuantity: "1", remainingQuantity: "0", executions: [] }, metrics: { buyCount: 1, sellCount: 1, boughtQuantity: "1", soldQuantity: "1", grossExposure: "1", fees: "0", realizedPnl: "1", unrealizedPnl: "0", netPnl: "1", returnPercent: "1", holdingMilliseconds: 1 }, reviewStatus: "pending", confirmedTagIds: [], tagDictionaryVersion: 1, rMultiple: null }],
    accountCount: 1, tradeCount: 2, episodeCount: 1, firstTradeAt: "2026-01-01T00:00:00Z", lastTradeAt: "2026-01-02T00:00:00Z", status: "closed", netPnl: "1", returnPercent: "1", reviewedEpisodeCount: 0, confirmedTagIds: [], cumulativeR: null,
  };
}

function execution(id: string, accountId: string, run: string, platform = "tradingview", nature: "simulation" | "live" = "simulation"): TradeExecution {
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
    source: { platform, row: 1, tradeNature: nature, simulationRunId: run },
  };
}

describe("shared scope", () => {
  it("normalizes persisted values and filters by ledger nature/account", () => {
    const scope = normalizeSharedScope({ nature: "simulation", accountIds: ["a", "a", ""], reportCurrency: "CNY" });
    expect(scope).toEqual({ nature: "simulation", accountIds: ["a"], reportCurrency: "CNY", simulationRunId: null });
    expect(filterEntriesBySharedScope([entry("live"), entry("sim", "simulation")], scope)).toHaveLength(1);
  });

  it("preserves the persisted HKD report currency", () => {
    expect(normalizeSharedScope({ reportCurrency: "HKD" }).reportCurrency).toBe("HKD");
    expect(normalizeSharedScope({ reportCurrency: "EUR" }).reportCurrency).toBe("original");
  });

  it("projects matching episodes instead of leaking other accounts from the same instrument entry", () => {
    const original = entry("mixed", "live", "a");
    const other = { ...original.episodes[0], episode: { ...original.episodes[0].episode, id: "other", accountId: "b", accountLabel: "b" } };
    const mixed = { ...original, episodes: [original.episodes[0], other], executions: [] };
    const [projected] = filterEntriesBySharedScope([mixed], normalizeSharedScope({ nature: "live", accountIds: ["a"] }));
    expect(projected.episodes.map(({ episode }) => episode.id)).toEqual(["mixed"]);
    expect(projected.accountCount).toBe(1);
  });

  it("uses the canonical entry nature for legacy unknown episodes", () => {
    const original = entry("legacy", "live");
    const legacy = { ...original, episodes: [{ ...original.episodes[0], episode: { ...original.episodes[0].episode, tradeNature: "unknown" as const } }] };
    expect(filterEntriesBySharedScope([legacy], normalizeSharedScope({ nature: "live" })).map(item => item.episodes.length)).toEqual([1]);
  });

  it("keeps every TradingView source run in canonical episode history while retaining legacy run isolation", () => {
    const canonicalEpisode: TradeEpisode = {
      id: "canonical-episode",
      accountId: TRADINGVIEW_CANONICAL_ACCOUNT_ID,
      accountLabel: "TradingView · 模拟盘",
      instrument: { id: "US:SPY", symbol: "SPY", name: "SPY", market: "US", currency: "USD" },
      tradeNature: "simulation",
      direction: "long",
      status: "open",
      startedAt: "2026-09-01T00:00:00Z",
      openingQuantity: "1",
      remainingQuantity: "1",
      executions: [execution("canonical-r1", TRADINGVIEW_CANONICAL_ACCOUNT_ID, "run-1")],
    };
    const history = [
      execution("canonical-r1", TRADINGVIEW_CANONICAL_ACCOUNT_ID, "run-1"),
      execution("canonical-r2", TRADINGVIEW_CANONICAL_ACCOUNT_ID, "run-2"),
      execution("live-row", TRADINGVIEW_CANONICAL_ACCOUNT_ID, "live-run", "futu", "live"),
    ];
    expect(filterExecutionHistoryForEpisode(history, canonicalEpisode).map(item => item.id)).toEqual(["canonical-r1", "canonical-r2"]);

    const legacyEpisode = { ...canonicalEpisode, id: "legacy-episode", accountId: "legacy-account", accountLabel: "legacy-account", executions: [execution("legacy-r1", "legacy-account", "run-1", "futu")] };
    const legacyHistory = [
      execution("legacy-r1", "legacy-account", "run-1", "futu"),
      execution("legacy-r2", "legacy-account", "run-2", "futu"),
      execution("other-account", "other-account", "run-1", "futu"),
    ];
    expect(filterExecutionHistoryForEpisode(legacyHistory, legacyEpisode).map(item => item.id)).toEqual(["legacy-r1"]);
  });

  it("recognizes only the canonical TradingView account as a ready run-null cash scope", () => {
    expect(isCanonicalTradingViewSharedScope(normalizeSharedScope({ nature: "simulation", accountIds: [TRADINGVIEW_CANONICAL_ACCOUNT_ID], simulationRunId: null }))).toBe(true);
    expect(isCanonicalTradingViewSharedScope(normalizeSharedScope({ nature: "simulation", accountIds: [], simulationRunId: null }))).toBe(false);
    expect(isCanonicalTradingViewSharedScope(normalizeSharedScope({ nature: "simulation", accountIds: ["legacy"], simulationRunId: null }))).toBe(false);
  });
});
