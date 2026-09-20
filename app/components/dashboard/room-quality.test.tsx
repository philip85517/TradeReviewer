import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { CostReturnSummary, MonthlyWinRateSummary } from "../../lib/reviews/trading-room-metrics";
import type { RoomMoneyView } from "../../lib/reviews/trading-room-scope";
import { RoomQuality } from "./room-quality";

function money(originalByCurrency: Record<string, string>, convertedCny: string | null): RoomMoneyView {
  return {
    baseCurrency: "CNY",
    originalByCurrency,
    convertedCny,
    conversion: convertedCny === null ? "partial" : "complete",
    fxSnapshotId: "fx:test",
    note: convertedCny === null ? "汇率快照不完整，按币种显示原币小计" : "按最新汇率估算",
  };
}

const costReturn: CostReturnSummary = {
  netPnl: money({ USD: "200" }, "1350.42"),
  buyCost: money({ USD: "20000" }, "135042"),
  costReturnPercent: "1",
  applicableCount: 2,
  excludedCount: 1,
  exclusionReasons: { "unknown-fees": 1 },
  includedEpisodeIds: ["a", "b"],
  excludedEpisodeIds: ["c"],
  unavailableReason: null,
};

const monthlyWinRate: MonthlyWinRateSummary = {
  wins: 2,
  denominator: 3,
  ratePercent: "66.6666666666666667",
  points: [
    {
      month: "2026-09",
      wins: 2,
      denominator: 3,
      ratePercent: "66.6666666666666667",
      coverage: "partial",
      coverageStartDate: "2026-09-01",
      coverageEndDate: "2026-09-19",
      coverageLabel: "覆盖 2026-09-01 至 2026-09-19",
    },
  ],
};

describe("RoomQuality", () => {
  it("is collapsed by default and reveals cost and monthly quality details on demand", () => {
    render(<RoomQuality costReturn={costReturn} monthlyWinRate={monthlyWinRate} />);

    const section = screen.getByRole("region", { name: "收益质量" });
    const details = within(section).getByTestId("room-quality-details");
    expect(details).not.toHaveAttribute("open");
    expect(within(section).getByText("交易成本收益率")).toBeInTheDocument();
    expect(within(section).getByText("1%")).toBeInTheDocument();
    expect(within(section).getByText("2 个适用回合 · 1 个排除回合")).toBeInTheDocument();

    fireEvent.click(within(details).getByText("查看月胜率趋势"));

    expect(details).toHaveAttribute("open");
    expect(within(details).getByText("原币成本")).toBeInTheDocument();
    expect(within(details).getByText("2026-09")).toBeInTheDocument();
    expect(within(details).getByText(/覆盖 2026-09-01 至 2026-09-19/)).toBeInTheDocument();
    expect(within(details).getByText("费用未知：1 个")).toBeInTheDocument();
  });
});
