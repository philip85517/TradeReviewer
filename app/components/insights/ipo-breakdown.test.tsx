import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { InsightEpisodeFact } from "../../lib/insights/episode-facts";
import { buildIpoBreakdownReport } from "../../lib/insights/ipo-breakdown";
import { IpoBreakdown } from "./ipo-breakdown";

function fact(
  episodeId: string,
  classification: InsightEpisodeFact["ipoClassification"],
  returnPercent: string | null,
  overrides: Partial<InsightEpisodeFact> = {},
): InsightEpisodeFact {
  return {
    episodeId,
    instrumentId: "US:" + episodeId,
    instrumentSymbol: episodeId,
    instrumentName: episodeId,
    market: "US",
    direction: "long",
    startedAt: "2026-01-01T00:00:00Z",
    endedAt: "2026-01-02T00:00:00Z",
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
    ipoCostComplete: true,
    ...overrides,
  };
}

describe("IpoBreakdown", () => {
  afterEach(() => cleanup());

  it("shows all three source groups, reasons, and opens evidence episodes", async () => {
    const onOpenEpisode = vi.fn();
    const facts = [
      fact("ipo-episode", "ipo", "12", {
        ipoEvidence: [{ id: "ipo-event", label: "IPO 配售 / 获配" }],
      }),
      fact("ordinary-episode", "non-ipo", "-4"),
      fact("unknown-episode", "unknown", "2", {
        ipoClassificationReason: "历史库存缺口",
      }),
    ];

    render(
      <IpoBreakdown
        report={buildIpoBreakdownReport(facts)}
        facts={facts}
        onOpenEpisode={onOpenEpisode}
      />,
    );

    expect(screen.getByRole("heading", { name: "新股 / 非新股来源拆分" })).toBeVisible();
    expect(screen.getByText("新股 / IPO")).toBeVisible();
    expect(screen.getByText("非新股")).toBeVisible();
    expect(screen.getByText("无法判定")).toBeVisible();
    expect(screen.getByText(/历史库存缺口/)).toBeVisible();
    expect(screen.getByText(/IPO 配售 \/ 获配/)).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: /ipo-episode/ }));
    expect(onOpenEpisode).toHaveBeenCalledWith("US:ipo-episode", "ipo-episode");
  });

  it("uses dashes for unavailable metrics and explains coverage", () => {
    const facts = [fact("unknown-episode", "unknown", null, { ipoClassificationReason: "收益不可用" })];
    render(<IpoBreakdown report={buildIpoBreakdownReport(facts)} facts={facts} onOpenEpisode={vi.fn()} />);
    expect(within(screen.getByRole("article", { name: "无法判定" })).getByText(/0 个可比较回合/)).toBeVisible();
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
    expect(screen.getByText(/收益不可用/)).toBeVisible();
  });
});
