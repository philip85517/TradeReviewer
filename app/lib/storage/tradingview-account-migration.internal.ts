import "server-only";

import Decimal from "decimal.js";
import type { DatabaseSync } from "node:sqlite";

import {
  buildTradingViewAccountMigrationPlan,
  canonicalMigrationPlanDigest,
  type TradingViewAccountMigrationPlan,
  type TradingViewReferenceMigrationPlanRow,
  type TradingViewExecutionMigrationPlanRow,
} from "./tradingview-account-migration-plan";
import {
  buildTradingViewAccountMigrationSnapshot,
  type ReadonlySqliteRow,
  type ReadonlySqliteRows,
  type TradingViewSnapshotAdapterResult,
} from "./tradingview-account-migration-snapshot";
import {
  TradingViewMigrationTransactionError,
  normalizeTradingViewMaintenanceRequest,
  type TradingViewAccountMigrationTransactionOptions,
  type TradingViewMigrationAlias,
  type TradingViewMigrationCommitRequest,
  type TradingViewMigrationCommitResult,
  type TradingViewMigrationEvaluation,
  type TradingViewMigrationExpectedAffectedRow,
  type TradingViewMigrationPreview,
  type TradingViewMigrationRollbackPreview,
  type TradingViewMigrationRollbackPreviewBlocker,
  type TradingViewMigrationRollbackRequest,
  type TradingViewMigrationRollbackResult,
} from "./tradingview-account-migration-contracts";
import {
  TRADINGVIEW_CANONICAL_ACCOUNT_ID,
} from "../trades/tradingview-account-identity";
import type { TradeExecution } from "../trades/types";

import {
  copySourceMaterialRows, _prepareSourceMaterialAccountCorrection,
  _assertPreparedSourceMaterialAccountCorrectionInTransaction,
  _applyPreparedSourceMaterialAccountCorrectionInTransaction,
  SourceMaterialAccountCorrectionError,
  type SourceMaterialRows, type PreparedSourceAccountCorrection,
  type PreparedForwardSourceAccountCorrection, type MaterialAccountMappingChange,
} from "./source-materials";
import type { TradingViewMaintenanceIntent, TradingViewMaintenanceRequest, CommitReceipt } from "./sqlite-contracts";
import { createHash } from "node:crypto";
import { tradeChangeChoicesDigest, tradeChangeInputDigest } from "./trade-changes-engine.internal";

type DbRow = Record<string, unknown>;
export type TradingViewRawSnapshot = { tables: Record<string, DbRow[]>; source: SourceMaterialRows; legacyProofs: Record<string, DbRow | null> };
type ReadDatabase = DatabaseSync | TradingViewRawSnapshot;
function tableRows(database: ReadDatabase, table: string): DbRow[] {
  return "tables" in database ? database.tables[table] ?? [] : database.prepare(`select * from ${identifier(table)}`).all() as DbRow[];
}

type JsonRecord = Record<string, unknown>;
type SqlInput = string | number | bigint | Uint8Array | null;

type ReferenceSpec = {
  primaryKeys: readonly string[];
  columns: readonly string[];
  jsonColumns: readonly string[];
};

type LedgerRow = {
  tableName: string;
  primaryKey: string;
  before: DbRow | null;
  after: DbRow | null;
  beforeDigest: string;
  afterDigest: string;
};

type DependencyRow = {
  tableName: string;
  rowKey: string;
  rowDigest: string;
};

const EXECUTION_COLUMNS = new Set([
  "id", "import_batch_id", "instrument_id", "account", "side", "executed_at",
  "quantity", "price", "fee", "currency", "evidence_json", "created_at",
  "updated_at", "trade_nature", "simulation_run_id",
]);

const PRINCIPAL_SPEC: ReferenceSpec = {
  primaryKeys: ["account_id"],
  columns: ["account_id", "currency", "amount", "as_of", "status", "source", "revision", "updated_at"],
  jsonColumns: [],
};

// This is the only source table this maintenance operation may mutate.
const MATERIAL_MAPPING_SPEC: ReferenceSpec = {
  primaryKeys: ["material_id", "original_account_id"],
  columns: ["material_id", "original_account_id", "canonical_account_id", "reason", "audit_reference", "recorded_at"],
  jsonColumns: [],
};
const DEPENDENCY_POLICY = "tradingview-complete-dependencies-v2";
const DEPENDENCY_POLICY_TABLE = "@tradingview-policy";

type DependencyScope = { identities: string[]; executionIds: string[] };
type SourceGraph = { materials: DbRow[]; versions: DbRow[]; observations: DbRow[]; links: DbRow[]; mappings: DbRow[]; states: DbRow[] };

function referenceSpec(primaryKeys: readonly string[], columns: readonly string[], jsonColumns: readonly string[] = []): ReferenceSpec {
  return { primaryKeys, columns, jsonColumns };
}

const REFERENCE_SPECS: Readonly<Record<string, ReferenceSpec>> = {
  import_batches: referenceSpec(
    ["id"],
    ["id", "source_fingerprint", "source_name", "source_type", "imported_at", "record_count", "reconciliation_json", "evidence_json", "created_at", "trade_nature", "simulation_run_id"],
    ["reconciliation_json", "evidence_json"],
  ),
  reviews: referenceSpec(
    ["episode_id"],
    ["episode_id", "instrument_id", "cursor_json", "plan_json", "review_json", "drawings_json", "revisions_json", "confirmed_tags_json", "created_at", "updated_at"],
    ["cursor_json", "plan_json", "review_json", "drawings_json", "revisions_json", "confirmed_tags_json"],
  ),
  tag_suggestions: referenceSpec(
    ["id"],
    ["id", "episode_id", "instrument_id", "tag", "status", "evidence_json", "created_at", "updated_at"],
    ["evidence_json"],
  ),
  app_settings: referenceSpec(["key"], ["key", "value_json", "updated_at"], ["value_json"]),
  trade_revisions: referenceSpec(
    ["id"],
    ["id", "instrument_id", "account_id", "request_json", "revision_json", "recorded_at", "scope_account_unknown"],
    ["request_json", "revision_json"],
  ),
  recall_documents: referenceSpec(
    ["episode_id"],
    ["episode_id", "draft_json", "finalized_json", "revision", "updated_at"],
    ["draft_json", "finalized_json"],
  ),
  recall_plan_versions: referenceSpec(
    ["episode_id", "version_kind", "entity_id"],
    ["episode_id", "version_kind", "document_revision", "entity_id", "state", "plan_id", "decision_id", "parent_version_id", "kind", "direction", "currency", "price_basis", "entry", "initial_stop", "size_input_mode", "size_input_value", "resolved_quantity", "quantity_unit", "capital_amount", "capital_currency", "capital_as_of", "capital_source", "capital_snapshot_ref", "recorded_phase", "source", "recorded_at", "knowledge_cursor", "execution_cursor", "has_seen_future", "retained_at", "revision_reason", "quantity_step", "step_source", "rounding", "derived_unrounded_quantity", "rounding_delta", "budget_amount", "budget_currency", "budget_scope", "budget_source_description", "budget_evidence_reference", "budget_provenance", "budget_knowledge_cursor", "budget_execution_cursor"],
    [],
  ),
  recall_plan_targets: referenceSpec(
    ["episode_id", "version_kind", "plan_entity_id", "entity_id"],
    ["episode_id", "version_kind", "document_revision", "plan_entity_id", "entity_id", "ordinal", "price", "quantity", "ratio"],
    [],
  ),
  recall_risk_baselines: referenceSpec(
    ["episode_id", "version_kind", "entity_id"],
    ["episode_id", "version_kind", "document_revision", "entity_id", "scope", "decision_id", "plan_version_id", "amount", "currency", "method", "method_version", "frozen_at", "corrects_baseline_id"],
    [],
  ),
  recall_retained_bundles: referenceSpec(
    ["episode_id", "version_kind", "entity_id"],
    ["episode_id", "version_kind", "document_revision", "entity_id", "snapshot_id", "capture_revision", "retained_at", "evidence_digest", "evidence_json", "decisions_json", "capture_phase", "capture_cursor", "capture_execution_cursor", "capture_timeframe", "capture_viewport_json", "capture_has_seen_future"],
    ["evidence_json", "decisions_json", "capture_viewport_json"],
  ),
  recall_bundle_plans: referenceSpec(["episode_id", "version_kind", "bundle_id", "plan_version_id"], ["episode_id", "version_kind", "document_revision", "bundle_id", "plan_version_id"]),
  recall_bundle_baselines: referenceSpec(["episode_id", "version_kind", "bundle_id", "baseline_id"], ["episode_id", "version_kind", "document_revision", "bundle_id", "baseline_id"]),
  recall_plan_associations: referenceSpec(["episode_id", "version_kind", "plan_id"], ["episode_id", "version_kind", "document_revision", "plan_id", "decision_id", "status"]),
  recall_exit_evaluations: referenceSpec(
    ["episode_id", "version_kind", "entity_id"],
    ["episode_id", "version_kind", "document_revision", "entity_id", "state", "evaluation_id", "captured_decision_id", "early_exit", "adherence", "reason", "reason_detail", "compared_plan_version_id", "compared_target_id", "dictionary_version", "source", "recorded_by", "recorded_phase", "recorded_at", "knowledge_cursor", "execution_cursor", "has_seen_future", "retained_at"],
  ),
  recall_evaluation_associations: referenceSpec(["episode_id", "version_kind", "evaluation_id"], ["episode_id", "version_kind", "document_revision", "evaluation_id", "decision_id", "status"]),
  recall_evaluation_tags: referenceSpec(["episode_id", "version_kind", "evaluation_entity_id", "tag_id"], ["episode_id", "version_kind", "document_revision", "evaluation_entity_id", "tag_id", "dictionary_version"]),
  recall_evaluation_evidence: referenceSpec(["episode_id", "version_kind", "evaluation_entity_id", "ordinal"], ["episode_id", "version_kind", "document_revision", "evaluation_entity_id", "ordinal", "kind", "drawing_id", "text_revision", "owner_id", "snapshot_id"]),
  recall_evaluation_executions: referenceSpec(["episode_id", "version_kind", "evaluation_entity_id", "execution_id"], ["episode_id", "version_kind", "document_revision", "evaluation_entity_id", "execution_id"]),
  recall_bundle_evaluations: referenceSpec(["episode_id", "version_kind", "bundle_id", "evaluation_revision_id"], ["episode_id", "version_kind", "document_revision", "bundle_id", "evaluation_revision_id"]),
  recall_evaluation_selections: referenceSpec(["episode_id", "version_kind", "decision_id"], ["episode_id", "version_kind", "document_revision", "decision_id", "evaluation_id"]),
  recall_actual_metric_sources: referenceSpec(
    ["episode_id", "version_kind", "bundle_id"],
    ["episode_id", "version_kind", "document_revision", "bundle_id", "status", "missing_reason", "method_version", "capture_revision", "evidence_digest", "computed_at", "source_bundle_id", "risk_baseline_id", "risk_plan_version_id", "risk_amount", "risk_currency", "risk_scope", "risk_method"],
  ),
  recall_actual_metrics: referenceSpec(["episode_id", "version_kind", "bundle_id", "scope", "scope_id", "metric_key"], ["episode_id", "version_kind", "document_revision", "bundle_id", "scope", "scope_id", "metric_key", "value", "reason", "currency", "unit", "method_version"]),
  recall_actual_metric_refs: referenceSpec(["episode_id", "version_kind", "bundle_id", "ref_kind", "ref_id"], ["episode_id", "version_kind", "document_revision", "bundle_id", "ref_kind", "ref_id"]),
  recall_actual_metric_exits: referenceSpec(["episode_id", "version_kind", "bundle_id", "execution_id"], ["episode_id", "version_kind", "document_revision", "bundle_id", "execution_id", "decision_id", "quantity"]),
  recall_manual_evaluations: referenceSpec(["episode_id", "version_kind", "entity_id"], ["episode_id", "version_kind", "document_revision", "entity_id", "state", "evaluation_id", "target_scope", "target_decision_id", "dictionary_version", "source", "recorded_by", "recorded_phase", "recorded_at", "knowledge_cursor", "execution_cursor", "has_seen_future", "retained_at"]),
  recall_manual_evaluation_tags: referenceSpec(["episode_id", "version_kind", "evaluation_entity_id", "tag_id"], ["episode_id", "version_kind", "document_revision", "evaluation_entity_id", "tag_id", "dictionary_version"]),
  recall_manual_evaluation_evidence: referenceSpec(["episode_id", "version_kind", "evaluation_entity_id", "ordinal"], ["episode_id", "version_kind", "document_revision", "evaluation_entity_id", "ordinal", "kind", "drawing_id", "text_revision", "owner_id", "snapshot_id"]),
  recall_manual_evaluation_executions: referenceSpec(["episode_id", "version_kind", "evaluation_entity_id", "execution_id"], ["episode_id", "version_kind", "document_revision", "evaluation_entity_id", "execution_id"]),
  recall_manual_evaluation_associations: referenceSpec(["episode_id", "version_kind", "evaluation_id"], ["episode_id", "version_kind", "document_revision", "evaluation_id", "decision_id", "status"]),
  recall_manual_evaluation_association_executions: referenceSpec(["episode_id", "version_kind", "evaluation_id", "execution_id"], ["episode_id", "version_kind", "document_revision", "evaluation_id", "execution_id"]),
  recall_bundle_manual_evaluations: referenceSpec(["episode_id", "version_kind", "bundle_id", "manual_evaluation_revision_id"], ["episode_id", "version_kind", "document_revision", "bundle_id", "manual_evaluation_revision_id"]),
};

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

