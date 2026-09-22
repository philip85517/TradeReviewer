import type {
  CoverageSegment,
  DailyCandleRecord,
  IntervalCoverageSegment,
  MarketCandleRecord,
  SupportedMarket,
} from "./contracts";
import type { DateRange } from "./coverage-planner";
import {
  syncIntradayMarketDataForRanges,
  type IntradayTimeRange,
  type IntradaySyncResult,
} from "./intraday-sync-service";
import {
  MarketDataSyncError,
  syncMarketData,
  type MarketDataSyncErrorDetail,
} from "./sync-service";
import type { MarketDataRepository } from "../storage/market-data-repository";
import type { MarketDataErrorDetail } from "../storage/market-data-jobs";
import type { MarketDataSyncStatus } from "./sync-status";
import { coverageStatusForDateRange } from "./sync-status";

export type MarketDataRefreshSnapshot = {
  daily: DailyCandleRecord[];
  dailyCoverage: CoverageSegment[];
  intraday: MarketCandleRecord[];
  intradayCoverage: IntervalCoverageSegment[];
  intradayInterval: "15m" | "1h";
};

export type MarketDataRefreshRequest = {
  instrumentId: string;
  symbol: string;
  market: SupportedMarket;
  currency: string;
  dailyRange: DateRange;
  hourlyRanges: ReadonlyArray<IntradayTimeRange>;
  previous: MarketDataRefreshSnapshot;
  repository: MarketDataRepository;
  fetcher?: typeof fetch;
  signal?: AbortSignal;
  retryUnavailable?: boolean;
  forceRefresh?: boolean;
};

export type MarketDataRefreshError = MarketDataErrorDetail &
  Partial<Pick<MarketDataSyncErrorDetail, "failedCount" | "failedRanges">>;

type MarketDataRefreshIntervalResult<T, R, Ranges> = {
  candles: T[];
  coverage: R[];
  /** Status returned by the attempted synchronizer; daily failures may derive it from retained coverage. */
  status: MarketDataSyncStatus;
  /** Acquisition path used by the low-level synchronizer, even when it returns cached data. */
  source: "cache" | "network";
  /** Ranges actually attempted by the low-level synchronizer. */
  requestedRanges: Ranges[];
  /** Partial usable-result diagnostic returned by the synchronizer. */
  error?: MarketDataRefreshError;
  /** Failure in this refresh orchestration, including coverage reads. */
  refreshError?: MarketDataRefreshError;
  /** Stage that produced refreshError, when present. */
  refreshErrorSource?: "sync" | "coverage-read";
  /** Whether candles and coverage came from the previous snapshot. */
  retainedPrevious: boolean;
  interval: "15m" | "1h" | "1D";
};

export type MarketDataRefreshResult = {
  daily: MarketDataRefreshIntervalResult<DailyCandleRecord, CoverageSegment, DateRange> & { interval: "1D" };
  hourly: MarketDataRefreshIntervalResult<MarketCandleRecord, IntervalCoverageSegment, IntradayTimeRange> & { interval: "15m" | "1h" };
};

function isAbortError(error: unknown) {
  return (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError");
}

function abortError(signal?: AbortSignal): DOMException {
  if (signal?.reason instanceof DOMException && signal.reason.name === "AbortError") {
    return signal.reason;
  }
  return new DOMException("行情更新已取消", "AbortError");
}

function errorDetail(error: unknown): MarketDataRefreshError {
  if (error instanceof DOMException) {
    return { code: "storage-error", message: error.message || "行情更新失败" };
  }
  if (error instanceof MarketDataSyncError) {
    return {
      code: error.code,
      message: error.message,
      ...(error.failedRanges.length ? { failedCount: error.failedRanges.length, failedRanges: error.failedRanges } : {}),
    };
  }
  if (error && typeof error === "object" && "code" in error && "message" in error && typeof error.code === "string" && error.code.length > 0) {
    return { code: error.code, message: String(error.message) };
  }
  return {
    code: "source-unavailable",
    message: error instanceof Error && error.message ? error.message : "行情更新失败",
  };
}

function dailyFailureStatus(error: unknown): MarketDataSyncStatus {
  if (error instanceof DOMException) return "storage-error";
  const code = errorDetail(error).code;
  if (code === "source-rate-limited" || code === "source-forbidden" || code === "source-unavailable" || code === "invalid-response") {
    return code;
  }
  if (code === "provider-history-limit" || code === "no-data") return "partial";
  return "source-unavailable";
}

function hourlyFailureStatus(error: unknown): MarketDataSyncStatus {
  return error instanceof DOMException ? "storage-error" : "source-unavailable";
}

function checkAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw abortError(signal);
}

