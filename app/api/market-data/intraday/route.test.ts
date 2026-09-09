import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  IntradayProviderResult,
  MarketDataProvider,
  SupportedMarket,
} from "../../../lib/market/contracts";
import { MarketDataProviderError } from "../../../lib/market/providers/errors";
import { createProviderRouter } from "../../../lib/market/providers/router";
import type { ProviderRouter } from "../../../lib/market/providers/router";
import {
  InvalidMarketDataRequest,
  parseIntradayCandleRequest,
} from "../../../lib/market/request-policy";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.resetModules();
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
  async function loadRouteWithRouter(router: ProviderRouter) {
    const routeModule = await import("./route");
    return routeModule.createIntradayGetForTest(() => router);
  }

  async function loadRouteWithRealRouter(
    options?: Parameters<typeof createProviderRouter>[1],
  ) {
    const routeModule = await import("./route");
    return routeModule.createIntradayGetForTest((providerFetch) =>
      createProviderRouter(providerFetch, options),
    );
  }

  function tigerIntradayResult(
    overrides: Partial<IntradayProviderResult> = {},
  ): IntradayProviderResult {
    return {
      provider: "tiger",
      providerSymbol: "00700",
      fetchedAt: "2026-08-31T00:00:00.000Z",
      interval: "1h",
      warnings: [],
      candles: [
        {
          timestamp: "2025-01-02T01:30:00.000Z",
          open: "34.1",
          high: "35",
          low: "33.8",
          close: "34.5",
          volume: "1200",
        },
      ],
      ...overrides,
    };
  }

  function fakeTigerProvider(
    fetchIntraday: MarketDataProvider["fetchIntraday"],
    supportedMarkets: SupportedMarket[] = ["US", "HK"],
  ): MarketDataProvider {
    return {
      id: "tiger",
      supports: (market) => supportedMarkets.includes(market),
      fetchDaily: vi.fn(async () => {
        throw new Error("unexpected daily call");
      }),
      fetchIntraday,
    };
  }

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

    const { GET } = await import("./route");

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
    const { GET } = await import("./route");
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
    const { GET } = await import("./route");
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

    const { GET } = await import("./route");

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

    const { GET } = await import("./route");

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

  it("returns the existing success shape for configured HK Tiger 1h requests", async () => {
    const GET = await loadRouteWithRouter({
      fetchDaily: vi.fn(),
      fetchIntraday: vi.fn(async () => tigerIntradayResult()),
    });

    const response = await GET(
      new Request(
        "http://localhost/api/market-data/intraday?market=HK&symbol=700&interval=1h&start=2025-01-02T00%3A00%3A00.000Z&end=2025-01-03T23%3A59%3A59.000Z",
      ),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      provider: "tiger",
      providerSymbol: "00700",
      interval: "1h",
      adjustmentMode: "raw",
      request: {
        instrumentId: "HK:700",
        symbol: "700",
        market: "HK",
        interval: "1h",
        startTime: "2025-01-02T00:00:00.000Z",
        endTime: "2025-01-03T23:59:59.000Z",
      },
      candles: [{ timestamp: "2025-01-02T01:30:00.000Z", close: "34.5" }],
    });
  });

  it("uses a public provider through createProviderRouter when Tiger is not configured for HK hourly", async () => {
    const hosts: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input) => {
      const url = new URL(String(input));
      hosts.push(url.host);
      if (url.host === "web.ifzq.gtimg.cn") {
        return Response.json({ data: {} });
      }
      if (url.host.includes("eastmoney.com")) {
        return Response.json({
          data: {
            code: "00700",
            klines: ["2025-01-02 09:30:00,34.1,34.5,35,33.8,1200"],
          },
        });
      }
      throw new Error(`unexpected provider host: ${url.host}`);
    }));

    const GET = await loadRouteWithRealRouter({ environment: {} });

    const response = await GET(
      new Request(
        "http://localhost/api/market-data/intraday?market=HK&symbol=700&interval=1h&start=2025-01-02T00%3A00%3A00.000Z&end=2025-01-03T23%3A59%3A59.000Z",
      ),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      provider: "eastmoney",
      providerSymbol: "116.00700",
      candles: [{ timestamp: "2025-01-02T01:30:00.000Z", close: "34.5" }],
    });
    expect(hosts).toEqual([
      "web.ifzq.gtimg.cn",
      "33.push2his.eastmoney.com",
    ]);
  });

  it("falls back to a public provider through createProviderRouter after a Tiger hourly fetch error", async () => {
    const tigerFetchIntraday = vi.fn(async () => {
      throw new MarketDataProviderError(
        "source-unavailable",
        "Tiger unavailable",
      );
    });
    const hosts: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input) => {
      const url = new URL(String(input));
      hosts.push(url.host);
      if (url.host === "web.ifzq.gtimg.cn") {
        return Response.json({ data: {} });
      }
      if (url.host.includes("eastmoney.com")) {
        return Response.json({
          data: {
            code: "00700",
            klines: ["2025-01-02 09:30:00,34.1,34.5,35,33.8,1200"],
          },
        });
      }
      throw new Error(`unexpected provider host: ${url.host}`);
    }));

    const GET = await loadRouteWithRealRouter({
      environment: {},
      tigerConfig: { configPath: "/tmp/tiger.properties" },
      tigerProvider: fakeTigerProvider(tigerFetchIntraday),
    });

    const response = await GET(
      new Request(
        "http://localhost/api/market-data/intraday?market=HK&symbol=700&interval=1h&start=2025-01-02T00%3A00%3A00.000Z&end=2025-01-03T23%3A59%3A59.000Z",
      ),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      provider: "eastmoney",
      candles: [{ timestamp: "2025-01-02T01:30:00.000Z" }],
    });
    expect(tigerFetchIntraday).toHaveBeenCalledOnce();
    expect(hosts).toEqual([
      "web.ifzq.gtimg.cn",
      "33.push2his.eastmoney.com",
    ]);
  });
});
