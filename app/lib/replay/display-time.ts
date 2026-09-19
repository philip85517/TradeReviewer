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
    // A source instant before the loaded window must remain unmatched. Using
    // the first candle would silently move a fill to an unrelated day.
    return ordered.filter(candle => candle.time <= input.at).at(-1)?.time;
  }

  const anchor = input.calendarDate ?? input.at.slice(0, 10);
  const first = anchor.length === 7
    ? ordered.find(candle => candle.time.slice(0, 7) === anchor)
    : ordered.find(candle => datePart(candle.time) === anchor);
  if (first) return first.time;

  // A legacy month-only statement event can arrive with a representative day
  // in `at` but without `calendarDate`. Preserve the month anchor for those
  // events; fill location uses the strict execution-marker mapper above.
  if (!input.calendarDate && anchor.length === 10) {
    return ordered.find(candle => candle.time.slice(0, 7) === anchor.slice(0, 7))?.time;
  }

  // Sparse history has no evidence for this source date. Leave the marker
  // unmatched so the caller can request a daily fallback or show the gap.
  return undefined;
}
