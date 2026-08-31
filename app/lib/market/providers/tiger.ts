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
import type { TigerOpenApiConfig } from "../tiger-config";
import { runTigerBars, type TigerBar } from "../tiger-process";
import { normalizeMarketSymbol } from "../symbol-map";
import {
  validateProviderCandles,
  validateProviderMarketCandles,
} from "../validation";
import { MarketDataProviderError } from "./errors";

type TigerDailyRequest = DailyCandleRequest & {
  providerSymbol: string;
};

type TigerIntradayRequest = IntradayCandleRequest & {
  providerSymbol: string;
};

export type TigerRunBars = (
  request: {
    symbol: string;
    period: "day" | "60min";
    beginTime: string;
    endTime: string;
  },
) => Promise<TigerBar[]>;

function normalizeTigerSymbol(
  market: SupportedMarket,
  symbol: string,
) {
  const normalized = normalizeMarketSymbol(market, symbol);
  if (market === "HK") {
    return normalized.padStart(5, "0");
  }
  return normalized;
}

function supportsTigerMarket(market: SupportedMarket) {
  return market === "US" || market === "HK";
}

function tigerUtcTimestamp(value: string) {
  const timestamp = new Date(value);
  if (!Number.isFinite(timestamp.getTime())) {
    throw new Error("Tiger OpenAPI 行情响应格式已变化");
  }
  return String(timestamp.getTime());
}

function assertTigerNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value);
}

function assertTigerIdentity(bar: TigerBar, providerSymbol: string) {
  if (bar.symbol !== providerSymbol) {
    throw new Error("Tiger OpenAPI 行情响应标的不匹配");
  }
}

export function parseTigerBars(
  bars: TigerBar[],
  request: TigerDailyRequest,
): ProviderDailyCandle[];
export function parseTigerBars(
  bars: TigerBar[],
  request: TigerIntradayRequest,
): ProviderMarketCandle[];
export function parseTigerBars(
  bars: TigerBar[],
  request: TigerDailyRequest | TigerIntradayRequest,
) {
  return bars.map((bar) => {
    if (
      typeof bar.symbol !== "string" ||
      !assertTigerNumber(bar.time) ||
      !assertTigerNumber(bar.open) ||
      !assertTigerNumber(bar.high) ||
      !assertTigerNumber(bar.low) ||
      !assertTigerNumber(bar.close) ||
      !assertTigerNumber(bar.volume)
    ) {
      throw new Error("Tiger OpenAPI 行情响应格式已变化");
    }
    assertTigerIdentity(bar, request.providerSymbol);
    const timestamp = new Date(bar.time);
    if (!Number.isFinite(timestamp.getTime())) {
      throw new Error("Tiger OpenAPI 行情响应格式已变化");
    }
    const iso = timestamp.toISOString();
    if ("interval" in request) {
      return {
        timestamp: iso,
        open: String(bar.open),
        high: String(bar.high),
        low: String(bar.low),
        close: String(bar.close),
        volume: String(bar.volume),
      };
    }
    return {
      tradingDate: iso.slice(0, 10),
      open: String(bar.open),
      high: String(bar.high),
      low: String(bar.low),
      close: String(bar.close),
      volume: String(bar.volume),
    };
  });
}

export class TigerProvider implements MarketDataProvider {
  readonly id = "tiger" as const;

  constructor(
    readonly config: Pick<TigerOpenApiConfig, "configPath">,
    private readonly runBars: TigerRunBars = runTigerBars,
  ) {}

  supports(market: SupportedMarket) {
    return supportsTigerMarket(market);
  }

  async fetchDaily(
    request: DailyCandleRequest,
    _fetcher?: typeof fetch,
  ): Promise<ProviderResult> {
    if (!supportsTigerMarket(request.market)) {
      throw new MarketDataProviderError(
        "no-data",
        "Tiger OpenAPI 仅支持美股和港股",
      );
    }

    const providerSymbol = normalizeTigerSymbol(request.market, request.symbol);
    try {
      const candles = parseTigerBars(
        await this.runBars({
          symbol: providerSymbol,
          period: "day",
          beginTime: request.startDate,
          endTime: request.endDate,
        }),
        { ...request, providerSymbol },
      );
      validateProviderCandles(candles, request.startDate, request.endDate);
      return {
        provider: this.id,
        providerSymbol,
        fetchedAt: new Date().toISOString(),
        candles,
        warnings: [],
      };
    } catch (error) {
      if (error instanceof MarketDataProviderError) {
        throw error;
      }
      throw new MarketDataProviderError(
        "invalid-response",
        error instanceof Error ? error.message : "Tiger OpenAPI 行情响应无效",
      );
    }
  }

  async fetchIntraday(
    request: IntradayCandleRequest,
    _fetcher?: typeof fetch,
  ): Promise<IntradayProviderResult> {
    if (!supportsTigerMarket(request.market) || request.interval !== "1h") {
      throw new MarketDataProviderError(
        "no-data",
        "Tiger OpenAPI 仅支持美股和港股日线与 1 小时行情",
      );
    }

    const providerSymbol = normalizeTigerSymbol(request.market, request.symbol);
    try {
      const candles = parseTigerBars(
        await this.runBars({
          symbol: providerSymbol,
          period: "60min",
          beginTime: tigerUtcTimestamp(request.startTime),
          endTime: tigerUtcTimestamp(request.endTime),
        }),
        { ...request, providerSymbol },
      );
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
      if (error instanceof MarketDataProviderError) {
        throw error;
      }
      throw new MarketDataProviderError(
        "invalid-response",
        error instanceof Error ? error.message : "Tiger OpenAPI 行情响应无效",
      );
    }
  }
}
