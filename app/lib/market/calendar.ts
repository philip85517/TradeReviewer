import calendarData from "../../data/exchange-holidays-2010-2030.json";
import type { SupportedMarket } from "./contracts";

const DAY = 86_400_000;

const holidays = Object.fromEntries(
  Object.entries(calendarData.holidays).map(([market, dates]) => [
    market,
    new Set(dates),
  ]),
) as Record<SupportedMarket, Set<string>>;

export class CalendarOutOfRangeError extends Error {}

export function expectedTradingDates(
  market: SupportedMarket,
  startDate: string,
  endDate: string,
) {
  const [calendarStart, calendarEnd] = calendarData.ranges[market];
  if (startDate < calendarStart || endDate > calendarEnd) {
    throw new CalendarOutOfRangeError(
      `${market} 交易日历仅覆盖 ${calendarStart} 至 ${calendarEnd}`,
    );
  }

  const result: string[] = [];
  for (
    let timestamp = Date.parse(`${startDate}T00:00:00Z`);
    timestamp <= Date.parse(`${endDate}T00:00:00Z`);
    timestamp += DAY
  ) {
    const date = new Date(timestamp);
    const isoDate = date.toISOString().slice(0, 10);
    const weekday = date.getUTCDay();
    if (
      weekday !== 0 &&
      weekday !== 6 &&
      !holidays[market].has(isoDate)
    ) {
      result.push(isoDate);
    }
  }
  return result;
}
