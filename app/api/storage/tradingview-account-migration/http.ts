import { openSqliteDatabase } from "../../../../db/sqlite";
import { TRADINGVIEW_CANONICAL_ACCOUNT_ID } from "../../../lib/trades/tradingview-account-identity";
import {
  TradingViewAccountMigrationStore,
} from "../../../lib/storage/tradingview-account-migration-store";
import {
  TradingViewMigrationTransactionError,
  type TradingViewMigrationCommitRequest,
  type TradingViewMigrationPreviewRequest,
  type TradingViewMigrationRollbackPreviewRequest,
  type TradingViewMigrationRollbackRequest,
} from "../../../lib/storage/tradingview-account-migration-contracts";

type JsonRecord = Record<string, unknown>;

const PREVIEW_KEYS = new Set(["operationId", "sourceAccountIds", "canonicalAccountId"]);
const COMMIT_KEYS = new Set([
  "operationId",
  "idempotencyKey",
  "planDigest",
  "baseSnapshotDigest",
  "episodeMapDigest",
  "expectedAffectedRows",
  "provisionalPrincipalAction",
]);
const ROLLBACK_PREVIEW_KEYS = new Set(["operationId", "expectedAfterSnapshotDigest"]);
const ROLLBACK_KEYS = new Set(["operationId", "rollbackOperationId", "expectedAfterSnapshotDigest"]);

function response(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function failure(code: string, message: string, status: number): Response {
  return response({ error: { code, message } }, status);
}

function invalid(message = "Invalid migration request"): Response {
  return failure("invalid-request", message, 400);
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function exactKeys(value: JsonRecord, allowed: ReadonlySet<string>): boolean {
  return Object.keys(value).every((key) => allowed.has(key));
}

function parseStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value) || value.some((item) => !nonEmptyString(item))) return undefined;
  return [...value];
}

async function body(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new Error("invalid-json");
  }
}

function parsePreview(value: unknown): { input: TradingViewMigrationPreviewRequest; sourceAccountIds?: string[]; canonicalAccountId?: string } | undefined {
  if (!isRecord(value) || !exactKeys(value, PREVIEW_KEYS)) return undefined;
  if (value.operationId !== undefined && !nonEmptyString(value.operationId)) return undefined;
  const sourceAccountIds = value.sourceAccountIds === undefined ? undefined : parseStringArray(value.sourceAccountIds);
  if (value.sourceAccountIds !== undefined && !sourceAccountIds) return undefined;
  const canonicalAccountId = value.canonicalAccountId === undefined ? undefined : value.canonicalAccountId;
  if (canonicalAccountId !== undefined && canonicalAccountId !== TRADINGVIEW_CANONICAL_ACCOUNT_ID) return undefined;
  return {
    input: {
      ...(value.operationId === undefined ? {} : { operationId: value.operationId }),
    },
    ...(sourceAccountIds === undefined ? {} : { sourceAccountIds }),
    ...(canonicalAccountId === undefined ? {} : { canonicalAccountId }),
  };
}

function parseCommit(value: unknown): TradingViewMigrationCommitRequest | undefined {
  if (!isRecord(value) || !exactKeys(value, COMMIT_KEYS)) return undefined;
  if (!nonEmptyString(value.operationId) || !nonEmptyString(value.idempotencyKey) || !nonEmptyString(value.planDigest) || !nonEmptyString(value.baseSnapshotDigest)) return undefined;
  if (value.episodeMapDigest !== undefined && !nonEmptyString(value.episodeMapDigest)) return undefined;
  if (value.provisionalPrincipalAction !== undefined && value.provisionalPrincipalAction !== "create-if-absent" && value.provisionalPrincipalAction !== "no-op") return undefined;
  let expectedAffectedRows: TradingViewMigrationCommitRequest["expectedAffectedRows"];
  if (value.expectedAffectedRows !== undefined) {
    if (!Array.isArray(value.expectedAffectedRows)) return undefined;
    const rows = value.expectedAffectedRows.map((item) => {
      if (!isRecord(item) || !exactKeys(item, new Set(["table", "key", "beforeDigest"]))) return undefined;
      if (!nonEmptyString(item.table) || !nonEmptyString(item.key) || !nonEmptyString(item.beforeDigest)) return undefined;
      return { table: item.table, key: item.key, beforeDigest: item.beforeDigest };
    });
    if (rows.some((item) => !item)) return undefined;
    expectedAffectedRows = rows as TradingViewMigrationCommitRequest["expectedAffectedRows"];
  }
  return {
    operationId: value.operationId,
    idempotencyKey: value.idempotencyKey,
    planDigest: value.planDigest,
    baseSnapshotDigest: value.baseSnapshotDigest,
    ...(value.episodeMapDigest === undefined ? {} : { episodeMapDigest: value.episodeMapDigest }),
    ...(expectedAffectedRows === undefined ? {} : { expectedAffectedRows }),
    ...(value.provisionalPrincipalAction === undefined ? {} : { provisionalPrincipalAction: value.provisionalPrincipalAction }),
  };
}

function parseRollbackPreview(value: unknown): TradingViewMigrationRollbackPreviewRequest | undefined {
  if (!isRecord(value) || !exactKeys(value, ROLLBACK_PREVIEW_KEYS)) return undefined;
  if (!nonEmptyString(value.operationId)) return undefined;
  if (value.expectedAfterSnapshotDigest !== undefined && !nonEmptyString(value.expectedAfterSnapshotDigest)) return undefined;
  return {
    operationId: value.operationId,
    ...(value.expectedAfterSnapshotDigest === undefined ? {} : { expectedAfterSnapshotDigest: value.expectedAfterSnapshotDigest }),
  };
}

