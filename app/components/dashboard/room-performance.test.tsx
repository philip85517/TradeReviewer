import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { TradeLibraryEntry } from "../../lib/trades/library";
import type { Instrument } from "../../lib/trades/types";
import { buildRoomDateRange, createDefaultRoomScope, type RoomScope, type TradingRoomInstrumentMetadata } from "../../lib/reviews/trading-room-scope";
import { RoomPerformance } from "./room-performance";

afterEach(cleanup);

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
    expect(within(panel).getByLabelText("趋势图横轴")).toBeInTheDocument();
    expect(within(panel).getByLabelText("趋势图纵轴")).toBeInTheDocument();
    expect(panel).toHaveTextContent("累计收益");
    expect(panel).toHaveTextContent("+¥100.00");
    expect(panel).toHaveTextContent("+¥300.00");
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

    expect(container.querySelectorAll("svg circle")).toHaveLength(1);
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
    const value = entry("2026-09-02", "100");
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

  it("uses the selected original currency in incomplete-FX point readouts", async () => {
    const user = userEvent.setup();
    const usd = entry("2026-09-02", "100", { instrument: { id: "US:TEST", symbol: "TEST", name: "美股测试", market: "US", currency: "USD" } });
    const hkd = entry("2026-09-03", "20", { instrument: { id: "HK:0700", symbol: "0700", name: "港股测试", market: "HK", currency: "HKD" } });
    render(<RoomPerformance entries={[usd, hkd]} scope={scope(buildRoomDateRange("custom", "2026-09-03", { startDate: "2026-09-02", endDate: "2026-09-03" }))}
      instrumentMetadata={metadata([usd, hkd])} onScopeChange={() => undefined} onOpenInReview={() => undefined} asOf="2026-09-03T08:00:00.000Z" />);
    const panel = screen.getByRole("region", { name: "业绩趋势与日历" });
    await user.click(within(panel).getByRole("button", { name: /2026-09-02.*USD/ }));
    expect(panel).toHaveTextContent("期间 +US$100.00");
    await user.click(within(panel).getByRole("button", { name: /2026-09-03.*HKD/ }));
    expect(panel).toHaveTextContent("期间 +HK$20.00");
  });

  it("does not show another currency when the selected series has no period value", async () => {
    const user = userEvent.setup();
    const usd = entry("2026-09-02", "100", { instrument: { id: "US:TEST", symbol: "TEST", name: "美股测试", market: "US", currency: "USD" } });
    const hkd = entry("2026-09-03", "20", { instrument: { id: "HK:0700", symbol: "0700", name: "港股测试", market: "HK", currency: "HKD" } });
    render(<RoomPerformance entries={[usd, hkd]} scope={scope(buildRoomDateRange("custom", "2026-09-03", { startDate: "2026-09-02", endDate: "2026-09-03" }))}
      instrumentMetadata={metadata([usd, hkd])} onScopeChange={() => undefined} onOpenInReview={() => undefined} asOf="2026-09-03T08:00:00.000Z" />);
    const panel = screen.getByRole("region", { name: "业绩趋势与日历" });
    await user.click(within(panel).getByRole("button", { name: /2026-09-03.*USD/ }));
    expect(panel).toHaveTextContent("期间 该币种无成交");
    expect(panel).not.toHaveTextContent("期间 +HK$20.00 · 累计");
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

  it("keeps no-trade buckets as a known plateau and exposes keyboard point readouts", async () => {
    const user = userEvent.setup();
    const first = entry("2026-09-02", "100");
    const last = entry("2026-09-04", "-50", { id: "last" });
    render(
      <RoomPerformance
        entries={[first, last]}
        scope={scope(buildRoomDateRange("custom", "2026-09-04", { startDate: "2026-09-02", endDate: "2026-09-04" }))}
        instrumentMetadata={metadata([first, last])}
        onScopeChange={() => undefined}
        onOpenInReview={() => undefined}
        asOf="2026-09-04T08:00:00.000Z"
      />,
    );
    const panel = screen.getByRole("region", { name: "业绩趋势与日历" });
    expect(panel.querySelectorAll("svg path")).toHaveLength(1);
    const point = within(panel).getByRole("button", { name: /2026-09-02.*期间收益.*累计收益/ });
    point.focus();
    await user.keyboard("{Enter}");
    expect(panel).toHaveTextContent("2026-09-02 · 期间 +¥100.00 · 累计 +¥100.00");
    expect(point).toHaveAttribute("tabindex", "0");
  });

  it("breaks the trend across an unavailable bucket", () => {
    const first = entry("2026-09-02", "100");
    const unknown = entry("2026-09-03", "20", { id: "unknown", instrument: { id: "UNKNOWN:TEST", symbol: "TEST", name: "未知测试", market: "XX", currency: "CNY" } });
    const last = entry("2026-09-04", "-50", { id: "last" });
    const { container } = render(
      <RoomPerformance
        entries={[first, unknown, last]}
        scope={scope(buildRoomDateRange("custom", "2026-09-04", { startDate: "2026-09-02", endDate: "2026-09-04" }))}
        instrumentMetadata={metadata([first, last])}
        onScopeChange={() => undefined}
        onOpenInReview={() => undefined}
        asOf="2026-09-04T08:00:00.000Z"
      />,
    );
    expect(container.querySelectorAll("svg path")).toHaveLength(0);
  });

  it("aligns daily cells under Monday through Sunday with leading blanks", async () => {
    const user = userEvent.setup();
    const value = entry("2026-09-01", "100");
    const { container } = render(
      <RoomPerformance entries={[value]} scope={scope()} instrumentMetadata={metadata([value])}
        onScopeChange={() => undefined} onOpenInReview={() => undefined} asOf="2026-09-19T08:00:00.000Z" />,
    );
    const panel = screen.getByRole("region", { name: "业绩趋势与日历" });
    await user.click(within(panel).getByRole("button", { name: "日历" }));
    expect(panel).toHaveTextContent("周一");
    expect(panel).toHaveTextContent("周日");
    expect(container.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThanOrEqual(1);
    expect(within(panel).getByRole("button", { name: /2026-09-01，\+¥100\.00/ })).toBeInTheDocument();
  });

  it("marks cross-month calendar as a summary and returns from a drilled month", async () => {
    const user = userEvent.setup();
    const july = entry("2026-07-02", "10");
    const august = entry("2026-08-02", "20", { id: "aug" });
    const onScopeChange = vi.fn();
    render(<RoomPerformance entries={[july, august]} scope={scope(buildRoomDateRange("custom", "2026-08-02", { startDate: "2026-07-01", endDate: "2026-08-02" }))}
      instrumentMetadata={metadata([july, august])} onScopeChange={onScopeChange} onOpenInReview={() => undefined} asOf="2026-09-19T08:00:00.000Z" />);
    const panel = screen.getByRole("region", { name: "业绩趋势与日历" });
    await user.click(within(panel).getByRole("button", { name: "日历" }));
    expect(within(panel).getByRole("button", { name: "所选期间·按月汇总" })).toHaveAttribute("aria-pressed", "false");
    await user.click(within(panel).getByRole("button", { name: /2026年7月/ }));
    expect(onScopeChange).toHaveBeenLastCalledWith({ period: { preset: "custom", startDate: "2026-07-01", endDate: "2026-07-31" } });
    await user.click(within(panel).getByRole("button", { name: "返回上一范围" }));
    expect(onScopeChange).toHaveBeenLastCalledWith({ period: { preset: "custom", startDate: "2026-07-01", endDate: "2026-08-02" } });
  });
});
