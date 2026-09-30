"use client";

import {
  isAccountPrincipalProvisional,
  type AccountPrincipalProvisional,
  type AccountPrincipalProvisionalDraft,
} from "./account-principal-provisional-contracts";
import { TRADINGVIEW_CANONICAL_ACCOUNT_ID } from "../trades/tradingview-account-identity";

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

export class AccountPrincipalProvisionalError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly current?: AccountPrincipalProvisional | null,
  ) {
    super(message);
    this.name = "AccountPrincipalProvisionalError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function errorFromBody(status: number, body: unknown, expectedAccountId?: string): AccountPrincipalProvisionalError {
  const error = isRecord(body) && isRecord(body.error) ? body.error : {};
  const hasCurrent = isRecord(body) && ("current" in body || "currentRecord" in body);
  const rawCurrent = isRecord(body) ? body.current ?? body.currentRecord : undefined;
  if (status === 409 && expectedAccountId && hasCurrent && rawCurrent !== null && rawCurrent !== undefined) {
    if (!isAccountPrincipalProvisional(rawCurrent) || rawCurrent.accountId !== expectedAccountId) {
      return new AccountPrincipalProvisionalError(status, "invalid-response", "账户暂定本金冲突响应账户不匹配");
    }
    return new AccountPrincipalProvisionalError(
      status,
      typeof error.code === "string" ? error.code : "account-principal-request-failed",
      typeof error.message === "string" ? error.message : `账户暂定本金请求失败（${status}）`,
      rawCurrent,
    );
  }
  const current = isAccountPrincipalProvisional(rawCurrent) ? rawCurrent : undefined;
  return new AccountPrincipalProvisionalError(
    status,
    typeof error.code === "string" ? error.code : "account-principal-request-failed",
    typeof error.message === "string" ? error.message : `账户暂定本金请求失败（${status}）`,
    current,
  );
}

async function readJson(response: Response): Promise<unknown> {
  try { return await response.json(); }
  catch { throw new AccountPrincipalProvisionalError(response.status, "invalid-response", "账户暂定本金响应格式无效"); }
}

function accountUrl(accountId?: string): string {
  return accountId ? `/api/trading-room/account-principal?accountId=${encodeURIComponent(accountId)}` : "/api/trading-room/account-principal";
}

async function parseRecord(response: Response, allowNotFound = false, expectedAccountId?: string): Promise<AccountPrincipalProvisional | undefined> {
  const body = await readJson(response);
  if (!response.ok) {
    if (allowNotFound && response.status === 404 && isRecord(body) && isRecord(body.error) && body.error.code === "not-found") return undefined;
    throw errorFromBody(response.status, body);
  }
  if (!isAccountPrincipalProvisional(body)) throw new AccountPrincipalProvisionalError(response.status, "invalid-response", "账户暂定本金响应格式无效");
  if (expectedAccountId !== undefined && body.accountId !== expectedAccountId) {
    throw new AccountPrincipalProvisionalError(response.status, "invalid-response", "账户暂定本金响应账户不匹配");
  }
  return body;
}

export type AccountPrincipalProvisionalClient = {
  read: (accountId?: string) => Promise<AccountPrincipalProvisional | undefined>;
  save: (draft: AccountPrincipalProvisionalDraft) => Promise<AccountPrincipalProvisional>;
  revise: (draft: AccountPrincipalProvisionalDraft) => Promise<AccountPrincipalProvisional>;
};

export function createAccountPrincipalProvisionalClient(fetcher: Fetcher = fetch): AccountPrincipalProvisionalClient {
  const save = async (draft: AccountPrincipalProvisionalDraft): Promise<AccountPrincipalProvisional> => {
    const response = await fetcher("/api/trading-room/account-principal", {
      method: "PUT",
      cache: "no-store",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(draft),
    });
    const expectedAccountId = draft.accountId.trim();
    if (!response.ok) {
      const body = await readJson(response);
      throw errorFromBody(response.status, body, expectedAccountId);
    }
    const record = await parseRecord(response, false, draft.accountId.trim());
    if (!record) throw new AccountPrincipalProvisionalError(response.status, "invalid-response", "账户暂定本金响应格式无效");
    return record;
  };
  return {
    read: async (accountId) => {
      const expectedAccountId = accountId?.trim() || TRADINGVIEW_CANONICAL_ACCOUNT_ID;
      return parseRecord(await fetcher(accountUrl(accountId?.trim() || undefined), { cache: "no-store", headers: { accept: "application/json" } }), true, expectedAccountId);
    },
    save,
    revise: save,
  };
}
