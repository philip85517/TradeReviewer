import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { InsightEpisodeFact } from "../../lib/insights/episode-facts";
import { buildMarketBreakdownReport } from "../../lib/insights/market-breakdown";
import { MarketBreakdown } from "./market-breakdown";

function fact(episodeId: string, market: string, returnPercent: string): InsightEpisodeFact {
  return {
    episodeId,
    instrumentId: `${market}:${episodeId}`,
    instrumentSymbol: episodeId,
    instrumentName: episodeId,
    market,
    direction: "long",
    startedAt: "2025-01-01T15:00:00Z",
    endedAt: "2025-01-02T15:00:00Z",
    netPnl: returnPercent,
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

describe("MarketBreakdown", () => {
  afterEach(cleanup);

  it("shows each market's sample count, shared core metrics, and descriptive-only warning", () => {
    const facts = [fact("us-a", "US", "3"), fact("us-b", "US", "-1"), fact("hk-a", "HK", "2")];
    render(
      <MarketBreakdown
        report={buildMarketBreakdownReport(facts, [])}
        facts={facts}
        onOpenEpisode={vi.fn()}
      />,
    );

    expect(screen.getByRole("region", { name: "分市场收益结构" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "分市场表现" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "美股" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "港股" })).toBeInTheDocument();
    expect(screen.getByText("2 个合格回合")).toBeInTheDocument();
    expect(screen.getByText("1 个合格回合")).toBeInTheDocument();
    expect(screen.getAllByText("仅描述统计：样本少于 3，不生成诊断或排名。")).toHaveLength(5);
    expect(screen.getAllByText("口径：收益率口径")).toHaveLength(5);
    expect(screen.getByText("跨币种仅合并可比较的收益率和比例指标；金额不可用时显示未知。")).toBeInTheDocument();
  });

  it("opens a market episode from its accessible transaction list", async () => {
    const user = userEvent.setup();
    const onOpenEpisode = vi.fn();
    const facts = [fact("us-a", "US", "3"), fact("us-b", "US", "-1")];
    render(
      <MarketBreakdown
        report={buildMarketBreakdownReport(facts, [])}
        facts={facts}
        onOpenEpisode={onOpenEpisode}
      />,
    );

    await user.click(screen.getByRole("button", { name: "查看美股 us-a" }));
    expect(onOpenEpisode).toHaveBeenCalledWith("US:us-a", "us-a");
  });

  it("shows unknown market and unavailable metric as unknown, not zero", () => {
    const facts = [fact("other", "OTC", "1")];
    render(
      <MarketBreakdown
        report={buildMarketBreakdownReport(facts, [])}
        facts={facts}
        onOpenEpisode={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "未知市场" })).toBeInTheDocument();
    expect(screen.getByText("未知市场字段，保留在未知组，不参与市场排名。")).toBeInTheDocument();
    expect(within(screen.getByRole("article", { name: "未知市场收益结构" })).getByText("赔率—")).toBeInTheDocument();
  });
});
