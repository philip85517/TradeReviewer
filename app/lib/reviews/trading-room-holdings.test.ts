import { buildCurrentPortfolio } from "./trading-room-portfolio";
import { describe, expect, it } from "vitest";

import type { PositionLedgerSnapshot } from "../replay/position-ledger";
import type { TradeLibraryEntry } from "../trades/library";
import type { Instrument, TradeEpisode, TradeExecution } from "../trades/types";
import { buildRoomDateRange, createDefaultRoomScope, type RoomScope, type TradingRoomInstrumentMetadata } from "./trading-room-scope";
import {
  buildTradingRoomHoldings,
  type TradingRoomQuote,
} from "./trading-room-holdings";

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

function execution(
  base: Instrument,
  side: "buy" | "sell",
  executedAt: string,
  accountId = "account-1",
): TradeExecution {
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

function openEntry(
  base: Instrument,
  startedAt: string,
  accountId = "account-1",
  netPnl = "999",
): TradeLibraryEntry {
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

function scope(overrides: Partial<RoomScope> = {}): RoomScope {
  return {
    ...createDefaultRoomScope("2026-09-19"),
    period: buildRoomDateRange("month", "2026-09-19"),
    ...overrides,
  };
}

function metadataFor(base: Instrument, assetType: "stock" | "etf"): TradingRoomInstrumentMetadata {
  return { market: base.market, symbol: base.symbol, assetType };
}

function quote(overrides: Partial<TradingRoomQuote> = {}): TradingRoomQuote {
  return {
    price: "12",
    currency: "USD",
    quoteDate: "2026-09-19",
    fetchedAt: "2026-09-19T08:00:00.000Z",
    provider: "fixture",
    freshness: "current",
    ...overrides,
  };
}

function snapshot(overrides: Partial<PositionLedgerSnapshot> = {}): PositionLedgerSnapshot {
  return {
    quantity: "2",
    averageCost: "10",
    realizedPnl: "0",
    unrealizedPnl: "4",
    netPnl: "4",
    fees: "0",
    grossCapitalDeployed: "20",
    returnPercent: "20",
    ...overrides,
  };
}

describe("trading room holdings model", () => {
  it("keeps an open position from before the performance window", () => {
    const base = instrument();
    const entry = openEntry(base, "2020-01-02T01:00:00.000Z");
    const model = buildTradingRoomHoldings([entry], {
      scope: scope(),
      instrumentMetadata: new Map([[base.id, metadataFor(base, "stock")]]),
      positionSnapshotsByEpisode: { [entry.episodes[0].episode.id]: snapshot() },
    });

    expect(model.rows).toHaveLength(1);
    expect(model.rows[0]).toMatchObject({
      accountId: "account-1",
      quantity: "2",
      quantityStatus: "available",
      averageCost: "10",
    });
  });

  it("keeps same instrument positions separate by account and sorts latest activity first", () => {
    const base = instrument({ id: "HK:0700", symbol: "0700", market: "HK", currency: "HKD" });
    const older = openEntry(base, "2026-09-01T01:00:00.000Z", "account-1");
    const newer = openEntry(base, "2026-09-18T01:00:00.000Z", "account-2");
    const model = buildTradingRoomHoldings([older, newer], {
      scope: scope(),
      instrumentMetadata: new Map([[base.id, metadataFor(base, "stock")]]),
      positionSnapshotsByEpisode: {
        [older.episodes[0].episode.id]: snapshot({ quantity: "1" }),
        [newer.episodes[0].episode.id]: snapshot({ quantity: "3" }),
      },
    });

    expect(model.groups.map(group => group.market)).toEqual(["HK"]);
    expect(model.groups[0].rows.map(row => row.accountId)).toEqual(["account-2", "account-1"]);
  });

  it("keeps an ETF in its real market group and applies the shared scope category", () => {
    const etf = instrument({ id: "US:SPY", symbol: "SPY", name: "标普ETF" });
    const entry = openEntry(etf, "2026-09-10T01:00:00.000Z");
    const model = buildTradingRoomHoldings([entry], {
      scope: scope({ assetCategory: "etf" }),
      instrumentMetadata: new Map([[etf.id, metadataFor(etf, "etf")]]),
      positionSnapshotsByEpisode: { [entry.episodes[0].episode.id]: snapshot() },
    });

    expect(model.groups[0]).toMatchObject({ market: "US", label: "美股", rows: [{ assetType: "etf", assetCategory: "us-stock" }] });
  });

  it("uses only unrealized PnL from the current quote and never open net PnL", () => {
    const base = instrument();
    const entry = openEntry(base, "2026-09-10T01:00:00.000Z", "account-1", "999");
    const episodeId = entry.episodes[0].episode.id;
    const model = buildTradingRoomHoldings([entry], {
      scope: scope(),
      asOf: "2026-09-22T00:00:00+08:00",
      instrumentMetadata: new Map([[base.id, metadataFor(base, "stock")]]),
      quotesByInstrument: { [base.id]: quote({ price: "12" }) },
      positionSnapshotsByEpisode: { [episodeId]: snapshot({ realizedPnl: "80", netPnl: "84", unrealizedPnl: "4" }) },
    });

    expect(model.rows[0]).toMatchObject({ unrealizedPnl: "4", unrealizedPnlStatus: "available" });
    expect(model.rows[0].unrealizedPnl).not.toBe("999");
  });

  it("refreshes an explicit position snapshot with the current quote", () => {
    const base = instrument();
    const entry = openEntry(base, "2026-09-10T01:00:00.000Z");
    const episodeId = entry.episodes[0].episode.id;
    const model = buildTradingRoomHoldings([entry], {
      scope: scope(),
      asOf: "2026-09-22T00:00:00+08:00",
      instrumentMetadata: new Map([[base.id, metadataFor(base, "stock")]]),
      quotesByInstrument: { [base.id]: quote({ price: "13" }) },
      positionSnapshotsByEpisode: { [episodeId]: snapshot({ unrealizedPnl: "4", netPnl: "4" }) },
    });

    expect(model.rows[0]).toMatchObject({ unrealizedPnl: "6", unrealizedPnlStatus: "available" });
  });

  it("keeps a short holding direction when deriving the ledger snapshot", () => {
    const base = instrument();
    const entry = openEntry(base, "2026-09-10T01:00:00.000Z");
    const episode = entry.episodes[0].episode;
    const fill = episode.executions[0];
    fill.side = "sell";
    fill.price = "10";
    fill.source.positionEffect = "open-short";
    episode.direction = "short";
    episode.openingQuantity = "2";
    episode.remainingQuantity = "2";
    const model = buildTradingRoomHoldings([entry], {
      scope: scope(),
      asOf: "2026-09-22T00:00:00+08:00",
      quotesByInstrument: { [base.id]: quote({ price: "8" }) },
    });

    expect(model.rows[0]).toMatchObject({
      quantity: "-2",
      averageCost: "10",
      unrealizedPnl: "4",
      unrealizedPnlStatus: "available",
      direction: "short",
      diagnostic: "available",
      positionEvidence: { status: "verified-short" },
    });
  });

  it("keeps a trusted negative opening position as a short without inventing its cost", () => {
    const base = instrument();
    const entry = openEntry(base, "2026-09-10T01:00:00.000Z");
    const episode = entry.episodes[0].episode;
    const fill = episode.executions[0];
    fill.side = "buy";
    fill.quantity = "2";
    fill.source.openingPosition = {
      accountId: "account-1",
      market: "US",
      symbol: "TEST",
      phase: "opening",
      date: "2026-09-01",
      quantity: "-10",
      source: [{ page: 1, row: 2 }],
    };
    episode.direction = "short";
    const model = buildTradingRoomHoldings([entry], {
      scope: scope(),
      quotesByInstrument: { [base.id]: quote({ price: "8" }) },
    });

    expect(model.rows[0]).toMatchObject({
      quantity: "-8",
      direction: "short",
      positionEvidence: { status: "verified-short" },
      unrealizedPnl: null,
      unrealizedPnlStatus: "unavailable",
    });
  });

  it("does not let a historical open-short marker override a currently non-negative position", () => {
    const base = instrument();
    const entry = openEntry(base, "2026-09-10T01:00:00.000Z");
    const episode = entry.episodes[0].episode;
    const opening = episode.executions[0];
    opening.side = "sell";
    opening.source.positionEffect = "open-short";
    episode.executions.push({
      ...opening,
      id: "cover",
      side: "buy",
      quantity: "4",
      price: "9",
      source: { ...opening.source, positionEffect: "close-short" },
    });
    entry.executions = episode.executions;
    episode.direction = "long";
    episode.remainingQuantity = "2";
    const model = buildTradingRoomHoldings([entry], {
      scope: scope(),
      quotesByInstrument: { [base.id]: quote({ price: "12" }) },
    });

    expect(model.rows[0]).toMatchObject({
      quantity: "2",
      direction: "long",
      positionEvidence: { status: "verified-long" },
    });
  });

  it("does not treat a negative net difference as a legal short when position evidence is absent", () => {
    const base = instrument();
    const entry = openEntry(base, "2026-09-10T01:00:00.000Z");
    const episode = entry.episodes[0].episode;
    const fill = episode.executions[0];
    fill.side = "sell";
    fill.quantity = "10000";
    fill.source.formatRuleId = "china-merchants/pdf/monthly-v1";
    fill.source.positionEffectEvidence = {
      kind: "inferred",
      confidence: "high",
      reason: "由净成交数量推断",
    };
    fill.source.statementMonth = undefined;
    fill.source.templateId = undefined;
    episode.direction = "short";
    episode.openingQuantity = "0";
    episode.remainingQuantity = "-10000";
    const model = buildTradingRoomHoldings([entry], {
      scope: scope(),
      quotesByInstrument: { [base.id]: quote({ price: "8" }) },
    });

    expect(model.rows[0]).toMatchObject({
      quantity: "-10000",
      direction: "unknown",
      diagnostic: "position-evidence",
      positionEvidence: {
        status: "unverified-negative",
        missing: expect.arrayContaining(["positionEffect", "openingPosition", "statementPositions"]),
      },
      averageCost: null,
      unrealizedPnl: null,
      unrealizedPnlStatus: "unavailable",
    });
    expect(model.rows[0].statusReason).toContain("未证明开空");
  });

  it("does not treat an inferred open-short marker as explicit evidence", () => {
    const base = instrument();
    const entry = openEntry(base, "2026-09-10T01:00:00.000Z");
    const episode = entry.episodes[0].episode;
    const fill = episode.executions[0];
    fill.side = "sell";
    fill.quantity = "10000";
    fill.source.formatRuleId = "china-merchants/pdf/monthly-v1";
    fill.source.positionEffect = "open-short";
    fill.source.positionEffectEvidence = {
      kind: "inferred",
      confidence: "high",
      reason: "由净成交数量推断",
    };
    episode.direction = "short";
    episode.remainingQuantity = "-10000";
    const model = buildTradingRoomHoldings([entry], {
      scope: scope(),
      quotesByInstrument: { [base.id]: quote({ price: "8" }) },
    });

    expect(model.rows[0]).toMatchObject({
      quantity: "-10000",
      direction: "unknown",
      positionEvidence: { status: "unverified-negative" },
      diagnostic: "position-evidence",
      averageCost: null,
      unrealizedPnl: null,
    });
  });

  it("keeps holding evidence and quote failure reasons distinct", () => {
    const base = instrument();
    const build = (quoteValue: TradingRoomQuote | undefined, overrides: Partial<PositionLedgerSnapshot> = {}) => {
      const value = openEntry(base, "2026-09-10T01:00:00.000Z");
      const episodeId = value.episodes[0].episode.id;
      return buildTradingRoomHoldings([value], {
        scope: scope(),
        quotesByInstrument: quoteValue ? { [base.id]: quoteValue } : {},
        positionSnapshotsByEpisode: { [episodeId]: snapshot(overrides) },
      }).rows[0];
    };

    expect(build(undefined)).toMatchObject({ diagnostic: "missing-quote", statusReason: "缺少行情，无法计算浮盈亏" });
    expect(build(quote({ freshness: "stale" }))).toMatchObject({ diagnostic: "stale-quote", statusReason: "行情已过期，无法计算当前浮盈亏" });
    expect(build(quote({ quoteDate: "2026-09-08" }))).toMatchObject({ diagnostic: "pre-trade-quote", statusReason: "行情早于最近一笔交易，无法计算浮盈亏" });
    expect(build(quote({ currency: "HKD" }))).toMatchObject({ diagnostic: "currency-mismatch", statusReason: "行情币种与结算币种不一致，无法计算浮盈亏" });
    expect(build(quote({ price: "0" }))).toMatchObject({ diagnostic: "invalid-quote", statusReason: "行情价格无效，无法计算浮盈亏" });
    expect(build(quote(), { quantityKnown: false })).toMatchObject({ direction: "unknown", diagnostic: "position-evidence", statusReason: "持仓数量待核对" });
  });

  it("shows explicit unavailable states for missing or stale quotes and uncertain inventory", () => {
    const base = instrument();
    const missingEntry = openEntry(base, "2026-09-10T01:00:00.000Z", "account-1");
    const staleEntry = openEntry(base, "2026-09-11T01:00:00.000Z", "account-2");
    const uncertainEntry = openEntry(base, "2026-09-12T01:00:00.000Z", "account-3");
    const model = buildTradingRoomHoldings([missingEntry, staleEntry, uncertainEntry], {
      scope: scope(),
      instrumentMetadata: new Map([[base.id, metadataFor(base, "stock")]]),
      quotesByInstrument: {
        [base.id]: quote({ freshness: "stale", quoteDate: "2026-09-14" }),
      },
      positionSnapshotsByEpisode: {
        [missingEntry.episodes[0].episode.id]: snapshot(),
        [staleEntry.episodes[0].episode.id]: snapshot(),
        [uncertainEntry.episodes[0].episode.id]: snapshot({ quantityKnown: false, costKnown: false, accuracy: { pnl: "unavailable", reasons: ["unknown-cost"] } }),
      },
    });

    expect(model.rows.find(row => row.accountId === "account-1")).toMatchObject({ quoteStatus: "stale", unrealizedPnlStatus: "stale" });
    expect(model.rows.find(row => row.accountId === "account-2")).toMatchObject({ quoteStatus: "stale", unrealizedPnl: null });
    expect(model.rows.find(row => row.accountId === "account-3")).toMatchObject({ quantityStatus: "unavailable", costStatus: "unavailable", unrealizedPnlStatus: "unavailable" });
  });

  it("supports candle projections and marks an old latest close stale", () => {
    const base = instrument();
    const entry = openEntry(base, "2026-09-10T01:00:00.000Z");
    const model = buildTradingRoomHoldings([entry], {
      scope: scope(),
      instrumentMetadata: new Map([[base.id, metadataFor(base, "stock")]]),
      asOf: "2026-09-19T08:00:00.000Z",
      candlesByInstrument: {
        [base.id]: [{
          instrumentId: base.id,
          tradingDate: "2026-09-15",
          open: "10",
          high: "12",
          low: "9",
          close: "11",
          volume: "100",
          currency: "USD",
          provider: "yahoo",
          providerSymbol: base.symbol,
          adjustmentMode: "raw",
          fetchedAt: "2026-09-16T08:00:00.000Z",
        }],
      },
    });

    expect(model.rows[0]).toMatchObject({ quoteStatus: "stale", quote: { price: "11", quoteDate: "2026-09-15" } });
    expect(model.rows[0].unrealizedPnl).toBeNull();
  });

  it("uses the selected nature and run without combining simulation rows", () => {
    const base = instrument();
    const first = openEntry(base, "2026-09-10T01:00:00.000Z");
    const simulation = openEntry(base, "2026-09-11T01:00:00.000Z");
    simulation.tradeNature = "simulation";
    simulation.simulationRunId = "run-a";
    simulation.episodes[0].episode.tradeNature = "simulation";
    simulation.episodes[0].episode.simulationRunId = "run-a";
    for (const execution of simulation.executions) {
      execution.source.tradeNature = "simulation";
      execution.source.simulationRunId = "run-a";
    }
    const model = buildTradingRoomHoldings([first, simulation], {
      scope: scope({ nature: "simulation", simulationRunId: "run-a" }),
      instrumentMetadata: new Map([[base.id, metadataFor(base, "stock")]]),
      positionSnapshotsByEpisode: { [simulation.episodes[0].episode.id]: snapshot() },
    });

    expect(model.rows).toHaveLength(1);
    expect(model.rows[0].sourceNature).toBe("simulation");
    expect(model.rows[0].simulationRunId).toBe("run-a");
  });

  it("blocks PnL when the ledger marks cost or quantity unknown even without accuracy", () => {
    const base = instrument();
    const entry = openEntry(base, "2026-09-10T01:00:00.000Z");
    const model = buildTradingRoomHoldings([entry], {
      scope: scope(),
      quotesByInstrument: { [base.id]: quote() },
      positionSnapshotsByEpisode: {
        [entry.episodes[0].episode.id]: snapshot({ quantityKnown: false, costKnown: false }),
      },
    });

    expect(model.rows[0]).toMatchObject({
      quantityStatus: "unavailable",
      costStatus: "unavailable",
      unrealizedPnl: null,
      unrealizedPnlStatus: "unavailable",
    });
  });

  it("rejects mismatched, non-positive, future, and pre-trade quotes for PnL", () => {
    const base = instrument({ currency: "USD" });
    const entry = openEntry(base, "2026-09-10T01:00:00.000Z");
    const build = (value: Partial<TradingRoomQuote>) => buildTradingRoomHoldings([entry], {
      scope: scope(),
      asOf: "2026-09-19T00:00:00.000Z",
      quotesByInstrument: { [base.id]: quote(value) },
      positionSnapshotsByEpisode: { [entry.episodes[0].episode.id]: snapshot() },
    }).rows[0];

    expect(build({ currency: "HKD" })).toMatchObject({ quoteStatus: "unavailable", unrealizedPnl: null });
    expect(build({ price: "0" })).toMatchObject({ quoteStatus: "unavailable", unrealizedPnl: null });
    expect(build({ price: "-1" })).toMatchObject({ quoteStatus: "unavailable", unrealizedPnl: null });
    expect(build({ quoteDate: "2026-09-20" })).toMatchObject({ quoteStatus: "unavailable", unrealizedPnl: null });
    expect(build({ quoteDate: "2026-09-08" })).toMatchObject({ quoteStatus: "unavailable", unrealizedPnl: null });
  });

  it("falls through invalid source dates before applying the market calendar fallback", () => {
    const base = instrument();
    const entry = openEntry(base, "2026-09-10T01:00:00.000Z");
    entry.episodes[0].episode.executions[0].source.tradingDate = "not-a-date";
    entry.episodes[0].episode.executions[0].source.marketCalendarDate = "2026-09-01";
    const model = buildTradingRoomHoldings([entry], {
      scope: scope(),
      asOf: "2026-09-19T00:00:00.000Z",
      staleAfterDays: 30,
      quotesByInstrument: { [base.id]: quote({ quoteDate: "2026-09-02" }) },
      positionSnapshotsByEpisode: { [entry.episodes[0].episode.id]: snapshot() },
    });

    expect(model.rows[0]).toMatchObject({ quoteStatus: "available", unrealizedPnlStatus: "available" });
  });

  it("uses the source settlement currency when validating a quote", () => {
    const base = instrument({ currency: "USD" });
    const entry = openEntry(base, "2026-09-10T01:00:00.000Z");
    entry.episodes[0].episode.executions[0].source.settlement = {
      currency: "CNY",
      quantity: "2",
      grossAmount: "20",
      netAmount: "20",
      fees: {},
    };
    const model = buildTradingRoomHoldings([entry], {
      scope: scope(),
      quotesByInstrument: { [base.id]: quote({ currency: "USD" }) },
      positionSnapshotsByEpisode: { [entry.episodes[0].episode.id]: snapshot() },
    });

    expect(model.rows[0]).toMatchObject({ quoteStatus: "unavailable", unrealizedPnl: null });
  });

  it("uses the Shanghai local date for an as-of instant near UTC midnight", () => {
    const base = instrument();
    const entry = openEntry(base, "2026-09-10T01:00:00.000Z");
    const model = buildTradingRoomHoldings([entry], {
      scope: scope(),
      asOf: "2026-09-18T17:00:00.000Z",
      quotesByInstrument: { [base.id]: quote({ quoteDate: "2026-09-19" }) },
      positionSnapshotsByEpisode: { [entry.episodes[0].episode.id]: snapshot() },
    });

    expect(model.asOf).toBe("2026-09-19");
    expect(model.rows[0].quoteStatus).toBe("available");
  });

  it("preserves episode accuracy when persisted evidence is not repeated on executions", () => {
    const base = instrument();
    const entry = openEntry(base, "2026-09-10T01:00:00.000Z");
    entry.episodes[0].episode.accuracy = { pnl: "unavailable", reasons: ["unknown-cost"] };
    const model = buildTradingRoomHoldings([entry], {
      scope: scope(),
      quotesByInstrument: { [base.id]: quote() },
      positionSnapshotsByEpisode: { [entry.episodes[0].episode.id]: snapshot() },
    });

    expect(model.rows[0]).toMatchObject({ unrealizedPnl: null, unrealizedPnlStatus: "unavailable", costStatus: "unavailable" });
  });

  it("replays persisted initial inventory evidence instead of treating a later sell as a fresh short", () => {
    const base = instrument();
    const entry = openEntry(base, "2026-09-10T01:00:00.000Z");
    entry.episodes[0].episode.initialPosition = {
      accountId: "account-1",
      market: "US",
      symbol: "TEST",
      phase: "opening",
      date: "2020-01-01",
      quantity: "100",
      source: [],
    };
    entry.episodes[0].episode.executions[0].side = "sell";
    entry.episodes[0].episode.executions[0].source.positionEffect = "close-long";
    entry.episodes[0].episode.openingQuantity = "100";
    entry.episodes[0].episode.remainingQuantity = "98";
    const model = buildTradingRoomHoldings([entry], {
      scope: scope(),
      quotesByInstrument: { [base.id]: quote({ price: "12" }) },
    });

    expect(model.rows[0]).toMatchObject({ quantity: "98", quantityStatus: "available", costStatus: "unavailable", unrealizedPnl: null });
  });
});

describe("statement-only current holdings", () => {
  function evidenceEntry() {
    const value = openEntry(instrument(), "2026-09-17");
    value.executions = [];
    value.episodes[0].episode.executions = [];
    value.episodes[0].episode.initialPosition = {
      accountId: "account-1", market: "US", symbol: "TEST", phase: "opening" as const,
      date: "2026-09-17", quantity: "5", source: [],
    };
    return value;
  }
  const options = { scope: scope(), asOf: "2026-09-19", quotesByInstrument: { "US:TEST": quote() } };
  it("replays a zero-cash bonus share into quantity and average cost", () => {
    const base = instrument({ id: "CN-SH:516780", symbol: "516780", name: "稀土ETF", market: "CN-SH", currency: "CNY" });
    const value = openEntry(base, "2026-05-20T02:00:00Z");
    const fill = value.episodes[0].episode.executions[0];
    fill.quantity = "10000";
    fill.price = "2.5";
    value.episodes[0].episode.openingQuantity = "10000";
    value.episodes[0].episode.remainingQuantity = "10000";
    fill.source.positionEvents = [{
      id: "bonus-516780",
      accountId: "account-1",
      market: "CN-SH",
      symbol: "516780",
      date: "2026-05-22",
      kind: "corporate-action",
      quantity: "10000",
      amount: "0",
      currency: "CNY",
      description: "红股入账 1.8900",
      source: [],
    }];

    const row = buildTradingRoomHoldings([value], {
      ...options,
      asOf: "2026-06-02",
      quotesByInstrument: { [base.id]: quote({ currency: "CNY", quoteDate: "2026-06-02", price: "2" }) },
      instrumentMetadata: new Map([[base.id, metadataFor(base, "stock")]]),
    }).rows[0];

    expect(row).toMatchObject({
      quantity: "20000",
      quantityStatus: "available",
      averageCost: "1.25",
      costStatus: "available",
      unrealizedPnl: "15000",
      unrealizedPnlStatus: "available",
    });
  });

  it("keeps real opening quantity and quote available without inventing acquisition cost or executions", () => {
    const value = evidenceEntry();
    const row = buildTradingRoomHoldings([value], options).rows[0];
    expect(row).toMatchObject({ quantity: "5", quantityStatus: "available", quoteStatus: "available", averageCost: null, unrealizedPnl: null, direction: "long" });
    expect(row.position?.costKnown).toBe(false);
    expect(buildCurrentPortfolio([value], options).rows[0]).toMatchObject({ marketValue: "60", cost: null, unrealizedPnl: null });
    expect(value.episodes[0].episode.executions).toEqual([]);
  });
  it("replays only matching account and instrument events for statement-only inventory", () => {
    const value = evidenceEntry();
    const event = { id: "received", accountId: "account-1", symbol: "TEST", market: "US", date: "2026-09-18", kind: "transfer-in" as const, quantity: "2", description: "received", source: [] };
    value.episodes[0].episode.positionEvents = [event, { ...event, id: "other-account", accountId: "other", quantity: "90" }, { ...event, id: "other-symbol", symbol: "OTHER", quantity: "80" }];
    expect(buildTradingRoomHoldings([value], options).rows[0].quantity).toBe("7");
    value.episodes[0].episode.initialPosition!.accountId = "other";
    value.episodes[0].episode.positionEvents = [];
    expect(buildTradingRoomHoldings([value], options).rows[0].quantity).toBeNull();
  });
  it("does not leak real statement inventory into a simulation run or turn absent evidence into zero", () => {
    const value = evidenceEntry();
    value.tradeNature = "simulation";
    value.episodes[0].episode.tradeNature = "simulation";
    value.episodes[0].episode.simulationRunId = "run-1";
    const result = buildTradingRoomHoldings([value], { ...options, scope: scope({ nature: "simulation", simulationRunId: "run-1" }) });
    expect(result.rows[0].quantity).toBeNull();
    const future = evidenceEntry();
    future.episodes[0].episode.initialPosition!.date = "2026-09-20";
    expect(buildTradingRoomHoldings([future], options).rows[0].quantity).toBeNull();
    const noEvidence = evidenceEntry();
    noEvidence.episodes[0].episode.initialPosition = undefined;
    expect(buildTradingRoomHoldings([noEvidence], options).rows[0].quantity).toBeNull();
  });
  it("does not turn non-inventory or unsupported evidence into a known zero position", () => {
    const value = evidenceEntry();
    value.episodes[0].episode.initialPosition = undefined;
    const event = { id: "fee-only", accountId: "account-1", symbol: "TEST", market: "US", date: "2026-09-18", kind: "fee" as const, description: "custody", source: [] };
    value.episodes[0].episode.positionEvents = [event];
    expect(buildTradingRoomHoldings([value], options).rows[0].quantity).toBeNull();
    value.episodes[0].episode.positionEvents = [{ ...event, kind: "corporate-action" }];
    expect(buildTradingRoomHoldings([value], options).rows[0].quantity).toBeNull();
  });

  it.each(["future", "other-account", "other-symbol"] as const)("does not use %s negative opening evidence to authorize an unexplained outflow", kind => {
    const value = evidenceEntry();
    const opening = value.episodes[0].episode.initialPosition!;
    opening.quantity = "-5";
    if (kind === "future") opening.date = "2026-09-20";
    if (kind === "other-account") opening.accountId = "other";
    if (kind === "other-symbol") opening.symbol = "OTHER";
    value.episodes[0].episode.positionEvents = [{ id: "outflow", accountId: "account-1", symbol: "TEST", market: "US", date: "2026-09-18", kind: "transfer-out", quantity: "2", description: "outflow", source: [] }];
    const row = buildTradingRoomHoldings([value], options).rows[0];
    expect(row.quantity).toBe("-2");
    expect(row.direction).toBe("unknown");
    expect(row.positionEvidence.status).toBe("unverified-negative");
    expect(buildCurrentPortfolio([value], options).rows[0].marketValue).toBeNull();
  });
  it("still accepts matching visible negative opening evidence", () => {
    const value = evidenceEntry();
    value.episodes[0].episode.initialPosition!.quantity = "-5";
    expect(buildTradingRoomHoldings([value], options).rows[0].direction).toBe("short");
    expect(buildCurrentPortfolio([value], options).rows[0].marketValue).toBe("-60");
  });

});
