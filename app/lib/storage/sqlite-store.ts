import { completionHasPendingEvidence, monthlyHasPendingEvidence, validImportCompletionEvidence } from "../import/import-completion";
import { validFileContentIdentity, type FileContentIdentity } from "../import/file-fingerprint";
import "server-only";

import Decimal from "decimal.js";
import { canonicalRecord, type TradeRevision, type TradeRevisionRequest, type TradeRevisionResult } from "./trade-revisions";
import { assertTradeExecutionSemantics } from "./trade-fact-validation";
import { createHash, randomUUID } from "node:crypto";
import { createTradeChangeEngine, canonicalOriginalImport, type VerifiedIdentityReviewParent, type InternalIntent as EngineIntent, type StandardInternalIntent as InternalIntent } from "./trade-changes-engine.internal";
import { assessTradingViewImport, isTradingViewExecution, makeIndependentBindings, prepareTVMaterial, validateTVImportEvidence, TV_IMPORT_POLICY, type TVAssessment } from "./tradingview-import-compatibility.internal";
import {
  TradeChangeError,
  TradeChangeRuleError,
  type TradeChangeIntent,
  type TradeChangeChoices,
  type TradeChangeOptions,
  type CommitReceipt,
  type FactStateAudit,
  type ReviewChange,
  type ReviewFactValues,
} from "./sqlite-contracts";
import {
  copySourceMaterialRows,
  materializeSourceMaterialContext,
  prepareMaterialChanges,
  _applyPreparedMaterialChangesInTransaction,
  type SourceMaterialRows,
  type PreparedMaterialChanges,
  type MaterialVersionInput,
  type MissingExecutionDependency,
} from "./source-materials";
import type { DatabaseSync } from "node:sqlite";
import {
  copyTradingViewMigrationRows, prepareTradingViewMaintenance, validateTradingViewMaintenanceIntent, proveTradingViewImportIdentity,
  isTradingViewMaintenanceIntent, TradingViewMigrationApplication,
  type TradingViewRawSnapshot, type PreparedTradingViewMaintenance,
} from "./tradingview-account-migration.internal";
import type { TradingViewAccountMigrationTransactionOptions } from "./tradingview-account-migration-contracts";


import { SQLITE_MIGRATIONS } from "../../../db/sqlite-schema";
import { withSqliteTransaction } from "../../../db/sqlite";
import { normalizeDrawing, validateDrawing } from "../chart/drawings";
import { compareExecutions, reconcileExecutions, type ExecutionReconciliation } from "../import/execution-reconciliation";
import type { TagSuggestionRecord } from "../insights/types";
import { createEmptyEpisodeReviewRecord } from "../reviews/review-metrics";
import type { CoverageSegment, DailyCandleRecord, IntervalCoverageSegment, MarketCandleRecord, NativeMarketInterval } from "../market/contracts";
import type { EpisodeReviewRecord } from "../reviews/types";
import {
  isReviewSummaryNote,
  reviewSummarySettingKey,
  type ReviewSummaryNote,
} from "../reviews/review-summary";
import { tradeNatureOf, type Instrument, type TradeExecution } from "../trades/types";
import type { ChartSettings } from "./chart-settings";
import { validReviewExtensions } from "../reviews/review-metrics";
import type { ImportHistoryEntry } from "./import-history";
import { isLegacyImportHistoryEntry } from "./import-history-contract";
import { ensureImportHistoryAudit, readImportHistoryCommits } from "./import-history-audit";
import { isMonthlyEvidenceScope, isMonthlyStatement } from "../import/monthly-statement";
import { canonicalInstrumentId } from "../instruments/display-name";
import {
  validateResolvedInstrument,
  mergeInstrumentExchange,
  validateLocalizedInstrumentName,
  type LocalizedInstrumentName,
  type ResolvedInstrument,
} from "../instruments/metadata-contracts";
import type { MarketDataJob } from "./market-data-jobs";
import type { EpisodeReviewState } from "./review-storage";
import { buildTradeEpisodes } from "../trades/episodes";
import { bridgeRecallCompletions, type RecallCompletionProjection } from "./recall-completion-bridge";
import type {
  BrowserStatePayload,
  CoverageRecord,
  ExecutionMergeReport,
  MigrationReport,
  ProviderSymbolRecord,
  ReviewPlan,
  SqliteStatus,
  StorageBootstrap,
  StoredInstrument,
} from "./sqlite-contracts";

type Row = Record<string, unknown>;
type IntervalCoverageRecord = IntervalCoverageSegment & {
  instrumentId: string;
  adjustmentMode?: "raw";
};
type IntervalCoverageInput = IntervalCoverageSegment & {
  instrumentId?: string;
  adjustmentMode?: "raw";
};
type NormalizedIntervalCoverageRecord = IntervalCoverageRecord & {
  adjustmentMode: "raw";
};
type MarketDataCommitInput = {
  instrumentId: string;
  candles: DailyCandleRecord[];
  coverage: CoverageSegment[];
  providerSymbol?: { provider: string; symbol: string };
};
type IntervalMarketDataCommitInput = {
  instrumentId: string;
  interval: "15m" | "1h" | "1D";
  candles: MarketCandleRecord[];
  coverage: IntervalCoverageSegment[];
  providerSymbol?: { provider: string; symbol: string };
};
type MigrationCounts = Pick<MigrationReport, "inserted" | "duplicate" | "conflict">;

const MARKET_DATA_STATUSES = new Set([
  "not-requested", "syncing", "complete", "latest-available", "partial", "stale",
  "source-rate-limited", "source-forbidden", "source-unavailable",
  "invalid-response", "storage-error", "needs-provider", "ready", "error",
]);
const COVERAGE_STATUSES = new Set([
  "not-requested", "syncing", "complete", "latest-available", "partial", "stale",
  "source-rate-limited", "source-forbidden", "source-unavailable",
  "invalid-response", "storage-error",
]);

function marketCurrency(market: string): string {
  if (market === "HK") return "HKD";
  if (market === "CN-SH" || market === "CN-SZ") return "CNY";
  return "USD";
}

function resolvedAtTimestamp(value: string | undefined): number | undefined {
  if (typeof value !== "string") return undefined;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : undefined;
}

function newestByResolvedAt<T extends { resolvedAt: string }>(
  candidates: readonly (T | undefined)[],
): T | undefined {
  let newest: T | undefined;
  let newestTimestamp: number | undefined;
  for (const candidate of candidates) {
    if (!candidate) continue;
    const timestamp = resolvedAtTimestamp(candidate.resolvedAt);
    if (timestamp === undefined) continue;
    if (newest === undefined || newestTimestamp === undefined || timestamp >= newestTimestamp) {
      newest = candidate;
      newestTimestamp = timestamp;
    }
  }
  return newest;
}

function storedLocalizedName(value: unknown): LocalizedInstrumentName | undefined {
  try {
    return validateLocalizedInstrumentName(value);
  } catch {
    return undefined;
  }
}

function storedMetadata(value: unknown): ResolvedInstrument | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const candidate = value as Partial<ResolvedInstrument>;
  if (typeof candidate.market !== "string" || typeof candidate.symbol !== "string") return undefined;
  try {
    return validateResolvedInstrument(value, {
      market: candidate.market,
      symbol: candidate.symbol,
    });
  } catch {
    return undefined;
  }
}

function tradeInputError(message: string, cause?: unknown) {
  return new TradeChangeRuleError("input", message, { cause });
}
function tradeDomainError(message: string, cause?: unknown) {
  return new TradeChangeRuleError("domain", message, { cause });
}
/** Compatibility adapter for accepted, pure validators that still throw plain
 * Error for rejected values. It is never used around SQL, snapshot copying,
 * the complete prepare/apply operation, or arbitrary application callbacks.
 * Programming exceptions and errors carrying an operational code pass through.
 */
function externalTradeValidation<T>(category: "input" | "domain", message: string, work: () => T): T {
  try {
    return work();
  } catch (error) {
    if (error instanceof Error && error.constructor === Error && !("code" in error)) {
      throw new TradeChangeRuleError(category, message, { cause: error });
    }
    throw error;
  }
}

function asString(value: unknown, field: string) {
  if (typeof value !== "string") throw tradeInputError(`Invalid ${field}`);
  return value;
}

function asRecord(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw tradeInputError(`Invalid ${field}`);
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
  if (typeof value !== "string") throw tradeInputError(`Invalid ${field}`);
  try { return JSON.parse(value) as T; } catch { throw tradeInputError(`Invalid ${field}`); }
}

function withoutMonthlyEvidence(entry: ImportHistoryEntry): ImportHistoryEntry {
  const { monthly: _monthly, ...metadata } = entry;
  return metadata;
}

function parseRevisionRequest(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== "string") return undefined;
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * A legacy scoped supplement was persisted before MonthlyEvidenceScope existed.
 * Recover its target only from the revision request written in the same batch;
 * an unproven batch must not become document-wide evidence during bootstrap.
 */
function projectImportHistoryMonthly(
  entry: ImportHistoryEntry,
  revisionRequestJson: unknown,
): ImportHistoryEntry {
  if (entry.monthly === undefined) return entry;
  if (!isMonthlyStatement(entry.monthly)) return withoutMonthlyEvidence(entry);

  const isLegacyScopedSupplement = entry.id.startsWith("supplement:") && entry.instrumentCount === 1;
  if (!isLegacyScopedSupplement) return entry;

  const request = parseRevisionRequest(revisionRequestJson);
  const importHistory = request?.importHistory;
  if (!request || request.id !== entry.id || !importHistory || typeof importHistory !== "object" || Array.isArray(importHistory)) {
    return withoutMonthlyEvidence(entry);
  }
  const auditHistory = importHistory as Record<string, unknown>;
  if (auditHistory.id !== entry.id || auditHistory.instrumentCount !== 1) {
    return withoutMonthlyEvidence(entry);
  }
  const instrumentId = request.instrumentId;
  const accountId = request.accountId;
  const derivedScope = { instrumentId, accountId };
  if (!isMonthlyEvidenceScope(derivedScope)) return withoutMonthlyEvidence(entry);

  const auditMonthly = auditHistory.monthly;
  if (!isMonthlyStatement(auditMonthly)) return withoutMonthlyEvidence(entry);
  if (
    auditMonthly.documentId !== entry.monthly.documentId ||
    auditMonthly.accountId !== accountId ||
    (entry.monthly.accountId !== undefined && entry.monthly.accountId !== accountId)
  ) {
    return withoutMonthlyEvidence(entry);
  }

  if (entry.monthly.evidenceScope !== undefined) {
    return isMonthlyEvidenceScope(entry.monthly.evidenceScope) &&
      entry.monthly.evidenceScope.instrumentId === instrumentId &&
      entry.monthly.evidenceScope.accountId === accountId
      ? entry
      : withoutMonthlyEvidence(entry);
  }

  return {
    ...entry,
    monthly: { ...entry.monthly, evidenceScope: derivedScope },
  };
}

function json(value: unknown, field: string) {
  try {
    assertJsonSafe(value, field);
    const serialized = JSON.stringify(value);
    if (serialized === undefined) throw tradeInputError(`Invalid ${field}`);
    return serialized;
  } catch { throw tradeInputError(`Invalid ${field}`); }
}

function assertJsonSafe(value: unknown, field: string, seen = new Set<object>()): void {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (Number.isFinite(value)) return;
    throw tradeInputError(`Invalid ${field}`);
  }
  if (typeof value !== "object" || value === undefined) throw tradeInputError(`Invalid ${field}`);
  if (seen.has(value)) throw tradeInputError(`Invalid ${field}`);
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((item) => assertJsonSafe(item, field, seen));
  } else {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) throw tradeInputError(`Invalid ${field}`);
    Object.values(value).forEach((item) => assertJsonSafe(item, field, seen));
  }
  seen.delete(value);
}

