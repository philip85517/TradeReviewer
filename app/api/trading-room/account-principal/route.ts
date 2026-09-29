import { openSqliteDatabase } from "../../../../db/sqlite";
import {
  TRADINGVIEW_CANONICAL_ACCOUNT_ID,
} from "../../../lib/trades/tradingview-account-identity";
import {
  AccountPrincipalProvisionalConflictError,
  AccountPrincipalProvisionalStore,
  AccountPrincipalProvisionalValidationError,
  type AccountPrincipalProvisionalStoreLike,
} from "../../../lib/principal/account-principal-provisional-store";
import {
  isAccountPrincipalProvisional,
  type AccountPrincipalProvisionalDraft,
} from "../../../lib/principal/account-principal-provisional-contracts";

export const runtime = "nodejs";

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function error(code: string, message: string, status: number, details?: Record<string, unknown>): Response {
  return json({ error: { code, message }, ...details }, status);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function queryAccountId(request: Request): string | Response {
  const params = new URL(request.url).searchParams;
  for (const key of params.keys()) if (key !== "accountId") return error("invalid-request", "账户本金查询参数无效", 400);
  const value = params.get("accountId")?.trim();
  return value || TRADINGVIEW_CANONICAL_ACCOUNT_ID;
}

function parseDraft(value: unknown): AccountPrincipalProvisionalDraft | null {
  if (!isRecord(value)) return null;
  const keys = new Set(["accountId", "currency", "amount", "asOf", "status", "source", "expectedRevision"]);
  if (Object.keys(value).some(key => !keys.has(key))) return null;
  if (typeof value.accountId !== "string" || !value.accountId.trim() || typeof value.currency !== "string" || typeof value.amount !== "string" || typeof value.source !== "string" || !value.source.trim() || (value.asOf !== null && typeof value.asOf !== "string") || (value.status !== "provisional" && value.status !== "confirmed") || (value.expectedRevision !== null && (!Number.isInteger(value.expectedRevision) || Number(value.expectedRevision) < 0))) return null;
  return {
    accountId: value.accountId.trim(),
    currency: value.currency as AccountPrincipalProvisionalDraft["currency"],
    amount: value.amount,
    asOf: value.asOf as string | null,
    status: value.status as AccountPrincipalProvisionalDraft["status"],
    source: value.source.trim(),
    expectedRevision: value.expectedRevision as number | null,
  };
}

export function createAccountPrincipalHandlers(store: AccountPrincipalProvisionalStoreLike) {
  return {
    async GET(request: Request): Promise<Response> {
      const accountId = queryAccountId(request);
      if (accountId instanceof Response) return accountId;
      try {
        const record = store.read(accountId);
        if (!record) return error("not-found", "账户暂定本金不存在", 404);
        if (!isAccountPrincipalProvisional(record)) return error("storage-unavailable", "账户暂定本金内容无效", 503);
        return json(record);
      } catch {
        return error("storage-unavailable", "账户暂定本金暂时不可用", 503);
      }
    },
    async PUT(request: Request): Promise<Response> {
      let body: unknown;
      try { body = await request.json(); } catch { return error("invalid-request", "账户暂定本金请求无效", 400); }
      const draft = parseDraft(body);
      if (!draft) return error("invalid-request", "账户暂定本金请求无效", 400);
      try {
        const result = store.save(draft);
        return json(result.record);
      } catch (caught) {
        if (caught instanceof AccountPrincipalProvisionalConflictError) {
          return error("revision-conflict", caught.message, 409, { current: caught.current, currentRecord: caught.current });
        }
        if (caught instanceof AccountPrincipalProvisionalValidationError) return error("invalid-request", caught.message, 400);
        return error("storage-unavailable", "账户暂定本金暂时不可用", 503);
      }
    },
  };
}

function defaultStore(): AccountPrincipalProvisionalStoreLike {
  return new AccountPrincipalProvisionalStore(openSqliteDatabase());
}

export async function GET(request: Request): Promise<Response> {
  try { return await createAccountPrincipalHandlers(defaultStore()).GET(request); }
  catch { return error("storage-unavailable", "账户暂定本金暂时不可用", 503); }
}

export async function PUT(request: Request): Promise<Response> {
  try { return await createAccountPrincipalHandlers(defaultStore()).PUT(request); }
  catch { return error("storage-unavailable", "账户暂定本金暂时不可用", 503); }
}
