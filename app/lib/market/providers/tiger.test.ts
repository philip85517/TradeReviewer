import { describe, expect, it } from "vitest";

import { MarketDataProviderError } from "./errors";
import {
  parseTigerBars,
  TigerProvider,
  type TigerRunBars,
} from "./tiger";

describe("Tiger provider", () => {
  it("includes the requested final session when Tiger excludes its end date", async () => {
    const provider = new TigerProvider({ configPath: "/tmp/tiger.properties" }, async request =>
      ["2026-09-04", "2026-09-05"].filter(date => date < request.endTime).map(date => ({
        symbol: request.symbol, time: Date.parse(`${date}T04:00:00Z`),
        open: 100, high: 102, low: 99, close: 101, volume: 800,
      })));
    const result = await provider.fetchDaily({ instrumentId: "US:CWEB", symbol: "CWEB",
      market: "US", startDate: "2026-09-04", endDate: "2026-09-04" });
    expect(result.candles.map(candle => candle.tradingDate)).toEqual(["2026-09-04"]);
  });
  it("passes the detected config path to the Tiger runner", async () => {
    let receivedConfigPath: string | undefined;
    const provider = new TigerProvider(
      { configPath: "/tmp/detected-tiger.properties" },
      async (_request, options) => {
        receivedConfigPath = options?.configPath;
        return [{
          symbol: "AAPL",
          time: Date.parse("2025-01-02T14:30:00.000Z"),
          open: 100,
          high: 102,
          low: 99,
          close: 101,
          volume: 800,
        }];
      },
    );

    await provider.fetchDaily({
      instrumentId: "US:AAPL",
      symbol: "AAPL",
      market: "US",
      startDate: "2025-01-01",
      endDate: "2025-01-03",
    });

    expect(receivedConfigPath).toBe("/tmp/detected-tiger.properties");
  });

  it("parses Tiger daily bars into provider candles", async () => {
    const provider = new TigerProvider(
      { configPath: "/tmp/tiger.properties" },
      async (request) => [{
        symbol: request.symbol,
        time: Date.parse("2025-01-02T14:30:00.000Z"),
        open: 100,
        high: 102,
        low: 99,
        close: 101,
        volume: 800,
      }],
    );

    await expect(provider.fetchDaily({
      instrumentId: "US:AAPL",
      symbol: "AAPL",
      market: "US",
      startDate: "2025-01-01",
      endDate: "2025-01-03",
    })).resolves.toMatchObject({
      provider: "tiger",
      providerSymbol: "AAPL",
      candles: [{ tradingDate: "2025-01-02", close: "101", volume: "800" }],
      warnings: [],
    });
  });

  it("normalizes HK symbols to Tiger's raw five-digit contract code", async () => {
    const requests: Parameters<TigerRunBars>[0][] = [];
    const provider = new TigerProvider(
      { configPath: "/tmp/tiger.properties" },
      async (request) => {
        requests.push(request);
        return [{
          symbol: request.symbol,
          time: Date.parse("2025-01-02T02:30:00.000Z"),
          open: 510,
          high: 515,
          low: 508,
          close: 512,
          volume: 900,
        }];
      },
    );

    const result = await provider.fetchDaily({
      instrumentId: "HK:700",
      symbol: "700",
      market: "HK",
      startDate: "2025-01-01",
      endDate: "2025-01-03",
    });

    expect(requests).toEqual([{
      symbol: "00700",
      period: "day",
      beginTime: "2025-01-01",
      endTime: "2025-01-04",
    }]);
    expect(result.providerSymbol).toBe("00700");
  });

  it("normalizes four-digit HK symbols to Tiger's raw five-digit contract code", async () => {
    const requests: Parameters<TigerRunBars>[0][] = [];
    const provider = new TigerProvider(
      { configPath: "/tmp/tiger.properties" },
      async (request) => {
        requests.push(request);
        return [{
          symbol: request.symbol,
          time: Date.parse("2025-01-02T02:30:00.000Z"),
          open: 510,
          high: 515,
          low: 508,
          close: 512,
          volume: 900,
        }];
      },
    );

    const result = await provider.fetchDaily({
      instrumentId: "HK:1810",
      symbol: "1810",
      market: "HK",
      startDate: "2025-01-01",
      endDate: "2025-01-03",
    });

    expect(requests).toEqual([{
      symbol: "01810",
      period: "day",
      beginTime: "2025-01-01",
      endTime: "2025-01-04",
    }]);
    expect(result.providerSymbol).toBe("01810");
  });

  it("interprets HK daily bar times in the Hong Kong trading day", async () => {
    const provider = new TigerProvider(
      { configPath: "/tmp/tiger.properties" },
      async (request) => [{
        symbol: request.symbol,
        time: Date.parse("2025-01-01T16:00:00.000Z"),
        open: 510,
        high: 515,
        low: 508,
        close: 512,
        volume: 900,
      }],
    );

    await expect(provider.fetchDaily({
      instrumentId: "HK:700",
      symbol: "700",
      market: "HK",
      startDate: "2025-01-02",
      endDate: "2025-01-03",
    })).resolves.toMatchObject({
      provider: "tiger",
      providerSymbol: "00700",
      candles: [{ tradingDate: "2025-01-02", close: "512", volume: "900" }],
      warnings: [],
    });
  });

  it("maps 1h requests to Tiger 60min bars with UTC millisecond boundaries", async () => {
    const requests: Parameters<TigerRunBars>[0][] = [];
    const provider = new TigerProvider(
      { configPath: "/tmp/tiger.properties" },
      async (request) => {
        requests.push(request);
        return [{
          symbol: request.symbol,
          time: Date.parse("2025-01-02T14:30:00.000Z"),
          open: 100,
          high: 103,
          low: 99,
          close: 102,
          volume: 1200,
        }];
      },
    );

    const result = await provider.fetchIntraday({
      instrumentId: "US:AAPL",
      symbol: "AAPL",
      market: "US",
      interval: "1h",
      startTime: "2025-01-02T14:30:00.000Z",
      endTime: "2025-01-02T14:30:00.000Z",
    });

    expect(requests).toEqual([{
      symbol: "AAPL",
      period: "60min",
      beginTime: String(Date.parse("2025-01-02T14:30:00.000Z")),
      endTime: String(Date.parse("2025-01-02T14:30:00.000Z")),
    }]);
    expect(result).toMatchObject({
      provider: "tiger",
      providerSymbol: "AAPL",
      interval: "1h",
      candles: [{ timestamp: "2025-01-02T14:30:00.000Z", close: "102" }],
    });
  });

  it("rejects 15m requests instead of silently remapping them", async () => {
    const provider = new TigerProvider(
      { configPath: "/tmp/tiger.properties" },
      async () => [],
    );

    await expect(provider.fetchIntraday({
      instrumentId: "US:AAPL",
      symbol: "AAPL",
      market: "US",
      interval: "15m",
      startTime: "2025-01-02T14:30:00.000Z",
      endTime: "2025-01-02T14:45:00.000Z",
    })).rejects.toEqual(
      expect.objectContaining<Partial<MarketDataProviderError>>({
        code: "no-data",
      }),
    );
  });

  it("rejects unsupported CN markets", async () => {
    const provider = new TigerProvider(
      { configPath: "/tmp/tiger.properties" },
      async () => [],
    );

    await expect(provider.fetchDaily({
      instrumentId: "CN-SH:600519",
      symbol: "600519",
      market: "CN-SH",
      startDate: "2025-01-01",
      endDate: "2025-01-03",
    })).rejects.toEqual(
      expect.objectContaining<Partial<MarketDataProviderError>>({
        code: "no-data",
      }),
    );
  });

  it("keeps an empty bar response safe for router fallback", async () => {
    const provider = new TigerProvider(
      { configPath: "/tmp/tiger.properties" },
      async () => [],
    );

    await expect(provider.fetchDaily({
      instrumentId: "US:AAPL",
      symbol: "AAPL",
      market: "US",
      startDate: "2025-01-01",
      endDate: "2025-01-03",
    })).resolves.toMatchObject({
      provider: "tiger",
      providerSymbol: "AAPL",
      candles: [],
      warnings: [],
    });
  });
});

