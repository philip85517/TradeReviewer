import Decimal from "decimal.js";

import type { FxSnapshot } from "../fx/contracts";
import {
  hasSettlementCurrencyMismatch,
  tradeNatureOf as executionTradeNatureOf,
  type TradeNature,
} from "../trades/types";
import type { ReviewQueueItem } from "./review-queue";

/** Reasons are split between closed-PnL coverage and weighted-return coverage. */
export type LibraryPerformanceExclusionReason =
  | "open"
  | "unknown-fees"
  | "currency-conversion"
  | "history-incomplete"
  | "accuracy"
  | "pnl-unavailable"
  | "missing-pnl"
  | "invalid-pnl"
  | "invalid-exposure"
  | "missing-fx"
  | "invalid-fx";

export type LibraryPerformanceExclusions = Partial<
  Record<LibraryPerformanceExclusionReason, number>
>;

export type LibraryPerformanceScope = {
  key: string;
  tradeNature: TradeNature;
  simulationRunId: string | null;
};

export type LibraryPerformanceMetricSet = {
  /** Sum of trusted, closed, finite net PnL values in this metric's currency. */
  netPnl: string | null;
  /** Sum of opening exposure from the weighted-return sample only. */
  grossExposure: string | null;
  /** `returnSampleNetPnl / grossExposure * 100`. */
  weightedReturn: string | null;
  /** PnL numerator restricted to the same rows used by weightedReturn. */
  returnSampleNetPnl: string | null;
  /** Number of rows contributing to netPnl. */
  netPnlSampleCount: number;
  /** Number of rows contributing to both returnSampleNetPnl and grossExposure. */
  returnSampleCount: number;
  wins: number;
  losses: number;
  breakEven: number;
  winRate: { wins: number; denominator: number } | null;
  grossProfit: string | null;
  grossLoss: string | null;
  averageWin: string | null;
  averageLoss: string | null;
  payoff: string | null;
  payoffReason: string | null;
  profitFactor: string | null;
  profitFactorReason: string | null;
  /** Rows excluded from netPnl and their first applicable reason. */
  excludedCount: number;
  exclusionReasons: LibraryPerformanceExclusions;
  /** Rows excluded from weightedReturn and their first applicable reason. */
  returnExcludedCount: number;
  returnExclusionReasons: LibraryPerformanceExclusions;
};

export type LibraryPerformanceCurrencyGroup = LibraryPerformanceMetricSet & {
  key: string;
  currency: string;
  tradeNature: TradeNature;
  simulationRunId: string | null;
  sampleCount: number;
  closedCount: number;
  openCount: number;
};

export type LibraryPerformanceComparableGroup = LibraryPerformanceMetricSet & {
  key: string;
  currency: "CNY";
  tradeNature: TradeNature;
  simulationRunId: string | null;
  sourceCurrencies: string[];
  sampleCount: number;
  closedCount: number;
  openCount: number;
};

export type LibraryPerformanceCnySummary = LibraryPerformanceComparableGroup & {
  available: boolean;
  /** Why a single CNY metric cannot be displayed, when it is unavailable. */
  reason: "empty" | "multiple-scopes" | "missing-fx" | "no-trusted-closed" | null;
  scopeCount: number;
};

export type LibraryPerformanceOpenGroup = {
  key: string;
  currency: string;
  tradeNature: TradeNature;
  simulationRunId: string | null;
  count: number;
  withUnrealizedPnl: number;
  unavailable: number;
  unrealizedPnl: string | null;
};

export type LibraryPerformanceOpen = {
  count: number;
  withUnrealizedPnl: number;
  unavailable: number;
  /** Set only when all open rows share one raw currency/nature/run scope. */
  unrealizedPnl: string | null;
  groups: LibraryPerformanceOpenGroup[];
};

export type LibraryPerformanceSampleCoverage = {
  total: number;
  closed: number;
  open: number;
  trustedClosed: number;
  /** Raw-currency return coverage, before FX availability is considered. */
  returnEligible: number;
  /** Rows with trusted finite closed PnL after applying FX per comparable group. */
  cnyNetPnlEligible: number;
  /** Rows with valid PnL, valid positive exposure, and FX per comparable group. */
  cnyReturnEligible: number;
  excluded: number;
  returnExcluded: number;
};

export type LibraryPerformanceSummary = {
  sample: LibraryPerformanceSampleCoverage;
  rawCurrencyGroups: LibraryPerformanceCurrencyGroup[];
  /** One group per nature/run scope; no values are combined across runs. */
  comparableGroups: LibraryPerformanceComparableGroup[];
  /** Top-level CNY metric, available only when all rows share one nature/run scope. */
  cny: LibraryPerformanceCnySummary;
  open: LibraryPerformanceOpen;
};

