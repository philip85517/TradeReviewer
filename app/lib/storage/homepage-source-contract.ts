import type { RecallReviewSummary } from "../recall/summary";
import type { StorageBootstrap } from "./sqlite-contracts";
import { isLegacyImportHistoryEntry } from "./import-history-contract";
import { isLegacyMarketDataJob } from "./market-data-job-contract";

import { validBookVersion, assembleTradeReadPages, assertTradeReadSelection, parseTradeReadPage, encodeTradeRead, type TradeReadPage } from "./trade-read-contract";
import type { BookVersion } from "./trade-book-version";

export type HomepageStoredCollection = Readonly<{
  bootstrap: StorageBootstrap;
  bookVersion: BookVersion;
  tradeReadPages: readonly TradeReadPage[];
  recallSummaries: readonly RecallReviewSummary[];
  receipt: Readonly<{
    policy: "homepage-stored-collection-v1";
    scope: "all-persisted-records";
    enumeration: "complete";
    /** Opaque read identity, not a persistent database revision. */
    receiptId: string;
    /** Actual materialization completion; never an FX or inception clock. */
    knownAt: string;
    counts: Readonly<{
      executions: number;
      instruments: number;
      importHistory: number;
      legacyReviewRows: number;
      recallDocuments: number;
    }>;
    /** Existing monthly projection omitted evidence from these import IDs. */
    projectionGaps: readonly string[];
    /** SHA-256 content binding, not a signature or proof of financial completeness. */
    payloadDigest: string;
  }>;
}>;

type RecordValue = Record<string, unknown>;
type UnboundCollection = Omit<HomepageStoredCollection, "receipt"> & {
  receipt: Omit<HomepageStoredCollection["receipt"], "payloadDigest">;
};

function invalid(): never { throw new Error("Invalid homepage stored source"); }
function record(value: unknown): RecordValue {
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalid();
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return invalid();
  return value as RecordValue;
}
function strings(value: RecordValue, keys: readonly string[]): void {
  if (keys.some((key) => typeof value[key] !== "string")) invalid();
}
function count(value: unknown): asserts value is number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) invalid();
}
function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) return invalid();
  return value;
}
function records(value: unknown, id: string): RecordValue[] {
  const rows = array(value).map(record);
  const seen = new Set<string>();
  for (const row of rows) {
    const key = row[id];
    if (typeof key !== "string" || !key || seen.has(key)) invalid();
    seen.add(key);
  }
  return rows;
}

