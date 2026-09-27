import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildInstrumentTradeSummaries } from "../../lib/trades/instruments";
import { buildTradeLibraryEntries, type TradeLibraryEntry } from "../../lib/trades/library";
import type { Instrument, TradeExecution } from "../../lib/trades/types";
import { ReviewDashboard } from "./review-dashboard";
import * as portfolioModule from "../../lib/reviews/trading-room-portfolio";
import * as historyModule from "../../lib/reviews/trading-room-history";
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

function revealDateEditor(input: HTMLElement): HTMLElement {
  const details = input.closest("details");
  if (details && !details.open) fireEvent.click(details.querySelector("summary")!);
  return input;
}

async function openRoomFilters(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.click(screen.getByRole("button", { name: /^筛选/ }));
}

function openRoomFiltersImmediately(): void {
  fireEvent.click(screen.getByRole("button", { name: /^筛选/ }));
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

describe("ReviewDashboard", () => {
  it("shows page-wide identity with YTD default and expandable custom dates", () => {
    render(<ReviewDashboard entries={dashboardEntries()} onOpenInReview={() => undefined} />);
    const room = screen.getByRole("region", { name: "我的交易室" });
    expect(within(room).getByRole("button", { name: "实盘" })).toHaveAttribute("aria-pressed", "true");
    expect(within(room).getByRole("button", { name: "模拟盘" })).toHaveAttribute("aria-pressed", "false");
    expect(within(room).getByRole("combobox", { name: "报告计价" })).toHaveValue("original");
    expect(within(room).getByRole("combobox", { name: "报告计价" })).not.toHaveValue("CNY");
    expect(within(room).getByRole("tab", { name: "今年至今" })).toHaveAttribute("aria-selected", "true");
    expect(within(room).getByLabelText("交易室起始日期")).not.toBeVisible();
    fireEvent.click(screen.getByText("自定义统计日期"));
    expect(within(room).getByLabelText("交易室起始日期")).toBeVisible();
    expect(within(room).getByLabelText("交易室结束日期")).toBeVisible();
    expect(within(room).queryByRole("tab", { name: "本月" })).not.toBeInTheDocument();
  });

  it("keeps simulation runs and live holdings isolated after changing nature", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const base = dashboardEntries()[0];
    const live = holdingDashboardEntry();
    const runA = copyEntry(base, { prefix: "run-a", tradeNature: "simulation", simulationRunId: "run-a" });
    const runB = copyEntry(base, { prefix: "run-b", tradeNature: "simulation", simulationRunId: "run-b" });
    render(<ReviewDashboard entries={[live, runA, runB]} onOpenInReview={() => undefined} />);
    const room = screen.getByRole("region", { name: "我的交易室" });
    await user.click(within(room).getByRole("button", { name: "模拟盘" }));
    await openRoomFilters(user);
    expect(within(room).getByRole("group", { name: "交易室模拟运行筛选" })).toBeInTheDocument();
    expect(within(room).getByRole("radio", { name: /模拟运行 · 1/ })).toBeInTheDocument();
    expect(within(room).getByRole("radio", { name: /模拟运行 · 2/ })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "当前持仓" })).not.toBeInTheDocument();
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

    expect(screen.getByRole("region", { name: "当前持仓" })).toHaveTextContent("暂无可用报价");
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

  it("starts with live, all categories and the year to date period", () => {
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
    expect(within(screen.getByRole("region", { name: "我的交易室" })).getByRole("button", { name: "实盘" })).toHaveAttribute("aria-pressed", "true");
    openRoomFiltersImmediately();
    expect(within(within(room).getByRole("group", { name: "交易室市场分类筛选" })).getByRole("radio", { name: "全部市场" })).toBeChecked();
    expect(room).toHaveTextContent("全部市场");
    expect(within(room).getByRole("tab", { name: "今年至今" })).toHaveAttribute("aria-selected", "true");
    expect(within(room).getByRole("tablist", { name: "交易室期间" })).toHaveTextContent("近3个自然月");
    expect(within(room).getByRole("region", { name: "历史交易与复盘" })).toBeInTheDocument();
    expect(room).not.toHaveTextContent("统一统计范围");
    expect(room).toHaveTextContent("未知资产类型");
    expect(room).toHaveTextContent("不纳入 A股 / 美股 / 港股合计");
    expect(room).toHaveTextContent("可信已平仓回合");
  });

  it("puts nature controls beside the scope heading and exposes a holdings focus action", () => {
    render(<ReviewDashboard entries={dashboardEntries()} onOpenInReview={() => undefined} />);

    const scope = screen.getByRole("region", { name: "交易室范围" });
    expect(within(screen.getByRole("region", { name: "我的交易室" })).getByRole("button", { name: "实盘" })).toHaveAttribute("aria-pressed", "true");
    expect(within(screen.getByRole("region", { name: "我的交易室" })).getByRole("button", { name: "模拟盘" })).toHaveAttribute("aria-pressed", "false");
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
    openRoomFiltersImmediately();
    const category = within(within(scope).getByRole("group", { name: "交易室市场分类筛选" })).getByRole("radio", { name: "全部市场" });
    expect(category).toBeChecked();
    expect(within(scope).queryByRole("radio", { name: "未知资产类型" })).not.toBeInTheDocument();
    expect(within(scope).getByRole("radio", { name: "全部资产" })).toBeChecked();
    expect(scope).toHaveTextContent("未知资产类型");
  });

  it("opens, applies, cancels and validates a custom period in place", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<ReviewDashboard entries={dashboardEntries()} onOpenInReview={() => undefined} />);

    const scope = screen.getByRole("region", { name: "交易室范围" });
    fireEvent.click(screen.getByText("自定义统计日期"));
    expect(within(scope).getByLabelText("交易室起始日期")).toBeVisible();
    expect(within(scope).getByLabelText("交易室结束日期")).toBeVisible();

    fireEvent.change(revealDateEditor(within(scope).getByLabelText("交易室起始日期")), { target: { value: "2026-10-05" } });
    fireEvent.change(revealDateEditor(within(scope).getByLabelText("交易室结束日期")), { target: { value: "2026-10-10" } });
    await user.click(within(scope).getByRole("button", { name: "应用期间" }));
    expect(scope).toHaveTextContent("2026-10-05 至 2026-10-10");

    fireEvent.change(revealDateEditor(within(scope).getByLabelText("交易室起始日期")), { target: { value: "2026-11-01" } });
    expect(scope).toHaveTextContent("2026-10-05 至 2026-10-10");

    fireEvent.change(revealDateEditor(within(scope).getByLabelText("交易室结束日期")), { target: { value: "2026-10-01" } });
    await user.click(within(scope).getByRole("button", { name: "应用期间" }));
    expect(scope).toHaveTextContent("自定义期间起止日期无效");
    expect(scope).toHaveTextContent("2026-10-05 至 2026-10-10");

    await user.click(within(scope).getByRole("tab", { name: "今年至今" }));
    expect(within(scope).getByLabelText("交易室起始日期")).toBeInTheDocument();
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
    await openRoomFilters(user);
    await user.click(within(room).getByRole("tab", { name: "近3个自然月" }));
    expect(room).toHaveTextContent("2026-08-01 至 2026-10-15");
    expect(within(room).getByRole("heading", { name: /^盈亏日历(?:\s|$)/ })).toBeInTheDocument();
    await user.click(within(within(room).getByRole("group", { name: "交易室市场分类筛选" })).getByRole("radio", { name: "美股" }));
    expect(room).toHaveTextContent("4 个回合进入范围");
    expect(room).toHaveTextContent("可信已平仓回合");
    expect(within(room).getByRole("heading", { name: /^盈亏日历(?:\s|$)/ })).toBeInTheDocument();
  });

  it("requires a simulation run and never combines runs", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const base = dashboardEntries()[0];
    const runA = copyEntry(base, { prefix: "run-a", tradeNature: "simulation", simulationRunId: "run-a" });
    const runB = copyEntry(base, { prefix: "run-b", tradeNature: "simulation", simulationRunId: "run-b" });
    render(<ReviewDashboard entries={[runA, runB]} onOpenInReview={() => undefined} />);
    const room = screen.getByRole("region", { name: "交易室范围" });
    await user.click(within(screen.getByRole("region", { name: "我的交易室" })).getByRole("button", { name: "模拟盘" }));
    await openRoomFilters(user);
    expect(within(screen.getByRole("region", { name: "我的交易室" })).getByRole("button", { name: "模拟盘" })).toHaveAttribute("aria-pressed", "true");
    expect(room).toHaveTextContent("请选择一个模拟运行");
    const runSelect = within(room).getByRole("radio", { name: /模拟运行 · 1/ });
    await user.click(runSelect);
    expect(room).toHaveTextContent("4 个回合进入范围");
    expect(room).not.toHaveTextContent("run-b");
    await user.click(within(screen.getByRole("region", { name: "我的交易室" })).getByRole("button", { name: "实盘" }));
    await user.click(within(screen.getByRole("region", { name: "我的交易室" })).getByRole("button", { name: "模拟盘" }));
    expect(within(room).getByRole("radio", { name: "请选择运行" })).toBeChecked();
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
    expect(screen.getByRole("button", { name: "实盘" })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "模拟盘" }));
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
    expect(screen.getByRole("button", { name: "模拟盘" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("combobox", { name: "模拟运行" })).toHaveValue("run-controlled");
  });

  it("keeps the last valid scope when a custom date draft is invalid", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<ReviewDashboard entries={dashboardEntries()} onOpenInReview={() => undefined} />);
    const room = screen.getByRole("region", { name: "交易室范围" });
    await openRoomFilters(user);
    fireEvent.change(revealDateEditor(within(room).getByLabelText("交易室起始日期")), { target: { value: "2026-11-01" } });
    await user.click(within(room).getByRole("button", { name: "应用期间" }));
    expect(room).toHaveTextContent("自定义期间起止日期无效");
    expect(room).toHaveTextContent("2026-01-01 至 2026-10-15");
    expect(room).toHaveTextContent("4 个回合进入范围");
  });

  it("stages a custom period and restores the applied range on cancel", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<ReviewDashboard entries={dashboardEntries()} onOpenInReview={() => undefined} />);
    const room = screen.getByRole("region", { name: "交易室范围" });
    fireEvent.change(revealDateEditor(within(room).getByLabelText("交易室起始日期")), { target: { value: "2026-10-05" } });
    fireEvent.change(revealDateEditor(within(room).getByLabelText("交易室结束日期")), { target: { value: "2026-10-10" } });
    expect(room).toHaveTextContent("2026-01-01 至 2026-10-15");
    await user.click(within(room).getByRole("tab", { name: "今年至今" }));
    expect(room).toHaveTextContent("2026-01-01 至 2026-10-15");
    expect(within(room).getByLabelText("交易室起始日期")).toBeInTheDocument();
  });

  it("rejects a future custom end date without changing the applied range", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<ReviewDashboard entries={dashboardEntries()} onOpenInReview={() => undefined} />);
    const room = screen.getByRole("region", { name: "交易室范围" });
    fireEvent.change(revealDateEditor(within(room).getByLabelText("交易室结束日期")), { target: { value: "2026-10-16" } });
    await user.click(within(room).getByRole("button", { name: "应用期间" }));
    expect(room).toHaveTextContent("自定义期间起止日期无效");
    expect(room).toHaveTextContent("2026-10-01 至 2026-10-15");
  });

  it("keeps the applied range when no scoped closed month can be found", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<ReviewDashboard entries={dashboardEntries()} onOpenInReview={() => undefined} />);
    const room = screen.getByRole("region", { name: "交易室范围" });
    await openRoomFilters(user);
    await user.click(within(room).getByText("更多筛选"));
    await user.type(within(room).getByRole("searchbox", { name: "交易室标的筛选" }), "不存在");
    await user.click(within(room).getByRole("tab", { name: "全部" }));
    expect(room).toHaveTextContent("当前筛选没有可用的已平仓回合");
    expect(room).toHaveTextContent("2026-01-01 至 2026-10-15");
  });

  it("shows and removes the active asset type filter", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<ReviewDashboard entries={dashboardEntries()} onOpenInReview={() => undefined} />);
    const room = screen.getByRole("region", { name: "交易室范围" });
    await openRoomFilters(user);
    await user.click(within(room).getByText("更多筛选"));
    await user.click(within(room).getByRole("radio", { name: "ETF" }));
    const chips = within(room).getByRole("list", { name: "已启用交易室筛选" });
    expect(chips).toHaveTextContent("资产类型：ETF");
    await user.click(within(chips).getByRole("button", { name: "移除资产类型筛选" }));
    expect(within(room).queryByRole("list", { name: "已启用交易室筛选" })).not.toBeInTheDocument();
  });

  it("distinguishes empty data from an empty scoped period", () => {
    const { rerender } = render(<ReviewDashboard entries={[]} onOpenInReview={() => undefined} />);
    expect(screen.getByRole("region", { name: "交易室范围" })).toHaveTextContent("导入交易后查看我的交易室");
    rerender(<ReviewDashboard entries={dashboardEntries(shanghai, "2025-09")} onOpenInReview={() => undefined} />);
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
    await user.click(within(performance).getByRole("button", { name: "全部年份" }));
    expect(within(performance).getByRole("button", { name: "全部年份" })).toHaveAttribute("aria-pressed", "true");
    await user.click(within(screen.getByRole("region", { name: "交易室范围" })).getByRole("tab", { name: "今年至今" }));
    expect(screen.getByRole("region", { name: "交易室范围" })).toHaveTextContent("2026-01-01 至 2026-10-15");
    expect(within(screen.getByRole("region", { name: "业绩趋势与日历" })).getByRole("heading", { name: /^盈亏日历(?:\s|$)/ })).toBeInTheDocument();
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
    await user.click(within(performance).getByRole("button", { name: "年" }));
    await user.click(within(within(performance).getByRole("region", { name: "盈亏日历" })).getByRole("button", { name: /2026年8月/ }));

    const room = screen.getByRole("region", { name: "交易室范围" });
    expect(room).toHaveTextContent("2026-08-01 至 2026-08-31");
    expect(within(room).getByLabelText("交易室起始日期")).toBeInTheDocument();
    expect(within(room).getByLabelText("交易室结束日期")).toBeInTheDocument();
  });

  it("keeps diagnostics and return detail modules out of the homepage", () => {
    render(
      <ReviewDashboard
        entries={dashboardEntries()}
        qualityInput={{}}
        onOpenInReview={() => undefined}
      />,
    );
    expect(screen.queryByRole("region", { name: "数据质量摘要" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("room-quality-metrics")).not.toBeInTheDocument();
    expect(screen.queryByTestId("room-return-details")).not.toBeInTheDocument();
  });

  it("opens the ordinary closed-history library with the complete room snapshot", () => {
    const onViewHistoryLibrary = vi.fn();
    render(
      <ReviewDashboard
        entries={dashboardEntries()}
        onOpenInReview={() => undefined}
        onViewHistoryLibrary={onViewHistoryLibrary}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /进入交易库/ }));

    expect(onViewHistoryLibrary).toHaveBeenCalledWith(expect.objectContaining({
      reviewStatus: "all",
      positionStatus: "closed",
      closeDateFrom: expect.any(String),
      closeDateTo: expect.any(String),
      sourceSnapshot: expect.objectContaining({
        sharedScope: expect.objectContaining({ nature: "live" }),
        roomScope: expect.objectContaining({
          assetCategory: "all",
          accountIds: [],
          instrumentIds: [],
          markets: [],
          currencies: [],
          reviewStatuses: [],
        }),
      }),
    }));
  });

});

