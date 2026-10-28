import { createHash } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { isMonthlyStatement, isMonthlyEvidenceScope, type MonthlyStatement } from "../import/monthly-statement";
import { isLegacyImportHistoryEntry } from "./import-history-contract";
import { TRADINGVIEW_CANONICAL_ACCOUNT_ID } from "../trades/tradingview-account-identity";

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type JsonObject = { [key: string]: Json };
export type ScopeAxis<T = string> = { values: T[]; unknown: boolean };
export type Period = { from: string; to: string };
export type MaterialScope = {
  accounts: ScopeAxis; markets: ScopeAxis; instruments: ScopeAxis; periods: ScopeAxis<Period>;
};
export type EvidenceSelection = { accounts?: readonly string[]; markets?: readonly string[]; instruments?: readonly string[]; period?: Period };
export type MaterialDiagnostic = { code: string; materialId?: string; versionId?: string; detail?: string };
export type MaterialObservationInput = {
  id: string; key?: string | null; locator: JsonObject; raw: Json; originalAccountId?: string | null;
  executionIds: string[]; linkReason: string;
};
export type MaterialVersionInput = {
  materialId: string; versionId: string; parserVersion: string; sourceKind: string;
  locator: JsonObject; fileFingerprint: string | null; recordedAt: string; scope: MaterialScope;
  diagnostics: MaterialDiagnostic[]; content: JsonObject; observations: MaterialObservationInput[];
  /** Compatibility projection only; source versions retain every prior projection. */
  historyProjection?: { batchId: string; reconciliation: JsonObject };
  /** Explicit mappings for this material only; never rewrites execution facts. */
  accountMappings?: { originalAccountId: string; canonicalAccountId: string | null; reason: string; auditReference: string; recordedAt: string }[];
};
type Row = Record<string, string | number | bigint | null | Uint8Array>;
export type SourceMaterialRows = {
  materials: Row[]; versions: Row[]; observations: Row[]; links: Row[]; mappings: Row[]; revisions: Row[];
};
export type MaterialObservation = {
  id: string; versionId: string; key: string | null; identityStatus: "located" | "unresolved";
  locator: JsonObject; raw: Json; originalAccountId: string | null; executionIds: string[];
};
export type MaterialVersion = {
  id: string; materialId: string; supersedesVersionId: string | null; parserVersion: string; sourceKind: string;
  locator: JsonObject; fileFingerprint: string | null; scope: MaterialScope; diagnostics: MaterialDiagnostic[];
  content: JsonObject; recordedAt: string; observations: MaterialObservation[]; monthly?: MonthlyStatement;
  legacy: { batchId: string; batchJson: string | null; reconciliationJson: string | null; evidenceJson: string | null; revisionRequestJson: string | null } | null;
};
export type SourceMaterialContext = {
  materials: { id: string; currentVersionId: string | null; createdAt: string }[];
  versions: MaterialVersion[]; mappings: Row[]; revisions: { id: string; requestJson: string; revisionJson: string }[];
};
export type MissingExecutionDependency = {
  executionId: string; previousObservationIds: string[]; otherSourceObservationIds: string[]; revisionIds: string[];
};
export type MissingExecutionDecision = { executionId: string; action: "keep" | "withdraw"; reason?: string };
export type PreparedMaterialChanges = {
  policy: "source-material-changes-v1"; input: MaterialVersionInput; expectedCurrentVersionId: string | null;
  missingExecutions: MissingExecutionDependency[]; dependencyDigest: string; digest: string;
};

/** Detached raw SQL copy; the caller owns the read transaction and its lifetime. */
export function copySourceMaterialRows(database: DatabaseSync): SourceMaterialRows {
  return {
    materials: database.prepare("select * from source_materials order by id").all(),
    versions: database.prepare("select * from source_material_versions order by id").all(),
    observations: database.prepare("select * from source_observations order by id").all(),
    links: database.prepare("select * from source_execution_links order by observation_id,execution_id").all(),
    mappings: database.prepare("select * from source_material_account_mappings order by material_id,original_account_id").all(),
    revisions: database.prepare("select id,request_json,revision_json from trade_revisions order by id").all(),
  };
}
function str(value: unknown): string { if (typeof value !== "string") throw new Error("Invalid material storage string"); return value; }
function nullable(value: unknown): string | null { return value === null ? null : str(value); }
function object(value: unknown): value is Record<string, unknown> { return !!value && typeof value === "object" && !Array.isArray(value); }
function parse(value: unknown): Json { return JSON.parse(str(value)) as Json; }
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (object(value)) return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stable(value[k])}`).join(",")}}`;
  return JSON.stringify(value);
}
function digest(value: unknown): string { return `sha256:${createHash("sha256").update(stable(value)).digest("hex")}`; }
function frozen<T>(value: T): T {
  if (value && typeof value === "object") { for (const v of Object.values(value)) frozen(v); Object.freeze(value); }
  return value;
}
function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
function assertJson(value: unknown, ancestors = new Set<object>()): void {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number" && Number.isFinite(value)) return;
  if (!value || typeof value !== "object" || ancestors.has(value)
    || (!Array.isArray(value) && ![Object.prototype, null].includes(Object.getPrototypeOf(value)))) throw new Error("Material input must be finite, acyclic JSON");
  ancestors.add(value);
  for (const item of Object.values(value)) assertJson(item, ancestors);
  ancestors.delete(value);
}
function nonempty(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`Invalid ${label}`);
}
const unknownScope = (): MaterialScope => ({ accounts: { values: [], unknown: true }, markets: { values: [], unknown: true }, instruments: { values: [], unknown: true }, periods: { values: [], unknown: true } });

