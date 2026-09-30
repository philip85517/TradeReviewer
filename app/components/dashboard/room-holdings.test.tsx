import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildCurrentPortfolio } from "../../lib/reviews/trading-room-portfolio";
import type { TradeLibraryEntry } from "../../lib/trades/library";
import { buildRoomDateRange, createDefaultRoomScope, type TradingRoomInstrumentMetadata } from "../../lib/reviews/trading-room-scope";
import { RoomHoldingsPanel, holdingsCsv, holdingPriceSeries } from "./room-holdings";

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
    expect(holdings).toHaveTextContent("当前持仓");
    expect(holdings).toHaveTextContent("持仓日期：2026-09-19");
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
    expect(holdings).toHaveTextContent("暂无可用报价");
    expect(holdings).toHaveTextContent("暂不可用（缺少报价）");
    expect(holdings).not.toHaveTextContent("+US$999.00");
  });

  it("keeps quote and valuation diagnostics accessible as separate cell content", () => {
    const value = entry();
    const scope = { ...createDefaultRoomScope("2026-09-19"), period: buildRoomDateRange("month", "2026-09-19") };
    render(<RoomHoldingsPanel entries={[value]} scope={scope} onOpenInReview={() => undefined} />);

    const holdings = screen.getByRole("region", { name: "当前持仓" });
    const quoteCell = holdings.querySelector('td[data-label="估值价"]');
    const marketValueCell = holdings.querySelector('td[data-label="持仓市值"]');
    expect(quoteCell).toHaveAttribute("aria-label", expect.stringContaining("暂无可用报价"));
    expect(marketValueCell).toHaveAttribute("aria-label", expect.stringContaining("缺少可信金额"));
  });

  it("labels a short position without exposing a diagnostics link", async () => {
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
    expect(holdings).toHaveTextContent("暂无可用报价");
    expect(within(holdings).queryByRole("button", { name: "查看数据" })).not.toBeInTheDocument();
    expect(onOpenDataCheck).not.toHaveBeenCalled();
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
    expect(holdings).toHaveTextContent("持仓数量");
    expect(holdings).toHaveTextContent("-10,000");
    expect(holdings).toHaveTextContent("可用成本待核对");
    expect(holdings).toHaveTextContent("暂不可用");
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

  it("shows the quote date inline", () => {
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

    expect(screen.getByText("报价时间：2026-09-19")).toBeInTheDocument();
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

  it("keeps source price precision and makes average cost detail available", () => {
    const value = entry();
    const scope = { ...createDefaultRoomScope("2026-09-19"), period: buildRoomDateRange("month", "2026-09-19") };
    render(
      <RoomHoldingsPanel
        entries={[value]}
        scope={scope}
        quotesByInstrument={{ "US:TEST": { price: "1.104", currency: "USD", quoteDate: "2026-09-19", fetchedAt: "2026-09-19T08:00:00.000Z", provider: "fixture", freshness: "current" } }}
        positionSnapshotsByEpisode={{ "episode:holding": { quantity: "2", averageCost: "1.103456789", realizedPnl: "0", unrealizedPnl: "0.001", netPnl: "0.001", fees: "0", grossCapitalDeployed: "2.206913578", returnPercent: "0.05" } }}
        onOpenInReview={() => undefined}
      />,
    );
    const holdings = screen.getByRole("region", { name: "当前持仓" });
    expect(holdings).toHaveTextContent("US$1.104");
    expect(holdings).toHaveTextContent("US$1.103457");
    expect(holdings).not.toHaveTextContent("持仓均价完整值");
    expect(holdings).toHaveAttribute("data-current-date", "2026-09-19");
    expect(holdings).toHaveTextContent("方向：多头");
  });

  it("labels stale quotes inline and separates imported, quote, and viewed dates", () => {
    const value = entry();
    const scope = { ...createDefaultRoomScope("2026-09-19"), period: buildRoomDateRange("month", "2026-09-19") };
    render(
      <RoomHoldingsPanel
        entries={[value]}
        scope={scope}
        asOf="2026-09-19T12:00:00.000Z"
        staleAfterDays={3}
        quotesByInstrument={{ "US:TEST": { price: "1.103", currency: "USD", quoteDate: "2026-09-10", fetchedAt: "2026-09-10T08:00:00.000Z", provider: "fixture", freshness: "stale" } }}
        onOpenInReview={() => undefined}
      />,
    );
    const holdings = screen.getByRole("region", { name: "当前持仓" });
    expect(holdings).toHaveTextContent("旧报价");
    expect(holdings).toHaveTextContent("报价时间：2026-09-10");
  });

  it("keeps the stale reference warning when the quote predates the latest execution", () => {
    const value = entry();
    value.episodes[0].episode.executions[0].executedAt = "2026-09-18T01:00:00.000Z";
    value.firstTradeAt = value.episodes[0].episode.executions[0].executedAt;
    value.lastTradeAt = value.firstTradeAt;
    const scope = { ...createDefaultRoomScope("2026-09-22"), period: buildRoomDateRange("month", "2026-09-22") };
    render(
      <RoomHoldingsPanel
        entries={[value]}
        scope={scope}
        asOf="2026-09-22T12:00:00.000Z"
        staleAfterDays={3}
        quotesByInstrument={{ "US:TEST": { price: "1.103", currency: "USD", quoteDate: "2026-09-10", fetchedAt: "2026-09-10T08:00:00.000Z", provider: "fixture", freshness: "stale" } }}
        onOpenInReview={() => undefined}
      />,
    );
    const holdings = screen.getByRole("region", { name: "当前持仓" });
    expect(holdings).toHaveTextContent("旧报价");
    expect(holdings).toHaveTextContent("暂不可用");
  });

  it("offers PnL sorting only within currency and keeps unknown values last", async () => {
    const user = userEvent.setup();
    const first = entry("account-1");
    const second = entry("account-2");
    second.episodes[0].episode.executions[0].executedAt = "2020-01-03T01:00:00.000Z";
    const scope = { ...createDefaultRoomScope("2026-09-19"), period: buildRoomDateRange("month", "2026-09-19") };
    render(<RoomHoldingsPanel entries={[first, second]} scope={scope} onOpenInReview={() => undefined} />);
    expect(screen.queryByText("币种不可直接比较，已保留最近成交顺序。")).not.toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "浮盈亏" }));
    expect(screen.getByRole("region", { name: "当前持仓" })).toHaveTextContent("仅在同币种内比较浮盈亏");
  });

  it("explains disabled PnL sorting in the default recent state for mixed currencies", async () => {
    const user = userEvent.setup();
    const first = entry("account-1");
    const second = entry("account-2");
    for (const instrument of [second.instrument, second.episodes[0].episode.instrument, second.episodes[0].episode.executions[0].instrument]) {
      instrument.id = "HK:TEST";
      instrument.symbol = "TESTHK";
      instrument.market = "HK";
      instrument.currency = "HKD";
    }
    const scope = { ...createDefaultRoomScope("2026-09-19"), period: buildRoomDateRange("month", "2026-09-19") };
    render(<RoomHoldingsPanel entries={[first, second]} scope={scope} onOpenInReview={() => undefined} />);

    const pnlSort = screen.getByRole("radio", { name: "浮盈亏" });
    expect(pnlSort).toBeDisabled();
    expect(pnlSort).toHaveAttribute("aria-describedby", "holdings-pnl-sort-disabled-reason");
    expect(pnlSort).toHaveAccessibleDescription("币种不可直接比较，已保留最近成交顺序。");
    expect(screen.getByText("币种不可直接比较，已保留最近成交顺序。")).toBeVisible();
    const recentSort = screen.getByRole("radio", { name: "最近成交" });
    expect(recentSort).toBeChecked();
    expect(recentSort).toHaveAttribute("aria-describedby", "holdings-pnl-sort-disabled-reason");
    await user.tab();
    expect(recentSort).toHaveFocus();
    expect(recentSort).toHaveAccessibleDescription("币种不可直接比较，已保留最近成交顺序。");
  });

  it("uses loss styling and keeps the negative sign for negative PnL", () => {
    const value = entry();
    const scope = { ...createDefaultRoomScope("2026-09-19"), period: buildRoomDateRange("month", "2026-09-19") };
    render(
      <RoomHoldingsPanel
        entries={[value]}
        scope={scope}
        quotesByInstrument={{ "US:TEST": { price: "9", currency: "USD", quoteDate: "2026-09-19", fetchedAt: "2026-09-19T08:00:00.000Z", provider: "fixture", freshness: "current" } }}
        positionSnapshotsByEpisode={{ "episode:holding": { quantity: "2", averageCost: "10", realizedPnl: "0", unrealizedPnl: "-2", netPnl: "-2", fees: "0", grossCapitalDeployed: "20", returnPercent: "-10" } }}
        onOpenInReview={() => undefined}
      />,
    );
    const pnl = screen.getByText("-US$2.00");
    expect(pnl.closest("dd")?.className).toContain("negative");
  });

  it("uses neutral styling for a zero unrealized PnL", () => {
    const value = entry();
    const scope = { ...createDefaultRoomScope("2026-09-19"), period: buildRoomDateRange("month", "2026-09-19") };
    render(
      <RoomHoldingsPanel
        entries={[value]}
        scope={scope}
        quotesByInstrument={{ "US:TEST": { price: "10", currency: "USD", quoteDate: "2026-09-19", fetchedAt: "2026-09-19T08:00:00.000Z", provider: "fixture", freshness: "current" } }}
        positionSnapshotsByEpisode={{ "episode:holding": { quantity: "2", averageCost: "10", realizedPnl: "0", unrealizedPnl: "0", netPnl: "0", fees: "0", grossCapitalDeployed: "20", returnPercent: "0" } }}
        onOpenInReview={() => undefined}
      />,
    );
    const pnl = screen.getByText("+US$0.00");
    expect(pnl.closest("dd")?.className).toContain("neutral");
    expect(pnl.closest("dd")?.className).not.toContain("positive");
    expect(pnl.closest("dd")?.className).not.toContain("negative");
  });

  it("shows plain-language quote status and an explicit market badge", () => {
    const value = entry();
    value.instrument.market = "CN-SH";
    const scope = { ...createDefaultRoomScope("2026-09-19"), period: buildRoomDateRange("month", "2026-09-19") };
    const metadata: ReadonlyMap<string, TradingRoomInstrumentMetadata> = new Map([[value.instrument.id, { market: "CN-SH", symbol: "TEST", assetType: "stock" }]]);
    render(
      <RoomHoldingsPanel
        entries={[value]}
        scope={scope}
        instrumentMetadata={metadata}
        quotesByInstrument={{ "US:TEST": { price: "12.3", currency: "CNY", quoteDate: "2026-09-19", fetchedAt: "2026-09-19T08:00:00.000Z", provider: "fixture", freshness: "stale" } }}
        onOpenInReview={() => undefined}
      />,
    );
    const holdings = screen.getByRole("region", { name: "当前持仓" });
    expect(holdings).toHaveTextContent("沪市");
    expect(holdings).toHaveTextContent("旧报价 · 非实时");
    expect(holdings).toHaveTextContent("报价时间：2026-09-19");
    expect(holdings).not.toHaveTextContent("技术证据");
  });
});

