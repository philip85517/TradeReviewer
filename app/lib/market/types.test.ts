import { expect, it } from "vitest";
import { dailyRecordToChartCandle } from "./types";

it.each([
  ["HK:1021", "2026-03-30", "2026-03-30T08:10:00.000Z"],
  ["US:AAPL", "2026-01-05", "2026-01-05T21:00:00.000Z"],
  ["US:AAPL", "2026-07-06", "2026-07-06T20:00:00.000Z"],
  ["CN-SH:600000", "2026-03-30", "2026-03-30T07:00:00.000Z"],
])("uses the market session close for %s on %s", (instrumentId, tradingDate, close) => {
  expect(dailyRecordToChartCandle({ instrumentId, tradingDate, open: "1", high: "2", low: "1", close: "2", volume: "100",
    currency: "USD", provider: "tiger", providerSymbol: instrumentId, adjustmentMode: "raw", fetchedAt: "2026-09-05T00:00:00Z" }).knowledgeAt).toBe(close);
});