/** Date-only bounds retain date precision; timestamps must carry an explicit zone. */
export function periodBounds(period: Period): { from: number; to: number } {
  const bound = (value: string, end: boolean) => {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value)) throw new Error("Invalid period date");
    const day = value.slice(0, 10);
    const dayTime = Date.parse(`${day}T00:00:00Z`);
    if (!Number.isFinite(dayTime) || new Date(dayTime).toISOString().slice(0, 10) !== day) throw new Error("Invalid period date");
    const time = Date.parse(value.length === 10 ? `${value}T00:00:00Z` : value);
    if (!Number.isFinite(time)) throw new Error("Invalid period date");
    return time + (value.length === 10 && end ? 86_400_000 - 1 : 0);
  };
  const from = bound(period.from, false), to = bound(period.to, true);
  if (from > to) throw new Error("Invalid period range");
  return { from, to };
}
function validateScope(value: MaterialScope): void {
  for (const name of ["accounts", "markets", "instruments", "periods"] as const) {
    const axis = value?.[name];
    if (!axis || typeof axis.unknown !== "boolean" || !Array.isArray(axis.values)) throw new Error(`Invalid scope ${name}`);
    if (name === "periods") for (const period of value.periods.values) periodBounds(period);
    else for (const item of value[name].values) nonempty(item, `scope ${name}`);
  }
}
function legacyMonthly(raw: string | null, revisionRaw: string | null): { monthly?: MonthlyStatement; diagnostic?: string } {
  if (raw === null) return {};
  let entry: unknown;
  try { entry = JSON.parse(raw); } catch { return { diagnostic: "LEGACY_HISTORY_INVALID" }; }
  if (!object(entry)) return { diagnostic: "LEGACY_HISTORY_INVALID" };
  if (entry.monthly === undefined) return {};
  if (!isMonthlyStatement(entry.monthly)) return { diagnostic: "MONTHLY_EVIDENCE_INVALID" };
  const monthly = entry.monthly;
  if (typeof entry.id !== "string" || !entry.id.startsWith("supplement:") || entry.instrumentCount !== 1) return { monthly };
  let request: unknown;
  try { request = JSON.parse(revisionRaw ?? "null"); } catch { /* Explicitly unproven below. */ }
  if (!object(request) || request.id !== entry.id || !object(request.importHistory)
    || request.importHistory.id !== entry.id || request.importHistory.instrumentCount !== 1) return { diagnostic: "SCOPED_SUPPLEMENT_UNPROVEN" };
  const evidenceScope = { instrumentId: request.instrumentId, accountId: request.accountId };
  const audit = request.importHistory.monthly;
  if (!isMonthlyEvidenceScope(evidenceScope) || !isMonthlyStatement(audit)
    || audit.documentId !== monthly.documentId || audit.accountId !== evidenceScope.accountId
    || (monthly.accountId !== undefined && monthly.accountId !== evidenceScope.accountId)
    || (monthly.evidenceScope !== undefined && (monthly.evidenceScope.instrumentId !== evidenceScope.instrumentId || monthly.evidenceScope.accountId !== evidenceScope.accountId))) return { diagnostic: "SCOPED_SUPPLEMENT_UNPROVEN" };
  return { monthly: { ...monthly, evidenceScope } };
}
function scopeFromMonthly(monthly: MonthlyStatement): MaterialScope {
  const scope = unknownScope();
  if (monthly.accountId?.trim()) scope.accounts = { values: [monthly.accountId], unknown: false };
  if (monthly.evidenceScope) {
    scope.accounts = { values: [monthly.evidenceScope.accountId], unknown: false };
    scope.instruments = { values: [monthly.evidenceScope.instrumentId], unknown: false };
    scope.markets = { values: [monthly.evidenceScope.instrumentId.split(":")[0]], unknown: false };
  }
  if (monthly.month && /^\d{4}-(0[1-9]|1[0-2])$/.test(monthly.month)) {
    const from = `${monthly.month}-01`;
    const next = new Date(`${from}T00:00:00Z`); next.setUTCMonth(next.getUTCMonth() + 1);
    const to = new Date(next.getTime() - 86_400_000).toISOString().slice(0, 10);
    scope.periods = { values: [{ from, to }], unknown: false };
  }
  return scope;
}