describe("holdings table workflow", () => {
 it("keeps every market in one table with one header and numbered five-row pages", async () => {
  const entries = Array.from({length: 12}, (_, index) => {
    const value = entry(`account-${index + 1}`);
    value.instrument.id = `US:TEST-${index + 1}`;
    value.instrument.symbol = `TEST${index + 1}`;
    value.episodes[0].episode.instrument.id = value.instrument.id;
    value.episodes[0].episode.instrument.symbol = value.instrument.symbol;
    value.episodes[0].episode.executions[0].instrument.id = value.instrument.id;
    value.episodes[0].episode.executions[0].instrument.symbol = value.instrument.symbol;
    if (index === 1) {
      value.instrument.market = "CN-SH";
      value.episodes[0].episode.instrument.market = "CN-SH";
      value.episodes[0].episode.executions[0].instrument.market = "CN-SH";
    }
    return value;
  });
  const view = render(<RoomHoldingsPanel entries={entries} scope={createDefaultRoomScope("2026-09-19")} onOpenInReview={() => undefined} />);
  expect(screen.getAllByRole("table")).toHaveLength(1);
  expect(screen.getAllByRole("columnheader", { name: "市场" })).toHaveLength(1);
  expect(screen.getAllByRole("button", { name: "打开持仓回合复盘" })).toHaveLength(5);
  expect(screen.getAllByText("美股").length).toBeGreaterThan(0);
  expect(screen.getByText("A股·沪市")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "第2页" })).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "第2页" }));
  expect(screen.getAllByRole("button", { name: "打开持仓回合复盘" })).toHaveLength(5);
  expect(view.container.querySelectorAll("thead")).toHaveLength(1);
 });

 it("converts row values and CSV amounts to the selected report currency while prices stay local", () => {
  const value = entry();
  const fxSnapshot = { id: "fx-hkd", baseCurrency: "CNY" as const, asOf: "2026-09-19T00:00:00Z", source: "fixture", status: "complete" as const, rates: { "USD/CNY": "7", "HKD/CNY": "0.9", "CNY/CNY": "1" } };
  const scope = createDefaultRoomScope("2026-09-19");
  const model = buildCurrentPortfolio([value], { scope, asOf: "2026-09-19", quotesByInstrument: { "US:TEST": { price: "12", currency: "USD", quoteDate: "2026-09-19", fetchedAt: "2026-09-19T08:00:00.000Z", provider: "fixture", freshness: "current" } } });
  render(<RoomHoldingsPanel entries={[value]} portfolioModel={model} scope={scope} asOf="2026-09-19" reportCurrency="HKD" fxSnapshot={fxSnapshot} onOpenInReview={() => undefined} />);
  const holdings = screen.getByRole("region", { name: "当前持仓" });
  expect(holdings).toHaveTextContent("HK$186.67");
  expect(holdings).toHaveTextContent("US$10");
  const csv = holdingsCsv(model.rows, "2026-09-19", { reportCurrency: "HKD", fxSnapshot });
  expect(csv).toContain("HKD");
  expect(csv).toContain("HK$186.67");
  expect(csv).not.toContain("USD,\"$24.00\"");
 });

 it("keeps a missing target FX rate visible as unavailable instead of relabeling the source amount", () => {
  const value = entry();
  const scope = createDefaultRoomScope("2026-09-19");
  const partialFx = { id: "fx-partial", baseCurrency: "CNY" as const, asOf: "2026-09-19T00:00:00Z", source: "fixture", status: "partial" as const, rates: { "USD/CNY": "7" } };
  render(<RoomHoldingsPanel entries={[value]} scope={scope} asOf="2026-09-19" reportCurrency="HKD" fxSnapshot={partialFx} quotesByInstrument={{ "US:TEST": { price: "12", currency: "USD", quoteDate: "2026-09-19", fetchedAt: "2026-09-19T08:00:00.000Z", provider: "fixture", freshness: "current" } }} onOpenInReview={() => undefined} />);
  const holdings = screen.getByRole("region", { name: "当前持仓" });
  expect(holdings).toHaveTextContent("不可用（汇率快照不完整");
  expect(holdings).toHaveTextContent("US$10");
  expect(holdings).not.toHaveTextContent("HK$24");
 });

 it("shows an explicit empty state when search has no table matches", async () => {
  render(<RoomHoldingsPanel entries={[entry()]} scope={createDefaultRoomScope("2026-09-19")} onOpenInReview={() => undefined} />);
  await userEvent.type(screen.getByRole("searchbox", { name: "搜索持仓" }), "does-not-exist");
  expect(screen.getByText("没有匹配的持仓")).toBeInTheDocument();
  expect(screen.queryAllByRole("button", { name: "打开持仓回合复盘" })).toHaveLength(0);
 });

 it("exposes shell-owned query and one-based page changes for return navigation", async () => {
  const onBrowseStateChange = vi.fn();
  const entries = Array.from({ length: 7 }, (_, index) => entry(`account-${index + 1}`));
  function ControlledHoldings() {
    const [browseState, setBrowseState] = useState({ query: "", page: 1 });
    return <RoomHoldingsPanel entries={entries} scope={createDefaultRoomScope("2026-09-19")} browseState={browseState} onBrowseStateChange={next => { onBrowseStateChange(next); setBrowseState(next); }} onOpenInReview={() => undefined} />;
  }
  render(<ControlledHoldings />);
  await userEvent.click(screen.getByRole("button", { name: "第2页" }));
  expect(onBrowseStateChange).toHaveBeenCalledWith({ query: "", page: 2 });
  await userEvent.type(screen.getByRole("searchbox", { name: "搜索持仓" }), "account-7");
  expect(onBrowseStateChange).toHaveBeenLastCalledWith({ query: "account-7", page: 1 });
 });

 it("searches locally, paginates, preserves search on updated review props and opens the selected account episode", async () => {
  const entries=Array.from({length:7},(_,index)=>entry(`account-${index+1}`));
  const scope=createDefaultRoomScope("2026-09-19"); const open=vi.fn();
  const props={entries,scope,asOf:"2026-09-19",onOpenInReview:open};
  const view=render(<RoomHoldingsPanel {...props} />);
  expect(screen.getAllByRole("button",{name:"打开持仓回合复盘"})).toHaveLength(5);
  await userEvent.click(screen.getByRole("button",{name:"下一页持仓"}));
  expect(screen.getAllByRole("button",{name:"打开持仓回合复盘"})).toHaveLength(2);
  await userEvent.type(screen.getByRole("searchbox",{name:"搜索持仓"}),"account-7");
  expect(screen.getAllByRole("button",{name:"打开持仓回合复盘"})).toHaveLength(1);
  await userEvent.click(screen.getByRole("button",{name:"打开持仓回合复盘"}));
  expect(open).toHaveBeenCalledWith("US:TEST","episode:holding:account-7",["episode:holding:account-7"]);
  entries[6].episodes[0].review={version:1,episodeId:"episode:holding:account-7",instrumentId:"US:TEST",updatedAt:"2026-09-19T10:00:00Z",plan:{thesis:"观察现金流",expectedPath:"",invalidationCondition:"",targetRange:"",plannedRiskAmount:"",confidence:null},review:{decisionQuality:null,executionQuality:null,riskManagement:"",psychology:"",reusableRule:"",completed:false,keyDecision:"保持仓位"},confirmedTagIds:[]};
  view.rerender(<RoomHoldingsPanel {...props} entries={[...entries]} />);
  expect(screen.getByRole("searchbox",{name:"搜索持仓"})).toHaveValue("account-7");
  expect(screen.getByText("保持仓位")).toBeInTheDocument();
  expect(screen.getByText("2026-09-19T10:00:00Z")).toBeInTheDocument();
 });
 it("exports every filtered row with unavailable fields, as-of and formula-safe text", () => {
  const entries=Array.from({length:7},(_,index)=>entry(`account-${index+1}`));
  entries[0].instrument.name='=HYPERLINK("bad")';
  const model=buildCurrentPortfolio(entries,{scope:createDefaultRoomScope("2026-09-19"),asOf:"2026-09-19"});
  const csv=holdingsCsv(model.rows,"2026-09-19");
  expect(csv.split("\r\n")).toHaveLength(8);
  expect(csv).toContain("'=HYPERLINK"); expect(csv).toContain("不可用");expect(csv).toContain("2026-09-19");expect(csv).toContain("USD");
 });
});