function parseRollback(value: unknown): TradingViewMigrationRollbackRequest | undefined {
  if (!isRecord(value) || !exactKeys(value, ROLLBACK_KEYS)) return undefined;
  if (!nonEmptyString(value.operationId) || !nonEmptyString(value.rollbackOperationId) || !nonEmptyString(value.expectedAfterSnapshotDigest)) return undefined;
  return {
    operationId: value.operationId,
    rollbackOperationId: value.rollbackOperationId,
    expectedAfterSnapshotDigest: value.expectedAfterSnapshotDigest,
  };
}

function isTransactionError(error: unknown): error is TradingViewMigrationTransactionError {
  return error instanceof TradingViewMigrationTransactionError;
}

function transactionFailure(error: TradingViewMigrationTransactionError): Response {
  if (error.code === "migration-operation-not-found") {
    return failure("not-found", "Migration operation not found", 404);
  }
  return failure(error.code, "Migration request conflicts with current storage state", 409);
}

function unexpectedFailure(): Response {
  return failure("storage-unavailable", "Migration storage is unavailable", 503);
}

function sourceIdsFromPreview(preview: { executionPlan?: readonly { beforeAccountId?: unknown }[] }): string[] {
  return [...new Set((preview.executionPlan ?? []).flatMap((row) => nonEmptyString(row.beforeAccountId) ? [row.beforeAccountId] : []))].sort();
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export async function postPreview(request: Request): Promise<Response> {
  let parsed: unknown;
  try {
    parsed = await body(request);
  } catch {
    return invalid("Migration request must be valid JSON");
  }
  const input = parsePreview(parsed);
  if (!input) return invalid();
  try {
    const result = new TradingViewAccountMigrationStore(openSqliteDatabase()).preview(input.input);
    if (input.canonicalAccountId && result.canonicalAccountId !== input.canonicalAccountId) return invalid();
    if (input.sourceAccountIds && !sameStrings([...input.sourceAccountIds].sort(), sourceIdsFromPreview(result))) return invalid();
    return response(result);
  } catch (error) {
    if (isTransactionError(error)) return transactionFailure(error);
    return unexpectedFailure();
  }
}

export async function postCommit(request: Request): Promise<Response> {
  let parsed: unknown;
  try {
    parsed = await body(request);
  } catch {
    return invalid("Migration request must be valid JSON");
  }
  const input = parseCommit(parsed);
  if (!input) return invalid();
  try {
    return response(new TradingViewAccountMigrationStore(openSqliteDatabase()).commit(input));
  } catch (error) {
    if (isTransactionError(error)) return transactionFailure(error);
    return unexpectedFailure();
  }
}

export async function postRollbackPreview(request: Request): Promise<Response> {
  let parsed: unknown;
  try {
    parsed = await body(request);
  } catch {
    return invalid("Migration request must be valid JSON");
  }
  const input = parseRollbackPreview(parsed);
  if (!input) return invalid();
  try {
    const result = new TradingViewAccountMigrationStore(openSqliteDatabase()).rollbackPreview(input);
    const missing = result.blockers.find((blocker) => blocker.code === "migration-operation-not-found");
    if (missing) return failure("not-found", "Migration operation not found", 404);
    return response(result);
  } catch (error) {
    if (isTransactionError(error)) return transactionFailure(error);
    return unexpectedFailure();
  }
}

export async function postRollback(request: Request): Promise<Response> {
  let parsed: unknown;
  try {
    parsed = await body(request);
  } catch {
    return invalid("Migration request must be valid JSON");
  }
  const input = parseRollback(parsed);
  if (!input) return invalid();
  try {
    return response(new TradingViewAccountMigrationStore(openSqliteDatabase()).rollback(input));
  } catch (error) {
    if (isTransactionError(error)) return transactionFailure(error);
    return unexpectedFailure();
  }
}

function query(request: Request, allowed: ReadonlySet<string>): Map<string, string> | undefined {
  const params = new URL(request.url).searchParams;
  const result = new Map<string, string>();
  for (const key of params.keys()) {
    if (!allowed.has(key)) return undefined;
    const value = params.get(key);
    if (!value || !value.trim()) return undefined;
    result.set(key, value);
  }
  return result;
}

export async function getAliases(request: Request): Promise<Response> {
  const params = query(request, new Set(["operationId"]));
  if (!params) return invalid();
  try {
    const aliases = new TradingViewAccountMigrationStore(openSqliteDatabase()).getCommittedAliases(params.get("operationId"));
    return response({ aliases });
  } catch {
    return unexpectedFailure();
  }
}

type ProvisionalRow = {
  account_id: string;
  currency: string;
  amount: string;
  as_of: string | null;
  status: "provisional" | "confirmed";
  source: string;
  revision: number;
  updated_at: string;
};

export async function getProvisional(request: Request): Promise<Response> {
  const params = query(request, new Set(["accountId"]));
  if (!params) return invalid();
  const accountId = params.get("accountId") ?? TRADINGVIEW_CANONICAL_ACCOUNT_ID;
  try {
    const row = openSqliteDatabase().prepare(
      "select account_id, currency, amount, as_of, status, source, revision, updated_at from account_principal_provisionals where account_id = ?",
    ).get(accountId) as ProvisionalRow | undefined;
    if (!row) return failure("not-found", "Account provisional not found", 404);
    return response({
      accountId: row.account_id,
      currency: row.currency,
      amount: row.amount,
      asOf: row.as_of,
      status: row.status,
      source: row.source,
      revision: row.revision,
      updatedAt: row.updated_at,
    });
  } catch {
    return unexpectedFailure();
  }
}

export function invalidAction(): Response {
  return failure("invalid-request", "Unknown migration action", 400);
}