/** Parsing, scope projection and diagnostics happen on the detached copy. */
export function materializeSourceMaterialContext(rows: SourceMaterialRows): SourceMaterialContext {
  const observations: MaterialObservation[] = rows.observations.map(row => ({
    id: str(row.id), versionId: str(row.version_id), key: nullable(row.observation_key),
    identityStatus: row.identity_status === "located" ? "located" : "unresolved",
    locator: parse(row.locator_json) as JsonObject, raw: row.raw_json === null ? null : parse(row.raw_json),
    originalAccountId: nullable(row.original_account_id),
    executionIds: rows.links.filter(link => link.observation_id === row.id).map(link => str(link.execution_id)),
  }));
  const versions = rows.versions.map(row => {
    let scope = parse(row.scope_json) as MaterialScope; validateScope(scope);
    const diagnostics = parse(row.diagnostics_json) as MaterialDiagnostic[];
    if (!Array.isArray(diagnostics)) throw new Error("Invalid material diagnostics");
    const legacy = row.legacy_batch_id === null ? null : {
      batchId: str(row.legacy_batch_id), batchJson: nullable(row.legacy_batch_json),
      reconciliationJson: nullable(row.raw_reconciliation_json), evidenceJson: nullable(row.raw_evidence_json), revisionRequestJson: nullable(row.legacy_revision_request_json),
    };
    const content = parse(row.content_json) as JsonObject;
    const projection = object(content.historyProjection) ? content.historyProjection.reconciliation : undefined;
    const newMonthly = object(projection) ? projection.monthly : content.monthly;
    const projected = legacy ? legacyMonthly(legacy.reconciliationJson, legacy.revisionRequestJson)
      : isMonthlyStatement(newMonthly) ? { monthly: newMonthly } : {};
    if (legacy && projected.monthly) scope = scopeFromMonthly(projected.monthly);
    if (projected.diagnostic) diagnostics.push({ code: projected.diagnostic });
    const mappings = rows.mappings.filter(m => m.material_id === row.material_id);
    const account = (id: string) => {
      const mapping = mappings.find(m => m.original_account_id === id); return mapping ? str(mapping.canonical_account_id) : id;
    };
    scope.accounts.values = [...new Set(scope.accounts.values.map(account))];
    const monthly = projected.monthly ? {
      ...projected.monthly,
      ...(projected.monthly.accountId === undefined ? {} : { accountId: account(projected.monthly.accountId) }),
      ...(projected.monthly.evidenceScope ? { evidenceScope: { ...projected.monthly.evidenceScope, accountId: account(projected.monthly.evidenceScope.accountId) } } : {}),
      positions: projected.monthly.positions.map(p => ({ ...p, accountId: account(p.accountId) })),
      events: projected.monthly.events.map(e => ({ ...e, accountId: account(e.accountId) })),
    } : undefined;
    const owned = observations.filter(o => o.versionId === row.id);
    if (owned.some(o => o.identityStatus === "unresolved")) diagnostics.push({ code: "OBSERVATION_POSITION_UNKNOWN" });
    return { id: str(row.id), materialId: str(row.material_id), supersedesVersionId: nullable(row.supersedes_version_id), parserVersion: str(row.parser_version), sourceKind: str(row.source_kind), locator: parse(row.locator_json) as JsonObject, fileFingerprint: nullable(row.file_fingerprint), scope, diagnostics, content, recordedAt: str(row.recorded_at), observations: owned, legacy, ...(monthly ? { monthly } : {}) };
  });
  return frozen({ materials: rows.materials.map(r => ({ id: str(r.id), currentVersionId: nullable(r.current_version_id), createdAt: str(r.created_at) })), versions, mappings: clone(rows.mappings), revisions: rows.revisions.map(r => ({ id: str(r.id), requestJson: str(r.request_json), revisionJson: str(r.revision_json) })) });
}
function current(context: SourceMaterialContext) { return context.materials.flatMap(m => context.versions.filter(v => v.id === m.currentVersionId)); }
export function explainMaterial(context: SourceMaterialContext, materialId: string) {
  const material = context.materials.find(m => m.id === materialId);
  if (!material) throw new Error(`Unknown source material ${materialId}`);
  return { ...material, versions: context.versions.filter(v => v.materialId === materialId), accountMappings: context.mappings.filter(m => m.material_id === materialId) };
}
export function projectEvidence(context: SourceMaterialContext, selection: EvidenceSelection = {}) {
  if (selection.period) periodBounds(selection.period);
  const relevant = current(context).filter(v => {
    for (const name of ["accounts", "markets", "instruments"] as const) {
      const wanted = selection[name]; const axis = v.scope[name];
      if (wanted && !axis.unknown && !axis.values.some(id => wanted.includes(id))) return false;
    }
    if (selection.period && !v.scope.periods.unknown) {
      const wanted = periodBounds(selection.period);
      if (!v.scope.periods.values.some(p => { const b = periodBounds(p); return b.from <= wanted.to && b.to >= wanted.from; })) return false;
    }
    return true;
  });
  const diagnostics: MaterialDiagnostic[] = relevant.flatMap(v => [
    ...v.diagnostics.map(d => ({ ...d, materialId: v.materialId, versionId: v.id })),
    ...Object.entries(v.scope).filter(([, axis]) => axis.unknown).map(([axis]) => ({ code: "SCOPE_UNKNOWN", materialId: v.materialId, versionId: v.id, detail: axis })),
  ]);
  return { materials: relevant.map(version => ({ id: version.materialId, version })), diagnostics, coverage: "not-proven" as const };
}
function revisionTouches(requestJson: string, executionId: string): boolean {
  const request: unknown = JSON.parse(requestJson);
  return object(request) && Array.isArray(request.changes) && request.changes.some(change => object(change) && [change.before, change.after].some(fact => object(fact) && fact.id === executionId));
}
function missingDependencies(context: SourceMaterialContext, input: MaterialVersionInput): MissingExecutionDependency[] {
  const previous = current(context).find(v => v.materialId === input.materialId);
  const proposed = new Set(input.observations.flatMap(o => o.executionIds));
  return [...new Set(previous?.observations.flatMap(o => o.executionIds) ?? [])].filter(id => !proposed.has(id)).sort().map(executionId => ({
    executionId,
    previousObservationIds: previous!.observations.filter(o => o.executionIds.includes(executionId)).map(o => o.id).sort(),
    otherSourceObservationIds: current(context).filter(v => v.materialId !== input.materialId).flatMap(v => v.observations.filter(o => o.executionIds.includes(executionId)).map(o => o.id)).sort(),
    revisionIds: context.revisions.filter(r => revisionTouches(r.requestJson, executionId)).map(r => r.id).sort(),
  }));
}
function dependencyDigest(context: SourceMaterialContext, input: MaterialVersionInput) {
  const previous = current(context).find(v => v.materialId === input.materialId) ?? null;
  const missing = missingDependencies(context, input);
  const ids = new Set(missing.flatMap(m => m.revisionIds));
  return digest({ previous, missing, revisions: context.revisions.filter(r => ids.has(r.id)), mappings: context.mappings.filter(m => m.material_id === input.materialId) });
}
function validateInput(input: MaterialVersionInput): void {
  for (const key of ["materialId", "versionId", "parserVersion", "sourceKind", "recordedAt"] as const) nonempty(input[key], key);
  if (input.fileFingerprint !== null) nonempty(input.fileFingerprint, "file fingerprint");
  validateScope(input.scope);
  if (!object(input.locator) || !object(input.content) || !Array.isArray(input.diagnostics) || input.diagnostics.some(d => !object(d) || typeof d.code !== "string" || !d.code.trim())) throw new Error("Invalid material content or diagnostics");
  for (const key of ["historyProjection", "accountMappingChanges"]) {
    if (Object.prototype.hasOwnProperty.call(input.content, key)) throw new Error(`Reserved material content field ${key}`);
  }
  const ids = new Set<string>(), keys = new Set<string>();
  for (const observation of input.observations) {
    nonempty(observation.id, "observation id"); nonempty(observation.linkReason, "link reason");
    if (ids.has(observation.id)) throw new Error("Duplicate observation id"); ids.add(observation.id);
    if (observation.key !== undefined && observation.key !== null) { nonempty(observation.key, "observation key"); if (keys.has(observation.key)) throw new Error("Duplicate observation position"); keys.add(observation.key); }
    if (!object(observation.locator) || !Array.isArray(observation.executionIds)) throw new Error("Invalid observation");
    for (const id of observation.executionIds) nonempty(id, "execution id");
    if (new Set(observation.executionIds).size !== observation.executionIds.length) throw new Error("Duplicate execution link");
  }
  if (input.historyProjection && (!isLegacyImportHistoryEntry(input.historyProjection.reconciliation) || input.historyProjection.batchId !== input.historyProjection.reconciliation.id)) throw new Error("Invalid import history projection");
  const originalAccounts = new Set<string>();
  for (const mapping of input.accountMappings ?? []) {
    for (const key of ["originalAccountId", "reason", "auditReference", "recordedAt"] as const) nonempty(mapping[key], `mapping ${key}`);
    if (mapping.canonicalAccountId !== null) nonempty(mapping.canonicalAccountId, "mapping canonicalAccountId");
    if (originalAccounts.has(mapping.originalAccountId)) throw new Error("Duplicate material account mapping");
    originalAccounts.add(mapping.originalAccountId);
  }
}
function assertHistoryOwner(context: SourceMaterialContext, input: MaterialVersionInput): void {
  if (!input.historyProjection) return;
  const batchId = input.historyProjection.batchId;
  if (context.versions.some(version => version.materialId !== input.materialId &&
    (version.legacy?.batchId === batchId || (object(version.content.historyProjection) && version.content.historyProjection.batchId === batchId)))) {
    throw new Error("Compatibility batch belongs to another material");
  }
}
/** Pure planning. No database access and no withdrawal policy is silently selected. */
export function prepareMaterialChanges(context: SourceMaterialContext, input: MaterialVersionInput): PreparedMaterialChanges {
  assertJson(input);
  const copied = clone(input); validateInput(copied);
  assertHistoryOwner(context, copied);
  if (context.versions.some(v => v.id === copied.versionId)) throw new Error("Material version already exists");
  const existingObservations = new Set(context.versions.flatMap(v => v.observations.map(o => o.id)));
  if (copied.observations.some(o => existingObservations.has(o.id))) throw new Error("Observation already exists");
  const unbound = { policy: "source-material-changes-v1" as const, input: copied, expectedCurrentVersionId: context.materials.find(m => m.id === copied.materialId)?.currentVersionId ?? null, missingExecutions: missingDependencies(context, copied), dependencyDigest: dependencyDigest(context, copied) };
  return frozen({ ...unbound, digest: digest(unbound) });
}
export function validateMissingExecutionDecisions(missing: readonly MissingExecutionDependency[], decisions: readonly MissingExecutionDecision[]) {
  const ids = new Set(missing.map(m => m.executionId)), seen = new Set<string>();
  for (const decision of decisions) {
    if (!ids.has(decision.executionId) || seen.has(decision.executionId) || !["keep", "withdraw"].includes(decision.action)) throw new Error("Unexpected or duplicate missing execution decision");
    if (decision.reason !== undefined && typeof decision.reason !== "string") throw new Error("Invalid decision reason");
    if (decision.action === "withdraw" && !decision.reason?.trim()) throw new Error("Withdrawal reason is required");
    seen.add(decision.executionId);
  }
  for (const id of ids) if (!seen.has(id)) throw new Error(`Explicit decision required for ${id}`);
  return decisions.map(d => ({ ...d, reason: d.reason ?? "" }));
}