function identifier(value: string): string {
  if (!IDENTIFIER.test(value)) throw new Error(`Unsafe SQLite identifier: ${value}`);
  return `"${value}"`;
}

function digest(value: unknown): string {
  return canonicalMigrationPlanDigest(value);
}

function normalizedCommitRequest(request: TradingViewMigrationCommitRequest): Readonly<Record<string, unknown>> {
  return normalizeTradingViewMaintenanceRequest(request);
}

function normalizedRollbackRequest(request: TradingViewMigrationRollbackRequest): Readonly<Record<string, unknown>> {
  return normalizeTradingViewMaintenanceRequest(request);
}

function cloneRow(row: ReadonlySqliteRow | null | undefined): DbRow | null {
  if (!row) return null;
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, cloneValue(value)]));
}

function cloneValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(cloneValue);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, child]) => [key, cloneValue(child)]));
  return value;
}

function jsonValue(value: readonly unknown[]): string;
function jsonValue(value: unknown): string | null;
function jsonValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const serialized = JSON.stringify(value);
  if (serialized === undefined) throw new Error("Migration transaction cannot serialize JSON");
  return serialized;
}

function sqlInput(value: unknown): SqlInput {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "bigint") return value;
  if (value instanceof Uint8Array) return value;
  throw new Error("Unsupported SQLite value in migration transaction");
}

function parseJson(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return cloneValue(value);
  return JSON.parse(value) as unknown;
}

function decimalString(value: string): string {
  const decimal = new Decimal(value);
  if (!decimal.isFinite()) throw new Error("Invalid migration decimal");
  return decimal.toFixed();
}

function normalizeExecution(execution: TradeExecution): Readonly<Record<string, unknown>> {
  try {
    return {
      id: execution.id,
      accountId: execution.accountId,
      accountLabel: execution.accountLabel,
      instrument: execution.instrument,
      side: execution.side,
      executedAt: execution.executedAt,
      quantity: decimalString(execution.quantity),
      price: decimalString(execution.price),
      fee: decimalString(execution.fee),
      source: execution.source,
    };
  } catch {
    return {
      id: execution.id,
      accountId: execution.accountId,
      accountLabel: execution.accountLabel,
      instrument: execution.instrument,
      side: execution.side,
      executedAt: execution.executedAt,
      quantity: execution.quantity,
      price: execution.price,
      fee: execution.fee,
      source: execution.source,
    };
  }
}

function rowString(row: DbRow, key: string): string {
  const value = row[key];
  if (typeof value !== "string") throw new Error(`Invalid ${key} in migration row`);
  return value;
}

function executionFromRow(row: DbRow): TradeExecution {
  const evidence = row.evidence_json === null || row.evidence_json === undefined
    ? {}
    : parseJson(row.evidence_json);
  const evidenceRecord = evidence && typeof evidence === "object" && !Array.isArray(evidence)
    ? evidence as JsonRecord
    : {};
  const sourceValue = evidenceRecord.source;
  const source = sourceValue && typeof sourceValue === "object" && !Array.isArray(sourceValue)
    ? cloneValue(sourceValue) as TradeExecution["source"]
    : { platform: "unknown", row: 0 };
  if (typeof row.trade_nature === "string" && source.tradeNature === undefined) source.tradeNature = row.trade_nature as TradeExecution["source"]["tradeNature"];
  if (typeof row.simulation_run_id === "string" && source.simulationRunId === undefined) source.simulationRunId = row.simulation_run_id;
  return {
    id: rowString(row, "id"),
    source,
    accountId: typeof row.account === "string" ? row.account : "",
    accountLabel: typeof evidenceRecord.accountLabel === "string" ? evidenceRecord.accountLabel : "",
    instrument: {
      id: rowString(row, "instrument_id"),
      symbol: rowString(row, "symbol"),
      name: rowString(row, "name"),
      market: rowString(row, "market"),
      currency: rowString(row, "currency"),
    },
    side: rowString(row, "side") as TradeExecution["side"],
    executedAt: rowString(row, "executed_at"),
    quantity: rowString(row, "quantity"),
    price: rowString(row, "price"),
    fee: typeof row.fee === "string" ? row.fee : "",
  };
}

function fieldName(sqlColumn: string, spec: ReferenceSpec): string {
  return spec.jsonColumns.includes(sqlColumn) && sqlColumn.endsWith("_json")
    ? sqlColumn.slice(0, -"_json".length)
    : sqlColumn;
}

function sqlColumn(field: string, spec: ReferenceSpec): string {
  const candidate = spec.jsonColumns.includes(`${field}_json`) ? `${field}_json` : field;
  if (!spec.columns.includes(candidate)) throw new TradingViewMigrationTransactionError("migration-unsupported-reference", `Reference field ${field} is not whitelisted.`);
  return candidate;
}

function referenceFields(row: DbRow, spec: ReferenceSpec): JsonRecord {
  const fields: JsonRecord = {};
  for (const [column, value] of Object.entries(row)) {
    if (!spec.columns.includes(column)) throw new TradingViewMigrationTransactionError("migration-unsupported-reference", `Reference column ${column} is not whitelisted.`);
    fields[fieldName(column, spec)] = spec.jsonColumns.includes(column) ? parseJson(value) : cloneValue(value);
  }
  return fields;
}

function primaryValues(fields: Readonly<Record<string, unknown>>, spec: ReferenceSpec): unknown[] {
  return spec.primaryKeys.map((key) => {
    const value = fields[key];
    if (value === undefined || value === null) throw new TradingViewMigrationTransactionError("migration-unsupported-reference", `Reference primary key ${key} is missing.`);
    return value;
  });
}

function samePrimaryKey(left: Readonly<Record<string, unknown>>, right: Readonly<Record<string, unknown>>, spec: ReferenceSpec): boolean {
  return spec.primaryKeys.every((key) => left[key] === right[key]);
}

function readRow(database: ReadDatabase, table: string, spec: ReferenceSpec, fields: Readonly<Record<string, unknown>>): DbRow | null {
  const keys = primaryValues(fields, spec);
  return cloneRow(tableRows(database, table).find(row => spec.primaryKeys.every((key, i) => row[key] === keys[i])));
}

function updateRawRow(
  database: DatabaseSync,
  table: string,
  spec: ReferenceSpec,
  current: DbRow,
  next: Readonly<Record<string, unknown>>,
): DbRow {
  const nextRaw: DbRow = { ...current };
  for (const [field, value] of Object.entries(next)) {
    const column = sqlColumn(field, spec);
    nextRaw[column] = spec.jsonColumns.includes(column) ? jsonValue(value) : cloneValue(value);
  }
  const columns = Object.keys(nextRaw).filter((column) => spec.columns.includes(column));
  if (columns.length === 0) throw new TradingViewMigrationTransactionError("migration-unsupported-reference", `No whitelisted columns exist for ${table}.`);
  const assignments = columns.map((column) => `${identifier(column)} = ?`).join(", ");
  const where = spec.primaryKeys.map((key) => `${identifier(key)} = ?`).join(" and ");
  const currentFields = referenceFields(current, spec);
  const result = database.prepare(`update ${identifier(table)} set ${assignments} where ${where}`).run(
    ...columns.map((column) => sqlInput(nextRaw[column])),
    ...primaryValues(currentFields, spec).map(sqlInput),
  );
  if (Number(result.changes) !== 1) throw new TradingViewMigrationTransactionError("migration-stale", `Expected one ${table} row while applying migration.`);
  const updated = readRow(database, table, spec, referenceFields(nextRaw, spec));
  if (!updated) throw new TradingViewMigrationTransactionError("migration-stale", `Updated ${table} row could not be read back.`);
  return updated;
}

function replaceReferenceRawRow(
  database: DatabaseSync,
  table: string,
  spec: ReferenceSpec,
  current: DbRow,
  replacement: DbRow,
): void {
  const columns = Object.keys(replacement).filter((column) => spec.columns.includes(column));
  if (columns.length === 0) throw new TradingViewMigrationTransactionError("migration-unsupported-reference", `No whitelisted columns exist for ${table}.`);
  const assignments = columns.map((column) => `${identifier(column)} = ?`).join(", ");
  const where = spec.primaryKeys.map((key) => `${identifier(key)} = ?`).join(" and ");
  const currentFields = referenceFields(current, spec);
  const result = database.prepare(`update ${identifier(table)} set ${assignments} where ${where}`).run(
    ...columns.map((column) => sqlInput(replacement[column])),
    ...primaryValues(currentFields, spec).map(sqlInput),
  );
  if (Number(result.changes) !== 1) throw new TradingViewMigrationTransactionError("migration-rollback-stale", `Expected one ${table} row while restoring rollback state.`);
}

function deleteRawRow(database: DatabaseSync, table: string, spec: ReferenceSpec, row: DbRow): void {
  const fields = referenceFields(row, spec);
  const where = spec.primaryKeys.map((key) => `${identifier(key)} = ?`).join(" and ");
  const result = database.prepare(`delete from ${identifier(table)} where ${where}`).run(...primaryValues(fields, spec).map(sqlInput));
  if (Number(result.changes) !== 1) throw new TradingViewMigrationTransactionError("migration-rollback-stale", `Expected one ${table} row while deleting rollback state.`);
}

function insertRawRow(database: DatabaseSync, table: string, spec: ReferenceSpec, row: DbRow): DbRow {
  const columns = Object.keys(row).filter((column) => spec.columns.includes(column));
  if (columns.length === 0) throw new TradingViewMigrationTransactionError("migration-unsupported-reference", `No whitelisted columns exist for ${table}.`);
  const placeholders = columns.map(() => "?").join(", ");
  database.prepare(`insert into ${identifier(table)} (${columns.map(identifier).join(", ")}) values (${placeholders})`).run(...columns.map((column) => sqlInput(row[column])));
  const fields = referenceFields(row, spec);
  const inserted = readRow(database, table, spec, fields);
  if (!inserted) throw new TradingViewMigrationTransactionError("migration-stale", `Inserted ${table} row could not be read back.`);
  return inserted;
}

function readReferenceRow(database: ReadDatabase, table: string, fields: Readonly<Record<string, unknown>>): DbRow | null {
  const spec = table === "source_material_account_mappings" ? MATERIAL_MAPPING_SPEC : REFERENCE_SPECS[table];
  if (!spec) throw new TradingViewMigrationTransactionError("migration-unsupported-reference", `Reference table ${table} is not whitelisted.`);
  return readRow(database, table, spec, fields);
}

function encodedIdentityVariants(value: string): string[] {
  const variants = [value];
  let encoded = value;
  for (let depth = 0; depth < 2; depth += 1) {
    encoded = encodeURIComponent(encoded);
    variants.push(encoded);
  }
  return [...new Set(variants)];
}

function containsIdentity(value: string, identities: readonly string[]): boolean {
  return identities.some((identity) => {
    if (encodedIdentityVariants(identity).some((variant) => value.includes(variant))) return true;
    let decoded = value;
    for (let depth = 0; depth < 2; depth += 1) {
      try {
        decoded = decodeURIComponent(decoded);
      } catch {
        break;
      }
      if (decoded.includes(identity)) return true;
    }
    return false;
  });
}

function valueContainsIdentity(value: unknown, identities: readonly string[]): boolean {
  if (typeof value === "string") {
    if (containsIdentity(value, identities)) return true;
    try {
      return value.trim().startsWith("{") || value.trim().startsWith("[")
        ? valueContainsIdentity(JSON.parse(value) as unknown, identities)
        : false;
    } catch {
      return false;
    }
  }
  if (Array.isArray(value)) return value.some((child) => valueContainsIdentity(child, identities));
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).some(([key, child]) => containsIdentity(key, identities) || valueContainsIdentity(child, identities));
  }
  return false;
}

function referenceRowKey(table: string, spec: ReferenceSpec, row: DbRow): string {
  try {
    return digest({ table, primaryKey: primaryValues(referenceFields(row, spec), spec) });
  } catch {
    return digest({ table, row });
  }
}

function schema16OrdinaryRevision(row: DbRow): DbRow | null {
  const columns = REFERENCE_SPECS.trade_revisions.columns;
  if (row.scope_account_unknown !== 0 || isFactStateAudit(row)
    || Object.keys(row).length !== columns.length || !columns.every((column) => Object.hasOwn(row, column))) return null;
  return Object.fromEntries(Object.entries(row).filter(([column]) => column !== "scope_account_unknown"));
}

function matchesLedgerImage(table: string, current: DbRow, image: DbRow, expectedDigest: string): boolean {
  if (digest(current) === expectedDigest) return true;
  if (table !== "trade_revisions" || Object.hasOwn(image, "scope_account_unknown") || isFactStateAudit(image)) return false;
  const legacy = schema16OrdinaryRevision(current);
  // Migration17 adds exactly one defaulted discriminator. Preserve every old
  // column, and never project a dedicated fact-state audit onto the old shape.
  return legacy !== null && digest(Object.keys(legacy).sort()) === digest(Object.keys(image).sort()) && digest(legacy) === expectedDigest;
}

