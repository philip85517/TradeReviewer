import type {
  TradingViewMigrationCommitRequest,
  TradingViewMigrationCommitResult,
  TradingViewMigrationPreview,
  TradingViewMigrationRollbackPreview,
  TradingViewMigrationRollbackPreviewRequest,
  TradingViewMigrationRollbackRequest,
  TradingViewMigrationRollbackResult,
} from "./tradingview-account-migration-contracts";
import { StorageHttpError } from "./sqlite-http-client";
import {
  TRADINGVIEW_CANONICAL_ACCOUNT_ID,
  TRADINGVIEW_CANONICAL_ACCOUNT_LABEL,
} from "../trades/tradingview-account-identity";

export type TradingViewMigrationPreviewRequest = {
  operationId?: string;
  sourceAccountIds?: readonly string[];
  canonicalAccountId?: string;
};

export type TradingViewAccountMigrationAlias = {
  operationId: string;
  kind: "account" | "episode" | "scope";
  oldId: string;
  newId: string;
};

export type TradingViewAccountProvisional = {
  accountId: string;
  currency: string;
  amount: string;
  asOf: string | null;
  status: "provisional" | "confirmed";
  source: string;
  revision: number;
  updatedAt: string;
};

export type TradingViewMigrationAliasesResponse = {
  aliases: TradingViewAccountMigrationAlias[];
};

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

export type TradingViewAccountMigrationClient = {
  preview(request?: TradingViewMigrationPreviewRequest): Promise<TradingViewMigrationPreview>;
  retryPreview(operationId: string): Promise<TradingViewMigrationPreview>;
  commit(request: TradingViewMigrationCommitRequest): Promise<TradingViewMigrationCommitResult>;
  retryCommit(operationId: string): Promise<TradingViewMigrationCommitResult>;
  rollbackPreview(request: TradingViewMigrationRollbackPreviewRequest): Promise<TradingViewMigrationRollbackPreview>;
  retryRollbackPreview(operationId: string): Promise<TradingViewMigrationRollbackPreview>;
  rollback(request: TradingViewMigrationRollbackRequest): Promise<TradingViewMigrationRollbackResult>;
  retryRollback(rollbackOperationId: string): Promise<TradingViewMigrationRollbackResult>;
  getAliases(operationId?: string): Promise<TradingViewMigrationAliasesResponse>;
  getActiveAliases(operationId?: string): Promise<TradingViewMigrationAliasesResponse>;
  getProvisional(accountId?: string): Promise<TradingViewAccountProvisional | undefined>;
  getProvisionalPrincipal(accountId?: string): Promise<TradingViewAccountProvisional | undefined>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function nonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(nonEmptyString);
}

function optionalString(record: Record<string, unknown>, key: string): boolean {
  return record[key] === undefined || typeof record[key] === "string";
}

function isTradeSide(value: unknown): value is "buy" | "sell" {
  return value === "buy" || value === "sell";
}

function isExecutionSnapshot(value: unknown, canonical: boolean): boolean {
  if (!isRecord(value)) return false;
  return nonEmptyString(value.accountId)
    && (!canonical || value.accountId === TRADINGVIEW_CANONICAL_ACCOUNT_ID)
    && typeof value.accountLabel === "string"
    && (!canonical || value.accountLabel === TRADINGVIEW_CANONICAL_ACCOUNT_LABEL)
    && nonEmptyString(value.sourceRunId)
    && nonNegativeInteger(value.sourceRow)
    && optionalString(value, "sourceFingerprint");
}

function isExecutionPlanRow(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return nonEmptyString(value.executionId)
    && nonEmptyString(value.beforeAccountId)
    && value.afterAccountId === TRADINGVIEW_CANONICAL_ACCOUNT_ID
    && typeof value.beforeAccountLabel === "string"
    && value.afterAccountLabel === TRADINGVIEW_CANONICAL_ACCOUNT_LABEL
    && nonEmptyString(value.sourceRunId)
    && nonNegativeInteger(value.originalSourceRow)
    && nonEmptyString(value.executedAt)
    && isTradeSide(value.side)
    && nonEmptyString(value.instrumentId)
    && nonEmptyString(value.quantity)
    && nonEmptyString(value.price)
    && nonEmptyString(value.fee)
    && nonEmptyString(value.originalQuantity)
    && nonEmptyString(value.originalPrice)
    && nonEmptyString(value.originalFee)
    && nonEmptyString(value.beforeDigest)
    && nonEmptyString(value.afterDigest)
    && isExecutionSnapshot(value.before, false)
    && isExecutionSnapshot(value.after, true)
    && optionalString(value, "originalSourceFingerprint")
    && optionalString(value, "originalSourceTradeId")
    && optionalString(value, "originalGrossAmount");
}

