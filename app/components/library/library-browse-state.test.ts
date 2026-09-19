import { describe, expect, it } from "vitest";

import { buildInstrumentTradeSummaries } from "../../lib/trades/instruments";
import { buildTradeLibraryEntries } from "../../lib/trades/library";
import type { Instrument, TradeExecution } from "../../lib/trades/types";
import {
  DEFAULT_TRADE_LIBRARY_BROWSE_STATE,
  aggregateTradeLibraryStockDisplayEntries,
  aggregateTradeLibraryStocks,
  applyTradeNature,
  buildTradeLibraryBrowseRows,
  createTradeLibraryBrowseCache,
  normalizeTradeLibraryBrowseState,
  resetTradeLibraryBrowseState,
  reviewQueueFilterForBrowseState,
  tradeLibraryBrowseRangeKey,
} from "./library-browse-state";

const instrument: Instrument = {
  id: "US:TEST",
  symbol: "TEST",
  name: "测试股票",
  market: "US",
  currency: "USD",
};

function execution(
  side: "buy" | "sell",
  at: string,
  id: string,
  options: {
    accountId?: string;
    accountLabel?: string;
    tradeNature?: "live" | "simulation" | "unknown";
    simulationRunId?: string;
    platform?: string;
  } = {},
): TradeExecution {
  return {
    id,
    source: {
      platform: options.platform ?? "futu",
      row: 1,
      ...(options.tradeNature ? { tradeNature: options.tradeNature } : {}),
      ...(options.simulationRunId
        ? { simulationRunId: options.simulationRunId }
        : {}),
    },
    accountId: options.accountId ?? "account-live",
    accountLabel: options.accountLabel ?? "实盘账户",
    instrument,
    side,
    executedAt: at,
    quantity: "10",
    price: side === "buy" ? "10" : "12",
    fee: "1",
  };
}

function entriesFor(executions: TradeExecution[]) {
  return buildTradeLibraryEntries(
    buildInstrumentTradeSummaries(executions),
    {},
    {},
  );
}

