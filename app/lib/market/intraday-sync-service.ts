import type {
  CoverageStatus,
  IntervalCoverageSegment,
  MarketCandleRecord,
  MarketDataProviderId,
  ProviderMarketCandle,
  SupportedMarket,
} from "./contracts";
import { coverageStatusForSegments } from "./sync-status";
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

function coverageGaps(
  required: IntradayTimeRange,
  coverage: IntervalCoverageSegment[],
) {
  let gaps = [{ ...required }];
  const segments = coverage
    .filter(
      (segment) =>
        (segment.status === "complete" || segment.status === "partial") &&
        segment.requestedEnd >= required.startTime &&
        segment.requestedStart <= required.endTime,
    )
    .map((segment) => ({
      startTime: segment.requestedStart,
      endTime: segment.requestedEnd,
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

function parseRouteResult(value: unknown, range: IntradayTimeRange) {
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
  validateProviderMarketCandles(result.candles, range.startTime, range.endTime);
  return result as IntradayRouteResult;
}

function replaceCoverageForRange(
  coverage: IntervalCoverageSegment[],
  range: IntradayTimeRange,
) {
  return coverage.filter(
    (segment) =>
      segment.requestedEnd < range.startTime ||
      segment.requestedStart > range.endTime,
  );
}

export function splitIntradayRequestRange(
  range: IntradayTimeRange,
  maxDays = 60,
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
    const result = parseRouteResult(await response.json(), range);
    throwIfAborted();
    const historyLimited =
      result.candles.length === 0 ||
      result.warnings.includes("provider-history-limit");
    const candles: MarketCandleRecord[] = result.candles.map((candle) => ({
      instrumentId,
      interval: "15m",
      timestamp: candle.timestamp,
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
    const segment: IntervalCoverageSegment = {
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
      ...(historyLimited ? { reason: "provider-history-limit" } : {}),
    };
    coverage = [...replaceCoverageForRange(coverage, range), segment];
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
