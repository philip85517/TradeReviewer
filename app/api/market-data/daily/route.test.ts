import { afterEach, describe, expect, it, vi } from "vitest";

import type { ProviderResult } from "../../../lib/market/contracts";
import type { ProviderRouter } from "../../../lib/market/providers/router";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("GET /api/market-data/daily", () => {
  async function loadRouteWithRouter(router: ProviderRouter) {
    const routeModule = await import("./route");
    return routeModule.createDailyGetForTest(() => router);
  }

  function dailyTigerResult(
    overrides: Partial<ProviderResult> = {},
  ): ProviderResult {
    return {
      provider: "tiger",
      providerSymbol: "AAPL",
      fetchedAt: "2026-08-31T00:00:00.000Z",
      warnings: [],
      candles: [
        {
          tradingDate: "2025-01-02",
          open: "100",
          high: "101",
          low: "99",
          close: "100.5",
          volume: "1200",
        },
      ],
      ...overrides,
    };
  }

  it("rejects unsupported markets before contacting a provider", async () => {
    const providerFetch = vi.fn();
    vi.stubGlobal("fetch", providerFetch);

    const { GET } = await import("./route");

    const response = await GET(
      new Request(
        "http://localhost/api/market-data/daily?market=JP&symbol=7203&start=2025-01-01&end=2025-01-31",
      ),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: {
        code: "invalid-request",
        message: "不支持的市场",
      },
    });
    expect(providerFetch).not.toHaveBeenCalled();
  });

  it("rejects requests longer than 500 natural days", async () => {
    const { GET } = await import("./route");
    const response = await GET(
      new Request(
        "http://localhost/api/market-data/daily?market=US&symbol=XPEV&start=2023-01-01&end=2025-01-31",
      ),
    );
    expect(response.status).toBe(400);
    expect(
      (
        (await response.json()) as {
          error: { code: string };
        }
      ).error.code,
    ).toBe("invalid-request");
  });

  it("returns normalized raw daily candles with public transient caching", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          data: {
            "hk01810": {
              day: [["2025-01-02", "34.1", "34.5", "35", "33.8", "1200"]],
            },
          },
        }),
      ),
    );

    const { GET } = await import("./route");

    const response = await GET(
      new Request(
        "http://localhost/api/market-data/daily?market=HK&symbol=1810&start=2025-01-01&end=2025-01-31",
      ),
    );
    const body = (await response.json()) as {
      provider: string;
      providerSymbol: string;
      adjustmentMode: string;
      candles: Array<{ close: string }>;
    };

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe(
      "public, max-age=21600, stale-while-revalidate=86400",
    );
    expect(body.provider).toBe("tencent");
    expect(body.providerSymbol).toBe("hk01810");
    expect(body.adjustmentMode).toBe("raw");
    expect(body).toMatchObject({
      request: {
        instrumentId: "HK:1810",
        symbol: "1810",
        market: "HK",
        startDate: "2025-01-01",
        endDate: "2025-01-31",
      },
    });
    expect(body.candles[0].close).toBe("34.5");
  });

  it("does not throttle direct localhost batch requests", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          data: {
            hk01810: {
              day: [["2025-01-02", "34.1", "34.5", "35", "33.8", "1200"]],
            },
          },
        }),
      ),
    );
    const { GET } = await import("./route");
    const url =
      "http://localhost/api/market-data/daily?market=HK&symbol=1810&start=2025-01-01&end=2025-01-31";

    for (let index = 0; index < 31; index += 1) {
      expect((await GET(new Request(url))).status).toBe(200);
    }
  });

  it("returns the existing success shape for configured US Tiger requests", async () => {
    const GET = await loadRouteWithRouter({
      fetchDaily: vi.fn(async () => dailyTigerResult()),
      fetchIntraday: vi.fn(),
    });

    const response = await GET(
      new Request(
        "http://localhost/api/market-data/daily?market=US&symbol=AAPL&start=2025-01-02&end=2025-01-03",
      ),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      provider: "tiger",
      providerSymbol: "AAPL",
      adjustmentMode: "raw",
      request: {
        instrumentId: "US:AAPL",
        symbol: "AAPL",
        market: "US",
        startDate: "2025-01-02",
        endDate: "2025-01-03",
      },
      candles: [{ tradingDate: "2025-01-02", close: "100.5" }],
    });
  });

  it("returns the public provider path when Tiger is not configured", async () => {
    const GET = await loadRouteWithRouter({
      fetchDaily: vi.fn(async () =>
        dailyTigerResult({
          provider: "yahoo",
          providerSymbol: "AAPL",
        }),
      ),
      fetchIntraday: vi.fn(),
    });

    const response = await GET(
      new Request(
        "http://localhost/api/market-data/daily?market=US&symbol=AAPL&start=2025-01-02&end=2025-01-03",
      ),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      provider: "yahoo",
      providerSymbol: "AAPL",
    });
  });

  it("returns a public fallback result instead of 502 when Tiger fails upstream", async () => {
    const GET = await loadRouteWithRouter({
      fetchDaily: vi.fn(async () =>
        dailyTigerResult({
          provider: "yahoo",
          providerSymbol: "AAPL",
        }),
      ),
      fetchIntraday: vi.fn(),
    });

    const response = await GET(
      new Request(
        "http://localhost/api/market-data/daily?market=US&symbol=AAPL&start=2025-01-02&end=2025-01-03",
      ),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      provider: "yahoo",
      candles: [{ tradingDate: "2025-01-02" }],
    });
  });
});