/** Internal coordinator hook: caller already holds its sole write transaction.
 * Invoke after facts exist, before inserting the new revision audit. The coordinator
 * checks BookVersion/fact old-values and applies returned soft-state decisions.
 * This hook never changes execution facts or execution_fact_states.
 */
export function _applyPreparedMaterialChangesInTransaction(database: DatabaseSync, change: PreparedMaterialChanges, decisions: readonly MissingExecutionDecision[]) {
  if (!database.isTransaction) throw new Error("Material apply requires the caller's existing transaction");
  const { digest: expectedDigest, ...unbound } = change;
  if (change.policy !== "source-material-changes-v1" || digest(unbound) !== expectedDigest) throw new Error("Material change digest mismatch");
  assertJson(change.input);
  validateInput(change.input);
  const context = materializeSourceMaterialContext(copySourceMaterialRows(database));
  assertHistoryOwner(context, change.input);
  if ((context.materials.find(m => m.id === change.input.materialId)?.currentVersionId ?? null) !== change.expectedCurrentVersionId || dependencyDigest(context, change.input) !== change.dependencyDigest) throw new Error("Material dependencies changed; prepare again");
  if (stable(missingDependencies(context, change.input)) !== stable(change.missingExecutions)) throw new Error("Material missing execution dependencies changed");
  const validated = validateMissingExecutionDecisions(change.missingExecutions, decisions);
  const input = change.input;
  const accountMappingChanges = input.accountMappings?.map(mapping => ({
    before: context.mappings.find(m => m.material_id === input.materialId && m.original_account_id === mapping.originalAccountId) ?? null,
    after: mapping.canonicalAccountId === null ? null : mapping,
    reason: mapping.reason, auditReference: mapping.auditReference,
  }));
  // All validation precedes mutation. Any subsequent SQLite error belongs to the
  // caller's transaction, which the coordinator must roll back in its entirety.
  database.prepare("insert into source_materials(id,created_at) values(?,?) on conflict(id) do nothing").run(input.materialId, input.recordedAt);
  database.prepare("insert into source_material_versions(id,material_id,supersedes_version_id,parser_version,source_kind,locator_json,file_fingerprint,scope_json,diagnostics_json,content_json,recorded_at) values(?,?,?,?,?,?,?,?,?,?,?)")
    .run(input.versionId, input.materialId, change.expectedCurrentVersionId, input.parserVersion, input.sourceKind, JSON.stringify(input.locator), input.fileFingerprint, JSON.stringify(input.scope), JSON.stringify(input.diagnostics), JSON.stringify({ ...input.content, ...(input.historyProjection ? { historyProjection: input.historyProjection } : {}), ...(accountMappingChanges ? { accountMappingChanges } : {}) }), input.recordedAt);
  for (const o of input.observations) {
    database.prepare("insert into source_observations(id,version_id,observation_key,identity_status,locator_json,raw_json,original_account_id) values(?,?,?,?,?,?,?)").run(o.id, input.versionId, o.key ?? null, o.key == null ? "unresolved" : "located", JSON.stringify(o.locator), JSON.stringify(o.raw), o.originalAccountId ?? null);
    for (const id of o.executionIds) database.prepare("insert into source_execution_links values(?,?,?,?)").run(o.id, id, o.linkReason, input.recordedAt);
  }
  database.prepare("update source_materials set current_version_id=? where id=?").run(input.versionId, input.materialId);
  for (const mapping of input.accountMappings ?? []) {
    if (mapping.canonicalAccountId === null) {
      database.prepare("delete from source_material_account_mappings where material_id=? and original_account_id=?").run(input.materialId, mapping.originalAccountId);
      continue;
    }
    database.prepare("insert into source_material_account_mappings values(?,?,?,?,?,?) on conflict(material_id,original_account_id) do update set canonical_account_id=excluded.canonical_account_id,reason=excluded.reason,audit_reference=excluded.audit_reference,recorded_at=excluded.recorded_at")
      .run(input.materialId, mapping.originalAccountId, mapping.canonicalAccountId, mapping.reason, mapping.auditReference, mapping.recordedAt);
  }
  if (input.historyProjection) {
    const history = input.historyProjection.reconciliation;
    database.prepare("insert into import_batches(id,source_name,source_type,imported_at,record_count,source_fingerprint,reconciliation_json) values(?,?,?,?,?,?,?) on conflict(id) do update set source_name=excluded.source_name,source_type=excluded.source_type,imported_at=excluded.imported_at,record_count=excluded.record_count,source_fingerprint=excluded.source_fingerprint,reconciliation_json=excluded.reconciliation_json")
      .run(input.historyProjection.batchId, str(history.fileName), input.sourceKind, str(history.importedAt), Number(history.tradeCount), input.fileFingerprint, JSON.stringify(history));
  }
  return frozen({ materialId: input.materialId, versionId: input.versionId, decisions: validated });
}

