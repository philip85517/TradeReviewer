import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { InsightEpisodeFact } from "../../lib/insights/episode-facts";
import type {
  PatternInsight,
  PatternInsightReport,
} from "../../lib/insights/insight-engine";
import { buildPatternInsightReport } from "../../lib/insights/insight-engine";
import { buildOutcomeStructureReport } from "../../lib/insights/outcome-structure";
import { PatternInsights } from "./pattern-insights";

function fact(
  episodeId: string,
  instrumentName: string,
  symbol: string,
  returnPercent: string,
  overrides: Partial<InsightEpisodeFact> = {},
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
    ...overrides,
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
    pathSampleCount: 5,
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

  it("shows the return structure summary, accessible distribution table, and opens a bucket episode", async () => {
    const user = userEvent.setup();
    const onOpenEpisode = vi.fn();
    const outcomeFacts = [
      fact("episode-win", "小鹏汽车", "XPEV", "2"),
      fact("episode-loss", "英伟达", "NVDA", "-1"),
      fact("episode-base", "小米集团-W", "1810", "0.5"),
      fact("episode-profit-small", "腾讯控股", "0700", "1"),
      fact("episode-loss-2", "苹果", "AAPL", "-2"),
      fact("episode-loss-3", "微软", "MSFT", "-3"),
    ];

    render(
      <PatternInsights
        report={report({
          outcomeStructure: buildOutcomeStructureReport(outcomeFacts, []),
        })}
        facts={outcomeFacts}
        suggestions={[]}
        episodeContexts={{}}
        onConfirmSuggestion={vi.fn()}
        onEditSuggestion={vi.fn()}
        onRejectSuggestion={vi.fn()}
        onOpenEpisode={onOpenEpisode}
      />,
    );

    expect(screen.getByRole("region", { name: "收益结构" })).toBeInTheDocument();
    expect(screen.getByText("主口径：已平仓且费用后收益率可用的回合；描述统计不代表因果或交易建议。")).toBeInTheDocument();
    expect(screen.getByText("盈利 / 亏损 / 持平")).toBeInTheDocument();
    expect(screen.getByText("总胜率（含持平）")).toBeInTheDocument();
    expect(screen.getByText("收益率分布的可读替代表格")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /收益率分布（零收益线：0%）/ })).toBeInTheDocument();
    expect(screen.getByText(/盈利侧：可可靠分类/)).toBeInTheDocument();

    await user.click(screen.getByText(/大赚 · 1 笔/));
    await user.click(screen.getByRole("button", { name: "查看大赚 小鹏汽车 XPEV" }));
    expect(onOpenEpisode).toHaveBeenCalledWith("US:XPEV", "episode-win");
  });

  it("shows the complete outcome analysis with diagnostics, IPO groups, and market groups", async () => {
    const user = userEvent.setup();
    const onOpenEpisode = vi.fn();
    const analysisFacts = [
      fact("profit-1", "盈利一", "P1", "1", { ipoClassification: "ipo", ipoEvidence: [{ id: "ipo-1", label: "配售" }] }),
      fact("profit-2", "盈利二", "P2", "2", { ipoClassification: "ipo", ipoEvidence: [{ id: "ipo-2", label: "获配" }] }),
      fact("profit-3", "盈利三", "P3", "3", { ipoClassification: "non-ipo" }),
      fact("profit-4", "盈利四", "P4", "4", { ipoClassification: "non-ipo" }),
      fact("profit-5", "盈利五", "P5", "5", { market: "JP", ipoClassification: "unknown", ipoClassificationReason: "库存来源不明确" }),
      fact("loss-1", "亏损一", "L1", "-1", { ipoClassification: "non-ipo" }),
      fact("loss-2", "亏损二", "L2", "-2", { ipoClassification: "non-ipo" }),
      fact("loss-3", "亏损三", "L3", "-3", { ipoClassification: "unknown", ipoClassificationReason: "历史缺口" }),
      fact("loss-4", "亏损四", "L4", "-4", { ipoClassification: "unknown", ipoClassificationReason: "库存冲突" }),
      fact("loss-5", "亏损五", "L5", "-20", { ipoClassification: "non-ipo" }),
    ];

    render(
      <PatternInsights
        report={buildPatternInsightReport(analysisFacts, [])}
        facts={analysisFacts}
        suggestions={[]}
        episodeContexts={{}}
        onConfirmSuggestion={vi.fn()}
        onEditSuggestion={vi.fn()}
        onRejectSuggestion={vi.fn()}
        onOpenEpisode={onOpenEpisode}
      />,
    );

    expect(screen.getByRole("tablist", { name: "收益结构分析分组" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "总体" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("region", { name: "收益结构" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "尾部结构诊断" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "新股来源拆分" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "分市场收益结构" })).not.toBeInTheDocument();
    expect(screen.getAllByText(/不代表因果或交易建议/).length).toBeGreaterThan(0);

    await user.click(screen.getByRole("tab", { name: "IPO / 非新股" }));
    expect(screen.getByRole("tab", { name: "IPO / 非新股" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("region", { name: "新股来源拆分" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "新股 / 非新股来源拆分" })).toBeInTheDocument();
    expect(screen.getByText("无法判定")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "收益结构" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "市场" }));
    expect(screen.getByRole("tab", { name: "市场" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("region", { name: "分市场收益结构" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "分市场表现" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "新股来源拆分" })).not.toBeInTheDocument();

    await user.click(screen.getByText(/查看未知市场交易回合/));
    await user.click(screen.getByRole("button", { name: "查看未知市场 盈利五" }));
    expect(onOpenEpisode).toHaveBeenCalledWith("US:P5", "profit-5");
  });

  it("renders unavailable outcome metrics as a dash instead of zero", () => {
    const outcomeFacts = [fact("episode-win", "小鹏汽车", "XPEV", "2")];
    render(
      <PatternInsights
        report={report({
          outcomeStructure: buildOutcomeStructureReport(outcomeFacts, []),
        })}
        facts={outcomeFacts}
        suggestions={[]}
        episodeContexts={{}}
        onConfirmSuggestion={vi.fn()}
        onEditSuggestion={vi.fn()}
        onRejectSuggestion={vi.fn()}
        onOpenEpisode={vi.fn()}
      />,
    );

    const odds = screen.getByText("赔率").parentElement;
    expect(odds).toHaveTextContent("赔率—");
    expect(odds).not.toHaveTextContent("赔率0");
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
    expect(screen.getByText("可比较样本")).toBeInTheDocument();
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

    await user.click(screen.getByText("证据交易（1）"));
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

  it("shows unavailable path aggregates as unknown rather than zero", () => {
    render(
      <PatternInsights
        report={report({
          formalInsights: [insight({
            pathSampleCount: 0,
            medianMfePercent: null,
            medianMaePercent: null,
            medianGivebackPercent: null,
          })],
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

    expect(screen.getByText("MFE —")).toBeInTheDocument();
    expect(screen.getByText("MAE —")).toBeInTheDocument();
    expect(screen.getByText("回吐 —")).toBeInTheDocument();
    expect(screen.getByText("路径样本 0 / 5 · 日线不完整")).toBeInTheDocument();
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
    expect(screen.queryByText("可比较样本")).not.toBeInTheDocument();
  });

  it("uses the report basis for evidence rows even when R is available", () => {
    render(
      <PatternInsights
        report={report({
          metricBasis: "return-percent",
          formalInsights: [
            insight({
              metricBasis: "return-percent",
              medianTagged: "11.1111111111111",
              medianBaseline: "0.5555555555555",
              winRate: "66.6666666666667",
            }),
          ],
        })}
        facts={[
          {
            ...facts[0],
            rMultiple: "99",
            returnPercent: "10.4972375690608",
          },
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

    expect(screen.getByText("中位 11.11%")).toBeInTheDocument();
    expect(screen.getByText("基准 0.56%")).toBeInTheDocument();
    expect(screen.getByText("胜率 66.67%")).toBeInTheDocument();
    expect(screen.getByText("10.5%", { selector: "b" })).toBeInTheDocument();
    expect(screen.queryByText("11.1111111111111%")).not.toBeInTheDocument();
    expect(screen.queryByText("99R")).not.toBeInTheDocument();
  });

  it("labels insufficient-baseline cards as descriptive statistics", () => {
    const descriptive = insight({
      id: "market:US",
      category: "condition",
      dimension: {
        kind: "market",
        id: "market",
        value: "US",
        label: "美股",
      },
      sampleCount: 8,
      baselineCount: 1,
      medianBaseline: null,
      medianDifference: null,
      tagDictionaryVersion: null,
    });
    const { container } = render(
      <PatternInsights
        report={report({
          formalInsights: [],
          descriptiveStatistics: [descriptive],
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

    expect(
      container.querySelector(".insight-confidence"),
    ).toHaveTextContent("描述统计");
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