type Assessment = {
  row: ReviewQueueItem;
  currency: string;
  scope: LibraryPerformanceScope;
  pnl: Decimal | null;
  exposure: Decimal | null;
  closedPnlReason?: LibraryPerformanceExclusionReason;
  exposureReason?: LibraryPerformanceExclusionReason;
  unrealizedPnl: Decimal | null;
};

type Conversion = {
  rate: Decimal | null;
  reason?: "missing-fx" | "invalid-fx";
};

const EMPTY_METRIC_SET: LibraryPerformanceMetricSet = {
  netPnl: null,
  grossExposure: null,
  weightedReturn: null,
  returnSampleNetPnl: null,
  netPnlSampleCount: 0,
  returnSampleCount: 0,
  wins: 0,
  losses: 0,
  breakEven: 0,
  winRate: null,
  grossProfit: null,
  grossLoss: null,
  averageWin: null,
  averageLoss: null,
  payoff: null,
  payoffReason: null,
  profitFactor: null,
  profitFactorReason: null,
  excludedCount: 0,
  exclusionReasons: {},
  returnExcludedCount: 0,
  returnExclusionReasons: {},
};

function normalizedCurrency(value: string | undefined): string {
  const currency = value?.trim().toUpperCase() ?? "";
  if (currency === "人民币" || currency === "RMB") return "CNY";
  if (currency === "港币" || currency === "HK$" || currency === "HKD") return "HKD";
  if (currency === "美元" || currency === "US$" || currency === "USD") return "USD";
  return currency || "UNKNOWN";
}

function parseDecimal(value: string | null | undefined): Decimal | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  try {
    const parsed = new Decimal(value);
    return parsed.isFinite() ? parsed : null;
  } catch {
    return null;
  }
}

function tradeNatureOf(row: ReviewQueueItem): TradeNature {
  return row.entry.tradeNature ??
    row.item.episode.tradeNature ??
    (row.item.episode.executions[0]
      ? executionTradeNatureOf(row.item.episode.executions[0])
      : undefined) ??
    "unknown";
}

function simulationRunIdOf(row: ReviewQueueItem): string | null {
  return row.item.episode.simulationRunId ??
    row.entry.simulationRunId ??
    row.item.episode.executions[0]?.source.simulationRunId ??
    null;
}

function encodePart(value: string): string {
  return encodeURIComponent(value);
}

function scopeOf(row: ReviewQueueItem): LibraryPerformanceScope {
  const tradeNature = tradeNatureOf(row);
  const simulationRunId = simulationRunIdOf(row);
  return {
    key: `${encodePart(tradeNature)}|${encodePart(simulationRunId ?? "")}`,
    tradeNature,
    simulationRunId,
  };
}

function increment(
  reasons: LibraryPerformanceExclusions,
  reason: LibraryPerformanceExclusionReason,
) {
  reasons[reason] = (reasons[reason] ?? 0) + 1;
}

function closedPnlExclusionReason(row: ReviewQueueItem): LibraryPerformanceExclusionReason {
  const episode = row.item.episode;
  const executions = episode.executions;
  if (executions.some(execution => execution.source.feeStatus === "unknown")) return "unknown-fees";
  if (executions.some(execution => (execution.source.historyIncomplete?.length ?? 0) > 0)) return "history-incomplete";
  if (executions.some(hasSettlementCurrencyMismatch)) return "currency-conversion";
  if (episode.accuracy?.reasons.length) return "accuracy";
  return row.item.metrics.pnlAvailable === false ? "pnl-unavailable" : "missing-pnl";
}

function assess(row: ReviewQueueItem): Assessment {
  const episode = row.item.episode;
  const metrics = row.item.metrics;
  const currency = normalizedCurrency(episode.instrument.currency || row.entry.instrument.currency);
  const scope = scopeOf(row);
  const unrealizedPnl = episode.status === "open" && metrics.pnlAvailable !== false
    ? parseDecimal(metrics.unrealizedPnl)
    : null;
  if (episode.status === "open") {
    return {
      row,
      currency,
      scope,
      pnl: null,
      exposure: parseDecimal(metrics.grossExposure),
      closedPnlReason: "open",
      unrealizedPnl,
    };
  }
  if (metrics.pnlAvailable === false) {
    return {
      row,
      currency,
      scope,
      pnl: null,
      exposure: parseDecimal(metrics.grossExposure),
      closedPnlReason: closedPnlExclusionReason(row),
      unrealizedPnl,
    };
  }
  const pnl = parseDecimal(metrics.netPnl);
  const exposure = parseDecimal(metrics.grossExposure);
  return {
    row,
    currency,
    scope,
    pnl,
    exposure,
    ...(pnl === null
      ? { closedPnlReason: metrics.netPnl === null ? "missing-pnl" as const : "invalid-pnl" as const }
      : {}),
    ...(pnl !== null && (!exposure || !exposure.gt(0))
      ? { exposureReason: "invalid-exposure" as const }
      : {}),
    unrealizedPnl,
  };
}

