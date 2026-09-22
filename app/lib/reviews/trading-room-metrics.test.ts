import { describe, expect, it } from "vitest";

import type { DashboardRow } from "./dashboard";
import type { TradingRoomRow, RoomFxSnapshot, RoomDateRange } from "./trading-room-scope";
import type { TradeEpisode, TradeExecution } from "../trades/types";
import type { TradeEpisodeMetrics } from "../trades/episode-metrics";
import type { TradeLibraryEntry, TradeLibraryEpisode } from "../trades/library";
import {
  buildCostReturnSummary,
  buildMonthlyWinRate,
  buildTradeQualitySummary,
  buildTradingRoomMetrics,
} from "./trading-room-metrics";

const instrument = {
  id: "US:TEST",
  symbol: "TEST",
  name: "测试标的",
  market: "US",
  currency: "USD",
};

function execution(side: "buy" | "sell", date: string): TradeExecution {
  return {
    id: `${side}-${date}`,
    source: { platform: "test", row: 1, feeStatus: "reported" },
    accountId: "acct",
    accountLabel: "测试账户",
    instrument,
    side,
    executedAt: `${date}T09:00:00.000Z`,
    quantity: "100",
    price: side === "buy" ? "100" : "101",
    fee: "0",
  };
}

function metrics(netPnl: string, grossExposure: string, unavailable = false): TradeEpisodeMetrics {
  return {
    ...(unavailable ? { pnlAvailable: false as const } : {}),
    buyCount: 1,
    sellCount: 1,
    boughtQuantity: "100",
    soldQuantity: "100",
    grossExposure,
    fees: "0",
    realizedPnl: netPnl,
    unrealizedPnl: "0",
    netPnl: unavailable ? null : netPnl,
    returnPercent: unavailable ? null : "1",
    holdingMilliseconds: 86_400_000,
  };
}

function episode(input: {
  id: string;
  closeDate: string;
  netPnl?: string | null;
  grossExposure?: string;
  direction?: "long" | "short";
  status?: "open" | "closed";
  directionKnown?: false;
  unavailable?: boolean;
  unknownFee?: boolean;
  initialPosition?: TradeEpisode["initialPosition"];
  positionEvents?: TradeEpisode["positionEvents"];
}): TradeEpisode {
  return {
    id: input.id,
    accountId: "acct",
    accountLabel: "测试账户",
    instrument,
    direction: input.direction ?? "long",
    ...(input.directionKnown === false ? { directionKnown: false as const } : {}),
    status: input.status ?? "closed",
    startedAt: `${input.closeDate}T09:00:00.000Z`,
    endedAt: `${input.closeDate}T10:00:00.000Z`,
    openingQuantity: "100",
    remainingQuantity: input.status === "open" ? "100" : "0",
    executions: [execution("buy", input.closeDate), execution("sell", input.closeDate)].map(value => input.unknownFee
      ? { ...value, source: { ...value.source, feeStatus: "unknown" as const } }
      : value),
    ...(input.initialPosition ? { initialPosition: input.initialPosition } : {}),
    ...(input.positionEvents ? { positionEvents: input.positionEvents } : {}),
  };
}

function row(input: Parameters<typeof episode>[0] & {
  trustedPnl?: string | null;
  exclusionReason?: string | null;
}): TradingRoomRow {
  const itemEpisode = episode(input);
  const item: TradeLibraryEpisode = {
    episode: itemEpisode,
    metrics: metrics(input.netPnl ?? "0", input.grossExposure ?? "10000", input.unavailable),
    reviewStatus: "pending",
    confirmedTagIds: [],
    tagDictionaryVersion: 1,
    rMultiple: null,
  };
  const entry: TradeLibraryEntry = {
    instrument,
    executions: itemEpisode.executions,
    episodes: [item],
    accountCount: 1,
    tradeCount: itemEpisode.executions.length,
    episodeCount: 1,
    firstTradeAt: itemEpisode.startedAt,
    lastTradeAt: itemEpisode.endedAt ?? itemEpisode.startedAt,
    status: itemEpisode.status,
    netPnl: input.netPnl ?? null,
    returnPercent: null,
    reviewedEpisodeCount: 0,
    confirmedTagIds: [],
    cumulativeR: null,
  };
  const dashboardRow: DashboardRow = { entry, item };
  return {
    row: dashboardRow,
    assetCategory: "us-stock",
    assetType: "stock",
    sourceNature: "live",
    closeDate: input.closeDate,
    trustedPnl: input.trustedPnl === undefined ? input.netPnl ?? null : input.trustedPnl,
    exclusionReason: input.exclusionReason ?? null,
    assetReason: null,
  };
}

const range: RoomDateRange = {
  preset: "custom",
  startDate: "2026-01-15",
  endDate: "2026-03-10",
};

const completeFx: RoomFxSnapshot = {
  id: "fx:test",
  baseCurrency: "CNY",
  asOf: "2026-09-19T02:00:00.000Z",
  source: "BOC",
  status: "complete",
  rates: { "USD/CNY": "6.7521", "HKD/CNY": "0.8606" },
};

