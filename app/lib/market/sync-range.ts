import Decimal from "decimal.js";

import {
  CalendarOutOfRangeError,
  expectedTradingDates,
} from "./calendar";
import type { DateRange } from "./coverage-planner";
import type { SupportedMarket } from "./contracts";
import { marketTradingDate } from "./trading-date";

export const MIN_FORWARD_DAILY_SESSIONS = 180;

function shiftIsoDate(timestamp: string, days: number) {
  const date = new Date(timestamp);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function latestCompletedSession(
  market: SupportedMarket,
  now: Date,
) {
  const yesterday = shiftIsoDate(now.toISOString(), -1);
  const lookback = shiftIsoDate(yesterday + "T00:00:00.000Z", -14);
  try {
    return (
      expectedTradingDates(market, lookback, yesterday).at(-1) ??
      yesterday
    );
  } catch (error) {
    if (!(error instanceof CalendarOutOfRangeError)) throw error;
    let endDate = yesterday;
    while (
      [0, 6].includes(
        new Date(`${endDate}T00:00:00Z`).getUTCDay(),
      )
    ) {
      endDate = shiftIsoDate(`${endDate}T00:00:00Z`, -1);
    }
    return endDate;
  }
}

function dailyEndAfterLastTrade(
  lastTradeAt: string,
  market: SupportedMarket,
  now: Date,
) {
  const lastTradeDate = marketTradingDate(lastTradeAt, market);
  const latestAvailableDate = latestCompletedSession(market, now);
  if (latestAvailableDate <= lastTradeDate) return lastTradeDate;

  try {
    const forwardDates = expectedTradingDates(
      market,
      shiftIsoDate(`${lastTradeDate}T00:00:00.000Z`, 1),
      latestAvailableDate,
    );
    return (
      forwardDates[MIN_FORWARD_DAILY_SESSIONS - 1] ??
      forwardDates.at(-1) ??
      lastTradeDate
    );
  } catch (error) {
    if (!(error instanceof CalendarOutOfRangeError)) throw error;
    return latestAvailableDate;
  }
}

export function requiredMarketDataRange(
  firstTradeAt: string,
  lastTradeAt: string,
  options?: {
    open?: boolean;
    market?: SupportedMarket;
    now?: Date;
  },
) {
  let endDate = shiftIsoDate(lastTradeAt, 35);
  if (options?.market) {
    const now = options.now ?? new Date();
    endDate = dailyEndAfterLastTrade(
      lastTradeAt,
      options.market,
      now,
    );
  }
  return {
    startDate: shiftIsoDate(firstTradeAt, -400),
    endDate,
  };
}

export function requiredRangeExpanded(
  before: DateRange | undefined,
  after: DateRange,
) {
  return (
    before === undefined ||
    after.startDate < before.startDate ||
    after.endDate > before.endDate
  );
}

export function hasOpenPosition(
  executions: Array<{
    accountId: string;
    side: "buy" | "sell";
    quantity: string;
  }>,
) {
  const positions = new Map<string, Decimal>();
  for (const execution of executions) {
    const signed = new Decimal(execution.quantity).times(
      execution.side === "buy" ? 1 : -1,
    );
    positions.set(
      execution.accountId,
      (positions.get(execution.accountId) ?? new Decimal(0)).plus(signed),
    );
  }
  return [...positions.values()].some((position) => !position.isZero());
}
