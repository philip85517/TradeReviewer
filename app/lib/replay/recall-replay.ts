import { candleKnowledgeAt, type Candle } from "../market/types";
import type { RecallDecision } from "../recall/types";
import type { TradeExecution } from "../trades/types";
import { mapExecutionsToCandles } from "./execution-markers";

export type RecallReplayMode = "replay" | "history";

/** Persisted marker for a valid replay state before the first fill. */
export const NO_REVEALED_EXECUTIONS = "__recall_before_first_execution__";

/**
 * `executionCursor` is a stable execution id whenever the cursor has been
 * advanced by Recall. Older drafts may contain a timestamp; those values are
 * still accepted and include every fill at or before that timestamp.
 */
export type RecallReplayCursor = {
  cursor: string;
  executionCursor: string;
  mode: RecallReplayMode;
  revealedCandles: Candle[];
  revealedExecutions: TradeExecution[];
  currentCandle?: Candle;
};

export type RecallReplayInput = {
  candles: Candle[];
  executions: TradeExecution[];
  decisions: RecallDecision[];
};

function byTime(left: { time?: string; executedAt?: string }, right: { time?: string; executedAt?: string }) {
  return Date.parse(left.time ?? left.executedAt ?? "") - Date.parse(right.time ?? right.executedAt ?? "");
}

function sortedCandles(candles: Candle[]) {
  return [...candles].sort(byTime);
}

function executionOrder(executions: TradeExecution[]) {
  // Stable sort is not guaranteed in every browser/runtime the application
  // supports. Keep episode order as the tie-breaker for date-only and same-bar
  // fills instead of manufacturing an order from a floating timestamp.
  return executions.map((execution, index) => ({ execution, index })).sort((left, right) => {
    const time = Date.parse(left.execution.executedAt) - Date.parse(right.execution.executedAt);
    return time || left.index - right.index;
  });
}

function orderedExecutions(executions: TradeExecution[]) {
  return executionOrder(executions).map(({ execution }) => execution);
}

export function executionBoundaryForCursor(
  executions: TradeExecution[],
  cursor: string,
): number {
  if (cursor === NO_REVEALED_EXECUTIONS) return -1;
  const ordered = orderedExecutions(executions);
  const byId = ordered.findIndex((execution) => execution.id === cursor);
  if (byId >= 0) return byId;
  const cursorTime = Date.parse(cursor);
  if (!Number.isFinite(cursorTime)) return -1;
  return ordered.reduce(
    (last, execution, index) =>
      Date.parse(execution.executedAt) <= cursorTime ? index : last,
    -1,
  );
}

export function executionsThroughCursor(
  executions: TradeExecution[],
  cursor: string,
): TradeExecution[] {
  const ordered = orderedExecutions(executions);
  const boundary = executionBoundaryForCursor(ordered, cursor);
  return boundary < 0 ? [] : ordered.slice(0, boundary + 1);
}

function mappedCandleMap(candles: Candle[], executions: TradeExecution[]) {
  return new Map(
    mapExecutionsToCandles(candles, executions).map((mapping) => [mapping.executionId, mapping.candleTime]),
  );
}

/** Return the full candle containing an execution, when market data maps it. */
export function mapRecallExecutionToCandle(
  execution: TradeExecution,
  candles: Candle[],
): Candle | undefined {
  const mapped = mappedCandleMap(candles, [execution]).get(execution.id);
  if (mapped) return candles.find((candle) => candle.time === mapped);

  // Daily data can still be useful when the provider omitted a knowledge
  // boundary. `mapExecutionsToCandles` already handles tradingDates; this
  // fallback only covers a candle whose range is expressed by its timestamps.
  const executionTime = Date.parse(execution.executedAt);
  if (!Number.isFinite(executionTime)) return undefined;
  return sortedCandles(candles).find((candle, index, ordered) => {
    const start = Date.parse(candle.time);
    const next = ordered[index + 1];
    const end = next ? Date.parse(next.time) : Date.parse(candleKnowledgeAt(candle));
    return Number.isFinite(start) && start <= executionTime && executionTime <= end;
  });
}

