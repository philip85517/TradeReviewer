import { candleKnowledgeAt, type Candle } from "../market/types";
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

export function createImportedReplay(
  input: ImportedReplayInput,
): ImportedReplay {
  const candles = [...input.candles].sort((a, b) =>
    candleKnowledgeAt(a).localeCompare(candleKnowledgeAt(b)),
  );
  const executions = [...input.executions].sort((a, b) =>
    a.executedAt.localeCompare(b.executedAt),
  );
  const firstCandle = candles[0];
  const lastCandle = candles.at(-1);
  const storedCursorIsInRange =
    input.storedCursor !== undefined &&
    firstCandle !== undefined &&
    lastCandle !== undefined &&
    input.storedCursor >= candleKnowledgeAt(firstCandle) &&
    input.storedCursor <= candleKnowledgeAt(lastCandle);
  const currentCursor = storedCursorIsInRange
    ? candleKnowledgeAt(
        candles.findLast(
          (candle) => candleKnowledgeAt(candle) <= input.storedCursor!,
        )!,
      )
    : firstCandle
      ? candleKnowledgeAt(firstCandle)
      : "";
  const currentIndex = candles.findIndex(
    (candle) => candleKnowledgeAt(candle) === currentCursor,
  );

  return {
    currentCursor,
    canGoBack: currentIndex > 0,
    canGoForward: currentIndex >= 0 && currentIndex < candles.length - 1,
    previous: () => {
      const candle = candles[Math.max(currentIndex - 1, 0)];
      return candle ? candleKnowledgeAt(candle) : currentCursor;
    },
    next: () =>
      candles[Math.min(currentIndex + 1, candles.length - 1)]
        ? candleKnowledgeAt(
            candles[Math.min(currentIndex + 1, candles.length - 1)],
          )
        : currentCursor,
    nextExecution: () =>
      executions.find((execution) => execution.executedAt > currentCursor)
        ?.executedAt ?? currentCursor,
    cursorForTimeframe: (nextCandles) => {
      const containing = [...nextCandles]
        .sort((a, b) =>
          candleKnowledgeAt(a).localeCompare(candleKnowledgeAt(b)),
        )
        .findLast((candle) => candleKnowledgeAt(candle) <= currentCursor);
      return containing ? candleKnowledgeAt(containing) : currentCursor;
    },
  };
}
