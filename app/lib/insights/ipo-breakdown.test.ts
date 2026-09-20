import { describe, expect, it } from "vitest";

import type { InsightEpisodeExclusion, InsightEpisodeFact } from "./episode-facts";
import { buildIpoBreakdownReport } from "./ipo-breakdown";

function fact(
  episodeId: string,
  classification: InsightEpisodeFact["ipoClassification"],
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
    startedAt: "2026-01-01T00:00:00.000Z",
    endedAt: "2026-01-02T00:00:00.000Z",
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
    ipoClassification: classification,
    ipoEvidence: [],
    ipoClassificationReason: null,
    ipoCostComplete: classification !== "ipo" || returnPercent !== null,
    ...overrides,
  };
}

describe("buildIpoBreakdownReport", () => {
  it("keeps unknown samples in coverage while comparing only classified, eligible results", () => {
    const report = buildIpoBreakdownReport([
      fact("ipo-win", "ipo", "20", {
        ipoEvidence: [{ id: "allocation-1", label: "IPO 配售" }],
      }),
      fact("ipo-loss", "ipo", "-10"),
      fact("ordinary-flat", "non-ipo", "0"),
      fact("unknown", "unknown", "30", {
        ipoClassificationReason: "历史库存缺口",
      }),
      fact("ipo-incomplete", "ipo", "5", { ipoCostComplete: false }),
      fact("missing", "unknown", null, {
        ipoClassificationReason: "收益不可用",
      }),
    ]);

    expect(report.groups.map((group) => [group.id, group.sampleCount])).toEqual([
      ["ipo", 3],
      ["non-ipo", 1],
      ["unknown", 2],
    ]);
    expect(report.groups[0]).toMatchObject({
      comparableSampleCount: 2,
      excludedCount: 1,
      classificationLabel: "新股 / IPO",
    });
    expect(report.groups[0].outcome.metrics).toMatchObject({
      totalWinRate: "50",
      nonFlatWinRate: "50",
      averageProfitPercent: "20",
      averageLossPercent: "-10",
      odds: "2",
    });
    expect(report.groups[0].excluded).toEqual([
      expect.objectContaining({
        episodeId: "ipo-incomplete",
        reason: "ipo-cost-incomplete",
      }),
    ]);
    expect(report.groups[2].outcome.sampleCount).toBe(1);
    expect(report.groups[2].reasons).toEqual([
      expect.objectContaining({ episodeId: "unknown", reason: "历史库存缺口" }),
      expect.objectContaining({ episodeId: "missing", reason: "收益不可用" }),
    ]);
  });

  it("retains evidence IDs and outcome buckets for each group", () => {
    const report = buildIpoBreakdownReport([
      fact("ipo-a", "ipo", "3", {
        ipoEvidence: [
          { id: "allocation-1", label: "IPO 配售" },
          { id: "execution-1", label: "执行背书" },
        ],
      }),
      fact("ordinary-b", "non-ipo", "-4"),
    ]);

    expect(report.groups[0].evidence).toEqual([
      expect.objectContaining({ episodeId: "ipo-a", evidenceIds: ["allocation-1", "execution-1"] }),
    ]);
    expect(report.groups[0].outcome.buckets.map((bucket) => bucket.id)).toEqual([
      "small-loss",
      "large-loss",
      "small-profit",
      "large-profit",
      "flat",
    ]);
    expect(report.groups[0].outcome.histogram.bins[0].episodeIds).toEqual(["ipo-a"]);
    expect(report.groups[1].outcome.histogram.bins[0].episodeIds).toEqual(["ordinary-b"]);
  });

  it("preserves upstream exclusions in the unknown-source audit trail", () => {
    const facts = [fact("unknown", "unknown", "4")];
    const exclusion: InsightEpisodeExclusion = {
      episodeId: "open-source",
      instrumentId: "US:open-source",
      instrumentName: "开放来源",
      startedAt: "2026-01-03T00:00:00.000Z",
      endedAt: null,
      reason: "open-episode",
      reasonLabel: "持仓回合尚未结束",
    };

    const report = buildIpoBreakdownReport(facts, [exclusion]);

    expect(report.excluded).toEqual([exclusion]);
    expect(report.groups[2].excluded).toEqual([exclusion]);
  });
});
