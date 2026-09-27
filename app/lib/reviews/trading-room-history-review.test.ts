import { expect, it } from "vitest";
import { expectedTradingDates } from "../market/calendar";
import type { DailyCandleRecord } from "../market/contracts";
import { buildInstrumentTradeSummaries } from "../trades/instruments";
import { buildTradeLibraryEntries } from "../trades/library";
import type { TradeExecution } from "../trades/types";
import { buildHoldingsHistory } from "./trading-room-history";
import { createDefaultRoomScope } from "./trading-room-scope";

it("does not turn an off-calendar quote into a new valuation or weekend profit", () => {
  expect(expectedTradingDates("CN-SH", "2026-09-24", "2026-09-26")).toEqual(["2026-09-24"]);
  const trade: TradeExecution = {
    id: "review-cn-open", accountId: "review-account", accountLabel: "Review",
    instrument: { id: "CN-SH:600000", symbol: "600000", name: "浦发银行", market: "CN-SH", currency: "CNY" },
    side: "buy", executedAt: "2026-09-23T03:00:00Z", quantity: "2", price: "10", fee: "0",
    source: { platform: "fixture", row: 1, tradeNature: "live", tradingDate: "2026-09-23", feeStatus: "reported" },
  };
  const candles: DailyCandleRecord[] = [["2026-09-23", "10"], ["2026-09-24", "10"], ["2026-09-25", "999"]].map(([tradingDate, close]) => ({
    instrumentId: trade.instrument.id, tradingDate, close, open: close, high: close, low: close,
    volume: "1000", currency: "CNY", provider: "tencent", providerSymbol: "sh600000", adjustmentMode: "raw", fetchedAt: "2026-09-26T03:00:00Z",
  }));
  const candleMap = { [trade.instrument.id]: candles };
  const entries = buildTradeLibraryEntries(buildInstrumentTradeSummaries([trade]), candleMap, {});
  const model = buildHoldingsHistory(entries, {
    scope: { ...createDefaultRoomScope("2026-09-26"), period: { preset: "custom", startDate: "2026-09-24", endDate: "2026-09-26" } },
    asOf: "2026-09-26", candlesByInstrument: candleMap,
  });
  for (const point of model.points) {
    expect(point.marketValue.originalByCurrency).toEqual({ CNY: "20" });
    expect(point.dailyPnl.originalByCurrency).toEqual({ CNY: "0" });
    expect(point.holdings[0].quoteDate).toBe("2026-09-24");
  }
});