describe("parseTigerBars", () => {
  it("rejects null numeric fields", () => {
    expect(() => parseTigerBars([{
      symbol: "AAPL",
      time: Date.parse("2025-01-02T14:30:00.000Z"),
      open: 100,
      high: 101,
      low: 99,
      close: null as never,
      volume: 800,
    }], {
      instrumentId: "US:AAPL",
      symbol: "AAPL",
      market: "US",
      interval: "1h",
      providerSymbol: "AAPL",
      startTime: "2025-01-02T14:30:00.000Z",
      endTime: "2025-01-02T14:30:00.000Z",
    })).toThrow("Tiger OpenAPI 行情响应格式已变化");
  });

  it("rejects invalid timestamps", () => {
    expect(() => parseTigerBars([{
      symbol: "AAPL",
      time: Number.NaN,
      open: 100,
      high: 101,
      low: 99,
      close: 100,
      volume: 800,
    }], {
      instrumentId: "US:AAPL",
      symbol: "AAPL",
      market: "US",
      interval: "1h",
      providerSymbol: "AAPL",
      startTime: "2025-01-02T14:30:00.000Z",
      endTime: "2025-01-02T14:30:00.000Z",
    })).toThrow("Tiger OpenAPI 行情响应格式已变化");
  });

  it("rejects a bar for a different contract", () => {
    expect(() => parseTigerBars([{
      symbol: "MSFT",
      time: Date.parse("2025-01-02T14:30:00.000Z"),
      open: 100,
      high: 101,
      low: 99,
      close: 100,
      volume: 800,
    }], {
      instrumentId: "US:AAPL",
      symbol: "AAPL",
      market: "US",
      interval: "1h",
      providerSymbol: "AAPL",
      startTime: "2025-01-02T14:30:00.000Z",
      endTime: "2025-01-02T14:30:00.000Z",
    })).toThrow("Tiger OpenAPI 行情响应标的不匹配");
  });
});
