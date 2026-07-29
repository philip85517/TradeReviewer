import { describe, expect, it } from "vitest";

import { resolveTimeframeAvailability } from "./availability";
import type {
  DailyCandleRecord,
  MarketCandleRecord,
} from "./contracts";

const intradayRecord: MarketCandleRecord = {
  instrumentId: "instrument-1",
  interval: "15m",
  timestamp: "2025-01-02T14:30:00.000Z",
  open: "10",
  high: "11",
  low: "9",
  close: "10.5",
  volume: "100",
  currency: "USD",
  provider: "yahoo",
  providerSymbol: "TEST",
  adjustmentMode: "raw",
  fetchedAt: "2025-01-02T15:30:00.000Z",
};

const dailyRecord: DailyCandleRecord = {
  instrumentId: "instrument-1",
  tradingDate: "2025-01-02",
  open: "10",
  high: "12",
  low: "9",
  close: "11.5",
  volume: "460",
  currency: "USD",
  provider: "yahoo",
  providerSymbol: "TEST",
  adjustmentMode: "raw",
  fetchedAt: "2025-01-02T15:30:00.000Z",
};

describe("resolveTimeframeAvailability", () => {
  it("enables only periods backed by the required native data", () => {
    const result = resolveTimeframeAvailability({
      intradayCandles: [intradayRecord],
      dailyCandles: [dailyRecord],
      intradayCoverage: [],
    });

    expect(result["15m"].enabled).toBe(true);
    expect(result["1h"].enabled).toBe(true);
    expect(result["4h"].enabled).toBe(true);
    expect(result["1D"].enabled).toBe(true);
    expect(result["1W"].enabled).toBe(true);
  });

  it("explains why intraday periods are unavailable", () => {
    const result = resolveTimeframeAvailability({
      intradayCandles: [],
      dailyCandles: [dailyRecord],
      intradayCoverage: [
        {
          interval: "15m",
          requestedStart: "2025-01-01T00:00:00.000Z",
          requestedEnd: "2025-01-10T00:00:00.000Z",
          status: "partial",
          reason: "provider-history-limit",
        },
      ],
    });

    expect(result["15m"]).toEqual({
      enabled: false,
      reason: "公开行情源未覆盖该交易日期的 15 分钟行情",
    });
  });

  it("identifies periods that have not been requested", () => {
    const result = resolveTimeframeAvailability({
      intradayCandles: [],
      dailyCandles: [],
      intradayCoverage: [],
    });

    expect(result["15m"]).toEqual({
      enabled: false,
      reason: "尚未获取该周期行情",
    });
    expect(result["1D"]).toEqual({
      enabled: false,
      reason: "尚未获取该周期行情",
    });
  });

  it("treats an explicit not-requested coverage segment as unrequested", () => {
    const result = resolveTimeframeAvailability({
      intradayCandles: [],
      dailyCandles: [],
      intradayCoverage: [
        {
          interval: "15m",
          requestedStart: "2025-01-01T00:00:00.000Z",
          requestedEnd: "2025-01-10T00:00:00.000Z",
          status: "not-requested",
        },
      ],
    });

    expect(result["15m"]).toEqual({
      enabled: false,
      reason: "尚未获取该周期行情",
    });
  });

  it("uses a stable explanation for an unavailable intraday source", () => {
    const result = resolveTimeframeAvailability({
      intradayCandles: [],
      dailyCandles: [],
      intradayCoverage: [
        {
          interval: "15m",
          requestedStart: "2025-01-01T00:00:00.000Z",
          requestedEnd: "2025-01-10T00:00:00.000Z",
          status: "source-unavailable",
        },
      ],
    });

    expect(result["15m"]).toEqual({
      enabled: false,
      reason: "公开行情源暂不可用",
    });
  });
});
