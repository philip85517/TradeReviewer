import { createEmptyEpisodeReviewRecord } from "../reviews/review-metrics";
import { parseBrokerStatement } from "../import/dispatcher";
import { fileFor } from "../import/__fixtures__/tradingview";
import { describe, expect, it } from "vitest";

import type { DailyCandleRecord } from "../market/contracts";
import type { EpisodeReviewRecord } from "../reviews/types";
import { buildInstrumentTradeSummaries } from "./instruments";
import { buildTradeEpisodes } from "./episodes";
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
  it("uses the canonical broker nature for display without changing historical episode scope", () => {
    const executions = [
      fill(xpev, "a", "buy", "2025-01-02T14:30:00Z", "100", "10"),
      fill(xpev, "a", "sell", "2025-01-03T14:30:00Z", "100", "11"),
    ];
    executions.forEach((execution) => {
      execution.source.platform = "futu";
    });
    const historicalEpisode = buildTradeEpisodes(executions)[0];

    const [entry] = buildTradeLibraryEntries(
      buildInstrumentTradeSummaries(executions),
      {},
      { "US:XPEV": "source-unavailable" },
    );

    expect(entry).toMatchObject({
      tradeNature: "live",
      tradingLabel: "实盘",
    });
    expect(entry.scopeKey).toBeUndefined();
    expect(entry.episodes[0].episode).toMatchObject({
      id: historicalEpisode.id,
      tradeNature: "unknown",
    });
  });

  it("keeps live and simulated summaries separate for the same instrument", () => {
    const liveEntry = fill(xpev, "a", "buy", "2025-01-02T14:30:00Z", "100", "10");
    liveEntry.source.tradeNature = "live";
    const liveExit = fill(xpev, "a", "sell", "2025-01-03T14:30:00Z", "100", "11");
    liveExit.source.tradeNature = "live";
    const simulationEntry = fill(xpev, "simulation-account", "buy", "2025-01-02T14:30:00Z", "100", "10");
    simulationEntry.source = {
      ...simulationEntry.source,
      platform: "tradingview",
      tradeNature: "simulation",
      simulationRunId: "tradingview:run-a",
    };
    const simulationExit = fill(xpev, "simulation-account", "sell", "2025-01-03T14:30:00Z", "100", "12");
    simulationExit.source = {
      ...simulationExit.source,
      platform: "tradingview",
      tradeNature: "simulation",
      simulationRunId: "tradingview:run-a",
    };

    const entries = buildTradeLibraryEntries(
      buildInstrumentTradeSummaries([liveEntry, liveExit, simulationEntry, simulationExit]),
      {},
      { "US:XPEV": "complete" },
    );

    expect(entries).toHaveLength(2);
    expect(entries.map((entry) => entry.tradeNature).sort()).toEqual([
      "live",
      "simulation",
    ]);
    expect(entries.map((entry) => entry.tradeCount).sort()).toEqual([2, 2]);
    expect(entries.map((entry) => entry.netPnl).sort()).toEqual(["100", "200"]);
  });

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

  it("rejects pre-trade marks but values valid closes independently of coverage", () => {
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
    expect(partial.netPnl).toBe("1200");
  });

  it("projects a valid local quote and values holdings with partial coverage", () => {
    const summaries = buildInstrumentTradeSummaries([
      fill(xpev, "a", "buy", "2025-01-02T14:30:00Z", "100", "10"),
    ]);

    const [entry] = buildTradeLibraryEntries(
      summaries,
      { "US:XPEV": [candle("US:XPEV", "2025-01-06", "22")] },
      { "US:XPEV": "partial" },
    );

    expect(entry.latestQuote).toMatchObject({
      price: "22",
      currency: "USD",
      quoteDate: "2025-01-06",
      provider: "tencent",
      status: "partial",
    });
    expect(entry.netPnl).toBe("1200");
  });

  it("requires a valid mark on or after the latest add-on trading day", () => {
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

  it("values the approved current holdings examples without relaxing cost trust", () => {
    const ganli: Instrument = { id: "CN-SH:603087", symbol: "603087", name: "甘李药业", market: "CN-SH", currency: "CNY" };
    const sndk: Instrument = { ...xpev, id: "US:SNDK", symbol: "SNDK" };
    const executions = [
      fill(ganli, "a", "buy", "2026-08-27T07:00:00Z", "300", "71.28"),
      fill(sndk, "a", "buy", "2026-08-12T18:14:39Z", "2", "1363"),
      fill(sndk, "a", "sell", "2026-08-17T14:00:00Z", "1", "1789.63"),
    ];
    const entries = buildTradeLibraryEntries(buildInstrumentTradeSummaries(executions), {
      [ganli.id]: [{ ...candle(ganli.id, "2026-11-20", "60.860"), currency: "CNY" }],
      [sndk.id]: [candle(sndk.id, "2026-11-20", "79.240")],
    }, { [ganli.id]: "latest-available", [sndk.id]: "partial" });
    expect(entries.find(entry => entry.instrument.id === ganli.id)?.episodes[0].metrics.unrealizedPnl).toBe("-3126");
    const projected = entries.find(entry => entry.instrument.id === sndk.id)!;
    expect(projected.episodes[0].metrics.unrealizedPnl).toBe("-729.08");
    expect(projected.episodes[0].valuationNote).toContain("拆股推算");
    expect(projected.executions).toEqual(executions.filter(fill => fill.instrument.id === sndk.id));
    executions[0].source.feeStatus = "unknown";
    expect(buildTradeLibraryEntries(buildInstrumentTradeSummaries(executions), {
      [ganli.id]: [{ ...candle(ganli.id, "2026-11-20", "60.860"), currency: "CNY" }],
    }, {}) .find(entry => entry.instrument.id === ganli.id)?.episodes[0].metrics.unrealizedPnl).toBeNull();
  });

  it("rejects invalid local closes and mixed split-unit executions", () => {
    const sndk: Instrument = { ...xpev, id: "US:SNDK", symbol: "SNDK" };
    const mixed = buildInstrumentTradeSummaries([
      fill(sndk, "a", "buy", "2026-08-12T18:00:00Z", "2", "1363"),
      fill(sndk, "a", "buy", "2026-11-20T15:00:00Z", "1", "79.24"),
    ]);
    expect(buildTradeLibraryEntries(mixed, { [sndk.id]: [candle(sndk.id, "2026-11-20", "79.24")] }, {})[0].netPnl).toBeNull();
    const summaries = buildInstrumentTradeSummaries([fill(xpev, "a", "buy", "2025-01-10T14:30:00Z", "100", "10")]);
    for (const price of ["0", "-1", "NaN", "Infinity", "invalid"]) {
      expect(buildTradeLibraryEntries(summaries, { [xpev.id]: [candle(xpev.id, "2025-01-11", price)] }, {})[0].netPnl).toBeNull();
    }
  });

  it("projects confirmed review status, tags, and exact R by episode id", () => {
    const executions = [
      fill(xpev, "a", "buy", "2025-01-02T14:30:00Z", "100", "10"),
      fill(xpev, "a", "sell", "2025-01-03T14:30:00Z", "100", "12"),
    ];
    const [episode] = buildTradeEpisodes(executions);
    const review: EpisodeReviewRecord = {
      version: 1,
      episodeId: episode.id,
      instrumentId: "US:XPEV",
      updatedAt: "2025-01-04T00:00:00.000Z",
      plan: {
        thesis: "等待突破",
        expectedPath: "",
        invalidationCondition: "",
        targetRange: "",
        plannedRiskAmount: "100",
        confidence: 4,
      },
      review: {
        decisionQuality: 4,
        executionQuality: 4,
        riskManagement: "",
        psychology: "",
        reusableRule: "",
        completed: true,
      },
      confirmedTagIds: ["breakout", "planned"],
    };

    const [entry] = buildTradeLibraryEntries(
      buildInstrumentTradeSummaries(executions),
      {},
      { "US:XPEV": "complete" },
      { [episode.id]: review },
    );

    expect(entry).toMatchObject({
      reviewedEpisodeCount: 1,
      confirmedTagIds: ["breakout", "planned"],
      cumulativeR: "2",
    });
    expect(entry.episodes[0]).toMatchObject({
      reviewStatus: "completed",
      confirmedTagIds: ["breakout", "planned"],
      rMultiple: "2",
      review,
    });
  });
});

 it("separates simulation statistics from live trades for the same security", async () => {
   const {records}=await parseBrokerStatement(fileFor());
   const live=records.map(r=>({...r,id:'live:'+r.id,source:{platform:'futu',row:r.source.row},accountId:'live'}));
   const entries=buildTradeLibraryEntries(buildInstrumentTradeSummaries([...records,...live]),{},{});
   expect(entries).toHaveLength(2);
   expect(entries.map(e=>e.tradeCount)).toEqual([2,2]);
   expect(entries.every(e=>e.netPnl==='99.4')).toBe(true);
 });

