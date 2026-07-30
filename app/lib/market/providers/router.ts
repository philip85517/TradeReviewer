import type {
  DailyCandleRequest,
  IntradayCandleRequest,
  IntradayProviderResult,
  MarketDataProvider,
  ProviderResult,
} from "../contracts";
import { EastmoneyProvider } from "./eastmoney";
import { MarketDataProviderError } from "./errors";
import { TencentProvider } from "./tencent";
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
  "source-forbidden",
  "provider-history-limit",
  "invalid-response",
  "source-timeout",
  "source-unavailable",
  "no-data",
] as const;

async function fetchWithProviderFallback<Request extends { market: string }, Result>(
  providers: MarketDataProvider[],
  request: Request,
  run: (provider: MarketDataProvider, request: Request) => Promise<Result>,
) {
  const failures: string[] = [];
  const providerErrors: MarketDataProviderError[] = [];
  for (const provider of providers) {
    if (!provider.supports(request.market as DailyCandleRequest["market"])) {
      continue;
    }
    try {
      return await run(provider, request);
    } catch (error) {
      if (error instanceof MarketDataProviderError) {
        providerErrors.push(error);
      }
      failures.push(
        error instanceof Error ? error.message : `${provider.id}失败`,
      );
    }
  }
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
): ProviderRouter {
  const providers: MarketDataProvider[] = [
    new TencentProvider(),
    new EastmoneyProvider(),
    new YahooProvider(),
  ];

  return {
    fetchDaily: (request) =>
      fetchWithProviderFallback(
        providers,
        request,
        (provider, nextRequest) =>
          provider.fetchDaily(nextRequest, fetcher),
      ),
    fetchIntraday: (request) =>
      fetchWithProviderFallback(
        providers,
        request,
        (provider, nextRequest) =>
          provider.fetchIntraday(nextRequest, fetcher),
      ),
  };
}
