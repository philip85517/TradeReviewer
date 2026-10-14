import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
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

it("uses market-specific empty distribution copy", () => {
  const model = buildCurrentPortfolio([], { scope: createDefaultRoomScope() });
  render(<RoomAllocation model={model} scope="market" />);
  expect(screen.getByText("当前市场暂无持仓，暂无资产分布")).toBeInTheDocument();
  expect(screen.queryByText("当前空仓，暂无资产分布")).not.toBeInTheDocument();
});

it("fences holdings allocation while keeping independent cash visible", () => {
  const model = buildCurrentPortfolio([], { scope: createDefaultRoomScope() });
  const money = { baseCurrency: "CNY", originalByCurrency: { HKD: "345" }, convertedCny: "345", converted: "345", convertedHkd: "345", targetCurrency: "HKD", conversion: "same-currency", fxSnapshotId: null, note: "完整" } as const;
  const cashSummary = {
    todayProceeds: money,
    cashTotal: money,
    todayProceedsStatus: "available",
    cashTotalStatus: "available",
    coverage: { included: 1, excluded: 0, missing: 0 },
    asOf: "2026-09-25T00:00:00Z",
    missingReasons: [],
    byScope: {},
    updatedAt: "2026-09-25T00:00:00Z",
  } satisfies CashSummary;
  render(<RoomAllocation model={model} reportCurrency="HKD" holdingsPublicationBlocked cashSummary={cashSummary} />);
  expect(screen.getByTestId("holdings-allocation-publication-placeholder")).toHaveTextContent("等待发布");
  expect(screen.queryByText("当前空仓，暂无资产分布")).not.toBeInTheDocument();
  expect(screen.getByText("现金独立更新")).toBeInTheDocument();
  expect(screen.getAllByText("HKD 345.00")).toHaveLength(2);
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
  render(<RoomAllocation model={model} reportCurrency="HKD" cashSummary={cashSummary} cashScopeLabel="全账户范围（当前账户筛选）" />);
  expect(screen.getByText("HKD 100.00")).toBeInTheDocument();
  expect(screen.getByText("港股")).toBeInTheDocument();
  expect(screen.getByText("今日卖出回款")).toBeInTheDocument();
  expect(screen.getByText("全账户范围（当前账户筛选）")).toBeInTheDocument();
  expect(screen.getByText("HKD 12.00")).toBeInTheDocument();
  expect(screen.getByText("参考现金")).toBeInTheDocument();
  expect(screen.getByText("基准+股票/ETF成交变化")).toBeInTheDocument();
  expect(screen.getByText("现金独立更新")).toBeInTheDocument();
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
  const { rerender } = render(<RoomAllocation model={model} reportCurrency="HKD" cashSummary={cashSummary} />);
  expect(screen.getByText("HKD 0.00")).toBeInTheDocument();
  expect(screen.getByText("全账户范围（当前账户筛选）")).toBeInTheDocument();
});

it("removes the ratio graphic for a selected currency with incomplete coverage", () => {
  const model = buildCurrentPortfolio([], { scope: createDefaultRoomScope(), asOf: "2026-09-25" });
  model.rows = [
    { holding: { market: "US", marketLabel: "美股", settlementCurrency: "USD", assetType: "stock", direction: "long" }, marketValue: "100" },
    { holding: { market: "HK", marketLabel: "港股", settlementCurrency: "HKD", assetType: "stock", direction: "long" }, marketValue: null },
  ] as never;
  const expectedReason = buildRoomAllocation(model, { dimension: "market", reportCurrency: "original" }).globalMissingReasons[0];
  render(<RoomAllocation model={model} reportCurrency="original" />);
  expect(screen.queryByTestId("allocation-donut")).not.toBeInTheDocument();
  expect(screen.getByText("已知市值小计")).toBeInTheDocument();
  expect(screen.getByText(/全卡缺口：/)).toBeInTheDocument();
  expect(screen.queryByText(/查看完整解释/)).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "查看问题详情" })).toBeInTheDocument();
  expect(expectedReason).toBeTruthy();
});

