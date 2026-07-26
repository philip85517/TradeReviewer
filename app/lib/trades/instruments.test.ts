import { describe, expect, it } from "vitest";

import { buildInstrumentTradeSummaries } from "./instruments";
import type { TradeExecution } from "./types";

function execution(
  id: string,
  symbol: string,
  market: string,
  executedAt: string,
): TradeExecution {
  return {
    id,
    source: { platform: "futu", row: 2 },
    accountId: "acct",
    accountLabel: "账户",
    instrument: {
      id: `${market}:${symbol}`,
      symbol,
      name: symbol,
      market,
      currency: market === "HK" ? "HKD" : "USD",
    },
    side: "buy",
    executedAt,
    quantity: "10",
    price: "20",
    fee: "1",
  };
}

describe("buildInstrumentTradeSummaries", () => {
  it("shows one named stock per traded instrument", () => {
    const summaries = buildInstrumentTradeSummaries([
      execution("1", "1810", "HK", "2025-03-01T00:00:00.000Z"),
      execution("2", "1810", "HK", "2025-03-10T00:00:00.000Z"),
      execution("3", "NVDA", "US", "2025-04-01T00:00:00.000Z"),
    ]);

    expect(summaries).toHaveLength(2);
    expect(summaries[0]).toMatchObject({
      instrument: { symbol: "1810", name: "小米集团-W" },
      tradeCount: 2,
      firstTradeAt: "2025-03-01T00:00:00.000Z",
      lastTradeAt: "2025-03-10T00:00:00.000Z",
    });
    expect(summaries[1].instrument.name).toBe("英伟达");
  });
});
