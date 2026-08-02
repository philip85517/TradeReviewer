import "server-only";

import { createHash } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

import { SQLITE_MIGRATIONS } from "../../../db/sqlite-schema";
import { withSqliteTransaction } from "../../../db/sqlite";
import { normalizeDrawing, validateDrawing } from "../chart/drawings";
import { compareExecutions, reconcileExecutions } from "../import/execution-reconciliation";
import type { TagSuggestionRecord } from "../insights/types";
import { createEmptyEpisodeReviewRecord } from "../reviews/review-metrics";
import type { CoverageSegment, DailyCandleRecord, IntervalCoverageSegment, MarketCandleRecord } from "../market/contracts";
import type { EpisodeReviewRecord } from "../reviews/types";
import type { Instrument, TradeExecution } from "../trades/types";
import type { ChartSettings } from "./chart-settings";
import type { ImportHistoryEntry } from "./import-history";
import type { MarketDataJob } from "./market-data-jobs";
import type { EpisodeReviewState } from "./review-storage";
import type {
  BrowserStatePayload,
  CoverageRecord,
  ExecutionMergeReport,
  MigrationReport,
  ProviderSymbolRecord,
  SqliteStatus,
  StorageBootstrap,
  StoredInstrument,
} from "./sqlite-contracts";

type Row = Record<string, unknown>;
type IntervalCoverageRecord = IntervalCoverageSegment & {
  instrumentId: string;
  adjustmentMode?: "raw";
};
type NormalizedIntervalCoverageRecord = IntervalCoverageRecord & {
  adjustmentMode: "raw";
};
type MarketDataCommitInput = {
  instrumentId: string;
  candles: DailyCandleRecord[];
  coverage: CoverageSegment[];
  providerSymbol: { provider: string; symbol: string };
};
type IntervalMarketDataCommitInput = {
  instrumentId: string;
  interval: "15m" | "1D";
  candles: MarketCandleRecord[];
  coverage: IntervalCoverageSegment[];
  providerSymbol?: { provider: string; symbol: string };
};
type MigrationCounts = Pick<MigrationReport, "inserted" | "duplicate" | "conflict">;

const MARKET_DATA_STATUSES = new Set([
  "not-requested", "syncing", "complete", "partial", "stale",
  "source-rate-limited", "source-forbidden", "source-unavailable",
  "invalid-response", "storage-error", "needs-provider", "ready", "error",
]);
const COVERAGE_STATUSES = new Set([
  "not-requested", "syncing", "complete", "partial", "stale",
  "source-rate-limited", "source-forbidden", "source-unavailable",
  "invalid-response", "storage-error",
]);

function asString(value: unknown, field: string) {
  if (typeof value !== "string") throw new Error(`Invalid ${field}`);
  return value;
}

