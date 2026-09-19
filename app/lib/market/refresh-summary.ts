import type { NativeMarketInterval } from "./contracts";
import type { MarketDataSyncStatus } from "./sync-status";
import type {
  MarketDataIntervalJob,
  MarketDataJob,
} from "../storage/market-data-jobs";

/**
 * The queue keeps the retry count independent from the result categories.
 * A partially usable instrument can therefore appear in both `partial` and
 * `retryable`, while the three result categories remain mutually exclusive.
 */
export type GlobalMarketRefreshSummary = {
  total: number;
  processed: number;
  completed: number;
  partial: number;
  /** Instruments with no usable result, excluding partial instruments. */
  failed: number;
  /** Instruments with at least one interval that can be retried. */
  retryable: number;
  cancelled: number;
  unfinished: number;
  unfinishedInstrumentIds: string[];
  unfinishedDetails: GlobalMarketRefreshUnfinishedDetail[];
  retryableInstrumentIds: string[];
  failureDetails: GlobalMarketRefreshFailureDetail[];
  /** True when the numbers came from saved per-instrument jobs. */
  restored: boolean;
};

export type GlobalMarketRefreshFailureInterval = {
  /** `overall` is used when a legacy job has no interval detail. */
  interval: NativeMarketInterval | "overall";
  status: MarketDataSyncStatus;
  reason: string;
  coverageStart?: string;
  coverageEnd?: string;
};

export type GlobalMarketRefreshFailureDetail = {
  instrumentId: string;
  symbol: string;
  market: string;
  /** Last attempt recorded by the durable per-instrument job. */
  requestedAt: string;
  intervals: GlobalMarketRefreshFailureInterval[];
};

export type GlobalMarketRefreshUnfinishedDetail = {
  instrumentId: string;
  symbol: string;
  market: string;
  /** Last attempt recorded by the durable job, if one exists. */
  requestedAt: string;
  status: Extract<MarketDataSyncStatus, "syncing" | "not-requested">;
  reason: string;
};

export type GlobalMarketRefreshInventoryItem = {
  instrumentId: string;
  symbol: string;
  market: string;
};

export type GlobalMarketRefreshStateInput = {
  running?: boolean;
  total: number;
  processed?: number;
  completed: number;
  partial: number;
  /** Exclusive hard failure count when `retryable` is present. */
  failed: number;
  retryable?: number;
  cancelled?: number;
};

const RETRYABLE_STATUSES = new Set<MarketDataSyncStatus>([
  "source-rate-limited",
  "source-forbidden",
  "source-unavailable",
  "invalid-response",
  "storage-error",
  "needs-provider",
  "error",
]);

const PARTIAL_STATUSES = new Set<MarketDataSyncStatus>([
  "partial",
  "latest-available",
  "stale",
]);

const COMPLETE_STATUSES = new Set<MarketDataSyncStatus>([
  "complete",
  "ready",
]);

function nonNegativeInteger(value: number | undefined, fallback = 0) {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.floor(value));
}

function clampCount(value: number, maximum: number) {
  return Math.min(nonNegativeInteger(value), maximum);
}

/**
 * Summarize a live queue state. New callers provide `retryable` and keep
 * `failed` exclusive; legacy callers only provide `failed`, where it was the
 * retry count and can overlap `partial`.
 */
export function summarizeGlobalMarketRefresh(
  state: GlobalMarketRefreshStateInput,
): GlobalMarketRefreshSummary {
  const total = nonNegativeInteger(state.total);
  const processed = clampCount(
    state.processed ?? state.completed + state.partial + state.failed,
    total,
  );
  const completed = clampCount(state.completed, total);
  const partial = clampCount(state.partial, total);
  const retryable = clampCount(state.retryable ?? state.failed, total);
  const failed = state.retryable === undefined
    ? Math.max(0, retryable - partial)
    : clampCount(state.failed, total);
  const cancelled = clampCount(state.cancelled ?? 0, total);

  return {
    total,
    processed,
    completed,
    partial,
    failed,
    retryable,
    cancelled,
    unfinished: Math.max(0, total - processed),
    unfinishedInstrumentIds: [],
    unfinishedDetails: [],
    retryableInstrumentIds: [],
    failureDetails: [],
    restored: false,
  };
}

