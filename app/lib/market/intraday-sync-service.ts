import type {
  CoverageStatus,
  IntervalCoverageSegment,
  MarketCandleRecord,
  MarketDataProviderId,
  ProviderMarketCandle,
  SupportedMarket,
} from "./contracts";
import {
  CalendarOutOfRangeError,
  expectedTradingDates,
} from "./calendar";
import { marketLocalTimestampToIso } from "./providers/errors";
import { coverageStatusForSegments } from "./sync-status";
import {
  marketTimeZone,
  marketTradingDate,
} from "./trading-date";
import { validateProviderMarketCandles } from "./validation";
import type { MarketDataRepository } from "../storage/market-data-repository";

export type IntradayTimeRange = {
  startTime: string;
  endTime: string;
};

type IntradayRouteResult = {
  provider: MarketDataProviderId;
  providerSymbol: string;
  fetchedAt: string;
  interval: "15m";
  adjustmentMode: "raw";
  candles: ProviderMarketCandle[];
  warnings: string[];
  request: {
    instrumentId: string;
    symbol: string;
    market: SupportedMarket;
    interval: "15m";
    startTime: string;
    endTime: string;
  };
};

export type SyncIntradayMarketDataOptions = {
  instrumentId: string;
  symbol: string;
  market: SupportedMarket;
  currency: string;
  required: IntradayTimeRange;
  repository: MarketDataRepository;
  fetcher?: typeof fetch;
  signal?: AbortSignal;
};

function isProvider(value: unknown): value is MarketDataProviderId {
  return value === "tencent" || value === "eastmoney" || value === "yahoo";
}

function abortError() {
  return new DOMException("行情同步已被较新的请求取代", "AbortError");
}

function shiftTime(timestamp: string, milliseconds: number) {
  return new Date(new Date(timestamp).getTime() + milliseconds).toISOString();
}

function fifteenMinuteBarKnowledgeAt(timestamp: string) {
  return shiftTime(timestamp, 15 * 60 * 1000);
}

const MARKET_SESSIONS: Record<
  SupportedMarket,
  Array<{ startMinute: number; endMinute: number }>
