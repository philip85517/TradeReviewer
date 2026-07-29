import type {
  DailyCandleRequest,
  MarketDataProvider,
  ProviderDailyCandle,
  ProviderMarketCandle,
  ProviderResult,
} from "../contracts";
import { providerSymbolCandidates } from "../symbol-map";
import { validateProviderCandles } from "../validation";
import {
  marketLocalTimestampToIso,
  MarketDataProviderError,
  readProviderJson,
} from "./errors";
import type { IntradayCandleRequest, IntradayProviderResult } from "./router";

function marketTimeZone(market: DailyCandleRequest["market"]) {
  if (market === "US") return "America/New_York";
  if (market === "HK") return "Asia/Hong_Kong";
  return "Asia/Shanghai";
}

type TencentEnvelope = {
  data?: Record<
    string,
    {
      day?: unknown;
      m15?: unknown;
    }
  >;
};

export function parseTencentDaily(
  value: unknown,
  providerSymbol: string,
): ProviderDailyCandle[] {
  const rows = (value as TencentEnvelope)?.data?.[providerSymbol]?.day;
  if (!Array.isArray(rows)) {
    throw new Error("腾讯行情响应格式已变化");
  }

  return rows.map((row) => {
    if (
      !Array.isArray(row) ||
      row.length < 6 ||
      !row.slice(0, 6).every((item) => typeof item === "string")
    ) {
      throw new Error("腾讯行情响应格式已变化");
    }
    const [tradingDate, open, close, high, low, volume] = row as string[];
    return { tradingDate, open, high, low, close, volume };
  });
}

export function parseTencentIntraday(
  value: unknown,
  providerSymbol: string,
  timeZone: string,
): ProviderMarketCandle[] {
  const rows = (value as TencentEnvelope)?.data?.[providerSymbol]?.m15;
  if (!Array.isArray(rows)) {
    throw new Error("腾讯行情响应格式已变化");
  }

  return rows.map((row) => {
    if (
      !Array.isArray(row) ||
      row.length < 6 ||
      !row.slice(0, 6).every((item) => typeof item === "string")
    ) {
      throw new Error("腾讯行情响应格式已变化");
    }
    const [localTimestamp, open, close, high, low, volume] = row as string[];
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

export class TencentProvider implements MarketDataProvider {
  readonly id = "tencent" as const;

  supports() {
    return true;
  }

  async fetchDaily(
    request: DailyCandleRequest,
    fetcher: typeof fetch = fetch,
  ): Promise<ProviderResult> {
    for (const providerSymbol of providerSymbolCandidates(
      this.id,
      request.market,
      request.symbol,
    )) {
      const params = [
        providerSymbol,
        "day",
        request.startDate,
        request.endDate,
        "500",
        "",
      ].join(",");
      const response = await fetcher(
        `https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=${encodeURIComponent(params)}`,
      );
      const value = await readProviderJson(response, "腾讯行情");
      let candles: ProviderDailyCandle[];
      try {
        candles = parseTencentDaily(value, providerSymbol);
        validateProviderCandles(
          candles,
          request.startDate,
          request.endDate,
        );
      } catch (error) {
        throw new MarketDataProviderError(
          "invalid-response",
          error instanceof Error ? error.message : "腾讯行情响应无效",
        );
      }
      if (candles.length === 0) continue;
      return {
        provider: this.id,
        providerSymbol,
        fetchedAt: new Date().toISOString(),
        candles,
        warnings: [],
      };
    }
    throw new MarketDataProviderError(
      "no-data",
      "腾讯行情未返回该股票数据",
    );
  }

  async fetchIntraday(
    request: IntradayCandleRequest,
    fetcher: typeof fetch = fetch,
  ): Promise<IntradayProviderResult> {
    let hasUnavailableHistory = false;
    for (const providerSymbol of providerSymbolCandidates(
      this.id,
      request.market,
      request.symbol,
    )) {
      const params = [
        providerSymbol,
        "m15",
        request.startTime,
        request.endTime,
        "500",
        "",
      ].join(",");
      const response = await fetcher(
        `https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=${encodeURIComponent(params)}`,
      );
      const value = await readProviderJson(response, "腾讯行情");
      let parsed;
      try {
        parsed = parseTencentIntraday(
          value,
          providerSymbol,
          marketTimeZone(request.market),
        );
      } catch (error) {
        throw new MarketDataProviderError(
          "invalid-response",
          error instanceof Error ? error.message : "腾讯行情响应无效",
        );
      }
      const candles = parsed.filter(
        (candle) =>
          candle.timestamp >= request.startTime && candle.timestamp <= request.endTime,
      );
      if (candles.length === 0) {
        hasUnavailableHistory ||= parsed.length > 0;
        continue;
      }
      return {
        provider: this.id,
        providerSymbol,
        fetchedAt: new Date().toISOString(),
        interval: "15m",
        candles,
        warnings: [],
      };
    }
    throw new MarketDataProviderError(
      hasUnavailableHistory ? "provider-history-limit" : "no-data",
      hasUnavailableHistory
        ? "腾讯行情不提供该时间范围的 15 分钟数据"
        : "腾讯行情未返回该股票数据",
    );
  }
}
