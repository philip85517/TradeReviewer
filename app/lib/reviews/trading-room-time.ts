import Decimal from "decimal.js";

import {
  roomMoneyValue,
  type RoomDateRange,
  type RoomMoneyView,
  type RoomTargetCurrency,
} from "./trading-room-scope";

export type TradingRoomCalendarState = {
  /** The statistics period; navigation must never mutate this value. */
  period: RoomDateRange;
  /** The separately browsed calendar month in YYYY-MM form. */
  displayMonth: string;
  /** A day selected for drilldown, or null when the month changed. */
  selectedDate: string | null;
};

export type DailyPnlPercentInput = {
  dailyPnl: RoomMoneyView;
  previousMarketValue: RoomMoneyView;
  buySpend: RoomMoneyView;
  dailyPnlAvailable: boolean;
  previousMarketValueAvailable: boolean;
  buySpendAvailable: boolean;
  hasShortPosition: boolean;
  /** Used only for explicit target mode; legacy money views carry it themselves. */
  targetCurrency?: RoomTargetCurrency;
};

export type DailyPnlPercentResult = {
  value: string | null;
  denominator: string | null;
  available: boolean;
  reason: string | null;
};

function decimal(value: string | null | undefined): Decimal | null {
  if (value === null || value === undefined) return null;
  try {
    const parsed = new Decimal(value);
    return parsed.isFinite() ? parsed : null;
  } catch {
    return null;
  }
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function monthStart(value: string): string {
  return `${value.slice(0, 7)}-01`;
}

function monthDelta(value: string, delta: number): string {
  const date = new Date(`${monthStart(value)}T00:00:00.000Z`);
  date.setUTCMonth(date.getUTCMonth() + delta);
  return date.toISOString().slice(0, 7);
}

function clampMonth(period: RoomDateRange, month: string): string {
  const first = period.startDate.slice(0, 7);
  const last = period.endDate.slice(0, 7);
  if (month < first) return first;
  if (month > last) return last;
  return month;
}

function moneyScalar(view: RoomMoneyView, targetCurrency?: RoomTargetCurrency): string | null {
  if (targetCurrency !== undefined || view.targetCurrency !== undefined || view.converted !== undefined) {
    return roomMoneyValue(view);
  }
  if (view.convertedCny !== null) return view.convertedCny;
  const currencies = Object.keys(view.originalByCurrency);
  return currencies.length === 1 ? view.originalByCurrency[currencies[0]] : null;
}

function currencySet(view: RoomMoneyView): Set<string> {
  return new Set(Object.keys(view.originalByCurrency));
}

function sameOriginalCurrency(views: readonly RoomMoneyView[]): boolean {
  const currencies = [...new Set(views.flatMap(view => [...currencySet(view)]))];
  if (currencies.length !== 1) return false;
  return views.every(view => {
    const values = [...currencySet(view)];
    return values.length === 0 || (values.length === 1 && values[0] === currencies[0]);
  });
}

/**
 * The KPI's daily percentage has an independent denominator. It is deliberately
 * calculated after the per-ledger daily amount so the amount can remain useful
 * when this denominator is unknown, non-positive, short-sided, or unconvertible.
 */
export function buildDailyPnlPercent(input: DailyPnlPercentInput): DailyPnlPercentResult {
  if (!input.dailyPnlAvailable) {
    return { value: null, denominator: null, available: false, reason: "当日净盈亏不可用" };
  }
  if (input.hasShortPosition) {
    return { value: null, denominator: null, available: false, reason: "范围包含空头仓位，百分比分母口径不可用" };
  }
  if (!input.previousMarketValueAvailable) {
    return { value: null, denominator: null, available: false, reason: "前一应有交易日持仓市值缺失或不可核对" };
  }
  if (!input.buySpendAvailable) {
    return { value: null, denominator: null, available: false, reason: "当日买入支出（含费用）缺失或不可核对" };
  }
  const views = [input.dailyPnl, input.previousMarketValue, input.buySpend];
  const explicitTarget = input.targetCurrency !== undefined
    || views.some(view => view.targetCurrency !== undefined || view.converted !== undefined);
  if (!explicitTarget && !sameOriginalCurrency(views) && views.some(view => view.convertedCny === null)) {
    return { value: null, denominator: null, available: false, reason: "原币不一致且缺少完整汇率换算" };
  }
  const pnl = moneyScalar(input.dailyPnl, input.targetCurrency);
  const previous = moneyScalar(input.previousMarketValue, input.targetCurrency);
  const buys = moneyScalar(input.buySpend, input.targetCurrency);
  const parsedPnl = decimal(pnl);
  const parsedPrevious = decimal(previous);
  const parsedBuys = decimal(buys);
  if (!parsedPnl || !parsedPrevious || !parsedBuys) {
    return { value: null, denominator: null, available: false, reason: "当日金额或同口径换算不可用" };
  }
  const denominator = parsedPrevious.plus(parsedBuys);
  const denominatorValue = denominator.toDecimalPlaces(8).toString();
  if (!denominator.gt(0)) {
    return { value: null, denominator: denominatorValue, available: false, reason: "当日百分比分母非正" };
  }
  return {
    value: parsedPnl.div(denominator).mul(100).toDecimalPlaces(16).toString(),
    denominator: denominatorValue,
    available: true,
    reason: null,
  };
}

export function createTradingRoomCalendarState(period: RoomDateRange): TradingRoomCalendarState {
  return {
    period,
    displayMonth: clampMonth(period, period.endDate.slice(0, 7)),
    selectedDate: null,
  };
}

/** Browse one calendar month while preserving the independent statistics period. */
export function moveTradingRoomCalendarMonth(
  state: TradingRoomCalendarState,
  delta: number,
): TradingRoomCalendarState {
  if (!Number.isInteger(delta)) throw new RangeError("日历月份步长无效");
  const candidate = monthDelta(state.displayMonth, delta);
  const nextMonth = clampMonth(state.period, candidate);
  return nextMonth === state.displayMonth
    ? state
    : { ...state, displayMonth: nextMonth, selectedDate: null };
}

export function selectTradingRoomCalendarDate(
  state: TradingRoomCalendarState,
  date: string,
): TradingRoomCalendarState {
  if (!validDate(date) || date < state.period.startDate || date > state.period.endDate || date.slice(0, 7) !== state.displayMonth) {
    return { ...state, selectedDate: null };
  }
  return { ...state, selectedDate: date };
}

/** A statistics-period change returns the calendar to its end month and clears stale drilldown. */
export function applyTradingRoomCalendarPeriod(
  state: TradingRoomCalendarState,
  period: RoomDateRange,
): TradingRoomCalendarState {
  return createTradingRoomCalendarState(period);
}

export function calendarMonthBounds(state: TradingRoomCalendarState): {
  previousAvailable: boolean;
  nextAvailable: boolean;
} {
  const first = state.period.startDate.slice(0, 7);
  const last = state.period.endDate.slice(0, 7);
  return {
    previousAvailable: state.displayMonth > first,
    nextAvailable: state.displayMonth < last,
  };
}
