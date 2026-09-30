import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";

import { buildInstrumentTradeSummaries } from "../trades/instruments";
import { buildTradeLibraryEntries, type TradeLibraryEntry } from "../trades/library";
import { TRADINGVIEW_CANONICAL_ACCOUNT_ID, tradingViewEpisodeBusinessScope } from "../trades/tradingview-account-identity";
import type { TradeExecution } from "../trades/types";
import { buildDashboardModel } from "./dashboard";
import { buildGlobalNotifications, searchGlobalInstruments } from "./trading-room-global-entries";
import { buildHoldingsHistory } from "./trading-room-history";
import { summarizeLibraryPerformance } from "./library-performance";
import { filterEntriesBySharedScope } from "./shared-scope";
import { buildRoomDateRange, filterRoomRows } from "./trading-room-scope";
import { reviewScopeOptions } from "./review-summary";
import type { ReviewQueueItem } from "./review-queue";

const instrument = {
  id: "CN-SH:600330",
  symbol: "600330",
  name: "测试标的",
  market: "CN-SH",
  currency: "CNY",
};

function execution(
  id: string,
  side: "buy" | "sell",
  run: string,
  executedAt: string,
): TradeExecution {
  return {
    id,
    accountId: TRADINGVIEW_CANONICAL_ACCOUNT_ID,
    accountLabel: "TradingView · 模拟盘",
    instrument,
    side,
    executedAt,
    quantity: "10",
    price: side === "buy" ? "10" : "12",
    fee: "0",
    source: {
      platform: "tradingview",
      row: side === "buy" ? 1 : 2,
      tradeNature: "simulation",
      simulationRunId: run,
      tradingDate: executedAt.slice(0, 10),
    },
  };
}

function canonicalEntry(): TradeLibraryEntry {
  return buildTradeLibraryEntries(
    buildInstrumentTradeSummaries([
      execution("buy-a", "buy", "run-a", "2026-01-02T01:00:00.000Z"),
      execution("sell-b", "sell", "run-b", "2026-01-03T01:00:00.000Z"),
    ]),
    {},
    {},
  )[0]!;
}

function canonicalScope() {
  return {
    nature: "simulation" as const,
    accountIds: [TRADINGVIEW_CANONICAL_ACCOUNT_ID],
    simulationRunId: null,
  };
}

/**
 * The migration snapshot is intentionally kept read-only, so this fixture
 * mirrors its contract without depending on the business database. There
 * are 32 rounds across four instruments and 82 fills; one round crosses
 * source runs to prove that source provenance does not become a business
 * boundary.
 */
function canonicalPortfolioExecutions(): TradeExecution[] {
  const instruments = [
    { ...instrument, id: "CN-SH:600330", symbol: "600330" },
    { ...instrument, id: "CN-SH:600869", symbol: "600869" },
    { ...instrument, id: "CN-SH:600737", symbol: "600737" },
    { ...instrument, id: "CN-SH:300857", symbol: "300857" },
  ];
  const runs = ["run-a", "run-b", "run-c", "run-d"];
  const extraFillRounds = [5, 5, 4, 4];
  const executions: TradeExecution[] = [];
  let fillIndex = 0;
  for (const [instrumentIndex, currentInstrument] of instruments.entries()) {
    for (let round = 0; round < 8; round += 1) {
      const quantity = instrumentIndex === 0 && round === 0 ? "10000" : "8000";
      const extraFill = round < extraFillRounds[instrumentIndex];
      const quantities = extraFill
        ? [new Decimal(quantity).div(2).toString(), new Decimal(quantity).div(2).toString(), quantity]
        : [quantity, quantity];
      const sides: Array<"buy" | "sell"> = extraFill
        ? ["buy", "buy", "sell"]
        : ["buy", "sell"];
      for (const [leg, side] of sides.entries()) {
        const executedAt = new Date(Date.UTC(2026, 0, 1 + instrumentIndex * 40 + round * 3 + leg)).toISOString();
        const run = instrumentIndex === 0 && round === 0 && leg === 0
          ? runs[0]
          : instrumentIndex === 0 && round === 0 && leg > 0
            ? runs[1]
            : runs[(instrumentIndex + round + leg) % runs.length];
        executions.push({
          id: `canonical-${currentInstrument.symbol}-${round}-${leg}`,
          accountId: TRADINGVIEW_CANONICAL_ACCOUNT_ID,
          accountLabel: "TradingView · 模拟盘",
          instrument: currentInstrument,
          side,
          executedAt,
          quantity: quantities[leg],
          price: side === "buy" ? "10" : "11",
          fee: fillIndex < 80 ? "0.1" : "0.8",
          source: {
            platform: "tradingview",
            row: fillIndex + 1,
            tradeNature: "simulation",
            simulationRunId: run,
            tradingDate: executedAt.slice(0, 10),
          },
        });
        fillIndex += 1;
      }
    }
  }
  return executions;
}

