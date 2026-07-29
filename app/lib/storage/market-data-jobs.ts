import type { MarketDataSyncStatus } from "../market/sync-status";
import type { NativeMarketInterval } from "../market/contracts";

export const MARKET_DATA_JOBS_STORAGE_KEY =
  "trade-reviewer:market-data-jobs:v1";

export type MarketDataIntervalJob = {
  interval: NativeMarketInterval;
  status: MarketDataSyncStatus;
  message?: string;
  coverageStart?: string;
  coverageEnd?: string;
};

export type MarketDataJob = {
  instrumentId: string;
  symbol: string;
  market: string;
  requestedAt: string;
  status: MarketDataSyncStatus;
  message?: string;
  intervals: MarketDataIntervalJob[];
};

export type MarketDataJobInput = Omit<MarketDataJob, "intervals"> & {
  intervals?: MarketDataIntervalJob[];
};

const VALID_STATUSES: MarketDataSyncStatus[] = [
  "not-requested",
  "syncing",
  "complete",
  "partial",
  "stale",
  "source-unavailable",
  "invalid-response",
  "storage-error",
  "needs-provider",
  "ready",
  "error",
];

function isIntervalJob(value: unknown): value is MarketDataIntervalJob {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<MarketDataIntervalJob>;
  return (
    (candidate.interval === "15m" || candidate.interval === "1D") &&
    typeof candidate.status === "string" &&
    VALID_STATUSES.includes(candidate.status) &&
    (candidate.message === undefined || typeof candidate.message === "string") &&
    (candidate.coverageStart === undefined ||
      typeof candidate.coverageStart === "string") &&
    (candidate.coverageEnd === undefined ||
      typeof candidate.coverageEnd === "string")
  );
}

function isBaseJob(value: unknown): value is Omit<MarketDataJob, "intervals"> {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<MarketDataJob>;
  return (
    typeof candidate.instrumentId === "string" &&
    typeof candidate.symbol === "string" &&
    typeof candidate.market === "string" &&
    typeof candidate.requestedAt === "string" &&
    typeof candidate.status === "string" &&
    VALID_STATUSES.includes(candidate.status)
  );
}

function isJob(value: unknown): value is MarketDataJob {
  return (
    isBaseJob(value) &&
    Array.isArray((value as Partial<MarketDataJob>).intervals) &&
    (value as Partial<MarketDataJob>).intervals?.every(isIntervalJob) === true
  );
}

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

function recoverInterruptedJob(job: MarketDataJob): MarketDataJob {
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
      return parsed.jobs.filter(isJob).map(recoverInterruptedJob);
    }
    if (parsed.version === 1) {
      return parsed.jobs
        .filter(isBaseJob)
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
