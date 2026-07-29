import { MarketDataProviderError } from "../../../lib/market/providers/errors";
import { createProviderRouter } from "../../../lib/market/providers/router";
import {
  InvalidMarketDataRequest,
  parseIntradayCandleRequest,
} from "../../../lib/market/request-policy";

const CACHE_CONTROL = "public, max-age=1800, stale-while-revalidate=3600";
const REQUEST_TIMEOUT_MS = 12_000;
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

export async function GET(request: Request) {
  let intradayRequest;
  try {
    intradayRequest = parseIntradayCandleRequest(new URL(request.url));
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
      createProviderRouter(providerFetch).fetchIntraday(intradayRequest),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          controller.abort();
          reject(new MarketDataProviderError("source-timeout", "行情源响应超时"));
        }, REQUEST_TIMEOUT_MS);
      }),
    ]);
    return json({ ...result, adjustmentMode: "raw" });
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
}
