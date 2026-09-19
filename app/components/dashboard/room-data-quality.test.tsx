import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { TradingRoomQualityModel } from "../../lib/reviews/trading-room-quality";
import { RoomDataQuality } from "./room-data-quality";

function model(): TradingRoomQualityModel {
  return {
    scopeKey: "live|all|month",
    scope: {
      nature: "live",
      assetCategory: "all",
      period: { preset: "month", startDate: "2026-09-01", endDate: "2026-09-19" },
      simulationRunId: null,
      accountIds: [],
      instrumentIds: [],
      markets: [],
      currencies: [],
      reviewStatuses: [],
    },
    status: "limited",
    summary: "部分结果不可用",
    unknownAssetCount: 0,
    unknownAssetEpisodeCount: 0,
    retryQueue: ["US:SPY"],
    supplementQueue: [],
    sourceUnsupportedQueue: [],
    dimensions: [
      {
        id: "transaction",
        label: "交易盈亏可信度",
        status: "available",
        totalCount: 2,
        availableCount: 2,
        affectedCount: 0,
        impact: "可信已平仓盈亏可用于本期统计。",
        reason: "当前范围的已平仓交易盈亏均有可信证据",
        asOf: "2026-09-19",
        action: "none",
        actionLabel: "",
        affectedInstrumentIds: [],
        affectedEpisodeIds: [],
        retryableInstrumentIds: [],
        issues: [],
      },
      {
        id: "holdings",
        label: "持仓估值行情",
        status: "limited",
        totalCount: 2,
        availableCount: 1,
        affectedCount: 1,
        impact: "受影响持仓不显示浮盈亏。",
        reason: "1 个持仓回合的估值证据待核对",
        asOf: "2026-09-19",
        action: "retry",
        actionLabel: "重试持仓估值行情",
        affectedInstrumentIds: ["US:SPY"],
        affectedEpisodeIds: ["ep-2"],
        retryableInstrumentIds: ["US:SPY"],
        issues: [],
      },
      {
        id: "historical",
        label: "历史复盘 K 线",
        status: "available",
        totalCount: 2,
        availableCount: 2,
        affectedCount: 0,
        impact: "历史复盘 K 线可用。",
        reason: "当前范围所需历史 K 线均有覆盖",
        asOf: "2026-09-19",
        action: "none",
        actionLabel: "",
        affectedInstrumentIds: [],
        affectedEpisodeIds: [],
        retryableInstrumentIds: [],
        issues: [],
      },
      {
        id: "fx",
        label: "人民币估算汇率",
        status: "limited",
        totalCount: 1,
        availableCount: 1,
        affectedCount: 0,
        impact: "人民币估算沿用旧汇率，原币金额不受影响。",
        reason: "本次更新失败，沿用 2026-09-18 汇率估算",
        asOf: "2026-09-18",
        action: "retry",
        actionLabel: "重试汇率",
        affectedInstrumentIds: [],
        affectedEpisodeIds: [],
        retryableInstrumentIds: [],
        issues: [],
      },
    ],
  };
}

describe("RoomDataQuality", () => {
  it("keeps four dimensions visible and routes retry with its scoped ids", async () => {
    const user = userEvent.setup();
    const onRetryDataQuality = vi.fn();
    render(<RoomDataQuality model={model()} onRetryDataQuality={onRetryDataQuality} />);

    expect(screen.getByRole("region", { name: "数据质量摘要" })).toBeInTheDocument();
    expect(screen.getByText("部分结果不可用")).toBeInTheDocument();
    expect(screen.getByText("本次更新失败，沿用 2026-09-18 汇率估算")).toBeInTheDocument();
    expect(screen.getByText("已用 1 / 2 个回合；受影响 1 个")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "重试持仓估值行情" }));
    expect(onRetryDataQuality).toHaveBeenCalledWith("holdings", ["US:SPY"]);
  });

  it("routes source and evidence actions without exposing account ids", async () => {
    const user = userEvent.setup();
    const onOpenDataManagement = vi.fn();
    const onOpenDataCheck = vi.fn();
    const value = model();
    const transaction = value.dimensions[0];
    const source = value.dimensions[2];
    render(
      <RoomDataQuality
        model={{
          ...value,
          dimensions: [
            {
              ...transaction,
              status: "needs-check",
              action: "open-data-check",
              actionLabel: "查看数据",
              affectedInstrumentIds: ["US:AAPL"],
              issues: [],
            },
            value.dimensions[1],
            {
              ...source,
              status: "needs-check",
              action: "source-unsupported",
              actionLabel: "查看数据源",
              affectedInstrumentIds: ["HK:0700"],
            },
            value.dimensions[3],
          ],
        }}
        onOpenDataManagement={onOpenDataManagement}
        onOpenDataCheck={onOpenDataCheck}
      />,
    );

    await user.click(screen.getByRole("button", { name: "查看数据" }));
    expect(onOpenDataCheck).toHaveBeenCalledWith("transaction", ["US:AAPL"]);
    await user.click(screen.getByRole("button", { name: "查看数据源" }));
    expect(onOpenDataManagement).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("account-123456")).not.toBeInTheDocument();
  });
});
