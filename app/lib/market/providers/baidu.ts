import { aggregateCandles } from "../aggregate";
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
  MarketDataProviderError,
  readProviderJson,
  utcIsoToMarketLocal,
} from "./errors";

type BaiduMarketData = {
  keys?: unknown;
  marketData?: unknown;
};

type BaiduEnvelope = {
  ResultCode?: unknown;
  Result?: {
    newMarketData?: BaiduMarketData;
  };
};

const BAIDU_FINANCE_ENDPOINT =
  "https://sp0.baidu.com/5LMDcjW6BwF3otqbppnN2DJv/finance.pae.baidu.com/vapi/v1/getquotation";
const BAIDU_SOURCE_INTERVAL_MINUTES = 15;
const BAIDU_MAX_POINTS = 1000;

function marketTimeZone(market: SupportedMarket) {
  return market === "US" ? "America/New_York" : "Asia/Hong_Kong";
}

function addMinutes(value: string, minutes: number) {
  return new Date(Date.parse(value) + minutes * 60 * 1000).toISOString();
}

function numericValue(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim() || value === "--") {
    throw new Error(`百度行情${field}格式已变化`);
  }
  return value;
}

function volumeValue(value: unknown) {
  return value === "--" ? "0" : numericValue(value, "成交量");
}

function parseBaiduSourceCandles(
  value: unknown,
  market: Extract<SupportedMarket, "HK" | "US">,
): ProviderMarketCandle[] {
  const envelope = value as BaiduEnvelope;
  const marketData = envelope.Result?.newMarketData;
  const keys = marketData?.keys;
  const rows = marketData?.marketData;
  if (
    !Array.isArray(keys) ||
    !keys.every((key) => typeof key === "string") ||
    typeof rows !== "string"
  ) {
    throw new Error("百度行情响应格式已变化");
  }

  const timestampIndex = keys.indexOf("timestamp");
  const openIndex = keys.indexOf("open");
  const closeIndex = keys.indexOf("close");
  const volumeIndex = keys.indexOf("volume");
  const highIndex = keys.indexOf("high");
  const lowIndex = keys.indexOf("low");
  if ([timestampIndex, openIndex, closeIndex, volumeIndex, highIndex, lowIndex].some((index) => index < 0)) {
    throw new Error("百度行情响应格式已变化");
  }

  const sourceCandles = rows
    .split(";")
    .filter(Boolean)
    .map((row) => {
      const fields = row.split(",");
      const timestamp = Number(fields[timestampIndex]);
      if (!Number.isFinite(timestamp) || timestamp <= 0) {
        throw new Error("百度行情时间格式已变化");
      }
      const end = new Date(timestamp * 1000).toISOString();
      return {
        timestamp: new Date(
          timestamp * 1000 - BAIDU_SOURCE_INTERVAL_MINUTES * 60 * 1000,
        ).toISOString(),
        knowledgeAt: end,
        open: numericValue(fields[openIndex], "开盘价"),
        high: numericValue(fields[highIndex], "最高价"),
        low: numericValue(fields[lowIndex], "最低价"),
        close: numericValue(fields[closeIndex], "收盘价"),
        volume: volumeValue(fields[volumeIndex]),
      } satisfies ProviderMarketCandle;
    });

  const aggregated = aggregateCandles(
    sourceCandles.map((candle) => ({
      time: candle.timestamp,
      knowledgeAt: candle.knowledgeAt,
      open: Number(candle.open),
      high: Number(candle.high),
      low: Number(candle.low),
      close: Number(candle.close),
      volume: Number(candle.volume),
    })),
    "1h",
    { sourceInterval: "15m", market },
  );
  return aggregated.map((candle) => ({
    timestamp: candle.time,
    knowledgeAt: candle.knowledgeAt,
    open: String(candle.open),
    high: String(candle.high),
    low: String(candle.low),
    close: String(candle.close),
    volume: String(candle.volume),
  }));
}

export function parseBaiduDaily(value: unknown): ProviderDailyCandle[] {
  const envelope = value as BaiduEnvelope;
  const marketData = envelope.Result?.newMarketData;
  const keys = marketData?.keys;
  const rows = marketData?.marketData;
  if (
    !Array.isArray(keys) ||
    !keys.every((key) => typeof key === "string") ||
    typeof rows !== "string"
  ) {
    throw new Error("百度行情响应格式已变化");
  }

  const dateIndex = keys.indexOf("time");
  const timestampIndex = keys.indexOf("timestamp");
  const openIndex = keys.indexOf("open");
  const closeIndex = keys.indexOf("close");
  const volumeIndex = keys.indexOf("volume");
  const highIndex = keys.indexOf("high");
  const lowIndex = keys.indexOf("low");
  if (
    [dateIndex, timestampIndex, openIndex, closeIndex, volumeIndex, highIndex, lowIndex]
      .some((index) => index < 0)
  ) {
    throw new Error("百度行情响应格式已变化");
  }

  return rows
    .split(";")
    .filter(Boolean)
    .map((row) => {
      const fields = row.split(",");
      const date = fields[dateIndex].slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        throw new Error("百度行情交易日期格式已变化");
      }
      const timestamp = Number(fields[timestampIndex]);
      if (!Number.isFinite(timestamp) || timestamp <= 0) {
        throw new Error("百度行情时间格式已变化");
      }
      return {
        tradingDate: date,
        open: numericValue(fields[openIndex], "开盘价"),
        high: numericValue(fields[highIndex], "最高价"),
        low: numericValue(fields[lowIndex], "最低价"),
        close: numericValue(fields[closeIndex], "收盘价"),
        volume: volumeValue(fields[volumeIndex]),
      } satisfies ProviderDailyCandle;
    });
}

