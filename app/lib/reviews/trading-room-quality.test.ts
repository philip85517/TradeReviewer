import { describe, expect, it } from "vitest";

import type { FxState } from "../fx/contracts";
import type { MarketDataJob } from "../storage/market-data-jobs";
import type { TradingRoomHoldingRow, TradingRoomHoldingsModel } from "./trading-room-holdings";
import type { RoomFxSnapshot, RoomScope, TradingRoomRow } from "./trading-room-scope";
import { buildTradingRoomQuality } from "./trading-room-quality";

const scope: RoomScope = {
  nature: "live",
  assetCategory: "all",
  period: { preset: "month", startDate: "2026-09-01", endDate: "2026-09-19" },
  simulationRunId: null,
  accountIds: [],
  instrumentIds: [],
  markets: [],
  currencies: [],
  reviewStatuses: [],
};

function roomRow(
  instrumentId: string,
  overrides: Partial<Pick<TradingRoomRow, "assetCategory" | "trustedPnl" | "exclusionReason" | "assetReason">> = {},
): TradingRoomRow {
  const instrument = {
    id: instrumentId,
    symbol: instrumentId.split(":").at(-1) ?? instrumentId,
    name: instrumentId,
    market: instrumentId.startsWith("US:") ? "US" : "HK",
    currency: instrumentId.startsWith("US:") ? "USD" : "HKD",
  };
  return {
    row: {
      entry: { instrument } as never,
      item: {
        episode: {
          id: `${instrumentId}:episode`,
          status: "closed",
          accountId: "account-123456",
          accountLabel: "主账户",
          instrument,
        },
      },
    } as never,
    assetCategory: "us-stock",
    assetType: "stock",
    sourceNature: "live",
    closeDate: "2026-09-10",
    trustedPnl: "10",
    exclusionReason: null,
    assetReason: null,
    ...overrides,
  };
}

function holdingsRow(instrumentId: string, status: TradingRoomHoldingRow["unrealizedPnlStatus"]): TradingRoomHoldingRow {
  return {
    row: roomRow(instrumentId).row,
    instrumentId,
    instrumentName: instrumentId,
    symbol: instrumentId.split(":").at(-1) ?? instrumentId,
    market: "US",
    marketLabel: "美股",
    accountId: "account-123456",
    accountLabel: "主账户",
    episodeId: `${instrumentId}:open`,
    settlementCurrency: "USD",
    latestTradeDate: "2026-09-10",
    sourceNature: "live",
    simulationRunId: null,
    assetCategory: "us-stock",
    assetType: "stock",
    assetReason: null,
    lastActivityAt: "2026-09-10T00:00:00.000Z",
    position: null,
    quantity: null,
    quantityStatus: "unavailable",
    averageCost: null,
    costStatus: "unavailable",
    quote: null,
    quoteStatus: "missing",
    unrealizedPnl: status === "available" ? "2" : null,
    unrealizedPnlStatus: status,
    statusReason: status === "available" ? null : "缺少行情，无法计算浮盈亏",
  };
}

function holdings(rows: TradingRoomHoldingRow[]): TradingRoomHoldingsModel {
  return {
    scope,
    asOf: "2026-09-19",
    latestImportedTradeDate: "2026-09-10",
    rows,
    groups: [],
    availablePnlCount: rows.filter(row => row.unrealizedPnlStatus === "available").length,
    unavailablePnlCount: rows.filter(row => row.unrealizedPnlStatus !== "available").length,
  };
}

function fxState(overrides: Partial<FxState> = {}): FxState {
  return {
    id: "fx:test",
    baseCurrency: "CNY",
    source: "BOC",
    publishedAt: "2026-09-19T10:00:00+08:00",
    publishedAtByCurrency: { USD: "2026-09-19T10:00:00+08:00", HKD: "2026-09-19T10:00:00+08:00" },
    fetchedAt: "2026-09-19T02:00:00.000Z",
    rates: { USD: "6.75", HKD: "0.86" },
    lastAttemptDay: "2026-09-19",
    status: "complete",
    error: null,
    ...overrides,
  };
}

function fxSnapshot(status: RoomFxSnapshot["status"] = "complete"): RoomFxSnapshot {
  return {
    id: "fx:test",
    baseCurrency: "CNY",
    source: "BOC",
    asOf: "2026-09-19T10:00:00+08:00",
    status,
    rates: { "USD/CNY": "6.75", "HKD/CNY": "0.86" },
  };
}

