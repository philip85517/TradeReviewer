import { describe, expect, it } from "vitest";

import { filterEntriesBySharedScope, normalizeSharedScope } from "./shared-scope";
import type { TradeLibraryEntry } from "../trades/library";

function entry(id: string, nature: "live" | "simulation" = "live", accountId = "a"): TradeLibraryEntry {
  const instrument = { id: `US:${id}`, symbol: id, name: id, market: "US", currency: "USD" };
  return {
    groupId: instrument.id, scopeKey: nature, tradeNature: nature, instrument, executions: [],
    episodes: [{ episode: { id, accountId, accountLabel: accountId, instrument, tradeNature: nature, direction: "long", status: "closed", startedAt: "2026-01-01T00:00:00Z", endedAt: "2026-01-02T00:00:00Z", openingQuantity: "1", remainingQuantity: "0", executions: [] }, metrics: { buyCount: 1, sellCount: 1, boughtQuantity: "1", soldQuantity: "1", grossExposure: "1", fees: "0", realizedPnl: "1", unrealizedPnl: "0", netPnl: "1", returnPercent: "1", holdingMilliseconds: 1 }, reviewStatus: "pending", confirmedTagIds: [], tagDictionaryVersion: 1, rMultiple: null }],
    accountCount: 1, tradeCount: 2, episodeCount: 1, firstTradeAt: "2026-01-01T00:00:00Z", lastTradeAt: "2026-01-02T00:00:00Z", status: "closed", netPnl: "1", returnPercent: "1", reviewedEpisodeCount: 0, confirmedTagIds: [], cumulativeR: null,
  };
}

describe("shared scope", () => {
  it("normalizes persisted values and filters by ledger nature/account", () => {
    const scope = normalizeSharedScope({ nature: "simulation", accountIds: ["a", "a", ""], reportCurrency: "CNY" });
    expect(scope).toEqual({ nature: "simulation", accountIds: ["a"], reportCurrency: "CNY", simulationRunId: null });
    expect(filterEntriesBySharedScope([entry("live"), entry("sim", "simulation")], scope)).toHaveLength(1);
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
});
