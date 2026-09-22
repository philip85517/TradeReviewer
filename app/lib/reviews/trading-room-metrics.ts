import Decimal from "decimal.js";

import { dashboardEpisodeDate, type DashboardExclusionReason } from "./dashboard";
import {
  buildRoomMoneyView,
  type RoomDateRange,
  type RoomFxSnapshot,
  type RoomMoneyView,
  type TradingRoomRow,
} from "./trading-room-scope";
import { resolveIpoAcquisitionCost } from "../trades/ipo-cost";
import { isExecutionBackedIpoAllocation } from "../import/statement-evidence";
import type { TradeEpisode } from "../trades/types";

export type CostReturnExclusionReason =
  | "not-closed"
  | "short-or-unknown-direction"
  | "pnl-unavailable"
  | "unknown-fees"
  | "history-incomplete"
  | "settlement-currency-mismatch"
  | "incomplete-cost-evidence"
  | "invalid-cost"
  | "unknown-asset";

export type CostReturnSummary = {
  /** Net PnL from the same applicable episode set used by buyCost. */
  netPnl: RoomMoneyView;
  /** Full opening buy cash cost from the same applicable episode set. */
  buyCost: RoomMoneyView;
  costReturnPercent: string | null;
  applicableCount: number;
  excludedCount: number;
  exclusionReasons: Readonly<Partial<Record<CostReturnExclusionReason, number>>>;
  includedEpisodeIds: readonly string[];
  excludedEpisodeIds: readonly string[];
  unavailableReason: string | null;
};

export type MonthlyWinRatePoint = {
  month: string;
  wins: number;
  denominator: number;
  ratePercent: string | null;
  coverage: "full" | "partial";
  coverageStartDate: string;
  coverageEndDate: string;
  coverageLabel: string;
};

export type MonthlyWinRateSummary = {
  points: readonly MonthlyWinRatePoint[];
  wins: number;
  denominator: number;
  ratePercent: string | null;
};

export type TradingRoomMetrics = {
  costReturn: CostReturnSummary;
  monthlyWinRate: MonthlyWinRateSummary;
};

export type TradeQualityCurrencySummary = {
  currency: string;
  sampleCount: number;
  wins: number;
  losses: number;
  breakEven: number;
  grossProfit: string;
  grossLoss: string;
  averageWin: string | null;
  averageLoss: string | null;
  payoffRatio: string | null;
  profitFactor: string | null;
  payoffReason: string | null;
  profitFactorReason: string | null;
};

export type TradeQualitySummary = TradeQualityCurrencySummary & {
  currencies: readonly TradeQualityCurrencySummary[];
  excludedCount: number;
  fxSnapshotId: string | null;
  comparable: boolean;
};

export type BuildTradingRoomMetricsOptions = {
  period: RoomDateRange;
  fxSnapshot?: RoomFxSnapshot;
};

type ParsedAmount = Decimal | null;

function decimal(value: string | number | null | undefined): ParsedAmount {
  if (value === null || value === undefined) return null;
  try {
    const parsed = new Decimal(value);
    return parsed.isFinite() ? parsed : null;
  } catch {
    return null;
  }
}

function currency(value: string | undefined): string {
  const normalized = value?.trim().toUpperCase() ?? "";
  if (normalized === "人民币" || normalized === "RMB") return "CNY";
  if (normalized === "港币" || normalized === "HK$") return "HKD";
  if (normalized === "美元" || normalized === "US$") return "USD";
  return normalized;
}

function reasonFromDashboard(reason: string | null | undefined): CostReturnExclusionReason | null {
  switch (reason as DashboardExclusionReason | null | undefined) {
    case "open": return "not-closed";
    case "unknown-fees": return "unknown-fees";
    case "currency-conversion": return "settlement-currency-mismatch";
    case "history-incomplete": return "history-incomplete";
    case "pnl-unavailable":
    case "missing-pnl": return "pnl-unavailable";
    default: return null;
  }
}