it("keeps holding observation and closed performance periods independent in two ordered workspaces", () => {
  render(<ReviewDashboard entries={dashboardEntries()} onOpenInReview={vi.fn()} referenceCapitalEnabled={false} />);
  const holdings = screen.getByRole("region", { name: "持仓照看" });
  const history = screen.getByRole("region", { name: "历史交易与复盘" });
  expect(holdings.compareDocumentPosition(history) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  fireEvent.click(within(holdings).getByRole("tab", { name: "持仓历史：近3个自然月" }));
  expect(within(history).getByRole("tab", { name: "今年至今", selected: true })).toBeInTheDocument();
  fireEvent.change(revealDateEditor(within(history).getByLabelText("交易室起始日期")), { target: { value: "2026-10-01" } });
  fireEvent.click(within(history).getByRole("button", { name: "应用期间" }));
  expect(within(holdings).getByRole("tab", { name: "持仓历史：近3个自然月", selected: true })).toBeInTheDocument();
  expect(within(holdings).getByLabelText("持仓历史起始日期")).toHaveValue("2026-08-01");
});

it("reactively bounds all observation history by selected account, nature/run and refreshed entries", () => {
  const accountA = dashboardEntries(shanghai, "2026-09", "a")[0];
  const accountB = dashboardEntries(shanghai, "2023-02", "b")[0];
  accountB.executions.forEach(execution => { execution.accountId = "account-2"; execution.accountLabel = "第二账户"; });
  accountB.episodes.forEach(item => { item.episode.accountId = "account-2"; });
  const run = copyEntry(dashboardEntries(shanghai, "2022-03", "sim")[0], { prefix: "sim", tradeNature: "simulation", simulationRunId: "run-one" });
  const scope: SharedScope = { nature: "live", accountIds: ["account-1"], simulationRunId: null, reportCurrency: "original" };
  const props = { onOpenInReview: vi.fn(), referenceCapitalEnabled: false };
  const view = render(<ReviewDashboard {...props} entries={[accountA, accountB, run]} sharedScope={scope} />);
  fireEvent.click(screen.getByRole("tab", { name: "持仓历史：全部" }));
  expect(screen.getByLabelText("持仓历史起始日期")).toHaveValue("2026-09-02");
  view.rerender(<ReviewDashboard {...props} entries={[accountA, accountB, run]} sharedScope={{ ...scope, accountIds: ["account-2"] }} />);
  expect(screen.getByLabelText("持仓历史起始日期")).toHaveValue("2023-02-02");
  view.rerender(<ReviewDashboard {...props} entries={[accountA, accountB, run]} sharedScope={{ ...scope, nature: "simulation", simulationRunId: "run-one" }} />);
  expect(screen.getByLabelText("持仓历史起始日期")).toHaveValue("2022-03-02");
  const earlier = dashboardEntries(shanghai, "2021-04", "earlier")[0];
  view.rerender(<ReviewDashboard {...props} entries={[accountA, accountB, run, earlier]} sharedScope={scope} />);
  expect(screen.getByLabelText("持仓历史起始日期")).toHaveValue("2021-04-02");
  expect(screen.getByRole("tab", { name: "持仓历史：全部" })).toHaveAttribute("aria-selected", "true");
});

it("uses validated source trading dates and visible matching opening evidence for all observation history", () => {
  const holding = holdingDashboardEntry();
  const execution = holding.executions[0];
  execution.executedAt = "2026-09-25T00:30:00Z";
  execution.source.tradingDate = "2026-09-24";
  holding.episodes[0].episode.startedAt = execution.executedAt;
  const props = { onOpenInReview: vi.fn(), referenceCapitalEnabled: false, holdingsAsOf: "2026-09-25" };
  const view = render(<ReviewDashboard {...props} entries={[holding]} />);
  fireEvent.click(screen.getByRole("tab", { name: "持仓历史：全部" }));
  expect(screen.getByLabelText("持仓历史起始日期")).toHaveValue("2026-09-24");
  execution.source.tradingDate = "2026-02-30";
  execution.source.marketCalendarDate = "2026-09-23";
  view.rerender(<ReviewDashboard {...props} entries={[{ ...holding }]} />);
  expect(screen.getByLabelText("持仓历史起始日期")).toHaveValue("2026-09-23");
  holding.episodes[0].episode.initialPosition = { accountId: "account-1", symbol: "TEST", market: "US", date: "2026-09-01", phase: "opening", quantity: "2", cost: "10", source: [] };
  view.rerender(<ReviewDashboard {...props} entries={[{ ...holding }]} />);
  expect(screen.getByLabelText("持仓历史起始日期")).toHaveValue("2026-09-01");
  holding.episodes[0].episode.initialPosition.date = "2026-09-30";
  view.rerender(<ReviewDashboard {...props} entries={[{ ...holding }]} />);
  expect(screen.getByLabelText("持仓历史起始日期")).toHaveValue("2026-09-23");
  holding.episodes[0].episode.positionEvents = [{ id: "monthly-evidence", accountId: "account-1", symbol: "TEST", market: "US", kind: "corporate-action", date: "2026-08", description: "月级公司行动", source: [] }];
  view.rerender(<ReviewDashboard {...props} entries={[{ ...holding }]} />);
  expect(screen.getByLabelText("持仓历史起始日期")).toHaveValue("2026-08-31");
  holding.episodes[0].episode.positionEvents[0].date = "2026-09";
  view.rerender(<ReviewDashboard {...props} entries={[{ ...holding }]} />);
  expect(screen.getByLabelText("持仓历史起始日期")).toHaveValue("2026-09-23");
});

it("shows the model current date across Shanghai midnight", () => {
  render(<ReviewDashboard entries={[]} onOpenInReview={vi.fn()} referenceCapitalEnabled={false} holdingsAsOf="2026-09-24T20:00:00Z" />);
  expect(screen.getByRole("region", { name: "持仓照看" })).toHaveTextContent("当前时点 · 2026-09-25");
  expect(screen.getByRole("region", { name: "当前持仓" })).toHaveAttribute("data-current-date", "2026-09-25");
});

it("assembles the B2 current portfolio, allocation, history and pending work without observing old dates changing current KPI", () => {
  const holding = holdingDashboardEntry();
  render(<ReviewDashboard entries={[holding, ...dashboardEntries()]} onOpenInReview={vi.fn()} referenceCapitalEnabled={false} holdingsAsOf="2026-10-15" holdingsQuotesByInstrument={{ [holding.instrument.id]: { price: "15", currency: "USD", quoteDate: "2026-10-15", fetchedAt: null, provider: "test", freshness: "current" } }} />);
  const current = screen.getByRole("region", { name: "当前持仓概览" });
  expect(current).toHaveTextContent("持仓市值USD 30.00");
  expect(current).toHaveTextContent("持仓标的数1");
  expect(screen.getByRole("region", { name: "当前持仓资产分布" })).toBeInTheDocument();
  expect(screen.getByRole("region", { name: "历史持仓估值" })).toBeInTheDocument();
  expect(screen.getByRole("region", { name: "盈亏贡献分解" })).toBeInTheDocument();
  expect(screen.getByRole("group", { name: "日历层级" })).toBeInTheDocument();
  expect(screen.getByRole("region", { name: "待复盘的已完成交易" })).toHaveTextContent("（4）");
  fireEvent.change(revealDateEditor(screen.getByLabelText("持仓历史起始日期")), { target: { value: "2026-01-01" } });
  fireEvent.change(revealDateEditor(screen.getByLabelText("持仓历史结束日期")), { target: { value: "2026-01-03" } });
  fireEvent.click(screen.getByRole("button", { name: "应用观察期间" }));
  expect(current).toHaveTextContent("持仓市值USD 30.00");
  expect(screen.getByLabelText("交易室结束日期")).toHaveValue("2026-10-15");
});

it("uses one selected simulation run and one currency snapshot for all current modules", () => {
  const runA = copyEntry(holdingDashboardEntry(), { prefix: "holding-a", tradeNature: "simulation", simulationRunId: "run-a" });
  const runB = copyEntry(holdingDashboardEntry(), { prefix: "holding-b", tradeNature: "simulation", simulationRunId: "run-b" });
  runB.executions[0].quantity = "7";
  runB.episodes[0].episode.remainingQuantity = "7";
  const shared: SharedScope = { nature: "simulation", simulationRunId: null, accountIds: [], reportCurrency: "original" };
  const props = { entries: [runA, runB], onOpenInReview: vi.fn(), referenceCapitalEnabled: false, holdingsAsOf: "2026-10-15", holdingsQuotesByInstrument: { "US:TEST": { price: "15", currency: "USD", quoteDate: "2026-10-15", fetchedAt: null, provider: "test", freshness: "current" as const } }, fxSnapshot: { id: "fx", baseCurrency: "CNY" as const, asOf: "2026-10-15", source: "test", status: "complete" as const, rates: { "USD/CNY": "7" } } };
  const view = render(<ReviewDashboard {...props} sharedScope={shared} />);
  expect(screen.queryByRole("region", { name: "当前持仓概览" })).not.toBeInTheDocument();
  view.rerender(<ReviewDashboard {...props} sharedScope={{ ...shared, simulationRunId: "run-a" }} />);
  expect(screen.getByRole("region", { name: "当前持仓概览" })).toHaveTextContent("持仓市值USD 30.00");
  expect(screen.getByRole("region", { name: "当前持仓" })).toBeInTheDocument();
  view.rerender(<ReviewDashboard {...props} sharedScope={{ ...shared, simulationRunId: "run-a", reportCurrency: "CNY" }} />);
  expect(screen.getByRole("region", { name: "当前持仓概览" })).toHaveTextContent("持仓市值CNY 210.00");
  const allocation = screen.getByRole("region", { name: "当前持仓资产分布" });
  expect(allocation).toHaveTextContent("CNY 210.00");
  expect(allocation).toHaveTextContent("总市值");
});

it("does not rebuild holdings for shared-scope closed-period changes but rebuilds for a real identity change", () => {
  const portfolioSpy = vi.spyOn(portfolioModule, "buildCurrentPortfolio");
  const historySpy = vi.spyOn(historyModule, "buildHoldingsHistory");
  try {
    const entries = [...dashboardEntries(shanghai, "2026-09"), holdingDashboardEntry()];
    const shared: SharedScope = { nature: "live", accountIds: [], simulationRunId: null, reportCurrency: "original" };
    const props = { entries, onOpenInReview: vi.fn(), referenceCapitalEnabled: false, holdingsAsOf: "2026-10-15" };
    const view = render(<ReviewDashboard {...props} sharedScope={shared} />);
    portfolioSpy.mockClear(); historySpy.mockClear();
    fireEvent.click(screen.getByRole("tab", { name: "近3个自然月" }));
    expect(screen.getByLabelText("交易室起始日期")).toHaveValue("2026-08-01");
    expect(portfolioSpy).not.toHaveBeenCalled();
    expect(historySpy).not.toHaveBeenCalled();
    const calendar = screen.getByRole("region", { name: "盈亏日历" });
    fireEvent.click(within(calendar).getByRole("button", { name: "上一个月" }));
    expect(within(calendar).getByText("2026年9月")).toBeInTheDocument();
    // Calendar browsing is independent from the statistics period and must
    // not rebuild or rewrite the shared room scope.
    expect(screen.getByLabelText("交易室起始日期")).toHaveValue("2026-08-01");
    expect(portfolioSpy).not.toHaveBeenCalled();
    expect(historySpy).not.toHaveBeenCalled();
    view.rerender(<ReviewDashboard {...props} sharedScope={{ ...shared, accountIds: ["account-1"] }} />);
    expect(portfolioSpy).toHaveBeenCalledTimes(1);
    expect(historySpy).toHaveBeenCalledTimes(2);
    portfolioSpy.mockClear(); historySpy.mockClear();
    view.rerender(<ReviewDashboard {...props} sharedScope={{ ...shared, accountIds: ["account-1"] }} />);
    expect(portfolioSpy).not.toHaveBeenCalled();
    expect(historySpy).not.toHaveBeenCalled();
  } finally { portfolioSpy.mockRestore(); historySpy.mockRestore(); }
});
