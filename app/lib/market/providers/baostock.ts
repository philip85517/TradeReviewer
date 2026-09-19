import type {
  DailyCandleRequest,
  IntradayCandleRequest,
  IntradayProviderResult,
  MarketDataProvider,
  ProviderMarketCandle,
  ProviderResult,
  SupportedMarket,
} from "../contracts";
import { normalizeMarketSymbol } from "../symbol-map";
import { validateProviderMarketCandles } from "../validation";
import {
  marketLocalTimestampToIso,
  MarketDataProviderError,
  utcIsoToMarketLocal,
} from "./errors";
import {
  BaoStockClient,
  BaoStockClientError,
  type BaoStockHistoryClient,
  type BaoStockHistoryResponse,
} from "../baostock-client";

const BAOSTOCK_FIELDS = [
  "date",
  "time",
  "code",
  "open",
  "high",
  "low",
  "close",
  "volume",
  "amount",
  "adjustflag",
] as const;
const BAOSTOCK_TIME_ZONE = "Asia/Shanghai";
const BAOSTOCK_CODE_PATTERN = /^(?:sh|sz)\.\d{6}$/i;
const CN_SESSIONS = [
  { startMinute: 9 * 60 + 30, endMinute: 11 * 60 + 30 },
  { startMinute: 13 * 60, endMinute: 15 * 60 },
] as const;

export type BaoStockProviderOptions = {
  signal?: AbortSignal;
  client?: BaoStockHistoryClient;
};

function supportsBaoStockMarket(market: SupportedMarket) {
  return market === "CN-SH" || market === "CN-SZ";
}

function toProviderSymbol(market: SupportedMarket, symbol: string) {
  const normalized = normalizeMarketSymbol(market, symbol);
  return `${market === "CN-SH" ? "sh" : "sz"}.${normalized}`;
}

function requestDate(value: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== value) {
    throw new Error("BaoStock 请求时间必须是规范的 ISO 8601 UTC 时间");
  }
  return utcIsoToMarketLocal(value, BAOSTOCK_TIME_ZONE).slice(0, 10);
}

function fieldIndexes(fields: string[]) {
  const indexes = Object.fromEntries(
    BAOSTOCK_FIELDS.map((field) => [field, fields.indexOf(field)]),
  ) as Record<(typeof BAOSTOCK_FIELDS)[number], number>;
  if (BAOSTOCK_FIELDS.some((field) => indexes[field] < 0)) {
    throw new Error("BaoStock 历史响应缺少必要字段");
  }
  return indexes;
}

function sourceTime(value: string, date: string) {
  const match = /^(\d{8})(\d{2})(\d{2})(\d{2})(\d{3})?$/.exec(value);
  if (!match || match[1] !== date.replaceAll("-", "")) {
    throw new Error("BaoStock 历史响应时间格式无效");
  }
  const [, , hour, minute, second, millisecond = "000"] = match;
  if (second !== "00") {
    throw new Error("BaoStock 60 分钟响应必须以整分钟收盘");
  }
  const endMinute = Number(hour) * 60 + Number(minute);
  const session = CN_SESSIONS.find(
    (candidate) =>
      endMinute > candidate.startMinute && endMinute <= candidate.endMinute,
  );
  if (!session || endMinute - 60 < session.startMinute) {
    throw new Error("BaoStock 60 分钟收盘时间不在中国市场交易时段内");
  }
  const endLocal = `${date} ${hour}:${minute}:${second}`;
  const endWithoutMilliseconds = marketLocalTimestampToIso(
    endLocal,
    BAOSTOCK_TIME_ZONE,
  );
  const milliseconds = Number(millisecond);
  const knowledgeAt = new Date(
    Date.parse(endWithoutMilliseconds) + milliseconds,
  ).toISOString();
  const startMinute = endMinute - 60;
  const startLocal = `${date} ${String(Math.floor(startMinute / 60)).padStart(
    2,
    "0",
  )}:${String(startMinute % 60).padStart(2, "0")}:00`;
  return {
    timestamp: marketLocalTimestampToIso(startLocal, BAOSTOCK_TIME_ZONE),
    knowledgeAt,
  };
}

function rowValue(row: string[], index: number, field: string) {
  const value = row[index];
  if (typeof value !== "string" || value === "") {
    throw new Error(`BaoStock 历史响应${field}字段无效`);
  }
  return value;
}

