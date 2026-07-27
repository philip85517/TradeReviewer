import { describe, expect, it } from "vitest";

import type { DailyCandleRecord } from "../market/contracts";
import { buildInstrumentTradeSummaries } from "./instruments";
import { buildTradeLibraryEntries } from "./library";
import type { Instrument, TradeExecution } from "./types";

const xpev: Instrument = {
  id: "US:XPEV",
  symbol: "XPEV",
  name: "小鹏汽车",
  market: "US",
  currency: "USD",
};

const xiaomi: Instrument = {
  id: "HK:1810",
  symbol: "1810",
  name: "小米集团-W",
  market: "HK",
  currency: "HKD",
};

function fill(
  instrument: Instrument,
  accountId: string,
  side: "buy" | "sell",
  executedAt: string,
  quantity: string,
  price: string,
): TradeExecution {
  return {
    id: `${instrument.id}-${accountId}-${side}-${executedAt}`,
    source: { platform: "fixture", row: 1 },
    accountId,
    accountLabel: accountId === "a" ? "主账户" : "备用账户",
    instrument,
    side,
    executedAt,
    quantity,
    price,
    fee: "0",
  };
}

function candle(
  instrumentId: string,
  tradingDate: string,
  close: string,
): DailyCandleRecord {
  return {
    instrumentId,
    tradingDate,
    open: close,
    high: close,
    low: close,
    close,
    volume: "1000",
    currency: instrumentId.startsWith("HK:") ? "HKD" : "USD",
    provider: "tencent",
    providerSymbol: instrumentId,
    adjustmentMode: "raw",
    fetchedAt: "2025-02-01T00:00:00Z",
  };
}

describe("buildTradeLibraryEntries", () => {
  it("separates account episodes, rolls up marked PnL, and sorts recent stocks first", () => {
    const summaries = buildInstrumentTradeSummaries([
      fill(xpev, "a", "buy", "2025-01-02T14:30:00Z", "100", "10"),
      fill(xpev, "a", "sell", "2025-01-03T14:30:00Z", "100", "12"),
      fill(xpev, "b", "buy", "2025-01-05T14:30:00Z", "50", "20"),
      fill(xiaomi, "a", "buy", "2025-01-10T02:00:00Z", "10", "30"),
    ]);

    const entries = buildTradeLibraryEntries(summaries, {
      "US:XPEV": [candle("US:XPEV", "2025-01-06", "22")],
      "HK:1810": [candle("HK:1810", "2025-01-10", "31")],
    }, {
      "US:XPEV": "complete",
      "HK:1810": "complete",
    });

    expect(entries.map((entry) => entry.instrument.id)).toEqual([
      "HK:1810",
      "US:XPEV",
    ]);
    const entry = entries[1];
    expect(entry).toMatchObject({
      accountCount: 2,
      tradeCount: 3,
      episodeCount: 2,
      status: "open",
      netPnl: "300",
      returnPercent: "15",
    });
    expect(entry.episodes.map(({ episode }) => episode.accountId)).toEqual([
      "b",
      "a",
    ]);
  });

  it("leaves aggregate PnL unknown when an open episode has no local mark", () => {
    const summaries = buildInstrumentTradeSummaries([
      fill(xpev, "a", "buy", "2025-01-02T14:30:00Z", "100", "10"),
    ]);

    const [entry] = buildTradeLibraryEntries(
      summaries,
      {},
      { "US:XPEV": "complete" },
    );

    expect(entry.netPnl).toBeNull();
    expect(entry.returnPercent).toBeNull();
  });

  it("does not mark an open episode with pre-trade or partial candles", () => {
    const summaries = buildInstrumentTradeSummaries([
      fill(xpev, "a", "buy", "2025-01-10T14:30:00Z", "100", "10"),
    ]);

    const [stale] = buildTradeLibraryEntries(
      summaries,
      { "US:XPEV": [candle("US:XPEV", "2025-01-01", "22")] },
      { "US:XPEV": "complete" },
    );
    const [partial] = buildTradeLibraryEntries(
      summaries,
      { "US:XPEV": [candle("US:XPEV", "2025-01-11", "22")] },
      { "US:XPEV": "partial" },
    );

    expect(stale.netPnl).toBeNull();
    expect(partial.netPnl).toBeNull();
  });

  it("requires a complete mark on or after the latest add-on trading day", () => {
    const summaries = buildInstrumentTradeSummaries([
      fill(xpev, "a", "buy", "2025-01-10T14:30:00Z", "100", "10"),
      fill(xpev, "a", "buy", "2025-01-13T14:30:00Z", "100", "12"),
    ]);

    const [entry] = buildTradeLibraryEntries(
      summaries,
      { "US:XPEV": [candle("US:XPEV", "2025-01-10", "22")] },
      { "US:XPEV": "complete" },
    );

    expect(entry.netPnl).toBeNull();
  });

  it("uses the market-local date when validating an open mark", () => {
    const summaries = buildInstrumentTradeSummaries([
      fill(xpev, "a", "buy", "2025-01-01T01:00:00Z", "100", "10"),
    ]);

    const [entry] = buildTradeLibraryEntries(
      summaries,
      { "US:XPEV": [candle("US:XPEV", "2024-12-31", "12")] },
      { "US:XPEV": "complete" },
    );

    expect(entry.netPnl).toBe("200");
  });
});
