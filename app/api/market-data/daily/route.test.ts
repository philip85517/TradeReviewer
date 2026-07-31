import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GET /api/market-data/daily", () => {
  it("rejects unsupported markets before contacting a provider", async () => {
    const providerFetch = vi.fn();
    vi.stubGlobal("fetch", providerFetch);

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
});
