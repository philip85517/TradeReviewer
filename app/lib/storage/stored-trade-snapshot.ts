import { createHash, randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { Temporal } from "@js-temporal/polyfill";
import { BookVersionChangedError, readBookVersion, type BookVersion } from "./trade-book-version";
import { copySourceMaterialRows, materializeSourceMaterialContext, projectEvidence, explainMaterial, periodBounds, type EvidenceSelection, type SourceMaterialRows, type Json } from "./source-materials";

export type StoredTradeSelection = EvidenceSelection & {
  version?: { exact: BookVersion } | { atLeast: BookVersion };
  cursor?: string; pageSize?: number;
};
type RawRow = Record<string, unknown>;
export type StoredTradeSnapshotRows = {
  bookVersion: BookVersion; facts: RawRow[]; states: RawRow[]; source: SourceMaterialRows;
};
export type StoredTradeFact = {
  id: string; instrumentId: string; accountId: string | null; side: string; executedAt: string;
  quantity: string; price: string; fee: string | null; currency: string | null;
  tradeNature: string | null; simulationRunId: string | null; importBatchId: string | null;
  rawEvidenceJson: string | null; evidence: Json;
  instrument: { id: string; symbol: string; name: string; market: string; currency: string };
};

/** Raw copy only. No BEGIN, COMMIT, JSON parsing, hashing or scope materialization. */
export function copyStoredTradeSnapshotRows(database: DatabaseSync): StoredTradeSnapshotRows {
  return {
    bookVersion: readBookVersion(database),
    facts: database.prepare("select e.*,i.id as joined_instrument_id,i.symbol as instrument_symbol,i.name as instrument_name,i.market as instrument_market,i.currency as instrument_currency from executions e left join instruments i on i.id=e.instrument_id order by e.id").all(),
    states: database.prepare("select * from execution_fact_states order by execution_id").all(),
    source: copySourceMaterialRows(database),
  };
}
function text(value: unknown, label: string): string {
  if (typeof value !== "string") throw new Error(`Invalid stored fact ${label}`);
  return value;
}
function nullable(value: unknown, label: string): string | null { return value === null ? null : text(value, label); }
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`).join(",")}}`;
  return JSON.stringify(value);
}
function hash(value: unknown) { return `sha256:${createHash("sha256").update(stable(value)).digest("hex")}`; }
function same(actual: BookVersion, expected: BookVersion, atLeast = false) {
  if (actual.databaseId !== expected.databaseId || actual.epoch !== expected.epoch || (atLeast ? actual.sequence < expected.sequence : actual.sequence !== expected.sequence)) throw new BookVersionChangedError(expected, actual);
}
function validVersion(value: unknown): value is BookVersion {
  if (!value || typeof value !== "object") return false;
  const v = value as BookVersion;
  return typeof v.databaseId === "string" && !!v.databaseId.trim() && typeof v.epoch === "string" && !!v.epoch.trim() && Number.isSafeInteger(v.sequence) && v.sequence >= 0;
}
function validateSelection(selection: StoredTradeSelection) {
  for (const name of ["accounts", "markets", "instruments"] as const) {
    if (selection[name] !== undefined && (!Array.isArray(selection[name]) || selection[name]!.some(v => typeof v !== "string" || !v.trim()))) throw new Error(`Invalid selection ${name}`);
  }
  if (selection.period) periodBounds(selection.period);
  if (selection.pageSize !== undefined && (!Number.isSafeInteger(selection.pageSize) || selection.pageSize < 1 || selection.pageSize > 1000)) throw new Error("Invalid page size (1..1000)");
  if (selection.version) {
    const v = selection.version;
    if (("exact" in v) === ("atLeast" in v) || !validVersion("exact" in v ? v.exact : v.atLeast)) throw new Error("Invalid version requirement");
  }
}
function normalizeSelection(selection: StoredTradeSelection) {
  const axis = (values: readonly string[] | undefined) => values === undefined ? null : [...new Set(values)].sort();
  return { accounts: axis(selection.accounts), markets: axis(selection.markets), instruments: axis(selection.instruments), period: selection.period ?? null, pageSize: selection.pageSize ?? 500 };
}
type Cursor = { policy: "stored-trades-page-v1"; bookVersion: BookVersion; selectionDigest: string; offset: number };
function decodeCursor(value: string): Cursor {
  let cursor: Cursor;
  try { cursor = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Cursor; } catch { throw new Error("Invalid snapshot cursor"); }
  if (!cursor || cursor.policy !== "stored-trades-page-v1" || !validVersion(cursor.bookVersion) || typeof cursor.selectionDigest !== "string" || !Number.isSafeInteger(cursor.offset) || cursor.offset < 1) throw new Error("Invalid snapshot cursor");
  return cursor;
}
function fact(row: RawRow): StoredTradeFact {
  if (row.joined_instrument_id === null) throw new Error("Stored source contains orphan execution");
  const rawEvidenceJson = nullable(row.evidence_json, "evidence");
  return {
    id: text(row.id, "id"), instrumentId: text(row.instrument_id, "instrument"), accountId: nullable(row.account, "account"),
    side: text(row.side, "side"), executedAt: text(row.executed_at, "date"), quantity: text(row.quantity, "quantity"), price: text(row.price, "price"),
    fee: nullable(row.fee, "fee"), currency: nullable(row.currency, "currency"), tradeNature: nullable(row.trade_nature, "nature"), simulationRunId: nullable(row.simulation_run_id, "simulation"), importBatchId: nullable(row.import_batch_id, "batch"), rawEvidenceJson,
    evidence: rawEvidenceJson === null ? null : JSON.parse(rawEvidenceJson) as Json,
    instrument: { id: text(row.joined_instrument_id, "joined instrument"), symbol: text(row.instrument_symbol, "symbol"), name: text(row.instrument_name, "name"), market: text(row.instrument_market, "market"), currency: text(row.instrument_currency, "instrument currency") },
  };
}