describe("buildTradingRoomQuality", () => {
  it("keeps unknown fees in transaction quality even when market history is complete", () => {
    const model = buildTradingRoomQuality({
      scope,
      rows: [roomRow("US:AAPL"), roomRow("US:MSFT", { trustedPnl: null, exclusionReason: "unknown-fees" })],
      marketDataStatuses: { "US:AAPL": "complete", "US:MSFT": "complete" },
      marketDataCandles: { "US:AAPL": [{ tradingDate: "2026-09-19" } as never], "US:MSFT": [{ tradingDate: "2026-09-19" } as never] },
    });

    expect(model.dimensions.find(dimension => dimension.id === "transaction")).toMatchObject({
      status: "limited",
      availableCount: 1,
      totalCount: 2,
      affectedCount: 1,
    });
  });

  it("uses the current holdings denominator and keeps missing quotes separate", () => {
    const model = buildTradingRoomQuality({
      scope,
      rows: [roomRow("US:AAPL")],
      holdings: holdings([holdingsRow("US:AAPL", "available"), holdingsRow("US:MSFT", "missing")]),
    });

    expect(model.dimensions.find(dimension => dimension.id === "holdings")).toMatchObject({
      status: "limited",
      availableCount: 1,
      totalCount: 2,
      affectedCount: 1,
    });
  });

  it("treats unsupported history as a source decision and stale history as retryable", () => {
    const job: MarketDataJob = {
      instrumentId: "HK:0700",
      symbol: "0700",
      market: "HK",
      requestedAt: "2026-09-19T02:00:00.000Z",
      status: "source-unavailable",
      intervals: [],
    };
    const model = buildTradingRoomQuality({
      scope,
      rows: [roomRow("HK:0700"), roomRow("US:SPY")],
      marketDataStatuses: { "HK:0700": "needs-provider", "US:SPY": "stale" },
      marketDataLabels: { "HK:0700": "行情源待连接", "US:SPY": "行情可更新" },
      marketDataJobs: { "HK:0700": job },
    });
    const dimension = model.dimensions.find(item => item.id === "historical");

    expect(dimension).toMatchObject({ status: "needs-check", totalCount: 2, availableCount: 0, affectedCount: 2, action: "source-unsupported" });
    expect(dimension?.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ instrumentId: "HK:0700", action: "source-unsupported" }),
      expect.objectContaining({ instrumentId: "US:SPY", action: "retry" }),
    ]));
  });

  it("reports failed FX with complete old rates as a limited stale estimate", () => {
    const model = buildTradingRoomQuality({
      scope,
      rows: [roomRow("US:AAPL")],
      fxState: fxState({ status: "partial", error: "更新失败：汇率源响应 502" }),
      fxSnapshot: fxSnapshot("partial"),
    });
    const dimension = model.dimensions.find(item => item.id === "fx");

    expect(dimension).toMatchObject({ status: "limited", totalCount: 1, availableCount: 1, affectedCount: 0, action: "retry" });
    expect(dimension?.reason).toContain("沿用");
  });

  it("does not require FX for an all-CNY scope and returns an empty-scope model", () => {
    const cny = roomRow("CN-SH:600000");
    cny.row.item.episode.instrument.currency = "CNY";
    const empty = buildTradingRoomQuality({ scope, rows: [] });
    const cnyModel = buildTradingRoomQuality({ scope, rows: [cny] });

    expect(empty.status).toBe("available");
    expect(cnyModel.dimensions.find(item => item.id === "fx")).toMatchObject({ status: "available", totalCount: 0, action: "none" });
  });

  it("keeps unknown assets out of the four class denominator and asks for classification", () => {
    const unknown = roomRow("US:UNKNOWN", { assetCategory: "unknown", assetReason: "缺少可信资产类型元数据" });
    const unknownOnly = buildTradingRoomQuality({ scope, rows: [unknown] });
    const mixed = buildTradingRoomQuality({
      scope,
      rows: [roomRow("US:AAPL"), unknown],
      marketDataStatuses: { "US:AAPL": "complete" },
      marketDataCandles: { "US:AAPL": [{ tradingDate: "2026-09-19" } as never] },
      fxSnapshot: fxSnapshot(),
    });

    expect(unknownOnly.status).toBe("needs-check");
    expect(unknownOnly.unknownAssetCount).toBe(1);
    expect(unknownOnly.unknownAssetEpisodeCount).toBe(1);
    expect(unknownOnly.dimensions.find(item => item.id === "transaction")).toMatchObject({ totalCount: 0, availableCount: 0 });
    expect(mixed.status).toBe("limited");
    expect(mixed.unknownAssetCount).toBe(1);
  });

  it("does not queue a provider-unsupported holding for retry and includes current holdings in history", () => {
    const current = holdings([holdingsRow("HK:0700", "missing")]);
    const model = buildTradingRoomQuality({
      scope,
      rows: [],
      holdings: current,
      marketDataStatuses: { "HK:0700": "needs-provider" },
      marketDataLabels: { "HK:0700": "行情源待连接" },
      marketDataCandles: { "HK:0700": [] },
    });
    const holdingsDimension = model.dimensions.find(item => item.id === "holdings");
    const historicalDimension = model.dimensions.find(item => item.id === "historical");

    expect(holdingsDimension).toMatchObject({ action: "source-unsupported", retryableInstrumentIds: [] });
    expect(holdingsDimension?.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ action: "source-unsupported", instrumentId: "HK:0700" }),
    ]));
    expect(historicalDimension).toMatchObject({ totalCount: 1, action: "source-unsupported" });
  });

  it("uses independent daily status for holdings when the merged 1H status is unsupported", () => {
    const current = holdings([
      holdingsRow("HK:0700", "missing"),
      holdingsRow("HK:0701", "missing"),
      holdingsRow("HK:0702", "missing"),
    ]);
    const model = buildTradingRoomQuality({
      scope,
      rows: [],
      // This is the legacy merged status: 1H is unsupported while daily data
      // has separate, actionable states below.
      marketDataStatuses: {
        "HK:0700": "needs-provider",
        "HK:0701": "needs-provider",
        "HK:0702": "needs-provider",
      },
      marketDataLabels: {
        "HK:0700": "行情源待连接",
        "HK:0701": "行情源待连接",
        "HK:0702": "行情源待连接",
      },
      marketDataDailyStatuses: {
        "HK:0700": "stale",
        "HK:0701": "source-unavailable",
        "HK:0702": "needs-provider",
      },
      holdings: current,
    });
    const dimension = model.dimensions.find(item => item.id === "holdings");

    expect(dimension?.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ instrumentId: "HK:0700", action: "retry" }),
      expect.objectContaining({ instrumentId: "HK:0701", action: "retry" }),
      expect.objectContaining({ instrumentId: "HK:0702", action: "source-unsupported" }),
    ]));
    expect(dimension).toMatchObject({
      action: "source-unsupported",
      retryableInstrumentIds: expect.arrayContaining(["HK:0700", "HK:0701"]),
      sourceUnsupportedInstrumentIds: ["HK:0702"],
    });
  });

  it("does not call a complete status coverage when its candle cache is empty", () => {
    const model = buildTradingRoomQuality({
      scope,
      rows: [roomRow("US:AAPL")],
      marketDataStatuses: { "US:AAPL": "complete" },
      marketDataCandles: { "US:AAPL": [] },
    });
    expect(model.dimensions.find(item => item.id === "historical")).toMatchObject({
      status: "needs-check",
      availableCount: 0,
      affectedCount: 1,
    });
  });

  it("does not infer complete history from one candle when coverage status is missing", () => {
    const model = buildTradingRoomQuality({
      scope,
      rows: [roomRow("US:AAPL")],
      marketDataCandles: { "US:AAPL": [{ tradingDate: "2026-09-19" } as never] },
    });
    expect(model.dimensions.find(item => item.id === "historical")).toMatchObject({
      status: "needs-check",
      totalCount: 1,
      availableCount: 0,
      action: "retry",
    });
  });

  it("does not infer a cross-range history coverage from boundary candles without status", () => {
    const model = buildTradingRoomQuality({
      scope,
      rows: [roomRow("US:AAPL")],
      marketDataCandles: {
        "US:AAPL": [
          { tradingDate: "2026-09-01" } as never,
          { tradingDate: "2026-09-19" } as never,
        ],
      },
    });
    expect(model.dimensions.find(item => item.id === "historical")).toMatchObject({
      status: "needs-check",
      totalCount: 1,
      availableCount: 0,
      affectedCount: 1,
    });
  });
});