/** Version 1 encoding: sorted object keys, ordered arrays, JSON wire semantics. */
function canonical(value: unknown, ancestors = new Set<object>()): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
  if (!value || typeof value !== "object" || ancestors.has(value)) return invalid();
  ancestors.add(value);
  let encoded: string;
  if (Array.isArray(value)) {
    encoded = `[${Array.from(value, (item) => canonical(item, ancestors)).join(",")}]`;
  } else {
    const item = record(value);
    encoded = `{${Object.keys(item).filter((key) => item[key] !== undefined).sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(item[key], ancestors)}`).join(",")}}`;
  }
  ancestors.delete(value);
  return encoded;
}

/** Binds receipt identity, diagnostics and counts as well as the actual payload. */
export function encodeHomepageSourceBinding(value: UnboundCollection | HomepageStoredCollection): string {
  const receipt = Object.fromEntries(Object.entries(value.receipt).filter(([key]) => key !== "payloadDigest"));
  return canonical({ bootstrap: value.bootstrap, bookVersion: value.bookVersion, tradeReadPages: value.tradeReadPages, recallSummaries: value.recallSummaries, receipt });
}

/** Structural envelope checks only; financial qualification remains with S1/F. */
export function assertHomepageSourceShape(value: unknown): asserts value is HomepageStoredCollection {
  const envelope = record(value);
  if (Object.keys(envelope).sort().join(",") !== "bookVersion,bootstrap,recallSummaries,receipt,tradeReadPages") invalid();
  if (!validBookVersion(envelope.bookVersion)) invalid();
  const pages = array(envelope.tradeReadPages) as TradeReadPage[];
  let book;
  try { book = assembleTradeReadPages(pages); } catch { return invalid(); }
  if (encodeTradeRead(book.bookVersion) !== encodeTradeRead(envelope.bookVersion)) invalid();
  const bootstrap = record(envelope.bootstrap);
  count(bootstrap.schemaVersion);
  const executions = records(bootstrap.executions, "id");
  if (encodeTradeRead(book.executions.map(e => e.id).sort()) !== encodeTradeRead(executions.map(e => e.id).sort()) || book.executions.some(e => encodeTradeRead(e) !== encodeTradeRead(executions.find(b => b.id === e.id)))) invalid();
  const instruments = records(bootstrap.instruments, "id");
  const imports = records(bootstrap.importHistory, "id");
  const reviews = records(bootstrap.reviews, "episodeId");
  const states = records(bootstrap.reviewStates, "episodeId");
  const suggestions = records(bootstrap.tagSuggestions, "id");
  const jobs = records(bootstrap.marketDataJobs, "instrumentId");
  record(bootstrap.settings);
  if (bootstrap.migration !== null) {
    const migration = record(bootstrap.migration);
    strings(migration, ["sourceFingerprint", "validationDigest"]);
    for (const key of ["inserted", "duplicate", "conflict", "failed"]) count(migration[key]);
  }
  const instrumentIds = new Set(instruments.map((instrument) => instrument.id));
  for (const instrument of instruments) strings(instrument, ["symbol", "name", "market", "currency"]);
  for (const execution of executions) {
    strings(execution, ["accountId", "accountLabel", "executedAt", "quantity", "price", "fee"]);
    if (execution.side !== "buy" && execution.side !== "sell") invalid();
    const instrument = record(execution.instrument);
    strings(instrument, ["id", "symbol", "name", "market", "currency"]);
    if (!instrumentIds.has(instrument.id)) invalid();
    const source = record(execution.source);
    strings(source, ["platform"]);
    if (typeof source.row !== "number" || !Number.isFinite(source.row)) invalid();
  }
  if (encodeTradeRead(book.instruments) !== encodeTradeRead(bootstrap.instruments) || encodeTradeRead(book.importHistory) !== encodeTradeRead(bootstrap.importHistory)) invalid();
  if (imports.some((entry) => !isLegacyImportHistoryEntry(entry))) invalid();
  for (const review of reviews) {
    strings(review, ["instrumentId", "updatedAt"]);
    if (review.version !== 1) invalid();
    strings(record(review.plan), ["thesis", "expectedPath", "invalidationCondition", "targetRange", "plannedRiskAmount"]);
    const details = record(review.review);
    strings(details, ["riskManagement", "psychology", "reusableRule"]);
    if (typeof details.completed !== "boolean" || array(review.confirmedTagIds).some((tag) => typeof tag !== "string")) invalid();
  }
  for (const state of states) {
    strings(state, ["replayCursor", "timeframe", "activePanelTab"]);
    if (state.version !== 2) invalid();
    array(state.drawings).forEach(record);
  }
  for (const suggestion of suggestions) {
    strings(suggestion, ["episodeId", "instrumentId", "tagId", "ruleId", "status", "suggestedAt"]);
    if (suggestion.version !== 1) invalid();
    array(suggestion.evidence).forEach(record);
  }
  if (jobs.some((job) => !isLegacyMarketDataJob(job))) invalid();
  const summaries = records(envelope.recallSummaries, "episodeId");
  for (const summary of summaries) {
    strings(summary, ["updatedAt", "text"]);
    count(summary.snapshotCount);
    if (!["in-progress", "completed", "needs-confirmation"].includes(String(summary.status))) invalid();
    if (summary.completedAt !== undefined && typeof summary.completedAt !== "string") invalid();
    if (summary.status === "completed" && (typeof summary.completedAt !== "string" || !summary.completedAt.trim())) invalid();
  }
  const receipt = record(envelope.receipt);
  if (Object.keys(receipt).sort().join(",") !== "counts,enumeration,knownAt,payloadDigest,policy,projectionGaps,receiptId,scope") invalid();
  if (receipt.policy !== "homepage-stored-collection-v1" || receipt.scope !== "all-persisted-records" || receipt.enumeration !== "complete") invalid();
  if (typeof receipt.receiptId !== "string" || !/^[a-zA-Z0-9-]{1,128}$/.test(receipt.receiptId)) invalid();
  if (typeof receipt.knownAt !== "string" || !Number.isFinite(Date.parse(receipt.knownAt)) || new Date(receipt.knownAt).toISOString() !== receipt.knownAt) invalid();
  if (typeof receipt.payloadDigest !== "string" || !/^sha256:[a-f0-9]{64}$/.test(receipt.payloadDigest)) invalid();
  const counts = record(receipt.counts);
  if (Object.keys(counts).sort().join(",") !== "executions,importHistory,instruments,legacyReviewRows,recallDocuments") invalid();
  Object.values(counts).forEach(count);
  if (counts.executions !== executions.length || counts.instruments !== instruments.length || counts.importHistory !== imports.length || counts.recallDocuments !== summaries.length) invalid();
  if (Number(counts.legacyReviewRows) > reviews.length || reviews.length > Number(counts.legacyReviewRows) + summaries.length) invalid();
  const gaps = array(receipt.projectionGaps);
  const importIds = new Set(imports.map((entry) => entry.id));
  if (gaps.some((id) => typeof id !== "string" || !importIds.has(id)) || new Set(gaps).size !== gaps.length) invalid();
}

/** WebCrypto works in the browser and native Node; this module has no Node imports. */
export async function parseHomepageStoredCollection(value: unknown): Promise<HomepageStoredCollection> {
  // Detach before awaiting crypto, so mutation by a fetcher cannot bypass the binding.
  const owned: unknown = JSON.parse(canonical(value));
  assertHomepageSourceShape(owned);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(encodeHomepageSourceBinding(owned)));
  const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  if (owned.receipt.payloadDigest !== `sha256:${hex}`) invalid();
  for (const page of owned.tradeReadPages) { await parseTradeReadPage(page); await assertTradeReadSelection(page, { pageSize: 1000 }); }
  return owned;
}
