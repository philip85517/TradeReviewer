import type { SupportedMarket } from "./contracts";
import { marketLocalTimestampToIso } from "./providers/errors";

const MARKET_TIME_ZONES = {
  US: "America/New_York",
  HK: "Asia/Hong_Kong",
  "CN-SH": "Asia/Shanghai",
  "CN-SZ": "Asia/Shanghai",
} satisfies Record<SupportedMarket, string>;

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
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone:
      marketTimeZone(market),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(timestamp));
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
