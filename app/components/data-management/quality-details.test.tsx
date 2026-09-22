import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { TradingRoomQualityModel } from "../../lib/reviews/trading-room-quality";
import { QualityDetails } from "./quality-details";

afterEach(cleanup);

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
    status: "needs-check",
    summary: "数据待检查",
    dimensions: [
      {
        id: "transaction",
        label: "交易盈亏可信度",
        status: "limited",
        totalCount: 2,
        availableCount: 1,
        affectedCount: 1,
        impact: "影响 1 个已平仓回合的收益统计。",
        reason: "费用未知",
        asOf: "2026-09-19",
        action: "open-data-check",
        actionLabel: "查看数据",
        affectedInstrumentIds: ["US:AAPL"],
        affectedEpisodeIds: ["ep-1"],
        retryableInstrumentIds: [],
        issues: [{
          id: "transaction:ep-1",
          label: "AAPL（AAPL）",
          instrumentId: "US:AAPL",
          episodeId: "ep-1",
          status: "needs-check",
          reason: "费用未知",
          action: "open-data-check",
          at: "2026-09-19",
          accountSuffix: "3456",
        }],
      },
      {
        id: "holdings",
        label: "持仓估值行情",
        status: "available",
        totalCount: 1,
        availableCount: 1,
        affectedCount: 0,
        impact: "持仓浮盈亏可用。",
        reason: "当前范围的持仓行情完整",
        asOf: "2026-09-19",
        action: "none",
        actionLabel: "",
        affectedInstrumentIds: [],
        affectedEpisodeIds: [],
        retryableInstrumentIds: [],
        issues: [],
      },
      {
        id: "historical",
        label: "历史复盘 K 线",
        status: "needs-check",
        totalCount: 1,
        availableCount: 0,
        affectedCount: 1,
        impact: "影响历史复盘 K 线，不影响可信已平仓盈亏。",
        reason: "行情源不支持",
        asOf: "2026-09-18",
        action: "source-unsupported",
        actionLabel: "查看数据源",
        affectedInstrumentIds: ["HK:0700"],
        affectedEpisodeIds: [],
        retryableInstrumentIds: [],
        issues: [{
          id: "historical:HK:0700",
          label: "腾讯（0700）",
          instrumentId: "HK:0700",
          status: "needs-check",
          reason: "行情源不支持",
          action: "source-unsupported",
          at: "2026-09-18",
        }],
      },
      {
        id: "fx",
        label: "人民币估算汇率",
        status: "limited",
        totalCount: 1,
        availableCount: 1,
        affectedCount: 0,
        impact: "跨币种人民币估算沿用旧汇率。",
        reason: "本次更新失败，沿用 2026-09-18 汇率",
        asOf: "2026-09-18",
        action: "retry",
        actionLabel: "重试汇率",
        affectedInstrumentIds: [],
        affectedEpisodeIds: [],
        retryableInstrumentIds: [],
        issues: [{
          id: "fx:refresh",
          label: "USD/CNY",
          status: "limited",
          reason: "本次更新失败，沿用 2026-09-18 汇率",
          action: "retry",
          at: "2026-09-18",
        }],
      },
    ],
    unknownAssetCount: 0,
    unknownAssetEpisodeCount: 0,
    retryQueue: [],
    supplementQueue: [],
    sourceUnsupportedQueue: [],
  };
}