it("uses only real raw 30-day prices and preserves missing sessions as gaps", () => {
 const model=buildCurrentPortfolio([entry()],{scope:createDefaultRoomScope("2026-09-19"),asOf:"2026-09-19"});
 const candle={instrumentId:"US:TEST",tradingDate:"2026-09-17",open:"11",high:"11",low:"11",close:"11",volume:"1",currency:"USD",provider:"yahoo" as const,providerSymbol:"TEST",adjustmentMode:"raw" as const,fetchedAt:"2026-09-19"};
 const points=holdingPriceSeries(model.rows[0].holding,[candle,{...candle,tradingDate:"2026-09-21",close:"99"},{...candle,tradingDate:"2026-08-01",close:"88"}],"2026-09-19");
 expect(points.find(point=>point.date==="2026-09-17")?.value).toBe(11);
 expect(points.find(point=>point.date==="2026-09-18")?.value).toBeNull();
 expect(points.filter(point=>point.value!==null)).toHaveLength(1);
});

it("refreshes the latest persisted Recall summary and snapshot fallback without a legacy review write", () => {
  const value = entry();
  value.episodes[0].recallReview = { episodeId: "episode:holding", status: "in-progress", updatedAt: "2026-09-19T09:00:00Z", text: "真实Recall记录", snapshotCount: 1 };
  const props = { scope:createDefaultRoomScope("2026-09-19"), asOf:"2026-09-19", onOpenInReview:vi.fn() };
  const view = render(<RoomHoldingsPanel {...props} entries={[value]} />);
  expect(screen.getByText("真实Recall记录")).toBeInTheDocument();
  expect(screen.getByText("2026-09-19T09:00:00Z")).toBeInTheDocument();
  value.episodes[0].recallReview = { ...value.episodes[0].recallReview, status:"completed", updatedAt:"2026-09-19T10:00:00Z", text:"", snapshotCount:3 };
  view.rerender(<RoomHoldingsPanel {...props} entries={[{...value}]} />);
  expect(screen.getByText("已留存3份快照")).toBeInTheDocument();
  expect(screen.queryByText("真实Recall记录")).not.toBeInTheDocument();
  expect(value.episodes[0].review).toBeUndefined();
});