function firstExecution(decision: RecallDecision, executions: TradeExecution[]) {
  const order = executionOrder(executions);
  const ids = new Set(decision.executionIds);
  return order.find(({ execution }) => ids.has(execution.id));
}

function candlesThrough(candles: Candle[], target: Candle | undefined) {
  const ordered = sortedCandles(candles);
  if (!target) return [];
  const index = ordered.findIndex((candle) => candle.time === target.time);
  return index < 0 ? [] : ordered.slice(0, index + 1);
}

function result(
  candles: Candle[],
  executions: TradeExecution[],
  cursor: string,
  executionCursor: string,
  mode: RecallReplayMode = "replay",
  currentCandle?: Candle,
): RecallReplayCursor {
  return {
    cursor,
    executionCursor,
    mode,
    currentCandle,
    revealedCandles: mode === "history" ? sortedCandles(candles) : candlesThrough(candles, currentCandle),
    revealedExecutions: mode === "history" ? orderedExecutions(executions) : executionsThroughCursor(executions, executionCursor),
  };
}

export function revealRecallDecision({
  candles,
  executions,
  decisions,
  decisionId,
}: RecallReplayInput & { decisionId: string }): RecallReplayCursor {
  const decision = decisions.find((candidate) => candidate.id === decisionId);
  if (!decision) throw new Error(`未知复盘决策 ${decisionId}`);
  const first = firstExecution(decision, executions);
  if (!first) throw new Error(`决策 ${decisionId} 没有对应成交`);
  const currentCandle = mapRecallExecutionToCandle(first.execution, candles);
  return result(
    candles,
    executions,
    currentCandle ? candleKnowledgeAt(currentCandle) : first.execution.executedAt,
    first.execution.id,
    "replay",
    currentCandle,
  );
}

export function nextRecallDecisionState({
  candles,
  executions,
  decisions,
  current,
}: RecallReplayInput & { current: RecallReplayCursor }): RecallReplayCursor {
  const ordered = executionOrder(executions);
  const boundary = executionBoundaryForCursor(ordered.map(({ execution }) => execution), current.executionCursor);
  const currentIndex = boundary < 0 ? -1 : boundary;
  const nextDecision = decisions
    .map((decision) => ({ decision, first: firstExecution(decision, executions) }))
    .filter((item): item is { decision: RecallDecision; first: { execution: TradeExecution; index: number } } => Boolean(item.first))
    .find((item) => item.first.index > currentIndex);
  if (!nextDecision) return current;
  const currentCandle = mapRecallExecutionToCandle(nextDecision.first.execution, candles);
  return result(
    candles,
    executions,
    currentCandle ? candleKnowledgeAt(currentCandle) : nextDecision.first.execution.executedAt,
    nextDecision.first.execution.id,
    "replay",
    currentCandle,
  );
}

export function revealRecallBar({
  candles,
  executions,
  current,
}: Pick<RecallReplayInput, "candles" | "executions"> & { current: RecallReplayCursor }): RecallReplayCursor {
  const ordered = sortedCandles(candles);
  const currentIndex = current.currentCandle
    ? ordered.findIndex((candle) => candle.time === current.currentCandle?.time)
    : ordered.findIndex((candle) => candleKnowledgeAt(candle) >= current.cursor);
  const nextCandle = ordered[Math.max(0, currentIndex) + 1];
  if (!nextCandle) return current;

  const mappings = mappedCandleMap(candles, executions);
  const nextIndex = ordered.findIndex((candle) => candle.time === nextCandle.time);
  const throughBar = executionsThroughCursor(executions, candleKnowledgeAt(nextCandle));
  const throughMappedBar = orderedExecutions(executions).filter((execution) => {
    const mapped = mappings.get(execution.id);
    const mappedIndex = mapped ? ordered.findIndex((candle) => candle.time === mapped) : -1;
    return mappedIndex >= 0 && mappedIndex <= nextIndex;
  });
  const revealed = [...new Map([...throughBar, ...throughMappedBar].map((execution) => [execution.id, execution])).values()]
    .sort((left, right) => {
      const l = orderedExecutions(executions).findIndex((execution) => execution.id === left.id);
      const r = orderedExecutions(executions).findIndex((execution) => execution.id === right.id);
      return l - r;
    });
  const last = revealed.at(-1);
  return result(
    candles,
    executions,
    candleKnowledgeAt(nextCandle),
    last?.id ?? current.executionCursor,
    "replay",
    nextCandle,
  );
}