function reasonFromAccuracy(episode: TradeEpisode): CostReturnExclusionReason | null {
  const reasons = episode.accuracy?.reasons ?? [];
  if (reasons.includes("unknown-fees")) return "unknown-fees";
  if (reasons.includes("history-incomplete")) return "history-incomplete";
  if (reasons.includes("currency-conflict")) return "settlement-currency-mismatch";
  if (reasons.some(reason => [
    "initial-position",
    "unknown-cost",
    "position-event",
    "position-gap",
    "ambiguous-opening",
    "ambiguous-event-order",
  ].includes(reason))) return "incomplete-cost-evidence";
  return reasons.length > 0 ? "pnl-unavailable" : null;
}

function isPositive(value: string | number | null | undefined): boolean {
  const parsed = decimal(value);
  return parsed !== null && parsed.gt(0);
}

function hasValidBuyEvidence(episode: TradeEpisode): CostReturnExclusionReason | null {
  for (const execution of episode.executions) {
    if (execution.source.feeStatus === "unknown") return "unknown-fees";
    if (execution.source.historyIncomplete?.length) return "history-incomplete";
    if (execution.source.settlement && currency(execution.source.settlement.currency) !== currency(execution.instrument.currency)) {
      return "settlement-currency-mismatch";
    }
  }

  const buys = episode.executions.filter(execution => execution.side === "buy");
  if (buys.length === 0) return null;
  for (const execution of buys) {
    if (!isPositive(execution.quantity)) return "invalid-cost";
    const settlement = execution.source.settlement;
    if (settlement) {
      if (!isPositive(settlement.quantity) || !isPositive(settlement.grossAmount)) return "invalid-cost";
    } else if (!isPositive(execution.price)) {
      return "invalid-cost";
    }
  }
  return null;
}

function hasCompleteIpoEvidence(episode: TradeEpisode): boolean {
  const events = episode.positionEvents ?? [];
  const allocations = events.filter(event => event.kind === "ipo" && isPositive(event.quantity));
  if (allocations.length === 0) return false;
  const evidence = episode.ipoCostEvidence ?? [];
  const evidenceIds = new Set(events.map(event => event.id));
  return allocations.every(allocation => {
    if (isExecutionBackedIpoAllocation(allocation, episode.executions)) return true;
    const chain = evidence.find(item => item.allocationId === allocation.id);
    if (!chain || chain.evidenceIds.some(id => !evidenceIds.has(id))) return false;
    return resolveIpoAcquisitionCost(
      allocation,
      events,
      episode.executions,
      episode.instrument.currency,
    ) !== undefined;
  });
}

function costEvidenceReason(row: TradingRoomRow): CostReturnExclusionReason | null {
  const episode = row.row.item.episode;
  const metrics = row.row.item.metrics;
  if (row.assetCategory === "unknown") return "unknown-asset";
  if (episode.status !== "closed" || !isZero(episode.remainingQuantity)) return "not-closed";
  if (episode.direction !== "long" || episode.directionKnown === false) return "short-or-unknown-direction";
  const executionReason = hasValidBuyEvidence(episode);
  if (executionReason) return executionReason;
  const accuracyReason = reasonFromAccuracy(episode);
  if (accuracyReason) return accuracyReason;
  if (episode.initialPosition) return "incomplete-cost-evidence";
  const positionEvents = episode.positionEvents ?? [];
  if (positionEvents.some(event => event.kind !== "ipo" && event.kind !== "fee")) return "incomplete-cost-evidence";
  const hasBuyExecution = episode.executions.some(execution => execution.side === "buy");
  if (!hasBuyExecution && !positionEvents.some(event => event.kind === "ipo")) return "incomplete-cost-evidence";
  if (positionEvents.some(event => event.kind === "ipo") && !hasCompleteIpoEvidence(episode)) {
    return "incomplete-cost-evidence";
  }
  if (metrics.pnlAvailable === false || metrics.netPnl === null || row.trustedPnl === null) {
    return reasonFromDashboard(row.exclusionReason) ?? "pnl-unavailable";
  }
  const netPnl = decimal(row.trustedPnl);
  if (netPnl === null) return "pnl-unavailable";
  const grossExposure = decimal(metrics.grossExposure);
  if (grossExposure === null || !grossExposure.gt(0)) return "invalid-cost";
  return null;
}

