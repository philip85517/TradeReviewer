import type { CoverageStatus } from "./contracts";

export type MarketDataSyncStatus =
  | "not-requested"
  | "syncing"
  | "complete"
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
    "stale",
  ];
  return (
    priority.find((status) =>
      segments.some((segment) => segment.status === status),
    ) ?? "complete"
  );
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
    daily !== "partial" &&
    daily !== "stale" &&
    daily !== "ready";
  if (
    options.hasIntradayData &&
    dailyFailedWithoutCache &&
    (effectiveIntraday === "complete" || effectiveIntraday === "partial" || effectiveIntraday === "stale" || effectiveIntraday === "ready")
  ) {
    return "partial";
  }
  if (options.hasIntradayData && daily === "not-requested") {
    return effectiveIntraday;
  }
  return combinedMarketDataStatus(daily, effectiveIntraday);
}