> = {
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

function expectedIntradayTimestamps(
  range: IntradayTimeRange,
  market: SupportedMarket,
) {
  let tradingDates: string[];
  try {
    tradingDates = expectedTradingDates(
      market,
      marketTradingDate(range.startTime, market),
      marketTradingDate(range.endTime, market),
    );
  } catch (error) {
    if (error instanceof CalendarOutOfRangeError) return undefined;
    throw error;
  }

  const timeZone = marketTimeZone(market);
  return tradingDates.flatMap((date) =>
    MARKET_SESSIONS[market].flatMap((session) => {
      const timestamps: string[] = [];
      for (
        let minute = session.startMinute;
        minute < session.endMinute;
        minute += 15
      ) {
        const hour = Math.floor(minute / 60);
        const minuteWithinHour = minute % 60;
        const timestamp = marketLocalTimestampToIso(
          `${date} ${String(hour).padStart(2, "0")}:${String(
            minuteWithinHour,
          ).padStart(2, "0")}:00`,
          timeZone,
        );
        if (
          timestamp >= range.startTime &&
          timestamp <= range.endTime
        ) {
          timestamps.push(timestamp);
        }
      }
      return timestamps;
    }),
  );
}

function contiguousCandleRuns(candles: MarketCandleRecord[]) {
  const sorted = [...candles].sort((left, right) =>
    left.timestamp.localeCompare(right.timestamp),
  );
  const runs: MarketCandleRecord[][] = [];
  for (const candle of sorted) {
    const current = runs.at(-1);
    const previous = current?.at(-1);
    if (
      !current ||
      !previous ||
      Date.parse(candle.timestamp) - Date.parse(previous.timestamp) !==
        15 * 60 * 1000
    ) {
      runs.push([candle]);
    } else {
      current.push(candle);
    }
  }
  return runs;
}

function coverageGaps(
  required: IntradayTimeRange,
  coverage: IntervalCoverageSegment[],
) {
  let gaps = [{ ...required }];
  const segments = coverage
    .filter(
      (segment) =>
        (segment.status === "complete" || segment.status === "partial") &&
        segment.reason !== "missing-candles" &&
        segment.requestedEnd >= required.startTime &&
        segment.requestedStart <= required.endTime,
    )
    .map((segment) => ({
      startTime:
        segment.status === "partial" &&
        segment.actualStart &&
        segment.actualEnd
          ? segment.actualStart
          : segment.requestedStart,
      endTime:
        segment.status === "partial" &&
        segment.actualStart &&
        segment.actualEnd
          ? segment.actualEnd
          : segment.requestedEnd,
    }))
    .sort((left, right) => left.startTime.localeCompare(right.startTime));

  for (const segment of segments) {
    gaps = gaps.flatMap((gap) => {
      if (segment.endTime < gap.startTime || segment.startTime > gap.endTime) {
        return [gap];
      }
      const remaining: IntradayTimeRange[] = [];
      if (segment.startTime > gap.startTime) {
        remaining.push({
          startTime: gap.startTime,
          endTime: shiftTime(segment.startTime, -1),
        });
      }
      if (segment.endTime < gap.endTime) {
        remaining.push({
          startTime: shiftTime(segment.endTime, 1),
          endTime: gap.endTime,
        });
      }
      return remaining;
    });
  }
  return gaps;
}

function coverageForRange(
  required: IntradayTimeRange,
  coverage: IntervalCoverageSegment[],
) {
  return coverage.filter(
    (segment) =>
      segment.requestedEnd >= required.startTime &&
      segment.requestedStart <= required.endTime,
  );
}

function parseRouteResult(
  value: unknown,
  range: IntradayTimeRange,
  expected: Pick<
    SyncIntradayMarketDataOptions,
    "instrumentId" | "symbol" | "market"
  >,
) {
  if (!value || typeof value !== "object") {
    throw new Error("行情接口响应无效");
  }
  const result = value as Partial<IntradayRouteResult>;
  if (
    !isProvider(result.provider) ||
    typeof result.providerSymbol !== "string" ||
    typeof result.fetchedAt !== "string" ||
    result.interval !== "15m" ||
    result.adjustmentMode !== "raw" ||
    !Array.isArray(result.candles) ||
    !Array.isArray(result.warnings)
  ) {
    throw new Error("行情接口响应无效");
  }
  if (
    !result.request ||
    result.request.instrumentId !== expected.instrumentId ||
      result.request.symbol !== expected.symbol ||
      result.request.market !== expected.market ||
      result.request.interval !== "15m" ||
      result.request.startTime !== range.startTime ||
      result.request.endTime !== range.endTime
  ) {
    throw new Error("行情接口响应标的不匹配");
  }
  validateProviderMarketCandles(result.candles, range.startTime, range.endTime);
  return result as IntradayRouteResult;
}

function replaceCoverageForRange(
  coverage: IntervalCoverageSegment[],
  range: IntradayTimeRange,
) {
  return coverage.filter(
    (segment) => {
      const start =
        segment.status === "partial" &&
        segment.actualStart &&
        segment.actualEnd
          ? segment.actualStart
          : segment.requestedStart;
      const end =
        segment.status === "partial" &&
        segment.actualStart &&
        segment.actualEnd
          ? segment.actualEnd
          : segment.requestedEnd;
      return end < range.startTime || start > range.endTime;
    },
  );
}

export function splitIntradayRequestRange(
  range: IntradayTimeRange,
  maxDays = 14,
) {
  const chunks: IntradayTimeRange[] = [];
  let start = range.startTime;
  while (start <= range.endTime) {
    const startDate = new Date(`${start.slice(0, 10)}T00:00:00.000Z`);
    startDate.setUTCDate(startDate.getUTCDate() + maxDays - 1);
    const chunkEnd = `${startDate.toISOString().slice(0, 10)}T23:59:59.999Z`;
    const endTime = chunkEnd < range.endTime ? chunkEnd : range.endTime;
    chunks.push({ startTime: start, endTime });
    if (endTime === range.endTime) break;
    start = shiftTime(endTime, 1);
  }
  return chunks;
}

export async function syncIntradayMarketData({
  instrumentId,
  symbol,
  market,
  currency,
  required,
  repository,
  fetcher = fetch,
  signal,
}: SyncIntradayMarketDataOptions): Promise<{
  source: "cache" | "network";
  status: CoverageStatus;
  candles: MarketCandleRecord[];
  coverage: IntervalCoverageSegment[];
  requestedRanges: IntradayTimeRange[];
}> {
  const throwIfAborted = () => {
    if (signal?.aborted) throw abortError();
  };
  throwIfAborted();
  let coverage = await repository.getIntervalCoverage(instrumentId, "15m");
  const requestedRanges = coverageGaps(required, coverage).flatMap((range) =>
    splitIntradayRequestRange(range),
  );

  if (requestedRanges.length === 0) {
    return {
      source: "cache",
      status: coverageStatusForSegments(coverageForRange(required, coverage)),
      candles: await repository.getCandles(
        instrumentId,
        "15m",
        required.startTime,
        required.endTime,
      ),
      coverage,
      requestedRanges: [],
    };
  }

  for (const range of requestedRanges) {
    throwIfAborted();
    const query = new URLSearchParams({
      market,
      symbol,
      interval: "15m",
      start: range.startTime,
      end: range.endTime,
    });
    const response = await fetcher(`/api/market-data/intraday?${query}`, {
      signal,
    });
    throwIfAborted();
    if (!response.ok) {
      const body = (await response.json().catch(() => undefined)) as
        | { error?: { code?: string } }
        | undefined;
      throwIfAborted();
      if (body?.error?.code === "provider-history-limit") {
        const segment: IntervalCoverageSegment = {
          interval: "15m",
          requestedStart: range.startTime,
          requestedEnd: range.endTime,
          status: "partial",
          fetchedAt: new Date().toISOString(),
          reason: "provider-history-limit",
        };
        coverage = [...replaceCoverageForRange(coverage, range), segment];
        throwIfAborted();
        await repository.commitIntervalSyncResult({
          instrumentId,
          interval: "15m",
          candles: [],
          coverage,
        });
        continue;
      }
      return {
        source: "network",
        status: "source-unavailable",
        candles: await repository.getCandles(
          instrumentId,
          "15m",
          required.startTime,
          required.endTime,
        ),
        coverage,
        requestedRanges,
      };
    }
    const result = parseRouteResult(await response.json(), range, {
      instrumentId,
      symbol,
      market,
    });
    throwIfAborted();
    const historyLimited =
      result.candles.length === 0 ||
      result.warnings.includes("provider-history-limit");
    const candles: MarketCandleRecord[] = result.candles.map((candle) => ({
      instrumentId,
      interval: "15m",
      timestamp: candle.timestamp,
      knowledgeAt: candle.knowledgeAt ?? fifteenMinuteBarKnowledgeAt(candle.timestamp),
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume,
      currency,
      provider: result.provider,
      providerSymbol: result.providerSymbol,
      adjustmentMode: "raw",
      fetchedAt: result.fetchedAt,
    }));
    const expectedTimestamps = historyLimited
      ? undefined
      : expectedIntradayTimestamps(range, market);
    const returnedTimestamps = new Set(
      candles.map((item) => item.timestamp),
    );
    const missingTimestamps = expectedTimestamps?.filter(
      (timestamp) => !returnedTimestamps.has(timestamp),
    );
    const sparse = Boolean(missingTimestamps?.length);
    const segments: IntervalCoverageSegment[] = sparse
      ? [
          ...contiguousCandleRuns(candles).map((run) => ({
            interval: "15m" as const,
            requestedStart: run[0].timestamp,
            requestedEnd: run.at(-1)!.timestamp,
            actualStart: run[0].timestamp,
            actualEnd: run.at(-1)!.timestamp,
            status: "complete" as const,
            provider: result.provider,
            fetchedAt: result.fetchedAt,
          })),
          {
            interval: "15m",
            requestedStart: range.startTime,
            requestedEnd: range.endTime,
            status: "partial",
            provider: result.provider,
            fetchedAt: result.fetchedAt,
            reason: "missing-candles",
          },
        ]
      : [
          {
            interval: "15m",
            requestedStart: range.startTime,
            requestedEnd: range.endTime,
            ...(candles.length > 0
              ? {
                  actualStart: candles[0].timestamp,
                  actualEnd: candles.at(-1)?.timestamp,
                }
              : {}),
            status: historyLimited ? "partial" : "complete",
            provider: result.provider,
            fetchedAt: result.fetchedAt,
            ...(historyLimited
              ? { reason: "provider-history-limit" }
              : {}),
          },
        ];
    coverage = [
      ...replaceCoverageForRange(coverage, range),
      ...segments,
    ];
    throwIfAborted();
    await repository.commitIntervalSyncResult({
      instrumentId,
      interval: "15m",
      candles,
      coverage,
      providerSymbol: {
        provider: result.provider,
        symbol: result.providerSymbol,
      },
    });
  }

  return {
    source: "network",
    status: coverageStatusForSegments(coverageForRange(required, coverage)),
    candles: await repository.getCandles(
      instrumentId,
      "15m",
      required.startTime,
      required.endTime,
    ),
    coverage,
    requestedRanges,
  };
}
