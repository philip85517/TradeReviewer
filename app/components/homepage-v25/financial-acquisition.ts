import { Temporal } from "@js-temporal/polyfill";
import { projectMonthlyHistoryEvidence } from "../../lib/import/statement-evidence";
import { assertHomepageSourceShape, encodeHomepageSourceBinding, type HomepageStoredCollection } from "../../lib/storage/homepage-source-contract";
import type { TradeExecution } from "../../lib/trades/types";
import type { FxState } from "../../lib/fx/room-contracts";
import { sha256 } from "../../lib/recall/retained-digest";
import type { CurrentFxEvidence } from "../../lib/reviews/homepage-v25-performance";
import type { CoverageSegment } from "../../lib/market/contracts";
import type { RecallReviewSummary } from "../../lib/recall/summary";
import type { EpisodeReviewRecord } from "../../lib/reviews/types";
import type { ImportHistoryEntry } from "../../lib/storage/import-history";
import type { StoredInstrument } from "../../lib/storage/sqlite-contracts";
import type { HomepageFinancialRawSource } from "./source-contract";

/** Same acquisition's actual inputs; fingerprints describe contents, not DB revisions. */
export type HomepageFinancialAcquisitionInput = Readonly<Pick<HomepageFinancialRawSource,
  "entries" | "instrumentMetadata" | "candlesByInstrument" | "marketDataStatuses" | "reviewSummariesComplete"
> & {
  requestedAt: string;
  completedAt: string;
  fx: Readonly<{ state: FxState; observedAt: string }> | null;
  provenance: Readonly<{
    importHistory: readonly ImportHistoryEntry[];
    reviews: readonly EpisodeReviewRecord[];
    reviewSummaries: readonly RecallReviewSummary[] | null;
    storedInstruments: readonly StoredInstrument[];
    dailyCoverageByInstrument: Readonly<Record<string, readonly CoverageSegment[] | undefined>>;
  }>;
}>;

export type StoredRepresentationReceipt = Readonly<{
  policy: "stored-financial-representation-v1";
  storedReceiptId: string;
  payloadDigest: string;
  entriesRevision: string;
  state: "complete" | "unknown";
  gapCount: number;
  /** Stable first 64 diagnostics; state/gapCount always reflect every check. */
  gaps: readonly Readonly<{ sourceRef: string; reason: string }>[];
}>;

export type HomepageAcquisitionCompletionInput = Readonly<Omit<HomepageFinancialAcquisitionInput,
  "provenance" | "reviewSummariesComplete"> & {
  dailyCoverageByInstrument: HomepageFinancialAcquisitionInput["provenance"]["dailyCoverageByInstrument"];
}>;

export type HomepageFinancialAcquisitionReceipt = Readonly<{
  policy: "acquisition-completed-v1";
  representation?: StoredRepresentationReceipt;
  requestedAt: string;
  completedAt: string;
  fx: Readonly<{
    state: Readonly<FxState>;
    observedAt: string;
    knowledgePolicy: "client-body-observed";
    upstreamFetchedAtSemantics: "provider-attempt-start";
    snapshotAsOfOrigin: "provider-published" | "client-observed";
    sourceRevision: string;
    evidenceId: string;
    reasons: readonly string[];
  }> | null;
}>;

function instant(value: string): bigint | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:[0-5]\d(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return null;
  try { return Temporal.Instant.from(value).epochNanoseconds; } catch { return null; }
}

function captureTime(value: string, name: string): bigint {
  const parsed = instant(value);
  if (parsed === null) throw new RangeError(`${name} must be an explicit valid zoned instant`);
  return parsed;
}

