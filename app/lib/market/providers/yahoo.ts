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
import { normalizeMarketSymbol } from "../symbol-map";
import {
  validateProviderCandles,
  validateProviderMarketCandles,
} from "../validation";
import { MarketDataProviderError, readProviderJson } from "./errors";

type YahooEnvelope = {
  chart?: {
    result?: Array<{
      meta?: {
        symbol?: unknown;
      };
      timestamp?: unknown;
      indicators?: {
        quote?: Array<Record<string, unknown>>;
        adjclose?: Array<{ adjclose?: unknown }>;
      };
    }> | null;
    error?: {
      code?: unknown;
      description?: unknown;
    } | null;
  };
};

const YAHOO_CHART_HOSTS = [
  "query1.finance.yahoo.com",
  "query2.finance.yahoo.com",
] as const;

const YAHOO_RETRYABLE_ERRORS = new Set([
  "source-rate-limited",
  "source-forbidden",
  "source-unavailable",
]);

async function fetchYahooChart(
  fetcher: typeof fetch,
  providerSymbol: string,
  query: URLSearchParams,
) {
  let lastError: unknown;
  for (const host of YAHOO_CHART_HOSTS) {
    try {
      const response = await fetcher(
        `https://${host}/v8/finance/chart/${encodeURIComponent(providerSymbol)}?${query}`,
      );
      return await readProviderJson(response, "Yahoo 行情");
    } catch (error) {
      if (
        error instanceof MarketDataProviderError &&
        YAHOO_RETRYABLE_ERRORS.has(error.code)
      ) {
        lastError = error;
        continue;
      }
      throw error;
    }
  }
  throw (
    lastError ??
    new MarketDataProviderError("source-unavailable", "Yahoo 行情暂时不可用")
  );
}

function yahooNoDataMessage(value: unknown) {
  const chart = (value as YahooEnvelope)?.chart;
  if (
    !chart ||
    !(chart.result === null ||
      (Array.isArray(chart.result) && chart.result.length === 0))
  ) {
    return undefined;
  }
  const description = chart.error?.description;
  return typeof description === "string" && description.length > 0
    ? `Yahoo 未返回该股票数据：${description}`
    : "Yahoo 未返回该股票数据";
}

function validateYahooIdentity(value: unknown, providerSymbol: string) {
  const symbol = (value as YahooEnvelope)?.chart?.result?.[0]?.meta?.symbol;
  if (
    symbol !== undefined &&
    (typeof symbol !== "string" ||
      symbol.toUpperCase() !== providerSymbol.toUpperCase())
  ) {
    throw new Error("Yahoo 行情响应标的不匹配");
  }
}

function numberAt(value: unknown, index: number) {
  if (!Array.isArray(value) || typeof value[index] !== "number") {
    throw new Error("Yahoo 行情响应格式已变化");
  }
  return String(value[index]);
}

function yahooSymbol(market: SupportedMarket, symbol: string) {
  const normalized = normalizeMarketSymbol(market, symbol);
  if (market === "HK") return `${normalized.padStart(4, "0")}.HK`;
  if (market === "CN-SH") return `${normalized}.SS`;
  if (market === "CN-SZ") return `${normalized}.SZ`;
  return normalized;
}

export function parseYahooDaily(value: unknown): ProviderDailyCandle[] {
  const result = (value as YahooEnvelope)?.chart?.result?.[0];
  const timestamps = result?.timestamp;
  const quote = result?.indicators?.quote?.[0];
  if (!Array.isArray(timestamps) || !quote) {
    throw new Error("Yahoo 行情响应格式已变化");
  }

  return timestamps.map((timestamp, index) => {
    if (typeof timestamp !== "number") {
      throw new Error("Yahoo 行情响应格式已变化");
    }
    const adjusted = result.indicators?.adjclose?.[0]?.adjclose;
    const candle: ProviderDailyCandle = {
      tradingDate: new Date(timestamp * 1000).toISOString().slice(0, 10),
      open: numberAt(quote.open, index),
      high: numberAt(quote.high, index),
      low: numberAt(quote.low, index),
      close: numberAt(quote.close, index),
      volume: numberAt(quote.volume, index),
    };
    if (Array.isArray(adjusted) && typeof adjusted[index] === "number") {
      candle.adjustedClose = String(adjusted[index]);
    }
    return candle;
  });
}

