import Decimal from "decimal.js";

import {
  hasTrustedClosedMetrics,
  reviewQueueMarketLabel,
  type ReviewQueueItem,
} from "./review-queue";
import {
  aggregateDashboardRows,
  dashboardMarketGroup,
  dashboardMarketLabel,
  type DashboardExclusionReason,
} from "./dashboard";

export type ReviewQueueSummaryScope = {
  id: string;
  label: string;
  market: string;
  marketGroup?: string;
  actualMarkets?: string[];
  tradeNature: "live" | "simulation" | "unknown";
  simulationRunId: string | null;
  currency: string;
};

export type ReviewQueueSummaryGroup = ReviewQueueSummaryScope & {
  sampleCount: number;
  reviewedCount: number;
  trustedClosedCount: number;
  netPnl: string | null;
  wins: number;
  losses: number;
  breakEven: number;
  excludedCount: number;
  winRate: { wins: number; denominator: number } | null;
  averageWin: string | null;
  averageLoss: string | null;
  payoff: string | null;
  payoffReason: string | null;
  profitFactor: string | null;
  profitFactorReason: string | null;
  exclusionReasons: Partial<Record<DashboardExclusionReason, number>>;
};

export type ReviewQueueSummary = {
  sampleCount: number;
  reviewedCount: number;
  trustedClosedCount: number;
  netPnl: string | null;
  wins: number;
  losses: number;
  breakEven: number;
  excludedCount: number;
  winRate: { wins: number; denominator: number } | null;
  averageWin: string | null;
  averageLoss: string | null;
  payoff: string | null;
  payoffReason: string | null;
  profitFactor: string | null;
  profitFactorReason: string | null;
  exclusionReasons: Partial<Record<DashboardExclusionReason, number>>;
  groups: ReviewQueueSummaryGroup[];
  sharpe: { available: false; reason: "缺少资金净值与周期收益序列" };
};

function tradeNature(row: ReviewQueueItem): ReviewQueueSummaryScope["tradeNature"] {
  return row.entry.tradeNature ?? row.item.episode.tradeNature ?? "unknown";
}

function scopeFor(row: ReviewQueueItem): ReviewQueueSummaryScope {
  const episode = row.item.episode;
  const nature = tradeNature(row);
  const simulationRunId = episode.simulationRunId ?? row.entry.simulationRunId ?? null;
  const id = [
    dashboardMarketGroup(row.entry.instrument.market),
    nature,
    simulationRunId ?? "",
    row.entry.instrument.currency,
  ].map(encodeURIComponent).join(":");
  const label = scopeLabel({
    id,
    label: "",
    market: row.entry.instrument.market,
    tradeNature: nature,
    simulationRunId,
    currency: row.entry.instrument.currency,
  });
  return {
    id,
    label,
    market: row.entry.instrument.market,
    marketGroup: dashboardMarketGroup(row.entry.instrument.market),
    tradeNature: nature,
    simulationRunId,
    currency: row.entry.instrument.currency,
  };
}

function scopeLabel(scope: ReviewQueueSummaryScope) {
  const nature = scope.tradeNature === "live" ? "实盘" : scope.tradeNature === "simulation" ? "模拟盘" : "来源未知";
  const run = scope.simulationRunId ? ` · ${scope.simulationRunId}` : "";
  return `${reviewQueueMarketLabel(scope.market)} · ${nature}${run} · ${scope.currency}`;
}

