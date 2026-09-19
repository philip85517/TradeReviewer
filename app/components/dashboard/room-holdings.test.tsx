import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { TradeLibraryEntry } from "../../lib/trades/library";
import { buildRoomDateRange, createDefaultRoomScope, type TradingRoomInstrumentMetadata } from "../../lib/reviews/trading-room-scope";
import { RoomHoldingsPanel } from "./room-holdings";

afterEach(cleanup);

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

  it("explains missing quote without inventing a current price or PnL", () => {
    const value = entry();
    const scope = { ...createDefaultRoomScope("2026-09-19"), period: buildRoomDateRange("month", "2026-09-19") };
    render(<RoomHoldingsPanel entries={[value]} scope={scope} onOpenInReview={() => undefined} />);
    const holdings = screen.getByRole("region", { name: "当前持仓" });
    expect(holdings).toHaveTextContent("缺少行情");
    expect(holdings).toHaveTextContent("浮盈亏不可用");
    expect(holdings).not.toHaveTextContent("+US$999.00");
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