function isRetryableInterval(interval: MarketDataIntervalJob) {
  return (
    RETRYABLE_STATUSES.has(interval.status) ||
    Boolean(interval.error)
  );
}

function isRetryableJob(job: MarketDataJob) {
  return (
    RETRYABLE_STATUSES.has(job.status) ||
    Boolean(job.error) ||
    job.intervals.some(isRetryableInterval)
  );
}

function isUnfinishedStatus(status: MarketDataSyncStatus) {
  return status === "not-requested" || status === "syncing";
}

function isUnfinishedJob(job: MarketDataJob) {
  return (
    isUnfinishedStatus(job.status) ||
    job.intervals.some((interval) => isUnfinishedStatus(interval.status))
  );
}

function unfinishedStatus(job: MarketDataJob): "syncing" | "not-requested" {
  return job.status === "syncing" ||
    job.intervals.some((interval) => interval.status === "syncing")
    ? "syncing"
    : "not-requested";
}

function unfinishedReason(job: MarketDataJob) {
  if (unfinishedStatus(job) === "syncing") {
    return "上次未结束，可重新尝试";
  }
  return job.error?.message ?? "尚未开始行情更新";
}

function inventoryItem(
  item: string | GlobalMarketRefreshInventoryItem,
  job: MarketDataJob | undefined,
): GlobalMarketRefreshInventoryItem {
  if (typeof item !== "string") return item;
  const separator = item.indexOf(":");
  return {
    instrumentId: item,
    symbol: job?.symbol ?? (separator >= 0 ? item.slice(separator + 1) : item),
    market: job?.market ?? (separator >= 0 ? item.slice(0, separator) : ""),
  };
}

function unfinishedDetail(
  item: GlobalMarketRefreshInventoryItem,
  job: MarketDataJob | undefined,
): GlobalMarketRefreshUnfinishedDetail {
  return {
    instrumentId: item.instrumentId,
    symbol: job?.symbol ?? item.symbol,
    market: job?.market ?? item.market,
    requestedAt: job?.requestedAt ?? "",
    status: job ? unfinishedStatus(job) : "not-requested",
    reason: job ? unfinishedReason(job) : "尚未记录行情更新任务",
  };
}

/** Classifies one settled result for the mutually exclusive UI categories. */
export function classifyMarketDataRefreshStatus(
  status: MarketDataSyncStatus | undefined,
) {
  if (!status || status === "not-requested" || status === "syncing") {
    return undefined;
  }
  if (COMPLETE_STATUSES.has(status)) return "complete" as const;
  if (PARTIAL_STATUSES.has(status)) return "partial" as const;
  return "failed" as const;
}

function classifyPersistedJob(job: MarketDataJob) {
  const overall = classifyMarketDataRefreshStatus(job.status);
  const hasHardInterval = job.intervals.some((interval) =>
    RETRYABLE_STATUSES.has(interval.status) &&
    !PARTIAL_STATUSES.has(interval.status),
  );
  const hasUsableInterval = job.intervals.some((interval) =>
    COMPLETE_STATUSES.has(interval.status) || PARTIAL_STATUSES.has(interval.status),
  );
  if (hasHardInterval && overall === "complete") {
    return hasUsableInterval ? "partial" as const : "failed" as const;
  }
  return overall;
}

function intervalReason(
  job: MarketDataJob,
  interval: MarketDataIntervalJob,
) {
  return (
    interval.error?.message ??
    interval.message ??
    job.error?.message ??
    job.message ??
    "该周期更新未完成"
  );
}

function failureDetail(job: MarketDataJob): GlobalMarketRefreshFailureDetail {
  const intervals: GlobalMarketRefreshFailureInterval[] = job.intervals
    .filter(isRetryableInterval)
    .map((interval) => ({
      interval: interval.interval,
      status: interval.status,
      reason: intervalReason(job, interval),
      ...(interval.coverageStart
        ? { coverageStart: interval.coverageStart }
        : {}),
      ...(interval.coverageEnd ? { coverageEnd: interval.coverageEnd } : {}),
    }));

  // A malformed or legacy job can carry only an overall status. Keep that
  // failure inspectable instead of silently dropping it from the details UI.
  if (intervals.length === 0 && isRetryableJob(job)) {
    intervals.push({
      interval: "overall",
      status: job.status,
      reason: job.error?.message ?? job.message ?? "该标的行情更新未完成",
    });
  }

  return {
    instrumentId: job.instrumentId,
    symbol: job.symbol,
    market: job.market,
    requestedAt: job.requestedAt,
    intervals,
  };
}

