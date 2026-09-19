import { describe, expect, it } from "vitest";

import type { TradeLibraryEntry } from "../../lib/trades/library";
import {
  buildLibraryFilterOptions,
  formatBrokerLabel,
  formatSimulationRunLabel,
  normalizeBrokerId,
  normalizeBrokerIds,
  shortStableId,
} from "./library-filter-options";

function entry(overrides: Partial<TradeLibraryEntry> = {}): TradeLibraryEntry {
  const instrument = {
    id: "US:ABC",
    market: "US",
    symbol: "ABC",
    name: "Alpha Beta",
    currency: "USD",
  } as TradeLibraryEntry["instrument"];
  const execution = {
    id: "fill-1",
    accountId: "account-a",
    accountLabel: "共享账户",
    instrument,
    source: { platform: "futu", row: 1, tradingDate: "2026-01-02" },
    side: "buy" as const,
    executedAt: "2026-01-02T15:00:00.000Z",
    quantity: "1",
    price: "10",
    fee: "0",
  } as TradeLibraryEntry["executions"][number];
  const episode = {
    episode: {
      id: "episode-1",
      instrument,
      executions: [execution],
      accountId: execution.accountId,
      accountLabel: execution.accountLabel,
      startedAt: execution.executedAt,
      status: "open" as const,
      direction: "long" as const,
      openingQuantity: "1",
      remainingQuantity: "1",
      tradeNature: "simulation" as const,
      simulationRunId: "tradingview:source:US:ABC:long-run-id",
    },
    metrics: {} as TradeLibraryEntry["episodes"][number]["metrics"],
    reviewStatus: "pending" as const,
    confirmedTagIds: ["breakout"],
    tagDictionaryVersion: 1,
    rMultiple: null,
  } as TradeLibraryEntry["episodes"][number];
  return {
    groupId: "US:ABC|simulation",
    tradeNature: "simulation",
    simulationRunId: "tradingview:source:US:ABC:long-run-id",
    instrument,
    executions: [execution],
    episodes: [episode],
    accountCount: 1,
    tradeCount: 1,
    episodeCount: 1,
    firstTradeAt: execution.executedAt,
    lastTradeAt: execution.executedAt,
    status: "open",
    netPnl: null,
    returnPercent: null,
    reviewedEpisodeCount: 0,
    confirmedTagIds: ["breakout"],
    cumulativeR: null,
    ...overrides,
  };
}

describe("library filter option formatting", () => {
  it("uses readable, stable source platform labels", () => {
    expect(formatBrokerLabel("china-merchants")).toBe("招商证券");
    expect(formatBrokerLabel("tradingview")).toBe("TradingView");
    expect(formatBrokerLabel("unknown-platform")).toBe("unknown-platform");
  });

  it("canonicalizes source aliases before building filter IDs", () => {
    expect(normalizeBrokerId("TradingView")).toBe("tradingview");
    expect(normalizeBrokerId("china_merchants")).toBe("china-merchants");
    expect(normalizeBrokerId("CMB")).toBe("china-merchants");
    expect(normalizeBrokerIds(["TradingView", "tradingview", "CMB"])).toEqual([
      "tradingview",
      "china-merchants",
    ]);

    const first = entry();
    const aliases = entry({
      executions: [
        { ...first.executions[0], id: "fill-tradingview", source: { ...first.executions[0].source, platform: "TradingView" } },
        { ...first.executions[0], id: "fill-tradingview-2", source: { ...first.executions[0].source, platform: "tradingview" } },
        { ...first.executions[0], id: "fill-cmb", source: { ...first.executions[0].source, platform: "CMB" } },
      ],
      episodes: [],
    });
    expect(buildLibraryFilterOptions([aliases]).brokers).toEqual([
      { id: "china-merchants", label: "招商证券" },
      { id: "tradingview", label: "TradingView" },
    ]);
  });

  it("shortens run identities without exposing full hashes", () => {
    expect(shortStableId("tradingview:2026-very-long-opaque-run-id")).toHaveLength(4);
    expect(formatSimulationRunLabel("tradingview:2026-very-long-opaque-run-id", {
      instrumentName: "Alpha Beta",
      symbol: "ABC",
    })).toMatch(/^Alpha Beta（ABC） · /);
    expect(formatSimulationRunLabel("tradingview:2026-very-long-opaque-run-id", {
      instrumentName: "Alpha Beta",
      symbol: "ABC",
    })).not.toContain("tradingview:2026-very-long-opaque-run-id");
  });

  it("keeps runs with a common suffix distinguishable", () => {
    expect(shortStableId("run-aa-common-suffix")).not.toBe(
      shortStableId("run-bb-common-suffix"),
    );
  });

  it("deduplicates same-label accounts with stable ID suffixes and keeps OR options", () => {
    const first = entry();
    const second = entry({
      executions: [{ ...first.executions[0], id: "fill-2", accountId: "account-z" }],
      episodes: [{ ...first.episodes[0], episode: { ...first.episodes[0].episode, id: "episode-2", accountId: "account-z", executions: [{ ...first.executions[0], id: "fill-2", accountId: "account-z" }] } }],
    });
    const options = buildLibraryFilterOptions([first, second]);

    expect(options.accounts).toEqual([
      { id: "account-a", label: "共享账户（账户1）" },
      { id: "account-z", label: "共享账户（账户2）" },
    ]);
    expect(options.brokers).toEqual([{ id: "futu", label: "富途" }]);
    expect(options.simulationRuns).toHaveLength(1);
    expect(options.years).toEqual([{ id: "2026", label: "2026 年" }]);
    expect(options.tags).toEqual([{ id: "breakout", label: "突破" }]);
  });
});
