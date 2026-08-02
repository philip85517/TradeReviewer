import "server-only";

import { createHash } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

import { SQLITE_MIGRATIONS } from "../../../db/sqlite-schema";
import { withSqliteTransaction } from "../../../db/sqlite";
import { compareExecutions, reconcileExecutions } from "../import/execution-reconciliation";
import type { TagSuggestionRecord } from "../insights/types";
import type { DailyCandleRecord, IntervalCoverageSegment, MarketCandleRecord } from "../market/contracts";
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
} from "./sqlite-contracts";

type Row = Record<string, unknown>;

function asString(value: unknown, field: string) {
  if (typeof value !== "string") throw new Error(`Invalid ${field}`);
  return value;
}

function parseJson<T>(value: unknown, field: string): T {
  if (typeof value !== "string") throw new Error(`Invalid ${field}`);
  try { return JSON.parse(value) as T; } catch { throw new Error(`Invalid ${field}`); }
}

function json(value: unknown, field: string) {
  try {
    const serialized = JSON.stringify(value);
    if (serialized === undefined) throw new Error(`Invalid ${field}`);
    return serialized;
  } catch { throw new Error(`Invalid ${field}`); }
}

function sameJson(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function validateInstrument(value: unknown): asserts value is Instrument {
  if (!value || typeof value !== "object") throw new Error("Invalid instrument");
  const item = value as Partial<Instrument>;
  for (const field of ["id", "symbol", "name", "market", "currency"] as const) asString(item[field], "instrument");
}

function validateExecution(value: unknown): asserts value is TradeExecution {
  if (!value || typeof value !== "object") throw new Error("Invalid execution");
  const item = value as Partial<TradeExecution>;
  for (const field of ["id", "accountId", "accountLabel", "executedAt", "quantity", "price", "fee"] as const) asString(item[field], "execution");
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
    if (!drawing || typeof drawing.id !== "string" || drawing.version !== 2 || drawing.episodeId !== state.episodeId || typeof drawing.name !== "string" || !Array.isArray(drawing.anchors) || !drawing.style || typeof drawing.style.color !== "string" || typeof drawing.style.lineWidth !== "number" || typeof drawing.style.opacity !== "number" || typeof drawing.zIndex !== "number" || typeof drawing.hidden !== "boolean" || typeof drawing.locked !== "boolean" || typeof drawing.createdAtCursor !== "string") throw new Error("Invalid review drawing");
  }
}

function validateTagSuggestion(value: unknown): asserts value is TagSuggestionRecord {
  if (!value || typeof value !== "object") throw new Error("Invalid tag suggestion");
  const item = value as Partial<TagSuggestionRecord>;
  if (item.version !== 1 || typeof item.id !== "string" || typeof item.episodeId !== "string" || typeof item.instrumentId !== "string" || typeof item.tagId !== "string" || !Array.isArray(item.evidence)) throw new Error("Invalid tag suggestion");
}

