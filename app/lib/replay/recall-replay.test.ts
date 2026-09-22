import { describe, expect, it } from "vitest";

import type { Candle } from "../market/types";
import type { RecallDecision } from "../recall/types";
import type { TradeExecution } from "../trades/types";
import {
  executionBoundaryForCursor,
  mapRecallExecutionToCandle,
  nextRecallDecisionState,
  NO_REVEALED_EXECUTIONS,
  revealRecallBar,
  revealRecallDecision,
  rewindRecallBar,
  type RecallReplayCursor,
} from "./recall-replay";

const instrument = {
  id: "US:TEST",
  symbol: "TEST",
  name: "Test",
  market: "US",
  currency: "USD",
};

function fill(id: string, executedAt: string, side: "buy" | "sell" = "buy"): TradeExecution {
  return {
    id,
    source: { platform: "test", row: Number(id.replace(/\D/g, "")) || 1 },
    accountId: "account-1",
    accountLabel: "Test account",
    instrument,
    side,
    executedAt,
    quantity: "1",
    price: "10",
    fee: "0",
  };
}

function candle(time: string, knowledgeAt: string): Candle {
  return {
    time,
    knowledgeAt,
    open: 10,
    high: 11,
    low: 9,
    close: 10.5,
    volume: 100,
  };
}

describe("recall replay cursors", () => {
  const candles = [
    candle("2025-01-02T10:00:00.000Z", "2025-01-02T10:15:00.000Z"),
    candle("2025-01-02T10:15:00.000Z", "2025-01-02T10:30:00.000Z"),
  ];
  const executions = [
    fill("fill-1", "2025-01-02T10:05:00.000Z"),
    fill("fill-2", "2025-01-02T10:05:00.000Z"),
    fill("fill-3", "2025-01-02T10:20:00.000Z", "sell"),
  ];
  const decisions: RecallDecision[] = [
    { id: "decision-1", executionIds: ["fill-1"] },
    { id: "decision-2", executionIds: ["fill-2"] },
    { id: "decision-3", executionIds: ["fill-3"] },
  ];

  it("keeps same-candle decisions ordered by episode execution order", () => {
    const first = revealRecallDecision({
      candles,
      executions,
      decisions,
      decisionId: "decision-1",
    });
    expect(first.cursor).toBe("2025-01-02T10:15:00.000Z");
    expect(first.executionCursor).toBe("fill-1");
    expect(first.revealedExecutions.map(({ id }) => id)).toEqual(["fill-1"]);

    const second = nextRecallDecisionState({
      candles,
      executions,
      decisions,
      current: first,
    });
    expect(second.executionCursor).toBe("fill-2");
    expect(second.revealedExecutions.map(({ id }) => id)).toEqual([
      "fill-1",
      "fill-2",
    ]);
    expect(second.cursor).toBe(first.cursor);
  });

  it("advances the bar cursor to a complete candle and reveals fills through its close", () => {
    const first = revealRecallDecision({
      candles,
      executions,
      decisions,
      decisionId: "decision-1",
    });
    const next = revealRecallBar({ candles, executions, current: first });
    expect(next.cursor).toBe("2025-01-02T10:30:00.000Z");
    expect(next.revealedExecutions.map(({ id }) => id)).toEqual([
      "fill-1",
      "fill-2",
      "fill-3",
    ]);
  });

  it("rewinds the market and execution boundaries together", () => {
    const first = revealRecallDecision({
      candles,
      executions,
      decisions,
      decisionId: "decision-1",
    });
    const advanced = revealRecallBar({ candles, executions, current: first });

    expect(advanced.revealedExecutions.map(({ id }) => id)).toEqual([
      "fill-1",
      "fill-2",
      "fill-3",
    ]);

    const rewound = rewindRecallBar({ candles, executions, current: advanced });

    expect(rewound.cursor).toBe("2025-01-02T10:15:00.000Z");
    expect(rewound.executionCursor).toBe("fill-2");
    expect(rewound.revealedExecutions.map(({ id }) => id)).toEqual([
      "fill-1",
      "fill-2",
    ]);
  });

  it("uses a persistent empty execution boundary before the first fill", () => {
    const prefillCandle = candle("2025-01-02T10:00:00.000Z", "2025-01-02T10:15:00.000Z");
    const firstFillCandle = candle("2025-01-02T10:15:00.000Z", "2025-01-02T10:30:00.000Z");
    const prefillExecution = fill("prefill", "2025-01-02T10:15:00.000Z");
    const initial = revealRecallDecision({
      candles: [prefillCandle, firstFillCandle],
      executions: [prefillExecution],
      decisions: [{ id: "prefill-decision", executionIds: [prefillExecution.id] }],
      decisionId: "prefill-decision",
    });

    const rewound = rewindRecallBar({
      candles: [prefillCandle, firstFillCandle],
      executions: [prefillExecution],
      current: initial,
    });

    expect(rewound.executionCursor).toBe(NO_REVEALED_EXECUTIONS);
    expect(rewound.revealedExecutions).toEqual([]);
  });

  it("maps the same execution boundary to another timeframe without advancing fills", () => {
    const first = revealRecallDecision({
      candles,
      executions,
      decisions,
      decisionId: "decision-2",
    });
    const hourly = [
      candle("2025-01-02T10:00:00.000Z", "2025-01-02T11:00:00.000Z"),
    ];
    const mapped = mapRecallExecutionToCandle(
      executions[1],
      hourly,
    );
    expect(mapped?.time).toBe(hourly[0].time);
    expect(first.executionCursor).toBe("fill-2");
    expect(executionBoundaryForCursor(executions, first.executionCursor)).toBe(1);
  });

  it("preserves a replay cursor when entering and leaving full history", () => {
    const first = revealRecallDecision({
      candles,
      executions,
      decisions,
      decisionId: "decision-1",
    });
    const full: RecallReplayCursor = {
      ...first,
      mode: "history",
      cursor: "2025-01-02T10:30:00.000Z",
      executionCursor: "fill-3",
    };
    expect(full.mode).toBe("history");
    expect(first.mode).toBe("replay");
    expect(first.executionCursor).toBe("fill-1");
  });
});
