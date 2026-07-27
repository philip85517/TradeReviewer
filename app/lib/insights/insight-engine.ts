import Decimal from "decimal.js";

import {
  REVIEW_TAG_DICTIONARY_VERSION,
  reviewTagLabel,
} from "../reviews/review-tags";
import type {
  InsightEpisodeExclusion,
  InsightEpisodeFact,
} from "./episode-facts";

export type InsightMetricBasis = "r-multiple" | "return-percent";
export type InsightConfidence =
  | "early-signal"
  | "usable"
  | "high-confidence";
export type InsightCategory =
  | "condition"
  | "pattern"
  | "execution-psychology";

export type InsightDimension = {
  kind: "market" | "direction" | "holding-period" | "confirmed-tag";
  id: string;
  value: string;
  label: string;
};

export type PatternInsight = {
  id: string;
  category: InsightCategory;
  dimension: InsightDimension;
  confidence: InsightConfidence;
  metricBasis: InsightMetricBasis;
  sampleCount: number;
  baselineCount: number;
  timeRange: { start: string; end: string };
  medianTagged: string;
  medianBaseline: string | null;
  medianDifference: string | null;
  winRate: string;
  netPnl: string;
  medianMfePercent: string;
  medianMaePercent: string;
  medianGivebackPercent: string;
  planAdherenceRate: string | null;
  evidenceEpisodeIds: string[];
  counterexampleEpisodeIds: string[];
  baselineEpisodeIds: string[];
  conclusion: string;
  tagDictionaryVersion: 1 | null;
  ruleVersions: Array<{ ruleId: string; ruleVersion: number }>;
  calculationVersion: 1;
};

export type PatternInsightReport = {
  metricBasis: InsightMetricBasis;
  formalInsights: PatternInsight[];
  earlySignals: PatternInsight[];
  descriptiveStatistics: PatternInsight[];
  excluded: InsightEpisodeExclusion[];
  calculationVersion: 1;
};

type CandidateDefinition = {
  id: string;
  category: InsightCategory;
  dimension: InsightDimension;
  matches: (fact: InsightEpisodeFact) => boolean;
};

const PATTERN_TAGS = new Set([
  "breakout",
  "pullback",
  "bull-flag",
  "trading-range",
]);
const EXECUTION_TAGS = new Set([
  "planned",
  "scale-in",
  "fomo",
  "fear",
]);

function metricValue(
  fact: InsightEpisodeFact,
  basis: InsightMetricBasis,
) {
  return basis === "r-multiple" ? fact.rMultiple : fact.returnPercent;
}

function median(values: string[]) {
  const sorted = values
    .map((value) => new Decimal(value))
    .sort((a, b) => a.comparedTo(b));
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle];
  return sorted[middle - 1].plus(sorted[middle]).div(2);
}

function confidenceFor(
  sampleCount: number,
  baselineCount: number,
): InsightConfidence {
  if (sampleCount < 5) return "early-signal";
  if (sampleCount >= 10 && baselineCount >= 3) {
    return "high-confidence";
  }
  return "usable";
}

function conditionCandidates(facts: InsightEpisodeFact[]) {
  const markets = [...new Set(facts.map(({ market }) => market))].sort();
  const marketLabels: Record<string, string> = {
    US: "美股",
    HK: "港股",
    "CN-SH": "沪市",
    "CN-SZ": "深市",
  };
  const candidates: CandidateDefinition[] = markets.map((market) => ({
    id: `market:${market}`,
    category: "condition",
    dimension: {
      kind: "market",
      id: "market",
      value: market,
      label: marketLabels[market] ?? market,
    },
    matches: (fact) => fact.market === market,
  }));
  for (const direction of ["long", "short"] as const) {
    candidates.push({
      id: `direction:${direction}`,
      category: "condition",
      dimension: {
        kind: "direction",
        id: "direction",
        value: direction,
        label: direction === "long" ? "多头回合" : "空头回合",
      },
      matches: (fact) => fact.direction === direction,
    });
  }
  candidates.push(
    {
      id: "holding-period:short",
      category: "condition",
      dimension: {
        kind: "holding-period",
        id: "holding-period",
        value: "short",
        label: "短持（≤5天）",
      },
      matches: (fact) => new Decimal(fact.holdingDays).lte(5),
    },
    {
      id: "holding-period:long",
      category: "condition",
      dimension: {
        kind: "holding-period",
        id: "holding-period",
        value: "long",
        label: "长持（>5天）",
      },
      matches: (fact) => new Decimal(fact.holdingDays).gt(5),
    },
  );
  return candidates;
}

