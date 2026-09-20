import Decimal from "decimal.js";

import type {
  InsightEpisodeExclusion,
  InsightEpisodeFact,
} from "./episode-facts";

export type OutcomeSizeClassification = "reliable" | "unreliable";

export type OutcomeBucket = {
  id: "small-loss" | "large-loss" | "small-profit" | "large-profit" | "flat";
  label: string;
  side: "loss" | "profit" | "flat";
  count: number;
  sharePercent: string;
  medianReturnPercent: string | null;
  episodeIds: string[];
};

export type OutcomeHistogramBin = {
  id: string;
  label: string;
  startPercent: string;
  endPercent: string;
  count: number;
  episodeIds: string[];
};

export type OutcomeStructureReport = {
  metricBasis: "return-percent";
  sampleCount: number;
  excluded: InsightEpisodeExclusion[];
  distribution: {
    profitCount: number;
    lossCount: number;
    flatCount: number;
    profitSize: {
      classification: OutcomeSizeClassification;
      thresholdPercent: string | null;
      sampleCount: number;
    };
    lossSize: {
      classification: OutcomeSizeClassification;
      thresholdPercent: string | null;
      sampleCount: number;
    };
    unreliableReason: string | null;
  };
  metrics: {
    totalWinRate: string | null;
    nonFlatWinRate: string | null;
    averageProfitPercent: string | null;
    medianProfitPercent: string | null;
    averageLossPercent: string | null;
    medianLossPercent: string | null;
    odds: string | null;
    profitFactor: string | null;
    expectancyPercent: string | null;
    maxProfitPercent: string | null;
    maxLossPercent: string | null;
  };
  histogram: {
    zeroBoundaryPercent: "0";
    bins: OutcomeHistogramBin[];
  };
  buckets: OutcomeBucket[];
  calculationVersion: 1;
};

function median(values: Decimal[]) {
  const sorted = [...values].sort((a, b) => a.comparedTo(b));
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : sorted[middle - 1].plus(sorted[middle]).div(2);
}

function displayBoundary(value: Decimal) {
  return value.toDecimalPlaces(2).toString();
}

function percentOf(count: number, total: number) {
  return total === 0
    ? null
    : new Decimal(count).div(total).times(100).toString();
}

function bucket(
  id: OutcomeBucket["id"],
  label: string,
  side: OutcomeBucket["side"],
  facts: InsightEpisodeFact[],
  sampleCount: number,
): OutcomeBucket {
  return {
    id,
    label,
    side,
    count: facts.length,
    sharePercent: percentOf(facts.length, sampleCount) ?? "0",
    medianReturnPercent:
      facts.length === 0
        ? null
        : median(facts.map(({ returnPercent }) => new Decimal(returnPercent as string))).toString(),
    episodeIds: facts.map(({ episodeId }) => episodeId),
  };
}

function buildHistogram(facts: InsightEpisodeFact[]) {
  if (facts.length === 0) return [];
  const values = facts.map(({ returnPercent }) => new Decimal(returnPercent as string));
  const min = Decimal.min(...values);
  const max = Decimal.max(...values);
  if (max.equals(min)) {
    return [
      {
        id: "return-bin-1",
        label: `${displayBoundary(min)}% 至 ${displayBoundary(max)}%`,
        startPercent: min.toString(),
        endPercent: max.toString(),
        count: facts.length,
        episodeIds: facts.map(({ episodeId }) => episodeId),
      },
    ];
  }
  const binCount = Math.min(7, Math.max(1, Math.ceil(Math.sqrt(values.length))));
  const width = max.minus(min).div(binCount);
  const bins = Array.from({ length: binCount }, (_, index) => {
    const start = min.plus(width.times(index));
    const end = index === binCount - 1 ? max : start.plus(width);
    return {
      id: `return-bin-${index + 1}`,
      label: `${displayBoundary(start)}% 至 ${displayBoundary(end)}%`,
      startPercent: start.toString(),
      endPercent: end.toString(),
      count: 0,
      episodeIds: [] as string[],
    } satisfies OutcomeHistogramBin;
  });
  facts.forEach((fact) => {
    const value = new Decimal(fact.returnPercent as string);
    const index = width.isZero()
      ? 0
      : Math.min(binCount - 1, value.minus(min).div(width).floor().toNumber());
    bins[index].count += 1;
    bins[index].episodeIds.push(fact.episodeId);
  });
  return bins;
}