function scanReferenceDependencies(database: ReadDatabase, identities: readonly string[], concreteKeys = false, legacyBaseline: readonly DependencyRow[] = []): DependencyRow[] {
  if (identities.length === 0) return [];
  const legacyDigests = new Map(legacyBaseline.filter((row) => row.tableName === "trade_revisions").map((row) => [row.rowKey, row.rowDigest]));
  const dependencies: DependencyRow[] = [];
  for (const [table, spec] of Object.entries(REFERENCE_SPECS)) {
    const rows = tableRows(database, table);
    for (const row of rows) {
      if (!Object.entries(row).some(([key, value]) => containsIdentity(key, identities) || valueContainsIdentity(value, identities))) continue;
      const rowKey = concreteKeys ? jsonValue(spec.primaryKeys.map((column) => row[column])) : referenceRowKey(table, spec, row);
      const legacy = table === "trade_revisions" ? schema16OrdinaryRevision(row) : null;
      const rowDigest = legacy && legacyDigests.get(rowKey) === digest(legacy) ? digest(legacy) : digest(row);
      dependencies.push({
        tableName: table,
        rowKey,
        rowDigest,
      });
    }
  }
  return dependencies.sort((left, right) => `${left.tableName}\u0000${left.rowKey}`.localeCompare(`${right.tableName}\u0000${right.rowKey}`));
}

function scopeForPlan(plan: TradingViewAccountMigrationPlan): DependencyScope {
  return {
    executionIds: plan.executionPlan.map((row) => row.executionId).sort(),
    identities: [...new Set([
      TRADINGVIEW_CANONICAL_ACCOUNT_ID,
      ...plan.executionPlan.flatMap((row) => [row.executionId, row.beforeAccountId, row.afterAccountId, row.sourceRunId]),
      ...plan.episodeMap.flatMap((row) => [row.oldEpisodeId, row.newEpisodeId]),
    ])].sort(),
  };
}

function scopeForOperation(aliases: readonly TradingViewMigrationAlias[], rows: readonly LedgerRow[]): DependencyScope {
  const executions = rows.filter((row) => row.tableName === "executions");
  return {
    executionIds: executions.map((row) => row.primaryKey).sort(),
    identities: [...new Set([
      TRADINGVIEW_CANONICAL_ACCOUNT_ID,
      ...aliases.flatMap((alias) => [alias.oldId, alias.newId]),
      ...executions.flatMap((row) => [row.primaryKey, row.before?.simulation_run_id, row.after?.simulation_run_id].filter((value): value is string => typeof value === "string" && value.length > 0)),
    ])].sort(),
  };
}

function sourceGraph(database: ReadDatabase, executionIds: readonly string[]): SourceGraph {
  const target = new Set(executionIds);
  const links = tableRows(database, "source_execution_links");
  const observations = tableRows(database, "source_observations");
  const versions = tableRows(database, "source_material_versions");
  const targetObservations = new Set(links.filter((row) => target.has(rowString(row, "execution_id"))).map((row) => rowString(row, "observation_id")));
  const targetVersions = new Set(observations.filter((row) => targetObservations.has(rowString(row, "id"))).map((row) => rowString(row, "version_id")));
  const materialIds = new Set(versions.filter((row) => targetVersions.has(rowString(row, "id"))).map((row) => rowString(row, "material_id")));
  const ownedVersions = versions.filter((row) => materialIds.has(rowString(row, "material_id")));
  const versionIds = new Set(ownedVersions.map((row) => rowString(row, "id")));
  const ownedObservations = observations.filter((row) => versionIds.has(rowString(row, "version_id")));
  const observationIds = new Set(ownedObservations.map((row) => rowString(row, "id")));
  return {
    materials: (tableRows(database, "source_materials")).filter((row) => materialIds.has(rowString(row, "id"))),
    versions: ownedVersions,
    observations: ownedObservations,
    links: links.filter((row) => observationIds.has(rowString(row, "observation_id")) || target.has(rowString(row, "execution_id"))),
    mappings: (tableRows(database, "source_material_account_mappings")).filter((row) => materialIds.has(rowString(row, "material_id"))),
    states: (tableRows(database, "execution_fact_states")).filter((row) => target.has(rowString(row, "execution_id"))),
  };
}

const SOURCE_DEPENDENCY_KEYS = {
  materials: ["source_materials", ["id"]],
  versions: ["source_material_versions", ["id"]],
  observations: ["source_observations", ["id"]],
  links: ["source_execution_links", ["observation_id", "execution_id"]],
  mappings: ["source_material_account_mappings", ["material_id", "original_account_id"]],
  states: ["execution_fact_states", ["execution_id"]],
} as const;

function sourceDependencies(graph: SourceGraph): DependencyRow[] {
  return Object.entries(SOURCE_DEPENDENCY_KEYS).flatMap(([name, [table, keys]]) =>
    graph[name as keyof SourceGraph].map((row) => ({ tableName: table, rowKey: jsonValue(keys.map((key) => row[key])), rowDigest: digest(row) })));
}

function completeDependencies(database: ReadDatabase, scope: DependencyScope): DependencyRow[] {
  const rows = [
    ...scanReferenceDependencies(database, scope.identities, true),
    ...sourceDependencies(sourceGraph(database, scope.executionIds)),
    { tableName: "account_principal_provisionals", rowKey: jsonValue([TRADINGVIEW_CANONICAL_ACCOUNT_ID]), rowDigest: digest(readPrincipal(database)) },
  ];
  // Empty sets are explicit dependencies too. A row moving into/out of the scope
  // must invalidate the same plan even when its content no longer matches.
  const tables = [...Object.keys(REFERENCE_SPECS), ...Object.values(SOURCE_DEPENDENCY_KEYS).map(([table]) => table), "account_principal_provisionals"];
  for (const table of tables) rows.push({ tableName: table, rowKey: "@membership", rowDigest: digest(rows.filter((row) => row.tableName === table).map((row) => row.rowKey).sort()) });
  rows.push({ tableName: DEPENDENCY_POLICY_TABLE, rowKey: "@policy", rowDigest: digest(DEPENDENCY_POLICY) });
  return rows.sort((left, right) => `${left.tableName}\u0000${left.rowKey}`.localeCompare(`${right.tableName}\u0000${right.rowKey}`));
}

function writeDependencyGuard(database: DatabaseSync, operationId: string, scope: DependencyScope): void {
  const statement = database.prepare("insert into tradingview_account_migration_dependencies (operation_id, table_name, row_key, row_digest) values (?, ?, ?, ?)");
  for (const row of completeDependencies(database, scope)) statement.run(operationId, row.tableName, row.rowKey, row.rowDigest);
}

function readDependencyGuard(database: ReadDatabase, operationId: string): DependencyRow[] {
  const rows = tableRows(database, "tradingview_account_migration_dependencies").filter(row => row.operation_id === operationId).sort((a,b) => `${a.table_name}\0${a.row_key}`.localeCompare(`${b.table_name}\0${b.row_key}`));
  return rows.map((row) => ({
    tableName: rowString(row, "table_name"),
    rowKey: rowString(row, "row_key"),
    rowDigest: rowString(row, "row_digest"),
  }));
}

function readAliases(database: ReadDatabase, operationId: string): TradingViewMigrationAlias[] {
  const rows = tableRows(database, "tradingview_account_migration_aliases").filter(row => row.operation_id === operationId).sort((a,b) => `${a.alias_kind}\0${a.old_id}`.localeCompare(`${b.alias_kind}\0${b.old_id}`));
  return rows.map((row) => ({
    operationId: rowString(row, "operation_id"),
    kind: rowString(row, "alias_kind") as TradingViewMigrationAlias["kind"],
    oldId: rowString(row, "old_id"),
    newId: rowString(row, "new_id"),
  }));
}

function compareDependencies(expected: readonly DependencyRow[], current: readonly DependencyRow[]): TradingViewMigrationRollbackPreviewBlocker[] {
  const before = new Map(expected.map((row) => [`${row.tableName}\u0000${row.rowKey}`, row]));
  const after = new Map(current.map((row) => [`${row.tableName}\u0000${row.rowKey}`, row]));
  return [...new Set([...before.keys(), ...after.keys()])].sort().flatMap((key) => {
    const old = before.get(key), next = after.get(key);
    if (old?.rowDigest === next?.rowDigest) return [];
    const row = next ?? old!;
    return [{ code: "migration-rollback-stale" as const, message: `The ${row.tableName}/${row.rowKey} dependency ${!old ? "was added" : !next ? "was removed or moved out of scope" : "changed"} after migration.`, table: row.tableName, primaryKey: row.rowKey }];
  });
}

/** A schema16 legacy association can be reconstructed from facts that the
 * original operation actually audited. IDs or timestamps alone are not proof. */
function legacyObservationProof(database: ReadDatabase, batchId: string, executionId: string): DbRow | undefined {
  if ("tables" in database) return database.legacyProofs[executionId] ?? undefined;
  // Reproduce migration16's read projection, including duplicate positions and
  // unknown locators. A legacy-looking identifier cannot supply this proof.
  return database.prepare(`
    with candidates as (
      select e.*, case when json_type(evidence_json,'$.source.fileFingerprint')='text'
        and length(trim(json_extract(evidence_json,'$.source.fileFingerprint')))>0
        and json_type(evidence_json,'$.source.row')='integer' and json_extract(evidence_json,'$.source.row')>0
        then json_array(json_extract(evidence_json,'$.source.fileFingerprint'),json_extract(evidence_json,'$.source.page'),
          json_extract(evidence_json,'$.source.sheet'),json_extract(evidence_json,'$.source.row')) end as position_key
      from executions e where import_batch_id=?
    ), positions as (select *,count(*) over(partition by position_key) as multiplicity from candidates)
    select case when multiplicity=1 then position_key end as observation_key,
      case when multiplicity=1 and position_key is not null then 'located' else 'unresolved' end as identity_status,
      case when position_key is not null then json_object('fileFingerprint',json_extract(evidence_json,'$.source.fileFingerprint'),
        'page',json_extract(evidence_json,'$.source.page'),'sheet',json_extract(evidence_json,'$.source.sheet'),
        'row',json_extract(evidence_json,'$.source.row')) else '{}' end as locator_json
    from positions where id=?
  `).get(batchId, executionId) as DbRow | undefined;
}

function provenLegacyAssociations(database: ReadDatabase, operationId: string, rows: readonly LedgerRow[], graph: SourceGraph): { proven: Set<string>; batches: DependencyRow[] } {
  const executions = new Map(rows.filter((row) => row.tableName === "executions" && row.before && row.after).map((row) => [row.primaryKey, row]));
  const proven = new Set<string>();
  const batches = new Map<string, DependencyRow>();
  for (const link of graph.links) {
    const ledger = executions.get(rowString(link, "execution_id"));
    const observation = graph.observations.find((row) => row.id === link.observation_id);
    const version = observation && graph.versions.find((row) => row.id === observation.version_id);
    const material = version && graph.materials.find((row) => row.id === version.material_id);
    if (!ledger?.after || !ledger.before || !observation || !version || !material) continue;
    const batchId = ledger.after.import_batch_id;
    if (typeof batchId !== "string" || ledger.before.import_batch_id !== batchId) continue;
    const batch = cloneRow(tableRows(database,"import_batches").find(row => row.id === batchId));
    const evidence = parseJson(ledger.after.evidence_json);
    const correction = evidence && typeof evidence === "object" && !Array.isArray(evidence) ? (evidence as JsonRecord).accountCorrection : null;
    if (!batch || !correction || typeof correction !== "object" || Array.isArray(correction)
      || (correction as JsonRecord).operationId !== operationId
      || (correction as JsonRecord).originalAccountId !== ledger.before.account
      || (correction as JsonRecord).canonicalAccountId !== TRADINGVIEW_CANONICAL_ACCOUNT_ID
      || ledger.after.account !== TRADINGVIEW_CANONICAL_ACCOUNT_ID) continue;
    if (material.id !== `legacy:material:${batchId}` || version.id !== `legacy:version:${batchId}`
      || material.current_version_id !== version.id || material.created_at !== batch.imported_at
      || version.material_id !== material.id || version.supersedes_version_id !== null
      || version.parser_version !== "legacy-unrecorded" || version.legacy_batch_id !== batchId
      || version.source_kind !== (batch.source_type ?? "unknown") || version.file_fingerprint !== batch.source_fingerprint
      || version.recorded_at !== batch.imported_at || version.raw_reconciliation_json !== batch.reconciliation_json
      || version.raw_evidence_json !== batch.evidence_json || digest(parseJson(version.legacy_batch_json)) !== digest(batch)
      || digest(parseJson(version.locator_json)) !== digest({ legacyBatchId: batchId })
      || digest(parseJson(version.scope_json)) !== digest(Object.fromEntries(["accounts", "markets", "instruments", "periods"].map((axis) => [axis, { values: [], unknown: true }])))
      || digest(parseJson(version.diagnostics_json)) !== digest(batch.source_fingerprint === null ? [{ code: "FILE_FINGERPRINT_UNKNOWN" }] : [])
      || digest(parseJson(version.content_json)) !== digest({})
      || graph.versions.filter((row) => row.material_id === material.id).length !== 1
      || graph.mappings.some((row) => row.material_id === material.id)) continue;
    const revision = tableRows(database,"trade_revisions").find(row => row.id === batchId);
    if (version.legacy_revision_request_json !== (revision?.request_json ?? null)) continue;
    const expectedObservation = legacyObservationProof(database, batchId, ledger.primaryKey);
    if (observation.id !== `legacy:observation:${batchId.length}:${batchId}:${ledger.primaryKey}`
      || !expectedObservation || observation.observation_key !== expectedObservation.observation_key
      || observation.identity_status !== expectedObservation.identity_status
      || digest(parseJson(observation.locator_json)) !== digest(parseJson(expectedObservation.locator_json))
      || observation.original_account_id !== ledger.before.account
      || observation.raw_json !== ledger.after.evidence_json
      || link.reason !== "legacy-batch-reference" || link.recorded_at !== ledger.after.created_at) continue;
    proven.add(jsonValue([link.observation_id, link.execution_id]));
    batches.set(batchId, { tableName: "import_batches", rowKey: referenceRowKey("import_batches", REFERENCE_SPECS.import_batches, batch), rowDigest: digest(batch) });
  }
  return { proven, batches: [...batches.values()] };
}

