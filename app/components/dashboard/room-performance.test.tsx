import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { TradeLibraryEntry } from "../../lib/trades/library";
import type { Instrument } from "../../lib/trades/types";
import { buildRoomDateRange, createDefaultRoomScope, type RoomScope, type TradingRoomInstrumentMetadata } from "../../lib/reviews/trading-room-scope";
import { findTradingRoomHistoryRange } from "../../lib/reviews/trading-room-calendar";
import { RoomPerformance } from "./room-performance";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function entry(
  date: string,
  pnl: string,
  overrides: { instrument?: Instrument; id?: string } = {},
): TradeLibraryEntry {
  const instrument = overrides.instrument ?? {
    id: "CN-SH:600000",
    symbol: "600000",
    name: "上海测试",
    market: "CN-SH",
    currency: "CNY",
  };
  const buy = {
    id: `${overrides.id ?? instrument.id}:${date}:buy`,
    accountId: "account-1",
    accountLabel: "主账户",
    instrument,
    side: "buy" as const,
    executedAt: `${date}T01:00:00.000Z`,
    quantity: "1",
    price: "10",
    fee: "0",
    source: { platform: "fixture", row: 1, tradingDate: date },
  };
  const sell = {
    ...buy,
    id: `${overrides.id ?? instrument.id}:${date}:sell`,
    side: "sell" as const,
    executedAt: `${date}T02:00:00.000Z`,
    price: "11",
    source: { platform: "fixture", row: 2, tradingDate: date },
  };
  const episode = {
    id: `${overrides.id ?? instrument.id}:${date}`,
    accountId: "account-1",
    accountLabel: "主账户",
    instrument,
    tradeNature: "live" as const,
    direction: "long" as const,
    status: "closed" as const,
    startedAt: buy.executedAt,
    endedAt: sell.executedAt,
    openingQuantity: "1",
    remainingQuantity: "0",
    executions: [buy, sell],
  };
  return {
    groupId: `${instrument.id}:live`,
    tradeNature: "live",
    instrument,
    executions: [buy, sell],
    episodes: [{
      episode,
      metrics: {
        buyCount: 1,
        sellCount: 1,
        boughtQuantity: "1",
        soldQuantity: "1",
        grossExposure: "10",
        fees: "0",
        realizedPnl: pnl,
        unrealizedPnl: "0",
        netPnl: pnl,
        returnPercent: pnl,
        holdingMilliseconds: 3_600_000,
      },
      reviewStatus: "pending",
      confirmedTagIds: [],
      tagDictionaryVersion: 1,
      rMultiple: null,
    }],
    accountCount: 1,
    tradeCount: 2,
    episodeCount: 1,
    firstTradeAt: buy.executedAt,
    lastTradeAt: sell.executedAt,
    status: "closed",
    netPnl: pnl,
    returnPercent: pnl,
    reviewedEpisodeCount: 0,
    confirmedTagIds: [],
    cumulativeR: null,
  };
}

function scope(period = buildRoomDateRange("month", "2026-09-19")): RoomScope {
  return { ...createDefaultRoomScope("2026-09-19"), period };
}

