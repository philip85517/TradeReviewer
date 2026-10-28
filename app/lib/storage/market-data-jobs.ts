/** MIGRATION-ONLY: load/save access the retired browser rollback copy. */
import type { MarketDataJob, MarketDataJobInput } from "./market-data-job-contract";
import { isLegacyMarketDataJob, isLegacyMarketDataJobBase } from "./market-data-job-contract";
export type { MarketDataErrorDetail, MarketDataIntervalJob, MarketDataJob, MarketDataJobInput } from "./market-data-job-contract";
export { isMarketDataErrorDetail, isLegacyMarketDataIntervalJob, isLegacyMarketDataJobBase, isLegacyMarketDataJob } from "./market-data-job-contract";

export const MARKET_DATA_JOBS_STORAGE_KEY =
  "trade-reviewer:market-data-jobs:v1";

function withIntervals(job: MarketDataJobInput): MarketDataJob {
  return {
    ...job,
    intervals: job.intervals ?? [
      {
        interval: "1D",
        status: job.status,
        ...(job.message === undefined ? {} : { message: job.message }),
      },
    ],
  };
}

export function recoverInterruptedJob(job: MarketDataJob): MarketDataJob {
  if (job.status !== "syncing") return job;
  const message = "上次行情更新被中断，请重试。";
  return {
    ...job,
    status: "error",
    message,
    intervals: job.intervals.map((interval) =>
      interval.status === "syncing"
        ? { ...interval, status: "error", message }
        : interval,
    ),
  };
}

export function loadMarketDataJobs(): MarketDataJob[] {
  if (typeof window === "undefined") return [];
  const serialized = window.localStorage.getItem(
    MARKET_DATA_JOBS_STORAGE_KEY,
  );
  if (!serialized) return [];
  try {
    const parsed = JSON.parse(serialized) as {
      version?: unknown;
      jobs?: unknown;
    };
    if (!Array.isArray(parsed.jobs)) return [];
    if (parsed.version === 2) {
      return parsed.jobs.filter(isLegacyMarketDataJob).map(recoverInterruptedJob);
    }
    if (parsed.version === 1) {
      return parsed.jobs
        .filter(isLegacyMarketDataJobBase)
        .map((job) => withIntervals(job))
        .map(recoverInterruptedJob);
    }
    return [];
  } catch {
    return [];
  }
}

export function saveMarketDataJob(job: MarketDataJobInput) {
  if (typeof window === "undefined") return;
  const record = withIntervals(job);
  const jobs = [
    record,
    ...loadMarketDataJobs().filter(
      (item) => item.instrumentId !== record.instrumentId,
    ),
  ];
  window.localStorage.setItem(
    MARKET_DATA_JOBS_STORAGE_KEY,
    JSON.stringify({ version: 2, jobs }),
  );
}
