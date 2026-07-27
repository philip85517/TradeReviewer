import { describe, expect, it } from "vitest";

import { parseEastmoneyDaily } from "./eastmoney";
import { parseTencentDaily } from "./tencent";
import { parseYahooDaily } from "./yahoo";
import { createProviderRouter } from "./router";
import { MarketDataProviderError } from "./errors";

describe("provider response parsers", () => {
  it("parses Tencent [date, open, close, high, low, volume] rows", () => {
    const response = {
      code: 0,
      data: {
        hk01810: {
          day: [["2025-01-02", "34.1", "34.5", "35", "33.8", "1200"]],
        },
      },
    };

    expect(parseTencentDaily(response, "hk01810")).toEqual([
      {
        tradingDate: "2025-01-02",
        open: "34.1",
        high: "35",
        low: "33.8",
        close: "34.5",
        volume: "1200",
      },
    ]);
  });

  it("parses Eastmoney comma-delimited klines", () => {
    const response = {
      data: {
        klines: ["2025-01-02,100,102,104,99,800"],
      },
    };

    expect(parseEastmoneyDaily(response)).toEqual([
      {
        tradingDate: "2025-01-02",
        open: "100",
        high: "104",
        low: "99",
        close: "102",
        volume: "800",
      },
    ]);
  });

  it("parses Yahoo timestamps and parallel quote arrays", () => {
    const response = {
      chart: {
        result: [
          {
            timestamp: [1735776000],
            indicators: {
              quote: [
                {
                  open: [10],
                  high: [12],
                  low: [9],
                  close: [11],
                  volume: [100],
                },
              ],
              adjclose: [{ adjclose: [10.5] }],
            },
          },
        ],
        error: null,
      },
    };

    expect(parseYahooDaily(response)).toEqual([
      {
        tradingDate: "2025-01-02",
        open: "10",
        high: "12",
        low: "9",
        close: "11",
        volume: "100",
        adjustedClose: "10.5",
      },
    ]);
  });

  it("rejects a changed provider response instead of returning fake data", () => {
    expect(() => parseTencentDaily({ data: {} }, "hk01810")).toThrow(
      "腾讯行情响应格式已变化",
    );
  });
});

describe("provider routing", () => {
  it("uses the first Tencent US symbol candidate that returns candles", async () => {
    const requested: string[] = [];
    const fetcher: typeof fetch = async (input) => {
      const url = String(input);
      requested.push(url);
      const providerSymbol = url.includes("usXPEV.OQ")
        ? "usXPEV.OQ"
        : "usXPEV.N";
      return Response.json({
        data: {
          [providerSymbol]: {
            day:
              providerSymbol === "usXPEV.OQ"
                ? [["2025-01-02", "10", "11", "12", "9", "100"]]
                : [],
          },
        },
      });
    };

    const result = await createProviderRouter(fetcher).fetchDaily({
      instrumentId: "US:XPEV",
      symbol: "XPEV",
      market: "US",
      startDate: "2025-01-01",
      endDate: "2025-01-31",
    });

    expect(result.provider).toBe("tencent");
    expect(result.providerSymbol).toBe("usXPEV.OQ");
    expect(result.candles).toHaveLength(1);
    expect(requested).toHaveLength(2);
  });

  it("falls back to Eastmoney when Tencent is unavailable for A shares", async () => {
    const fetcher: typeof fetch = async (input) => {
      const url = String(input);
      if (url.includes("gtimg")) {
        return new Response("limited", { status: 429 });
      }
      return Response.json({
        data: { klines: ["2025-01-02,100,102,104,99,800"] },
      });
    };

    const result = await createProviderRouter(fetcher).fetchDaily({
      instrumentId: "CN-SH:600519",
      symbol: "600519",
      market: "CN-SH",
      startDate: "2025-01-01",
      endDate: "2025-01-31",
    });

    expect(result.provider).toBe("eastmoney");
    expect(result.providerSymbol).toBe("1.600519");
  });

  it("preserves rate-limit semantics when every eligible source is throttled", async () => {
    const fetcher: typeof fetch = async () =>
      new Response("limited", { status: 429 });

    await expect(
      createProviderRouter(fetcher).fetchDaily({
        instrumentId: "US:XPEV",
        symbol: "XPEV",
        market: "US",
        startDate: "2025-01-01",
        endDate: "2025-01-31",
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<MarketDataProviderError>>({
        code: "source-rate-limited",
      }),
    );
  });
});