function isZero(value: string | undefined): boolean {
  const parsed = decimal(value);
  return parsed !== null && parsed.isZero();
}

function emptyReasons(): Partial<Record<CostReturnExclusionReason, number>> {
  return {};
}

function ratioPercent(netPnl: RoomMoneyView, buyCost: RoomMoneyView): string | null {
  const netCurrencies = Object.keys(netPnl.originalByCurrency);
  const costCurrencies = Object.keys(buyCost.originalByCurrency);
  if (netCurrencies.length === 1 && costCurrencies.length === 1 && netCurrencies[0] === costCurrencies[0]) {
    const numerator = decimal(netPnl.originalByCurrency[netCurrencies[0]]);
    const denominator = decimal(buyCost.originalByCurrency[costCurrencies[0]]);
    if (numerator && denominator?.gt(0)) return percentage(numerator, denominator);
  }
  if (netPnl.convertedCny === null || buyCost.convertedCny === null) return null;
  const numerator = decimal(netPnl.convertedCny);
  const denominator = decimal(buyCost.convertedCny);
  if (!numerator || !denominator || !denominator.gt(0)) return null;
  return percentage(numerator, denominator);
}

function percentage(numerator: Decimal, denominator: Decimal): string {
  return numerator.div(denominator).times(100).toDecimalPlaces(16).toString();
}

function unavailableReason(
  summary: Pick<CostReturnSummary, "applicableCount" | "buyCost" | "costReturnPercent">,
): string | null {
  if (summary.applicableCount === 0) return "没有完整、可核验的已平仓回合样本";
  if (summary.buyCost.convertedCny === null && summary.costReturnPercent === null) {
    const currencies = Object.keys(summary.buyCost.originalByCurrency);
    if (currencies.length > 1) return "缺少完整汇率快照，无法合计跨币种比例";
  }
  if (summary.costReturnPercent === null) return "成本分母不可用";
  return null;
}

export function buildCostReturnSummary(
  rows: readonly TradingRoomRow[],
  fxSnapshot?: RoomFxSnapshot,
): CostReturnSummary {
  const pnlAmounts: Array<{ currency: string; amount: string }> = [];
  const costAmounts: Array<{ currency: string; amount: string }> = [];
  const includedEpisodeIds: string[] = [];
  const excludedEpisodeIds: string[] = [];
  const exclusionReasons = emptyReasons();

  for (const row of rows) {
    const reason = costEvidenceReason(row);
    if (reason) {
      excludedEpisodeIds.push(row.row.item.episode.id);
      exclusionReasons[reason] = (exclusionReasons[reason] ?? 0) + 1;
      continue;
    }
    const netPnl = row.trustedPnl;
    const grossExposure = row.row.item.metrics.grossExposure;
    if (netPnl === null) {
      excludedEpisodeIds.push(row.row.item.episode.id);
      exclusionReasons["pnl-unavailable"] = (exclusionReasons["pnl-unavailable"] ?? 0) + 1;
      continue;
    }
    const rowCurrency = currency(row.row.item.episode.instrument.currency);
    pnlAmounts.push({ currency: rowCurrency, amount: netPnl });
    costAmounts.push({ currency: rowCurrency, amount: grossExposure });
    includedEpisodeIds.push(row.row.item.episode.id);
  }

  const netPnl = buildRoomMoneyView(pnlAmounts, fxSnapshot);
  const buyCost = buildRoomMoneyView(costAmounts, fxSnapshot);
  const costReturnPercent = ratioPercent(netPnl, buyCost);
  const base = {
    netPnl,
    buyCost,
    costReturnPercent,
    applicableCount: includedEpisodeIds.length,
    excludedCount: excludedEpisodeIds.length,
    exclusionReasons,
    includedEpisodeIds,
    excludedEpisodeIds,
  };
  return {
    ...base,
    unavailableReason: unavailableReason(base),
  };
}

