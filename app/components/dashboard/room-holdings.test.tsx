import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TradeLibraryEntry } from "../../lib/trades/library";
import { buildRoomDateRange, createDefaultRoomScope, type TradingRoomInstrumentMetadata } from "../../lib/reviews/trading-room-scope";
import { RoomHoldingsPanel } from "./room-holdings";

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

function entry(accountId = "account-1"): TradeLibraryEntry {
  const instrument = { id: "US:TEST", symbol: "TEST", name: "测试标的", market: "US", currency: "USD" };
  const episodeId = accountId === "account-1" ? "episode:holding" : `episode:holding:${accountId}`;
  const execution = { id: `buy-1:${accountId}`, source: { platform: "fixture", row: 1 }, accountId, accountLabel: "主账户", instrument, side: "buy" as const, executedAt: "2020-01-02T01:00:00.000Z", quantity: "2", price: "10", fee: "0" };
  const episode = { id: episodeId, accountId, accountLabel: "主账户", instrument, tradeNature: "live" as const, direction: "long" as const, status: "open" as const, startedAt: execution.executedAt, openingQuantity: "2", remainingQuantity: "2", executions: [execution] };
  return {
    groupId: `US:TEST|live:${accountId}`,
    tradeNature: "live",
    instrument,
    executions: [execution],
    episodes: [{ episode, metrics: { buyCount: 1, sellCount: 0, boughtQuantity: "2", soldQuantity: "0", grossExposure: "20", fees: "0", realizedPnl: "0", unrealizedPnl: "999", netPnl: "999", returnPercent: "999", holdingMilliseconds: null }, reviewStatus: "pending", confirmedTagIds: [], tagDictionaryVersion: 1, rMultiple: null }],
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

describe("RoomHoldingsPanel", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-19T12:00:00.000Z"));
  });

  it("shows holding status and opens the exact episode", async () => {
    const user = userEvent.setup();
    const onOpenInReview = vi.fn();
    const value = entry();
    const metadata: ReadonlyMap<string, TradingRoomInstrumentMetadata> = new Map([[value.instrument.id, { market: "US", symbol: "TEST", assetType: "stock" }]]);
    const scope = { ...createDefaultRoomScope("2026-09-19"), period: buildRoomDateRange("month", "2026-09-19") };
    render(
      <RoomHoldingsPanel
        entries={[value]}
        scope={scope}
        instrumentMetadata={metadata}
        quotesByInstrument={{ "US:TEST": { price: "12", currency: "USD", quoteDate: "2026-09-19", fetchedAt: "2026-09-19T08:00:00.000Z", provider: "fixture", freshness: "current" } }}
        asOf="2026-09-19T08:00:00.000Z"
        onOpenInReview={onOpenInReview}
        positionSnapshotsByEpisode={{ "episode:holding": { quantity: "2", averageCost: "10", realizedPnl: "0", unrealizedPnl: "4", netPnl: "4", fees: "0", grossCapitalDeployed: "20", returnPercent: "20" } }}
      />,
    );

    const holdings = screen.getByRole("region", { name: "当前持仓" });
    expect(holdings).toHaveTextContent("当前持仓，截至 2026-09-19");
    expect(holdings).toHaveTextContent("测试标的");
    expect(holdings).toHaveTextContent("持仓数量");
    expect(holdings).toHaveTextContent("+US$4.00");
    await user.click(within(holdings).getByRole("button", { name: "打开持仓回合复盘" }));
    expect(onOpenInReview).toHaveBeenCalledWith("US:TEST", "episode:holding", ["episode:holding"]);
  });

  it("shows fractional holding quantities to two decimal places without changing the model value", () => {
    const value = entry();
    value.episodes[0].episode.executions[0].quantity = "1.23456789";
    const scope = { ...createDefaultRoomScope("2026-09-19"), period: buildRoomDateRange("month", "2026-09-19") };
    render(<RoomHoldingsPanel entries={[value]} scope={scope} onOpenInReview={() => undefined} />);

    const holdings = screen.getByRole("region", { name: "当前持仓" });
    expect(holdings).toHaveTextContent("1.23");
    expect(holdings).not.toHaveTextContent("1.23456789");
  });

  it("explains missing quote without inventing a current price or PnL", () => {
    const value = entry();
    const scope = { ...createDefaultRoomScope("2026-09-19"), period: buildRoomDateRange("month", "2026-09-19") };
    render(<RoomHoldingsPanel entries={[value]} scope={scope} onOpenInReview={() => undefined} />);
    const holdings = screen.getByRole("region", { name: "当前持仓" });
    expect(holdings).toHaveTextContent("缺少行情");
    expect(holdings).toHaveTextContent("浮盈亏不可用");
    expect(holdings).not.toHaveTextContent("+US$999.00");
  });

  it("labels a short position and exposes the existing data check action", async () => {
    const user = userEvent.setup();
    const value = entry();
    const episode = value.episodes[0].episode;
    episode.executions[0].side = "sell";
    episode.executions[0].source.positionEffect = "open-short";
    episode.direction = "short";
    const onOpenDataCheck = vi.fn();
    const scope = { ...createDefaultRoomScope("2026-09-19"), period: buildRoomDateRange("month", "2026-09-19") };
    render(<RoomHoldingsPanel entries={[value]} scope={scope} onOpenInReview={() => undefined} onOpenDataCheck={onOpenDataCheck} />);

    const holdings = screen.getByRole("region", { name: "当前持仓" });
    expect(holdings).toHaveTextContent("空头");
    expect(holdings).toHaveTextContent("缺少行情");
    await user.click(within(holdings).getByRole("button", { name: "查看数据" }));
    expect(onOpenDataCheck).toHaveBeenCalledWith("US:TEST", "episode:holding");
  });

  it("offers a quote retry for stale holdings", async () => {
    const user = userEvent.setup();
    const value = entry();
    const onRetryQuote = vi.fn();
    const scope = { ...createDefaultRoomScope("2026-09-19"), period: buildRoomDateRange("month", "2026-09-19") };
    render(<RoomHoldingsPanel entries={[value]} scope={scope} quotesByInstrument={{ "US:TEST": { price: "12", currency: "USD", quoteDate: "2026-09-10", fetchedAt: null, provider: "fixture", freshness: "stale" } }} onOpenInReview={() => undefined} onRetryQuote={onRetryQuote} />);

    const holdings = screen.getByRole("region", { name: "当前持仓" });
    await user.click(within(holdings).getByRole("button", { name: "重试行情" }));
    expect(onRetryQuote).toHaveBeenCalledWith("US:TEST");
  });

  it("keeps a negative import difference as evidence-to-check and does not show cost or PnL", () => {
    const value = entry();
    const episode = value.episodes[0].episode;
    episode.executions[0].side = "sell";
    episode.executions[0].quantity = "10000";
    episode.executions[0].source.formatRuleId = "china-merchants/pdf/monthly-v1";
    episode.direction = "short";
    episode.remainingQuantity = "-10000";
    const scope = { ...createDefaultRoomScope("2026-09-19"), period: buildRoomDateRange("month", "2026-09-19") };
    render(
      <RoomHoldingsPanel
        entries={[value]}
        scope={scope}
        quotesByInstrument={{ "US:TEST": { price: "8", currency: "USD", quoteDate: "2026-09-19", fetchedAt: "2026-09-19T08:00:00.000Z", provider: "fixture", freshness: "current" } }}
        onOpenInReview={() => undefined}
      />,
    );

    const holdings = screen.getByRole("region", { name: "当前持仓" });
    expect(holdings).toHaveTextContent("方向待核对");
    expect(holdings).toHaveTextContent("负仓差额待核对");
    expect(holdings).toHaveTextContent("-10,000");
    expect(holdings).toHaveTextContent("可用成本待核对");
    expect(holdings).toHaveTextContent("浮盈亏不可用");
    expect(holdings).not.toHaveTextContent("+US$20,000.00");
  });

  it("shows quote retry in progress and success only after the row becomes available", async () => {
    const user = userEvent.setup();
    let resolveRetry!: () => void;
    const onRetryQuote = vi.fn(() => new Promise<void>(resolve => { resolveRetry = resolve; }));
    const value = entry();
    const scope = { ...createDefaultRoomScope("2026-09-19"), period: buildRoomDateRange("month", "2026-09-19") };
    const props = {
      entries: [value],
      scope,
      onOpenInReview: () => undefined,
      onRetryQuote,
    };
    const view = render(<RoomHoldingsPanel {...props} />);
    const holdings = screen.getByRole("region", { name: "当前持仓" });
    await user.click(within(holdings).getByRole("button", { name: "重试行情" }));
    expect(holdings).toHaveTextContent("行情重试进行中");

    resolveRetry();
    await screen.findByText("行情重试完成，仍不可用");
    view.rerender(
      <RoomHoldingsPanel
        {...props}
        quotesByInstrument={{ "US:TEST": { price: "12", currency: "USD", quoteDate: "2026-09-19", fetchedAt: "2026-09-19T08:00:00.000Z", provider: "fixture", freshness: "current" } }}
      />,
    );
    expect(await screen.findByText("行情重试成功")).toBeInTheDocument();
  });

  it("reports a rejected quote retry as a failure", async () => {
    const user = userEvent.setup();
    const onRetryQuote = vi.fn(async () => { throw new Error("source down"); });
    const value = entry();
    const scope = { ...createDefaultRoomScope("2026-09-19"), period: buildRoomDateRange("month", "2026-09-19") };
    render(<RoomHoldingsPanel entries={[value]} scope={scope} onOpenInReview={() => undefined} onRetryQuote={onRetryQuote} />);

    await user.click(screen.getByRole("button", { name: "重试行情" }));
    expect(await screen.findByText("行情重试失败")).toBeInTheDocument();
  });

  it("puts quote date, source, and fetch time behind an expandable details control", () => {
    const value = entry();
    const scope = { ...createDefaultRoomScope("2026-09-19"), period: buildRoomDateRange("month", "2026-09-19") };
    render(
      <RoomHoldingsPanel
        entries={[value]}
        scope={scope}
        quotesByInstrument={{ "US:TEST": { price: "12", currency: "USD", quoteDate: "2026-09-19", fetchedAt: "2026-09-19T08:00:00.000Z", provider: "fixture", freshness: "current" } }}
        onOpenInReview={() => undefined}
      />,
    );

    expect(screen.getByRole("group", { name: "行情详情" })).toBeInTheDocument();
    expect(screen.getByText(/2026-09-19.*fixture/)).toBeInTheDocument();
  });

  it("disambiguates colliding account labels without exposing account IDs", () => {
    const first = entry("account-1");
    const second = entry("account-2");
    const scope = { ...createDefaultRoomScope("2026-09-19"), period: buildRoomDateRange("month", "2026-09-19") };
    render(<RoomHoldingsPanel entries={[first, second]} scope={scope} onOpenInReview={() => undefined} />);
    const holdings = screen.getByRole("region", { name: "当前持仓" });
    expect(holdings).toHaveTextContent("主账户 · 1");
    expect(holdings).toHaveTextContent("主账户 · 2");
    expect(holdings).not.toHaveTextContent("account-1");
    expect(holdings).not.toHaveTextContent("account-2");
  });
});
