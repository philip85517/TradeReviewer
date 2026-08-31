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
import {
  parseYahooDaily,
  parseYahooIntraday,
  YahooProvider,
} from "./yahoo";
import { parseSinaUsIntraday, SinaUsProvider } from "./sina-us";
import { parseBaiduDaily, parseBaiduIntraday, BaiduProvider } from "./baidu";
import { createProviderRouter } from "./router";
import { MarketDataProviderError } from "./errors";
import { TigerProvider } from "./tiger";

const BAIDU_INTRADAY_KEYS = [
  "timestamp",
  "time",
  "open",
  "close",
  "volume",
  "high",
  "low",
  "amount",
  "range",
  "ratio",
  "turnoverratio",
  "preClose",
];

function baiduIntradayResponse(rows: string[]) {
  return {
    ResultCode: 0,
    Result: {
      newMarketData: {
        headers: BAIDU_INTRADAY_KEYS,
        keys: BAIDU_INTRADAY_KEYS,
        marketData: rows.join(";"),
      },
    },
  };
}

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

  it("normalizes Sina US hourly rows from New York local time", () => {
    expect(parseSinaUsIntraday([
      {
        d: "2026-02-20 10:30:00",
        o: "397.00",
        h: "398.50",
        l: "396.50",
        c: "398.00",
        v: "1200",
      },
      {
        d: "2026-02-20 16:00:00",
        o: "399.00",
        h: "400.50",
        l: "398.50",
        c: "400.00",
        v: "900",
      },
    ])).toEqual([
      {
        timestamp: "2026-02-20T14:30:00.000Z",
        open: "397.00",
        high: "398.50",
        low: "396.50",
        close: "398.00",
        volume: "1200",
      },
      {
        timestamp: "2026-02-20T20:30:00.000Z",
        open: "399.00",
        high: "400.50",
        low: "398.50",
        close: "400.00",
        volume: "900",
      },
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

  it("normalizes Baidu 15 minute endpoint timestamps and aggregates them into one hour", () => {
    const response = baiduIntradayResponse([
      "1735782300,2025-01-02 09:45:00,10,10.5,100,11,9.5,1000,0.5,5,0,9.5",
      "1735783200,2025-01-02 10:00:00,10.5,11,200,11.2,10.2,2200,0.5,4.76,0,10.5",
      "1735784100,2025-01-02 10:15:00,11,11.5,300,11.8,10.8,3300,0.5,4.55,0,11",
      "1735785000,2025-01-02 10:30:00,11.5,11.2,400,11.8,11,4480,-0.3,-2.61,0,11.5",
    ]);

    expect(parseBaiduIntraday(response, "HK")).toEqual([
      {
        timestamp: "2025-01-02T01:30:00.000Z",
        knowledgeAt: "2025-01-02T02:30:00.000Z",
        open: "10",
        high: "11.8",
        low: "9.5",
        close: "11.2",
        volume: "1000",
      },
    ]);
  });

  it("treats Baidu zero-volume bars as valid candles", () => {
    const response = baiduIntradayResponse([
      "1735782300,2025-01-02 09:45:00,10,10.5,--,11,9.5,--,0,0,0,9.5",
      "1735783200,2025-01-02 10:00:00,10.5,11,200,11.2,10.2,2200,0.5,4.76,0,10.5",
      "1735784100,2025-01-02 10:15:00,11,11.5,300,11.8,10.8,3300,0.5,4.55,0,11",
      "1735785000,2025-01-02 10:30:00,11.5,11.2,400,11.8,11,4480,-0.3,-2.61,0,11.5",
    ]);

    expect(parseBaiduIntraday(response, "HK")).toEqual([
      expect.objectContaining({
        timestamp: "2025-01-02T01:30:00.000Z",
        volume: "900",
      }),
    ]);
  });

  it("parses Baidu daily rows", () => {
    const response = baiduIntradayResponse([
      "1787846400,2026-08-28,317,300.4,11182735,329.6,297.2,3517503596,0,0,0,314.6",
    ]);

    expect(parseBaiduDaily(response)).toEqual([
      {
        tradingDate: "2026-08-28",
        open: "317",
        high: "329.6",
        low: "297.2",
        close: "300.4",
        volume: "11182735",
      },
    ]);
  });
});

describe("provider routing", () => {
  it("tries Tencent before other public sources for HK hourly history", async () => {
    const hosts: string[] = [];
    await expect(
      createProviderRouter(async (input) => {
        hosts.push(new URL(String(input)).host);
        return new Response("unavailable", { status: 503 });
      }).fetchIntraday({
        instrumentId: "HK:7500",
        symbol: "7500",
        market: "HK",
        interval: "1h",
        startTime: "2022-01-04T01:30:00.000Z",
        endTime: "2022-01-04T07:00:00.000Z",
      }),
    ).rejects.toMatchObject({ code: "source-unavailable" });

    expect(hosts[0]).toBe("web.ifzq.gtimg.cn");
  });

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

  it("reports an unavailable fallback source instead of masking it as forbidden", async () => {
    const fetcher: typeof fetch = async (input) => {
      const url = String(input);
      if (url.includes("gtimg")) return Response.json({ data: {} });
      if (url.includes("eastmoney")) throw new TypeError("fetch failed");
      return new Response("blocked", { status: 403 });
    };

    await expect(
      createProviderRouter(fetcher).fetchIntraday({
        instrumentId: "HK:1810",
        symbol: "1810",
        market: "HK",
        interval: "15m",
        startTime: "2025-01-02T01:30:00.000Z",
        endTime: "2025-01-02T01:30:00.000Z",
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<MarketDataProviderError>>({
        code: "source-unavailable",
      }),
    );
  });

  it("uses a public Eastmoney source before Yahoo for hourly candles", async () => {
    const hosts: string[] = [];
    const result = await createProviderRouter(async (input) => {
      const url = new URL(String(input));
      hosts.push(url.host);
      return Response.json({
        data: {
          code: "01810",
          klines: [
            "2025-01-02 09:30:00,34.1,34.5,35,33.8,1200",
          ],
        },
      });
    }).fetchIntraday({
      instrumentId: "HK:1810",
      symbol: "1810",
      market: "HK",
      interval: "1h",
      startTime: "2025-01-02T01:30:00.000Z",
      endTime: "2025-01-02T01:30:00.000Z",
    });

    expect(hosts).toEqual([
      "web.ifzq.gtimg.cn",
      "33.push2his.eastmoney.com",
    ]);
    expect(result).toMatchObject({
      provider: "eastmoney",
      interval: "1h",
      candles: [expect.objectContaining({ close: "34.5" })],
    });
  });

  it("falls back to Baidu for HK hourly candles when legacy sources lack history", async () => {
    const hosts: string[] = [];
    const result = await createProviderRouter(async (input) => {
      const url = new URL(String(input));
      hosts.push(url.host);
      if (url.host.includes("eastmoney.com")) {
        return Response.json({
          data: {
            code: "01810",
            klines: ["2026-08-28 09:30:00,100,101,102,99,100"],
          },
        });
      }
      if (url.host === "query1.finance.yahoo.com" || url.host === "query2.finance.yahoo.com") {
        return new Response("blocked", { status: 403 });
      }
      return Response.json(baiduIntradayResponse([
        "1767923100,2026-01-09 09:45:00,235,250,100,260,230,1000,15,6.38,0,220",
        "1767924000,2026-01-09 10:00:00,250,260,200,270,245,2200,10,4,0,250",
        "1767924900,2026-01-09 10:15:00,260,270,300,280,255,3300,10,3.85,0,260",
        "1767925800,2026-01-09 10:30:00,270,265,400,275,260,4240,-5,-1.85,0,270",
      ]));
    }).fetchIntraday({
      instrumentId: "HK:100",
      symbol: "100",
      market: "HK",
      interval: "1h",
      startTime: "2026-01-09T01:30:00.000Z",
      endTime: "2026-01-09T02:30:00.000Z",
    });

    expect(hosts).toEqual([
      "web.ifzq.gtimg.cn",
      "33.push2his.eastmoney.com",
      "query1.finance.yahoo.com",
      "query2.finance.yahoo.com",
      "sp0.baidu.com",
    ]);
    expect(result).toMatchObject({
      provider: "baidu",
      providerSymbol: "00100",
      interval: "1h",
      candles: [expect.objectContaining({
        timestamp: "2026-01-09T01:30:00.000Z",
        close: "265",
        volume: "1000",
      })],
    });
  });

  it("falls back to Sina for US hourly candles outside Eastmoney history", async () => {
    const hosts: string[] = [];
    const result = await createProviderRouter(async (input) => {
      const url = new URL(String(input));
      hosts.push(url.host);
      if (url.host.includes("eastmoney.com")) {
        return Response.json({
          data: {
            code: "MSFT",
            klines: ["2026-08-28 10:30:00,500,501,502,499,100"],
          },
        });
      }
      if (url.host === "stock.finance.sina.com.cn") {
        return Response.json([
          {
            d: "2026-02-20 10:30:00",
            o: "397.00",
            h: "398.50",
            l: "396.50",
            c: "398.00",
            v: "1200",
          },
        ]);
      }
      throw new Error("Yahoo should not be requested");
    }).fetchIntraday({
      instrumentId: "US:MSFT",
      symbol: "MSFT",
      market: "US",
      interval: "1h",
      startTime: "2026-02-20T14:30:00.000Z",
      endTime: "2026-02-20T14:30:00.000Z",
    });

    expect(hosts).toEqual([
      "web.ifzq.gtimg.cn",
      "63.push2his.eastmoney.com",
      "stock.finance.sina.com.cn",
    ]);
    expect(result).toMatchObject({
      provider: "sina",
      providerSymbol: "MSFT",
      interval: "1h",
      candles: [expect.objectContaining({ close: "398.00" })],
    });
  });

  it("falls through a sparse hourly provider response before accepting the last source", async () => {
    const hosts: string[] = [];
    const result = await createProviderRouter(async (input) => {
      const url = new URL(String(input));
      hosts.push(url.host);
      if (url.host.includes("eastmoney.com")) {
        return Response.json({
          data: {
            code: "TSLA",
            klines: ["2026-02-20 09:30:00,100,101,102,99,100"],
          },
        });
      }
      if (url.host === "stock.finance.sina.com.cn") {
        return Response.json([
          {
            d: "2026-02-20 10:30:00",
            o: "100",
            h: "101",
            l: "99",
            c: "100.5",
            v: "100",
          },
        ]);
      }
      if (url.host === "query1.finance.yahoo.com" || url.host === "query2.finance.yahoo.com") {
        return new Response("blocked", { status: 403 });
      }
      const sourceStart = Math.floor(Date.parse("2026-02-20T14:45:00.000Z") / 1000);
      return Response.json(baiduIntradayResponse([
        `${sourceStart},2026-02-20 09:45:00,100,101,100,102,99,100,1,1,0,99`,
        `${sourceStart + 900},2026-02-20 10:00:00,101,102,100,103,100,100,1,1,0,100`,
        `${sourceStart + 1800},2026-02-20 10:15:00,102,103,101,104,101,100,1,1,0,101`,
        `${sourceStart + 2700},2026-02-20 10:30:00,103,102,102,104,101,100,-1,-1,0,102`,
      ]));
    }).fetchIntraday({
      instrumentId: "US:TSLA",
      symbol: "TSLA",
      market: "US",
      interval: "1h",
      startTime: "2026-02-20T14:30:00.000Z",
      endTime: "2026-02-27T21:00:00.000Z",
    });

    expect(hosts).toEqual([
      "web.ifzq.gtimg.cn",
      "63.push2his.eastmoney.com",
      "stock.finance.sina.com.cn",
      "query1.finance.yahoo.com",
      "query2.finance.yahoo.com",
      "sp0.baidu.com",
    ]);
    expect(result).toMatchObject({
      provider: "baidu",
      providerSymbol: "TSLA",
      interval: "1h",
      candles: [expect.objectContaining({ close: "102" })],
    });
  });

  it("tries Tiger before public providers for US daily when configured", async () => {
    const calls: string[] = [];
    const tiger = new TigerProvider(
      { configPath: "/tmp/tiger.properties" },
      async (request) => {
        calls.push(`tiger:${request.period}`);
        return [{
          symbol: request.symbol,
          time: Date.parse("2025-01-02T14:30:00.000Z"),
          open: 100,
          high: 102,
          low: 99,
          close: 101,
          volume: 800,
        }];
      },
    );

    const result = await createProviderRouter(fetch, {
      tigerConfig: { configPath: "/tmp/tiger.properties" },
      tigerProvider: tiger,
    }).fetchDaily({
      instrumentId: "US:AAPL",
      symbol: "AAPL",
      market: "US",
      startDate: "2025-01-01",
      endDate: "2025-01-03",
    });

    expect(calls).toEqual(["tiger:day"]);
    expect(result.provider).toBe("tiger");
  });

  it("tries Tiger before public providers for HK hourly when configured", async () => {
    const calls: string[] = [];
    const tiger = new TigerProvider(
      { configPath: "/tmp/tiger.properties" },
      async (request) => {
        calls.push(`tiger:${request.period}`);
        return [{
          symbol: request.symbol,
          time: Date.parse("2025-01-02T01:30:00.000Z"),
          open: 34.1,
          high: 35,
          low: 33.8,
          close: 34.5,
          volume: 1200,
        }];
      },
    );

    const result = await createProviderRouter(fetch, {
      tigerConfig: { configPath: "/tmp/tiger.properties" },
      tigerProvider: tiger,
    }).fetchIntraday({
      instrumentId: "HK:1810",
      symbol: "1810",
      market: "HK",
      interval: "1h",
      startTime: "2025-01-02T01:30:00.000Z",
      endTime: "2025-01-02T01:30:00.000Z",
    });

    expect(calls).toEqual(["tiger:60min"]);
    expect(result.provider).toBe("tiger");
  });

  it("falls back to public providers after a Tiger error", async () => {
    const hosts: string[] = [];
    const tiger = new TigerProvider(
      { configPath: "/tmp/tiger.properties" },
      async () => {
        throw new MarketDataProviderError("source-unavailable", "Tiger unavailable");
      },
    );

    const result = await createProviderRouter(async (input) => {
      hosts.push(new URL(String(input)).host);
      return Response.json({
        chart: {
          result: [
            {
              meta: { symbol: "AAPL" },
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
    }, {
      tigerConfig: { configPath: "/tmp/tiger.properties" },
      tigerProvider: tiger,
    }).fetchDaily({
      instrumentId: "US:AAPL",
      symbol: "AAPL",
      market: "US",
      startDate: "2025-01-01",
      endDate: "2025-01-03",
    });

    expect(hosts[0]).toBe("web.ifzq.gtimg.cn");
    expect(result.provider).toBe("yahoo");
  });

  it("never calls Tiger for CN requests even when configured", async () => {
    const calls: string[] = [];
    const tiger = new TigerProvider(
      { configPath: "/tmp/tiger.properties" },
      async (request) => {
        calls.push(request.symbol);
        return [];
      },
    );

    await createProviderRouter(async (input) => {
      if (String(input).includes("gtimg")) {
        return new Response("limited", { status: 429 });
      }
      return Response.json({
        data: { klines: ["2025-01-02,100,102,104,99,800"] },
      });
    }, {
      tigerConfig: { configPath: "/tmp/tiger.properties" },
      tigerProvider: tiger,
    }).fetchDaily({
      instrumentId: "CN-SH:600519",
      symbol: "600519",
      market: "CN-SH",
      startDate: "2025-01-01",
      endDate: "2025-01-03",
    });

    expect(calls).toEqual([]);
  });

  it("falls through a sparse Tiger hourly result to a fuller public provider", async () => {
    const tiger = new TigerProvider(
      { configPath: "/tmp/tiger.properties" },
      async (request) => [{
        symbol: request.symbol,
        time: Date.parse("2026-02-20T14:30:00.000Z"),
        open: 100,
        high: 101,
        low: 99,
        close: 100.5,
        volume: 100,
      }],
    );
    const hosts: string[] = [];

    const result = await createProviderRouter(async (input) => {
      const url = new URL(String(input));
      hosts.push(url.host);
      if (url.host.includes("gtimg")) {
        return Response.json({ data: {} });
      }
      if (url.host.includes("eastmoney.com")) {
        return Response.json({
          data: {
            code: "TSLA",
            klines: ["2026-02-20 09:30:00,100,101,102,99,100"],
          },
        });
      }
      if (url.host === "stock.finance.sina.com.cn") {
        return Response.json([
          {
            d: "2026-02-20 10:30:00",
            o: "100",
            h: "101",
            l: "99",
            c: "100.5",
            v: "100",
          },
          {
            d: "2026-02-20 11:30:00",
            o: "100.5",
            h: "102",
            l: "100",
            c: "101.5",
            v: "120",
          },
        ]);
      }
      throw new Error("unexpected provider");
    }, {
      tigerConfig: { configPath: "/tmp/tiger.properties" },
      tigerProvider: tiger,
    }).fetchIntraday({
      instrumentId: "US:TSLA",
      symbol: "TSLA",
      market: "US",
      interval: "1h",
      startTime: "2026-02-20T14:30:00.000Z",
      endTime: "2026-02-27T21:00:00.000Z",
    });

    expect(hosts).toContain("stock.finance.sina.com.cn");
    expect(result.provider).toBe("sina");
    expect(result.candles.length).toBeGreaterThan(1);
  });

  it("uses Tencent native hourly candles for mainland stocks before Eastmoney", async () => {
    const hosts: string[] = [];
    const result = await createProviderRouter(async (input) => {
      const url = new URL(String(input));
      hosts.push(url.host);
      return Response.json({
        code: 0,
        data: {
          sh600519: {
            m60: [["202501020930", "1700", "1705", "1710", "1690", "100"]],
          },
        },
      });
    }).fetchIntraday({
      instrumentId: "CN-SH:600519",
      symbol: "600519",
      market: "CN-SH",
      interval: "1h",
      startTime: "2025-01-02T01:30:00.000Z",
      endTime: "2025-01-02T01:30:00.000Z",
    });

    expect(hosts).toEqual(["web.ifzq.gtimg.cn"]);
    expect(result).toMatchObject({
      provider: "tencent",
      interval: "1h",
      candles: [expect.objectContaining({ close: "1705" })],
    });
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
      market: "HK" as const,
      symbol: "1810",
      instrumentId: "HK:1810",
      providerSymbol: "116.01810",
      timeZone: "Asia/Hong_Kong",
    },
    {
      market: "US" as const,
      symbol: "MSFT",
      instrumentId: "US:MSFT",
      providerSymbol: "105.MSFT",
      timeZone: "America/New_York",
    },
  ])("uses Eastmoney for $market 15 minute candles", async (request) => {
    const fetcher: typeof fetch = async (input) => {
      if (String(input).includes("gtimg")) {
        return Response.json({ data: {} });
      }
      return Response.json({
        data: {
          code: request.providerSymbol.split(".").at(-1),
          klines: [
            request.market === "US"
              ? "2025-01-02 09:30:00,100,102,104,99,800"
              : "2025-01-02 09:30:00,100,102,104,99,800",
          ],
        },
      });
    };

    const result = await createProviderRouter(fetcher).fetchIntraday({
      instrumentId: request.instrumentId,
      symbol: request.symbol,
      market: request.market,
      interval: "15m",
      startTime: request.market === "US"
        ? "2025-01-02T14:30:00.000Z"
        : "2025-01-02T01:30:00.000Z",
      endTime: request.market === "US"
        ? "2025-01-02T14:30:00.000Z"
        : "2025-01-02T01:30:00.000Z",
    });

    expect(result).toMatchObject({
      provider: "eastmoney",
      providerSymbol: request.providerSymbol,
      candles: [
        expect.objectContaining({
          timestamp: request.market === "US"
            ? "2025-01-02T14:30:00.000Z"
            : "2025-01-02T01:30:00.000Z",
        }),
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
  it("requests Baidu 15 minute data and returns session-aligned hourly candles", async () => {
    let requestedUrl: URL | undefined;
    const result = await new BaiduProvider().fetchIntraday(
      {
        instrumentId: "HK:100",
        symbol: "100",
        market: "HK",
        interval: "1h",
        startTime: "2025-01-02T01:30:00.000Z",
        endTime: "2025-01-02T02:30:00.000Z",
      },
      async (input) => {
        requestedUrl = new URL(String(input));
        return Response.json(baiduIntradayResponse([
          "1735782300,2025-01-02 09:45:00,10,10.5,100,11,9.5,1000,0.5,5,0,9.5",
          "1735783200,2025-01-02 10:00:00,10.5,11,200,11.2,10.2,2200,0.5,4.76,0,10.5",
          "1735784100,2025-01-02 10:15:00,11,11.5,300,11.8,10.8,3300,0.5,4.55,0,11",
          "1735785000,2025-01-02 10:30:00,11.5,11.2,400,11.8,11,4480,-0.3,-2.61,0,11.5",
        ]));
      },
    );

    expect(requestedUrl?.host).toBe("sp0.baidu.com");
    expect(requestedUrl?.pathname).toContain("finance.pae.baidu.com/vapi/v1/getquotation");
    expect(requestedUrl?.searchParams.get("group")).toBe("quotation_kline_hk");
    expect(requestedUrl?.searchParams.get("market_type")).toBe("hk");
    expect(requestedUrl?.searchParams.get("code")).toBe("00100");
    expect(requestedUrl?.searchParams.get("query")).toBe("00100");
    expect(requestedUrl?.searchParams.get("ktype")).toBe("min15");
    expect(requestedUrl?.searchParams.get("count")).toBe("1000");
    expect(requestedUrl?.searchParams.get("end_time")).toBe("2025-01-02 10:45:00");
    expect(result).toMatchObject({
      provider: "baidu",
      providerSymbol: "00100",
      interval: "1h",
      candles: [expect.objectContaining({
        timestamp: "2025-01-02T01:30:00.000Z",
        close: "11.2",
      })],
    });
  });

  it("requests public native hourly candles from Sina for US stocks", async () => {
    let requestedUrl: URL | undefined;
    const result = await new SinaUsProvider().fetchIntraday(
      {
        instrumentId: "US:MSFT",
        symbol: "MSFT",
        market: "US",
        interval: "1h",
        startTime: "2026-02-20T14:30:00.000Z",
        endTime: "2026-02-20T14:30:00.000Z",
      },
      async (input) => {
        requestedUrl = new URL(String(input));
        return Response.json([
          {
            d: "2026-02-20 10:30:00",
            o: "397.00",
            h: "398.50",
            l: "396.50",
            c: "398.00",
            v: "1200",
          },
        ]);
      },
    );

    expect(requestedUrl?.host).toBe("stock.finance.sina.com.cn");
    expect(requestedUrl?.searchParams.get("symbol")).toBe("MSFT");
    expect(requestedUrl?.searchParams.get("type")).toBe("60");
    expect(result).toMatchObject({
      provider: "sina",
      interval: "1h",
      candles: [{ timestamp: "2026-02-20T14:30:00.000Z", close: "398.00" }],
    });
  });

  it("asks Yahoo for native hourly candles and maps mainland symbols", async () => {
    let requestedUrl: URL | undefined;
    const fetcher: typeof fetch = async (input) => {
      requestedUrl = new URL(String(input));
      return Response.json({
        chart: {
          result: [
            {
              meta: { symbol: "600519.SS" },
              timestamp: [1735781400],
              indicators: {
                quote: [
                  {
                    open: [1_700],
                    high: [1_710],
                    low: [1_690],
                    close: [1_705],
                    volume: [100_000],
                  },
                ],
              },
            },
          ],
          error: null,
        },
      });
    };

    const result = await new YahooProvider().fetchIntraday(
      {
        instrumentId: "CN-SH:600519",
        symbol: "600519",
        market: "CN-SH",
        interval: "1h" as never,
        startTime: "2025-01-02T01:00:00.000Z",
        endTime: "2025-01-02T02:00:00.000Z",
      },
      fetcher,
    );

    expect(requestedUrl?.pathname).toContain("600519.SS");
    expect(requestedUrl?.searchParams.get("interval")).toBe("1h");
    expect(result).toMatchObject({
      provider: "yahoo",
      providerSymbol: "600519.SS",
      interval: "1h",
      candles: [{ close: "1705" }],
    });
  });

  it("falls back to Yahoo's second public chart host after rate limiting", async () => {
    const hosts: string[] = [];
    const fetcher: typeof fetch = async (input) => {
      const url = new URL(String(input));
      hosts.push(url.host);
      if (hosts.length === 1) {
        return Response.json({}, { status: 429 });
      }
      return Response.json({
        chart: {
          result: [
            {
              meta: { symbol: "AAPL" },
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

    const result = await new YahooProvider().fetchIntraday(
      {
        instrumentId: "US:AAPL",
        symbol: "AAPL",
        market: "US",
        interval: "1h",
        startTime: "2025-01-02T14:30:00.000Z",
        endTime: "2025-01-02T14:30:00.000Z",
      },
      fetcher,
    );

    expect(hosts).toEqual([
      "query1.finance.yahoo.com",
      "query2.finance.yahoo.com",
    ]);
    expect(result.provider).toBe("yahoo");
  });

  it("classifies an empty Yahoo chart result as no-data", async () => {
    await expect(
      new YahooProvider().fetchIntraday(
        {
          instrumentId: "US:UNKNOWN",
          symbol: "UNKNOWN",
          market: "US",
          interval: "1h",
          startTime: "2025-01-02T14:30:00.000Z",
          endTime: "2025-01-02T14:30:00.000Z",
        },
        async () =>
          Response.json({
            chart: {
              result: null,
              error: {
                code: "Not Found",
                description: "No data found",
              },
            },
          }),
      ),
    ).rejects.toMatchObject({ code: "no-data" });
  });

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

  it("requests native hourly candles from Eastmoney for HK stocks", async () => {
    let requestedUrl: URL | undefined;
    const result = await new EastmoneyProvider().fetchIntraday(
      {
        instrumentId: "HK:1810",
        symbol: "1810",
        market: "HK",
        interval: "1h",
        startTime: "2025-01-02T01:30:00.000Z",
        endTime: "2025-01-02T02:30:00.000Z",
      },
      async (input) => {
        requestedUrl = new URL(String(input));
        return Response.json({
          data: {
            code: "01810",
            klines: [
              "2025-01-02 09:30:00,34.1,34.5,35,33.8,1200",
              "2025-01-02 10:30:00,34.5,34.7,35,34,900",
            ],
          },
        });
      },
    );

    expect(requestedUrl?.host).toBe("33.push2his.eastmoney.com");
    expect(requestedUrl?.searchParams.get("klt")).toBe("60");
    expect(requestedUrl?.searchParams.get("secid")).toBe("116.01810");
    expect(requestedUrl?.searchParams.get("beg")).toBe("0");
    expect(requestedUrl?.searchParams.get("end")).toBe("20500000");
    expect(requestedUrl?.searchParams.get("lmt")).toBe("1000");
    expect(result).toMatchObject({
      provider: "eastmoney",
      providerSymbol: "116.01810",
      interval: "1h",
    });
    expect(result.candles).toHaveLength(2);
    expect(result.candles[0]).toMatchObject({
      timestamp: "2025-01-02T01:30:00.000Z",
      close: "34.5",
    });
  });

  it("requests Tencent native m60 candles for mainland stocks", async () => {
    let requestedUrl: URL | undefined;
    const result = await new TencentProvider().fetchIntraday(
      {
        instrumentId: "CN-SH:600519",
        symbol: "600519",
        market: "CN-SH",
        interval: "1h",
        startTime: "2025-01-02T01:30:00.000Z",
        endTime: "2025-01-02T01:30:00.000Z",
      },
      async (input) => {
        requestedUrl = new URL(String(input));
        return Response.json({
          code: 0,
          data: {
            sh600519: {
              m60: [["202501020930", "1700", "1705", "1710", "1690", "100"]],
            },
          },
        });
      },
    );

    expect(requestedUrl?.pathname).toBe("/appstock/app/fqkline/get");
    expect(requestedUrl?.searchParams.get("param")).toBe(
      "sh600519,m60,2025-01-02 09:30:00,2025-01-02 09:30:00,500,",
    );
    expect(result).toMatchObject({
      provider: "tencent",
      providerSymbol: "sh600519",
      interval: "1h",
      candles: [expect.objectContaining({ close: "1705" })],
    });
  });

  it("marks a Tencent 500-row intraday response as truncated", async () => {
    const rows = Array.from({ length: 500 }, (_, index) => {
      const timestamp = new Date(
        Date.UTC(2025, 0, 1, 0, index * 15),
      );
      const local = timestamp.toISOString().replace("T", " ").slice(0, 19);
      return [local, "10", "11", "12", "9", "100"];
    });
    const result = await new TencentProvider().fetchIntraday(
      {
        instrumentId: "HK:1810",
        symbol: "1810",
        market: "HK",
        interval: "15m",
        startTime: "2024-12-31T16:00:00.000Z",
        endTime: "2025-01-05T20:45:00.000Z",
      },
      async () =>
        Response.json({
          data: { hk01810: { m15: rows } },
        }),
    );

    expect(result.candles).toHaveLength(500);
    expect(result.warnings).toContain("provider-history-limit");
  });

  it("rejects an Eastmoney response carrying a different instrument code", async () => {
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
        async () =>
          Response.json({
            data: {
              code: "000001",
              klines: ["2025-01-02 09:30:00,100,102,104,99,800"],
            },
          }),
      ),
    ).rejects.toMatchObject({ code: "invalid-response" });
  });

  it("rejects a Yahoo response carrying a different provider symbol", async () => {
    await expect(
      new YahooProvider().fetchIntraday(
        {
          instrumentId: "US:XPEV",
          symbol: "XPEV",
          market: "US",
          interval: "15m",
          startTime: "2025-01-02T14:30:00.000Z",
          endTime: "2025-01-02T14:30:00.000Z",
        },
        async () =>
          Response.json({
            chart: {
              result: [
                {
                  meta: { symbol: "TSLA" },
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
            },
          }),
      ),
    ).rejects.toMatchObject({ code: "invalid-response" });
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

describe("daily provider requests", () => {
  it("requests Baidu daily data for HK symbols", async () => {
    let requestedUrl: URL | undefined;
    const result = await new BaiduProvider().fetchDaily(
      {
        instrumentId: "HK:100",
        symbol: "100",
        market: "HK",
        startDate: "2026-08-28",
        endDate: "2026-08-28",
      },
      async (input) => {
        requestedUrl = new URL(String(input));
        return Response.json(baiduIntradayResponse([
          "1787846400,2026-08-28,317,300.4,11182735,329.6,297.2,3517503596,0,0,0,314.6",
        ]));
      },
    );

    expect(requestedUrl?.host).toBe("sp0.baidu.com");
    expect(requestedUrl?.searchParams.get("group")).toBe("quotation_kline_hk");
    expect(requestedUrl?.searchParams.get("ktype")).toBe("day");
    expect(requestedUrl?.searchParams.get("code")).toBe("00100");
    expect(result).toMatchObject({
      provider: "baidu",
      providerSymbol: "00100",
      candles: [expect.objectContaining({ tradingDate: "2026-08-28" })],
    });
  });
});
