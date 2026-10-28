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
  InstrumentMetadataRead,
  MigrationReport,
  SqliteStatus,
  StorageBootstrap,
  StoredInstrument,
  TradeChangeIntent,
  TradeChangeCommit,
  ReviewPlan,
  CommitReceipt,
} from "./sqlite-contracts";
import type { ResolvedInstrument } from "../instruments/metadata-contracts";
import type { TagSuggestionRecord } from "../insights/types";
import { parseHomepageStoredCollection, type HomepageStoredCollection } from "./homepage-source-contract";
import { encodeTradeRead, parseTradeReadPage, assertTradeReadSelection, assembleTradeReadPages, type StoredTradeSelection, type TradeReadPage, type TradeBookRead } from "./trade-read-contract";
import { parseTradePlan, parseTradeCommitReceipt, parseWriteAcknowledgement } from "./trade-change-response";
import type { ImportHistoryCommitRead } from "./import-history-contract";
import type { BookVersion } from "./trade-book-version";

export class StorageHttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly category?: string,
    readonly phase?: string,
    readonly retryable?: boolean,
    readonly correlationId?: string,
    readonly locators?: string[],
    readonly savedState?: string,
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

type SqliteHttpClientWithMetadata = ReturnType<typeof createSqliteHttpClient>;
type OptionalClientMethods = "getInstrumentMetadata" | "putInstrumentMetadata" | "putInstrumentName" | "getHomepageSource" | "prepareTradeChanges" | "commitTradeChanges" | "getTradeCommit" | "readTradeSnapshot" | "readTradeBook" | "readImportHistoryCommit";
export type SqliteHttpClient = Omit<
  SqliteHttpClientWithMetadata,
  OptionalClientMethods
> & Partial<Pick<
  SqliteHttpClientWithMetadata,
  OptionalClientMethods
>>;

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

