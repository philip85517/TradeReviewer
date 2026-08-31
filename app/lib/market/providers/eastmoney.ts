import type {
  DailyCandleRequest,
  IntradayCandleRequest,
  IntradayProviderResult,
  MarketDataProvider,
  ProviderDailyCandle,
  ProviderMarketCandle,
  ProviderResult,
  SupportedMarket,
} from "../contracts";
import { providerSymbolCandidates } from "../symbol-map";
import {
  validateProviderCandles,
  validateProviderMarketCandles,
} from "../validation";
import {
  marketLocalTimestampToIso,
  MarketDataProviderError,
  readProviderJson,
  utcIsoToMarketLocal,
} from "./errors";

type EastmoneyEnvelope = {
  data?: {
    code?: unknown;
    klines?: unknown;
  };
};

const EASTMONEY_PUSH_TOKEN = "7eea3edcaed734bea9cbfc24409ed989";

function klineEndpoint(market: SupportedMarket) {
  if (market === "HK") {
    return "https://33.push2his.eastmoney.com/api/qt/stock/kline/get";
  }
  if (market === "US") {
    return "https://63.push2his.eastmoney.com/api/qt/stock/kline/get";
  }
  return "https://push2his.eastmoney.com/api/qt/stock/kline/get";
}

function validateEastmoneyIdentity(value: unknown, providerSymbol: string) {
  const code = (value as EastmoneyEnvelope)?.data?.code;
  if (
    code !== undefined &&
    (typeof code !== "string" || code !== providerSymbol.split(".").at(-1))
  ) {
    throw new Error("东方财富行情响应标的不匹配");
  }
}

function marketTimeZone(market: SupportedMarket) {
  if (market === "US") return "America/New_York";
  if (market === "HK") return "Asia/Hong_Kong";
  return "Asia/Shanghai";
}

function intradayBound(value: string, interval: IntradayCandleRequest["interval"]) {
  if (interval === "1h") {
    return value.slice(0, 10).replaceAll("-", "");
  }
  return value.replace(/\D/g, "");
}

export function parseEastmoneyDaily(
  value: unknown,
): ProviderDailyCandle[] {
  const rows = (value as EastmoneyEnvelope)?.data?.klines;
  if (!Array.isArray(rows)) {
    throw new Error("东方财富行情响应格式已变化");
  }

  return rows.map((row) => {
    if (typeof row !== "string") {
      throw new Error("东方财富行情响应格式已变化");
    }
    const [tradingDate, open, close, high, low, volume] = row.split(",");
    if (![tradingDate, open, close, high, low, volume].every(Boolean)) {
      throw new Error("东方财富行情响应格式已变化");
    }
    return { tradingDate, open, high, low, close, volume };
  });
}

export function parseEastmoneyIntraday(
  value: unknown,
  timeZone: string,
): ProviderMarketCandle[] {
  const rows = (value as EastmoneyEnvelope)?.data?.klines;
  if (!Array.isArray(rows)) {
    throw new Error("东方财富行情响应格式已变化");
  }

  return rows.map((row) => {
    if (typeof row !== "string") {
      throw new Error("东方财富行情响应格式已变化");
    }
    const [localTimestamp, open, close, high, low, volume] = row.split(",");
    if (![localTimestamp, open, close, high, low, volume].every(Boolean)) {
      throw new Error("东方财富行情响应格式已变化");
    }
    return {
      timestamp: marketLocalTimestampToIso(localTimestamp, timeZone),
      open,
      high,
      low,
      close,
      volume,
    };
  });
}

export class EastmoneyProvider implements MarketDataProvider {
  readonly id = "eastmoney" as const;

  supports(market: SupportedMarket) {
    return (
      market === "CN-SH" ||
      market === "CN-SZ" ||
      market === "HK" ||
      market === "US"
    );
  }