function dateKey(value: string | null | undefined): string | null {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function rowCloseDate(row: TradingRoomRow): string | null {
  return dateKey(row.closeDate) ?? dateKey(dashboardEpisodeDate(row.row));
}

function monthStart(value: string): string {
  return `${value.slice(0, 7)}-01`;
}

function addMonth(value: string): string {
  const date = new Date(`${monthStart(value)}T00:00:00.000Z`);
  date.setUTCMonth(date.getUTCMonth() + 1);
  return date.toISOString().slice(0, 10);
}

function lastDayOfMonth(value: string): string {
  const date = new Date(`${monthStart(value)}T00:00:00.000Z`);
  date.setUTCMonth(date.getUTCMonth() + 1);
  date.setUTCDate(0);
  return date.toISOString().slice(0, 10);
}

function monthCoverage(month: string, period: RoomDateRange): { start: string; end: string; coverage: "full" | "partial" } {
  const start = period.startDate > monthStart(month) ? period.startDate : monthStart(month);
  const endOfMonth = lastDayOfMonth(month);
  const end = period.endDate < endOfMonth ? period.endDate : endOfMonth;
  return {
    start,
    end,
    coverage: start === monthStart(month) && end === endOfMonth ? "full" : "partial",
  };
}

export function buildMonthlyWinRate(
  rows: readonly TradingRoomRow[],
  period: RoomDateRange,
): MonthlyWinRateSummary {
  const points: MonthlyWinRatePoint[] = [];
  let month = monthStart(period.startDate);
  const finalMonth = monthStart(period.endDate);
  let wins = 0;
  let denominator = 0;
  while (month <= finalMonth) {
    const coverage = monthCoverage(month, period);
    let pointWins = 0;
    let pointDenominator = 0;
    for (const row of rows) {
      if (row.assetCategory === "unknown" || row.trustedPnl === null || row.row.item.episode.status !== "closed") continue;
      const closeDate = rowCloseDate(row);
      if (!closeDate || closeDate < coverage.start || closeDate > coverage.end) continue;
      const pnl = decimal(row.trustedPnl);
      if (pnl === null) continue;
      pointDenominator += 1;
      if (pnl.gt(0)) pointWins += 1;
    }
    wins += pointWins;
    denominator += pointDenominator;
    const ratePercent = pointDenominator > 0
      ? percentage(new Decimal(pointWins), new Decimal(pointDenominator))
      : null;
    const coverageLabel = pointDenominator === 0
      ? `${coverage.start} 至 ${coverage.end} · 无样本`
      : coverage.coverage === "full"
        ? "完整自然月"
        : `覆盖 ${coverage.start} 至 ${coverage.end}`;
    points.push({
      month: month.slice(0, 7),
      wins: pointWins,
      denominator: pointDenominator,
      ratePercent,
      coverage: coverage.coverage,
      coverageStartDate: coverage.start,
      coverageEndDate: coverage.end,
      coverageLabel,
    });
    month = addMonth(month);
  }
  return {
    points,
    wins,
    denominator,
    ratePercent: denominator > 0
      ? percentage(new Decimal(wins), new Decimal(denominator))
      : null,
  };
}

function qualityReason(kind: "payoff" | "profitFactor", wins: number, losses: number): string | null {
  if (wins === 0) return kind === "payoff" ? "无盈利样本，无法计算盈亏比" : "无盈利样本，无法计算利润因子";
  if (losses === 0) return kind === "payoff" ? "无亏损样本，无法计算盈亏比" : "无亏损样本，无法计算利润因子";
  return null;
}

function buildCurrencyQuality(currencyCode: string, values: readonly Decimal[]): TradeQualityCurrencySummary {
  const wins = values.filter(value => value.gt(0));
  const losses = values.filter(value => value.lt(0)).map(value => value.abs());
  const breakEven = values.length - wins.length - losses.length;
  const grossProfit = wins.reduce((sum, value) => sum.plus(value), new Decimal(0));
  const grossLoss = losses.reduce((sum, value) => sum.plus(value), new Decimal(0));
  const averageWin = wins.length ? grossProfit.div(wins.length).toString() : null;
  const averageLoss = losses.length ? grossLoss.div(losses.length).toString() : null;
  const payoffRatio = averageWin !== null && averageLoss !== null && !new Decimal(averageLoss).isZero()
    ? new Decimal(averageWin).div(averageLoss).toString()
    : null;
  const profitFactor = wins.length > 0 && losses.length > 0 && !grossLoss.isZero()
    ? grossProfit.div(grossLoss).toString()
    : null;
  return {
    currency: currencyCode,
    sampleCount: values.length,
    wins: wins.length,
    losses: losses.length,
    breakEven,
    grossProfit: grossProfit.toString(),
    grossLoss: grossLoss.toString(),
    averageWin,
    averageLoss,
    payoffRatio,
    profitFactor,
    payoffReason: payoffRatio === null ? qualityReason("payoff", wins.length, losses.length) : null,
    profitFactorReason: profitFactor === null ? qualityReason("profitFactor", wins.length, losses.length) : null,
  };
}

/** Build quality metrics from the full trusted, known-asset, closed-round sample. */
export function buildTradeQualitySummary(
  rows: readonly TradingRoomRow[],
  fxSnapshot?: RoomFxSnapshot,
): TradeQualitySummary {
  const trustedAmounts = rows
    .filter(row => row.assetCategory !== "unknown" && row.row.item.episode.status === "closed" && row.trustedPnl !== null)
    .map(row => ({ currency: row.row.item.episode.instrument.currency, amount: row.trustedPnl }));
  const trustedViews = trustedAmounts.map(amount => buildRoomMoneyView([amount], fxSnapshot));
  const trustedMoney = trustedViews.length > 0 && trustedViews.every(view => view.convertedCny !== null)
    ? buildRoomMoneyView(trustedAmounts, fxSnapshot)
    : buildRoomMoneyView(trustedAmounts, undefined);
  const grouped = new Map<string, Decimal[]>();
  for (const row of rows) {
    if (row.assetCategory === "unknown" || row.row.item.episode.status !== "closed" || row.trustedPnl === null) continue;
    const value = decimal(row.trustedPnl);
    if (!value) continue;
    const code = currency(row.row.item.episode.instrument.currency);
    const bucket = grouped.get(code) ?? [];
    bucket.push(value);
    grouped.set(code, bucket);
  }
  const currencies = [...grouped.keys()].sort().map(code => buildCurrencyQuality(code, grouped.get(code) ?? []));
  const comparable = currencies.length <= 1 || trustedMoney.convertedCny !== null;
  const primary = currencies.length === 1 ? currencies[0] : (() => {
    if (!comparable) return buildCurrencyQuality("CNY", []);
    return buildCurrencyQuality("CNY", trustedViews.flatMap(view => {
      const value = decimal(view.convertedCny);
      return value ? [value] : [];
    }));
  })();
  const excludedCount = rows.filter(row => row.assetCategory !== "unknown" && row.row.item.episode.status === "closed" && row.trustedPnl === null).length;
  return {
    ...primary,
    currencies,
    excludedCount,
    fxSnapshotId: fxSnapshot?.id ?? null,
    comparable,
  };
}

export function buildTradingRoomMetrics(
  rows: readonly TradingRoomRow[],
  options: BuildTradingRoomMetricsOptions,
): TradingRoomMetrics {
  return {
    costReturn: buildCostReturnSummary(rows, options.fxSnapshot),
    monthlyWinRate: buildMonthlyWinRate(rows, options.period),
  };
}
