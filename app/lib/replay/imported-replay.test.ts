import { describe, expect, it } from "vitest";

import type { Candle } from "../market/types";
import type { TradeExecution } from "../trades/types";
import { createImportedReplay } from "./imported-replay";

function candle(time: string): Candle {
  return { time, open: 10, high: 11, low: 9, close: 10, volume: 100 };
}

function fill(executedAt: string): TradeExecution {
  return {
    id: executedAt,
    source: { platform: "test", row: 1 },
    accountId: "account-1",
    accountLabel: "Test account",
    instrument: {
      id: "US:TEST",
      symbol: "TEST",
      name: "Test",
      market: "US",
      currency: "USD",
    },
    side: "buy",
    executedAt,
    quantity: "1",
    price: "10",
    fee: "0",
  };
}

describe("createImportedReplay", () => {
  const candles = [
    candle("2025-01-02T14:30:00Z"),
    candle("2025-01-02T14:45:00Z"),
    candle("2025-01-02T15:00:00Z"),
  ];
  const executions = [
    fill("2025-01-02T14:30:00Z"),
    fill("2025-01-02T15:00:00Z"),
  ];

  it("derives timeline navigation from an immutable stored cursor", () => {
    const replay = createImportedReplay({
      candles,
      executions,
      storedCursor: candles[1].time,
    });
    const hourlyCandles = [
      candle("2025-01-02T14:00:00Z"),
      candle("2025-01-02T15:00:00Z"),
    ];

    expect(replay.currentCursor).toBe(candles[1].time);
    expect(replay.canGoBack).toBe(true);
    expect(replay.canGoForward).toBe(true);
    expect(replay.next()).toBe(candles[2].time);
    expect(replay.previous()).toBe(candles[0].time);
    expect(replay.nextExecution()).toBe(executions[1].executedAt);
    expect(replay.cursorForTimeframe(hourlyCandles)).toBe(
      hourlyCandles[0].time,
    );
  });

  it("clamps missing and out-of-range cursors to the first visible candle", () => {
    expect(createImportedReplay({ candles, executions }).currentCursor).toBe(
      candles[0].time,
    );
    expect(
      createImportedReplay({
        candles,
        executions,
        storedCursor: "2025-01-02T13:00:00Z",
      }).currentCursor,
    ).toBe(candles[0].time);
    expect(
      createImportedReplay({
        candles,
        executions,
        storedCursor: "2025-01-02T16:00:00Z",
      }).currentCursor,
    ).toBe(candles[0].time);
  });

  it("does not advance beyond either end of the timeline", () => {
    const first = createImportedReplay({ candles, executions });
    const last = createImportedReplay({
      candles,
      executions,
      storedCursor: candles[2].time,
    });

    expect(first.previous()).toBe(candles[0].time);
    expect(last.next()).toBe(candles[2].time);
    expect(last.nextExecution()).toBe(candles[2].time);
  });
});