/** Builds a visible detail row when a worker failed before it could persist a terminal job. */
export function failureDetailForReason(input: {
  instrumentId: string;
  symbol: string;
  market: string;
  reason: string;
  status?: MarketDataSyncStatus;
  requestedAt?: string;
  coverageStart?: string;
  coverageEnd?: string;
}): GlobalMarketRefreshFailureDetail {
  return {
    instrumentId: input.instrumentId,
    symbol: input.symbol,
    market: input.market,
    intervals: [
      {
        interval: "overall",
        status: input.status ?? "error",
        reason: input.reason,
        ...(input.coverageStart
          ? { coverageStart: input.coverageStart }
          : {}),
        ...(input.coverageEnd ? { coverageEnd: input.coverageEnd } : {}),
      },
    ],
    requestedAt: input.requestedAt ?? "",
  };
}

/**
 * Reconstruct the global display from the durable one-job-per-instrument
 * records. This is deliberately a snapshot of saved state; it never starts a
 * provider request and it does not imply that these jobs were one batch.
 */
export function summarizePersistedMarketDataJobs(
  jobs: readonly MarketDataJob[],
  inventory?: readonly (string | GlobalMarketRefreshInventoryItem)[],
): GlobalMarketRefreshSummary {
  const byInstrument = new Map(jobs.map((job) => [job.instrumentId, job]));
  const inventoryItems = inventory
    ? inventory.map((item) => inventoryItem(
        item,
        byInstrument.get(typeof item === "string" ? item : item.instrumentId),
      ))
    : jobs.map((job) => ({
        instrumentId: job.instrumentId,
        symbol: job.symbol,
        market: job.market,
      }));
  // An explicitly supplied empty inventory means there is nothing to render.
  // Only the omitted argument uses the jobs as its implicit inventory.
  const requestedIds = inventory === undefined
    ? [...new Set(jobs.map((job) => job.instrumentId))]
    : [...new Set(inventoryItems.map((item) => item.instrumentId))];
  const selected = requestedIds.map((instrumentId) => {
    const job = byInstrument.get(instrumentId);
    const item = inventoryItems.find((candidate) => candidate.instrumentId === instrumentId) ??
      inventoryItem(instrumentId, job);
    return { item, job };
  });
  let completed = 0;
  let partial = 0;
  let failed = 0;
  const retryableJobs: MarketDataJob[] = [];
  const unfinishedItems: Array<{
    item: GlobalMarketRefreshInventoryItem;
    job?: MarketDataJob;
  }> = [];

  for (const { item, job } of selected) {
    if (!job || isUnfinishedJob(job)) {
      unfinishedItems.push({ item, job });
      continue;
    }
    const category = classifyPersistedJob(job);
    if (category === "complete") completed += 1;
    else if (category === "partial") partial += 1;
    else if (category === "failed") failed += 1;
    if (isRetryableJob(job)) retryableJobs.push(job);
  }

  const retryableInstrumentIds = retryableJobs.map((job) => job.instrumentId);
  const total = requestedIds.length;
  const unfinishedInstrumentIds = unfinishedItems.map(({ item }) => item.instrumentId);
  const unfinishedDetails = unfinishedItems.map(({ item, job }) =>
    unfinishedDetail(item, job),
  );
  const processed = Math.max(0, total - unfinishedItems.length);

  return {
    total,
    processed: Math.min(processed, total),
    completed,
    partial,
    failed,
    retryable: retryableJobs.length,
    cancelled: 0,
    unfinished: Math.max(0, total - processed),
    unfinishedInstrumentIds,
    unfinishedDetails,
    retryableInstrumentIds,
    failureDetails: retryableJobs.map(failureDetail),
    restored: true,
  };
}
