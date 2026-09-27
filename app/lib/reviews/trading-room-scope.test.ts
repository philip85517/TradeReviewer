import { describe, expect, it } from "vitest";

import type { DashboardRow } from "./dashboard";
import {
  buildRoomDateRange,
  buildRoomMoneyView,
  buildTradingRoomModel,
  classifyTradingRoomAsset,
  createDefaultRoomScope,
  DEFAULT_ROOM_SCOPE,
  filterRoomRows,
  normalizeRoomMetadata,
  roomTodayKey,
  type RoomScope,
  type TradingRoomInstrumentMetadata,
} from "./trading-room-scope";
import type { TradeLibraryEntry } from "../trades/library";
import type { TradeEpisodeMetrics } from "../trades/episode-metrics";
import type { Instrument, TradeEpisode, TradeExecution } from "../trades/types";

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
  id: string,
  base: Instrument,
  side: "buy" | "sell",
  executedAt: string,
  overrides: Partial<TradeExecution> = {},
): TradeExecution {
  return {
    id,
    source: { platform: "fixture", row: 1, ...overrides.source },
    accountId: "account-1",
    accountLabel: "主账户",
    instrument: base,
    side,
    executedAt,
    quantity: "1",
    price: side === "buy" ? "10" : "11",
    fee: "0",
    ...overrides,
  };
}

function row(
  base: Instrument,
  date: string,
  netPnl: string | null,
  options: {
    status?: "open" | "closed";
    nature?: "live" | "simulation" | "unknown";
    simulationRunId?: string;
    metadata?: TradingRoomInstrumentMetadata;
    episodeId?: string;
  } = {},
): DashboardRow {
  const episode: TradeEpisode = {
    id: options.episodeId ?? `${base.id}:${date}`,
    accountId: "account-1",
    accountLabel: "主账户",
    instrument: base,
    tradeNature: options.nature ?? "live",
    ...(options.simulationRunId ? { simulationRunId: options.simulationRunId } : {}),
    direction: "long",
    status: options.status ?? "closed",
    startedAt: `${date}T01:00:00.000Z`,
    ...(options.status === "open" ? {} : { endedAt: `${date}T02:00:00.000Z` }),
    openingQuantity: "1",
    remainingQuantity: options.status === "open" ? "1" : "0",
    executions: [
      execution(`${base.id}:${date}:buy`, base, "buy", `${date}T01:00:00.000Z`, {
        source: {
          platform: "fixture",
          row: 1,
          tradeNature: options.nature ?? "live",
          simulationRunId: options.simulationRunId,
          tradingDate: date,
        },
      }),
      ...(options.status === "open"
        ? []
        : [execution(`${base.id}:${date}:sell`, base, "sell", `${date}T02:00:00.000Z`, {
            source: {
              platform: "fixture",
              row: 2,
              tradeNature: options.nature ?? "live",
              simulationRunId: options.simulationRunId,
              tradingDate: date,
            },
          })]),
    ],
  };
  const metrics: TradeEpisodeMetrics = {
    buyCount: 1,
    sellCount: options.status === "open" ? 0 : 1,
    boughtQuantity: "1",
    soldQuantity: options.status === "open" ? "0" : "1",
    grossExposure: "10",
    fees: "0",
    realizedPnl: netPnl ?? "0",
    unrealizedPnl: null,
    netPnl,
    returnPercent: netPnl,
    holdingMilliseconds: options.status === "open" ? null : 3_600_000,
    ...(netPnl === null ? { pnlAvailable: false as const } : {}),
  };
  const entry = {
    instrument: base,
    executions: episode.executions,
    episodes: [{
      episode,
      metrics,
      reviewStatus: "pending",
      confirmedTagIds: [],
      tagDictionaryVersion: 1,
      rMultiple: null,
    }],
    tradeNature: options.nature,
    ...(options.simulationRunId ? { simulationRunId: options.simulationRunId } : {}),
    accountCount: 1,
    tradeCount: episode.executions.length,
    episodeCount: 1,
    firstTradeAt: episode.executions[0].executedAt,
    lastTradeAt: episode.executions.at(-1)!.executedAt,
    status: options.status ?? "closed",
    netPnl,
    returnPercent: netPnl,
    reviewedEpisodeCount: 0,
    confirmedTagIds: [],
    cumulativeR: null,
  } satisfies TradeLibraryEntry;
  return { entry, item: entry.episodes[0] };
}

