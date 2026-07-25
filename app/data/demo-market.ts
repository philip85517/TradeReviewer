import type { Candle } from "../lib/market/types";

const BARS_PER_SESSION = 26;
const SESSION_MINUTES = 15;

function nextTradingDay(date: Date) {
  const next = new Date(date);
  do {
    next.setUTCDate(next.getUTCDate() + 1);
  } while (next.getUTCDay() === 0 || next.getUTCDay() === 6);
  return next;
}

export const demoCandles15m: Candle[] = (() => {
  const candles: Candle[] = [];
  let tradingDay = new Date("2025-01-02T14:30:00.000Z");
  let previousClose = 17.24;

  for (let session = 0; session < 52; session += 1) {
    for (let bar = 0; bar < BARS_PER_SESSION; bar += 1) {
      const index = session * BARS_PER_SESSION + bar;
      const time = new Date(
        tradingDay.getTime() + bar * SESSION_MINUTES * 60 * 1000,
      );
      const trend = index * 0.0046;
      const wave = Math.sin(index / 21) * 0.52 + Math.sin(index / 63) * 0.8;
      const pulse = Math.sin(index * 1.71) * 0.09;
      const close = Number((17.1 + trend + wave + pulse).toFixed(2));
      const open = Number(previousClose.toFixed(2));
      const high = Number(
        (Math.max(open, close) + 0.08 + Math.abs(Math.sin(index)) * 0.11).toFixed(2),
      );
      const low = Number(
        (Math.min(open, close) - 0.08 - Math.abs(Math.cos(index)) * 0.09).toFixed(2),
      );

      candles.push({
        time: time.toISOString(),
        open,
        high,
        low,
        close,
        volume: Math.round(42_000 + Math.abs(Math.sin(index / 8)) * 85_000),
      });
      previousClose = close;
    }
    tradingDay = nextTradingDay(tradingDay);
  }

  return candles;
})();

export const demoInitialCursorIndex = 430;