export function errorFromResponse(status: number, body: unknown): StorageHttpError {
  const error = body && typeof body === "object" && "error" in body
    ? (body as { error?: unknown }).error
    : undefined;
  const code = error && typeof error === "object" && typeof (error as { code?: unknown }).code === "string"
    ? (error as { code: string }).code
    : "storage-request-failed";
  const message = error && typeof error === "object" && typeof (error as { message?: unknown }).message === "string"
    ? (error as { message: string }).message
    : `Storage request failed (${status})`;
  const details = error && typeof error === "object" ? error as Record<string, unknown> : {};
  return new StorageHttpError(status, code, message,
    typeof details.category === "string" ? details.category : undefined,
    typeof details.phase === "string" ? details.phase : undefined,
    typeof details.retryable === "boolean" ? details.retryable : undefined,
    typeof details.correlationId === "string" ? details.correlationId : undefined,
    Array.isArray(details.locators) && details.locators.every(v => typeof v === "string") ? details.locators : undefined,
    typeof details.savedState === "string" ? details.savedState : undefined);
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

function instrumentMetadataUrl(instrumentIds: readonly string[]): string {
  const params = new URLSearchParams();
  for (const instrumentId of new Set(instrumentIds)) params.append("id", instrumentId);
  return `/api/storage/instruments/metadata?${params.toString()}`;
}

export function createSqliteHttpClient(fetcher: Fetcher = fetch): {
  getStatus(): Promise<SqliteStatus>;
  getBootstrap(): Promise<StorageBootstrap & { bookVersion?: TradeBookRead["bookVersion"]; tradeReadPages?: readonly TradeReadPage[] }>;
  getHomepageSource(signal?: AbortSignal, version?: StoredTradeSelection["version"]): Promise<HomepageStoredCollection>;
  getInstrumentMetadata(instrumentIds: string[], signal?: AbortSignal): Promise<InstrumentMetadataRead>;
  putInstrumentMetadata(record: ResolvedInstrument): Promise<{ ok: true }>;
  putInstrumentName(input: { instrumentId: string; name: string }): Promise<{ ok: true }>;
  prepareTradeChanges(intent: TradeChangeIntent): Promise<ReviewPlan>;
  commitTradeChanges(input: TradeChangeCommit): Promise<CommitReceipt>;
  getTradeCommit(requestId: string): Promise<CommitReceipt | null>;
  readTradeSnapshot(selection?: StoredTradeSelection): Promise<TradeReadPage>;
  readTradeBook(selection?: Omit<StoredTradeSelection, "cursor">): Promise<TradeBookRead>;
  readImportHistoryCommit(batchId: string, version: BookVersion, signal?: AbortSignal): Promise<ImportHistoryCommitRead>;
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
  }, signal?: AbortSignal): Promise<MarketDataRead>;
  putMarketData(input: MarketDataWrite): Promise<{ ok: true }>;
  putMarketDataJob(job: MarketDataJob): Promise<MarketDataJob>;
  getSettings(): Promise<ChartSettings>;
  putSettings(settings: ChartSettings): Promise<ChartSettings>;
} {
  async function checkedResponse<T>(response: Response, parse: (body: unknown) => T): Promise<T> {
    const body = await parseResponse<unknown>(response);
    try { return parse(body); }
    catch { throw new StorageHttpError(response.status, "invalid-response", "Storage returned an invalid trade response"); }
  }
  async function readTradeSnapshot(selection: StoredTradeSelection = {}): Promise<TradeReadPage> {
    const response = await fetcher("/api/storage/trades/read", jsonRequest("POST", selection));
    const body = await parseResponse<unknown>(response);
    try { const page = await parseTradeReadPage(body); await assertTradeReadSelection(page, selection); return page; }
    catch { throw new StorageHttpError(response.status, "invalid-response", "Storage returned an invalid trade snapshot"); }
  }
  async function readTradeBook(selection: Omit<StoredTradeSelection, "cursor"> = {}): Promise<TradeBookRead> {
    const pages: TradeReadPage[] = [];
    const displayIds = new Set<string>(), facts = new Map<string, TradeReadPage["snapshot"]["facts"][number]>(), cursors = new Set<string>();
    let nextSelection: StoredTradeSelection = selection;
    for (;;) {
      const page = await readTradeSnapshot(nextSelection);
      const first = pages[0] ?? page;
      const invalid = () => new StorageHttpError(200, "invalid-response", "Storage did not return a complete same-version trade collection");
      if (encodeTradeRead(page.snapshot.bookVersion) !== encodeTradeRead(first.snapshot.bookVersion)
        || page.snapshot.receipt.selectionDigest !== first.snapshot.receipt.selectionDigest
        || page.snapshot.receipt.totalDisplayFacts !== first.snapshot.receipt.totalDisplayFacts
        || page.snapshot.receipt.totalDependencyFacts !== first.snapshot.receipt.totalDependencyFacts
        || page.snapshot.receipt.displayOffset !== displayIds.size
        || encodeTradeRead(page.display.instruments) !== encodeTradeRead(first.display.instruments)
        || encodeTradeRead(page.display.importHistory) !== encodeTradeRead(first.display.importHistory)) throw invalid();
      for (const id of page.snapshot.displayExecutionIds) { if (displayIds.has(id)) throw invalid(); displayIds.add(id); }
      for (const fact of page.snapshot.facts) {
        const existing = facts.get(fact.id);
        if (existing && encodeTradeRead(existing) !== encodeTradeRead(fact)) throw invalid();
        facts.set(fact.id, fact);
      }
      pages.push(page);
      const cursor = page.snapshot.nextCursor;
      if (cursor === null) {
        const dependencyIds = new Set(pages.flatMap(p => p.snapshot.dependencyExecutionIds));
        if (displayIds.size !== first.snapshot.receipt.totalDisplayFacts || dependencyIds.size !== first.snapshot.receipt.totalDependencyFacts) throw invalid();
        try { return assembleTradeReadPages(pages); } catch { throw invalid(); }
      }
      if (!page.snapshot.displayExecutionIds.length || cursors.has(cursor)) throw invalid();
      cursors.add(cursor);
      nextSelection = { ...selection, version: { exact: first.snapshot.bookVersion }, cursor };
    }
  }
  return {
    prepareTradeChanges: async intent => checkedResponse(await fetcher("/api/storage/trades/plans", jsonRequest("POST", intent)), body => parseTradePlan(body, intent.kind)),
    commitTradeChanges: async input => checkedResponse(await fetcher("/api/storage/trades/commit", jsonRequest("POST", input)), body => parseTradeCommitReceipt(body, input.planId)),
    getTradeCommit: async requestId => checkedResponse(await fetcher(`/api/storage/trades/receipts?${new URLSearchParams({ requestId })}`, { cache: "no-store" }), body => body === null ? null : parseTradeCommitReceipt(body)),
    readTradeSnapshot,
    readTradeBook,
    readImportHistoryCommit: async (batchId, version, signal) => {
      const response = await fetcher("/api/storage/import-history/commit", { ...jsonRequest("POST", { batchId, version }), cache: "no-store", ...(signal ? { signal } : {}) });
      return checkedResponse(response, body => {
        if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Invalid history result");
        const value = body as ImportHistoryCommitRead;
        if (Object.keys(value).some(key => !["batchId", "bookVersion", "committedDuplicateTradeCount"].includes(key)) ||
            value.batchId !== batchId || encodeTradeRead(value.bookVersion) !== encodeTradeRead(version) ||
            (value.committedDuplicateTradeCount !== undefined && (!Number.isSafeInteger(value.committedDuplicateTradeCount) || value.committedDuplicateTradeCount < 0))) throw new Error("Invalid history result");
        return value;
      });
    },
    getStatus: async () => parseResponse<SqliteStatus>(await fetcher("/api/storage/status", { cache: "no-store" })),
    getBootstrap: async () => {
      const response = await fetcher("/api/storage/bootstrap", { cache: "no-store" });
      const body = await parseResponse<unknown>(response);
      try { const collection = await parseHomepageStoredCollection(body); return { ...collection.bootstrap, bookVersion: collection.bookVersion, tradeReadPages: collection.tradeReadPages }; }
      catch { throw new StorageHttpError(response.status, "invalid-response", "Storage returned an invalid bootstrap snapshot"); }
    },
    getHomepageSource: async (signal, version) => {
      const url = `/api/storage/homepage-source${version ? `?${new URLSearchParams({ version: JSON.stringify(version) })}` : ""}`;
      const response = await fetcher(url, { cache: "no-store", ...(signal ? { signal } : {}) });
      const body = await parseResponse<unknown>(response);
      try { const collection = await parseHomepageStoredCollection(body); if (version) await assertTradeReadSelection(collection.tradeReadPages[0], { version, pageSize: 1000 }); return collection; }
      catch { throw new StorageHttpError(response.status, "invalid-response", "Storage returned an invalid homepage source"); }
    },
    getInstrumentMetadata: async (instrumentIds, signal) => parseResponse<InstrumentMetadataRead>(await fetcher(instrumentMetadataUrl(instrumentIds), { cache: "no-store", ...(signal ? { signal } : {}) })),
    putInstrumentMetadata: async (record) => checkedResponse(await fetcher("/api/storage/instruments/metadata", jsonRequest("PUT", record)), parseWriteAcknowledgement),
    putInstrumentName: async input => checkedResponse(await fetcher("/api/storage/instruments/name", jsonRequest("PUT", input)), parseWriteAcknowledgement),
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
    getMarketData: async (input, signal) => parseResponse<MarketDataRead>(await fetcher(marketDataUrl(input), { cache: "no-store", ...(signal ? { signal } : {}) })),
    putMarketData: async (input) => parseResponse<{ ok: true }>(await fetcher("/api/storage/market-data", jsonRequest("PUT", input))),
    putMarketDataJob: async (job) => parseResponse<MarketDataJob>(await fetcher("/api/storage/market-data", jsonRequest("PUT", { kind: "job", job }))),
    getSettings: async () => parseResponse<ChartSettings>(await fetcher("/api/storage/settings", { cache: "no-store" })),
    putSettings: async (settings) => parseResponse<ChartSettings>(await fetcher("/api/storage/settings", jsonRequest("PUT", settings))),
  };
}
