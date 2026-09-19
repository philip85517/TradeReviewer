import type { Candle } from "../market/types";
import { tradeScopeKey, type TradeExecution } from "../trades/types";
import { marketTradingDate } from "../market/trading-date";

export type ExecutionCandleMarker = {
  executionId: string;
  candleTime: string;
};

export type ExecutionCandleGroup = {
  candleTime: string;
  side: TradeExecution["side"];
  accountId: string;
  scopeKey: string;
  executionIds: string[];
  executions: TradeExecution[];
  /** Number of source execution records represented by this visual marker. */
  fillCount: number;
};

function timestamp(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Parse a source-provided calendar date without interpreting it in UTC. */
function sourceCalendarDate(value: string | undefined) {
  const text = value?.trim() ?? "";
  const match = /^(\d{4})(?:[-/年]\s*)(\d{1,2})(?:[-/月]\s*)(\d{1,2})/.exec(text) ??
    /^(\d{4})(\d{2})(\d{2})/.exec(text);
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) return undefined;
  return `${match[1]}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function mapExecutionsToCandles(
  candles: readonly Candle[],
  executions: readonly TradeExecution[],
): ExecutionCandleMarker[] {
  const sortedCandles = candles
    .map((candle) => ({ candle, time: timestamp(candle.time) }))
    .filter((entry): entry is { candle: Candle; time: number } =>
      entry.time !== null,
    )
    .sort((left, right) => left.time - right.time);

  return executions.flatMap((execution) => {
    const candleTime = mapExecutionToCandleFromSorted(sortedCandles, execution);
    return candleTime === undefined
      ? []
      : [{ executionId: execution.id, candleTime }];
  });
}

function mapExecutionToCandleFromSorted(
  sortedCandles: Array<{ candle: Candle; time: number }>,
  execution: TradeExecution,
): string | undefined {
    // Loaded candles describe the exchange session, not broker grey-market trading.
    if (execution.source.tradingSession === "grey-market") return undefined;
    const executionTime = timestamp(execution.executedAt);
    if (executionTime === null) return undefined;

    const dateOnly = execution.source.timePrecision === "date-only" ||
      execution.source.sourceTimeKind === "date" ||
      execution.source.sourceTimeKind === "order" ||
      /^\d{4}-\d{2}-\d{2}$/.test(execution.executedAt);
    // Prefer source/exchange dates. For date-only rows, the source text and
    // date-shaped executedAt are wall-calendar values, so interpreting them
    // through UTC first can move a US/HK trade to the prior trading day.
    const sourceDate = execution.source.marketCalendarDate ??
      execution.source.tradingDate ??
      (dateOnly ? sourceCalendarDate(execution.source.sourceTimestampText) : undefined) ??
      (dateOnly && /^\d{4}-\d{2}-\d{2}$/.test(execution.executedAt)
        ? execution.executedAt
        : undefined) ??
      marketTradingDate(execution.executedAt, execution.instrument.market);

    const candleIndex = sortedCandles.findIndex((entry, index) => {
      // Daily bars represent an exchange date, not just the regular-hours
      // knowledge boundary. After-hours fills belong to that same date.
      if (entry.candle.tradingDates) {
        return entry.candle.tradingDates.includes(sourceDate);
      }
      // A date-only source has no reliable intraday instant. Intraday views
      // must fall back to a daily bar instead of inventing an opening time.
      if (dateOnly) {
        return false;
      }
      const next = sortedCandles[index + 1];
      return (
        entry.time <= executionTime &&
        (entry.candle.knowledgeAt === undefined || executionTime < Date.parse(entry.candle.knowledgeAt)) &&
        (next === undefined || executionTime < next.time)
      );
    });
    return candleIndex < 0 ? undefined : sortedCandles[candleIndex].candle.time;
}

/** Resolve one execution to one visible candle, preserving a missing result. */
export function mapExecutionToCandle(
  candles: readonly Candle[],
  execution: TradeExecution,
): string | undefined {
  const sortedCandles = candles
    .map((candle) => ({ candle, time: timestamp(candle.time) }))
    .filter((entry): entry is { candle: Candle; time: number } =>
      entry.time !== null,
    )
    .sort((left, right) => left.time - right.time);
  return mapExecutionToCandleFromSorted(sortedCandles, execution);
}

/**
 * Group visual markers without changing the source execution ledger. The
 * group key intentionally includes candle time and side so a buy and sell on
 * one bar remain two independently locatable markers.
 */
export function groupExecutionsByCandle(
  candles: readonly Candle[],
  executions: readonly TradeExecution[],
): ExecutionCandleGroup[] {
  const mapped = new Map(
    mapExecutionsToCandles(candles, executions).map((marker) => [
      marker.executionId,
      marker.candleTime,
    ]),
  );
  const groups = new Map<string, ExecutionCandleGroup>();
  for (const execution of executions) {
    const candleTime = mapped.get(execution.id);
    if (!candleTime) continue;
    const scopeKey = tradeScopeKey(execution);
    const key = `${candleTime}:${execution.side}:${execution.accountId}:${scopeKey}`;
    const existing = groups.get(key);
    if (existing) {
      existing.executionIds.push(execution.id);
      existing.executions.push(execution);
      existing.fillCount += 1;
      continue;
    }
    groups.set(key, {
      candleTime,
      side: execution.side,
      accountId: execution.accountId,
      scopeKey,
      executionIds: [execution.id],
      executions: [execution],
      fillCount: 1,
    });
  }
  return [...groups.values()].sort((left, right) =>
    left.candleTime.localeCompare(right.candleTime) ||
    left.side.localeCompare(right.side),
  );
}
