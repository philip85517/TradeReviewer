import { describe, expect, it } from "vitest";

import {
  EastmoneyProvider,
  parseEastmoneyDaily,
  parseEastmoneyIntraday,
} from "./eastmoney";
import {
  parseTencentDaily,
  parseTencentIntraday,
  TencentProvider,
} from "./tencent";
import { parseYahooDaily, parseYahooIntraday } from "./yahoo";
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

  it("normalizes Tencent 15 minute K-line timestamps from the market time zone", () => {
    const response = {
      code: 0,
      data: {
        hk01810: {
          m15: [["2025-01-02 09:30:00", "34.1", "34.5", "35", "33.8", "1200"]],
        },
      },
    };

    expect(parseTencentIntraday(response, "hk01810", "Asia/Hong_Kong")).toEqual([
      {
        timestamp: "2025-01-02T01:30:00.000Z",
        open: "34.1",
        high: "35",
        low: "33.8",
        close: "34.5",
        volume: "1200",
      },
    ]);
  });

  it("normalizes Eastmoney 15 minute K-line timestamps from the market time zone", () => {
    const response = {
      data: {
        klines: ["2025-01-02 09:30:00,100,102,104,99,800"],
      },
    };

    expect(parseEastmoneyIntraday(response, "Asia/Shanghai")).toEqual([
      expect.objectContaining({
        timestamp: "2025-01-02T01:30:00.000Z",
        close: "102",
      }),
    ]);
  });

  it("normalizes Yahoo 15 minute timestamps that are already UTC", () => {
    const response = {
      chart: {
        result: [
          {
            timestamp: [1735828200],
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
            },
          },
        ],
        error: null,
      },
    };

    expect(parseYahooIntraday(response)).toEqual([
      expect.objectContaining({
        timestamp: "2025-01-02T14:30:00.000Z",
        close: "11",
      }),
    ]);
  });

  it("rejects null intraday OHLC values instead of yielding a partial candle", () => {
    const response = {
      chart: {
        result: [
          {
            timestamp: [1735828200],
            indicators: {
              quote: [
                {
                  open: [10],
                  high: [12],
                  low: [9],
                  close: [null],
                  volume: [100],
                },
              ],
            },
          },
        ],
        error: null,
      },
    };

    expect(() => parseYahooIntraday(response)).toThrow(
      "Yahoo 行情响应格式已变化",
    );
  });

  it("rejects changed intraday envelopes instead of yielding fake candles", () => {
    expect(() => parseEastmoneyIntraday({ data: {} }, "Asia/Shanghai")).toThrow(
      "东方财富行情响应格式已变化",
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

  it("falls back to Eastmoney for 15 minute A-share candles when Tencent is unavailable", async () => {
    const fetcher: typeof fetch = async (input) => {
      if (String(input).includes("gtimg")) {
        return new Response("unavailable", { status: 503 });
      }
      return Response.json({
        data: {
          klines: ["2025-01-02 09:30:00,100,102,104,99,800"],
        },
      });
    };

    const result = await createProviderRouter(fetcher).fetchIntraday({
      instrumentId: "CN-SH:600519",
      symbol: "600519",
      market: "CN-SH",
      interval: "15m",
      startTime: "2025-01-02T01:30:00.000Z",
      endTime: "2025-01-02T01:30:00.000Z",
    });

    expect(result).toMatchObject({
      provider: "eastmoney",
      providerSymbol: "1.600519",
      interval: "15m",
      candles: [
        {
          timestamp: "2025-01-02T01:30:00.000Z",
          close: "102",
        },
      ],
    });
  });

  it.each([
    {
      market: "US" as const,
      symbol: "XPEV",
      instrumentId: "US:XPEV",
      providerSymbol: "XPEV",
    },
    {
      market: "HK" as const,
      symbol: "1810",
      instrumentId: "HK:1810",
      providerSymbol: "1810.HK",
    },
  ])("falls back to Yahoo 15 minute candles for $market", async (request) => {
    const fetcher: typeof fetch = async (input) => {
      if (String(input).includes("gtimg")) {
        return new Response("unavailable", { status: 503 });
      }
      return Response.json({
        chart: {
          result: [
            {
              timestamp: [1735828200],
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
              },
            },
          ],
          error: null,
        },
      });
    };

    const result = await createProviderRouter(fetcher).fetchIntraday({
      ...request,
      interval: "15m",
      startTime: "2025-01-02T14:30:00.000Z",
      endTime: "2025-01-02T14:30:00.000Z",
    });

    expect(result).toMatchObject({
      provider: "yahoo",
      providerSymbol: request.providerSymbol,
      candles: [{ timestamp: "2025-01-02T14:30:00.000Z", close: "11" }],
    });
  });

  it("preserves history-limit semantics when every eligible 15 minute source lacks the range", async () => {
    const fetcher: typeof fetch = async (input) => {
      if (String(input).includes("gtimg")) {
        return Response.json({
          data: {
            "usXPEV.N": {
              m15: [["2020-01-02 09:30:00", "10", "11", "12", "9", "100"]],
            },
          },
        });
      }
      return Response.json({
        chart: {
          result: [
            {
              timestamp: [1577971800],
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
              },
            },
          ],
          error: null,
        },
      });
    };

    await expect(
      createProviderRouter(fetcher).fetchIntraday({
        instrumentId: "US:XPEV",
        symbol: "XPEV",
        market: "US",
        interval: "15m",
        startTime: "2025-01-02T14:30:00.000Z",
        endTime: "2025-01-02T14:30:00.000Z",
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<MarketDataProviderError>>({
        code: "provider-history-limit",
      }),
    );
  });
});

describe("intraday provider requests", () => {
  it("asks Tencent for HK market-open bounds in Hong Kong local time", async () => {
    let requestedUrl: URL | undefined;
    const fetcher: typeof fetch = async (input) => {
      requestedUrl = new URL(String(input));
      return Response.json({
        data: {
          hk01810: {
            m15: [
              ["2025-01-02 09:30:00", "34.1", "34.5", "35", "33.8", "1200"],
              ["2025-01-02 09:45:00", "34.5", "34.7", "35", "34", "900"],
            ],
          },
        },
      });
    };

    await new TencentProvider().fetchIntraday(
      {
        instrumentId: "HK:1810",
        symbol: "1810",
        market: "HK",
        interval: "15m",
        startTime: "2025-01-02T01:30:00.000Z",
        endTime: "2025-01-02T01:45:00.000Z",
      },
      fetcher,
    );

    expect(requestedUrl?.searchParams.get("param")).toBe(
      "hk01810,m15,2025-01-02 09:30:00,2025-01-02 09:45:00,500,",
    );
  });

  it("asks Eastmoney for local bounds across the Shanghai date boundary", async () => {
    let requestedUrl: URL | undefined;
    const fetcher: typeof fetch = async (input) => {
      requestedUrl = new URL(String(input));
      return Response.json({
        data: {
          klines: [
            "2025-01-03 00:00:00,100,102,104,99,800",
            "2025-01-03 00:15:00,102,103,105,101,600",
          ],
        },
      });
    };

    await new EastmoneyProvider().fetchIntraday(
      {
        instrumentId: "CN-SH:600519",
        symbol: "600519",
        market: "CN-SH",
        interval: "15m",
        startTime: "2025-01-02T16:00:00.000Z",
        endTime: "2025-01-02T16:15:00.000Z",
      },
      fetcher,
    );

    expect(requestedUrl?.searchParams.get("beg")).toBe("20250103000000");
    expect(requestedUrl?.searchParams.get("end")).toBe("20250103001500");
  });

  it.each([
    ["an empty price", "", "11", "12", "9", "100"],
    ["a nonnumeric close", "10", "invalid", "12", "9", "100"],
    ["a non-finite high", "10", "11", "Infinity", "9", "100"],
    ["an invalid OHLC range", "10", "11", "9", "12", "100"],
  ])(
    "rejects Tencent candles with %s as invalid responses",
    async (_case, open, close, high, low, volume) => {
      const fetcher: typeof fetch = async () =>
        Response.json({
          data: {
            hk01810: {
              m15: [["2025-01-02 09:30:00", open, close, high, low, volume]],
            },
          },
        });

      await expect(
        new TencentProvider().fetchIntraday(
          {
            instrumentId: "HK:1810",
            symbol: "1810",
            market: "HK",
            interval: "15m",
            startTime: "2025-01-02T01:30:00.000Z",
            endTime: "2025-01-02T01:30:00.000Z",
          },
          fetcher,
        ),
      ).rejects.toEqual(
        expect.objectContaining<Partial<MarketDataProviderError>>({
          code: "invalid-response",
        }),
      );
    },
  );

  it.each([
    ["a nonnumeric open", "invalid", "11", "12", "9", "100"],
    ["a non-finite volume", "10", "11", "12", "9", "Infinity"],
    ["an invalid OHLC range", "10", "11", "9", "12", "100"],
  ])(
    "rejects Eastmoney candles with %s as invalid responses",
    async (_case, open, close, high, low, volume) => {
      const fetcher: typeof fetch = async () =>
        Response.json({
          data: {
            klines: [
              `2025-01-02 09:30:00,${open},${close},${high},${low},${volume}`,
            ],
          },
        });

      await expect(
        new EastmoneyProvider().fetchIntraday(
          {
            instrumentId: "CN-SH:600519",
            symbol: "600519",
            market: "CN-SH",
            interval: "15m",
            startTime: "2025-01-02T01:30:00.000Z",
            endTime: "2025-01-02T01:30:00.000Z",
          },
          fetcher,
        ),
      ).rejects.toEqual(
        expect.objectContaining<Partial<MarketDataProviderError>>({
          code: "invalid-response",
        }),
      );
    },
  );
});
