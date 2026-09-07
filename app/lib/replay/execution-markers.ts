import type { Candle } from "../market/types";
import type { TradeExecution } from "../trades/types";
import { marketTradingDate } from "../market/trading-date";

export type ExecutionCandleMarker = {
  executionId: string;
  candleTime: string;
};

function timestamp(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function mapExecutionsToCandles(
  candles: Candle[],
  executions: TradeExecution[],
): ExecutionCandleMarker[] {
  const sortedCandles = candles
    .map((candle) => ({ candle, time: timestamp(candle.time) }))
    .filter((entry): entry is { candle: Candle; time: number } =>
      entry.time !== null,
    )
    .sort((left, right) => left.time - right.time);

  return executions.flatMap((execution) => {
    // Loaded candles describe the exchange session, not broker grey-market trading.
    if (execution.source.tradingSession === "grey-market") return [];
    const executionTime = timestamp(execution.executedAt);
    if (executionTime === null) return [];

    const candleIndex = sortedCandles.findIndex((entry, index) => {
      // Daily bars represent an exchange date, not just the regular-hours
      // knowledge boundary. After-hours fills belong to that same date.
      if (entry.candle.tradingDates) {
        return entry.candle.tradingDates.includes(marketTradingDate(execution.executedAt, execution.instrument.market));
      }
      const next = sortedCandles[index + 1];
      return (
        entry.time <= executionTime &&
        (entry.candle.knowledgeAt === undefined || executionTime <= Date.parse(entry.candle.knowledgeAt)) &&
        (next === undefined || executionTime < next.time)
      );
    });
    if (candleIndex < 0) return [];

    return [
      {
        executionId: execution.id,
        candleTime: sortedCandles[candleIndex].candle.time,
      },
    ];
  });
}
