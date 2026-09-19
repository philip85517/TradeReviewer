import { cleanup, render, screen, within } from "@testing-library/react";
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
  month = "2026-09",
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
    ["2026-09-02", "100"],
    ["2026-09-03", "300"],
    ["2026-09-04", "-100"],
    ["2026-09-05", "0"],
  ]);
  for (const item of entry.episodes) {
    const date = item.episode.endedAt?.slice(0, 10);
    const netPnl = date ? values.get(date) : undefined;
    if (netPnl !== undefined) {
      item.metrics = { ...item.metrics, netPnl, realizedPnl: netPnl, returnPercent: netPnl };
    }
  }
  entry.netPnl = "300";
  return entries;
}

function copyEntry(
  entry: TradeLibraryEntry,
  options: {
    prefix: string;
    accountId?: string;
    accountLabel?: string;
    instrument?: Instrument;
    tradeNature?: "live" | "simulation" | "unknown";
    simulationRunId?: string;
  },
): TradeLibraryEntry {
  const instrument = options.instrument ?? entry.instrument;
  const mapExecution = (execution: TradeExecution): TradeExecution => ({
    ...execution,
    id: `${options.prefix}:${execution.id}`,
    accountId: options.accountId ?? execution.accountId,
    accountLabel: options.accountLabel ?? execution.accountLabel,
    instrument,
    source: {
      ...execution.source,
      ...(options.tradeNature ? { tradeNature: options.tradeNature } : {}),
      ...(options.simulationRunId ? { simulationRunId: options.simulationRunId } : {}),
    },
  });
  const executionsById = new Map(entry.executions.map(execution => [execution.id, mapExecution(execution)]));
  const episodes = entry.episodes.map(item => ({
    ...item,
    episode: {
      ...item.episode,
      id: `${options.prefix}:${item.episode.id}`,
      accountId: options.accountId ?? item.episode.accountId,
      accountLabel: options.accountLabel ?? item.episode.accountLabel,
      instrument,
      ...(options.tradeNature ? { tradeNature: options.tradeNature } : {}),
      ...(options.simulationRunId ? { simulationRunId: options.simulationRunId } : {}),
      executions: item.episode.executions.map(execution => executionsById.get(execution.id)!),
    },
  }));
  return {
    ...entry,
    groupId: `${options.prefix}:${entry.groupId ?? entry.instrument.id}`,
    scopeKey: options.tradeNature === "simulation"
      ? `simulation:${options.simulationRunId}`
      : entry.scopeKey,
    tradeNature: options.tradeNature ?? entry.tradeNature,
    ...(options.simulationRunId ? { simulationRunId: options.simulationRunId } : {}),
    instrument,
    executions: [...executionsById.values()],
    episodes,
  };
}

function hongKongConnectEntry(entry: TradeLibraryEntry): TradeLibraryEntry {
  const instrument: Instrument = {
    ...entry.instrument,
    id: "HK:1810",
    symbol: "1810",
    name: "港股通测试",
    market: "HK",
    currency: "HKD",
  };
  const connectSource = (source: TradeExecution["source"]): TradeExecution["source"] => ({
    ...source,
    platform: "china-merchants",
    settlement: {
      currency: "CNY",
      quantity: "1",
      grossAmount: "10",
      netAmount: "-10",
      fees: {},
    },
  });
  const executions = entry.executions.map(execution => ({
    ...execution,
    instrument,
    source: connectSource(execution.source),
  }));
  return {
    ...entry,
    instrument,
    executions,
    episodes: entry.episodes.map(item => ({
      ...item,
      metrics: { ...item.metrics, pnlAvailable: false },
      episode: {
        ...item.episode,
        instrument,
        executions: item.episode.executions.map(execution => ({
          ...execution,
          instrument,
          source: connectSource(execution.source),
        })),
      },
    })),
  };
}

