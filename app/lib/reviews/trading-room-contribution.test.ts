import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { buildInstrumentTradeSummaries } from "../trades/instruments";
import { buildTradeLibraryEntries } from "../trades/library";
import type { TradeExecution } from "../trades/types";
import { buildTradingRoomModel, createDefaultRoomScope, type RoomFxSnapshot } from "./trading-room-scope";
import { buildRoomContribution } from "./trading-room-contribution";

function room() {
  const fills: TradeExecution[] = [];
  for (const [id, market, currency, accountId, pnl] of [["ONE", "US", "USD", "a", 10], ["TWO", "US", "USD", "b", -10], ["THREE", "HK", "HKD", "a", 4]] as const) {
    const instrument = { id: `${market}:${id}`, symbol: id, name: "同名证券", market, currency };
    for (const side of ["buy", "sell"] as const) fills.push({ id: `${id}:${side}`, accountId, accountLabel: "同名账户", instrument, side, executedAt: `2026-09-02T0${side === "buy" ? 1 : 2}:00:00Z`, quantity: "1", price: String(side === "buy" ? 20 : 20 + pnl), fee: "0", source: { tradeNature: "live", platform: "test", row: 1, tradingDate: "2026-09-02" } });
  }
  const entries = buildTradeLibraryEntries(buildInstrumentTradeSummaries(fills), {}, {});
  return { entries, scope: createDefaultRoomScope("2026-09-25"), instrumentMetadata: { "US:ONE": { market: "US", symbol: "ONE", assetType: "etf" as const }, "US:TWO": { market: "US", symbol: "TWO", assetType: "stock" as const }, "HK:THREE": { market: "HK", symbol: "THREE", assetType: "stock" as const } } };
}
const fx: RoomFxSnapshot = { id: "same-fx", baseCurrency: "CNY", asOf: "2026-09-25", source: "fixture", status: "complete", rates: { "USD/CNY": "7", "HKD/CNY": "0.9" } };

describe("buildRoomContribution", () => {
  it("reconciles every signed dimension to the same original room summary without counting ETF as a second market", () => {
    const data = room();
    const source = buildTradingRoomModel(data.entries, data);
    const result = buildRoomContribution(source.rows);
    expect(result.total).toEqual(source.summary.money);
    expect(result.dimensions.market.map(group => group.id)).toEqual(["HK", "US"]);
    expect(result.dimensions.market.find(group => group.id === "US")?.money.originalByCurrency.USD).toBe("0");
    expect(result.dimensions.instrument).toHaveLength(3);
    expect(result.dimensions.account).toHaveLength(2);
    expect(result.dimensions.instrument.some(group => group.money.originalByCurrency.USD === "-10")).toBe(true);
    for (const groups of Object.values(result.dimensions)) for (const currency of ["USD", "HKD"]) expect(groups.reduce((sum, group) => sum.plus(group.money.originalByCurrency[currency] ?? "0"), new Decimal(0)).toString()).toBe(source.summary.money.originalByCurrency[currency]);
  });
  it("uses the supplied common FX snapshot and never mixes partial conversions", () => {
    const data = room();
    const source = buildTradingRoomModel(data.entries, { ...data, fxSnapshot: fx });
    const result = buildRoomContribution(source.rows, fx);
    expect(result.total).toEqual(source.summary.money);
    expect(result.total.convertedCny).toBe("3.6");
    for (const groups of Object.values(result.dimensions)) expect(groups.reduce((sum, group) => sum.plus(group.money.convertedCny!), new Decimal(0)).toString()).toBe("3.6");
    const partial = buildRoomContribution(source.rows, { ...fx, rates: { "USD/CNY": "7" } });
    expect(partial.total.convertedCny).toBeNull();
    expect(partial.total.originalByCurrency).toEqual({ USD: "0", HKD: "4" });
  });
  it("converts every contribution dimension to the selected HKD target", () => {
    const data = room();
    const source = buildTradingRoomModel(data.entries, { ...data, fxSnapshot: fx, targetCurrency: "HKD" });
    const result = buildRoomContribution(source.rows, fx, "HKD");
    expect(result.total).toMatchObject({ targetCurrency: "HKD", converted: "4" });
    expect(result.dimensions.market.find(group => group.id === "HK")?.money.converted).toBe("4");
  });
  it("retains excluded and unknown explanations and follows the caller's already scoped rows", () => {
    const data = room();
    data.entries[0].episodes[0].metrics.netPnl = null;
    const source = buildTradingRoomModel(data.entries, { ...data, scope: { ...data.scope, accountIds: ["a"] } });
    const result = buildRoomContribution(source.rows);
    expect(result.includedCount).toBe(source.summary.trustedClosedCount);
    expect(result.excluded.length).toBe(source.summary.excludedCount);
    expect(result.dimensions.account.every(group => group.id === "a")).toBe(true);
    expect(buildRoomContribution([]).includedCount).toBe(0);
  });
});
