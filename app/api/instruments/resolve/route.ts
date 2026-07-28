import {
  InstrumentMetadataResolutionError,
  createMetadataRouter,
} from "../../../lib/instruments/providers/metadata-router";
import { InstrumentMetadataProviderError } from "../../../lib/instruments/providers/metadata-errors";
import {
  InvalidInstrumentLookup,
  parseInstrumentLookup,
} from "../../../lib/instruments/metadata-request-policy";

const CACHE_CONTROL = "public, max-age=21600, stale-while-revalidate=86400";
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

function errorStatus(code: string) {
  switch (code) {
    case "no-data":
      return 404;
    case "source-rate-limited":
      return 429;
    case "source-forbidden":
      return 403;
    case "source-timeout":
      return 504;
    default:
      return 502;
  }
}

export async function GET(request: Request) {
  let lookup;
  try {
    lookup = parseInstrumentLookup(new URL(request.url));
  } catch (error) {
    return json(
      {
        error: {
          code: "invalid-request",
          message:
            error instanceof InvalidInstrumentLookup
              ? error.message
              : "证券查询参数无效",
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

  const controller = new AbortController();
  const providerFetch: typeof fetch = (input, init) =>
    fetch(input, { ...init, signal: controller.signal });
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    const result = await Promise.race([
      createMetadataRouter(providerFetch).resolve(lookup),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          controller.abort();
          reject(
            new InstrumentMetadataProviderError(
              "source-timeout",
              "证券元数据请求超时",
            ),
          );
        }, REQUEST_TIMEOUT_MS);
      }),
    ]);
    return json(result);
  } catch (error) {
    if (error instanceof InstrumentMetadataResolutionError) {
      return json(
        {
          error: {
            code: error.code === "no-data" ? "unresolved" : error.code,
            message: error.message,
            attempts: error.failure.attempts,
          },
        },
        errorStatus(error.code),
      );
    }

    const providerError =
      error instanceof InstrumentMetadataProviderError ? error : undefined;
    return json(
      {
        error: {
          code: providerError?.code ?? "source-unavailable",
          message:
            providerError?.code === "source-timeout"
              ? "证券元数据请求超时"
              : "证券元数据暂时不可用",
          attempts: [],
        },
      },
      errorStatus(providerError?.code ?? "source-unavailable"),
    );
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
