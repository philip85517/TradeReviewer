import type { ReadonlySqliteRows, TradingViewSnapshotAdapterBlocker, TradingViewSnapshotAdapterResult } from "./tradingview-account-migration-snapshot";
import type {
  TradingViewAccountMigrationPlan,
  TradingViewAccountMigrationSnapshot,
  TradingViewMigrationBlocker,
} from "./tradingview-account-migration-plan";

export type TradingViewMigrationPreviewRequest = {
  operationId?: string;
};

export type TradingViewMigrationPreview = TradingViewAccountMigrationPlan & {
  operationId: string;
  snapshotDigest: string;
  adapterBlockers: readonly TradingViewSnapshotAdapterBlocker[];
};

export type TradingViewMigrationExpectedAffectedRow = {
  table: string;
  key: string;
  beforeDigest: string;
};

export type TradingViewMigrationCommitRequest = {
  operationId: string;
  idempotencyKey: string;
  planDigest: string;
  baseSnapshotDigest: string;
  episodeMapDigest?: string | null;
  expectedAffectedRows?: readonly TradingViewMigrationExpectedAffectedRow[];
  provisionalPrincipalAction?: "create-if-absent" | "no-op" | null;
};

export type TradingViewMigrationCommitResult = {
  operationId: string;
  status: "committed";
  idempotent: boolean;
  afterSnapshotDigest: string;
  affectedRows: number;
  executionCount: number;
  quantity: string;
  fee: string;
  episodeMap: TradingViewAccountMigrationPlan["episodeMap"];
  provisionalPrincipalRevision?: number;
};

export type TradingViewMigrationRollbackRequest = {
  operationId: string;
  rollbackOperationId: string;
  expectedAfterSnapshotDigest: string;
};

export type TradingViewMigrationRollbackPreviewRequest = {
  operationId: string;
  expectedAfterSnapshotDigest?: string;
};

export type TradingViewMigrationRollbackPreviewBlocker = {
  code: TradingViewMigrationTransactionErrorCode;
  message: string;
  table?: string;
  primaryKey?: string;
};

export type TradingViewMigrationRollbackPreview = {
  operationId: string;
  status: "ready" | "blocked";
  expectedAfterSnapshotDigest: string;
  affectedRows: number;
  aliases: TradingViewMigrationAlias[];
  blockers: readonly TradingViewMigrationRollbackPreviewBlocker[];
};

export type TradingViewMigrationRollbackResult = {
  operationId: string;
  rollbackOperationId: string;
  status: "rolled-back";
  idempotent: boolean;
  afterSnapshotDigest: string;
  affectedRows: number;
};

export type TradingViewMigrationAlias = {
  operationId: string;
  kind: "account" | "episode" | "scope";
  oldId: string;
  newId: string;
};

export type TradingViewMigrationTransactionErrorCode =
  | "migration-blocked"
  | "migration-stale"
  | "migration-idempotency-conflict"
  | "migration-rollback-stale"
  | "migration-rollback-conflict"
  | "migration-unsupported-reference"
  | "migration-primary-key-conflict"
  | "migration-operation-not-found"
  | "canonical-account-conflict";

export class TradingViewMigrationTransactionError extends Error {
  readonly code: TradingViewMigrationTransactionErrorCode;
  readonly details?: Readonly<Record<string, unknown>>;

  constructor(
    code: TradingViewMigrationTransactionErrorCode,
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ) {
    super(message);
    this.name = "TradingViewMigrationTransactionError";
    this.code = code;
    this.details = details;
  }
}

/** The old operation identity covers every accepted request field. */
export function normalizeTradingViewMaintenanceRequest(
  request: unknown,
): Readonly<Record<string, unknown>> {
  const validString = (value: unknown) => typeof value === "string" && value.trim().length > 0;
  const record = request as unknown as Record<string, unknown>;
  const invalid = () => { throw new TradingViewMigrationTransactionError("migration-blocked", "Invalid complete maintenance request"); };
  if (!record || typeof record !== "object" || Array.isArray(record)) return invalid();
  const rollback = Object.hasOwn(record, "rollbackOperationId");
  const allowed = rollback ? ["operationId", "rollbackOperationId", "expectedAfterSnapshotDigest"]
    : ["operationId", "idempotencyKey", "planDigest", "baseSnapshotDigest", "episodeMapDigest", "expectedAffectedRows", "provisionalPrincipalAction"];
  const required = rollback ? allowed : ["operationId", "idempotencyKey", "planDigest", "baseSnapshotDigest"];
  if (Object.keys(record).some(key => !allowed.includes(key)) || required.some(key => !validString(record[key]))) return invalid();
  if (rollback) return {operationId: record.operationId, rollbackOperationId: record.rollbackOperationId, expectedAfterSnapshotDigest: record.expectedAfterSnapshotDigest};
  // Null is the canonical representation of an omitted optional field; normalization is idempotent.
  if (record.episodeMapDigest != null && !validString(record.episodeMapDigest)
    || record.provisionalPrincipalAction != null && !["create-if-absent", "no-op"].includes(String(record.provisionalPrincipalAction))) return invalid();
  if (record.expectedAffectedRows !== undefined && (!Array.isArray(record.expectedAffectedRows)
    || record.expectedAffectedRows.some(row => !row || typeof row !== "object" || Array.isArray(row)
      || Object.keys(row).some(key => !["table", "key", "beforeDigest"].includes(key))
      || ![row.table, row.key, row.beforeDigest].every(validString)))) return invalid();
  const rows = [...((request as TradingViewMigrationCommitRequest).expectedAffectedRows ?? [])]
    .map(row => ({table: row.table, key: row.key, beforeDigest: row.beforeDigest}))
    .sort((left, right) => `${left.table}\0${left.key}\0${left.beforeDigest}`.localeCompare(`${right.table}\0${right.key}\0${right.beforeDigest}`));
  return {operationId: record.operationId, idempotencyKey: record.idempotencyKey, planDigest: record.planDigest,
    baseSnapshotDigest: record.baseSnapshotDigest, episodeMapDigest: record.episodeMapDigest ?? null,
    expectedAffectedRows: rows, provisionalPrincipalAction: record.provisionalPrincipalAction ?? null};
}

export type TradingViewMigrationSnapshotBuilder = (
  reader: ReadonlySqliteRows,
) => TradingViewSnapshotAdapterResult;

export type TradingViewMigrationPlanBuilder = (
  snapshot: TradingViewAccountMigrationSnapshot,
) => TradingViewAccountMigrationPlan;

export type TradingViewAccountMigrationTransactionOptions = {
  snapshotBuilder?: TradingViewMigrationSnapshotBuilder;
  planBuilder?: TradingViewMigrationPlanBuilder;
  now?: () => string;
};

export type TradingViewMigrationEvaluation = {
  snapshot: TradingViewSnapshotAdapterResult;
  plan: TradingViewAccountMigrationPlan;
};

export type TradingViewMigrationBlockers = {
  plan: readonly TradingViewMigrationBlocker[];
  adapter: readonly TradingViewSnapshotAdapterBlocker[];
};
