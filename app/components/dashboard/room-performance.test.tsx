import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { findTradingRoomHistoryRange } from "../../lib/reviews/trading-room-calendar";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TradeLibraryEntry } from "../../lib/trades/library";
import type { Instrument } from "../../lib/trades/types";
import { buildRoomDateRange, createDefaultRoomScope, type RoomScope, type TradingRoomInstrumentMetadata } from "../../lib/reviews/trading-room-scope";
import { RoomPerformance } from "./room-performance";
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
function entry(date: string, pnl: string, overrides: { instrument?: Instrument; id?: string } = {}): TradeLibraryEntry {
  const instrument = overrides.instrument ?? { id: "CN-SH:600000", symbol: "600000", name: "上海测试", market: "CN-SH", currency: "CNY" };
  const buy = { id: `${overrides.id ?? instrument.id}:${date}:buy`, accountId: "account-1", accountLabel: "主账户", instrument, side: "buy" as const, executedAt: `${date}T01:00:00.000Z`, quantity: "1", price: "10", fee: "0", source: { platform: "fixture", row: 1, tradingDate: date } };
  const sell = { ...buy, id: `${overrides.id ?? instrument.id}:${date}:sell`, side: "sell" as const, executedAt: `${date}T02:00:00.000Z`, price: "11", source: { platform: "fixture", row: 2, tradingDate: date } };
  const episode = { id: `${overrides.id ?? instrument.id}:${date}`, accountId: "account-1", accountLabel: "主账户", instrument, tradeNature: "live" as const, direction: "long" as const, status: "closed" as const, startedAt: buy.executedAt, endedAt: sell.executedAt, openingQuantity: "1", remainingQuantity: "0", executions: [buy, sell] };
  return { groupId: `${instrument.id}:live`, tradeNature: "live", instrument, executions: [buy, sell], episodes: [{ episode, metrics: { buyCount: 1, sellCount: 1, boughtQuantity: "1", soldQuantity: "1", grossExposure: "10", fees: "0", realizedPnl: pnl, unrealizedPnl: "0", netPnl: pnl, returnPercent: pnl, holdingMilliseconds: 3600000 }, reviewStatus: "pending", confirmedTagIds: [], tagDictionaryVersion: 1, rMultiple: null }], accountCount: 1, tradeCount: 2, episodeCount: 1, firstTradeAt: buy.executedAt, lastTradeAt: sell.executedAt, status: "closed", netPnl: pnl, returnPercent: pnl, reviewedEpisodeCount: 0, confirmedTagIds: [], cumulativeR: null };
}
function scope(period = buildRoomDateRange("month", "2026-09-19")): RoomScope { return { ...createDefaultRoomScope("2026-09-19"), period }; }
function metadata(entries: readonly TradeLibraryEntry[]): ReadonlyMap<string, TradingRoomInstrumentMetadata> { return new Map(entries.map(value => [value.instrument.id, { market: value.instrument.market, symbol: value.instrument.symbol, assetType: "stock" }])); }
function renderRoom(entries: readonly TradeLibraryEntry[], period = buildRoomDateRange("month", "2026-09-19"), onScopeChange = vi.fn()) { render(<RoomPerformance entries={entries} scope={scope(period)} instrumentMetadata={metadata(entries)} onScopeChange={onScopeChange} onOpenInReview={vi.fn()} asOf="2026-09-19T08:00:00.000Z" />); return onScopeChange; }
function PerformanceScopeHarness({ entries, initialPeriod }: { entries: readonly TradeLibraryEntry[]; initialPeriod: RoomScope["period"] }) {
  const [period, setPeriod] = useState(initialPeriod);
  return (
    <>
      <button type="button" onClick={() => setPeriod(buildRoomDateRange("month", "2026-09-19"))}>外部本月</button>
      <button type="button" onClick={() => setPeriod(buildRoomDateRange("last-3-months", "2026-09-19"))}>外部近3月</button>
      <button type="button" onClick={() => setPeriod(buildRoomDateRange("ytd", "2026-09-19"))}>外部YTD</button>
      <RoomPerformance
        entries={entries}
        scope={scope(period)}
        instrumentMetadata={metadata(entries)}
        onScopeChange={change => setPeriod(change.period ?? period)}
        onOpenInReview={() => undefined}
        asOf="2026-09-19T08:00:00.000Z"
      />
    </>
  );
}

