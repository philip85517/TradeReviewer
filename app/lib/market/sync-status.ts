import type { CoverageSegment, CoverageStatus } from "./contracts";
import type { DateRange } from "./coverage-planner";
import { planCoverageGaps } from "./coverage-planner";

export type MarketDataSyncStatus =
  | "not-requested"
  | "syncing"
  | "complete"
  | "latest-available"
  | "partial"
  | "stale"
  | "source-rate-limited"
  | "source-forbidden"
  | "source-unavailable"
  | "invalid-response"
  | "storage-error"
  // v1 localStorage values kept readable during migration.
  | "needs-provider"
  | "ready"
  | "error";

export function marketDataStatusLabel(status: MarketDataSyncStatus) {
  if (status === "syncing") return "正在更新行情";
  if (status === "complete" || status === "ready") return "本地行情完整";
  if (status === "latest-available") return "尾部待补";
  if (status === "partial") return "行情部分可用";
  if (status === "stale") return "行情可更新";
  if (status === "source-rate-limited") return "行情源访问受限";
  if (status === "source-forbidden") return "行情源拒绝访问";
  if (status === "source-unavailable") return "行情源暂不可用";
  if (status === "invalid-response") return "行情格式异常";
  if (status === "storage-error") return "本地存储失败";
  if (status === "error") return "行情更新失败";
  return "行情源待连接";
}

export function coverageStatusForSegments(
  segments: ReadonlyArray<{ status: CoverageStatus }>,
): CoverageStatus {
  if (segments.length === 0) return "not-requested";
  const priority: CoverageStatus[] = [
    "storage-error",
    "invalid-response",
    "source-forbidden",
    "source-rate-limited",
    "source-unavailable",
    "syncing",
    "partial",
    "latest-available",
    "stale",
  ];
  return (
    priority.find((status) =>
      segments.some((segment) => segment.status === status),
    ) ?? "complete"
  );
}

export function coverageStatusForDateRange(
  required: DateRange,
  segments: ReadonlyArray<CoverageSegment>,
): CoverageStatus {
  if (segments.length === 0) return "not-requested";
  const relevant = segments.filter(
    (segment) =>
      segment.endDate >= required.startDate &&
      segment.startDate <= required.endDate,
  );
  if (relevant.length === 0) return "stale";
  const status = coverageStatusForSegments(relevant);
  if (status !== "complete" && status !== "partial") return status;
  const partials = relevant.filter(segment => segment.status === "partial");
  const tailOnly = partials.length > 0 && partials.every(segment =>
    segment.reason === "provider-latest-available" &&
    typeof segment.actualEndDate === "string" &&
    segment.missingTradingDates.length > 0 &&
    segment.missingTradingDates.every(date => date > segment.actualEndDate!),
  );
  const planning = tailOnly ? relevant.map(segment => segment.status === "partial"
    ? { ...segment, status: "complete" as const, missingTradingDates: [] } : segment) : relevant;
  if (planCoverageGaps(required, [...planning]).length > 0) {
    return status === "partial" ? "partial" : "stale";
  }
  const hasProviderLatestTail = relevant.some(
    (segment) =>
      segment.status === "partial" &&
      segment.reason === "provider-latest-available" &&
      typeof segment.actualEndDate === "string" &&
      segment.missingTradingDates.length > 0 &&
      segment.missingTradingDates.some(
        (date) => date >= required.startDate && date <= required.endDate,
      ) &&
      segment.missingTradingDates
        .filter(
          (date) => date >= required.startDate && date <= required.endDate,
        )
        .every((date) => date > segment.actualEndDate!),
  );
  if (hasProviderLatestTail && tailOnly) return "latest-available";
  return status === "complete" ? "complete" : "partial";
}

type TimeCoverageSegment = {
  requestedStart: string;
  requestedEnd: string;
  status: CoverageStatus;
};

export function coverageStatusForTimeRanges(
  required: ReadonlyArray<{ startTime: string; endTime: string }>,
  segments: ReadonlyArray<TimeCoverageSegment>,
): CoverageStatus {
  if (required.length === 0) return "not-requested";
  if (segments.length === 0) return "not-requested";
  const relevant = segments.filter((segment) =>
    required.some(
      (range) =>
        segment.requestedEnd >= range.startTime &&
        segment.requestedStart <= range.endTime,
    ),
  );
  if (relevant.length === 0) return "stale";
  const status = coverageStatusForSegments(relevant);
  if (status !== "complete") return status;
  const covered = required.every((range) =>
    relevant.some(
      (segment) =>
        segment.status === "complete" &&
        segment.requestedStart <= range.startTime &&
        segment.requestedEnd >= range.endTime,
    ),
  );
  return covered ? status : "stale";
}

export function combinedMarketDataStatus(
  daily: MarketDataSyncStatus,
  intraday: MarketDataSyncStatus,
): MarketDataSyncStatus {
  const normalize = (status: MarketDataSyncStatus) =>
    status === "ready"
      ? "complete"
      : status === "error" || status === "needs-provider"
        ? "source-unavailable"
        : status;
  const statuses = [normalize(daily), normalize(intraday)];
  const aggregate = coverageStatusForSegments(
    statuses.map((status) => ({ status })),
  );
  if (
    aggregate === "storage-error" ||
    aggregate === "invalid-response" ||
    aggregate === "source-forbidden" ||
    aggregate === "source-rate-limited" ||
    aggregate === "source-unavailable" ||
    aggregate === "syncing"
  ) {
    return aggregate;
  }
  if (statuses.includes("not-requested")) return "not-requested";
  return aggregate;
}

export function displayMarketDataStatus(
  daily: MarketDataSyncStatus,
  intraday: MarketDataSyncStatus,
  options: {
    hasDailyData: boolean;
    hasIntradayData: boolean;
    intradayJobStatus?: MarketDataSyncStatus;
  },
): MarketDataSyncStatus {
  const effectiveIntraday =
    !options.hasIntradayData && intraday === "not-requested"
      ? options.intradayJobStatus ?? intraday
      : intraday;
  const dailyFailedWithoutCache =
    !options.hasDailyData &&
    daily !== "not-requested" &&
    daily !== "complete" &&
    daily !== "latest-available" &&
    daily !== "partial" &&
    daily !== "stale" &&
    daily !== "ready";
  if (
    options.hasIntradayData &&
    dailyFailedWithoutCache &&
    (effectiveIntraday === "complete" || effectiveIntraday === "latest-available" || effectiveIntraday === "partial" || effectiveIntraday === "stale" || effectiveIntraday === "ready")
  ) {
    return "partial";
  }
  if (options.hasIntradayData && daily === "not-requested") {
    return effectiveIntraday;
  }
  return combinedMarketDataStatus(daily, effectiveIntraday);
}
