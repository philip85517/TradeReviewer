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
});
