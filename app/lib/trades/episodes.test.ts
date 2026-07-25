import { describe, expect, it } from "vitest";

import { buildTradeEpisodes } from "./episodes";
import type { TradeExecution } from "./types";

function execution(
  side: "buy" | "sell",
  executedAt: string,
  quantity: string,
  price: string,
): TradeExecution {
  return {
    id: `${side}-${executedAt}`,
    source: { platform: "demo", row: 1 },
    accountId: "acct-1",
    accountLabel: "演示账户",
    instrument: {
      id: "US:XPEV",
      symbol: "XPEV",
      name: "XPeng",
      market: "US",
      currency: "USD",
    },
    side,
    executedAt,
    quantity,
    price,
    fee: "0",
  };
}

describe("buildTradeEpisodes", () => {
  it("groups partial buys and sells until the position returns to zero", () => {
    const episodes = buildTradeEpisodes([
      execution("buy", "2025-01-02T14:30:00Z", "100", "10"),
      execution("buy", "2025-01-03T14:30:00Z", "50", "11"),
      execution("sell", "2025-01-08T14:30:00Z", "75", "12"),
      execution("sell", "2025-01-09T14:30:00Z", "75", "13"),
    ]);

    expect(episodes).toHaveLength(1);
    expect(episodes[0]).toMatchObject({
      status: "closed",
      openingQuantity: "150",
      remainingQuantity: "0",
      startedAt: "2025-01-02T14:30:00Z",
      endedAt: "2025-01-09T14:30:00Z",
    });
    expect(episodes[0].executions).toHaveLength(4);
  });

  it("closes a long and opens a short when one sell crosses through zero", () => {
    const episodes = buildTradeEpisodes([
      execution("buy", "2025-01-02T14:30:00Z", "100", "10"),
      execution("sell", "2025-01-03T14:30:00Z", "150", "9"),
    ]);

    expect(episodes).toHaveLength(2);
    expect(episodes[0]).toMatchObject({
      direction: "long",
      status: "closed",
      remainingQuantity: "0",
    });
    expect(episodes[0].executions.at(-1)?.quantity).toBe("100");
    expect(episodes[1]).toMatchObject({
      direction: "short",
      status: "open",
      openingQuantity: "50",
      remainingQuantity: "50",
    });
    expect(episodes[1].executions[0].quantity).toBe("50");
  });
});
