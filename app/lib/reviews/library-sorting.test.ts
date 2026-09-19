import { describe, expect, it } from "vitest";

import type { FxSnapshot } from "../fx/contracts";
import type { TradeLibraryEntry, TradeLibraryEpisode } from "../trades/library";
import type { TradeEpisode, TradeExecution, TradeNature } from "../trades/types";
import { createEmptyEpisodeReviewRecord } from "./review-metrics";
import type { ReviewQueueItem, ReviewQueueSort } from "./review-queue";
import { canSortLibraryPerformance, sortLibraryItems } from "./library-sorting";

const baseInstrument = {
  id: "US:TEST",
  symbol: "TEST",
  name: "测试标的",
  market: "US",
  currency: "USD",
};

type RowOptions = {
  currency?: string;
  nature?: TradeNature;
  runId?: string;
  netPnl?: string | null;
  grossExposure?: string;
  status?: "open" | "closed";
  timestamps?: string[];
  reviewed?: boolean;
};

function execution(id: string, executedAt: string, instrument: typeof baseInstrument): TradeExecution {
  return {
    id,
    accountId: "account-1",
    accountLabel: "主账户",
    instrument,
    side: "buy",
    executedAt,
    quantity: "1",
    price: "100",
    fee: "0",
    source: { platform: "fixture", row: 1 },
  };
}

function row(id: string, options: RowOptions = {}): ReviewQueueItem {
  const nature = options.nature ?? "live";
  const status = options.status ?? "closed";
  const currency = options.currency ?? "CNY";
  const instrument = { ...baseInstrument, id: `${currency}:${id}`, currency };
  const timestamps = options.timestamps ?? ["2026-01-01T00:00:00.000Z"];
  const executions = timestamps.map((executedAt, index) => execution(`${id}:${index}`, executedAt, instrument));
  const netPnl = options.netPnl === undefined ? "0" : options.netPnl;
  const grossExposure = options.grossExposure ?? "100";
  const episode: TradeEpisode = {
    id,
    accountId: "account-1",
    accountLabel: "主账户",
    instrument,
    tradeNature: nature,
    ...(options.runId ? { simulationRunId: options.runId } : {}),
    direction: "long",
    status,
    startedAt: timestamps[0] ?? "invalid-start",
    ...(status === "closed" ? { endedAt: timestamps[timestamps.length - 1] } : {}),
    openingQuantity: "1",
    remainingQuantity: status === "closed" ? "0" : "1",
    executions,
  };
  const metrics: TradeLibraryEpisode["metrics"] = {
    buyCount: executions.length,
    sellCount: status === "closed" ? 1 : 0,
    boughtQuantity: "1",
    soldQuantity: status === "closed" ? "1" : "0",
    grossExposure,
    fees: "0",
    realizedPnl: netPnl ?? "0",
    unrealizedPnl: null,
    netPnl: status === "closed" ? netPnl : null,
    returnPercent: status === "closed" && netPnl !== null ? "1" : null,
    holdingMilliseconds: null,
  };
  const item: TradeLibraryEpisode = {
    episode,
    metrics,
    review: options.reviewed ? {
      ...createEmptyEpisodeReviewRecord(id, instrument.id),
      review: {
        ...createEmptyEpisodeReviewRecord(id, instrument.id).review,
        completed: true,
      },
    } : undefined,
    reviewStatus: options.reviewed ? "completed" : "pending",
    confirmedTagIds: [],
    tagDictionaryVersion: 1,
    rMultiple: null,
  };
  const entry: TradeLibraryEntry = {
    groupId: `${instrument.id}|${id}`,
    tradeNature: nature,
    ...(options.runId ? { simulationRunId: options.runId } : {}),
    instrument,
    executions,
    episodes: [item],
    accountCount: 1,
    tradeCount: executions.length,
    episodeCount: 1,
    firstTradeAt: timestamps[0] ?? "invalid-start",
    lastTradeAt: timestamps[timestamps.length - 1] ?? "invalid-last",
    status,
    netPnl,
    returnPercent: metrics.returnPercent,
    reviewedEpisodeCount: options.reviewed ? 1 : 0,
    confirmedTagIds: [],
    cumulativeR: null,
  };
  return { entry, item };
}

