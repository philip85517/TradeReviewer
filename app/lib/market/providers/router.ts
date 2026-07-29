import type {
  DailyCandleRequest,
  MarketDataProvider,
  MarketDataProviderId,
  ProviderMarketCandle,
  ProviderResult,
  SupportedMarket,
} from "../contracts";
import { EastmoneyProvider } from "./eastmoney";
import { MarketDataProviderError } from "./errors";
import { TencentProvider } from "./tencent";
import { YahooProvider } from "./yahoo";

export type IntradayCandleRequest = {
  instrumentId: string;
  symbol: string;
  market: SupportedMarket;
  interval: "15m";
  startTime: string;
  endTime: string;
};

export type IntradayProviderResult = {
  provider: MarketDataProviderId;
  providerSymbol: string;
  fetchedAt: string;
  interval: "15m";
  candles: ProviderMarketCandle[];
  warnings: string[];
};

export type ProviderRouter = {
  fetchDaily(request: DailyCandleRequest): Promise<ProviderResult>;
  fetchIntraday(request: IntradayCandleRequest): Promise<IntradayProviderResult>;
};

export function createProviderRouter(
  fetcher: typeof fetch = fetch,
): ProviderRouter {
  const providers: Array<
    MarketDataProvider & {
      fetchIntraday(
        request: IntradayCandleRequest,
        fetcher?: typeof fetch,
      ): Promise<IntradayProviderResult>;
    }
  > = [
    new TencentProvider(),
    new EastmoneyProvider(),
    new YahooProvider(),
  ];

  return {
    async fetchDaily(request) {
      const failures: string[] = [];
      const providerErrors: MarketDataProviderError[] = [];
      for (const provider of providers) {
        if (!provider.supports(request.market)) continue;
        try {
          return await provider.fetchDaily(request, fetcher);
        } catch (error) {
          if (error instanceof MarketDataProviderError) {
            providerErrors.push(error);
          }
          failures.push(
            error instanceof Error ? error.message : `${provider.id}失败`,
          );
        }
      }
      const priority = [
        "source-rate-limited",
        "source-forbidden",
        "invalid-response",
        "source-timeout",
        "source-unavailable",
        "no-data",
      ] as const;
      const selectedError = priority
        .map((code) => providerErrors.find((error) => error.code === code))
        .find((error) => error !== undefined);
      throw new MarketDataProviderError(
        selectedError?.code ?? "source-unavailable",
        failures.join("；") || "没有支持该市场的行情源",
        selectedError?.status,
      );
    },
    async fetchIntraday(request) {
      const failures: string[] = [];
      const providerErrors: MarketDataProviderError[] = [];
      for (const provider of providers) {
        if (!provider.supports(request.market)) continue;
        try {
          return await provider.fetchIntraday(request, fetcher);
        } catch (error) {
          if (error instanceof MarketDataProviderError) {
            providerErrors.push(error);
          }
          failures.push(
            error instanceof Error ? error.message : `${provider.id}失败`,
          );
        }
      }
      const priority = [
        "source-rate-limited",
        "source-forbidden",
        "provider-history-limit",
        "invalid-response",
        "source-timeout",
        "source-unavailable",
        "no-data",
      ] as const;
      const selectedError = priority
        .map((code) => providerErrors.find((error) => error.code === code))
        .find((error) => error !== undefined);
      throw new MarketDataProviderError(
        selectedError?.code ?? "source-unavailable",
        failures.join("；") || "没有支持该市场的行情源",
        selectedError?.status,
      );
    },
  };
}
