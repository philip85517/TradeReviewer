import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildInstrumentTradeSummaries } from "../../lib/trades/instruments";
import { buildTradeLibraryEntries, type TradeLibraryEntry } from "../../lib/trades/library";
import type { Instrument, TradeExecution } from "../../lib/trades/types";
import { ReviewDashboard } from "./review-dashboard";
import type { SharedScope } from "../../lib/reviews/shared-scope";

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

function holdingDashboardEntry(): TradeLibraryEntry {
  const instrument: Instrument = { id: "US:TEST", symbol: "TEST", name: "测试持仓", market: "US", currency: "USD" };
  const execution: TradeExecution = {
    id: "holding:buy",
    accountId: "account-1",
    accountLabel: "主账户",
    instrument,
    side: "buy",
    executedAt: "2020-01-02T01:00:00.000Z",
    quantity: "2",
    price: "10",
    fee: "0",
    source: { platform: "fixture", row: 1 },
  };
  const episode = {
    id: "episode:holding",
    accountId: "account-1",
    accountLabel: "主账户",
    instrument,
    tradeNature: "live" as const,
    direction: "long" as const,
    status: "open" as const,
    startedAt: execution.executedAt,
    openingQuantity: "2",
    remainingQuantity: "2",
    executions: [execution],
  };
  return {
    groupId: "US:TEST|live:account-1",
    tradeNature: "live",
    instrument,
    executions: [execution],
    episodes: [{
      episode,
      metrics: { buyCount: 1, sellCount: 0, boughtQuantity: "2", soldQuantity: "0", grossExposure: "20", fees: "0", realizedPnl: "0", unrealizedPnl: "999", netPnl: "999", returnPercent: "999", holdingMilliseconds: null },
      reviewStatus: "pending",
      confirmedTagIds: [],
      tagDictionaryVersion: 1,
      rMultiple: null,
    }],
    accountCount: 1,
    tradeCount: 1,
    episodeCount: 1,
    firstTradeAt: execution.executedAt,
    lastTradeAt: execution.executedAt,
    status: "open",
    netPnl: "999",
    returnPercent: "999",
    reviewedEpisodeCount: 0,
    confirmedTagIds: [],
    cumulativeR: null,
  };
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

function radio(container: HTMLElement, name: string | RegExp) {
  return within(container).getByRole("radio", { name });
}

describe("ReviewDashboard", () => {
  it("shows page-wide nature and currency radios with a YTD default and permanent dates", () => {
    render(<ReviewDashboard entries={dashboardEntries()} onOpenInReview={() => undefined} />);
    const room = screen.getByRole("region", { name: "我的交易室" });
    expect(within(room).getByRole("radio", { name: "实盘" })).toBeChecked();
    expect(within(room).getByRole("radio", { name: "模拟盘" })).not.toBeChecked();
    expect(within(room).getByRole("radio", { name: "原币" })).toBeChecked();
    expect(within(room).getByRole("radio", { name: "折算 CNY" })).not.toBeChecked();
    expect(within(room).getByRole("tab", { name: "今年至今" })).toHaveAttribute("aria-selected", "true");
    expect(within(room).getByLabelText("交易室起始日期")).toBeVisible();
    expect(within(room).getByLabelText("交易室结束日期")).toBeVisible();
    expect(within(room).queryByRole("tab", { name: "本月" })).not.toBeInTheDocument();
  });

  it("does not turn an untouched preset into a custom period on date blur or Enter", () => {
    render(<ReviewDashboard entries={dashboardEntries()} onOpenInReview={() => undefined} />);
    const room = screen.getByRole("region", { name: "我的交易室" });
    const start = within(room).getByLabelText("交易室起始日期");
    fireEvent.keyDown(start, { key: "Enter" });
    fireEvent.blur(start);
    expect(within(room).getByRole("tab", { name: "今年至今" })).toHaveAttribute("aria-selected", "true");
    expect(room).not.toHaveTextContent("编辑中");
  });

  it("keeps simulation runs and live holdings isolated after changing nature", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const base = dashboardEntries()[0];
    const live = holdingDashboardEntry();
    const runA = copyEntry(base, { prefix: "run-a", tradeNature: "simulation", simulationRunId: "run-a" });
    const runB = copyEntry(base, { prefix: "run-b", tradeNature: "simulation", simulationRunId: "run-b" });
    render(<ReviewDashboard entries={[live, runA, runB]} onOpenInReview={() => undefined} />);
    const room = screen.getByRole("region", { name: "我的交易室" });
    await user.click(within(room).getByRole("radio", { name: "模拟盘" }));
    expect(within(room).getByRole("group", { name: "交易室模拟运行筛选" })).toBeInTheDocument();
    const runs = within(room).getByRole("group", { name: "交易室模拟运行筛选" });
    expect(within(runs).getAllByRole("radio")[1]).toHaveAttribute("value", "run-a");
    expect(within(runs).getAllByRole("radio")).toHaveLength(3);
    expect(screen.queryByRole("region", { name: "当前持仓" })).not.toBeInTheDocument();
  });

  it("propagates reset and clear actions through a controlled shared scope", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const patches: Partial<SharedScope>[] = [];
    render(
      <ReviewDashboard
        entries={dashboardEntries()}
        sharedScope={{ nature: "simulation", accountIds: ["account-1"], reportCurrency: "original", simulationRunId: "run-a" }}
        onSharedScopeChange={patch => patches.push(patch)}
        onOpenInReview={() => undefined}
      />,
    );
    const room = screen.getByRole("region", { name: "我的交易室" });
    await user.click(within(room).getByRole("button", { name: "恢复默认范围" }));
    expect(patches.at(-1)).toEqual({ nature: "live", accountIds: [], simulationRunId: null });
  });

  it("drops shared accounts that do not belong to the selected nature or run", () => {
    const live = dashboardEntries()[0];
    const simulation = copyEntry(live, { prefix: "sim", tradeNature: "simulation", simulationRunId: "run-a" });
    render(
      <ReviewDashboard
        entries={[live, simulation]}
        sharedScope={{ nature: "unknown", accountIds: ["missing-account"], reportCurrency: "original", simulationRunId: "run-a" }}
        onOpenInReview={() => undefined}
      />,
    );
    const room = screen.getByRole("region", { name: "我的交易室" });
    expect(radio(room, "实盘")).toBeChecked();
    expect(room).toHaveTextContent("账户：全部");
  });

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
      scopeKey: expect.stringContaining("live|all|ytd"),
      dimensions: expect.arrayContaining([
        expect.objectContaining({ id: "transaction" }),
        expect.objectContaining({ id: "holdings" }),
        expect.objectContaining({ id: "historical" }),
        expect.objectContaining({ id: "fx" }),
      ]),
    }));
  });

  it("forwards market-data diagnostics to holdings and its quality model", () => {
    const onQualityModelChange = vi.fn();
    const view = render(
      <ReviewDashboard
        entries={[holdingDashboardEntry()]}
        holdingsQuotesByInstrument={{ "US:TEST": { price: null, currency: "USD", quoteDate: "2026-10-15", fetchedAt: "2026-10-15T08:00:00.000Z", provider: "fixture", freshness: "current" } }}
        qualityInput={{
          marketDataStatuses: { "US:TEST": "latest-available" },
          marketDataDailyStatuses: { "US:TEST": "syncing" },
          marketDataLabels: { "US:TEST": "fixture provider" },
          marketDataJobs: {
            "US:TEST": {
              instrumentId: "US:TEST",
              symbol: "TEST",
              market: "US",
              requestedAt: "2026-10-15T08:00:00.000Z",
              status: "syncing",
              intervals: [],
            },
          },
        }}
        onQualityModelChange={onQualityModelChange}
        onOpenInReview={() => undefined}
      />,
    );

    expect(screen.getByRole("region", { name: "当前持仓" })).toBeInTheDocument();
    const qualityModel = onQualityModelChange.mock.lastCall?.[0];
    const holdingsDimension = qualityModel?.dimensions.find((dimension: { id: string }) => dimension.id === "holdings");
    expect(holdingsDimension).toEqual(expect.objectContaining({
      action: "retry",
      issues: expect.arrayContaining([expect.objectContaining({ reason: "行情更新进行中", action: "retry" })]),
    }));

    view.rerender(
      <ReviewDashboard
        entries={[holdingDashboardEntry()]}
        holdingsQuotesByInstrument={{ "US:TEST": { price: null, currency: "USD", quoteDate: "2026-10-15", fetchedAt: "2026-10-15T08:00:00.000Z", provider: "fixture", freshness: "current" } }}
        qualityInput={{
          marketDataStatuses: { "US:TEST": "complete" },
          marketDataDailyStatuses: { "US:TEST": "complete" },
          marketDataLabels: { "US:TEST": "fixture provider" },
          marketDataJobs: {
            "US:TEST": {
              instrumentId: "US:TEST",
              symbol: "TEST",
              market: "US",
              requestedAt: "2026-10-15T08:00:00.000Z",
              status: "complete",
              intervals: [],
            },
          },
        }}
        onQualityModelChange={onQualityModelChange}
        onOpenInReview={() => undefined}
      />,
    );
    const refreshedQualityModel = onQualityModelChange.mock.lastCall?.[0];
    const refreshedHoldingsDimension = refreshedQualityModel?.dimensions.find((dimension: { id: string }) => dimension.id === "holdings");
    expect(refreshedHoldingsDimension).toEqual(expect.objectContaining({
      issues: expect.arrayContaining([expect.objectContaining({ reason: "行情价格无效，无法计算浮盈亏", action: "open-data-check" })]),
    }));
  });

  it("forwards an async holdings retry through the dashboard callback", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    let resolveRetry!: () => void;
    const onRetryDataQuality = vi.fn(() => new Promise<void>(resolve => { resolveRetry = resolve; }));
    render(
      <ReviewDashboard
        entries={[holdingDashboardEntry()]}
        qualityInput={{ marketDataDailyStatuses: { "US:TEST": "not-requested" } }}
        onRetryDataQuality={onRetryDataQuality}
        onOpenInReview={() => undefined}
      />,
    );

    const holdings = screen.getByRole("region", { name: "当前持仓" });
    await user.click(within(holdings).getByRole("button", { name: "重试行情" }));
    expect(onRetryDataQuality).toHaveBeenCalledWith("holdings", ["US:TEST"]);
    expect(holdings).toHaveTextContent("行情重试进行中");
    resolveRetry();
    expect(await screen.findByText("行情重试完成，仍不可用")).toBeInTheDocument();
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
    expect(radio(room, "实盘")).toBeChecked();
    expect(within(room).getByRole("group", { name: "交易室市场分类筛选" }).querySelector('input[value="all"]')).toBeChecked();
    expect(room).toHaveTextContent("全部市场");
    expect(within(room).getByRole("tab", { name: "今年至今" })).toHaveAttribute("aria-selected", "true");
    expect(within(room).getByRole("tablist", { name: "交易室期间" })).toHaveTextContent("近3个自然月");
    expect(room).toHaveTextContent("收益概览");
    expect(room).not.toHaveTextContent("统一统计范围");
    expect(room).toHaveTextContent("未知资产类型");
    expect(room).toHaveTextContent("不纳入 A股 / 美股 / 港股合计");
    expect(room).toHaveTextContent("可信已平仓回合");
  });

  it("puts nature controls beside the scope heading and exposes a holdings focus action", () => {
    render(<ReviewDashboard entries={dashboardEntries()} onOpenInReview={() => undefined} />);

    const scope = screen.getByRole("region", { name: "交易室范围" });
    expect(radio(scope, "实盘")).toBeChecked();
    expect(radio(scope, "模拟盘")).not.toBeChecked();
    expect(document.getElementById("trading-room-holdings")).toBeInTheDocument();
    expect(within(scope).queryByText("交易性质")).not.toBeInTheDocument();
  });

  it("keeps the summary and trend inside one visual performance block", () => {
    render(<ReviewDashboard entries={dashboardEntries()} onOpenInReview={() => undefined} />);

    const scope = screen.getByRole("region", { name: "交易室范围" });
    expect(within(scope).getByRole("region", { name: "业绩趋势与日历" })).toBeInTheDocument();
  });

  it("keeps full PnL context behind a compact keyboard-accessible disclosure", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<ReviewDashboard entries={dashboardEntries()} onOpenInReview={() => undefined} />);

    const scope = screen.getByRole("region", { name: "交易室范围" });
    const card = within(scope).getByText("已平仓回合净盈亏").closest("div");
    expect(card?.querySelector("small")).toHaveTextContent("2026-01-01");
    const disclosure = within(scope).getByText("查看原币与汇率详情");
    expect(disclosure.closest("details")).not.toHaveAttribute("open");
    disclosure.focus();
    expect(document.activeElement).toBe(disclosure);
    await user.click(disclosure);
    expect(disclosure.closest("details")).toHaveAttribute("open");
    expect(card).toHaveTextContent("2026-01-01 至 2026-10-15");
  });

  it("labels a pure CNY summary as original currency instead of an FX conversion", () => {
    const trustedEntries = dashboardEntries().map(entry => ({
      ...entry,
      episodes: entry.episodes.map(item => ({
        ...item,
        metrics: { ...item.metrics, pnlAvailable: undefined },
        reviewStatus: "completed" as const,
      })),
    }));
    render(
      <ReviewDashboard
        entries={trustedEntries}
        instrumentMetadata={new Map([[shanghai.id, metadata(shanghai, "stock")]])}
        onOpenInReview={() => undefined}
      />,
    );

    const scope = screen.getByRole("region", { name: "交易室范围" });
    const card = within(scope).getByText("已平仓回合净盈亏").closest("div");
    expect(card?.querySelector("small")).toHaveTextContent("CNY 原币");
    expect(card?.querySelector("small")).not.toHaveTextContent("汇率快照");
  });

  it("labels the primary category filter as market category without offering unknown as a choice", () => {
    const unknown: Instrument = { ...shanghai, id: "US:UNKNOWN", symbol: "UNKNOWN", name: "未知资产", market: "US", currency: "USD" };
    render(<ReviewDashboard entries={[...dashboardEntries(), ...dashboardEntries(unknown, "2026-10", "unknown-")]} onOpenInReview={() => undefined} />);

    const scope = screen.getByRole("region", { name: "交易室范围" });
    expect(within(scope).getByRole("group", { name: "交易室市场分类筛选" }).querySelector('input[value="all"]')).toBeChecked();
    expect(radio(scope, "ETF")).toBeInTheDocument();
    expect(radio(scope, "全部资产")).toBeChecked();
    expect(scope).toHaveTextContent("未知资产类型");
  });

  it("opens, applies, cancels and validates a custom period in place", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<ReviewDashboard entries={dashboardEntries()} onOpenInReview={() => undefined} />);

    const scope = screen.getByRole("region", { name: "交易室范围" });
    expect(within(scope).getByLabelText("交易室起始日期")).toBeVisible();
    expect(within(scope).getByLabelText("交易室结束日期")).toBeVisible();

    fireEvent.change(within(scope).getByLabelText("交易室起始日期"), { target: { value: "2026-10-05" } });
    fireEvent.change(within(scope).getByLabelText("交易室结束日期"), { target: { value: "2026-10-10" } });
    fireEvent.blur(within(scope).getByLabelText("交易室结束日期"));
    expect(scope).toHaveTextContent("2026-10-05 至 2026-10-10");
    expect(within(scope).queryByRole("button", { name: "应用期间" })).not.toBeInTheDocument();

    fireEvent.change(within(scope).getByLabelText("交易室起始日期"), { target: { value: "2026-11-01" } });
    fireEvent.change(within(scope).getByLabelText("交易室起始日期"), { target: { value: "2026-10-05" } });
    expect(scope).toHaveTextContent("2026-10-05 至 2026-10-10");

    fireEvent.change(within(scope).getByLabelText("交易室结束日期"), { target: { value: "2026-10-01" } });
    fireEvent.blur(within(scope).getByLabelText("交易室结束日期"));
    expect(scope).toHaveTextContent("自定义期间起止日期无效");
    expect(scope).toHaveTextContent("2026-10-05 至 2026-10-10");

    await user.click(within(scope).getByRole("tab", { name: "今年至今" }));
    expect(within(scope).queryByLabelText("交易室起始日期")).toBeInTheDocument();
    expect(scope).not.toHaveTextContent("自定义期间起止日期无效");
  });

  it("keeps original currency subtotals beside the converted summary", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
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
    const disclosure = within(room).getByText("查看原币与汇率详情");
    expect(disclosure.closest("details")).not.toHaveAttribute("open");
    await user.click(disclosure);
    expect(disclosure.closest("details")).toHaveAttribute("open");
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
    const performance = within(room).getByRole("region", { name: "业绩趋势与日历" });
    await user.click(within(performance).getByRole("button", { name: "日历" }));
    await user.click(within(room).getByRole("tab", { name: "近3个自然月" }));
    expect(room).toHaveTextContent("2026-08-01 至 2026-10-15");
    expect(within(room).getByRole("heading", { name: "已平仓净盈亏日历" })).toBeInTheDocument();
    await user.click(within(room).getByRole("group", { name: "交易室市场分类筛选" }).querySelector('input[value="us-stock"]')!);
    expect(room).toHaveTextContent("4 个回合进入范围");
    expect(room).toHaveTextContent("可信已平仓回合");
    expect(within(room).getByRole("heading", { name: "已平仓净盈亏日历" })).toBeInTheDocument();
  });

  it("requires a simulation run and never combines runs", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const base = dashboardEntries()[0];
    const runA = copyEntry(base, { prefix: "run-a", tradeNature: "simulation", simulationRunId: "run-a" });
    const runB = copyEntry(base, { prefix: "run-b", tradeNature: "simulation", simulationRunId: "run-b" });
    render(<ReviewDashboard entries={[runA, runB]} onOpenInReview={() => undefined} />);
    const room = screen.getByRole("region", { name: "交易室范围" });
    await user.click(radio(room, "模拟盘"));
    expect(radio(room, "模拟盘")).toBeChecked();
    expect(room).toHaveTextContent("请选择一个模拟运行");
    const runSelect = within(room).getByRole("group", { name: "交易室模拟运行筛选" });
    await user.click(within(runSelect).getAllByRole("radio")[1]);
    expect(room).toHaveTextContent("4 个回合进入范围");
    expect(room).not.toHaveTextContent("run-b");
    await user.click(radio(room, "实盘"));
    await user.click(radio(room, "模拟盘"));
    expect(within(room).getByRole("group", { name: "交易室模拟运行筛选" })).toBeInTheDocument();
  });

  it("clears an account that is incompatible with the newly selected simulation run", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const base = dashboardEntries()[0];
    const withAccount = (entry: TradeLibraryEntry, accountId: string) => ({
      ...entry,
      episodes: entry.episodes.map(item => ({ ...item, episode: { ...item.episode, accountId } })),
    });
    const runA = withAccount(copyEntry(base, { prefix: "run-a", tradeNature: "simulation", simulationRunId: "run-a" }), "account-a");
    const runB = withAccount(copyEntry(base, { prefix: "run-b", tradeNature: "simulation", simulationRunId: "run-b" }), "account-b");
    const patches: Partial<SharedScope>[] = [];
    render(
      <ReviewDashboard
        entries={[runA, runB]}
        sharedScope={{ nature: "simulation", accountIds: ["account-a"], reportCurrency: "original", simulationRunId: "run-a" }}
        onSharedScopeChange={patch => patches.push(patch)}
        onOpenInReview={() => undefined}
      />,
    );
    const room = screen.getByRole("region", { name: "交易室范围" });
    const runs = within(room).getByRole("group", { name: "交易室模拟运行筛选" });
    await user.click(runs.querySelector('input[value="run-b"]')!);
    expect(patches.at(-1)).toEqual({ accountIds: [], simulationRunId: "run-b" });
  });

  it("derives room metrics immediately from the controlled shared nature and account scope", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const base = dashboardEntries()[0];
    const simulation = copyEntry(base, { prefix: "controlled-sim", tradeNature: "simulation", simulationRunId: "run-controlled" });
    let scope: SharedScope = { nature: "live", accountIds: [], reportCurrency: "original", simulationRunId: null };
    const { rerender } = render(
      <ReviewDashboard
        entries={[base, simulation]}
        sharedScope={scope}
        sharedAccountOptions={[{ id: "account-1", label: "主账户" }]}
        onSharedScopeChange={patch => { scope = { ...scope, ...patch }; }}
        onOpenInReview={() => undefined}
      />,
    );
    const room = screen.getByRole("region", { name: "交易室范围" });
    expect(room).toHaveTextContent("实盘");
    expect(room).toHaveTextContent("4 个回合进入范围");
    await user.click(screen.getByRole("radio", { name: "模拟盘" }));
    scope = { ...scope, nature: "simulation", simulationRunId: "run-controlled" };
    rerender(
      <ReviewDashboard
        entries={[base, simulation]}
        sharedScope={scope}
        sharedAccountOptions={[{ id: "account-1", label: "主账户" }]}
        onSharedScopeChange={patch => { scope = { ...scope, ...patch }; }}
        onOpenInReview={() => undefined}
      />,
    );
    expect(screen.getByRole("region", { name: "交易室范围" })).toHaveTextContent("模拟盘");
    expect(screen.getByRole("region", { name: "交易室范围" })).toHaveTextContent("4 个回合进入范围");
  });

  it("keeps account, symbol and review filters inside the collapsed advanced scope", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<ReviewDashboard entries={dashboardEntries()} onOpenInReview={() => undefined} />);
    const room = screen.getByRole("region", { name: "交易室范围" });
    await user.click(within(room).getByRole("tab", { name: "今年至今" }));
    await user.click(within(room).getByRole("radio", { name: "主账户" }));
    expect(room).toHaveTextContent("1 项已启用");
    await user.type(within(room).getByRole("searchbox", { name: "交易室标的筛选" }), "不存在");
    expect(room).toHaveTextContent("当前交易室范围没有回合");
    await user.click(within(room).getByRole("button", { name: "清除附加筛选" }));
    expect(radio(room, "实盘")).toBeChecked();
    expect(within(room).getByRole("group", { name: "交易室市场分类筛选" }).querySelector('input[value="all"]')).toBeChecked();
    expect(within(room).getByRole("tab", { name: "今年至今" })).toHaveAttribute("aria-selected", "true");
    expect(room).toHaveTextContent("4 个回合进入范围");
  });

  it("keeps the last valid scope when a custom date draft is invalid", async () => {
    render(<ReviewDashboard entries={dashboardEntries()} onOpenInReview={() => undefined} />);
    const room = screen.getByRole("region", { name: "交易室范围" });
    fireEvent.change(within(room).getByLabelText("交易室起始日期"), { target: { value: "2026-11-01" } });
    fireEvent.blur(within(room).getByLabelText("交易室起始日期"));
    expect(room).toHaveTextContent("自定义期间起止日期无效");
    expect(room).toHaveTextContent("2026-01-01 至 2026-10-15");
    expect(room).toHaveTextContent("4 个回合进入范围");
  });

  it("stages a custom period and restores the applied range on cancel", async () => {
    render(<ReviewDashboard entries={dashboardEntries()} onOpenInReview={() => undefined} />);
    const room = screen.getByRole("region", { name: "交易室范围" });
    fireEvent.change(within(room).getByLabelText("交易室起始日期"), { target: { value: "2026-10-05" } });
    fireEvent.change(within(room).getByLabelText("交易室结束日期"), { target: { value: "2026-10-10" } });
    expect(room).toHaveTextContent("2026-01-01 至 2026-10-15");
    expect(room).toHaveTextContent("编辑中");
  });

  it("rejects a future custom end date without changing the applied range", async () => {
    render(<ReviewDashboard entries={dashboardEntries()} onOpenInReview={() => undefined} />);
    const room = screen.getByRole("region", { name: "交易室范围" });
    fireEvent.change(within(room).getByLabelText("交易室结束日期"), { target: { value: "2026-10-16" } });
    fireEvent.blur(within(room).getByLabelText("交易室结束日期"));
    expect(room).toHaveTextContent("自定义期间起止日期无效");
    expect(room).toHaveTextContent("2026-01-01 至 2026-10-15");
  });

  it("keeps the applied range when no scoped closed month can be found", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<ReviewDashboard entries={dashboardEntries()} onOpenInReview={() => undefined} />);
    const room = screen.getByRole("region", { name: "交易室范围" });
    await user.click(within(room).getByText("更多筛选"));
    await user.type(within(room).getByRole("searchbox", { name: "交易室标的筛选" }), "不存在");
    await user.click(within(room).getByRole("tab", { name: "全部" }));
    expect(room).toHaveTextContent("当前筛选没有可用的已平仓回合");
    expect(room).toHaveTextContent("2026-01-01 至 2026-10-15");
  });

  it("shows active scope filters as individually removable chips", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<ReviewDashboard entries={dashboardEntries()} onOpenInReview={() => undefined} />);
    const room = screen.getByRole("region", { name: "交易室范围" });
    await user.click(within(room).getByRole("radio", { name: "主账户" }));
    expect(within(room).getByRole("list", { name: "已启用交易室筛选" })).toHaveTextContent("账户：主账户");
    await user.click(within(room).getByRole("button", { name: "移除账户筛选" }));
    expect(within(room).queryByRole("list", { name: "已启用交易室筛选" })).not.toBeInTheDocument();
  });

  it("shows and removes the active asset type filter", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<ReviewDashboard entries={dashboardEntries()} onOpenInReview={() => undefined} />);
    const room = screen.getByRole("region", { name: "交易室范围" });
    await user.click(within(room).getByRole("radio", { name: "ETF" }));
    const chips = within(room).getByRole("list", { name: "已启用交易室筛选" });
    expect(chips).toHaveTextContent("资产类型：ETF");
    await user.click(within(chips).getByRole("button", { name: "移除资产类型筛选" }));
    expect(within(room).queryByRole("list", { name: "已启用交易室筛选" })).not.toBeInTheDocument();
  });

  it("keeps quality dimensions scoped and visible beside the summary", () => {
    const onQualityModelChange = vi.fn();
    render(
      <ReviewDashboard
        entries={dashboardEntries()}
        qualityInput={{}}
        onQualityModelChange={onQualityModelChange}
        onOpenInReview={() => undefined}
      />,
    );
    expect(screen.queryByRole("region", { name: "数据质量摘要" })).not.toBeInTheDocument();
    expect(onQualityModelChange).toHaveBeenCalled();
  });

  it("opens a calendar episode using the unified room rows and compatible callback", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onOpenInReview = vi.fn();
    render(<ReviewDashboard entries={dashboardEntries()} instrumentMetadata={new Map([[shanghai.id, metadata(shanghai, "stock")]])} onOpenInReview={onOpenInReview} />);
    const performance = screen.getByRole("region", { name: "业绩趋势与日历" });
    await user.click(within(performance).getByRole("button", { name: "日历" }));
    expect(within(performance).getByRole("heading", { name: "已平仓净盈亏日历" })).toBeInTheDocument();
  });

  it("distinguishes empty data from an empty scoped period", () => {
    const { rerender } = render(<ReviewDashboard entries={[]} onOpenInReview={() => undefined} />);
    expect(screen.getByRole("region", { name: "交易室范围" })).toHaveTextContent("导入交易后查看我的交易室");
    rerender(<ReviewDashboard entries={dashboardEntries(shanghai, "2026-09")} onOpenInReview={() => undefined} />);
    expect(screen.getByRole("region", { name: "交易室范围" })).toHaveTextContent("可信已平仓回合");
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
    expect(within(screen.getByRole("region", { name: "业绩趋势与日历" })).getByRole("heading", { name: "已平仓净盈亏日历" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "日历日期详情" })).not.toBeInTheDocument();
  });

  it("does not open the custom editor after calendar period drilldown", async () => {
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
    expect(within(room).getByLabelText("交易室起始日期")).toBeInTheDocument();
    expect(within(room).getByLabelText("交易室结束日期")).toBeInTheDocument();
  });

  it("keeps diagnostics and principal configuration out of the homepage", async () => {
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
    expect(screen.queryByTestId("room-quality-metrics")).not.toBeInTheDocument();
    expect(onOpenDataManagement).not.toHaveBeenCalled();
  });
  it("integrates collapsed return and quality details without expanding the homepage", () => {
    render(
      <ReviewDashboard
        entries={dashboardEntries()}
        qualityInput={{}}
        principalEnabled
        onOpenDataManagement={() => undefined}
        onOpenInReview={() => undefined}
      />,
    );
    expect(screen.queryByTestId("room-return-details")).not.toBeInTheDocument();
    expect(screen.queryByTestId("room-quality-metrics")).not.toBeInTheDocument();
  });

});
