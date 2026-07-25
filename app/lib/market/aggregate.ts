import type { Candle, Timeframe } from "./types";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

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
): Candle[] {
  if (timeframe === "15m") return candles.map((candle) => ({ ...candle }));

  const sorted = [...candles].sort((a, b) => a.time.localeCompare(b.time));
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
