import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { InsightEpisodeFact } from "../../lib/insights/episode-facts";
import type {
  PatternInsight,
  PatternInsightReport,
} from "../../lib/insights/insight-engine";
import { PatternInsights } from "./pattern-insights";

function fact(
  episodeId: string,
  instrumentName: string,
  symbol: string,
  returnPercent: string,
): InsightEpisodeFact {
  return {
    episodeId,
    instrumentId: `US:${symbol}`,
    instrumentSymbol: symbol,
    instrumentName,
    market: "US",
    direction: "long",
    startedAt: "2025-01-02T15:00:00Z",
    endedAt: "2025-01-05T15:00:00Z",
    netPnl: returnPercent,
    returnPercent,
    rMultiple: returnPercent,
    holdingMilliseconds: 259_200_000,
    holdingDays: "3",
    averageEntryPrice: "10",
    openingExecutionCount: 1,
    addOnCount: 0,
    mfePercent: "8",
    maePercent: "-3",
    givebackPercent: "2",
    confirmedTagIds: ["breakout"],
    tagDictionaryVersion: 1,
    confirmedRuleVersions: [],
    calculationVersion: 1,
  };
}

function insight(
  overrides: Partial<PatternInsight> = {},
): PatternInsight {
  return {
    id: "tag:breakout",
    category: "pattern",
    dimension: {
      kind: "confirmed-tag",
      id: "confirmed-tag",
      value: "breakout",
      label: "突破",
    },
    confidence: "usable",
    metricBasis: "r-multiple",
    sampleCount: 5,
    baselineCount: 3,
    timeRange: {
      start: "2025-01-02T15:00:00Z",
      end: "2025-06-02T15:00:00Z",
    },
    medianTagged: "1.8",
    medianBaseline: "0.6",
    medianDifference: "1.2",
    winRate: "60",
    netPnl: "850",
    medianMfePercent: "8",
    medianMaePercent: "-3",
    medianGivebackPercent: "2",
    planAdherenceRate: "80",
    evidenceEpisodeIds: ["episode-win"],
    counterexampleEpisodeIds: ["episode-loss"],
    baselineEpisodeIds: ["episode-base"],
    conclusion:
      "突破样本的中位 R 为 1.8，与基准组相差 1.2；这是相关性描述，不代表因果。",
    tagDictionaryVersion: 1,
    ruleVersions: [
      { ruleId: "entry-20d-breakout", ruleVersion: 1 },
    ],
    calculationVersion: 1,
    ...overrides,
  };
}

const facts = [
  fact("episode-win", "小鹏汽车", "XPEV", "2"),
  fact("episode-loss", "英伟达", "NVDA", "-1"),
  fact("episode-base", "小米集团-W", "1810", "0.5"),
];

function report(
  overrides: Partial<PatternInsightReport> = {},
): PatternInsightReport {
  return {
    metricBasis: "r-multiple",
    formalInsights: [insight()],
    earlySignals: [],
    descriptiveStatistics: [],
    excluded: [
      {
        episodeId: "episode-open",
        instrumentId: "US:OPEN",
        instrumentName: "开放持仓股票",
        startedAt: "2025-07-01T15:00:00Z",
        endedAt: null,
        reason: "open-episode",
        reasonLabel: "持仓回合尚未结束",
      },
    ],
    calculationVersion: 1,
    ...overrides,
  };
}