export function parseYahooIntraday(value: unknown): ProviderMarketCandle[] {
  const result = (value as YahooEnvelope)?.chart?.result?.[0];
  const timestamps = result?.timestamp;
  const quote = result?.indicators?.quote?.[0];
  if (!Array.isArray(timestamps) || !quote) {
    throw new Error("Yahoo 行情响应格式已变化");
  }

  return timestamps.map((timestamp, index) => {
    if (typeof timestamp !== "number") {
      throw new Error("Yahoo 行情响应格式已变化");
    }
    return {
      timestamp: new Date(timestamp * 1000).toISOString(),
      open: numberAt(quote.open, index),
      high: numberAt(quote.high, index),
      low: numberAt(quote.low, index),
      close: numberAt(quote.close, index),
      volume: numberAt(quote.volume, index),
    };
  });
}

export class YahooProvider implements MarketDataProvider {
  readonly id = "yahoo" as const;

  supports(market: SupportedMarket) {
    return (
      market === "US" ||
      market === "HK" ||
      market === "CN-SH" ||
      market === "CN-SZ"
    );
  }

  async fetchDaily(
    request: DailyCandleRequest,
    fetcher: typeof fetch = fetch,
  ): Promise<ProviderResult> {
    const providerSymbol = yahooSymbol(request.market, request.symbol);
    const period1 = Math.floor(
      new Date(`${request.startDate}T00:00:00Z`).getTime() / 1000,
    );
    const period2 =
      Math.floor(new Date(`${request.endDate}T00:00:00Z`).getTime() / 1000) +
      86400;
    const query = new URLSearchParams({
      period1: String(period1),
      period2: String(period2),
      interval: "1d",
      events: "history",
    });
    const value = await fetchYahooChart(fetcher, providerSymbol, query);
    try {
      validateYahooIdentity(value, providerSymbol);
      const noDataMessage = yahooNoDataMessage(value);
      if (noDataMessage) {
        throw new MarketDataProviderError("no-data", noDataMessage);
      }
      const candles = parseYahooDaily(value);
      validateProviderCandles(
        candles,
        request.startDate,
        request.endDate,
      );
      if (candles.length === 0) {
        throw new MarketDataProviderError(
          "no-data",
          "Yahoo 未返回该股票数据",
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
        error instanceof Error ? error.message : "Yahoo 行情响应无效",
      );
    }
  }

  async fetchIntraday(
    request: IntradayCandleRequest,
    fetcher: typeof fetch = fetch,
  ): Promise<IntradayProviderResult> {
    const providerSymbol = yahooSymbol(request.market, request.symbol);
    const period1 = Math.floor(new Date(request.startTime).getTime() / 1000);
    const period2 =
      Math.floor(new Date(request.endTime).getTime() / 1000) +
      (request.interval === "1h" ? 60 * 60 : 15 * 60);
    const query = new URLSearchParams({
      period1: String(period1),
      period2: String(period2),
      interval: request.interval,
      events: "history",
    });
    const value = await fetchYahooChart(fetcher, providerSymbol, query);
    try {
      validateYahooIdentity(value, providerSymbol);
      const noDataMessage = yahooNoDataMessage(value);
      if (noDataMessage) {
        throw new MarketDataProviderError("no-data", noDataMessage);
      }
      const parsed = parseYahooIntraday(value);
      const candles = parsed.filter(
        (candle) =>
          candle.timestamp >= request.startTime && candle.timestamp <= request.endTime,
      );
      if (candles.length === 0) {
        throw new MarketDataProviderError(
          parsed.length > 0 ? "provider-history-limit" : "no-data",
          parsed.length > 0
            ? `Yahoo 不提供该时间范围的 ${request.interval === "1h" ? "1 小时" : "15 分钟"}数据`
            : "Yahoo 未返回该股票数据",
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
        error instanceof Error ? error.message : "Yahoo 行情响应无效",
      );
    }
  }
}