export function buildOutcomeStructureReport(
  inputFacts: InsightEpisodeFact[],
  upstreamExclusions: InsightEpisodeExclusion[],
): OutcomeStructureReport {
  const excluded = [...upstreamExclusions];
  const facts = inputFacts.filter((fact) => {
    if (fact.returnPercent !== null) return true;
    excluded.push({
      episodeId: fact.episodeId,
      instrumentId: fact.instrumentId,
      instrumentName: fact.instrumentName,
      startedAt: fact.startedAt,
      endedAt: fact.endedAt,
      reason: "missing-comparison-metric",
      reasonLabel: "缺少费用后收益率，未进入收益结构统计",
    });
    return false;
  });
  const profit = facts.filter(({ returnPercent }) => new Decimal(returnPercent as string).gt(0));
  const loss = facts.filter(({ returnPercent }) => new Decimal(returnPercent as string).lt(0));
  const flat = facts.filter(({ returnPercent }) => new Decimal(returnPercent as string).eq(0));
  const profitValues = profit.map(({ returnPercent }) => new Decimal(returnPercent as string));
  const lossValues = loss.map(({ returnPercent }) => new Decimal(returnPercent as string));
  const profitMedian = profitValues.length > 0 ? median(profitValues) : null;
  const lossMedian = lossValues.length > 0 ? median(lossValues.map((value) => value.abs())) : null;
  const profitSize = {
    classification: profit.length >= 3 ? "reliable" : "unreliable" as OutcomeSizeClassification,
    thresholdPercent: profit.length >= 3 ? profitMedian?.toString() ?? null : null,
    sampleCount: profit.length,
  };
  const lossSize = {
    classification: loss.length >= 3 ? "reliable" : "unreliable" as OutcomeSizeClassification,
    thresholdPercent: loss.length >= 3 ? lossMedian?.toString() ?? null : null,
    sampleCount: loss.length,
  };
  const smallProfit = profitSize.classification === "reliable"
    ? profit.filter(({ returnPercent }) => new Decimal(returnPercent as string).lte(profitMedian as Decimal))
    : [];
  const largeProfit = profitSize.classification === "reliable"
    ? profit.filter(({ returnPercent }) => new Decimal(returnPercent as string).gt(profitMedian as Decimal))
    : [];
  const smallLoss = lossSize.classification === "reliable"
    ? loss.filter(({ returnPercent }) => new Decimal(returnPercent as string).abs().lte(lossMedian as Decimal))
    : [];
  const largeLoss = lossSize.classification === "reliable"
    ? loss.filter(({ returnPercent }) => new Decimal(returnPercent as string).abs().gt(lossMedian as Decimal))
    : [];
  const totalProfit = profitValues.reduce((total, value) => total.plus(value), new Decimal(0));
  const totalLossAbs = lossValues.reduce((total, value) => total.plus(value.abs()), new Decimal(0));
  const averageProfit = profitValues.length > 0 ? totalProfit.div(profitValues.length) : null;
  const averageLoss = lossValues.length > 0 ? lossValues.reduce((total, value) => total.plus(value), new Decimal(0)).div(lossValues.length) : null;
  const nonFlatCount = profit.length + loss.length;
  return {
    metricBasis: "return-percent",
    sampleCount: facts.length,
    excluded,
    distribution: {
      profitCount: profit.length,
      lossCount: loss.length,
      flatCount: flat.length,
      profitSize,
      lossSize,
      unreliableReason:
        profit.length < 3 || loss.length < 3
          ? "同侧少于 3 个样本，大小分类不可可靠"
          : null,
    },
    metrics: {
      totalWinRate: percentOf(profit.length, facts.length),
      nonFlatWinRate: percentOf(profit.length, nonFlatCount),
      averageProfitPercent: averageProfit?.toString() ?? null,
      medianProfitPercent: profitMedian?.toString() ?? null,
      averageLossPercent: averageLoss?.toString() ?? null,
      medianLossPercent: lossMedian === null ? null : lossMedian.negated().toString(),
      odds: averageProfit && averageLoss && !averageLoss.isZero() ? averageProfit.div(averageLoss.abs()).toString() : null,
      profitFactor: totalLossAbs.isZero() ? null : totalProfit.div(totalLossAbs).toString(),
      expectancyPercent: facts.length === 0 ? null : totalProfit.minus(totalLossAbs).div(facts.length).toString(),
      maxProfitPercent: profitValues.length > 0 ? Decimal.max(...profitValues).toString() : null,
      maxLossPercent: lossValues.length > 0 ? Decimal.min(...lossValues).toString() : null,
    },
    histogram: {
      zeroBoundaryPercent: "0",
      bins: buildHistogram(facts),
    },
    buckets: [
      bucket("small-loss", "小亏", "loss", smallLoss, facts.length),
      bucket("large-loss", "大亏", "loss", largeLoss, facts.length),
      bucket("small-profit", "小赚", "profit", smallProfit, facts.length),
      bucket("large-profit", "大赚", "profit", largeProfit, facts.length),
      bucket("flat", "持平", "flat", flat, facts.length),
    ],
    calculationVersion: 1,
  };
}
