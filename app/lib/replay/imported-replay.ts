import { candleKnowledgeAt, type Candle } from "../market/types";
import { replayExecutionAt } from "../import/statement-evidence";
import type { TradeExecution } from "../trades/types";

export type ImportedReplay = {
  currentCursor: string;
  canGoBack: boolean;
  canGoForward: boolean;
  previous(): string;
  next(): string;
  nextExecution(): string;
  cursorForTimeframe(nextCandles: Candle[]): string;
};

type ImportedReplayInput = {
  candles: Candle[];
  executions: TradeExecution[];
  storedCursor?: string;
};

/**
 * Complete history must advance through the knowledge timestamp of a
 * date-only execution. Its stored execution timestamp is only a display
 * anchor and must not hide the row before the source date is complete.
 */
export function latestImportedHistoryCursor(
  storedCursor: string,
  candles: readonly Candle[],
  executions: readonly TradeExecution[],
): string {
  return [
    storedCursor,
    ...candles.map(candleKnowledgeAt),
    ...executions.map(replayExecutionAt),
  ].sort((left, right) => Date.parse(left) - Date.parse(right)).at(-1) ?? storedCursor;
}

export function createImportedReplay(
  input: ImportedReplayInput,
): ImportedReplay {
  const candles = [...input.candles].sort((a, b) =>
    Date.parse(candleKnowledgeAt(a)) - Date.parse(candleKnowledgeAt(b)),
  );
  const executions = [...input.executions].sort((a, b) =>
    Date.parse(a.executedAt) - Date.parse(b.executedAt),
  );
  const firstCandle = candles[0];
  const lastCandle = candles.at(-1);
  const storedCursorTime = input.storedCursor
    ? Date.parse(input.storedCursor)
    : Number.NaN;
  const storedCursorIsInRange =
    input.storedCursor !== undefined &&
    firstCandle !== undefined &&
    lastCandle !== undefined &&
    Number.isFinite(storedCursorTime) &&
    storedCursorTime >= Date.parse(firstCandle.time) &&
    storedCursorTime <= Date.parse(candleKnowledgeAt(lastCandle));
  const currentCursor = storedCursorIsInRange
    ? input.storedCursor!
    : firstCandle
      ? candleKnowledgeAt(firstCandle)
      : "";
  const currentCursorTime = Date.parse(currentCursor);
  const previousCandle = candles.findLast(
    (candle) => Date.parse(candleKnowledgeAt(candle)) < currentCursorTime,
  );
  const nextCandle = candles.find(
    (candle) => Date.parse(candleKnowledgeAt(candle)) > currentCursorTime,
  );

  return {
    currentCursor,
    canGoBack: previousCandle !== undefined,
    canGoForward: nextCandle !== undefined,
    previous: () =>
      previousCandle ? candleKnowledgeAt(previousCandle) : currentCursor,
    next: () => (nextCandle ? candleKnowledgeAt(nextCandle) : currentCursor),
    nextExecution: () =>
      executions.find(
        (execution) => Date.parse(execution.executedAt) > currentCursorTime,
      )?.executedAt ?? currentCursor,
    cursorForTimeframe: (nextCandles) => {
      const containing = [...nextCandles]
        .sort((a, b) =>
          Date.parse(candleKnowledgeAt(a)) -
          Date.parse(candleKnowledgeAt(b)),
        )
        .findLast(
          (candle) =>
            Date.parse(candleKnowledgeAt(candle)) <= currentCursorTime,
        );
      return containing ? candleKnowledgeAt(containing) : currentCursor;
    },
  };
}
