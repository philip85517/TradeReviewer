import "server-only";

import { demoCandles15m } from "../../data/demo-market";
import { demoExecutions } from "../../data/demo-trades";
import { candleKnowledgeAt } from "../market/types";
import type {
  DemoReplayFrame,
  DemoReplayMode,
} from "./replay-frame";

export const DEMO_INITIAL_CURSOR_INDEX = 360;

function timestamp(value: string) {
  return Date.parse(value);
}

function restoredCursor(cursor?: string | null) {
  const defaultCursor = candleKnowledgeAt(
    demoCandles15m[DEMO_INITIAL_CURSOR_INDEX],
  );
  if (!cursor || !Number.isFinite(timestamp(cursor))) return defaultCursor;

  const firstBarStart = timestamp(demoCandles15m[0].time);
  const lastCompletion = timestamp(candleKnowledgeAt(demoCandles15m.at(-1)!));
  const requested = timestamp(cursor);
  if (requested < firstBarStart || requested > lastCompletion) {
    return defaultCursor;
  }
  return cursor;
}

function adjacentCompletion(cursor: string, direction: "next" | "previous") {
  const cursorTime = timestamp(cursor);
  const candidate =
    direction === "next"
      ? demoCandles15m.find(
          (candle) => timestamp(candleKnowledgeAt(candle)) > cursorTime,
        )
      : demoCandles15m.findLast(
          (candle) => timestamp(candleKnowledgeAt(candle)) < cursorTime,
        );
  return candidate ? candleKnowledgeAt(candidate) : cursor;
}

function nextExecutionCursor(cursor: string) {
  const cursorTime = timestamp(cursor);
  const execution = demoExecutions.find(
    (candidate) => timestamp(candidate.executedAt) > cursorTime,
  );
  return execution?.executedAt ?? adjacentCompletion(cursor, "next");
}

export function getDemoReplayFrame(input?: {
  cursor?: string | null;
  mode?: DemoReplayMode;
}): DemoReplayFrame {
  const restored = restoredCursor(input?.cursor);
  const mode = input?.mode ?? "restore";
  const cursor =
    mode === "next"
      ? adjacentCompletion(restored, "next")
      : mode === "previous"
        ? adjacentCompletion(restored, "previous")
        : mode === "next-execution"
          ? nextExecutionCursor(restored)
          : restored;
  const cursorTime = timestamp(cursor);
  const cursorIndex = demoCandles15m.findLastIndex(
    (candle) => timestamp(candleKnowledgeAt(candle)) <= cursorTime,
  );

  return {
    cursorIndex,
    cursor,
    candles15m: demoCandles15m.slice(0, cursorIndex + 1),
    executions: demoExecutions.filter(
      (execution) => timestamp(execution.executedAt) <= cursorTime,
    ),
    canGoBack: demoCandles15m.some(
      (candle) => timestamp(candleKnowledgeAt(candle)) < cursorTime,
    ),
    canGoForward: demoCandles15m.some(
      (candle) => timestamp(candleKnowledgeAt(candle)) > cursorTime,
    ),
  };
}
