type MarketDataFetchOptions = {
  minIntervalMs?: number;
  retryDelayMs?: number;
  maxRetries?: number;
};

const RETRYABLE_STATUSES = new Set([429, 502, 503, 504]);
const NON_RETRYABLE_MARKET_DATA_ERRORS = new Set([
  "no-data",
  "provider-history-limit",
  "source-unavailable",
]);

async function isNonRetryableMarketDataError(response: Response) {
  if (!response.headers.get("content-type")?.includes("application/json")) {
    return false;
  }
  const body = (await response.clone().json().catch(() => undefined)) as
    | { error?: { code?: unknown } }
    | undefined;
  return (
    typeof body?.error?.code === "string" &&
    NON_RETRYABLE_MARKET_DATA_ERRORS.has(body.error.code)
  );
}

function abortError() {
  return new DOMException("行情请求已取消", "AbortError");
}

function delay(milliseconds: number, signal?: AbortSignal) {
  if (signal?.aborted) return Promise.reject(abortError());
  if (milliseconds <= 0) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, milliseconds);
    const onAbort = () => {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", onAbort);
      reject(abortError());
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export function createMarketDataFetcher(
  fetcher: typeof fetch = fetch,
  options: MarketDataFetchOptions = {},
): typeof fetch {
  const minIntervalMs = Math.max(0, options.minIntervalMs ?? 2_100);
  const retryDelayMs = Math.max(0, options.retryDelayMs ?? 2_100);
  const maxRetries = Math.max(0, Math.floor(options.maxRetries ?? 2));
  let nextRequestAt = 0;

  return async (input, init) => {
    for (let attempt = 0; ; attempt += 1) {
      const now = Date.now();
      const wait = Math.max(0, nextRequestAt - now);
      nextRequestAt = Math.max(now, nextRequestAt) + minIntervalMs;
      await delay(wait, init?.signal ?? undefined);

      const response = await fetcher(input, init);
      if (
        !RETRYABLE_STATUSES.has(response.status) ||
        (await isNonRetryableMarketDataError(response)) ||
        attempt >= maxRetries
      ) {
        return response;
      }

      await response.arrayBuffer().catch(() => undefined);
      await delay(retryDelayMs * 2 ** attempt, init?.signal ?? undefined);
    }
  };
}