/** Pure materialization: safe after COMMIT, even after closing the connection. */
export function materializeStoredTradeSnapshot(raw: StoredTradeSnapshotRows, selection: StoredTradeSelection = {}) {
  validateSelection(selection);
  if (selection.version) same(raw.bookVersion, "exact" in selection.version ? selection.version.exact : selection.version.atLeast, "atLeast" in selection.version);
  const normalized = normalizeSelection(selection), selectionDigest = hash(normalized);
  const cursor = selection.cursor === undefined ? null : decodeCursor(selection.cursor);
  if (cursor) {
    same(raw.bookVersion, cursor.bookVersion);
    if (cursor.selectionDigest !== selectionDigest) throw new Error("Snapshot cursor selection changed");
  }
  const bounds = selection.period ? periodBounds(selection.period) : null;
  const facts = raw.facts.map(fact).map(value => {
    try {
      // Match the accepted write validator: retain a real calendar day, or
      // require an explicit offset for an instant; never normalize bad dates.
      const time = /^\d{4}-\d{2}-\d{2}$/.test(value.executedAt)
        ? Temporal.PlainDate.from(value.executedAt, { overflow: "reject" }).toZonedDateTime("UTC").epochMilliseconds
        : Temporal.Instant.from(value.executedAt).epochMilliseconds;
      return { value, time };
    } catch { throw new Error(`Invalid stored execution time ${value.id}`); }
  }).filter(({ value, time }) =>
    (!selection.accounts || (value.accountId !== null && selection.accounts.includes(value.accountId))) && (!selection.markets || selection.markets.includes(value.instrument.market)) && (!selection.instruments || selection.instruments.includes(value.instrumentId)) && (!bounds || time <= bounds.to)
  ).sort((a, b) => a.time - b.time || (a.value.id < b.value.id ? -1 : a.value.id > b.value.id ? 1 : 0));
  const stateById = new Map(raw.states.map(row => [text(row.execution_id, "state id"), row]));
  const withdrawnFacts = facts.filter(({ value }) => stateById.get(value.id)?.state === "withdrawn").map(({ value }) => {
    const state = stateById.get(value.id)!;
    const audit = raw.source.revisions.find(r => r.id === state.revision_id);
    if (!audit) throw new Error(`Missing withdrawal audit ${value.id}`);
    return { fact: value, state: { state: "withdrawn" as const, revisionId: text(state.revision_id, "revision"), reason: text(state.reason, "reason"), recordedAt: text(state.recorded_at, "state date") }, audit: { id: text(audit.id, "audit"), requestJson: text(audit.request_json, "audit request"), revisionJson: text(audit.revision_json, "audit revision") } };
  });
  const active = facts.filter(({ value }) => {
    const state = stateById.get(value.id);
    if (state && state.state !== "active" && state.state !== "withdrawn") throw new Error(`Invalid execution state ${value.id}`);
    return state?.state !== "withdrawn";
  });
  const dependencies = bounds ? active.filter(f => f.time < bounds.from) : [];
  const display = active.filter(f => !bounds || f.time >= bounds.from);
  const offset = cursor?.offset ?? 0;
  if (offset > display.length) throw new Error("Snapshot cursor exceeds result size");
  const page = display.slice(offset, offset + normalized.pageSize);
  const nextOffset = offset + page.length;
  const nextCursor = nextOffset < display.length ? Buffer.from(JSON.stringify({ policy: "stored-trades-page-v1", bookVersion: raw.bookVersion, selectionDigest, offset: nextOffset } satisfies Cursor)).toString("base64url") : null;
  const sourceContext = materializeSourceMaterialContext(raw.source);
  // Kept, predecessor and withdrawn facts retain their original source history,
  // even when a newer version is now outside the requested scope. Their old
  // histories do not reintroduce unrelated current gaps or prove an opening.
  const evidence = projectEvidence(sourceContext, selection);
  const beforePeriod = bounds ? projectEvidence(sourceContext, { accounts: selection.accounts, markets: selection.markets, instruments: selection.instruments }) : null;
  const dependencyMaterials = beforePeriod?.materials.filter(m => m.version.scope.periods.unknown || m.version.scope.periods.values.some(p => periodBounds(p).from < bounds!.from)) ?? [];
  const dependencyMaterialIds = new Set(dependencyMaterials.map(m => m.id));
  const dependencyDiagnostics = beforePeriod?.diagnostics.filter(d => d.materialId !== undefined && dependencyMaterialIds.has(d.materialId)) ?? [];
  const factIds = new Set([...dependencies, ...page].map(f => f.value.id).concat(withdrawnFacts.map(f => f.fact.id)));
  const linkedMaterialIds = sourceContext.versions.filter(v => v.observations.some(o => o.executionIds.some(id => factIds.has(id)))).map(v => v.materialId);
  const historyIds = [...new Set([...evidence.materials.map(m => m.id), ...dependencyMaterialIds, ...linkedMaterialIds])].sort();
  const materialHistory = historyIds.map(id => explainMaterial(sourceContext, id));
  const scope = { selection: normalized, predecessors: bounds ? "all-prior-facts" as const : "not-requested" as const, coverage: "not-proven" as const, financialAmounts: "not-evaluated" as const };
  const data = { bookVersion: raw.bookVersion, facts: [...dependencies, ...page].map(f => f.value), displayExecutionIds: page.map(f => f.value.id), dependencyExecutionIds: dependencies.map(f => f.value.id), withdrawnFacts, materials: evidence.materials, dependencyMaterials, materialHistory, diagnostics: evidence.diagnostics, dependencyDiagnostics, scope, nextCursor };
  const receipt = { policy: "stored-trade-snapshot-v1" as const, receiptId: randomUUID(), knownAt: new Date().toISOString(), selectionDigest, totalDisplayFacts: display.length, totalDependencyFacts: dependencies.length, displayOffset: offset, pageComplete: nextCursor === null, payloadDigest: hash(data) };
  return { ...data, receipt };
}

/** One short, synchronous, consistent copy transaction. Complex work runs after COMMIT. */
export function readStoredTradeSnapshot(database: DatabaseSync, selection: StoredTradeSelection = {}) {
  validateSelection(selection);
  // A failed BEGIN must never roll back a transaction owned by the caller.
  database.exec("begin deferred");
  let raw: StoredTradeSnapshotRows;
  try {
    raw = copyStoredTradeSnapshotRows(database);
    database.exec("commit");
  } catch (error) {
    database.exec("rollback");
    throw error;
  }
  return materializeStoredTradeSnapshot(raw, selection);
}
