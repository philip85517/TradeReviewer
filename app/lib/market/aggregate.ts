import { marketTradingDate } from "./trading-date";
import type { NativeMarketInterval } from "./contracts";
import type { Candle, Timeframe } from "./types";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const INTERVAL_RANK: Record<Timeframe, number> = {
  "15m": 0,
  "1h": 1,
  "4h": 2,
  "1D": 3,
  "1W": 4,
};

type AggregationOptions = {
  sourceInterval?: NativeMarketInterval;
  market?: string;
};

function bucketStart(timestamp: number, timeframe: Timeframe) {
  if (timeframe === "15m") return timestamp;
  if (timeframe === "1h") return Math.floor(timestamp / HOUR) * HOUR;
  if (timeframe === "4h") return Math.floor(timestamp / (4 * HOUR)) * 4 * HOUR;
  if (timeframe === "1D") return Math.floor(timestamp / DAY) * DAY;

  const date = new Date(timestamp);
  const dayFromMonday = (date.getUTCDay() + 6) % 7;
  return Math.floor(timestamp / DAY) * DAY - dayFromMonday * DAY;
}

export function aggregateCandles(
  candles: Candle[],
  timeframe: Timeframe,
  options?: AggregationOptions,
): Candle[] {
  if (
    options?.sourceInterval &&
    INTERVAL_RANK[options.sourceInterval] > INTERVAL_RANK[timeframe]
  ) {
    throw new Error(`不能从 ${options.sourceInterval} 生成 ${timeframe}`);
  }

  if (timeframe === "15m") return candles.map((candle) => ({ ...candle }));

  const sorted = [...candles].sort((a, b) => a.time.localeCompare(b.time));

  if (
    options?.sourceInterval === "15m" &&
    (timeframe === "1h" || timeframe === "4h")
  ) {
    const count = timeframe === "1h" ? 4 : 16;
    const byTradingDate = new Map<string, Candle[]>();
    for (const candle of sorted) {
      const tradingDate = marketTradingDate(candle.time, options.market ?? "UTC");
      const group = byTradingDate.get(tradingDate) ?? [];
      group.push(candle);
      byTradingDate.set(tradingDate, group);
    }

    return [...byTradingDate.values()].flatMap((candlesForDate) =>
      Array.from(
        { length: Math.ceil(candlesForDate.length / count) },
        (_, index) => aggregateGroup(candlesForDate.slice(index * count, (index + 1) * count)),
      ),
    );
  }

  const result: Candle[] = [];

  for (const candle of sorted) {
    const start = bucketStart(new Date(candle.time).getTime(), timeframe);
    const time = new Date(start).toISOString();
    const previous = result.at(-1);

    if (!previous || previous.time !== time) {
      result.push({ ...candle, time });
      continue;
    }

    previous.high = Math.max(previous.high, candle.high);
    previous.low = Math.min(previous.low, candle.low);
    previous.close = candle.close;
    previous.volume += candle.volume;
  }

  return result;
}

function aggregateGroup(candles: Candle[]): Candle {
  const [first, ...rest] = candles;
  const aggregated = { ...first };
  for (const candle of rest) {
    aggregated.high = Math.max(aggregated.high, candle.high);
    aggregated.low = Math.min(aggregated.low, candle.low);
    aggregated.close = candle.close;
    aggregated.volume += candle.volume;
  }
  return aggregated;
}
