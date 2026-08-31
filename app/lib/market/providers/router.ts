import type {
  DailyCandleRequest,
  IntradayCandleRequest,
  IntradayProviderResult,
  MarketDataProvider,
  ProviderResult,
} from "../contracts";
import {
  readTigerOpenApiConfig,
  type TigerOpenApiConfig,
} from "../tiger-config";
import { EastmoneyProvider } from "./eastmoney";
import { MarketDataProviderError } from "./errors";
import { BaiduProvider } from "./baidu";
import { SinaUsProvider } from "./sina-us";
import { TencentProvider } from "./tencent";
import { TigerProvider } from "./tiger";
import { YahooProvider } from "./yahoo";

export type {
  IntradayCandleRequest,
  IntradayProviderResult,
} from "../contracts";

export type ProviderRouter = {
  fetchDaily(request: DailyCandleRequest): Promise<ProviderResult>;
  fetchIntraday(request: IntradayCandleRequest): Promise<IntradayProviderResult>;
};

const PROVIDER_ERROR_PRIORITY = [
  "source-rate-limited",
  "source-unavailable",
  "source-timeout",
  "source-forbidden",
  "provider-history-limit",
  "invalid-response",
  "no-data",
] as const;

type ProviderCandleResult = {
  provider: string;
  candles: readonly unknown[];
  warnings: readonly string[];
};

type ProviderRouterOptions = {
  environment?: Readonly<Record<string, string | undefined>>;
  tigerConfig?: Pick<TigerOpenApiConfig, "configPath">;
  tigerProvider?: MarketDataProvider;
};

function shouldFallBackOnEmptyTigerResult(
  result: ProviderCandleResult,
) {
  return result.provider === "tiger" && result.candles.length === 0;
}

function likelySparseHourlyResult(
  request: IntradayCandleRequest,
  result: IntradayProviderResult,
) {
  if (result.warnings.includes("provider-history-limit")) return true;
  if (request.interval !== "1h") return false;
  const start = Date.parse(request.startTime);
  const end = Date.parse(request.endTime);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return false;
  }
  const spanDays = (end - start) / (24 * 60 * 60 * 1000);
  return spanDays >= 3 && result.candles.length < Math.ceil(spanDays * 2);
}

async function fetchWithProviderFallback<
  Request extends { market: string },
  Result extends ProviderCandleResult,
>(
  providers: MarketDataProvider[],
  request: Request,
  run: (provider: MarketDataProvider, request: Request) => Promise<Result>,
  shouldTryNext?: (result: Result, request: Request) => boolean,
) {
  const failures: string[] = [];
  const providerErrors: MarketDataProviderError[] = [];
  let bestPartial: Result | undefined;
  for (const [index, provider] of providers.entries()) {
    if (!provider.supports(request.market as DailyCandleRequest["market"])) {
      continue;
    }
    try {
      const result = await run(provider, request);
      const hasNextProvider = providers
        .slice(index + 1)
        .some((candidate) =>
          candidate.supports(request.market as DailyCandleRequest["market"]),
        );
      if (shouldTryNext?.(result, request) && hasNextProvider) {
        if (!bestPartial || result.candles.length > bestPartial.candles.length) {
          bestPartial = result;
        }
        continue;
      }
      if (shouldTryNext?.(result, request) && result.candles.length === 0) {
        throw new MarketDataProviderError(
          "no-data",
          `${provider.id}未返回该股票数据`,
        );
      }
      return result;
    } catch (error) {
      providerErrors.push(
        error instanceof MarketDataProviderError
          ? error
          : new MarketDataProviderError(
              "source-unavailable",
              `${provider.id}行情源连接失败`,
            ),
      );
      failures.push(
        error instanceof Error ? error.message : `${provider.id}失败`,
      );
    }
  }
  if (bestPartial) return bestPartial;
  const selectedError = PROVIDER_ERROR_PRIORITY
    .map((code) => providerErrors.find((error) => error.code === code))
    .find((error) => error !== undefined);
  throw new MarketDataProviderError(
    selectedError?.code ?? "source-unavailable",
    failures.join("；") || "没有支持该市场的行情源",
    selectedError?.status,
  );
}

export function createProviderRouter(
  fetcher: typeof fetch = fetch,
  options: ProviderRouterOptions = {},
): ProviderRouter {
  const tigerConfig = options.tigerConfig ??
    readTigerOpenApiConfig(options.environment);
  const tigerProvider = tigerConfig
    ? (options.tigerProvider ?? new TigerProvider(tigerConfig))
    : undefined;
  const providers: MarketDataProvider[] = [
    new TencentProvider(),
    new EastmoneyProvider(),
    new YahooProvider(),
    new BaiduProvider(),
  ];
  const dailyProviders = tigerProvider
    ? [tigerProvider, ...providers]
    : providers;

  return {
    fetchDaily: (request) =>
      fetchWithProviderFallback(
        dailyProviders,
        request,
        (provider, nextRequest) =>
          provider.fetchDaily(nextRequest, fetcher),
        (result) => shouldFallBackOnEmptyTigerResult(result),
      ),
    fetchIntraday: (request) =>
      fetchWithProviderFallback(
        request.interval === "1h"
          ? request.market === "CN-SH" || request.market === "CN-SZ"
            ? [new TencentProvider(), new EastmoneyProvider(), new YahooProvider()]
            : request.market === "US"
              ? [
                ...(tigerProvider ? [tigerProvider] : []),
                new TencentProvider(),
                new EastmoneyProvider(),
                new SinaUsProvider(),
                new YahooProvider(),
                new BaiduProvider(),
              ]
              : [
                ...(tigerProvider ? [tigerProvider] : []),
                new TencentProvider(),
                new EastmoneyProvider(),
                new YahooProvider(),
                new BaiduProvider(),
              ]
          : providers,
        request,
        (provider, nextRequest) =>
          provider.fetchIntraday(nextRequest, fetcher),
        (result, nextRequest) =>
          shouldFallBackOnEmptyTigerResult(result) ||
          likelySparseHourlyResult(nextRequest, result),
      ),
  };
}
