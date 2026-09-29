import { describe, expect, it } from "vitest";

import type { Candle } from "../market/types";
import type { RecallDecision } from "../recall/types";
import type { TradeExecution } from "../trades/types";
import {
  executionBoundaryForCursor,
  executionsThroughCursor,
  mapRecallExecutionToCandle,
  nextRecallDecisionState,
  NO_REVEALED_EXECUTIONS,
  revealRecallBar,
  revealableCandlesThroughCursor,
  revealRecallDecision,
  rewindRecallBar,
  visibleRecallExecutions,
  type RecallReplayCursor,
} from "./recall-replay";

const instrument = {
  id: "US:TEST",
  symbol: "TEST",
  name: "Test",
  market: "US",
  currency: "USD",
};

const cnInstrument = {
  id: "CN-SH:TEST",
  symbol: "TEST",
  name: "Test CN",
  market: "CN-SH",
  currency: "CNY",
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

function dailyCandle(date: string, knowledgeAt = `${date}T07:00:00.000Z`): Candle {
  return { ...candle(`${date}T00:00:00.000Z`, knowledgeAt), tradingDates: [date] };
}

function dateOnlyFill(id: string, date: string, row: number): TradeExecution {
  return {
    id,
    source: {
      platform: "china-merchants",
      row,
      timePrecision: "date-only",
      sourceTimestampText: date.replaceAll("-", ""),
      sourceTimezone: "Asia/Shanghai",
    },
    accountId: "account-1",
    accountLabel: "Test account",
    instrument: cnInstrument,
    side: "buy",
    // Source precision remains date-only. This is only the parser's close anchor.
    executedAt: `${date}T07:00:00.000Z`,
    quantity: "30",
    price: "1.10",
    fee: "0",
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

  it("keeps date-only decisions distinct when raw timestamps disagree within one replay day", () => {
    const sameDayExecutions = executions.map((execution, index) => ({
      ...execution,
      executedAt: index === 0
        ? execution.executedAt
        : `2025-01-02T${index === 1 ? "10:20" : "10:05"}:00.000Z`,
      source: { ...execution.source, timePrecision: "date-only" as const },
    }));
    const sameDayDecisions: RecallDecision[] = [
      { id: "decision-1", executionIds: ["fill-1"] },
      { id: "decision-2", executionIds: ["fill-2"] },
      { id: "decision-3", executionIds: ["fill-3"] },
    ];
    const first = revealRecallDecision({
      candles,
      executions: sameDayExecutions,
      decisions: sameDayDecisions,
      decisionId: "decision-2",
    });
    const next = nextRecallDecisionState({
      candles,
      executions: sameDayExecutions,
      decisions: sameDayDecisions,
      current: first,
    });
    expect(first.executionCursor).toBe("fill-2");
    expect(first.revealedExecutions.map(({ id }) => id)).toEqual(["fill-1", "fill-2"]);
    expect(next.executionCursor).toBe("fill-3");
    expect(next.revealedExecutions.map(({ id }) => id)).toEqual(["fill-1", "fill-2", "fill-3"]);
  });

  it("advances the bar cursor to a complete candle and reveals fills through its close", () => {
    const first = revealRecallDecision({
      candles,
      executions,
      decisions,
      decisionId: "decision-1",
    });
    const completedFirst = revealRecallBar({ candles, executions, current: first });
    expect(completedFirst.revealedExecutions.map(({ id }) => id)).toEqual(["fill-1", "fill-2"]);
    const next = revealRecallBar({ candles, executions, current: completedFirst });
    expect(next.cursor).toBe("2025-01-02T10:30:00.000Z");
    expect(next.revealedExecutions.map(({ id }) => id)).toEqual([
      "fill-1",
      "fill-2",
      "fill-3",
    ]);
  });

  it("updates the independent market boundary on decision, bar, and rewind transitions", () => {
    const first = revealRecallDecision({
      candles,
      executions,
      decisions,
      decisionId: "decision-1",
    });
    expect(first.revealedCandleCursor).toBe("2025-01-02T10:05:00.000Z");

    const completedFirst = revealRecallBar({ candles, executions, current: first });
    expect(completedFirst.revealedCandleCursor).toBe(candles[0].knowledgeAt);

    const advanced = revealRecallBar({ candles, executions, current: completedFirst });
    expect(advanced.revealedCandleCursor).toBe(candles[1].knowledgeAt);

    const rewound = rewindRecallBar({
      candles,
      executions,
      current: { ...advanced, revealedCandleCursor: "2025-01-02T11:00:00.000Z" },
    });
    expect(rewound.revealedCandleCursor).toBe(candles[0].knowledgeAt);

    const beforeFirst = rewindRecallBar({
      candles,
      executions,
      current: { ...completedFirst, revealedCandleCursor: "2025-01-02T11:00:00.000Z" },
    });
    expect(beforeFirst.revealedCandleCursor).toBeNull();
    expect(beforeFirst.revealedCandles).toEqual([]);
  });

  it("does not reveal a trading-date-mapped fill after the candle knowledge cutoff", () => {
    const datedCandles = [
      { ...candle("2025-01-02T10:00:00.000Z", "2025-01-02T10:05:00.000Z"), tradingDates: ["2025-01-02"] },
      { ...candle("2025-01-02T10:05:00.000Z", "2025-01-02T10:10:00.000Z"), tradingDates: ["2025-01-02"] },
    ];
    const future = fill("future", "2025-01-02T10:20:00.000Z", "sell");
    const current: RecallReplayCursor = {
      cursor: "2025-01-02T10:05:00.000Z",
      executionCursor: NO_REVEALED_EXECUTIONS,
      mode: "replay",
      revealedCandles: [datedCandles[0]],
      revealedExecutions: [],
      currentCandle: datedCandles[0],
    };
    const next = revealRecallBar({ candles: datedCandles, executions: [future], current });
    expect(next.revealedExecutions).toEqual([]);
  });

  it("rewinds the market and execution boundaries together", () => {
    const first = revealRecallDecision({
      candles,
      executions,
      decisions,
      decisionId: "decision-1",
    });
    const completedFirst = revealRecallBar({ candles, executions, current: first });
    const advanced = revealRecallBar({ candles, executions, current: completedFirst });

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

  it("masks OHLCV for a candle whose knowledge boundary is still ahead of the replay cursor", () => {
    const partial = revealRecallDecision({
      candles,
      executions,
      decisions,
      decisionId: "decision-1",
    });
    const persistedEarlyCursor: RecallReplayCursor = {
      ...partial,
      cursor: "2025-01-02T10:05:00.000Z",
      currentCandle: candles[0],
    };
    expect(partial.currentCandle).toBeUndefined();
    expect(partial.revealedCandles).toEqual([]);
    const replayed = revealableCandlesThroughCursor(candles, persistedEarlyCursor.cursor);
    expect(replayed).toEqual([]);
  });

  it("keeps a date-only fill hidden at session close and reveals it at source day end", () => {
    const target = dateOnlyFill("date-only", "2025-01-03", 1);
    const candles = [
      dailyCandle("2025-01-02"),
      dailyCandle("2025-01-03"),
      { ...candle("2025-01-03T07:00:00.000Z", "2025-01-03T08:00:00.000Z") },
      dailyCandle("2025-01-04"),
    ];
    expect(mapRecallExecutionToCandle(target, [
      candle("2025-01-03T07:00:00.000Z", "2025-01-03T08:00:00.000Z"),
    ])).toBeUndefined();
    const before: RecallReplayCursor = {
      cursor: candles[0].knowledgeAt!,
      executionCursor: NO_REVEALED_EXECUTIONS,
      mode: "replay",
      revealedCandles: [candles[0]],
      revealedExecutions: [],
      currentCandle: candles[0],
    };

    const atSessionClose = revealRecallBar({ candles, executions: [target], current: before });
    expect(atSessionClose.revealedExecutions).toEqual([]);
    expect(atSessionClose.executionCursor).toBe(NO_REVEALED_EXECUTIONS);
    expect(atSessionClose.revealedCandles).toEqual([candles[0], candles[1]]);

    const atExecutionKnowledge = nextRecallDecisionState({
      candles,
      executions: [target],
      decisions: [{ id: "decision", executionIds: [target.id] }],
      current: atSessionClose,
    });
    expect(atExecutionKnowledge.cursor).toBe("2025-01-03T23:59:59.999Z");
    expect(atExecutionKnowledge.executionCursor).toBe(target.id);
    expect(atExecutionKnowledge.revealedExecutions.map(({ id }) => id)).toEqual([target.id]);
    expect(atExecutionKnowledge.revealedCandles).toEqual([candles[0], candles[1]]);

    const rewound = rewindRecallBar({ candles, executions: [target], current: atExecutionKnowledge });
    expect(rewound.revealedExecutions).toEqual([]);
    expect(rewound.executionCursor).toBe(NO_REVEALED_EXECUTIONS);
  });

  it("treats a hidden saved execution id as unrevealed for the next decision", () => {
    const target = dateOnlyFill("saved-date-only", "2025-01-03", 1);
    const current: RecallReplayCursor = {
      cursor: "2025-01-03T07:00:00.000Z",
      executionCursor: target.id,
      mode: "replay",
      revealedCandles: [dailyCandle("2025-01-02")],
      revealedExecutions: [],
      currentCandle: dailyCandle("2025-01-02"),
    };

    expect(visibleRecallExecutions([target], current.executionCursor, current.cursor)).toEqual([]);
    const next = nextRecallDecisionState({
      candles: [dailyCandle("2025-01-02"), dailyCandle("2025-01-03")],
      executions: [target],
      decisions: [{ id: "saved-decision", executionIds: [target.id] }],
      current,
    });

    expect(next.cursor).toBe("2025-01-03T23:59:59.999Z");
    expect(next.executionCursor).toBe(target.id);
    expect(next.revealedExecutions.map(({ id }) => id)).toEqual([target.id]);
  });

  it("rewinds the first revealed market bar even when no execution is visible", () => {
    const first = dailyCandle("2025-01-02");
    const current: RecallReplayCursor = {
      cursor: first.knowledgeAt!,
      executionCursor: NO_REVEALED_EXECUTIONS,
      mode: "replay",
      revealedCandles: [first],
      revealedExecutions: [],
      currentCandle: first,
    };

    const rewound = rewindRecallBar({ candles: [first, dailyCandle("2025-01-03")], executions: [], current });

    expect(rewound.executionCursor).toBe(NO_REVEALED_EXECUTIONS);
    expect(rewound.revealedCandles).toEqual([]);
    expect(rewound.revealedExecutions).toEqual([]);
    expect(rewound.currentCandle).toBeUndefined();
  });

  it("orders mixed precision fills by knowledge and keeps same-day date-only source order", () => {
    const firstDateOnly = dateOnlyFill("date-only-1", "2025-01-03", 1);
    const precise = {
      ...fill("precise", "2025-01-03T10:00:00.000Z"),
      instrument: cnInstrument,
      source: { platform: "test", row: 2, timePrecision: "second" as const },
    };
    const secondDateOnly = dateOnlyFill("date-only-2", "2025-01-03", 3);
    const executions = [firstDateOnly, precise, secondDateOnly];

    expect(executionsThroughCursor(executions, precise.id).map(({ id }) => id)).toEqual([precise.id]);
    expect(executionsThroughCursor(executions, secondDateOnly.id).map(({ id }) => id)).toEqual([
      precise.id,
      firstDateOnly.id,
      secondDateOnly.id,
    ]);
  });
  it("reveals the first completed bar when a decision has no visible candles yet", () => {
    const initial = revealRecallDecision({ candles, executions, decisions, decisionId: "decision-1" });
    expect(initial.revealedCandles).toEqual([]);
    const next = revealRecallBar({ candles, executions, current: initial });
    expect(next.revealedCandles).toEqual([candles[0]]);
    expect(next.currentCandle).toEqual(candles[0]);
    expect(next.cursor).toBe(candles[0].knowledgeAt);
  });

});