describe("RoomPerformance", () => {
  it("keeps the header slots mounted when switching between trend and calendar", async () => {
    const user = userEvent.setup();
    const value = entry("2026-09-02", "100");
    renderRoom([value]);
    const panel = screen.getByRole("region", { name: "业绩趋势与日历" });
    const heading = panel.querySelector("header");
    expect(heading).toBeInTheDocument();
    expect(heading?.querySelectorAll(":scope > *")).toHaveLength(3);
    expect(within(panel).getByRole("group", { name: "趋势分桶" })).toBeInTheDocument();
    await user.click(within(panel).getByRole("button", { name: "日历" }));
    expect(heading?.querySelectorAll(":scope > *")).toHaveLength(3);
    expect(within(panel).queryByRole("group", { name: "趋势分桶" })).not.toBeInTheDocument();
    expect(heading?.querySelector("[aria-hidden='true']")).toBeInTheDocument();
  });

  it("renders the chart boundary and latest period/cumulative details", () => { const value = entry("2026-09-02", "100"); renderRoom([value], buildRoomDateRange("custom", "2026-09-02", { startDate: "2026-09-02", endDate: "2026-09-02" })); expect(screen.getByLabelText("趋势币种图例")).toHaveTextContent("CNY"); const status = screen.getByRole("status", { name: "趋势点详情" }); expect(status).toHaveTextContent("本期 +¥100.00"); expect(status).toHaveTextContent("累计 +¥100.00"); });
  it("keeps negative period and positive cumulative amounts independently colored", () => { const gain = entry("2026-09-02", "100"); const loss = entry("2026-09-03", "-20", { id: "loss" }); renderRoom([gain, loss], buildRoomDateRange("custom", "2026-09-03", { startDate: "2026-09-02", endDate: "2026-09-03" })); const rows = [...screen.getByLabelText("趋势数据").querySelectorAll("div[aria-label]")]; expect(rows.at(-1)?.querySelector("[data-chart-role='trend-period-value']")).toHaveAttribute("data-tone", "negative"); expect(rows.at(-1)?.querySelector("[data-chart-role='trend-cumulative-value']")).toHaveAttribute("data-tone", "positive"); });
  it("keeps an unconverted single USD trend labeled USD", () => { const usd = entry("2026-09-02", "12", { instrument: { id: "US:TEST", symbol: "TEST", name: "美股测试", market: "US", currency: "USD" } }); renderRoom([usd]); expect(screen.getByLabelText("趋势币种图例")).toHaveTextContent("USD"); expect(screen.getByLabelText("趋势币种图例")).not.toHaveTextContent("CNY"); });
  it("keeps mixed original currencies isolated and exposes every period", () => { const usd = entry("2026-09-02", "100", { id: "usd", instrument: { id: "US:TEST", symbol: "TEST", name: "美股测试", market: "US", currency: "USD" } }); const hkd = entry("2026-09-03", "20", { id: "hkd", instrument: { id: "HK:TEST", symbol: "TEST", name: "港股测试", market: "HK", currency: "HKD" } }); renderRoom([usd, hkd], buildRoomDateRange("custom", "2026-09-03", { startDate: "2026-09-02", endDate: "2026-09-03" })); expect(screen.getByLabelText("趋势币种图例")).toHaveTextContent("USD"); expect(screen.getByLabelText("趋势币种图例")).toHaveTextContent("HKD"); fireEvent.click(screen.getByText("查看趋势数据")); expect(screen.getByLabelText("趋势数据").querySelectorAll(":scope > div[aria-label]").length).toBeGreaterThanOrEqual(2); });
  it("supports keyboard selection and all amount toggle", () => { const first = entry("2026-09-02", "100"); const second = entry("2026-09-03", "-20", { id: "second" }); renderRoom([first, second], buildRoomDateRange("custom", "2026-09-03", { startDate: "2026-09-02", endDate: "2026-09-03" })); const chart = screen.getByLabelText("累计盈亏趋势图"); fireEvent.keyDown(chart, { key: "ArrowLeft" }); expect(screen.getByRole("status", { name: "趋势点详情" })).toHaveTextContent("2026-09-02"); fireEvent.click(screen.getByRole("checkbox", { name: "显示全部金额" })); expect(screen.getByLabelText("全部金额标注")).toBeInTheDocument(); });
  it("resets selected date to a valid latest point when the scope changes", () => { const first = entry("2026-09-02", "100"); const second = entry("2026-09-03", "20", { id: "second" }); renderRoom([first, second], buildRoomDateRange("custom", "2026-09-03", { startDate: "2026-09-02", endDate: "2026-09-03" })); expect(screen.getByRole("status", { name: "趋势点详情" })).toHaveTextContent("2026-09-03"); });
  it("supports day, week, and month trend controls", () => { const value = entry("2026-09-02", "100"); renderRoom([value]); const tabs = within(screen.getByRole("group", { name: "趋势分桶" })); fireEvent.click(tabs.getByRole("button", { name: "周" })); fireEvent.click(tabs.getByRole("button", { name: "月" })); expect(screen.getByRole("status", { name: "趋势点详情" })).toBeInTheDocument(); });
  it("keeps empty calendar cells explicitly available rather than zero", () => { const value = entry("2026-09-02", "100"); render(<RoomPerformance entries={[value]} scope={scope()} instrumentMetadata={metadata([value])} onScopeChange={vi.fn()} onOpenInReview={vi.fn()} asOf="2026-09-19T08:00:00.000Z" />); fireEvent.click(screen.getByRole("button", { name: /日历/ })); expect(screen.getByRole("button", { name: /2026-09-19/ })).toHaveTextContent("暂无样本"); });
  it("supports embedded mode without a range summary", () => { const value = entry("2026-09-02", "100"); render(<RoomPerformance entries={[value]} scope={scope()} instrumentMetadata={metadata([value])} embedded onScopeChange={vi.fn()} onOpenInReview={vi.fn()} />); expect(screen.getByRole("region", { name: "业绩趋势与日历" }).querySelector('[aria-label="区间收益摘要"]')).not.toBeInTheDocument(); });
  it("changes natural week without changing scope", async () => { const user = userEvent.setup(); const value = entry("2026-09-02", "100"); const onScopeChange = renderRoom([value]); await user.click(screen.getByRole("button", { name: "周" })); expect(screen.getByRole("button", { name: "周" })).toHaveAttribute("aria-pressed", "true"); expect(onScopeChange).not.toHaveBeenCalled(); });
  it("clears calendar selection after an actual scope rerender", async () => { const user = userEvent.setup(); const value = entry("2026-09-02", "100"); const next = entry("2026-09-03", "200", { id: "next" }); const initial = scope(buildRoomDateRange("custom", "2026-09-02", { startDate: "2026-09-02", endDate: "2026-09-02" })); const { rerender } = render(<RoomPerformance entries={[value, next]} scope={initial} instrumentMetadata={metadata([value, next])} onScopeChange={vi.fn()} onOpenInReview={vi.fn()} asOf="2026-09-03T08:00:00.000Z" />); await user.click(screen.getByRole("button", { name: "日历" })); await user.click(screen.getByRole("button", { name: /2026-09-02，/ })); expect(screen.getByRole("region", { name: "日历日期详情" })).toBeInTheDocument(); rerender(<RoomPerformance entries={[value, next]} scope={scope(buildRoomDateRange("custom", "2026-09-03", { startDate: "2026-09-03", endDate: "2026-09-03" }))} instrumentMetadata={metadata([value, next])} onScopeChange={vi.fn()} onOpenInReview={vi.fn()} asOf="2026-09-03T08:00:00.000Z" />); expect(screen.queryByRole("region", { name: "日历日期详情" })).not.toBeInTheDocument(); });
});

