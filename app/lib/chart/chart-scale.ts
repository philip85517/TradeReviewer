import type { Candle } from "../market/types";

export function priceRangeForCandles(candles: Candle[]) {
  if (candles.length === 0) {
    return { minPrice: 0, maxPrice: 1, priceRange: 1 };
  }

  const prices = candles.flatMap((candle) => [candle.high, candle.low]);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);

  return {
    minPrice,
    maxPrice,
    priceRange: Math.max(maxPrice - minPrice, 0.01),
  };
}

export function containingCandleTime(
  candles: Candle[],
  anchorTime: string,
) {
  if (candles.length === 0) return anchorTime;
  return (
    candles.findLast((candle) => candle.time <= anchorTime)?.time ??
    candles[0].time
  );
}