describe("trade library browse state", () => {
  it("starts in live stock browsing with all rounds and newest execution ordering", () => {
    expect(DEFAULT_TRADE_LIBRARY_BROWSE_STATE).toMatchObject({
      mode: "stocks",
      tradeNature: "live",
      reviewStatus: "all",
      sort: "newest",
      market: "all",
      stockPage: 1,
      roundPage: 1,
    });
  });

  it("restores missing pagination fields at the first page", () => {
    const state = normalizeTradeLibraryBrowseState({
      mode: "queue",
      query: "XPEV",
      stockPage: 0,
      roundPage: -2,
    });

    expect(state.stockPage).toBe(1);
    expect(state.roundPage).toBe(1);
  });

  it("normalizes the previous queue state without dropping its persisted filters", () => {
    const state = normalizeTradeLibraryBrowseState({
      mode: "queue",
      query: "XPEV",
      market: "US",
      account: "acct-1",
      queueFilter: {
        status: "completed",
        nature: "simulation",
        simulationRunId: "run-1",
        sort: "oldest",
      },
    });

    expect(state).toMatchObject({
      mode: "queue",
      query: "XPEV",
      market: "US",
      account: "acct-1",
      accounts: ["acct-1"],
      tradeNature: "simulation",
      simulationRunId: "run-1",
      reviewStatus: "completed",
      sort: "oldest",
    });
  });

  it("filters episodes before aggregating stock rows", () => {
    const entries = entriesFor([
      execution("buy", "2025-01-02T00:00:00Z", "live-old-in"),
      execution("sell", "2025-01-03T00:00:00Z", "live-old-out"),
      execution("buy", "2026-01-02T00:00:00Z", "other-account-in", {
        accountId: "account-other",
        accountLabel: "其他账户",
      }),
      execution("sell", "2026-01-03T00:00:00Z", "other-account-out", {
        accountId: "account-other",
        accountLabel: "其他账户",
      }),
    ]);
    const state = {
      ...DEFAULT_TRADE_LIBRARY_BROWSE_STATE,
      accounts: ["account-live"],
      account: "account-live",
      year: "2025",
    };

    const rows = buildTradeLibraryBrowseRows(entries, state, {});
    const stocks = aggregateTradeLibraryStocks(rows);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.item.episode.accountId).toBe("account-live");
    expect(stocks).toHaveLength(1);
    expect(stocks[0]?.episodeCount).toBe(1);
    expect(stocks[0]?.tradeCount).toBe(2);
    expect(stocks[0]?.episodes[0]?.episode.accountId).toBe("account-live");
    expect(stocks[0]?.executions.every(fill => fill.accountId === "account-live")).toBe(true);
  });

  it("keeps stock display aggregation free of legacy financial totals", () => {
    const entries = entriesFor([
      execution("buy", "2025-01-02T00:00:00Z", "display-in"),
      execution("sell", "2025-01-03T00:00:00Z", "display-out"),
    ]);
    const rows = buildTradeLibraryBrowseRows(entries, DEFAULT_TRADE_LIBRARY_BROWSE_STATE, {});
    const legacy = aggregateTradeLibraryStocks(rows)[0];
    const display = aggregateTradeLibraryStockDisplayEntries(rows)[0];

    expect(display).toMatchObject({
      netPnl: null,
      returnPercent: null,
      episodeCount: legacy?.episodeCount,
      tradeCount: legacy?.tradeCount,
      firstTradeAt: legacy?.firstTradeAt,
      lastTradeAt: legacy?.lastTradeAt,
      cumulativeR: legacy?.cumulativeR,
    });
  });

  it("reuses range keys across navigation state and bounds the browse cache", () => {
    const base = DEFAULT_TRADE_LIBRARY_BROWSE_STATE;
    const revisited = {
      ...base,
      expandedStockIds: ["US:TEST"],
      includeReviewedStockIds: ["US:TEST"],
      selectedInstrumentId: "US:TEST|legacy",
      selectedEpisodeId: "episode-1",
      scrollTop: 480,
      stockPage: 3,
      roundPage: 2,
    };

    expect(tradeLibraryBrowseRangeKey(revisited)).toBe(tradeLibraryBrowseRangeKey(base));

    const cache = createTradeLibraryBrowseCache<string>(2);
    cache.set("first", "one");
    cache.set("second", "two");
    expect(cache.get("first")).toBe("one");
    cache.set("third", "three");
    expect(cache.get("second")).toBeUndefined();
    expect(cache.get("first")).toBe("one");
    expect(cache.get("third")).toBe("three");
  });

  it("infers legacy broker executions as live for stock labels", () => {
    const entries = entriesFor([
      execution("buy", "2025-01-02T00:00:00Z", "legacy-in", { platform: "futu" }),
      execution("sell", "2025-01-03T00:00:00Z", "legacy-out", { platform: "futu" }),
    ]);
    const rows = buildTradeLibraryBrowseRows(entries, DEFAULT_TRADE_LIBRARY_BROWSE_STATE, {});
    expect(rows).toHaveLength(1);
    expect(aggregateTradeLibraryStocks(rows)[0]?.tradeNature).toBe("live");
  });

  it("keeps an explicit unknown entry nature isolated from inferred execution nature", () => {
    const entries = entriesFor([
      execution("buy", "2025-01-02T00:00:00Z", "unknown-in", { platform: "futu" }),
      execution("sell", "2025-01-03T00:00:00Z", "unknown-out", { platform: "futu" }),
    ]);
    const entry = { ...entries[0]!, tradeNature: "unknown" as const };
    const row = { entry, item: entry.episodes[0]! };
    expect(aggregateTradeLibraryStocks([row])[0]?.tradeNature).toBe("unknown");
  });

  it("uses one shared filter when switching between queue and stock views", () => {
    const state = {
      ...DEFAULT_TRADE_LIBRARY_BROWSE_STATE,
      mode: "queue" as const,
      query: "TEST",
      market: "US",
      brokers: ["futu"],
      accounts: ["account-live"],
      account: "account-live",
      year: "2025",
      tradeNature: "live" as const,
      reviewStatus: "pending" as const,
      sort: "oldest" as const,
    };
    expect(reviewQueueFilterForBrowseState(state)).toMatchObject({
      query: "TEST",
      market: "US",
      brokers: ["futu"],
      accounts: ["account-live"],
      year: "2025",
      nature: "live",
      status: "pending",
      sort: "oldest",
    });
  });

  it("orders rounds by their latest execution when newest sorting is selected", () => {
    const entries = entriesFor([
      execution("buy", "2025-01-01T00:00:00Z", "old-start-in"),
      execution("sell", "2026-01-01T00:00:00Z", "old-start-late-out"),
      execution("buy", "2025-06-01T00:00:00Z", "recent-start-in", {
        accountId: "account-recent",
        accountLabel: "近期账户",
      }),
      execution("sell", "2025-06-02T00:00:00Z", "recent-start-out", {
        accountId: "account-recent",
        accountLabel: "近期账户",
      }),
    ]);
    const rows = buildTradeLibraryBrowseRows(entries, DEFAULT_TRADE_LIBRARY_BROWSE_STATE, {});

    expect(rows.map(row => row.item.episode.executions.at(-1)?.executedAt)).toEqual([
      "2026-01-01T00:00:00Z",
      "2025-06-02T00:00:00Z",
    ]);
  });

  it("reset preserves the current nature and view while restoring the full browse range", () => {
    const state = {
      ...DEFAULT_TRADE_LIBRARY_BROWSE_STATE,
      mode: "queue" as const,
      tradeNature: "simulation" as const,
      reviewStatus: "completed" as const,
      sort: "return-high" as const,
      query: "TEST",
      market: "US",
      brokers: ["tradingview"],
      accounts: ["account-sim"],
      account: "account-sim",
      year: "2025",
      simulationRunId: "run-1",
      positionStatus: "closed" as const,
      dataStatus: "incomplete" as const,
      tag: "pullback",
      stockPage: 4,
      roundPage: 7,
    };

    expect(resetTradeLibraryBrowseState(state)).toMatchObject({
      mode: "queue",
      tradeNature: "simulation",
      reviewStatus: "all",
      sort: "newest",
      query: "",
      market: "all",
      brokers: [],
      accounts: [],
      account: "all",
      year: "all",
      simulationRunId: "all",
      positionStatus: "all",
      dataStatus: "all",
      tag: "all",
      stockPage: 1,
      roundPage: 1,
    });
  });

  it("clears only source, account, and run filters incompatible with a nature switch", () => {
    const entries = entriesFor([
      execution("buy", "2025-01-02T00:00:00Z", "live-in", {
        accountId: "account-shared",
        accountLabel: "共享账户",
        tradeNature: "live",
        platform: "futu",
      }),
      execution("sell", "2025-01-03T00:00:00Z", "live-out", {
        accountId: "account-shared",
        accountLabel: "共享账户",
        tradeNature: "live",
        platform: "futu",
      }),
      execution("buy", "2025-02-02T00:00:00Z", "sim-in", {
        accountId: "account-sim",
        accountLabel: "模拟账户",
        tradeNature: "simulation",
        simulationRunId: "run-1",
        platform: "tradingview",
      }),
      execution("sell", "2025-02-03T00:00:00Z", "sim-out", {
        accountId: "account-sim",
        accountLabel: "模拟账户",
        tradeNature: "simulation",
        simulationRunId: "run-1",
        platform: "tradingview",
      }),
    ]);
    const state = {
      ...DEFAULT_TRADE_LIBRARY_BROWSE_STATE,
      tradeNature: "simulation" as const,
      brokers: ["tradingview", "futu"],
      accounts: ["account-sim", "account-shared"],
      account: "all",
      simulationRunId: "run-1",
    };

    const allNature = applyTradeNature(state, "all", entries);
    expect(allNature.state.simulationRunId).toBe("run-1");
    expect(allNature.cleared).not.toContain("模拟运行 run-1");

    const changed = applyTradeNature(state, "live", entries);

    expect(changed.state.tradeNature).toBe("live");
    expect(changed.state.brokers).toEqual(["futu"]);
    expect(changed.state.accounts).toEqual(["account-shared"]);
    expect(changed.state.simulationRunId).toBe("all");
    expect(changed.cleared).toEqual(
      expect.arrayContaining([
        expect.stringContaining("TradingView"),
        expect.stringContaining("account-sim"),
        expect.stringContaining("run-1"),
      ]),
    );
  });
});
