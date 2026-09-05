import type { DailyCandleRecord, MarketCandleRecord } from "./contracts";
import { marketTimeZone } from "./trading-date";
import { marketLocalTimestampToIso } from "./providers/errors";

export type Timeframe = "15m" | "1h" | "4h" | "1D" | "1W";

export type Candle = {
  time: string;
  knowledgeAt?: string;
  /** Actual exchange dates represented by a daily/weekly bar, including gaps. */
  tradingDates?: string[];
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

const FIFTEEN_MINUTES = 15 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;

export function candleKnowledgeAt(candle: Candle) {
  return candle.knowledgeAt ?? candle.time;
}

export function dailyRecordToChartCandle(
  record: DailyCandleRecord,
): Candle {
  const market = record.instrumentId.split(":")[0];
  // Conservative regular-session cutoff (HK includes closing auction).
  // Early-close sessions remain hidden until this cutoff, never revealed early.
  const close = market === "HK" ? "16:10:00" : market.startsWith("CN-") ? "15:00:00" : "16:00:00";
  return {
    time: `${record.tradingDate}T00:00:00.000Z`,
    tradingDates: [record.tradingDate],
    knowledgeAt: marketLocalTimestampToIso(`${record.tradingDate} ${close}`, marketTimeZone(market)),
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
      : record.interval === "1h"
        ? new Date(Date.parse(record.timestamp) + ONE_HOUR).toISOString()
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