function asRecord(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Invalid ${field}`);
  }
  return value as Record<string, unknown>;
}

function assertStringFields(
  record: Record<string, unknown>,
  fields: readonly string[],
  label: string,
): void {
  for (const field of fields) asString(record[field], label);
}

function assertOptionalStringFields(
  record: Record<string, unknown>,
  fields: readonly string[],
  label: string,
): void {
  for (const field of fields) {
    if (record[field] !== undefined) asString(record[field], label);
  }
}

function parseJson<T>(value: unknown, field: string): T {
  if (typeof value !== "string") throw new Error(`Invalid ${field}`);
  try { return JSON.parse(value) as T; } catch { throw new Error(`Invalid ${field}`); }
}

function json(value: unknown, field: string) {
  try {
    assertJsonSafe(value, field);
    const serialized = JSON.stringify(value);
    if (serialized === undefined) throw new Error(`Invalid ${field}`);
    return serialized;
  } catch { throw new Error(`Invalid ${field}`); }
}

function assertJsonSafe(value: unknown, field: string, seen = new Set<object>()): void {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (Number.isFinite(value)) return;
    throw new Error(`Invalid ${field}`);
  }
  if (typeof value !== "object" || value === undefined) throw new Error(`Invalid ${field}`);
  if (seen.has(value)) throw new Error(`Invalid ${field}`);
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((item) => assertJsonSafe(item, field, seen));
  } else {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) throw new Error(`Invalid ${field}`);
    Object.values(value).forEach((item) => assertJsonSafe(item, field, seen));
  }
  seen.delete(value);
}

function sameJson(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function validateInstrument(value: unknown): asserts value is StoredInstrument {
  const instrument = asRecord(value, "instrument");
  assertStringFields(
    instrument,
    ["id", "symbol", "name", "market", "currency"],
    "instrument",
  );
  if (instrument.metadata !== undefined) {
    const metadata = asRecord(instrument.metadata, "instrument metadata");
    assertStringFields(metadata, ["market", "symbol", "name", "assetType", "source", "confidence", "resolvedAt"], "instrument metadata");
    if (metadata.market !== instrument.market || metadata.symbol !== instrument.symbol || metadata.name !== instrument.name) {
      throw new Error("Invalid instrument metadata");
    }
    assertJsonSafe(metadata, "instrument metadata");
  }
}

function validateExecution(value: unknown): asserts value is TradeExecution {
  const item = asRecord(value, "execution") as Partial<TradeExecution>;
  assertStringFields(
    item as Record<string, unknown>,
    ["id", "accountId", "accountLabel", "executedAt", "quantity", "price", "fee"],
    "execution",
  );
  if (item.side !== "buy" && item.side !== "sell") throw new Error("Invalid execution");
  validateInstrument(item.instrument);
  if (!item.source || typeof item.source !== "object" || typeof item.source.platform !== "string" || typeof item.source.row !== "number") throw new Error("Invalid execution");
}

function validateReview(value: unknown): asserts value is EpisodeReviewRecord {
  if (!value || typeof value !== "object") throw new Error("Invalid review");
  const item = value as Partial<EpisodeReviewRecord>;
  if (item.version !== 1 || typeof item.episodeId !== "string" || typeof item.instrumentId !== "string" || typeof item.updatedAt !== "string" || !item.plan || !item.review || !Array.isArray(item.confirmedTagIds)) throw new Error("Invalid review");
  for (const field of ["thesis", "expectedPath", "invalidationCondition", "targetRange", "plannedRiskAmount"] as const) asString(item.plan[field], "review plan");
  for (const field of ["riskManagement", "psychology", "reusableRule"] as const) asString(item.review[field], "review");
  if (typeof item.review.completed !== "boolean" || item.confirmedTagIds.some((tag) => typeof tag !== "string")) throw new Error("Invalid review");
  json(item, "review");
}

function validateReviewState(value: unknown): asserts value is EpisodeReviewState {
  if (!value || typeof value !== "object") throw new Error("Invalid review state");
  const state = value as EpisodeReviewState;
  if (state.version !== 2 || typeof state.episodeId !== "string" || typeof state.replayCursor !== "string" || !["15m", "1h", "4h", "1D", "1W"].includes(state.timeframe) || (state.activePanelTab !== "stats" && state.activePanelTab !== "notes") || !Array.isArray(state.drawings)) throw new Error("Invalid review state");
  for (const drawing of state.drawings) {
    if (!drawing || typeof drawing.id !== "string" || drawing.version !== 2 || drawing.episodeId !== state.episodeId || typeof drawing.name !== "string" || !Array.isArray(drawing.anchors) || !drawing.style || typeof drawing.style.color !== "string" || typeof drawing.style.lineWidth !== "number" || typeof drawing.style.opacity !== "number" || typeof drawing.zIndex !== "number" || typeof drawing.hidden !== "boolean" || typeof drawing.locked !== "boolean" || typeof drawing.createdAtCursor !== "string" || (drawing.visibleOn !== "all" && (!Array.isArray(drawing.visibleOn) || drawing.visibleOn.some((timeframe) => !["15m", "1h", "4h", "1D", "1W"].includes(timeframe)))) || !["pre-trade", "during-replay", "post-review"].includes(drawing.stage)) throw new Error("Invalid review drawing");
    try { validateDrawing(normalizeDrawing(drawing, state.episodeId, state.replayCursor, drawing.zIndex)); } catch { throw new Error("Invalid review drawing"); }
  }
}

function validateTagSuggestion(value: unknown): asserts value is TagSuggestionRecord {
  if (!value || typeof value !== "object") throw new Error("Invalid tag suggestion");
  const item = value as Partial<TagSuggestionRecord>;
  if (item.version !== 1 || typeof item.id !== "string" || typeof item.episodeId !== "string" || typeof item.instrumentId !== "string" || typeof item.tagId !== "string" || !Array.isArray(item.evidence)) throw new Error("Invalid tag suggestion");
}

function validateImportHistory(value: unknown): asserts value is ImportHistoryEntry {
  const entry = asRecord(value, "import history");
  assertStringFields(entry, ["id", "fileName", "sourceLabel", "importedAt"], "import history");
  for (const field of [
    "tradeCount", "instrumentCount", "excludedInstrumentCount", "excludedRecordCount",
    "duplicateTradeCount", "unresolvedInstrumentCount", "captureCount", "conflictTradeCount",
  ]) {
    const count = entry[field];
    if (count !== undefined && (typeof count !== "number" || !Number.isFinite(count) || count < 0)) {
      throw new Error("Invalid import history");
    }
  }
}

function validateJobInterval(value: unknown): void {
  const interval = asRecord(value, "market data job");
  if (interval.interval !== "15m" && interval.interval !== "1D") {
    throw new Error("Invalid market data job");
  }
  if (typeof interval.status !== "string" || !MARKET_DATA_STATUSES.has(interval.status)) {
    throw new Error("Invalid market data job");
  }
  assertOptionalStringFields(
    interval,
    ["message", "coverageStart", "coverageEnd"],
    "market data job",
  );
}

function validateJob(value: unknown): asserts value is MarketDataJob {
  const job = asRecord(value, "market data job");
  assertStringFields(
    job,
    ["instrumentId", "symbol", "market", "requestedAt", "status"],
    "market data job",
  );
  if (!MARKET_DATA_STATUSES.has(job.status as string) || !Array.isArray(job.intervals)) {
    throw new Error("Invalid market data job");
  }
  job.intervals.forEach(validateJobInterval);
}

function validateDailyCandle(value: unknown): asserts value is DailyCandleRecord {
  assertStringFields(
    asRecord(value, "daily candle"),
    [
      "instrumentId", "tradingDate", "open", "high", "low", "close", "volume",
      "currency", "provider", "providerSymbol", "adjustmentMode", "fetchedAt",
    ],
    "daily candle",
  );
}

function validateMarketCandle(value: unknown): asserts value is MarketCandleRecord {
  assertStringFields(
    asRecord(value, "market candle"),
    [
      "instrumentId", "interval", "timestamp", "open", "high", "low", "close",
      "volume", "currency", "provider", "providerSymbol", "adjustmentMode", "fetchedAt",
    ],
    "market candle",
  );
}

function validateCoverage(value: unknown): asserts value is CoverageRecord {
  const coverage = asRecord(value, "coverage");
  if (typeof coverage.instrumentId !== "string" || coverage.adjustmentMode !== "raw") {
    throw new Error("Invalid coverage");
  }
  assertOptionalStringFields(coverage, ["startDate", "endDate"], "coverage");
  if (coverage.segments !== undefined) {
    if (!Array.isArray(coverage.segments)) throw new Error("Invalid coverage");
    for (const segment of coverage.segments) {
      const item = asRecord(segment, "coverage segment");
      if (
        typeof item.startDate !== "string"
        || typeof item.endDate !== "string"
        || typeof item.status !== "string"
        || !COVERAGE_STATUSES.has(item.status)
        || !Array.isArray(item.missingTradingDates)
        || item.missingTradingDates.some((date) => typeof date !== "string")
      ) throw new Error("Invalid coverage");
      assertOptionalStringFields(item, ["provider", "fetchedAt", "reason"], "coverage segment");
    }
    assertJsonSafe(coverage.segments, "coverage");
  }
}

function normalizeIntervalCoverage(value: IntervalCoverageRecord): NormalizedIntervalCoverageRecord {
  return { ...value, adjustmentMode: value.adjustmentMode ?? "raw" };
}

function validateIntervalCoverage(value: unknown): asserts value is IntervalCoverageRecord {
  const coverage = asRecord(value, "interval coverage");
  if (
    typeof coverage.instrumentId !== "string"
    || (coverage.interval !== "15m" && coverage.interval !== "1D")
    || typeof coverage.requestedStart !== "string"
    || typeof coverage.requestedEnd !== "string"
    || typeof coverage.status !== "string"
    || !COVERAGE_STATUSES.has(coverage.status)
    || (coverage.adjustmentMode !== undefined && coverage.adjustmentMode !== "raw")
  ) {
    throw new Error("Invalid interval coverage");
  }
  assertOptionalStringFields(
    coverage,
    ["actualStart", "actualEnd", "provider", "fetchedAt", "reason"],
    "interval coverage",
  );
}

function validateProviderSymbol(value: unknown): asserts value is ProviderSymbolRecord {
  const providerSymbol = asRecord(value, "provider symbol");
  assertStringFields(
    providerSymbol,
    ["instrumentId", "provider", "providerSymbol"],
    "provider symbol",
  );
  if (
    providerSymbol.metadata !== undefined
    && (!providerSymbol.metadata
      || typeof providerSymbol.metadata !== "object"
      || Array.isArray(providerSymbol.metadata))
  ) {
    throw new Error("Invalid provider symbol");
  }
  if (providerSymbol.metadata !== undefined) {
    assertJsonSafe(providerSymbol.metadata, "provider metadata");
  }
}

function validateJsonCollection(
  value: unknown,
  field: string,
  validate: (item: unknown) => void,
): void {
  if (!Array.isArray(value)) throw new Error(`Invalid ${field}`);
  value.forEach(validate);
  assertJsonSafe(value, field);
}

function validateBrowserState(payload: BrowserStatePayload): void {
  if (
    !payload
    || payload.version !== 1
    || typeof payload.sourceClientId !== "string"
    || !payload.sourceClientId
    || typeof payload.sourceFingerprint !== "string"
    || !payload.sourceFingerprint
  ) {
    throw new Error("Invalid browser state");
  }

  asRecord(payload.settings, "settings");
  assertJsonSafe(payload.settings, "settings");
  validateJsonCollection(payload.instruments, "instruments", validateInstrument);
  validateJsonCollection(payload.executions, "executions", validateExecution);
  validateJsonCollection(payload.importHistory, "import history", validateImportHistory);
  validateJsonCollection(payload.reviews, "reviews", validateReview);
  validateJsonCollection(payload.reviewStates, "review states", validateReviewState);
  validateJsonCollection(payload.tagSuggestions, "tag suggestions", validateTagSuggestion);
  validateJsonCollection(payload.marketDataJobs, "market data jobs", validateJob);
  validateJsonCollection(payload.dailyCandles, "daily candles", validateDailyCandle);
  validateJsonCollection(payload.marketCandles, "market candles", validateMarketCandle);
  validateJsonCollection(payload.coverage, "coverage", validateCoverage);
  validateJsonCollection(payload.intervalCoverage, "interval coverage", validateIntervalCoverage);
  validateJsonCollection(payload.providerSymbols, "provider symbols", validateProviderSymbol);
}

function classifyMigrationRecord(
  counts: MigrationCounts,
  existing: unknown,
  incoming: unknown,
): void {
  if (existing === undefined) counts.inserted += 1;
  else if (sameJson(existing, incoming)) counts.duplicate += 1;
  else counts.conflict += 1;
}

function addExecutionCounts(counts: MigrationCounts, execution: ExecutionMergeReport): void {
  counts.inserted += execution.inserted;
  counts.duplicate += execution.duplicate;
  counts.conflict += execution.conflict;
}

function migrationReport(row: Row): MigrationReport {
  const counts = parseJson<MigrationReport>(row.counts_json, "migration counts");
  return { ...counts, sourceFingerprint: asString(row.source_fingerprint, "migration fingerprint"), validationDigest: typeof row.validation_digest === "string" ? row.validation_digest : "" };
}

function mapInstrumentRow(row: Row): StoredInstrument {
  return {
    id: asString(row.id, "instrument id"),
    symbol: asString(row.symbol, "symbol"),
    name: asString(row.name, "name"),
    market: asString(row.market, "market"),
    currency: asString(row.currency, "currency"),
    ...(row.metadata_json
      ? { metadata: parseJson<StoredInstrument["metadata"]>(row.metadata_json, "instrument metadata") }
      : {}),
  };
}

function mapExecutionRow(row: Row): TradeExecution {
  const evidence = row.evidence_json
    ? parseJson<{ source: TradeExecution["source"]; accountLabel: string }>(
      row.evidence_json,
      "execution evidence",
    )
    : undefined;
  return {
    id: asString(row.id, "execution id"),
    source: evidence?.source ?? { platform: "unknown", row: 0 },
    accountId: String(row.account ?? ""),
    accountLabel: evidence?.accountLabel ?? "",
    instrument: mapInstrumentRow({
      id: row.instrument_id,
      symbol: row.symbol,
      name: row.name,
      market: row.market,
      currency: row.currency,
    }),
    side: asString(row.side, "side") as TradeExecution["side"],
    executedAt: asString(row.executed_at, "executed at"),
    quantity: asString(row.quantity, "quantity"),
    price: asString(row.price, "price"),
    fee: typeof row.fee === "string" ? row.fee : "",
  };
}

function mapReviewStateRow(row: Row): EpisodeReviewState {
  const cursor = parseJson<Omit<EpisodeReviewState, "version" | "episodeId" | "drawings">>(
    row.cursor_json,
    "review cursor",
  );
  return {
    version: 2,
    episodeId: asString(row.episode_id, "episode id"),
    ...cursor,
    drawings: parseJson<EpisodeReviewState["drawings"]>(row.drawings_json, "review drawings"),
  };
}

function mapDailyCandleRow(row: Row): DailyCandleRecord {
  return {
    instrumentId: asString(row.instrument_id, "instrument id"),
    tradingDate: asString(row.date, "date"),
    open: asString(row.open, "open"),
    high: asString(row.high, "high"),
    low: asString(row.low, "low"),
    close: asString(row.close, "close"),
    volume: typeof row.volume === "string" ? row.volume : "",
    currency: asString(row.currency, "currency"),
    provider: asString(row.provider, "provider") as DailyCandleRecord["provider"],
    providerSymbol: asString(row.provider_symbol, "provider symbol"),
    adjustmentMode: asString(row.adjustment_mode, "adjustment mode") as "raw",
    fetchedAt: asString(row.fetched_at, "fetched at"),
  };
}

function mapMarketCandleRow(row: Row): MarketCandleRecord {
  return {
    instrumentId: asString(row.instrument_id, "instrument id"),
    interval: asString(row.interval, "interval") as MarketCandleRecord["interval"],
    timestamp: asString(row.timestamp, "timestamp"),
    ...(typeof row.knowledge_at === "string" ? { knowledgeAt: row.knowledge_at } : {}),
    open: asString(row.open, "open"),
    high: asString(row.high, "high"),
    low: asString(row.low, "low"),
    close: asString(row.close, "close"),
    volume: typeof row.volume === "string" ? row.volume : "",
    currency: asString(row.currency, "currency"),
    provider: asString(row.provider, "provider") as MarketCandleRecord["provider"],
    providerSymbol: asString(row.provider_symbol, "provider symbol"),
    adjustmentMode: asString(row.adjustment_mode, "adjustment mode") as "raw",
    fetchedAt: asString(row.fetched_at, "fetched at"),
  };
}

function mapCoverageRow(row: Row): CoverageRecord {
  return {
    instrumentId: asString(row.instrument_id, "instrument id"),
    adjustmentMode: asString(row.adjustment_mode, "adjustment mode") as "raw",
    ...(typeof row.start_date === "string" ? { startDate: row.start_date } : {}),
    ...(typeof row.end_date === "string" ? { endDate: row.end_date } : {}),
    ...(typeof row.details_json === "string" ? { segments: parseJson<CoverageSegment[]>(row.details_json, "coverage") } : {}),
  };
}

function mapIntervalCoverageRow(row: Row): NormalizedIntervalCoverageRecord {
  return {
    ...parseJson<IntervalCoverageSegment>(row.details_json, "interval coverage"),
    instrumentId: asString(row.instrument_id, "instrument id"),
    adjustmentMode: asString(row.adjustment_mode, "adjustment mode") as "raw",
  };
}

function mapProviderSymbolRow(row: Row): ProviderSymbolRecord {
  return {
    instrumentId: asString(row.instrument_id, "instrument id"),
    provider: asString(row.provider, "provider"),
    providerSymbol: asString(row.provider_symbol, "provider symbol"),
    ...(row.metadata_json
      ? { metadata: parseJson<Record<string, unknown>>(row.metadata_json, "provider metadata") }
      : {}),
  };
}

export class SqliteStore {
  constructor(private readonly database: DatabaseSync) {}

  getStatus(): SqliteStatus {
    const counts: Record<string, number> = {};
    for (const table of ["instruments", "executions", "import_batches", "reviews", "tag_suggestions", "market_data_jobs", "daily_candles", "market_candles"]) {
      counts[table] = Number((this.database.prepare(`select count(*) as count from ${table}`).get() as Row).count);
    }
    return { schemaVersion: SQLITE_MIGRATIONS.at(-1)?.version ?? 0, migration: this.getLatestMigration(), counts };
  }

  getBootstrap(): StorageBootstrap {
    return {
      schemaVersion: SQLITE_MIGRATIONS.at(-1)?.version ?? 0,
      migration: this.getLatestMigration(),
      executions: this.getExecutions(),
      importHistory: this.getImportHistory(),
      instruments: this.getInstruments(),
      reviews: this.getReviews(),
      reviewStates: this.getReviewStates(),
      tagSuggestions: this.getTagSuggestions(),
      marketDataJobs: this.getMarketDataJobs(),
      settings: this.getSettings(),
    };
  }

  getInstruments(): StoredInstrument[] {
    const rows = this.database
      .prepare("select id, symbol, name, market, currency, metadata_json from instruments order by id")
      .all() as Row[];
    return rows.map(mapInstrumentRow);
  }

  getExecutions(): TradeExecution[] {
    const rows = this.database.prepare("select e.*, i.symbol, i.name, i.market, i.currency from executions e join instruments i on i.id = e.instrument_id").all() as Row[];
    return rows.map(mapExecutionRow).sort(compareExecutions);
  }

  getImportHistory(): ImportHistoryEntry[] {
    return (this.database.prepare("select reconciliation_json from import_batches order by imported_at desc, id").all() as Row[]).map((row) => parseJson<ImportHistoryEntry>(row.reconciliation_json, "import history"));
  }

  getReviews(): EpisodeReviewRecord[] { return (this.database.prepare("select review_json from reviews where review_json is not null order by episode_id").all() as Row[]).map((row) => parseJson<EpisodeReviewRecord>(row.review_json, "review")); }
  getReview(episodeId: string): EpisodeReviewRecord | undefined { const row = this.database.prepare("select review_json from reviews where episode_id = ?").get(episodeId) as Row | undefined; return row?.review_json ? parseJson<EpisodeReviewRecord>(row.review_json, "review") : undefined; }
  getReviewStates(): EpisodeReviewState[] {
    const rows = this.database
      .prepare("select episode_id, cursor_json, drawings_json from reviews where cursor_json is not null order by episode_id")
      .all() as Row[];
    return rows.map(mapReviewStateRow);
  }
  getTagSuggestions(): TagSuggestionRecord[] { return (this.database.prepare("select evidence_json from tag_suggestions order by id").all() as Row[]).map((row) => parseJson<TagSuggestionRecord>(row.evidence_json, "tag suggestion")); }
  getMarketDataJobs(): MarketDataJob[] { return (this.database.prepare("select progress_json from market_data_jobs order by id").all() as Row[]).map((row) => parseJson<MarketDataJob>(row.progress_json, "market data job")); }
  getSettings(): Record<string, unknown> { return Object.fromEntries((this.database.prepare("select key, value_json from app_settings order by key").all() as Row[]).map((row) => [asString(row.key, "setting key"), parseJson(row.value_json, "setting value")])); }
  getDailyCandles(instrumentId?: string, start?: string, end?: string): DailyCandleRecord[] {
    const clauses = [instrumentId ? "instrument_id = ?" : "", start ? "date >= ?" : "", end ? "date <= ?" : ""].filter(Boolean);
    const where = clauses.length ? `where ${clauses.join(" and ")}` : "";
    const rows = this.database
      .prepare(`select * from daily_candles ${where} order by instrument_id, date`)
      .all(...[instrumentId, start, end].filter((value): value is string => Boolean(value))) as Row[];
    return rows.map(mapDailyCandleRow);
  }

  getMarketCandles(
    instrumentId?: string,
    interval?: MarketCandleRecord["interval"],
    start?: string,
    end?: string,
  ): MarketCandleRecord[] {
    const clauses = [
      instrumentId ? "instrument_id = ?" : "",
      interval ? "interval = ?" : "",
      start ? "timestamp >= ?" : "",
      end ? "timestamp <= ?" : "",
    ].filter(Boolean);
    const values = [instrumentId, interval, start, end].filter((value): value is string => Boolean(value));
    const where = clauses.length ? `where ${clauses.join(" and ")}` : "";
    const rows = this.database
      .prepare(`select * from market_candles ${where} order by instrument_id, interval, timestamp`)
      .all(...values) as Row[];
    return rows.map(mapMarketCandleRow);
  }

  getCoverage(): CoverageRecord[] {
    const rows = this.database
      .prepare("select instrument_id, adjustment_mode, start_date, end_date, details_json from coverage order by instrument_id")
      .all() as Row[];
    return rows.map(mapCoverageRow);
  }

  getCoverageSegments(instrumentId: string): CoverageSegment[] {
    const row = this.database.prepare("select details_json, start_date, end_date from coverage where instrument_id = ? and adjustment_mode = 'raw'").get(instrumentId) as Row | undefined;
    if (!row) return [];
    if (row.details_json) return parseJson<CoverageSegment[]>(row.details_json, "coverage");
    return typeof row.start_date === "string" && typeof row.end_date === "string" ? [{ startDate: row.start_date, endDate: row.end_date, status: "complete", missingTradingDates: [] }] : [];
  }

  getCandles(instrumentId: string, interval: "15m" | "1D", start: string, end: string): MarketCandleRecord[] {
    const generic = this.getMarketCandles(instrumentId, interval, start, end);
    if (interval !== "1D") return generic;
    const byTimestamp = new Map(generic.map((candle) => [candle.timestamp, candle]));
    for (const candle of this.getDailyCandles(instrumentId, start.slice(0, 10), end.slice(0, 10))) {
      const timestamp = `${candle.tradingDate}T00:00:00.000Z`;
      if (timestamp >= start && timestamp <= end && !byTimestamp.has(timestamp)) byTimestamp.set(timestamp, { ...candle, interval: "1D", timestamp });
    }
    return [...byTimestamp.values()].sort((left, right) => left.timestamp.localeCompare(right.timestamp));
  }

  getIntervalCoverage(): NormalizedIntervalCoverageRecord[] {
    const rows = this.database
      .prepare("select * from interval_coverage order by instrument_id, interval")
      .all() as Row[];
    return rows.map(mapIntervalCoverageRow);
  }

  getProviderSymbols(): ProviderSymbolRecord[] {
    const rows = this.database
      .prepare("select * from provider_symbols order by instrument_id, provider")
      .all() as Row[];
    return rows.map(mapProviderSymbolRow);
  }

  getProviderSymbol(instrumentId: string, provider: string): string | undefined {
    const row = this.database.prepare(
      "select provider_symbol from provider_symbols where instrument_id = ? and provider = ?",
    ).get(instrumentId, provider) as Row | undefined;
    return typeof row?.provider_symbol === "string" ? row.provider_symbol : undefined;
  }

  mergeExecutions(incoming: readonly TradeExecution[]): ExecutionMergeReport {
    return withSqliteTransaction(this.database, () => this.mergeExecutionsInTransaction(incoming));
  }

  mergeTradeData(input: {
    instruments?: StoredInstrument[];
    executions: TradeExecution[];
    importHistory?: ImportHistoryEntry[];
    replaceExecutionIds?: string[];
  }): ExecutionMergeReport {
    if (!input || !Array.isArray(input.executions)
      || (input.instruments !== undefined && !Array.isArray(input.instruments))
      || (input.importHistory !== undefined && !Array.isArray(input.importHistory))) {
      throw new Error("Invalid trade merge");
    }
    input.instruments?.forEach(validateInstrument);
    input.executions.forEach(validateExecution);
    input.importHistory?.forEach(validateImportHistory);
    if (input.replaceExecutionIds !== undefined && (!Array.isArray(input.replaceExecutionIds) || input.replaceExecutionIds.some((id) => typeof id !== "string" || !id))) throw new Error("Invalid execution replacements");
    return withSqliteTransaction(this.database, () => {
      for (const instrument of input.instruments ?? []) this.putInstrument(instrument);
      for (const id of input.replaceExecutionIds ?? []) this.database.prepare("delete from executions where id = ?").run(id);
      const result = this.mergeExecutionsInTransaction(input.executions);
      for (const entry of input.importHistory ?? []) this.putImportHistory(entry);
      return result;
    });
  }

  putReview(record: EpisodeReviewRecord): boolean {
    validateReview(record);
    return withSqliteTransaction(this.database, () => this.putReviewInTransaction(record));
  }

  putTagSuggestion(record: TagSuggestionRecord): void {
    validateTagSuggestion(record);
    withSqliteTransaction(this.database, () => this.putTagSuggestionInTransaction(record));
  }

  putSuggestionDecision(input: { suggestion: TagSuggestionRecord; review: EpisodeReviewRecord }): boolean {
    validateTagSuggestion(input.suggestion);
    validateReview(input.review);
    return withSqliteTransaction(this.database, () => {
      if (!this.putReviewInTransaction(input.review)) return false;
      this.putTagSuggestionInTransaction(input.suggestion);
      return true;
    });
  }

  putReviewState(state: EpisodeReviewState): void {
    validateReviewState(state);
    withSqliteTransaction(this.database, () => this.putReviewStateInTransaction(state));
  }

  commitMarketData(result: MarketDataCommitInput): void {
    if (!result || typeof result.instrumentId !== "string" || !Array.isArray(result.candles) || !Array.isArray(result.coverage) || !result.providerSymbol || typeof result.providerSymbol.provider !== "string" || typeof result.providerSymbol.symbol !== "string") throw new Error("Invalid market data");
    result.candles.forEach((candle) => { validateDailyCandle(candle); if (candle.instrumentId !== result.instrumentId) throw new Error("Invalid market data"); });
    result.coverage.forEach((segment) => { if (!segment || typeof segment.startDate !== "string" || typeof segment.endDate !== "string" || !COVERAGE_STATUSES.has(segment.status) || !Array.isArray(segment.missingTradingDates) || segment.missingTradingDates.some((date) => typeof date !== "string")) throw new Error("Invalid coverage"); });
    withSqliteTransaction(this.database, () => {
      result.candles.forEach((candle) => this.putDailyCandle(candle));
      this.putCoverageSegments(result.instrumentId, result.coverage);
      this.putProviderSymbol({ instrumentId: result.instrumentId, provider: result.providerSymbol.provider, providerSymbol: result.providerSymbol.symbol });
    });
  }

  commitIntervalMarketData(result: IntervalMarketDataCommitInput): void {
    if (!result || typeof result.instrumentId !== "string" || (result.interval !== "15m" && result.interval !== "1D") || !Array.isArray(result.candles) || !Array.isArray(result.coverage)) throw new Error("Invalid market data");
    result.candles.forEach((candle) => { validateMarketCandle(candle); if (candle.instrumentId !== result.instrumentId || candle.interval !== result.interval) throw new Error("Invalid market data"); }); result.coverage.forEach((coverage) => { if (coverage.interval !== result.interval) throw new Error("Invalid market data"); validateIntervalCoverage({ ...coverage, instrumentId: result.instrumentId }); });
    withSqliteTransaction(this.database, () => { result.candles.forEach((candle) => this.putMarketCandle(candle)); result.coverage.forEach((coverage) => this.putIntervalCoverage({ ...coverage, instrumentId: result.instrumentId })); if (result.providerSymbol) this.putProviderSymbol({ instrumentId: result.instrumentId, provider: result.providerSymbol.provider, providerSymbol: result.providerSymbol.symbol }); });
  }

  putMarketData(input: { dailyCandles?: DailyCandleRecord[]; marketCandles?: MarketCandleRecord[]; coverage?: CoverageRecord[]; intervalCoverage?: IntervalCoverageRecord[]; providerSymbols?: ProviderSymbolRecord[] }): void {
    if (!input || typeof input !== "object") throw new Error("Invalid market data");
    input.dailyCandles?.forEach(validateDailyCandle);
    input.marketCandles?.forEach(validateMarketCandle);
    input.coverage?.forEach(validateCoverage);
    input.intervalCoverage?.forEach(validateIntervalCoverage);
    input.providerSymbols?.forEach(validateProviderSymbol);
    withSqliteTransaction(this.database, () => {
      for (const candle of input.dailyCandles ?? []) this.putDailyCandle(candle);
      for (const candle of input.marketCandles ?? []) this.putMarketCandle(candle);
      for (const entry of input.coverage ?? []) this.putCoverage(entry);
      for (const entry of input.intervalCoverage ?? []) this.putIntervalCoverage(entry);
      for (const entry of input.providerSymbols ?? []) this.putProviderSymbol(entry);
    });
  }

  putSettings(settings: ChartSettings | Record<string, unknown>): void {
    withSqliteTransaction(this.database, () => {
      for (const [key, value] of Object.entries(settings)) this.putSetting(key, value);
    });
  }

  putMarketDataJob(job: MarketDataJob): void {
    validateJob(job);
    withSqliteTransaction(this.database, () => this.putMarketDataJobRecord(job));
  }

  mergeBrowserState(payload: BrowserStatePayload): MigrationReport {
    validateBrowserState(payload);
    const existing = this.database.prepare("select * from data_migrations where source_fingerprint = ?").get(payload.sourceFingerprint) as Row | undefined;
    if (existing) {
      const prior = migrationReport(existing);
      return { ...prior, inserted: 0, duplicate: prior.inserted + prior.duplicate };
    }
    const report = withSqliteTransaction(this.database, () => {
      const counts: MigrationCounts = { inserted: 0, duplicate: 0, conflict: 0 };
      for (const instrument of payload.instruments) {
        classifyMigrationRecord(
          counts,
          this.getInstruments().find((item) => item.id === instrument.id),
          instrument,
        );
        this.putInstrument(instrument);
      }
      const execution = this.mergeExecutionsInTransaction(payload.executions);
      addExecutionCounts(counts, execution);
      for (const entry of payload.importHistory) {
        classifyMigrationRecord(
          counts,
          this.getImportHistory().find((item) => item.id === entry.id),
          entry,
        );
        this.putImportHistory(entry);
      }
      for (const review of payload.reviews) {
        const before = this.getReview(review.episodeId);
        if (before && Date.parse(before.updatedAt) > Date.parse(review.updatedAt)) {
          counts.conflict += 1;
        } else {
          classifyMigrationRecord(counts, before, review);
          this.putReviewInTransaction(review);
        }
      }
      for (const state of payload.reviewStates) {
        classifyMigrationRecord(
          counts,
          this.getReviewStates().find((item) => item.episodeId === state.episodeId),
          state,
        );
        this.putReviewStateInTransaction(state);
      }
      for (const suggestion of payload.tagSuggestions) {
        classifyMigrationRecord(
          counts,
          this.getTagSuggestions().find((item) => item.id === suggestion.id),
          suggestion,
        );
        this.putTagSuggestionInTransaction(suggestion);
      }
      for (const job of payload.marketDataJobs) {
        classifyMigrationRecord(
          counts,
          this.getMarketDataJobs().find((item) => item.instrumentId === job.instrumentId),
          job,
        );
        this.putMarketDataJobRecord(job);
      }
      for (const candle of payload.dailyCandles) {
        classifyMigrationRecord(
          counts,
          this.getDailyCandles(candle.instrumentId).find(
            (item) => item.tradingDate === candle.tradingDate
              && item.adjustmentMode === candle.adjustmentMode,
          ),
          candle,
        );
        this.putDailyCandle(candle);
      }
      for (const candle of payload.marketCandles) {
        classifyMigrationRecord(
          counts,
          this.getMarketCandles(candle.instrumentId, candle.interval).find(
            (item) => item.timestamp === candle.timestamp
              && item.adjustmentMode === candle.adjustmentMode,
          ),
          candle,
        );
        this.putMarketCandle(candle);
      }
      for (const coverage of payload.coverage) {
        classifyMigrationRecord(
          counts,
          this.getCoverage().find(
            (item) => item.instrumentId === coverage.instrumentId
              && item.adjustmentMode === coverage.adjustmentMode,
          ),
          coverage,
        );
        this.putCoverage(coverage);
      }
      for (const rawCoverage of payload.intervalCoverage) {
        const coverage = normalizeIntervalCoverage(rawCoverage);
        classifyMigrationRecord(
          counts,
          this.getIntervalCoverage().find(
            (item) => item.instrumentId === coverage.instrumentId
              && item.interval === coverage.interval
              && item.adjustmentMode === coverage.adjustmentMode,
          ),
          coverage,
        );
        this.putIntervalCoverage(coverage);
      }
      for (const providerSymbol of payload.providerSymbols) {
        classifyMigrationRecord(
          counts,
          this.getProviderSymbols().find(
            (item) => item.instrumentId === providerSymbol.instrumentId
              && item.provider === providerSymbol.provider,
          ),
          providerSymbol,
        );
        this.putProviderSymbol(providerSymbol);
      }
      for (const [key, value] of Object.entries(payload.settings)) {
        classifyMigrationRecord(counts, this.getSettings()[key], value);
        this.putSetting(key, value);
      }
      const validationDigest = createHash("sha256").update(json(payload, "browser state")).digest("hex");
      const result: MigrationReport = {
        sourceFingerprint: payload.sourceFingerprint,
        ...counts,
        failed: 0,
        validationDigest,
      };
      this.database.prepare("insert into data_migrations (source_fingerprint, source_client_id, version, status, counts_json, validation_digest, completed_at) values (?, ?, ?, 'complete', ?, ?, current_timestamp)").run(payload.sourceFingerprint, payload.sourceClientId, payload.version, json(result, "migration counts"), validationDigest);
      return result;
    });
    return report;
  }

  private getLatestMigration(): MigrationReport | null {
    const row = this.database
      .prepare("select * from data_migrations where status = 'complete' order by completed_at desc, source_fingerprint desc limit 1")
      .get() as Row | undefined;
    return row ? migrationReport(row) : null;
  }

  private hasInstrument(id: string): boolean {
    return Boolean(this.database.prepare("select 1 from instruments where id = ?").get(id));
  }

  private putInstrument(instrument: StoredInstrument): boolean {
    validateInstrument(instrument);
    const existed = this.hasInstrument(instrument.id);
    this.database.prepare(`
      insert into instruments (id, symbol, name, market, currency, metadata_json, updated_at)
      values (?, ?, ?, ?, ?, ?, current_timestamp)
      on conflict(id) do update set
        symbol = excluded.symbol,
        name = excluded.name,
        market = excluded.market,
        currency = excluded.currency,
        metadata_json = coalesce(excluded.metadata_json, instruments.metadata_json),
        updated_at = excluded.updated_at
    `).run(
      instrument.id,
      instrument.symbol,
      instrument.name,
      instrument.market,
      instrument.currency,
      instrument.metadata ? json(instrument.metadata, "instrument metadata") : null,
    );
    return !existed;
  }

  private ensureInstrument(instrument: Instrument): void {
    this.putInstrument(instrument);
  }

  private ensureInstrumentId(id: string): void {
    if (!this.hasInstrument(id)) throw new Error(`Unknown instrument: ${id}`);
  }

  private mergeExecutionsInTransaction(
    incoming: readonly TradeExecution[],
  ): ExecutionMergeReport {
    incoming.forEach(validateExecution);
    const reconciliation = reconcileExecutions(this.getExecutions(), incoming);
    for (const id of reconciliation.automaticReplacementIds) {
      this.database.prepare("delete from executions where id = ?").run(id);
    }
    for (const execution of reconciliation.acceptedIncoming) {
      this.writeExecution(execution);
    }
    return {
      inserted: reconciliation.acceptedIncoming.length,
      duplicate: reconciliation.duplicates.length,
      conflict: reconciliation.conflicts.length,
    };
  }

  private writeExecution(execution: TradeExecution): void {
    this.ensureInstrument(execution.instrument);
    const batchId = execution.source.batchId;
    if (batchId) {
      const importBatch = {
        id: batchId,
        fileName: execution.source.fileName ?? "",
        sourceLabel: execution.source.platform,
        importedAt: execution.executedAt,
        tradeCount: 0,
        instrumentCount: 0,
        excludedInstrumentCount: 0,
      };
      this.database.prepare(`
        insert into import_batches (id, imported_at, reconciliation_json)
        values (?, ?, ?)
        on conflict(id) do nothing
      `).run(batchId, execution.executedAt, json(importBatch, "import batch"));
    }

    const evidence = json(
      { source: execution.source, accountLabel: execution.accountLabel },
      "execution evidence",
    );
    this.database.prepare(`
      insert into executions (
        id, import_batch_id, instrument_id, account, side, executed_at,
        quantity, price, fee, currency, evidence_json, updated_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, current_timestamp)
      on conflict(id) do update set
        import_batch_id = excluded.import_batch_id,
        instrument_id = excluded.instrument_id,
        account = excluded.account,
        side = excluded.side,
        executed_at = excluded.executed_at,
        quantity = excluded.quantity,
        price = excluded.price,
        fee = excluded.fee,
        currency = excluded.currency,
        evidence_json = excluded.evidence_json,
        updated_at = excluded.updated_at
    `).run(
      execution.id,
      batchId ?? null,
      execution.instrument.id,
      execution.accountId,
      execution.side,
      execution.executedAt,
      execution.quantity,
      execution.price,
      execution.fee,
      execution.instrument.currency,
      evidence,
    );
  }

  private putImportHistory(entry: ImportHistoryEntry): void {
    validateImportHistory(entry);
    this.database.prepare(`
      insert into import_batches (
        id, source_name, source_type, imported_at, record_count, reconciliation_json
      ) values (?, ?, ?, ?, ?, ?)
      on conflict(id) do update set
        source_name = excluded.source_name,
        source_type = excluded.source_type,
        imported_at = excluded.imported_at,
        record_count = excluded.record_count,
        reconciliation_json = excluded.reconciliation_json
    `).run(
      entry.id,
      entry.fileName,
      entry.sourceKind ?? "statement",
      entry.importedAt,
      entry.tradeCount,
      json(entry, "import history"),
    );
  }

  private putReviewInTransaction(record: EpisodeReviewRecord): boolean {
    validateReview(record);
    const current = this.getReview(record.episodeId);
    if (current && Date.parse(current.updatedAt) > Date.parse(record.updatedAt)) return false;
    this.ensureInstrumentId(record.instrumentId);
    this.database.prepare(`
      insert into reviews (
        episode_id, instrument_id, plan_json, review_json, revisions_json,
        confirmed_tags_json, updated_at
      ) values (?, ?, ?, ?, ?, ?, ?)
      on conflict(episode_id) do update set
        instrument_id = excluded.instrument_id,
        plan_json = excluded.plan_json,
        review_json = excluded.review_json,
        revisions_json = excluded.revisions_json,
        confirmed_tags_json = excluded.confirmed_tags_json,
        updated_at = excluded.updated_at
    `).run(
      record.episodeId,
      record.instrumentId,
      json(record.plan, "review plan"),
      json(record, "review"),
      json(record.planRevisions ?? [], "review revisions"),
      json(record.confirmedTagIds, "review tags"),
      record.updatedAt,
    );
    return true;
  }

  private putReviewStateInTransaction(state: EpisodeReviewState): void {
    validateReviewState(state);
    const cursor = json(
      {
        replayCursor: state.replayCursor,
        timeframe: state.timeframe,
        activePanelTab: state.activePanelTab,
      },
      "review cursor",
    );
    this.database.prepare(`
      insert into reviews (episode_id, cursor_json, drawings_json, updated_at)
      values (?, ?, ?, current_timestamp)
      on conflict(episode_id) do update set
        cursor_json = excluded.cursor_json,
        drawings_json = excluded.drawings_json,
        updated_at = excluded.updated_at
    `).run(state.episodeId, cursor, json(state.drawings, "review drawings"));
  }

  private putTagSuggestionInTransaction(record: TagSuggestionRecord): void {
    validateTagSuggestion(record);
    this.ensureInstrumentId(record.instrumentId);
    if (!this.getReview(record.episodeId)) {
      this.putReviewInTransaction(createEmptyEpisodeReviewRecord(record.episodeId, record.instrumentId, record.suggestedAt));
    }
    this.database.prepare(`
      insert into tag_suggestions (
        id, episode_id, instrument_id, tag, status, evidence_json, created_at, updated_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?)
      on conflict(id) do update set
        status = excluded.status,
        evidence_json = excluded.evidence_json,
        updated_at = excluded.updated_at
    `).run(
      record.id,
      record.episodeId,
      record.instrumentId,
      record.tagId,
      record.status,
      json(record, "tag suggestion"),
      record.suggestedAt,
      record.decidedAt ?? record.suggestedAt,
    );
  }

  private putMarketDataJobRecord(job: MarketDataJob): void {
    validateJob(job);
    this.ensureInstrumentId(job.instrumentId);
    this.database.prepare(`
      insert into market_data_jobs (id, instrument_id, provider, status, progress_json)
      values (?, ?, ?, ?, ?)
      on conflict(id) do update set
        status = excluded.status,
        progress_json = excluded.progress_json,
        updated_at = current_timestamp
    `).run(job.instrumentId, job.instrumentId, "browser", job.status, json(job, "market data job"));
  }

  private putDailyCandle(candle: DailyCandleRecord): void {
    validateDailyCandle(candle);
    this.ensureInstrumentId(candle.instrumentId);
    this.database.prepare(`
      insert into daily_candles (
        instrument_id, date, adjustment_mode, open, high, low, close,
        volume, provider, provider_symbol, currency, fetched_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      on conflict(instrument_id, date, adjustment_mode) do update set
        open = excluded.open,
        high = excluded.high,
        low = excluded.low,
        close = excluded.close,
        volume = excluded.volume,
        provider = excluded.provider,
        provider_symbol = excluded.provider_symbol,
        currency = excluded.currency,
        fetched_at = excluded.fetched_at
    `).run(
      candle.instrumentId,
      candle.tradingDate,
      candle.adjustmentMode,
      candle.open,
      candle.high,
      candle.low,
      candle.close,
      candle.volume,
      candle.provider,
      candle.providerSymbol,
      candle.currency,
      candle.fetchedAt,
    );
  }

  private putMarketCandle(candle: MarketCandleRecord): void {
    validateMarketCandle(candle);
    this.ensureInstrumentId(candle.instrumentId);
    this.database.prepare(`
      insert into market_candles (
        instrument_id, interval, timestamp, adjustment_mode, open, high, low, close,
        volume, provider, provider_symbol, currency, fetched_at, knowledge_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      on conflict(instrument_id, interval, timestamp, adjustment_mode) do update set
        open = excluded.open,
        high = excluded.high,
        low = excluded.low,
        close = excluded.close,
        volume = excluded.volume,
        provider = excluded.provider,
        provider_symbol = excluded.provider_symbol,
        currency = excluded.currency,
        fetched_at = excluded.fetched_at,
        knowledge_at = excluded.knowledge_at
    `).run(
      candle.instrumentId,
      candle.interval,
      candle.timestamp,
      candle.adjustmentMode,
      candle.open,
      candle.high,
      candle.low,
      candle.close,
      candle.volume,
      candle.provider,
      candle.providerSymbol,
      candle.currency,
      candle.fetchedAt,
      candle.knowledgeAt ?? null,
    );
  }

  private putCoverage(coverage: CoverageRecord): void {
    validateCoverage(coverage);
    this.ensureInstrumentId(coverage.instrumentId);
    this.database.prepare(`
      insert into coverage (instrument_id, adjustment_mode, start_date, end_date, details_json, updated_at)
      values (?, ?, ?, ?, ?, current_timestamp)
      on conflict(instrument_id, adjustment_mode) do update set
        start_date = excluded.start_date,
        end_date = excluded.end_date,
        details_json = excluded.details_json,
        updated_at = excluded.updated_at
    `).run(
      coverage.instrumentId,
      coverage.adjustmentMode,
      coverage.startDate ?? null,
      coverage.endDate ?? null,
      coverage.segments ? json(coverage.segments, "coverage") : null,
    );
  }

  private putCoverageSegments(instrumentId: string, segments: CoverageSegment[]): void {
    this.ensureInstrumentId(instrumentId);
    const startDate = segments.at(0)?.startDate ?? null;
    const endDate = segments.at(-1)?.endDate ?? null;
    this.database.prepare("insert into coverage (instrument_id, adjustment_mode, start_date, end_date, details_json, updated_at) values (?, 'raw', ?, ?, ?, current_timestamp) on conflict(instrument_id, adjustment_mode) do update set start_date = excluded.start_date, end_date = excluded.end_date, details_json = excluded.details_json, updated_at = excluded.updated_at").run(instrumentId, startDate, endDate, json(segments, "coverage"));
  }

  private putIntervalCoverage(coverage: IntervalCoverageRecord): void {
    validateIntervalCoverage(coverage);
    const normalized = normalizeIntervalCoverage(coverage);
    this.ensureInstrumentId(normalized.instrumentId);
    this.database.prepare(`
      insert into interval_coverage (
        instrument_id, interval, adjustment_mode, start_timestamp,
        end_timestamp, details_json, updated_at
      ) values (?, ?, ?, ?, ?, ?, current_timestamp)
      on conflict(instrument_id, interval, adjustment_mode) do update set
        start_timestamp = excluded.start_timestamp,
        end_timestamp = excluded.end_timestamp,
        details_json = excluded.details_json,
        updated_at = excluded.updated_at
    `).run(
      normalized.instrumentId,
      normalized.interval,
      normalized.adjustmentMode,
      normalized.actualStart ?? normalized.requestedStart,
      normalized.actualEnd ?? normalized.requestedEnd,
      json(normalized, "interval coverage"),
    );
  }

  private putProviderSymbol(record: ProviderSymbolRecord): void {
    validateProviderSymbol(record);
    this.ensureInstrumentId(record.instrumentId);
    this.database.prepare(`
      insert into provider_symbols (
        instrument_id, provider, provider_symbol, metadata_json, updated_at
      ) values (?, ?, ?, ?, current_timestamp)
      on conflict(instrument_id, provider) do update set
        provider_symbol = excluded.provider_symbol,
        metadata_json = excluded.metadata_json,
        updated_at = excluded.updated_at
    `).run(
      record.instrumentId,
      record.provider,
      record.providerSymbol,
      record.metadata ? json(record.metadata, "provider metadata") : null,
    );
  }

  private putSetting(key: string, value: unknown): void {
    this.database.prepare(`
      insert into app_settings (key, value_json, updated_at)
      values (?, ?, current_timestamp)
      on conflict(key) do update set
        value_json = excluded.value_json,
        updated_at = excluded.updated_at
    `).run(key, json(value, "setting"));
  }
}

export function getSqliteStore(database: DatabaseSync) { return new SqliteStore(database); }
