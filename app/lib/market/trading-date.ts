import type { SupportedMarket } from "./contracts";

const MARKET_TIME_ZONES = {
  US: "America/New_York",
  HK: "Asia/Hong_Kong",
  "CN-SH": "Asia/Shanghai",
  "CN-SZ": "Asia/Shanghai",
} satisfies Record<SupportedMarket, string>;

export function marketTradingDate(timestamp: string, market: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone:
      MARKET_TIME_ZONES[
        market.toUpperCase() as SupportedMarket
      ] ?? "UTC",
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