function fxConversion(currency: string, snapshot?: FxSnapshot): Conversion {
  if (currency === "CNY") return { rate: new Decimal(1) };
  if (!snapshot) return { rate: null, reason: "missing-fx" };
  const rates = snapshot.rates;
  if (!rates || typeof rates !== "object") return { rate: null, reason: "invalid-fx" };
  const rawRate = (rates as Readonly<Record<string, unknown>>)[currency];
  if (typeof rawRate !== "number" || !Number.isFinite(rawRate) || rawRate <= 0) {
    return { rate: null, reason: "invalid-fx" };
  }
  return { rate: new Decimal(rawRate) };
}

function reasonText(kind: "payoff" | "profitFactor", wins: number, losses: number): string {
  if (wins === 0) return kind === "payoff" ? "无盈利样本，无法计算盈亏比" : "无盈利样本，无法计算利润因子";
  if (losses === 0) return kind === "payoff" ? "无亏损样本，无法计算盈亏比" : "无亏损样本，无法计算利润因子";
  return "可计算样本不足，无法计算" + (kind === "payoff" ? "盈亏比" : "利润因子");
}

function calculateMetricSet(
  assessments: Assessment[],
  options: { toCny: boolean; snapshot?: FxSnapshot } = { toCny: false },
): LibraryPerformanceMetricSet {
  const metrics: LibraryPerformanceMetricSet = {
    ...EMPTY_METRIC_SET,
    exclusionReasons: {},
    returnExclusionReasons: {},
  };
  let net = new Decimal(0);
  let returnNet = new Decimal(0);
  let exposure = new Decimal(0);
  let grossProfit = new Decimal(0);
  let grossLoss = new Decimal(0);
  let positiveCount = 0;
  let negativeCount = 0;
  let breakEvenCount = 0;
  for (const assessment of assessments) {
    const isClosed = assessment.row.item.episode.status === "closed";
    const conversion = options.toCny
      ? fxConversion(assessment.currency, options.snapshot)
      : { rate: new Decimal(1) };
    let trustedForMetric = false;
    let convertedPnl: Decimal | null = null;

    if (!isClosed) {
      increment(metrics.exclusionReasons, "open");
      increment(metrics.returnExclusionReasons, "open");
    } else if (assessment.pnl === null || assessment.closedPnlReason) {
      const reason = assessment.closedPnlReason ?? "invalid-pnl";
      increment(metrics.exclusionReasons, reason);
      increment(metrics.returnExclusionReasons, reason);
    } else if (!conversion.rate) {
      const reason = conversion.reason ?? "missing-fx";
      increment(metrics.exclusionReasons, reason);
      increment(metrics.returnExclusionReasons, reason);
    } else {
      trustedForMetric = true;
      convertedPnl = assessment.pnl.times(conversion.rate);
      metrics.netPnlSampleCount += 1;
      net = net.plus(convertedPnl);
      if (convertedPnl.gt(0)) {
        positiveCount += 1;
        grossProfit = grossProfit.plus(convertedPnl);
      } else if (convertedPnl.lt(0)) {
        negativeCount += 1;
        grossLoss = grossLoss.plus(convertedPnl.abs());
      } else {
        breakEvenCount += 1;
      }
    }

    const validExposure = assessment.exposure !== null && assessment.exposure.gt(0);
    if (trustedForMetric && validExposure && conversion.rate && convertedPnl) {
      const convertedExposure = assessment.exposure!.times(conversion.rate);
      if (convertedExposure.isFinite() && convertedExposure.gt(0)) {
        metrics.returnSampleCount += 1;
        returnNet = returnNet.plus(convertedPnl);
        exposure = exposure.plus(convertedExposure);
        continue;
      }
      increment(metrics.returnExclusionReasons, "invalid-exposure");
      continue;
    }

    if (trustedForMetric) {
      if (!conversion.rate) {
        increment(metrics.returnExclusionReasons, conversion.reason ?? "missing-fx");
      } else {
        increment(metrics.returnExclusionReasons, assessment.exposureReason ?? "invalid-exposure");
      }
    }
  }

  metrics.netPnl = metrics.netPnlSampleCount > 0 ? net.toString() : null;
  metrics.grossExposure = metrics.returnSampleCount > 0 ? exposure.toString() : null;
  metrics.returnSampleNetPnl = metrics.returnSampleCount > 0 ? returnNet.toString() : null;
  metrics.weightedReturn = metrics.returnSampleCount > 0 && exposure.gt(0)
    ? returnNet.div(exposure).times(100).toString()
    : null;
  metrics.wins = positiveCount;
  metrics.losses = negativeCount;
  metrics.breakEven = breakEvenCount;
  const denominator = positiveCount + negativeCount + breakEvenCount;
  metrics.winRate = denominator > 0 ? { wins: positiveCount, denominator } : null;
  metrics.grossProfit = metrics.netPnlSampleCount > 0 ? grossProfit.toString() : null;
  metrics.grossLoss = metrics.netPnlSampleCount > 0 ? grossLoss.toString() : null;
  metrics.averageWin = positiveCount > 0 ? grossProfit.div(positiveCount).toString() : null;
  metrics.averageLoss = negativeCount > 0 ? grossLoss.div(negativeCount).toString() : null;
  metrics.payoff = positiveCount > 0 && negativeCount > 0 && !grossLoss.isZero()
    ? grossProfit.div(positiveCount).div(grossLoss.div(negativeCount)).toString()
    : null;
  metrics.payoffReason = metrics.payoff === null
    ? reasonText("payoff", positiveCount, negativeCount)
    : null;
  metrics.profitFactor = negativeCount > 0 && !grossLoss.isZero()
    ? grossProfit.div(grossLoss).toString()
    : null;
  metrics.profitFactorReason = metrics.profitFactor === null
    ? reasonText("profitFactor", positiveCount, negativeCount)
    : null;
  metrics.excludedCount = assessments.length - metrics.netPnlSampleCount;
  metrics.returnExcludedCount = assessments.length - metrics.returnSampleCount;
  return metrics;
}

