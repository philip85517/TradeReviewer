import type { DailyCandleRecord, MarketCandleRecord } from "./contracts";

export type Timeframe = "15m" | "1h" | "4h" | "1D" | "1W";

export type Candle = {
  time: string;
  knowledgeAt?: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

const FIFTEEN_MINUTES = 15 * 60 * 1000;

export function candleKnowledgeAt(candle: Candle) {
  return candle.knowledgeAt ?? candle.time;
}

export function dailyRecordToChartCandle(
  record: DailyCandleRecord,
): Candle {
  return {
    time: `${record.tradingDate}T00:00:00.000Z`,
    knowledgeAt: `${record.tradingDate}T23:59:59.999Z`,
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
  const knowledgeAt =
    record.knowledgeAt ??
    (record.interval === "15m"
      ? new Date(Date.parse(record.timestamp) + FIFTEEN_MINUTES).toISOString()
      : `${record.timestamp.slice(0, 10)}T23:59:59.999Z`);
  return {
    time: record.timestamp,
    knowledgeAt,
    open: Number(record.open),
    high: Number(record.high),
    low: Number(record.low),
    close: Number(record.close),
    volume: Number(record.volume),
  };
}
