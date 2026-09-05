import { expectedTradingDates } from "./calendar";
import type {
  CoverageSegment,
  DailyCandleRecord,
  SupportedMarket,
} from "./contracts";
import type { DateRange } from "./coverage-planner";

/** Coverage metadata must not claim a session for which no bar is stored. */
export function reconcileDailyCoverage(
  market: SupportedMarket, required: DateRange,
  coverage: CoverageSegment[], candles: readonly DailyCandleRecord[],
) {
  const dates = new Set(candles.map(c => c.tradingDate));
  return coverage.map(segment => {
    if (segment.status !== "complete") return segment;
    const start = segment.startDate > required.startDate ? segment.startDate : required.startDate;
    const end = segment.endDate < required.endDate ? segment.endDate : required.endDate;
    if (start > end) return segment;
    try {
      const missing = expectedTradingDates(market, start, end).filter(date => !dates.has(date));
      return missing.length ? { ...segment, status: "partial" as const, missingTradingDates: missing, reason: undefined } : segment;
    } catch {
      return segment;
    }
  });
}

/** Short missing suffixes get a pending-tail label, never a completeness claim. */
export const MAX_PROVIDER_LATEST_TAIL_DATES = 5;

/**
 * The legacy reason name is retained for persisted records. It means pending
 * tail only: neither these dates nor their count prove provider availability.
 * A missing date is only reclassified when every missing session is after the
 * last candle already stored for that requested segment.
 */
export function normalizeProviderLatestTails(
  market: SupportedMarket,
  coverage: CoverageSegment[],
  candles: readonly DailyCandleRecord[],
) {
  return coverage.map((segment) => {
    if (
      segment.status !== "partial" ||
      segment.reason !== undefined ||
      segment.missingTradingDates.length === 0 ||
      segment.missingTradingDates.length > MAX_PROVIDER_LATEST_TAIL_DATES
    ) {
      return segment;
    }

    let expectedDates: string[];
    try {
      expectedDates = expectedTradingDates(
        market,
        segment.startDate,
        segment.endDate,
      );
    } catch {
      return segment;
    }

    const candleDates = new Set(
      candles
        .filter(
          (candle) =>
            candle.tradingDate >= segment.startDate &&
            candle.tradingDate <= segment.endDate,
        )
        .map((candle) => candle.tradingDate),
    );
    const missingTradingDates = expectedDates.filter(
      (date) => !candleDates.has(date),
    );
    const actualEndDate = [...candleDates].sort().at(-1);
    if (
      actualEndDate === undefined ||
      missingTradingDates.length === 0 ||
      missingTradingDates.length > MAX_PROVIDER_LATEST_TAIL_DATES ||
      !missingTradingDates.every((date) => date > actualEndDate)
    ) {
      return segment;
    }

    return {
      ...segment,
      actualEndDate,
      missingTradingDates,
      reason: "provider-latest-available",
    };
  });
}
