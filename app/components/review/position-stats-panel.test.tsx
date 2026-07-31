import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { PositionPathMetrics } from "../../lib/replay/position-path-metrics";
import { PositionStatsPanel } from "./position-stats-panel";

afterEach(cleanup);

function metrics(overrides: Partial<PositionPathMetrics> = {}): PositionPathMetrics {
  return {
    current: {
      quantity: "10",
      averageCost: "25",
      grossCapitalDeployed: "250",
      realizedPnl: "0",
      unrealizedPnl: "180",
      fees: "5",
      netPnl: "175",
      returnPercent: "70",
    },
    holdingMilliseconds: 49 * 60 * 60 * 1000,
    mfe: { amount: "500", percent: "12.5" },
    mae: { amount: "-120", percent: "-3" },
    maximumDrawdown: { amount: "80", percent: "2" },
    profitGiveback: { amount: "325", percent: "8.125" },
    rMultiple: "1.75",
    ...overrides,
  };
}

describe("PositionStatsPanel", () => {
  it("presents upstream path metrics with locale, signs, duration, percentages, risk, and R", () => {
    render(
      <PositionStatsPanel
        instrumentLabel="小鹏汽车（XPEV）"
        currency="HKD"
        plan={{
          thesis: "突破回踩",
          expectedPath: "放量上行",
          invalidationCondition: "跌破 24.50",
          targetRange: "30.00–32.00",
          plannedRiskAmount: "100",
          confidence: 4,
        }}
        metrics={metrics()}
      />,
    );

    expect(screen.getByText("持仓数量")).toBeInTheDocument();
    expect(screen.getByText("平均成本")).toBeInTheDocument();
    expect(screen.getByText("HK$25.00")).toBeInTheDocument();
    expect(screen.getByText("已实现盈亏")).toBeInTheDocument();
    expect(screen.getByText("浮动盈亏")).toBeInTheDocument();
    expect(screen.getByText("当前净盈亏")).toBeInTheDocument();
    expect(screen.getByText("收益率")).toBeInTheDocument();
    expect(screen.getByText("累计费用")).toBeInTheDocument();
    expect(screen.getByText("HK$5.00")).toBeInTheDocument();
    expect(screen.getByText("最大盈利（MFE）")).toBeInTheDocument();
    expect(screen.getByText("+HK$500.00")).toBeInTheDocument();
    expect(screen.getByText("最大亏损（MAE）")).toBeInTheDocument();
    expect(screen.getByText("-HK$120.00")).toBeInTheDocument();
    expect(screen.getByText("最大回撤")).toBeInTheDocument();
    expect(screen.getByText("盈利回吐")).toBeInTheDocument();
    expect(screen.getByText("2 天")).toBeInTheDocument();
    expect(screen.getByText("+12.50%")).toBeInTheDocument();
    expect(screen.getByText("HK$100.00")).toBeInTheDocument();
    expect(screen.getByText("+1.75R")).toBeInTheDocument();
    expect(screen.getByText("失效条件")).toBeInTheDocument();
    expect(screen.getByText("跌破 24.50")).toBeInTheDocument();
    expect(screen.getByText("目标区间")).toBeInTheDocument();
    expect(screen.getByText("30.00–32.00")).toBeInTheDocument();
  });

  it("uses hours for short holdings and shows an em dash plus the upstream reason when data is unavailable", () => {
    render(
      <PositionStatsPanel
        instrumentLabel="小鹏汽车（XPEV）"
        currency="HKD"
        plan={undefined}
        metrics={metrics({
          current: {
            quantity: "0",
            averageCost: "0",
            grossCapitalDeployed: "0",
            realizedPnl: "0",
            unrealizedPnl: "0",
            fees: "0",
            netPnl: "0",
            returnPercent: "0",
          },
          holdingMilliseconds: 3.5 * 60 * 60 * 1000,
          mfe: null,
          mae: null,
          maximumDrawdown: null,
          profitGiveback: null,
          rMultiple: null,
          unavailableReason: "游标之前尚无成交。",
        })}
      />,
    );

    expect(screen.getByText("3.5 小时")).toBeInTheDocument();
    expect(screen.getAllByText("游标之前尚无成交。").length).toBeGreaterThan(0);
    expect(screen.getAllByText("—").length).toBeGreaterThan(3);
    expect(screen.queryByText("+HK$0.00")).not.toBeInTheDocument();
  });

  it("shows the execution ledger while path metrics remain unavailable without candles", () => {
    render(
      <PositionStatsPanel
        instrumentLabel="小鹏汽车（XPEV）"
        currency="HKD"
        plan={undefined}
        metrics={metrics({
          current: {
            quantity: "0",
            averageCost: "0",
            grossCapitalDeployed: "250",
            realizedPnl: "50",
            unrealizedPnl: "0",
            fees: "5",
            netPnl: "45",
            returnPercent: "18",
          },
          holdingMilliseconds: null,
          mfe: null,
          mae: null,
          maximumDrawdown: null,
          profitGiveback: null,
          rMultiple: null,
          unavailableReason:
            "No candle is available at or before the replay cursor.",
        })}
      />,
    );

    expect(screen.getByText("+HK$45.00")).toBeInTheDocument();
    expect(screen.getByText("+HK$50.00")).toBeInTheDocument();
    expect(screen.getByText("HK$5.00")).toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThan(3);
  });
});
