import type { Candle } from "../market/types";
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
    a.time.localeCompare(b.time),
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
    input.storedCursor >= firstCandle.time &&
    input.storedCursor <= lastCandle.time;
  const currentCursor = storedCursorIsInRange
    ? candles.findLast((candle) => candle.time <= input.storedCursor!)!.time
    : firstCandle?.time ?? "";
  const currentIndex = candles.findIndex(
    (candle) => candle.time === currentCursor,
  );

  return {
    currentCursor,
    canGoBack: currentIndex > 0,
    canGoForward: currentIndex >= 0 && currentIndex < candles.length - 1,
    previous: () => candles[Math.max(currentIndex - 1, 0)]?.time ?? currentCursor,
    next: () =>
      candles[Math.min(currentIndex + 1, candles.length - 1)]?.time ??
      currentCursor,
    nextExecution: () =>
      executions.find((execution) => execution.executedAt > currentCursor)
        ?.executedAt ?? currentCursor,
    cursorForTimeframe: (nextCandles) =>
      [...nextCandles]
        .sort((a, b) => a.time.localeCompare(b.time))
        .findLast((candle) => candle.time <= currentCursor)?.time ??
      currentCursor,
  };
}
