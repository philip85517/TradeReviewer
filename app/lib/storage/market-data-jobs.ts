import type { MarketDataSyncStatus } from "../market/sync-status";

export const MARKET_DATA_JOBS_STORAGE_KEY =
  "trade-reviewer:market-data-jobs:v1";

export type MarketDataJob = {
  instrumentId: string;
  symbol: string;
  market: string;
  requestedAt: string;
  status: MarketDataSyncStatus;
  message?: string;
};

function isJob(value: unknown): value is MarketDataJob {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<MarketDataJob>;
  return (
    typeof candidate.instrumentId === "string" &&
    typeof candidate.symbol === "string" &&
    typeof candidate.market === "string" &&
    typeof candidate.requestedAt === "string" &&
    [
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
    ].includes(
      candidate.status ?? "",
    )
  );
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
    return parsed.version === 1 && Array.isArray(parsed.jobs)
      ? parsed.jobs.filter(isJob).map((job) =>
          job.status === "syncing"
            ? {
                ...job,
                status: "error" as const,
                message: "上次行情更新被中断，请重试。",
              }
            : job,
        )
      : [];
  } catch {
    return [];
  }
}

export function saveMarketDataJob(job: MarketDataJob) {
  if (typeof window === "undefined") return;
  const jobs = [
    job,
    ...loadMarketDataJobs().filter(
      (item) => item.instrumentId !== job.instrumentId,
    ),
  ];
  window.localStorage.setItem(
    MARKET_DATA_JOBS_STORAGE_KEY,
    JSON.stringify({ version: 1, jobs }),
  );
}
