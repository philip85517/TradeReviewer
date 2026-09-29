import "server-only";

import Decimal from "decimal.js";
import { DatabaseSync } from "node:sqlite";

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
  type TradingViewAccountMigrationTransactionOptions,
  type TradingViewMigrationAlias,
  type TradingViewMigrationCommitRequest,
  type TradingViewMigrationCommitResult,
  type TradingViewMigrationEvaluation,
  type TradingViewMigrationExpectedAffectedRow,
  type TradingViewMigrationPreview,
  type TradingViewMigrationPreviewRequest,
  type TradingViewMigrationRollbackPreview,
  type TradingViewMigrationRollbackPreviewBlocker,
  type TradingViewMigrationRollbackPreviewRequest,
  type TradingViewMigrationRollbackRequest,
  type TradingViewMigrationRollbackResult,
} from "./tradingview-account-migration-contracts";
import {
  TRADINGVIEW_CANONICAL_ACCOUNT_ID,
} from "../trades/tradingview-account-identity";
import type { TradeExecution } from "../trades/types";

type DbRow = Record<string, unknown>;
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
    ["id", "instrument_id", "account_id", "request_json", "revision_json", "recorded_at"],
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

function normalizedAffectedRows(rows: readonly TradingViewMigrationExpectedAffectedRow[] | undefined): TradingViewMigrationExpectedAffectedRow[] {
  return [...(rows ?? [])]
    .map((row) => ({ table: row.table, key: row.key, beforeDigest: row.beforeDigest }))
    .sort((left, right) => `${left.table}\u0000${left.key}\u0000${left.beforeDigest}`.localeCompare(`${right.table}\u0000${right.key}\u0000${right.beforeDigest}`));
}

function normalizedCommitRequest(request: TradingViewMigrationCommitRequest): Readonly<Record<string, unknown>> {
  return {
    operationId: request.operationId,
    idempotencyKey: request.idempotencyKey,
    planDigest: request.planDigest,
    baseSnapshotDigest: request.baseSnapshotDigest,
    episodeMapDigest: request.episodeMapDigest ?? null,
    expectedAffectedRows: normalizedAffectedRows(request.expectedAffectedRows),
    provisionalPrincipalAction: request.provisionalPrincipalAction ?? null,
  };
}

function normalizedRollbackRequest(request: TradingViewMigrationRollbackRequest): Readonly<Record<string, unknown>> {
  return {
    operationId: request.operationId,
    rollbackOperationId: request.rollbackOperationId,
    expectedAfterSnapshotDigest: request.expectedAfterSnapshotDigest,
  };
}