function isEpisodeMapRow(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return nonEmptyString(value.oldEpisodeId)
    && nonEmptyString(value.newEpisodeId)
    && value.accountId === TRADINGVIEW_CANONICAL_ACCOUNT_ID
    && nonEmptyString(value.instrumentId)
    && (value.direction === "long" || value.direction === "short")
    && isStringArray(value.executionIds)
    && optionalString(value, "sourceRunId")
    && nonEmptyString(value.beforeDigest)
    && nonEmptyString(value.afterDigest);
}

function isReferencePlanRow(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return nonEmptyString(value.table)
    && nonEmptyString(value.primaryKey)
    && optionalString(value, "owner")
    && (value.status === "mapped" || value.status === "preserved" || value.status === "blocked")
    && isRecord(value.before)
    && isRecord(value.after)
    && nonEmptyString(value.beforeDigest)
    && nonEmptyString(value.afterDigest);
}

function isMigrationBlockerCode(value: unknown): boolean {
  return value === "duplicate-execution-id"
    || value === "invalid-decimal"
    || value === "live-execution"
    || value === "unknown-nature"
    || value === "nature-conflict"
    || value === "platform-mismatch"
    || value === "missing-account-id"
    || value === "missing-source-run"
    || value === "source-run-conflict"
    || value === "canonical-account-conflict"
    || value === "ambiguous-episode"
    || value === "unknown-reference"
    || value === "principal-conflict";
}

function isMigrationBlocker(value: unknown): boolean {
  if (!isRecord(value) || !isMigrationBlockerCode(value.code) || !nonEmptyString(value.message)) return false;
  return optionalString(value, "executionId")
    && optionalString(value, "oldEpisodeId")
    && optionalString(value, "newEpisodeId")
    && optionalString(value, "table")
    && optionalString(value, "primaryKey")
    && optionalString(value, "fieldPath")
    && optionalString(value, "owner");
}

function isAdapterBlockerCode(value: unknown): boolean {
  return value === "domain-run-grouping"
    || value === "invalid-execution-row"
    || value === "invalid-json"
    || value === "table-read-error";
}

function isAdapterBlocker(value: unknown): boolean {
  if (!isRecord(value) || !isAdapterBlockerCode(value.code) || !nonEmptyString(value.message)) return false;
  return optionalString(value, "table")
    && optionalString(value, "primaryKey")
    && optionalString(value, "executionId")
    && optionalString(value, "fieldPath");
}

function isPrincipalPlan(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (value.action === "create-if-absent" || value.action === "no-op" || value.action === "conflict")
    && value.accountId === TRADINGVIEW_CANONICAL_ACCOUNT_ID
    && value.currency === "CNY"
    && value.amount === "100000"
    && value.asOf === null
    && value.status === "provisional"
    && value.source === "user-default"
    && (value.revision === undefined || nonNegativeInteger(value.revision));
}

function isCounts(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return nonNegativeInteger(value.executions)
    && nonNegativeInteger(value.oldAccounts)
    && nonNegativeInteger(value.sourceRuns)
    && nonNegativeInteger(value.instruments)
    && nonNegativeInteger(value.reviews)
    && nonNegativeInteger(value.recallRows)
    && nonNegativeInteger(value.settingsRows)
    && nonEmptyString(value.quantity)
    && nonEmptyString(value.fee);
}