/** Tagged values preserve undefined and Map contents; only key order is immaterial. */
function stableContents(value: unknown, ancestors = new Set<object>()): string {
  if (value === undefined) return "undefined";
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
  if (typeof value !== "object" || value === null) throw new TypeError("Unsupported acquisition fingerprint value");
  if (ancestors.has(value)) throw new TypeError("Cyclic acquisition evidence");
  ancestors.add(value);
  try {
    if (Array.isArray(value)) return `array[${value.map(item => stableContents(item, ancestors)).join(",")}]`;
    const isMap = value instanceof Map;
    if (!isMap && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
      throw new TypeError("Unsupported acquisition evidence object");
    const entries: [string, unknown][] = isMap ? [...value.entries()] : Object.entries(value);
    if (entries.some(([key]) => typeof key !== "string")) throw new TypeError("Acquisition Map keys must be strings");
    entries.sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0);
    return `${isMap ? "map" : "object"}{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableContents(item, ancestors)}`).join(",")}}`;
  } finally { ancestors.delete(value); }
}

function fingerprint(kind: string, value: unknown): string {
  return `homepage-${kind}-v1:${sha256(stableContents(value))}`;
}

function mapPairs(values: Readonly<Record<string, string>>, reasons: string[]): Map<string, string> {
  const pairs = new Map<string, string>();
  for (const [key, value] of Object.entries(values).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)) {
    const pair = /^[A-Z]{3}$/.test(key) && key !== "CNY" ? `${key}/CNY` : /^[A-Z]{3}\/CNY$/.test(key) && key !== "CNY/CNY" ? key : null;
    if (!pair) { reasons.push(`fx-pair-unsupported:${key}`); continue; }
    if (pairs.has(pair) && pairs.get(pair) !== value) reasons.push(`fx-pair-alias-conflict:${pair}`);
    else pairs.set(pair, value);
  }
  return pairs;
}

function captureFx(input: NonNullable<HomepageFinancialAcquisitionInput["fx"]>, observed: bigint): {
  current: CurrentFxEvidence | null;
  receipt: NonNullable<HomepageFinancialAcquisitionReceipt["fx"]>;
} {
  // Only this small receipt is copied here. S1 owns/copies the complete financial source.
  const state = { ...input.state, rates: { ...input.state.rates }, publishedAtByCurrency: { ...input.state.publishedAtByCurrency } };
  const reasons: string[] = [];
  const rates = mapPairs(state.rates, reasons);
  const publications = mapPairs(state.publishedAtByCurrency, reasons);
  const publishedAtByPair: Record<string, string> = {};
  for (const [pair, time] of publications) {
    const at = instant(time);
    if (at !== null && at <= observed) publishedAtByPair[pair] = time;
    else reasons.push(`fx-pair-publication-unusable:${pair}`);
  }
  for (const pair of rates.keys()) if (!publications.has(pair)) reasons.push(`fx-pair-publication-missing:${pair}`);
  const snapshotAsOfOrigin = state.publishedAt === null ? "client-observed" : "provider-published";
  // Observation fallback dates this captured snapshot, never the provider's publication.
  const asOf = state.publishedAt ?? input.observedAt;
  const snapshotTime = instant(asOf);
  if (snapshotTime === null || snapshotTime > observed) reasons.push("fx-snapshot-publication-unusable");
  if (state.fetchedAt !== null) {
    const attempt = instant(state.fetchedAt);
    if (attempt === null || attempt > observed) reasons.push("fx-provider-attempt-unusable");
  }
  if (!state.id || state.baseCurrency !== "CNY" || state.source !== "BOC" || !["complete", "partial", "missing"].includes(state.status))
    reasons.push("fx-identity-unusable");
  const sourceRevision = fingerprint("fx-body", state);
  const evidenceId = fingerprint("fx-observation", { state, observedAt: input.observedAt });
  const receipt: NonNullable<HomepageFinancialAcquisitionReceipt["fx"]> = {
    state, observedAt: input.observedAt, knowledgePolicy: "client-body-observed", upstreamFetchedAtSemantics: "provider-attempt-start",
    snapshotAsOfOrigin, sourceRevision, evidenceId, reasons: [...new Set(reasons)].sort(),
  };
  const unusable = reasons.some(reason => reason.startsWith("fx-pair-alias-conflict:") ||
    ["fx-snapshot-publication-unusable", "fx-provider-attempt-unusable", "fx-identity-unusable"].includes(reason));
  return { receipt, current: unusable ? null : {
    snapshot: { id: state.id, baseCurrency: "CNY", source: state.source, status: state.status, asOf, rates: Object.fromEntries(rates) },
    fetchedAt: input.observedAt, publishedAtByPair, sourceRevision, evidenceIds: [evidenceId],
  } };
}

/** Pure assembly Seam. Caller captures clocks/IO; S1 alone owns and selects the raw source. */
export function buildHomepageFinancialAcquisition(input: HomepageFinancialAcquisitionInput): Readonly<{
  raw: HomepageFinancialRawSource;
  receipt: HomepageFinancialAcquisitionReceipt;
}> {
  const requested = captureTime(input.requestedAt, "requestedAt");
  const completed = captureTime(input.completedAt, "completedAt");
  let fx: ReturnType<typeof captureFx> | null = null;
  if (input.fx) {
    const observed = captureTime(input.fx.observedAt, "observedAt");
    if (requested > observed) throw new RangeError("requestedAt must not follow observedAt");
    if (observed > completed) throw new RangeError("observedAt must not follow completedAt");
    fx = captureFx(input.fx, observed);
  } else if (requested > completed) throw new RangeError("requestedAt must not follow completedAt");
  if (input.reviewSummariesComplete && input.provenance.reviewSummaries === null)
    throw new TypeError("Complete reviewSummaries require the actual response");
  const { entries, instrumentMetadata, candlesByInstrument, marketDataStatuses, reviewSummariesComplete, provenance } = input;
  return {
    raw: {
      asOf: input.completedAt, entries, instrumentMetadata, candlesByInstrument, marketDataStatuses, reviewSummariesComplete,
      fxObservations: [], lifetimeSourceCoverage: [], currentFxSnapshot: fx?.current ?? null,
      universeCoverage: { state: "unknown", knownAt: null, evidenceIds: [], reasons: ["stored-universe-coverage-unproved"] },
      revisions: {
        trades: fingerprint("trades", { entries, importHistory: provenance.importHistory, reviews: provenance.reviews,
          reviewSummaries: provenance.reviewSummaries, reviewSummariesComplete }),
        metadata: fingerprint("metadata", { instrumentMetadata, storedInstruments: provenance.storedInstruments }),
        quotes: fingerprint("quotes", { candlesByInstrument, marketDataStatuses, dailyCoverageByInstrument: provenance.dailyCoverageByInstrument }),
        fx: fingerprint("fx", input.fx),
      },
    },
    receipt: { policy: "acquisition-completed-v1", requestedAt: input.requestedAt, completedAt: input.completedAt, fx: fx?.receipt ?? null },
  };
}


/**
 * One atomic stored read, one statement projection, then the existing market IO /
 * entries assembly. The handle is temporary; complete or dispose releases it.
 * Missing storage evidence cannot upgrade the legacy unknown-only assembly path.
 */
export function prepareHomepageFinancialAcquisition(stored: HomepageStoredCollection): Readonly<{
  executions: readonly TradeExecution[];
  complete(input: HomepageAcquisitionCompletionInput): Readonly<{
    raw: HomepageFinancialRawSource;
    receipt: HomepageFinancialAcquisitionReceipt;
  }>;
  dispose(): void;
}> {
  assertHomepageSourceShape(stored);
  const originalDigest = stored.receipt.payloadDigest;
  if (`sha256:${sha256(encodeHomepageSourceBinding(stored))}` !== originalDigest)
    throw new Error("Homepage stored source binding mismatch");
  let retained: HomepageStoredCollection | null = stored;
  let projection: ReturnType<typeof projectMonthlyHistoryEvidence> | null = projectMonthlyHistoryEvidence(
    stored.bootstrap.executions.filter(execution => execution.source.platform !== "demo"), stored.bootstrap.importHistory,
  );
  const dispose = () => { projection = null; retained = null; };
  const requireOpen = () => {
    if (!projection || !retained) throw new Error("Homepage acquisition is closed");
    return { projection, retained };
  };
  return Object.freeze({
    get executions() { return requireOpen().projection.executions; },
    complete(input: HomepageAcquisitionCompletionInput) {
      const active = requireOpen();
      try {
        // Recheck actual contents after IO, including receipt identity/counts/diagnostics.
        assertHomepageSourceShape(active.retained);
        if (active.retained.receipt.payloadDigest !== originalDigest ||
            `sha256:${sha256(encodeHomepageSourceBinding(active.retained))}` !== originalDigest)
          throw new Error("Homepage stored source binding mismatch");
        const requested = captureTime(input.requestedAt, "requestedAt");
        const completed = captureTime(input.completedAt, "completedAt");
        const known = captureTime(active.retained.receipt.knownAt, "stored knownAt");
        if (known < requested || known > completed)
          throw new RangeError("Stored knownAt must be between requestedAt and completedAt");
        const inspection = active.projection.inspectOriginalCarriers(input.entries.flatMap(entry => entry.executions));
        const storage = active.retained.receipt;
        const gaps = [...inspection.gaps, ...storage.projectionGaps.map(id => ({ sourceRef: `import:${id}`, reason: "storage-projection-gap" }))]
          .sort((left, right) => left.sourceRef.localeCompare(right.sourceRef) || left.reason.localeCompare(right.reason));
        const representationBase = {
          policy: "stored-financial-representation-v1" as const, storedReceiptId: storage.receiptId,
          payloadDigest: originalDigest, state: gaps.length ? "unknown" as const : "complete" as const,
          gapCount: gaps.length, gaps: gaps.slice(0, 64),
        };
        const acquired = buildHomepageFinancialAcquisition({ ...input, reviewSummariesComplete: true, provenance: {
          importHistory: active.retained.bootstrap.importHistory, reviews: active.retained.bootstrap.reviews,
          reviewSummaries: active.retained.recallSummaries, storedInstruments: active.retained.bootstrap.instruments,
          dailyCoverageByInstrument: input.dailyCoverageByInstrument,
        } });
        const entriesRevision = fingerprint("represented-trades", { trades: acquired.raw.revisions.trades,
          representation: representationBase, universeReasons: inspection.universeReasons });
        const representation: StoredRepresentationReceipt = { ...representationBase, entriesRevision };
        const reasons = [...new Set([...inspection.universeReasons, ...gaps.map(gap => gap.reason)])].sort();
        return {
          raw: { ...acquired.raw, revisions: { ...acquired.raw.revisions, trades: entriesRevision }, universeCoverage: {
            state: reasons.length ? "unknown" as const : "complete" as const,
            knownAt: input.completedAt, evidenceIds: [storage.receiptId, entriesRevision], reasons,
          } },
          receipt: { ...acquired.receipt, representation },
        };
      } finally { dispose(); }
    },
    dispose,
  });
}
