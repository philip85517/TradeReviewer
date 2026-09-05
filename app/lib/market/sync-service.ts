import type {
  DailyCandleRequest,
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
import { coverageStatusForDateRange } from "./sync-status";
import {
  MAX_PROVIDER_LATEST_TAIL_DATES,
  normalizeProviderLatestTails,
  reconcileDailyCoverage,
} from "./coverage-tail";
import { validateProviderCandles } from "./validation";
import type { MarketDataSyncStatus } from "./sync-status";
import { canonicalInstrumentId } from "../instruments/display-name";
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
  retryUnavailable?: boolean;
};

type RouteResult = ProviderResult & {
  adjustmentMode: "raw";
  request: DailyCandleRequest;
};

type DailySyncFailureCode =
  | MarketDataSyncStatus
  | "source-timeout"
  | "provider-history-limit"
  | "no-data";

export class MarketDataSyncError extends Error {
  constructor(
    readonly code: DailySyncFailureCode,
    message: string,
  ) {
    super(message);
    this.name = "MarketDataSyncError";
  }
}

function isDailySyncFailureCode(value: unknown): value is DailySyncFailureCode {
  return (
    value === "source-rate-limited" ||
    value === "source-forbidden" ||
    value === "source-unavailable" ||
    value === "invalid-response" ||
    value === "source-timeout" ||
    value === "provider-history-limit" ||
    value === "no-data"
  );
}

