import type {
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
  readProviderJson,
} from "./errors";

type SinaUsRow = {
  d?: unknown;
  o?: unknown;
  h?: unknown;
  l?: unknown;
  c?: unknown;
  v?: unknown;
};

function sinaUsBarStart(value: string) {
  const time = value.slice(11, 16);
  const durationMinutes = time === "16:00"
    ? 30
    : /^(10|11|12|13|14|15):30$/.test(time)
      ? 60
      : undefined;
  if (durationMinutes === undefined) {
    throw new Error("新浪美股行情时间格式已变化");
  }
  const end = marketLocalTimestampToIso(value, "America/New_York");
  return new Date(
    Date.parse(end) - durationMinutes * 60 * 1000,
  ).toISOString();
}

export function parseSinaUsIntraday(value: unknown): ProviderMarketCandle[] {
  if (!Array.isArray(value)) {
    throw new Error("新浪美股行情响应格式已变化");
  }
  return value.map((row) => {
    const item = row as SinaUsRow;
    if (
      !item ||
      typeof item !== "object" ||
      typeof item.d !== "string" ||
      typeof item.o !== "string" ||
      typeof item.h !== "string" ||
      typeof item.l !== "string" ||
      typeof item.c !== "string" ||
      typeof item.v !== "string"
    ) {
      throw new Error("新浪美股行情响应格式已变化");
    }
    return {
      timestamp: sinaUsBarStart(item.d),
      open: item.o,
      high: item.h,
      low: item.l,
      close: item.c,
      volume: item.v,
    };
  });
}

export class SinaUsProvider implements MarketDataProvider {
  readonly id = "sina" as const;

  supports(market: SupportedMarket) {
    return market === "US";
  }

  async fetchDaily(): Promise<ProviderResult> {
    throw new MarketDataProviderError(
      "no-data",
      "新浪美股源仅用于 1 小时行情",
    );
  }

  async fetchIntraday(
    request: IntradayCandleRequest,
    fetcher: typeof fetch = fetch,
  ): Promise<IntradayProviderResult> {
    if (request.market !== "US" || request.interval !== "1h") {
      throw new MarketDataProviderError(
        "no-data",
        "新浪美股源仅支持美股 1 小时行情",
      );
    }
    const providerSymbol = normalizeMarketSymbol(request.market, request.symbol);
    const query = new URLSearchParams({
      symbol: providerSymbol,
      type: "60",
      ___qn: "3",
    });
    const response = await fetcher(
      `https://stock.finance.sina.com.cn/usstock/api/json.php/US_MinKService.getMinK?${query}`,
    );
    const value = await readProviderJson(response, "新浪美股行情");
    let parsed: ProviderMarketCandle[];
    try {
      parsed = parseSinaUsIntraday(value);
    } catch (error) {
      throw new MarketDataProviderError(
        "invalid-response",
        error instanceof Error ? error.message : "新浪美股行情响应无效",
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
          ? "新浪美股源不提供该时间范围的 1 小时数据"
          : "新浪美股源未返回该股票数据",
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
        error instanceof Error ? error.message : "新浪美股行情响应无效",
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
