import { describe, expect, it, vi } from "vitest";
import * as positionLedger from "../replay/position-ledger";
import type { Instrument, TradeExecution, TradeEpisode } from "../trades/types";
import type { TradeLibraryEntry } from "../trades/library";
import type { DailyCandleRecord } from "../market/contracts";
import { createDefaultRoomScope } from "./trading-room-scope";
import { buildHoldingsHistory, sampleHoldingsHistory } from "./trading-room-history";
function instrument(overrides: Partial<Instrument> = {}): Instrument {
  return {
    id: "US:TEST",
    symbol: "TEST",
    name: "测试标的",
    market: "US",
    currency: "USD",
    ...overrides,
  };
}
function execution(base: Instrument, side: "buy" | "sell", executedAt: string, accountId = "account-1"): TradeExecution {
  return {
    id: `${accountId}:${side}:${executedAt}`,
    source: { platform: "fixture", row: 1 },
    accountId,
    accountLabel: accountId === "account-1" ? "主账户" : "副账户",
    instrument: base,
    side,
    executedAt,
    quantity: "2",
    price: side === "buy" ? "10" : "11",
    fee: "0",
  };
}
function openEntry(base: Instrument, startedAt: string, accountId = "account-1", netPnl = "999"): TradeLibraryEntry {
  const executions = [execution(base, "buy", startedAt, accountId)];
  const episode: TradeEpisode = {
    id: `${accountId}:${base.id}:${startedAt}`,
    accountId,
    accountLabel: accountId === "account-1" ? "主账户" : "副账户",
    instrument: base,
    tradeNature: "live",
    direction: "long",
    status: "open",
    startedAt,
    openingQuantity: "2",
    remainingQuantity: "2",
    executions,
  };
  return {
    groupId: `${base.id}:live`,
    tradeNature: "live",
    instrument: base,
    executions,
    episodes: [{
        episode,
        metrics: {
          buyCount: 1,
          sellCount: 0,
          boughtQuantity: "2",
          soldQuantity: "0",
          grossExposure: "20",
          fees: "0",
          realizedPnl: "0",
          unrealizedPnl: netPnl,
          netPnl,
          returnPercent: "999",
          holdingMilliseconds: null,
        },
        reviewStatus: "pending",
        confirmedTagIds: [],
        tagDictionaryVersion: 1,
        rMultiple: null,
      }],
    accountCount: 1,
    tradeCount: 1,
    episodeCount: 1,
    firstTradeAt: startedAt,
    lastTradeAt: startedAt,
    status: "open",
    netPnl,
    returnPercent: "999",
    reviewedEpisodeCount: 0,
    confirmedTagIds: [],
    cumulativeR: null,
  };
}
const scope = {
  ...createDefaultRoomScope("2026-09-21"),
  assetCategory: "all" as const,
  period: {
    preset: "custom" as const,
    startDate: "2026-09-17",
    endDate: "2026-09-21"
  }
};
function candle(date: string, close = "12"): DailyCandleRecord {
  return {
    instrumentId: "US:TEST",
    tradingDate: date,
    close,
    open: close,
    high: close,
    low: close,
    volume: "10",
    currency: "USD",
    provider: "yahoo",
    providerSymbol: "TEST",
    adjustmentMode: "raw",
    fetchedAt: "2026-09-22T00:00:00Z"
  };
}
const options = {
  scope,
  asOf: "2026-09-21",
  candlesByInstrument: { "US:TEST": [candle("2026-09-17"), candle("2026-09-18"), candle("2026-09-21")] }
};
describe("historical holdings", () => {
  it("includes now closed episodes, deduplicates ledger, and ignores final accuracy", () => {
    const entry = openEntry(instrument(), "2026-09-17");
    const buy = entry.executions[0];
    const sell = execution(instrument(), "sell", "2026-09-21");
    entry.executions.push(sell);
    entry.episodes[0].episode = {
      ...entry.episodes[0].episode,
      status: "closed",
      endedAt: "2026-09-21",
      executions: [buy, sell],
      accuracy: { pnl: "unavailable", reasons: ["later"] }
    };
    entry.episodes.push({ ...entry.episodes[0], episode: { ...entry.episodes[0].episode, id: "duplicate" } });
    const result = buildHoldingsHistory([entry], options);
    expect(result.points[0].marketValue.originalByCurrency).toEqual({ USD: "24" });
    expect(result.points[0].unrealizedPnl.originalByCurrency).toEqual({ USD: "4" });
    expect(result.points[0].unrealizedReturnPercent).toBe("20");
    expect(result.points.at(-1)?.holdings).toHaveLength(0);
  });
  it("carries a Friday mark over weekend but leaves missing trading days unavailable", () => {
    const result = buildHoldingsHistory([openEntry(instrument(), "2026-09-17")], { ...options, candlesByInstrument: { "US:TEST": [candle("2026-09-18")] } });
    expect(result.points[0].marketValueAvailable).toBe(false);
    expect(result.points[2].marketValueAvailable).toBe(true);
    expect(result.points.at(-1)?.marketValueAvailable).toBe(false);
  });
  it("replays period-start holdings from earlier trades and isolates simulation runs", () => {
    const entry = openEntry(instrument(), "2026-09-10");
    expect(buildHoldingsHistory([entry], options).points[0].holdings[0].quantity).toBe("2");
    expect(buildHoldingsHistory([entry], { ...options, scope: {
        ...scope,
        nature: "simulation",
        simulationRunId: "run-x"
      } }).points[0].holdings).toEqual([]);
  });
  it("does not treat unverified sell-only inventory as a short value", () => {
    const entry = openEntry(instrument(), "2026-09-17");
    entry.executions[0].side = "sell";
    const point = buildHoldingsHistory([entry], options).points[0];
    expect(point.marketValueAvailable).toBe(false);
    expect(point.holdings[0].quantity).toBeNull();
  });
  it("retains exact intraday execution ordering even when input is shuffled", () => {
    const entry = openEntry(instrument(), "2026-09-16T14:00:00Z");
    const sell = { ...execution(instrument(), "sell", "2026-09-17T14:00:00Z"), quantity: "1" };
    const buy = {
      ...execution(instrument(), "buy", "2026-09-17T15:00:00Z"),
      quantity: "1",
      price: "20"
    };
    entry.episodes[0].episode.executions = [buy, entry.executions[0], sell];
    expect(buildHoldingsHistory([entry], options).points[0].holdings[0].cost).toBe("30");
  });
  it("does not reuse an older short episode to validate later unexplained negative inventory", () => {
    const entry = openEntry(instrument(), "2026-09-15");
    const opening = {
      ...entry.executions[0],
      side: "sell" as const,
      source: { ...entry.executions[0].source, positionEffect: "open-short" as const }
    };
    const cover = execution(instrument(), "buy", "2026-09-16");
    const unknown = execution(instrument(), "sell", "2026-09-17");
    entry.episodes[0].episode.executions = [opening, cover, unknown];
    expect(buildHoldingsHistory([entry], options).points[0].marketValueAvailable).toBe(false);
  });
  it("keeps known closed cashless inventory zero in its original currency and never invents empty-scope totals", () => {
    const entry = openEntry(instrument(), "2026-09-16");
    entry.episodes[0].episode.executions.push(execution(instrument(), "sell", "2026-09-17"));
    expect(buildHoldingsHistory([entry], options).points[0].marketValue.originalByCurrency).toEqual({ USD: "0" });
    const empty = buildHoldingsHistory([], options).points[0];
    expect(empty.marketValue.originalByCurrency).toEqual({});
    expect(empty.marketValueAvailable).toBe(false);
  });
  it("separates quantity and market value from unavailable cost, without importing future evidence", () => {
    const entry = openEntry(instrument(), "2026-09-17");
    entry.episodes[0].episode.initialPosition = {
      accountId: "account-1",
      market: "US",
      symbol: "TEST",
      phase: "opening",
      date: "2026-09-17",
      quantity: "5",
      source: []
    };
    const point = buildHoldingsHistory([entry], options).points[0];
    expect(point.holdings[0]).toMatchObject({
      quantity: "7",
      marketValue: "84",
      cost: null,
      unrealizedPnl: null
    });
    expect(point.marketValueAvailable).toBe(true);
    expect(point.costAvailable).toBe(false);
    const clean = openEntry(instrument(), "2026-09-17");
    clean.executions[0].source.statementPositions = [{
        accountId: "account-1",
        market: "US",
        symbol: "TEST",
        phase: "closing",
        date: "2026-09-21",
        quantity: "999",
        source: []
      }];
    expect(buildHoldingsHistory([clean], options).points[0].holdings[0]).toMatchObject({ quantity: "2", cost: "20" });
  });
  it("combines account holdings in one original currency and only converts with complete FX", () => {
    const entries = [openEntry(instrument(), "2026-09-17"), openEntry(instrument(), "2026-09-17", "account-2")];
    const original = buildHoldingsHistory(entries, options).points[0];
    expect(original.marketValue.originalByCurrency).toEqual({ USD: "48" });
    expect(original.marketValue.convertedCny).toBeNull();
    const fxSnapshot = {
      id: "fx",
      baseCurrency: "CNY" as const,
      asOf: "2026-09-21",
      source: "fixture",
      status: "complete" as const,
      rates: { "USD/CNY": "7" }
    };
    const converted = buildHoldingsHistory(entries, { ...options, fxSnapshot }).points[0];
    expect(converted.marketValue.convertedCny).toBe("336");
    expect(converted.unrealizedPnl.convertedCny).toBe("56");
    expect(converted.unrealizedReturnPercent).toBe("20");
    expect(buildHoldingsHistory(entries, { ...options, fxSnapshot: { ...fxSnapshot, status: "partial" } }).points[0].available).toBe(false);
  });
  it("uses the target HKD conversion for historical points", () => {
    const entries = [openEntry(instrument(), "2026-09-17"), openEntry(instrument(), "2026-09-17", "account-2")];
    const fxSnapshot = {
      id: "fx-hkd",
      baseCurrency: "CNY" as const,
      asOf: "2026-09-21",
      source: "fixture",
      status: "complete" as const,
      rates: { "USD/CNY": "7", "HKD/CNY": "0.875" },
    };
    const point = buildHoldingsHistory(entries, { ...options, fxSnapshot, targetCurrency: "HKD" }).points[0];
    expect(point.marketValue).toMatchObject({ targetCurrency: "HKD", converted: "384" });
    expect(point.unrealizedPnl).toMatchObject({ targetCurrency: "HKD", converted: "64" });
  });
  it("uses exchange dates when a US execution falls on the following UTC day", () => {
    const entry = openEntry(instrument(), "2026-09-18T00:30:00Z");
    expect(buildHoldingsHistory([entry], options).points[0].holdings[0].quantity).toBe("2");
  });
  it("blocks raw-price valuation after unsupported corporate-action evidence becomes visible", () => {
    const entry = openEntry(instrument(), "2026-09-17");
    entry.executions[0].source.positionEvents = [{
        id: "split",
        accountId: "account-1",
        market: "US",
        symbol: "TEST",
        date: "2026-09-18",
        kind: "corporate-action",
        description: "split",
        source: []
      }];
    const result = buildHoldingsHistory([entry], options);
    expect(result.points[0].available).toBe(true);
    expect(result.points[1].marketValueAvailable).toBe(false);
    expect(result.points[1].reasons.join(" ")).toContain("公司行动");
  });
  it("selects exactly one simulation run when accounts and instruments overlap", () => {
    const entries = ["run-a", "run-b"].map((run, index) => {
      const entry = openEntry(instrument(), "2026-09-17");
      entry.tradeNature = "simulation";
      entry.episodes[0].episode.tradeNature = "simulation";
      entry.episodes[0].episode.simulationRunId = run;
      entry.executions[0].source.tradeNature = "simulation";
      entry.executions[0].source.simulationRunId = run;
      entry.executions[0].quantity = String(index + 2);
      return entry;
    });
    const model = (run: string) => buildHoldingsHistory(entries, { ...options, scope: {
        ...scope,
        nature: "simulation",
        simulationRunId: run
      } });
    expect(model("run-a").points[0].marketValue.originalByCurrency).toEqual({ USD: "24" });
    expect(model("run-b").points[0].marketValue.originalByCurrency).toEqual({ USD: "36" });
  });
  it("values evidence-only opening inventory without inventing a fill or acquisition cost", () => {
    const entry = openEntry(instrument(), "2026-09-17");
    entry.executions = [];
    entry.episodes[0].episode.executions = [];
    entry.episodes[0].episode.initialPosition = {
      accountId: "account-1",
      market: "US",
      symbol: "TEST",
      phase: "opening",
      date: "2026-09-17",
      quantity: "5",
      source: []
    };
    const result = buildHoldingsHistory([entry], options);
    expect(result.points[0].holdings[0]).toMatchObject({
      quantity: "5",
      marketValue: "60",
      cost: null,
      unrealizedPnl: null
    });
    expect(entry.executions).toEqual([]);
    expect(entry.episodes[0].episode.executions).toEqual([]);
  });
  it.each(["transfer-in", "ipo"] as const)("does not carry short authorization across %s that closes the short", kind => {
    const entry = openEntry(instrument(), "2026-09-15");
    entry.executions[0].side = "sell";
    entry.executions[0].source.positionEffect = "open-short";
    entry.episodes[0].episode.positionEvents = [{
        id: "close-short",
        accountId: "account-1",
        market: "US",
        symbol: "TEST",
        date: "2026-09-16",
        kind,
        quantity: "2",
        description: "inventory received",
        source: []
      }];
    entry.episodes[0].episode.executions.push(execution(instrument(), "sell", "2026-09-17"));
    const point = buildHoldingsHistory([entry], options).points[0];
    expect(point.quantityAvailable).toBe(false);
    expect(point.marketValueAvailable).toBe(false);
  });
  it("reveals month-only allocation at month end, before its later first fill", () => {
    const entry = openEntry(instrument(), "2026-09-03");
    entry.executions[0].source.positionEvents = [{
        id: "allocation",
        accountId: "account-1",
        market: "US",
        symbol: "TEST",
        date: "2026-08",
        kind: "ipo",
        quantity: "5",
        displayTimePolicy: "session-open",
        description: "allotment",
        source: []
      }];
    const model = buildHoldingsHistory([entry], {
      ...options,
      scope: { ...scope, period: {
          preset: "custom",
          startDate: "2026-08-28",
          endDate: "2026-09-01"
        } },
      candlesByInstrument: { "US:TEST": [candle("2026-08-28"), candle("2026-08-31"), candle("2026-09-01")] }
    });
    expect(model.points[0].holdings).toEqual([]);
    expect(model.points[2].holdings).toEqual([]);
    expect(model.points[3].holdings[0]).toMatchObject({
      quantity: "5",
      marketValue: "60",
      cost: null
    });
    expect(model.points[4].holdings[0].quantity).toBe("5");
  });
  it("uses the Shanghai as-of calendar date and valid source trading date precedence", () => {
    const entry = openEntry(instrument(), "2026-09-18T00:30:00Z");
    entry.executions[0].source.tradingDate = "2026-09-17";
    entry.executions[0].source.marketCalendarDate = "2026-09-18";
    expect(buildHoldingsHistory([entry], { ...options, asOf: "2026-09-20T17:00:00Z" }).end).toBe("2026-09-21");
    expect(buildHoldingsHistory([entry], options).points[0].holdings[0].quantity).toBe("2");
    entry.executions[0].source.tradingDate = "not-a-date";
    entry.executions[0].source.marketCalendarDate = "2026-09-17";
    expect(buildHoldingsHistory([entry], options).points[0].holdings[0].quantity).toBe("2");
  });
  it.each([
    {
      side: "buy" as const,
      quantity: "2",
      price: "10",
      close: "10",
      expected: "-1"
    },
    {
      side: "sell" as const,
      quantity: "1",
      price: "12",
      close: "12",
      expected: "3"
    },
    {
      side: "sell" as const,
      quantity: "2",
      price: "12",
      close: "12",
      expected: "3"
    },
  ])("computes daily cash-flow-neutral PnL for $side $quantity including one fee", trade => {
    const entry = openEntry(instrument(), "2026-09-15");
    entry.episodes[0].episode.executions.push({
      ...execution(instrument(), trade.side, "2026-09-17"),
      quantity: trade.quantity,
      price: trade.price,
      fee: "1"
    });
    const point = buildHoldingsHistory([entry], { ...options, candlesByInstrument: { "US:TEST": [candle("2026-09-16", "10"), candle("2026-09-17", trade.close)] } }).points[0];
    expect(point.dailyPnlAvailable).toBe(true);
    expect(point.dailyPnl.originalByCurrency).toEqual({ USD: trade.expected });
  });

  it("computes the KPI daily percentage from prior value plus same-day buy spend", () => {
    const entry = openEntry(instrument(), "2026-09-15");
    entry.executions[0].quantity = "100";
    entry.executions[0].price = "100";
    entry.episodes[0].episode.executions[0] = entry.executions[0];
    const buy = {
      ...execution(instrument(), "buy", "2026-09-17"),
      quantity: "50",
      price: "100",
      fee: "0",
    };
    entry.executions.push(buy);
    entry.episodes[0].episode.executions.push(buy);
    const point = buildHoldingsHistory([entry], {
      ...options,
      candlesByInstrument: {
        "US:TEST": [candle("2026-09-16", "100"), candle("2026-09-17", "102")],
      },
    }).points[0];

    expect(point.dailyPnl.originalByCurrency).toEqual({ USD: "300" });
    expect(point.dailyPnlPercent).toBe("2");
    expect(point.dailyPnlPercentAvailable).toBe(true);
    expect(point.dailyPnlDenominator.originalByCurrency).toEqual({ USD: "15000" });
    expect(point.dailyReturnPercent).toBe("2");
    expect(point.dailyCapital.originalByCurrency).toEqual({ USD: "15000" });
  });

  it("does not substitute a zero prior value when the prior valuation is unknown", () => {
    const entry = openEntry(instrument(), "2026-09-15");
    const point = buildHoldingsHistory([entry], {
      ...options,
      candlesByInstrument: { "US:TEST": [candle("2026-09-17", "12")] },
    }).points[0];

    expect(point.dailyPnlAvailable).toBe(false);
    expect(point.dailyPnlPercent).toBeNull();
    expect(point.dailyPnlPercentAvailable).toBe(false);
    expect(point.dailyPnlPercentReasons.join(" ")).toContain("前一");
  });
  it("preserves same-day roundtrip PnL when the end-of-day holdings are empty", () => {
    const entry = openEntry(instrument(), "2026-09-17T14:00:00Z");
    entry.executions[0].fee = "1";
    entry.episodes[0].episode.executions.push({
      ...execution(instrument(), "sell", "2026-09-17T15:00:00Z"),
      price: "12",
      fee: "1"
    });
    const point = buildHoldingsHistory([entry], options).points[0];
    expect(point.holdings).toEqual([]);
    expect(point.dailyPnl.originalByCurrency).toEqual({ USD: "2" });
    expect(point.dailyPnlPercent).toBe("9.5238095238095238");
    expect(point.dailyPnlDenominator.originalByCurrency).toEqual({ USD: "21" });
  });
  it("uses settlement gross cash and charges the reported fee only once", () => {
    const entry = openEntry(instrument(), "2026-09-17");
    entry.executions[0].fee = "1";
    entry.executions[0].source.settlement = {
      currency: "USD",
      quantity: "2",
      grossAmount: "20",
      netAmount: "21",
      fees: { commission: "1" }
    };
    const point = buildHoldingsHistory([entry], options).points[0];
    expect(point.dailyPnl.originalByCurrency).toEqual({ USD: "3" });
  });
  it("does not rename a multi-session mark change as daily PnL when the required prior session is missing", () => {
    const entry = openEntry(instrument(), "2026-09-15");
    const point = buildHoldingsHistory([entry], { ...options, candlesByInstrument: { "US:TEST": [candle("2026-09-15", "10"), candle("2026-09-17", "12")] } }).points[0];
    expect(point.dailyPnlAvailable).toBe(false);
    expect(point.dailyPnlReasons.join(" ")).toContain("前一");
  });
  it("invalidates a cached ledger when the candle reference changes", () => {
    const entry = openEntry(instrument(), "2026-09-17");
    const first = buildHoldingsHistory([entry], {
      ...options,
      candlesByInstrument: { "US:TEST": [candle("2026-09-17", "12")] },
    });
    const second = buildHoldingsHistory([entry], {
      ...options,
      candlesByInstrument: { "US:TEST": [candle("2026-09-17", "20")] },
    });

    expect(first.points[0].holdings[0]?.quotePrice).toBe("12");
    expect(second.points[0].holdings[0]?.quotePrice).toBe("20");
  });
  it("makes daily PnL unavailable for unknown fees or inventory transfers", () => {
    const entry = openEntry(instrument(), "2026-09-17");
    entry.executions[0].source.feeStatus = "unknown";
    expect(buildHoldingsHistory([entry], options).points[0].dailyPnlAvailable).toBe(false);
    entry.executions[0].source.feeStatus = "reported";
    entry.episodes[0].episode.positionEvents = [{
        id: "transfer",
        accountId: "account-1",
        market: "US",
        symbol: "TEST",
        date: "2026-09-17",
        kind: "transfer-in",
        quantity: "1",
        description: "transfer",
        source: []
      }];
    expect(buildHoldingsHistory([entry], options).points[0].dailyPnlReasons.join(" ")).toContain("转仓");
  });
  it("samples each week/month at the last complete valuation and retains that day's PnL", () => {
    const entry = openEntry(instrument(), "2026-09-15");
    const model = buildHoldingsHistory([entry], { ...options, candlesByInstrument: { "US:TEST": [candle("2026-09-16", "10"), candle("2026-09-17", "11"), candle("2026-09-18", "12")] } });
    const week = sampleHoldingsHistory(model, "week");
    expect(week[0]).toMatchObject({
      actualDate: "2026-09-18",
      periodStart: "2026-09-17",
      periodEnd: "2026-09-20"
    });
    expect(week[0].point.dailyPnl.originalByCurrency).toEqual({ USD: "2" });
    expect(week[0].point.dailyPnlPercent).toBe("9.0909090909090909");
    const month = sampleHoldingsHistory(model, "month");
    expect(month[0].actualDate).toBe("2026-09-18");
    expect(month[0].point.unrealizedReturnPercent).toBe("20");
    expect(month[0].point.dailyPnlPercent).toBe("9.0909090909090909");
    expect(month[0].partialPeriod).toBe(true);
  });
  it("samples the latest market valuation even when its cost/PnL evidence is unavailable", () => {
    const entry = openEntry(instrument(), "2026-09-15");
    entry.executions[0].source.statementPositions = [{
      accountId: "account-1",
      market: "US",
      symbol: "TEST",
      phase: "closing",
      date: "2026-09-18",
      quantity: "3",
      source: []
    }];
    const model = buildHoldingsHistory([entry], {
      ...options,
      candlesByInstrument: { "US:TEST": [candle("2026-09-17", "11"), candle("2026-09-18", "12")] }
    });
    const latest = model.points.find(point => point.date === "2026-09-18")!;
    expect(latest).toMatchObject({ marketValueAvailable: true, costAvailable: false, available: false });
    expect(sampleHoldingsHistory(model, "week")[0]).toMatchObject({
      actualDate: "2026-09-18",
      point: { date: "2026-09-18", marketValueAvailable: true }
    });
  });
  it("ignores long-closed markets when choosing a live portfolio's last weekly valuation date", () => {
    const oldUs = openEntry(instrument(), "2026-09-15");
    oldUs.episodes[0].episode.executions.push(execution(instrument(), "sell", "2026-09-16"));
    const cnInstrument = instrument({
      id: "CN-SH:TEST",
      market: "CN-SH",
      currency: "CNY"
    });
    const cn = openEntry(cnInstrument, "2026-09-21");
    const cnCandle = (date: string) => ({
      ...candle(date),
      instrumentId: cnInstrument.id,
      currency: "CNY"
    });
    const result = buildHoldingsHistory([oldUs, cn], {
      scope: { ...scope, period: {
          preset: "custom",
          startDate: "2026-09-24",
          endDate: "2026-09-25"
        } },
      asOf: "2026-09-25",
      candlesByInstrument: { [cnInstrument.id]: [cnCandle("2026-09-23"), cnCandle("2026-09-24")] }
    });
    expect(sampleHoldingsHistory(result, "week")[0].actualDate).toBe("2026-09-24");
  });
  it("replays unchanged position evidence once while revaluing each daily price", () => {
    const replay = vi.spyOn(positionLedger, "replayPositionAtPrice");
    try {
      const entry = openEntry(instrument(), "2026-09-15");
      const result = buildHoldingsHistory([entry], { ...options, candlesByInstrument: { "US:TEST": [candle("2026-09-16", "10"), candle("2026-09-17", "11"), candle("2026-09-18", "12"), candle("2026-09-21", "13")] } });
      expect(result.points.map(point => point.marketValue.originalByCurrency.USD)).toEqual(["22", "24", "24", "24", "26"]);
      expect(result.points[0].dailyPnl.originalByCurrency).toEqual({ USD: "2" });
      expect(result.points.at(-1)?.dailyPnl.originalByCurrency).toEqual({ USD: "2" });
      expect(replay).toHaveBeenCalledTimes(1);
    }
    finally {
      replay.mockRestore();
    }
  });
  it("retains bounded long and single-day ledger variants across dashboard calls", () => {
    const replay = vi.spyOn(positionLedger, "replayPositionAtPrice");
    try {
      const entry = openEntry(instrument(), "2026-09-17");
      const candles = [candle("2026-09-17", "12"), candle("2026-09-18", "13"), candle("2026-09-21", "14")];
      const longOptions = {
        ...options,
        candlesByInstrument: { "US:TEST": candles },
      };
      const dayOptions = {
        ...longOptions,
        scope: { ...scope, period: { preset: "custom" as const, startDate: "2026-09-21", endDate: "2026-09-21" } },
      };

      buildHoldingsHistory([entry], longOptions);
      buildHoldingsHistory([entry], dayOptions);
      buildHoldingsHistory([entry], longOptions);

      expect(replay).toHaveBeenCalledTimes(2);
    }
    finally {
      replay.mockRestore();
    }
  });
});
