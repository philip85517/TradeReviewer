import type { CoverageStatus } from "./contracts";

export type MarketDataSyncStatus =
  | "not-requested"
  | "syncing"
  | "complete"
  | "partial"
  | "stale"
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