const metadata = (assetType: "stock" | "etf", base: Instrument): TradingRoomInstrumentMetadata => ({
  market: base.market,
  symbol: base.symbol,
  assetType,
});

const liveScope = (overrides: Partial<RoomScope> = {}): RoomScope => ({
  ...DEFAULT_ROOM_SCOPE,
  period: buildRoomDateRange("month", "2026-09-19"),
  ...overrides,
});

describe("trading room scope contracts", () => {
  it("projects metadata into four mutually exclusive categories and keeps unknown explicit", () => {
    const usEtf = instrument({ id: "US:ETF", symbol: "SPY" });
    const hkEtf = instrument({ id: "HK:ETF", symbol: "02800", market: "HK", currency: "HKD" });
    const hkStock = instrument({ id: "HK:STOCK", symbol: "0700", market: "HK", currency: "HKD" });
    const cnStock = instrument({ id: "CN-SH:STOCK", symbol: "600000", market: "CN-SH", currency: "CNY" });

    expect(classifyTradingRoomAsset(usEtf, metadata("etf", usEtf))).toEqual({
      category: "us-stock",
      assetType: "etf",
      reason: null,
    });
    expect(classifyTradingRoomAsset(hkEtf, metadata("etf", hkEtf))).toEqual({
      category: "hk-stock",
      assetType: "etf",
      reason: null,
    });
    expect(classifyTradingRoomAsset(hkStock, metadata("stock", hkStock))).toEqual({
      category: "hk-stock",
      assetType: "stock",
      reason: null,
    });
    expect(classifyTradingRoomAsset(cnStock, metadata("stock", cnStock))).toEqual({
      category: "a-share-stock",
      assetType: "stock",
      reason: null,
    });
    expect(classifyTradingRoomAsset(usEtf)).toEqual({
      category: "us-stock",
      assetType: "unknown",
      reason: "缺少可信资产类型元数据",
    });
    expect(classifyTradingRoomAsset(usEtf, { ...metadata("etf", usEtf), symbol: "WRONG" })).toMatchObject({
      category: "us-stock",
      reason: expect.stringContaining("代码"),
    });
    expect(classifyTradingRoomAsset(instrument({ market: "OTHER" }), metadata("stock", instrument({ market: "OTHER" })))).toMatchObject({
      category: "unknown",
      reason: expect.stringContaining("市场"),
    });
  });

  it("normalizes metadata maps without mutating the instrument identity", () => {
    const base = instrument({ id: "US:AAPL", symbol: "AAPL" });
    const mapped = normalizeRoomMetadata(new Map([[base.id, { ...metadata("stock", base), market: "us" }]]));
    expect(mapped.get(base.id)).toEqual({ market: "US", symbol: "AAPL", assetType: "stock" });
    expect(base).toMatchObject({ id: "US:AAPL", market: "US", symbol: "AAPL" });
    expect(normalizeRoomMetadata({ [base.id]: undefined }).get(base.id)).toBeUndefined();
  });

  it("uses natural month boundaries and includes today", () => {
    expect(roomTodayKey(new Date("2026-09-18T17:00:00.000Z"))).toBe("2026-09-19");
    expect(buildRoomDateRange("month", "2026-09-19")).toEqual({
      preset: "month",
      startDate: "2026-09-01",
      endDate: "2026-09-19",
    });
    expect(buildRoomDateRange("last-3-months", "2026-01-02")).toEqual({
      preset: "last-3-months",
      startDate: "2025-11-01",
      endDate: "2026-01-02",
    });
    expect(buildRoomDateRange("ytd", "2024-02-29")).toEqual({
      preset: "ytd",
      startDate: "2024-01-01",
      endDate: "2024-02-29",
    });
  });

  it("keeps natural-month shortcuts stable at month ends and across leap years", () => {
    expect(buildRoomDateRange("month", "2026-03-31")).toEqual({
      preset: "month",
      startDate: "2026-03-01",
      endDate: "2026-03-31",
    });
    expect(buildRoomDateRange("last-3-months", "2026-03-31")).toEqual({
      preset: "last-3-months",
      startDate: "2026-01-01",
      endDate: "2026-03-31",
    });
    expect(buildRoomDateRange("last-3-months", "2024-02-29")).toEqual({
      preset: "last-3-months",
      startDate: "2023-12-01",
      endDate: "2024-02-29",
    });
  });

  it("defaults to year to date and supports an explicit all-history range", () => {
    expect(createDefaultRoomScope("2026-09-19").period).toEqual({
      preset: "ytd",
      startDate: "2026-01-01",
      endDate: "2026-09-19",
    });
    expect(buildRoomDateRange("all", "2026-09-19", { startDate: "2021-04-02", endDate: "2026-09-19" })).toEqual({
      preset: "all",
      startDate: "2021-04-02",
      endDate: "2026-09-19",
    });
  });

  it("does not add incomparable currencies without an FX snapshot", () => {
    const view = buildRoomMoneyView([
      { currency: "USD", amount: "100" },
      { currency: "HKD", amount: "200" },
    ]);
    expect(view).toMatchObject({
      originalByCurrency: { USD: "100", HKD: "200" },
      convertedCny: null,
      conversion: "missing",
      fxSnapshotId: null,
    });
    expect(view.note).toContain("原币");
  });

  it("uses one complete FX snapshot for a comparable CNY view", () => {
    const view = buildRoomMoneyView(
      [{ currency: "USD", amount: "100" }, { currency: "HKD", amount: "200" }],
      {
        id: "fx:1",
        baseCurrency: "CNY",
        asOf: "2026-09-19T08:00:00.000Z",
        source: "fixture",
        status: "complete",
        rates: { "USD/CNY": "7", "HKD/CNY": "0.9" },
      },
    );
    expect(view.convertedCny).toBe("880");
    expect(view.conversion).toBe("complete");
    expect(view.fxSnapshotId).toBe("fx:1");
  });

  it("does not call a money view complete when an input amount is invalid", () => {
    const view = buildRoomMoneyView(
      [{ currency: "USD", amount: "100" }, { currency: "HKD", amount: "not-a-number" }],
      {
        id: "fx:invalid-amount",
        baseCurrency: "CNY",
        asOf: "2026-09-19T08:00:00.000Z",
        source: "fixture",
        status: "complete",
        rates: { "USD/CNY": "7" },
      },
    );
    expect(view).toMatchObject({
      originalByCurrency: { USD: "100" },
      convertedCny: null,
      conversion: "partial",
    });
  });

  it("keeps a pure CNY amount comparable when the FX snapshot is partial", () => {
    const view = buildRoomMoneyView(
      [{ currency: "CNY", amount: "100" }],
      {
        id: "fx:partial-cny",
        baseCurrency: "CNY",
        asOf: "2026-09-19T08:00:00.000Z",
        source: "fixture",
        status: "partial",
        rates: {},
      },
    );
    expect(view).toMatchObject({ convertedCny: "100", conversion: "same-currency", fxSnapshotId: "fx:partial-cny" });
  });

  it("converts a mixed CNY/USD/HKD report to HKD with the same FX snapshot", () => {
    const view = buildRoomMoneyView(
      [
        { currency: "CNY", amount: "100" },
        { currency: "USD", amount: "10" },
        { currency: "HKD", amount: "20" },
      ],
      {
        id: "fx:hkd",
        baseCurrency: "CNY",
        asOf: "2026-09-19T08:00:00.000Z",
        source: "fixture",
        status: "complete",
        rates: { "USD/CNY": "7", "HKD/CNY": "0.875" },
      },
      "HKD",
    );
    expect(view).toMatchObject({
      targetCurrency: "HKD",
      converted: "214.28571428571428571",
      convertedCny: "187.5",
      convertedHkd: "214.28571428571428571",
      conversion: "complete",
      fxSnapshotId: "fx:hkd",
    });
  });

  it("keeps zero and negative amounts convertible to HKD", () => {
    const view = buildRoomMoneyView(
      [{ currency: "CNY", amount: "0" }, { currency: "USD", amount: "-7" }],
      {
        id: "fx:hkd-signed",
        baseCurrency: "CNY",
        asOf: "2026-09-19T08:00:00.000Z",
        source: "fixture",
        status: "complete",
        rates: { "USD/CNY": "7", "HKD/CNY": "0.875" },
      },
      "HKD",
    );
    expect(view.converted).toBe("-56");
    expect(view.originalByCurrency).toEqual({ CNY: "0", USD: "-7" });
  });

  it("does not silently fall back to CNY when HKD FX is missing", () => {
    const view = buildRoomMoneyView(
      [{ currency: "USD", amount: "10" }],
      {
        id: "fx:hkd-missing",
        baseCurrency: "CNY",
        asOf: "2026-09-19T08:00:00.000Z",
        source: "fixture",
        status: "complete",
        rates: { "USD/CNY": "7" },
      },
      "HKD",
    );
    expect(view).toMatchObject({
      targetCurrency: "HKD",
      converted: null,
      convertedCny: "70",
      convertedHkd: null,
      conversion: "partial",
    });
    expect(view.note).toContain("HKD");
  });

  it("filters simulation runs and keeps performance dates inclusive", () => {
    const live = row(instrument(), "2026-09-01", "10");
    const simulationA = row(instrument({ id: "US:SIM-A" }), "2026-09-19", "20", {
      nature: "simulation",
      simulationRunId: "run-a",
    });
    const simulationB = row(instrument({ id: "US:SIM-B" }), "2026-09-19", "30", {
      nature: "simulation",
      simulationRunId: "run-b",
    });
    const selected = filterRoomRows([live, simulationA, simulationB], liveScope({
      nature: "simulation",
      simulationRunId: "run-a",
    }));
    expect(selected.map(item => item.item.episode.id)).toEqual([simulationA.item.episode.id]);
  });

  it("filters ETF as a secondary asset type without changing its market category", () => {
    const shEtf = instrument({ id: "CN-SH:ETF", symbol: "510300", market: "CN-SH", currency: "CNY" });
    const usEtf = instrument({ id: "US:ETF", symbol: "SPY", market: "US", currency: "USD" });
    const stock = instrument({ id: "US:STOCK", symbol: "AAPL", market: "US", currency: "USD" });
    const selected = filterRoomRows(
      [row(shEtf, "2026-09-10", "10"), row(usEtf, "2026-09-11", "20"), row(stock, "2026-09-12", "30")],
      liveScope({ assetCategory: "us-stock", assetType: "etf" }),
      { instrumentMetadata: new Map([
        [shEtf.id, metadata("etf", shEtf)],
        [usEtf.id, metadata("etf", usEtf)],
        [stock.id, metadata("stock", stock)],
      ]) },
    );
    expect(selected.map(item => item.item.episode.instrument.id)).toEqual([usEtf.id]);
  });

  it("groups an A-share ETF with A-share performance instead of an ETF category", () => {
    const cnEtf = instrument({ id: "CN-SH:ETF", symbol: "510300", market: "CN-SH", currency: "CNY" });
    const cnStock = instrument({ id: "CN-SZ:STOCK", symbol: "000001", market: "CN-SZ", currency: "CNY" });
    const model = buildTradingRoomModel(
      [row(cnEtf, "2026-09-10", "10"), row(cnStock, "2026-09-11", "20")],
      {
        scope: liveScope(),
        instrumentMetadata: new Map([
          [cnEtf.id, metadata("etf", cnEtf)],
          [cnStock.id, metadata("stock", cnStock)],
        ]),
      },
    );

    expect(model.categories.map(category => category.id)).toEqual(["a-share-stock"]);
    expect(model.categories[0]?.label).toBe("A股");
    expect(model.categories[0]?.rows.map(value => [value.assetType, value.assetCategory])).toEqual([
      ["etf", "a-share-stock"],
      ["stock", "a-share-stock"],
    ]);
    expect(model.categories[0]?.summary.money.originalByCurrency).toEqual({ CNY: "30" });
  });

  it("keeps legacy ETF category scopes as a compatibility asset-type filter", () => {
    const etf = instrument({ id: "US:ETF", symbol: "SPY", market: "US", currency: "USD" });
    const stock = instrument({ id: "US:STOCK", symbol: "AAPL", market: "US", currency: "USD" });
    const selected = filterRoomRows(
      [row(etf, "2026-09-10", "10"), row(stock, "2026-09-11", "20")],
      liveScope({ assetCategory: "etf" }),
      { instrumentMetadata: new Map([[etf.id, metadata("etf", etf)], [stock.id, metadata("stock", stock)]]) },
    );
    expect(selected.map(item => item.item.episode.instrument.id)).toEqual([etf.id]);
  });

  it("ignores the performance date for current holdings", () => {
    const oldOpen = row(instrument(), "2020-01-01", null, { status: "open" });
    const closedInRange = row(instrument({ id: "US:CLOSED" }), "2026-09-10", "10");
    const scope = liveScope();
    expect(filterRoomRows([oldOpen], scope)).toHaveLength(0);
    expect(filterRoomRows([oldOpen], scope, { ignorePerformanceDates: true })).toHaveLength(1);
    expect(filterRoomRows([closedInRange], scope, { ignorePerformanceDates: true })).toHaveLength(0);
  });

  it("skips only the date range for library scope reuse while retaining closed rows and filters", () => {
    const old = instrument({ id: "US:OLD", symbol: "OLD" });
    const other = instrument({ id: "HK:OTHER", symbol: "OTHER", market: "HK", currency: "HKD" });
    const scope = liveScope({
      assetCategory: "us-stock",
      assetType: "stock",
      query: "OLD",
      instrumentIds: [old.id],
      markets: ["US"],
      currencies: ["USD"],
      reviewStatuses: ["pending"],
    });
    const selected = filterRoomRows(
      [row(old, "2020-01-01", "10"), row(other, "2020-01-01", "20")],
      scope,
      {
        ignoreDateRange: true,
        instrumentMetadata: new Map([
          [old.id, metadata("stock", old)],
          [other.id, metadata("stock", other)],
        ]),
      },
    );
    expect(selected).toHaveLength(1);
    expect(selected[0]?.item.episode.instrument.id).toBe(old.id);
    expect(selected[0]?.item.episode.status).toBe("closed");
  });

  it("summarizes trusted rounds and reports unknown asset episodes separately", () => {
    const cn = instrument({ id: "CN-SH:STOCK", symbol: "600000", market: "CN-SH", currency: "CNY" });
    const etf = instrument({ id: "US:ETF", symbol: "SPY", market: "US", currency: "USD" });
    const unknown = instrument({ id: "OTHER:UNKNOWN", symbol: "UNK", market: "OTHER", currency: "USD" });
    const rows = [row(cn, "2026-09-02", "100"), row(etf, "2026-09-03", "200"), row(unknown, "2026-09-04", "300")];
    const model = buildTradingRoomModel(rows, {
      scope: liveScope(),
      instrumentMetadata: new Map([
        [cn.id, metadata("stock", cn)],
        [etf.id, metadata("etf", etf)],
      ]),
    });
    expect(model.rows).toHaveLength(3);
    expect(model.summary.trustedClosedCount).toBe(2);
    expect(model.summary.unknownAssetEpisodeCount).toBe(1);
    expect(model.summary.money.originalByCurrency).toEqual({ CNY: "100", USD: "200" });
    expect(model.categories.map(category => category.id)).toEqual([
      "a-share-stock",
      "us-stock",
      "unknown",
    ]);
  });

  it("keeps open holdings out of the performance exclusion count", () => {
    const base = instrument({ id: "US:OPEN" });
    const model = buildTradingRoomModel([
      row(base, "2026-09-02", null, { status: "open" }),
      row(instrument({ id: "US:CLOSED" }), "2026-09-03", null),
    ], {
      scope: liveScope(),
      instrumentMetadata: new Map([
        [base.id, metadata("stock", base)],
        ["US:CLOSED", metadata("stock", instrument({ id: "US:CLOSED" }))],
      ]),
    });

    expect(model.summary.excludedCount).toBe(1);
    expect(model.summary.trustedClosedCount).toBe(0);
  });
});

it("filters by persisted Recall state instead of stale legacy status", () => {
  const value = row(instrument(), "2026-09-19", "10");
  value.item.recallReview = { episodeId: value.item.episode.id, status: "completed", updatedAt: "2026-09-25", text: "", snapshotCount: 1 };
  const scope = createDefaultRoomScope("2026-09-25");
  expect(filterRoomRows([value], { ...scope, reviewStatuses: ["pending"] })).toHaveLength(0);
  expect(filterRoomRows([value], { ...scope, reviewStatuses: ["completed"] })).toHaveLength(1);
  value.item.recallReview.status = "needs-confirmation";
  expect(filterRoomRows([value], { ...scope, reviewStatuses: ["pending"] })).toHaveLength(1);
  expect(filterRoomRows([value], { ...scope, reviewStatuses: ["completed"] })).toHaveLength(0);
});