export type MaterialAccountMappingRow = {
  material_id: string; original_account_id: string; canonical_account_id: string;
  reason: string; audit_reference: string; recorded_at: string;
};
export type MaterialAccountMappingChange = {
  tableName: "source_material_account_mappings"; primaryKey: string;
  before: MaterialAccountMappingRow | null; after: MaterialAccountMappingRow | null;
  beforeDigest: string; afterDigest: string;
};
export type SourceAccountExecutionScope = {
  executionId: string; beforeAccountId: string; afterAccountId: typeof TRADINGVIEW_CANONICAL_ACCOUNT_ID;
};
export type SourceAccountDependency = {
  tableName: "source_materials" | "source_material_versions" | "source_observations"
    | "source_execution_links" | "source_material_account_mappings";
  rowKey: string; rowDigest: string;
};
export type ForwardSourceAccountCorrectionInput = {
  kind: "tradingview-account-migration"; operationId: string; recordedAt: string;
  executions: readonly SourceAccountExecutionScope[];
};
export type RestoreSourceAccountCorrectionInput = {
  kind: "tradingview-account-migration-rollback"; operationId: string; recordedAt: string;
  original: {
    prepared: PreparedForwardSourceAccountCorrection;
    /** Loaded from the original verified server ledger, never from an HTTP patch. */
    appliedMappings: readonly MaterialAccountMappingChange[];
  };
};
export type SourceAccountCorrectionInput = ForwardSourceAccountCorrectionInput | RestoreSourceAccountCorrectionInput;
export type PreparedSourceAccountCorrectionBase<I> = {
  policy: "source-material-account-correction-v1"; input: I;
  changes: readonly MaterialAccountMappingChange[];
  beforeDependencies: readonly SourceAccountDependency[]; afterDependencies: readonly SourceAccountDependency[];
  dependencyDigest: string; digest: string;
};
export type PreparedForwardSourceAccountCorrection = PreparedSourceAccountCorrectionBase<ForwardSourceAccountCorrectionInput>;
export type PreparedRestoreSourceAccountCorrection = PreparedSourceAccountCorrectionBase<RestoreSourceAccountCorrectionInput>;
export type PreparedSourceAccountCorrection = PreparedForwardSourceAccountCorrection | PreparedRestoreSourceAccountCorrection;
export type SourceMaterialAccountCorrectionErrorCode = "source-account-correction-invalid" | "source-account-correction-blocked"
  | "source-account-correction-stale" | "source-account-correction-transaction-required";
export type SourceMaterialAccountCorrectionBlocker = {
  table: SourceAccountDependency["tableName"]; primaryKey: string; message: string;
};
export class SourceMaterialAccountCorrectionError extends Error {
  readonly table?: SourceAccountDependency["tableName"];
  readonly primaryKey?: string;
  readonly blockers: readonly SourceMaterialAccountCorrectionBlocker[];
  constructor(readonly code: SourceMaterialAccountCorrectionErrorCode, message: string, blockers: readonly SourceMaterialAccountCorrectionBlocker[] = []) {
    super(message); this.name = "SourceMaterialAccountCorrectionError";
    this.blockers = frozen(clone(blockers));
    this.table = blockers[0]?.table; this.primaryKey = blockers[0]?.primaryKey;
  }
}

