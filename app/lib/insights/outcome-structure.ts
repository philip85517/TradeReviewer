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
  tone: "loss" | "flat" | "profit" | "mixed";
  count: number;
  episodeIds: string[];
};

export type InsightSampleChain = {
  rangeCount: number;
  eligibleCount: number;
  excludedCount: number;
  eligibleEpisodeIds: string[];
  excluded: InsightEpisodeExclusion[];
};

export type OutcomeStripPoint = {
  episodeId: string;
  returnPercent: string;
  positionPercent: string;
};

export type OutcomeOddsWinRatePoint = {
  id: string;
  label: string;
  sampleCount: number;
  winRatePercent: string | null;
  odds: string | null;
  episodeIds: string[];
};

export type OutcomeBreakEvenPoint = {
  winRatePercent: string;
  odds: string;
};

export type OutcomeStructureReport = {
  metricBasis: "return-percent";
  sampleCount: number;
  excluded: InsightEpisodeExclusion[];
  sampleChain: InsightSampleChain;
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
    zeroPositionPercent: string | null;
    bins: OutcomeHistogramBin[];
  };
  strip: {
    medianPercent: string | null;
    medianPositionPercent: string | null;
    points: OutcomeStripPoint[];
  };
  netPnlContribution: {
    numeratorLabel: string;
    denominatorLabel: string;
    totalNetPnl: string;
    currency: string | null;
    points: Array<{ episodeId: string; netPnl: string; sharePercent: string | null }>;
    groups: Array<{ currency: string; totalNetPnl: string; points: Array<{ episodeId: string; netPnl: string; sharePercent: string | null }> }>;
  };
  oddsWinRate: {
    point: OutcomeOddsWinRatePoint;
    breakEvenLine: OutcomeBreakEvenPoint[];
  };
  buckets: OutcomeBucket[];
  calculationVersion: 1;
};

export type OutcomeHistogramDomain = { min: string; max: string; binCount: number };

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

function histogramTone(start: Decimal, end: Decimal): OutcomeHistogramBin["tone"] {
  if (end.lt(0)) return "loss";
  if (start.gt(0)) return "profit";
  if (start.eq(0) && end.eq(0)) return "flat";
  return "mixed";
}