function historicalDependencyBlockers(database: ReadDatabase, operationId: string, aliases: readonly TradingViewMigrationAlias[], rows: readonly LedgerRow[]): TradingViewMigrationRollbackPreviewBlocker[] {
  const expected = readDependencyGuard(database, operationId);
  const scope = scopeForOperation(aliases, rows);
  const graph = sourceGraph(database, scope.executionIds);
  const proof = provenLegacyAssociations(database, operationId, rows, graph);
  // The immutable schema16 batch projection supplies an upgrade baseline only
  // after its execution/correction/association provenance has been proven.
  const expectedKeys = new Set(expected.map((row) => `${row.tableName}\u0000${row.rowKey}`));
  const derived = proof.batches.filter((row) => !expectedKeys.has(`${row.tableName}\u0000${row.rowKey}`));
  const blockers = compareDependencies([...expected, ...derived], scanReferenceDependencies(database, scope.identities, false, expected));
  for (const link of graph.links) {
    const primaryKey = jsonValue([link.observation_id, link.execution_id]);
    if (proof.proven.has(primaryKey)) continue;
    blockers.push({ code: "migration-rollback-stale", message: "This historical operation has no proven baseline for the source association.", table: "source_execution_links", primaryKey });
  }
  for (const state of graph.states) blockers.push({ code: "migration-rollback-stale", message: "A fact-state revision has no baseline in this historical operation.", table: "execution_fact_states", primaryKey: rowString(state, "execution_id") });
  if (!rows.some((row) => row.tableName === "account_principal_provisionals")) {
    blockers.push({ code: "migration-rollback-stale", message: "The historical no-op principal has no complete before/after baseline.", table: "account_principal_provisionals", primaryKey: TRADINGVIEW_CANONICAL_ACCOUNT_ID });
  }
  return blockers;
}

function dependencyGuardBlockers(database: ReadDatabase, operationId: string, aliases: readonly TradingViewMigrationAlias[], rows: readonly LedgerRow[]): TradingViewMigrationRollbackPreviewBlocker[] {
  const expected = readDependencyGuard(database, operationId);
  if (!expected.some((row) => row.tableName === DEPENDENCY_POLICY_TABLE && row.rowDigest === digest(DEPENDENCY_POLICY))) {
    return historicalDependencyBlockers(database, operationId, aliases, rows);
  }
  return compareDependencies(expected, completeDependencies(database, scopeForOperation(aliases, rows)));
}

function isFactStateAudit(row: DbRow | null): boolean {
  if (!row) return false;
  if (row.scope_account_unknown === 1) return true;
  return [row.request_json, row.revision_json].some((value) => {
    const audit = parseJson(value);
    return audit && typeof audit === "object" && !Array.isArray(audit) && (audit as JsonRecord).kind === "fact-state-audit-v1";
  });
}

function updateReferenceRow(database: DatabaseSync, row: TradingViewReferenceMigrationPlanRow): LedgerRow | null {
  if (row.beforeDigest === row.afterDigest || row.status === "preserved") return null;
  const spec = REFERENCE_SPECS[row.table];
  if (!spec) throw new TradingViewMigrationTransactionError("migration-unsupported-reference", `Reference table ${row.table} is not whitelisted.`);
  const current = readReferenceRow(database, row.table, row.before);
  if (!current) throw new TradingViewMigrationTransactionError("migration-stale", `Reference ${row.table}/${row.primaryKey} no longer exists.`);
  if (row.table === "trade_revisions" && isFactStateAudit(current)) {
    throw new TradingViewMigrationTransactionError("migration-blocked", `Fact-state audit ${row.primaryKey} must retain its original scope and raw facts.`, { table: row.table, primaryKey: row.primaryKey });
  }
  const currentFields = referenceFields(current, spec);
  const comparableFields = Object.fromEntries(Object.keys(row.before).map((key) => [key, currentFields[key]]));
  if (Object.keys(comparableFields).some((key) => !(key in currentFields)) || digest(comparableFields) !== row.beforeDigest) {
    throw new TradingViewMigrationTransactionError("migration-stale", `Reference ${row.table}/${row.primaryKey} changed after preview.`);
  }
  if (!samePrimaryKey(row.before, row.after, spec) && readReferenceRow(database, row.table, row.after)) {
    throw new TradingViewMigrationTransactionError("migration-primary-key-conflict", `Reference ${row.table}/${row.primaryKey} maps onto an existing primary key.`);
  }
  const updated = updateRawRow(database, row.table, spec, current, row.after);
  const updatedFields = referenceFields(updated, spec);
  const comparableAfter = Object.fromEntries(Object.keys(row.after).map((key) => [key, updatedFields[key]]));
  if (digest(comparableAfter) !== row.afterDigest) {
    throw new TradingViewMigrationTransactionError("migration-stale", `Reference ${row.table}/${row.primaryKey} did not preserve its planned after image.`);
  }
  return {
    tableName: row.table,
    primaryKey: row.primaryKey,
    before: current,
    after: updated,
    beforeDigest: digest(current),
    afterDigest: digest(updated),
  };
}

function readExecutionRaw(database: ReadDatabase, executionId: string): DbRow | null {
  return cloneRow(tableRows(database,"executions").find(row => row.id === executionId));
}

function readExecutionForDigest(database: DatabaseSync, executionId: string): TradeExecution {
  const row = database.prepare(`
    select e.*, i.symbol, i.name, i.market, i.currency
    from executions e join instruments i on i.id = e.instrument_id
    where e.id = ?
  `).get(executionId) as DbRow | undefined;
  if (!row) throw new TradingViewMigrationTransactionError("migration-stale", `Execution ${executionId} no longer exists.`);
  return executionFromRow(row);
}

const EXECUTION_IMMUTABLE_COLUMNS = [
  "id", "import_batch_id", "instrument_id", "side", "executed_at", "quantity", "price", "fee", "currency", "trade_nature", "simulation_run_id",
] as const;

function assertExecutionImmutable(before: DbRow, after: DbRow, executionId: string): void {
  for (const column of EXECUTION_IMMUTABLE_COLUMNS) {
    if (before[column] !== after[column]) {
      throw new TradingViewMigrationTransactionError("migration-stale", `Execution ${executionId} changed immutable financial or source column ${column} during migration.`);
    }
  }
}

function currentExecutionLedgerRow(database: DatabaseSync, row: TradingViewExecutionMigrationPlanRow, operationId: string): LedgerRow {
  const current = readExecutionRaw(database, row.executionId);
  if (!current) throw new TradingViewMigrationTransactionError("migration-stale", `Execution ${row.executionId} no longer exists.`);
  const currentExecution = readExecutionForDigest(database, row.executionId);
  if (digest(normalizeExecution(currentExecution)) !== row.beforeDigest) {
    throw new TradingViewMigrationTransactionError("migration-stale", `Execution ${row.executionId} changed after preview.`);
  }
  if (row.beforeAccountId === row.afterAccountId) return {
    tableName: "executions",
    primaryKey: row.executionId,
    before: current,
    after: current,
    beforeDigest: digest(current),
    afterDigest: digest(current),
  };
  const evidenceValue = parseJson(current.evidence_json);
  if (!evidenceValue || typeof evidenceValue !== "object" || Array.isArray(evidenceValue)) {
    throw new TradingViewMigrationTransactionError("migration-stale", `Execution ${row.executionId} has no auditable evidence JSON.`);
  }
  const evidence = evidenceValue as JsonRecord;
  const source = evidence.source;
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    throw new TradingViewMigrationTransactionError("migration-stale", `Execution ${row.executionId} has no auditable source evidence.`);
  }
  const correction = {
    originalAccountId: row.beforeAccountId,
    canonicalAccountId: row.afterAccountId,
    originalAccountLabel: row.beforeAccountLabel,
    reason: "tradingview-account-migration",
    operationId,
  };
  const nextEvidence = {
    ...evidence,
    accountLabel: row.afterAccountLabel,
    accountCorrection: correction,
  };
  database.prepare("update executions set account = ?, evidence_json = ?, updated_at = current_timestamp where id = ?")
    .run(row.afterAccountId, jsonValue(nextEvidence), row.executionId);
  const after = readExecutionRaw(database, row.executionId);
  if (!after) throw new TradingViewMigrationTransactionError("migration-stale", `Execution ${row.executionId} could not be read after update.`);
  assertExecutionImmutable(current, after, row.executionId);
  const afterExecution = readExecutionForDigest(database, row.executionId);
  if (digest(normalizeExecution(afterExecution)) !== row.afterDigest) {
    throw new TradingViewMigrationTransactionError("migration-stale", `Execution ${row.executionId} changed an immutable financial or source field during migration.`);
  }
  return {
    tableName: "executions",
    primaryKey: row.executionId,
    before: current,
    after,
    beforeDigest: digest(current),
    afterDigest: digest(after),
  };
}

function principalMatches(row: DbRow, amount: string, currency: string, asOf: string | null, status: string, source: string): boolean {
  try {
    return row.account_id === TRADINGVIEW_CANONICAL_ACCOUNT_ID
      && String(row.currency).toUpperCase() === currency.toUpperCase()
      && decimalString(String(row.amount)) === decimalString(amount)
      && (row.as_of ?? null) === asOf
      && row.status === status
      && row.source === source;
  } catch {
    return false;
  }
}

function readPrincipal(database: ReadDatabase): DbRow | null {
  return cloneRow(tableRows(database,"account_principal_provisionals").find(row => row.account_id === TRADINGVIEW_CANONICAL_ACCOUNT_ID));
}

function applyPrincipal(
  database: DatabaseSync,
  plan: TradingViewAccountMigrationPlan,
  now: string,
): { ledger: LedgerRow | null; revision?: number } {
  const action = plan.provisionalPrincipal.action;
  const current = readPrincipal(database);
  if (action === "conflict") throw new TradingViewMigrationTransactionError("migration-blocked", "The provisional principal plan is conflicting.");
  if (action === "no-op") {
    if (!current || !principalMatches(current, "100000", "CNY", null, "provisional", "user-default")) {
      throw new TradingViewMigrationTransactionError("migration-stale", "The expected provisional principal is no longer present.");
    }
    if (plan.provisionalPrincipal.revision !== undefined && Number(current.revision) !== plan.provisionalPrincipal.revision) {
      throw new TradingViewMigrationTransactionError("migration-stale", "The provisional principal revision changed after preview.");
    }
    return { ledger: null, revision: Number(current.revision) };
  }
  if (current) {
    if (!principalMatches(current, "100000", "CNY", null, "provisional", "user-default")) {
      throw new TradingViewMigrationTransactionError("canonical-account-conflict", "The canonical account already has a different principal.");
    }
    return { ledger: null, revision: Number(current.revision) };
  }
  const next = {
    account_id: TRADINGVIEW_CANONICAL_ACCOUNT_ID,
    currency: "CNY",
    amount: "100000",
    as_of: null,
    status: "provisional",
    source: "user-default",
    revision: 0,
    updated_at: now,
  };
  database.prepare("insert into account_principal_provisionals (account_id, currency, amount, as_of, status, source, revision, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?)")
    .run(next.account_id, next.currency, next.amount, next.as_of, next.status, next.source, next.revision, next.updated_at);
  return {
    ledger: {
      tableName: "account_principal_provisionals",
      primaryKey: TRADINGVIEW_CANONICAL_ACCOUNT_ID,
      before: null,
      after: next,
      beforeDigest: digest(null),
      afterDigest: digest(next),
    },
    revision: 0,
  };
}

function readOperation(database: ReadDatabase, operationId: string): DbRow | null {
  return cloneRow(tableRows(database,"tradingview_account_migration_operations").find(row => row.operation_id === operationId));
}

function parseResult<T>(row: DbRow): T {
  const value = parseJson(row.result_json);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid migration operation result");
  return value as T;
}

function readerFor(database: ReadDatabase): ReadonlySqliteRows {
  return { all<T extends ReadonlySqliteRow>(sql: string): readonly T[] {
    if (sql.includes("join instruments")) {
      return tableRows(database,"executions").flatMap(row => {
        const instrument=tableRows(database,"instruments").find(i => i.id === row.instrument_id);
        return instrument ? [{...row,...Object.fromEntries(["symbol","name","market","currency","metadata_json","localized_name_json"].map(key=>[key,instrument[key]]))}] : [];
      }) as T[];
    }
    const table = /^select \* from ([a-z_]+)$/.exec(sql.trim())?.[1];
    if (!table || !(table in REFERENCE_SPECS) && table !== "account_principal_provisionals") throw new Error("Unsupported migration snapshot read");
    return tableRows(database,table).map(row=>({...row})) as T[];
  }};
}

