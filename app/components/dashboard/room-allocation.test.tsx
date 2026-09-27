import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it } from "vitest";
import { buildCurrentPortfolio } from "../../lib/reviews/trading-room-portfolio";
import { createDefaultRoomScope } from "../../lib/reviews/trading-room-scope";
import { RoomAllocation } from "./room-allocation";
import type { CashSummary } from "../../lib/cash/cash-model";
afterEach(cleanup);
it("exposes exclusive keyboard-operable dimensions and genuine empty state", async () => {
  render(<RoomAllocation model={buildCurrentPortfolio([], { scope: createDefaultRoomScope() })}/>);
  expect(screen.getByText("当前空仓，暂无资产分布")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "按资产类型" }));
  expect(screen.getByRole("button", { name: "按资产类型" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: "按市场" })).toHaveAttribute("aria-pressed", "false");
});

it("renders the complete distribution as a left donut with a right legend and real cash fields", () => {
  const model = buildCurrentPortfolio([], { scope: createDefaultRoomScope(), asOf: "2026-09-25" });
  model.rows = [{
    holding: { market: "HK", marketLabel: "港股", settlementCurrency: "HKD", assetType: "stock", direction: "long", instrumentName: "测试" },
    marketValue: "100",
  }] as never;
  const money = { baseCurrency: "CNY", originalByCurrency: { HKD: "100" }, convertedCny: "100", converted: "100", convertedHkd: "100", targetCurrency: "HKD", conversion: "same-currency", fxSnapshotId: null, note: "完整" } as const;
  const cashSummary = {
    todayProceeds: { ...money, originalByCurrency: { HKD: "12" }, converted: "12", convertedHkd: "12" },
    cashTotal: { ...money, originalByCurrency: { HKD: "345" }, converted: "345", convertedHkd: "345" },
    todayProceedsStatus: "available",
    cashTotalStatus: "available",
    coverage: { included: 1, excluded: 0, missing: 0 },
    asOf: "2026-09-25T00:00:00Z",
    missingReasons: [],
    byScope: {},
    updatedAt: "2026-09-25T00:00:00Z",
  } satisfies CashSummary;
  render(<RoomAllocation model={model} reportCurrency="HKD" cashSummary={cashSummary} />);
  expect(screen.getByText("HKD 100.00")).toBeInTheDocument();
  expect(screen.getByText("港股")).toBeInTheDocument();
  expect(screen.getByText("今日卖出回款")).toBeInTheDocument();
  expect(screen.getByText("HKD 12.00")).toBeInTheDocument();
  expect(screen.getByText("现金总额")).toBeInTheDocument();
  expect(screen.getByText("HKD 345.00")).toBeInTheDocument();
  expect(document.querySelector(".donut")).toBeTruthy();
  expect(screen.getByText("港股").closest("li")?.querySelector("small")).toBeNull();
});

it("shows a reliable zero proceeds state even when its money view has no currency entries", () => {
  const model = buildCurrentPortfolio([], { scope: createDefaultRoomScope() });
  const cashSummary = {
    todayProceeds: { baseCurrency: "CNY", originalByCurrency: {}, convertedCny: null, converted: null, convertedHkd: null, targetCurrency: "HKD", conversion: "same-currency", fxSnapshotId: null, note: "暂无可信原币金额" },
    cashTotal: { baseCurrency: "CNY", originalByCurrency: { HKD: "345" }, convertedCny: "345", converted: "345", convertedHkd: "345", targetCurrency: "HKD", conversion: "same-currency", fxSnapshotId: null, note: "完整" },
    todayProceedsStatus: "zero",
    cashTotalStatus: "available",
    coverage: { included: 0, excluded: 0, missing: 0 },
    asOf: null,
    missingReasons: [],
    byScope: {},
    updatedAt: null,
  } satisfies CashSummary;
  render(<RoomAllocation model={model} reportCurrency="HKD" cashSummary={cashSummary} />);
  expect(screen.getByText("HKD 0.00")).toBeInTheDocument();
});

it("keeps a complete selected original-currency donut while exposing a missing other-currency gap", () => {
  const model = buildCurrentPortfolio([], { scope: createDefaultRoomScope(), asOf: "2026-09-25" });
  model.rows = [
    { holding: { market: "US", marketLabel: "美股", settlementCurrency: "USD", assetType: "stock", direction: "long" }, marketValue: "100" },
    { holding: { market: "HK", marketLabel: "港股", settlementCurrency: "HKD", assetType: "stock", direction: "long" }, marketValue: null },
  ] as never;
  render(<RoomAllocation model={model} reportCurrency="original" />);
  expect(screen.getByTestId("allocation-donut")).toBeInTheDocument();
  expect(screen.getByText(/全卡缺口：/)).toBeInTheDocument();
  expect(screen.getByText(/HKD/)).toBeInTheDocument();
});

it("hides ratio bars and ratio labels for partial signed coverage while keeping net and side subtotals", () => {
  const model = buildCurrentPortfolio([], { scope: createDefaultRoomScope(), asOf: "2026-09-25" });
  model.rows = [
    { holding: { market: "US", marketLabel: "美股", settlementCurrency: "USD", assetType: "stock", direction: "long" }, marketValue: "100" },
    { holding: { market: "US", marketLabel: "美股", settlementCurrency: "USD", assetType: "stock", direction: "short" }, marketValue: "-100" },
    { holding: { market: "US", marketLabel: "美股", settlementCurrency: "USD", assetType: "stock", direction: "long" }, marketValue: null },
  ] as never;
  const { container } = render(<RoomAllocation model={model} reportCurrency="original" />);
  expect(screen.getByText("净市值小计")).toBeInTheDocument();
  expect(screen.getByText(/多头 \+100\.00/)).toBeInTheDocument();
  expect(screen.getByText(/空头 -100\.00/)).toBeInTheDocument();
  expect(container.querySelector(".barTrack")).toBeNull();
  expect(screen.queryByText(/多空占比按绝对市值/)).not.toBeInTheDocument();
});
