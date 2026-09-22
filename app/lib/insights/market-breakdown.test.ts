import { describe, expect, it } from "vitest";

import type { InsightEpisodeFact } from "./episode-facts";
import { buildMarketBreakdownReport } from "./market-breakdown";

function fact(
  episodeId: string,
  market: string,
  returnPercent: string | null,
): InsightEpisodeFact {
  return {
    episodeId,
    instrumentId: `${market}:${episodeId}`,
    instrumentSymbol: episodeId,
    instrumentName: episodeId,
    market,
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
  };
}

describe("buildMarketBreakdownReport", () => {
  it("creates stable US, HK, CN-SH, CN-SZ, and unknown groups with reused metrics", () => {
    const facts = [
      fact("us-win", "US", "10"),
      fact("us-loss", "US", "-5"),
      fact("hk-win", "HK", "4"),
      fact("sh-flat", "CN-SH", "0"),
      fact("sz-loss", "CN-SZ", "-2"),
      fact("unknown-win", "OTC", "3"),
      fact("other-loss", "", "-1"),
    ];

    const report = buildMarketBreakdownReport(facts, []);

    expect(report.groups.map((group) => group.market)).toEqual([
      "US",
      "HK",
      "CN-SH",
      "CN-SZ",
      "unknown",
    ]);
    expect(report.groups.map((group) => group.sampleCount)).toEqual([2, 1, 1, 1, 2]);
    expect(report.groups[0].report.metrics.odds).toBe("2");
    expect(report.groups[4].facts.map(({ episodeId }) => episodeId)).toEqual([
      "unknown-win",
      "other-loss",
    ]);
    expect(report.groups.every((group) => group.report.metricBasis === "return-percent")).toBe(true);
  });

  it("marks groups below three samples as descriptive-only and never rankable", () => {
    const report = buildMarketBreakdownReport(
      [fact("us-a", "US", "1"), fact("us-b", "US", "2"), fact("hk-a", "HK", "4")],
      [],
    );

    expect(report.groups.find(({ market }) => market === "US")).toMatchObject({
      sampleCount: 2,
      descriptiveOnly: true,
      rankable: false,
    });
    expect(report.groups.find(({ market }) => market === "HK")).toMatchObject({
      sampleCount: 1,
      descriptiveOnly: true,
      rankable: false,
    });
  });

  it("keeps null return facts as group exclusions without turning them into zero", () => {
    const report = buildMarketBreakdownReport(
      [fact("us-unknown", "US", null), fact("us-win", "US", "2")],
      [],
    );
    const us = report.groups.find(({ market }) => market === "US");

    expect(us?.sampleCount).toBe(1);
    expect(us?.excluded).toEqual([
      expect.objectContaining({ episodeId: "us-unknown", reason: "missing-comparison-metric" }),
    ]);
    expect(us?.report.metrics.profitFactor).toBe(null);
  });

  it("preserves upstream exclusions and does not mix facts from separate simulation runs", () => {
    const upstreamExclusion = {
      episodeId: "US:open-run-b",
      instrumentId: "US:OPEN",
      instrumentName: "开放回合",
      startedAt: "2025-01-01T00:00:00Z",
      endedAt: null,
      reason: "open-episode" as const,
      reasonLabel: "持仓回合尚未结束",
    };
    const report = buildMarketBreakdownReport(
      [fact("run-a", "US", "3")],
      [upstreamExclusion],
    );

    expect(report.overall.excluded).toContainEqual(upstreamExclusion);
    expect(report.groups.find(({ market }) => market === "US")?.excluded).toContainEqual(upstreamExclusion);
    expect(report.groups.find(({ market }) => market === "HK")?.facts).toEqual([]);
  });
});
