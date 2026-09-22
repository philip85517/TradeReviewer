import { describe, expect, it } from "vitest";

import type { InsightEpisodeFact } from "./episode-facts";
import { buildOutcomeStructureReport } from "./outcome-structure";

function fact(
  episodeId: string,
  returnPercent: string | null,
  overrides: Partial<InsightEpisodeFact> = {},
): InsightEpisodeFact {
  return {
    episodeId,
    instrumentId: `US:${episodeId}`,
    instrumentSymbol: episodeId,
    instrumentName: episodeId,
    market: "US",
    direction: "long",
    startedAt: "2025-01-01T15:00:00Z",
    endedAt: "2025-01-02T15:00:00Z",
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
    ...overrides,
  };
}

describe("buildOutcomeStructureReport", () => {
  it("uses available fee-adjusted return percentages and separates wins, losses, and ties", () => {
    const report = buildOutcomeStructureReport(
      [
        fact("win-1", "10"),
        fact("win-2", "2"),
        fact("win-3", "4"),
        fact("loss-1", "-1"),
        fact("loss-2", "-3"),
        fact("loss-3", "-5"),
        fact("flat", "0"),
        fact("unknown", null),
      ],
      [],
    );

    expect(report.sampleCount).toBe(7);
    expect(report.distribution).toMatchObject({
      profitCount: 3,
      lossCount: 3,
      flatCount: 1,
    });
    expect(report.metrics).toMatchObject({
      totalWinRate: "42.857142857142857143",
      nonFlatWinRate: "50",
      averageProfitPercent: "5.3333333333333333333",
      medianProfitPercent: "4",
      averageLossPercent: "-3",
      medianLossPercent: "-3",
      odds: "1.7777777777777777778",
      profitFactor: "1.7777777777777777778",
      expectancyPercent: "1",
      maxProfitPercent: "10",
      maxLossPercent: "-5",
    });
    expect(report.excluded).toEqual([
      expect.objectContaining({
        episodeId: "unknown",
        reason: "missing-comparison-metric",
      }),
    ]);
  });

  it("classifies each side around its own median and preserves episode links", () => {
    const report = buildOutcomeStructureReport(
      [
        fact("win-1", "2"),
        fact("win-2", "4"),
        fact("win-3", "10"),
        fact("loss-1", "-1"),
        fact("loss-2", "-3"),
        fact("loss-3", "-8"),
        fact("flat", "0"),
      ],
      [],
    );

    expect(report.distribution.profitSize).toMatchObject({
      classification: "reliable",
      thresholdPercent: "4",
    });
    expect(report.distribution.lossSize).toMatchObject({
      classification: "reliable",
      thresholdPercent: "3",
    });
    expect(report.buckets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "small-profit", count: 2, episodeIds: ["win-1", "win-2"] }),
        expect.objectContaining({ id: "large-profit", count: 1, episodeIds: ["win-3"] }),
        expect.objectContaining({ id: "small-loss", count: 2, episodeIds: ["loss-1", "loss-2"] }),
        expect.objectContaining({ id: "large-loss", count: 1, episodeIds: ["loss-3"] }),
        expect.objectContaining({ id: "flat", count: 1, episodeIds: ["flat"] }),
      ]),
    );
  });

  it("does not manufacture small/large classifications with fewer than three same-side samples", () => {
    const report = buildOutcomeStructureReport(
      [fact("win-1", "2"), fact("win-2", "4"), fact("loss-1", "-3"), fact("flat", "0")],
      [],
    );

    expect(report.distribution.profitSize).toMatchObject({
      classification: "unreliable",
      thresholdPercent: null,
    });
    expect(report.distribution.lossSize).toMatchObject({
      classification: "unreliable",
      thresholdPercent: null,
    });
    expect(report.buckets.filter((bucket) => bucket.side !== "flat").every((bucket) => bucket.count === 0)).toBe(true);
    expect(report.distribution.unreliableReason).toContain("3");
  });

  it("keeps upstream exclusions and reports an accessible histogram with a zero boundary", () => {
    const report = buildOutcomeStructureReport(
      [fact("a", "-2"), fact("b", "1"), fact("c", "5")],
      [
        {
          episodeId: "open",
          instrumentId: "US:OPEN",
          instrumentName: "开放回合",
          startedAt: "2025-01-01T00:00:00Z",
          endedAt: null,
          reason: "open-episode",
          reasonLabel: "持仓回合尚未结束",
        },
      ],
    );

    expect(report.excluded).toHaveLength(1);
    expect(report.histogram.zeroBoundaryPercent).toBe("0");
    expect(report.histogram.zeroPositionPercent).toBe("28.571428571428571429");
    expect(report.histogram.bins.length).toBeGreaterThan(0);
    expect(report.histogram.bins.every((bin) => ["loss", "flat", "profit", "mixed"].includes(bin.tone))).toBe(true);
    expect(report.oddsWinRate.point).toMatchObject({
      label: "总体",
      sampleCount: 3,
      winRatePercent: "66.666666666666666667",
      odds: "1.5",
    });
    expect(report.oddsWinRate.breakEvenLine).toEqual(expect.arrayContaining([
      { winRatePercent: "50", odds: "1" },
    ]));
    expect(report.histogram.bins.flatMap((bin) => bin.episodeIds)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("uses one valid histogram interval when every return percentage is identical", () => {
    const report = buildOutcomeStructureReport(
      [fact("same-1", "2.5"), fact("same-2", "2.5"), fact("same-3", "2.5")],
      [],
    );

    expect(report.histogram.bins).toHaveLength(1);
    expect(report.histogram.bins[0]).toMatchObject({
      startPercent: "2.5",
      endPercent: "2.5",
      count: 3,
      episodeIds: ["same-1", "same-2", "same-3"],
    });
    expect(report.histogram.bins.every(({ startPercent, endPercent }) =>
      Number(startPercent) <= Number(endPercent),
    )).toBe(true);
    expect(report.histogram.bins[0].tone).toBe("profit");
    expect(report.histogram.zeroPositionPercent).toBe("0");
  });
});
