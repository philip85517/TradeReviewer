import { describe, expect, it } from "vitest";

import { MarketDataProviderError } from "./errors";
import {
  parseTigerBars,
  TigerProvider,
  type TigerRunBars,
} from "./tiger";

describe("Tiger provider", () => {
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

  it("normalizes HK symbols to Tiger's raw four-digit contract code", async () => {
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
      symbol: "0700",
      period: "day",
      beginTime: "2025-01-01",
      endTime: "2025-01-03",
    }]);
    expect(result.providerSymbol).toBe("0700");
  });

  it("maps 1h requests to Tiger 60min bars", async () => {
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
      beginTime: "2025-01-02 14:30:00",
      endTime: "2025-01-02 14:30:00",
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
