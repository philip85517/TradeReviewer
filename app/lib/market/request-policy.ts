import type {
  DailyCandleRequest,
  IntradayCandleRequest,
  NativeIntradayInterval,
  SupportedMarket,
} from "./contracts";
import { normalizeMarketSymbol } from "./symbol-map";

const MARKETS = new Set<SupportedMarket>(["US", "HK", "CN-SH", "CN-SZ"]);
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DAY = 86_400_000;
const INTRADAY_MAX_NATURAL_DAYS: Record<NativeIntradayInterval, number> = {
  "15m": 60,
  "1h": 730,
};

export class InvalidMarketDataRequest extends Error {}

export function parseDailyCandleRequest(url: URL): DailyCandleRequest {
  const marketValue = url.searchParams.get("market")?.toUpperCase();
  if (!marketValue || !MARKETS.has(marketValue as SupportedMarket)) {
    throw new InvalidMarketDataRequest("不支持的市场");
  }
  const market = marketValue as SupportedMarket;
  const symbolValue = url.searchParams.get("symbol") ?? "";
  let symbol: string;
  try {
    symbol = normalizeMarketSymbol(market, symbolValue);
  } catch (error) {
    throw new InvalidMarketDataRequest(
      error instanceof Error ? error.message : "股票代码无效",
    );
  }

  const startDate = url.searchParams.get("start") ?? "";
  const endDate = url.searchParams.get("end") ?? "";
  if (!DATE_PATTERN.test(startDate) || !DATE_PATTERN.test(endDate)) {
    throw new InvalidMarketDataRequest("日期必须使用 YYYY-MM-DD 格式");
  }
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    new Date(start).toISOString().slice(0, 10) !== startDate ||
    new Date(end).toISOString().slice(0, 10) !== endDate ||
    end < start
  ) {
    throw new InvalidMarketDataRequest("日期区间无效");
  }
  if ((end - start) / DAY + 1 > 500) {
    throw new InvalidMarketDataRequest("单次请求不能超过 500 个自然日");
  }

  return {
    instrumentId: `${market}:${symbol}`,
    market,
    symbol,
    startDate,
    endDate,
  };
}

function parseIsoTimestamp(value: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== value) {
    throw new InvalidMarketDataRequest("时间必须使用 ISO 8601 UTC 格式");
  }
  return timestamp;
}

export function parseIntradayCandleRequest(url: URL): IntradayCandleRequest {
  const marketValue = url.searchParams.get("market")?.toUpperCase();
  if (!marketValue || !MARKETS.has(marketValue as SupportedMarket)) {
    throw new InvalidMarketDataRequest("不支持的市场");
  }
  const market = marketValue as SupportedMarket;
  const symbolValue = url.searchParams.get("symbol") ?? "";
  let symbol: string;
  try {
    symbol = normalizeMarketSymbol(market, symbolValue);
  } catch (error) {
    throw new InvalidMarketDataRequest(
      error instanceof Error ? error.message : "股票代码无效",
    );
  }

  const intervalValue = url.searchParams.get("interval");
  if (intervalValue !== "15m" && intervalValue !== "1h") {
    throw new InvalidMarketDataRequest("仅支持 15 分钟或 1 小时行情");
  }
  const interval = intervalValue as NativeIntradayInterval;
  const startTime = url.searchParams.get("start") ?? "";
  const endTime = url.searchParams.get("end") ?? "";
  const start = parseIsoTimestamp(startTime);
  const end = parseIsoTimestamp(endTime);
  if (end < start) {
    throw new InvalidMarketDataRequest("时间区间无效");
  }

  const startDay = Date.parse(`${startTime.slice(0, 10)}T00:00:00Z`);
  const endDay = Date.parse(`${endTime.slice(0, 10)}T00:00:00Z`);
  const maxDays = INTRADAY_MAX_NATURAL_DAYS[interval];
  if ((endDay - startDay) / DAY + 1 > maxDays) {
    throw new InvalidMarketDataRequest(
      `${interval === "15m" ? "15 分钟" : "1 小时"}行情单次请求不能超过 ${maxDays} 个自然日`,
    );
  }

  return {
    instrumentId: `${market}:${symbol}`,
    market,
    symbol,
    interval,
    startTime,
    endTime,
  };
}
