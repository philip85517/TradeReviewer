import type { InsightEpisodeExclusion, InsightEpisodeFact } from "./episode-facts";
import {
  buildOutcomeStructureReport,
  type OutcomeStructureReport,
} from "./outcome-structure";
import {
  buildOutcomeDiagnosticsReport,
  type OutcomeDiagnosticsReport,
} from "./outcome-diagnostics";

export type IpoBreakdownGroupId = "ipo" | "non-ipo" | "unknown";

export type IpoBreakdownExclusion = InsightEpisodeExclusion;

export type IpoBreakdownGroup = {
  id: IpoBreakdownGroupId;
  classificationLabel: string;
  sampleCount: number;
  coveragePercent: string;
  comparableSampleCount: number;
  excludedCount: number;
  outcome: OutcomeStructureReport;
  diagnostics: OutcomeDiagnosticsReport;
  facts: InsightEpisodeFact[];
  excluded: IpoBreakdownExclusion[];
  evidence: Array<{ episodeId: string; evidenceIds: string[]; labels: string[] }>;
  reasons: Array<{ episodeId: string; reason: string }>;
};

export type IpoBreakdownReport = {
  sampleCount: number;
  groups: [IpoBreakdownGroup, IpoBreakdownGroup, IpoBreakdownGroup];
  excluded: IpoBreakdownExclusion[];
  calculationVersion: 1;
};

const LABELS: Record<IpoBreakdownGroupId, string> = {
  ipo: "新股 / IPO",
  "non-ipo": "非新股",
  unknown: "无法判定",
};

function percent(count: number, total: number) {
  return total === 0 ? "0" : (count / total * 100).toString();
}

function groupFor(
  facts: InsightEpisodeFact[],
  id: IpoBreakdownGroupId,
  total: number,
  upstreamExclusions: InsightEpisodeExclusion[],
): IpoBreakdownGroup {
  const members = facts.filter((fact) => (fact.ipoClassification ?? "unknown") === id);
  const comparable = members.filter((fact) =>
    fact.returnPercent !== null && (id !== "ipo" || fact.ipoCostComplete !== false),
  );
  const excluded: IpoBreakdownExclusion[] = members
    .filter((fact) => !comparable.includes(fact))
    .map((fact): IpoBreakdownExclusion => ({
      episodeId: fact.episodeId,
      instrumentId: fact.instrumentId,
      instrumentName: fact.instrumentName,
      startedAt: fact.startedAt,
      endedAt: fact.endedAt,
      reason: id === "ipo" && fact.ipoCostComplete === false
        ? "ipo-cost-incomplete"
        : "missing-comparison-metric",
      reasonLabel: id === "ipo" && fact.ipoCostComplete === false
        ? "IPO 成本证据链不完整，未进入正式收益比较"
        : "收益率不可用，未进入正式收益比较",
    }));
  const inherited = upstreamExclusions.filter((exclusion) => {
    const fact = facts.find((item) => item.episodeId === exclusion.episodeId);
    return (fact?.ipoClassification ?? "unknown") === id;
  });
  const outcome = buildOutcomeStructureReport(comparable, [], LABELS[id]);
  return {
    id,
    classificationLabel: LABELS[id],
    sampleCount: members.length,
    coveragePercent: percent(members.length, total),
    comparableSampleCount: comparable.length,
    excludedCount: excluded.length,
    outcome,
    diagnostics: buildOutcomeDiagnosticsReport(outcome, comparable),
    facts: members,
    excluded: [...inherited, ...excluded],
    evidence: members
      .filter((fact) => (fact.ipoEvidence?.length ?? 0) > 0)
      .map((fact) => ({
        episodeId: fact.episodeId,
        evidenceIds: (fact.ipoEvidence ?? []).map((item) => item.id),
        labels: (fact.ipoEvidence ?? []).map((item) => item.label),
      })),
    reasons: members
      .filter((fact) => fact.ipoClassificationReason !== null && fact.ipoClassificationReason !== undefined)
      .map((fact) => ({ episodeId: fact.episodeId, reason: fact.ipoClassificationReason as string })),
  };
}

export function buildIpoBreakdownReport(
  facts: InsightEpisodeFact[],
  upstreamExclusions: InsightEpisodeExclusion[] = [],
): IpoBreakdownReport {
  const groups = [
    groupFor(facts, "ipo", facts.length, upstreamExclusions),
    groupFor(facts, "non-ipo", facts.length, upstreamExclusions),
    groupFor(facts, "unknown", facts.length, upstreamExclusions),
  ] as [IpoBreakdownGroup, IpoBreakdownGroup, IpoBreakdownGroup];
  return {
    sampleCount: facts.length,
    groups,
    excluded: groups.flatMap((group) => group.excluded),
    calculationVersion: 1,
  };
}
