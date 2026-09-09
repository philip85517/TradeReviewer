import { createProviderRouter } from "../../../lib/market/providers/router";
import { MarketDataProviderError } from "../../../lib/market/providers/errors";
import {
  InvalidMarketDataRequest,
  parseDailyCandleRequest,
} from "../../../lib/market/request-policy";
import type { ProviderRouter } from "../../../lib/market/providers/router";

const CACHE_CONTROL =
  "public, max-age=21600, stale-while-revalidate=86400";
// Allow the bounded provider attempts to finish instead of cancelling fallback
// at exactly the Tiger subprocess timeout.
const REQUEST_TIMEOUT_MS = 55_000;
const MAX_REQUESTS_PER_MINUTE = 30;
const requestsByClient = new Map<string, number[]>();

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: status === 200 ? { "Cache-Control": CACHE_CONTROL } : undefined,
  });
}

function clientId(request: Request) {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "local"
  );
}

function isRateLimited(request: Request) {
  const url = new URL(request.url);
  if (
    (url.hostname === "localhost" ||
      url.hostname === "127.0.0.1" ||
      url.hostname === "[::1]") &&
    !request.headers.has("cf-connecting-ip") &&
    !request.headers.has("x-forwarded-for")
  ) {
    return false;
  }
  const key = clientId(request);
  const now = Date.now();
  const recent = (requestsByClient.get(key) ?? []).filter(
    (timestamp) => now - timestamp < 60_000,
  );
  recent.push(now);
  requestsByClient.set(key, recent);
  if (requestsByClient.size > 1_000) {
    const oldestKey = requestsByClient.keys().next().value;
    if (typeof oldestKey === "string") requestsByClient.delete(oldestKey);
  }
  return recent.length > MAX_REQUESTS_PER_MINUTE;
}

type RouterFactory = (providerFetch: typeof fetch) => ProviderRouter;

export function createDailyGetForTest(
  createRouter: RouterFactory = createProviderRouter,
) {
  return async function GET(request: Request) {
    let dailyRequest;
    try {
      dailyRequest = parseDailyCandleRequest(new URL(request.url));
    } catch (error) {
      return json(
        {
          error: {
            code: "invalid-request",
            message:
              error instanceof InvalidMarketDataRequest
                ? error.message
                : "请求参数无效",
          },
        },
        400,
      );
    }

    if (isRateLimited(request)) {
      return json(
        {
          error: {
            code: "rate-limited",
            message: "请求过于频繁，请稍后再试",
          },
        },
        429,
      );
    }

    let timeout: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();
    const providerFetch: typeof fetch = (input, init) =>
      fetch(input, { ...init, signal: controller.signal });
    try {
      const result = await Promise.race([
        createRouter(providerFetch).fetchDaily(dailyRequest),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(
            () => {
              controller.abort();
              reject(
                new MarketDataProviderError(
                  "source-timeout",
                  "行情源响应超时",
                ),
              );
            },
            REQUEST_TIMEOUT_MS,
          );
        }),
      ]);
      const response = json({
        ...result,
        request: dailyRequest,
        adjustmentMode: "raw",
      });
      if (result.warnings.includes("missing-sessions") || result.candles.length === 0) {
        response.headers.set("Cache-Control", "no-store");
      }
      return response;
    } catch (error) {
      const providerError =
        error instanceof MarketDataProviderError ? error : undefined;
      const status =
        providerError?.code === "source-rate-limited"
          ? 429
          : providerError?.code === "source-forbidden"
            ? 403
            : 502;
      return json(
        {
          error: {
            code: providerError?.code ?? "source-unavailable",
            message:
              error instanceof Error ? error.message : "行情源暂时不可用",
          },
        },
        status,
      );
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  };
}

export const GET = createDailyGetForTest();