function validateImportHistory(value: unknown): asserts value is ImportHistoryEntry { if (!value || typeof value !== "object") throw new Error("Invalid import history"); const entry = value as ImportHistoryEntry; for (const field of ["id", "fileName", "sourceLabel", "importedAt"] as const) asString(entry[field], "import history"); for (const field of ["tradeCount", "instrumentCount", "excludedInstrumentCount", "excludedRecordCount", "duplicateTradeCount", "unresolvedInstrumentCount", "captureCount", "conflictTradeCount"] as const) if (entry[field] !== undefined && (typeof entry[field] !== "number" || !Number.isFinite(entry[field]) || entry[field] < 0)) throw new Error("Invalid import history"); }
function validateJob(value: unknown): asserts value is MarketDataJob { if (!value || typeof value !== "object") throw new Error("Invalid market data job"); const job = value as MarketDataJob; for (const field of ["instrumentId", "symbol", "market", "requestedAt", "status"] as const) asString(job[field], "market data job"); if (!Array.isArray(job.intervals) || job.intervals.some((interval) => !interval || (interval.interval !== "15m" && interval.interval !== "1D") || typeof interval.status !== "string" || (interval.message !== undefined && typeof interval.message !== "string") || (interval.coverageStart !== undefined && typeof interval.coverageStart !== "string") || (interval.coverageEnd !== undefined && typeof interval.coverageEnd !== "string"))) throw new Error("Invalid market data job"); }
function validateDailyCandle(value: unknown): asserts value is DailyCandleRecord { if (!value || typeof value !== "object") throw new Error("Invalid daily candle"); for (const field of ["instrumentId", "tradingDate", "open", "high", "low", "close", "volume", "currency", "provider", "providerSymbol", "adjustmentMode", "fetchedAt"] as const) asString((value as DailyCandleRecord)[field], "daily candle"); }
function validateMarketCandle(value: unknown): asserts value is MarketCandleRecord { if (!value || typeof value !== "object") throw new Error("Invalid market candle"); for (const field of ["instrumentId", "interval", "timestamp", "open", "high", "low", "close", "volume", "currency", "provider", "providerSymbol", "adjustmentMode", "fetchedAt"] as const) asString((value as MarketCandleRecord)[field], "market candle"); }
function validateCoverage(value: unknown): asserts value is CoverageRecord { if (!value || typeof value !== "object" || typeof (value as CoverageRecord).instrumentId !== "string" || (value as CoverageRecord).adjustmentMode !== "raw") throw new Error("Invalid coverage"); const coverage = value as CoverageRecord; if ((coverage.startDate !== undefined && typeof coverage.startDate !== "string") || (coverage.endDate !== undefined && typeof coverage.endDate !== "string")) throw new Error("Invalid coverage"); }
function normalizeIntervalCoverage(value: IntervalCoverageSegment & { instrumentId: string; adjustmentMode?: "raw" }) { return { ...value, adjustmentMode: value.adjustmentMode ?? "raw" } as IntervalCoverageSegment & { instrumentId: string; adjustmentMode: "raw" }; }
function validateIntervalCoverage(value: unknown): asserts value is IntervalCoverageSegment & { instrumentId: string; adjustmentMode?: "raw" } { if (!value || typeof value !== "object" || typeof (value as { instrumentId?: unknown }).instrumentId !== "string" || !["15m", "1D"].includes((value as IntervalCoverageSegment).interval) || typeof (value as IntervalCoverageSegment).requestedStart !== "string" || typeof (value as IntervalCoverageSegment).requestedEnd !== "string" || typeof (value as IntervalCoverageSegment).status !== "string") throw new Error("Invalid interval coverage"); const coverage = value as IntervalCoverageSegment & { adjustmentMode?: unknown }; if (coverage.adjustmentMode !== undefined && coverage.adjustmentMode !== "raw") throw new Error("Invalid interval coverage"); for (const field of ["actualStart", "actualEnd", "provider", "fetchedAt", "reason"] as const) if (coverage[field] !== undefined && typeof coverage[field] !== "string") throw new Error("Invalid interval coverage"); }
function validateProviderSymbol(value: unknown): asserts value is ProviderSymbolRecord { if (!value || typeof value !== "object" || typeof (value as ProviderSymbolRecord).instrumentId !== "string" || typeof (value as ProviderSymbolRecord).provider !== "string" || typeof (value as ProviderSymbolRecord).providerSymbol !== "string") throw new Error("Invalid provider symbol"); const metadata = (value as ProviderSymbolRecord).metadata; if (metadata !== undefined && (!metadata || typeof metadata !== "object" || Array.isArray(metadata))) throw new Error("Invalid provider symbol"); if (metadata) json(metadata, "provider metadata"); }