function groupAssessments(
  assessments: Assessment[],
  keyFor: (assessment: Assessment) => string,
) {
  const groups = new Map<string, Assessment[]>();
  for (const assessment of assessments) {
    const key = keyFor(assessment);
    const group = groups.get(key);
    if (group) group.push(assessment);
    else groups.set(key, [assessment]);
  }
  return groups;
}

function rawGroup(
  key: string,
  assessments: Assessment[],
): LibraryPerformanceCurrencyGroup {
  const first = assessments[0];
  const metrics = calculateMetricSet(assessments);
  return {
    key,
    currency: first.currency,
    tradeNature: first.scope.tradeNature,
    simulationRunId: first.scope.simulationRunId,
    sampleCount: assessments.length,
    closedCount: assessments.filter(({ row }) => row.item.episode.status === "closed").length,
    openCount: assessments.filter(({ row }) => row.item.episode.status === "open").length,
    ...metrics,
  };
}

function comparableGroup(
  key: string,
  assessments: Assessment[],
  snapshot?: FxSnapshot,
): LibraryPerformanceComparableGroup {
  const first = assessments[0];
  const metrics = calculateMetricSet(assessments, { toCny: true, snapshot });
  return {
    key,
    currency: "CNY",
    tradeNature: first.scope.tradeNature,
    simulationRunId: first.scope.simulationRunId,
    sourceCurrencies: [...new Set(assessments.map(assessment => assessment.currency))].sort(),
    sampleCount: assessments.length,
    closedCount: assessments.filter(({ row }) => row.item.episode.status === "closed").length,
    openCount: assessments.filter(({ row }) => row.item.episode.status === "open").length,
    ...metrics,
  };
}

function blankCnySummary(
  assessments: Assessment[],
  reason: LibraryPerformanceCnySummary["reason"],
  scopeCount: number,
): LibraryPerformanceCnySummary {
  const sample = assessments.length;
  const closed = assessments.filter(({ row }) => row.item.episode.status === "closed").length;
  const open = sample - closed;
  const first = assessments[0];
  return {
    key: "cny",
    currency: "CNY",
    tradeNature: first?.scope.tradeNature ?? "unknown",
    simulationRunId: first?.scope.simulationRunId ?? null,
    sourceCurrencies: [...new Set(assessments.map(assessment => assessment.currency))].sort(),
    sampleCount: sample,
    closedCount: closed,
    openCount: open,
    ...EMPTY_METRIC_SET,
    exclusionReasons: {},
    returnExclusionReasons: {},
    available: false,
    reason,
    scopeCount,
  };
}

