import Decimal from "decimal.js";

import type { InsightEpisodeFact } from "./episode-facts";
import type { OutcomeStructureReport } from "./outcome-structure";

export type OutcomeDiagnosticStatus =
  | "insufficient-sample"
  | "descriptive-only"
  | "diagnosed";

export type OutcomeDiagnosticSide = {
  sampleCount: number;
  status: OutcomeDiagnosticStatus;
  episodeIds: string[];
  tailEpisodeIds: string[];
  breadthPercent: string | null;
  tailConcentrationPercent: string | null;
  medianAbsolutePercent: string | null;
  maximumAbsolutePercent: string | null;
};

export type OutcomeDiagnosticThreshold = {
  minimumSideSampleCount: number;
  tailSharePercent: string;
  breadthThresholdPercent: string;
  maxToMedianRatio: string;
  tailMethod: "ceil-20-percent-by-absolute-return";
};

export type OutcomeDiagnostic = {
  id: "loss-tail" | "loss-breadth" | "profit-tail" | "profit-breadth";
  side: "loss" | "profit";
  label: "少数大亏拉动" | "亏损较普遍" | "少数大赚拉动" | "多笔小赚";
  conclusion: string;
  sampleCount: number;
  sampleEpisodeIds: string[];
  evidenceEpisodeIds: string[];
  counterexampleEpisodeIds: string[];
  breadthPercent: string | null;
  tailConcentrationPercent: string | null;
  timeRange: { start: string; end: string };
  threshold: OutcomeDiagnosticThreshold;
  calculationVersion: 1;
};

export type OutcomeDiagnosticsReport = {
  metricBasis: "return-percent";
  sampleCount: number;
  metrics: {
    lossBreadthPercent: string | null;
    profitBreadthPercent: string | null;
    lossTailConcentrationPercent: string | null;
    profitTailConcentrationPercent: string | null;
  };
  sides: {
    loss: OutcomeDiagnosticSide;
    profit: OutcomeDiagnosticSide;
  };
  diagnostics: OutcomeDiagnostic[];
  calculationVersion: 1;
};

const MINIMUM_SIDE_SAMPLE_COUNT = 5;
const TAIL_SHARE_PERCENT = new Decimal(50);
const BREADTH_THRESHOLD_PERCENT = new Decimal(50);
const MAX_TO_MEDIAN_RATIO = new Decimal("2.5");

type Side = "loss" | "profit";

function percentOf(count: number, total: number) {
  return total === 0 ? null : new Decimal(count).div(total).times(100).toString();
}

function median(values: Decimal[]) {
  const sorted = [...values].sort((a, b) => a.comparedTo(b));
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : sorted[middle - 1].plus(sorted[middle]).div(2);
}

function sideFacts(facts: InsightEpisodeFact[], side: Side) {
  return facts
    .filter(({ returnPercent }) => {
      if (returnPercent === null) return false;
      const value = new Decimal(returnPercent);
      return side === "profit" ? value.gt(0) : value.lt(0);
    })
    .map((fact) => ({ fact, absolute: new Decimal(fact.returnPercent as string).abs() }));
}

function sideReport(
  facts: InsightEpisodeFact[],
  side: Side,
  sampleCount: number,
): OutcomeDiagnosticSide {
  const values = sideFacts(facts, side).sort((a, b) => b.absolute.comparedTo(a.absolute));
  const tailCount = values.length === 0 ? 0 : Math.max(1, Math.ceil(values.length * 0.2));
  const tail = values.slice(0, tailCount);
  const totalAbsolute = values.reduce((sum, item) => sum.plus(item.absolute), new Decimal(0));
  const tailAbsolute = tail.reduce((sum, item) => sum.plus(item.absolute), new Decimal(0));
  const med = values.length === 0 ? null : median(values.map(({ absolute }) => absolute));
  return {
    sampleCount: values.length,
    status:
      values.length < MINIMUM_SIDE_SAMPLE_COUNT
        ? "insufficient-sample"
        : "descriptive-only",
    episodeIds: values.map(({ fact }) => fact.episodeId),
    tailEpisodeIds: tail.map(({ fact }) => fact.episodeId),
    breadthPercent: percentOf(values.length, sampleCount),
    tailConcentrationPercent:
      totalAbsolute.isZero() ? null : tailAbsolute.div(totalAbsolute).times(100).toString(),
    medianAbsolutePercent: med?.toString() ?? null,
    maximumAbsolutePercent: values[0]?.absolute.toString() ?? null,
  };
}

function threshold(): OutcomeDiagnosticThreshold {
  return {
    minimumSideSampleCount: MINIMUM_SIDE_SAMPLE_COUNT,
    tailSharePercent: TAIL_SHARE_PERCENT.toString(),
    breadthThresholdPercent: BREADTH_THRESHOLD_PERCENT.toString(),
    maxToMedianRatio: MAX_TO_MEDIAN_RATIO.toString(),
    tailMethod: "ceil-20-percent-by-absolute-return",
  };
}

