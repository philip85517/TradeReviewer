import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PrincipalReferenceSummary } from "../../lib/principal/principal-model";
import type { RoomMoneyView } from "../../lib/reviews/trading-room-scope";
import { RoomReturnDetails } from "./room-return-details";

const money = (value: string): RoomMoneyView => ({ baseCurrency: "CNY", originalByCurrency: { CNY: value }, convertedCny: value, conversion: "same-currency", fxSnapshotId: null, note: "原币" });
const summary: PrincipalReferenceSummary = {
  mode: "principal", principalReturnPercent: "2", costReturn: { netPnl: money("200"), buyCost: money("10000"), costReturnPercent: "2", applicableCount: 1, excludedCount: 1, exclusionReasons: { "unknown-fees": 1 }, includedEpisodeIds: ["a"], excludedEpisodeIds: ["b"], unavailableReason: null },
  netPnl: money("200"), principal: money("10000"), principalByCategory: {}, requiredCategories: [], configuredCategories: [], missingCategories: [], fallbackReason: null,
};

describe("RoomReturnDetails", () => {
  it("discloses numerator, denominator, currency and exclusions", () => {
    render(<RoomReturnDetails summary={summary} onOpenPrincipal={vi.fn()} />);
    screen.getAllByText("查看收益率口径与样本").at(-1)?.click();
    expect(screen.getByText(/可信净盈亏 ÷ 已配置本金/)).toBeInTheDocument();
    expect(screen.getByText(/CNY 200（人民币估算/)).toBeInTheDocument();
    expect(screen.getByText(/CNY 10,000（人民币估算/)).toBeInTheDocument();
    expect(screen.getByText(/费用未知 1 个/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "前往数据管理配置本金" })).toBeInTheDocument();
  });

  it("uses the cost subset numerator and labels its exclusions in cost mode", () => {
    render(<RoomReturnDetails summary={{ ...summary, mode: "cost", netPnl: money("200"), costReturn: { ...summary.costReturn, netPnl: money("100"), buyCost: money("5000") } }} />);
    screen.getAllByText("查看收益率口径与样本").at(-1)?.click();
    expect(screen.getByText(/CNY 100（人民币估算/)).toBeInTheDocument();
    expect(screen.getByText("成本适用样本")).toBeInTheDocument();
    expect(screen.getByText("排除样本")).toBeInTheDocument();
  });
});