describe("ReviewDashboard", () => {
  it("shows the hand-calculated quality metrics and lets a calendar date open its episode", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onOpenInReview = vi.fn();
    render(<ReviewDashboard entries={dashboardEntries()} onOpenInReview={onOpenInReview} />);

    expect(screen.getByRole("heading", { name: "统计总览" })).toBeInTheDocument();
    const quality = screen.getByRole("region", { name: "收益质量" });
    expect(quality).toHaveTextContent("+¥300.00");
    expect(quality).toHaveTextContent("平均盈利");
    expect(quality).toHaveTextContent("盈亏比");
    expect(quality).toHaveTextContent("2.00");
    expect(quality).toHaveTextContent("利润因子");
    expect(quality).toHaveTextContent("4.00");
    expect(quality).toHaveTextContent("平均亏损额");
    expect(quality).not.toHaveTextContent("+¥100.00");

    expect(screen.getByRole("region", { name: "盈亏日历" })).toHaveTextContent("2026 年 9 月");
    const day = screen.getByRole("button", { name: /2026-09-03，\+¥300\.00/ });
    await user.click(day);
    const drilldown = screen.getByRole("region", { name: "日历下钻明细" });
    expect(drilldown).toHaveTextContent("2026-09-03");
    await user.click(within(drilldown).getByRole("button", { name: "打开复盘" }));
    expect(onOpenInReview).toHaveBeenCalledWith("CN-SH:600000", expect.any(String), expect.any(Array));

    await user.click(screen.getByRole("button", { name: "周汇总" }));
    const week = screen.getByRole("button", { name: /2026-08-31 至 2026-09-06/ });
    await user.click(week);
    expect(screen.getByRole("region", { name: "日历下钻明细" })).toHaveTextContent("2026-08-31 至 2026-09-06");
  });

  it("uses the shared A-share filter for Shanghai and Shenzhen entries", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const entries = dashboardEntries();
    const szInstrument = { ...entries[0].instrument, id: "CN-SZ:000001", symbol: "000001", name: "深圳测试", market: "CN-SZ" };
    const sz = {
      ...entries[0],
      instrument: szInstrument,
      executions: entries[0].executions.map(execution => ({ ...execution, instrument: szInstrument })),
      episodes: entries[0].episodes.map(item => ({
        ...item,
        episode: {
          ...item.episode,
          instrument: szInstrument,
          executions: item.episode.executions.map(execution => ({ ...execution, instrument: szInstrument })),
        },
      })),
    };
    render(<ReviewDashboard entries={[entries[0], sz]} onOpenInReview={() => undefined} />);

    await user.selectOptions(screen.getByRole("combobox", { name: "总览市场筛选" }), "a-share");
    expect(screen.getByText("8 个回合入选")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /A股 · 实盘 · CNY/ })).toBeInTheDocument();
  });

  it("labels the default group and keeps global counts separate from scoped quality", () => {
    const entries = dashboardEntries();
    const hkdInstrument = { ...entries[0].instrument, id: "HK:0700", symbol: "0700", name: "港股测试", market: "HK", currency: "HKD" };
    const hkd = {
      ...entries[0],
      instrument: hkdInstrument,
      executions: entries[0].executions.map(execution => ({ ...execution, instrument: hkdInstrument })),
      episodes: entries[0].episodes.map(item => ({
        ...item,
        episode: {
          ...item.episode,
          instrument: hkdInstrument,
          executions: item.episode.executions.map(execution => ({ ...execution, instrument: hkdInstrument })),
        },
      })),
    };
    render(<ReviewDashboard entries={[entries[0], hkd]} onOpenInReview={() => undefined} />);

    const progress = screen.getByRole("region", { name: "复盘进度" });
    expect(progress).toHaveTextContent("全局回合总数");
    expect(progress).toHaveTextContent("全局不可计算");
    expect(progress).toHaveTextContent("胜率见当前统计组");
    expect(progress).not.toHaveTextContent("全局胜率 不可用");
    expect(progress).not.toHaveTextContent("请选择统计组");
    expect(screen.getByRole("region", { name: "收益质量" })).toHaveTextContent("当前统计组");
    expect(screen.getByRole("region", { name: "收益质量" })).toHaveTextContent("胜率");
    expect(screen.getByRole("region", { name: "收益质量" })).toHaveTextContent("可信样本");
    expect(screen.getByRole("region", { name: "收益质量" })).toHaveTextContent("排除样本");
  });

  it("moves to a changed group's recent month and preserves a manual month within that group", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const hongKong: Instrument = {
      ...shanghai,
      id: "HK:0700",
      symbol: "0700",
      name: "港股测试",
      market: "HK",
      currency: "HKD",
    };
    render(
      <ReviewDashboard
        entries={[
          ...dashboardEntries(shanghai, "2026-09", "sh-"),
          ...dashboardEntries(hongKong, "2026-07", "hk-"),
        ]}
        onOpenInReview={() => undefined}
      />,
    );

    const groupSelect = screen.getByRole("combobox", { name: "总览统计范围" });
    const hkOption = Array.from(groupSelect.querySelectorAll("option"))
      .find(option => option.textContent?.includes("港股"));
    expect(hkOption).toBeDefined();
    await user.selectOptions(groupSelect, hkOption!.value);
    const calendar = screen.getByRole("region", { name: "盈亏日历" });
    expect(calendar).toHaveTextContent("2026 年 7 月");

    await user.click(screen.getByRole("button", { name: "上一个月" }));
    expect(calendar).toHaveTextContent("2026 年 6 月");
    const search = screen.getByRole("searchbox", { name: "搜索总览标的" });
    await user.type(search, "港股");
    expect(calendar).toHaveTextContent("2026 年 6 月");

    await user.clear(search);
    await user.selectOptions(screen.getByRole("combobox", { name: "总览市场筛选" }), "CN-SH");
    expect(calendar).toHaveTextContent("2026 年 9 月");
  });

  it("explains an empty global calendar and an empty manually selected month", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const emptyEntries = [] as TradeLibraryEntry[];
    render(<ReviewDashboard entries={emptyEntries} onOpenInReview={() => undefined} />);
    const emptyCalendar = screen.getByRole("region", { name: "盈亏日历" });
    expect(emptyCalendar).toHaveTextContent("全局暂无已平仓回合");

    cleanup();
    render(<ReviewDashboard entries={dashboardEntries()} onOpenInReview={() => undefined} />);
    const calendar = screen.getByRole("region", { name: "盈亏日历" });
    const search = screen.getByRole("searchbox", { name: "搜索总览标的" });
    await user.type(search, "不存在的标的");
    expect(calendar).toHaveTextContent("当前筛选没有已平仓回合");
    await user.clear(search);
    await user.click(screen.getByRole("button", { name: "上一个月" }));
    expect(calendar).toHaveTextContent("本月没有已平仓回合");
    await user.click(screen.getByRole("button", { name: "月汇总" }));
    expect(calendar).toHaveTextContent("可以跳转到最近有记录的月份");
  });

  it("uses the selected group's reason when all selected returns are unavailable", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const entries = [hongKongConnectEntry(dashboardEntries()[0])];
    render(<ReviewDashboard entries={entries} onOpenInReview={() => undefined} />);

    const market = screen.getByRole("combobox", { name: "总览市场筛选" });
    await user.selectOptions(market, "hk-connect");
    const quality = screen.getByRole("region", { name: "收益质量" });
    expect(quality).toHaveTextContent("没有可计算的已平仓回合");
    expect(quality).not.toHaveTextContent("跨组金额不可合并");
  });

  it("keeps duplicate account names safe and makes simulation runs readable", () => {
    const entries = dashboardEntries();
    const accountA = copyEntry(entries[0], {
      prefix: "account-4108",
      accountId: "account-4108",
      accountLabel: "主账户",
    });
    const accountB = copyEntry(entries[0], {
      prefix: "account-19742",
      accountId: "account-19742",
      accountLabel: "主账户",
    });
    const accountEntries = [accountA, accountB];
    const simulationA = copyEntry(entries[0], {
      prefix: "simulation-a",
      tradeNature: "simulation",
      simulationRunId: "account-4108",
    });
    const simulationB = copyEntry(entries[0], {
      prefix: "simulation-b",
      tradeNature: "simulation",
      simulationRunId: "account-19742",
    });

    const { rerender } = render(<ReviewDashboard entries={accountEntries} onOpenInReview={() => undefined} />);
    const accountSelect = screen.getByRole("combobox", { name: "总览账户筛选" });
    const accountOptions = Array.from(accountSelect.querySelectorAll("option"))
      .filter(option => option.value !== "all");
    expect(accountOptions).toHaveLength(2);
    expect(new Set(accountOptions.map(option => option.textContent)).size).toBe(2);
    expect(accountOptions.every(option => option.textContent?.includes("主账户"))).toBe(true);
    expect(accountOptions.every(option => option.textContent?.includes("#2T9G"))).toBe(true);
    expect(accountOptions.map(option => option.value).sort()).toEqual(["account-19742", "account-4108"]);
    expect(accountOptions.every(option => !option.textContent?.includes("account-4108"))).toBe(true);
    expect(accountOptions.every(option => !option.textContent?.includes("account-19742"))).toBe(true);

    rerender(<ReviewDashboard entries={[simulationA, simulationB]} onOpenInReview={() => undefined} />);
    const runSelect = screen.getByRole("combobox", { name: "总览模拟运行筛选" });
    const runOptions = Array.from(runSelect.querySelectorAll("option"))
      .filter(option => option.value !== "all");
    expect(runOptions.map(option => option.value)).toEqual(expect.arrayContaining([
      "account-4108",
      "account-19742",
    ]));
    expect(new Set(runOptions.map(option => option.textContent)).size).toBe(2);
    expect(runOptions.every(option => option.textContent?.includes("上海测试（600000）"))).toBe(true);
    expect(runOptions.every(option => option.textContent?.includes("#2T9G"))).toBe(true);
    expect(runOptions.every(option => !option.textContent?.includes("account-4108"))).toBe(true);
    expect(runOptions.every(option => !option.textContent?.includes("account-19742"))).toBe(true);

    const groupSelect = screen.getByRole("combobox", { name: "总览统计范围" });
    const groupOptions = Array.from(groupSelect.querySelectorAll("option"));
    expect(groupOptions).toHaveLength(2);
    expect(new Set(groupOptions.map(option => option.textContent)).size).toBe(2);
    expect(groupOptions.every(option => option.textContent?.includes("#2T9G"))).toBe(true);
    expect(within(screen.getByRole("region", { name: "统计分组" })).getAllByRole("button")).toHaveLength(2);
  });
});