function tagCandidates(facts: InsightEpisodeFact[]) {
  const tags = [
    ...new Set(facts.flatMap(({ confirmedTagIds }) => confirmedTagIds)),
  ].sort();
  return tags.flatMap<CandidateDefinition>((tagId) => {
    const category = PATTERN_TAGS.has(tagId)
      ? "pattern"
      : EXECUTION_TAGS.has(tagId)
        ? "execution-psychology"
        : null;
    if (!category) return [];
    return [
      {
        id: `tag:${tagId}`,
        category,
        dimension: {
          kind: "confirmed-tag",
          id: "confirmed-tag",
          value: tagId,
          label: reviewTagLabel(tagId),
        },
        matches: (fact) => fact.confirmedTagIds.includes(tagId),
      },
    ];
  });
}

function uniqueRuleVersions(
  sample: InsightEpisodeFact[],
  tagId: string,
) {
  const values = sample
    .flatMap(({ confirmedRuleVersions }) => confirmedRuleVersions)
    .filter((item) => item.tagId === tagId)
    .map(({ ruleId, ruleVersion }) => ({ ruleId, ruleVersion }));
  return [
    ...new Map(
      values.map((item) => [
        `${item.ruleId}:${item.ruleVersion}`,
        item,
      ]),
    ).values(),
  ].sort(
    (a, b) =>
      a.ruleId.localeCompare(b.ruleId) ||
      a.ruleVersion - b.ruleVersion,
  );
}

function buildInsight(
  definition: CandidateDefinition,
  facts: InsightEpisodeFact[],
  basis: InsightMetricBasis,
): PatternInsight | null {
  const sample = facts.filter(definition.matches);
  if (sample.length < 3) return null;
  const baseline = facts.filter((fact) => !definition.matches(fact));
  const sampleMetrics = sample.map(
    (fact) => metricValue(fact, basis) as string,
  );
  const medianTagged = median(sampleMetrics);
  const hasBaseline = baseline.length >= 3;
  const medianBaseline = hasBaseline
    ? median(
        baseline.map((fact) => metricValue(fact, basis) as string),
      )
    : null;
  const difference = medianBaseline
    ? medianTagged.minus(medianBaseline)
    : null;
  const positive = sample.filter((fact) =>
    new Decimal(metricValue(fact, basis) as string).gt(0),
  );
  const counterexamples = sample.filter((fact) =>
    new Decimal(metricValue(fact, basis) as string).lte(0),
  );
  const plannedCount = sample.filter((fact) =>
    fact.confirmedTagIds.includes("planned"),
  ).length;
  const metricLabel = basis === "r-multiple" ? "R" : "收益率";
  const conclusion =
    medianBaseline === null
      ? `${definition.dimension.label}当前仅显示描述统计，中位${metricLabel}为 ${medianTagged.toString()}；基准样本不足，不比较差异。`
      : `${definition.dimension.label}样本的中位${metricLabel}为 ${medianTagged.toString()}，与基准组相差 ${difference?.toString()}；这是相关性描述，不代表因果。`;
  const isTag = definition.dimension.kind === "confirmed-tag";

  return {
    id: definition.id,
    category: definition.category,
    dimension: definition.dimension,
    confidence: confidenceFor(sample.length, baseline.length),
    metricBasis: basis,
    sampleCount: sample.length,
    baselineCount: baseline.length,
    timeRange: {
      start: sample
        .map(({ startedAt }) => startedAt)
        .sort()[0],
      end: sample
        .map(({ endedAt }) => endedAt)
        .sort()
        .at(-1) as string,
    },
    medianTagged: medianTagged.toString(),
    medianBaseline: medianBaseline?.toString() ?? null,
    medianDifference: difference?.toString() ?? null,
    winRate: new Decimal(positive.length)
      .div(sample.length)
      .times(100)
      .toString(),
    netPnl: sample
      .reduce(
        (total, fact) => total.plus(fact.netPnl),
        new Decimal(0),
      )
      .toString(),
    medianMfePercent: median(
      sample.map(({ mfePercent }) => mfePercent),
    ).toString(),
    medianMaePercent: median(
      sample.map(({ maePercent }) => maePercent),
    ).toString(),
    medianGivebackPercent: median(
      sample.map(({ givebackPercent }) => givebackPercent),
    ).toString(),
    planAdherenceRate:
      plannedCount === 0
        ? null
        : new Decimal(plannedCount)
            .div(sample.length)
            .times(100)
            .toString(),
    evidenceEpisodeIds: positive.map(({ episodeId }) => episodeId),
    counterexampleEpisodeIds: counterexamples.map(
      ({ episodeId }) => episodeId,
    ),
    baselineEpisodeIds: baseline.map(({ episodeId }) => episodeId),
    conclusion,
    tagDictionaryVersion: isTag
      ? REVIEW_TAG_DICTIONARY_VERSION
      : null,
    ruleVersions: isTag
      ? uniqueRuleVersions(sample, definition.dimension.value)
      : [],
    calculationVersion: 1,
  };
}

