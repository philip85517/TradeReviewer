import { describe, expect, it } from "vitest";

import { buildRoomMoneyView, buildRoomDateRange } from "./trading-room-scope";
import {
  applyTradingRoomCalendarPeriod,
  buildDailyPnlPercent,
  createTradingRoomCalendarState,
  moveTradingRoomCalendarMonth,
  selectTradingRoomCalendarDate,
} from "./trading-room-time";

describe("trading room time contracts", () => {
  it("keeps calendar month navigation independent from the selected statistics period", () => {
    const period = buildRoomDateRange("last-3-months", "2026-01-02");
    const initial = createTradingRoomCalendarState(period);
    expect(initial).toMatchObject({
      period,
      displayMonth: "2026-01",
      selectedDate: null,
    });

    const previous = moveTradingRoomCalendarMonth(initial, -1);
    expect(previous.displayMonth).toBe("2025-12");
    expect(previous.period).toEqual(period);
    expect(moveTradingRoomCalendarMonth(previous, -1).displayMonth).toBe("2025-11");
    expect(moveTradingRoomCalendarMonth(previous, 1).displayMonth).toBe("2026-01");
    expect(moveTradingRoomCalendarMonth(initial, 1).displayMonth).toBe("2026-01");

    const selected = selectTradingRoomCalendarDate(previous, "2025-12-18");
    expect(selected.selectedDate).toBe("2025-12-18");
    expect(selectTradingRoomCalendarDate(previous, "2026-02-01").selectedDate).toBeNull();
    const nextPeriod = buildRoomDateRange("month", "2026-09-26");
    expect(applyTradingRoomCalendarPeriod(selected, nextPeriod)).toMatchObject({
      period: nextPeriod,
      displayMonth: "2026-09",
      selectedDate: null,
    });
  });

  it("uses the prior market value plus every day's buy spend as the independent denominator", () => {
    const result = buildDailyPnlPercent({
      dailyPnl: buildRoomMoneyView([{ currency: "USD", amount: "300" }]),
      previousMarketValue: buildRoomMoneyView([{ currency: "USD", amount: "10000" }]),
      buySpend: buildRoomMoneyView([{ currency: "USD", amount: "5000" }]),
      dailyPnlAvailable: true,
      previousMarketValueAvailable: true,
      buySpendAvailable: true,
      hasShortPosition: false,
    });

    expect(result).toEqual({
      value: "2",
      denominator: "15000",
      available: true,
      reason: null,
    });
  });

  it("keeps the amount gate separate from an unavailable percentage", () => {
    const dailyPnl = buildRoomMoneyView([{ currency: "USD", amount: "300" }]);
    const previousMarketValue = buildRoomMoneyView([{ currency: "USD", amount: "10000" }]);
    const buySpend = buildRoomMoneyView([{ currency: "USD", amount: "0" }]);

    expect(buildDailyPnlPercent({
      dailyPnl,
      previousMarketValue,
      buySpend,
      dailyPnlAvailable: true,
      previousMarketValueAvailable: false,
      buySpendAvailable: true,
      hasShortPosition: false,
    })).toMatchObject({ value: null, denominator: null, available: false });
    expect(buildDailyPnlPercent({
      dailyPnl,
      previousMarketValue,
      buySpend,
      dailyPnlAvailable: true,
      previousMarketValueAvailable: true,
      buySpendAvailable: true,
      hasShortPosition: true,
    })).toMatchObject({ value: null, denominator: null, available: false });
  });

  it("uses the same target FX snapshot for the numerator and denominator", () => {
    const fxSnapshot = {
      id: "fx-hkd",
      baseCurrency: "CNY" as const,
      asOf: "2026-09-26",
      source: "fixture",
      status: "complete" as const,
      rates: { "USD/CNY": "7", "HKD/CNY": "0.875" },
    };
    const converted = buildDailyPnlPercent({
      dailyPnl: buildRoomMoneyView([{ currency: "USD", amount: "300" }], fxSnapshot, "HKD"),
      previousMarketValue: buildRoomMoneyView([{ currency: "USD", amount: "10000" }], fxSnapshot, "HKD"),
      buySpend: buildRoomMoneyView([{ currency: "USD", amount: "5000" }], fxSnapshot, "HKD"),
      dailyPnlAvailable: true,
      previousMarketValueAvailable: true,
      buySpendAvailable: true,
      hasShortPosition: false,
      targetCurrency: "HKD",
    });
    expect(converted).toMatchObject({ value: "2", denominator: "120000", available: true });

    const missingTarget = buildDailyPnlPercent({
      dailyPnl: buildRoomMoneyView([{ currency: "USD", amount: "300" }], { ...fxSnapshot, rates: { "USD/CNY": "7" } }, "HKD"),
      previousMarketValue: buildRoomMoneyView([{ currency: "USD", amount: "10000" }], { ...fxSnapshot, rates: { "USD/CNY": "7" } }, "HKD"),
      buySpend: buildRoomMoneyView([{ currency: "USD", amount: "5000" }], { ...fxSnapshot, rates: { "USD/CNY": "7" } }, "HKD"),
      dailyPnlAvailable: true,
      previousMarketValueAvailable: true,
      buySpendAvailable: true,
      hasShortPosition: false,
      targetCurrency: "HKD",
    });
    expect(missingTarget).toMatchObject({ value: null, denominator: null, available: false });
  });
});
