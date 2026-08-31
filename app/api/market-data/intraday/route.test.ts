import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";
import {
  InvalidMarketDataRequest,
  parseIntradayCandleRequest,
} from "../../../lib/market/request-policy";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("parseIntradayCandleRequest", () => {
  it("accepts a bounded native 1h request", () => {
    expect(
      parseIntradayCandleRequest(
        new URL(
          "http://local/api?market=CN-SH&symbol=600519&interval=1h&start=2025-01-01T00%3A00%3A00.000Z&end=2025-01-10T23%3A59%3A59.999Z",
        ),
      ),
    ).toMatchObject({
      market: "CN-SH",
      symbol: "600519",
      interval: "1h",
    });
  });

  it("rejects a 1h request outside the public source history window", () => {
    const overlongUrl = new URL(
      "http://local/api?market=HK&symbol=1810&interval=1h&start=2024-01-01T00%3A00%3A00.000Z&end=2026-01-01T00%3A00%3A00.000Z",
    );

    expect(() => parseIntradayCandleRequest(overlongUrl)).toThrow(
      "1 小时行情单次请求不能超过 730 个自然日",
    );
  });

  it("accepts only a bounded 15m request", () => {
    expect(
      parseIntradayCandleRequest(
        new URL(
          "http://local/api?market=HK&symbol=1810&interval=15m&start=2025-01-01T00%3A00%3A00.000Z&end=2025-01-10T00%3A00%3A00.000Z",
        ),
      ),
    ).toMatchObject({ market: "HK", symbol: "1810", interval: "15m" });
  });

  it("rejects an intraday request longer than 60 natural days", () => {
    const overlongUrl = new URL(
      "http://local/api?market=HK&symbol=1810&interval=15m&start=2025-01-01T00%3A00%3A00.000Z&end=2025-03-02T00%3A00%3A00.000Z",
    );

    expect(() => parseIntradayCandleRequest(overlongUrl)).toThrow(
      "15 分钟行情单次请求不能超过 60 个自然日",
    );
  });

  it("rejects an unsupported intraday interval", () => {
    expect(() =>
      parseIntradayCandleRequest(
        new URL(
          "http://local/api?market=US&symbol=XPEV&interval=5m&start=2025-01-01T00%3A00%3A00.000Z&end=2025-01-01T00%3A15%3A00.000Z",
        ),
      ),
    ).toThrow(InvalidMarketDataRequest);
  });
});

describe("GET /api/market-data/intraday", () => {
  it("returns normalized raw 15 minute candles with public transient caching", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          data: {
            hk01810: {
              m15: [
                ["2025-01-02 09:30:00", "34.1", "34.5", "35", "33.8", "1200"],
              ],
            },
          },
        }),
      ),
    );

    const response = await GET(
      new Request(
        "http://localhost/api/market-data/intraday?market=HK&symbol=1810&interval=15m&start=2025-01-02T01%3A30%3A00.000Z&end=2025-01-02T01%3A30%3A00.000Z",
        { headers: { "x-forwarded-for": "intraday-success" } },
      ),
    );
    const body = (await response.json()) as {
      provider: string;
      providerSymbol: string;
      interval: string;
      adjustmentMode: string;
      candles: Array<{ timestamp: string; close: string }>;
    };

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe(
      "public, max-age=1800, stale-while-revalidate=3600",
    );
    expect(body).toMatchObject({
      provider: "tencent",
      providerSymbol: "hk01810",
      interval: "15m",
      adjustmentMode: "raw",
      request: {
        instrumentId: "HK:1810",
        symbol: "1810",
        market: "HK",
        interval: "15m",
        startTime: "2025-01-02T01:30:00.000Z",
        endTime: "2025-01-02T01:30:00.000Z",
      },
      candles: [
        { timestamp: "2025-01-02T01:30:00.000Z", close: "34.5" },
      ],
    });
  });

  it("rate limits one client without blocking a different client", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          data: {
            hk01810: {
              m15: [
                ["2025-01-02 09:30:00", "34.1", "34.5", "35", "33.8", "1200"],
              ],
            },
          },
        }),
      ),
    );
    const url =
      "http://localhost/api/market-data/intraday?market=HK&symbol=1810&interval=15m&start=2025-01-02T01%3A30%3A00.000Z&end=2025-01-02T01%3A30%3A00.000Z";
    const sameClient = { headers: { "x-forwarded-for": "intraday-busy" } };

    for (let index = 0; index < 30; index += 1) {
      expect((await GET(new Request(url, sameClient))).status).toBe(200);
    }
    const limited = await GET(new Request(url, sameClient));
    const otherClient = await GET(
      new Request(url, { headers: { "x-forwarded-for": "intraday-free" } }),
    );

    expect(limited.status).toBe(429);
    expect(await limited.json()).toMatchObject({
      error: { code: "rate-limited" },
    });
    expect(otherClient.status).toBe(200);
  });

  it("does not throttle direct localhost batch requests", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          data: {
            hk01810: {
              m15: [
                ["2025-01-02 09:30:00", "34.1", "34.5", "35", "33.8", "1200"],
              ],
            },
          },
        }),
      ),
    );
    const url =
      "http://localhost/api/market-data/intraday?market=HK&symbol=1810&interval=15m&start=2025-01-02T01%3A30%3A00.000Z&end=2025-01-02T01%3A30%3A00.000Z";

    for (let index = 0; index < 31; index += 1) {
      expect((await GET(new Request(url))).status).toBe(200);
    }
  });

  it("aborts provider fetches after the 12 second deadline", async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
        signal = init?.signal ?? undefined;
        return new Promise<Response>(() => {});
      }),
    );

    const pending = GET(
      new Request(
        "http://localhost/api/market-data/intraday?market=HK&symbol=1810&interval=15m&start=2025-01-02T01%3A30%3A00.000Z&end=2025-01-02T01%3A30%3A00.000Z",
        { headers: { "x-forwarded-for": "intraday-timeout" } },
      ),
    );
    await vi.advanceTimersByTimeAsync(12_000);
    const response = await pending;

    expect(signal?.aborted).toBe(true);
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({
      error: { code: "source-timeout" },
    });
  });

  it("returns a public provider error code", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("limited", { status: 429 })));

    const response = await GET(
      new Request(
        "http://localhost/api/market-data/intraday?market=HK&symbol=1810&interval=15m&start=2025-01-02T01%3A30%3A00.000Z&end=2025-01-02T01%3A30%3A00.000Z",
        { headers: { "x-forwarded-for": "intraday-error" } },
      ),
    );

    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({
      error: { code: "source-rate-limited" },
    });
  });
});