function rank(a: PatternInsight, b: PatternInsight) {
  const confidenceRank: Record<InsightConfidence, number> = {
    "early-signal": 1,
    usable: 2,
    "high-confidence": 3,
  };
  const confidenceDifference =
    confidenceRank[b.confidence] - confidenceRank[a.confidence];
  if (confidenceDifference !== 0) return confidenceDifference;
  const effectA = new Decimal(a.medianDifference ?? 0).abs();
  const effectB = new Decimal(b.medianDifference ?? 0).abs();
  const effectDifference = effectB.comparedTo(effectA);
  if (effectDifference !== 0) return effectDifference;
  const smallerDifference =
    Math.min(b.sampleCount, b.baselineCount) -
    Math.min(a.sampleCount, a.baselineCount);
  if (smallerDifference !== 0) return smallerDifference;
  const recencyDifference = b.timeRange.end.localeCompare(a.timeRange.end);
  if (recencyDifference !== 0) return recencyDifference;
  return a.id.localeCompare(b.id);
}

export function buildPatternInsightReport(
  inputFacts: InsightEpisodeFact[],
  upstreamExclusions: InsightEpisodeExclusion[],
): PatternInsightReport {
  const rCoverage =
    inputFacts.length === 0
      ? 0
      : inputFacts.filter(({ rMultiple }) => rMultiple !== null).length /
        inputFacts.length;
  const metricBasis: InsightMetricBasis =
    rCoverage >= 0.8 ? "r-multiple" : "return-percent";
  const facts: InsightEpisodeFact[] = [];
  const missing: InsightEpisodeExclusion[] = [];
  for (const fact of inputFacts) {
    if (metricValue(fact, metricBasis) !== null) {
      facts.push(fact);
      continue;
    }
    missing.push({
      episodeId: fact.episodeId,
      instrumentId: fact.instrumentId,
      instrumentName: fact.instrumentName,
      startedAt: fact.startedAt,
      endedAt: fact.endedAt,
      reason: "missing-comparison-metric",
      reasonLabel: "缺少当前统计口径所需指标",
    });
  }

  const candidates = [
    ...conditionCandidates(facts),
    ...tagCandidates(facts),
  ]
    .map((definition) => buildInsight(definition, facts, metricBasis))
    .filter((insight): insight is PatternInsight => insight !== null);

  return {
    metricBasis,
    formalInsights: candidates
      .filter(
        ({ sampleCount, baselineCount }) =>
          sampleCount >= 5 && baselineCount >= 3,
      )
      .sort(rank),
    earlySignals: candidates
      .filter(
        ({ sampleCount }) => sampleCount >= 3 && sampleCount <= 4,
      )
      .sort(rank),
    descriptiveStatistics: candidates
      .filter(
        ({ sampleCount, baselineCount }) =>
          sampleCount >= 5 && baselineCount < 3,
      )
      .sort(rank),
    excluded: [...upstreamExclusions, ...missing],
    calculationVersion: 1,
  };
}