describe("persisted Recall library projection", () => {
  it.each(["completed", "in-progress", "needs-confirmation"] as const)("uses saved %s state over legacy completion", status => {
    const fills = [fill(xpev, "a", "buy", "2026-09-01", "2", "10"), fill(xpev, "a", "sell", "2026-09-02", "2", "12")];
    const summaries = buildInstrumentTradeSummaries(fills);
    const episodeId = buildTradeEpisodes(fills)[0].id;
    const recall = { episodeId, status, updatedAt: "2026-09-25T08:00:00Z", text: "保留趋势证据", snapshotCount: 2 };
    const legacy = createEmptyEpisodeReviewRecord(episodeId, xpev.id);
    legacy.review.completed = true;
    const result = buildTradeLibraryEntries(summaries, {}, {}, { [episodeId]: legacy }, { [episodeId]: recall });
    expect(result[0].episodes[0].recallReview).toEqual(recall);
    expect(result[0].episodes[0].reviewStatus).toBe(status === "completed" ? "completed" : "pending");
    expect(result[0].reviewedEpisodeCount).toBe(status === "completed" ? 1 : 0);
  });
});

it("rejects mismatched Recall identity and retains legacy completion without a matching saved summary", () => {
  const fills = [fill(xpev, "a", "buy", "2026-09-01", "2", "10"), fill(xpev, "a", "sell", "2026-09-02", "2", "12")];
  const episodeId = buildTradeEpisodes(fills)[0].id;
  const legacy = createEmptyEpisodeReviewRecord(episodeId, xpev.id);
  legacy.review.completed = true;
  const result = buildTradeLibraryEntries(buildInstrumentTradeSummaries(fills), {}, {}, { [episodeId]: legacy }, {
    [episodeId]: { episodeId: "other-account-episode", status: "in-progress", updatedAt: "2026-09-25", text: "别的回合", snapshotCount: 1 },
  });
  expect(result[0].episodes[0].recallReview).toBeUndefined();
  expect(result[0].episodes[0].reviewStatus).toBe("completed");
});
