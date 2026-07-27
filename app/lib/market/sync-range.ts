import Decimal from "decimal.js";

import {
  CalendarOutOfRangeError,
  expectedTradingDates,
} from "./calendar";
import type { DateRange } from "./coverage-planner";
import type { SupportedMarket } from "./contracts";

function shiftIsoDate(timestamp: string, days: number) {
  const date = new Date(timestamp);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
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
  if (options?.open && options.market) {
    const now = options.now ?? new Date();
    const yesterday = shiftIsoDate(now.toISOString(), -1);
    const lookback = shiftIsoDate(yesterday, -14);
    try {
      endDate =
        expectedTradingDates(options.market, lookback, yesterday).at(-1) ??
        yesterday;
    } catch (error) {
      if (!(error instanceof CalendarOutOfRangeError)) throw error;
      endDate = yesterday;
      while (
        [0, 6].includes(
          new Date(`${endDate}T00:00:00Z`).getUTCDay(),
        )
      ) {
        endDate = shiftIsoDate(`${endDate}T00:00:00Z`, -1);
      }
    }
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