export function parseBaoStockIntraday(
  response: Pick<BaoStockHistoryResponse, "fields" | "records">,
  expectedCode: string,
): ProviderMarketCandle[] {
  if (
    !BAOSTOCK_CODE_PATTERN.test(expectedCode) ||
    !Array.isArray(response.fields) ||
    !Array.isArray(response.records) ||
    !response.fields.every((field) => typeof field === "string")
  ) {
    throw new Error("BaoStock 历史响应格式无效");
  }
  const indexes = fieldIndexes(response.fields);
  return response.records.map((row) => {
    if (!Array.isArray(row) || row.some((value) => typeof value !== "string")) {
      throw new Error("BaoStock 历史响应记录格式无效");
    }
    const date = rowValue(row, indexes.date, "交易日期");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error("BaoStock 历史响应交易日期格式无效");
    }
    const code = rowValue(row, indexes.code, "证券代码");
    if (code.toLowerCase() !== expectedCode.toLowerCase()) {
      throw new Error("BaoStock 历史响应标的不匹配");
    }
    if (rowValue(row, indexes.adjustflag, "复权标记") !== "3") {
      throw new Error("BaoStock 历史响应不是不复权数据");
    }
    const times = sourceTime(rowValue(row, indexes.time, "收盘时间"), date);
    return {
      timestamp: times.timestamp,
      knowledgeAt: times.knowledgeAt,
      open: rowValue(row, indexes.open, "开盘价"),
      high: rowValue(row, indexes.high, "最高价"),
      low: rowValue(row, indexes.low, "最低价"),
      close: rowValue(row, indexes.close, "收盘价"),
      volume: rowValue(row, indexes.volume, "成交量"),
    } satisfies ProviderMarketCandle;
  });
}

function providerError(error: unknown): never {
  if (error instanceof MarketDataProviderError) throw error;
  if (error instanceof BaoStockClientError) {
    if (error.code === "aborted") {
      throw new DOMException("行情同步已被较新的请求取代", "AbortError");
    }
    if (error.code === "timeout") {
      throw new MarketDataProviderError("source-timeout", error.message);
    }
    if (error.code === "server") {
      if (error.serverCode === "10004011" || error.serverCode === "10004015") {
        throw new MarketDataProviderError("no-data", error.message);
      }
      if (error.serverCode === "10004013") {
        throw new MarketDataProviderError(
          "provider-history-limit",
          error.message,
        );
      }
      throw new MarketDataProviderError("source-unavailable", error.message);
    }
    if (error.code === "connection") {
      throw new MarketDataProviderError("source-unavailable", error.message);
    }
    throw new MarketDataProviderError("invalid-response", error.message);
  }
  throw new MarketDataProviderError(
    "invalid-response",
    error instanceof Error ? error.message : "BaoStock 行情响应无效",
  );
}

export class BaoStockProvider implements MarketDataProvider {
  readonly id = "baostock" as const;
  private readonly signal?: AbortSignal;
  private readonly client: BaoStockHistoryClient;

  constructor(options: BaoStockProviderOptions = {}) {
    this.signal = options.signal;
    this.client = options.client ?? new BaoStockClient({ signal: options.signal });
  }

  supports(market: SupportedMarket) {
    return supportsBaoStockMarket(market);
  }

  async fetchDaily(request: DailyCandleRequest): Promise<ProviderResult> {
    void request;
    throw new MarketDataProviderError(
      "no-data",
      "BaoStock 当前仅支持中国 A 股 1 小时行情",
    );
  }

  async fetchIntraday(
    request: IntradayCandleRequest,
  ): Promise<IntradayProviderResult> {
    if (!supportsBaoStockMarket(request.market) || request.interval !== "1h") {
      throw new MarketDataProviderError(
        "no-data",
        "BaoStock 当前仅支持中国 A 股 1 小时行情",
      );
    }
    if (this.signal?.aborted) {
      throw new DOMException("行情同步已被较新的请求取代", "AbortError");
    }
    const providerSymbol = toProviderSymbol(request.market, request.symbol);
    let startDate: string;
    let endDate: string;
    try {
      startDate = requestDate(request.startTime);
      endDate = requestDate(request.endTime);
      if (endDate < startDate) throw new Error("BaoStock 请求日期区间无效");
    } catch (error) {
      return providerError(error);
    }

    let response: BaoStockHistoryResponse;
    try {
      response = await this.client.queryHistoryKDataPlus({
        code: providerSymbol,
        startDate,
        endDate,
        frequency: "60",
        adjustflag: "3",
        signal: this.signal,
      });
      if (this.signal?.aborted) {
        throw new DOMException("行情同步已被较新的请求取代", "AbortError");
      }
      const parsed = parseBaoStockIntraday(response, providerSymbol);
      const candles = parsed.filter(
        (candle) =>
          candle.timestamp >= request.startTime &&
          candle.timestamp <= request.endTime,
      );
      if (candles.length === 0) {
        throw new MarketDataProviderError(
          response.records.length > 0 ? "provider-history-limit" : "no-data",
          response.records.length > 0
            ? "BaoStock 未返回请求时间范围内的 1 小时数据"
            : "BaoStock 未返回该股票数据",
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
        warnings: response.truncated ? ["provider-history-limit"] : [],
      };
    } catch (error) {
      return providerError(error);
    }
  }
}
