import type { DailyCandleRecord, MarketCandleRecord } from "./contracts";

export type Timeframe = "15m" | "1h" | "4h" | "1D" | "1W";

export type Candle = {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export function dailyRecordToChartCandle(
  record: DailyCandleRecord,
): Candle {
  return {
    time: `${record.tradingDate}T00:00:00.000Z`,
    open: Number(record.open),
    high: Number(record.high),
    low: Number(record.low),
    close: Number(record.close),
    volume: Number(record.volume),
  };
}

export function marketRecordToChartCandle(
  record: MarketCandleRecord,
): Candle {
  return {
    time: record.timestamp,
    open: Number(record.open),
    high: Number(record.high),
    low: Number(record.low),
    close: Number(record.close),
    volume: Number(record.volume),
  };
}
