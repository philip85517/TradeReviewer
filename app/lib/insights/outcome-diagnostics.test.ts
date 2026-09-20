import { describe, expect, it } from "vitest";

import type { InsightEpisodeFact } from "./episode-facts";
import { buildOutcomeStructureReport } from "./outcome-structure";
import { buildOutcomeDiagnosticsReport } from "./outcome-diagnostics";

function fact(
  episodeId: string,
  returnPercent: string | null,
  day: number,
): InsightEpisodeFact {
  return {
    episodeId,
    instrumentId: `US:${episodeId}`,
    instrumentSymbol: episodeId,
    instrumentName: episodeId,
    market: "US",
    direction: "long",
    startedAt: `2025-01-${String(day).padStart(2, "0")}T15:00:00Z`,
    endedAt: `2025-01-${String(day + 1).padStart(2, "0")}T15:00:00Z`,
    netPnl: returnPercent ?? "0",
    returnPercent,
    rMultiple: null,
    holdingMilliseconds: 86_400_000,
    holdingDays: "1",
    averageEntryPrice: "10",
    openingExecutionCount: 1,
    addOnCount: 0,
    mfePercent: null,
    maePercent: null,
    givebackPercent: null,
    confirmedTagIds: [],
    tagDictionaryVersion: 1,
    confirmedRuleVersions: [],
    calculationVersion: 1,
  };
}

describe("buildOutcomeDiagnosticsReport", () => {
  it("calculates loss and profit breadth plus worst and best 20% concentration", () => {
    const facts = [
      fact("loss-1", "-20", 1),
      fact("loss-2", "-4", 2),
      fact("loss-3", "-3", 3),
      fact("loss-4", "-2", 4),
      fact("loss-5", "-1", 5),
      fact("profit-1", "10", 6),
      fact("profit-2", "4", 7),
      fact("profit-3", "3", 8),
      fact("profit-4", "2", 9),
      fact("profit-5", "1", 10),
      fact("flat", "0", 11),
    ];
    const report = buildOutcomeDiagnosticsReport(
      buildOutcomeStructureReport(facts, []),
      facts,
    );

    expect(report.metrics).toMatchObject({
      lossBreadthPercent: "45.454545454545454545",
      profitBreadthPercent: "45.454545454545454545",
      lossTailConcentrationPercent: "66.666666666666666667",
      profitTailConcentrationPercent: "50",
    });
    expect(report.diagnostics.map(({ label }) => label)).toEqual([
      "少数大亏拉动",
      "少数大赚拉动",
    ]);
    expect(report.diagnostics[0]).toMatchObject({
      sampleCount: 5,
      sampleEpisodeIds: ["loss-1", "loss-2", "loss-3", "loss-4", "loss-5"],
      evidenceEpisodeIds: ["loss-1"],
      counterexampleEpisodeIds: ["loss-5"],
      threshold: expect.objectContaining({
        minimumSideSampleCount: 5,
        tailSharePercent: "50",
      }),
      timeRange: {
        start: "2025-01-01T15:00:00Z",
        end: "2025-01-12T15:00:00Z",
      },
      calculationVersion: 1,
    });
  });

  it("describes broad losses and many small profits when tails are not concentrated", () => {
    const values = ["-1", "-2", "-3", "-4", "-5", "1", "2", "3", "4", "5"];
    const facts = values.map((value, index) => fact(`episode-${index}`, value, index + 1));
    const report = buildOutcomeDiagnosticsReport(
      buildOutcomeStructureReport(facts, []),
      facts,
    );

    expect(report.diagnostics.map(({ label }) => label)).toEqual([
      "亏损较普遍",
      "多笔小赚",
    ]);
    expect(report.diagnostics.every(({ counterexampleEpisodeIds, evidenceEpisodeIds }) =>
      evidenceEpisodeIds.length > 0 && counterexampleEpisodeIds.length > 0,
    )).toBe(true);
  });

  it("does not manufacture formal diagnoses below the five-sample side threshold", () => {
    const facts = [
      fact("loss-1", "-10", 1),
      fact("loss-2", "-1", 2),
      fact("profit-1", "10", 3),
      fact("profit-2", "1", 4),
      fact("flat", "0", 5),
      fact("unknown", null, 6),
    ];
    const report = buildOutcomeDiagnosticsReport(
      buildOutcomeStructureReport(facts, []),
      facts,
    );

    expect(report.diagnostics).toEqual([]);
    expect(report.sides).toMatchObject({
      loss: { sampleCount: 2, status: "insufficient-sample" },
      profit: { sampleCount: 2, status: "insufficient-sample" },
    });
    expect(report.metrics.lossBreadthPercent).toBe("40");
    expect(report.metrics.profitBreadthPercent).toBe("40");
  });
});
