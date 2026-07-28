import { describe, expect, it } from "vitest";

import type {
  InsightEpisodeExclusion,
  InsightEpisodeFact,
} from "./episode-facts";
import { buildPatternInsightReport } from "./insight-engine";

function fact(
  index: number,
  overrides: Partial<InsightEpisodeFact> = {},
): InsightEpisodeFact {
  const day = String(index + 1).padStart(2, "0");
  return {
    episodeId: `episode-${day}`,
    instrumentId: `US:STOCK${day}`,
    instrumentSymbol: `STOCK${day}`,
    instrumentName: `股票 ${day}`,
    market: "US",
    direction: index % 2 === 0 ? "long" : "short",
    startedAt: `2025-01-${day}T15:00:00Z`,
    endedAt: `2025-01-${day}T20:00:00Z`,
    netPnl: String((index + 1) * 10),
    returnPercent: String(index + 1),
    rMultiple: String(index + 1),
    holdingMilliseconds: 86_400_000,
    holdingDays: index < 5 ? "3" : "8",
    averageEntryPrice: "10",
    openingExecutionCount: 1,
    addOnCount: 0,
    mfePercent: String(index + 2),
    maePercent: String(-(index + 1)),
    givebackPercent: "1",
    confirmedTagIds: [],
    tagDictionaryVersion: 1,
    confirmedRuleVersions: [],
    calculationVersion: 1,
    ...overrides,
  };
}

