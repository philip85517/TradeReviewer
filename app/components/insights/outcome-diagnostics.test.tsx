import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { InsightEpisodeFact } from "../../lib/insights/episode-facts";
import { buildOutcomeStructureReport } from "../../lib/insights/outcome-structure";
import { buildOutcomeDiagnosticsReport } from "../../lib/insights/outcome-diagnostics";
import { OutcomeDiagnostics } from "./outcome-diagnostics";

function fact(episodeId: string, value: string, day: number): InsightEpisodeFact {
  return {
    episodeId,
    instrumentId: `US:${episodeId}`,
    instrumentSymbol: episodeId,
    instrumentName: `股票 ${episodeId}`,
    market: "US",
    direction: "long",
    startedAt: `2025-01-${String(day).padStart(2, "0")}T15:00:00Z`,
    endedAt: `2025-01-${String(day + 1).padStart(2, "0")}T15:00:00Z`,
    netPnl: value,
    returnPercent: value,
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

describe("OutcomeDiagnostics", () => {
  afterEach(cleanup);

  it("shows diagnostic audit details and opens evidence and counterexample episodes", async () => {
    const user = userEvent.setup();
    const onOpenEpisode = vi.fn();
    const facts = [
      ...["-20", "-4", "-3", "-2", "-1"].map((value, index) => fact(`loss-${index + 1}`, value, index + 1)),
      ...["10", "4", "3", "2", "1"].map((value, index) => fact(`profit-${index + 1}`, value, index + 6)),
    ];
    const report = buildOutcomeDiagnosticsReport(buildOutcomeStructureReport(facts, []), facts);

    render(<OutcomeDiagnostics report={report} facts={facts} onOpenEpisode={onOpenEpisode} />);

    expect(screen.getByRole("region", { name: "尾部结构诊断" })).toBeInTheDocument();
    expect(screen.getByText("少数大亏拉动")).toBeInTheDocument();
    expect(screen.getByText(/亏损广度 50%/)).toBeInTheDocument();
    expect(screen.getByText(/最差 20% 尾部集中度/)).toBeInTheDocument();
    expect(screen.getAllByText(/计算 v1/)).toHaveLength(2);
    expect(screen.getAllByText(/阈值：同侧样本至少 5 笔/)).toHaveLength(2);

    await user.click(screen.getAllByText("支持证据（1）")[0]);
    await user.click(screen.getByRole("button", { name: "查看证据 股票 loss-1 loss-1" }));
    await user.click(screen.getAllByText("反例（1）")[0]);
    await user.click(screen.getByRole("button", { name: "查看反例 股票 loss-5 loss-5" }));

    expect(onOpenEpisode).toHaveBeenNthCalledWith(1, "US:loss-1", "loss-1");
    expect(onOpenEpisode).toHaveBeenNthCalledWith(2, "US:loss-5", "loss-5");
  });

  it("shows unavailable tail metrics as unknown and no formal diagnosis for small samples", () => {
    const facts = [{
      ...fact("unknown", "0", 1),
      returnPercent: null,
    }];
    const report = buildOutcomeDiagnosticsReport(buildOutcomeStructureReport(facts, []), facts);

    render(<OutcomeDiagnostics report={report} facts={facts} onOpenEpisode={vi.fn()} />);

    expect(screen.getAllByText("样本不足，不生成正式诊断")).toHaveLength(3);
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
    expect(screen.queryByText("少数大亏拉动")).not.toBeInTheDocument();
  });
});
