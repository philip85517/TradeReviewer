import type { MarketDataJob } from "../storage/market-data-jobs";
import type { MarketDataSyncStatus } from "./sync-status";

export type MarketDataRetryDimension = "holdings" | "historical";

export type MarketDataRetryJobCheck =
  | { status: "ready" }
  | { status: "unfinished"; message: string }
  | { status: "failed"; message: string };

export type RetryMarketDataOptions = {
  dimension: MarketDataRetryDimension;
  instrumentIds: readonly string[];
  start: () => boolean | Promise<boolean>;
  jobFor: (instrumentId: string) => MarketDataJob | undefined;
};

const failedStatuses: ReadonlySet<MarketDataSyncStatus> = new Set([
  "source-rate-limited",
  "source-forbidden",
  "source-unavailable",
  "invalid-response",
  "storage-error",
  "error",
  "needs-provider",
]);

function messageFor(job: MarketDataJob, fallback: string): string {
  return job.error?.message ?? job.message ?? fallback;
}

function checkInterval(
  job: MarketDataJob,
  interval: "1D" | "all",
): MarketDataRetryJobCheck {
  // A job-level failure describes persistence or the overall refresh. It is
  // relevant to holdings even when its daily interval was already complete;
  // only an unrelated interval failure may be ignored for a holdings retry.
  if (failedStatuses.has(job.status)) {
    return { status: "failed", message: messageFor(job, "行情更新失败，请查看数据状态后重试") };
  }
  const relevant = interval === "all"
    ? job.intervals
    : job.intervals.filter(item => item.interval === "1D");
  if (relevant.length === 0) {
    return job.status === "syncing" || job.status === "not-requested"
      ? { status: "unfinished", message: "行情更新未完成或未开始，请查看数据状态后重试" }
      : { status: "failed", message: "行情更新缺少日线终态，请查看数据状态后重试" };
  }
  const unfinished = relevant.find(item => item.status === "syncing" || item.status === "not-requested");
  if (unfinished) {
    return { status: "unfinished", message: unfinished.message ?? "行情更新未完成或未开始，请查看数据状态后重试" };
  }
  const failed = relevant.find(item => failedStatuses.has(item.status));
  if (failed) {
    return { status: "failed", message: failed.error?.message ?? failed.message ?? "行情更新失败，请查看数据状态后重试" };
  }
  return { status: "ready" };
}

export function checkMarketDataRetryJob(
  job: MarketDataJob | undefined,
  dimension: MarketDataRetryDimension,
): MarketDataRetryJobCheck {
  if (!job) return { status: "unfinished", message: "行情更新未完成或未开始，请查看数据状态后重试" };
  return checkInterval(job, dimension === "holdings" ? "1D" : "all");
}

export async function retryMarketData(options: RetryMarketDataOptions): Promise<void> {
  if (!(await options.start())) {
    throw new Error("行情更新未开始：其他页面正在更新行情，请稍后再试");
  }
  for (const instrumentId of options.instrumentIds) {
    const result = checkMarketDataRetryJob(options.jobFor(instrumentId), options.dimension);
    if (result.status !== "ready") throw new Error(result.message);
  }
}
