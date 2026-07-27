import type {
  DailyCandleRecord,
  MarketDataProviderId,
  ProviderResult,
  SupportedMarket,
} from "./contracts";
import {
  planCoverageGaps,
  type DateRange,
} from "./coverage-planner";
import {
  CalendarOutOfRangeError,
  expectedTradingDates,
} from "./calendar";
import { coverageStatusForSegments } from "./sync-status";
import { validateProviderCandles } from "./validation";
import type { MarketDataRepository } from "../storage/market-data-repository";

type SyncMarketDataOptions = {
  instrumentId: string;
  symbol: string;
  market: SupportedMarket;
  currency: string;
  required: DateRange;
  repository: MarketDataRepository;
  fetcher?: typeof fetch;
  signal?: AbortSignal;
};

type RouteResult = ProviderResult & {
  adjustmentMode: "raw";
};

function isProvider(value: unknown): value is MarketDataProviderId {
  return value === "tencent" || value === "eastmoney" || value === "yahoo";
}

function shiftDate(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function retainCoveragePart(
  segment: Awaited<
    ReturnType<MarketDataRepository["getCoverage"]>
  >[number],
  startDate: string,
  endDate: string,
) {
  const missingTradingDates = segment.missingTradingDates.filter(
    (date) => date >= startDate && date <= endDate,
  );
  const resolvedPartial =
    segment.status === "partial" &&
    segment.reason !== "calendar-out-of-range" &&
    missingTradingDates.length === 0;
  return {
    ...segment,
    startDate,
    endDate,
    status: resolvedPartial ? ("complete" as const) : segment.status,
    missingTradingDates,
    reason: resolvedPartial ? undefined : segment.reason,
  };
}

function preserveCoverageOutsideGap(
  coverage: Awaited<
    ReturnType<MarketDataRepository["getCoverage"]>
  >,
  gap: DateRange,
) {
  return coverage.flatMap((segment) => {
    if (
      segment.endDate < gap.startDate ||
      segment.startDate > gap.endDate
    ) {
      return [segment];
    }
    const retained = [];
    if (segment.startDate < gap.startDate) {
      retained.push(
        retainCoveragePart(
          segment,
          segment.startDate,
          shiftDate(gap.startDate, -1),
        ),
      );
    }
    if (segment.endDate > gap.endDate) {
      retained.push(
        retainCoveragePart(
          segment,
          shiftDate(gap.endDate, 1),
          segment.endDate,
        ),
      );
    }
    return retained;
  });
}

function parseRouteResult(value: unknown, range: DateRange): RouteResult {
  if (!value || typeof value !== "object") {
    throw new Error("行情接口响应无效");
  }
  const result = value as Partial<RouteResult>;
  if (
    !isProvider(result.provider) ||
    typeof result.providerSymbol !== "string" ||
    typeof result.fetchedAt !== "string" ||
    result.adjustmentMode !== "raw" ||
    !Array.isArray(result.candles) ||
    !Array.isArray(result.warnings)
  ) {
    throw new Error("行情接口响应无效");
  }
  validateProviderCandles(
    result.candles,
    range.startDate,
    range.endDate,
  );
  return result as RouteResult;
}

export async function syncMarketData({
  instrumentId,
  symbol,
  market,
  currency,
  required,
  repository,
  fetcher = fetch,
  signal,
}: SyncMarketDataOptions) {
  const throwIfAborted = () => {
    if (signal?.aborted) {
      throw new DOMException("行情同步已被较新的请求取代", "AbortError");
    }
  };
  throwIfAborted();
  let coverage = await repository.getCoverage(instrumentId);
  const gaps = planCoverageGaps(required, coverage);

  if (gaps.length === 0) {
    const relevantCoverage = coverage.filter(
      (segment) =>
        segment.endDate >= required.startDate &&
        segment.startDate <= required.endDate,
    );
    return {
      source: "cache" as const,
      status: coverageStatusForSegments(relevantCoverage),
      candles: await repository.getDailyCandles(
        instrumentId,
        required.startDate,
        required.endDate,
      ),
      requestedRanges: [],
    };
  }

  for (const gap of gaps) {
    throwIfAborted();
    const query = new URLSearchParams({
      market,
      symbol,
      start: gap.startDate,
      end: gap.endDate,
    });
    const response = await fetcher(`/api/market-data/daily?${query}`, {
      signal,
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => undefined)) as
        | { error?: { message?: string } }
        | undefined;
      throw new Error(body?.error?.message ?? "行情更新失败");
    }
    const result = parseRouteResult(await response.json(), gap);
    throwIfAborted();
    const candles: DailyCandleRecord[] = result.candles.map((candle) => ({
      instrumentId,
      tradingDate: candle.tradingDate,
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
    let missingTradingDates: string[] = [];
    let segmentStatus: "complete" | "partial" = "complete";
    let reason: string | undefined;
    try {
      const returnedDates = new Set(
        result.candles.map((candle) => candle.tradingDate),
      );
      missingTradingDates = expectedTradingDates(
        market,
        gap.startDate,
        gap.endDate,
      ).filter((date) => !returnedDates.has(date));
      if (missingTradingDates.length > 0) segmentStatus = "partial";
    } catch (error) {
      if (!(error instanceof CalendarOutOfRangeError)) throw error;
      segmentStatus = "partial";
      reason = "calendar-out-of-range";
    }
    coverage = [
      ...preserveCoverageOutsideGap(coverage, gap),
      {
        ...gap,
        status: segmentStatus,
        provider: result.provider,
        fetchedAt: result.fetchedAt,
        missingTradingDates,
        reason,
      },
    ];
    throwIfAborted();
    await repository.commitSyncResult({
      instrumentId,
      candles,
      coverage,
      providerSymbol: {
        provider: result.provider,
        symbol: result.providerSymbol,
      },
    });
  }

  return {
    source: "network" as const,
    status: coverage.some((segment) => segment.status === "partial")
      ? ("partial" as const)
      : ("complete" as const),
    candles: await repository.getDailyCandles(
      instrumentId,
      required.startDate,
      required.endDate,
    ),
    requestedRanges: gaps,
  };
}
