import { describe, expect, it } from "vitest";

import { summarizeTradeEpisode } from "../trades/episode-metrics";
import { buildTradeEpisodes } from "../trades/episodes";
import { buildTradeLibraryEntries } from "../trades/library";
import { buildInstrumentTradeSummaries } from "../trades/instruments";
import type { StatementEvent } from "../import/monthly-statement";
import type { TradeExecution } from "../trades/types";
import { summarizeLibraryPerformance } from "./library-performance";

function execution(
  id: string,
  instrument: TradeExecution["instrument"],
  side: "buy" | "sell",
  executedAt: string,
  overrides: Partial<TradeExecution> = {},
): TradeExecution {
  return {
    id,
    accountId: "account-1",
    accountLabel: "主账户",
    instrument,
    side,
    executedAt,
    quantity: "1",
    price: "10",
    fee: "0",
    source: { platform: "futu", row: 1 },
    ...overrides,
  };
}

function entriesFrom(executions: TradeExecution[]) {
  return buildTradeLibraryEntries(
    buildInstrumentTradeSummaries(executions),
    {},
    {},
  );
}

function rowsFrom(executions: TradeExecution[]) {
  return entriesFrom(executions).flatMap((entry) =>
    entry.episodes.map((item) => ({ entry, item })),
  );
}

