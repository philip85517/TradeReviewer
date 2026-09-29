import { candleKnowledgeAt, type Candle } from "../market/types";
import { replayCursorAt, replayExecutionAt } from "../import/statement-evidence";
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
  /** Last completed market candle knowledge boundary, independent of execution knowledge. */
  revealedCandleCursor?: string | null;
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

function replayCursorTime(cursor: string) {
  try {
    const parsed = Date.parse(replayCursorAt(cursor));
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  } catch {
    return Number.NaN;
  }
}

function executionKnowledgeTime(execution: TradeExecution) {
  return Date.parse(replayExecutionAt(execution));
}

/** Canonical knowledge boundary used by every Recall consumer. */
export function recallExecutionKnowledgeAt(execution: TradeExecution) {
  return replayExecutionAt(execution);
}

/** Canonical Recall order: knowledge time first, episode/source order on ties. */
export function orderedRecallExecutions(executions: readonly TradeExecution[]) {
  return executions
    .map((execution, index) => ({ execution, index }))
    .sort((left, right) => {
      const leftTime = executionKnowledgeTime(left.execution);
      const rightTime = executionKnowledgeTime(right.execution);
      if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) {
        return leftTime - rightTime;
      }
      if (Number.isFinite(leftTime) !== Number.isFinite(rightTime)) {
        return Number.isFinite(leftTime) ? -1 : 1;
      }
      return left.index - right.index;
    })
    .map(({ execution }) => execution);
}

export function executionBoundaryForCursor(
  executions: readonly TradeExecution[],
  cursor: string,
): number {
  if (cursor === NO_REVEALED_EXECUTIONS) return -1;
  const ordered = orderedRecallExecutions(executions);
  const byId = ordered.findIndex((execution) => execution.id === cursor);
  if (byId >= 0) return byId;
  const cursorTime = replayCursorTime(cursor);
  if (!Number.isFinite(cursorTime)) return -1;
  return ordered.reduce(
    (last, execution, index) =>
      executionKnowledgeTime(execution) <= cursorTime ? index : last,
    -1,
  );
}

/**
 * Persisted drafts can retain an execution id that is beyond their knowledge
 * cursor. Navigation must use the visible prefix as its current boundary;
 * otherwise “next decision” treats a hidden target as already revealed.
 */
function visibleExecutionBoundaryForCursor(
  executions: readonly TradeExecution[],
  executionCursor: string,
  knowledgeCursor: string,
): number {
  const ordered = orderedRecallExecutions(executions);
  const boundary = executionBoundaryForCursor(ordered, executionCursor);
  if (boundary < 0) return -1;
  const cutoff = replayCursorTime(knowledgeCursor);
  if (!Number.isFinite(cutoff)) return -1;
  return ordered
    .slice(0, boundary + 1)
    .findLastIndex((execution) => executionKnowledgeTime(execution) <= cutoff);
}

export function executionsThroughCursor(
  executions: readonly TradeExecution[],
  cursor: string,
): TradeExecution[] {
  const ordered = orderedRecallExecutions(executions);
  const boundary = executionBoundaryForCursor(ordered, cursor);
  return boundary < 0 ? [] : ordered.slice(0, boundary + 1);
}

/**
 * Apply both Recall cutoffs. The execution cursor selects a stable prefix;
 * the knowledge cursor prevents an old draft or a same-bar decision from
 * making a later date-only fill visible early.
 */
export function visibleRecallExecutions(
  executions: readonly TradeExecution[],
  executionCursor: string,
  knowledgeCursor: string,
): TradeExecution[] {
  const ordered = orderedRecallExecutions(executions);
  const boundary = executionBoundaryForCursor(ordered, executionCursor);
  if (boundary < 0) return [];
  const cutoff = replayCursorTime(knowledgeCursor);
  if (!Number.isFinite(cutoff)) return [];
  return ordered
    .slice(0, boundary + 1)
    .filter((execution) => executionKnowledgeTime(execution) <= cutoff);
}

