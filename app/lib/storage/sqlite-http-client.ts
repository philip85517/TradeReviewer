import type {
  CoverageSegment,
  DailyCandleRecord,
  IntervalCoverageSegment,
  MarketCandleRecord,
  NativeMarketInterval,
} from "../market/contracts";
import type { EpisodeReviewRecord } from "../reviews/types";
import type { EpisodeReviewState } from "./review-storage";
import type { TradeExecution } from "../trades/types";
import type { ChartSettings } from "./chart-settings";
import type { ImportHistoryEntry } from "./import-history";
import type { MarketDataJob } from "./market-data-jobs";
import type {
  IntervalMarketDataCommit,
  MarketDataCommit,
} from "./market-data-repository";
import type {
  BrowserStatePayload,
  ExecutionMergeReport,
  MigrationReport,
  SqliteStatus,
  StorageBootstrap,
  StoredInstrument,
} from "./sqlite-contracts";
import type { TagSuggestionRecord } from "../insights/types";

export class StorageHttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "StorageHttpError";
  }
}

export type MarketDataRead = {
  candles: MarketCandleRecord[];
  dailyCandles?: DailyCandleRecord[];
  intervalCoverage: IntervalCoverageSegment[];
  coverage?: CoverageSegment[];
};

export type MarketDataWrite =
  | { kind: "daily"; result: MarketDataCommit }
  | { kind: "interval"; result: IntervalMarketDataCommit };

export type MergeTradeDataInput = {
  executions: TradeExecution[];
  instruments?: StoredInstrument[];
  importHistory?: ImportHistoryEntry[];
  /** Existing execution ids intentionally removed by a client reconciliation decision. */
  replaceExecutionIds?: string[];
};

export type SuggestionDecisionInput = {
  suggestion: TagSuggestionRecord;
  review: EpisodeReviewRecord;
};

export type SqliteHttpClient = ReturnType<typeof createSqliteHttpClient>;

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

function errorFromResponse(status: number, body: unknown): StorageHttpError {
  const error = body && typeof body === "object" && "error" in body
    ? (body as { error?: unknown }).error
    : undefined;
  const code = error && typeof error === "object" && typeof (error as { code?: unknown }).code === "string"
    ? (error as { code: string }).code
    : "storage-request-failed";
  const message = error && typeof error === "object" && typeof (error as { message?: unknown }).message === "string"
    ? (error as { message: string }).message
    : `Storage request failed (${status})`;
  return new StorageHttpError(status, code, message);
}

async function parseResponse<T>(response: Response): Promise<T> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    if (!response.ok) throw new StorageHttpError(response.status, "storage-request-failed", `Storage request failed (${response.status})`);
    throw new StorageHttpError(response.status, "invalid-response", "Storage response was not valid JSON");
  }
  if (!response.ok) throw errorFromResponse(response.status, body);
  return body as T;
}

function jsonRequest(method: "POST" | "PUT", body: unknown): RequestInit {
  return {
    method,
    cache: "no-store",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

function marketDataUrl(input: {
  instrumentId: string;
  interval: NativeMarketInterval;
  start?: string;
  end?: string;
  dailyOnly?: boolean;
}): string {
  const params = new URLSearchParams({
    instrumentId: input.instrumentId,
    interval: input.interval,
  });
  if (input.start !== undefined) params.set("start", input.start);
  if (input.end !== undefined) params.set("end", input.end);
  if (input.dailyOnly) params.set("dailyOnly", "true");
  return `/api/storage/market-data?${params.toString()}`;
}

export function createSqliteHttpClient(fetcher: Fetcher = fetch): {
  getStatus(): Promise<SqliteStatus>;
  getBootstrap(): Promise<StorageBootstrap>;
  migrate(payload: BrowserStatePayload): Promise<MigrationReport>;
  mergeExecutions(input: MergeTradeDataInput): Promise<ExecutionMergeReport>;
  putReview(record: EpisodeReviewRecord): Promise<EpisodeReviewRecord>;
  putReviewState(state: EpisodeReviewState): Promise<EpisodeReviewState>;
  putTagSuggestion(record: TagSuggestionRecord): Promise<TagSuggestionRecord>;
  putSuggestionDecision(input: SuggestionDecisionInput): Promise<SuggestionDecisionInput>;
  getProviderSymbol(instrumentId: string, provider: string): Promise<string | undefined>;
  getMarketData(input: {
    instrumentId: string;
    interval: NativeMarketInterval;
    start?: string;
    end?: string;
    dailyOnly?: boolean;
  }): Promise<MarketDataRead>;
  putMarketData(input: MarketDataWrite): Promise<{ ok: true }>;
  putMarketDataJob(job: MarketDataJob): Promise<MarketDataJob>;
  getSettings(): Promise<ChartSettings>;
  putSettings(settings: ChartSettings): Promise<ChartSettings>;
} {
  return {
    getStatus: async () => parseResponse<SqliteStatus>(await fetcher("/api/storage/status", { cache: "no-store" })),
    getBootstrap: async () => parseResponse<StorageBootstrap>(await fetcher("/api/storage/bootstrap", { cache: "no-store" })),
    migrate: async (payload) => parseResponse<MigrationReport>(await fetcher("/api/storage/migrate", jsonRequest("POST", payload))),
    mergeExecutions: async (input) => parseResponse<ExecutionMergeReport>(await fetcher("/api/storage/trades", jsonRequest("PUT", input))),
    putReview: async (record) => parseResponse<EpisodeReviewRecord>(await fetcher("/api/storage/reviews", jsonRequest("PUT", record))),
    putReviewState: async (state) => parseResponse<EpisodeReviewState>(await fetcher("/api/storage/reviews", jsonRequest("PUT", state))),
    putTagSuggestion: async (record) => parseResponse<TagSuggestionRecord>(await fetcher("/api/storage/reviews", jsonRequest("PUT", record))),
    putSuggestionDecision: async (input) => parseResponse<SuggestionDecisionInput>(await fetcher("/api/storage/reviews", jsonRequest("PUT", { kind: "suggestion-decision", ...input }))),
    getProviderSymbol: async (instrumentId, provider) => {
      const params = new URLSearchParams({ instrumentId, provider });
      const result = await parseResponse<{ providerSymbol: string | null }>(await fetcher(`/api/storage/market-data?${params.toString()}`, { cache: "no-store" }));
      return result.providerSymbol ?? undefined;
    },
    getMarketData: async (input) => parseResponse<MarketDataRead>(await fetcher(marketDataUrl(input), { cache: "no-store" })),
    putMarketData: async (input) => parseResponse<{ ok: true }>(await fetcher("/api/storage/market-data", jsonRequest("PUT", input))),
    putMarketDataJob: async (job) => parseResponse<MarketDataJob>(await fetcher("/api/storage/market-data", jsonRequest("PUT", { kind: "job", job }))),
    getSettings: async () => parseResponse<ChartSettings>(await fetcher("/api/storage/settings", { cache: "no-store" })),
    putSettings: async (settings) => parseResponse<ChartSettings>(await fetcher("/api/storage/settings", jsonRequest("PUT", settings))),
  };
}
