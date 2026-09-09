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
  it("does not certify net profit when a reported fee is missing", () => {
    const buy = fill("buy", "2025-01-02T14:30:00Z", "1", "10", "0");
    buy.source.feeStatus = "unknown";
    const [episode] = buildTradeEpisodes([buy, fill("sell", "2025-01-09T14:30:00Z", "1", "12", "0")]);
    expect(episode.accuracy?.reasons).toContain("unknown-fees");
    expect(summarizeTradeEpisode(episode)).toMatchObject({ pnlAvailable: false, netPnl: null, returnPercent: null });
  });
  it("does not report sale proceeds as profit when acquisition history is missing", () => {
    const sale = fill("sell", "2025-01-09T14:30:00Z", "100", "12", "3");
    sale.source.openingPosition = { accountId: "acct-1", market: "US", symbol: "XPEV", phase: "opening", date: "2025-01-01", quantity: "100", source: [] };
    expect(summarizeTradeEpisode(buildTradeEpisodes([sale])[0], "13")).toMatchObject({ pnlAvailable: false, netPnl: null, unrealizedPnl: null, returnPercent: null, holdingMilliseconds: null });
  });
  it("uses settlement amounts when statement average prices are rounded",()=>{
    const buy=fill("buy","2025-01-01T07:00:00Z","300","76.087","5");
    buy.source.settlement={currency:"USD",quantity:"300",grossAmount:"22826",netAmount:"-22831",fees:{commission:"5"}};
    const sell=fill("sell","2025-01-02T07:00:00Z","300","80","5");
    const [episode]=buildTradeEpisodes([buy,sell]);
    expect(summarizeTradeEpisode(episode)).toMatchObject({grossExposure:"22826",netPnl:"1164"});
  });
  it("allocates original settlement across a split closing and reversing fill",()=>{
    const buy=fill("buy","2025-01-01T07:00:00Z","100","10","0");
    const sell=fill("sell","2025-01-02T07:00:00Z","200","11","0");
    sell.source.settlement={currency:"USD",quantity:"200",grossAmount:"2201",netAmount:"2201",fees:{}};
    const episodes=buildTradeEpisodes([buy,sell]);
    expect(summarizeTradeEpisode(episodes[0]).netPnl).toBe("100.5");
    expect(summarizeTradeEpisode(episodes[1]).grossExposure).toBe("1100.5");
  });

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
