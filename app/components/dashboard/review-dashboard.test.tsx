import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildInstrumentTradeSummaries } from "../../lib/trades/instruments";
import { buildTradeLibraryEntries, type TradeLibraryEntry } from "../../lib/trades/library";
import type { Instrument, TradeExecution } from "../../lib/trades/types";
import { ReviewDashboard } from "./review-dashboard";

beforeEach(() => {
  vi.useFakeTimers({ now: new Date("2026-10-15T12:00:00.000Z"), shouldAdvanceTime: true });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const shanghai: Instrument = {
  id: "CN-SH:600000",
  symbol: "600000",
  name: "上海测试",
  market: "CN-SH",
  currency: "CNY",
};

function pair(instrument: Instrument, date: string, suffix: string): TradeExecution[] {
  return [
    {
      id: `${suffix}:buy`,
      accountId: "account-1",
      accountLabel: "主账户",
      instrument,
      side: "buy",
      executedAt: `${date}T01:00:00.000Z`,
      quantity: "1",
      price: "10",
      fee: "0",
      source: { platform: "futu", row: 1 },
    },
    {
      id: `${suffix}:sell`,
      accountId: "account-1",
      accountLabel: "主账户",
      instrument,
      side: "sell",
      executedAt: `${date}T02:00:00.000Z`,
      quantity: "1",
      price: "11",
      fee: "0",
      source: { platform: "futu", row: 2 },
    },
  ];
}

function dashboardEntries(
  instrument: Instrument = shanghai,
  month = "2026-10",
  prefix = "",
): TradeLibraryEntry[] {
  const executions = [
    ...pair(instrument, `${month}-02`, `${prefix}win-100`),
    ...pair(instrument, `${month}-03`, `${prefix}win-300`),
    ...pair(instrument, `${month}-04`, `${prefix}loss-100`),
    ...pair(instrument, `${month}-05`, `${prefix}break-even`),
  ];
  const entries = buildTradeLibraryEntries(buildInstrumentTradeSummaries(executions), {}, {});
  const entry = entries[0];
  const values = new Map([
    [`${month}-02`, "100"],
    [`${month}-03`, "300"],
    [`${month}-04`, "-100"],
    [`${month}-05`, "0"],
  ]);
  for (const item of entry.episodes) {
    const date = item.episode.endedAt?.slice(0, 10);
    const netPnl = date ? values.get(date) : undefined;
    if (netPnl !== undefined) item.metrics = { ...item.metrics, netPnl, realizedPnl: netPnl, returnPercent: netPnl };
  }
  entry.netPnl = "300";
  return entries;
}

function copyEntry(
  entry: TradeLibraryEntry,
  options: { prefix: string; tradeNature: "live" | "simulation" | "unknown"; simulationRunId?: string },
): TradeLibraryEntry {
  const mapExecution = (execution: TradeExecution): TradeExecution => ({
    ...execution,
    id: `${options.prefix}:${execution.id}`,
    source: {
      ...execution.source,
      tradeNature: options.tradeNature,
      ...(options.simulationRunId ? { simulationRunId: options.simulationRunId } : {}),
    },
  });
  const executionsById = new Map(entry.executions.map(execution => [execution.id, mapExecution(execution)]));
  const episodes = entry.episodes.map(item => ({
    ...item,
    episode: {
      ...item.episode,
      id: `${options.prefix}:${item.episode.id}`,
      tradeNature: options.tradeNature,
      ...(options.simulationRunId ? { simulationRunId: options.simulationRunId } : {}),
      executions: item.episode.executions.map(execution => executionsById.get(execution.id)!),
    },
  }));
  return {
    ...entry,
    groupId: `${options.prefix}:${entry.groupId ?? entry.instrument.id}`,
    tradeNature: options.tradeNature,
    ...(options.simulationRunId ? { simulationRunId: options.simulationRunId } : {}),
    executions: [...executionsById.values()],
    episodes,
  };
}

function metadata(instrument: Instrument, assetType: "stock" | "etf") {
  return { market: instrument.market, symbol: instrument.symbol, assetType } as const;
}

describe("ReviewDashboard", () => {
  it("publishes the current scoped quality model after building it", () => {
    const onQualityModelChange = vi.fn();
    render(
      <ReviewDashboard
        entries={dashboardEntries()}
        qualityInput={{}}
        onQualityModelChange={onQualityModelChange}
        onOpenInReview={() => undefined}
      />,
    );

    expect(onQualityModelChange).toHaveBeenCalled();
    expect(onQualityModelChange.mock.lastCall?.[0]).toEqual(expect.objectContaining({
      scopeKey: expect.stringContaining("live|all|month"),
      dimensions: expect.arrayContaining([
        expect.objectContaining({ id: "transaction" }),
        expect.objectContaining({ id: "holdings" }),
        expect.objectContaining({ id: "historical" }),
        expect.objectContaining({ id: "fx" }),
      ]),
    }));
  });

  it("starts with live, all categories and the current natural month", () => {
    const etf: Instrument = { ...shanghai, id: "US:SPY", symbol: "SPY", name: "标普ETF", market: "US", currency: "USD" };
    const unknown: Instrument = { ...shanghai, id: "US:UNKNOWN", symbol: "UNKNOWN", name: "未知资产", market: "US", currency: "USD" };
    render(
      <ReviewDashboard
        entries={[...dashboardEntries(shanghai), ...dashboardEntries(etf, "2026-10", "etf-"), ...dashboardEntries(unknown, "2026-10", "unknown-")]}
        instrumentMetadata={new Map([[shanghai.id, metadata(shanghai, "stock")], [etf.id, metadata(etf, "etf")]])}
        onOpenInReview={() => undefined}
      />,
    );

    const room = screen.getByRole("region", { name: "交易室范围" });
    expect(within(room).getByRole("button", { name: "实盘" })).toHaveAttribute("aria-pressed", "true");
    expect(within(room).getByLabelText("实盘身份")).toHaveTextContent("实盘");
    expect(within(room).getByRole("combobox", { name: "交易室分类筛选" })).toHaveValue("all");
    expect(within(room).getByRole("tab", { name: "本月" })).toHaveAttribute("aria-selected", "true");
    expect(within(room).getByRole("tablist", { name: "交易室期间" })).toHaveTextContent("近3个自然月");
    expect(room).toHaveTextContent("收益概览");
    expect(room).not.toHaveTextContent("统一统计范围");
    expect(room).toHaveTextContent("未知资产类型");
    expect(room).toHaveTextContent("未纳入四类合计");
    expect(room).toHaveTextContent("可信已平仓回合");
  });

  it("keeps original currency subtotals beside the converted summary", () => {
    const usd: Instrument = { ...shanghai, id: "US:TEST", symbol: "TEST", name: "美股测试", market: "US", currency: "USD" };
    const entries = [dashboardEntries(shanghai), dashboardEntries(usd, "2026-10", "usd-")].flat();
    render(
      <ReviewDashboard
        entries={entries}
        instrumentMetadata={new Map([
          [shanghai.id, metadata(shanghai, "stock")],
          [usd.id, metadata(usd, "stock")],
        ])}
        fxSnapshot={{ id: "fx:test", baseCurrency: "CNY", asOf: "2026-10-15", source: "fixture", status: "complete", rates: { "USD/CNY": "7" } }}
        onOpenInReview={() => undefined}
      />,
    );

    const room = screen.getByRole("region", { name: "交易室范围" });
    expect(room).toHaveTextContent("原币小计");
    expect(room).toHaveTextContent("US$");
  });

  it("uses the same scope when switching category and period", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const etf: Instrument = { ...shanghai, id: "US:SPY", symbol: "SPY", name: "标普ETF", market: "US", currency: "USD" };
    render(
      <ReviewDashboard
        entries={[...dashboardEntries(shanghai, "2026-09"), ...dashboardEntries(etf, "2026-10", "etf-")]}
        instrumentMetadata={new Map([[shanghai.id, metadata(shanghai, "stock")], [etf.id, metadata(etf, "etf")]])}
        onOpenInReview={() => undefined}
      />,
    );
    const room = screen.getByRole("region", { name: "交易室范围" });
    await user.click(within(room).getByRole("tab", { name: "近3个自然月" }));
    expect(room).toHaveTextContent("2026-08-01 至 2026-10-15");
    await user.selectOptions(within(room).getByRole("combobox", { name: "交易室分类筛选" }), "etf");
    expect(room).toHaveTextContent("4 个回合进入范围");
    expect(room).toHaveTextContent("可信已平仓回合");
  });

  it("requires a simulation run and never combines runs", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const base = dashboardEntries()[0];
    const runA = copyEntry(base, { prefix: "run-a", tradeNature: "simulation", simulationRunId: "run-a" });
    const runB = copyEntry(base, { prefix: "run-b", tradeNature: "simulation", simulationRunId: "run-b" });
    render(<ReviewDashboard entries={[runA, runB]} onOpenInReview={() => undefined} />);
    const room = screen.getByRole("region", { name: "交易室范围" });
    await user.click(within(room).getByRole("button", { name: "模拟盘" }));
    expect(within(room).getByLabelText("模拟盘身份")).toHaveTextContent("模拟盘");
    expect(room).toHaveTextContent("请选择一个模拟运行");
    const runSelect = within(room).getByRole("combobox", { name: "交易室模拟运行筛选" });
    await user.selectOptions(runSelect, "run-a");
    expect(room).toHaveTextContent("4 个回合进入范围");
    expect(room).not.toHaveTextContent("run-b");
    await user.click(within(room).getByRole("button", { name: "实盘" }));
    await user.click(within(room).getByRole("button", { name: "模拟盘" }));
    expect(within(room).getByRole("combobox", { name: "交易室模拟运行筛选" })).toHaveValue("run-a");
  });

  it("keeps account, symbol and review filters inside the collapsed advanced scope", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<ReviewDashboard entries={dashboardEntries()} onOpenInReview={() => undefined} />);
    const room = screen.getByRole("region", { name: "交易室范围" });
    await user.click(within(room).getByRole("tab", { name: "今年至今" }));
    expect(within(room).queryByRole("combobox", { name: "交易室账户筛选" })).not.toBeVisible();
    await user.click(within(room).getByText("更多筛选"));
    await user.selectOptions(within(room).getByRole("combobox", { name: "交易室账户筛选" }), "account-1");
    expect(room).toHaveTextContent("1 项已启用");
    await user.type(within(room).getByRole("searchbox", { name: "交易室标的筛选" }), "不存在");
    expect(room).toHaveTextContent("当前交易室范围没有回合");
    await user.click(within(room).getByRole("button", { name: "清除交易室筛选" }));
    expect(within(room).getByRole("button", { name: "实盘" })).toHaveAttribute("aria-pressed", "true");
    expect(within(room).getByRole("combobox", { name: "交易室分类筛选" })).toHaveValue("all");
    expect(within(room).getByRole("tab", { name: "今年至今" })).toHaveAttribute("aria-selected", "true");
    expect(room).toHaveTextContent("4 个回合进入范围");
  });

  it("keeps the last valid scope when a custom date draft is invalid", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<ReviewDashboard entries={dashboardEntries()} onOpenInReview={() => undefined} />);
    const room = screen.getByRole("region", { name: "交易室范围" });
    await user.click(within(room).getByRole("button", { name: "更多期间" }));
    fireEvent.change(within(room).getByLabelText("交易室自定义起始日期"), { target: { value: "2026-11-01" } });
    expect(room).toHaveTextContent("自定义期间起止日期无效");
    expect(room).toHaveTextContent("2026-10-01 至 2026-10-15");
    expect(room).toHaveTextContent("4 个回合进入范围");
  });

  it("opens a calendar episode using the unified room rows and compatible callback", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onOpenInReview = vi.fn();
    render(<ReviewDashboard entries={dashboardEntries()} instrumentMetadata={new Map([[shanghai.id, metadata(shanghai, "stock")]])} onOpenInReview={onOpenInReview} />);
    const performance = screen.getByRole("region", { name: "业绩趋势与日历" });
    await user.click(within(performance).getByRole("button", { name: "日历" }));
    const day = within(performance).getByRole("button", { name: /2026-10-03，\+¥300\.00/ });
    await user.click(day);
    const drilldown = within(performance).getByRole("region", { name: "日历日期详情" });
    await user.click(within(drilldown).getByRole("button", { name: "打开复盘" }));
    expect(onOpenInReview).toHaveBeenCalledWith("CN-SH:600000", expect.any(String), expect.arrayContaining([expect.any(String)]));
  });

  it("distinguishes empty data from an empty scoped period", () => {
    const { rerender } = render(<ReviewDashboard entries={[]} onOpenInReview={() => undefined} />);
    expect(screen.getByRole("region", { name: "交易室范围" })).toHaveTextContent("导入交易后查看统计总览");
    rerender(<ReviewDashboard entries={dashboardEntries(shanghai, "2026-09")} onOpenInReview={() => undefined} />);
    expect(screen.getByRole("region", { name: "交易室范围" })).toHaveTextContent("当前交易室范围暂无已平仓回合");
  });

  it("clears a calendar drilldown and returns to the new scope after a top-level period change", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const entries = [
      ...dashboardEntries(shanghai, "2026-09"),
      ...dashboardEntries(shanghai, "2025-10", "history-"),
    ];
    render(
      <ReviewDashboard
        entries={entries}
        instrumentMetadata={new Map([[shanghai.id, metadata(shanghai, "stock")]])}
        onOpenInReview={() => undefined}
      />,
    );
    const performance = screen.getByRole("region", { name: "业绩趋势与日历" });
    await user.click(within(performance).getByRole("button", { name: "日历" }));
    await user.click(within(performance).getByRole("button", { name: "全部年份" }));
    expect(within(performance).getByRole("button", { name: "全部年份" })).toHaveAttribute("aria-pressed", "true");
    await user.click(within(screen.getByRole("region", { name: "交易室范围" })).getByRole("tab", { name: "今年至今" }));
    expect(screen.getByRole("region", { name: "交易室范围" })).toHaveTextContent("2026-01-01 至 2026-10-15");
    expect(within(screen.getByRole("region", { name: "业绩趋势与日历" })).getByRole("heading", { name: "累计盈亏趋势" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "日历日期详情" })).not.toBeInTheDocument();
  });

  it("syncs custom date drafts after calendar period drilldown", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const entries = [
      ...dashboardEntries(shanghai, "2026-09"),
      ...dashboardEntries(shanghai, "2026-08", "aug-"),
    ];
    render(
      <ReviewDashboard
        entries={entries}
        instrumentMetadata={new Map([[shanghai.id, metadata(shanghai, "stock")]])}
        onOpenInReview={() => undefined}
      />,
    );
    const performance = screen.getByRole("region", { name: "业绩趋势与日历" });
    await user.click(within(performance).getByRole("button", { name: "日历" }));
    await user.click(within(performance).getByRole("button", { name: "年" }));
    await user.click(within(performance).getByRole("button", { name: /2026年8月/ }));

    const room = screen.getByRole("region", { name: "交易室范围" });
    expect(room).toHaveTextContent("2026-08-01 至 2026-08-31");
    expect(within(room).getByRole("button", { name: "更多期间" })).toHaveAttribute("aria-pressed", "true");
    expect(within(room).getByLabelText("交易室自定义起始日期")).toHaveValue("2026-08-01");
    expect(within(room).getByLabelText("交易室自定义结束日期")).toHaveValue("2026-08-31");
    });
  });

  it("keeps diagnostics and principal configuration out of the homepage", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onOpenDataManagement = vi.fn();
    render(
      <ReviewDashboard
        entries={dashboardEntries()}
        qualityInput={{}}
        onOpenDataManagement={onOpenDataManagement}
        onOpenInReview={() => undefined}
      />,
    );

    expect(screen.queryByRole("region", { name: "数据质量摘要" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "收益质量" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "本金与参考收益率" })).not.toBeInTheDocument();
    const status = screen.getByRole("status", { name: "数据状态" });
    expect(status).toHaveTextContent("数据");
    await user.click(within(status).getByRole("button", { name: "打开数据管理" }));
    expect(onOpenDataManagement).toHaveBeenCalledOnce();
  });