function isConservation(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return isStringArray(value.executionIdsBefore)
    && isStringArray(value.executionIdsAfter)
    && typeof value.executionIdsPreserved === "boolean"
    && isStringArray(value.sourceRunsBefore)
    && isStringArray(value.sourceRunsAfter)
    && typeof value.sourceRunsPreserved === "boolean"
    && nonEmptyString(value.quantityBefore)
    && nonEmptyString(value.quantityAfter)
    && nonEmptyString(value.feeBefore)
    && nonEmptyString(value.feeAfter);
}

function isAlias(value: unknown): value is TradingViewAccountMigrationAlias {
  if (!isRecord(value)) return false;
  return nonEmptyString(value.operationId)
    && (value.kind === "account" || value.kind === "episode" || value.kind === "scope")
    && nonEmptyString(value.oldId)
    && nonEmptyString(value.newId);
}

function isPreview(value: unknown): value is TradingViewMigrationPreview {
  if (!isRecord(value)) return false;
  const counts = value.counts;
  const conservation = value.conservation;
  return nonEmptyString(value.operationId)
    && (value.status === "ready" || value.status === "blocked")
    && nonEmptyString(value.snapshotDigest)
    && value.canonicalAccountId === TRADINGVIEW_CANONICAL_ACCOUNT_ID
    && value.canonicalAccountLabel === TRADINGVIEW_CANONICAL_ACCOUNT_LABEL
    && nonEmptyString(value.baseSnapshotDigest)
    && nonEmptyString(value.planDigest)
    && isCounts(counts)
    && Array.isArray(value.executionPlan)
    && value.executionPlan.every(isExecutionPlanRow)
    && Array.isArray(value.episodeMap)
    && value.episodeMap.every(isEpisodeMapRow)
    && Array.isArray(value.referencePlan)
    && value.referencePlan.every(isReferencePlanRow)
    && Array.isArray(value.browserStatePlan)
    && value.browserStatePlan.every(isReferencePlanRow)
    && isPrincipalPlan(value.provisionalPrincipal)
    && Array.isArray(value.blockers)
    && value.blockers.every(isMigrationBlocker)
    && Array.isArray(value.adapterBlockers)
    && value.adapterBlockers.every(isAdapterBlocker)
    && isConservation(conservation);
}

function isCommitResult(value: unknown): value is TradingViewMigrationCommitResult {
  if (!isRecord(value)) return false;
  return nonEmptyString(value.operationId)
    && value.status === "committed"
    && typeof value.idempotent === "boolean"
    && nonEmptyString(value.afterSnapshotDigest)
    && nonNegativeInteger(value.affectedRows)
    && nonNegativeInteger(value.executionCount)
    && nonEmptyString(value.quantity)
    && nonEmptyString(value.fee)
    && Array.isArray(value.episodeMap)
    && value.episodeMap.every(isEpisodeMapRow)
    && (value.provisionalPrincipalRevision === undefined || nonNegativeInteger(value.provisionalPrincipalRevision));
}

function isRollbackPreviewBlocker(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (value.code === "migration-blocked"
    || value.code === "migration-stale"
    || value.code === "migration-idempotency-conflict"
    || value.code === "migration-rollback-stale"
    || value.code === "migration-rollback-conflict"
    || value.code === "migration-unsupported-reference"
    || value.code === "migration-primary-key-conflict"
    || value.code === "migration-operation-not-found"
    || value.code === "canonical-account-conflict")
    && nonEmptyString(value.message)
    && optionalString(value, "table")
    && optionalString(value, "primaryKey");
}

function isRollbackPreview(value: unknown): value is TradingViewMigrationRollbackPreview {
  if (!isRecord(value)) return false;
  return nonEmptyString(value.operationId)
    && (value.status === "ready" || value.status === "blocked")
    && nonEmptyString(value.expectedAfterSnapshotDigest)
    && nonNegativeInteger(value.affectedRows)
    && Array.isArray(value.aliases)
    && value.aliases.every(isAlias)
    && Array.isArray(value.blockers)
    && value.blockers.every(isRollbackPreviewBlocker);
}

function isRollbackResult(value: unknown): value is TradingViewMigrationRollbackResult {
  if (!isRecord(value)) return false;
  return nonEmptyString(value.operationId)
    && nonEmptyString(value.rollbackOperationId)
    && value.status === "rolled-back"
    && typeof value.idempotent === "boolean"
    && nonEmptyString(value.afterSnapshotDigest)
    && nonNegativeInteger(value.affectedRows);
}

