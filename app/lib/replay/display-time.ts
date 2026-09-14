import type { Candle } from "../market/types";

export type DisplayTimePolicy = "execution-time" | "session-open";

type CandleTime = Pick<Candle, "time">;

function datePart(value: string) {
  return value.slice(0, 10);
}

/**
 * Maps source evidence to a chart candle without changing the canonical event
 * time. Session-open evidence is deliberately anchored by trading date/month,
 * so an IPO allotment or OTC fill remains visible even when its source clock
 * is outside the regular exchange session.
 */
export function displayTimeForCandle(
  candles: readonly CandleTime[],
  input: { at: string; policy?: DisplayTimePolicy; calendarDate?: string },
): string | undefined {
  if (!candles.length) return undefined;
  const ordered = [...candles].sort((left, right) => left.time.localeCompare(right.time));
  if (input.policy !== "session-open") {
    return ordered.filter(candle => candle.time <= input.at).at(-1)?.time ?? ordered[0].time;
  }

  const anchor = input.calendarDate ?? input.at.slice(0, 10);
  const first = anchor.length === 7
    ? ordered.find(candle => candle.time.slice(0, 7) === anchor)
    : ordered.find(candle => datePart(candle.time) === anchor);
  if (first) return first.time;

  // Sparse market history may start after the source date. Keep the event
  // visible at the nearest future candle rather than dropping the marker.
  return ordered.find(candle => candle.time.slice(0, anchor.length) >= anchor)?.time ?? ordered[0].time;
}
