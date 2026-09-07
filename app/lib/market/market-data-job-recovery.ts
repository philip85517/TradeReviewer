import type { MarketDataJob } from "../storage/market-data-jobs";

export const MARKET_DATA_JOB_STALE_AFTER_MS = 5 * 60 * 1000;

export function recoverStaleMarketDataJob(
  job: MarketDataJob,
  now = new Date(),
  staleAfterMs = MARKET_DATA_JOB_STALE_AFTER_MS,
): MarketDataJob {
  if (job.status !== "syncing") return job;
  const requestedAt = Date.parse(job.requestedAt);
  if (!Number.isFinite(requestedAt)) return job;
  if (now.getTime() - requestedAt < staleAfterMs) return job;
  const message = "上次行情更新被中断，请重试。";
  const error = {
    code: "market-data-job-interrupted",
    message,
  };
  return {
    ...job,
    status: "error",
    message,
    error,
    intervals: job.intervals.map((interval) =>
      interval.status === "syncing"
        ? { ...interval, status: "error", message, error }
        : interval,
    ),
  };
}