function metadata(entries: readonly TradeLibraryEntry[]): ReadonlyMap<string, TradingRoomInstrumentMetadata> {
  return new Map(entries.map(value => [value.instrument.id, {
    market: value.instrument.market,
    symbol: value.instrument.symbol,
    assetType: "stock",
  }]));
}

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
  it("starts on the cumulative trend and keeps a visible zero baseline", () => {
    const value = entry("2026-09-02", "100");
    const { container } = render(
      <RoomPerformance
        entries={[value]}
        scope={scope()}
        instrumentMetadata={metadata([value])}
        onScopeChange={() => undefined}
        onOpenInReview={() => undefined}
        asOf="2026-09-19T08:00:00.000Z"
      />,
    );

    const panel = screen.getByRole("region", { name: "业绩趋势与日历" });
    expect(panel).toHaveTextContent("累计盈亏趋势");
    expect(panel).toHaveTextContent("+¥100.00");
    expect(container.querySelector("line")?.getAttribute("y1")).not.toBe("95");
  });

  it("can embed without rendering a second range summary line", () => {
    const value = entry("2026-09-02", "100");
    render(
      <RoomPerformance
        entries={[value]}
        scope={scope(buildRoomDateRange("custom", "2026-02-25", { startDate: "2026-02-25", endDate: "2026-02-25" }))}
        instrumentMetadata={metadata([value])}
        onScopeChange={() => undefined}
        onOpenInReview={() => undefined}
        asOf="2026-02-25T08:00:00.000Z"
        embedded
      />,
    );

    const panel = screen.getByRole("region", { name: "业绩趋势与日历" });
    expect(within(panel).queryByRole("group", { name: "区间收益摘要" })).not.toBeInTheDocument();
  });

  it("labels trend axes and exposes period and cumulative values for every point", () => {
    const first = entry("2026-09-02", "100");
    const second = entry("2026-09-03", "200", { id: "second" });
    render(
      <RoomPerformance
        entries={[first, second]}
        scope={scope(buildRoomDateRange("custom", "2026-09-03", { startDate: "2026-09-02", endDate: "2026-09-03" }))}
        instrumentMetadata={metadata([first, second])}
        onScopeChange={() => undefined}
        onOpenInReview={() => undefined}
        asOf="2026-09-03T08:00:00.000Z"
      />,
    );

    const panel = screen.getByRole("region", { name: "业绩趋势与日历" });
    expect(panel.querySelector("[aria-label='趋势图横轴']")).toBeInTheDocument();
    expect(panel.querySelector("[aria-label='趋势图纵轴刻度']")).toBeInTheDocument();
    expect(panel).toHaveTextContent("期间收益");
    expect(panel).toHaveTextContent("累计收益");
    expect(panel).toHaveTextContent("+¥100.00");
    expect(panel).toHaveTextContent("+¥300.00");
  });

  it("shows a selected trend point detail without opening the fallback disclosure", async () => {
    const user = userEvent.setup();
    const first = entry("2026-09-02", "100");
    const second = entry("2026-09-03", "200", { id: "second" });
    render(
      <RoomPerformance
        entries={[first, second]}
        scope={scope(buildRoomDateRange("custom", "2026-09-03", { startDate: "2026-09-02", endDate: "2026-09-03" }))}
        instrumentMetadata={metadata([first, second])}
        onScopeChange={() => undefined}
        onOpenInReview={() => undefined}
        asOf="2026-09-03T08:00:00.000Z"
      />,
    );

    const panel = screen.getByRole("region", { name: "业绩趋势与日历" });
    const point = within(panel).getByRole("button", { name: /2026-09-03.*期间收益/ });
    await user.click(point);
    const detail = within(panel).getByRole("status", { name: "趋势点详情" });
    expect(detail).toHaveTextContent("期间收益");
    expect(detail).toHaveTextContent("累计收益");
    expect(detail).toHaveTextContent("2026-09-03");
    expect(panel.querySelector("details")).not.toHaveAttribute("open");
  });

  it("switches the trend to natural-week buckets without changing the room scope", async () => {
    const user = userEvent.setup();
    const first = entry("2026-07-02", "100");
    const second = entry("2026-08-03", "200", { id: "second" });
    const onScopeChange = vi.fn();
    render(
      <RoomPerformance
        entries={[first, second]}
        scope={scope(buildRoomDateRange("last-3-months", "2026-09-19"))}
        instrumentMetadata={metadata([first, second])}
        onScopeChange={onScopeChange}
        onOpenInReview={() => undefined}
        asOf="2026-09-19T08:00:00.000Z"
      />,
    );

    const panel = screen.getByRole("region", { name: "业绩趋势与日历" });
    await user.click(within(panel).getByRole("button", { name: "周" }));
    expect(within(panel).getByRole("button", { name: "周" })).toHaveAttribute("aria-pressed", "true");
    expect(panel).toHaveTextContent("自然周");
    expect(onScopeChange).not.toHaveBeenCalled();
  });

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
    expect(within(panel).getByRole("button", { name: "月" })).toHaveAttribute("aria-pressed", "true");
    expect(within(panel).getByRole("button", { name: /2026年9月/ })).toBeInTheDocument();
    expect(within(panel).queryByRole("button", { name: /2025/ })).not.toBeInTheDocument();

    await user.click(within(panel).getByRole("button", { name: "全部年份" }));
    expect(panel).toHaveTextContent("+¥300.00");
    expect(within(panel).getByRole("button", { name: /2025/ })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "外部本月" }));
    expect(within(panel).getByRole("button", { name: "月" })).toHaveAttribute("aria-pressed", "true");
    expect(within(panel).getByRole("button", { name: /2026-09-02/ })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "外部近3月" }));
    expect(within(panel).getByRole("button", { name: "月" })).toHaveAttribute("aria-pressed", "true");
    expect(within(panel).getByRole("button", { name: /2026年7月/ })).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: /2026年9月/ })).toBeInTheDocument();

    await user.click(within(panel).getByRole("button", { name: "月" }));
    expect(panel).toHaveTextContent("+¥200.00");
    expect(within(panel).queryByRole("button", { name: /2025/ })).not.toBeInTheDocument();
  });

  it("keeps natural-week axis ticks distinct within the same month", async () => {
    const user = userEvent.setup();
    const first = entry("2026-09-02", "100");
    const second = entry("2026-09-10", "200", { id: "second" });
    render(
      <RoomPerformance
        entries={[first, second]}
        scope={scope(buildRoomDateRange("custom", "2026-09-19", { startDate: "2026-09-01", endDate: "2026-09-19" }))}
        instrumentMetadata={metadata([first, second])}
        onScopeChange={() => undefined}
        onOpenInReview={() => undefined}
        asOf="2026-09-19T08:00:00.000Z"
      />,
    );

    const panel = screen.getByRole("region", { name: "业绩趋势与日历" });
    await user.click(within(panel).getByRole("button", { name: "周" }));
    const axis = panel.querySelector("[aria-label='趋势图横轴']");
    expect(axis).toHaveTextContent("09-01~09-06");
    expect(axis).toHaveTextContent("09-07~09-13");
  });

  it("labels a single unconverted USD trend with USD instead of CNY", () => {
    const value = entry("2026-09-02", "100", { instrument: { id: "US:TEST", symbol: "TEST", name: "美股测试", market: "US", currency: "USD" } });
    render(
      <RoomPerformance
        entries={[value]}
        scope={scope(buildRoomDateRange("custom", "2026-09-02", { startDate: "2026-09-02", endDate: "2026-09-02" }))}
        instrumentMetadata={metadata([value])}
        onScopeChange={() => undefined}
        onOpenInReview={() => undefined}
        asOf="2026-09-02T08:00:00.000Z"
      />,
    );

    const panel = screen.getByRole("region", { name: "业绩趋势与日历" });
    expect(within(panel).getByRole("button", { name: /^USD ·/ })).toBeInTheDocument();
    expect(within(panel).queryByRole("button", { name: /^CNY ·/ })).not.toBeInTheDocument();
  });

  it("renders a visible point when the selected range has one trend bucket", () => {
    const value = entry("2026-09-02", "100");
    const { container } = render(
      <RoomPerformance
        entries={[value]}
        scope={scope(buildRoomDateRange("custom", "2026-09-02", { startDate: "2026-09-02", endDate: "2026-09-02" }))}
        instrumentMetadata={metadata([value])}
        onScopeChange={() => undefined}
        onOpenInReview={() => undefined}
        asOf="2026-09-02T08:00:00.000Z"
      />,
    );

    expect(container.querySelectorAll("svg circle[data-chart-role='point-visible']")).toHaveLength(1);
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

  it("keeps original currencies visible when mixed currency conversion is unavailable", () => {
    const usd = entry("2026-09-02", "100", { instrument: { id: "US:TEST", symbol: "TEST", name: "美股测试", market: "US", currency: "USD" } });
    const hkd = entry("2026-09-03", "20", { instrument: { id: "HK:0700", symbol: "0700", name: "港股测试", market: "HK", currency: "HKD" } });
    render(
      <RoomPerformance
        entries={[usd, hkd]}
        scope={scope()}
        instrumentMetadata={metadata([usd, hkd])}
        onScopeChange={() => undefined}
        onOpenInReview={() => undefined}
        asOf="2026-09-19T08:00:00.000Z"
      />,
    );
    const panel = screen.getByRole("region", { name: "业绩趋势与日历" });
    expect(panel).toHaveTextContent("多币种暂不可合计");
    expect(panel).toHaveTextContent("原币小计");
    expect(panel).toHaveTextContent("US$100.00");
    expect(panel).toHaveTextContent("HK$20.00");
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

  it("draws one converted line when the shared FX snapshot is complete", () => {
    const usd = entry("2026-09-02", "100", { instrument: { id: "US:TEST", symbol: "TEST", name: "美股测试", market: "US", currency: "USD" } });
    const hkd = entry("2026-09-03", "20", { instrument: { id: "HK:0700", symbol: "0700", name: "港股测试", market: "HK", currency: "HKD" } });
    const { container } = render(
      <RoomPerformance
        entries={[usd, hkd]}
        scope={scope()}
        instrumentMetadata={metadata([usd, hkd])}
        fxSnapshot={{ id: "fx:complete", baseCurrency: "CNY", asOf: "2026-09-19", source: "fixture", status: "complete", rates: { "USD/CNY": "7", "HKD/CNY": "0.9" } }}
        onScopeChange={() => undefined}
        onOpenInReview={() => undefined}
        asOf="2026-09-19T08:00:00.000Z"
      />,
    );
    expect(container.querySelectorAll("svg path")).toHaveLength(1);
    expect(screen.getByRole("region", { name: "业绩趋势与日历" })).toHaveTextContent("按同一汇率快照换算为人民币合计");
  });

  it("keeps each currency point paired with its own date when a series starts later", () => {
    const usd = entry("2026-09-02", "100", { instrument: { id: "US:TEST", symbol: "TEST", name: "美股测试", market: "US", currency: "USD" } });
    const hkd = entry("2026-09-03", "20", { instrument: { id: "HK:0700", symbol: "0700", name: "港股测试", market: "HK", currency: "HKD" } });
    render(
      <RoomPerformance
        entries={[usd, hkd]}
        scope={scope(buildRoomDateRange("custom", "2026-09-03", { startDate: "2026-09-02", endDate: "2026-09-03" }))}
        instrumentMetadata={metadata([usd, hkd])}
        onScopeChange={() => undefined}
        onOpenInReview={() => undefined}
        asOf="2026-09-03T08:00:00.000Z"
      />,
    );

    const panel = screen.getByRole("region", { name: "业绩趋势与日历" });
    expect(within(panel).getByRole("button", { name: /^HKD · 2026-09-03/ })).toBeInTheDocument();
    expect(within(panel).queryByRole("button", { name: /^HKD · 2026-09-02/ })).not.toBeInTheDocument();
  });

  it("uses padded shared coordinates for points, ticks, and the zero baseline", () => {
    const first = entry("2026-09-02", "-100");
    const second = entry("2026-09-03", "200", { id: "second" });
    const { container } = render(
      <RoomPerformance
        entries={[first, second]}
        scope={scope(buildRoomDateRange("custom", "2026-09-03", { startDate: "2026-09-02", endDate: "2026-09-03" }))}
        instrumentMetadata={metadata([first, second])}
        onScopeChange={() => undefined}
        onOpenInReview={() => undefined}
        asOf="2026-09-03T08:00:00.000Z"
      />,
    );

    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("preserveAspectRatio", "none");
    expect(svg).toHaveAttribute("height", "190");
    expect(svg?.getAttribute("viewBox")?.split(" ").at(-1)).toBe("190");
    const circles = [...container.querySelectorAll("svg circle")];
    const xValues = circles.map(circle => Number(circle.getAttribute("cx")));
    expect(Math.min(...xValues)).toBeGreaterThan(0);
    expect(Math.max(...xValues)).toBeLessThan(640);
    const zero = container.querySelector("svg [data-chart-role='zero-line']");
    const zeroTick = container.querySelector("svg [data-chart-role='axis-y-tick'][data-value='0']");
    expect(zero).toHaveAttribute("y1", zeroTick?.getAttribute("y"));
    const xTick = container.querySelector("[data-chart-role='axis-x-tick'][data-key='2026-09-03']");
    expect(xTick?.getAttribute("data-x")).toBe(circles.at(-1)?.getAttribute("cx"));
  });

  it("keeps trend ticks short and gives visible points a larger touch target", () => {
    const first = entry("2026-09-02", "100");
    const second = entry("2026-09-03", "200", { id: "second" });
    const { container } = render(
      <RoomPerformance
        entries={[first, second]}
        scope={scope(buildRoomDateRange("custom", "2026-09-03", { startDate: "2026-09-02", endDate: "2026-09-03" }))}
        instrumentMetadata={metadata([first, second])}
        onScopeChange={() => undefined}
        onOpenInReview={() => undefined}
        asOf="2026-09-03T08:00:00.000Z"
      />,
    );

    const axis = container.querySelector("[aria-label='趋势图横轴']");
    expect(axis).toHaveTextContent("09-02");
    expect(axis).not.toHaveTextContent("2026-09-02");
    expect(container.querySelector("[class*='axisYHeader']")).not.toBeInTheDocument();
    expect(container.querySelector("[class*='chartAxisCaption']")).not.toBeInTheDocument();
    const hitAreas = container.querySelectorAll("circle[data-chart-role='point-hit-area']");
    const visiblePoints = container.querySelectorAll("circle[data-chart-role='point-visible']");
    expect(hitAreas.length).toBe(visiblePoints.length);
    expect(Number(hitAreas[0]?.getAttribute("r"))).toBeGreaterThan(Number(visiblePoints[0]?.getAttribute("r")));
    expect(container.querySelector("svg")?.getAttribute("height")).toBe("190");
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

  it("measures the chart when it appears after an initially empty scope", () => {
    let resizeCallback: (() => void) | null = null;
    vi.stubGlobal("ResizeObserver", class {
      constructor(callback: () => void) {
        resizeCallback = callback;
      }

      observe(element: Element) {
        Object.defineProperty(element, "getBoundingClientRect", {
          configurable: true,
          value: () => ({ width: 320, height: 190, top: 0, right: 320, bottom: 190, left: 0 }),
        });
        resizeCallback?.();
      }

      disconnect() {}
    });

    const value = entry("2026-09-02", "100");
    const { container, rerender } = render(
      <RoomPerformance
        entries={[]}
        scope={scope()}
        instrumentMetadata={metadata([value])}
        onScopeChange={() => undefined}
        onOpenInReview={() => undefined}
        asOf="2026-09-19T08:00:00.000Z"
      />,
    );
    expect(container.querySelector("svg")).not.toBeInTheDocument();

    rerender(
      <RoomPerformance
        entries={[value]}
        scope={scope()}
        instrumentMetadata={metadata([value])}
        onScopeChange={() => undefined}
        onOpenInReview={() => undefined}
        asOf="2026-09-19T08:00:00.000Z"
      />,
    );

    expect(container.querySelector("svg")?.getAttribute("viewBox")).toBe("0 0 320 190");
    const yLabel = container.querySelector("[data-chart-role='axis-y-label']") as HTMLElement | null;
    expect(Number.parseFloat(yLabel?.style.left ?? "0")).toBeGreaterThanOrEqual(21.8);
  });

  it("shows the same trend point detail on hover, focus, and click", async () => {
    const user = userEvent.setup();
    const value = entry("2026-09-02", "100");
    render(
      <RoomPerformance
        entries={[value]}
        scope={scope()}
        instrumentMetadata={metadata([value])}
        onScopeChange={() => undefined}
        onOpenInReview={() => undefined}
        asOf="2026-09-19T08:00:00.000Z"
      />,
    );

    const panel = screen.getByRole("region", { name: "业绩趋势与日历" });
    const point = within(panel).getByRole("button", { name: /2026-09-02.*期间收益/ });
    fireEvent.mouseEnter(point);
    const detail = within(panel).getByRole("status", { name: "趋势点详情" });
    expect(detail).toHaveTextContent("期间收益");
    await user.tab();
    expect(detail).toHaveTextContent("累计收益");
    await user.click(point);
    expect(detail).toHaveTextContent("1 个可信回合");
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

  it("clears a selected calendar date when a new scope no longer contains it", async () => {
    const user = userEvent.setup();
    const value = entry("2026-09-02", "100");
    const next = entry("2026-09-03", "200", { id: "next" });
    const initialScope = scope(buildRoomDateRange("custom", "2026-09-02", { startDate: "2026-09-02", endDate: "2026-09-02" }));
    const { rerender } = render(
      <RoomPerformance
        entries={[value, next]}
        scope={initialScope}
        instrumentMetadata={metadata([value, next])}
        onScopeChange={() => undefined}
        onOpenInReview={() => undefined}
        asOf="2026-09-03T08:00:00.000Z"
      />,
    );

    const panel = screen.getByRole("region", { name: "业绩趋势与日历" });
    await user.click(within(panel).getByRole("button", { name: "日历" }));
    await user.click(within(panel).getByRole("button", { name: /2026-09-02，/ }));
    expect(within(panel).getByRole("region", { name: "日历日期详情" })).toBeInTheDocument();
    rerender(
      <RoomPerformance
        entries={[value, next]}
        scope={scope(buildRoomDateRange("custom", "2026-09-03", { startDate: "2026-09-03", endDate: "2026-09-03" }))}
        instrumentMetadata={metadata([value, next])}
        onScopeChange={() => undefined}
        onOpenInReview={() => undefined}
        asOf="2026-09-03T08:00:00.000Z"
      />,
    );
    expect(within(panel).queryByRole("region", { name: "日历日期详情" })).not.toBeInTheDocument();
  });
});