/**
 * Move one complete candle backward while applying the same execution cutoff
 * as forward replay. A market rewind must never leave fills, holdings, or P/L
 * from a later candle visible.
 */
export function rewindRecallBar({
  candles,
  executions,
  current,
}: Pick<RecallReplayInput, "candles" | "executions"> & { current: RecallReplayCursor }): RecallReplayCursor {
  const ordered = sortedCandles(candles);
  const currentIndex = current.currentCandle
    ? ordered.findIndex((candle) => candle.time === current.currentCandle?.time)
    : ordered.findIndex((candle) => candleKnowledgeAt(candle) >= current.cursor);
  const previousCandle = currentIndex > 0 ? ordered[currentIndex - 1] : undefined;
  if (!previousCandle) return current;

  const mappings = mappedCandleMap(candles, executions);
  const previousIndex = currentIndex - 1;
  const throughKnowledge = executionsThroughCursor(executions, candleKnowledgeAt(previousCandle));
  const throughMappedBar = orderedExecutions(executions).filter((execution) => {
    const mapped = mappings.get(execution.id);
    const mappedIndex = mapped ? ordered.findIndex((candle) => candle.time === mapped) : -1;
    return mappedIndex >= 0 && mappedIndex <= previousIndex;
  });
  const throughKnowledgeBeforeNextBar = throughKnowledge.filter((execution) => {
    const mapped = mappings.get(execution.id);
    if (!mapped) return true;
    return ordered.findIndex((candle) => candle.time === mapped) <= previousIndex;
  });
  const revealed = [...new Map([...throughKnowledgeBeforeNextBar, ...throughMappedBar].map((execution) => [execution.id, execution])).values()]
    .sort((left, right) => {
      const l = orderedExecutions(executions).findIndex((execution) => execution.id === left.id);
      const r = orderedExecutions(executions).findIndex((execution) => execution.id === right.id);
      return l - r;
    });

  return result(
    candles,
    executions,
    candleKnowledgeAt(previousCandle),
    revealed.at(-1)?.id ?? NO_REVEALED_EXECUTIONS,
    "replay",
    previousCandle,
  );
}

export function revealRecallHistory(
  candles: Candle[],
  executions: TradeExecution[],
): RecallReplayCursor {
  const orderedCandles = sortedCandles(candles);
  const last = orderedCandles.at(-1);
  const orderedExecutionsList = orderedExecutions(executions);
  return result(
    candles,
    executions,
    last ? candleKnowledgeAt(last) : orderedExecutionsList.at(-1)?.executedAt ?? "",
    orderedExecutionsList.at(-1)?.id ?? "",
    "history",
    last,
  );
}

export function recallExecutionCandleIndex(
  candles: Candle[],
  executions: TradeExecution[],
): Map<string, number> {
  const ordered = sortedCandles(candles);
  const map = mappedCandleMap(candles, executions);
  return new Map(
    executions.map((execution) => [
      execution.id,
      map.has(execution.id)
        ? ordered.findIndex((candle) => candle.time === map.get(execution.id))
        : -1,
    ]),
  );
}
