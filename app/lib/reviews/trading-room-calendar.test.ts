import { describe, expect, it } from "vitest";

import type { TradeLibraryEntry } from "../trades/library";
import type { Instrument, TradeExecution } from "../trades/types";
import {
  buildRoomDateRange,
  createDefaultRoomScope,
  type RoomScope,
  type TradingRoomInstrumentMetadata,
} from "./trading-room-scope";
import { buildTradingRoomCalendar } from "./trading-room-calendar";

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

function execution(base: Instrument, date: string, side: "buy" | "sell", accountId = "account-1"): TradeExecution {
  return {
    id: `${base.id}:${date}:${side}:${accountId}`,
    source: { platform: "fixture", row: side === "buy" ? 1 : 2, tradingDate: date },
    accountId,
    accountLabel: "主账户",
    instrument: base,
    side,
    executedAt: `${date}T01:00:00.000Z`,
    quantity: "1",
    price: side === "buy" ? "10" : "11",
    fee: "0",
  };
}

function closedEntry(
  date: string,
  pnl: string,
  overrides: { instrument?: Instrument; id?: string; accountId?: string; trusted?: boolean } = {},
): TradeLibraryEntry {
  const base = overrides.instrument ?? instrument();
  const accountId = overrides.accountId ?? "account-1";
  const buy = execution(base, date, "buy", accountId);
  const sell = execution(base, date, "sell", accountId);
  const episodeId = `${overrides.id ?? base.id}:${date}:${accountId}`;
  const episode = {
    id: episodeId,
    accountId,
    accountLabel: "主账户",
    instrument: base,
    tradeNature: "live" as const,
    direction: "long" as const,
    status: "closed" as const,
    startedAt: buy.executedAt,
    endedAt: `${date}T02:00:00.000Z`,
    openingQuantity: "1",
    remainingQuantity: "0",
    executions: [buy, sell],
    ...(overrides.trusted === false ? { accuracy: { pnl: "unavailable" as const, reasons: ["unknown-cost"] } } : {}),
  };
  return {
    groupId: `${base.id}:live`,
    tradeNature: "live",
    instrument: base,
    executions: [buy, sell],
    episodes: [{
      episode,
      metrics: {
        buyCount: 1,
        sellCount: 1,
        boughtQuantity: "1",
        soldQuantity: "1",
        grossExposure: "10",
        fees: "0",
        realizedPnl: overrides.trusted === false ? "0" : pnl,
        unrealizedPnl: "0",
        netPnl: overrides.trusted === false ? null : pnl,
        returnPercent: overrides.trusted === false ? null : pnl,
        holdingMilliseconds: 3_600_000,
        ...(overrides.trusted === false ? { pnlAvailable: false as const } : {}),
      },
      reviewStatus: "pending",
      confirmedTagIds: [],
      tagDictionaryVersion: 1,
      rMultiple: null,
    }],
    accountCount: 1,
    tradeCount: 2,
    episodeCount: 1,
    firstTradeAt: buy.executedAt,
    lastTradeAt: sell.executedAt,
    status: "closed",
    netPnl: overrides.trusted === false ? null : pnl,
    returnPercent: overrides.trusted === false ? null : pnl,
    reviewedEpisodeCount: 0,
    confirmedTagIds: [],
    cumulativeR: null,
  };
}

function scope(period = buildRoomDateRange("month", "2026-09-19"), overrides: Partial<RoomScope> = {}): RoomScope {
  return { ...createDefaultRoomScope("2026-09-19"), period, ...overrides };
}

function metadata(entries: readonly TradeLibraryEntry[]): ReadonlyMap<string, TradingRoomInstrumentMetadata> {
  return new Map(entries.map(entry => [entry.instrument.id, { market: entry.instrument.market, symbol: entry.instrument.symbol, assetType: "stock" }]));
}