describe("PatternInsights", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows explainable formal metrics, evidence, counterexamples, and exclusions", async () => {
    const user = userEvent.setup();
    const onOpenEpisode = vi.fn();
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    render(
      <PatternInsights
        report={report()}
        facts={facts}
        suggestions={[]}
        episodeContexts={{}}
        onConfirmSuggestion={vi.fn()}
        onEditSuggestion={vi.fn()}
        onRejectSuggestion={vi.fn()}
        onOpenEpisode={onOpenEpisode}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "模式洞察" }),
    ).toBeInTheDocument();
    expect(screen.getByText("可用洞察")).toBeInTheDocument();
    expect(screen.getByText("5 个标签样本 · 3 个基准样本")).toBeInTheDocument();
    expect(screen.getByText("口径：计划风险 R")).toBeInTheDocument();
    expect(screen.getByText("中位 1.8R")).toBeInTheDocument();
    expect(screen.getByText("基准 0.6R")).toBeInTheDocument();
    expect(screen.getByText("胜率 60%")).toBeInTheDocument();
    expect(screen.getByText("净盈亏 850")).toBeInTheDocument();
    expect(screen.getByText("MFE 8%")).toBeInTheDocument();
    expect(screen.getByText("MAE -3%")).toBeInTheDocument();
    expect(screen.getByText("回吐 2%")).toBeInTheDocument();
    expect(screen.getByText("计划遵守 80%")).toBeInTheDocument();
    expect(
      screen.getByText("标签字典 v1 · 计算 v1 · entry-20d-breakout v1"),
    ).toBeInTheDocument();
    expect(screen.getByText("小鹏汽车（XPEV）")).toBeInTheDocument();
    expect(screen.getByText("英伟达（NVDA）")).toBeInTheDocument();
    expect(screen.getByText("持仓回合尚未结束")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: "查看证据 小鹏汽车 XPEV",
      }),
    );
    expect(onOpenEpisode).toHaveBeenCalledWith(
      "US:XPEV",
      "episode-win",
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("filters categories and labels early-only data without promoting it", async () => {
    const user = userEvent.setup();
    const early = insight({
      id: "tag:fomo",
      category: "execution-psychology",
      dimension: {
        kind: "confirmed-tag",
        id: "confirmed-tag",
        value: "fomo",
        label: "FOMO",
      },
      confidence: "early-signal",
      sampleCount: 3,
      baselineCount: 5,
      conclusion:
        "FOMO 当前仅有 3 个样本，这是相关性描述，不代表因果。",
    });
    render(
      <PatternInsights
        report={report({
          formalInsights: [
            insight(),
            insight({
              id: "direction:long",
              category: "condition",
              dimension: {
                kind: "direction",
                id: "direction",
                value: "long",
                label: "多头回合",
              },
              tagDictionaryVersion: null,
            }),
          ],
          earlySignals: [early],
          excluded: [],
        })}
        facts={facts}
        suggestions={[]}
        episodeContexts={{}}
        onConfirmSuggestion={vi.fn()}
        onEditSuggestion={vi.fn()}
        onRejectSuggestion={vi.fn()}
        onOpenEpisode={vi.fn()}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "只看交易条件" }),
    );
    expect(screen.getByText("多头回合")).toBeInTheDocument();
    expect(screen.queryByText("突破")).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "只看执行与心理" }),
    );
    expect(screen.getByText("FOMO")).toBeInTheDocument();
    expect(screen.getByText("样本不足，仅供观察")).toBeInTheDocument();
    expect(screen.queryByText("可用洞察")).not.toBeInTheDocument();
  });

  it("uses the report basis for evidence rows even when R is available", () => {
    render(
      <PatternInsights
        report={report({
          metricBasis: "return-percent",
          formalInsights: [
            insight({
              metricBasis: "return-percent",
              medianTagged: "2",
              medianBaseline: "0.5",
            }),
          ],
        })}
        facts={[
          { ...facts[0], rMultiple: "99", returnPercent: "2" },
          ...facts.slice(1),
        ]}
        suggestions={[]}
        episodeContexts={{}}
        onConfirmSuggestion={vi.fn()}
        onEditSuggestion={vi.fn()}
        onRejectSuggestion={vi.fn()}
        onOpenEpisode={vi.fn()}
      />,
    );

    expect(screen.getByText("2%", { selector: "b" })).toBeInTheDocument();
    expect(screen.queryByText("99R")).not.toBeInTheDocument();
  });

  it("uses an honest empty state when no candidate reaches three samples", () => {
    render(
      <PatternInsights
        report={report({
          formalInsights: [],
          earlySignals: [],
          descriptiveStatistics: [],
          excluded: [],
        })}
        facts={[]}
        suggestions={[]}
        episodeContexts={{}}
        onConfirmSuggestion={vi.fn()}
        onEditSuggestion={vi.fn()}
        onRejectSuggestion={vi.fn()}
        onOpenEpisode={vi.fn()}
      />,
    );

    expect(screen.getByText("还没有足够样本形成模式")).toBeInTheDocument();
    expect(
      screen.getByText("至少需要 3 个可比较回合才会显示早期线索。"),
    ).toBeInTheDocument();
    expect(screen.queryByText("不代表因果")).not.toBeInTheDocument();
  });
});