function openGroup(
  key: string,
  assessments: Assessment[],
): LibraryPerformanceOpenGroup {
  const first = assessments[0];
  const withUnrealized = assessments.filter(({ unrealizedPnl }) => unrealizedPnl !== null);
  const total = withUnrealized.reduce(
    (sum, assessment) => sum.plus(assessment.unrealizedPnl!),
    new Decimal(0),
  );
  return {
    key,
    currency: first.currency,
    tradeNature: first.scope.tradeNature,
    simulationRunId: first.scope.simulationRunId,
    count: assessments.length,
    withUnrealizedPnl: withUnrealized.length,
    unavailable: assessments.length - withUnrealized.length,
    unrealizedPnl: withUnrealized.length > 0 ? total.toString() : null,
  };
}

/**
 * Summarize a queue slice without changing trade facts. Closed PnL comes from
 * summarizeTradeEpisode's trusted metrics; this layer only selects samples,
 * converts one immutable FX snapshot, and aggregates the selected values.
 */
export function summarizeLibraryPerformance(
  rows: ReviewQueueItem[],
  fxSnapshot?: FxSnapshot,
): LibraryPerformanceSummary {
  const assessments = rows.map(assess);
  const rawCurrencyGroups = [...groupAssessments(
    assessments,
    assessment => `${assessment.scope.key}|${encodePart(assessment.currency)}`,
  ).entries()]
    .map(([key, group]) => rawGroup(key, group))
    .sort((left, right) => left.key.localeCompare(right.key));
  const comparableGroups = [...groupAssessments(assessments, assessment => assessment.scope.key).entries()]
    .map(([key, group]) => comparableGroup(key, group, fxSnapshot))
    .sort((left, right) => left.key.localeCompare(right.key));

  let cny: LibraryPerformanceCnySummary;
  if (comparableGroups.length === 0) {
    cny = blankCnySummary(assessments, "empty", 0);
  } else if (comparableGroups.length > 1) {
    cny = blankCnySummary(assessments, "multiple-scopes", comparableGroups.length);
  } else {
    const group = comparableGroups[0];
    const unavailableReason = group.netPnlSampleCount === 0
      ? group.exclusionReasons["missing-fx"] !== undefined || group.exclusionReasons["invalid-fx"] !== undefined
        ? "missing-fx" as const
        : "no-trusted-closed" as const
      : null;
    cny = {
      ...group,
      available: unavailableReason === null,
      reason: unavailableReason,
      scopeCount: 1,
    };
  }

  const rawTrusted = assessments.filter(assessment => assessment.pnl !== null && !assessment.closedPnlReason);
  const rawReturnEligible = rawTrusted.filter(assessment => assessment.exposure !== null && assessment.exposure.gt(0));
  const cnyNetPnlEligible = comparableGroups.reduce((sum, group) => sum + group.netPnlSampleCount, 0);
  const cnyReturnEligible = comparableGroups.reduce((sum, group) => sum + group.returnSampleCount, 0);
  const sample: LibraryPerformanceSampleCoverage = {
    total: assessments.length,
    closed: assessments.filter(({ row }) => row.item.episode.status === "closed").length,
    open: assessments.filter(({ row }) => row.item.episode.status === "open").length,
    trustedClosed: rawTrusted.length,
    returnEligible: rawReturnEligible.length,
    cnyNetPnlEligible,
    cnyReturnEligible,
    excluded: assessments.length - rawTrusted.length,
    returnExcluded: assessments.length - rawReturnEligible.length,
  };

  const openAssessments = assessments.filter(({ row }) => row.item.episode.status === "open");
  const openGroups = [...groupAssessments(
    openAssessments,
    assessment => `${assessment.scope.key}|${encodePart(assessment.currency)}`,
  ).entries()]
    .map(([key, group]) => openGroup(key, group))
    .sort((left, right) => left.key.localeCompare(right.key));
  const openWithPnl = openAssessments.filter(({ unrealizedPnl }) => unrealizedPnl !== null);
  const openComparable = openGroups.length === 1 && openWithPnl.length > 0;
  const open: LibraryPerformanceOpen = {
    count: openAssessments.length,
    withUnrealizedPnl: openWithPnl.length,
    unavailable: openAssessments.length - openWithPnl.length,
    unrealizedPnl: openComparable ? openGroups[0].unrealizedPnl : null,
    groups: openGroups,
  };

  return { sample, rawCurrencyGroups, comparableGroups, cny, open };
}

/** Alias for callers that name aggregate builders consistently with the queue. */
export const buildLibraryPerformance = summarizeLibraryPerformance;
