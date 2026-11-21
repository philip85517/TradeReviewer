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

  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) return [];
  const dates = indexedTradingDates(market);
  const lower = new Date(start).toISOString().slice(0, 10);
  const upper = new Date(end).toISOString().slice(0, 10);
  // Each caller owns the returned array; mutating it cannot damage the calendar.
  return dates.slice(lowerBound(dates, lower), lowerBound(dates, upper, true));
}

const tradingDateIndex = new Map<SupportedMarket, readonly string[]>();

function indexedTradingDates(market: SupportedMarket): readonly string[] {
  const saved = tradingDateIndex.get(market);
  if (saved) return saved;
  const [start, end] = calendarData.ranges[market];
  const last = Date.parse(`${end}T00:00:00Z`);
  const dates: string[] = [];
  for (let timestamp = Date.parse(`${start}T00:00:00Z`); timestamp <= last; timestamp += DAY) {
    const date = new Date(timestamp);
    const isoDate = date.toISOString().slice(0, 10);
    const weekday = date.getUTCDay();
    if (weekday !== 0 && weekday !== 6 && !holidays[market].has(isoDate)) dates.push(isoDate);
  }
  tradingDateIndex.set(market, dates);
  return dates;
}

function lowerBound(dates: readonly string[], target: string, afterEqual = false): number {
  let lo = 0, hi = dates.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (dates[mid] < target || (afterEqual && dates[mid] === target)) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