/** Coordinate daily and hourly refreshes while keeping each interval independently useful. */
export async function refreshMarketData(
  request: MarketDataRefreshRequest,
): Promise<MarketDataRefreshResult> {
  checkAborted(request.signal);
  const [dailyResult, hourlyResult] = await Promise.allSettled([
    syncMarketData({
      instrumentId: request.instrumentId,
      symbol: request.symbol,
      market: request.market,
      currency: request.currency,
      required: request.dailyRange,
      repository: request.repository,
      fetcher: request.fetcher,
      signal: request.signal,
      retryUnavailable: request.retryUnavailable,
    }),
    syncIntradayMarketDataForRanges({
      instrumentId: request.instrumentId,
      symbol: request.symbol,
      market: request.market,
      currency: request.currency,
      requiredRanges: request.hourlyRanges,
      repository: request.repository,
      fetcher: request.fetcher,
      signal: request.signal,
      interval: "1h",
      forceRefresh: request.forceRefresh,
    }),
  ]);
  if (request.signal?.aborted || (dailyResult.status === "rejected" && isAbortError(dailyResult.reason)) || (hourlyResult.status === "rejected" && isAbortError(hourlyResult.reason))) {
    throw abortError(request.signal);
  }

  let dailyCoverage = [...request.previous.dailyCoverage];
  let daily: MarketDataRefreshResult["daily"];
  if (dailyResult.status === "fulfilled") {
    let coverageError: MarketDataRefreshError | undefined;
    try {
      dailyCoverage = [...await request.repository.getCoverage(request.instrumentId)];
    } catch (error) {
      if (isAbortError(error)) throw abortError(request.signal);
      coverageError = { code: "storage-error", message: error instanceof Error ? error.message : "日线覆盖状态读取失败" };
    }
    daily = {
      candles: [...dailyResult.value.candles], coverage: dailyCoverage,
      status: coverageError ? "storage-error" : dailyResult.value.status,
      source: dailyResult.value.source, requestedRanges: [...dailyResult.value.requestedRanges],
      ...(("error" in dailyResult.value && dailyResult.value.error) ? { error: dailyResult.value.error } : {}),
      ...(coverageError ? { refreshError: coverageError, refreshErrorSource: "coverage-read" as const } : {}), retainedPrevious: false, interval: "1D",
    };
  } else {
    const detail = errorDetail(dailyResult.reason);
    daily = {
      candles: [...request.previous.daily], coverage: dailyCoverage,
      status: request.previous.daily.length > 0
        ? coverageStatusForDateRange(request.dailyRange, dailyCoverage)
        : dailyFailureStatus(dailyResult.reason),
      source: "cache", requestedRanges: [], refreshError: detail, refreshErrorSource: "sync", retainedPrevious: true, interval: "1D",
    };
  }

  let hourly: MarketDataRefreshResult["hourly"];
  if (hourlyResult.status === "fulfilled") {
    const value: IntradaySyncResult = hourlyResult.value;
    const retainLegacy = value.candles.length === 0 && request.previous.intradayInterval === "15m" && request.previous.intraday.length > 0;
    hourly = {
      candles: retainLegacy ? [...request.previous.intraday] : [...value.candles],
      coverage: retainLegacy ? [...request.previous.intradayCoverage] : [...value.coverage],
      status: value.status, source: value.source, requestedRanges: [...value.requestedRanges],
      ...(value.error ? { error: value.error } : {}), retainedPrevious: retainLegacy,
      interval: retainLegacy ? "15m" : "1h",
    };
  } else {
    hourly = {
      candles: [...request.previous.intraday], coverage: [...request.previous.intradayCoverage],
      status: hourlyFailureStatus(hourlyResult.reason), source: "cache", requestedRanges: [],
      refreshError: errorDetail(hourlyResult.reason), refreshErrorSource: "sync", retainedPrevious: true,
      interval: request.previous.intradayInterval,
    };
  }
  checkAborted(request.signal);
  return { daily, hourly };
}
