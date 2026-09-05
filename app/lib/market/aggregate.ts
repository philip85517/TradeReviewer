import { marketTradingDate } from "./trading-date";
import type { NativeMarketInterval } from "./contracts";
import { marketLocalTimestampToIso } from "./providers/errors";
import { candleKnowledgeAt, type Candle, type Timeframe } from "./types";

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

type Session = {
  startMinute: number;
  endMinute: number;
};

const MARKET_TIME_ZONES: Record<string, string> = {
  US: "America/New_York",
  HK: "Asia/Hong_Kong",
  "CN-SH": "Asia/Shanghai",
  "CN-SZ": "Asia/Shanghai",
};

const MARKET_SESSIONS: Record<string, Session[]> = {
  US: [{ startMinute: 9 * 60 + 30, endMinute: 16 * 60 }],
  HK: [
    { startMinute: 9 * 60 + 30, endMinute: 12 * 60 },
    { startMinute: 13 * 60, endMinute: 16 * 60 },
  ],
  "CN-SH": [
    { startMinute: 9 * 60 + 30, endMinute: 11 * 60 + 30 },
    { startMinute: 13 * 60, endMinute: 15 * 60 },
  ],
  "CN-SZ": [
    { startMinute: 9 * 60 + 30, endMinute: 11 * 60 + 30 },
    { startMinute: 13 * 60, endMinute: 15 * 60 },
  ],
};

function localDateTimeParts(timestamp: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(timestamp));
  return Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
}

function intradayBucket(candle: Candle, timeframe: "1h" | "4h", market: string) {
  const normalizedMarket = market.toUpperCase();
  const timeZone = MARKET_TIME_ZONES[normalizedMarket] ?? "UTC";
  const parts = localDateTimeParts(candle.time, timeZone);
  const minute = Number(parts.hour) * 60 + Number(parts.minute);
  const sessions = MARKET_SESSIONS[normalizedMarket] ?? [
    { startMinute: 0, endMinute: 24 * 60 },
  ];
  const sessionIndex = sessions.findIndex(
    (session) => minute >= session.startMinute && minute < session.endMinute,
  );
  const session = sessionIndex >= 0 ? sessions[sessionIndex] : undefined;
  const bucketMinutes = timeframe === "1h" ? 60 : 240;
  const fallbackOffset = (sessions[0]?.startMinute ?? 0) % 60;
  const bucketMinute = session
    ? session.startMinute +
      Math.floor((minute - session.startMinute) / bucketMinutes) * bucketMinutes
    : Math.max(
        0,
        fallbackOffset +
          Math.floor((minute - fallbackOffset) / bucketMinutes) * bucketMinutes,
      );
  const hour = Math.floor(bucketMinute / 60);
  const minuteWithinHour = bucketMinute % 60;
  const localTimestamp = `${parts.year}-${parts.month}-${parts.day} ${String(hour).padStart(2, "0")}:${String(minuteWithinHour).padStart(2, "0")}:00`;
  return {
    key: `${parts.year}-${parts.month}-${parts.day}:${sessionIndex}:${bucketMinute}`,
    time: marketLocalTimestampToIso(localTimestamp, timeZone),
  };
}

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
    (options?.sourceInterval === "15m" || options?.sourceInterval === "1h") &&
    !["15m", "1h", "4h"].includes(timeframe)
  ) {
    throw new Error(`不能从 ${options.sourceInterval} 生成 ${timeframe}`);
  }

  if (
    options?.sourceInterval &&
    INTERVAL_RANK[options.sourceInterval] > INTERVAL_RANK[timeframe]
  ) {
    throw new Error(`不能从 ${options.sourceInterval} 生成 ${timeframe}`);
  }

  if (timeframe === "15m") return candles.map((candle) => ({ ...candle }));

  const sorted = [...candles].sort((a, b) => a.time.localeCompare(b.time));

  if (options?.sourceInterval === "1h" && timeframe === "1h") {
    return sorted.map((candle) => ({ ...candle }));
  }

  if (
    (options?.sourceInterval === "15m" || options?.sourceInterval === "1h") &&
    (timeframe === "1h" || timeframe === "4h")
  ) {
    const groups = new Map<string, { time: string; candles: Candle[] }>();
    for (const candle of sorted) {
      const tradingDate = marketTradingDate(
        candle.time,
        options.market ?? "UTC",
      );
      const bucket = intradayBucket(
        candle,
        timeframe,
        options.market ?? "UTC",
      );
      const key = `${tradingDate}:${bucket.key}`;
      const group = groups.get(key) ?? { time: bucket.time, candles: [] };
      group.candles.push(candle);
      groups.set(key, group);
    }

    return [...groups.values()]
      .sort((left, right) => left.time.localeCompare(right.time))
      .flatMap((group) =>
        splitAtMissingSourceBars(
          group.candles,
          options.sourceInterval === "1h" ? HOUR : 15 * 60 * 1000,
        ).map((segment, index) =>
          aggregateGroup(segment, index === 0 ? group.time : segment[0].time),
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
    if (candle.tradingDates) previous.tradingDates = [...(previous.tradingDates ?? []), ...candle.tradingDates];
    if (candle.knowledgeAt !== undefined || previous.knowledgeAt !== undefined) {
      previous.knowledgeAt =
        candleKnowledgeAt(candle) > candleKnowledgeAt(previous)
          ? candleKnowledgeAt(candle)
          : candleKnowledgeAt(previous);
    }
  }

  return result;
}

function splitAtMissingSourceBars(candles: Candle[], sourceMilliseconds: number) {
  const segments: Candle[][] = [];
  for (const candle of candles) {
    const segment = segments.at(-1);
    const previous = segment?.at(-1);
    if (
      !segment ||
      !previous ||
      Date.parse(candle.time) - Date.parse(previous.time) !== sourceMilliseconds
    ) {
      segments.push([candle]);
    } else {
      segment.push(candle);
    }
  }
  return segments;
}

function aggregateGroup(candles: Candle[], time = candles[0]?.time): Candle {
  const [first, ...rest] = candles;
  const aggregated = { ...first, time };
  for (const candle of rest) {
    aggregated.high = Math.max(aggregated.high, candle.high);
    aggregated.low = Math.min(aggregated.low, candle.low);
    aggregated.close = candle.close;
    aggregated.volume += candle.volume;
    if (candle.tradingDates) aggregated.tradingDates = [...(aggregated.tradingDates ?? []), ...candle.tradingDates];
    if (candle.knowledgeAt !== undefined || aggregated.knowledgeAt !== undefined) {
      aggregated.knowledgeAt =
        candleKnowledgeAt(candle) > candleKnowledgeAt(aggregated)
          ? candleKnowledgeAt(candle)
          : candleKnowledgeAt(aggregated);
    }
  }
  return aggregated;
}
