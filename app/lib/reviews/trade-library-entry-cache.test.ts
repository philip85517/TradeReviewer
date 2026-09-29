import { describe, expect, it } from "vitest";

import type { DailyCandleRecord } from "../market/contracts";
import { buildInstrumentTradeSummaries } from "../trades/instruments";
import { buildTradeLibraryEntries } from "../trades/library";
import type { TradeExecution } from "../trades/types";
import { buildCachedTradeLibraryEntries } from "./trade-library-entry-cache";

function execution(id: string, instrument: TradeExecution["instrument"]): TradeExecution {
  return {
    id,
    instrument,
    accountId: "account-1",
    accountLabel: "测试账户",
    source: { platform: "fixture", row: 1 },
    side: "buy",
    executedAt: "2026-01-02T14:30:00.000Z",
    quantity: "1",
    price: "10",
    fee: "0",
  };
}

describe("trade library entry cache", () => {
  it("reuses entries for instruments whose daily input did not change", () => {
    const xpev = { id: "US:XPEV", symbol: "XPEV", name: "小鹏汽车", market: "US", currency: "USD" } as const;
    const msft = { id: "US:MSFT", symbol: "MSFT", name: "微软", market: "US", currency: "USD" } as const;
    const summaries = buildInstrumentTradeSummaries([execution("xpev-buy", xpev), execution("msft-buy", msft)]);
    const statuses = { "US:XPEV": "ready" as const, "US:MSFT": "ready" as const };
    const unchangedMsft: DailyCandleRecord[] = [];
    const reviews = {};
    const recallSummaries = {};
    const first = buildCachedTradeLibraryEntries(undefined, summaries, { "US:XPEV": [], "US:MSFT": unchangedMsft }, statuses, reviews, recallSummaries);
    const changedXpev = [{
      instrumentId: "US:XPEV",
      tradingDate: "2026-01-02",
      open: "10",
      high: "11",
      low: "9",
      close: "10.5",
      volume: "1",
      currency: "USD",
      provider: "yahoo" as const,
      providerSymbol: "XPEV",
      adjustmentMode: "raw" as const,
      fetchedAt: "2026-01-03T00:00:00.000Z",
    }];
    const second = buildCachedTradeLibraryEntries(first.cache, summaries, { "US:XPEV": changedXpev, "US:MSFT": unchangedMsft }, statuses, reviews, recallSummaries);
    expect(second.entries.find(entry => entry.instrument.id === "US:XPEV")).not.toBe(first.entries.find(entry => entry.instrument.id === "US:XPEV"));
    expect(second.entries.find(entry => entry.instrument.id === "US:MSFT")).toBe(first.entries.find(entry => entry.instrument.id === "US:MSFT"));
  });

  it("keeps the canonical library order while reusing per-instrument entries", () => {
    const early = { id: "US:AAA", symbol: "AAA", name: "早期标的", market: "US", currency: "USD" } as const;
    const late = { id: "US:BBB", symbol: "BBB", name: "晚期标的", market: "US", currency: "USD" } as const;
    const scoped = { id: "US:CCC", symbol: "CCC", name: "同日标的", market: "US", currency: "USD" } as const;
    const executions = [
      execution("early-buy", early),
      { ...execution("late-buy", late), executedAt: "2026-01-03T14:30:00.000Z" },
      {
        ...execution("scope-a", scoped),
        executedAt: "2026-01-02T14:30:00.000Z",
        source: { ...execution("scope-a-source", scoped).source, tradingNature: "simulated" as const, simulationRunId: "run-a" },
      },
      {
        ...execution("scope-b", scoped),
        executedAt: "2026-01-02T14:30:00.000Z",
        source: { ...execution("scope-b-source", scoped).source, tradingNature: "simulated" as const, simulationRunId: "run-b" },
      },
    ];
    const summaries = buildInstrumentTradeSummaries(executions);
    const candles: Record<string, DailyCandleRecord[]> = {
      "US:AAA": [],
      "US:BBB": [],
      "US:CCC": [],
    };
    const statuses = {
      "US:AAA": "ready" as const,
      "US:BBB": "ready" as const,
      "US:CCC": "ready" as const,
    };
    const expected = buildTradeLibraryEntries(summaries, candles, statuses);
    const actual = buildCachedTradeLibraryEntries(undefined, summaries, candles, statuses);

    expect(actual.entries).toEqual(expected);
    expect(actual.entries.map(entry => `${entry.instrument.symbol}:${entry.scopeKey ?? ""}`))
      .toEqual(expected.map(entry => `${entry.instrument.symbol}:${entry.scopeKey ?? ""}`));
  });
});
