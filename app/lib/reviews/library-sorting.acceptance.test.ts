import { describe, expect, it } from "vitest";

import type { FxSnapshot } from "../fx/contracts";
import { buildInstrumentTradeSummaries } from "../trades/instruments";
import { buildTradeLibraryEntries } from "../trades/library";
import type {
  Instrument,
  TradeEpisode,
  TradeExecution,
  TradeNature,
} from "../trades/types";
import type { TradeLibraryEntry, TradeLibraryEpisode } from "../trades/library";
import type { ReviewQueueItem } from "./review-queue";
import { canSortLibraryPerformance, sortLibraryItems } from "./library-sorting";

const baseInstrument: Instrument = {
  id: "US:SORT",
  symbol: "SORT",
  name: "排序标的",
  market: "US",
  currency: "CNY",
};

function execution(
  id: string,
  instrument: Instrument,
  side: "buy" | "sell",
  executedAt: string,
  source: TradeExecution["source"] = { platform: "fixture", row: 1 },
): TradeExecution {
  return {
    id,
    accountId: "account-1",
    accountLabel: "主账户",
    instrument,
    side,
    executedAt,
    quantity: "1",
    price: side === "buy" ? "10" : "11",
    fee: "0",
    source,
  };
}

function metricRow(
  id: string,
  options: {
    currency?: string;
    netPnl: string;
    grossExposure: string;
    tradeNature?: TradeNature;
    simulationRunId?: string;
  },
): ReviewQueueItem {
  const instrument = {
    ...baseInstrument,
    id: `${options.currency ?? "CNY"}:${id}`,
    currency: options.currency ?? "CNY",
  };
  const buy = execution(`${id}:buy`, instrument, "buy", "2026-01-01T00:00:00.000Z");
  const sell = execution(`${id}:sell`, instrument, "sell", "2026-01-02T00:00:00.000Z");
  const episode: TradeEpisode = {
    id,
    accountId: "account-1",
    accountLabel: "主账户",
    instrument,
    tradeNature: options.tradeNature ?? "live",
    ...(options.simulationRunId ? { simulationRunId: options.simulationRunId } : {}),
    direction: "long",
    status: "closed",
    startedAt: buy.executedAt,
    endedAt: sell.executedAt,
    openingQuantity: "1",
    remainingQuantity: "0",
    executions: [buy, sell],
  };
  const metrics: TradeLibraryEpisode["metrics"] = {
    buyCount: 1,
    sellCount: 1,
    boughtQuantity: "1",
    soldQuantity: "1",
    grossExposure: options.grossExposure,
    fees: "0",
    realizedPnl: options.netPnl,
    unrealizedPnl: "0",
    netPnl: options.netPnl,
    returnPercent: "0",
    holdingMilliseconds: 86_400_000,
  };
  const item: TradeLibraryEpisode = {
    episode,
    metrics,
    reviewStatus: "pending",
    confirmedTagIds: [],
    tagDictionaryVersion: 1,
    rMultiple: null,
  };
  const entry: TradeLibraryEntry = {
    groupId: `${instrument.id}|${id}`,
    tradeNature: options.tradeNature ?? "live",
    ...(options.simulationRunId ? { simulationRunId: options.simulationRunId } : {}),
    instrument,
    executions: [buy, sell],
    episodes: [item],
    accountCount: 1,
    tradeCount: 2,
    episodeCount: 1,
    firstTradeAt: buy.executedAt,
    lastTradeAt: sell.executedAt,
    status: "closed",
    netPnl: options.netPnl,
    returnPercent: "0",
    reviewedEpisodeCount: 0,
    confirmedTagIds: [],
    cumulativeR: null,
  };
  return { entry, item };
}

function fxSnapshot(): FxSnapshot {
  return {
    version: 1,
    baseCurrency: "CNY",
    rates: { CNY: 1, HKD: 0.9, USD: 7.123456789 },
    source: {
      id: "frankfurter-ecb",
      label: "fixture",
      url: "https://example.test/fx",
      attributionUrl: "https://example.test/fx/about",
    },
    rateDate: "2026-01-01",
    fetchedAt: "2026-01-01T00:00:00.000Z",
    lastAttemptedAt: "2026-01-01T00:00:00.000Z",
    cacheStatus: "fresh",
  };
}