function isProvider(value: unknown): value is MarketDataProviderId {
  return value === "tencent" || value === "eastmoney" || value === "yahoo" || value === "sina" || value === "baidu" || value === "tiger";
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
    (segment.reason === undefined ||
      segment.reason === "provider-latest-available") &&
    missingTradingDates.length === 0;
  return {
    ...segment,
    startDate,
    endDate,
    actualEndDate:
      segment.actualEndDate !== undefined &&
      segment.actualEndDate >= startDate &&
      segment.actualEndDate <= endDate
        ? segment.actualEndDate
        : undefined,
    status: resolvedPartial ? ("complete" as const) : segment.status,
    missingTradingDates,
    reason:
      resolvedPartial ||
      (segment.reason === "provider-latest-available" &&
        missingTradingDates.length === 0)
        ? undefined
        : segment.reason,
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

function isKnownMissingGapOutsideCandleHistory(
  coverage: Awaited<ReturnType<MarketDataRepository["getCoverage"]>>,
  gap: DateRange,
  firstKnownDate: string | undefined,
  lastKnownDate: string | undefined,
) {
  const today = new Date().toISOString().slice(0, 10);
  const hasConfirmedNoDataAfterLastCandle =
    lastKnownDate !== undefined &&
    coverage.some(
      (segment) =>
        segment.reason === "no-data" &&
        segment.startDate > lastKnownDate &&
        segment.endDate < gap.startDate,
    );
  const outsideKnownHistory =
    (firstKnownDate !== undefined && gap.endDate < firstKnownDate) ||
    (lastKnownDate !== undefined &&
      hasConfirmedNoDataAfterLastCandle &&
      gap.startDate > lastKnownDate &&
      gap.endDate < today);
  if (!outsideKnownHistory) {
    return false;
  }
  return coverage.some(
    (segment) =>
      segment.status === "partial" &&
      segment.provider !== undefined &&
      segment.startDate <= gap.startDate &&
      segment.endDate >= gap.endDate &&
      segment.missingTradingDates.some(
        (date) => date >= gap.startDate && date <= gap.endDate,
      ),
  );
}

function parseRouteResult(
  value: unknown,
  range: DateRange,
  expected: Pick<
    SyncMarketDataOptions,
    "instrumentId" | "symbol" | "market"
  >,
): RouteResult {
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
  if (
    !result.request ||
    (result.request.instrumentId !== expected.instrumentId &&
      result.request.instrumentId !==
        canonicalInstrumentId(expected.symbol, expected.market)) ||
      result.request.symbol !== expected.symbol ||
      result.request.market !== expected.market ||
      result.request.startDate !== range.startDate ||
      result.request.endDate !== range.endDate
  ) {
    throw new Error("行情接口响应标的不匹配");
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
  retryUnavailable = false,
}: SyncMarketDataOptions) {
  const throwIfAborted = () => {
    if (signal?.aborted) {
      throw new DOMException("行情同步已被较新的请求取代", "AbortError");
    }
  };
  throwIfAborted();
  let coverage = await repository.getCoverage(instrumentId);
  const knownCandles = await repository.getDailyCandles(
    instrumentId,
    required.startDate,
    required.endDate,
  );
  const normalizedCoverage = normalizeProviderLatestTails(
    market,
    reconcileDailyCoverage(market, required, coverage, knownCandles),
    knownCandles,
  );
  const coverageWasNormalized =
    JSON.stringify(normalizedCoverage) !== JSON.stringify(coverage);
  if (coverageWasNormalized) {
    coverage = normalizedCoverage;
    await repository.commitSyncResult({
      instrumentId,
      candles: [],
      coverage,
    });
  }
  let firstKnownDate = knownCandles.reduce<string | undefined>(
    (first, candle) =>
      first === undefined || candle.tradingDate < first
        ? candle.tradingDate
        : first,
    undefined,
  );
  let lastKnownDate = knownCandles.reduce<string | undefined>(
    (last, candle) =>
      last === undefined || candle.tradingDate > last
        ? candle.tradingDate
        : last,
    undefined,
  );
  const planningCoverage = retryUnavailable
    ? coverage.filter(
        (segment) =>
          !(
            segment.status === "partial" &&
            [
              "no-data",
              "provider-history-limit",
              "source-unavailable",
              "source-rate-limited",
              "source-forbidden",
              "invalid-response",
            ].includes(segment.reason ?? "")
          ),
      )
    : coverage;
  const gaps = planCoverageGaps(required, planningCoverage, {
    retryLatestAvailable: true,
  });

  if (gaps.length === 0) {
    return {
      source: "cache" as const,
      status: coverageStatusForDateRange(required, coverage),
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
    if (
      !retryUnavailable &&
      isKnownMissingGapOutsideCandleHistory(
        coverage,
        gap,
        firstKnownDate,
        lastKnownDate,
      )
    ) {
      coverage = [
        ...preserveCoverageOutsideGap(coverage, gap),
        {
          ...gap,
          status: "partial",
          fetchedAt: new Date().toISOString(),
          missingTradingDates: [],
          reason: "no-data",
        },
      ];
      await repository.commitSyncResult({
        instrumentId,
        candles: [],
        coverage,
      });
      continue;
    }
    const query = new URLSearchParams({
      market,
      symbol,
      start: gap.startDate,
      end: gap.endDate,
    });
    const response = await fetcher(`/api/market-data/daily?${query}`, {
      signal,
      ...(retryUnavailable ? { cache: "no-store" as const } : {}),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => undefined)) as
        | { error?: { code?: unknown; message?: string } }
        | undefined;
      const code = isDailySyncFailureCode(body?.error?.code)
        ? body.error.code
        : "source-unavailable";
      if (
        code === "provider-history-limit" ||
        code === "no-data"
      ) {
        const reason = code;
        const previousTail = coverage.find(segment =>
          segment.reason === "provider-latest-available" && segment.actualEndDate &&
          gap.startDate > segment.actualEndDate && gap.endDate <= segment.endDate);
        coverage = [
          ...preserveCoverageOutsideGap(coverage, gap),
          {
            ...gap,
            status: "partial",
            fetchedAt: new Date().toISOString(),
            missingTradingDates: previousTail
              ? expectedTradingDates(market, gap.startDate, gap.endDate) : [],
            actualEndDate: previousTail?.actualEndDate,
            reason: previousTail ? "provider-latest-available" : reason,
          },
        ];
        throwIfAborted();
        await repository.commitSyncResult({
          instrumentId,
          candles: [],
          coverage,
        });
        continue;
      }
      throw new MarketDataSyncError(
        code,
        body?.error?.message ?? "行情更新失败",
      );
    }
    const result = parseRouteResult(await response.json(), gap, {
      instrumentId,
      symbol,
      market,
    });
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
      provider: result.candleSources?.[candle.tradingDate]?.provider ?? result.provider,
      providerSymbol: result.candleSources?.[candle.tradingDate]?.providerSymbol ?? result.providerSymbol,
      adjustmentMode: "raw",
      fetchedAt: result.candleSources?.[candle.tradingDate]?.fetchedAt ?? result.fetchedAt,
    }));
    for (const candle of candles) {
      if (firstKnownDate === undefined || candle.tradingDate < firstKnownDate) {
        firstKnownDate = candle.tradingDate;
      }
      if (lastKnownDate === undefined || candle.tradingDate > lastKnownDate) {
        lastKnownDate = candle.tradingDate;
      }
    }
    let missingTradingDates: string[] = [];
    let segmentStatus: "complete" | "partial" = "complete";
    let reason: string | undefined;
    let actualEndDate: string | undefined;
    if (result.warnings.includes("provider-history-limit")) {
      segmentStatus = "partial";
      reason = "provider-history-limit";
    }
    try {
      const returnedDates = new Set(
        result.candles.map((candle) => candle.tradingDate),
      );
      missingTradingDates = expectedTradingDates(
        market,
        gap.startDate,
        gap.endDate,
      ).filter((date) => !returnedDates.has(date));
      const isProviderLatestTail =
        missingTradingDates.length > 0 &&
        missingTradingDates.length <= MAX_PROVIDER_LATEST_TAIL_DATES &&
        lastKnownDate !== undefined &&
        missingTradingDates.every((date) => date > lastKnownDate!);
      if (missingTradingDates.length > 0) segmentStatus = "partial";
      if (isProviderLatestTail && reason === undefined) {
        reason = "provider-latest-available";
        actualEndDate = lastKnownDate;
      }
    } catch (error) {
      if (!(error instanceof CalendarOutOfRangeError)) throw error;
      segmentStatus = "partial";
      reason ??= "calendar-out-of-range";
    }
    coverage = [
      ...preserveCoverageOutsideGap(coverage, gap),
      {
        ...gap,
        status: segmentStatus,
        provider: result.provider,
        fetchedAt: result.fetchedAt,
        actualEndDate,
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
    status: coverageStatusForDateRange(required, coverage),
    candles: await repository.getDailyCandles(
      instrumentId,
      required.startDate,
      required.endDate,
    ),
    requestedRanges: gaps,
  };
}