describe("TradingView canonical account business scope", () => {
  it("keeps cross-run executions in one library entry and one closed episode", () => {
    const entry = canonicalEntry();
    expect(entry.episodes).toHaveLength(1);
    expect(entry.episodes[0]!.episode.status).toBe("closed");
    expect(entry.tradeCount).toBe(2);
    expect(entry.episodes[0]!.episode.executions.map(item => item.source.simulationRunId)).toEqual(["run-a", "run-b"]);
  });

  it("projects canonical rows through every run-null consumer while retaining legacy run isolation", () => {
    const entry = canonicalEntry();
    const scope = canonicalScope();
    const rows = [{ entry, item: entry.episodes[0]! }];
    const queueRows: ReviewQueueItem[] = rows;

    expect(filterEntriesBySharedScope([entry], { ...scope, reportCurrency: "original" })).toHaveLength(1);
    expect(filterRoomRows(rows, {
      ...scope,
      assetCategory: "all",
      assetType: "all",
      period: buildRoomDateRange("all", "2026-09-19", { startDate: "2026-01-01", endDate: "2026-09-19" }),
      query: undefined,
      instrumentIds: [],
      markets: [],
      currencies: [],
      reviewStatuses: [],
    })).toHaveLength(1);
    expect(buildDashboardModel([entry]).groups).toHaveLength(1);
    expect(buildDashboardModel([entry]).groups[0]!.scope.simulationRunId).toBeNull();
    expect(searchGlobalInstruments([entry], scope, "600330")).toHaveLength(1);
    expect(buildGlobalNotifications([entry], scope).state).toBe("ready");
    expect(buildHoldingsHistory([entry], {
      scope: {
        ...scope,
        assetCategory: "all",
        assetType: "all",
        period: buildRoomDateRange("all", "2026-09-19", { startDate: "2026-01-01", endDate: "2026-09-19" }),
        query: undefined,
        instrumentIds: [],
        markets: [],
        currencies: [],
        reviewStatuses: [],
      },
      asOf: "2026-01-04T00:00:00.000Z",
      candlesByInstrument: {},
    }).reasons).toEqual([]);
    expect(summarizeLibraryPerformance(queueRows).comparableGroups).toEqual([
      expect.objectContaining({ tradeNature: "simulation", simulationRunId: null, sampleCount: 1 }),
    ]);
    expect(reviewScopeOptions([entry])).toEqual([
      expect.objectContaining({ scope: expect.objectContaining({
        accountId: TRADINGVIEW_CANONICAL_ACCOUNT_ID,
        tradeNature: "simulation",
        simulationRunId: null,
      }) }),
    ]);
  });

  it("preserves the 82-fill/32-round migration shape across all canonical consumers", () => {
    const canonicalExecutions = canonicalPortfolioExecutions();
    const quantity = canonicalExecutions.reduce((sum, value) => sum.plus(value.quantity), new Decimal(0));
    const fee = canonicalExecutions.reduce((sum, value) => sum.plus(value.fee), new Decimal(0));
    expect(canonicalExecutions).toHaveLength(82);
    expect(quantity.toString()).toBe("516000");
    expect(fee.toString()).toBe("9.6");
    expect(new Set(canonicalExecutions.map(value => value.source.simulationRunId))).toEqual(
      new Set(["run-a", "run-b", "run-c", "run-d"]),
    );

    const entries = buildTradeLibraryEntries(
      buildInstrumentTradeSummaries(canonicalExecutions),
      {},
      {},
    );
    expect(entries).toHaveLength(4);
    expect(entries.reduce((sum, value) => sum + value.episodeCount, 0)).toBe(32);
    expect(entries.reduce((sum, value) => sum + value.tradeCount, 0)).toBe(82);
    expect(entries.every(value => value.tradeNature === "simulation" && value.simulationRunId === undefined && value.accountCount === 1)).toBe(true);

    const scope = canonicalScope();
    const scopedEntries = filterEntriesBySharedScope(entries, { ...scope, reportCurrency: "original" });
    const scopedRows = scopedEntries.flatMap(entry => entry.episodes.map(item => ({ entry, item })));
    expect(scopedEntries).toHaveLength(4);
    expect(scopedRows).toHaveLength(32);
    expect(new Set(scopedRows.flatMap(({ item }) => item.episode.executions.map(value => value.accountId)))).toEqual(
      new Set([TRADINGVIEW_CANONICAL_ACCOUNT_ID]),
    );

    const roomScope = {
      ...scope,
      assetCategory: "all" as const,
      assetType: "all" as const,
      period: buildRoomDateRange("all", "2026-12-31", { startDate: "2026-01-01", endDate: "2026-12-31" }),
      query: undefined,
      instrumentIds: [],
      markets: [],
      currencies: [],
      reviewStatuses: [],
    };
    expect(buildDashboardModel(scopedEntries).rows).toHaveLength(32);
    expect(buildDashboardModel(scopedEntries).groups.every(group => group.scope.simulationRunId === null)).toBe(true);
    expect(filterRoomRows(scopedEntries, roomScope)).toHaveLength(32);
    expect(searchGlobalInstruments(scopedEntries, scope, "CN-")).toHaveLength(4);
    expect(buildGlobalNotifications(scopedEntries, scope).state).toBe("ready");
    expect(buildHoldingsHistory(scopedEntries, {
      scope: roomScope,
      asOf: "2026-12-31T00:00:00.000Z",
      candlesByInstrument: {},
    }).reasons).toEqual([]);

    const performance = summarizeLibraryPerformance(scopedRows);
    expect(performance.sample).toMatchObject({ total: 32, closed: 32 });
    expect(performance.comparableGroups).toEqual([
      expect.objectContaining({ tradeNature: "simulation", simulationRunId: null, sampleCount: 32 }),
    ]);
    expect(reviewScopeOptions(scopedEntries)).toEqual([
      expect.objectContaining({ scope: expect.objectContaining({
        accountId: TRADINGVIEW_CANONICAL_ACCOUNT_ID,
        tradeNature: "simulation",
        simulationRunId: null,
      }) }),
    ]);
  });

  it("keeps canonical filtering separate from a legacy simulation account and live rows", () => {
    const canonicalExecutions = canonicalPortfolioExecutions();
    const base = canonicalExecutions[0]!;
    const legacy = {
      ...base,
      id: "legacy-simulation-fill",
      accountId: "tradingview:legacy-account",
      accountLabel: "旧模拟账户",
      source: { ...base.source, simulationRunId: "legacy-run" },
    };
    const live = {
      ...base,
      id: "live-fill",
      accountId: "broker:live",
      accountLabel: "实盘",
      source: { platform: "futu", row: 999, tradeNature: "live" as const },
    };
    const mixedEntries = buildTradeLibraryEntries(
      buildInstrumentTradeSummaries([...canonicalExecutions, legacy, live]),
      {},
      {},
    );
    const canonicalEntries = filterEntriesBySharedScope(mixedEntries, { ...canonicalScope(), reportCurrency: "original" });
    expect(canonicalEntries).toHaveLength(4);
    expect(canonicalEntries.reduce((sum, value) => sum + value.tradeCount, 0)).toBe(82);
    expect(canonicalEntries.flatMap(value => value.episodes).every(({ episode }) => episode.accountId === TRADINGVIEW_CANONICAL_ACCOUNT_ID)).toBe(true);
    expect(mixedEntries.some(value => value.tradeNature === "live")).toBe(true);
    expect(mixedEntries.some(value => value.simulationRunId === "legacy-run")).toBe(true);
  });

  it("retains the missing-run explanation for relevant legacy simulation rows", () => {
    const legacy = execution("legacy-fill", "buy", "legacy-run", "2026-01-02T01:00:00.000Z");
    legacy.accountId = "legacy-account";
    const entries = buildTradeLibraryEntries(buildInstrumentTradeSummaries([legacy]), {}, {});
    const history = buildHoldingsHistory(entries, {
      scope: {
        ...canonicalScope(),
        accountIds: ["legacy-account"],
        assetCategory: "all",
        assetType: "all",
        period: buildRoomDateRange("all", "2026-01-04", { startDate: "2026-01-01", endDate: "2026-01-04" }),
        instrumentIds: [],
        markets: [],
        currencies: [],
        reviewStatuses: [],
      },
      asOf: "2026-01-04T00:00:00.000Z",
      candlesByInstrument: {},
    });
    expect(history.reasons).toContain("请先选择单一模拟运行");
  });

  it("preserves a canonical helper null when an entry carries a stale run", () => {
    const entry = canonicalEntry();
    entry.simulationRunId = "stale-run";
    expect(tradingViewEpisodeBusinessScope(entry.episodes[0]!.episode)).toEqual({
      accountId: TRADINGVIEW_CANONICAL_ACCOUNT_ID,
      tradeNature: "simulation",
      simulationRunId: null,
    });
    expect(reviewScopeOptions([entry])[0]!.scope.simulationRunId).toBeNull();
  });
});
