import { describe, expect, it } from "vitest";

import type { FxSnapshot } from "../fx/contracts";
import type { TradeLibraryEntry, TradeLibraryEpisode } from "../trades/library";
import { buildTradeEpisodes } from "../trades/episodes";
import { summarizeTradeEpisode } from "../trades/episode-metrics";
import type { TradeEpisode, TradeExecution } from "../trades/types";
import type { ReviewQueueItem } from "./review-queue";
import { summarizeLibraryPerformance } from "./library-performance";

const instrument = {
  id: "US:TEST",
  symbol: "TEST",
  name: "测试标的",
  market: "US",
  currency: "USD",
};

function execution(
  id: string,
  side: "buy" | "sell",
  overrides: Partial<TradeExecution> = {},
): TradeExecution {
  return {
    id,
    accountId: "account-1",
    accountLabel: "主账户",
    instrument,
    side,
    executedAt: "2026-01-01T00:00:00.000Z",
    quantity: "1",
    price: "10",
    fee: "0",
    source: { platform: "fixture", row: 1 },
    ...overrides,
  };
}

type MetricOverrides = Partial<TradeLibraryEpisode["metrics"]>;

function row(
  id: string,
  overrides: {
    netPnl?: string | null;
    grossExposure?: string;
    status?: "open" | "closed";
    unrealizedPnl?: string | null;
    pnlAvailable?: false;
    currency?: string;
    tradeNature?: "live" | "simulation" | "unknown";
    simulationRunId?: string;
    metrics?: MetricOverrides;
  } = {},
): ReviewQueueItem {
  const status = overrides.status ?? "closed";
  const currency = overrides.currency ?? instrument.currency;
  const scopeNature = overrides.tradeNature ?? "live";
  const scopedInstrument = { ...instrument, currency, id: `${currency}:${id}` };
  const episode: TradeEpisode = {
    id,
    accountId: "account-1",
    accountLabel: "主账户",
    instrument: scopedInstrument,
    ...(scopeNature ? { tradeNature: scopeNature } : {}),
    ...(overrides.simulationRunId ? { simulationRunId: overrides.simulationRunId } : {}),
    direction: "long",
    status,
    startedAt: "2026-01-01T00:00:00.000Z",
    ...(status === "closed" ? { endedAt: "2026-01-02T00:00:00.000Z" } : {}),
    openingQuantity: "1",
    remainingQuantity: status === "closed" ? "0" : "1",
    executions: [
      execution(`${id}:buy`, "buy", { instrument: scopedInstrument }),
      ...(status === "closed"
        ? [execution(`${id}:sell`, "sell", { instrument: scopedInstrument, executedAt: "2026-01-02T00:00:00.000Z" })]
        : []),
    ],
  };
  const netPnl = overrides.netPnl === undefined ? "0" : overrides.netPnl;
  const metrics: TradeLibraryEpisode["metrics"] = {
    buyCount: status === "closed" ? 1 : 1,
    sellCount: status === "closed" ? 1 : 0,
    boughtQuantity: "1",
    soldQuantity: status === "closed" ? "1" : "0",
    grossExposure: overrides.grossExposure ?? "100",
    fees: "0",
    realizedPnl: status === "closed" ? netPnl ?? "0" : "0",
    unrealizedPnl: status === "open" ? (overrides.unrealizedPnl ?? null) : "0",
    netPnl: status === "open" ? null : netPnl,
    returnPercent: status === "open" || netPnl === null ? null : "1",
    holdingMilliseconds: status === "closed" ? 86_400_000 : null,
    ...(overrides.pnlAvailable === false ? { pnlAvailable: false as const } : {}),
    ...overrides.metrics,
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
    groupId: `${scopedInstrument.id}|${id}`,
    tradeNature: scopeNature,
    ...(overrides.simulationRunId ? { simulationRunId: overrides.simulationRunId } : {}),
    instrument: scopedInstrument,
    executions: episode.executions,
    episodes: [item],
    accountCount: 1,
    tradeCount: episode.executions.length,
    episodeCount: 1,
    firstTradeAt: episode.startedAt,
    lastTradeAt: episode.endedAt ?? episode.startedAt,
    status,
    netPnl: item.metrics.netPnl,
    returnPercent: item.metrics.returnPercent,
    reviewedEpisodeCount: 0,
    confirmedTagIds: [],
    cumulativeR: null,
  };
  return { entry, item };
}