function digestAffectedRows(rows: readonly LedgerRow[]): string {
  return digest(rows
    .map((row) => ({ tableName: row.tableName, primaryKey: row.primaryKey, afterDigest: row.afterDigest }))
    .sort((left, right) => `${left.tableName}\u0000${left.primaryKey}`.localeCompare(`${right.tableName}\u0000${right.primaryKey}`)));
}

function affectedPlanRows(plan: TradingViewAccountMigrationPlan): TradingViewMigrationExpectedAffectedRow[] {
  return [
    ...plan.executionPlan.map((row) => ({ table: "executions", key: row.executionId, beforeDigest: row.beforeDigest })),
    ...plan.referencePlan.map((row) => ({ table: row.table, key: row.primaryKey, beforeDigest: row.beforeDigest })),
  ];
}

function validateExpectedRows(plan: TradingViewAccountMigrationPlan, expected: readonly TradingViewMigrationExpectedAffectedRow[] | undefined): void {
  if (!expected) return;
  const expectedMap = new Map(expected.map((row) => [`${row.table}\u0000${row.key}`, row.beforeDigest]));
  const planRows = affectedPlanRows(plan);
  if (expectedMap.size !== expected.length || expectedMap.size !== planRows.length) {
    throw new TradingViewMigrationTransactionError("migration-stale", "The affected-row expectation does not match the current plan.");
  }
  for (const row of planRows) {
    if (expectedMap.get(`${row.table}\u0000${row.key}`) !== row.beforeDigest) {
      throw new TradingViewMigrationTransactionError("migration-stale", `The affected-row expectation for ${row.table}/${row.key} changed.`);
    }
  }
}