describe("preserved calendar and review behavior", () => {
  it("separates the full-history selector from the current performance scope", async () => {
    const user = userEvent.setup();
    const entries = [entry("2025-09-02", "100", { id: "2025" }), entry("2026-09-02", "200", { id: "2026" })];
    const initialPeriod = buildRoomDateRange("month", "2026-09-19");
    expect(findTradingRoomHistoryRange(entries, scope(initialPeriod), { asOf: "2026-09-19T08:00:00.000Z", instrumentMetadata: metadata(entries) })).toEqual({ preset: "custom", startDate: "2025-09-02", endDate: "2026-09-02" });
    render(<PerformanceScopeHarness entries={entries} initialPeriod={initialPeriod} />);

    const panel = screen.getByRole("region", { name: "业绩趋势与日历" });
    await user.click(within(panel).getByRole("button", { name: "日历" }));
    await user.click(within(panel).getByRole("button", { name: "全部年份" }));
    expect(panel).toHaveTextContent("+¥300.00");
    expect(within(panel).getByRole("button", { name: /2025/ })).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: /2026/ })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "外部YTD" }));
    expect(panel).toHaveTextContent("+¥200.00");
    expect(within(panel).getByRole("button", { name: "所选期间·按月汇总" })).toHaveAttribute("aria-pressed", "false");
    expect(within(panel).getByRole("button", { name: /2026年9月/ })).toBeInTheDocument();
    expect(within(panel).queryByRole("button", { name: /2025/ })).not.toBeInTheDocument();

    await user.click(within(panel).getByRole("button", { name: "全部年份" }));
    expect(panel).toHaveTextContent("+¥300.00");
    expect(within(panel).getByRole("button", { name: /2025/ })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "外部本月" }));
    expect(within(panel).getByRole("button", { name: "月" })).toHaveAttribute("aria-pressed", "true");
    expect(within(panel).getByRole("button", { name: /2026-09-02/ })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "外部近3月" }));
    expect(within(panel).getByRole("button", { name: "所选期间·按月汇总" })).toHaveAttribute("aria-pressed", "false");
    expect(within(panel).getByRole("button", { name: /2026年7月/ })).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: /2026年9月/ })).toBeInTheDocument();

    expect(panel).toHaveTextContent("+¥200.00");
    expect(within(panel).queryByRole("button", { name: /2025/ })).not.toBeInTheDocument();
  });

  it("drills a day cell into exact review callback rows", async () => {
    const user = userEvent.setup();
    const value = entry("2026-09-02", "100");
    const onOpenInReview = vi.fn();
    render(
      <RoomPerformance
        entries={[value]}
        scope={scope()}
        instrumentMetadata={metadata([value])}
        onScopeChange={() => undefined}
        onOpenInReview={onOpenInReview}
        asOf="2026-09-19T08:00:00.000Z"
      />,
    );
    const panel = screen.getByRole("region", { name: "业绩趋势与日历" });
    await user.click(within(panel).getByRole("button", { name: "日历" }));
    const day = within(panel).getByRole("button", { name: /2026-09-02，\+¥100\.00/ });
    await user.click(day);
    const details = within(panel).getByRole("region", { name: "日历日期详情" });
    await user.click(within(details).getByRole("button", { name: "打开复盘" }));
    expect(onOpenInReview).toHaveBeenCalledWith("CN-SH:600000", expect.any(String), [expect.any(String)]);
  });

  it("shows unknown assets as unavailable in the day detail", async () => {
    const user = userEvent.setup();
    const value = entry("2026-09-02", "100", {
      instrument: { id: "OTHER:UNKNOWN", symbol: "UNKNOWN", name: "未知标的", market: "OTHER", currency: "CNY" },
    });
    render(
      <RoomPerformance
        entries={[value]}
        scope={scope()}
        onScopeChange={() => undefined}
        onOpenInReview={() => undefined}
        asOf="2026-09-19T08:00:00.000Z"
      />,
    );
    const panel = screen.getByRole("region", { name: "业绩趋势与日历" });
    await user.click(within(panel).getByRole("button", { name: "日历" }));
    await user.click(within(panel).getByRole("button", { name: /2026-09-02，不可用/ }));
    const details = within(panel).getByRole("region", { name: "日历日期详情" });
    expect(details).toHaveTextContent("不可用 · 未知资产类型");
    expect(details).not.toHaveTextContent("+¥100.00");
  });

  it("shows three natural month summaries before drilling into a selected month", async () => {
    const user = userEvent.setup();
    const values = [
      entry("2026-07-02", "10"),
      entry("2026-08-02", "20", { id: "aug" }),
      entry("2026-09-02", "30", { id: "sep" }),
    ];
    const onScopeChange = vi.fn();
    render(
      <RoomPerformance
        entries={values}
        scope={scope(buildRoomDateRange("last-3-months", "2026-09-19"))}
        instrumentMetadata={metadata(values)}
        onScopeChange={onScopeChange}
        onOpenInReview={() => undefined}
        asOf="2026-09-19T08:00:00.000Z"
      />,
    );
    const panel = screen.getByRole("region", { name: "业绩趋势与日历" });
    await user.click(within(panel).getByRole("button", { name: "日历" }));
    expect(within(panel).getByRole("button", { name: /2026年7月/ })).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: /2026年8月/ })).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: /2026年9月.*覆盖09-01至09-19/ })).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: /2026年7月/ })).toHaveTextContent("胜率 100%");
    await user.click(within(panel).getByRole("button", { name: /2026年7月/ }));
    expect(onScopeChange).toHaveBeenCalledWith({ period: { preset: "custom", startDate: "2026-07-01", endDate: "2026-07-31" } });
  });

  it("aligns daily cells under Monday through Sunday with leading blanks", async () => {
    const user = userEvent.setup();
    const value = entry("2026-09-01", "100");
    const { container } = render(<RoomPerformance entries={[value]} scope={scope()} instrumentMetadata={metadata([value])} onScopeChange={() => undefined} onOpenInReview={() => undefined} asOf="2026-09-19T08:00:00.000Z" />);
    const panel = screen.getByRole("region", { name: "业绩趋势与日历" });
    await user.click(within(panel).getByRole("button", { name: "日历" }));
    expect(panel).toHaveTextContent("周一");
    expect(panel).toHaveTextContent("周日");
    expect(container.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThanOrEqual(1);
  });

  it("marks cross-month calendar as a summary and returns from a drilled month", async () => {
    const user = userEvent.setup();
    const july = entry("2026-07-02", "10");
    const august = entry("2026-08-02", "20", { id: "aug" });
    const onScopeChange = vi.fn();
    render(<RoomPerformance entries={[july, august]} scope={scope(buildRoomDateRange("custom", "2026-08-02", { startDate: "2026-07-01", endDate: "2026-08-02" }))} instrumentMetadata={metadata([july, august])} onScopeChange={onScopeChange} onOpenInReview={() => undefined} asOf="2026-09-19T08:00:00.000Z" />);
    const panel = screen.getByRole("region", { name: "业绩趋势与日历" });
    await user.click(within(panel).getByRole("button", { name: "日历" }));
    expect(within(panel).getByRole("button", { name: "所选期间·按月汇总" })).toHaveAttribute("aria-pressed", "false");
    await user.click(within(panel).getByRole("button", { name: /2026年7月/ }));
    await user.click(within(panel).getByRole("button", { name: "返回上一范围" }));
    expect(onScopeChange).toHaveBeenLastCalledWith({ period: { preset: "custom", startDate: "2026-07-01", endDate: "2026-08-02" } });
  });

  it("keeps month cells readable instead of applying daily compact labels", async () => {
    const user = userEvent.setup();
    const first = entry("2026-07-02", "100");
    const second = entry("2026-08-02", "200", { id: "second" });
    render(
      <RoomPerformance
        entries={[first, second]}
        scope={scope(buildRoomDateRange("last-3-months", "2026-09-19"))}
        instrumentMetadata={metadata([first, second])}
        onScopeChange={() => undefined}
        onOpenInReview={() => undefined}
        asOf="2026-09-19T08:00:00.000Z"
      />,
    );

    const panel = screen.getByRole("region", { name: "业绩趋势与日历" });
    await user.click(within(panel).getByRole("button", { name: "日历" }));
    const grid = panel.querySelector("[class*='periodGrid']");
    expect(grid).toBeInTheDocument();
    expect(grid).toHaveTextContent("+¥100.00");
    expect(grid?.querySelector("[class*='cellValueShort']")).not.toBeInTheDocument();
  });

  it("uses compact daily cells and keeps complete amount, sample, and win-rate details below", async () => {
    const user = userEvent.setup();
    const value = entry("2026-02-25", "50360.44");
    render(
      <RoomPerformance
        entries={[value]}
        scope={scope(buildRoomDateRange("custom", "2026-02-25", { startDate: "2026-02-25", endDate: "2026-02-25" }))}
        instrumentMetadata={metadata([value])}
        onScopeChange={() => undefined}
        onOpenInReview={() => undefined}
        asOf="2026-02-25T08:00:00.000Z"
      />,
    );

    const panel = screen.getByRole("region", { name: "业绩趋势与日历" });
    await user.click(within(panel).getByRole("button", { name: "日历" }));
    const day = within(panel).getByRole("button", { name: /2026-02-25，\+¥50,360\.44/ });
    expect(within(day).getByText("盈")).toBeInTheDocument();
    await user.click(day);
    const details = within(panel).getByRole("region", { name: "日历日期详情" });
    expect(details).toHaveTextContent("期间金额");
    expect(details).toHaveTextContent("+¥50,360.44");
    expect(details).toHaveTextContent("可信样本");
    expect(details).toHaveTextContent("胜率");
  });


});