describe("QualityDetails", () => {
  it("shows independent denominators, impact, time, and the action for each dimension", async () => {
    const user = userEvent.setup();
    const onOpenDataManagement = vi.fn();
    const onRetryDataQuality = vi.fn();
    const onOpenDataCheck = vi.fn();
    const quality = model();

    render(
      <QualityDetails
        model={quality}
        onOpenDataManagement={onOpenDataManagement}
        onRetryDataQuality={onRetryDataQuality}
        onOpenDataCheck={onOpenDataCheck}
      />,
    );

    expect(screen.getByRole("region", { name: "数据质量明细" })).toBeInTheDocument();
    expect(screen.getByText("交易盈亏可信度")).toBeInTheDocument();
    expect(screen.getByText("已用 1 / 2 个回合；受影响 1 个")).toBeInTheDocument();
    expect(screen.getByText("本次更新失败，沿用 2026-09-18 汇率")).toBeInTheDocument();
    expect(screen.getByText("行情源不支持")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "重试历史复盘 K 线" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "重试人民币估算汇率" }));
    expect(onRetryDataQuality).toHaveBeenCalledWith("fx", []);

    await user.click(screen.getByRole("button", { name: "查看数据 US:AAPL" }));
    expect(onOpenDataCheck).toHaveBeenCalledWith("transaction", ["US:AAPL"], "ep-1");
  });

  it("uses the management action for supplement and unsupported-source cases", async () => {
    const user = userEvent.setup();
    const onOpenDataManagement = vi.fn();
    const quality = model();
    render(<QualityDetails model={{ ...quality, dimensions: quality.dimensions.map(dimension => dimension.id === "transaction"
      ? { ...dimension, action: "supplement", actionLabel: "补充数据" }
      : dimension) }} onOpenDataManagement={onOpenDataManagement} />);

    await user.click(screen.getByRole("button", { name: "补充交易数据" }));
    await user.click(screen.getByRole("button", { name: "查看数据源" }));
    expect(onOpenDataManagement).toHaveBeenCalledTimes(2);
    expect(onOpenDataManagement).toHaveBeenNthCalledWith(1, expect.objectContaining({ status: "needs-check" }));
  });

  it("uses the scoped data check for instrument-specific supplement and source diagnostics", async () => {
    const user = userEvent.setup();
    const onOpenDataManagement = vi.fn();
    const onOpenDataCheck = vi.fn();
    const quality = model();
    const scoped = {
      ...quality,
      dimensions: quality.dimensions.map(dimension => dimension.id === "transaction"
        ? {
            ...dimension,
            action: "supplement" as const,
            actionLabel: "补充交易数据",
            issues: dimension.issues.map(issue => ({ ...issue, action: "supplement" as const })),
          }
        : dimension),
    };

    render(
      <QualityDetails
        model={scoped}
        onOpenDataManagement={onOpenDataManagement}
        onOpenDataCheck={onOpenDataCheck}
      />,
    );

    await user.click(screen.getByRole("button", { name: "补充交易数据" }));
    expect(onOpenDataCheck).toHaveBeenCalledWith("transaction", ["US:AAPL"], "ep-1");

    await user.click(screen.getByRole("button", { name: "查看数据源" }));
    expect(onOpenDataCheck).toHaveBeenCalledWith("historical", ["HK:0700"], undefined);
    expect(onOpenDataManagement).not.toHaveBeenCalled();
  });

  it("disables an issue retry while its async callback is pending", async () => {
    const user = userEvent.setup();
    let resolveRetry!: () => void;
    const onRetryDataQuality = vi.fn(() => new Promise<void>(resolve => { resolveRetry = resolve; }));

    render(<QualityDetails model={model()} onRetryDataQuality={onRetryDataQuality} />);

    const retryButton = screen.getByRole("button", { name: "重试人民币估算汇率" });
    await user.click(retryButton);

    expect(onRetryDataQuality).toHaveBeenCalledWith("fx", []);
    expect(retryButton).toBeDisabled();
    expect(screen.getByText("重试进行中…")).toBeInTheDocument();
    expect(onRetryDataQuality).toHaveBeenCalledTimes(1);

    resolveRetry();
    await waitFor(() => expect(retryButton).not.toBeDisabled());
    expect(screen.queryByText("重试失败，请稍后再试")).not.toBeInTheDocument();
  });

  it("shows failure feedback when a dimension retry rejects", async () => {
    const user = userEvent.setup();
    const onRetryDataQuality = vi.fn().mockRejectedValue(new Error("source down"));
    const quality = model();
    const retryableDimensionModel: TradingRoomQualityModel = {
      ...quality,
      dimensions: quality.dimensions.map(dimension => dimension.id === "transaction"
        ? {
            ...dimension,
            action: "retry",
            actionLabel: "重试交易盈亏可信度",
            retryableInstrumentIds: ["US:AAPL"],
          }
        : dimension),
    };

    render(<QualityDetails model={retryableDimensionModel} onRetryDataQuality={onRetryDataQuality} />);

    const retryButton = screen.getByRole("button", { name: "重试交易盈亏可信度" });
    await user.click(retryButton);

    expect(onRetryDataQuality).toHaveBeenCalledWith("transaction", ["US:AAPL"]);
    expect(await screen.findByRole("alert")).toHaveTextContent("重试失败，请稍后再试");
    expect(retryButton).not.toBeDisabled();
  });
});
