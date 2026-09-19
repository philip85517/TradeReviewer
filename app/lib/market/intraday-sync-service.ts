import type {
  CoverageStatus,
  IntervalCoverageSegment,
  MarketCandleRecord,
  MarketDataProviderId,
  NativeIntradayInterval,
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
import { canonicalInstrumentId } from "../instruments/display-name";
import type { MarketDataRepository } from "../storage/market-data-repository";
import { mergeIntradayTimeRanges } from "./intraday-sync-ranges";
import type {
  MarketDataFailedRange,
  MarketDataSyncErrorDetail,
} from "./sync-service";

export type IntradayTimeRange = {
  startTime: string;
  endTime: string;
};

type IntradayRouteResult = {
  provider: MarketDataProviderId;
  providerSymbol: string;
  fetchedAt: string;
  interval: NativeIntradayInterval;
  adjustmentMode: "raw";
  candles: ProviderMarketCandle[];
  warnings: string[];
  request: {
    instrumentId: string;
    symbol: string;
    market: SupportedMarket;
    interval: NativeIntradayInterval;
    startTime: string;
    endTime: string;
  };
};

class IntradayRouteIdentityError extends Error {}

export type SyncIntradayMarketDataOptions = {
  instrumentId: string;
  symbol: string;
  market: SupportedMarket;
  currency: string;
  required: IntradayTimeRange;
  interval?: NativeIntradayInterval;
  repository: MarketDataRepository;
  fetcher?: typeof fetch;
  signal?: AbortSignal;
  /** Bypass the browser HTTP cache for an explicit user refresh. */
  forceRefresh?: boolean;
};

export type IntradaySyncResult = {
  source: "cache" | "network";
  status: CoverageStatus;
  candles: MarketCandleRecord[];
  coverage: IntervalCoverageSegment[];
  requestedRanges: IntradayTimeRange[];
  error?: MarketDataSyncErrorDetail;
  failedRanges?: MarketDataFailedRange[];
};

function isProvider(value: unknown): value is MarketDataProviderId {
  return value === "tencent" || value === "eastmoney" || value === "yahoo" || value === "sina" || value === "baidu" || value === "tiger" || value === "baostock";
}

function abortError() {
  return new DOMException("行情同步已被较新的请求取代", "AbortError");
}

function isAbortError(error: unknown) {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}

function failureMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function failedRange(
  range: IntradayTimeRange,
  code: string,
  message: string,
): MarketDataFailedRange {
  return {
    start: range.startTime,
    end: range.endTime,
    code,
    message,
  };
}

function failureDetail(
  failures: readonly MarketDataFailedRange[],
): MarketDataSyncErrorDetail | undefined {
  if (failures.length === 0) return undefined;
  const messages = [...new Set(failures.map((failure) => failure.message))];
  const message = failures.length === 1
    ? `${failures[0]!.message}（${failures[0]!.start} 至 ${failures[0]!.end}）`
    : `${failures.length} 个 1 小时区间更新失败（${failures
        .map((failure) => `${failure.start} 至 ${failure.end}`)
        .join("、")}）：${messages.join("；")}`;
  return {
    code: failures[0]!.code,
    message,
    failedCount: failures.length,
    failedRanges: [...failures],
  };
}

function isHardFailure(code: string) {
  return !["provider-history-limit", "no-data"].includes(code);
}

function normalizeFailureCode(value: unknown) {
  return value === "invalid-response" ||
    value === "source-rate-limited" ||
    value === "source-forbidden" ||
    value === "source-unavailable" ||
    value === "source-timeout" ||
    value === "provider-history-limit" ||
    value === "no-data"
    ? value
    : "source-unavailable";
}

function failedCoverageSegment(
  interval: NativeIntradayInterval,
  range: IntradayTimeRange,
  code: string,
): IntervalCoverageSegment {
  return {
    interval,
    requestedStart: range.startTime,
    requestedEnd: range.endTime,
    status: "partial",
    fetchedAt: new Date().toISOString(),
    reason: code,
  };
}

function shiftTime(timestamp: string, milliseconds: number) {
  return new Date(new Date(timestamp).getTime() + milliseconds).toISOString();
}

function intradayBarKnowledgeAt(
  timestamp: string,
  interval: NativeIntradayInterval,
) {
  return shiftTime(timestamp, interval === "1h" ? 60 * 60 * 1000 : 15 * 60 * 1000);
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
  interval: NativeIntradayInterval,
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
        minute += interval === "1h" ? 60 : 15
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

function contiguousCandleRuns(
  candles: MarketCandleRecord[],
  interval: NativeIntradayInterval,
) {
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
        (interval === "1h" ? 60 * 60 * 1000 : 15 * 60 * 1000)
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
  options: { retryUnavailable?: boolean } = {},
) {
  let gaps = [{ ...required }];
  const segments = coverage
    .filter((segment) => {
      if (
        (segment.status !== "complete" && segment.status !== "partial") ||
        segment.reason === "missing-candles" ||
        segment.requestedEnd < required.startTime ||
        segment.requestedStart > required.endTime
      ) {
        return false;
      }
      const reason = segment.reason ?? "";
      const retryableSourceFailure = [
        "source-unavailable",
        "source-rate-limited",
        "source-forbidden",
        "source-timeout",
        "invalid-response",
      ].includes(reason);
      const retryableKnownNegative =
        options.retryUnavailable &&
        ["no-data", "provider-history-limit"].includes(reason);
      // A source failure never confirms coverage. Known negative provider
      // results are stable cache markers until an explicit refresh asks us
      // to retry them. If a history-limit response included actual bars,
      // retain that confirmed subrange while retrying only its gaps.
      if (retryableSourceFailure) return false;
      if (retryableKnownNegative && !(
        segment.status === "partial" &&
        segment.actualStart &&
        segment.actualEnd
      )) {
        return false;
      }
      return true;
    })
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

function coverageForRanges(
  ranges: ReadonlyArray<IntradayTimeRange>,
  coverage: IntervalCoverageSegment[],
) {
  return coverage.filter((segment) =>
    ranges.some(
      (range) =>
        segment.requestedEnd >= range.startTime &&
        segment.requestedStart <= range.endTime,
    ),
  );
}

function parseRouteResult(
  value: unknown,
  range: IntradayTimeRange,
  expected: Pick<
    SyncIntradayMarketDataOptions,
    "instrumentId" | "symbol" | "market"
  > & { interval: NativeIntradayInterval },
) {
  if (!value || typeof value !== "object") {
    throw new Error("行情接口响应无效");
  }
  const result = value as Partial<IntradayRouteResult>;
  if (
    !isProvider(result.provider) ||
    typeof result.providerSymbol !== "string" ||
    typeof result.fetchedAt !== "string" ||
    result.interval !== expected.interval ||
    result.adjustmentMode !== "raw" ||
    !Array.isArray(result.candles) ||
    !Array.isArray(result.warnings)
  ) {
    throw new Error("行情接口响应无效");
  }
  if (
    !result.request ||
    (result.request.instrumentId !== expected.instrumentId &&
      result.request.instrumentId !==
        canonicalInstrumentId(expected.symbol, expected.market)) ||
      result.request.symbol !== expected.symbol ||
      result.request.market !== expected.market ||
      result.request.interval !== expected.interval ||
      result.request.startTime !== range.startTime ||
      result.request.endTime !== range.endTime
  ) {
    throw new IntradayRouteIdentityError("行情接口响应标的不匹配");
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
  interval = "15m",
  repository,
  fetcher = fetch,
  signal,
  forceRefresh = false,
}: SyncIntradayMarketDataOptions): Promise<IntradaySyncResult> {
  const throwIfAborted = () => {
    if (signal?.aborted) throw abortError();
  };
  throwIfAborted();
  let coverage = await repository.getIntervalCoverage(instrumentId, interval);
  const plannedRanges = coverageGaps(required, coverage, {
    retryUnavailable: forceRefresh,
  }).flatMap((range) =>
    splitIntradayRequestRange(range),
  );

  if (plannedRanges.length === 0) {
    return {
      source: "cache",
      status: coverageStatusForSegments(coverageForRange(required, coverage)),
      candles: await repository.getCandles(
        instrumentId,
        interval,
        required.startTime,
        required.endTime,
      ),
      coverage,
      requestedRanges: [],
    };
  }

  const attemptedRanges: IntradayTimeRange[] = [];
  const failures: MarketDataFailedRange[] = [];
  for (const range of plannedRanges) {
    throwIfAborted();
    const query = new URLSearchParams({
      market,
      symbol,
      interval,
      start: range.startTime,
      end: range.endTime,
    });
    attemptedRanges.push({ ...range });
    let response: Response;
    try {
      response = await fetcher(`/api/market-data/intraday?${query}`, {
        signal,
        ...(forceRefresh ? { cache: "no-store" as const } : {}),
      });
    } catch (error) {
      throwIfAborted();
      if (isAbortError(error)) throw error;
      const code = "source-unavailable";
      const message = failureMessage(error, "1 小时行情请求失败");
      failures.push(failedRange(range, code, message));
      coverage = [
        ...replaceCoverageForRange(coverage, range),
        failedCoverageSegment(interval, range, code),
      ];
      throwIfAborted();
      await repository.commitIntervalSyncResult({
        instrumentId,
        interval,
        candles: [],
        coverage,
      });
      continue;
    }
    throwIfAborted();
    if (!response.ok) {
      let body:
        | { error?: { code?: string; message?: string } }
        | undefined;
      try {
        body = (await response.json()) as
          | { error?: { code?: string; message?: string } }
          | undefined;
      } catch (error) {
        if (isAbortError(error)) throw error;
      }
      throwIfAborted();
      const responseError = body?.error;
      const code = normalizeFailureCode(responseError?.code);
      const message = responseError?.message ?? "1 小时行情请求失败";
      failures.push(failedRange(range, code, message));
      if (code === "provider-history-limit" || code === "no-data") {
        const reason = code;
        const segment: IntervalCoverageSegment = {
          interval,
          requestedStart: range.startTime,
          requestedEnd: range.endTime,
          status: "partial",
          fetchedAt: new Date().toISOString(),
          reason,
        };
        coverage = [...replaceCoverageForRange(coverage, range), segment];
        throwIfAborted();
        await repository.commitIntervalSyncResult({
          instrumentId,
          interval,
          candles: [],
          coverage,
        });
        continue;
      }
      coverage = [
        ...replaceCoverageForRange(coverage, range),
        failedCoverageSegment(interval, range, code),
      ];
      throwIfAborted();
      await repository.commitIntervalSyncResult({
        instrumentId,
        interval,
        candles: [],
        coverage,
      });
      continue;
    }
    let result: IntradayRouteResult;
    try {
      result = parseRouteResult(await response.json(), range, {
        instrumentId,
        symbol,
        market,
        interval,
      });
    } catch (error) {
      throwIfAborted();
      if (isAbortError(error)) throw error;
      if (error instanceof IntradayRouteIdentityError) throw error;
      const code = "invalid-response";
      const message = failureMessage(error, "行情接口响应无效");
      failures.push(failedRange(range, code, message));
      coverage = [
        ...replaceCoverageForRange(coverage, range),
        failedCoverageSegment(interval, range, code),
      ];
      throwIfAborted();
      await repository.commitIntervalSyncResult({
        instrumentId,
        interval,
        candles: [],
        coverage,
      });
      continue;
    }
    throwIfAborted();
    const historyLimited =
      result.candles.length === 0 ||
      result.warnings.includes("provider-history-limit");
    const candles: MarketCandleRecord[] = result.candles.map((candle) => ({
      instrumentId,
      interval,
      timestamp: candle.timestamp,
      knowledgeAt: candle.knowledgeAt ?? intradayBarKnowledgeAt(candle.timestamp, interval),
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
      : expectedIntradayTimestamps(range, market, interval);
    const returnedTimestamps = new Set(
      candles.map((item) => item.timestamp),
    );
    const missingTimestamps = expectedTimestamps?.filter(
      (timestamp) => !returnedTimestamps.has(timestamp),
    );
    const sparse = Boolean(missingTimestamps?.length);
    const segments: IntervalCoverageSegment[] = sparse
      ? [
          ...contiguousCandleRuns(candles, interval).map((run) => ({
            interval,
            requestedStart: run[0].timestamp,
            requestedEnd: run.at(-1)!.timestamp,
            actualStart: run[0].timestamp,
            actualEnd: run.at(-1)!.timestamp,
            status: "complete" as const,
            provider: result.provider,
            fetchedAt: result.fetchedAt,
          })),
          {
            interval,
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
            interval,
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
      interval,
      candles,
      coverage,
      providerSymbol: {
        provider: result.provider,
        symbol: result.providerSymbol,
      },
    });
  }

  const candles = await repository.getCandles(
    instrumentId,
    interval,
    required.startTime,
    required.endTime,
  );
  const error = failureDetail(failures);
  const hardFailure = failures.find((failure) => isHardFailure(failure.code));
  const hardStatus: CoverageStatus = hardFailure?.code === "invalid-response" ||
    hardFailure?.code === "source-rate-limited" ||
    hardFailure?.code === "source-forbidden" ||
    hardFailure?.code === "source-unavailable"
    ? hardFailure.code
    : "source-unavailable";
  const status = hardFailure && candles.length === 0
    ? hardStatus
    : coverageStatusForSegments(coverageForRange(required, coverage));
  return {
    source: "network",
    status,
    candles,
    coverage,
    requestedRanges: attemptedRanges,
    ...(error ? { error, failedRanges: error.failedRanges } : {}),
  };
}

export async function syncIntradayMarketDataForRanges({
  requiredRanges,
  ...options
}: Omit<SyncIntradayMarketDataOptions, "required"> & {
  requiredRanges: ReadonlyArray<IntradayTimeRange>;
}): Promise<IntradaySyncResult> {
  const ranges = mergeIntradayTimeRanges(requiredRanges);
  if (ranges.length === 0) {
    return {
      source: "cache",
      status: "not-requested",
      candles: [],
      coverage: await options.repository.getIntervalCoverage(
        options.instrumentId,
        options.interval ?? "15m",
      ),
      requestedRanges: [],
    };
  }

  const results: IntradaySyncResult[] = [];
  for (const required of ranges) {
    results.push(
      await syncIntradayMarketData({
        ...options,
        required,
      }),
    );
  }

  const interval = options.interval ?? "15m";
  const coverage = await options.repository.getIntervalCoverage(
    options.instrumentId,
    interval,
  );
  const candles = new Map<string, MarketCandleRecord>();
  for (const result of results) {
    for (const candle of result.candles) {
      candles.set(candle.timestamp, candle);
    }
  }
  const failures = results.flatMap((result) => result.failedRanges ?? []);
  const error = failureDetail(failures);
  const hardFailure = results.find((result) =>
    result.status === "invalid-response" ||
    result.status === "source-rate-limited" ||
    result.status === "source-forbidden" ||
    result.status === "source-unavailable"
  );
  const coverageStatus = coverageStatusForSegments(
    coverageForRanges(ranges, coverage),
  );
  const status = hardFailure && candles.size === 0
    ? hardFailure.status
    : coverageStatus;
  return {
    source: results.some((result) => result.source === "network")
      ? "network"
      : "cache",
    status,
    candles: [...candles.values()].sort((left, right) =>
      left.timestamp.localeCompare(right.timestamp),
    ),
    coverage,
    requestedRanges: results.flatMap((result) => result.requestedRanges),
    ...(error ? { error, failedRanges: error.failedRanges } : {}),
  };
}