function latestCursor(...cursors: Array<string | undefined>) {
  let latest: string | undefined;
  let latestTime = Number.NEGATIVE_INFINITY;
  for (const cursor of cursors) {
    if (!cursor) continue;
    const time = Date.parse(cursor);
    if (!Number.isFinite(time)) continue;
    if (latest === undefined || time > latestTime) {
      latest = cursor;
      latestTime = time;
    }
  }
  return latest ?? cursors.find((cursor): cursor is string => Boolean(cursor)) ?? "";
}

export function recallMarketCursorForExecution(execution: TradeExecution, candle: Candle | undefined) {
  if (execution.source.timePrecision === "date-only") {
    // A normalized ISO anchor may describe the exchange close; a bare date has
    // no usable instant, so the mapped candle supplies only the market cutoff.
    return execution.executedAt.length === 10
      ? candle ? candleKnowledgeAt(candle) : undefined
      : execution.executedAt;
  }
  return execution.executedAt;
}

function completedCandleAtCursor(candle: Candle | undefined, cursor: string | undefined) {
  if (!candle || !cursor) return undefined;
  const cursorTime = Date.parse(cursor);
  const knowledgeTime = Date.parse(candleKnowledgeAt(candle));
  return Number.isFinite(cursorTime) && Number.isFinite(knowledgeTime) && knowledgeTime <= cursorTime
    ? candle
    : undefined;
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

  // A date-only source can be placed on a daily candle carrying its trading
  // date, but it cannot be assigned to an intraday candle from the normalized
  // `executedAt` anchor. Returning a fallback intraday mapping would recreate
  // the session-close leak this module is responsible for preventing.
  if (
    execution.source.timePrecision === "date-only" ||
    execution.source.sourceTimeKind === "date" ||
    execution.source.sourceTimeKind === "order" ||
    /^\d{4}-\d{2}-\d{2}$/.test(execution.executedAt)
  ) return undefined;

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
  const order = orderedRecallExecutions(executions).map((execution, index) => ({ execution, index }));
  const ids = new Set(decision.executionIds);
  return order.find(({ execution }) => ids.has(execution.id));
}

/**
 * Project market data onto what was knowable at a replay cursor. A persisted
 * cursor can fall inside a bar (for example after an imported execution), so
 * the bar remains useful for time alignment while its future OHLCV fields are
 * withheld until the provider's knowledge boundary.
 */
export function revealableCandlesThroughCursor(candles: Candle[], cursor: string): Candle[] {
  const cursorTime = Date.parse(cursor);
  if (!Number.isFinite(cursorTime)) return [];
  return sortedCandles(candles).filter((candle) => {
    const knowledgeTime = Date.parse(candleKnowledgeAt(candle));
    return Date.parse(candle.time) <= cursorTime && Number.isFinite(knowledgeTime) && knowledgeTime <= cursorTime;
  });
}

