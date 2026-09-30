import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it } from "vitest";
import { buildCurrentPortfolio } from "../../lib/reviews/trading-room-portfolio";
import { buildRoomAllocation } from "../../lib/reviews/trading-room-allocation";
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
  expect(screen.getByText("参考现金")).toBeInTheDocument();
  expect(screen.getByText("基准+股票/ETF成交变化")).toBeInTheDocument();
  expect(screen.queryByText("现金总额")).not.toBeInTheDocument();
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
  const expectedReason = buildRoomAllocation(model, { dimension: "market", reportCurrency: "original" }).globalMissingReasons[0];
  render(<RoomAllocation model={model} reportCurrency="original" />);
  expect(screen.getByTestId("allocation-donut")).toBeInTheDocument();
  expect(screen.getByText(/全卡缺口：/)).toBeInTheDocument();
  const reasonDisclosure = screen.getByText(/查看完整解释/).closest("details");
  expect(reasonDisclosure).not.toHaveAttribute("open");
  expect(reasonDisclosure).toHaveTextContent(expectedReason);
  fireEvent.click(reasonDisclosure!.querySelector("summary")!);
  expect(reasonDisclosure).toHaveAttribute("open");
  expect(screen.getByText(/HKD/)).toBeInTheDocument();
});

it("preserves each long holding reason in a collapsed disclosure and keeps unknown-currency note facts", () => {
  const model = buildCurrentPortfolio([], { scope: createDefaultRoomScope() });
  const reason = "缺少可信行情证据；最近一次行情截点仍早于持仓日期；该仓位不纳入可用小计";
  model.rows = [{
    holding: { market: "US", marketLabel: "美股", settlementCurrency: null, assetType: "stock", direction: "long", statusReason: reason },
    marketValue: null,
  }] as never;
  render(<RoomAllocation model={model} reportCurrency="original" />);

  const itemDetails = screen.getByLabelText("美股分布原因");
  expect(itemDetails).not.toHaveAttribute("open");
  fireEvent.click(itemDetails.querySelector("summary")!);
  expect(itemDetails).toHaveAttribute("open");
  expect(itemDetails).toHaveTextContent(reason);

  const groupNote = screen.getByLabelText("当前分布完整解释");
  fireEvent.click(groupNote.querySelector("summary")!);
  expect(groupNote).toHaveTextContent("未知币种不纳入已知币种分母");
});

it("keeps long cash diagnostics collapsed until the user opens the full explanation", () => {
  const model = buildCurrentPortfolio([], { scope: createDefaultRoomScope() });
  const money = { baseCurrency: "CNY", originalByCurrency: {}, convertedCny: null, converted: null, convertedHkd: null, targetCurrency: "CNY", conversion: "missing", fxSnapshotId: null, note: "缺少可信现金数据" } as const;
  const missingReasons = Array.from({ length: 120 }, (_, index) => `成交现金证据 ${index + 1}：缺少可核对的原币金额`);
  const cashSummary = {
    todayProceeds: money,
    cashTotal: money,
    todayProceedsStatus: "unavailable",
    cashTotalStatus: "unavailable",
    coverage: { included: 0, excluded: 0, missing: missingReasons.length },
    asOf: null,
    missingReasons,
    byScope: {},
    updatedAt: null,
  } satisfies CashSummary;
  render(<RoomAllocation model={model} reportCurrency="CNY" cashSummary={cashSummary} />);

  const disclosures = screen.getAllByText("查看完整解释（121 条原因）");
  expect(disclosures).toHaveLength(1);
  const details = disclosures[0].closest("details");
  expect(details).not.toHaveAttribute("open");
  expect(details).toHaveTextContent(missingReasons[119]);
  fireEvent.click(details!.querySelector("summary")!);
  expect(details).toHaveAttribute("open");
  expect(details).toHaveTextContent(missingReasons[0]);
  expect(details).toHaveTextContent(missingReasons[119]);
  expect(details).toHaveTextContent("缺少可信现金数据");
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

it("keeps multiple cash baseline dates and sources in a collapsed details disclosure", async () => {
  const model = buildCurrentPortfolio([], { scope: createDefaultRoomScope() });
  const money = { baseCurrency: "CNY", originalByCurrency: { CNY: "300" }, convertedCny: "300", converted: "300", convertedHkd: null, targetCurrency: "CNY", conversion: "same-currency", fxSnapshotId: null, note: "部分覆盖" } as const;
  const cashSummary = {
    todayProceeds: money,
    cashTotal: money,
    todayProceedsStatus: "available",
    cashTotalStatus: "partial",
    coverage: { included: 1, excluded: 0, missing: 0 },
    asOf: null,
    missingReasons: [],
    byScope: {},
    updatedAt: "2026-09-25T00:00:00Z",
  } satisfies CashSummary;
  render(<RoomAllocation
    model={model}
    reportCurrency="CNY"
    cashSummary={cashSummary}
    cashBaselineDetails={[
      { accountId: "account-a", accountLabel: "账户 A", currency: "CNY", balance: "300", asOf: "2026-09-01T00:00:00.000Z", source: "broker-a", revision: 2, coverage: "partial" },
      { accountId: "account-b", accountLabel: "账户 B", currency: "USD", balance: "100", asOf: "2026-09-02T00:00:00.000Z", source: "broker-b", revision: 1, coverage: "available" },
    ]}
  />);

  const disclosure = screen.getByRole("group", { name: "现金基准详情" });
  expect(disclosure).not.toHaveAttribute("open");
  await userEvent.click(screen.getByText(/查看基准详情/));
  expect(disclosure).toHaveAttribute("open");
  expect(disclosure).toHaveTextContent("账户 A");
  expect(disclosure).toHaveTextContent("截至 2026-09-01");
  expect(disclosure).toHaveTextContent("来源 broker-a · 版本 2");
  expect(disclosure).toHaveTextContent("账户 B");
});