describe("buildPatternInsightReport", () => {
  it("uses R at 80% coverage and keeps 3–4 samples as early signals", () => {
    const facts = Array.from({ length: 10 }, (_, index) =>
      fact(index, {
        rMultiple: index < 8 ? String(index + 1) : null,
        confirmedTagIds: index < 3 ? ["breakout"] : [],
      }),
    );
    const upstream: InsightEpisodeExclusion = {
      episodeId: "episode-open",
      instrumentId: "US:OPEN",
      instrumentName: "开放持仓",
      startedAt: "2025-01-01T00:00:00Z",
      endedAt: null,
      reason: "open-episode",
      reasonLabel: "持仓回合尚未结束",
    };

    const report = buildPatternInsightReport(facts, [upstream]);
    const breakout = report.earlySignals.find(
      ({ dimension }) => dimension.value === "breakout",
    );

    expect(report.metricBasis).toBe("r-multiple");
    expect(breakout).toMatchObject({
      category: "pattern",
      confidence: "early-signal",
      sampleCount: 3,
      baselineCount: 5,
      medianTagged: "2",
      medianBaseline: "6",
      medianDifference: "-4",
      evidenceEpisodeIds: [
        "episode-01",
        "episode-02",
        "episode-03",
      ],
      counterexampleEpisodeIds: [],
    });
    expect(report.formalInsights).not.toContainEqual(
      expect.objectContaining({
        dimension: expect.objectContaining({ value: "breakout" }),
      }),
    );
    expect(report.excluded).toEqual([
      upstream,
      expect.objectContaining({
        episodeId: "episode-09",
        reason: "missing-comparison-metric",
      }),
      expect.objectContaining({
        episodeId: "episode-10",
        reason: "missing-comparison-metric",
      }),
    ]);
  });

  it("falls back to return at 70% R coverage and produces a usable comparison", () => {
    const facts = Array.from({ length: 10 }, (_, index) =>
      fact(index, {
        rMultiple: index < 7 ? String(index + 1) : null,
        returnPercent: String(index + 1),
        netPnl: String(index % 2 === 0 ? 10 : -5),
        confirmedTagIds: index < 5 ? ["pullback"] : [],
      }),
    );

    const report = buildPatternInsightReport(facts, []);
    const pullback = report.formalInsights.find(
      ({ dimension }) => dimension.value === "pullback",
    );

    expect(report.metricBasis).toBe("return-percent");
    expect(pullback).toMatchObject({
      confidence: "usable",
      sampleCount: 5,
      baselineCount: 5,
      medianTagged: "3",
      medianBaseline: "8",
      medianDifference: "-5",
      winRate: "100",
      netPnl: "20",
      timeRange: {
        start: "2025-01-01T15:00:00Z",
        end: "2025-01-05T20:00:00Z",
      },
      tagDictionaryVersion: 1,
      calculationVersion: 1,
    });
    expect(report.excluded).toEqual([]);
  });

  it("marks 10 samples high confidence and separates insufficient baselines", () => {
    const highFacts = Array.from({ length: 13 }, (_, index) =>
      fact(index, {
        confirmedTagIds: index < 10 ? ["planned"] : [],
      }),
    );
    const descriptiveFacts = Array.from({ length: 10 }, (_, index) =>
      fact(index, {
        confirmedTagIds: index < 8 ? ["bull-flag"] : [],
      }),
    );

    const high = buildPatternInsightReport(highFacts, []);
    const descriptive = buildPatternInsightReport(descriptiveFacts, []);

    expect(
      high.formalInsights.find(
        ({ dimension }) => dimension.value === "planned",
      ),
    ).toMatchObject({
      confidence: "high-confidence",
      sampleCount: 10,
      baselineCount: 3,
    });
    expect(
      descriptive.descriptiveStatistics.find(
        ({ dimension }) => dimension.value === "bull-flag",
      ),
    ).toMatchObject({
      sampleCount: 8,
      baselineCount: 2,
      medianBaseline: null,
      medianDifference: null,
    });
  });

  it("emits all three categories with evidence, counterexamples, and stable ranking", () => {
    const returns = ["4", "3", "-2", "2", "-1", "1", "0", "0", "0", "0"];
    const facts = Array.from({ length: 10 }, (_, index) =>
      fact(index, {
        direction: index < 5 ? "long" : "short",
        returnPercent: returns[index],
        rMultiple: null,
        netPnl: returns[index],
        tagDictionaryVersion: 2,
        confirmedTagIds: [
          ...(index < 5 ? ["breakout", "pullback"] : []),
          ...(index < 6 ? ["fomo"] : []),
        ],
        confirmedRuleVersions:
          index < 5
            ? [
                {
                  tagId: "breakout",
                  tagDictionaryVersion: 2,
                  ruleId: "entry-20d-breakout",
                  ruleVersion: 1,
                },
                {
                  tagId: "pullback",
                  tagDictionaryVersion: 2,
                  ruleId: "first-pullback-after-breakout",
                  ruleVersion: 1,
                },
              ]
            : [],
      }),
    );

    const report = buildPatternInsightReport(facts, []);
    const breakout = report.formalInsights.find(
      ({ dimension }) => dimension.value === "breakout",
    );

    expect(
      new Set(report.formalInsights.map(({ category }) => category)),
    ).toEqual(
      new Set(["condition", "pattern", "execution-psychology"]),
    );
    expect(breakout).toMatchObject({
      evidenceEpisodeIds: ["episode-01", "episode-02", "episode-04"],
      counterexampleEpisodeIds: ["episode-03", "episode-05"],
      baselineEpisodeIds: [
        "episode-06",
        "episode-07",
        "episode-08",
        "episode-09",
        "episode-10",
      ],
      ruleVersions: [
        {
          ruleId: "entry-20d-breakout",
          ruleVersion: 1,
        },
      ],
      tagDictionaryVersion: 2,
      medianMfePercent: "4",
      medianMaePercent: "-3",
      medianGivebackPercent: "1",
      conclusion: expect.stringContaining("不代表因果"),
    });

    const tiedPatternIds = report.formalInsights
      .filter(
        ({ dimension }) =>
          dimension.value === "breakout" ||
          dimension.value === "pullback",
      )
      .map(({ id }) => id);
    expect(tiedPatternIds).toEqual([
      "tag:breakout:dictionary-v2",
      "tag:pullback:dictionary-v2",
    ]);
  });

  it("keeps incompatible tag dictionary versions in separate candidates", () => {
    const facts = Array.from({ length: 13 }, (_, index) =>
      fact(index, {
        confirmedTagIds:
          index < 3 || (index >= 6 && index < 9) || index === 12
            ? ["breakout"]
            : [],
        tagDictionaryVersion: index < 6 ? 1 : 2,
        confirmedRuleVersions:
          index < 3 || (index >= 6 && index < 9)
            ? [
                {
                  tagId: "breakout",
                  tagDictionaryVersion: index < 3 ? 1 : 2,
                  ruleId: "entry-20d-breakout",
                  ruleVersion: 1,
                },
              ]
            : index === 12
              ? [
                  {
                    tagId: "breakout",
                    tagDictionaryVersion: 1,
                    ruleId: "entry-20d-breakout",
                    ruleVersion: 1,
                  },
                  {
                    tagId: "breakout",
                    tagDictionaryVersion: 2,
                    ruleId: "entry-20d-breakout",
                    ruleVersion: 2,
                  },
                ]
            : [],
      }),
    );

    const report = buildPatternInsightReport(facts, []);
    const breakoutCandidates = report.earlySignals.filter(
      ({ dimension }) => dimension.value === "breakout",
    );

    expect(breakoutCandidates).toHaveLength(2);
    expect(breakoutCandidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "tag:breakout:dictionary-v2",
          sampleCount: 3,
          baselineCount: 3,
          baselineEpisodeIds: [
            "episode-10",
            "episode-11",
            "episode-12",
          ],
          tagDictionaryVersion: 2,
        }),
        expect.objectContaining({
          id: "tag:breakout:dictionary-v1",
          sampleCount: 3,
          baselineCount: 3,
          baselineEpisodeIds: [
            "episode-04",
            "episode-05",
            "episode-06",
          ],
          tagDictionaryVersion: 1,
        }),
      ]),
    );
  });
});
