import { describe, expect, it } from "vitest";
import { dailyRecordToChartCandle } from "../market/types";
import type { Candle } from "../market/types";
import type { TradeExecution } from "../trades/types";
import {
  resolveExecutionChartLocation,
  type ReviewChartLocateRequest,
} from "./chart-location";

const instrument = {
  id: "HK:TEST",
  symbol: "TEST",
  name: "Test",
  market: "HK",
  currency: "HKD",
};

function fill(
  id: string,
  executedAt: string,
  source: TradeExecution["source"] = { platform: "fixture", row: 1 },
): TradeExecution {
  return {
    id,
    source,
    accountId: "account",
    accountLabel: "Account",
    instrument,
    side: "buy",
    executedAt,
    quantity: "1",
    price: "1",
    fee: "0",
  };
}

const request: ReviewChartLocateRequest = {
  requestId: "request-1",
  instrumentId: instrument.id,
  episodeId: "episode-1",
  executionId: "date-only",
};

describe("resolveExecutionChartLocation", () => {
  it("does not invent an intraday time for a date-only fill", () => {
    const candles: Candle[] = [
      {
        time: "2025-01-03T01:30:00.000Z",
        knowledgeAt: "2025-01-03T02:30:00.000Z",
        open: 1,
        high: 2,
        low: 1,
        close: 2,
        volume: 10,
      },
      {
        time: "2025-01-03T02:30:00.000Z",
        knowledgeAt: "2025-01-03T03:30:00.000Z",
        open: 2,
        high: 3,
        low: 2,
        close: 3,
        volume: 12,
      },
    ];
    const location = resolveExecutionChartLocation(
      candles,
      [fill("date-only", "2025-01-03", {
        platform: "fixture",
        row: 1,
        timePrecision: "date-only",
        tradingDate: "2025-01-03",
      })],
      request,
    );
    expect(location?.candleTime).toBeUndefined();
  });

  it("maps a date-only fill to the explicit daily trading date", () => {
    const daily = dailyRecordToChartCandle({
      instrumentId: instrument.id,
      tradingDate: "2025-01-03",
      open: "1",
      high: "2",
      low: "1",
      close: "2",
      volume: "10",
      currency: "HKD",
      provider: "tencent",
      providerSymbol: "TEST",
      adjustmentMode: "raw",
      fetchedAt: "2025-01-04T00:00:00.000Z",
    });
    const location = resolveExecutionChartLocation(
      [daily],
      [fill("date-only", "2025-01-03", {
        platform: "fixture",
        row: 1,
        timePrecision: "date-only",
        tradingDate: "2025-01-03",
      })],
      request,
    );
    expect(location?.candleTime).toBe(daily.time);
  });

  it("keeps a missing target date unresolved", () => {
    const daily = dailyRecordToChartCandle({
      instrumentId: instrument.id,
      tradingDate: "2025-01-02",
      open: "1",
      high: "2",
      low: "1",
      close: "2",
      volume: "10",
      currency: "HKD",
      provider: "tencent",
      providerSymbol: "TEST",
      adjustmentMode: "raw",
      fetchedAt: "2025-01-04T00:00:00.000Z",
    });
    const location = resolveExecutionChartLocation(
      [daily],
      [fill("date-only", "2025-01-03", {
        platform: "fixture",
        row: 1,
        timePrecision: "date-only",
        tradingDate: "2025-01-03",
      })],
      request,
    );
    expect(location?.candleTime).toBeUndefined();
  });
});
