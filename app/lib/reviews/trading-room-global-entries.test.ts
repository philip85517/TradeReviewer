import { describe, expect, it } from "vitest";

import type { TradeLibraryEntry } from "../trades/library";
import type { Instrument, TradeExecution } from "../trades/types";
import { buildGlobalNotifications, searchGlobalInstruments } from "./trading-room-global-entries";

const baseInstrument: Instrument = {
  id: "HK:0005",
  symbol: "0005",
  name: "汇丰控股",
  market: "HK",
  currency: "HKD",
};

function entry(options: {
  id?: string;
  accountId?: string;
  nature?: "live" | "simulation" | "unknown";
  runId?: string;
  status?: "open" | "closed";
  pending?: boolean;
  accuracy?: boolean;
  market?: string;
} = {}): TradeLibraryEntry {
  const instrument = options.market ? { ...baseInstrument, id: options.market, symbol: options.market } : baseInstrument;
  const execution: TradeExecution = {
    id: `${options.id ?? instrument.id}:buy`,
    accountId: options.accountId ?? "account-1",
    accountLabel: "主账户",
    instrument,
    side: "buy",
    executedAt: "2026-01-04T00:00:00.000Z",
    quantity: "1",
    price: "10",
    fee: "0",
    source: {
      platform: "fixture",
      row: 1,
      tradeNature: options.nature ?? "live",
      ...(options.runId ? { simulationRunId: options.runId } : {}),
      ...(options.accuracy ? { historyIncomplete: ["statement-1"] } : {}),
    },
  };
  const episode = {
    id: `${options.id ?? instrument.id}:episode`,
    accountId: execution.accountId,
    accountLabel: execution.accountLabel,
    instrument,
    tradeNature: options.nature ?? "live",
    ...(options.runId ? { simulationRunId: options.runId } : {}),
    direction: "long" as const,
    status: options.status ?? "closed",
    startedAt: execution.executedAt,
    endedAt: "2026-01-05T00:00:00.000Z",
    openingQuantity: "1",
    remainingQuantity: options.status === "open" ? "1" : "0",
    executions: [execution],
    ...(options.accuracy ? { accuracy: { pnl: "unavailable" as const, reasons: ["history-incomplete"] } } : {}),
  };
  return {
    groupId: `${instrument.id}|${execution.accountId}`,
    tradeNature: options.nature ?? "live",
    simulationRunId: options.runId,
    instrument,
    executions: [execution],
    episodes: [{
      episode,
      metrics: {
        buyCount: 1, sellCount: 0, boughtQuantity: "1", soldQuantity: "0", grossExposure: "10", fees: "0",
        realizedPnl: "0", unrealizedPnl: null, netPnl: "0", returnPercent: null, holdingMilliseconds: null,
      },
      review: options.pending === false ? { review: { completed: true } } as never : undefined,
      reviewStatus: options.pending === false ? "completed" : "pending",
      confirmedTagIds: [], tagDictionaryVersion: 1, rMultiple: null,
    }],
    accountCount: 1, tradeCount: 1, episodeCount: 1, firstTradeAt: execution.executedAt, lastTradeAt: execution.executedAt,
    status: options.status ?? "closed", netPnl: options.accuracy ? null : "0", returnPercent: null, reviewedEpisodeCount: options.pending === false ? 1 : 0,
    confirmedTagIds: [], cumulativeR: null,
  };
}

describe("trading-room-global-entries", () => {
  it("searches all dates in the current identity and keeps the exact instrument", () => {
    const rows = [entry(), entry({ market: "US:AAPL" }), entry({ nature: "simulation", runId: "run-a", market: "SIM:0005" })];
    const result = searchGlobalInstruments(rows, { nature: "live", accountIds: [], simulationRunId: null }, "0005");
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(expect.objectContaining({ instrumentId: "HK:0005", symbol: "0005", episodeId: "HK:0005:episode" }));
  });

  it("requires one simulation run instead of merging runs", () => {
    const rows = [entry({ nature: "simulation", runId: "run-a" }), entry({ nature: "simulation", runId: "run-b", market: "SIM:0005" })];
    expect(searchGlobalInstruments(rows, { nature: "simulation", accountIds: [], simulationRunId: null }, "0005")).toEqual([]);
    expect(searchGlobalInstruments(rows, { nature: "simulation", accountIds: [], simulationRunId: "run-a" }, "0005")).toHaveLength(1);
  });

  it("builds real data, market, and pending review items without dashboard date filters", () => {
    const rows = [entry({ accuracy: true }), entry({ pending: false, market: "US:AAPL" })];
    const result = buildGlobalNotifications(rows, { nature: "live", accountIds: [], simulationRunId: null }, { marketDataStatuses: { "HK:0005": "partial", "US:AAPL": "complete" } });
    expect(result.state).toBe("ready");
    expect(result.items.map(item => item.kind)).toEqual(["data", "market", "pending-review"]);
    expect(result.items.find(item => item.kind === "pending-review")?.episodeId).toBe("HK:0005:episode");
  });

  it("keeps open holding data issues and de-duplicates market notices by instrument", () => {
    const openIssue = entry({ id: "open-issue", status: "open", accuracy: true });
    const sameInstrumentSecondAccount = entry({ id: "second-account", accountId: "account-2" });
    const result = buildGlobalNotifications(
      [openIssue, sameInstrumentSecondAccount],
      { nature: "live", accountIds: [], simulationRunId: null },
      { marketDataStatuses: { "HK:0005": "partial" } },
    );
    expect(result.items.filter(item => item.kind === "data")).toHaveLength(1);
    expect(result.items.filter(item => item.kind === "market")).toHaveLength(1);
    expect(result.items.find(item => item.kind === "data")?.description).toContain("证据待核对");
  });

  it("does not report zero items when a simulation run is not selected", () => {
    const result = buildGlobalNotifications([entry({ nature: "simulation", runId: "run-a" })], { nature: "simulation", accountIds: [], simulationRunId: null });
    expect(result).toEqual({ state: "needs-scope", items: [] });
  });
});
