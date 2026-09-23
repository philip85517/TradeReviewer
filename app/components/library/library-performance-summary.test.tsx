import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import type {
  LibraryPerformanceComparableGroup,
  LibraryPerformanceCnySummary,
  LibraryPerformanceMetricSet,
  LibraryPerformanceSummary,
} from "../../lib/reviews/library-performance";
import { LibraryPerformanceSummaryView } from "./library-performance-summary";

const emptyMetrics: LibraryPerformanceMetricSet = {
  netPnl: null,
  grossExposure: null,
  weightedReturn: null,
  returnSampleNetPnl: null,
  netPnlSampleCount: 0,
  returnSampleCount: 0,
  wins: 0,
  losses: 0,
  breakEven: 0,
  winRate: null,
  grossProfit: null,
  grossLoss: null,
  averageWin: null,
  averageLoss: null,
  payoff: null,
  payoffReason: null,
  profitFactor: null,
  profitFactorReason: null,
  excludedCount: 0,
  exclusionReasons: {},
  returnExcludedCount: 0,
  returnExclusionReasons: {},
};

function metric(overrides: Partial<LibraryPerformanceMetricSet> = {}): LibraryPerformanceMetricSet {
  return { ...emptyMetrics, ...overrides };
}

function comparable(
  key: string,
  overrides: Partial<LibraryPerformanceComparableGroup> = {},
): LibraryPerformanceComparableGroup {
  return {
    key,
    currency: "CNY",
    tradeNature: "live",
    simulationRunId: null,
    sourceCurrencies: ["CNY"],
    sampleCount: 2,
    closedCount: 2,
    openCount: 0,
    ...metric({
      netPnl: "100",
      grossExposure: "100000",
      weightedReturn: "0.1",
      returnSampleNetPnl: "100",
      netPnlSampleCount: 2,
      returnSampleCount: 2,
      wins: 1,
      losses: 1,
      breakEven: 1,
      winRate: { wins: 1, denominator: 2 },
      grossProfit: "1000",
      grossLoss: "900",
      averageWin: "1000",
      averageLoss: "900",
      payoff: "1.1111111111",
      profitFactor: "1.1111111111",
    }),
    ...overrides,
  };
}

function cnySummary(
  overrides: Partial<LibraryPerformanceCnySummary> = {},
): LibraryPerformanceCnySummary {
  return {
    ...comparable("live|"),
    available: true,
    reason: null,
    scopeCount: 1,
    ...overrides,
  };
}

function summary(
  overrides: Partial<LibraryPerformanceSummary> = {},
): LibraryPerformanceSummary {
  return {
    sample: {
      total: 2,
      closed: 2,
      open: 0,
      trustedClosed: 2,
      returnEligible: 2,
      cnyNetPnlEligible: 2,
      cnyReturnEligible: 2,
      excluded: 0,
      returnExcluded: 0,
    },
    rawCurrencyGroups: [{
      key: "live||CNY",
      currency: "CNY",
      tradeNature: "live",
      simulationRunId: null,
      sampleCount: 2,
      closedCount: 2,
      openCount: 0,
      ...metric({
        netPnl: "100",
        grossExposure: "100000",
        weightedReturn: "0.1",
        returnSampleNetPnl: "100",
        netPnlSampleCount: 2,
        returnSampleCount: 2,
      }),
    }],
    comparableGroups: [comparable("live|")],
    cny: cnySummary(),
    open: {
      count: 0,
      withUnrealizedPnl: 0,
      unavailable: 0,
      unrealizedPnl: null,
      groups: [],
    },
    ...overrides,
  };
}

afterEach(() => cleanup());