function result(
  candles: Candle[],
  executions: TradeExecution[],
  cursor: string,
  executionCursor: string,
  mode: RecallReplayMode = "replay",
  currentCandle?: Candle,
  marketCursor?: string,
): RecallReplayCursor {
  const revealedCandles = mode === "history"
    ? sortedCandles(candles)
    : marketCursor
      ? revealableCandlesThroughCursor(candles, marketCursor)
      : [];
  return {
    cursor,
    executionCursor,
    mode,
    revealedCandleCursor: mode === "history"
      ? revealedCandles.at(-1)
        ? candleKnowledgeAt(revealedCandles.at(-1)!)
        : null
      : marketCursor ?? null,
    currentCandle: mode === "history" ? currentCandle : completedCandleAtCursor(currentCandle, marketCursor),
    revealedCandles,
    revealedExecutions: mode === "history"
      ? orderedRecallExecutions(executions)
      : visibleRecallExecutions(executions, executionCursor, cursor),
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
  const marketCursor = recallMarketCursorForExecution(first.execution, currentCandle);
  return result(
    candles,
    executions,
    latestCursor(currentCandle ? candleKnowledgeAt(currentCandle) : undefined, replayExecutionAt(first.execution)),
    first.execution.id,
    "replay",
    currentCandle,
    marketCursor,
  );
}

export function nextRecallDecisionState({
  candles,
  executions,
  decisions,
  current,
}: RecallReplayInput & { current: RecallReplayCursor }): RecallReplayCursor {
  const ordered = orderedRecallExecutions(executions).map((execution, index) => ({ execution, index }));
  const currentIndex = visibleExecutionBoundaryForCursor(executions, current.executionCursor, current.cursor);
  const nextDecision = decisions
    .map((decision) => ({ decision, first: firstExecution(decision, executions) }))
    .filter((item): item is { decision: RecallDecision; first: { execution: TradeExecution; index: number } } => Boolean(item.first))
    .filter((item) => item.first.index > currentIndex)
    .sort((left, right) => left.first.index - right.first.index)
    .at(0);
  if (!nextDecision) return current;
  const currentCandle = mapRecallExecutionToCandle(nextDecision.first.execution, candles);
  const marketCursor = recallMarketCursorForExecution(nextDecision.first.execution, currentCandle);
  return result(
    candles,
    executions,
    latestCursor(currentCandle ? candleKnowledgeAt(currentCandle) : undefined, replayExecutionAt(nextDecision.first.execution)),
    nextDecision.first.execution.id,
    "replay",
    currentCandle,
    marketCursor,
  );
}

export function previousRecallDecisionState({
  candles,
  executions,
  decisions,
  current,
}: RecallReplayInput & { current: RecallReplayCursor }): RecallReplayCursor {
  const ordered = orderedRecallExecutions(executions).map((execution, index) => ({ execution, index }));
  const visibleBoundary = visibleExecutionBoundaryForCursor(executions, current.executionCursor, current.cursor);
  const persistedBoundary = executionBoundaryForCursor(
    ordered.map(({ execution }) => execution),
    current.executionCursor,
  );
  const currentIndex = current.executionCursor === NO_REVEALED_EXECUTIONS
    ? ordered.length
    : visibleBoundary < 0
      ? persistedBoundary
      : visibleBoundary;
  const previousDecision = decisions
    .map((decision) => ({ decision, first: firstExecution(decision, executions) }))
    .filter((item): item is { decision: RecallDecision; first: { execution: TradeExecution; index: number } } => Boolean(item.first))
    .filter((item) => item.first.index < currentIndex)
    .sort((left, right) => right.first.index - left.first.index)
    .at(0);
  if (!previousDecision) return current;
  const currentCandle = mapRecallExecutionToCandle(previousDecision.first.execution, candles);
  const marketCursor = recallMarketCursorForExecution(previousDecision.first.execution, currentCandle);
  return result(
    candles,
    executions,
    latestCursor(currentCandle ? candleKnowledgeAt(currentCandle) : undefined, replayExecutionAt(previousDecision.first.execution)),
    previousDecision.first.execution.id,
    "replay",
    currentCandle,
    marketCursor,
  );
}

export function revealRecallBar({
  candles,
  executions,
  current,
}: Pick<RecallReplayInput, "candles" | "executions"> & { current: RecallReplayCursor }): RecallReplayCursor {
  const ordered = sortedCandles(candles);
  // A decision may align its chart cursor with a bar's close while its OHLCV
  // remains withheld. Advance from the last actually revealed candle, not
  // that alignment cursor, otherwise the first bar is skipped entirely.
  const lastRevealed = current.revealedCandles.at(-1);
  const currentIndex = lastRevealed
    ? ordered.findIndex((candle) => candle.time === lastRevealed.time)
    : -1;
  const nextCandle = ordered[currentIndex + 1];
  if (!nextCandle) return current;

  const orderedExecutionsList = orderedRecallExecutions(executions);
  const mappings = mappedCandleMap(candles, executions);
  const nextIndex = ordered.findIndex((candle) => candle.time === nextCandle.time);
  const nextKnowledge = candleKnowledgeAt(nextCandle);
  const throughBar = visibleRecallExecutions(executions, nextKnowledge, nextKnowledge);
  const throughMappedBar = orderedExecutionsList.filter((execution) => {
    const mapped = mappings.get(execution.id);
    const mappedIndex = mapped ? ordered.findIndex((candle) => candle.time === mapped) : -1;
    const mappedCandle = mappedIndex >= 0 ? ordered[mappedIndex] : undefined;
    return mappedIndex >= 0 && mappedIndex <= nextIndex && mappedCandle !== undefined &&
      executionKnowledgeTime(execution) <= Date.parse(candleKnowledgeAt(mappedCandle));
  });
  const revealed = [...new Map([...throughBar, ...throughMappedBar].map((execution) => [execution.id, execution])).values()]
    .sort((left, right) => {
      const l = orderedExecutionsList.findIndex((execution) => execution.id === left.id);
      const r = orderedExecutionsList.findIndex((execution) => execution.id === right.id);
      return l - r;
    });
  const last = revealed.at(-1);
  return result(
    candles,
    executions,
    nextKnowledge,
    last?.id ?? current.executionCursor,
    "replay",
    nextCandle,
    nextKnowledge,
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
    : ordered.findLastIndex((candle) => Date.parse(candleKnowledgeAt(candle)) <= Date.parse(current.cursor));
  const previousCandle = currentIndex > 0 ? ordered[currentIndex - 1] : undefined;
  if (!previousCandle) {
    return result(candles, executions, current.cursor, NO_REVEALED_EXECUTIONS, "replay", undefined, undefined);
  }

  const orderedExecutionsList = orderedRecallExecutions(executions);
  const mappings = mappedCandleMap(candles, executions);
  const previousIndex = currentIndex - 1;
  const previousKnowledge = candleKnowledgeAt(previousCandle);
  const throughKnowledge = visibleRecallExecutions(executions, previousKnowledge, previousKnowledge);
  const throughMappedBar = orderedExecutionsList.filter((execution) => {
    const mapped = mappings.get(execution.id);
    const mappedIndex = mapped ? ordered.findIndex((candle) => candle.time === mapped) : -1;
    const mappedCandle = mappedIndex >= 0 ? ordered[mappedIndex] : undefined;
    return mappedIndex >= 0 && mappedIndex <= previousIndex && mappedCandle !== undefined &&
      executionKnowledgeTime(execution) <= Date.parse(candleKnowledgeAt(mappedCandle));
  });
  const throughKnowledgeBeforeNextBar = throughKnowledge.filter((execution) => {
    const mapped = mappings.get(execution.id);
    if (!mapped) return true;
    return ordered.findIndex((candle) => candle.time === mapped) <= previousIndex;
  });
  const revealed = [...new Map([...throughKnowledgeBeforeNextBar, ...throughMappedBar].map((execution) => [execution.id, execution])).values()]
    .sort((left, right) => {
      const l = orderedExecutionsList.findIndex((execution) => execution.id === left.id);
      const r = orderedExecutionsList.findIndex((execution) => execution.id === right.id);
      return l - r;
    });

  return result(
    candles,
    executions,
    previousKnowledge,
    revealed.at(-1)?.id ?? NO_REVEALED_EXECUTIONS,
    "replay",
    previousCandle,
    previousKnowledge,
  );
}

export function revealRecallHistory(
  candles: Candle[],
  executions: TradeExecution[],
): RecallReplayCursor {
  const orderedCandles = sortedCandles(candles);
  const last = orderedCandles.at(-1);
  const orderedExecutionsList = orderedRecallExecutions(executions);
  return result(
    candles,
    executions,
    last ? candleKnowledgeAt(last) : orderedExecutionsList.at(-1) ? recallExecutionKnowledgeAt(orderedExecutionsList.at(-1)!) : "",
    orderedExecutionsList.at(-1)?.id ?? "",
    "history",
    last,
    undefined,
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