function requestDigest(value: unknown): string {
  return digest(value);
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

function readRow(database: DatabaseSync, table: string, spec: ReferenceSpec, fields: Readonly<Record<string, unknown>>): DbRow | null {
  const where = spec.primaryKeys.map((key) => `${identifier(key)} = ?`).join(" and ");
  const row = database.prepare(`select * from ${identifier(table)} where ${where}`).get(...primaryValues(fields, spec).map(sqlInput)) as DbRow | undefined;
  return cloneRow(row);
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

function readReferenceRow(database: DatabaseSync, table: string, fields: Readonly<Record<string, unknown>>): DbRow | null {
  const spec = REFERENCE_SPECS[table];
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

function scanReferenceDependencies(database: DatabaseSync, identities: readonly string[]): DependencyRow[] {
  if (identities.length === 0) return [];
  const dependencies: DependencyRow[] = [];
  for (const [table, spec] of Object.entries(REFERENCE_SPECS)) {
    const rows = database.prepare(`select * from ${identifier(table)}`).all() as DbRow[];
    for (const row of rows) {
      if (!Object.entries(row).some(([key, value]) => containsIdentity(key, identities) || valueContainsIdentity(value, identities))) continue;
      dependencies.push({
        tableName: table,
        rowKey: referenceRowKey(table, spec, row),
        rowDigest: digest(row),
      });
    }
  }
  return dependencies.sort((left, right) => `${left.tableName}\u0000${left.rowKey}`.localeCompare(`${right.tableName}\u0000${right.rowKey}`));
}

function writeDependencyGuard(database: DatabaseSync, operationId: string, aliases: readonly TradingViewMigrationAlias[]): DependencyRow[] {
  const identities = [...new Set(aliases.map((alias) => alias.newId))];
  const dependencies = scanReferenceDependencies(database, identities);
  const statement = database.prepare("insert into tradingview_account_migration_dependencies (operation_id, table_name, row_key, row_digest) values (?, ?, ?, ?)");
  for (const dependency of dependencies) statement.run(operationId, dependency.tableName, dependency.rowKey, dependency.rowDigest);
  return dependencies;
}

function readDependencyGuard(database: DatabaseSync, operationId: string): DependencyRow[] {
  const rows = database.prepare("select table_name, row_key, row_digest from tradingview_account_migration_dependencies where operation_id = ? order by table_name, row_key").all(operationId) as DbRow[];
  return rows.map((row) => ({
    tableName: rowString(row, "table_name"),
    rowKey: rowString(row, "row_key"),
    rowDigest: rowString(row, "row_digest"),
  }));
}

function readAliases(database: DatabaseSync, operationId: string): TradingViewMigrationAlias[] {
  const rows = database.prepare("select operation_id, alias_kind, old_id, new_id from tradingview_account_migration_aliases where operation_id = ? order by alias_kind, old_id").all(operationId) as DbRow[];
  return rows.map((row) => ({
    operationId: rowString(row, "operation_id"),
    kind: rowString(row, "alias_kind") as TradingViewMigrationAlias["kind"],
    oldId: rowString(row, "old_id"),
    newId: rowString(row, "new_id"),
  }));
}

function dependencyGuardBlockers(database: DatabaseSync, operationId: string, aliases: readonly TradingViewMigrationAlias[]): TradingViewMigrationRollbackPreviewBlocker[] {
  const expected = readDependencyGuard(database, operationId);
  const expectedByKey = new Map(expected.map((row) => [`${row.tableName}\u0000${row.rowKey}`, row.rowDigest]));
  const current = scanReferenceDependencies(database, [...new Set(aliases.map((alias) => alias.newId))]);
  return current.flatMap((row) => {
    const key = `${row.tableName}\u0000${row.rowKey}`;
    const expectedDigest = expectedByKey.get(key);
    if (expectedDigest === row.rowDigest) return [];
    return [{
      code: "migration-rollback-stale" as const,
      message: expectedDigest === undefined
        ? `A new ${row.tableName} reference points at an identity created by the migration.`
        : `A ${row.tableName} reference changed after the migration.`,
      table: row.tableName,
      primaryKey: row.rowKey,
    }];
  });
}

function updateReferenceRow(database: DatabaseSync, row: TradingViewReferenceMigrationPlanRow): LedgerRow | null {
  if (row.beforeDigest === row.afterDigest || row.status === "preserved") return null;
  const spec = REFERENCE_SPECS[row.table];
  if (!spec) throw new TradingViewMigrationTransactionError("migration-unsupported-reference", `Reference table ${row.table} is not whitelisted.`);
  const current = readReferenceRow(database, row.table, row.before);
  if (!current) throw new TradingViewMigrationTransactionError("migration-stale", `Reference ${row.table}/${row.primaryKey} no longer exists.`);
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

function readExecutionRaw(database: DatabaseSync, executionId: string): DbRow | null {
  return cloneRow(database.prepare("select * from executions where id = ?").get(executionId) as DbRow | undefined);
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

function readPrincipal(database: DatabaseSync): DbRow | null {
  return cloneRow(database.prepare("select * from account_principal_provisionals where account_id = ?").get(TRADINGVIEW_CANONICAL_ACCOUNT_ID) as DbRow | undefined);
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

function readOperation(database: DatabaseSync, operationId: string): DbRow | null {
  return cloneRow(database.prepare("select * from tradingview_account_migration_operations where operation_id = ?").get(operationId) as DbRow | undefined);
}

function parseResult<T>(row: DbRow): T {
  const value = parseJson(row.result_json);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid migration operation result");
  return value as T;
}

function begin(database: DatabaseSync, mode: "read" | "write"): void {
  database.exec(mode === "write" ? "begin immediate" : "begin");
}

function rollback(database: DatabaseSync): void {
  try { database.exec("rollback"); } catch { /* preserve the original failure */ }
}

function runTransaction<T>(database: DatabaseSync, mode: "read" | "write", work: () => T): T {
  begin(database, mode);
  try {
    const result = work();
    database.exec("commit");
    return result;
  } catch (error) {
    rollback(database);
    throw error;
  }
}

function readerFor(database: DatabaseSync): ReadonlySqliteRows {
  return {
    all<T extends ReadonlySqliteRow>(sql: string, params: readonly unknown[] = []): readonly T[] {
      return database.prepare(sql).all(...params.map(sqlInput)) as unknown as readonly T[];
    },
  };
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

function executePlan(database: DatabaseSync, operationId: string, plan: TradingViewAccountMigrationPlan, now: string): { rows: LedgerRow[]; principalRevision?: number } {
  database.exec("pragma defer_foreign_keys = on");
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
  verifyExecutionConservation(database, plan, rows);
  verifyReferenceConservation(database, plan);
  return { rows, principalRevision: principal.revision };
}

function currentRawRow(database: DatabaseSync, table: string, raw: DbRow): DbRow | null {
  if (table === "executions") return readExecutionRaw(database, rowString(raw, "id"));
  if (table === "account_principal_provisionals") return readPrincipal(database);
  const spec = REFERENCE_SPECS[table];
  if (!spec) throw new TradingViewMigrationTransactionError("migration-unsupported-reference", `Reference table ${table} is not whitelisted.`);
  return readReferenceRow(database, table, referenceFields(raw, spec));
}

function restoreRawRow(database: DatabaseSync, table: string, before: DbRow | null, after: DbRow | null): void {
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
function verifyRollbackRestoration(database: DatabaseSync, rows: readonly LedgerRow[]): LedgerRow[] {
  return rows.map((row) => {
    const restored = row.before
      ? currentRawRow(database, row.tableName, row.before)
      : row.after
        ? currentRawRow(database, row.tableName, row.after)
        : null;
    if (row.before) {
      if (!restored) {
        throw new TradingViewMigrationTransactionError("migration-rollback-stale", `Rollback ${row.tableName}/${row.primaryKey} did not restore its target row.`);
      }
      if (digest(restored) !== row.beforeDigest) {
        throw new TradingViewMigrationTransactionError("migration-rollback-stale", `Rollback ${row.tableName}/${row.primaryKey} did not preserve its before image.`);
      }
    } else if (restored) {
      throw new TradingViewMigrationTransactionError("migration-rollback-stale", `Rollback ${row.tableName}/${row.primaryKey} did not delete its target row.`);
    }

    return {
      tableName: row.tableName,
      primaryKey: row.primaryKey,
      before: row.after,
      after: restored,
      beforeDigest: digest(row.after),
      afterDigest: digest(restored),
    };
  });
}

function ledgerRows(database: DatabaseSync, operationId: string): LedgerRow[] {
  const rows = database.prepare("select table_name, primary_key, before_json, after_json, before_digest, after_digest from tradingview_account_migration_rows where operation_id = ? order by rowid").all(operationId) as DbRow[];
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
  database: DatabaseSync,
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
  for (const row of rows) {
    const current = row.after ? currentRawRow(database, row.tableName, row.after) : null;
    if (row.after && (!current || digest(current) !== row.afterDigest)) {
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
  blockers.push(...dependencyGuardBlockers(database, operationId, aliases));
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
  database: DatabaseSync,
  options: TradingViewAccountMigrationTransactionOptions,
): TradingViewMigrationEvaluation & { adapter: TradingViewSnapshotAdapterResult } {
  const adapter = (options.snapshotBuilder ?? buildTradingViewAccountMigrationSnapshot)(readerFor(database));
  const plan = (options.planBuilder ?? buildTradingViewAccountMigrationPlan)(adapter.snapshot);
  return { snapshot: adapter, plan, adapter };
}

export class TradingViewAccountMigrationStore {
  private readonly options: TradingViewAccountMigrationTransactionOptions;

  constructor(
    private readonly database: DatabaseSync,
    options: TradingViewAccountMigrationTransactionOptions = {},
  ) {
    this.options = options;
  }

  preview(request: TradingViewMigrationPreviewRequest = {}): TradingViewMigrationPreview {
    return runTransaction(this.database, "read", () => {
      const evaluated = evaluate(this.database, this.options);
      return {
        operationId: request.operationId ?? crypto.randomUUID(),
        snapshotDigest: evaluated.adapter.snapshotDigest,
        adapterBlockers: evaluated.adapter.blockers,
        ...evaluated.plan,
        status: evaluated.adapter.blockers.length > 0 || evaluated.plan.blockers.length > 0 ? "blocked" : evaluated.plan.status,
        blockers: evaluated.plan.blockers,
      };
    });
  }

  commit(request: TradingViewMigrationCommitRequest): TradingViewMigrationCommitResult {
    const requestSummary = normalizedCommitRequest(request);
    return runTransaction(this.database, "write", () => {
      const existing = readOperation(this.database, request.operationId);
      if (existing) {
        const sameRequest = existing.operation_kind === "commit"
          && requestDigest(parseJson(existing.request_json)) === requestDigest(requestSummary);
        if (sameRequest && existing.status === "committed") {
          const result = parseResult<TradingViewMigrationCommitResult>(existing);
          return { ...result, idempotent: true };
        }
        throw new TradingViewMigrationTransactionError("migration-idempotency-conflict", "The migration operation was already used with different parameters.");
      }
      const reusedKey = this.database.prepare("select operation_id from tradingview_account_migration_operations where idempotency_key = ?").get(request.idempotencyKey) as DbRow | undefined;
      if (reusedKey) throw new TradingViewMigrationTransactionError("migration-idempotency-conflict", "The idempotency key belongs to another migration operation.");

      const evaluated = evaluate(this.database, this.options);
      const plan = evaluated.plan;
      if (evaluated.adapter.blockers.length > 0 || plan.blockers.length > 0 || plan.status !== "ready") {
        throw new TradingViewMigrationTransactionError("migration-blocked", "The migration cannot commit while adapter or planner blockers remain.", {
          adapterBlockers: evaluated.adapter.blockers,
          blockers: plan.blockers,
        });
      }
      if (plan.baseSnapshotDigest !== request.baseSnapshotDigest || plan.planDigest !== request.planDigest) {
        throw new TradingViewMigrationTransactionError("migration-stale", "The migration plan changed after preview.");
      }
      if (request.episodeMapDigest && digest(plan.episodeMap) !== request.episodeMapDigest) {
        throw new TradingViewMigrationTransactionError("migration-stale", "The episode mapping changed after preview.");
      }
      validateExpectedRows(plan, request.expectedAffectedRows);
      if (request.provisionalPrincipalAction && request.provisionalPrincipalAction !== plan.provisionalPrincipal.action) {
        throw new TradingViewMigrationTransactionError("migration-stale", "The provisional principal action changed after preview.");
      }

      const now = this.options.now?.() ?? new Date().toISOString();
      writeOperation(this.database, request.operationId, "commit", null, request.idempotencyKey, request.planDigest, request.baseSnapshotDigest, now, requestSummary);
      const applied = executePlan(this.database, request.operationId, plan, now);
      const afterSnapshotDigest = digestAffectedRows(applied.rows);
      const result: TradingViewMigrationCommitResult = {
        operationId: request.operationId,
        status: "committed",
        idempotent: false,
        afterSnapshotDigest,
        affectedRows: applied.rows.length,
        executionCount: plan.executionPlan.length,
        quantity: plan.counts.quantity,
        fee: plan.counts.fee,
        episodeMap: plan.episodeMap,
        ...(applied.principalRevision === undefined ? {} : { provisionalPrincipalRevision: applied.principalRevision }),
      };
      writeLedger(this.database, request.operationId, applied.rows);
      const aliases = migrationAliases(request.operationId, plan);
      writeAliases(this.database, aliases);
      writeDependencyGuard(this.database, request.operationId, aliases);
      writeResult(this.database, request.operationId, result, afterSnapshotDigest, now);
      return result;
    });
  }

  rollbackPreview(request: TradingViewMigrationRollbackPreviewRequest): TradingViewMigrationRollbackPreview {
    return runTransaction(this.database, "read", () => {
      const validation = rollbackValidation(this.database, request.operationId, request.expectedAfterSnapshotDigest);
      return {
        operationId: request.operationId,
        status: validation.blockers.length === 0 ? "ready" : "blocked",
        expectedAfterSnapshotDigest: validation.expectedAfterSnapshotDigest,
        affectedRows: validation.rows.length,
        aliases: validation.aliases,
        blockers: validation.blockers,
      };
    });
  }

  rollback(request: TradingViewMigrationRollbackRequest): TradingViewMigrationRollbackResult {
    const requestSummary = normalizedRollbackRequest(request);
    return runTransaction(this.database, "write", () => {
      const existingRollback = readOperation(this.database, request.rollbackOperationId);
      if (existingRollback) {
        const sameRequest = existingRollback.operation_kind === "rollback"
          && existingRollback.parent_operation_id === request.operationId
          && requestDigest(parseJson(existingRollback.request_json)) === requestDigest(requestSummary);
        if (!sameRequest) {
          throw new TradingViewMigrationTransactionError("migration-rollback-conflict", "The rollback operation was already used with different parameters.");
        }
        const result = parseResult<TradingViewMigrationRollbackResult>(existingRollback);
        return { ...result, idempotent: true };
      }
      const validation = rollbackValidation(this.database, request.operationId, request.expectedAfterSnapshotDigest);
      const blocker = validation.blockers[0];
      if (blocker) throwRollbackBlocker(blocker);
      const original = validation.original;
      const rows = validation.rows;
      const now = this.options.now?.() ?? new Date().toISOString();
      const rollbackIdempotencyKey = `rollback:${request.rollbackOperationId}`;
      writeOperation(this.database, request.rollbackOperationId, "rollback", request.operationId, rollbackIdempotencyKey, rowString(original, "plan_digest"), request.expectedAfterSnapshotDigest, now, requestSummary);
      databaseDeferForeignKeys(this.database);
      const rollbackRows: LedgerRow[] = [];
      for (const row of [...rows].reverse()) {
        const before = row.before;
        const after = row.after;
        restoreRawRow(this.database, row.tableName, before, after);
      }
      rollbackRows.push(...verifyRollbackRestoration(this.database, rows));
      const afterSnapshotDigest = digestAffectedRows(rollbackRows);
      const result: TradingViewMigrationRollbackResult = {
        operationId: request.operationId,
        rollbackOperationId: request.rollbackOperationId,
        status: "rolled-back",
        idempotent: false,
        afterSnapshotDigest,
        affectedRows: rollbackRows.length,
      };
      writeLedger(this.database, request.rollbackOperationId, rollbackRows);
      writeResult(this.database, request.rollbackOperationId, result, afterSnapshotDigest, now);
      this.database.prepare("update tradingview_account_migration_operations set status = 'rolled-back', updated_at = ? where operation_id = ?").run(now, request.operationId);
      return result;
    });
  }

  getCommittedAliases(operationId?: string): TradingViewMigrationAlias[] {
    const rows = operationId
      ? this.database.prepare(`
          select a.operation_id, a.alias_kind, a.old_id, a.new_id
          from tradingview_account_migration_aliases a
          join tradingview_account_migration_operations o on o.operation_id = a.operation_id
          where a.operation_id = ? and o.operation_kind = 'commit' and o.status = 'committed'
          order by a.alias_kind, a.old_id
        `).all(operationId)
      : this.database.prepare(`
          select a.operation_id, a.alias_kind, a.old_id, a.new_id
          from tradingview_account_migration_aliases a
          join tradingview_account_migration_operations o on o.operation_id = a.operation_id
          where o.operation_kind = 'commit' and o.status = 'committed'
          order by a.operation_id, a.alias_kind, a.old_id
        `).all();
    return (rows as DbRow[]).map((row) => ({
      operationId: rowString(row, "operation_id"),
      kind: rowString(row, "alias_kind") as TradingViewMigrationAlias["kind"],
      oldId: rowString(row, "old_id"),
      newId: rowString(row, "new_id"),
    }));
  }
}

function databaseDeferForeignKeys(database: DatabaseSync): void {
  database.exec("pragma defer_foreign_keys = on");
}

export class TradingViewAccountMigrationTransactionStore extends TradingViewAccountMigrationStore {}

export function previewTradingViewAccountMigration(database: DatabaseSync, request: TradingViewMigrationPreviewRequest = {}, options: TradingViewAccountMigrationTransactionOptions = {}): TradingViewMigrationPreview {
  return new TradingViewAccountMigrationStore(database, options).preview(request);
}

export function commitTradingViewAccountMigration(database: DatabaseSync, request: TradingViewMigrationCommitRequest, options: TradingViewAccountMigrationTransactionOptions = {}): TradingViewMigrationCommitResult {
  return new TradingViewAccountMigrationStore(database, options).commit(request);
}

export function rollbackTradingViewAccountMigration(database: DatabaseSync, request: TradingViewMigrationRollbackRequest, options: TradingViewAccountMigrationTransactionOptions = {}): TradingViewMigrationRollbackResult {
  return new TradingViewAccountMigrationStore(database, options).rollback(request);
}

export function rollbackPreviewTradingViewAccountMigration(database: DatabaseSync, request: TradingViewMigrationRollbackPreviewRequest, options: TradingViewAccountMigrationTransactionOptions = {}): TradingViewMigrationRollbackPreview {
  return new TradingViewAccountMigrationStore(database, options).rollbackPreview(request);
}

export const previewRollbackTradingViewAccountMigration = rollbackPreviewTradingViewAccountMigration;
