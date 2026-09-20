import type { InsightEpisodeFact } from "./episode-facts";
import {
  buildOutcomeStructureReport,
  type OutcomeStructureReport,
} from "./outcome-structure";

export type IpoBreakdownGroupId = "ipo" | "non-ipo" | "unknown";

export type IpoBreakdownExclusion = {
  episodeId: string;
  reason: "ipo-cost-incomplete" | "missing-comparison-metric";
  reasonLabel: string;
};

export type IpoBreakdownGroup = {
  id: IpoBreakdownGroupId;
  classificationLabel: string;
  sampleCount: number;
  coveragePercent: string;
  comparableSampleCount: number;
  excludedCount: number;
  outcome: OutcomeStructureReport;
  excluded: IpoBreakdownExclusion[];
  evidence: Array<{ episodeId: string; evidenceIds: string[]; labels: string[] }>;
  reasons: Array<{ episodeId: string; reason: string }>;
};

export type IpoBreakdownReport = {
  sampleCount: number;
  groups: [IpoBreakdownGroup, IpoBreakdownGroup, IpoBreakdownGroup];
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

function groupFor(facts: InsightEpisodeFact[], id: IpoBreakdownGroupId, total: number): IpoBreakdownGroup {
  const members = facts.filter((fact) => (fact.ipoClassification ?? "unknown") === id);
  const comparable = members.filter((fact) =>
    fact.returnPercent !== null && (id !== "ipo" || fact.ipoCostComplete !== false),
  );
  const excluded: IpoBreakdownExclusion[] = members
    .filter((fact) => !comparable.includes(fact))
    .map((fact) => ({
      episodeId: fact.episodeId,
      reason: id === "ipo" && fact.ipoCostComplete === false
        ? "ipo-cost-incomplete"
        : "missing-comparison-metric",
      reasonLabel: id === "ipo" && fact.ipoCostComplete === false
        ? "IPO 成本证据链不完整，未进入正式收益比较"
        : "收益率不可用，未进入正式收益比较",
    }));
  return {
    id,
    classificationLabel: LABELS[id],
    sampleCount: members.length,
    coveragePercent: percent(members.length, total),
    comparableSampleCount: comparable.length,
    excludedCount: excluded.length,
    outcome: buildOutcomeStructureReport(comparable, []),
    excluded,
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

export function buildIpoBreakdownReport(facts: InsightEpisodeFact[]): IpoBreakdownReport {
  return {
    sampleCount: facts.length,
    groups: [
      groupFor(facts, "ipo", facts.length),
      groupFor(facts, "non-ipo", facts.length),
      groupFor(facts, "unknown", facts.length),
    ],
    calculationVersion: 1,
  };
}