function isProvisional(value: unknown): value is TradingViewAccountProvisional {
  if (!isRecord(value)) return false;
  return nonEmptyString(value.accountId)
    && nonEmptyString(value.currency)
    && nonEmptyString(value.amount)
    && (value.asOf === null || nonEmptyString(value.asOf))
    && (value.status === "provisional" || value.status === "confirmed")
    && nonEmptyString(value.source)
    && nonNegativeInteger(value.revision)
    && nonEmptyString(value.updatedAt);
}

function invalidResponse(response: Response): StorageHttpError {
  return new StorageHttpError(response.status, "invalid-response", "Migration response was invalid");
}

function hasRequestedOperation(response: Response, requested: string | undefined, actual: string): void {
  if (requested !== undefined && requested !== actual) throw invalidResponse(response);
}

function isStructuredNotFound(value: unknown): boolean {
  return isRecord(value)
    && isRecord(value.error)
    && value.error.code === "not-found"
    && nonEmptyString(value.error.message);
}

function responseError(response: Response, body: unknown): StorageHttpError {
  const detail = isRecord(body) && isRecord(body.error) ? body.error : undefined;
  const code = detail && typeof detail.code === "string" ? detail.code : "storage-request-failed";
  const message = detail && typeof detail.message === "string"
    ? detail.message
    : `Storage request failed (${response.status})`;
  return new StorageHttpError(response.status, code, message);
}

async function responseBody(response: Response): Promise<unknown> {
  try {
    return await response.json() as unknown;
  } catch {
    if (!response.ok) throw responseError(response, undefined);
    throw invalidResponse(response);
  }
}

async function read<T>(response: Response, isValid: (value: unknown) => value is T): Promise<T> {
  const body = await responseBody(response);
  if (!response.ok) throw responseError(response, body);
  if (isRecord(body) && "error" in body) throw invalidResponse(response);
  if (!isValid(body)) throw invalidResponse(response);
  return body;
}