describe("LibraryPerformanceSummaryView", () => {
  it("renders the four main metrics, distinct coverage, details, raw currency and open PnL", () => {
    const input = summary({
      open: {
        count: 1,
        withUnrealizedPnl: 1,
        unavailable: 0,
        unrealizedPnl: null,
        groups: [{
          key: "live||USD",
          currency: "USD",
          tradeNature: "live",
          simulationRunId: null,
          count: 1,
          withUnrealizedPnl: 1,
          unavailable: 0,
          unrealizedPnl: "50",
        }],
      },
      rawCurrencyGroups: [{
        key: "live||USD",
        currency: "USD",
        tradeNature: "live",
        simulationRunId: null,
        sampleCount: 1,
        closedCount: 1,
        openCount: 0,
        ...metric({ netPnl: "-100", grossExposure: "1000", weightedReturn: "-10", returnSampleNetPnl: "-100", netPnlSampleCount: 1, returnSampleCount: 1 }),
      }],
      cny: cnySummary({
        breakEven: 1,
        exclusionReasons: { "unknown-fees": 1 },
        returnExclusionReasons: { "invalid-exposure": 1 },
      }),
    });

    render(<LibraryPerformanceSummaryView summary={input} stockCount={1} roundCount={2} reviewedCount={1} progressTotal={2} />);

    expect(screen.getByRole("heading", { name: "绩效汇总" })).toBeInTheDocument();
    expect(screen.getByText("1 个标的 · 2 个回合 · 实盘 · 已复盘 1/2")).toBeInTheDocument();
    expect(within(screen.getByRole("article", { name: "已平仓净盈亏" })).getByText("+¥100.00")).toBeInTheDocument();
    expect(within(screen.getByRole("article", { name: "加权收益率（按开仓金额）" })).getByText("+0.10%")).toBeInTheDocument();
    expect(within(screen.getByRole("article", { name: "胜率" })).getByText("+50.00%")).toBeInTheDocument();
    expect(within(screen.getByRole("article", { name: "复盘进度" })).getByText("1/2")).toBeInTheDocument();
    expect(screen.getByText("净盈亏样本").closest("details")).toHaveTextContent(/净盈亏样本\s*2 个回合/);
    expect(within(screen.getByRole("article", { name: "胜率" })).getByText(/保本/)).toHaveTextContent("保本 1 个回合");
    expect(screen.getByText(/USD 浮盈亏/)).toHaveTextContent("· USD 浮盈亏 +USD 50.00");
    expect(screen.getAllByText(/USD/).length).toBeGreaterThan(0);
    expect(screen.getByText(/费用未知/)).toBeInTheDocument();
    expect(screen.getByText(/开仓金额无效或非正/)).toBeInTheDocument();
    expect(screen.getByText(/不受复盘状态筛选影响/)).toBeInTheDocument();
    expect(screen.getByText("统计详情", { selector: "h3" }).closest("details")).not.toHaveAttribute("open");
    expect(screen.getByRole("heading", { name: "原币金额" }).closest("details")).not.toHaveAttribute("open");
  });

  it("selects one comparable run and never displays a cross-run total", async () => {
    const user = userEvent.setup();
    const runA = comparable("simulation|run-a", {
      tradeNature: "simulation",
      simulationRunId: "run-a",
      sampleCount: 3,
      netPnl: "10",
      returnSampleNetPnl: "10",
      netPnlSampleCount: 1,
      returnSampleCount: 1,
    });
    const runB = comparable("simulation|run-b", {
      tradeNature: "simulation",
      simulationRunId: "run-b",
      sampleCount: 4,
      netPnl: "20",
      returnSampleNetPnl: "20",
      netPnlSampleCount: 2,
      returnSampleCount: 2,
    });
    const input = summary({
      comparableGroups: [runA, runB],
      cny: {
        ...cnySummary(),
        available: false,
        reason: "multiple-scopes",
        scopeCount: 2,
        netPnl: null,
        weightedReturn: null,
      },
    });

    render(<LibraryPerformanceSummaryView
      summary={input}
      stockCount={2}
      roundCount={7}
      reviewedCount={3}
      progressTotal={7}
      groupLabels={{ "simulation|run-a": "模拟盘 · 策略 A", "simulation|run-b": "模拟盘 · 策略 B" }}
    />);

    const selector = screen.getByRole("combobox", { name: "统计范围" });
    expect(screen.getByText("模拟盘 · 策略 A")).toBeInTheDocument();
    expect(screen.getByText("模拟盘 · 策略 A")).toBeInTheDocument();
    expect(within(screen.getByRole("article", { name: "已平仓净盈亏" })).getByText("+¥10.00")).toBeInTheDocument();
    expect(screen.queryByText("+¥30.00")).not.toBeInTheDocument();

    await user.selectOptions(selector, "simulation|run-b");

    expect(screen.getByText("模拟盘 · 策略 B")).toBeInTheDocument();
    expect(screen.getByText("模拟盘 · 策略 B")).toBeInTheDocument();
    expect(within(screen.getByRole("article", { name: "已平仓净盈亏" })).getByText("+¥20.00")).toBeInTheDocument();
  });

  it("shortens an opaque default simulation label", () => {
    const runId = "tradingview:2026-very-long-opaque-run-id";
    const run = comparable(`simulation|${runId}`, {
      tradeNature: "simulation",
      simulationRunId: runId,
    });
    const input = summary({
      comparableGroups: [run],
      cny: {
        ...run,
        available: true,
        reason: null,
        scopeCount: 1,
      },
    });

    render(<LibraryPerformanceSummaryView summary={input} stockCount={1} roundCount={2} reviewedCount={1} progressTotal={2} />);

    expect(screen.getAllByText(/模拟运行/).length).toBeGreaterThan(0);
    expect(screen.queryByText(runId)).not.toBeInTheDocument();
  });

  it("explains missing FX for the selected comparable group", () => {
    const noFx = comparable("live|", {
      netPnl: null,
      weightedReturn: null,
      returnSampleNetPnl: null,
      netPnlSampleCount: 0,
      returnSampleCount: 0,
      exclusionReasons: { "missing-fx": 1 },
      returnExclusionReasons: { "missing-fx": 1 },
    });
    const input = summary({
      comparableGroups: [noFx],
      cny: {
        ...noFx,
        available: false,
        reason: "missing-fx",
        scopeCount: 1,
      },
    });

    render(<LibraryPerformanceSummaryView summary={input} stockCount={1} roundCount={1} reviewedCount={0} progressTotal={1} />);

    expect(screen.getByRole("status")).toHaveTextContent("缺少有效汇率，外币样本暂无法折算");
    expect(within(screen.getByRole("article", { name: "已平仓净盈亏" })).getByText("不可用")).toBeInTheDocument();
  });

  it("uses unavailable text when no valid metric exists instead of a zero placeholder", () => {
    const unavailable = summary({
      sample: { total: 3, closed: 2, open: 1, trustedClosed: 0, returnEligible: 0, cnyNetPnlEligible: 0, cnyReturnEligible: 0, excluded: 3, returnExcluded: 3 },
      comparableGroups: [],
      cny: {
        ...cnySummary(),
        available: false,
        reason: "no-trusted-closed",
        netPnl: null,
        weightedReturn: null,
        netPnlSampleCount: 0,
        returnSampleCount: 0,
        winRate: null,
      },
    });

    render(<LibraryPerformanceSummaryView summary={unavailable} stockCount={0} roundCount={3} reviewedCount={0} progressTotal={3} />);

    expect(screen.getAllByText("不可用").length).toBeGreaterThanOrEqual(3);
    expect(screen.queryByText("0.00%")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("没有可信的已平仓净盈亏样本");
  });
});
