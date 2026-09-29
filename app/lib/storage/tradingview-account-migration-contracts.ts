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
  episodeMapDigest?: string;
  expectedAffectedRows?: readonly TradingViewMigrationExpectedAffectedRow[];
  provisionalPrincipalAction?: "create-if-absent" | "no-op";
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