function postRequest(body: unknown): RequestInit {
  return {
    method: "POST",
    cache: "no-store",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function missingRetry(operation: string): StorageHttpError {
  return new StorageHttpError(0, "missing-request", `No migration request is retained for ${operation}`);
}

function aliasesResponse(value: unknown): value is TradingViewMigrationAliasesResponse {
  return isRecord(value) && Array.isArray(value.aliases) && value.aliases.every(isAlias);
}

export function createTradingViewAccountMigrationClient(fetcher: Fetcher = fetch): TradingViewAccountMigrationClient {
  const previewRequests = new Map<string, TradingViewMigrationPreviewRequest>();
  const commitRequests = new Map<string, TradingViewMigrationCommitRequest>();
  const rollbackPreviewRequests = new Map<string, TradingViewMigrationRollbackPreviewRequest>();
  const rollbackRequests = new Map<string, TradingViewMigrationRollbackRequest>();

  async function sendPreview(request: TradingViewMigrationPreviewRequest): Promise<TradingViewMigrationPreview> {
    const response = await fetcher("/api/storage/tradingview-account-migration/preview", postRequest(request));
    const result = await read(response, isPreview);
    hasRequestedOperation(response, request.operationId, result.operationId);
    return result;
  }

  async function sendCommit(request: TradingViewMigrationCommitRequest): Promise<TradingViewMigrationCommitResult> {
    const response = await fetcher("/api/storage/tradingview-account-migration/commit", postRequest(request));
    const result = await read(response, isCommitResult);
    hasRequestedOperation(response, request.operationId, result.operationId);
    return result;
  }

  async function sendRollbackPreview(request: TradingViewMigrationRollbackPreviewRequest): Promise<TradingViewMigrationRollbackPreview> {
    const response = await fetcher("/api/storage/tradingview-account-migration/rollback-preview", postRequest(request));
    const result = await read(response, isRollbackPreview);
    hasRequestedOperation(response, request.operationId, result.operationId);
    if (result.aliases.some((alias) => alias.operationId !== request.operationId)) throw invalidResponse(response);
    return result;
  }

  async function sendRollback(request: TradingViewMigrationRollbackRequest): Promise<TradingViewMigrationRollbackResult> {
    const response = await fetcher("/api/storage/tradingview-account-migration/rollback", postRequest(request));
    const result = await read(response, isRollbackResult);
    hasRequestedOperation(response, request.operationId, result.operationId);
    if (result.rollbackOperationId !== request.rollbackOperationId) throw invalidResponse(response);
    return result;
  }

  async function preview(request: TradingViewMigrationPreviewRequest = {}): Promise<TradingViewMigrationPreview> {
    const original = clone(request);
    if (original.operationId !== undefined) previewRequests.set(original.operationId, clone(original));
    const result = await sendPreview(original);
    const retained = clone({ ...original, operationId: result.operationId });
    previewRequests.set(result.operationId, retained);
    return result;
  }

  async function commit(request: TradingViewMigrationCommitRequest): Promise<TradingViewMigrationCommitResult> {
    const original = clone(request);
    commitRequests.set(original.operationId, original);
    return sendCommit(original);
  }

  async function rollbackPreview(request: TradingViewMigrationRollbackPreviewRequest): Promise<TradingViewMigrationRollbackPreview> {
    const original = clone(request);
    rollbackPreviewRequests.set(original.operationId, original);
    return sendRollbackPreview(original);
  }

  async function rollback(request: TradingViewMigrationRollbackRequest): Promise<TradingViewMigrationRollbackResult> {
    const original = clone(request);
    rollbackRequests.set(original.rollbackOperationId, original);
    return sendRollback(original);
  }

  async function getAliases(operationId?: string): Promise<TradingViewMigrationAliasesResponse> {
    const url = operationId
      ? `/api/storage/tradingview-account-migration/aliases?operationId=${encodeURIComponent(operationId)}`
      : "/api/storage/tradingview-account-migration/aliases";
    const response = await fetcher(url, { cache: "no-store" });
    const result = await read(response, aliasesResponse);
    if (operationId !== undefined && result.aliases.some((alias) => alias.operationId !== operationId)) {
      throw invalidResponse(response);
    }
    return result;
  }

  async function getProvisional(accountId?: string): Promise<TradingViewAccountProvisional | undefined> {
    const url = accountId
      ? `/api/storage/tradingview-account-migration/provisional?accountId=${encodeURIComponent(accountId)}`
      : "/api/storage/tradingview-account-migration/provisional";
    const response = await fetcher(url, { cache: "no-store" });
    if (response.status === 404) {
      const body = await responseBody(response);
      if (isStructuredNotFound(body)) return undefined;
      throw invalidResponse(response);
    }
    const result = await read(response, isProvisional);
    if (accountId !== undefined && result.accountId !== accountId) throw invalidResponse(response);
    return result;
  }

  return {
    preview,
    retryPreview: async (operationId) => {
      const request = previewRequests.get(operationId);
      if (!request) throw missingRetry(`preview ${operationId}`);
      return sendPreview(clone(request));
    },
    commit,
    retryCommit: async (operationId) => {
      const request = commitRequests.get(operationId);
      if (!request) throw missingRetry(`commit ${operationId}`);
      return sendCommit(clone(request));
    },
    rollbackPreview,
    retryRollbackPreview: async (operationId) => {
      const request = rollbackPreviewRequests.get(operationId);
      if (!request) throw missingRetry(`rollback preview ${operationId}`);
      return sendRollbackPreview(clone(request));
    },
    rollback,
    retryRollback: async (rollbackOperationId) => {
      const request = rollbackRequests.get(rollbackOperationId);
      if (!request) throw missingRetry(`rollback ${rollbackOperationId}`);
      return sendRollback(clone(request));
    },
    getAliases,
    getActiveAliases: getAliases,
    getProvisional,
    getProvisionalPrincipal: getProvisional,
  };
}

export type {
  TradingViewMigrationCommitRequest,
  TradingViewMigrationCommitResult,
  TradingViewMigrationRollbackPreview,
  TradingViewMigrationRollbackPreviewRequest,
  TradingViewMigrationRollbackRequest,
  TradingViewMigrationRollbackResult,
};