export function parseBaiduIntraday(
  value: unknown,
  market: Extract<SupportedMarket, "HK" | "US">,
) {
  try {
    return parseBaiduSourceCandles(value, market);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("百度行情")) {
      throw error;
    }
    throw new Error("百度行情响应格式已变化");
  }
}

export class BaiduProvider implements MarketDataProvider {
  readonly id = "baidu" as const;

  supports(market: SupportedMarket) {
    return market === "HK" || market === "US";
  }

  async fetchDaily(
    request: DailyCandleRequest,
    fetcher: typeof fetch = fetch,
  ): Promise<ProviderResult> {
    if (request.market !== "HK" && request.market !== "US") {
      throw new MarketDataProviderError(
        "no-data",
        "百度行情源仅支持港股和美股",
      );
    }

    const providerSymbol = providerSymbolCandidates(
      this.id,
      request.market,
      request.symbol,
    )[0];
    if (!providerSymbol) {
      throw new MarketDataProviderError("no-data", "百度行情不支持该市场");
    }

    const timeZone = marketTimeZone(request.market);
    const query = new URLSearchParams({
      srcid: "5353",
      pointType: "string",
      group: `quotation_kline_${request.market.toLowerCase()}`,
      query: providerSymbol,
      code: providerSymbol,
      market_type: request.market.toLowerCase(),
      newFormat: "1",
      finClientType: "pc",
      ktype: "day",
      end_time: utcIsoToMarketLocal(
        `${request.endDate}T23:59:59.999Z`,
        timeZone,
      ),
      count: String(BAIDU_MAX_POINTS),
    });
    const response = await fetcher(`${BAIDU_FINANCE_ENDPOINT}?${query}`);
    const value = await readProviderJson(response, "百度行情");
    try {
      const parsed = parseBaiduDaily(value);
      const candles = parsed.filter(
        (candle) =>
          candle.tradingDate >= request.startDate &&
          candle.tradingDate <= request.endDate,
      );
      if (candles.length === 0) {
        throw new MarketDataProviderError(
          parsed.length > 0 ? "provider-history-limit" : "no-data",
          parsed.length > 0
            ? "百度行情源不提供该时间范围的日线数据"
            : "百度行情源未返回该股票数据",
        );
      }
      validateProviderCandles(candles, request.startDate, request.endDate);
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
        error instanceof Error ? error.message : "百度行情响应无效",
      );
    }
  }

  async fetchIntraday(
    request: IntradayCandleRequest,
    fetcher: typeof fetch = fetch,
  ): Promise<IntradayProviderResult> {
    if (
      (request.market !== "HK" && request.market !== "US") ||
      request.interval !== "1h"
    ) {
      throw new MarketDataProviderError(
        "no-data",
        "百度行情源仅支持港股和美股 1 小时行情",
      );
    }

    const providerSymbol = providerSymbolCandidates(
      this.id,
      request.market,
      request.symbol,
    )[0];
    if (!providerSymbol) {
      throw new MarketDataProviderError("no-data", "百度行情不支持该市场");
    }

    const timeZone = marketTimeZone(request.market);
    const endTime = addMinutes(request.endTime, BAIDU_SOURCE_INTERVAL_MINUTES);
    const query = new URLSearchParams({
      srcid: "5353",
      pointType: "string",
      group: `quotation_kline_${request.market.toLowerCase()}`,
      query: providerSymbol,
      code: providerSymbol,
      market_type: request.market.toLowerCase(),
      newFormat: "1",
      finClientType: "pc",
      ktype: "min15",
      end_time: utcIsoToMarketLocal(endTime, timeZone),
      count: String(BAIDU_MAX_POINTS),
    });
    const response = await fetcher(
      `${BAIDU_FINANCE_ENDPOINT}?${query}`,
    );
    const value = await readProviderJson(response, "百度行情");
    let parsed: ProviderMarketCandle[];
    try {
      parsed = parseBaiduIntraday(value, request.market);
    } catch (error) {
      throw new MarketDataProviderError(
        "invalid-response",
        error instanceof Error ? error.message : "百度行情响应无效",
      );
    }

    const candles = parsed.filter(
      (candle) =>
        candle.timestamp >= request.startTime &&
        candle.timestamp <= request.endTime,
    );
    if (candles.length === 0) {
      throw new MarketDataProviderError(
        parsed.length > 0 ? "provider-history-limit" : "no-data",
        parsed.length > 0
          ? "百度行情源不提供该时间范围的 1 小时数据"
          : "百度行情源未返回该股票数据",
      );
    }
    try {
      validateProviderMarketCandles(
        candles,
        request.startTime,
        request.endTime,
      );
    } catch (error) {
      throw new MarketDataProviderError(
        "invalid-response",
        error instanceof Error ? error.message : "百度行情响应无效",
      );
    }
    return {
      provider: this.id,
      providerSymbol,
      fetchedAt: new Date().toISOString(),
      interval: request.interval,
      candles,
      warnings: [],
    };
  }
}