describe("trading room metrics", () => {
  it("includes trusted short rounds in quality while cost return excludes them", () => {
    const result = buildTradeQualitySummary([row({ id: "short", closeDate: "2026-09-10", direction: "short", netPnl: "100" })]);
    expect(result.sampleCount).toBe(1);
    expect(result.wins).toBe(1);
    expect(buildCostReturnSummary([row({ id: "short", closeDate: "2026-09-10", direction: "short", netPnl: "100" })]).applicableCount).toBe(0);
  });

  it("keeps complete FX quality comparable and incomplete, zero, or negative rates separate", () => {
    const usd = row({ id: "usd", closeDate: "2026-09-10", netPnl: "100" });
    const hk = { ...row({ id: "hk", closeDate: "2026-09-11", netPnl: "100" }), row: { ...usd.row, item: { ...usd.row.item, episode: { ...usd.row.item.episode, id: "hk", instrument: { ...usd.row.item.episode.instrument, currency: "HKD" } } } } };
    const complete = buildTradeQualitySummary([usd, hk], { ...completeFx, status: "complete", rates: { "USD/CNY": "7", "HKD/CNY": "0.9" } });
    expect(complete.comparable).toBe(true);
    expect(complete.currency).toBe("CNY");
    expect(complete.profitFactor).toBeNull();
    for (const rates of [{ "USD/CNY": "7" }, { "USD/CNY": "0" }, { "USD/CNY": "-1" }]) {
      expect(buildTradeQualitySummary([usd, hk], { ...completeFx, status: "partial", rates }).comparable).toBe(false);
    }
  });

  it("normalizes the 人民币 currency alias without requiring FX", () => {
    const base = row({ id: "cny", closeDate: "2026-09-10", netPnl: "100" });
    const aliased = { ...base, row: { ...base.row, item: { ...base.row.item, episode: { ...base.row.item.episode, instrument: { ...base.row.item.episode.instrument, currency: "人民币" } } } } };
    const result = buildTradeQualitySummary([aliased]);
    expect(result.currency).toBe("CNY");
    expect(result.comparable).toBe(true);
  });
  it("computes payoff and profit factor with Decimal values and keeps ties out of averages", () => {
    const result = buildTradeQualitySummary([
      row({ id: "win-a", closeDate: "2026-09-10", netPnl: "200" }),
      row({ id: "loss-a", closeDate: "2026-09-11", netPnl: "-100" }),
      row({ id: "win-b", closeDate: "2026-09-12", netPnl: "200" }),
      row({ id: "loss-b", closeDate: "2026-09-13", netPnl: "-0" }),
    ]);
    expect(result.averageWin).toBe("200");
    expect(result.averageLoss).toBe("100");
    expect(result.payoffRatio).toBe("2");
    expect(result.profitFactor).toBe("4");
    expect(result.wins).toBe(2);
    expect(result.losses).toBe(1);
    expect(result.breakEven).toBe(1);
  });

  it("explains undefined ratios for an all-win sample", () => {
    const result = buildTradeQualitySummary([row({ id: "win", closeDate: "2026-09-10", netPnl: "200" })]);
    expect(result.payoffRatio).toBeNull();
    expect(result.profitFactor).toBeNull();
    expect(result.payoffReason).toContain("无亏损样本");
    expect(result.profitFactorReason).toContain("无亏损样本");
  });

  it("uses the same complete episodes for a weighted 1% cost return, including pre-period buys", () => {
    const rows = [
      row({ id: "cross-period", closeDate: "2026-09-10", netPnl: "100", grossExposure: "10000" }),
      row({ id: "second", closeDate: "2026-09-15", netPnl: "100", grossExposure: "10000" }),
    ];

    const result = buildCostReturnSummary(rows, completeFx);

    expect(result.applicableCount).toBe(2);
    expect(result.costReturnPercent).toBe("1");
    expect(result.netPnl.originalByCurrency).toEqual({ USD: "200" });
    expect(result.buyCost.originalByCurrency).toEqual({ USD: "20000" });
    expect(result.netPnl.convertedCny).toBe("1350.42");
    expect(result.buyCost.convertedCny).toBe("135042");
  });

  it("excludes open, short, unknown-PnL, and initial-position samples with reasons", () => {
    const rows = [
      row({ id: "valid", closeDate: "2026-09-10", netPnl: "100", grossExposure: "10000" }),
      row({ id: "open", closeDate: "2026-09-11", netPnl: null, status: "open", trustedPnl: null, exclusionReason: "open" }),
      row({ id: "short", closeDate: "2026-09-12", netPnl: "80", direction: "short", trustedPnl: null, exclusionReason: "accuracy" }),
      row({ id: "unknown-fee", closeDate: "2026-09-13", netPnl: "90", unavailable: true, unknownFee: true, trustedPnl: null, exclusionReason: "unknown-fees" }),
      row({
        id: "initial-position",
        closeDate: "2026-09-14",
        netPnl: "70",
        trustedPnl: null,
        exclusionReason: "accuracy",
        initialPosition: { accountId: "acct", market: "US", symbol: "TEST", phase: "opening", date: "2026-09-01", quantity: "100", cost: "5000", source: [] },
      }),
    ];

    const result = buildCostReturnSummary(rows, completeFx);

    expect(result.applicableCount).toBe(1);
    expect(result.excludedCount).toBe(4);
    expect(result.exclusionReasons).toEqual({
      "not-closed": 1,
      "short-or-unknown-direction": 1,
      "unknown-fees": 1,
      "incomplete-cost-evidence": 1,
    });
  });

  it("does not infer an IPO allocation cost when its cash evidence chain is incomplete", () => {
    const result = buildCostReturnSummary([
      row({
        id: "incomplete-ipo",
        closeDate: "2026-09-16",
        netPnl: "50",
        positionEvents: [{
          id: "allocation",
          accountId: "acct",
          market: "US",
          symbol: "TEST",
          date: "2026-09-10",
          kind: "ipo",
          quantity: "100",
          amount: "10000",
          currency: "USD",
          description: "IPO allotment",
          source: [],
        }],
      }),
    ], completeFx);

    expect(result.applicableCount).toBe(0);
    expect(result.exclusionReasons).toEqual({ "incomplete-cost-evidence": 1 });
  });

  it("keeps original currency subtotals and leaves the ratio unavailable when cross-currency FX is incomplete", () => {
    const hkd = row({ id: "hkd", closeDate: "2026-09-10", netPnl: "86.06", grossExposure: "860.6" });
    hkd.row.item.episode.instrument = { ...instrument, id: "HK:TEST", market: "HK", currency: "HKD" };
    hkd.row.entry.instrument = hkd.row.item.episode.instrument;
    const usd = row({ id: "usd", closeDate: "2026-09-11", netPnl: "67.521", grossExposure: "675.21" });

    const result = buildCostReturnSummary([hkd, usd], {
      ...completeFx,
      status: "partial",
      rates: { "USD/CNY": "6.7521" },
    });

    expect(result.netPnl.originalByCurrency).toEqual({ HKD: "86.06", USD: "67.521" });
    expect(result.buyCost.originalByCurrency).toEqual({ HKD: "860.6", USD: "675.21" });
    expect(result.costReturnPercent).toBeNull();
    expect(result.netPnl.convertedCny).toBeNull();
    expect(result.buyCost.convertedCny).toBeNull();
  });

  it("returns natural-month win rates, weighted totals, and explicit no-sample gaps", () => {
    const rows = [
      row({ id: "jan-win", closeDate: "2026-01-20", netPnl: "10" }),
      row({ id: "jan-loss", closeDate: "2026-01-25", netPnl: "-5" }),
      row({ id: "feb-win-1", closeDate: "2026-02-01", netPnl: "1" }),
      row({ id: "feb-win-2", closeDate: "2026-02-02", netPnl: "2" }),
      row({ id: "feb-win-3", closeDate: "2026-02-03", netPnl: "3" }),
      row({ id: "feb-loss", closeDate: "2026-02-04", netPnl: "-1" }),
    ];

    const result = buildMonthlyWinRate(rows, range);

    expect(result.wins).toBe(4);
    expect(result.denominator).toBe(6);
    expect(result.ratePercent).toBe("66.6666666666666667");
    expect(result.points).toEqual([
      expect.objectContaining({ month: "2026-01", wins: 1, denominator: 2, ratePercent: "50", coverage: "partial" }),
      expect.objectContaining({ month: "2026-02", wins: 3, denominator: 4, ratePercent: "75", coverage: "full" }),
      expect.objectContaining({ month: "2026-03", wins: 0, denominator: 0, ratePercent: null, coverage: "partial" }),
    ]);
    expect(result.points[2].coverageLabel).toContain("无样本");
  });

  it("excludes unknown asset rows from monthly win rate", () => {
    const unknown = row({ id: "unknown-asset", closeDate: "2026-02-05", netPnl: "100" });
    unknown.assetCategory = "unknown";

    const result = buildMonthlyWinRate([unknown], range);

    expect(result.denominator).toBe(0);
    expect(result.wins).toBe(0);
    expect(result.points.find(point => point.month === "2026-02")?.ratePercent).toBeNull();
  });

  it("builds the main cost-return summary and monthly trend together", () => {
    const result = buildTradingRoomMetrics(
      [row({ id: "one", closeDate: "2026-09-10", netPnl: "100", grossExposure: "10000" })],
      { period: { ...range, startDate: "2026-09-01", endDate: "2026-09-19" }, fxSnapshot: completeFx },
    );

    expect(result.costReturn.applicableCount).toBe(1);
    expect(result.monthlyWinRate.denominator).toBe(1);
  });
});