function writeOperation(
  database: DatabaseSync,
  operationId: string,
  kind: "commit" | "rollback",
  parentOperationId: string | null,
  idempotencyKey: string,
  planDigest: string,
  baseSnapshotDigest: string,
  now: string,
  request: unknown,
): void {
  const status = kind === "rollback" ? "rolled-back" : "committed";
  database.prepare(`
    insert into tradingview_account_migration_operations
      (operation_id, operation_kind, parent_operation_id, idempotency_key, plan_digest, base_snapshot_digest, status, request_json, result_json, created_at, updated_at)
    values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(operationId, kind, parentOperationId, idempotencyKey, planDigest, baseSnapshotDigest, status, jsonValue(request), "{}", now, now);
}

function writeLedger(database: DatabaseSync, operationId: string, rows: readonly LedgerRow[]): void {
  const statement = database.prepare(`
    insert into tradingview_account_migration_rows
      (operation_id, table_name, primary_key, before_json, after_json, before_digest, after_digest)
    values (?, ?, ?, ?, ?, ?, ?)
  `);
  for (const row of rows) {
    statement.run(operationId, row.tableName, row.primaryKey, jsonValue(row.before), jsonValue(row.after), row.beforeDigest, row.afterDigest);
  }
}

function migrationAliases(operationId: string, plan: TradingViewAccountMigrationPlan): TradingViewMigrationAlias[] {
  const aliases: TradingViewMigrationAlias[] = [];
  const accountIds = [...new Set(plan.executionPlan.map((row) => row.beforeAccountId).filter((id) => id !== TRADINGVIEW_CANONICAL_ACCOUNT_ID))];
  for (const oldId of accountIds) aliases.push({ operationId, kind: "account", oldId, newId: TRADINGVIEW_CANONICAL_ACCOUNT_ID });
  for (const row of plan.episodeMap) aliases.push({ operationId, kind: "episode", oldId: row.oldEpisodeId, newId: row.newEpisodeId });
  return aliases;
}

function writeAliases(database: DatabaseSync, aliases: readonly TradingViewMigrationAlias[]): void {
  const statement = database.prepare("insert into tradingview_account_migration_aliases (operation_id, alias_kind, old_id, new_id) values (?, ?, ?, ?)");
  for (const alias of aliases) statement.run(alias.operationId, alias.kind, alias.oldId, alias.newId);
}

function verifyExecutionConservation(database: DatabaseSync, plan: TradingViewAccountMigrationPlan, appliedRows: readonly LedgerRow[]): void {
  const beforeByExecutionId = new Map(
    appliedRows
      .filter((row) => row.tableName === "executions" && row.before)
      .map((row) => [row.primaryKey, row.before as DbRow]),
  );
  for (const row of plan.executionPlan) {
    const currentRaw = readExecutionRaw(database, row.executionId);
    if (!currentRaw) throw new TradingViewMigrationTransactionError("migration-stale", `Execution ${row.executionId} disappeared during migration.`);
    const beforeRaw = beforeByExecutionId.get(row.executionId);
    if (beforeRaw) assertExecutionImmutable(beforeRaw, currentRaw, row.executionId);
    if (currentRaw.account !== row.afterAccountId) {
      throw new TradingViewMigrationTransactionError("migration-stale", `Execution ${row.executionId} did not retain the planned canonical account.`);
    }
    const currentExecution = readExecutionForDigest(database, row.executionId);
    if (digest(normalizeExecution(currentExecution)) !== row.afterDigest) {
      throw new TradingViewMigrationTransactionError("migration-stale", `Execution ${row.executionId} did not preserve quantity, fee, source, or other financial fields after migration.`);
    }
  }
}

function verifyReferenceConservation(database: DatabaseSync, plan: TradingViewAccountMigrationPlan): void {
  for (const row of plan.referencePlan) {
    if (row.status === "preserved" || row.beforeDigest === row.afterDigest) continue;
    const spec = REFERENCE_SPECS[row.table];
    if (!spec) throw new TradingViewMigrationTransactionError("migration-unsupported-reference", `Reference table ${row.table} is not whitelisted.`);
    const current = readReferenceRow(database, row.table, row.after);
    if (!current) throw new TradingViewMigrationTransactionError("migration-stale", `Reference ${row.table}/${row.primaryKey} disappeared during migration.`);
    const currentFields = referenceFields(current, spec);
    const comparable = Object.fromEntries(Object.keys(row.after).map((key) => [key, currentFields[key]]));
    if (digest(comparable) !== row.afterDigest) {
      throw new TradingViewMigrationTransactionError("migration-stale", `Reference ${row.table}/${row.primaryKey} changed after its migration write.`);
    }
  }
}

function executePlan(database: DatabaseSync, operationId: string, plan: TradingViewAccountMigrationPlan, now: string, source: PreparedSourceAccountCorrection): { rows: LedgerRow[]; principalRevision?: number } {
  database.exec("pragma defer_foreign_keys = on");
  const sourceBefore = sourceDependencies(sourceGraph(database, plan.executionPlan.map((row) => row.executionId)));
  _assertPreparedSourceMaterialAccountCorrectionInTransaction(database, source, "before");
  const rows: LedgerRow[] = [];
  const executionIds = new Set<string>();
  for (const row of plan.executionPlan) {
    if (executionIds.has(row.executionId)) throw new TradingViewMigrationTransactionError("migration-stale", `Execution ${row.executionId} occurs more than once in the plan.`);
    executionIds.add(row.executionId);
    const ledger = currentExecutionLedgerRow(database, row, operationId);
    if (ledger.beforeDigest !== ledger.afterDigest || row.beforeAccountId !== row.afterAccountId) rows.push(ledger);
  }
  const referenceRows = [...plan.referencePlan].sort((left, right) => left.table.localeCompare(right.table) || left.primaryKey.localeCompare(right.primaryKey));
  for (const row of referenceRows) {
    const ledger = updateReferenceRow(database, row);
    if (ledger) rows.push(ledger);
  }
  const principal = applyPrincipal(database, plan, now);
  if (principal.ledger) rows.push(principal.ledger);
  if (principal.ledger?.after) {
    const currentPrincipal = readPrincipal(database);
    if (!currentPrincipal || digest(currentPrincipal) !== digest(principal.ledger.after)) {
      throw new TradingViewMigrationTransactionError("migration-stale", "The provisional principal changed during migration.");
    }
  }
  const mappings = _applyPreparedSourceMaterialAccountCorrectionInTransaction(database, source);
  rows.push(...mappings);
  const expectedSource = new Map(sourceBefore.map((row) => [`${row.tableName}\u0000${row.rowKey}`, row]));
  for (const row of mappings) expectedSource.set(`${row.tableName}\u0000${row.primaryKey}`, { tableName: row.tableName, rowKey: row.primaryKey, rowDigest: row.afterDigest });
  const sourceAfter = sourceDependencies(sourceGraph(database, plan.executionPlan.map((row) => row.executionId)));
  if (compareDependencies([...expectedSource.values()], sourceAfter).length > 0) throw new TradingViewMigrationTransactionError("migration-stale", "Source evidence, mappings or associations changed during migration.");
  verifyExecutionConservation(database, plan, rows);
  verifyReferenceConservation(database, plan);
  return { rows, principalRevision: principal.revision };
}

function currentRawRow(database: ReadDatabase, table: string, raw: DbRow): DbRow | null {
  if (table === "executions") return readExecutionRaw(database, rowString(raw, "id"));
  if (table === "account_principal_provisionals") return readPrincipal(database);
  const spec = table === "source_material_account_mappings" ? MATERIAL_MAPPING_SPEC : REFERENCE_SPECS[table];
  if (!spec) throw new TradingViewMigrationTransactionError("migration-unsupported-reference", `Reference table ${table} is not whitelisted.`);
  return readReferenceRow(database, table, referenceFields(raw, spec));
}

function restoreRawRow(database: DatabaseSync, table: string, before: DbRow | null, after: DbRow | null): void {
  if (table === "source_material_account_mappings") throw new Error("Source mapping writes require source authority");
  if (table === "trade_revisions" && (isFactStateAudit(before) || isFactStateAudit(after))) {
    throw new TradingViewMigrationTransactionError("migration-rollback-stale", "A fact-state audit cannot be rewritten by a migration rollback.", { table, primaryKey: String((after ?? before)?.id) });
  }
  if (!after && before) {
    if (table === "executions") {
      if (currentRawRow(database, table, before)) throw new TradingViewMigrationTransactionError("migration-rollback-stale", `Execution ${rowString(before, "id")} already exists during rollback.`);
      const columns = Object.keys(before).filter((column) => EXECUTION_COLUMNS.has(column));
      database.prepare(`insert into executions (${columns.map(identifier).join(", ")}) values (${columns.map(() => "?").join(", ")})`).run(...columns.map((column) => sqlInput(before[column])));
      return;
    }
    if (table === "account_principal_provisionals") {
      insertRawRow(database, table, PRINCIPAL_SPEC, before);
      return;
    }
    const spec = REFERENCE_SPECS[table];
    if (!spec) throw new TradingViewMigrationTransactionError("migration-unsupported-reference", `Reference table ${table} is not whitelisted.`);
    insertRawRow(database, table, spec, before);
    return;
  }
  if (after && !before) {
    if (table === "executions") {
      const result = database.prepare("delete from executions where id = ?").run(rowString(after, "id"));
      if (Number(result.changes) !== 1) throw new TradingViewMigrationTransactionError("migration-rollback-stale", `Expected one execution ${rowString(after, "id")} while deleting rollback state.`);
      return;
    }
    if (table === "account_principal_provisionals") {
      const result = database.prepare("delete from account_principal_provisionals where account_id = ?").run(rowString(after, "account_id"));
      if (Number(result.changes) !== 1) throw new TradingViewMigrationTransactionError("migration-rollback-stale", "Expected one provisional principal while deleting rollback state.");
      return;
    }
    const spec = REFERENCE_SPECS[table];
    if (!spec) throw new TradingViewMigrationTransactionError("migration-unsupported-reference", `Reference table ${table} is not whitelisted.`);
    deleteRawRow(database, table, spec, after);
    return;
  }
  if (!after || !before) return;
  if (table === "executions") {
    const current = readExecutionRaw(database, rowString(after, "id"));
    if (!current) throw new TradingViewMigrationTransactionError("migration-rollback-stale", `Execution ${rowString(after, "id")} disappeared during rollback.`);
    const columns = Object.keys(before).filter((column) => EXECUTION_COLUMNS.has(column));
    const assignments = columns.map((column) => `${identifier(column)} = ?`).join(", ");
    const result = database.prepare(`update executions set ${assignments} where id = ?`).run(...columns.map((column) => sqlInput(before[column])), rowString(after, "id"));
    if (Number(result.changes) !== 1) throw new TradingViewMigrationTransactionError("migration-rollback-stale", `Expected one execution ${rowString(after, "id")} while restoring rollback state.`);
    return;
  }
  if (table === "account_principal_provisionals") {
    const current = readPrincipal(database);
    if (!current) throw new TradingViewMigrationTransactionError("migration-rollback-stale", "The provisional principal disappeared during rollback.");
    const columns = PRINCIPAL_SPEC.columns;
    const assignments = columns.map((column) => `${identifier(column)} = ?`).join(", ");
    const result = database.prepare(`update account_principal_provisionals set ${assignments} where account_id = ?`).run(...columns.map((column) => sqlInput(before[column])), rowString(after, "account_id"));
    if (Number(result.changes) !== 1) throw new TradingViewMigrationTransactionError("migration-rollback-stale", "Expected one provisional principal while restoring rollback state.");
    return;
  }
  const spec = REFERENCE_SPECS[table];
  if (!spec) throw new TradingViewMigrationTransactionError("migration-unsupported-reference", `Reference table ${table} is not whitelisted.`);
  const current = readReferenceRow(database, table, referenceFields(after, spec));
  if (!current) throw new TradingViewMigrationTransactionError("migration-rollback-stale", `Reference ${table} disappeared during rollback.`);
  if (!samePrimaryKey(referenceFields(after, spec), referenceFields(before, spec), spec) && readReferenceRow(database, table, referenceFields(before, spec))) {
    throw new TradingViewMigrationTransactionError("migration-rollback-stale", `Reference ${table} target is occupied during rollback.`);
  }
  replaceReferenceRawRow(database, table, spec, current, before);
}

/**
 * Verify every inverse write from the database after all restores have run.
 * The expected before image is only a guard; the rollback audit must be built
 * from the rows that were actually read back. Any trigger or other write-side
 * effect therefore aborts the enclosing transaction before a success record
 * can be written.
 */
function verifyRollbackRestoration(database: DatabaseSync, rows: readonly LedgerRow[], beforeImages: readonly (DbRow | null)[]): LedgerRow[] {
  return rows.map((row, index) => {
    const restored = row.before
      ? currentRawRow(database, row.tableName, row.before)
      : row.after
        ? currentRawRow(database, row.tableName, row.after)
        : null;
    if (row.before) {
      if (!restored) {
        throw new TradingViewMigrationTransactionError("migration-rollback-stale", `Rollback ${row.tableName}/${row.primaryKey} did not restore its target row.`);
      }
      if (!matchesLedgerImage(row.tableName, restored, row.before, row.beforeDigest)) {
        throw new TradingViewMigrationTransactionError("migration-rollback-stale", `Rollback ${row.tableName}/${row.primaryKey} did not preserve its before image.`);
      }
    } else if (restored) {
      throw new TradingViewMigrationTransactionError("migration-rollback-stale", `Rollback ${row.tableName}/${row.primaryKey} did not delete its target row.`);
    }

    return {
      tableName: row.tableName,
      primaryKey: row.primaryKey,
      before: beforeImages[index],
      after: restored,
      beforeDigest: digest(beforeImages[index]),
      afterDigest: digest(restored),
    };
  });
}

function ledgerRows(database: ReadDatabase, operationId: string): LedgerRow[] {
  const rows = tableRows(database,"tradingview_account_migration_rows").filter(row => row.operation_id === operationId);
  return rows.map((row) => ({
    tableName: rowString(row, "table_name"),
    primaryKey: rowString(row, "primary_key"),
    before: parseJson(row.before_json) as DbRow | null,
    after: parseJson(row.after_json) as DbRow | null,
    beforeDigest: rowString(row, "before_digest"),
    afterDigest: rowString(row, "after_digest"),
  }));
}

function writeResult(database: DatabaseSync, operationId: string, result: Readonly<Record<string, unknown>>, afterSnapshotDigest: string, now: string): void {
  database.prepare("update tradingview_account_migration_operations set after_snapshot_digest = ?, result_json = ?, updated_at = ? where operation_id = ?")
    .run(afterSnapshotDigest, jsonValue(result), now, operationId);
}

type RollbackValidation = {
  original: DbRow;
  rows: LedgerRow[];
  aliases: TradingViewMigrationAlias[];
  blockers: TradingViewMigrationRollbackPreviewBlocker[];
  expectedAfterSnapshotDigest: string;
};

function rollbackValidation(
  database: ReadDatabase,
  operationId: string,
  expectedAfterSnapshotDigest: string | undefined,
): RollbackValidation {
  const original = readOperation(database, operationId);
  if (!original) {
    return {
      original: {},
      rows: [],
      aliases: [],
      blockers: [{ code: "migration-operation-not-found", message: "The migration operation does not exist." }],
      expectedAfterSnapshotDigest: expectedAfterSnapshotDigest ?? "",
    };
  }

  const rows = ledgerRows(database, operationId);
  const aliases = readAliases(database, operationId);
  const expected = typeof original.after_snapshot_digest === "string" ? original.after_snapshot_digest : "";
  const blockers: TradingViewMigrationRollbackPreviewBlocker[] = [];
  if (original.operation_kind !== "commit" || original.status !== "committed") {
    blockers.push({ code: "migration-rollback-conflict", message: "The migration operation is not rollbackable." });
  }
  if (expectedAfterSnapshotDigest !== undefined && expected !== expectedAfterSnapshotDigest) {
    blockers.push({ code: "migration-rollback-stale", message: "The migration after-state digest is stale." });
  }
  const request = parseJson(original.request_json) as JsonRecord | null;
  const result = parseJson(original.result_json) as JsonRecord | null;
  if (!request || request.operationId !== operationId || request.idempotencyKey !== original.idempotency_key
    || request.planDigest !== original.plan_digest || request.baseSnapshotDigest !== original.base_snapshot_digest
    || !result || result.operationId !== operationId || result.status !== "committed"
    || result.affectedRows !== rows.length || result.afterSnapshotDigest !== expected || digestAffectedRows(rows) !== expected) {
    blockers.push({ code: "migration-rollback-stale", message: "The original operation request, result and complete ledger disagree.", table: "tradingview_account_migration_operations", primaryKey: operationId });
  }
  for (const row of rows) {
    if (digest(row.before) !== row.beforeDigest || digest(row.after) !== row.afterDigest
      || row.tableName === "trade_revisions" && (isFactStateAudit(row.before) || isFactStateAudit(row.after))) {
      blockers.push({ code: "migration-rollback-stale", message: "The original ledger image or dedicated fact-state audit is not a valid migration proof.", table: row.tableName, primaryKey: row.primaryKey });
      continue;
    }
    if (row.tableName === "executions" && (!row.before || !row.after
      || row.before.id !== row.primaryKey || row.after.id !== row.primaryKey
      || EXECUTION_IMMUTABLE_COLUMNS.some(column => row.before![column] !== row.after![column]))) {
      blockers.push({ code: "migration-rollback-stale", message: "The original execution ledger does not preserve financial and source fields.", table: row.tableName, primaryKey: row.primaryKey });
      continue;
    }
    const current = row.after || row.before ? currentRawRow(database, row.tableName, (row.after ?? row.before)!) : null;
    if (row.after && (!current || !matchesLedgerImage(row.tableName, current, row.after, row.afterDigest))) {
      blockers.push({
        code: "migration-rollback-stale",
        message: `The affected ${row.tableName}/${row.primaryKey} row changed after migration.`,
        table: row.tableName,
        primaryKey: row.primaryKey,
      });
    }
    if (!row.after && current) {
      blockers.push({
        code: "migration-rollback-stale",
        message: `The deleted ${row.tableName}/${row.primaryKey} row was recreated after migration.`,
        table: row.tableName,
        primaryKey: row.primaryKey,
      });
    }
  }
  blockers.push(...dependencyGuardBlockers(database, operationId, aliases, rows));
  return {
    original,
    rows,
    aliases,
    blockers,
    expectedAfterSnapshotDigest: expected,
  };
}

function throwRollbackBlocker(blocker: TradingViewMigrationRollbackPreviewBlocker): never {
  throw new TradingViewMigrationTransactionError(blocker.code, blocker.message, {
    ...(blocker.table ? { table: blocker.table } : {}),
    ...(blocker.primaryKey ? { primaryKey: blocker.primaryKey } : {}),
  });
}

function evaluate(
  database: ReadDatabase,
  options: TradingViewAccountMigrationTransactionOptions,
): TradingViewMigrationEvaluation & { adapter: TradingViewSnapshotAdapterResult } {
  const adapter = (options.snapshotBuilder ?? buildTradingViewAccountMigrationSnapshot)(readerFor(database));
  const plan = (options.planBuilder ?? buildTradingViewAccountMigrationPlan)(adapter.snapshot);
  // Keep the frozen planner's semantic digest, but bind the full independent
  // row/absence/collection preconditions to the existing snapshot token.
  const completePlan = { ...plan, baseSnapshotDigest: digest({ policy: DEPENDENCY_POLICY, plannerSnapshotDigest: plan.baseSnapshotDigest, dependencies: completeDependencies(database, scopeForPlan(plan)) }) };
  return { snapshot: adapter, plan: completePlan, adapter };
}


export type PreparedTradingViewMaintenance = {
  intent: TradingViewMaintenanceIntent;
  preview: TradingViewMigrationPreview | TradingViewMigrationRollbackPreview;
  dependencies: DependencyRow[];
  scope: DependencyScope;
  source: PreparedSourceAccountCorrection | null;
  originalProof: string | null;
  rollbackRows: LedgerRow[];
  beforeImages: {tableName:string;primaryKey:string;image:DbRow|null}[];
  /** Read-only instrument closure for future import proof; older operations remain unavailable. */
  importProofInstruments?: DbRow[];
};
const EXTRA_TABLES = ["executions","instruments","account_principal_provisionals","source_materials","source_material_versions","source_observations","source_execution_links","source_material_account_mappings","execution_fact_states","tradingview_account_migration_operations","tradingview_account_migration_rows","tradingview_account_migration_aliases","tradingview_account_migration_dependencies","trade_change_plans","trade_change_receipts","trade_change_requests"];

/** Only raw fixed-table copies run inside the engine's read transaction. */
export function copyTradingViewMigrationRows(database: DatabaseSync): TradingViewRawSnapshot {
  const tables = Object.fromEntries([...new Set([...Object.keys(REFERENCE_SPECS),...EXTRA_TABLES])].map(table => [table, tableRows(database,table)]));
  const legacyProofs: TradingViewRawSnapshot["legacyProofs"] = {};
  for (const row of tables.executions) {
    if (typeof row.import_batch_id === "string") legacyProofs[rowString(row,"id")] = cloneRow(legacyObservationProof(database,row.import_batch_id,rowString(row,"id")));
  }
  return {tables,source:copySourceMaterialRows(database),legacyProofs};
}
export function isTradingViewMaintenanceIntent(intent: {kind:string}): intent is TradingViewMaintenanceIntent {
  return intent.kind === "tradingview-account-migration" || intent.kind === "tradingview-account-migration-rollback";
}
export function validateTradingViewMaintenanceIntent(intent: TradingViewMaintenanceIntent): number {
  const keys = intent.kind === "tradingview-account-migration" ? ["kind","operationId"] : ["kind","operationId","rollbackOperationId","expectedAfterSnapshotDigest"];
  if (Object.keys(intent).some(key=>!keys.includes(key)) || typeof intent.operationId !== "string" || !intent.operationId.trim() || intent.operationId.length > 160
    || intent.kind === "tradingview-account-migration-rollback" && (typeof intent.rollbackOperationId !== "string" || !intent.rollbackOperationId.trim() || intent.rollbackOperationId.length > 160
      || intent.expectedAfterSnapshotDigest !== undefined && typeof intent.expectedAfterSnapshotDigest !== "string")) {
    throw new TradingViewMigrationTransactionError("migration-blocked","Invalid fixed maintenance scope");
  }
  return 0;
}
function sourceError(error: unknown, rollback = false): never {
  if (error instanceof SourceMaterialAccountCorrectionError && error.code !== "source-account-correction-transaction-required") {
    throw new TradingViewMigrationTransactionError(error.code === "source-account-correction-blocked" ? "migration-blocked" : rollback ? "migration-rollback-stale" : "migration-stale", error.message,
      {blockers:error.blockers,...(error.table ? {table:error.table,primaryKey:error.primaryKey}: {})});
  }
  throw error;
}
function originalOperationProof(database: ReadDatabase, operationId: string): string {
  return digest({operation:readOperation(database,operationId),rows:ledgerRows(database,operationId),aliases:readAliases(database,operationId),dependencies:readDependencyGuard(database,operationId)});
}
function verifiedForwardSource(database: ReadDatabase, operationId: string, rows: readonly LedgerRow[]): PreparedForwardSourceAccountCorrection | null {
  const mappings = rows.filter(row=>row.tableName === "source_material_account_mappings");
  const modern = readDependencyGuard(database,operationId).some(row=>row.tableName===DEPENDENCY_POLICY_TABLE&&row.rowDigest===digest(DEPENDENCY_POLICY));
  if (!modern && mappings.length === 0) return null;
  const candidates = tableRows(database,"trade_change_plans").filter(row => {
    if (typeof row.body_json !== "string") return false;
    const stored=JSON.parse(row.body_json) as {prepared?:{tradingView?:PreparedTradingViewMaintenance}};
    return stored.prepared?.tradingView?.intent.kind === "tradingview-account-migration" && stored.prepared.tradingView.intent.operationId === operationId;
  });
  if (candidates.length !== 1) throw new TradingViewMigrationTransactionError("migration-rollback-stale","No unique persisted original plan proves the material mapping ledger",{table:"trade_change_plans",primaryKey:operationId});
  const row=candidates[0];
  if (createHash("sha256").update(rowString(row,"body_json")).digest("hex")!==row.body_digest || typeof row.receipt_id!=="string") throw new TradingViewMigrationTransactionError("migration-rollback-stale","Original plan integrity or receipt ownership is not proven");
  const stored=JSON.parse(rowString(row,"body_json")) as {review:{planId:string};prepared:{tradingView:PreparedTradingViewMaintenance}};
  const receipt=tableRows(database,"trade_change_receipts").find(value=>value.id===row.receipt_id&&value.plan_id===row.id);
  const original=readOperation(database,operationId)!;
  const result=receipt && (JSON.parse(rowString(receipt,"receipt_json")) as CommitReceipt).result.tradingView;
  const request=parseJson(original.request_json) as JsonRecord;
  const originalPrepared=stored.prepared.tradingView;
  const source=originalPrepared.source;
  if (stored.review.planId!==row.id || !result || digest(result)!==digest(parseJson(original.result_json))
    || tradeChangeChoicesDigest({conflicts:[],missingExecutions:[],reactivateExecutions:[]},request)!==row.choices_digest
    || result.operationId!==operationId || result.afterSnapshotDigest!==original.after_snapshot_digest
    || !source || source.input.kind!=="tradingview-account-migration" || source.input.operationId!==operationId
    || result.affectedRows!==rows.length || digestAffectedRows(rows)!==original.after_snapshot_digest
    || rows.some(value=>digest(value.before)!==value.beforeDigest||digest(value.after)!==value.afterDigest
      || !originalPrepared.beforeImages.some(before=>before.tableName===value.tableName&&before.primaryKey===value.primaryKey&&digest(before.image)===value.beforeDigest))
    || digest(readAliases(database,operationId))!==digest(migrationAliases(operationId,originalPrepared.preview as TradingViewMigrationPreview))
    || (originalPrepared.preview as TradingViewMigrationPreview).planDigest!==original.plan_digest
    || (originalPrepared.preview as TradingViewMigrationPreview).baseSnapshotDigest!==original.base_snapshot_digest) {
    throw new TradingViewMigrationTransactionError("migration-rollback-stale","Original plan, receipt and operation ledger do not prove the same migration");
  }
  return source as PreparedForwardSourceAccountCorrection;
}

export type TradingViewImportProof =
  | { kind: "verified"; operationId: string; digest: string; affectedExecutionIds: string[] }
  | { kind: "unavailable"; reason: string };
/** A closed read-only proof over the entire operation. No rollback fallback or selected-hit proof. */
export function proveTradingViewImportIdentity(snapshot: TradingViewRawSnapshot, binding: {
  operationId: string; executionId: string; observedAccountId: string; currentAccountId: string;
  instrumentId: string; rawSourceRun: string;
}): TradingViewImportProof {
  const unavailable = (reason: string): TradingViewImportProof => ({ kind: "unavailable", reason });
  try {
    const op=readOperation(snapshot,binding.operationId), rows=ledgerRows(snapshot,binding.operationId);
    if (!op || op.operation_kind!=="commit" || op.status!=="committed" || !rows.length) return unavailable("not-unique-current-forward-operation");
    const planRows=tableRows(snapshot,"trade_change_plans").filter(row=>{
      if (typeof row.body_json!=="string") return false;
      const body=JSON.parse(String(row.body_json)) as {prepared?:{tradingView?:PreparedTradingViewMaintenance}};
      return body.prepared?.tradingView?.intent.kind==="tradingview-account-migration" && body.prepared.tradingView.intent.operationId===binding.operationId;
    });
    if (planRows.length!==1 || !verifiedForwardSource(snapshot,binding.operationId,rows)) return unavailable("original-plan-receipt-ledger-unavailable");
    const plan=planRows[0], stored=JSON.parse(String(plan.body_json)) as {review:{summary:{inputDigest:string}};prepared:{tradingView:PreparedTradingViewMaintenance}};
    const prepared=stored.prepared.tradingView, affected=rows.filter(row=>row.tableName==="executions");
    if (stored.review.summary.inputDigest !== tradeChangeInputDigest(prepared.intent)) return unavailable("original-input-binding-changed");
    const affectedIds=affected.map(row=>row.primaryKey).sort();
    if (new Set(rows.map(row=>`${row.tableName}\0${row.primaryKey}`)).size!==rows.length
      || digest(affectedIds)!==digest((prepared.preview as TradingViewMigrationPreview).executionPlan.map(row=>row.executionId).sort())) return unavailable("incomplete-operation-ledger");
    const request=parseJson(op.request_json) as JsonRecord, result=parseJson(op.result_json) as JsonRecord;
    if (request.operationId!==binding.operationId || request.idempotencyKey!==op.idempotency_key || request.planDigest!==op.plan_digest || request.baseSnapshotDigest!==op.base_snapshot_digest
      || result.status!=="committed" || result.operationId!==binding.operationId || result.affectedRows!==rows.length || result.afterSnapshotDigest!==op.after_snapshot_digest) return unavailable("operation-request-result-mismatch");
    const hit=affected.find(row=>row.primaryKey===binding.executionId);
    if (!hit?.before || !hit.after || ![hit.before.account,hit.after.account].includes(binding.observedAccountId) || hit.after.account!==binding.currentAccountId
      || hit.after.instrument_id!==binding.instrumentId || hit.before.simulation_run_id!==binding.rawSourceRun || hit.after.simulation_run_id!==binding.rawSourceRun) return unavailable("binding-outside-audited-namespace");
    for (const row of rows) {
      if (digest(row.before)!==row.beforeDigest || digest(row.after)!==row.afterDigest || !prepared.beforeImages.some(before=>before.tableName===row.tableName&&before.primaryKey===row.primaryKey&&digest(before.image)===row.beforeDigest)) return unavailable("ledger-integrity");
      const current=currentRawRow(snapshot,row.tableName,(row.after??row.before)!);
      if (digest(current)!==row.afterDigest) return unavailable("operation-afterimage-changed");
      if (row.tableName==="executions" && row.before && row.after && EXECUTION_IMMUTABLE_COLUMNS.some(column=>digest(row.before![column])!==digest(row.after![column]))) return unavailable("financial-afterimage-changed");
    }
    const instruments=prepared.importProofInstruments;
    const instrumentIds=[...new Set(affected.map(row=>row.after?.instrument_id))].sort();
    const currentInstruments=tableRows(snapshot,"instruments").filter(row=>instrumentIds.includes(row.id));
    if (!instruments || digest(instruments.map(row=>row.id).sort())!==digest(instrumentIds) || digest(instruments)!==digest(currentInstruments)) return unavailable("instrument-closure-unavailable");
    const dependencies=readDependencyGuard(snapshot,binding.operationId);
    if (!dependencies.some(row=>row.tableName===DEPENDENCY_POLICY_TABLE&&row.rowDigest===digest(DEPENDENCY_POLICY))
      || compareDependencies(dependencies,completeDependencies(snapshot,prepared.scope)).length) return unavailable("dependency-or-source-mapping-closure-changed");
    for (const other of tableRows(snapshot,"tradingview_account_migration_operations")) {
      if (other.operation_id===binding.operationId || other.status!=="committed") continue;
      const otherRows=ledgerRows(snapshot,String(other.operation_id));
      if (otherRows.some(row=>row.tableName==="executions"&&affectedIds.includes(row.primaryKey))) return unavailable("competing-forward-or-rollback-operation");
    }
    const receiptRows=tableRows(snapshot,"trade_change_receipts").filter(row=>row.id===plan.receipt_id&&row.plan_id===plan.id);
    const aliases=tableRows(snapshot,"trade_change_requests").filter(row=>row.receipt_id===plan.receipt_id);
    const normalized=normalizeTradingViewMaintenanceRequest(request);
    const expectedRequest=tradeChangeInputDigest({planId:plan.id,choices:{conflicts:[],missingExecutions:[],reactivateExecutions:[]},maintenanceRequest:normalized});
    if (receiptRows.length!==1 || !aliases.length || aliases.some(row=>row.request_digest!==expectedRequest)) return unavailable("receipt-request-alias-closure-invalid");
    return {kind:"verified",operationId:binding.operationId,affectedExecutionIds:affectedIds,
      digest:digest({op,rows,instruments,currentInstruments,source:sourceGraph(snapshot,affectedIds),dependencies,plan,receipts:receiptRows,requests:aliases,aliases:readAliases(snapshot,binding.operationId)})};
  } catch { return unavailable("unparseable-or-incomplete-operation-proof"); }
}
export function prepareTradingViewMaintenance(snapshot: TradingViewRawSnapshot, intent: TradingViewMaintenanceIntent, options: TradingViewAccountMigrationTransactionOptions = {}) {
  const now=options.now?.()??new Date().toISOString();
  let prepared:PreparedTradingViewMaintenance;
  if (intent.kind==="tradingview-account-migration") {
    const evaluated=evaluate(snapshot,options), plan=evaluated.plan, scope=scopeForPlan(plan);
    const preview:TradingViewMigrationPreview={operationId:intent.operationId,snapshotDigest:evaluated.adapter.snapshotDigest,adapterBlockers:evaluated.adapter.blockers,...plan,
      status:evaluated.adapter.blockers.length||plan.blockers.length?"blocked":plan.status};
    let source:PreparedSourceAccountCorrection|null=null;
    if (preview.status==="ready") {
      try {source=_prepareSourceMaterialAccountCorrection(snapshot.source,{kind:intent.kind,operationId:intent.operationId,recordedAt:now,
        executions:plan.executionPlan.map(row=>({executionId:row.executionId,beforeAccountId:row.beforeAccountId,afterAccountId:TRADINGVIEW_CANONICAL_ACCOUNT_ID}))});}
      catch(error){if (!(error instanceof SourceMaterialAccountCorrectionError)) throw error;
        preview.status="blocked";preview.adapterBlockers=[...preview.adapterBlockers,{code:"invalid-execution-row",message:error.message,...(error.table?{table:error.table,primaryKey:error.primaryKey}:{})}];}
    }
    const beforeImages=[...plan.executionPlan.map(row=>({tableName:"executions",primaryKey:row.executionId,image:readExecutionRaw(snapshot,row.executionId)})),
      ...plan.referencePlan.map(row=>({tableName:row.table,primaryKey:row.primaryKey,image:readReferenceRow(snapshot,row.table,row.before)})),
      {tableName:"account_principal_provisionals",primaryKey:TRADINGVIEW_CANONICAL_ACCOUNT_ID,image:readPrincipal(snapshot)},
      ...(source?.changes??[]).map(row=>({tableName:row.tableName,primaryKey:row.primaryKey,image:row.before}))];
    const affectedInstruments=new Set(plan.executionPlan.map(row=>readExecutionRaw(snapshot,row.executionId)?.instrument_id));
    prepared={intent,preview,source,scope,dependencies:completeDependencies(snapshot,scope),originalProof:null,rollbackRows:[],beforeImages,
      importProofInstruments:tableRows(snapshot,"instruments").filter(row=>affectedInstruments.has(row.id))};
  } else {
    const validation=rollbackValidation(snapshot,intent.operationId,intent.expectedAfterSnapshotDigest);
    const scope=scopeForOperation(validation.aliases,validation.rows);
    let source:PreparedSourceAccountCorrection|null=null;
    if (!validation.blockers.length) {
      try {
        const forward=verifiedForwardSource(snapshot,intent.operationId,validation.rows);
        if (forward) source=_prepareSourceMaterialAccountCorrection(snapshot.source,{kind:intent.kind,operationId:intent.rollbackOperationId,recordedAt:now,
          original:{prepared:forward,appliedMappings:validation.rows.filter(row=>row.tableName==="source_material_account_mappings").sort((a,b)=>a.primaryKey.localeCompare(b.primaryKey)) as MaterialAccountMappingChange[]}});
      } catch(error){if (error instanceof SourceMaterialAccountCorrectionError) validation.blockers.push(...error.blockers.map(blocker=>({code:"migration-rollback-stale" as const,...blocker})));
        else if(error instanceof TradingViewMigrationTransactionError) validation.blockers.push({code:error.code,message:error.message,...error.details});else throw error;
        if (!validation.blockers.length) validation.blockers.push({code:"migration-rollback-stale",message:"Original source mapping proof is invalid"});}
    }
    prepared={intent,scope,source,dependencies:completeDependencies(snapshot,scope),originalProof:originalOperationProof(snapshot,intent.operationId),rollbackRows:validation.rows,beforeImages:[],
      preview:{operationId:intent.operationId,status:validation.blockers.length?"blocked":"ready",expectedAfterSnapshotDigest:validation.expectedAfterSnapshotDigest,affectedRows:validation.rows.length,aliases:validation.aliases,blockers:validation.blockers}};
  }
  return {body:prepared,review:{changes:[],conflicts:[],missingExecutions:[],reactivateExecutionIds:[],diagnostics:[],tradingView:prepared.preview}};
}
function dependencyKey(table:string,row:DbRow):string {
  const keys=table==="executions"?["id"]:table==="account_principal_provisionals"?["account_id"]:table==="source_material_account_mappings"?MATERIAL_MAPPING_SPEC.primaryKeys:REFERENCE_SPECS[table]?.primaryKeys;
  if (!keys) throw new Error("Unsupported maintenance dependency table");
  return jsonValue(keys.map(key=>row[key]));
}
function expectedDependencies(before:readonly DependencyRow[],rows:readonly LedgerRow[],scope:DependencyScope):DependencyRow[] {
  const result=new Map(before.filter(row=>row.rowKey!=="@membership").map(row=>[`${row.tableName}\0${row.rowKey}`,row]));
  for (const row of rows) {
    if(row.tableName==="executions") continue;
    if(row.before) result.delete(`${row.tableName}\0${dependencyKey(row.tableName,row.before)}`);
    if(row.after && (row.tableName==="account_principal_provisionals"||row.tableName==="source_material_account_mappings"||valueContainsIdentity(row.after,scope.identities))) {
      const next={tableName:row.tableName,rowKey:dependencyKey(row.tableName,row.after),rowDigest:row.afterDigest}; result.set(`${next.tableName}\0${next.rowKey}`,next);
    }
  }
  const values=[...result.values()];
  // An absent principal is a row dependency, not just an empty collection.
  if (!values.some(row=>row.tableName==="account_principal_provisionals")) values.push({tableName:"account_principal_provisionals",rowKey:jsonValue([TRADINGVIEW_CANONICAL_ACCOUNT_ID]),rowDigest:digest(null)});
  for(const table of before.filter(row=>row.rowKey==="@membership").map(row=>row.tableName)) values.push({tableName:table,rowKey:"@membership",rowDigest:digest(values.filter(row=>row.tableName===table).map(row=>row.rowKey).sort())});
  return values;
}
type FinalProof={prepared:PreparedTradingViewMaintenance;rows:LedgerRow[];dependencies:DependencyRow[];operation:DbRow;original:DbRow|null;aliases:TradingViewMigrationAlias[];guard:boolean};

/** Fixed internal application authority; never starts or commits a transaction. */
export class TradingViewMigrationApplication {
  private finalProof:FinalProof|null=null;
  private replayProof:string|null=null;
  constructor(private readonly database:DatabaseSync) {}
  assertReplay(receipt:CommitReceipt):void {
    const result=receipt.result.tradingView;
    if(!result) return;
    const rollback=result.status==="rolled-back";
    const operationId=rollback?result.rollbackOperationId:result.operationId;
    const operation=readOperation(this.database,operationId);
    if(!operation || operation.operation_kind!==(rollback?"rollback":"commit")
      || operation.status!==(rollback?"rolled-back":"committed")
      || digest({...parseResult<JsonRecord>(operation),idempotent:false})!==digest({...result,idempotent:false})) {
      throw new TradingViewMigrationTransactionError(rollback?"migration-rollback-conflict":"migration-idempotency-conflict","The original operation no longer owns this receipt result",{table:"tradingview_account_migration_operations",primaryKey:operationId});
    }
  }
  beforeReplay():void {
    this.finalProof=null;
    this.replayProof=this.replayDomainDigest();
  }
  private replayDomainDigest():string {
    const snapshot=copyTradingViewMigrationRows(this.database);
    // The engine proves this table's exact delta: only the requested alias may
    // be added. The maintenance proof still owns every other domain row.
    delete snapshot.tables.trade_change_requests;
    return digest(snapshot);
  }
  apply(prepared:PreparedTradingViewMaintenance,request:TradingViewMaintenanceRequest|undefined,now:string):CommitReceipt["result"] {
    if(!this.database.isTransaction) throw new Error("Maintenance application requires the engine transaction");
    this.replayProof=null;
    this.finalProof=null;
    if(!request) throw new TradingViewMigrationTransactionError("migration-blocked","A complete maintenance request is required");
    try { return this.applyInTransaction(prepared,request,now); } catch(error){sourceError(error,prepared.intent.kind==="tradingview-account-migration-rollback");}
  }
  private applyInTransaction(prepared:PreparedTradingViewMaintenance,request:TradingViewMaintenanceRequest,now:string):CommitReceipt["result"] {
    const rollback=prepared.intent.kind==="tradingview-account-migration-rollback";
    const operationId=prepared.intent.kind==="tradingview-account-migration-rollback"?prepared.intent.rollbackOperationId:prepared.intent.operationId;
    if(request.operationId!==prepared.intent.operationId || rollback!==Object.hasOwn(request,"rollbackOperationId")
      || rollback && (request as TradingViewMigrationRollbackRequest).rollbackOperationId!==operationId) throw new TradingViewMigrationTransactionError("migration-idempotency-conflict","The request does not belong to this operation plan");
    const summary=rollback?normalizedRollbackRequest(request as TradingViewMigrationRollbackRequest):normalizedCommitRequest(request as TradingViewMigrationCommitRequest);
    const existing=readOperation(this.database,operationId);
    if(existing) {
      if(existing.operation_kind!==(rollback?"rollback":"commit")||digest(parseJson(existing.request_json))!==digest(summary)
        ||!rollback&&existing.status!=="committed"||rollback&&existing.parent_operation_id!==request.operationId) throw new TradingViewMigrationTransactionError(rollback?"migration-rollback-conflict":"migration-idempotency-conflict","The operation was used with different parameters");
      return {report:{inserted:0,duplicate:0,conflict:0},appliedChanges:[],tradingView:{...parseResult<TradingViewMigrationCommitResult|TradingViewMigrationRollbackResult>(existing),idempotent:true}};
    }
    const differences=compareDependencies(prepared.dependencies,completeDependencies(this.database,prepared.scope));
    if(differences.length) throw new TradingViewMigrationTransactionError(rollback?"migration-rollback-stale":"migration-stale","Independent dependencies changed after preview",{blockers:differences,table:differences[0].table,primaryKey:differences[0].primaryKey});
    // This check precedes even the operation audit's first write.
    if(prepared.source) _assertPreparedSourceMaterialAccountCorrectionInTransaction(this.database,prepared.source,"before");
    let rows:LedgerRow[],result:TradingViewMigrationCommitResult|TradingViewMigrationRollbackResult,original:DbRow|null=null,aliases:TradingViewMigrationAlias[]=[];
    if(!rollback) {
      const req=request as TradingViewMigrationCommitRequest,plan=prepared.preview as TradingViewMigrationPreview;
      if(plan.status!=="ready"||plan.blockers.length||plan.adapterBlockers.length||!prepared.source) throw new TradingViewMigrationTransactionError("migration-blocked","The migration cannot commit while blockers remain",{blockers:plan.blockers,adapterBlockers:plan.adapterBlockers});
      if(req.planDigest!==plan.planDigest||req.baseSnapshotDigest!==plan.baseSnapshotDigest||req.episodeMapDigest&&req.episodeMapDigest!==digest(plan.episodeMap)
        ||req.provisionalPrincipalAction&&req.provisionalPrincipalAction!==plan.provisionalPrincipal.action) throw new TradingViewMigrationTransactionError("migration-stale","The complete migration request does not match the persisted plan");
      validateExpectedRows(plan,req.expectedAffectedRows);
      if(tableRows(this.database,"tradingview_account_migration_operations").some(row=>row.idempotency_key===req.idempotencyKey)) throw new TradingViewMigrationTransactionError("migration-idempotency-conflict","Idempotency key belongs to another operation");
      writeOperation(this.database,operationId,"commit",null,req.idempotencyKey,req.planDigest,req.baseSnapshotDigest,now,summary);
      const applied=executePlan(this.database,operationId,plan,now,prepared.source);rows=applied.rows;
      result={operationId,status:"committed",idempotent:false,afterSnapshotDigest:digestAffectedRows(rows),affectedRows:rows.length,executionCount:plan.executionPlan.length,quantity:plan.counts.quantity,fee:plan.counts.fee,episodeMap:plan.episodeMap,...(applied.principalRevision===undefined?{}:{provisionalPrincipalRevision:applied.principalRevision})};
      aliases=migrationAliases(operationId,plan);writeLedger(this.database,operationId,rows);writeAliases(this.database,aliases);
      writeDependencyGuard(this.database,operationId,prepared.scope);
    } else {
      const req=request as TradingViewMigrationRollbackRequest,preview=prepared.preview as TradingViewMigrationRollbackPreview;
      if(preview.status!=="ready") throwRollbackBlocker(preview.blockers[0]);
      if(req.expectedAfterSnapshotDigest!==preview.expectedAfterSnapshotDigest||originalOperationProof(this.database,req.operationId)!==prepared.originalProof) throw new TradingViewMigrationTransactionError("migration-rollback-stale","The original operation or rollback request changed after preparation");
      const validation=rollbackValidation(this.database,req.operationId,req.expectedAfterSnapshotDigest);
      if(validation.blockers.length) throwRollbackBlocker(validation.blockers[0]);
      original={...validation.original,status:"rolled-back",updated_at:now};
      writeOperation(this.database,operationId,"rollback",req.operationId,`rollback:${operationId}`,rowString(validation.original,"plan_digest"),req.expectedAfterSnapshotDigest,now,summary);
      this.database.exec("pragma defer_foreign_keys=on");
      const beforeImages=validation.rows.map(row=>currentRawRow(this.database,row.tableName,(row.after??row.before)!));
      for(const row of [...validation.rows].reverse()) if(row.tableName!=="source_material_account_mappings") restoreRawRow(this.database,row.tableName,row.before,row.after);
      if(prepared.source) _applyPreparedSourceMaterialAccountCorrectionInTransaction(this.database,prepared.source);
      rows=verifyRollbackRestoration(this.database,validation.rows,beforeImages);
      result={operationId:req.operationId,rollbackOperationId:operationId,status:"rolled-back",idempotent:false,afterSnapshotDigest:digestAffectedRows(rows),affectedRows:rows.length};
      writeLedger(this.database,operationId,rows);
      this.database.prepare("update tradingview_account_migration_operations set status='rolled-back',updated_at=? where operation_id=?").run(now,req.operationId);
    }
    writeResult(this.database,operationId,result,result.afterSnapshotDigest,now);
    const operation:DbRow={operation_id:operationId,operation_kind:rollback?"rollback":"commit",parent_operation_id:rollback?request.operationId:null,idempotency_key:rollback?`rollback:${operationId}`:(request as TradingViewMigrationCommitRequest).idempotencyKey,plan_digest:rollback?rowString(original!,"plan_digest"):(request as TradingViewMigrationCommitRequest).planDigest,base_snapshot_digest:rollback?(request as TradingViewMigrationRollbackRequest).expectedAfterSnapshotDigest:(request as TradingViewMigrationCommitRequest).baseSnapshotDigest,status:rollback?"rolled-back":"committed",request_json:jsonValue(summary),result_json:jsonValue(result),created_at:now,updated_at:now,after_snapshot_digest:result.afterSnapshotDigest};
    this.finalProof={prepared,rows,dependencies:expectedDependencies(prepared.dependencies,rows,prepared.scope),operation,original,aliases,guard:!rollback};
    this.assertAfter(prepared);
    return {report:{inserted:0,duplicate:0,conflict:0},appliedChanges:[],tradingView:result};
  }
  assertAfter(prepared:PreparedTradingViewMaintenance):void {
    if(this.replayProof!==null) {
      if(this.replayProof!==this.replayDomainDigest()) throw new TradingViewMigrationTransactionError("migration-stale","A request alias changed the current maintenance domain");
      return;
    }
    const proof=this.finalProof;
    if(!proof) return; // An exact historical operation retry performs no business write.
    const rollback=prepared.intent.kind==="tradingview-account-migration-rollback";
    try {
      if(prepared.source) _assertPreparedSourceMaterialAccountCorrectionInTransaction(this.database,prepared.source,"after");
      const blockers=compareDependencies(proof.dependencies,completeDependencies(this.database,prepared.scope));
      for(const row of proof.rows) {
        const actual=currentRawRow(this.database,row.tableName,(row.after??row.before)!);
        if(digest(actual)!==row.afterDigest) blockers.push({code:"migration-rollback-stale",message:"Final affected-row image changed",table:row.tableName,primaryKey:row.primaryKey});
      }
      const operationId=rowString(proof.operation,"operation_id");
      if(digest(readOperation(this.database,operationId))!==digest(proof.operation)||digest(ledgerRows(this.database,operationId))!==digest(proof.rows)
        ||digest(readAliases(this.database,operationId))!==digest(proof.aliases)||proof.original&&digest(readOperation(this.database,rowString(proof.original,"operation_id")))!==digest(proof.original)
        ||proof.guard&&compareDependencies(proof.dependencies,readDependencyGuard(this.database,operationId)).length) blockers.push({code:"migration-rollback-stale",message:"Operation, ledger, alias or independent audit changed",table:"tradingview_account_migration_operations",primaryKey:operationId});
      if(blockers.length) throw new TradingViewMigrationTransactionError(rollback?"migration-rollback-stale":"migration-stale","Final maintenance closure changed",{blockers,table:blockers[0].table,primaryKey:blockers[0].primaryKey});
    } catch(error){sourceError(error,rollback);}
  }
}

export function committedTradingViewAliases(database:DatabaseSync,operationId?:string):TradingViewMigrationAlias[] {
  return tableRows(database,"tradingview_account_migration_operations").filter(row=>row.operation_kind==="commit"&&row.status==="committed"&&(!operationId||row.operation_id===operationId))
    .flatMap(row=>readAliases(database,rowString(row,"operation_id"))).sort((a,b)=>`${a.operationId}\0${a.kind}\0${a.oldId}`.localeCompare(`${b.operationId}\0${b.kind}\0${b.oldId}`));
}
