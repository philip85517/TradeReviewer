import { describe, expect, it } from "vitest";
import { buildInstrumentTradeSummaries } from "../../../../../app/lib/trades/instruments";
import { buildTradeLibraryEntries } from "../../../../../app/lib/trades/library";
import { tradeNatureOf, type TradeExecution, type TradeNature } from "../../../../../app/lib/trades/types";
import { DEFAULT_SHARED_SCOPE, filterEntriesBySharedScope } from "../../../../../app/lib/reviews/shared-scope";
import { explicitLiveEntries } from "../../../../../app/components/homepage-v25/holdings-model";

function observation(platform: "tiger" | "futu", nature?: TradeNature) {
  const fill: TradeExecution = {
    id: `peer-${platform}-${nature ?? "absent"}`,
    instrument: { id: "HK:9868", symbol: "9868", name: "小鹏汽车", market: "HK", currency: "HKD" },
    accountId: "acct", accountLabel: "历史账户",
    source: { platform, row: 1, ...(nature ? { tradeNature: nature } : {}) },
    executedAt: "2026-09-10T02:00:00Z", side: "buy", quantity: "10", price: "10", fee: "0",
  };
  const entries = buildTradeLibraryEntries(buildInstrumentTradeSummaries([fill]), {}, {});
  const counts = (strict: boolean) => Object.fromEntries((["live", "simulation", "unknown"] as const).map(selectedNature => [selectedNature,
    filterEntriesBySharedScope(strict && selectedNature === "live" ? explicitLiveEntries(entries) : entries,
      { ...DEFAULT_SHARED_SCOPE, nature: selectedNature }).length]));
  return { platform, sourceNature: fill.source.tradeNature ?? "absent", canonicalNature: tradeNatureOf(fill),
    episodeNature: entries[0].episodes[0].episode.tradeNature, entryNature: entries[0].tradeNature,
    headScopeCounts: counts(false), freeze1ScopeCounts: counts(true) };
}

describe("independent nature reachability diagnosis, frozen explicit-live boundary", () => {
  it.each(["tiger", "futu"] as const)("proves the historical %s row disappears from every ordinary-library nature choice", platform => {
    const actual = observation(platform);
    console.log("NATURE_OBSERVATION", JSON.stringify(actual));
    expect(actual).toMatchObject({ sourceNature: "absent", canonicalNature: "unknown", episodeNature: "unknown", entryNature: "live",
      headScopeCounts: { live: 1, simulation: 0, unknown: 0 }, freeze1ScopeCounts: { live: 0, simulation: 0, unknown: 0 } });
  });
  it.each(["live", "unknown"] as const)("keeps the explicit %s control distinguishable from absent evidence", nature => {
    const actual = observation("futu", nature);
    console.log("NATURE_OBSERVATION", JSON.stringify(actual));
    expect(actual.canonicalNature).toBe(nature);
    expect(actual.episodeNature).toBe(nature);
    expect(actual.entryNature).toBe(nature);
    expect(actual.freeze1ScopeCounts[nature]).toBe(1);
  });
});
