import type {
  InsightEpisodeExclusion,
  InsightEpisodeFact,
} from "./episode-facts";
import {
  buildOutcomeStructureReport,
  type OutcomeStructureReport,
} from "./outcome-structure";
import {
  buildOutcomeDiagnosticsReport,
  type OutcomeDiagnosticsReport,
} from "./outcome-diagnostics";
import Decimal from "decimal.js";
import type { OutcomeHistogramDomain } from "./outcome-structure";

export type MarketBreakdownMarket = "US" | "HK" | "CN-SH" | "CN-SZ" | "unknown";

export type MarketBreakdownGroup = {
  market: MarketBreakdownMarket;
  label: string;
  description: string;
  facts: InsightEpisodeFact[];
  report: OutcomeStructureReport;
  diagnostics: OutcomeDiagnosticsReport;
  excluded: InsightEpisodeExclusion[];
  sampleCount: number;
  descriptiveOnly: boolean;
  rankable: boolean;
};

export type MarketBreakdownReport = {
  overall: OutcomeStructureReport;
  groups: MarketBreakdownGroup[];
  calculationVersion: 1;
};

const GROUPS: Array<{
  market: MarketBreakdownMarket;
  label: string;
  description: string;
}> = [
  { market: "US", label: "美股", description: "标准化市场：US。" },
  { market: "HK", label: "港股", description: "标准化市场：HK。" },
  { market: "CN-SH", label: "沪市", description: "标准化市场：CN-SH。" },
  { market: "CN-SZ", label: "深市", description: "标准化市场：CN-SZ。" },
  {
    market: "unknown",
    label: "未知市场",
    description: "未知市场字段，保留在未知组，不参与市场排名。",
  },
];

export function normalizeInsightMarket(market: string): MarketBreakdownMarket {
  const value = market.trim().toUpperCase();
  if (value === "US") return "US";
  if (value === "HK") return "HK";
  if (["CN-SH", "SH", "SSE"].includes(value)) return "CN-SH";
  if (["CN-SZ", "SZ", "SZSE"].includes(value)) return "CN-SZ";
  return "unknown";
}

function exclusionMarket(exclusion: InsightEpisodeExclusion): MarketBreakdownMarket {
  return normalizeInsightMarket(exclusion.instrumentId.split(":", 1)[0] ?? "");
}

export function buildMarketBreakdownReport(
  inputFacts: InsightEpisodeFact[],
  upstreamExclusions: InsightEpisodeExclusion[],
): MarketBreakdownReport {
  const overall = buildOutcomeStructureReport(inputFacts, upstreamExclusions);
  const values = inputFacts
    .map(({ returnPercent }) => returnPercent === null ? null : new Decimal(returnPercent))
    .filter((value): value is Decimal => value !== null);
  const histogramDomain: OutcomeHistogramDomain | undefined = values.length === 0 ? undefined : {
    min: Decimal.min(...values).toString(),
    max: Decimal.max(...values).toString(),
    binCount: Math.min(7, Math.max(1, Math.ceil(Math.sqrt(values.length)))),
  };
  const groups = GROUPS.map((definition) => {
    const facts = inputFacts.filter(
      (fact) => normalizeInsightMarket(fact.market) === definition.market,
    );
    const excluded = [
      ...upstreamExclusions.filter(
        (exclusion) => exclusionMarket(exclusion) === definition.market,
      ),
    ];
    const report = buildOutcomeStructureReport(facts, excluded, definition.label, histogramDomain);
    return {
      ...definition,
      facts,
      report,
      diagnostics: buildOutcomeDiagnosticsReport(report, facts),
      excluded: report.excluded,
      sampleCount: report.sampleCount,
      descriptiveOnly: report.sampleCount < 3,
      rankable: report.sampleCount >= 3 && definition.market !== "unknown",
    } satisfies MarketBreakdownGroup;
  });

  return { overall, groups, calculationVersion: 1 };
}