function groupFor(scope: ReviewQueueSummaryScope, rows: ReviewQueueItem[]): ReviewQueueSummaryGroup {
  const trusted = rows.filter(({ item }) => hasTrustedClosedMetrics(item));
  const values = trusted.map(({ item }) => new Decimal(item.metrics.netPnl as string));
  const wins = values.filter(value => value.gt(0)).length;
  const losses = values.filter(value => value.lt(0)).length;
  const breakEven = values.filter(value => value.isZero()).length;
  const actualMarkets = [...new Set(rows.map(row => row.entry.instrument.market))].sort();
  const stats = aggregateDashboardRows(rows);
  const marketLabel = scope.marketGroup === "a-share" && actualMarkets.length > 1
    ? dashboardMarketLabel("a-share")
    : reviewQueueMarketLabel(scope.market);
  return {
    ...scope,
    label: `${marketLabel} · ${scope.tradeNature === "live" ? "实盘" : scope.tradeNature === "simulation" ? "模拟盘" : "来源未知"}${scope.simulationRunId ? ` · ${scope.simulationRunId}` : ""} · ${scope.currency}`,
    actualMarkets,
    sampleCount: rows.length,
    reviewedCount: rows.filter(({ item }) => item.review?.review.completed).length,
    trustedClosedCount: trusted.length,
    netPnl: trusted.length ? values.reduce((sum, value) => sum.plus(value), new Decimal(0)).toString() : null,
    wins,
    losses,
    breakEven,
    excludedCount: rows.length - trusted.length,
    winRate: trusted.length ? { wins, denominator: trusted.length } : null,
    averageWin: stats.averageWin,
    averageLoss: stats.averageLoss,
    payoff: stats.payoff,
    payoffReason: stats.payoffReason,
    profitFactor: stats.profitFactor,
    profitFactorReason: stats.profitFactorReason,
    exclusionReasons: stats.exclusionReasons,
  };
}

export function buildReviewQueueSummary(
  rows: ReviewQueueItem[],
  _options: { accountDisplayLabels?: ReadonlyMap<string, string> } = {},
): ReviewQueueSummary {
  void _options;
  const grouped = new Map<string, { scope: ReviewQueueSummaryScope; rows: ReviewQueueItem[] }>();
  for (const row of rows) {
    const scope = scopeFor(row);
    const current = grouped.get(scope.id);
    if (current) current.rows.push(row);
    else grouped.set(scope.id, { scope, rows: [row] });
  }
  const groups = [...grouped.values()]
    .map(({ scope, rows: groupRows }) => groupFor(scope, groupRows));
  const labeledGroups = groups
    .sort((left, right) => left.label.localeCompare(right.label, "zh-CN") || left.id.localeCompare(right.id));
  const trustedClosedCount = labeledGroups.reduce((sum, group) => sum + group.trustedClosedCount, 0);
  const wins = labeledGroups.reduce((sum, group) => sum + group.wins, 0);
  const losses = labeledGroups.reduce((sum, group) => sum + group.losses, 0);
  const breakEven = labeledGroups.reduce((sum, group) => sum + group.breakEven, 0);
  const singleGroup = labeledGroups.length === 1 ? labeledGroups[0] : undefined;
  return {
    sampleCount: rows.length,
    reviewedCount: rows.filter(({ item }) => item.review?.review.completed).length,
    trustedClosedCount,
    netPnl: singleGroup?.netPnl ?? null,
    wins,
    losses,
    breakEven,
    excludedCount: rows.length - trustedClosedCount,
    winRate: singleGroup?.winRate ?? null,
    averageWin: singleGroup?.averageWin ?? null,
    averageLoss: singleGroup?.averageLoss ?? null,
    payoff: singleGroup?.payoff ?? null,
    payoffReason: singleGroup?.payoffReason ?? null,
    profitFactor: singleGroup?.profitFactor ?? null,
    profitFactorReason: singleGroup?.profitFactorReason ?? null,
    exclusionReasons: labeledGroups.length === 1
      ? singleGroup?.exclusionReasons ?? {}
      : labeledGroups.reduce<Partial<Record<DashboardExclusionReason, number>>>((result, group) => {
          for (const [reason, count] of Object.entries(group.exclusionReasons)) {
            const key = reason as DashboardExclusionReason;
            result[key] = (result[key] ?? 0) + (count ?? 0);
          }
          return result;
        }, {}),
    groups: labeledGroups,
    sharpe: { available: false, reason: "缺少资金净值与周期收益序列" },
  };
}