it("keeps unknown-currency coverage concise and exposes reasons through diagnostics", async () => {
  const model = buildCurrentPortfolio([], { scope: createDefaultRoomScope() });
  const reason = "缺少可信行情证据；最近一次行情截点仍早于持仓日期；该仓位不纳入可用小计";
  model.rows = [{
    holding: { market: "US", marketLabel: "美股", settlementCurrency: null, assetType: "stock", direction: "long", statusReason: reason },
    marketValue: null,
  }] as never;
  render(<RoomAllocation model={model} reportCurrency="original" />);

  expect(screen.getByText(/全卡缺口：/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "查看问题详情" }));
  await userEvent.type(screen.getByRole("textbox", { name: "搜索原因" }), reason);
  expect(screen.getByRole("dialog")).toHaveTextContent(reason);
});

it("keeps long cash diagnostics searchable and paginated in the drawer", async () => {
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

  await userEvent.click(screen.getByRole("button", { name: "查看问题详情" }));
  const dialog = screen.getByRole("dialog");
  await userEvent.click(screen.getAllByText("查看原始证据")[0]);
  expect(dialog).toHaveTextContent(missingReasons[0]);
  expect(dialog).not.toHaveTextContent(missingReasons[119]);
  await userEvent.click(screen.getByRole("button", { name: "下一批" }));
  expect(dialog).toHaveTextContent(missingReasons[30]);
  await userEvent.click(screen.getByRole("button", { name: "下一批" }));
  await userEvent.click(screen.getByRole("button", { name: "下一批" }));
  await userEvent.click(screen.getByRole("button", { name: "下一批" }));
  await userEvent.type(screen.getByRole("textbox", { name: "搜索原因" }), "120");
  expect(dialog).toHaveTextContent(missingReasons[119]);
  expect(dialog).not.toHaveTextContent(missingReasons[0]);
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

it("keeps the last cash summary and baseline details visible while refreshing", () => {
  const model = buildCurrentPortfolio([], { scope: createDefaultRoomScope() });
  const money = { baseCurrency: "CNY", originalByCurrency: { CNY: "300" }, convertedCny: "300", converted: "300", convertedHkd: null, targetCurrency: "CNY", conversion: "same-currency", fxSnapshotId: null, note: "完整" } as const;
  const cashSummary = {
    todayProceeds: money,
    cashTotal: { ...money, originalByCurrency: { CNY: "100300" }, convertedCny: "100300", converted: "100300" },
    todayProceedsStatus: "available",
    cashTotalStatus: "available",
    coverage: { included: 1, excluded: 0, missing: 0 },
    asOf: "2026-09-25T00:00:00Z",
    missingReasons: [],
    byScope: {},
    updatedAt: "2026-09-25T00:00:00Z",
  } satisfies CashSummary;

  render(<RoomAllocation
    model={model}
    reportCurrency="CNY"
    cashSummary={cashSummary}
    cashBaselineDetails={[{ accountId: "account-a", accountLabel: "账户 A", currency: "CNY", balance: "300", asOf: "2026-09-01T00:00:00.000Z", source: "broker-a", revision: 2, coverage: "available" }]}
    loading
  />);

  expect(screen.getByText("CNY 100,300.00")).toBeInTheDocument();
  expect(screen.getByText("现金基准截至 2026-09-25 00:00:00 UTC")).toBeInTheDocument();
  expect(screen.getByRole("group", { name: "现金基准详情" })).toHaveTextContent("账户 A");
  expect(screen.getByText("现金更新中 · 显示上次结果")).toBeInTheDocument();
  expect(screen.getByText("现金独立更新")).toBeInTheDocument();
});

it("keeps the last cash summary visible with a short error status", () => {
  const model = buildCurrentPortfolio([], { scope: createDefaultRoomScope() });
  const money = { baseCurrency: "CNY", originalByCurrency: { CNY: "300" }, convertedCny: "300", converted: "300", convertedHkd: null, targetCurrency: "CNY", conversion: "same-currency", fxSnapshotId: null, note: "完整" } as const;
  const cashSummary = {
    todayProceeds: money,
    cashTotal: { ...money, originalByCurrency: { CNY: "100300" }, convertedCny: "100300", converted: "100300" },
    todayProceedsStatus: "available",
    cashTotalStatus: "available",
    coverage: { included: 1, excluded: 0, missing: 0 },
    asOf: "2026-09-25T00:00:00Z",
    missingReasons: [],
    byScope: {},
    updatedAt: "2026-09-25T00:00:00Z",
  } satisfies CashSummary;

  render(<RoomAllocation model={model} reportCurrency="CNY" cashSummary={cashSummary} error="服务暂不可用" />);

  expect(screen.getByText("CNY 100,300.00")).toBeInTheDocument();
  expect(screen.getByText("现金数据读取失败：服务暂不可用 · 显示上次结果")).toBeInTheDocument();
  expect(screen.getByText("现金独立更新")).toBeInTheDocument();
});

it("reserves the cash status and action rows when a summary is settled or refreshing", () => {
  const model = buildCurrentPortfolio([], { scope: createDefaultRoomScope() });
  const { cashSummary } = savedCashFailureFixture();
  const onRetryCashSummary = vi.fn();
  const { rerender } = render(<RoomAllocation
    model={model}
    reportCurrency="HKD"
    cashSummary={cashSummary}
  />);

  expect(screen.getByTestId("cash-status-footer")).toBeInTheDocument();
  expect(screen.getByTestId("cash-status-empty")).toHaveAttribute("aria-hidden", "true");
  expect(screen.getByTestId("cash-action-empty")).toHaveAttribute("aria-hidden", "true");

  rerender(<RoomAllocation
    model={model}
    reportCurrency="HKD"
    cashSummary={cashSummary}
    cashRefreshNotice="现金更新中 · 显示上次结果"
    error="摘要读取失败"
    onRetryCashSummary={onRetryCashSummary}
  />);

  expect(screen.getByRole("status")).toHaveTextContent("现金更新中 · 显示上次结果");
  expect(screen.queryByTestId("cash-status-empty")).not.toBeInTheDocument();
  expect(screen.getByTestId("cash-action-row")).toContainElement(screen.getByRole("group", { name: "现金摘要读取详情" }));
  expect(screen.getByTestId("cash-action-row")).toContainElement(screen.getByRole("button", { name: "重试读取现金摘要" }));
  expect(screen.queryByTestId("cash-action-empty")).not.toBeInTheDocument();
});

it("explains converted cash using the matching summary FX snapshot and target direction", () => {
  const model = buildCurrentPortfolio([], { scope: createDefaultRoomScope() });
  const cashSnapshot = {
    id: "cash-fx",
    baseCurrency: "CNY" as const,
    asOf: "2026-09-26T00:00:00.000Z",
    source: "BOC",
    status: "complete" as const,
    rates: { "USD/CNY": "7", "HKD/CNY": "0.9" },
    publishedAtByCurrency: { USD: "2026-09-25T00:00:00.000Z", HKD: "2026-09-26T00:00:00.000Z" },
    fetchedAt: "2026-09-26T01:00:00.000Z",
  };
  const cashSummary = {
    todayProceeds: { baseCurrency: "CNY", originalByCurrency: { USD: "10" }, convertedCny: "70", converted: "77.777777777777777778", convertedHkd: "77.777777777777777778", targetCurrency: "HKD", conversion: "complete", fxSnapshotId: "cash-fx", note: "完整" },
    cashTotal: { baseCurrency: "CNY", originalByCurrency: { USD: "10", CNY: "20" }, convertedCny: "90", converted: "100", convertedHkd: "100", targetCurrency: "HKD", conversion: "complete", fxSnapshotId: "cash-fx", note: "完整" },
    fxSnapshot: cashSnapshot,
    todayProceedsStatus: "available",
    cashTotalStatus: "available",
    coverage: { included: 1, excluded: 0, missing: 0 },
    asOf: "2026-09-25T00:00:00Z",
    missingReasons: [],
    byScope: {},
    updatedAt: "2026-09-25T00:00:00Z",
  } satisfies CashSummary;

  const { rerender } = render(<RoomAllocation model={model} reportCurrency="HKD" cashSummary={cashSummary} />);

  const provenance = screen.getByTestId("cash-fx-provenance");
  expect(provenance).toHaveTextContent("汇率：2026-09-25（中行）");
  expect(provenance).toHaveTextContent("1 USD = 7.7777777777777777778 HKD");
  expect(provenance).toHaveTextContent("1 CNY = 1.1111111111111111111 HKD");
  expect(provenance).not.toHaveTextContent("人民币换算");

  rerender(<RoomAllocation model={model} reportCurrency="CNY" cashSummary={cashSummary} />);
  const cnyProvenance = screen.getByTestId("cash-fx-provenance");
  expect(cnyProvenance).toHaveTextContent("1 USD = 7 CNY");
  expect(cnyProvenance).not.toHaveTextContent("HKD");
});

it("uses today's proceeds money identity for FX provenance when cash total has no baseline", () => {
  const model = buildCurrentPortfolio([], { scope: createDefaultRoomScope() });
  const cashSnapshot = {
    id: "cash-fx-today-only",
    baseCurrency: "CNY" as const,
    asOf: "2026-09-26T01:00:00.000Z",
    source: "BOC",
    status: "complete" as const,
    rates: { "USD/CNY": "7", "HKD/CNY": "0.9" },
    publishedAt: "2026-09-26T00:00:00.000Z",
    publishedAtByCurrency: { USD: "2026-09-26T00:00:00.000Z", CNY: "2026-09-26T00:00:00.000Z", HKD: "2026-09-26T00:00:00.000Z" },
    fetchedAt: "2026-09-26T01:00:00.000Z",
  };
  const cashSummary = {
    todayProceeds: {
      baseCurrency: "CNY" as const,
      originalByCurrency: { USD: "10", CNY: "2" },
      convertedCny: "72",
      converted: "80",
      convertedHkd: "80",
      targetCurrency: "HKD" as const,
      conversion: "complete" as const,
      fxSnapshotId: cashSnapshot.id,
      note: "完整",
    },
    cashTotal: {
      baseCurrency: "CNY" as const,
      originalByCurrency: {},
      convertedCny: null,
      converted: null,
      convertedHkd: null,
      targetCurrency: "HKD" as const,
      conversion: "missing" as const,
      fxSnapshotId: null,
      note: "暂无可信原币金额",
    },
    fxSnapshot: cashSnapshot,
    todayProceedsStatus: "available" as const,
    cashTotalStatus: "unavailable" as const,
    coverage: { included: 1, excluded: 0, missing: 1 },
    asOf: null,
    missingReasons: ["账户缺少现金基准"],
    byScope: {},
    updatedAt: "2026-09-26T01:00:00.000Z",
  } satisfies CashSummary;

  render(<RoomAllocation model={model} reportCurrency="HKD" cashSummary={cashSummary} />);

  const provenance = screen.getByTestId("cash-fx-provenance");
  expect(provenance).toHaveTextContent("汇率：2026-09-26（中行）");
  expect(provenance).toHaveTextContent("1 USD = 7.7777777777777777778 HKD");
  expect(provenance).toHaveTextContent("1 CNY = 1.1111111111111111111 HKD");
  expect(provenance.querySelectorAll("p")).toHaveLength(1);
});

it("does not trust a money view whose FX identity mismatches the summary snapshot", () => {
  const model = buildCurrentPortfolio([], { scope: createDefaultRoomScope() });
  const cashSnapshot = {
    id: "cash-fx-matched-total",
    baseCurrency: "CNY" as const,
    asOf: "2026-09-26T01:00:00.000Z",
    source: "BOC",
    status: "complete" as const,
    rates: { "USD/CNY": "7", "HKD/CNY": "0.9" },
    publishedAt: "2026-09-26T00:00:00.000Z",
    publishedAtByCurrency: { USD: "2026-09-26T00:00:00.000Z", CNY: "2026-09-26T00:00:00.000Z", HKD: "2026-09-26T00:00:00.000Z" },
    fetchedAt: "2026-09-26T01:00:00.000Z",
  };
  const cashSummary = {
    todayProceeds: {
      baseCurrency: "CNY" as const,
      originalByCurrency: { USD: "10" },
      convertedCny: null,
      converted: null,
      convertedHkd: null,
      targetCurrency: "HKD" as const,
      conversion: "missing" as const,
      fxSnapshotId: "stale-today-fx",
      note: "尚无匹配汇率快照",
    },
    cashTotal: {
      baseCurrency: "CNY" as const,
      originalByCurrency: { CNY: "100" },
      convertedCny: "100",
      converted: "111.1111111111111111111",
      convertedHkd: "111.1111111111111111111",
      targetCurrency: "HKD" as const,
      conversion: "complete" as const,
      fxSnapshotId: cashSnapshot.id,
      note: "完整",
    },
    fxSnapshot: cashSnapshot,
    todayProceedsStatus: "partial" as const,
    cashTotalStatus: "available" as const,
    coverage: { included: 1, excluded: 0, missing: 0 },
    asOf: "2026-09-26T01:00:00.000Z",
    missingReasons: [],
    byScope: {},
    updatedAt: "2026-09-26T01:00:00.000Z",
  } satisfies CashSummary;

  render(<RoomAllocation model={model} reportCurrency="HKD" cashSummary={cashSummary} />);

  const provenance = screen.getByTestId("cash-fx-provenance");
  expect(provenance).toHaveTextContent("1 CNY = 1.1111111111111111111 HKD");
  expect(provenance).not.toHaveTextContent("1 USD =");
  expect(provenance).toHaveTextContent(/现金换算依据缺失|暂无可用汇率|未计入HKD换算/);
});

it("does not claim a visible converted amount was excluded when its FX identity mismatches", () => {
  const model = buildCurrentPortfolio([], { scope: createDefaultRoomScope() });
  const cashSnapshot = {
    id: "cash-fx-visible-mismatch",
    baseCurrency: "CNY" as const,
    asOf: "2026-09-26T01:00:00.000Z",
    source: "BOC",
    status: "complete" as const,
    rates: { "USD/CNY": "7", "HKD/CNY": "0.9" },
    publishedAt: "2026-09-26T00:00:00.000Z",
    publishedAtByCurrency: { USD: "2026-09-26T00:00:00.000Z", HKD: "2026-09-26T00:00:00.000Z" },
    fetchedAt: "2026-09-26T01:00:00.000Z",
  };
  const cashSummary = {
    todayProceeds: {
      baseCurrency: "CNY" as const,
      originalByCurrency: { USD: "10" },
      convertedCny: "70",
      converted: "77.777777777777777778",
      convertedHkd: "77.777777777777777778",
      targetCurrency: "HKD" as const,
      conversion: "complete" as const,
      fxSnapshotId: "stale-today-fx",
      note: "沿用旧换算结果",
    },
    cashTotal: {
      baseCurrency: "CNY" as const,
      originalByCurrency: { CNY: "100" },
      convertedCny: "100",
      converted: "111.1111111111111111111",
      convertedHkd: "111.1111111111111111111",
      targetCurrency: "HKD" as const,
      conversion: "complete" as const,
      fxSnapshotId: cashSnapshot.id,
      note: "完整",
    },
    fxSnapshot: cashSnapshot,
    todayProceedsStatus: "partial" as const,
    cashTotalStatus: "available" as const,
    coverage: { included: 1, excluded: 0, missing: 0 },
    asOf: "2026-09-26T01:00:00.000Z",
    missingReasons: [],
    byScope: {},
    updatedAt: "2026-09-26T01:00:00.000Z",
  } satisfies CashSummary;

  render(<RoomAllocation model={model} reportCurrency="HKD" cashSummary={cashSummary} />);

  const provenance = screen.getByTestId("cash-fx-provenance");
  expect(provenance).toHaveTextContent("USD：现金换算依据不可核对");
  expect(provenance).not.toHaveTextContent("USD：现金换算依据缺失，未计入HKD换算");
});

it("keeps a target publication date distinct when the source publication date is missing", () => {
  const model = buildCurrentPortfolio([], { scope: createDefaultRoomScope() });
  const cashSnapshot = {
    id: "cash-fx-publication-gap",
    baseCurrency: "CNY" as const,
    asOf: "2026-09-27T01:00:00.000Z",
    source: "BOC",
    status: "complete" as const,
    rates: { "USD/CNY": "7", "HKD/CNY": "0.9" },
    publishedAt: null,
    publishedAtByCurrency: { HKD: "2026-09-26T00:00:00.000Z" },
    fetchedAt: "2026-09-27T01:00:00.000Z",
  };
  const money = {
    baseCurrency: "CNY" as const,
    originalByCurrency: { USD: "10" },
    convertedCny: "70",
    converted: "77.777777777777777778",
    convertedHkd: "77.777777777777777778",
    targetCurrency: "HKD" as const,
    conversion: "complete" as const,
    fxSnapshotId: cashSnapshot.id,
    note: "完整",
  };
  const cashSummary = {
    todayProceeds: money,
    cashTotal: money,
    fxSnapshot: cashSnapshot,
    todayProceedsStatus: "available" as const,
    cashTotalStatus: "available" as const,
    coverage: { included: 1, excluded: 0, missing: 0 },
    asOf: "2026-09-27T01:00:00.000Z",
    missingReasons: [],
    byScope: {},
    updatedAt: "2026-09-27T01:00:00.000Z",
  } satisfies CashSummary;

  render(<RoomAllocation model={model} reportCurrency="HKD" cashSummary={cashSummary} />);

  const provenance = screen.getByTestId("cash-fx-provenance");
  expect(provenance).toHaveTextContent("USD发布日期未提供");
  expect(provenance).toHaveTextContent("目标HKD发布日期：2026-09-26");
  expect(provenance).toHaveTextContent("获取于 2026-09-27 09:00（GMT+8）");
  expect(provenance).not.toHaveTextContent("汇率：2026-09-26（中行）");
});

it("does not invent FX provenance when the summary snapshot is missing or the view is original currency", () => {
  const model = buildCurrentPortfolio([], { scope: createDefaultRoomScope() });
  const cashSummary = {
    todayProceeds: { baseCurrency: "CNY", originalByCurrency: { USD: "10" }, convertedCny: null, converted: null, convertedHkd: null, targetCurrency: "HKD", conversion: "missing", fxSnapshotId: "old-fx", note: "尚无完整汇率快照" },
    cashTotal: { baseCurrency: "CNY", originalByCurrency: { USD: "10" }, convertedCny: null, converted: null, convertedHkd: null, targetCurrency: "HKD", conversion: "missing", fxSnapshotId: "old-fx", note: "尚无完整汇率快照" },
    todayProceedsStatus: "partial",
    cashTotalStatus: "partial",
    coverage: { included: 1, excluded: 0, missing: 0 },
    asOf: null,
    missingReasons: [],
    byScope: {},
    updatedAt: null,
  } satisfies CashSummary;

  const { rerender } = render(<RoomAllocation model={model} reportCurrency="HKD" cashSummary={cashSummary} />);
  expect(screen.getByText(/现金换算依据缺失/)).toBeInTheDocument();
  expect(screen.queryByText(/1 USD =/)).not.toBeInTheDocument();

  rerender(<RoomAllocation model={model} reportCurrency="original" cashSummary={{ ...cashSummary, fxSnapshot: { id: "old-fx", baseCurrency: "CNY", asOf: "2026-09-26", source: "BOC", status: "complete", rates: { "USD/CNY": "7" } } }} />);
  expect(screen.queryByTestId("cash-fx-provenance")).not.toBeInTheDocument();
});

const savedCashRefreshNotice = "已保存现金基准，摘要暂未刷新";

function savedCashFailureFixture() {
  const fxSnapshot = {
    id: "cash-status-old-fx",
    baseCurrency: "CNY" as const,
    asOf: "2026-09-26T00:00:00.000Z",
    source: "BOC",
    status: "complete" as const,
    rates: { "HKD/CNY": "0.9" },
    publishedAtByCurrency: {
      CNY: "2026-09-25T00:00:00.000Z",
      HKD: "2026-09-25T00:00:00.000Z",
    },
    fetchedAt: "2026-09-26T01:00:00.000Z",
  };
  const cashSummary = {
    todayProceeds: {
      baseCurrency: "CNY" as const,
      originalByCurrency: { CNY: "12" },
      convertedCny: "12",
      converted: "13.3333333333333333333",
      convertedHkd: "13.3333333333333333333",
      targetCurrency: "HKD" as const,
      conversion: "complete" as const,
      fxSnapshotId: fxSnapshot.id,
      note: "完整",
    },
    cashTotal: {
      baseCurrency: "CNY" as const,
      originalByCurrency: { CNY: "100300" },
      convertedCny: "100300",
      converted: "111444.4444444444444444",
      convertedHkd: "111444.4444444444444444",
      targetCurrency: "HKD" as const,
      conversion: "complete" as const,
      fxSnapshotId: fxSnapshot.id,
      note: "基准+股票/ETF成交变化",
    },
    fxSnapshot,
    todayProceedsStatus: "available" as const,
    cashTotalStatus: "available" as const,
    coverage: { included: 1, excluded: 0, missing: 0 },
    asOf: "2026-09-25T00:00:00.000Z",
    missingReasons: [],
    byScope: {},
    updatedAt: "2026-09-25T00:00:00.000Z",
  } satisfies CashSummary;
  const cashBaselineDetails = [{
    accountId: "account-a",
    accountLabel: "账户 A",
    currency: "CNY",
    balance: "100000",
    asOf: "2026-09-19T00:00:00.000Z",
    source: "saved-old",
    revision: 2,
    coverage: "available",
  }];
  return { cashSummary, cashBaselineDetails };
}

it("keeps the old cash amount, basis and FX primary after a saved notice with summary read failure", async () => {
  const user = userEvent.setup();
  const model = buildCurrentPortfolio([], { scope: createDefaultRoomScope() });
  const { cashSummary, cashBaselineDetails } = savedCashFailureFixture();
  const onRetryCashSummary = vi.fn();
  const onRetryValuation = vi.fn();

  const { rerender } = render(<RoomAllocation
    model={model}
    reportCurrency="HKD"
    cashSummary={cashSummary}
    cashBaselineDetails={cashBaselineDetails}
    cashRefreshNotice={savedCashRefreshNotice}
    error="摘要读取失败"
    onRetryCashSummary={onRetryCashSummary}
    onRetryValuation={onRetryValuation}
  />);

  expect(screen.getByText("HKD 13.33")).toBeInTheDocument();
  expect(screen.getByText("HKD 111,444.44")).toBeInTheDocument();
  expect(screen.getByRole("group", { name: "现金基准详情" })).toHaveTextContent("saved-old");
  expect(screen.getByRole("group", { name: "现金基准详情" })).toHaveTextContent("100000");
  expect(screen.getByTestId("cash-fx-provenance")).toHaveTextContent("1 CNY = 1.1111111111111111111 HKD");

  const status = screen.getByRole("status");
  expect(status).toHaveTextContent(savedCashRefreshNotice);
  expect(status).not.toHaveTextContent("摘要读取失败");
  const details = screen.getByRole("group", { name: "现金摘要读取详情" });
  expect(details).not.toHaveAttribute("open");
  expect(details).toHaveTextContent("摘要读取失败");
  await user.click(screen.getByText("现金摘要读取详情"));
  expect(details).toHaveAttribute("open");

  const retry = screen.getByRole("button", { name: "重试读取现金摘要" });
  await user.click(retry);
  expect(onRetryCashSummary).toHaveBeenCalledTimes(1);
  expect(onRetryValuation).not.toHaveBeenCalled();

  rerender(<RoomAllocation
    model={model}
    reportCurrency="HKD"
    cashSummary={cashSummary}
    cashBaselineDetails={cashBaselineDetails}
    cashRefreshNotice={savedCashRefreshNotice}
    error="摘要再次读取失败"
    onRetryCashSummary={onRetryCashSummary}
    onRetryValuation={onRetryValuation}
  />);
  await user.click(screen.getByRole("button", { name: "重试读取现金摘要" }));
  expect(onRetryCashSummary).toHaveBeenCalledTimes(2);
  expect(onRetryValuation).not.toHaveBeenCalled();
  expect(screen.getByText("HKD 111,444.44")).toBeInTheDocument();
});

it("keeps a saved notice and read-only retry when no old cash summary exists", () => {
  const model = buildCurrentPortfolio([], { scope: createDefaultRoomScope() });
  const onRetryCashSummary = vi.fn();

  render(<RoomAllocation
    model={model}
    reportCurrency="HKD"
    cashSummary={null}
    cashRefreshNotice={savedCashRefreshNotice}
    error="摘要读取失败"
    onRetryCashSummary={onRetryCashSummary}
    cashRetryDisabled
  />);

  expect(screen.getByRole("status")).toHaveTextContent(savedCashRefreshNotice);
  expect(screen.queryByText("现金数据暂不可用")).not.toBeInTheDocument();
  expect(screen.queryByText(/现金数据读取失败：摘要读取失败/)).not.toBeInTheDocument();
  expect(screen.getByRole("group", { name: "现金摘要读取详情" })).toHaveTextContent("摘要读取失败");
  expect(screen.getByRole("button", { name: "重试读取现金摘要" })).toBeDisabled();
  expect(screen.queryByText("HKD 111,444.44")).not.toBeInTheDocument();
});

it("disables the saved-notice retry when no cash callback is provided", () => {
  const model = buildCurrentPortfolio([], { scope: createDefaultRoomScope() });
  const { cashSummary, cashBaselineDetails } = savedCashFailureFixture();

  render(<RoomAllocation
    model={model}
    reportCurrency="HKD"
    cashSummary={cashSummary}
    cashBaselineDetails={cashBaselineDetails}
    cashRefreshNotice={savedCashRefreshNotice}
    error="摘要读取失败"
  />);

  expect(screen.getByText("HKD 13.33")).toBeInTheDocument();
  expect(screen.getByText("HKD 111,444.44")).toBeInTheDocument();
  expect(screen.getByRole("group", { name: "现金基准详情" })).toHaveTextContent("saved-old");
  expect(screen.getByRole("group", { name: "现金基准详情" })).toHaveTextContent("100000");
  expect(screen.getByTestId("cash-fx-provenance")).toHaveTextContent("1 CNY = 1.1111111111111111111 HKD");
  expect(screen.getByRole("status")).toHaveTextContent(savedCashRefreshNotice);
  expect(screen.getByRole("group", { name: "现金摘要读取详情" })).toHaveTextContent("摘要读取失败");
  expect(screen.getByRole("button", { name: "重试读取现金摘要" })).toBeDisabled();
});

it("keeps ordinary read errors in the existing feedback path without saved notice controls", () => {
  const model = buildCurrentPortfolio([], { scope: createDefaultRoomScope() });
  const { cashSummary, cashBaselineDetails } = savedCashFailureFixture();

  render(<RoomAllocation
    model={model}
    reportCurrency="HKD"
    cashSummary={cashSummary}
    cashBaselineDetails={cashBaselineDetails}
    error="服务暂不可用"
  />);

  expect(screen.getByText("HKD 13.33")).toBeInTheDocument();
  expect(screen.getByText("HKD 111,444.44")).toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent("现金数据读取失败：服务暂不可用 · 显示上次结果");
  expect(screen.queryByRole("group", { name: "现金摘要读取详情" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "重试读取现金摘要" })).not.toBeInTheDocument();
});

it("shows a compact GET-only retry when the current cash read has no accepted summary", async () => {
  const user = userEvent.setup();
  const model = buildCurrentPortfolio([], { scope: createDefaultRoomScope() });
  const onRetryCashSummary = vi.fn();

  render(<RoomAllocation
    model={model}
    reportCurrency="HKD"
    cashSummary={null}
    error="服务暂不可用"
    onRetryCashSummary={onRetryCashSummary}
  />);

  expect(screen.getByText("现金数据读取失败：服务暂不可用")).toBeInTheDocument();
  const retry = screen.getByRole("button", { name: "重试读取现金摘要" });
  expect(retry).toBeEnabled();
  await user.click(retry);
  expect(onRetryCashSummary).toHaveBeenCalledTimes(1);
});