describe("library performance acceptance boundaries", () => {
  it("uses the built entry's inferred live nature while isolating an explicit unknown entry", () => {
    const legacyInstrument = {
      id: "CN:LEGACY",
      symbol: "LEGACY",
      name: "历史实盘标的",
      market: "CN-SH",
      currency: "CNY",
    };
    const unknownInstrument = {
      id: "CN:UNKNOWN",
      symbol: "UNKNOWN",
      name: "来源未知标的",
      market: "CN-SH",
      currency: "CNY",
    };
    const legacy = [
      execution("legacy-in", legacyInstrument, "buy", "2026-01-01T00:00:00.000Z"),
      execution("legacy-out", legacyInstrument, "sell", "2026-01-02T00:00:00.000Z"),
    ];
    const unknown = [
      execution("unknown-in", unknownInstrument, "buy", "2026-01-01T00:00:00.000Z", {
        accountId: "account-unknown",
        accountLabel: "未知账户",
        source: { platform: "manual", row: 1 },
      }),
      execution("unknown-out", unknownInstrument, "sell", "2026-01-02T00:00:00.000Z", {
        accountId: "account-unknown",
        accountLabel: "未知账户",
        source: { platform: "manual", row: 2 },
      }),
    ];
    const entries = entriesFrom([...legacy, ...unknown]);
    const legacyEntry = entries.find((entry) => entry.instrument.symbol === "LEGACY");
    expect(legacyEntry?.tradeNature).toBe("live");
    expect(legacyEntry?.episodes[0]?.episode.tradeNature).toBe("unknown");

    const summary = summarizeLibraryPerformance(
      entries.flatMap((entry) => entry.episodes.map((item) => ({ entry, item }))),
    );

    expect(summary.comparableGroups.map((group) => group.tradeNature)).toEqual([
      "live",
      "unknown",
    ]);
    expect(summary.cny).toMatchObject({ available: false, reason: "multiple-scopes" });
  });

  it("keeps short opening notional correct and does not count duplicated IPO evidence twice", () => {
    const shortInstrument = {
      id: "US:SHORT",
      symbol: "SHORT",
      name: "空头标的",
      market: "US",
      currency: "USD",
    };
    const shortExecutions = [
      execution("short-open", shortInstrument, "sell", "2026-01-01T00:00:00.000Z", {
        quantity: "100",
        price: "10",
      }),
      execution("short-close", shortInstrument, "buy", "2026-01-02T00:00:00.000Z", {
        quantity: "100",
        price: "8",
      }),
    ];
    const [shortEpisode] = buildTradeEpisodes(shortExecutions);
    const shortMetrics = summarizeTradeEpisode(shortEpisode);
    expect(shortEpisode.direction).toBe("short");
    expect(shortMetrics).toMatchObject({
      grossExposure: "1000",
      netPnl: "200",
      returnPercent: "20",
    });

    const ipoInstrument = {
      id: "US:IPO",
      symbol: "IPO",
      name: "配售标的",
      market: "US",
      currency: "USD",
    };
    const ipoEvents: StatementEvent[] = [
      {
        id: "ipo-application",
        accountId: "account-1",
        market: "US",
        symbol: "IPO",
        date: "2025-12-01",
        kind: "ipo",
        amount: "-68271.65",
        currency: "USD",
        description: "IPO application",
        source: [],
      },
      {
        id: "ipo-fee",
        accountId: "account-1",
        market: "US",
        symbol: "IPO",
        date: "2025-12-01",
        kind: "fee",
        amount: "-100",
        currency: "USD",
        description: "IPO fee",
        source: [],
      },
      {
        id: "ipo-refund",
        accountId: "account-1",
        market: "US",
        symbol: "IPO",
        date: "2026-01-02",
        kind: "ipo",
        amount: "56893.04",
        currency: "USD",
        description: "IPO refund",
        source: [],
      },
      {
        id: "ipo-allocation",
        accountId: "account-1",
        market: "US",
        symbol: "IPO",
        date: "2026-01-02",
        kind: "ipo",
        quantity: "500",
        amount: "11265",
        currency: "USD",
        displayTimePolicy: "session-open",
        description: "IPO allotment",
        source: [],
      },
    ];
    const ipoSale = execution("ipo-sale", ipoInstrument, "sell", "2026-01-02T00:00:00.000Z", {
      quantity: "500",
      price: "24",
      fee: "3",
      source: { platform: "fixture", row: 1, positionEvents: ipoEvents },
    });
    const [ipoEpisode] = buildTradeEpisodes([ipoSale]);
    expect(ipoEpisode.positionEvents?.length).toBeGreaterThan(0);
    const baseline = summarizeTradeEpisode(ipoEpisode);
    const duplicatedEvidenceEpisode = {
      ...ipoEpisode,
      positionEvents: [...(ipoEpisode.positionEvents ?? []), ...(ipoEpisode.positionEvents ?? [])],
    };
    const duplicated = summarizeTradeEpisode(duplicatedEvidenceEpisode);

    expect(baseline).toMatchObject({
      grossExposure: "11378.61",
      netPnl: "518.39",
    });
    expect(duplicated).toMatchObject({
      grossExposure: baseline.grossExposure,
      netPnl: baseline.netPnl,
      fees: baseline.fees,
    });
  });

  it("makes a foreign-only no-FX scope unavailable while retaining raw-currency coverage", () => {
    const instrument = {
      id: "US:NOFX",
      symbol: "NOFX",
      name: "缺汇率标的",
      market: "US",
      currency: "USD",
    };
    const rows = rowsFrom([
      execution("nofx-in", instrument, "buy", "2026-01-01T00:00:00.000Z", { quantity: "10" }),
      execution("nofx-out", instrument, "sell", "2026-01-02T00:00:00.000Z", { quantity: "10" }),
    ]);
    const summary = summarizeLibraryPerformance(rows);

    expect(summary.rawCurrencyGroups[0]).toMatchObject({
      currency: "USD",
      netPnlSampleCount: 1,
      returnSampleCount: 1,
    });
    expect(summary.cny).toMatchObject({
      available: false,
      reason: "missing-fx",
      netPnl: null,
      netPnlSampleCount: 0,
      returnSampleCount: 0,
    });
    expect(summary.sample).toMatchObject({
      trustedClosed: 1,
      returnEligible: 1,
      cnyNetPnlEligible: 0,
      cnyReturnEligible: 0,
    });
    expect(summary.cny.exclusionReasons).toMatchObject({ "missing-fx": 1 });
  });
});
