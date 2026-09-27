import { describe, expect, it } from "vitest";

import type { TradeEpisodeMetrics } from "../trades/episode-metrics";
import type { TradeLibraryEntry, TradeLibraryEpisode } from "../trades/library";
import type { Instrument, TradeEpisode, TradeExecution } from "../trades/types";
import {
  buildPendingClosingFacts,
  buildPendingReviews,
  pendingFinalCloseDate,
  roomFiltersFromScope,
} from "./trading-room-pending";
import { DEFAULT_ROOM_SCOPE, type TradingRoomRow } from "./trading-room-scope";

const instrument: Instrument = {
  id: "US:NVDA",
  symbol: "NVDA",
  name: "英伟达",
  market: "US",
  currency: "USD",
};

function fill(
  id: string,
  side: "buy" | "sell",
  quantity: string,
  price: string,
  tradingDate: string,
): TradeExecution {
  return {
    id,
    source: { platform: "fixture", row: 1, tradingDate },
    accountId: "qa-main",
    accountLabel: "QA 主账户",
    instrument,
    side,
    executedAt: `${tradingDate}T15:00:00Z`,
    quantity,
    price,
    fee: "0",
  };
}

function episode(executions: TradeExecution[], direction: "long" | "short" = "long"): TradeEpisode {
  return {
    id: "episode:pending",
    accountId: "qa-main",
    accountLabel: "QA 主账户",
    instrument,
    direction,
    status: "closed",
    startedAt: executions[0]!.executedAt,
    endedAt: executions.at(-1)!.executedAt,
    openingQuantity: direction === "long" ? "100" : "100",
    remainingQuantity: "0",
    executions,
  };
}

function trustedPendingRow(closePrice: string): TradingRoomRow {
  const executions = [
    fill("buy", "buy", "100", "100", "2026-02-01"),
    fill("sell", "sell", "100", closePrice, "2026-02-03"),
  ];
  const itemEpisode = episode(executions);
  const metrics: TradeEpisodeMetrics = {
    buyCount: 1,
    sellCount: 1,
    boughtQuantity: "100",
    soldQuantity: "100",
    grossExposure: "10000",
    fees: "0",
    realizedPnl: "1798",
    unrealizedPnl: "0",
    netPnl: "1798",
    returnPercent: "17.98",
    holdingMilliseconds: 172800000,
  };
  const item: TradeLibraryEpisode = {
    episode: itemEpisode,
    metrics,
    reviewStatus: "pending",
    confirmedTagIds: [],
    tagDictionaryVersion: 1,
    rMultiple: null,
  };
  const entry: TradeLibraryEntry = {
    instrument,
    executions,
    episodes: [item],
    accountCount: 1,
    tradeCount: executions.length,
    episodeCount: 1,
    firstTradeAt: itemEpisode.startedAt,
    lastTradeAt: itemEpisode.endedAt ?? itemEpisode.startedAt,
    status: "closed",
    netPnl: "1798",
    returnPercent: "17.98",
    reviewedEpisodeCount: 0,
    confirmedTagIds: [],
    cumulativeR: null,
  };
  return {
    row: { entry, item },
    assetCategory: "us-stock",
    assetType: "stock",
    sourceNature: "live",
    closeDate: "2026-02-03",
    trustedPnl: "1798",
    exclusionReason: null,
    assetReason: null,
  };
}

describe("pending closing facts", () => {
  it("does not create a library room filter for an unconstrained homepage scope", () => {
    expect(roomFiltersFromScope({
      ...DEFAULT_ROOM_SCOPE,
      assetCategory: "all",
      assetType: "all",
      query: "  ",
      instrumentIds: [],
      markets: [],
      currencies: [],
      reviewStatuses: [],
    })).toBeNull();
  });

  it("aggregates every long closing fill by quantity and preserves the source currency", () => {
    const value = episode([
      fill("buy", "buy", "100", "100", "2026-02-01"),
      fill("sell-a", "sell", "40", "115", "2026-02-02"),
      fill("sell-b", "sell", "60", "120", "2026-02-03"),
    ]);

    expect(buildPendingClosingFacts(value)).toMatchObject({
      closingSide: "sell",
      quantity: "100",
      weightedPrice: "118",
      currency: "USD",
      reason: null,
    });
    expect(pendingFinalCloseDate(value)).toBe("2026-02-03");
  });

  it("uses only the episode-owned quantity when a fill crosses zero", () => {
    const value = episode([
      fill("buy", "buy", "40", "100", "2026-02-01"),
      fill("cross-zero", "sell", "100", "120", "2026-02-03"),
    ]);

    expect(buildPendingClosingFacts(value)).toMatchObject({
      closingSide: "sell",
      quantity: "100",
      weightedPrice: "120",
    });
  });

  it("uses buy-to-cover for a short episode and refuses malformed price evidence", () => {
    const short = episode([
      fill("sell", "sell", "100", "130", "2026-02-01"),
      fill("buy", "buy", "100", "120", "2026-02-02"),
    ], "short");
    expect(buildPendingClosingFacts(short)).toMatchObject({
      closingSide: "buy",
      quantity: "100",
      weightedPrice: "120",
    });

    const malformed = episode([
      fill("buy", "buy", "100", "100", "2026-02-01"),
      fill("bad-close", "sell", "100", "not-a-price", "2026-02-02"),
    ]);
    expect(buildPendingClosingFacts(malformed)).toMatchObject({
      closingSide: "sell",
      quantity: "100",
      weightedPrice: null,
      reason: "closing-price-unavailable",
    });

    const missingQuantity = episode([
      fill("buy", "buy", "100", "100", "2026-02-01"),
      fill("missing-close-quantity", "sell", "", "120", "2026-02-02"),
    ]);
    expect(buildPendingClosingFacts(missingQuantity)).toMatchObject({
      closingSide: "sell",
      quantity: null,
      weightedPrice: null,
      reason: "closing-quantity-unavailable",
    });
  });

  it("keeps trusted round PnL when close-side price evidence is missing", () => {
    const result = buildPendingReviews([trustedPendingRow("")]);
    const row = result.rows[0];

    expect(row).toMatchObject({
      closingQuantity: "100",
      closingWeightedPrice: null,
      unavailableReason: "closing-price-unavailable",
    });
    expect(row?.money?.originalByCurrency).toEqual({ USD: "1798" });
  });

  it("keeps target conversion with a field gap and still excludes an untrusted PnL", () => {
    const fx = {
      id: "fx:pending",
      baseCurrency: "CNY" as const,
      asOf: "2026-02-04T00:00:00.000Z",
      source: "test",
      status: "complete" as const,
      rates: { "USD/CNY": "7", "HKD/CNY": "1" },
    };
    const converted = buildPendingReviews([trustedPendingRow("")], fx, "HKD").rows[0];
    expect(converted?.money).toMatchObject({
      originalByCurrency: { USD: "1798" },
      converted: "12586",
      targetCurrency: "HKD",
    });

    const untrusted = trustedPendingRow("");
    untrusted.trustedPnl = null;
    untrusted.exclusionReason = "missing-pnl";
    const unavailable = buildPendingReviews([untrusted]).rows[0];
    expect(unavailable?.money).toBeNull();
    expect(unavailable?.unavailableReason).toContain("缺少净盈亏");
  });
});