  async fetchDaily(
    request: DailyCandleRequest,
    fetcher: typeof fetch = fetch,
  ): Promise<ProviderResult> {
    const providerSymbol = providerSymbolCandidates(
      this.id,
      request.market,
      request.symbol,
    )[0];
    if (!providerSymbol) {
      throw new MarketDataProviderError("no-data", "东方财富不支持该市场");
    }
    const query = new URLSearchParams({
      ut: EASTMONEY_PUSH_TOKEN,
      secid: providerSymbol,
      klt: "101",
      fqt: "0",
      beg: request.startDate.replaceAll("-", ""),
      end: request.endDate.replaceAll("-", ""),
      fields1: "f1,f2,f3,f4,f5,f6",
      fields2: "f51,f52,f53,f54,f55,f56",
    });
    const response = await fetcher(
      `${klineEndpoint(request.market)}?${query}`,
    );
    const value = await readProviderJson(response, "东方财富行情");
    try {
      validateEastmoneyIdentity(value, providerSymbol);
      const candles = parseEastmoneyDaily(value);
      validateProviderCandles(
        candles,
        request.startDate,
        request.endDate,
      );
      if (candles.length === 0) {
        throw new MarketDataProviderError(
          "no-data",
          "东方财富未返回该股票数据",
        );
      }
      return {
        provider: this.id,
        providerSymbol,
        fetchedAt: new Date().toISOString(),
        candles,
        warnings: [],
      };
    } catch (error) {
      if (error instanceof MarketDataProviderError) throw error;
      throw new MarketDataProviderError(
        "invalid-response",
        error instanceof Error ? error.message : "东方财富行情响应无效",
      );
    }
  }

  async fetchIntraday(
    request: IntradayCandleRequest,
    fetcher: typeof fetch = fetch,
  ): Promise<IntradayProviderResult> {
    const providerSymbol = providerSymbolCandidates(
      this.id,
      request.market,
      request.symbol,
    )[0];
    if (!providerSymbol) {
      throw new MarketDataProviderError("no-data", "东方财富不支持该市场");
    }
    const timeZone = marketTimeZone(request.market);
    const startTime = utcIsoToMarketLocal(request.startTime, timeZone);
    const endTime = utcIsoToMarketLocal(request.endTime, timeZone);
    const intervalLabel = request.interval === "1h" ? "1 小时" : "15 分钟";
    const hourly = request.interval === "1h";
    const query = new URLSearchParams({
      ut: EASTMONEY_PUSH_TOKEN,
      secid: providerSymbol,
      klt: hourly ? "60" : "15",
      fqt: "0",
      beg: hourly ? "0" : intradayBound(startTime, request.interval),
      end: hourly ? "20500000" : intradayBound(endTime, request.interval),
      ...(hourly ? { lmt: "1000" } : {}),
      fields1: "f1,f2,f3,f4,f5,f6",
      fields2: "f51,f52,f53,f54,f55,f56",
    });
    const response = await fetcher(
      `${klineEndpoint(request.market)}?${query}`,
    );
    const value = await readProviderJson(response, "东方财富行情");
    try {
      validateEastmoneyIdentity(value, providerSymbol);
      const parsed = parseEastmoneyIntraday(value, timeZone);
      const candles = parsed.filter(
        (candle) =>
          candle.timestamp >= request.startTime && candle.timestamp <= request.endTime,
      );
      if (candles.length === 0) {
        throw new MarketDataProviderError(
          parsed.length > 0 ? "provider-history-limit" : "no-data",
          parsed.length > 0
            ? `东方财富不提供该时间范围的 ${intervalLabel}数据`
            : "东方财富未返回该股票数据",
        );
      }
      validateProviderMarketCandles(
        candles,
        request.startTime,
        request.endTime,
      );
      return {
        provider: this.id,
        providerSymbol,
        fetchedAt: new Date().toISOString(),
        interval: request.interval,
        candles,
        warnings: [],
      };
    } catch (error) {
      if (error instanceof MarketDataProviderError) throw error;
      throw new MarketDataProviderError(
        "invalid-response",
        error instanceof Error ? error.message : "东方财富行情响应无效",
      );
    }
  }
}