const accountCorrectionPolicy = "source-material-account-correction-v1" as const;
const mappingTable = "source_material_account_mappings" as const;
const mappingColumns = ["material_id", "original_account_id", "canonical_account_id", "reason", "audit_reference", "recorded_at"] as const;
const sourceAccountTables = [
  ["materials", "source_materials", ["id"]],
  ["versions", "source_material_versions", ["id"]],
  ["observations", "source_observations", ["id"]],
  ["links", "source_execution_links", ["observation_id", "execution_id"]],
  ["mappings", mappingTable, ["material_id", "original_account_id"]],
] as const;
type AccountSourceGraph = Pick<SourceMaterialRows, "materials" | "versions" | "observations" | "links" | "mappings">;
function invalidAccountCorrection(message: string): never {
  throw new SourceMaterialAccountCorrectionError("source-account-correction-invalid", message);
}
function accountCorrectionJson(value: unknown): void {
  try { assertJson(value); } catch { invalidAccountCorrection("Source account correction must be finite, acyclic JSON"); }
}
function exactAccountKeys(value: unknown, keys: readonly string[], label: string): asserts value is Record<string, unknown> {
  if (!object(value) || stable(Object.keys(value).sort()) !== stable([...keys].sort())) invalidAccountCorrection(`Invalid ${label} fields`);
}
function accountText(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || !value.trim()) invalidAccountCorrection(`Invalid ${label}`);
}
function mappingKey(row: MaterialAccountMappingRow | Row): string { return JSON.stringify([row.material_id, row.original_account_id]); }
function accountMappingRow(value: unknown): asserts value is MaterialAccountMappingRow {
  exactAccountKeys(value, mappingColumns, "mapping row");
  // Stored metadata follows the schema, including historical empty strings.
  // New metadata is derived exclusively from the fixed policy/server input.
  for (const column of mappingColumns) if (typeof value[column] !== "string") invalidAccountCorrection(`Invalid mapping ${column}`);
  for (const column of ["material_id", "original_account_id", "canonical_account_id"] as const) accountText(value[column], `mapping ${column}`);
}
function validateAccountChanges(value: unknown): asserts value is readonly MaterialAccountMappingChange[] {
  if (!Array.isArray(value)) invalidAccountCorrection("Invalid source mapping changes");
  const keys = new Set<string>();
  for (const change of value) {
    exactAccountKeys(change, ["tableName", "primaryKey", "before", "after", "beforeDigest", "afterDigest"], "mapping change");
    if (change.tableName !== mappingTable || (change.before === null && change.after === null)) invalidAccountCorrection("Invalid source mapping change");
    for (const image of [change.before, change.after]) {
      if (image === null) continue;
      accountMappingRow(image);
      if (mappingKey(image) !== change.primaryKey) invalidAccountCorrection("Mapping change key differs from its row");
    }
    if (typeof change.primaryKey !== "string" || keys.has(change.primaryKey)
      || digest(change.before) !== change.beforeDigest || digest(change.after) !== change.afterDigest) invalidAccountCorrection("Invalid or duplicate mapping change digest");
    keys.add(change.primaryKey);
  }
}
function validateAccountDependencies(value: unknown): asserts value is readonly SourceAccountDependency[] {
  if (!Array.isArray(value)) invalidAccountCorrection("Invalid source dependencies");
  const keys = new Set<string>();
  for (const dependency of value) {
    exactAccountKeys(dependency, ["tableName", "rowKey", "rowDigest"], "source dependency");
    if (!sourceAccountTables.some(([, table]) => table === dependency.tableName)) invalidAccountCorrection("Invalid source dependency table");
    accountText(dependency.rowKey, "source dependency key"); accountText(dependency.rowDigest, "source dependency digest");
    const key = JSON.stringify([dependency.tableName, dependency.rowKey]);
    if (keys.has(key)) invalidAccountCorrection("Duplicate source dependency"); keys.add(key);
  }
}
function validateAccountInput(input: unknown): asserts input is SourceAccountCorrectionInput {
  if (!object(input)) invalidAccountCorrection("Invalid source correction input");
  if (input.kind === "tradingview-account-migration") {
    exactAccountKeys(input, ["kind", "operationId", "recordedAt", "executions"], "forward source input");
    if (!Array.isArray(input.executions)) invalidAccountCorrection("Invalid source execution scope");
    const ids = new Set<string>();
    for (const execution of input.executions) {
      exactAccountKeys(execution, ["executionId", "beforeAccountId", "afterAccountId"], "source execution scope");
      accountText(execution.executionId, "execution id"); accountText(execution.beforeAccountId, "before account id");
      if (execution.afterAccountId !== TRADINGVIEW_CANONICAL_ACCOUNT_ID || ids.has(execution.executionId)) invalidAccountCorrection("Invalid or duplicate source execution scope");
      ids.add(execution.executionId);
    }
  } else if (input.kind === "tradingview-account-migration-rollback") {
    exactAccountKeys(input, ["kind", "operationId", "recordedAt", "original"], "restore source input");
    exactAccountKeys(input.original, ["prepared", "appliedMappings"], "original source evidence");
    if (!object(input.original.prepared) || !object(input.original.prepared.input)
      || input.original.prepared.input.kind !== "tradingview-account-migration") invalidAccountCorrection("Restore requires an original forward source plan");
    validatePreparedAccountCorrection(input.original.prepared);
    validateAccountChanges(input.original.appliedMappings);
    if (stable(input.original.appliedMappings) !== stable(input.original.prepared.changes)) invalidAccountCorrection("Original persisted source ledger differs from the forward plan");
  } else invalidAccountCorrection("Unsupported source correction intent");
  accountText(input.operationId, "source operation id"); accountText(input.recordedAt, "source operation time");
}
function validatePreparedAccountCorrection(prepared: unknown): asserts prepared is PreparedSourceAccountCorrection {
  accountCorrectionJson(prepared);
  exactAccountKeys(prepared, ["policy", "input", "changes", "beforeDependencies", "afterDependencies", "dependencyDigest", "digest"], "prepared source correction");
  if (prepared.policy !== accountCorrectionPolicy) invalidAccountCorrection("Invalid source correction policy");
  validateAccountInput(prepared.input); validateAccountChanges(prepared.changes);
  validateAccountDependencies(prepared.beforeDependencies); validateAccountDependencies(prepared.afterDependencies);
  const { digest: expected, ...unbound } = prepared;
  if (digest(unbound) !== expected || digest(prepared.beforeDependencies) !== prepared.dependencyDigest) invalidAccountCorrection("Source correction digest mismatch");
}
function sourceBlock(table: SourceAccountDependency["tableName"], primaryKey: string, message: string): SourceMaterialAccountCorrectionBlocker {
  return { table, primaryKey, message };
}
function blockedSources(blockers: SourceMaterialAccountCorrectionBlocker[]): never {
  throw new SourceMaterialAccountCorrectionError("source-account-correction-blocked", "Cannot prove the complete source mapping scope", blockers);
}
/** Rebuild from all raw rows; no caller-supplied material/observation subset is trusted at apply. */
function accountSourceGraph(rows: SourceMaterialRows, executions: readonly SourceAccountExecutionScope[]): AccountSourceGraph {
  const executionIds = new Set(executions.map(e => e.executionId)), materialIds = new Set<string>();
  const blockers: SourceMaterialAccountCorrectionBlocker[] = [];
  for (const link of rows.links.filter(l => executionIds.has(str(l.execution_id)))) {
    const observation = rows.observations.find(o => o.id === link.observation_id);
    if (!observation) { blockers.push(sourceBlock("source_observations", JSON.stringify([link.observation_id]), "Selected execution has a missing observation")); continue; }
    const version = rows.versions.find(v => v.id === observation.version_id);
    if (!version) { blockers.push(sourceBlock("source_material_versions", JSON.stringify([observation.version_id]), "Observation has a missing version")); continue; }
    if (!rows.materials.some(m => m.id === version.material_id)) { blockers.push(sourceBlock("source_materials", JSON.stringify([version.material_id]), "Version has a missing material")); continue; }
    materialIds.add(str(version.material_id));
  }
  if (blockers.length) blockedSources(blockers);
  const versions = rows.versions.filter(v => materialIds.has(str(v.material_id))), versionIds = new Set(versions.map(v => v.id));
  const observations = rows.observations.filter(o => versionIds.has(o.version_id)), observationIds = new Set(observations.map(o => o.id));
  return { materials: rows.materials.filter(m => materialIds.has(str(m.id))), versions, observations,
    links: rows.links.filter(l => observationIds.has(l.observation_id) || executionIds.has(str(l.execution_id))),
    mappings: rows.mappings.filter(m => materialIds.has(str(m.material_id))) };
}
function accountSourceDependencies(graph: AccountSourceGraph): SourceAccountDependency[] {
  const dependencies: SourceAccountDependency[] = [];
  for (const [field, tableName, keys] of sourceAccountTables) {
    const members = graph[field].map(row => ({ rowKey: JSON.stringify(keys.map(key => row[key])), rowDigest: digest(row) }))
      .sort((a, b) => a.rowKey < b.rowKey ? -1 : a.rowKey > b.rowKey ? 1 : 0);
    dependencies.push(...members.map(member => ({ tableName, ...member })), { tableName, rowKey: "@membership", rowDigest: digest(members.map(m => m.rowKey)) });
  }
  return dependencies.sort((a, b) => a.tableName < b.tableName ? -1 : a.tableName > b.tableName ? 1 : a.rowKey < b.rowKey ? -1 : a.rowKey > b.rowKey ? 1 : 0);
}
function assertAccountDependencies(expected: readonly SourceAccountDependency[], actual: readonly SourceAccountDependency[]): void {
  const key = (d: SourceAccountDependency) => JSON.stringify([d.tableName, d.rowKey]);
  const current = new Map(actual.map(d => [key(d), d])), prior = new Map(expected.map(d => [key(d), d]));
  const blockers: SourceMaterialAccountCorrectionBlocker[] = [];
  for (const id of [...new Set([...prior.keys(), ...current.keys()])].sort()) {
    const before = prior.get(id), after = current.get(id);
    if (before?.rowDigest !== after?.rowDigest) {
      const row = before ?? after!; blockers.push(sourceBlock(row.tableName, row.rowKey, "Source dependency changed since preparation"));
    }
  }
  if (blockers.length) {
    // Prefer concrete added/removed/changed keys to a membership-only diagnostic.
    blockers.sort((a, b) => Number(a.primaryKey === "@membership") - Number(b.primaryKey === "@membership"));
    throw new SourceMaterialAccountCorrectionError("source-account-correction-stale", "Source dependencies changed; prepare again", blockers);
  }
}
function forwardAccountChanges(graph: AccountSourceGraph, input: ForwardSourceAccountCorrectionInput): MaterialAccountMappingChange[] {
  const selected = new Map(input.executions.map(e => [e.executionId, e])), pairs = new Map<string, { materialId: string; original: string }>();
  const blockers: SourceMaterialAccountCorrectionBlocker[] = [];
  for (const link of graph.links.filter(l => selected.has(str(l.execution_id)))) {
    const observation = graph.observations.find(o => o.id === link.observation_id)!;
    const original = observation.original_account_id;
    if (typeof original !== "string" || !original.trim()) { blockers.push(sourceBlock("source_observations", JSON.stringify([observation.id]), "Observation original account is unknown")); continue; }
    const materialId = str(graph.versions.find(v => v.id === observation.version_id)!.material_id);
    pairs.set(JSON.stringify([materialId, original]), { materialId, original });
  }
  const changes: MaterialAccountMappingChange[] = [];
  for (const [primaryKey, { materialId, original }] of [...pairs.entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) {
    const versionIds = new Set(graph.versions.filter(v => v.material_id === materialId).map(v => v.id));
    const observations = graph.observations.filter(o => versionIds.has(o.version_id) && o.original_account_id === original);
    const accounts = new Set<string>();
    for (const observation of observations) {
      const links = graph.links.filter(l => l.observation_id === observation.id);
      if (!links.length) blockers.push(sourceBlock("source_observations", JSON.stringify([observation.id]), "Same-original observation has no formal execution link"));
      for (const link of links) {
        const execution = selected.get(str(link.execution_id));
        if (!execution) blockers.push(sourceBlock("source_execution_links", JSON.stringify([link.observation_id, link.execution_id]), "Mapping would affect an execution outside the reviewed scope"));
        else accounts.add(execution.beforeAccountId);
      }
    }
    const rawBefore = graph.mappings.find(m => m.material_id === materialId && m.original_account_id === original) ?? null;
    if (rawBefore !== null) accountMappingRow(rawBefore);
    const before = rawBefore === null ? null : clone(rawBefore);
    const projected = before?.canonical_account_id ?? original;
    if (accounts.size !== 1 || [...accounts].some(account => projected !== account && projected !== TRADINGVIEW_CANONICAL_ACCOUNT_ID)) {
      blockers.push(sourceBlock(mappingTable, primaryKey, "Reviewed executions disagree with the source account projection"));
    }
    if (before?.canonical_account_id === TRADINGVIEW_CANONICAL_ACCOUNT_ID) continue;
    const after: MaterialAccountMappingRow = { material_id: materialId, original_account_id: original, canonical_account_id: TRADINGVIEW_CANONICAL_ACCOUNT_ID,
      reason: "tradingview-account-migration", audit_reference: input.operationId, recorded_at: input.recordedAt };
    changes.push({ tableName: mappingTable, primaryKey, before, after, beforeDigest: digest(before), afterDigest: digest(after) });
  }
  if (blockers.length) blockedSources(blockers);
  return changes;
}
function rowsWithAccountChanges(rows: SourceMaterialRows, changes: readonly MaterialAccountMappingChange[], reverse = false): SourceMaterialRows {
  const mappings = clone(rows.mappings);
  for (const change of changes) {
    const index = mappings.findIndex(m => mappingKey(m) === change.primaryKey), replacement = reverse ? change.before : change.after;
    if (index >= 0) mappings.splice(index, 1);
    if (replacement !== null) mappings.push(clone(replacement));
  }
  mappings.sort((a, b) => mappingKey(a) < mappingKey(b) ? -1 : mappingKey(a) > mappingKey(b) ? 1 : 0);
  return { ...rows, mappings };
}
function originalAccountInput(prepared: PreparedSourceAccountCorrection): ForwardSourceAccountCorrectionInput {
  return prepared.input.kind === "tradingview-account-migration" ? prepared.input : prepared.input.original.prepared.input;
}

/** Pure, sealed TradingView policy. The Store owns trusted operation/ledger provenance and fact validation. */
export function _prepareSourceMaterialAccountCorrection(rows: SourceMaterialRows, input: SourceAccountCorrectionInput): PreparedSourceAccountCorrection {
  accountCorrectionJson(input); validateAccountInput(input);
  const copied = clone(input), graph = accountSourceGraph(rows, copied.kind === "tradingview-account-migration" ? copied.executions : copied.original.prepared.input.executions);
  let changes: readonly MaterialAccountMappingChange[], beforeDependencies: readonly SourceAccountDependency[], afterDependencies: readonly SourceAccountDependency[];
  if (copied.kind === "tradingview-account-migration") {
    changes = forwardAccountChanges(graph, copied); beforeDependencies = accountSourceDependencies(graph);
    afterDependencies = accountSourceDependencies(accountSourceGraph(rowsWithAccountChanges(rows, changes), copied.executions));
  } else {
    const original = copied.original.prepared;
    assertAccountDependencies(original.afterDependencies, accountSourceDependencies(graph));
    const restored = rowsWithAccountChanges(rows, copied.original.appliedMappings, true);
    const reconstructed = _prepareSourceMaterialAccountCorrection(restored, original.input);
    if (stable(reconstructed) !== stable(original)) invalidAccountCorrection("Original source plan cannot be independently reconstructed from its persisted ledger");
    changes = copied.original.appliedMappings.map(change => ({ ...change, before: change.after, after: change.before, beforeDigest: change.afterDigest, afterDigest: change.beforeDigest }));
    beforeDependencies = original.afterDependencies; afterDependencies = original.beforeDependencies;
  }
  const unbound = { policy: accountCorrectionPolicy, input: copied, changes, beforeDependencies, afterDependencies, dependencyDigest: digest(beforeDependencies) };
  return frozen({ ...unbound, digest: digest(unbound) }) as PreparedSourceAccountCorrection;
}

/** Call before the first outer write and again AFTER receipts/consumption, immediately before commit. */
export function _assertPreparedSourceMaterialAccountCorrectionInTransaction(database: DatabaseSync, prepared: PreparedSourceAccountCorrection, phase: "before" | "after"): void {
  if (!database.isTransaction) throw new SourceMaterialAccountCorrectionError("source-account-correction-transaction-required", "Source account correction requires the caller's existing transaction");
  if (phase !== "before" && phase !== "after") invalidAccountCorrection("Invalid source assertion phase");
  validatePreparedAccountCorrection(prepared);
  const rows = copySourceMaterialRows(database), graph = accountSourceGraph(rows, originalAccountInput(prepared).executions);
  assertAccountDependencies(phase === "before" ? prepared.beforeDependencies : prepared.afterDependencies, accountSourceDependencies(graph));
  const baseline = phase === "before" ? rows : rowsWithAccountChanges(rows, prepared.changes, true);
  const reconstructed = _prepareSourceMaterialAccountCorrection(baseline, prepared.input);
  if (stable(reconstructed) !== stable(prepared)) invalidAccountCorrection("Source correction differs from its independently prepared fixed policy");
}

/** Fixed six-column writer; never opens/closes a transaction or writes facts, versions or audit tables. */
export function _applyPreparedSourceMaterialAccountCorrectionInTransaction(database: DatabaseSync, prepared: PreparedSourceAccountCorrection): readonly MaterialAccountMappingChange[] {
  _assertPreparedSourceMaterialAccountCorrectionInTransaction(database, prepared, "before");
  const beforeRows = copySourceMaterialRows(database).mappings;
  for (const change of prepared.changes) {
    const row = change.after ?? change.before!;
    const result = change.after === null
      ? database.prepare("delete from source_material_account_mappings where material_id=? and original_account_id=?").run(row.material_id, row.original_account_id)
      : change.before === null
        ? database.prepare("insert into source_material_account_mappings(material_id,original_account_id,canonical_account_id,reason,audit_reference,recorded_at) values(?,?,?,?,?,?)")
          .run(...mappingColumns.map(column => change.after![column]))
        : database.prepare("update source_material_account_mappings set canonical_account_id=?,reason=?,audit_reference=?,recorded_at=? where material_id=? and original_account_id=?")
          .run(row.canonical_account_id, row.reason, row.audit_reference, row.recorded_at, row.material_id, row.original_account_id);
    if (Number(result.changes) !== 1) throw new SourceMaterialAccountCorrectionError("source-account-correction-stale", "Mapping write did not affect exactly one expected row", [sourceBlock(mappingTable, change.primaryKey, "Mapping write count changed")]);
  }
  _assertPreparedSourceMaterialAccountCorrectionInTransaction(database, prepared, "after");
  const afterRows = copySourceMaterialRows(database).mappings;
  return frozen(prepared.changes.map(change => {
    const before = beforeRows.find(m => mappingKey(m) === change.primaryKey) ?? null, after = afterRows.find(m => mappingKey(m) === change.primaryKey) ?? null;
    if (before !== null) accountMappingRow(before); if (after !== null) accountMappingRow(after);
    return { tableName: mappingTable, primaryKey: change.primaryKey, before, after, beforeDigest: digest(before), afterDigest: digest(after) };
  }));
}