function timeRange(facts: InsightEpisodeFact[]) {
  return {
    start: facts.reduce((earliest, fact) =>
      fact.startedAt < earliest ? fact.startedAt : earliest,
      facts[0]?.startedAt ?? "",
    ),
    end: facts.reduce((latest, fact) =>
      fact.endedAt > latest ? fact.endedAt : latest,
      facts[0]?.endedAt ?? "",
    ),
  };
}

function makeDiagnostic(
  id: OutcomeDiagnostic["id"],
  side: Side,
  label: OutcomeDiagnostic["label"],
  conclusion: string,
  sideData: OutcomeDiagnosticSide,
  facts: InsightEpisodeFact[],
): OutcomeDiagnostic {
  const sideItems = sideFacts(facts, side).sort((a, b) => b.absolute.comparedTo(a.absolute));
  const evidenceEpisodeIds = sideData.tailEpisodeIds;
  const counterexampleEpisodeIds = sideItems
    .map(({ fact }) => fact.episodeId)
    .filter((episodeId) => !evidenceEpisodeIds.includes(episodeId))
    .slice(-1);
  return {
    id,
    side,
    label,
    conclusion,
    sampleCount: sideData.sampleCount,
    sampleEpisodeIds: sideData.episodeIds,
    evidenceEpisodeIds,
    counterexampleEpisodeIds,
    breadthPercent: sideData.breadthPercent,
    tailConcentrationPercent: sideData.tailConcentrationPercent,
    timeRange: timeRange(facts),
    threshold: threshold(),
    calculationVersion: 1,
  };
}

function buildSideDiagnostic(
  side: Side,
  sideData: OutcomeDiagnosticSide,
  facts: InsightEpisodeFact[],
): OutcomeDiagnostic | null {
  if (sideData.sampleCount < MINIMUM_SIDE_SAMPLE_COUNT) return null;
  const concentration = new Decimal(sideData.tailConcentrationPercent as string);
  const breadth = new Decimal(sideData.breadthPercent as string);
  const maximum = new Decimal(sideData.maximumAbsolutePercent as string);
  const medianAbsolute = new Decimal(sideData.medianAbsolutePercent as string);
  const hasLargeTail = concentration.gte(TAIL_SHARE_PERCENT);
  const hasOutlier = !medianAbsolute.isZero() && maximum.div(medianAbsolute).gte(MAX_TO_MEDIAN_RATIO);

  if (side === "loss") {
    if ((hasLargeTail && breadth.lt(BREADTH_THRESHOLD_PERCENT)) || hasOutlier) {
      return makeDiagnostic(
        "loss-tail",
        side,
        "少数大亏拉动",
        "亏损总额主要集中在最差的一小部分回合；这是样本分布描述，不代表因果或交易建议。",
        sideData,
        facts,
      );
    }
    if (breadth.gte(BREADTH_THRESHOLD_PERCENT) && concentration.lt(TAIL_SHARE_PERCENT)) {
      return makeDiagnostic(
        "loss-breadth",
        side,
        "亏损较普遍",
        "亏损出现在较广泛的回合中，且没有由最差尾部单独集中承担；这是样本分布描述，不代表因果或交易建议。",
        sideData,
        facts,
      );
    }
    return null;
  }

  if (hasLargeTail) {
    return makeDiagnostic(
      "profit-tail",
      side,
      "少数大赚拉动",
      "盈利总额主要集中在最好的一小部分回合；这是样本分布描述，不代表因果或交易建议。",
      sideData,
      facts,
    );
  }
  if (concentration.lt(TAIL_SHARE_PERCENT) && breadth.gte(BREADTH_THRESHOLD_PERCENT)) {
    return makeDiagnostic(
      "profit-breadth",
      side,
      "多笔小赚",
      "盈利由较广泛的回合分散贡献，未明显集中在最好尾部；这是样本分布描述，不代表因果或交易建议。",
      sideData,
      facts,
    );
  }
  return null;
}

export function buildOutcomeDiagnosticsReport(
  outcomeReport: OutcomeStructureReport,
  inputFacts: InsightEpisodeFact[],
): OutcomeDiagnosticsReport {
  const facts = inputFacts.filter((fact) => fact.returnPercent !== null);
  const loss = sideReport(facts, "loss", outcomeReport.sampleCount);
  const profit = sideReport(facts, "profit", outcomeReport.sampleCount);
  const diagnostics = [
    buildSideDiagnostic("loss", loss, facts),
    buildSideDiagnostic("profit", profit, facts),
  ].filter((item): item is OutcomeDiagnostic => item !== null);
  return {
    metricBasis: "return-percent",
    sampleCount: outcomeReport.sampleCount,
    metrics: {
      lossBreadthPercent: loss.breadthPercent,
      profitBreadthPercent: profit.breadthPercent,
      lossTailConcentrationPercent: loss.tailConcentrationPercent,
      profitTailConcentrationPercent: profit.tailConcentrationPercent,
    },
    sides: { loss, profit },
    diagnostics,
    calculationVersion: 1,
  };
}