function breakEvenLine(): OutcomeBreakEvenPoint[] {
  return ["10", "25", "40", "50", "60", "75", "90"].map((winRatePercent) => {
    const winRate = new Decimal(winRatePercent);
    return {
      winRatePercent,
      odds: new Decimal(100).minus(winRate).div(winRate).toString(),
    };
  });
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

function buildHistogram(facts: InsightEpisodeFact[], domain?: OutcomeHistogramDomain) {
  if (facts.length === 0) return [];
  const values = facts.map(({ returnPercent }) => new Decimal(returnPercent as string));
  const min = domain ? new Decimal(domain.min) : Decimal.min(...values);
  const max = domain ? new Decimal(domain.max) : Decimal.max(...values);
  if (max.equals(min)) {
    return [
      {
        id: "return-bin-1",
        label: `${displayBoundary(min)}% 至 ${displayBoundary(max)}%`,
        startPercent: min.toString(),
        endPercent: max.toString(),
        tone: histogramTone(min, max),
        count: facts.length,
        episodeIds: facts.map(({ episodeId }) => episodeId),
      },
    ];
  }
  const binCount = domain?.binCount ?? Math.min(7, Math.max(1, Math.ceil(Math.sqrt(values.length))));
  const width = max.minus(min).div(binCount);
  const bins = Array.from({ length: binCount }, (_, index) => {
    const start = min.plus(width.times(index));
    const end = index === binCount - 1 ? max : start.plus(width);
    return {
      id: `return-bin-${index + 1}`,
      label: `${displayBoundary(start)}% 至 ${displayBoundary(end)}%`,
      startPercent: start.toString(),
      endPercent: end.toString(),
      tone: histogramTone(start, end),
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

function buildStrip(facts: InsightEpisodeFact[]) {
  if (facts.length === 0) return { medianPercent: null, medianPositionPercent: null, points: [] as OutcomeStripPoint[] };
  const values = facts.map(({ returnPercent }) => new Decimal(returnPercent as string));
  const minimum = Decimal.min(new Decimal(0), ...values);
  const maximum = Decimal.max(new Decimal(0), ...values);
  const span = maximum.minus(minimum);
  const medianValue = median(values);
  return {
    medianPercent: medianValue.toString(),
    medianPositionPercent: span.isZero() ? "50" : medianValue.minus(minimum).div(span).times(100).toString(),
    points: facts.map((fact) => {
      const value = new Decimal(fact.returnPercent as string);
      const position = span.isZero() ? new Decimal(50) : value.minus(minimum).div(span).times(100);
      return {
        episodeId: fact.episodeId,
        returnPercent: value.toString(),
        positionPercent: position.toString(),
      };
    }),
  };
}

export function buildOutcomeStructureReport(
  inputFacts: InsightEpisodeFact[],
  upstreamExclusions: InsightEpisodeExclusion[],
  label = "总体",
  histogramDomain?: OutcomeHistogramDomain,
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
  const values = facts.map(({ returnPercent }) => new Decimal(returnPercent as string));
  const minimum = values.length > 0 ? Decimal.min(...values) : null;
  const maximum = values.length > 0 ? Decimal.max(...values) : null;
  const zeroPositionPercent = minimum !== null && maximum !== null
    ? minimum.equals(maximum)
      ? minimum.gt(0)
        ? "0"
        : minimum.lt(0)
          ? "100"
          : "50"
      : minimum.gt(0)
        ? "0"
        : maximum.lt(0)
          ? "100"
          : new Decimal(0).minus(minimum).div(maximum.minus(minimum)).times(100).toString()
    : null;
  return {
    metricBasis: "return-percent",
    sampleCount: facts.length,
    excluded,
    sampleChain: {
      rangeCount: new Set([...facts.map(({ episodeId }) => episodeId), ...excluded.map(({ episodeId }) => episodeId)]).size,
      eligibleCount: facts.length,
      excludedCount: excluded.length,
      eligibleEpisodeIds: facts.map(({ episodeId }) => episodeId),
      excluded,
    },
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
      zeroPositionPercent,
      bins: buildHistogram(facts, histogramDomain),
    },
    strip: buildStrip(facts),
    netPnlContribution: {
      numeratorLabel: "回合净盈亏",
      denominatorLabel: "当前范围全部可用净盈亏合计",
      currency: (() => { const currencies = new Set(facts.map(fact => fact.currency).filter(Boolean)); return currencies.size === 1 ? [...currencies][0] ?? null : null; })(),
      totalNetPnl: (() => { const currencies = new Set(facts.map(fact => fact.currency).filter(Boolean)); return currencies.size === 1 ? facts.reduce((sum, fact) => sum.plus(fact.netPnl), new Decimal(0)).toString() : ""; })(),
      points: facts.map((fact) => ({
        episodeId: fact.episodeId,
        netPnl: fact.netPnl,
        sharePercent: (() => {
          const currencies = new Set(facts.map(item => item.currency).filter(Boolean));
          if (currencies.size !== 1) return null;
          const total = facts.reduce((sum, item) => sum.plus(item.netPnl), new Decimal(0));
          return total.isZero() ? null : new Decimal(fact.netPnl).div(total).times(100).toString();
        })(),
      })),
      groups: [...new Set(facts.map(fact => fact.currency).filter((currency): currency is string => Boolean(currency)))].map(currency => {
        const groupFacts = facts.filter(fact => fact.currency === currency);
        const total = groupFacts.reduce((sum, fact) => sum.plus(fact.netPnl), new Decimal(0));
        return { currency, totalNetPnl: total.toString(), points: groupFacts.map(fact => ({ episodeId: fact.episodeId, netPnl: fact.netPnl, sharePercent: total.isZero() ? null : new Decimal(fact.netPnl).div(total).times(100).toString() })) };
      }),
    },
    oddsWinRate: {
      point: {
        id: label,
        label,
        sampleCount: facts.length,
        winRatePercent: nonFlatCount === 0
          ? null
          : percentOf(profit.length, nonFlatCount),
        odds: averageProfit && averageLoss && !averageLoss.isZero()
          ? averageProfit.div(averageLoss.abs()).toString()
          : null,
        episodeIds: facts.map(({ episodeId }) => episodeId),
      },
      breakEvenLine: breakEvenLine(),
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