function rowFromEpisode(
  episode: TradeEpisode,
  metrics = summarizeTradeEpisode(episode),
): ReviewQueueItem {
  const item: TradeLibraryEpisode = {
    episode,
    metrics,
    reviewStatus: "pending",
    confirmedTagIds: [],
    tagDictionaryVersion: 1,
    rMultiple: null,
  };
  const entry: TradeLibraryEntry = {
    groupId: `${episode.instrument.id}|${episode.id}`,
    tradeNature: episode.tradeNature,
    ...(episode.simulationRunId ? { simulationRunId: episode.simulationRunId } : {}),
    instrument: episode.instrument,
    executions: episode.executions,
    episodes: [item],
    accountCount: 1,
    tradeCount: episode.executions.length,
    episodeCount: 1,
    firstTradeAt: episode.startedAt,
    lastTradeAt: episode.endedAt ?? episode.startedAt,
    status: episode.status,
    netPnl: metrics.netPnl,
    returnPercent: metrics.returnPercent,
    reviewedEpisodeCount: 0,
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

describe("library performance", () => {
  it("uses one trusted closed sample for net PnL and weighted return", () => {
    const summary = summarizeLibraryPerformance([
      row("winner", { netPnl: "1000", grossExposure: "10000" }),
      row("loser", { netPnl: "-900", grossExposure: "90000" }),
    ]);
    const group = summary.rawCurrencyGroups[0];

    expect(summary.sample).toMatchObject({
      total: 2,
      closed: 2,
      open: 0,
      trustedClosed: 2,
      returnEligible: 2,
    });
    expect(group).toMatchObject({
      netPnl: "100",
      grossExposure: "100000",
      returnSampleNetPnl: "100",
      weightedReturn: "0.1",
      wins: 1,
      losses: 1,
      breakEven: 0,
      winRate: { wins: 1, denominator: 2 },
      averageWin: "1000",
      averageLoss: "900",
      payoff: "1.1111111111111111111",
      profitFactor: "1.1111111111111111111",
    });
  });

  it("converts both numerator and denominator with one FX snapshot", () => {
    const summary = summarizeLibraryPerformance([
      row("cny-winner", { currency: "CNY", netPnl: "1000", grossExposure: "10000" }),
      row("usd-loser", { currency: "USD", netPnl: "-100", grossExposure: "1000" }),
    ], fxSnapshot({ USD: 7 }));

    expect(summary.comparableGroups).toHaveLength(1);
    expect(summary.cny).toMatchObject({
      available: true,
      netPnl: "300",
      grossExposure: "17000",
      returnSampleNetPnl: "300",
      weightedReturn: "1.7647058823529411765",
      netPnlSampleCount: 2,
      returnSampleCount: 2,
      wins: 1,
      losses: 1,
      winRate: { wins: 1, denominator: 2 },
    });
  });

  it("keeps raw foreign currency values and excludes missing FX symmetrically", () => {
    const summary = summarizeLibraryPerformance([
      row("cny-winner", { currency: "CNY", netPnl: "1000", grossExposure: "10000" }),
      row("hkd-loser", { currency: "HKD", netPnl: "-100", grossExposure: "1000" }),
    ]);

    const hkd = summary.rawCurrencyGroups.find(group => group.currency === "HKD");
    expect(hkd).toMatchObject({ netPnl: "-100", grossExposure: "1000", weightedReturn: "-10" });
    expect(summary.cny).toMatchObject({
      available: true,
      netPnl: "1000",
      grossExposure: "10000",
      returnSampleNetPnl: "1000",
      netPnlSampleCount: 1,
      returnSampleCount: 1,
    });
    expect(summary.cny.exclusionReasons).toMatchObject({ "missing-fx": 1 });
    expect(summary.cny.netPnl).not.toContain("-100");
  });

  it("keeps open and unrealized values separate from closed metrics", () => {
    const summary = summarizeLibraryPerformance([
      row("closed", { currency: "CNY", netPnl: "100", grossExposure: "100" }),
      row("open", { currency: "CNY", status: "open", unrealizedPnl: "75", grossExposure: "100" }),
      row("open-unknown", { currency: "CNY", status: "open", unrealizedPnl: "999", pnlAvailable: false, grossExposure: "100" }),
    ]);

    expect(summary.sample).toMatchObject({ total: 3, closed: 1, open: 2, trustedClosed: 1, returnEligible: 1 });
    expect(summary.cny.netPnl).toBe("100");
    expect(summary.cny.openCount).toBe(2);
    expect(summary.open).toMatchObject({ count: 2, withUnrealizedPnl: 1, unavailable: 1, unrealizedPnl: "75" });
    expect(summary.rawCurrencyGroups[0].exclusionReasons).toMatchObject({ open: 2 });
  });

  it("discloses invalid and untrusted samples without replacing them with zero", () => {
    const summary = summarizeLibraryPerformance([
      row("trusted", { currency: "CNY", netPnl: "5", grossExposure: "0" }),
      row("untrusted", { currency: "CNY", netPnl: "999", pnlAvailable: false, grossExposure: "100" }),
      row("missing", { currency: "CNY", netPnl: null, grossExposure: "100" }),
    ]);
    const group = summary.rawCurrencyGroups[0];

    expect(group).toMatchObject({
      netPnl: "5",
      netPnlSampleCount: 1,
      returnSampleCount: 0,
      weightedReturn: null,
      returnSampleNetPnl: null,
    });
    expect(group.exclusionReasons).toMatchObject({ "pnl-unavailable": 1, "missing-pnl": 1 });
    expect(group.returnExclusionReasons).toMatchObject({ "invalid-exposure": 1 });
    expect(summary.cny).toMatchObject({
      netPnl: "5",
      netPnlSampleCount: 1,
      returnSampleCount: 0,
      weightedReturn: null,
    });
  });

  it("preserves simulation run boundaries in comparable groups", () => {
    const summary = summarizeLibraryPerformance([
      row("run-a", { tradeNature: "simulation", simulationRunId: "run-a", netPnl: "10" }),
      row("run-b", { tradeNature: "simulation", simulationRunId: "run-b", netPnl: "20" }),
    ], fxSnapshot());

    expect(summary.rawCurrencyGroups).toHaveLength(2);
    expect(summary.comparableGroups).toHaveLength(2);
    expect(summary.comparableGroups.map(group => group.simulationRunId)).toEqual(["run-a", "run-b"]);
    expect(summary.cny).toMatchObject({ available: false, reason: "multiple-scopes" });
    expect(summary.cny.netPnl).toBeNull();
    expect(summary.sample).toMatchObject({ cnyNetPnlEligible: 2, cnyReturnEligible: 2 });
  });

  it("uses the entry nature for legacy episodes while isolating explicit unknown scope", () => {
    const legacyLive = row("legacy-live", { currency: "CNY", tradeNature: "live", netPnl: "10" });
    legacyLive.item.episode.tradeNature = "unknown";
    const explicitUnknown = row("unknown", { currency: "CNY", tradeNature: "unknown", netPnl: "20" });
    const summary = summarizeLibraryPerformance([legacyLive, explicitUnknown]);

    expect(summary.rawCurrencyGroups.map(group => [group.tradeNature, group.netPnl])).toEqual([
      ["live", "10"],
      ["unknown", "20"],
    ]);
  });

  it("reports a zero profit factor when all trusted samples are losses", () => {
    const summary = summarizeLibraryPerformance([
      row("loss-a", { currency: "CNY", netPnl: "-10", grossExposure: "100" }),
      row("loss-b", { currency: "CNY", netPnl: "-5", grossExposure: "100" }),
    ]);
    expect(summary.cny).toMatchObject({ profitFactor: "0", profitFactorReason: null, payoff: null });
  });

  it("consumes the trusted short and IPO metrics without recalculating them", () => {
    const shortFills = [
      execution("short-open", "sell", { quantity: "100", price: "10", executedAt: "2026-01-01T00:00:00.000Z" }),
      execution("short-close", "buy", { quantity: "100", price: "8", executedAt: "2026-01-02T00:00:00.000Z" }),
    ];
    const [shortEpisode] = buildTradeEpisodes(shortFills);
    const shortRow = rowFromEpisode(shortEpisode);
    expect(shortEpisode.direction).toBe("short");

    const ipoSale = execution("ipo-sale", "sell", {
      quantity: "500",
      price: "24",
      fee: "3",
      executedAt: "2026-01-02T00:00:00.000Z",
      source: {
        platform: "fixture",
        row: 1,
        positionEvents: [
          { id: "application", accountId: "account-1", market: "US", symbol: "TEST", date: "2025-12-01", kind: "ipo", amount: "-68271.65", currency: "USD", description: "IPO application", source: [] },
          { id: "fee", accountId: "account-1", market: "US", symbol: "TEST", date: "2025-12-01", kind: "fee", amount: "-100", currency: "USD", description: "IPO fee", source: [] },
          { id: "refund", accountId: "account-1", market: "US", symbol: "TEST", date: "2026-01-02", kind: "ipo", amount: "56893.04", currency: "USD", description: "IPO refund", source: [] },
          { id: "allocation", accountId: "account-1", market: "US", symbol: "TEST", date: "2026-01-02", kind: "ipo", quantity: "500", amount: "11265", currency: "USD", displayTimePolicy: "session-open", description: "IPO allotment", source: [] },
        ],
      },
    });
    const [ipoEpisode] = buildTradeEpisodes([ipoSale]);
    const ipoRow = rowFromEpisode(ipoEpisode);
    const summary = summarizeLibraryPerformance([shortRow, ipoRow]);

    expect(summary.rawCurrencyGroups[0]).toMatchObject({
      netPnl: "718.39",
      grossExposure: "12378.61",
      returnSampleNetPnl: "718.39",
    });
  });
});
