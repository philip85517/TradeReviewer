import "server-only";

import { demoCandles15m } from "../../data/demo-market";
import { demoExecutions } from "../../data/demo-trades";
import type {
  DemoReplayFrame,
  DemoReplayMode,
} from "./replay-frame";

export const DEMO_INITIAL_CURSOR_INDEX = 360;

function indexForCursor(cursor?: string | null) {
  if (!cursor) return DEMO_INITIAL_CURSOR_INDEX;
  const exact = demoCandles15m.findIndex(
    (candle) => candle.time === cursor,
  );
  if (exact >= 0) return exact;

  const firstAfter = demoCandles15m.findIndex(
    (candle) => candle.time > cursor,
  );
  return firstAfter <= 0 ? 0 : firstAfter - 1;
}

function nextExecutionIndex(currentIndex: number) {
  const cursor = demoCandles15m[currentIndex].time;
  const execution = demoExecutions.find(
    (candidate) => candidate.executedAt > cursor,
  );
  if (!execution) return Math.min(currentIndex + 1, demoCandles15m.length - 1);
  const index = demoCandles15m.findIndex(
    (candle) => candle.time >= execution.executedAt,
  );
  return index < 0 ? demoCandles15m.length - 1 : index;
}

export function getDemoReplayFrame(input?: {
  cursor?: string | null;
  mode?: DemoReplayMode;
}): DemoReplayFrame {
  const currentIndex = indexForCursor(input?.cursor);
  const mode = input?.mode ?? "restore";
  const cursorIndex =
    mode === "next"
      ? Math.min(currentIndex + 1, demoCandles15m.length - 1)
      : mode === "previous"
        ? Math.max(currentIndex - 1, 0)
        : mode === "next-execution"
          ? nextExecutionIndex(currentIndex)
          : currentIndex;
  const cursor = demoCandles15m[cursorIndex].time;

  return {
    cursorIndex,
    cursor,
    candles15m: demoCandles15m.slice(0, cursorIndex + 1),
    executions: demoExecutions.filter(
      (execution) => execution.executedAt <= cursor,
    ),
    canGoBack: cursorIndex > 0,
    canGoForward: cursorIndex < demoCandles15m.length - 1,
  };
}
