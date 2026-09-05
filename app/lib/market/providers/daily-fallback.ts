import { expectedTradingDates } from "../calendar";
import type { DailyCandleRequest, MarketDataProvider, ProviderResult } from "../contracts";
import { MarketDataProviderError } from "./errors";
import { validateProviderCandles } from "../validation";

/** Fill missing sessions without replacing bars already supplied by a preferred source. */
export async function fetchDailyWithCoverage(
  providers: MarketDataProvider[], request: DailyCandleRequest, fetcher: typeof fetch,
): Promise<ProviderResult> {
  const dates = expectedTradingDates(request.market, request.startDate, request.endDate);
  const bars = new Map<string, ProviderResult["candles"][number]>();
  const candleSources: NonNullable<ProviderResult["candleSources"]> = {};
  const failures: string[] = [];
  let first: ProviderResult | undefined;
  let lastError: unknown;
  const errors: MarketDataProviderError[] = [];
  for (const provider of providers) {
    if (!provider.supports(request.market)) continue;
    const missing = dates.filter(date => !bars.has(date));
    if (first && missing.length === 0) break;
    const next = first && missing.length
      ? { ...request, startDate: missing[0], endDate: missing[missing.length - 1] }
      : request;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();
    const boundedFetch: typeof fetch = (input, init) => fetcher(input, {
      ...init, signal: init?.signal ? AbortSignal.any([init.signal, controller.signal]) : controller.signal,
    });
    try {
      const result = await Promise.race([
        provider.fetchDaily(next, boundedFetch),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(new MarketDataProviderError("source-timeout", `${provider.id}响应超时`));
          }, 9_000);
        }),
      ]);
      validateProviderCandles(result.candles, next.startDate, next.endDate);
      if (!result.candles.length) throw new MarketDataProviderError("no-data", `${provider.id}未返回数据`);
      first ??= result;
      for (const candle of result.candles) {
        if (candle.tradingDate < request.startDate || candle.tradingDate > request.endDate || bars.has(candle.tradingDate)) continue;
        bars.set(candle.tradingDate, candle);
        candleSources[candle.tradingDate] = { provider: result.provider, providerSymbol: result.providerSymbol, fetchedAt: result.fetchedAt };
      }
    } catch (error) {
      lastError = error;
      if (error instanceof MarketDataProviderError) errors.push(error);
      failures.push(`${provider.id}: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  if (!first || !bars.size) {
    const priority = ["source-rate-limited", "source-forbidden", "source-timeout", "source-unavailable", "invalid-response", "provider-history-limit", "no-data"];
    const failure = priority.map(code => errors.find(error => error.code === code)).find(Boolean);
    throw new MarketDataProviderError(failure?.code ?? (lastError instanceof MarketDataProviderError ? lastError.code : "source-unavailable"), failures.join("；"));
  }
  const incomplete = dates.some(date => !bars.has(date));
  return { ...first, candles: [...bars.values()].sort((a,b) => a.tradingDate.localeCompare(b.tradingDate)), candleSources,
    warnings: incomplete ? [...first.warnings, ...failures, "missing-sessions"] : [] };
}