describe("buildTradingRoomCalendar", () => {
  it("builds a daily cumulative trend whose end equals the same-scope summary", () => {
    const entries = [
      closedEntry("2026-09-02", "100"),
      closedEntry("2026-09-03", "-40", { id: "US:SECOND" }),
    ];
    const model = buildTradingRoomCalendar(entries, {
      scope: scope(),
      level: "month",
      asOf: "2026-09-19T08:00:00.000Z",
      instrumentMetadata: metadata(entries),
    });

    expect(model.cells).toHaveLength(30);
    expect(model.range).toMatchObject({ startDate: "2026-09-01", endDate: "2026-09-19" });
    expect(model.summary.money.originalByCurrency).toEqual({ USD: "60" });
    expect(model.trend.points.at(-1)?.money.originalByCurrency).toEqual({ USD: "60" });
    expect(model.trend.points.at(-1)?.value).toBe("60");
    expect(model.trend.points).toHaveLength(19);
    expect(model.trend.points[0]?.value).toBe("0");
    expect(model.trend.points.every(point => point.startDate <= "2026-09-19")).toBe(true);
    expect(model.cells.find(cell => cell.key === "2026-09-02")).toMatchObject({ value: "100", state: "positive" });
    expect(model.cells.find(cell => cell.key === "2026-09-03")).toMatchObject({ value: "-40", state: "negative" });
    expect(model.cells.find(cell => cell.key === "2026-09-20")).toMatchObject({ value: null, state: "future" });
  });

  it("uses truncated month buckets for a custom range spanning calendar months", () => {
    const entries = [
      closedEntry("2026-08-20", "10"),
      closedEntry("2026-09-02", "20", { id: "US:SEP" }),
      closedEntry("2026-10-02", "30", { id: "US:OCT" }),
    ];
    const model = buildTradingRoomCalendar(entries, {
      scope: scope(buildRoomDateRange("custom", "2026-10-10", { startDate: "2026-08-15", endDate: "2026-10-10" })),
      level: "month",
      asOf: "2026-10-10T08:00:00.000Z",
      instrumentMetadata: metadata(entries),
    });

    expect(model.cells.map(cell => cell.key)).toEqual(["2026-08", "2026-09", "2026-10"]);
    expect(model.cells.map(cell => [cell.startDate, cell.endDate])).toEqual([
      ["2026-08-15", "2026-08-31"],
      ["2026-09-01", "2026-09-30"],
      ["2026-10-01", "2026-10-10"],
    ]);
    expect(model.cells.map(cell => cell.label)).toEqual([
      "2026年8月（覆盖08-15至08-31）",
      "2026年9月",
      "2026年10月（覆盖10-01至10-10）",
    ]);
    expect(model.cells.map(cell => cell.value)).toEqual(["10", "20", "30"]);
  });

  it("shows the three selected natural months before month drilldown", () => {
    const entries = [
      closedEntry("2026-07-02", "10"),
      closedEntry("2026-08-02", "20", { id: "US:AUG" }),
      closedEntry("2026-09-02", "30", { id: "US:SEP" }),
    ];
    const model = buildTradingRoomCalendar(entries, {
      scope: scope(buildRoomDateRange("last-3-months", "2026-09-19")),
      level: "month",
      asOf: "2026-09-19T08:00:00.000Z",
      instrumentMetadata: metadata(entries),
    });

    expect(model.cells.map(cell => cell.key)).toEqual(["2026-07", "2026-08", "2026-09"]);
    expect(model.scope.period.preset).toBe("last-3-months");
    expect(model.cells.map(cell => cell.value)).toEqual(["10", "20", "30"]);
  });

  it("builds all twelve year months, greys future months, and preserves leap-day source dates", () => {
    const entries = [
      closedEntry("2024-02-29", "5"),
      closedEntry("2026-01-02", "10", { id: "US:JAN" }),
    ];
    const model = buildTradingRoomCalendar(entries, {
      scope: scope(buildRoomDateRange("ytd", "2026-09-19")),
      level: "year",
      anchorDate: "2026-09-19",
      asOf: "2026-09-19T08:00:00.000Z",
      instrumentMetadata: metadata(entries),
    });

    expect(model.cells).toHaveLength(12);
    expect(model.cells[0].key).toBe("2026-01");
    expect(model.cells.find(cell => cell.key === "2026-10")).toMatchObject({ state: "future", value: null });
    expect(model.cells.find(cell => cell.key === "2024-02")).toBeUndefined();
  });

  it("uses all historical years without first applying the current-month date window", () => {
    const entries = [
      closedEntry("2024-12-31", "5"),
      closedEntry("2025-01-02", "10", { id: "US:2025" }),
      closedEntry("2026-09-02", "20", { id: "US:2026" }),
    ];
    const model = buildTradingRoomCalendar(entries, {
      scope: scope(),
      level: "all-years",
      asOf: "2026-09-19T08:00:00.000Z",
      instrumentMetadata: metadata(entries),
    });

    expect(model.cells.map(cell => cell.key)).toEqual(["2024", "2025", "2026"]);
    expect(model.summary.money.originalByCurrency).toEqual({ USD: "35" });
  });

  it("keeps zero, excluded, empty, future, and mixed-currency values explicit", () => {
    const zero = closedEntry("2026-09-02", "0");
    const excluded = closedEntry("2026-09-03", "100", { id: "US:EXCLUDED", trusted: false });
    const hkd = closedEntry("2026-09-04", "2", { id: "HK:0700", instrument: instrument({ id: "HK:0700", symbol: "0700", market: "HK", currency: "HKD" }) });
    const future = closedEntry("2026-09-20", "9", { id: "US:FUTURE" });
    const entries = [zero, excluded, hkd, future];
    const model = buildTradingRoomCalendar(entries, {
      scope: scope(buildRoomDateRange("custom", "2026-09-20", { startDate: "2026-09-01", endDate: "2026-09-20" })),
      level: "month",
      asOf: "2026-09-19T08:00:00.000Z",
      instrumentMetadata: metadata(entries),
    });

    expect(model.summary.money.convertedCny).toBeNull();
    expect(model.summary.money.originalByCurrency).toEqual({ HKD: "2", USD: "0" });
    expect(model.cells.find(cell => cell.key === "2026-09-02")).toMatchObject({ state: "break-even", value: "0" });
    expect(model.cells.find(cell => cell.key === "2026-09-03")).toMatchObject({ state: "unavailable", excludedCount: 1 });
    expect(model.cells.find(cell => cell.key === "2026-09-20")).toMatchObject({ state: "future", value: null });
  });

  it("keeps unknown assets out of closed-round exclusions while retaining their count", () => {
    const unknown = closedEntry("2026-09-02", "100", { instrument: instrument({ id: "US:UNKNOWN", symbol: "UNKNOWN" }) });
    const model = buildTradingRoomCalendar([unknown], {
      scope: scope(),
      level: "month",
      asOf: "2026-09-19T08:00:00.000Z",
    });

    expect(model.summary).toMatchObject({ excludedCount: 0, unknownAssetCount: 1, unknownAssetEpisodeCount: 1 });
  });

  it("uses one FX snapshot for summary, trend, and every calendar cell", () => {
    const entries = [
      closedEntry("2026-09-02", "10"),
      closedEntry("2026-09-03", "20", { id: "HK:0700", instrument: instrument({ id: "HK:0700", symbol: "0700", market: "HK", currency: "HKD" }) }),
    ];
    const model = buildTradingRoomCalendar(entries, {
      scope: scope(),
      level: "month",
      asOf: "2026-09-19T08:00:00.000Z",
      instrumentMetadata: metadata(entries),
      fxSnapshot: { id: "fx-1", baseCurrency: "CNY", asOf: "2026-09-19", source: "BOC", status: "complete", rates: { "HKD/CNY": "0.9", "USD/CNY": "7" } },
    });

    expect(model.summary.money).toMatchObject({ convertedCny: "88", fxSnapshotId: "fx-1" });
    expect(new Set(model.cells.flatMap(cell => cell.money.fxSnapshotId).filter(Boolean))).toEqual(new Set(["fx-1"]));
    expect(new Set(model.trend.points.map(point => point.money.fxSnapshotId).filter(Boolean))).toEqual(new Set(["fx-1"]));
  });

  it("uses the Shanghai natural day at the UTC midnight boundary", () => {
    const model = buildTradingRoomCalendar([], {
      scope: scope(buildRoomDateRange("month", "2026-09-19")),
      level: "month",
      asOf: "2026-09-18T17:00:00.000Z",
    });

    expect(model.asOf).toBe("2026-09-19");
    expect(model.cells.find(cell => cell.key === "2026-09-20")).toMatchObject({ state: "future", value: null });
  });
});
