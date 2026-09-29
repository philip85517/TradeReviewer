import type { SupportedMarket } from "./contracts";
import { marketLocalTimestampToIso } from "./providers/errors";

const MARKET_TIME_ZONES = {
  US: "America/New_York",
  HK: "Asia/Hong_Kong",
  "CN-SH": "Asia/Shanghai",
  "CN-SZ": "Asia/Shanghai",
} satisfies Record<SupportedMarket, string>;

const MARKET_TRADING_DATE_FORMATTERS = new Map<string, Intl.DateTimeFormat>();

export function marketTimeZone(market: string) {
  return (
    MARKET_TIME_ZONES[market.toUpperCase() as SupportedMarket] ?? "UTC"
  );
}

export function marketCalendarDateOffset(
  timestamp: string,
  market: string,
  days: number,
) {
  const timeZone = marketTimeZone(market);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(timestamp))
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  const localDate = new Date(
    Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)),
  );
  localDate.setUTCDate(localDate.getUTCDate() + days);
  return marketLocalTimestampToIso(
    `${localDate.toISOString().slice(0, 10)} ${parts.hour}:${parts.minute}:${parts.second}`,
    timeZone,
  );
}

export function marketTradingDate(timestamp: string, market: string) {
  // Date-only evidence is already a calendar label, not midnight in UTC.
  if (/^\d{4}-\d{2}-\d{2}$/.test(timestamp)) return timestamp;
  const timeZone = marketTimeZone(market);
  let formatter = MARKET_TRADING_DATE_FORMATTERS.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    MARKET_TRADING_DATE_FORMATTERS.set(timeZone, formatter);
  }
  const parts = formatter.formatToParts(new Date(timestamp));
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

export function formatMarketTradingDate(
  timestamp: string,
  market: string,
) {
  const [year, month, day] = marketTradingDate(timestamp, market).split(
    "-",
  );
  return `${year}/${Number(month)}/${Number(day)}`;
}