function sameJson(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

type AccountCorrection = {
  originalAccountId: string;
  canonicalAccountId: string;
  reason: string;
  [key: string]: unknown;
};

type StoredExecutionEvidence = Record<string, unknown> & {
  accountCorrection: AccountCorrection;
};

function validateAccountCorrection(value: unknown): AccountCorrection {
  const correction = asRecord(value, "account correction");
  assertStringFields(
    correction,
    ["originalAccountId", "canonicalAccountId", "reason"],
    "account correction",
  );
  const originalAccountId = correction.originalAccountId;
  const canonicalAccountId = correction.canonicalAccountId;
  const reason = correction.reason;
  if (
    typeof originalAccountId !== "string" ||
    typeof canonicalAccountId !== "string" ||
    typeof reason !== "string" ||
    !originalAccountId.trim() ||
    !canonicalAccountId.trim() ||
    !reason.trim() ||
    originalAccountId === canonicalAccountId
  ) {
    throw tradeInputError("Invalid account correction");
  }
  assertJsonSafe(correction, "account correction");
  return correction as AccountCorrection;
}

function executionCorrectionIdentity(execution: TradeExecution): string {
  const decimal = (value: string) => {
    try {
      const normalized = new Decimal(value);
      return normalized.isFinite() ? normalized.toString() : `invalid:${value}`;
    } catch {
      return `invalid:${value}`;
    }
  };
  return canonicalRecord({
    instrumentId: execution.instrument.id,
    side: execution.side,
    executedAt: execution.executedAt,
    quantity: decimal(execution.quantity),
    price: decimal(execution.price),
  });
}

function executionSourceDocument(execution: TradeExecution): string | undefined {
  const platform = execution.source.platform.trim();
  const fingerprint = execution.source.fileFingerprint?.trim();
  if (platform && fingerprint) return `fingerprint:${platform}|${fingerprint}`;
  const fileName = execution.source.fileName?.trim();
  if (platform && fileName) return `file:${platform}|${fileName}`;
  return undefined;
}

function executionSourceOrderReference(execution: TradeExecution): string | undefined {
  return execution.source.executionGroup?.orderReference?.trim() || undefined;
}

function sameTrustedSourceProvenance(
  existing: TradeExecution,
  incoming: TradeExecution,
): boolean {
  if (
    existing.source.platform.trim() !== incoming.source.platform.trim() ||
    existing.instrument.currency.trim().toUpperCase() !== incoming.instrument.currency.trim().toUpperCase() ||
    tradeNatureOf(existing) !== tradeNatureOf(incoming)
  ) return false;
  const nature = tradeNatureOf(existing);
  if (nature === "simulation" && existing.source.simulationRunId !== incoming.source.simulationRunId) return false;

  const existingDocument = executionSourceDocument(existing);
  const incomingDocument = executionSourceDocument(incoming);
  if (!existingDocument || existingDocument !== incomingDocument) return false;

  const provenanceChecks: boolean[] = [];
  const existingRowFingerprint = existing.source.statementRowFingerprint?.trim();
  const incomingRowFingerprint = incoming.source.statementRowFingerprint?.trim();
  if (existingRowFingerprint && incomingRowFingerprint) {
    provenanceChecks.push(existingRowFingerprint === incomingRowFingerprint);
  }
  if (typeof existing.source.page === "number" && typeof incoming.source.page === "number") {
    provenanceChecks.push(
      Number.isFinite(existing.source.page) &&
      Number.isFinite(incoming.source.page) &&
      existing.source.page === incoming.source.page &&
      existing.source.row === incoming.source.row,
    );
  }
  if (
    typeof existing.source.sourceOrder === "number" &&
    typeof incoming.source.sourceOrder === "number"
  ) {
    provenanceChecks.push(
      Number.isFinite(existing.source.sourceOrder) &&
      Number.isFinite(incoming.source.sourceOrder) &&
      existing.source.sourceOrder === incoming.source.sourceOrder,
    );
  }
  const existingOrderReference = executionSourceOrderReference(existing);
  const incomingOrderReference = executionSourceOrderReference(incoming);
  if (existingOrderReference && incomingOrderReference) {
    provenanceChecks.push(existingOrderReference === incomingOrderReference);
  }
  if (provenanceChecks.length === 0) {
    provenanceChecks.push(
      Number.isFinite(existing.source.row) &&
      Number.isFinite(incoming.source.row) &&
      existing.source.row === incoming.source.row,
    );
  }
  return provenanceChecks.length > 0 && provenanceChecks.every(Boolean);
}

function canCarryAccountCorrection(
  existing: TradeExecution,
  incoming: TradeExecution,
  correction: AccountCorrection,
): boolean {
  return (
    (incoming.accountId === correction.originalAccountId ||
      incoming.accountId === correction.canonicalAccountId) &&
    executionCorrectionIdentity(existing) === executionCorrectionIdentity(incoming) &&
    sameTrustedSourceProvenance(existing, incoming)
  );
}

function validateInstrument(value: unknown): asserts value is StoredInstrument {
  const instrument = asRecord(value, "instrument");
  assertStringFields(
    instrument,
    ["id", "symbol", "name", "market", "currency"],
    "instrument",
  );
  if (instrument.localizedName !== undefined) {
    externalTradeValidation("input", "Invalid localized instrument name", () => validateLocalizedInstrumentName(instrument.localizedName));
  }
  if (instrument.metadata !== undefined) {
    const metadata = asRecord(instrument.metadata, "instrument metadata");
    assertStringFields(metadata, ["market", "symbol", "name", "assetType", "source", "confidence", "resolvedAt"], "instrument metadata");
    if (metadata.market !== instrument.market || metadata.symbol !== instrument.symbol) {
      throw tradeInputError("Invalid instrument metadata");
    }
    if (!storedMetadata(metadata)) {
      throw tradeInputError("Invalid instrument metadata");
    }
    if (metadata.localizedName !== undefined) {
      externalTradeValidation("input", "Invalid localized instrument name", () => validateLocalizedInstrumentName(metadata.localizedName));
    }
    assertJsonSafe(metadata, "instrument metadata");
  }
}

function isValidNumericEvidence(value: unknown): value is string {
  return typeof value === "string" && /^-?\d+(?:\.\d+)?$/.test(value) && Number.isFinite(Number(value));
}

function validateSimulationReport(value: unknown) {
  const report = asRecord(value, "simulation report");
  if (Object.keys(report).length === 0 || Object.values(report).some(entry => !isValidNumericEvidence(entry))) {
    throw tradeInputError("Invalid simulation report");
  }
}

function validateTradingViewSourceReport(value: unknown) {
  const report = asRecord(value, "TradingView source report");
  const numericFields = [
    "netPnl",
    "returnPercent",
    "favorableExcursion",
    "favorableExcursionPercent",
    "adverseExcursion",
    "adverseExcursionPercent",
    "cumulativePnl",
    "cumulativeReturnPercent",
  ] as const;
  const expectedFields = [...numericFields, "durationBars"];
  if (Object.keys(report).length !== expectedFields.length || Object.keys(report).some(field => !expectedFields.includes(field as typeof expectedFields[number]))) {
    throw tradeInputError("Invalid TradingView source report");
  }
  assertStringFields(report, numericFields, "TradingView source report");
  if (numericFields.some(field => !isValidNumericEvidence(report[field]))
    || typeof report.durationBars !== "number" || !Number.isInteger(report.durationBars) || report.durationBars < 0) {
    throw tradeInputError("Invalid TradingView source report");
  }
}

function validateSimulationEvidence(source: TradeExecution["source"]) {
  const tradingView = source.platform === "tradingview" || source.inputKind === "tradingview";
  const hasSimulationEvidence = source.tradingNature === "simulated"
    || source.tradeNature === "simulation"
    || source.simulationRunId !== undefined
    || source.simulationTradeId !== undefined
    || (tradingView && source.sourceTradeId !== undefined)
    || source.simulationRole !== undefined
    || source.simulationSignal !== undefined
    || source.simulationReport !== undefined
    || source.sourceReport !== undefined;
  if (!hasSimulationEvidence) return;

  const legacyTradeId = source.simulationTradeId;
  const sourceTradeId = source.sourceTradeId;
  const tradeId = sourceTradeId ?? legacyTradeId;
  const rolelessCurrentParserRow = source.tradeNature === "simulation"
    && source.tradingNature === undefined
    && source.simulationRole === undefined
    && sourceTradeId !== undefined
    && legacyTradeId === undefined
    && source.simulationReport === undefined;
  if (rolelessCurrentParserRow) {
    if (!tradingView
      || typeof sourceTradeId !== "string" || !sourceTradeId.trim() || sourceTradeId !== sourceTradeId.trim()
      || typeof source.simulationRunId !== "string" || !source.simulationRunId.trim()
      || source.timePrecision !== "date-only" || source.sourceTimezone !== "Asia/Shanghai"
      || (source.simulationSignal !== undefined && typeof source.simulationSignal !== "string")) {
      throw tradeInputError("Invalid simulation evidence");
    }
    if (source.sourceReport !== undefined) validateTradingViewSourceReport(source.sourceReport);
    return;
  }

  if (!tradingView
    || (source.tradeNature !== "simulation" && source.tradingNature !== "simulated")
    || (source.tradeNature !== undefined && source.tradeNature !== "simulation")
    || (source.tradingNature !== undefined && source.tradingNature !== "simulated")
    || typeof source.simulationRunId !== "string" || !source.simulationRunId.trim()
    || typeof tradeId !== "string" || !tradeId.trim()
    || (legacyTradeId !== undefined && !/^\d+$/.test(legacyTradeId))
    || (legacyTradeId !== undefined && legacyTradeId !== tradeId)
    || (sourceTradeId !== undefined && sourceTradeId !== tradeId)
    || !["entry", "exit"].includes(source.simulationRole ?? "")
    || source.timePrecision !== "date-only" || source.sourceTimezone !== "Asia/Shanghai") {
    throw tradeInputError("Invalid simulation evidence");
  }
  if (source.simulationSignal !== undefined && typeof source.simulationSignal !== "string") {
    throw tradeInputError("Invalid simulation signal");
  }
  if (source.simulationReport !== undefined) {
    if (source.simulationRole !== "exit" || source.sourceReport !== undefined) throw tradeInputError("Invalid simulation report");
    validateSimulationReport(source.simulationReport);
  }
  if (source.sourceReport !== undefined) {
    if ((source.simulationRole !== undefined && source.simulationRole !== "exit") || source.simulationReport !== undefined) throw tradeInputError("Invalid TradingView source report");
    validateTradingViewSourceReport(source.sourceReport);
  }
}

function validateExecution(value: unknown, options: { allowUnknownFee?: boolean } = {}): asserts value is TradeExecution {
  const item = asRecord(value, "execution") as Partial<TradeExecution>;
  assertStringFields(
    item as Record<string, unknown>,
    ["id", "accountId", "accountLabel", "executedAt", "quantity", "price", "fee"],
    "execution",
  );
  if (item.side !== "buy" && item.side !== "sell") throw tradeInputError("Invalid execution");
  validateInstrument(item.instrument);
  if (!item.source || typeof item.source !== "object" || typeof item.source.platform !== "string" || typeof item.source.row !== "number") throw tradeInputError("Invalid execution");
  const source = item.source;
  if (source.sourceTradeId !== undefined && typeof source.sourceTradeId !== "string") throw tradeInputError("Invalid source trade ID");
  if (source.settlement !== undefined) {
    const settlement = asRecord(source.settlement, "cash settlement");
    assertStringFields(settlement,["currency","quantity","grossAmount","netAmount"],"cash settlement");
    const validDecimal = (value: unknown): value is string => typeof value === "string" && /^-?\d+(?:\.\d+)?$/.test(value) && new Decimal(value).isFinite();
    if (![settlement.quantity,settlement.grossAmount,settlement.netAmount].every(validDecimal)
      || new Decimal(settlement.quantity as string).lte(0) || new Decimal(settlement.grossAmount as string).lte(0)) throw tradeInputError("Invalid cash settlement");
    const fees=asRecord(settlement.fees,"settlement fees");
    if (Object.values(fees).some(value=>!validDecimal(value)||new Decimal(value).lt(0))) throw tradeInputError("Invalid settlement fees");
  }
  if (source.tradingNature !== undefined && !["simulated", "live", "unknown"].includes(source.tradingNature)) throw tradeInputError("Invalid trading nature");
  validateSimulationEvidence(source);
  validateTradeScope(source.tradeNature ?? (source.tradingNature === "simulated" ? "simulation" : source.tradingNature), source.simulationRunId, "simulation execution");
  assertTradeExecutionSemantics(item as TradeExecution, options);
}

function validateTradeScope(
  nature: unknown,
  simulationRunId: unknown,
  field: string,
) {
  if (nature !== undefined && nature !== "live" && nature !== "simulation" && nature !== "unknown") {
    throw tradeInputError(`Invalid ${field}`);
  }
  if (simulationRunId !== undefined && (typeof simulationRunId !== "string" || !simulationRunId.trim())) {
    throw tradeInputError(`Invalid ${field}`);
  }
  if (nature === "simulation" && (typeof simulationRunId !== "string" || !simulationRunId.trim())) {
    throw tradeInputError(`Invalid ${field}`);
  }
  if (nature !== "simulation" && simulationRunId !== undefined) {
    throw tradeInputError(`Invalid ${field}`);
  }
}

function validateReview(value: unknown): asserts value is EpisodeReviewRecord {
  if (!value || typeof value !== "object") throw tradeInputError("Invalid review");
  const item = value as Partial<EpisodeReviewRecord>;
  if (item.version !== 1 || typeof item.episodeId !== "string" || typeof item.instrumentId !== "string" || typeof item.updatedAt !== "string" || !item.plan || !item.review || !Array.isArray(item.confirmedTagIds)) throw tradeInputError("Invalid review");
  for (const field of ["thesis", "expectedPath", "invalidationCondition", "targetRange", "plannedRiskAmount"] as const) asString(item.plan[field], "review plan");
  for (const field of ["riskManagement", "psychology", "reusableRule"] as const) asString(item.review[field], "review");
  if (typeof item.review.completed !== "boolean" || item.confirmedTagIds.some((tag) => typeof tag !== "string")) throw tradeInputError("Invalid review");
  if (!validReviewExtensions(item.review)) throw tradeInputError("Invalid review extensions");
  json(item, "review");
}

function validateReviewState(value: unknown): asserts value is EpisodeReviewState {
  if (!value || typeof value !== "object") throw tradeInputError("Invalid review state");
  const state = value as EpisodeReviewState;
  if (state.version !== 2 || typeof state.episodeId !== "string" || typeof state.replayCursor !== "string" || !["15m", "1h", "4h", "1D", "1W"].includes(state.timeframe) || (state.activePanelTab !== "stats" && state.activePanelTab !== "notes") || !Array.isArray(state.drawings)) throw tradeInputError("Invalid review state");
  for (const drawing of state.drawings) {
    if (!drawing || typeof drawing.id !== "string" || drawing.version !== 2 || drawing.episodeId !== state.episodeId || typeof drawing.name !== "string" || !Array.isArray(drawing.anchors) || !drawing.style || typeof drawing.style.color !== "string" || typeof drawing.style.lineWidth !== "number" || typeof drawing.style.opacity !== "number" || typeof drawing.zIndex !== "number" || typeof drawing.hidden !== "boolean" || typeof drawing.locked !== "boolean" || typeof drawing.createdAtCursor !== "string" || (drawing.visibleOn !== "all" && (!Array.isArray(drawing.visibleOn) || drawing.visibleOn.some((timeframe) => !["15m", "1h", "4h", "1D", "1W"].includes(timeframe)))) || !["pre-trade", "during-replay", "post-review"].includes(drawing.stage)) throw tradeInputError("Invalid review drawing");
    try { validateDrawing(normalizeDrawing(drawing, state.episodeId, state.replayCursor, drawing.zIndex)); } catch { throw tradeInputError("Invalid review drawing"); }
  }
}

function validateTagSuggestion(value: unknown): asserts value is TagSuggestionRecord {
  if (!value || typeof value !== "object") throw tradeInputError("Invalid tag suggestion");
  const item = value as Partial<TagSuggestionRecord>;
  if (item.version !== 1 || typeof item.id !== "string" || typeof item.episodeId !== "string" || typeof item.instrumentId !== "string" || typeof item.tagId !== "string" || !Array.isArray(item.evidence)) throw tradeInputError("Invalid tag suggestion");
}

function validateImportHistory(value: unknown): asserts value is ImportHistoryEntry {
  const entry = asRecord(value, "import history");
  if (entry.monthly !== undefined && !isMonthlyStatement(entry.monthly)) throw tradeInputError("Invalid monthly statement evidence");
  assertStringFields(entry, ["id", "fileName", "sourceLabel", "importedAt"], "import history");
  if (entry.tradingNature !== undefined && !["live","simulated","unknown"].includes(String(entry.tradingNature))) throw tradeInputError("Invalid import trading nature");
  if (entry.tradingNature === "simulated" && (typeof entry.simulationRunId !== "string" || !entry.simulationRunId)) throw tradeInputError("Invalid simulation import history");

  for (const field of [
    "tradeCount", "instrumentCount", "excludedInstrumentCount", "excludedRecordCount",
    "duplicateTradeCount", "unresolvedInstrumentCount", "captureCount", "conflictTradeCount",
  ]) {
    const count = entry[field];
    if (count !== undefined && (typeof count !== "number" || !Number.isFinite(count) || count < 0)) {
      throw tradeInputError("Invalid import history");
    }
  }
  validateTradeScope(entry.tradeNature ?? (entry.tradingNature === "simulated" ? "simulation" : entry.tradingNature), entry.simulationRunId, "import history");
}

function isStoredMarketDataErrorDetail(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const error = value as { code?: unknown; message?: unknown };
  return typeof error.code === "string" &&
    error.code.length > 0 &&
    typeof error.message === "string" &&
    error.message.length > 0;
}

function validateJobInterval(value: unknown): void {
  const interval = asRecord(value, "market data job");
  if (
    interval.interval !== "15m" &&
    interval.interval !== "1h" &&
    interval.interval !== "1D"
  ) {
    throw tradeInputError("Invalid market data job");
  }
  if (typeof interval.status !== "string" || !MARKET_DATA_STATUSES.has(interval.status)) {
    throw tradeInputError("Invalid market data job");
  }
  assertOptionalStringFields(
    interval,
    ["message", "coverageStart", "coverageEnd"],
    "market data job",
  );
  if (interval.error !== undefined && !isStoredMarketDataErrorDetail(interval.error)) {
    throw tradeInputError("Invalid market data job");
  }
}

function validateJob(value: unknown): asserts value is MarketDataJob {
  const job = asRecord(value, "market data job");
  assertStringFields(
    job,
    ["instrumentId", "symbol", "market", "requestedAt", "status"],
    "market data job",
  );
  if (!MARKET_DATA_STATUSES.has(job.status as string) || !Array.isArray(job.intervals)) {
    throw tradeInputError("Invalid market data job");
  }
  if (job.error !== undefined && !isStoredMarketDataErrorDetail(job.error)) {
    throw tradeInputError("Invalid market data job");
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
    throw tradeInputError("Invalid coverage");
  }
  assertOptionalStringFields(coverage, ["startDate", "endDate"], "coverage");
  if (coverage.segments !== undefined) {
    if (!Array.isArray(coverage.segments)) throw tradeInputError("Invalid coverage");
    for (const segment of coverage.segments) {
      const item = asRecord(segment, "coverage segment");
      if (
        typeof item.startDate !== "string"
        || typeof item.endDate !== "string"
        || typeof item.status !== "string"
        || !COVERAGE_STATUSES.has(item.status)
        || !Array.isArray(item.missingTradingDates)
        || item.missingTradingDates.some((date) => typeof date !== "string")
      ) throw tradeInputError("Invalid coverage");
      assertOptionalStringFields(item, ["actualEndDate", "provider", "fetchedAt", "reason"], "coverage segment");
    }
    assertJsonSafe(coverage.segments, "coverage");
  }
}

function normalizeIntervalCoverage(value: IntervalCoverageRecord): NormalizedIntervalCoverageRecord {
  return { ...value, adjustmentMode: value.adjustmentMode ?? "raw" };
}

function intervalCoverageKey(value: IntervalCoverageSegment) {
  return JSON.stringify({
    interval: value.interval,
    requestedStart: value.requestedStart,
    requestedEnd: value.requestedEnd,
    actualStart: value.actualStart,
    actualEnd: value.actualEnd,
    status: value.status,
    provider: value.provider,
    fetchedAt: value.fetchedAt,
    reason: value.reason,
  });
}

function validateIntervalCoverage(value: unknown): asserts value is IntervalCoverageRecord {
  const coverage = asRecord(value, "interval coverage");
  if (
    typeof coverage.instrumentId !== "string"
    || !["15m", "1h", "1D"].includes(coverage.interval as string)
    || typeof coverage.requestedStart !== "string"
    || typeof coverage.requestedEnd !== "string"
    || typeof coverage.status !== "string"
    || !COVERAGE_STATUSES.has(coverage.status)
    || (coverage.adjustmentMode !== undefined && coverage.adjustmentMode !== "raw")
  ) {
    throw tradeInputError("Invalid interval coverage");
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
    throw tradeInputError("Invalid provider symbol");
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
  if (!Array.isArray(value)) throw tradeInputError(`Invalid ${field}`);
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
    throw tradeInputError("Invalid browser state");
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

function migrationReport(row: Row): MigrationReport {
  const counts = parseJson<MigrationReport>(row.counts_json, "migration counts");
  return { ...counts, sourceFingerprint: asString(row.source_fingerprint, "migration fingerprint"), validationDigest: typeof row.validation_digest === "string" ? row.validation_digest : "" };
}

function mapInstrumentRow(row: Row): StoredInstrument {
  const metadata = row.metadata_json
    ? parseJson<StoredInstrument["metadata"]>(row.metadata_json, "instrument metadata")
    : undefined;
  const localizedName = row.localized_name_json
    ? parseJson<StoredInstrument["localizedName"]>(row.localized_name_json, "localized instrument name")
    : metadata?.localizedName;
  return {
    id: asString(row.id, "instrument id"),
    symbol: asString(row.symbol, "symbol"),
    name: asString(row.name, "name"),
    market: asString(row.market, "market"),
    currency: asString(row.currency, "currency"),
    ...(localizedName ? { localizedName } : {}),
    ...(metadata ? { metadata } : {}),
  };
}

function mapExecutionRow(row: Row): TradeExecution {
  const evidence = row.evidence_json
    ? parseJson<{ source: TradeExecution["source"]; accountLabel: string }>(
      row.evidence_json,
      "execution evidence",
    )
    : undefined;
  const source: TradeExecution["source"] = evidence?.source ?? {
    platform: "unknown",
    row: 0,
  };
  if (typeof row.trade_nature === "string" && source.tradeNature === undefined) {
    source.tradeNature = row.trade_nature as TradeExecution["source"]["tradeNature"];
  }
  if (typeof row.simulation_run_id === "string" && source.simulationRunId === undefined) {
    source.simulationRunId = row.simulation_run_id;
  }
  const storedInstrument = mapInstrumentRow({
    id: row.instrument_id,
    symbol: row.symbol,
    name: row.name,
    market: row.market,
    currency: row.currency,
    metadata_json: row.metadata_json,
    localized_name_json: row.localized_name_json,
  });
  const { metadata: _metadata, ...instrument } = storedInstrument;
  return {
    id: asString(row.id, "execution id"),
    source,
    accountId: String(row.account ?? ""),
    accountLabel: evidence?.accountLabel ?? "",
    instrument,
    side: asString(row.side, "side") as TradeExecution["side"],
    executedAt: asString(row.executed_at, "executed at"),
    quantity: asString(row.quantity, "quantity"),
    price: asString(row.price, "price"),
    fee: typeof row.fee === "string" ? row.fee : "",
  };
}

function withoutLocalizedInstrumentName(execution: TradeExecution): TradeExecution {
  const { localizedName: _localizedName, ...instrument } = execution.instrument;
  return { ...execution, instrument };
}

function revisionComparableRequest(input: TradeRevisionRequest): TradeRevisionRequest {
  return {
    ...input,
    changes: input.changes.map((change) => ({
      ...change,
      before: change.before
        ? withoutLocalizedInstrumentName(change.before)
        : null,
      after: change.after
        ? withoutLocalizedInstrumentName(change.after)
        : null,
    })),
    ...(input.expectedScope
      ? {
          expectedScope: input.expectedScope.map(withoutLocalizedInstrumentName),
        }
      : {}),
  };
}

function matchesLegacyRevisionRequest(row: Row, input: TradeRevisionRequest, requestJson: string): boolean {
  const audit = parseRevisionRequest(row.revision_json);
  if (!audit || audit.kind === "fact-state-audit-v1" || row.scope_account_unknown !== 0)
    return false;
  const { recordedAt, ...request } = audit;
  if (audit.id !== input.id || audit.instrumentId !== row.instrument_id || audit.accountId !== row.account_id
    || typeof recordedAt !== "string" || recordedAt !== row.recorded_at
    || !Number.isFinite(Date.parse(recordedAt)) || new Date(recordedAt).toISOString() !== recordedAt)
    return false;
  let original: TradeRevisionRequest;
  // Pure shape validation only: corrupt legacy audit is not retry proof. No SQL
  // or storage failure is caught here, and the original row is never rewritten.
  try { original = validateRevision(request); } catch { return false; }
  const comparable = revisionComparableRequest(original);
  if (canonicalRecord(comparable) !== requestJson)
    return false;
  // Published writers projected change wrappers to before/after only. The
  // unified writer additionally leaked server recordedAt into request_json.
  // Prove one of those exact shapes, but compare the full audit request above
  // so extensions cannot hide a changed payload behind that old projection.
  const legacy = { ...comparable, changes: comparable.changes.map(({ before, after }) => ({ before, after })) };
  return row.request_json === canonicalRecord(legacy)
    || row.request_json === canonicalRecord({ ...legacy, recordedAt });
}

function executionForRevisionWrite(
  execution: TradeExecution,
  current: TradeExecution | undefined,
): TradeExecution {
  const { localizedName: _snapshotLocalizedName, ...instrument } = execution.instrument;
  const currentLocalizedName = current?.instrument.localizedName;
  return {
    ...execution,
    instrument: {
      ...instrument,
      ...(currentLocalizedName
        ? { localizedName: currentLocalizedName }
        : {}),
    },
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

function mapIntervalCoverageRow(row: Row): NormalizedIntervalCoverageRecord[] {
  const instrumentId = asString(row.instrument_id, "instrument id");
  const adjustmentMode = asString(row.adjustment_mode, "adjustment mode") as "raw";
  const parsed = parseJson<unknown>(row.details_json, "interval coverage");
  const segments = Array.isArray(parsed) ? parsed : [parsed];
  return segments.map((segment) => ({
    ...segment as IntervalCoverageSegment,
    instrumentId,
    adjustmentMode,
  }));
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


function storedStateFact(row: Row): import("./stored-trade-snapshot").StoredTradeFact {
  const nullable = (value: unknown) => value === null ? null : String(value);
  return {
    id: String(row.id),
    instrumentId: String(row.instrument_id),
    accountId: nullable(row.account),
    side: String(row.side),
    executedAt: String(row.executed_at),
    quantity: String(row.quantity),
    price: String(row.price),
    fee: nullable(row.fee),
    currency: nullable(row.fact_currency),
    tradeNature: nullable(row.trade_nature),
    simulationRunId: nullable(row.simulation_run_id),
    importBatchId: nullable(row.import_batch_id),
    rawEvidenceJson: nullable(row.evidence_json),
    evidence: row.evidence_json === null ? null : JSON.parse(String(row.evidence_json)),
    instrument: {
      id: String(row.instrument_id),
      symbol: String(row.symbol),
      name: String(row.name),
      market: String(row.market),
      currency: String(row.currency)
    },
  };
}
type TradeSnapshot = {
  importedFiles: FileContentIdentity[];
  facts: Row[];
  instruments: Row[];
  audits: Row[];
  states: Row[];
  source: SourceMaterialRows;
  ancillary: Record<string, Row[]>;
  tvProof: TradingViewRawSnapshot;
};

/** Raw identities establish relevance before any historical domain object is
 * trusted. Accounts never narrow this set. Invalid rows are isolated only when
 * their stable instrument identity proves that they cannot affect this intent.
 */
function projectTradeRows(snapshot: TradeSnapshot, intent: InternalIntent) {
  const candidates = intent.kind === "import" ? intent.candidates
    : intent.kind === "browser-migration" ? intent.payload.executions
      : intent.kind === "revision" ? intent.revision.changes.flatMap(c => [c.before, c.after].filter((e): e is TradeExecution => e !== null)) : [];
  const proposed = intent.kind === "import" ? intent.instruments ?? []
    : intent.kind === "browser-migration" ? intent.payload.instruments : [];
  const ids = new Set(candidates.map(e => e.id));
  const hardIds = new Set(ids);
  const instrumentIds = new Set([...candidates.map(e => e.instrument.id), ...proposed.map(i => i.id)]);
  const identity = (symbol: unknown, market: unknown) => typeof symbol === "string" && symbol.trim()
    && typeof market === "string" && market.trim() ? canonicalInstrumentId(symbol, market) : null;
  const identities = new Set([...candidates.map(e => e.instrument), ...proposed].map(i => identity(i.symbol, i.market)));
  const batches = new Set(candidates.flatMap(e => e.source.batchId ? [e.source.batchId] : []));
  const sources = new Set<string>();
  const sourceIdentity = (source: Record<string, unknown>) => {
    if (typeof source.platform !== "string")
      return null;
    const locator = typeof source.fileFingerprint === "string" && source.fileFingerprint.trim()
      ? ["fingerprint", source.fileFingerprint.trim()]
      : null;
    return locator ? JSON.stringify([source.platform.trim(), ...locator]) : null;
  };
  candidates.forEach(e => {
    const key = sourceIdentity(e.source);
    if (key)
      sources.add(key);
  });
  const needsGlobalSimulationSource = candidates.some(e => e.source.platform === "tradingview");
  const materialIds = new Set((intent.kind === "browser-migration" ? [] : intent.materials ?? []).map(m => m.materialId));
  for (const material of intent.kind === "browser-migration" ? [] : intent.materials ?? []) {
    material.observations.forEach(o => o.executionIds.forEach(id => {
      ids.add(id);
      hardIds.add(id);
    }));
  }
  for (const id of intent.kind === "revision" || intent.kind === "material" ? intent.reactivateExecutionIds ?? [] : []) {
    ids.add(id);
    hardIds.add(id);
  }
  if (intent.kind === "revision")
    instrumentIds.add(intent.revision.instrumentId);
  const histories = intent.kind === "import" ? intent.importHistory ?? []
    : intent.kind === "browser-migration" ? intent.payload.importHistory
      : intent.kind === "revision" && intent.revision.importHistory ? [intent.revision.importHistory] : [];
  histories.forEach(h => batches.add(h.id));
  // Parsing here only builds conservative raw indexes; failures are retained,
  // then classified after the complete material/fact/instrument closure.
  const evidence = new Map<string, Record<string, unknown> | null>();
  for (const row of snapshot.facts) {
    try {
      evidence.set(String(row.id), row.evidence_json === null ? {} : asRecord(parseJson(row.evidence_json, "execution evidence"), "execution evidence"));
    }
    catch {
      evidence.set(String(row.id), null);
    }
  }
  let changed = true;
  while (changed) {
    const before = ids.size + instrumentIds.size + identities.size + materialIds.size + batches.size + sources.size;
    for (const version of snapshot.source.versions) {
      if (typeof version.legacy_batch_id === "string" && batches.has(version.legacy_batch_id))
        materialIds.add(String(version.material_id));
    }
    const versions = new Set(snapshot.source.versions.filter(v => materialIds.has(String(v.material_id))).map(v => v.id));
    const observations = new Set(snapshot.source.observations.filter(o => versions.has(o.version_id)).map(o => o.id));
    for (const link of snapshot.source.links) {
      if (observations.has(link.observation_id)) {
        ids.add(String(link.execution_id));
        hardIds.add(String(link.execution_id));
      }
      if (ids.has(String(link.execution_id))) {
        const observation = snapshot.source.observations.find(o => o.id === link.observation_id);
        const version = snapshot.source.versions.find(v => v.id === observation?.version_id);
        if (version)
          materialIds.add(String(version.material_id));
      }
    }
    for (const row of snapshot.instruments) {
      const key = identity(row.symbol, row.market);
      if (instrumentIds.has(String(row.id)) || key !== null && identities.has(key)) {
        instrumentIds.add(String(row.id));
        if (key)
          identities.add(key);
      }
    }
    for (const row of snapshot.facts) {
      const raw = evidence.get(String(row.id));
      const source = raw?.source && typeof raw.source === "object" && !Array.isArray(raw.source) ? raw.source as Record<string, unknown> : null;
      const key = source ? sourceIdentity(source) : null;
      if (ids.has(String(row.id)) || instrumentIds.has(String(row.instrument_id))
        || batches.has(String(row.import_batch_id)) || key !== null && sources.has(key)) {
        if (batches.has(String(row.import_batch_id)) || key !== null && sources.has(key))
          hardIds.add(String(row.id));
        ids.add(String(row.id));
        instrumentIds.add(String(row.instrument_id));
        if (typeof row.import_batch_id === "string")
          batches.add(row.import_batch_id);
        if (key)
          sources.add(key);
      }
    }
    changed = before !== ids.size + instrumentIds.size + identities.size + materialIds.size + batches.size + sources.size;
  }
  const diagnostics: import("./sqlite-contracts").TradeChangeDiagnostic[] = [];
  const rejectOrDiagnose = (code: string, locator: string, relevant: boolean, error: unknown) => {
    const detail = error instanceof Error ? error.message : "Invalid historical value";
    if (relevant)
      throw new TradeChangeError(`${code}_REQUIRES_REVIEW`, "prepare", detail, randomUUID(), [locator]);
    diagnostics.push({ code, locator, detail });
  };
  const instruments: StoredInstrument[] = [];
  for (const row of snapshot.instruments) {
    try {
      const instrument = mapInstrumentRow(row);
      validateInstrument(instrument);
      instruments.push(instrument);
    }
    catch (error) {
      rejectOrDiagnose("LEGACY_INSTRUMENT", `instruments:${row.id}`, instrumentIds.has(String(row.id)) || identity(row.symbol, row.market) === null, error);
    }
  }
  const facts: Row[] = [], current: TradeExecution[] = [];
  const protectedEvidence = new Map<string, StoredExecutionEvidence>();
  for (const row of snapshot.facts) {
    let execution: TradeExecution | undefined;
    try {
      execution = mapExecutionRow(row);
      if (!execution.source || typeof execution.source !== "object" || typeof execution.source.platform !== "string")
        throw new Error("Invalid stored source identity");
      if (execution.source.platform === "tradingview" && execution.source.tradingNature === "simulated" && !execution.source.fileFingerprint)
        throw new Error("Invalid simulation fingerprint");
      assertTradeExecutionSemantics(execution, { allowUnknownFee: row.fee === null || row.fee === "" });
      const corrections = protectedEvidenceFromRows([row], [execution]);
      corrections.forEach((value, id) => protectedEvidence.set(id, value));
      facts.push(row);
      current.push(execution);
    }
    catch (error) {
      const unknownIdentity = identity(row.symbol, row.market) === null;
      // A broken evidence document can hide a broker fingerprint just as it
      // can hide a simulation fingerprint. Different accounts/instruments do
      // not prove different sources. Isolate it only when the complete raw
      // closure has no source key with which the unknown source could overlap.
      const unknownSource = evidence.get(String(row.id)) === null
        && (sources.size > 0 || needsGlobalSimulationSource);
      let mayIntersect = ids.has(String(row.id));
      if (execution && !hardIds.has(String(row.id)) && intent.kind !== "revision") {
        try {
          // The matcher remains the only matching authority. Account claims
          // cannot make a corrupt fact disappear from its protection: compare
          // in the stored account's scope for this read-only probe.
          const probe = reconcileExecutions([execution], candidates.map(candidate => ({ ...candidate, accountId: execution!.accountId })));
          mayIntersect = probe.conflicts.length > 0 || probe.duplicates.length > 0 || probe.automaticReplacementIds.length > 0
            || candidates.some(candidate => executionCorrectionIdentity(candidate) === executionCorrectionIdentity(execution!));
        }
        catch {
          mayIntersect = true;
        }
      }
      rejectOrDiagnose("LEGACY_FACT", `executions:${row.id}`, hardIds.has(String(row.id)) || mayIntersect || unknownIdentity || unknownSource, error);
    }
  }
  const revisions: TradeRevision[] = [];
  for (const row of snapshot.audits) {
    try {
      const revision = asRecord(parseJson(row.revision_json, "revision audit"), "revision audit");
      asRecord(parseJson(row.request_json, "revision request"), "revision request");
      // State audits remain reachable through Task4 history and their dedicated
      // reader; they never impersonate an ordinary known-account revision.
      if (row.scope_account_unknown === 0 && revision.kind !== "fact-state-audit-v1")
        revisions.push(revision as TradeRevision);
    }
    catch (error) {
      rejectOrDiagnose("LEGACY_REVISION", `trade_revisions:${row.id}`, instrumentIds.has(String(row.instrument_id)) || intent.kind === "revision" && row.id === intent.revision.id, error);
    }
  }
  // Unrelated material corruption is visible even when this intent does not
  // need materialization. Any material write retains Task4's complete proof.
  const needsMaterialProof = materialIds.size > 0 || histories.length > 0;
  for (const [table, rows, fields] of [
    ["source_material_versions", snapshot.source.versions, ["locator_json", "scope_json", "diagnostics_json", "content_json"]],
    ["source_observations", snapshot.source.observations, ["locator_json", "raw_json"]],
  ] as const) {
    for (const row of rows) {
      for (const field of fields) {
        if (row[field] === null)
          continue;
        try {
          parseJson(row[field], `material ${field}`);
        }
        catch (error) {
          rejectOrDiagnose("LEGACY_MATERIAL", `${table}:${row.id}:${field}`, needsMaterialProof, error);
        }
      }
    }
  }
  return { facts, current, instruments, protectedEvidence, revisions, diagnostics };
}
type PreparedTrade = {
  stateFacts: import("./stored-trade-snapshot").StoredTradeFact[];
  inheritedUnknownFees: [string, string | null][];
  reviewChanges: ReviewChange[];
  intent: InternalIntent;
  current: TradeExecution[];
  reconciliation: ExecutionReconciliation;
  preservedEvidence: [
    string,
    StoredExecutionEvidence
  ][];
  materials: PreparedMaterialChanges[];
  conditionalMaterialLinks: {
    executionId: string;
    when: Extract<NonNullable<ReviewChange["when"]>, { conflictId: string }>;
  }[];
  ancillaryDigest: string | null;
  withdrawnIds: string[];
  tvImport?: { assessment: TVAssessment; summary: import("./sqlite-contracts").TradingViewImportSummary;
    parent?: { planId: string; bodyDigest: string; expiresAt: string } };
};
function describeTradeChanges(body: PreparedTrade, missing: MissingExecutionDependency[], reactivations: string[]): ReviewChange[] {
  const result: ReviewChange[] = [];
  const beforeById = new Map(body.stateFacts.map(fact => [fact.id, fact]));
  const inheritedUnknownFees = new Map(body.inheritedUnknownFees);
  const values = (fact: TradeExecution): ReviewFactValues => ({
    instrumentId: fact.instrument.id,
    accountId: fact.accountId,
    side: fact.side,
    quantity: fact.quantity,
    price: fact.price,
    fee: inheritedUnknownFees.has(fact.id) ? inheritedUnknownFees.get(fact.id)! : fact.fee,
    executedAt: fact.executedAt,
    currency: fact.instrument.currency,
  });
  const prior = (id: string): ReviewFactValues | null => {
    const fact = beforeById.get(id);
    return fact ? {
      instrumentId: fact.instrumentId,
      accountId: fact.accountId,
      side: fact.side,
      quantity: fact.quantity,
      price: fact.price,
      fee: fact.fee,
      executedAt: fact.executedAt,
      currency: fact.currency
    } : null;
  };
  const factWrite = (fact: TradeExecution, kind?: "revise", when?: ReviewChange["when"]) => {
    result.push({
      kind: kind ?? (beforeById.has(fact.id) ? "replace" : "add"),
      executionId: fact.id,
      before: prior(fact.id),
      after: values(fact),
      ...(when ? { when } : {})
    });
  };
  const withdrawal = (id: string, when?: ReviewChange["when"]) => result.push({
    kind: "withdraw", executionId: id, before: prior(id), after: null, ...(when ? { when } : {}),
  });
  if (body.intent.kind === "revision") {
    for (const change of body.intent.revision.changes) {
      if (change.after)
        factWrite(change.after, change.before ? "revise" : undefined);
      else if (change.before)
        withdrawal(change.before.id);
    }
  }
  else {
    for (const fact of body.reconciliation.acceptedIncoming) {
      if (!body.withdrawnIds.includes(fact.id))
        factWrite(fact);
    }
    for (const id of body.reconciliation.automaticReplacementIds) {
      if (!body.reconciliation.acceptedIncoming.some(fact => fact.id === id))
        withdrawal(id);
    }
    for (const conflict of body.reconciliation.conflicts) {
      const decisions = conflict.incoming.some(incoming => conflict.existing.some(existing => existing.id === incoming.id))
        ? ["use-incoming"] as const : ["use-incoming", "keep-both"] as const;
      for (const incoming of conflict.incoming) {
        if (!body.withdrawnIds.includes(incoming.id))
          factWrite(incoming, undefined, { conflictId: conflict.id, decisions: [...decisions] });
      }
      for (const existing of conflict.existing) {
        if (!conflict.incoming.some(incoming => incoming.id === existing.id))
          withdrawal(existing.id, { conflictId: conflict.id, decisions: ["use-incoming"] });
      }
    }
  }
  for (const item of missing)
    withdrawal(item.executionId, { missingExecutionId: item.executionId, action: "withdraw" });
  for (const executionId of reactivations)
    result.push({
      kind: "reactivate",
      executionId,
      before: prior(executionId),
      after: prior(executionId),
      when: { reactivateExecutionId: executionId, action: "activate" }
    });
  for (const prepared of body.materials) {
    const material = prepared.input;
    result.push({
      kind: "material-version",
      materialId: material.materialId,
      versionId: material.versionId,
      previousVersionId: prepared.expectedCurrentVersionId
    });
    for (const observation of material.observations) {
      for (const executionId of observation.executionIds)
        result.push({
          kind: "link",
          materialId: material.materialId,
          versionId: material.versionId,
          observationId: observation.id,
          executionId,
          ...(body.conditionalMaterialLinks.find(link => link.executionId === executionId)?.when
            ? { when: body.conditionalMaterialLinks.find(link => link.executionId === executionId)!.when }
            : {}),
        });
    }
  }
  return result;
}
const BROWSER_DEPENDENCY_TABLES = ["reviews", "tag_suggestions", "market_data_jobs", "daily_candles", "market_candles", "coverage", "interval_coverage", "provider_symbols", "app_settings", "data_migrations"] as const;
function assertInstrumentIdentity(instruments: readonly Row[], instrument: StoredInstrument): void {
  validateInstrument(instrument);
  const previous = instruments.find(row => row.id === instrument.id);
  if (previous && (["symbol", "market", "currency"] as const).some(key => previous[key] !== instrument[key]))
    throw tradeDomainError("Instrument identity conflict");
}
function protectedEvidenceFromRows(rows: readonly Row[], current: readonly TradeExecution[]): Map<string, StoredExecutionEvidence> {
  const result = new Map<string, StoredExecutionEvidence>();
  for (const row of rows) {
    if (typeof row.evidence_json !== "string")
      continue;
    const evidence = asRecord(parseJson<unknown>(row.evidence_json, "execution evidence"), "execution evidence");
    if (evidence.accountCorrection === undefined)
      continue;
    const accountCorrection = validateAccountCorrection(evidence.accountCorrection);
    if (accountCorrection.canonicalAccountId !== current.find(e => e.id === row.id)?.accountId)
      throw tradeDomainError("Invalid stored account correction");
    result.set(String(row.id), { ...evidence, accountCorrection });
  }
  return result;
}
function prepareIncoming(current: TradeExecution[], incoming: readonly TradeExecution[], currentEvidence: Map<string, StoredExecutionEvidence>, instruments: Row[]) {
  incoming.forEach(execution => validateExecution(execution));
  const currentById = new Map(current.map((execution) => [execution.id, execution]));
  const correctedExecutions = current.filter(execution => currentEvidence.has(execution.id));
  const preservedEvidence = new Map<string, StoredExecutionEvidence>();
  const preparedIncoming = incoming.map((execution) => {
    const evidence = preservedEvidence.get(execution.id);
    if (evidence) {
      return {
        ...execution,
        accountId: evidence.accountCorrection.canonicalAccountId,
      };
    }
    const existing = currentById.get(execution.id);
    const existingEvidence = existing ? currentEvidence.get(existing.id) : undefined;
    if (existing && existingEvidence) {
      if (canCarryAccountCorrection(existing, execution, existingEvidence.accountCorrection)) {
        preservedEvidence.set(execution.id, existingEvidence);
        return {
          ...execution,
          accountId: existingEvidence.accountCorrection.canonicalAccountId,
        };
      }
      if (execution.accountId === existingEvidence.accountCorrection.canonicalAccountId) {
        throw tradeDomainError("Account correction identity conflict");
      }
      throw tradeDomainError("Account correction replacement identity conflict");
    }
    // Preserve only an already audited correction, never infer a new account merge.
    const correctionCandidates = correctedExecutions.filter(candidate => {
      const evidence = currentEvidence.get(candidate.id);
      return evidence
        && (execution.accountId === evidence.accountCorrection.originalAccountId
          || execution.accountId === evidence.accountCorrection.canonicalAccountId)
        && executionCorrectionIdentity(candidate) === executionCorrectionIdentity(execution);
    });
    if (correctionCandidates.length) {
      const trusted = correctionCandidates.filter(candidate => canCarryAccountCorrection(candidate, execution, currentEvidence.get(candidate.id)!.accountCorrection));
      if (trusted.length !== 1)
        throw tradeDomainError("Account correction replacement identity conflict");
      const evidence = currentEvidence.get(trusted[0].id)!;
      preservedEvidence.set(execution.id, evidence);
      return { ...execution, accountId: evidence.accountCorrection.canonicalAccountId };
    }
    return execution;
  });
  // A duplicate or conflict can skip writeExecution, but cannot bypass identity protection.
  preparedIncoming.forEach(execution => assertInstrumentIdentity(instruments, execution.instrument));
  const simulationContexts = new Map<string, string>();
  for (const execution of [...current, ...preparedIncoming]) {
    if (execution.source.platform !== "tradingview")
      continue;
    const fingerprint = execution.source.fileFingerprint;
    if (!fingerprint) {
      if (execution.source.tradingNature === "simulated")
        throw tradeDomainError("Invalid simulation fingerprint");
      continue;
    }
    const previous = simulationContexts.get(fingerprint);
    if (previous && previous !== execution.instrument.id)
      throw tradeDomainError("Simulation context conflict");
    simulationContexts.set(fingerprint, execution.instrument.id);
  }
  const reconciliation = reconcileExecutions(current, preparedIncoming);
  // Audited account correction follows only the same trusted old provenance.
  for (const id of reconciliation.automaticReplacementIds) {
    const existing = currentById.get(id), evidence = currentEvidence.get(id);
    if (!existing || !evidence)
      continue;
    const matches = reconciliation.acceptedIncoming.filter(candidate => canCarryAccountCorrection(existing, candidate, evidence.accountCorrection));
    if (matches.length !== 1 || (preservedEvidence.has(matches[0].id) && preservedEvidence.get(matches[0].id) !== evidence))
      throw tradeDomainError("Account correction replacement identity conflict");
    preservedEvidence.set(matches[0].id, evidence);
  }
  return { reconciliation, preservedEvidence: [...preservedEvidence.entries()] };
}
function isUnknownFeePlaceholder(execution: TradeExecution | null): boolean {
  return execution?.fee === "" && execution.source?.feeStatus === "unknown";
}

function validateRevision(value: unknown): TradeRevisionRequest {
  const input = value as TradeRevisionRequest;
  if (!input || typeof input !== "object" || typeof input.id !== "string" || !input.id || input.id.length > 200 || typeof input.instrumentId !== "string" || !input.instrumentId || typeof input.accountId !== "string" || !input.accountId || typeof input.reason !== "string" || !input.reason.trim() || input.reason.length > 2000 || !Array.isArray(input.changes) || input.changes.length === 0 || input.changes.length > 500)
    throw tradeInputError("Invalid trade revision");
  json(input, "trade revision");
  if (Object.prototype.hasOwnProperty.call(input, "recordedAt"))
    throw tradeInputError("Invalid trade revision audit field");
  if (input.expectedScope !== undefined) {
    if (!Array.isArray(input.expectedScope))
      throw tradeInputError("Invalid scope snapshot");
    for (const value of input.expectedScope) {
      // A scope is historical comparison evidence, not a new fact. Check its
      // shape before projection without revalidating amounts, dates or scope.
      const record = asRecord(value, "scope snapshot");
      assertStringFields(record, ["id", "accountId", "accountLabel", "executedAt", "quantity", "price", "fee"], "scope snapshot");
      if (record.side !== "buy" && record.side !== "sell")
        throw tradeInputError("Invalid scope snapshot");
      const instrument = asRecord(record.instrument, "scope instrument");
      assertStringFields(instrument, ["id", "symbol", "name", "market", "currency"], "scope instrument");
      const source = asRecord(record.source, "scope source");
      if (typeof source.platform !== "string" || typeof source.row !== "number")
        throw tradeInputError("Invalid scope source");
    }
  }
  if (input.importHistory) {
    validateImportHistory(input.importHistory);
    if (input.importHistory.instrumentCount !== 1 || !input.expectedScope)
      throw tradeInputError("Invalid supplement batch");
  }
  const ids = new Set<string>();
  for (const change of input.changes) {
    if (!change || typeof change !== "object" || !("before" in change) || !("after" in change) || (!change.before && !change.after))
      throw tradeInputError("Invalid trade change");
    for (const record of [change.before, change.after]) {
      if (record === null)
        continue;
      // Caller placeholders are only structurally admitted here. The stored
      // baseline and raw fee must qualify before a plan can inherit them.
      const allowUnknownFee = isUnknownFeePlaceholder(change.before)
        && (record === change.before || isUnknownFeePlaceholder(change.after));
      validateExecution(record, { allowUnknownFee });
      if (record.instrument.id !== input.instrumentId || record.accountId !== input.accountId)
        throw tradeInputError("Invalid trade scope");
    }
    const id = (change.before ?? change.after)!.id;
    if (ids.has(id) || (change.before && change.after && change.before.id !== change.after.id))
      throw tradeInputError("Invalid trade identity");
    ids.add(id);
  }
  return input;
}
function validateRevisionBaseline(input: TradeRevisionRequest, current: Map<string, TradeExecution>, active: TradeExecution[], instruments: StoredInstrument[], revisions: TradeRevision[]) {
  const instrument = instruments.find(instrument => instrument.id === input.instrumentId);
  if (!instrument)
    throw tradeDomainError("Invalid trade instrument");
  for (const change of input.changes) {
    if (change.after && (["symbol", "market", "currency"] as const).some(key => change.after!.instrument[key] !== instrument[key]))
      throw tradeDomainError("Invalid trade instrument");
  }
  if (input.expectedScope !== undefined) {
    if (!Array.isArray(input.expectedScope))
      throw tradeDomainError("Invalid scope snapshot");
    const actual = active.filter(e => e.instrument.id === input.instrumentId && e.accountId === input.accountId);
    const ordered = (records: TradeExecution[]) => records.slice().sort((a, b) => a.id.localeCompare(b.id));
    if (canonicalRecord(ordered(actual).map(withoutLocalizedInstrumentName)) !== canonicalRecord(ordered(input.expectedScope).map(withoutLocalizedInstrumentName)))
      throw new TradeChangeError("REVISION_CONFLICT", "prepare", "Trade revision conflict", randomUUID());
  }
  if (![...current.values()].some((execution) => execution.instrument.id === input.instrumentId && execution.accountId === input.accountId) && !revisions.some((revision) => revision.instrumentId === input.instrumentId && revision.accountId === input.accountId))
    throw tradeDomainError("Invalid trade account");
  for (const change of input.changes) {
    const id = (change.before ?? change.after)!.id;
    const original = current.get(id);
    if (change.before ? !original || canonicalRecord(withoutLocalizedInstrumentName(original)) !== canonicalRecord(withoutLocalizedInstrumentName(change.before)) : Boolean(original))
      throw new TradeChangeError("REVISION_CONFLICT", "prepare", "Trade revision conflict", randomUUID());
  }
}

export class SqliteStore {
  constructor(private readonly database: DatabaseSync) {}

  getStatus(): SqliteStatus {
    const counts: Record<string, number> = {};
    for (const table of ["instruments", "executions", "import_batches", "reviews", "tag_suggestions", "market_data_jobs", "daily_candles", "market_candles"]) {
      counts[table] = Number((this.database.prepare(`select count(*) as count from ${table}`).get() as Row).count);
    }
    counts.executions = Number((this.database.prepare("select count(*) as count from executions e where not exists(select 1 from execution_fact_states s where s.execution_id=e.id and s.state='withdrawn')").get() as Row).count);
    return { schemaVersion: SQLITE_MIGRATIONS.at(-1)?.version ?? 0, migration: this.getLatestMigration(), counts };
  }

  getBootstrap(options?: { onImportHistoryProjectionGap?: (importHistoryId: string) => void }): StorageBootstrap {
    return {
      schemaVersion: SQLITE_MIGRATIONS.at(-1)?.version ?? 0,
      migration: this.getLatestMigration(),
      executions: this.getExecutions(),
      importHistory: this.getImportHistory(options?.onImportHistoryProjectionGap),
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
      .prepare("select id, symbol, name, market, currency, metadata_json, localized_name_json from instruments order by id")
      .all() as Row[];
    return rows.map(mapInstrumentRow);
  }

  getInstrumentMetadata(instrumentIds: readonly string[]): StoredInstrument[] {
    const uniqueIds = [...new Set(instrumentIds)];
    if (uniqueIds.length === 0) return [];
    const placeholders = uniqueIds.map(() => "?").join(", ");
    const rows = this.database
      .prepare(`select id, symbol, name, market, currency, metadata_json, localized_name_json from instruments where id in (${placeholders}) order by id`)
      .all(...uniqueIds) as Row[];
    return rows.map(mapInstrumentRow);
  }

  putInstrumentMetadata(record: ResolvedInstrument): void {
    const normalized = validateResolvedInstrument(record, {
      market: record.market,
      symbol: record.symbol,
    });
    const instrumentId = canonicalInstrumentId(normalized.symbol, normalized.market);
    withSqliteTransaction(this.database, () => {
      const existingRow = this.database
        .prepare("select id, symbol, name, market, currency, metadata_json, localized_name_json from instruments where id = ?")
        .get(instrumentId) as Row | undefined;
      const existing = existingRow ? mapInstrumentRow(existingRow) : undefined;
      const existingMetadata = storedMetadata(existing?.metadata);
      const newestMetadata = newestByResolvedAt([existingMetadata, normalized]) ?? normalized;
      const effectiveLocalizedName =
        newestByResolvedAt<LocalizedInstrumentName>([
          storedLocalizedName(existing?.localizedName),
          storedLocalizedName(existingMetadata?.localizedName),
          normalized.localizedName,
        ]);
      this.putInstrument({
        ...existing,
        id: instrumentId,
        market: normalized.market,
        symbol: normalized.symbol,
        name: existing?.name ?? normalized.name,
        currency: existing?.currency ?? marketCurrency(normalized.market),
        ...(effectiveLocalizedName ? { localizedName: effectiveLocalizedName } : {}),
        metadata: {
          ...mergeInstrumentExchange(normalized, mergeInstrumentExchange(existingMetadata, newestMetadata)),
          ...(effectiveLocalizedName ? { localizedName: effectiveLocalizedName } : {}),
        },
      });
    });
  }

  getExecutions(): TradeExecution[] {
    const rows = this.database.prepare("select e.*, i.symbol, i.name, i.market, i.currency, i.metadata_json, i.localized_name_json from executions e join instruments i on i.id = e.instrument_id where not exists(select 1 from execution_fact_states s where s.execution_id=e.id and s.state='withdrawn')").all() as Row[];
    return rows.map(mapExecutionRow).sort(compareExecutions);
  }

  getImportHistory(onProjectionGap?: (importHistoryId: string) => void): ImportHistoryEntry[] {
    const rows = this.database.prepare(`
      select b.id, b.reconciliation_json, r.request_json as revision_request_json
      from import_batches b
      left join trade_revisions r on r.id = b.id
      order by b.imported_at desc, b.id
    `).all() as Row[];
    const entries = rows.map(row => {
      const { committedDuplicateTradeCount: _untrusted, ...entry } = parseJson<ImportHistoryEntry>(row.reconciliation_json, "import history");
      return entry;
    });
    return entries.map((entry, index) => {
      const row = rows[index];
      const projected = projectImportHistoryMonthly(entry, row.revision_request_json);
      // Observe the existing authority's result; do not repeat its provenance rules.
      if (entry.monthly !== undefined && projected.monthly === undefined) {
        onProjectionGap?.(asString(row.id, "import history id"));
      }
      return projected;
    });
  }

  /** Expensive formal evidence verification is confined to one requested batch. */
  getImportHistoryCommit(batchId: string): Partial<ImportHistoryEntry> | undefined {
    const row = this.database.prepare("select reconciliation_json from import_batches where id = ?").get(batchId);
    if (!row) return undefined;
    let entry: ImportHistoryEntry;
    try {
      const raw: unknown = parseJson(row.reconciliation_json, "import history");
      if (!isLegacyImportHistoryEntry(raw)) return {};
      entry = raw;
    } catch { return {}; } // Retain unsupported original evidence; its actual count is unknown.
    if (entry.id !== batchId) {
      const { committedDuplicateTradeCount: _untrusted, ...unknown } = entry;
      return unknown;
    }
    ensureImportHistoryAudit(this.database);
    return readImportHistoryCommits(this.database, [entry])[0];
  }

  private getLegacyReviews(): EpisodeReviewRecord[] {
    return (this.database.prepare("select review_json from reviews where review_json is not null order by episode_id").all() as Row[])
      .map((row) => parseJson<EpisodeReviewRecord>(row.review_json, "review"));
  }

  private getLegacyReview(episodeId: string): EpisodeReviewRecord | undefined {
    const row = this.database.prepare("select review_json from reviews where episode_id = ?").get(episodeId) as Row | undefined;
    return row?.review_json ? parseJson<EpisodeReviewRecord>(row.review_json, "review") : undefined;
  }

  private getFormalRecallCompletions(): RecallCompletionProjection[] {
    const rows = this.database
      .prepare("select episode_id, finalized_json from recall_documents where finalized_json is not null order by episode_id")
      .all() as Row[];
    return rows.flatMap((row) => {
      const finalized = parseJson<Record<string, unknown>>(row.finalized_json, "finalized recall document");
      if (finalized.status !== "completed" || typeof finalized.completedAt !== "string") return [];
      return [{
        episodeId: asString(row.episode_id, "recall episode id"),
        updatedAt:
          typeof finalized.updatedAt === "string"
            ? finalized.updatedAt
            : finalized.completedAt,
      }];
    });
  }

  getReviews(): EpisodeReviewRecord[] {
    const legacy = this.getLegacyReviews();
    const completions = this.getFormalRecallCompletions();
    if (completions.length === 0) return legacy;
    const instrumentIdsByEpisode = new Map(
      buildTradeEpisodes(this.getExecutions()).map((episode) => [episode.id, episode.instrument.id] as const),
    );
    return bridgeRecallCompletions(legacy, completions, instrumentIdsByEpisode);
  }

  getReview(episodeId: string): EpisodeReviewRecord | undefined {
    return this.getReviews().find((record) => record.episodeId === episodeId);
  }
  getReviewStates(): EpisodeReviewState[] {
    const rows = this.database
      .prepare("select episode_id, cursor_json, drawings_json from reviews where cursor_json is not null order by episode_id")
      .all() as Row[];
    return rows.map(mapReviewStateRow);
  }
  getTagSuggestions(): TagSuggestionRecord[] { return (this.database.prepare("select evidence_json from tag_suggestions order by id").all() as Row[]).map((row) => parseJson<TagSuggestionRecord>(row.evidence_json, "tag suggestion")); }
  getMarketDataJobs(): MarketDataJob[] { return (this.database.prepare("select progress_json from market_data_jobs order by id").all() as Row[]).map((row) => parseJson<MarketDataJob>(row.progress_json, "market data job")); }
  getSettings(): Record<string, unknown> { return Object.fromEntries((this.database.prepare("select key, value_json from app_settings order by key").all() as Row[]).map((row) => [asString(row.key, "setting key"), parseJson(row.value_json, "setting value")])); }
  getReviewSummary(
    scopeId: string,
    rangeId: string,
  ): ReviewSummaryNote | undefined {
    const key = reviewSummarySettingKey(scopeId, rangeId);
    const row = this.database
      .prepare("select value_json from app_settings where key = ?")
      .get(key) as Row | undefined;
    if (!row) return undefined;
    const value = parseJson<unknown>(row.value_json, "review summary");
    if (!isReviewSummaryNote(value)) throw new Error("Invalid review summary");
    return value;
  }
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

  getCandles(instrumentId: string, interval: NativeMarketInterval, start: string, end: string): MarketCandleRecord[] {
    const generic = this.getMarketCandles(instrumentId, interval, start, end);
    if (interval !== "1D") return generic;
    const byTimestamp = new Map(generic.map((candle) => [candle.timestamp, candle]));
    for (const candle of this.getDailyCandles(instrumentId, start.slice(0, 10), end.slice(0, 10))) {
      const timestamp = `${candle.tradingDate}T00:00:00.000Z`;
      if (timestamp >= start && timestamp <= end && !byTimestamp.has(timestamp)) byTimestamp.set(timestamp, { ...candle, interval: "1D", timestamp });
    }
    return [...byTimestamp.values()].sort((left, right) => left.timestamp.localeCompare(right.timestamp));
  }

  getIntervalCoverage(instrumentId?: string, interval?: NativeMarketInterval): NormalizedIntervalCoverageRecord[] {
    const clauses = [
      instrumentId !== undefined ? "instrument_id = ?" : "",
      interval !== undefined ? "interval = ?" : "",
    ].filter(Boolean);
    const values = [instrumentId, interval].filter((value): value is string => value !== undefined);
    const where = clauses.length ? ` where ${clauses.join(" and ")}` : "";
    const rows = this.database
      .prepare(`select * from interval_coverage${where} order by instrument_id, interval`)
      .all(...values) as Row[];
    return rows.flatMap(mapIntervalCoverageRow);
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
    return this.commitCompatibility({ kind: "import", candidates: [...incoming] }).result.report;
  }
  mergeTradeData(input: {
    instruments?: StoredInstrument[];
    executions: TradeExecution[];
    importHistory?: ImportHistoryEntry[];
    replaceExecutionIds?: string[];
  }): ExecutionMergeReport {
    if (input?.replaceExecutionIds?.length)
      throw new TradeChangeError("VERSION_REQUIRED", "compatibility", "Execution replacement requires a reviewed versioned plan", randomUUID(), input.replaceExecutionIds);
    return this.commitCompatibility({
      kind: "import",
      candidates: input?.executions,
      instruments: input?.instruments ?? [],
      importHistory: input?.importHistory ?? []
    }).result.report;
  }
  private commitCompatibility(intent: TradeChangeIntent): CommitReceipt {
    const changes = this.tradeChanges();
    const plan = changes.prepare(intent);
    // Legacy append preserves the old 'conflict counted and skipped' behavior.
    return changes.commit({
      requestId: randomUUID(),
      planId: plan.planId,
      choices: {
        conflicts: plan.conflicts.map(c => ({ conflictId: c.id, decision: "keep-existing" })),
        missingExecutions: plan.missingExecutions.map(c => ({ executionId: c.executionId, action: "keep" })),
        reactivateExecutions: plan.reactivateExecutionIds.map(executionId => ({ executionId, action: "keep-withdrawn" }))
      }
    });
  }
  putInstrumentName(input: {
    instrumentId: string;
    name: string;
  }): void {
    if (!input || Object.keys(input).some(k => !["instrumentId", "name"].includes(k)) || typeof input.instrumentId !== "string" || !input.instrumentId.trim() || typeof input.name !== "string" || !input.name.trim() || input.name.trim().length > 200 || /[\u0000-\u001f\u007f]/.test(input.name))
      throw new TradeChangeError("INVALID_INSTRUMENT_NAME", "name", "Expected an existing instrument and a legal name", randomUUID());
    try {
      withSqliteTransaction(this.database, () => {
        const result = this.database.prepare("update instruments set name=?,updated_at=current_timestamp where id=?").run(input.name.trim(), input.instrumentId);
        if (!result.changes)
          throw new TradeChangeError("INSTRUMENT_NOT_FOUND", "name", "Instrument does not exist", randomUUID(), [input.instrumentId]);
      });
    }
    catch (error) {
      if (error instanceof TradeChangeError)
        throw error;
      throw new TradeChangeError("INSTRUMENT_NAME_SAVE_FAILED", "name", error instanceof Error ? error.message : "Instrument name could not be saved", randomUUID(), [input.instrumentId]);
    }
  }
  getTradeRevisions(instrumentId: string): TradeRevision[] {
    return (this.database.prepare("select revision_json from trade_revisions where instrument_id = ? and scope_account_unknown=0 and json_extract(revision_json,'$.kind') is not 'fact-state-audit-v1' order by recorded_at desc, rowid desc").all(instrumentId) as Row[]).map((row) => parseJson<TradeRevision>(row.revision_json, "trade revision"));
  }
  getFactStateAudits(executionId: string): FactStateAudit[] {
    return (this.database.prepare(`
   select revision_json from trade_revisions
   where json_extract(revision_json, '$.kind') = 'fact-state-audit-v1'
    and json_extract(revision_json, '$.executionId') = ?
   order by recorded_at, rowid
  `).all(executionId) as Row[]).map(row => parseJson<FactStateAudit>(row.revision_json, "fact state audit"));
  }
  reviseTrades(value: unknown): TradeRevisionResult {
    const input = validateRevision(value), requestJson = canonicalRecord(revisionComparableRequest(input));
    const existing = this.database.prepare("select request_json,revision_json,instrument_id,account_id,recorded_at,scope_account_unknown from trade_revisions where id=?").get(input.id) as Row | undefined;
    if (existing) {
      if (existing.request_json !== requestJson && !matchesLegacyRevisionRequest(existing, input, requestJson))
        throw new TradeChangeError("REVISION_CONFLICT", "compatibility", "Trade revision conflict", randomUUID());
      return { executions: this.getExecutions(), revision: parseJson<TradeRevision>(existing.revision_json, "revision") };
    }
    const receipt = this.commitCompatibility({ kind: "revision", revision: input });
    return { executions: this.getExecutions(), revision: receipt.result.revision! };
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
    if (input.suggestion.episodeId !== input.review.episodeId || input.suggestion.instrumentId !== input.review.instrumentId) throw new Error("Invalid suggestion decision");
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
    if (!result || typeof result.instrumentId !== "string" || !Array.isArray(result.candles) || !Array.isArray(result.coverage) || (result.providerSymbol !== undefined && (typeof result.providerSymbol.provider !== "string" || typeof result.providerSymbol.symbol !== "string"))) throw new Error("Invalid market data");
    result.candles.forEach((candle) => { validateDailyCandle(candle); if (candle.instrumentId !== result.instrumentId) throw new Error("Invalid market data"); });
    result.coverage.forEach((segment) => { if (!segment || typeof segment.startDate !== "string" || typeof segment.endDate !== "string" || !COVERAGE_STATUSES.has(segment.status) || !Array.isArray(segment.missingTradingDates) || segment.missingTradingDates.some((date) => typeof date !== "string")) throw new Error("Invalid coverage"); });
    withSqliteTransaction(this.database, () => {
      result.candles.forEach((candle) => this.putDailyCandle(candle));
      this.putCoverageSegments(result.instrumentId, result.coverage);
      if (result.providerSymbol) this.putProviderSymbol({ instrumentId: result.instrumentId, provider: result.providerSymbol.provider, providerSymbol: result.providerSymbol.symbol }, { skipConflictingAlias: true });
    });
  }

  commitIntervalMarketData(result: IntervalMarketDataCommitInput): void {
    if (!result || typeof result.instrumentId !== "string" || !["15m", "1h", "1D"].includes(result.interval) || !Array.isArray(result.candles) || !Array.isArray(result.coverage)) throw new Error("Invalid market data");
    result.candles.forEach((candle) => { validateMarketCandle(candle); if (candle.instrumentId !== result.instrumentId || candle.interval !== result.interval) throw new Error("Invalid market data"); }); result.coverage.forEach((coverage) => { if (coverage.interval !== result.interval) throw new Error("Invalid market data"); validateIntervalCoverage({ ...coverage, instrumentId: result.instrumentId }); });
    withSqliteTransaction(this.database, () => { result.candles.forEach((candle) => this.putMarketCandle(candle)); this.putIntervalCoverageSegments(result.instrumentId, result.interval, result.coverage); if (result.providerSymbol) this.putProviderSymbol({ instrumentId: result.instrumentId, provider: result.providerSymbol.provider, providerSymbol: result.providerSymbol.symbol }, { skipConflictingAlias: true }); });
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

  putReviewSummary(record: ReviewSummaryNote): boolean {
    if (!isReviewSummaryNote(record)) throw new Error("Invalid review summary");
    const current = this.getReviewSummary(record.scopeId, record.rangeId);
    if (
      current &&
      Date.parse(current.updatedAt) > Date.parse(record.updatedAt)
    ) {
      return false;
    }
    this.putSetting(
      reviewSummarySettingKey(record.scopeId, record.rangeId),
      record,
    );
    return true;
  }

  putMarketDataJob(job: MarketDataJob): void {
    validateJob(job);
    withSqliteTransaction(this.database, () => this.putMarketDataJobRecord(job));
  }

  mergeBrowserState(payload: BrowserStatePayload): MigrationReport {
    validateBrowserState(payload);
    const existing = this.database.prepare("select * from data_migrations where source_fingerprint=?").get(payload.sourceFingerprint) as Row | undefined;
    if (existing) {
      const prior = migrationReport(existing);
      return { ...prior, inserted: 0, duplicate: prior.inserted + prior.duplicate };
    }
    const changes = this.tradeChanges();
    const plan = changes.prepare({ kind: "browser-migration", payload });
    return changes.commit({
      requestId: `browser:${payload.sourceFingerprint}`,
      planId: plan.planId,
      choices: {
        conflicts: plan.conflicts.map(c => ({ conflictId: c.id, decision: "keep-existing" })),
        missingExecutions: plan.missingExecutions.map(c => ({ executionId: c.executionId, action: "keep" })),
        reactivateExecutions: plan.reactivateExecutionIds.map(executionId => ({ executionId, action: "keep-withdrawn" }))
      }
    }).result.migration!;
  }
  private applyBrowserAncillary(payload: BrowserStatePayload, counts: MigrationCounts): MigrationReport {
    for (const review of payload.reviews) {
      const before = this.getLegacyReview(review.episodeId);
      if (before && Date.parse(before.updatedAt) > Date.parse(review.updatedAt)) {
        counts.conflict += 1;
      }
      else {
        classifyMigrationRecord(counts, before, review);
        this.putReviewInTransaction(review);
      }
    }
    for (const state of payload.reviewStates) {
      classifyMigrationRecord(counts, this.getReviewStates().find((item) => item.episodeId === state.episodeId), state);
      this.putReviewStateInTransaction(state);
    }
    for (const suggestion of payload.tagSuggestions) {
      classifyMigrationRecord(counts, this.getTagSuggestions().find((item) => item.id === suggestion.id), suggestion);
      this.putTagSuggestionInTransaction(suggestion);
    }
    for (const job of payload.marketDataJobs) {
      classifyMigrationRecord(counts, this.getMarketDataJobs().find((item) => item.instrumentId === job.instrumentId), job);
      this.putMarketDataJobRecord(job);
    }
    for (const candle of payload.dailyCandles) {
      classifyMigrationRecord(counts, this.getDailyCandles(candle.instrumentId).find((item) => item.tradingDate === candle.tradingDate
        && item.adjustmentMode === candle.adjustmentMode), candle);
      this.putDailyCandle(candle);
    }
    for (const candle of payload.marketCandles) {
      classifyMigrationRecord(counts, this.getMarketCandles(candle.instrumentId, candle.interval).find((item) => item.timestamp === candle.timestamp
        && item.adjustmentMode === candle.adjustmentMode), candle);
      this.putMarketCandle(candle);
    }
    for (const coverage of payload.coverage) {
      classifyMigrationRecord(counts, this.getCoverage().find((item) => item.instrumentId === coverage.instrumentId
        && item.adjustmentMode === coverage.adjustmentMode), coverage);
      this.putCoverage(coverage);
    }
    for (const rawCoverage of payload.intervalCoverage) {
      const coverage = normalizeIntervalCoverage(rawCoverage);
      classifyMigrationRecord(counts, this.getIntervalCoverage().find((item) => item.instrumentId === coverage.instrumentId
        && item.interval === coverage.interval
        && item.adjustmentMode === coverage.adjustmentMode), coverage);
      this.putIntervalCoverage(coverage);
    }
    for (const providerSymbol of payload.providerSymbols) {
      classifyMigrationRecord(counts, this.getProviderSymbols().find((item) => item.instrumentId === providerSymbol.instrumentId
        && item.provider === providerSymbol.provider), providerSymbol);
      this.putProviderSymbol(providerSymbol);
    }
    for (const [key, value] of Object.entries(payload.settings)) {
      classifyMigrationRecord(counts, this.getSettings()[key], value);
      this.putSetting(key, value);
    }
    const validationDigest = createHash("sha256").update(json(payload, "browser state")).digest("hex");
    const result: MigrationReport = { sourceFingerprint: payload.sourceFingerprint, ...counts, failed: 0, validationDigest };
    this.database.prepare("insert into data_migrations(source_fingerprint,source_client_id,version,status,counts_json,validation_digest,completed_at) values(?,?,?,'complete',?,?,current_timestamp)").run(payload.sourceFingerprint, payload.sourceClientId, payload.version, json(result, "migration counts"), validationDigest);
    return result;
  }
  private copyTradeRows(browser: boolean): TradeSnapshot {
    return {
      facts: this.database.prepare("select e.*, e.currency as fact_currency, i.symbol,i.name,i.market,i.currency,i.metadata_json,i.localized_name_json from executions e join instruments i on i.id=e.instrument_id order by e.id").all() as Row[],
      instruments: this.database.prepare("select * from instruments order by id").all() as Row[],
      audits: this.database.prepare("select * from trade_revisions order by id").all() as Row[],
      states: this.database.prepare("select * from execution_fact_states order by execution_id").all() as Row[],
      source: copySourceMaterialRows(this.database),
      ancillary: browser ? this.copyBrowserDependencies() : {},
      tvProof: copyTradingViewMigrationRows(this.database),
      importedFiles: this.importedFiles(),
    };
  }
  private importedFiles(): FileContentIdentity[] {
    return this.database.prepare("select json_extract(receipt_json, '$.result.importedFile') as identity from trade_change_receipts where json_type(receipt_json, '$.result.importedFile') = 'object'").all().flatMap(row => {
      const identity: unknown = JSON.parse(String(row.identity));
      return validFileContentIdentity(identity) ? [identity] : [];
    });
  }
  private assertFileNotImported(intent: InternalIntent, importedFiles: FileContentIdentity[], phase: "prepare" | "commit") {
    if (intent.kind === "import" && intent.fileImport && importedFiles.some(identity => identity.sha256 === intent.fileImport!.sha256 && identity.byteLength === intent.fileImport!.byteLength))
      throw new TradeChangeError("FILE_ALREADY_IMPORTED", phase, "This file was successfully imported.", randomUUID());
  }
  private importHasPendingRows(intent: InternalIntent) {
    if (intent.kind !== "import") return false;
    const reports = [...(intent.importHistory ?? []), ...(intent.materials ?? []).flatMap(material => material.historyProjection ? [material.historyProjection.reconciliation] : [])];
    const evidence = intent.fileImport?.evidence;
    const monthly = [...reports.map(report => report.monthly), ...(intent.materials ?? []).map(material => material.content.monthly)];
    if (intent.fileImport?.complete === false || evidence && completionHasPendingEvidence(evidence)
      || monthly.some(value => isMonthlyStatement(value) && monthlyHasPendingEvidence(value))) return true;
    if (evidence && (intent.candidates.some(candidate => candidate.source.platform !== evidence.broker)
      || new Set(intent.candidates.map(candidate => candidate.source.fileFingerprint)).size > 1)) return true;
    const excludedRecords = evidence?.exclusions.reduce((total, item) => total + item.count, 0) ?? 0;
    const excludedGroups = new Set(evidence?.exclusions.filter(item => item.count > 0).map(item => `${item.category}:${item.label.trim()}`)).size;
    return reports.some(report => typeof report.unresolvedInstrumentCount === "number" && report.unresolvedInstrumentCount > 0
      || [report.excludedInstrumentCount, report.excludedRecordCount].some(count => typeof count === "number" && count > 0)
        && (!evidence || report.excludedRecordCount !== excludedRecords || report.excludedInstrumentCount !== excludedGroups)
      || evidence && (report.excludedRecordCount !== undefined && report.excludedRecordCount !== excludedRecords
        || report.excludedInstrumentCount !== undefined && report.excludedInstrumentCount !== excludedGroups));
  }
  /** A legacy hash is only corroboration for the all-duplicate reconciliation,
   * never proof of byte identity or of a previous complete file import. */
  private assertLegacyFileTradesExist(intent: InternalIntent, reconciliation: ExecutionReconciliation, withdrawnIds: string[], hasMaterialRevision: boolean, phase: "prepare" | "commit") {
    if (intent.kind !== "import" || this.importHasPendingRows(intent)
      || hasMaterialRevision || !intent.candidates.length
      || reconciliation.acceptedIncoming.length || reconciliation.automaticReplacementIds.length || reconciliation.conflicts.length
      || reconciliation.duplicates.length !== intent.candidates.length
      || new Set(reconciliation.duplicates.map(pair => pair.kept.id)).size !== intent.candidates.length
      || intent.candidates.some(candidate => withdrawnIds.includes(candidate.id))) return;
    const statementFingerprint = (execution: TradeExecution) => {
      const source = execution.source;
      if (!["futu", "tiger", "china-merchants"].includes(source.platform) || typeof source.fileFingerprint !== "string" || !/^[a-f0-9]{16}$/.test(source.fileFingerprint)) return null;
      const rule = source.formatRuleId;
      return typeof rule === "string" && (rule === "futu/xlsx/trades-v1" || /^futu\/pdf\/(?:f[0-4][a-z]?(?:-[a-z-]+)?(?:@\d+)?|monthly-v1)$/.test(rule) || rule === "tiger/pdf/monthly-v1" || rule === "china-merchants/pdf/monthly-v1")
        ? `${source.platform}:${source.fileFingerprint}` : null;
    };
    const identities = intent.candidates.map(statementFingerprint);
    if (identities.some(identity => identity === null) || new Set(identities).size !== 1) return;
    if (reconciliation.duplicates.every(pair => statementFingerprint(pair.kept) === identities[0] && statementFingerprint(pair.skipped) === identities[0] && !withdrawnIds.includes(pair.kept.id)))
      throw new TradeChangeError("FILE_TRADES_ALREADY_EXIST", phase, "All candidate trades already exist; legacy evidence does not prove complete file identity.", randomUUID());
  }
  private copyBrowserDependencies(): Record<string, Row[]> {
    return Object.fromEntries(BROWSER_DEPENDENCY_TABLES.map(table => [table, this.database.prepare(`select * from ${table} order by rowid`).all() as Row[]]));
  }
  private tradeChanges(options: TradeChangeOptions = {}, tvOptions: TradingViewAccountMigrationTransactionOptions = {}) {
    let browser = false, maintenance = false;
    const application = new TradingViewMigrationApplication(this.database);
    type EngineSnapshot = TradeSnapshot | TradingViewRawSnapshot;
    type EnginePrepared = PreparedTrade | { tradingView: PreparedTradingViewMaintenance };
    return createTradeChangeEngine(this.database, {
      validate: (intent: EngineIntent) => {
        maintenance = isTradingViewMaintenanceIntent(intent);
        if (isTradingViewMaintenanceIntent(intent)) return validateTradingViewMaintenanceIntent(intent);
        browser = intent.kind === "browser-migration";
        // Establish only the collection framing consumed by raw projection.
        // Material semantics remain exclusively in Task4's pure authority.
        if (intent.kind !== "browser-migration" && intent.materials !== undefined) {
          if (!Array.isArray(intent.materials)) throw tradeInputError("Invalid material collection");
          for (const value of intent.materials) {
            const material = asRecord(value, "material");
            if (!Array.isArray(material.observations)) throw tradeInputError("Invalid material observations");
            for (const value of material.observations) {
              const observation = asRecord(value, "material observation");
              if (!Array.isArray(observation.executionIds) || observation.executionIds.some(id => typeof id !== "string")) {
                throw tradeInputError("Invalid material execution links");
              }
            }
          }
        }
        if (browser) {
          validateBrowserState((intent as Extract<InternalIntent, {
            kind: "browser-migration";
          }>).payload);
          return (intent as Extract<InternalIntent, {
            kind: "browser-migration";
          }>).payload.executions.length;
        }
        if (intent.kind === "revision") {
          validateRevision(intent.revision);
          if (intent.reactivateExecutionIds !== undefined && (!Array.isArray(intent.reactivateExecutionIds) || intent.reactivateExecutionIds.some(id => typeof id !== "string") || new Set(intent.reactivateExecutionIds).size !== intent.reactivateExecutionIds.length))
            throw tradeInputError("Invalid activation review");
          return intent.revision.changes.length;
        }
        if (intent.kind === "import") {
          if (!Array.isArray(intent.candidates) || intent.instruments !== undefined && !Array.isArray(intent.instruments) || intent.importHistory !== undefined && !Array.isArray(intent.importHistory))
            throw tradeInputError("Invalid trade merge");
          if (intent.fileImport !== undefined && (!validFileContentIdentity(intent.fileImport) || typeof intent.fileImport.complete !== "boolean" || intent.fileImport.evidence !== undefined && !validImportCompletionEvidence(intent.fileImport.evidence))) throw tradeInputError("Invalid original file identity");
          intent.candidates.forEach(execution => validateExecution(execution));
          validateTVImportEvidence(intent);
          intent.instruments?.forEach(validateInstrument);
          intent.importHistory?.forEach(validateImportHistory);
          return intent.candidates.length;
        }
        if (intent.kind !== "material" || !Array.isArray(intent.materials) || (!intent.materials.length && !intent.reactivateExecutionIds?.length))
          throw tradeInputError("Invalid trade intent");
        if (intent.reactivateExecutionIds !== undefined && (!Array.isArray(intent.reactivateExecutionIds) || intent.reactivateExecutionIds.some(id => typeof id !== "string") || new Set(intent.reactivateExecutionIds).size !== intent.reactivateExecutionIds.length))
          throw tradeInputError("Invalid activation review");
        return 0;
      },
      copy: (): EngineSnapshot => maintenance ? copyTradingViewMigrationRows(this.database) : this.copyTradeRows(browser),
      prepare: (snapshot: EngineSnapshot, intent: EngineIntent, context?: VerifiedIdentityReviewParent<EnginePrepared>) => {
        if (isTradingViewMaintenanceIntent(intent)) {
          if (!("tables" in snapshot)) throw new Error("Invalid maintenance snapshot");
          const value=prepareTradingViewMaintenance(snapshot,intent,tvOptions);
          return {...value,body:{tradingView:value.body}};
        }
        if ("tables" in snapshot) throw new Error("Invalid trade snapshot");
        if (context && "tradingView" in context.identityReviewSource.prepared) throw tradeInputError("Maintenance plans cannot authorize an import identity selection");
        const parent = context ? { identityReviewSource: { ...context.identityReviewSource, prepared: context.identityReviewSource.prepared as PreparedTrade } } : undefined;
        return this.prepareTradeRows(snapshot,intent,parent);
      },
      apply: (body: EnginePrepared, choices: TradeChangeChoices, auditId: string, recordedAt: string, request: import("./sqlite-contracts").TradingViewMaintenanceRequest | undefined, review: ReviewPlan) => {
        if ("tradingView" in body) return application.apply(body.tradingView,request,recordedAt);
        if (request !== undefined) throw tradeInputError("Maintenance request is not valid for this plan");
        return this.applyTradeRows(body,choices,auditId,recordedAt,options.now?.() ?? Date.now(),review);
      },
      assertAfter: (body: EnginePrepared) => {if ("tradingView" in body) application.assertAfter(body.tradingView);},
      beforeReplay: (body: EnginePrepared) => {if ("tradingView" in body) application.beforeReplay();},
      assertReplay: (receipt: CommitReceipt) => application.assertReplay(receipt),
    }, options);
  }
  private assessTV(snapshot: TradeSnapshot, intent: InternalIntent, current: TradeExecution[], independent?: TVAssessment["bindings"], phase: "prepare" | "commit" = "prepare") {
    return assessTradingViewImport({ intent, current, source: snapshot.source, independent, phase,
      proof: (existing, incoming) => {
        const row=snapshot.facts.find(row=>row.id===existing.id);
        try {
          const evidence=JSON.parse(String(row?.evidence_json)) as {accountCorrection?:{operationId?:unknown}};
          const operationId=evidence?.accountCorrection?.operationId;
          if (typeof operationId!=="string") {
            const hasFormalHistory=(snapshot.tvProof.tables.tradingview_account_migration_rows??[]).some(ledger=>ledger.table_name==="executions" && ledger.primary_key===existing.id);
            return {kind:"unavailable",reason:hasFormalHistory?"formal-history-without-current-proof":"no-formal-operation"};
          }
          if (tradeNatureOf(existing)!=="simulation" || tradeNatureOf(incoming)!=="simulation" || typeof existing.source.simulationRunId!=="string") return {kind:"unavailable",reason:"formal-namespace-unavailable"};
          return proveTradingViewImportIdentity(snapshot.tvProof,{operationId,executionId:existing.id,observedAccountId:incoming.accountId,currentAccountId:existing.accountId,instrumentId:existing.instrument.id,rawSourceRun:existing.source.simulationRunId});
        } catch { return {kind:"unavailable",reason:"unparseable-formal-operation"}; }
      } });
  }
  private prepareTradeRows(snapshot: TradeSnapshot, intent: InternalIntent, parent?: VerifiedIdentityReviewParent<PreparedTrade>) {
    this.assertFileNotImported(intent, snapshot.importedFiles, "prepare");
    const projection = projectTradeRows(snapshot, intent);
    const { current, instruments, revisions, diagnostics } = projection;
    const withdrawnIds = snapshot.states.filter(s => s.state === "withdrawn").map(s => String(s.execution_id));
    const currentEvidence = projection.protectedEvidence, active = current.filter(e => !withdrawnIds.includes(e.id));
    let tvAssessment=this.assessTV(snapshot,intent,current), tvImport: PreparedTrade["tvImport"];
    if (parent) {
      const prior=parent.identityReviewSource, selection=intent.kind==="import"?intent.tradingViewImport?.identity:undefined;
      const required=[...new Set(prior.review.identityReviews?.flatMap(r=>r.incomingIds)??[])].sort();
      if (!tvAssessment || !prior.prepared.tvImport || !selection || canonicalOriginalImport(prior.prepared.intent)!==canonicalOriginalImport(intent)
        || canonicalRecord(selection.candidateIds.slice().sort())!==canonicalRecord(required)
        || canonicalRecord(tvAssessment.reviews)!==canonicalRecord(prior.review.identityReviews)
        || tvAssessment.digest!==prior.prepared.tvImport.assessment.digest) throw new TradeChangeError("IDENTITY_REVIEW_STALE","prepare","Original input or complete identity proof closure changed",randomUUID());
      tvAssessment=this.assessTV(snapshot,intent,current,makeIndependentBindings(tvAssessment.reviews,current));
      if (!tvAssessment) throw tradeInputError("Missing TradingView identity assessment");
      const material=prepareTVMaterial(intent,tvAssessment,snapshot.source);
      tvImport={assessment:tvAssessment,summary:material.summary,parent:{planId:prior.planId,bodyDigest:prior.bodyDigest,expiresAt:prior.review.expiresAt}};
    } else if (tvAssessment) tvImport={assessment:tvAssessment,summary:prepareTVMaterial(intent,tvAssessment,snapshot.source).summary};
    const proposedInstruments = intent.kind === "import" ? intent.instruments ?? [] : intent.kind === "browser-migration" ? intent.payload.instruments : [];
    const identities = [...snapshot.instruments];
    for (const instrument of proposedInstruments) {
      assertInstrumentIdentity(identities, instrument);
      if (!identities.some(i => i.id === instrument.id))
        identities.push(instrument);
    }
    let incoming: TradeExecution[] = [], reconciliation: ExecutionReconciliation = { acceptedIncoming: [], automaticReplacementIds: [], duplicates: [], conflicts: [] }, preservedEvidence: [
      string,
      StoredExecutionEvidence
    ][] = [];
    if (intent.kind === "revision") {
      if (snapshot.source.revisions.some(r => r.id === intent.revision.id))
        throw new TradeChangeError("REVISION_CONFLICT", "prepare", "Trade revision ID already exists", randomUUID(), [intent.revision.id]);
      validateRevisionBaseline(intent.revision, new Map(current.map(e => [e.id, e])), active, instruments, revisions);
      incoming = intent.revision.changes.flatMap(c => c.after ? [c.after] : []);
      const revisionEvidence = new Map(currentEvidence);
      // Moving to a new fact ID may carry an existing correction only under the
      // same trusted provenance rule used by import reconciliation.
      for (const change of intent.revision.changes) {
        if (!change.before || change.after)
          continue;
        const evidence = currentEvidence.get(change.before.id);
        if (!evidence)
          continue;
        const replacements = incoming.filter(candidate => canCarryAccountCorrection(change.before!, candidate, evidence.accountCorrection));
        if (replacements.length !== 1 || (revisionEvidence.has(replacements[0].id) && revisionEvidence.get(replacements[0].id) !== evidence))
          throw tradeDomainError("Account correction replacement identity conflict");
        revisionEvidence.set(replacements[0].id, evidence);
      }
      preservedEvidence = [...revisionEvidence.entries()];
      for (const id of intent.reactivateExecutionIds ?? [])
        if (!withdrawnIds.includes(id) || !incoming.some(e => e.id === id))
          throw new TradeChangeError("INVALID_ACTIVATION", "prepare", "Only a reviewed withdrawn fact may be activated", randomUUID(), [id]);
    }
    else if (intent.kind === "import" || intent.kind === "browser-migration") {
      incoming = intent.kind === "import" ? intent.candidates : intent.payload.executions;
      for (const e of incoming)
        if (snapshot.facts.some(row => row.id === e.id && row.account === null))
          throw new TradeChangeError("UNKNOWN_ACCOUNT_REQUIRES_REVIEW", "prepare", "Existing fact has an unknown account", randomUUID(), [e.id]);
      if (tvAssessment) {
        const residual=incoming.filter(e=>!isTradingViewExecution(e));
        const ordinary=residual.length ? prepareIncoming(current,residual,currentEvidence,identities) : {reconciliation:{acceptedIncoming:[],automaticReplacementIds:[],duplicates:[],conflicts:[]} as ExecutionReconciliation,preservedEvidence:[] as [string,StoredExecutionEvidence][]};
        reconciliation={acceptedIncoming:[...tvAssessment.reconciliation.acceptedIncoming,...ordinary.reconciliation.acceptedIncoming],automaticReplacementIds:[...tvAssessment.reconciliation.automaticReplacementIds,...ordinary.reconciliation.automaticReplacementIds],duplicates:[...tvAssessment.reconciliation.duplicates,...ordinary.reconciliation.duplicates],conflicts:[...tvAssessment.reconciliation.conflicts,...ordinary.reconciliation.conflicts]};
        preservedEvidence=ordinary.preservedEvidence;
      } else ({ reconciliation, preservedEvidence } = prepareIncoming(current, incoming, currentEvidence, identities));
    }
    if (tvAssessment?.reviews.length) {
      const body:PreparedTrade={stateFacts:projection.facts.map(storedStateFact),inheritedUnknownFees:[],reviewChanges:[],intent,current,reconciliation,preservedEvidence,materials:[],conditionalMaterialLinks:[],ancillaryDigest:intent.kind==="browser-migration"?canonicalRecord(snapshot.ancillary):null,withdrawnIds,tvImport};
      return {body,review:{diagnostics,changes:[],conflicts:[],missingExecutions:[],reactivateExecutionIds:[],status:"review-required" as const,identityReviews:tvAssessment.reviews,tvImportGuard:{policy:TV_IMPORT_POLICY},tradingViewImport:tvImport!.summary}};
    }
    // Duplicate references attach to their actual surviving fact, without creating a second row.
    const duplicateAliases = new Map(reconciliation.duplicates.map(d => [d.skipped.id, d.kept.id]));
    // A new conflicted fact may be linked only if that conflict's reviewed
    // branch actually writes it. The immutable observation survives either way.
    const conditionalMaterialLinks: PreparedTrade["conditionalMaterialLinks"] = [];
    for (const conflict of reconciliation.conflicts) {
      const sameIdConflict = conflict.incoming.some(candidate => conflict.existing.some(existing => existing.id === candidate.id));
      for (const candidate of conflict.incoming) {
        if (!snapshot.facts.some(row => row.id === candidate.id)) {
          conditionalMaterialLinks.push({
            executionId: candidate.id,
            when: { conflictId: conflict.id, decisions: sameIdConflict ? ["use-incoming"] : ["use-incoming", "keep-both"] },
          });
        }
      }
    }
    const tvMaterial=tvAssessment?prepareTVMaterial(intent,tvAssessment,snapshot.source):undefined;
    if (tvImport && tvMaterial) tvImport.summary=tvMaterial.summary;
    const rawMaterials = [...(intent.kind === "browser-migration" ? [] : intent.materials ?? []),...(tvMaterial?.material?[tvMaterial.material]:[])];
    const tvNoHistory=!!tvAssessment && (tvMaterial?.summary.material.kind!=="normalized-only" || !reconciliation.acceptedIncoming.length && !reconciliation.conflicts.length);
    const history = tvNoHistory ? [] : intent.kind === "import" ? intent.importHistory ?? [] : intent.kind === "browser-migration" ? intent.payload.importHistory : intent.kind === "revision" && intent.revision.importHistory ? [intent.revision.importHistory] : [];
    let context: ReturnType<typeof materializeSourceMaterialContext> = { materials: [], versions: [], mappings: [], revisions: [] };
    if (rawMaterials.length || history.length) {
      try { context = materializeSourceMaterialContext(snapshot.source); }
      catch (error) { throw new TradeChangeError("LEGACY_MATERIAL_REQUIRES_REVIEW", "prepare", error instanceof Error ? error.message : "Invalid material dependency", randomUUID(), ["source-materials:dependencies"]); }
      // Task4's dependency proof parses all audit requests during apply. Refuse
      // unresolved dependencies now, without changing that accepted authority.
      for (const row of snapshot.source.revisions) {
        try { asRecord(parseJson(row.request_json, "revision request"), "revision request"); }
        catch (error) { throw new TradeChangeError("LEGACY_REVISION_REQUIRES_REVIEW", "prepare", error instanceof Error ? error.message : "Invalid revision dependency", randomUUID(), [`trade_revisions:${row.id}`]); }
      }
    }
    const materialInputs: MaterialVersionInput[] = [...rawMaterials];
    for (const entry of history) {
      const owner = context.versions.find(v => v.legacy?.batchId === entry.id || (typeof v.content.historyProjection === "object" && v.content.historyProjection !== null && !Array.isArray(v.content.historyProjection) && v.content.historyProjection.batchId === entry.id));
      const existing = context.materials.find(m => m.id === owner?.materialId), prior = context.versions.find(v => v.id === existing?.currentVersionId);
      const records = [...current, ...incoming].filter(e => e.source.batchId === entry.id);
      materialInputs.push({
        materialId: owner?.materialId ?? `import-history:${entry.id}`,
        versionId: `version:${randomUUID()}`,
        parserVersion: "legacy-store-adapter-v1",
        sourceKind: entry.sourceKind ?? "statement",
        locator: { batchId: entry.id },
        fileFingerprint: null,
        recordedAt: entry.importedAt,
        scope: prior?.scope ?? {
          accounts: { values: [], unknown: true },
          markets: { values: [], unknown: true },
          instruments: { values: [], unknown: true },
          periods: { values: [], unknown: true }
        },
        diagnostics: [{ code: "LEGACY_COMPATIBILITY_SCOPE_UNKNOWN" }],
        content: { legacyImportHistory: JSON.parse(json(entry, "import history")) },
        observations: prior ? prior.observations.map(o => ({
          id: `observation:${randomUUID()}`,
          key: o.key,
          locator: o.locator,
          raw: o.raw,
          originalAccountId: o.originalAccountId,
          executionIds: o.executionIds,
          linkReason: "Preserve prior source evidence in compatibility projection"
        })) : records.map(e => ({
          id: `observation:${randomUUID()}`,
          locator: {},
          raw: JSON.parse(json(e.source, "source")),
          originalAccountId: e.accountId,
          executionIds: [duplicateAliases.get(e.id) ?? e.id],
          linkReason: "Existing import batch reference"
        })),
        historyProjection: { batchId: entry.id, reconciliation: JSON.parse(json(entry, "import history")) }
      });
    }
    const materialIds = new Set<string>(), versionIds = new Set<string>(), observationIds = new Set<string>();
    const materials = materialInputs.map(input => {
      if (materialIds.has(input.materialId) || versionIds.has(input.versionId) || input.observations.some(o => observationIds.has(o.id)))
        throw tradeDomainError("A plan may change each material once with unique evidence IDs");
      materialIds.add(input.materialId);
      versionIds.add(input.versionId);
      input.observations.forEach(o => observationIds.add(o.id));
      const rewritten = {
        ...input,
        observations: input.observations.map(o => ({ ...o, executionIds: [...new Set(o.executionIds.map(id => duplicateAliases.get(id) ?? id))] }))
      };
      for (const o of rewritten.observations)
        for (const id of o.executionIds) {
          if (!current.some(e => e.id === id) && !reconciliation.acceptedIncoming.some(e => e.id === id)
            && !(intent.kind === "revision" && incoming.some(e => e.id === id))
            && !conditionalMaterialLinks.some(link => link.executionId === id)) {
            throw new TradeChangeError("MATERIAL_LINK_UNRESOLVED", "prepare", "Material links must reference an existing fact or a reviewed candidate", randomUUID(), [id]);
          }
        }
      return externalTradeValidation("domain", "Material input or dependencies require review", () => prepareMaterialChanges(context, rewritten));
    });
    const missing = new Map<string, MissingExecutionDependency>();
    for (const material of materials)
      for (const dependency of material.missingExecutions) {
        const prior = missing.get(dependency.executionId);
        missing.set(dependency.executionId, prior ? {
          executionId: dependency.executionId,
          previousObservationIds: [...new Set([...prior.previousObservationIds, ...dependency.previousObservationIds])],
          otherSourceObservationIds: [...new Set([...prior.otherSourceObservationIds, ...dependency.otherSourceObservationIds])],
          revisionIds: [...new Set([...prior.revisionIds, ...dependency.revisionIds])]
        } : dependency);
      }
    const reactivateExecutionIds = intent.kind === "revision" || intent.kind === "material" ? intent.reactivateExecutionIds ?? [] : [...new Set(incoming.filter(e => withdrawnIds.includes(e.id)).map(e => e.id))];
    for (const id of reactivateExecutionIds)
      if (!withdrawnIds.includes(id))
        throw new TradeChangeError("INVALID_ACTIVATION", "prepare", "Only a withdrawn fact may be reviewed for activation", randomUUID(), [id]);
    this.assertLegacyFileTradesExist(intent, reconciliation, withdrawnIds, materials.some(material => material.expectedCurrentVersionId !== null && intent.kind !== "browser-migration" && intent.materials?.some(input => input.versionId === material.input.versionId)), "prepare");
    const stateFacts = projection.facts.map(storedStateFact);
    const inheritedUnknownFees: PreparedTrade["inheritedUnknownFees"] = [];
    if (intent.kind === "revision") {
      // validateRevisionBaseline above has matched the complete before projection
      // to current storage. Preserve its raw fee separately from the string DTO.
      const factsById = new Map(stateFacts.map(fact => [fact.id, fact]));
      for (const change of intent.revision.changes) {
        if (!isUnknownFeePlaceholder(change.before) || !isUnknownFeePlaceholder(change.after))
          continue;
        const id = change.before!.id;
        const fee = factsById.get(id)?.fee;
        if (fee !== null && fee !== "")
          throw tradeDomainError("Unknown fee does not match the stored fact");
        inheritedUnknownFees.push([id, fee]);
      }
    }
    const body: PreparedTrade = {
      stateFacts,
      inheritedUnknownFees,
      reviewChanges: [],
      intent,
      current,
      reconciliation,
      preservedEvidence,
      materials,
      conditionalMaterialLinks,
      ancillaryDigest: intent.kind === "browser-migration" ? canonicalRecord(snapshot.ancillary) : null,
      withdrawnIds
      ,...(tvImport?{tvImport}:{})
    };
    body.reviewChanges = describeTradeChanges(body, [...missing.values()], reactivateExecutionIds);
    return {
      body,
      review: {
        diagnostics,
        ...(intent.kind === "import" && !tvImport ? { importDuplicates: {
          policy: "import-duplicate-review-v1" as const,
          count: reconciliation.duplicates.length,
          pairs: reconciliation.duplicates.map(pair => ({ kept: duplicateDisplayFact(pair.kept), skipped: duplicateDisplayFact(pair.skipped) })),
        } } : {}),
        changes: body.reviewChanges,
        conflicts: reconciliation.conflicts.map(c => ({
          ...c,
          allowed: c.incoming.some(i => c.existing.some(e => e.id === i.id)) ? ["keep-existing", "use-incoming"] as const : ["keep-existing", "use-incoming", "keep-both"] as const
        })).map(c => ({ ...c, allowed: [...c.allowed] })),
        missingExecutions: [...missing.values()],
        reactivateExecutionIds
        ,...(tvImport?{status:"ready" as const,identityReviews:[],tvImportGuard:{policy:TV_IMPORT_POLICY},tradingViewImport:tvImport.summary}:{})
      }
    };
  }
  private selectMaterialBranches(body: PreparedTrade, choices: TradeChangeChoices): PreparedMaterialChanges[] {
    if (!body.materials.length) return body.materials;
    const omittedIds = new Set(body.conditionalMaterialLinks
      .filter(link => !choices.conflicts?.some(choice => choice.conflictId === link.when.conflictId && link.when.decisions.includes(choice.decision)))
      .map(link => link.executionId));
    if (!omittedIds.size) return body.materials;
    // These IDs were absent in the copied raw book, so omitting their future
    // links cannot remove any existing material dependency. Recheck the claim
    // under the sole transaction and keep Task4's head/missing/digest authority.
    for (const id of omittedIds) {
      if (this.database.prepare("select 1 from executions where id=?").get(id)) {
        throw new TradeChangeError("MATERIAL_BRANCH_CHANGED", "commit", "Conditional candidate already exists; prepare again", randomUUID(), [id]);
      }
    }
    const context = materializeSourceMaterialContext(copySourceMaterialRows(this.database));
    return body.materials.map(prepared => {
      const input = {
        ...prepared.input,
        observations: prepared.input.observations.map(observation => ({
          ...observation,
          executionIds: observation.executionIds.filter(id => !omittedIds.has(id)),
        })),
      };
      const selected = prepareMaterialChanges(context, input);
      if (selected.expectedCurrentVersionId !== prepared.expectedCurrentVersionId
        || selected.dependencyDigest !== prepared.dependencyDigest
        || canonicalRecord(selected.missingExecutions) !== canonicalRecord(prepared.missingExecutions)) {
        throw new TradeChangeError("MATERIAL_BRANCH_CHANGED", "commit", "Conditional links changed material dependencies; prepare again", randomUUID(), [input.materialId]);
      }
      return selected;
    });
  }
  private applyTradeRows(body: PreparedTrade, choices: TradeChangeChoices, auditId: string, recordedAt: string, now: number, review: ReviewPlan): CommitReceipt["result"] {
    if (!this.database.isTransaction)
      throw new Error("Trade apply requires the coordinator transaction");
    const { intent, reconciliation, current } = body;
    this.assertFileNotImported(intent, this.importedFiles(), "commit");
    this.assertLegacyFileTradesExist(intent, reconciliation, body.withdrawnIds, body.materials.some(material => material.expectedCurrentVersionId !== null && intent.kind !== "browser-migration" && intent.materials?.some(input => input.versionId === material.input.versionId)), "commit");
    const importedFile = intent.kind === "import" && intent.fileImport?.complete && !this.importHasPendingRows(intent) && (intent.candidates.length > 0 || intent.fileImport.evidence?.monthly && !intent.fileImport.evidence.monthly.evidenceScope
        && body.materials.some(material => material.input.sourceKind === "statement" && isMonthlyStatement(material.input.content.monthly)
          && canonicalRecord(material.input.content.monthly) === canonicalRecord(intent.fileImport!.evidence!.monthly)))
      && reconciliation.conflicts.every(conflict => choices.conflicts?.some(choice => choice.conflictId === conflict.id && choice.decision !== "keep-existing"))
      && !choices.reactivateExecutions?.some(choice => choice.action === "keep-withdrawn")
      ? { sha256: intent.fileImport.sha256, byteLength: intent.fileImport.byteLength } : undefined;
    const candidates=intent.kind==="import"?intent.candidates:intent.kind==="browser-migration"?intent.payload.executions:[];
    if (candidates.some(isTradingViewExecution)) {
      if (review.reviewContract!=="trade-review-v2" || review.status!=="ready" || review.tvImportGuard?.policy!==TV_IMPORT_POLICY || !review.summary.tradingViewImport || !Array.isArray(review.identityReviews) || review.identityReviews.length) throw new TradeChangeError("POLICY_CHANGED","commit","TradingView plan requires a complete current ready contract",randomUUID());
      if (body.tvImport?.assessment.policy!==TV_IMPORT_POLICY) throw new TradeChangeError("POLICY_CHANGED","commit","Prepare a new TradingView review plan",randomUUID());
      if (body.tvImport.assessment.reviews.length) throw new TradeChangeError("TRADINGVIEW_SOURCE_REVIEW_REQUIRED","commit","Resolve identity review through a new plan",randomUUID());
      const parent=body.tvImport.parent;
      if (parent) {
        const row=this.database.prepare("select * from trade_change_plans where id=?").get(parent.planId);
        if (!row || row.receipt_id || row.policy!=="trade-changes-v1" || row.body_digest!==parent.bodyDigest || createHash("sha256").update(String(row.body_json)).digest("hex")!==parent.bodyDigest || Date.parse(String(row.expires_at))<=now || String(row.expires_at)!==parent.expiresAt) throw new TradeChangeError("IDENTITY_REVIEW_STALE","commit","Parent identity review changed or expired",randomUUID());
      }
      const snapshot=this.copyTradeRows(intent.kind==="browser-migration"), projection=projectTradeRows(snapshot,intent);
      const fresh=this.assessTV(snapshot,intent,projection.current,body.tvImport.assessment.bindings.length?body.tvImport.assessment.bindings:undefined,"commit");
      if (!fresh || fresh.digest!==body.tvImport.assessment.digest) throw new TradeChangeError("IDENTITY_REVIEW_STALE","commit","TradingView identity or source material closure changed",randomUUID());
      if (body.tvImport.summary.material.kind==="reuse-exact") {
        const material=prepareTVMaterial(intent,fresh,snapshot.source);
        if (canonicalRecord(material.summary)!==canonicalRecord(body.tvImport.summary)) throw new TradeChangeError("MATERIAL_HEAD_CHANGED","commit","Exact material no longer current",randomUUID());
      }
      if (intent.kind==="import" && !reconciliation.acceptedIncoming.length && !reconciliation.conflicts.length && !body.materials.length && !choices.reactivateExecutions?.length && !choices.missingExecutions?.length)
        return {report:{inserted:0,duplicate:reconciliation.duplicates.length,conflict:0},appliedChanges:[], ...(importedFile ? { importedFile } : {}),tradingViewImport:body.tvImport.summary};
    }
    if (body.ancillaryDigest !== null && canonicalRecord(this.copyBrowserDependencies()) !== body.ancillaryDigest)
      throw new TradeChangeError("DEPENDENCIES_CHANGED", "commit", "Browser migration dependencies changed; prepare again", randomUUID());
    const materialChanges = this.selectMaterialBranches(body, choices);
    const browserCounts: MigrationCounts = { inserted: 0, duplicate: 0, conflict: 0 };
    if (intent.kind === "browser-migration") {
      for (const instrument of intent.payload.instruments)
        classifyMigrationRecord(browserCounts, this.getInstruments().find(item => item.id === instrument.id), instrument);
      for (const history of intent.payload.importHistory)
        classifyMigrationRecord(browserCounts, this.getImportHistory().find(item => item.id === history.id), history);
    }
    const currentById = new Map(current.map(e => [e.id, e])), preserved = new Map(body.preservedEvidence), withdrawals = new Map<string, string>();
    const inheritedUnknownFees = new Map(body.inheritedUnknownFees);
    let writes = [...reconciliation.acceptedIncoming];
    for (const id of reconciliation.automaticReplacementIds)
      if (!writes.some(e => e.id === id))
        withdrawals.set(id, "Trusted source reconciliation replaced this fact");
    for (const choice of choices.conflicts ?? []) {
      const conflict = reconciliation.conflicts.find(c => c.id === choice.conflictId)!;
      if (choice.decision !== "keep-existing")
        writes.push(...conflict.incoming);
      if (choice.decision === "use-incoming")
        for (const e of conflict.existing)
          if (!conflict.incoming.some(i => i.id === e.id))
            withdrawals.set(e.id, choice.reason!);
    }
    if (intent.kind === "revision") {
      writes = intent.revision.changes.flatMap(c => c.after ? [executionForRevisionWrite(c.after, c.before ? currentById.get(c.before.id) : undefined)] : []);
      for (const c of intent.revision.changes)
        if (c.before && !c.after)
          withdrawals.set(c.before.id, intent.revision.reason);
    }
    for (const choice of choices.missingExecutions ?? [])
      if (choice.action === "withdraw")
        withdrawals.set(choice.executionId, choice.reason!);
    for (const choice of choices.reactivateExecutions ?? []) {
      if (choice.action === "activate" && withdrawals.has(choice.executionId))
        throw new TradeChangeError("INVALID_CHOICES", "commit", "A fact cannot be withdrawn and activated in the same commit", randomUUID(), [choice.executionId]);
    }
    if (new Set(writes.map(e => e.id)).size !== writes.length)
      throw new TradeChangeError("INVALID_CHOICES", "commit", "Choices would overwrite more than one candidate with the same ID", randomUUID());
    writes = writes.filter(e => !body.withdrawnIds.includes(e.id) || intent.kind === "revision");
    for (const instrument of intent.kind === "import" ? (body.tvImport && !writes.length ? [] : intent.instruments ?? []) : intent.kind === "browser-migration" ? intent.payload.instruments : [])
      this.putInstrument(instrument);
    for (const e of writes) {
      // A returned source does not reactivate or rewrite a withdrawn fact without explicit revision review.
      if (body.withdrawnIds.includes(e.id) && intent.kind !== "revision")
        continue;
      this.writeExecution(e, preserved.get(e.id), inheritedUnknownFees.get(e.id));
    }
    // Task4 dependencies must be checked before introducing this commit's revision.
    for (const material of materialChanges)
      _applyPreparedMaterialChangesInTransaction(this.database, material, (choices.missingExecutions ?? []).filter(c => material.missingExecutions.some(m => m.executionId === c.executionId)));
    let revision: TradeRevision | undefined;
    const changes = intent.kind === "revision" ? intent.revision.changes : writes.map(after => ({ before: currentById.get(after.id) ?? null, after }));
    const groups = new Map<string, typeof changes>();
    for (const change of changes) {
      const e = change.after ?? change.before!;
      const key = canonicalRecord([e.instrument.id, e.accountId]);
      const list = groups.get(key) ?? [];
      list.push(change);
      groups.set(key, list);
    }
    if (intent.kind === "revision" && groups.size === 0)
      throw new Error("Invalid empty revision");
    let index = 0;
    for (const group of groups.values()) {
      const e = group[0].after ?? group[0].before!;
      const record: TradeRevision = intent.kind === "revision" ? { ...intent.revision, recordedAt } : {
        id: `${auditId}:${index++}`,
        instrumentId: e.instrument.id,
        accountId: e.accountId,
        reason: [...new Set([...withdrawals.values(), ...(choices.conflicts ?? []).map(c => c.reason).filter((v): v is string => !!v)])].join("; ") || "Reviewed source import",
        changes: group,
        recordedAt
      };
      const { recordedAt: _auditRecordedAt, ...request } = record;
      this.database.prepare("insert into trade_revisions(id,instrument_id,account_id,request_json,revision_json,recorded_at) values(?,?,?,?,?,?)").run(record.id, record.instrumentId, record.accountId, canonicalRecord(revisionComparableRequest(request)), json(record, "trade revision"), recordedAt);
      if (intent.kind === "revision")
        revision = record;
    }
    const state = (executionId: string, action: "activate" | "withdraw", reason: string) => {
      const raw = this.database.prepare("select e.*, e.currency as fact_currency, i.symbol,i.name,i.market,i.currency from executions e join instruments i on i.id=e.instrument_id where e.id=?").get(executionId) as Row | undefined;
      const before = raw ? storedStateFact(raw) : undefined;
      if (!before)
        throw new Error("Fact state requires the original stored fact");
      const audit: FactStateAudit = {
        kind: "fact-state-audit-v1",
        id: `${auditId}:state:${executionId}`,
        executionId,
        instrumentId: before.instrumentId,
        accountId: before.accountId,
        action,
        reason,
        recordedAt,
        before,
        changes: [{ before, after: action === "activate" ? before : null }],
      };
      const encoded = json(audit, "fact state audit");
      this.database.prepare(`
    insert into trade_revisions(id,instrument_id,account_id,request_json,revision_json,recorded_at,scope_account_unknown)
    values(?,?,?,?,?,?,?)
   `).run(audit.id, audit.instrumentId, audit.accountId ?? "", encoded, encoded, recordedAt, audit.accountId === null ? 1 : 0);
      this.database.prepare(`
    insert into execution_fact_states(execution_id,state,revision_id,reason,recorded_at) values(?,?,?,?,?)
    on conflict(execution_id) do update set state=excluded.state,revision_id=excluded.revision_id,
     reason=excluded.reason,recorded_at=excluded.recorded_at
   `).run(executionId, action === "activate" ? "active" : "withdrawn", audit.id, reason, recordedAt);
    };
    for (const [id, reason] of withdrawals)
      state(id, "withdraw", reason);
    for (const choice of choices.reactivateExecutions ?? []) {
      if (choice.action === "activate")
        state(choice.executionId, "activate", choice.reason!);
    }
    const report: ExecutionMergeReport = {
      inserted: writes.filter(e => !body.withdrawnIds.includes(e.id) || intent.kind === "revision").length,
      duplicate: reconciliation.duplicates.length,
      conflict: reconciliation.conflicts.length
    };
    let migration: MigrationReport | undefined;
    if (intent.kind === "browser-migration") {
      const counts: MigrationCounts = {
        inserted: browserCounts.inserted + report.inserted,
        duplicate: browserCounts.duplicate + report.duplicate,
        conflict: browserCounts.conflict + report.conflict
      };
      migration = this.applyBrowserAncillary(intent.payload, counts);
    }
    const appliedChanges = body.reviewChanges.filter(change => {
      if (change.when && "conflictId" in change.when) {
        const condition = change.when;
        if (!choices.conflicts?.some(choice => choice.conflictId === condition.conflictId && condition.decisions.includes(choice.decision)))
          return false;
      }
      if (change.kind === "withdraw")
        return withdrawals.has(change.executionId!);
      if (change.kind === "reactivate")
        return choices.reactivateExecutions?.some(choice => choice.executionId === change.executionId && choice.action === "activate") ?? false;
      if (["add", "replace", "revise"].includes(change.kind))
        return writes.some(fact => fact.id === change.executionId);
      return true;
    }).map(change => {
      const applied = { ...change };
      delete applied.when;
      return applied;
    });
    return { report, appliedChanges, ...(importedFile ? { importedFile } : {}), ...(revision ? { revision } : {}), ...(migration ? { migration } : {}),...(body.tvImport?{tradingViewImport:body.tvImport.summary}:{}) };
  }
  private getLatestMigration(): MigrationReport | null {
    const row = this.database
      .prepare("select * from data_migrations where status = 'complete' order by completed_at desc, source_fingerprint desc limit 1")
      .get() as Row | undefined;
    return row ? migrationReport(row) : null;
  }

  hasInstrument(id: string): boolean {
    return Boolean(this.database.prepare("select 1 from instruments where id = ?").get(id));
  }

  private putInstrument(instrument: StoredInstrument, options: { validateOnly?: boolean } = {}): boolean {
    validateInstrument(instrument);
    const localizedName = instrument.localizedName
      ? validateLocalizedInstrumentName(instrument.localizedName)
      : undefined;
    const previousRow = this.database.prepare("select symbol, market, currency, metadata_json from instruments where id = ?").get(instrument.id) as Row | undefined;
    if (previousRow && (["symbol", "market", "currency"] as const).some(field => previousRow[field] !== instrument[field])) {
      throw new Error("Instrument identity conflict");
    }
    if (options.validateOnly) return !previousRow;
    let metadata = instrument.metadata;
    if (metadata) {
      const previous = previousRow?.metadata_json ? storedMetadata(JSON.parse(String(previousRow.metadata_json))) : undefined;
      metadata = mergeInstrumentExchange(previous, metadata);
    }
    this.database.prepare(`
      insert into instruments (id, symbol, name, market, currency, metadata_json, localized_name_json, updated_at)
      values (?, ?, ?, ?, ?, ?, ?, current_timestamp)
      on conflict(id) do update set
        name = excluded.name,
        metadata_json = coalesce(excluded.metadata_json, instruments.metadata_json),
        localized_name_json = coalesce(excluded.localized_name_json, instruments.localized_name_json),
        updated_at = excluded.updated_at
    `).run(
      instrument.id,
      instrument.symbol,
      instrument.name,
      instrument.market,
      instrument.currency,
      metadata ? json(metadata, "instrument metadata") : null,
      localizedName
        ? json(localizedName, "localized instrument name")
        : null,
    );
    return !previousRow;
  }

  private ensureInstrument(instrument: Instrument): void {
    this.putInstrument(instrument);
  }

  private ensureInstrumentId(id: string): void {
    if (!this.hasInstrument(id)) throw new Error(`Unknown instrument: ${id}`);
  }

  private writeExecution(
    execution: TradeExecution,
    preservedEvidence?: StoredExecutionEvidence,
    rawFee: string | null = execution.fee,
  ): void {
    const persistedAccountId = preservedEvidence?.accountCorrection.canonicalAccountId ?? execution.accountId;
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
      {
        ...(preservedEvidence ?? {}),
        source: execution.source,
        accountLabel: execution.accountLabel,
      },
      "execution evidence",
    );
    this.database.prepare(`
      insert into executions (
        id, import_batch_id, instrument_id, account, side, executed_at,
        quantity, price, fee, currency, trade_nature, simulation_run_id,
        evidence_json, updated_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, current_timestamp)
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
        trade_nature = excluded.trade_nature,
        simulation_run_id = excluded.simulation_run_id,
        evidence_json = excluded.evidence_json,
        updated_at = excluded.updated_at
    `).run(
      execution.id,
      batchId ?? null,
      execution.instrument.id,
      persistedAccountId,
      execution.side,
      execution.executedAt,
      execution.quantity,
      execution.price,
      rawFee,
      execution.instrument.currency,
      execution.source.tradeNature ?? null,
      execution.source.simulationRunId ?? null,
      evidence,
    );
  }

  private putImportHistory(entry: ImportHistoryEntry): void {
    validateImportHistory(entry);
    this.database.prepare(`
      insert into import_batches (
        id, source_name, source_type, imported_at, record_count,
        trade_nature, simulation_run_id, reconciliation_json
      ) values (?, ?, ?, ?, ?, ?, ?, ?)
      on conflict(id) do update set
        source_name = excluded.source_name,
        source_type = excluded.source_type,
        imported_at = excluded.imported_at,
        record_count = excluded.record_count,
        trade_nature = excluded.trade_nature,
        simulation_run_id = excluded.simulation_run_id,
        reconciliation_json = excluded.reconciliation_json
    `).run(
      entry.id,
      entry.fileName,
      entry.sourceKind ?? "statement",
      entry.importedAt,
      entry.tradeCount,
      entry.tradeNature ?? null,
      entry.simulationRunId ?? null,
      json(entry, "import history"),
    );
  }

  private putReviewInTransaction(record: EpisodeReviewRecord): boolean {
    validateReview(record);
    const current = this.getLegacyReview(record.episodeId);
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
    if (!this.getLegacyReview(record.episodeId)) {
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
      insert into market_data_jobs (id, instrument_id, provider, status, progress_json, error_json)
      values (?, ?, ?, ?, ?, ?)
      on conflict(id) do update set
        status = excluded.status,
        progress_json = excluded.progress_json,
        error_json = excluded.error_json,
        updated_at = current_timestamp
    `).run(
      job.instrumentId,
      job.instrumentId,
      "browser",
      job.status,
      json(job, "market data job"),
      job.error ? json(job.error, "market data job error") : null,
    );
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
    const existing = this.getIntervalCoverage().filter(
      (item) =>
        item.instrumentId === normalized.instrumentId
        && item.interval === normalized.interval
        && item.adjustmentMode === normalized.adjustmentMode,
    );
    const segments = [...existing, normalized].filter(
      (item, index, items) =>
        items.findIndex((candidate) => intervalCoverageKey(candidate) === intervalCoverageKey(item)) === index,
    );
    this.putIntervalCoverageSegments(normalized.instrumentId, normalized.interval, segments);
  }

  private putIntervalCoverageSegments(
    instrumentId: string,
    interval: IntervalCoverageSegment["interval"],
    coverage: IntervalCoverageInput[],
  ): void {
    this.ensureInstrumentId(instrumentId);
    const normalized = coverage.map((item) => normalizeIntervalCoverage({ ...item, instrumentId, interval }));
    const starts = normalized.map((item) => item.actualStart ?? item.requestedStart).sort();
    const ends = normalized.map((item) => item.actualEnd ?? item.requestedEnd).sort();
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
      instrumentId,
      interval,
      "raw",
      starts[0] ?? null,
      ends.at(-1) ?? null,
      json(normalized, "interval coverage"),
    );
  }

  private putProviderSymbol(
    record: ProviderSymbolRecord,
    options: { skipConflictingAlias?: boolean } = {},
  ): void {
    validateProviderSymbol(record);
    this.ensureInstrumentId(record.instrumentId);
    // Provider symbols are an optional lookup cache. The market-data commit
    // methods may keep the first mapping when a historical instrument shares
    // an alias with its renamed successor (for example FB and META), while
    // migration and explicit browser-state writes remain strict by default.
    if (options.skipConflictingAlias) {
      const conflicting = this.database.prepare(
        `select instrument_id from provider_symbols
         where provider = ? and provider_symbol = ? and instrument_id <> ?
         limit 1`,
      ).get(record.provider, record.providerSymbol, record.instrumentId) as Row | undefined;
      if (conflicting) return;
    }
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


/** Projection deliberately excludes IDs, fingerprints, paths and arbitrary source evidence. */
function duplicateDisplayFact(fact: TradeExecution): import("./sqlite-contracts").ImportDuplicateFact {
  const name = fact.source.fileName?.split(/[\\/]/).pop();
  return {
    accountId: fact.accountId, accountLabel: fact.accountLabel,
    instrument: { id: fact.instrument.id, symbol: fact.instrument.symbol, name: fact.instrument.name, market: fact.instrument.market, currency: fact.instrument.currency },
    executedAt: fact.executedAt, side: fact.side, quantity: fact.quantity, price: fact.price,
    fee: fact.source.feeStatus === "unknown" ? null : fact.fee,
    source: { platform: fact.source.platform, fileName: name || null, page: fact.source.page ?? null, row: fact.source.row },
  };
}

export function getSqliteStore(database: DatabaseSync) { return new SqliteStore(database); }

/** Public construction hides the closed port; no application callback is accepted. */
export function createTradeChanges(
  database: DatabaseSync,
  options: TradeChangeOptions = {},
): import("./sqlite-contracts").TradeChanges {
  const store = new SqliteStore(database);
  // Factory and private port share this module; consumers only see the closed intent protocol.
  return store["tradeChanges"](options);
}

/** Compatibility configuration preserves existing read-only planners; writes use the same fixed engine port. */
export function _createTradingViewTradeChanges(database: DatabaseSync, options: TradingViewAccountMigrationTransactionOptions = {}) {
  const store=new SqliteStore(database);
  return store["tradeChanges"](options.now ? {now:()=>Date.parse(options.now!())} : {},options);
}
