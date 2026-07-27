import { describe, expect, it } from "vitest";

import { buildTradeEpisodes } from "./episodes";
import { summarizeTradeEpisode } from "./episode-metrics";
import type { TradeExecution } from "./types";

function fill(
  side: "buy" | "sell",
  executedAt: string,
  quantity: string,
  price: string,
  fee: string,
): TradeExecution {
  return {
    id: `${side}-${executedAt}-${quantity}`,
    source: { platform: "fixture", row: 1 },
    accountId: "acct-1",
    accountLabel: "主账户",
    instrument: {
      id: "US:XPEV",
      symbol: "XPEV",
      name: "小鹏汽车",
      market: "US",
      currency: "USD",
    },
    side,
    executedAt,
    quantity,
    price,
    fee,
  };
}

describe("summarizeTradeEpisode", () => {
  it("calculates fee-adjusted PnL and return for a closed long episode", () => {
    const [episode] = buildTradeEpisodes([
      fill("buy", "2025-01-02T14:30:00Z", "100", "10", "2"),
      fill("sell", "2025-01-09T14:30:00Z", "100", "12", "3"),
    ]);

    expect(summarizeTradeEpisode(episode)).toEqual({
      buyCount: 1,
      sellCount: 1,
      boughtQuantity: "100",
      soldQuantity: "100",
      grossExposure: "1000",
      fees: "5",
      realizedPnl: "200",
      unrealizedPnl: "0",
      netPnl: "195",
      returnPercent: "19.5",
      holdingMilliseconds: 604_800_000,
    });
  });

  it("marks an open episode only when a local closing price is supplied", () => {
    const [episode] = buildTradeEpisodes([
      fill("buy", "2025-01-02T14:30:00Z", "100", "10", "2"),
      fill("sell", "2025-01-03T14:30:00Z", "40", "12", "1"),
    ]);

    expect(summarizeTradeEpisode(episode)).toMatchObject({
      realizedPnl: "80",
      unrealizedPnl: null,
      netPnl: null,
      returnPercent: null,
    });
    expect(summarizeTradeEpisode(episode, "11")).toMatchObject({
      realizedPnl: "80",
      unrealizedPnl: "60",
      netPnl: "137",
      returnPercent: "13.7",
    });
  });

  it("uses signed cash flow for exact open net PnL", () => {
    const [episode] = buildTradeEpisodes([
      fill("buy", "2025-01-02T14:30:00Z", "1", "10", "0"),
      fill("buy", "2025-01-03T14:30:00Z", "2", "11", "0"),
      fill("sell", "2025-01-04T14:30:00Z", "1", "12", "0"),
    ]);

    expect(summarizeTradeEpisode(episode, "11")).toMatchObject({
      netPnl: "2",
    });
  });
});