function fxSnapshot(rates: Partial<FxSnapshot["rates"]> = {}): FxSnapshot {
  return {
    version: 1,
    baseCurrency: "CNY",
    rates: { CNY: 1, HKD: 0.9, USD: 7, ...rates },
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

function item(id: string, rows: ReviewQueueItem[]) {
  return { id, rows, value: { id } };
}

describe("library sorting", () => {
  it("sorts latest valid execution timestamps in both directions, with invalid times last", () => {
    const timezone = row("timezone", {
      timestamps: ["2026-01-01T16:00:00.000Z", "2026-01-02T00:00:00+08:00"],
    });
    const earlier = row("earlier", { timestamps: ["2026-01-01T15:00:00.000Z"] });
    const invalid = row("invalid", { timestamps: ["not-a-timestamp"] });
    const items = [item("timezone", [timezone]), item("earlier", [earlier]), item("invalid", [invalid])];

    expect(sortLibraryItems(items, "newest").map(({ id }) => id)).toEqual(["timezone", "earlier", "invalid"]);
    expect(sortLibraryItems(items, "oldest").map(({ id }) => id)).toEqual(["earlier", "timezone", "invalid"]);
  });

  it.each<[ReviewQueueSort, string[]]>([
    ["net-profit", ["usd", "cny", "missing-fx"]],
    ["net-loss", ["cny", "usd", "missing-fx"]],
  ])("ranks CNY converted net PnL and keeps unavailable values last for %s", (sort, expected) => {
    const cny = row("cny", { currency: "CNY", netPnl: "100", grossExposure: "1000" });
    const usd = row("usd", { currency: "USD", netPnl: "20", grossExposure: "1000" });
    const missingFx = row("missing-fx", { currency: "GBP", netPnl: "1000", grossExposure: "1000" });
    const sorted = sortLibraryItems([
      item("cny", [cny]),
      item("usd", [usd]),
      item("missing-fx", [missingFx]),
    ], sort, fxSnapshot({ USD: 7 }));

    expect(sorted.map(({ id }) => id)).toEqual(expected);
  });

  it("sorts return by each item's weighted CNY return rather than averaging episode percentages", () => {
    const largeMixed = [
      row("large-win", { currency: "CNY", netPnl: "1000", grossExposure: "10000" }),
      row("large-loss", { currency: "CNY", netPnl: "-900", grossExposure: "90000" }),
    ];
    const smallWinner = [row("small-winner", { currency: "CNY", netPnl: "50", grossExposure: "1000" })];
    const sorted = sortLibraryItems([
      item("large-mixed", largeMixed),
      item("small-winner", smallWinner),
    ], "return-high");

    expect(sorted.map(({ id }) => id)).toEqual(["small-winner", "large-mixed"]);
  });

  it("uses id as a deterministic tie breaker and preserves each value reference", () => {
    const first = item("b", [row("b")]);
    const second = item("a", [row("a")]);
    const sorted = sortLibraryItems([first, second], "newest");

    expect(sorted.map(({ id }) => id)).toEqual(["a", "b"]);
    expect(sorted.find(({ id }) => id === "a")?.value).toBe(second.value);
    expect(sorted.find(({ id }) => id === "b")?.value).toBe(first.value);
  });

  it("keeps pending/completed compatibility sorts status-first and time-stable", () => {
    const pending = item("pending", [row("pending", { reviewed: false, timestamps: ["2026-01-01T00:00:00Z"] })]);
    const completed = item("completed", [row("completed", { reviewed: true, timestamps: ["2026-01-02T00:00:00Z"] })]);

    expect(sortLibraryItems([completed, pending], "pending-first").map(({ id }) => id)).toEqual(["pending", "completed"]);
    expect(sortLibraryItems([pending, completed], "completed-first").map(({ id }) => id)).toEqual(["completed", "pending"]);
  });

  it("requires an explicit matching simulation run and rejects mixed scopes", () => {
    const runA = row("run-a", { nature: "simulation", runId: "run-a" });
    const runB = row("run-b", { nature: "simulation", runId: "run-b" });
    const live = row("live", { nature: "live" });

    expect(canSortLibraryPerformance([runA], "all")).toEqual({ allowed: false, reason: "请先选择模拟运行" });
    expect(canSortLibraryPerformance([runA], "run-b")).toEqual({ allowed: false, reason: "所选模拟运行与当前回合不一致" });
    expect(canSortLibraryPerformance([runA], "run-a")).toEqual({ allowed: true, reason: null });
    expect(canSortLibraryPerformance([runA, runB], "run-a")).toEqual({ allowed: false, reason: "当前范围包含多个交易性质或模拟运行" });
    expect(canSortLibraryPerformance([live, runA], "run-a")).toEqual({ allowed: false, reason: "当前范围包含多个交易性质或模拟运行" });
    expect(canSortLibraryPerformance([], "all")).toEqual({ allowed: false, reason: "没有可排序的回合" });
  });
});