function migrationReport(row: Row): MigrationReport {
  const counts = parseJson<MigrationReport>(row.counts_json, "migration counts");
  return { ...counts, sourceFingerprint: asString(row.source_fingerprint, "migration fingerprint"), validationDigest: typeof row.validation_digest === "string" ? row.validation_digest : "" };
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

  getInstruments(): Instrument[] {
    return (this.database.prepare("select id, symbol, name, market, currency from instruments order by id").all() as Row[]).map((row) => ({ id: asString(row.id, "instrument id"), symbol: asString(row.symbol, "symbol"), name: asString(row.name, "name"), market: asString(row.market, "market"), currency: asString(row.currency, "currency") }));
  }

  getExecutions(): TradeExecution[] {
    const rows = this.database.prepare("select e.*, i.symbol, i.name, i.market, i.currency from executions e join instruments i on i.id = e.instrument_id").all() as Row[];
    return rows.map((row) => {
      const evidence = row.evidence_json ? parseJson<{ source: TradeExecution["source"]; accountLabel: string }>(row.evidence_json, "execution evidence") : undefined;
      return { id: asString(row.id, "execution id"), source: evidence?.source ?? { platform: "unknown", row: 0 }, accountId: String(row.account ?? ""), accountLabel: evidence?.accountLabel ?? "", instrument: { id: asString(row.instrument_id, "instrument id"), symbol: asString(row.symbol, "symbol"), name: asString(row.name, "name"), market: asString(row.market, "market"), currency: asString(row.currency, "currency") }, side: asString(row.side, "side") as TradeExecution["side"], executedAt: asString(row.executed_at, "executed at"), quantity: asString(row.quantity, "quantity"), price: asString(row.price, "price"), fee: typeof row.fee === "string" ? row.fee : "" };
    }).sort(compareExecutions);
  }

  getImportHistory(): ImportHistoryEntry[] {
    return (this.database.prepare("select reconciliation_json from import_batches order by imported_at desc, id").all() as Row[]).map((row) => parseJson<ImportHistoryEntry>(row.reconciliation_json, "import history"));
  }

  getReviews(): EpisodeReviewRecord[] { return (this.database.prepare("select review_json from reviews where review_json is not null order by episode_id").all() as Row[]).map((row) => parseJson<EpisodeReviewRecord>(row.review_json, "review")); }
  getReview(episodeId: string): EpisodeReviewRecord | undefined { const row = this.database.prepare("select review_json from reviews where episode_id = ?").get(episodeId) as Row | undefined; return row?.review_json ? parseJson<EpisodeReviewRecord>(row.review_json, "review") : undefined; }
  getReviewStates(): EpisodeReviewState[] { return (this.database.prepare("select episode_id, cursor_json, drawings_json from reviews where cursor_json is not null order by episode_id").all() as Row[]).map((row) => { const cursor = parseJson<Omit<EpisodeReviewState, "version" | "episodeId" | "drawings">>(row.cursor_json, "review cursor"); return { version: 2, episodeId: asString(row.episode_id, "episode id"), ...cursor, drawings: parseJson<EpisodeReviewState["drawings"]>(row.drawings_json, "review drawings") }; }); }
  getTagSuggestions(): TagSuggestionRecord[] { return (this.database.prepare("select evidence_json from tag_suggestions order by id").all() as Row[]).map((row) => parseJson<TagSuggestionRecord>(row.evidence_json, "tag suggestion")); }
  getMarketDataJobs(): MarketDataJob[] { return (this.database.prepare("select progress_json from market_data_jobs order by id").all() as Row[]).map((row) => parseJson<MarketDataJob>(row.progress_json, "market data job")); }
  getSettings(): Record<string, unknown> { return Object.fromEntries((this.database.prepare("select key, value_json from app_settings order by key").all() as Row[]).map((row) => [asString(row.key, "setting key"), parseJson(row.value_json, "setting value")])); }
  getDailyCandles(instrumentId?: string): DailyCandleRecord[] { return (this.database.prepare(`select * from daily_candles ${instrumentId ? "where instrument_id = ?" : ""} order by instrument_id, date`).all(...(instrumentId ? [instrumentId] : [])) as Row[]).map((row) => ({ instrumentId: asString(row.instrument_id, "instrument id"), tradingDate: asString(row.date, "date"), open: asString(row.open, "open"), high: asString(row.high, "high"), low: asString(row.low, "low"), close: asString(row.close, "close"), volume: typeof row.volume === "string" ? row.volume : "", currency: asString(row.currency, "currency"), provider: asString(row.provider, "provider") as DailyCandleRecord["provider"], providerSymbol: asString(row.provider_symbol, "provider symbol"), adjustmentMode: asString(row.adjustment_mode, "adjustment mode") as "raw", fetchedAt: asString(row.fetched_at, "fetched at") })); }
  getMarketCandles(instrumentId?: string, interval?: MarketCandleRecord["interval"]): MarketCandleRecord[] { const clauses = [instrumentId ? "instrument_id = ?" : "", interval ? "interval = ?" : ""].filter(Boolean); const values = [instrumentId, interval].filter((value): value is string => Boolean(value)); return (this.database.prepare(`select * from market_candles ${clauses.length ? `where ${clauses.join(" and ")}` : ""} order by instrument_id, interval, timestamp`).all(...values) as Row[]).map((row) => ({ instrumentId: asString(row.instrument_id, "instrument id"), interval: asString(row.interval, "interval") as MarketCandleRecord["interval"], timestamp: asString(row.timestamp, "timestamp"), ...(typeof row.knowledge_at === "string" ? { knowledgeAt: row.knowledge_at } : {}), open: asString(row.open, "open"), high: asString(row.high, "high"), low: asString(row.low, "low"), close: asString(row.close, "close"), volume: typeof row.volume === "string" ? row.volume : "", currency: asString(row.currency, "currency"), provider: asString(row.provider, "provider") as MarketCandleRecord["provider"], providerSymbol: asString(row.provider_symbol, "provider symbol"), adjustmentMode: asString(row.adjustment_mode, "adjustment mode") as "raw", fetchedAt: asString(row.fetched_at, "fetched at") })); }
  getCoverage(): CoverageRecord[] { return (this.database.prepare("select instrument_id, adjustment_mode, start_date, end_date from coverage order by instrument_id").all() as Row[]).map((row) => ({ instrumentId: asString(row.instrument_id, "instrument id"), adjustmentMode: asString(row.adjustment_mode, "adjustment mode") as "raw", ...(typeof row.start_date === "string" ? { startDate: row.start_date } : {}), ...(typeof row.end_date === "string" ? { endDate: row.end_date } : {}) })); }
  getIntervalCoverage(): Array<IntervalCoverageSegment & { instrumentId: string; adjustmentMode: "raw" }> { return (this.database.prepare("select * from interval_coverage order by instrument_id, interval").all() as Row[]).map((row) => ({ ...parseJson<IntervalCoverageSegment>(row.details_json, "interval coverage"), instrumentId: asString(row.instrument_id, "instrument id"), adjustmentMode: asString(row.adjustment_mode, "adjustment mode") as "raw" })); }
  getProviderSymbols(): ProviderSymbolRecord[] { return (this.database.prepare("select * from provider_symbols order by instrument_id, provider").all() as Row[]).map((row) => ({ instrumentId: asString(row.instrument_id, "instrument id"), provider: asString(row.provider, "provider"), providerSymbol: asString(row.provider_symbol, "provider symbol"), ...(row.metadata_json ? { metadata: parseJson<Record<string, unknown>>(row.metadata_json, "provider metadata") } : {}) })); }

  mergeExecutions(incoming: readonly TradeExecution[]): ExecutionMergeReport {
    return withSqliteTransaction(this.database, () => this.mergeExecutionsInTransaction(incoming));
  }

  putReview(record: EpisodeReviewRecord): boolean {
    validateReview(record);
    return withSqliteTransaction(this.database, () => this.putReviewInTransaction(record));
  }

  putTagSuggestion(record: TagSuggestionRecord): void {
    validateTagSuggestion(record);
    withSqliteTransaction(this.database, () => {
      this.ensureInstrumentId(record.instrumentId);
      this.database.prepare("insert into tag_suggestions (id, episode_id, instrument_id, tag, status, evidence_json, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?) on conflict(id) do update set status = excluded.status, evidence_json = excluded.evidence_json, updated_at = excluded.updated_at").run(record.id, record.episodeId, record.instrumentId, record.tagId, record.status, json(record, "tag suggestion"), record.suggestedAt, record.decidedAt ?? record.suggestedAt);
    });
  }

  putMarketData(input: { dailyCandles?: DailyCandleRecord[]; marketCandles?: MarketCandleRecord[]; coverage?: CoverageRecord[]; providerSymbols?: ProviderSymbolRecord[] }): void {
    withSqliteTransaction(this.database, () => {
      for (const candle of input.dailyCandles ?? []) this.putDailyCandle(candle);
      for (const candle of input.marketCandles ?? []) this.putMarketCandle(candle);
      for (const entry of input.coverage ?? []) this.putCoverage(entry);
      for (const entry of input.providerSymbols ?? []) this.putProviderSymbol(entry);
    });
  }

  putSettings(settings: ChartSettings | Record<string, unknown>): void {
    withSqliteTransaction(this.database, () => {
      for (const [key, value] of Object.entries(settings)) this.database.prepare("insert into app_settings (key, value_json, updated_at) values (?, ?, current_timestamp) on conflict(key) do update set value_json = excluded.value_json, updated_at = excluded.updated_at").run(key, json(value, "setting"));
    });
  }

  mergeBrowserState(payload: BrowserStatePayload): MigrationReport {
    this.validateBrowserState(payload);
    const existing = this.database.prepare("select * from data_migrations where source_fingerprint = ?").get(payload.sourceFingerprint) as Row | undefined;
    if (existing) {
      const prior = migrationReport(existing);
      return { ...prior, inserted: 0, duplicate: prior.inserted + prior.duplicate };
    }
    const report = withSqliteTransaction(this.database, () => {
      let inserted = 0, duplicate = 0, conflict = 0;
      const count = (existing: unknown, incoming: unknown) => {
        if (existing === undefined) inserted += 1;
        else if (sameJson(existing, incoming)) duplicate += 1;
        else conflict += 1;
      };
      for (const instrument of payload.instruments) {
        count(this.getInstruments().find((item) => item.id === instrument.id), instrument);
        this.putInstrument(instrument);
      }
      const execution = this.mergeExecutionsInTransaction(payload.executions);
      inserted += execution.inserted;
      duplicate += execution.duplicate;
      conflict += execution.conflict;
      for (const entry of payload.importHistory) { count(this.getImportHistory().find((item) => item.id === entry.id), entry); this.putImportHistory(entry); }
      for (const review of payload.reviews) { const before = this.getReview(review.episodeId); if (before && Date.parse(before.updatedAt) > Date.parse(review.updatedAt)) conflict += 1; else { count(before, review); this.putReviewInTransaction(review); } }
      for (const state of payload.reviewStates) { count(this.getReviewStates().find((item) => item.episodeId === state.episodeId), state); this.putReviewState(state); }
      for (const suggestion of payload.tagSuggestions) { count(this.getTagSuggestions().find((item) => item.id === suggestion.id), suggestion); this.putTagSuggestionInTransaction(suggestion); }
      for (const job of payload.marketDataJobs) { count(this.getMarketDataJobs().find((item) => item.instrumentId === job.instrumentId), job); this.putMarketDataJob(job); }
      for (const candle of payload.dailyCandles) { count(this.getDailyCandles(candle.instrumentId).find((item) => item.tradingDate === candle.tradingDate && item.adjustmentMode === candle.adjustmentMode), candle); this.putDailyCandle(candle); }
      for (const candle of payload.marketCandles) { count(this.getMarketCandles(candle.instrumentId, candle.interval).find((item) => item.timestamp === candle.timestamp && item.adjustmentMode === candle.adjustmentMode), candle); this.putMarketCandle(candle); }
      for (const coverage of payload.coverage) { count(this.getCoverage().find((item) => item.instrumentId === coverage.instrumentId && item.adjustmentMode === coverage.adjustmentMode), coverage); this.putCoverage(coverage); }
      for (const rawCoverage of payload.intervalCoverage) { const coverage = normalizeIntervalCoverage(rawCoverage); count(this.getIntervalCoverage().find((item) => item.instrumentId === coverage.instrumentId && item.interval === coverage.interval && item.adjustmentMode === coverage.adjustmentMode), coverage); this.putIntervalCoverage(coverage); }
      for (const providerSymbol of payload.providerSymbols) { count(this.getProviderSymbols().find((item) => item.instrumentId === providerSymbol.instrumentId && item.provider === providerSymbol.provider), providerSymbol); this.putProviderSymbol(providerSymbol); }
      for (const [key, value] of Object.entries(payload.settings)) { count(this.getSettings()[key], value); this.database.prepare("insert into app_settings (key, value_json) values (?, ?) on conflict(key) do update set value_json = excluded.value_json").run(key, json(value, "setting")); }
      const validationDigest = createHash("sha256").update(json(payload, "browser state")).digest("hex");
      const result: MigrationReport = { sourceFingerprint: payload.sourceFingerprint, inserted, duplicate, conflict, failed: 0, validationDigest };
      this.database.prepare("insert into data_migrations (source_fingerprint, source_client_id, version, status, counts_json, validation_digest, completed_at) values (?, ?, ?, 'complete', ?, ?, current_timestamp)").run(payload.sourceFingerprint, payload.sourceClientId, payload.version, json(result, "migration counts"), validationDigest);
      return result;
    });
    return report;
  }

  private getLatestMigration() { const row = this.database.prepare("select * from data_migrations where status = 'complete' order by completed_at desc, source_fingerprint desc limit 1").get() as Row | undefined; return row ? migrationReport(row) : null; }
  private hasInstrument(id: string) { return Boolean(this.database.prepare("select 1 from instruments where id = ?").get(id)); }
  private putInstrument(instrument: Instrument) { validateInstrument(instrument); const existed = this.hasInstrument(instrument.id); this.database.prepare("insert into instruments (id, symbol, name, market, currency, updated_at) values (?, ?, ?, ?, ?, current_timestamp) on conflict(id) do update set symbol = excluded.symbol, name = excluded.name, market = excluded.market, currency = excluded.currency, updated_at = excluded.updated_at").run(instrument.id, instrument.symbol, instrument.name, instrument.market, instrument.currency); return !existed; }
  private ensureInstrument(instrument: Instrument) { this.putInstrument(instrument); }
  private ensureInstrumentId(id: string) { if (!this.hasInstrument(id)) throw new Error(`Unknown instrument: ${id}`); }
  private mergeExecutionsInTransaction(incoming: readonly TradeExecution[]): ExecutionMergeReport { incoming.forEach(validateExecution); const reconciliation = reconcileExecutions(this.getExecutions(), incoming); for (const id of reconciliation.automaticReplacementIds) this.database.prepare("delete from executions where id = ?").run(id); for (const execution of reconciliation.acceptedIncoming) this.writeExecution(execution); return { inserted: reconciliation.acceptedIncoming.length, duplicate: reconciliation.duplicates.length, conflict: reconciliation.conflicts.length }; }
  private writeExecution(execution: TradeExecution) { this.ensureInstrument(execution.instrument); const batchId = execution.source.batchId; if (batchId) this.database.prepare("insert into import_batches (id, imported_at, reconciliation_json) values (?, ?, ?) on conflict(id) do nothing").run(batchId, execution.executedAt, json({ id: batchId, fileName: execution.source.fileName ?? "", sourceLabel: execution.source.platform, importedAt: execution.executedAt, tradeCount: 0, instrumentCount: 0, excludedInstrumentCount: 0 }, "import batch")); this.database.prepare("insert into executions (id, import_batch_id, instrument_id, account, side, executed_at, quantity, price, fee, currency, evidence_json, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, current_timestamp) on conflict(id) do update set import_batch_id = excluded.import_batch_id, instrument_id = excluded.instrument_id, account = excluded.account, side = excluded.side, executed_at = excluded.executed_at, quantity = excluded.quantity, price = excluded.price, fee = excluded.fee, currency = excluded.currency, evidence_json = excluded.evidence_json, updated_at = excluded.updated_at").run(execution.id, batchId ?? null, execution.instrument.id, execution.accountId, execution.side, execution.executedAt, execution.quantity, execution.price, execution.fee, execution.instrument.currency, json({ source: execution.source, accountLabel: execution.accountLabel }, "execution evidence")); }
  private putImportHistory(entry: ImportHistoryEntry) { if (!entry || typeof entry.id !== "string" || typeof entry.importedAt !== "string") throw new Error("Invalid import history"); this.database.prepare("insert into import_batches (id, source_name, source_type, imported_at, record_count, reconciliation_json) values (?, ?, ?, ?, ?, ?) on conflict(id) do update set source_name = excluded.source_name, source_type = excluded.source_type, imported_at = excluded.imported_at, record_count = excluded.record_count, reconciliation_json = excluded.reconciliation_json").run(entry.id, entry.fileName, entry.sourceKind ?? "statement", entry.importedAt, entry.tradeCount, json(entry, "import history")); }
  private putReviewInTransaction(record: EpisodeReviewRecord) { validateReview(record); const current = this.getReview(record.episodeId); if (current && Date.parse(current.updatedAt) > Date.parse(record.updatedAt)) return false; this.ensureInstrumentId(record.instrumentId); const data = json(record, "review"); this.database.prepare("insert into reviews (episode_id, instrument_id, plan_json, review_json, revisions_json, confirmed_tags_json, updated_at) values (?, ?, ?, ?, ?, ?, ?) on conflict(episode_id) do update set instrument_id = excluded.instrument_id, plan_json = excluded.plan_json, review_json = excluded.review_json, revisions_json = excluded.revisions_json, confirmed_tags_json = excluded.confirmed_tags_json, updated_at = excluded.updated_at").run(record.episodeId, record.instrumentId, json(record.plan, "review plan"), data, json(record.planRevisions ?? [], "review revisions"), json(record.confirmedTagIds, "review tags"), record.updatedAt); return true; }
  private putReviewState(state: EpisodeReviewState) { validateReviewState(state); this.database.prepare("insert into reviews (episode_id, cursor_json, drawings_json, updated_at) values (?, ?, ?, current_timestamp) on conflict(episode_id) do update set cursor_json = excluded.cursor_json, drawings_json = excluded.drawings_json, updated_at = excluded.updated_at").run(state.episodeId, json({ replayCursor: state.replayCursor, timeframe: state.timeframe, activePanelTab: state.activePanelTab }, "review cursor"), json(state.drawings, "review drawings")); }
  private putTagSuggestionInTransaction(record: TagSuggestionRecord) { validateTagSuggestion(record); this.ensureInstrumentId(record.instrumentId); this.database.prepare("insert into tag_suggestions (id, episode_id, instrument_id, tag, status, evidence_json, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?) on conflict(id) do update set status = excluded.status, evidence_json = excluded.evidence_json, updated_at = excluded.updated_at").run(record.id, record.episodeId, record.instrumentId, record.tagId, record.status, json(record, "tag suggestion"), record.suggestedAt, record.decidedAt ?? record.suggestedAt); }
  private putMarketDataJob(job: MarketDataJob) { if (!job || typeof job.instrumentId !== "string") throw new Error("Invalid market data job"); this.ensureInstrumentId(job.instrumentId); const id = job.instrumentId; this.database.prepare("insert into market_data_jobs (id, instrument_id, provider, status, progress_json) values (?, ?, ?, ?, ?) on conflict(id) do update set status = excluded.status, progress_json = excluded.progress_json, updated_at = current_timestamp").run(id, job.instrumentId, "browser", job.status, json(job, "market data job")); }
  private putDailyCandle(candle: DailyCandleRecord) { this.ensureInstrumentId(candle.instrumentId); for (const field of ["tradingDate", "open", "high", "low", "close", "volume", "currency", "provider", "providerSymbol", "fetchedAt"] as const) asString(candle[field], "daily candle"); this.database.prepare("insert into daily_candles (instrument_id, date, adjustment_mode, open, high, low, close, volume, provider, provider_symbol, currency, fetched_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) on conflict(instrument_id, date, adjustment_mode) do update set open = excluded.open, high = excluded.high, low = excluded.low, close = excluded.close, volume = excluded.volume, provider = excluded.provider, provider_symbol = excluded.provider_symbol, currency = excluded.currency, fetched_at = excluded.fetched_at").run(candle.instrumentId, candle.tradingDate, candle.adjustmentMode, candle.open, candle.high, candle.low, candle.close, candle.volume, candle.provider, candle.providerSymbol, candle.currency, candle.fetchedAt); }
  private putMarketCandle(candle: MarketCandleRecord) { this.ensureInstrumentId(candle.instrumentId); this.database.prepare("insert into market_candles (instrument_id, interval, timestamp, adjustment_mode, open, high, low, close, volume, provider, provider_symbol, currency, fetched_at, knowledge_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) on conflict(instrument_id, interval, timestamp, adjustment_mode) do update set open = excluded.open, high = excluded.high, low = excluded.low, close = excluded.close, volume = excluded.volume, provider = excluded.provider, provider_symbol = excluded.provider_symbol, currency = excluded.currency, fetched_at = excluded.fetched_at, knowledge_at = excluded.knowledge_at").run(candle.instrumentId, candle.interval, candle.timestamp, candle.adjustmentMode, candle.open, candle.high, candle.low, candle.close, candle.volume, candle.provider, candle.providerSymbol, candle.currency, candle.fetchedAt, candle.knowledgeAt ?? null); }
  private putCoverage(coverage: CoverageRecord) { this.ensureInstrumentId(coverage.instrumentId); this.database.prepare("insert into coverage (instrument_id, adjustment_mode, start_date, end_date, updated_at) values (?, ?, ?, ?, current_timestamp) on conflict(instrument_id, adjustment_mode) do update set start_date = excluded.start_date, end_date = excluded.end_date, updated_at = excluded.updated_at").run(coverage.instrumentId, coverage.adjustmentMode, coverage.startDate ?? null, coverage.endDate ?? null); }
  private putIntervalCoverage(coverage: IntervalCoverageSegment & { instrumentId: string; adjustmentMode?: "raw" }) { const normalized = normalizeIntervalCoverage(coverage); this.ensureInstrumentId(normalized.instrumentId); this.database.prepare("insert into interval_coverage (instrument_id, interval, adjustment_mode, start_timestamp, end_timestamp, details_json, updated_at) values (?, ?, ?, ?, ?, ?, current_timestamp) on conflict(instrument_id, interval, adjustment_mode) do update set start_timestamp = excluded.start_timestamp, end_timestamp = excluded.end_timestamp, details_json = excluded.details_json, updated_at = excluded.updated_at").run(normalized.instrumentId, normalized.interval, normalized.adjustmentMode, normalized.actualStart ?? normalized.requestedStart, normalized.actualEnd ?? normalized.requestedEnd, json(normalized, "interval coverage")); }
  private putProviderSymbol(record: ProviderSymbolRecord) { this.ensureInstrumentId(record.instrumentId); this.database.prepare("insert into provider_symbols (instrument_id, provider, provider_symbol, metadata_json, updated_at) values (?, ?, ?, ?, current_timestamp) on conflict(instrument_id, provider) do update set provider_symbol = excluded.provider_symbol, metadata_json = excluded.metadata_json, updated_at = excluded.updated_at").run(record.instrumentId, record.provider, record.providerSymbol, record.metadata ? json(record.metadata, "provider metadata") : null); }
  private validateBrowserState(payload: BrowserStatePayload) { if (!payload || payload.version !== 1 || typeof payload.sourceClientId !== "string" || !payload.sourceClientId || typeof payload.sourceFingerprint !== "string" || !payload.sourceFingerprint || !payload.settings || typeof payload.settings !== "object" || Array.isArray(payload.settings)) throw new Error("Invalid browser state"); for (const key of ["executions", "importHistory", "instruments", "reviews", "reviewStates", "tagSuggestions", "marketDataJobs", "dailyCandles", "marketCandles", "coverage", "intervalCoverage", "providerSymbols"] as const) if (!Array.isArray(payload[key])) throw new Error(`Invalid ${key}`); payload.instruments.forEach(validateInstrument); payload.executions.forEach(validateExecution); payload.importHistory.forEach(validateImportHistory); payload.reviews.forEach(validateReview); payload.reviewStates.forEach(validateReviewState); payload.tagSuggestions.forEach(validateTagSuggestion); payload.marketDataJobs.forEach(validateJob); payload.dailyCandles.forEach(validateDailyCandle); payload.marketCandles.forEach(validateMarketCandle); payload.coverage.forEach(validateCoverage); payload.intervalCoverage.forEach(validateIntervalCoverage); payload.providerSymbols.forEach(validateProviderSymbol); for (const value of Object.values(payload.settings)) json(value, "setting"); }
}

export function getSqliteStore(database: DatabaseSync) { return new SqliteStore(database); }
