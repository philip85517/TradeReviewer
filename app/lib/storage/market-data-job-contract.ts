import type { MarketDataSyncStatus } from "../market/sync-status";
import type { NativeMarketInterval } from "../market/contracts";

export type MarketDataErrorDetail = {
  code: string;
  message: string;
};

export function isMarketDataErrorDetail(
  value: unknown,
): value is MarketDataErrorDetail {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const error = value as Partial<MarketDataErrorDetail>;
  return (
    typeof error.code === "string" &&
    error.code.length > 0 &&
    typeof error.message === "string" &&
    error.message.length > 0
  );
}

export type MarketDataIntervalJob = {
  interval: NativeMarketInterval;
  status: MarketDataSyncStatus;
  message?: string;
  error?: MarketDataErrorDetail;
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
  error?: MarketDataErrorDetail;
  intervals: MarketDataIntervalJob[];
};

export type MarketDataJobInput = Omit<MarketDataJob, "intervals"> & {
  intervals?: MarketDataIntervalJob[];
};

const VALID_STATUSES: MarketDataSyncStatus[] = [
  "not-requested",
  "syncing",
  "complete",
  "latest-available",
  "partial",
  "stale",
  "source-rate-limited",
  "source-forbidden",
  "source-unavailable",
  "invalid-response",
  "storage-error",
  "needs-provider",
  "ready",
  "error",
];

export function isLegacyMarketDataIntervalJob(value: unknown): value is MarketDataIntervalJob {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<MarketDataIntervalJob>;
  return (
    (candidate.interval === "15m" || candidate.interval === "1h" || candidate.interval === "1D") &&
    typeof candidate.status === "string" &&
    VALID_STATUSES.includes(candidate.status) &&
    (candidate.message === undefined || typeof candidate.message === "string") &&
    (candidate.error === undefined || isMarketDataErrorDetail(candidate.error)) &&
    (candidate.coverageStart === undefined ||
      typeof candidate.coverageStart === "string") &&
    (candidate.coverageEnd === undefined ||
      typeof candidate.coverageEnd === "string")
  );
}

export function isLegacyMarketDataJobBase(value: unknown): value is Omit<MarketDataJob, "intervals"> {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<MarketDataJobInput> & { coverageStart?: unknown; coverageEnd?: unknown };
  return (
    typeof candidate.instrumentId === "string" &&
    typeof candidate.symbol === "string" &&
    typeof candidate.market === "string" &&
    typeof candidate.requestedAt === "string" &&
    typeof candidate.status === "string" &&
    VALID_STATUSES.includes(candidate.status) &&
    (candidate.message === undefined || typeof candidate.message === "string") &&
    (candidate.error === undefined || isMarketDataErrorDetail(candidate.error)) &&
    (candidate.coverageStart === undefined || typeof candidate.coverageStart === "string") &&
    (candidate.coverageEnd === undefined || typeof candidate.coverageEnd === "string")
  );
}

export function isLegacyMarketDataJob(value: unknown): value is MarketDataJob {
  return (
    isLegacyMarketDataJobBase(value) &&
    Array.isArray((value as Partial<MarketDataJob>).intervals) &&
    (value as Partial<MarketDataJob>).intervals?.every(isLegacyMarketDataIntervalJob) === true
  );
}