function builtLegacyAndUnknownRows(): ReviewQueueItem[] {
  const legacyInstrument: Instrument = {
    id: "CN:LEGACY-SORT",
    symbol: "LEGACY-SORT",
    name: "历史实盘排序标的",
    market: "CN-SH",
    currency: "CNY",
  };
  const unknownInstrument: Instrument = {
    id: "CN:UNKNOWN-SORT",
    symbol: "UNKNOWN-SORT",
    name: "未知排序标的",
    market: "CN-SH",
    currency: "CNY",
  };
  const executions = [
    execution("legacy-buy", legacyInstrument, "buy", "2026-01-01T00:00:00.000Z", { platform: "futu", row: 1 }),
    execution("legacy-sell", legacyInstrument, "sell", "2026-01-02T00:00:00.000Z", { platform: "futu", row: 2 }),
    execution("unknown-buy", unknownInstrument, "buy", "2026-01-01T00:00:00.000Z", { platform: "manual", row: 3 }),
    execution("unknown-sell", unknownInstrument, "sell", "2026-01-02T00:00:00.000Z", { platform: "manual", row: 4 }),
  ];
  return buildTradeLibraryEntries(
    buildInstrumentTradeSummaries(executions),
    {},
    {},
  ).flatMap((entry) => entry.episodes.map((item) => ({ entry, item })));
}

describe("library sorting acceptance boundaries", () => {
  it("uses entry-first nature for a real legacy row and rejects a mixed unknown scope", () => {
    const rows = builtLegacyAndUnknownRows();
    const legacy = rows.find((row) => row.entry.instrument.symbol === "LEGACY-SORT");
    const unknown = rows.find((row) => row.entry.instrument.symbol === "UNKNOWN-SORT");

    expect(legacy?.entry.tradeNature).toBe("live");
    expect(legacy?.item.episode.tradeNature).toBe("unknown");
    expect(canSortLibraryPerformance([legacy!], "all")).toEqual({ allowed: true, reason: null });
    expect(canSortLibraryPerformance([legacy!, unknown!], "all")).toEqual({
      allowed: false,
      reason: "当前范围包含多个交易性质或模拟运行",
    });
  });

  it("uses the same precise FX snapshot for net and weighted-return ordering", () => {
    const fx = fxSnapshot();
    const mixed = [
      metricRow("mixed-cny", { netPnl: "0", grossExposure: "100", currency: "CNY" }),
      metricRow("mixed-usd", { netPnl: "1", grossExposure: "100", currency: "USD" }),
    ];
    const cny = [metricRow("cny-only", { netPnl: "1", grossExposure: "100", currency: "CNY" })];

    expect(sortLibraryItems([
      { id: "mixed", rows: mixed, value: "mixed" },
      { id: "cny", rows: cny, value: "cny" },
    ], "net-profit", fx).map((item) => item.id)).toEqual(["mixed", "cny"]);
    expect(sortLibraryItems([
      { id: "mixed", rows: mixed, value: "mixed" },
      { id: "cny", rows: cny, value: "cny" },
    ], "return-high", fx).map((item) => item.id)).toEqual(["cny", "mixed"]);

    const preciseHigh = metricRow("z-precise-high", {
      netPnl: "9007199254740992.01",
      grossExposure: "100000000000000000",
    });
    const preciseLow = metricRow("a-precise-low", {
      netPnl: "9007199254740992.00",
      grossExposure: "100000000000000000",
    });
    expect(sortLibraryItems([
      { id: "z-precise-high", rows: [preciseHigh], value: "high" },
      { id: "a-precise-low", rows: [preciseLow], value: "low" },
    ], "net-profit", fx).map((item) => item.id)).toEqual(["z-precise-high", "a-precise-low"]);
    expect(sortLibraryItems([
      { id: "z-precise-high", rows: [preciseHigh], value: "high" },
      { id: "a-precise-low", rows: [preciseLow], value: "low" },
    ], "return-high", fx).map((item) => item.id)).toEqual(["z-precise-high", "a-precise-low"]);
  });
});
