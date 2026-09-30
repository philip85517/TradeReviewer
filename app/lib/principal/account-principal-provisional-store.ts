import "server-only";

import Decimal from "decimal.js";
import { DatabaseSync } from "node:sqlite";

import {
  ACCOUNT_PRINCIPAL_PROVISIONAL_HISTORY_SETTINGS_KEY,
  isAccountPrincipalProvisional,
  type AccountPrincipalProvisional,
  type AccountPrincipalProvisionalDraft,
  type AccountPrincipalProvisionalHistoryRecord,
  type AccountPrincipalProvisionalWriteResult,
} from "./account-principal-provisional-contracts";
import type { PrincipalCurrency } from "./principal-model";

const CURRENCIES = new Set<PrincipalCurrency>(["CNY", "USD", "HKD"]);

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

type JsonRow = { value_json?: unknown };

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function validAsOf(value: unknown): value is string | null {
  if (value === null) return true;
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function validRevision(value: unknown): value is number | null {
  return value === null || (Number.isInteger(value) && Number(value) >= 0);
}

function normalizeDraft(value: unknown): AccountPrincipalProvisionalDraft | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  const accountId = stringValue(item.accountId);
  const source = stringValue(item.source);
  if (!accountId || !source || !CURRENCIES.has(item.currency as PrincipalCurrency) || !validAsOf(item.asOf) || !validRevision(item.expectedRevision) || (item.status !== "provisional" && item.status !== "confirmed") || typeof item.amount !== "string") return null;
  try {
    const amount = new Decimal(item.amount);
    if (!amount.isFinite() || !amount.gt(0)) return null;
    return {
      accountId,
      currency: item.currency as PrincipalCurrency,
      amount: amount.toString(),
      asOf: item.asOf === null ? null : new Date(item.asOf as string).toISOString(),
      status: item.status,
      source,
      expectedRevision: item.expectedRevision,
    };
  } catch {
    return null;
  }
}

function fromRow(row: ProvisionalRow): AccountPrincipalProvisional {
  return {
    accountId: row.account_id,
    currency: row.currency as PrincipalCurrency,
    amount: new Decimal(row.amount).toString(),
    asOf: row.as_of,
    status: row.status,
    source: row.source,
    revision: Number(row.revision),
    updatedAt: row.updated_at,
  };
}

function historyFromValue(value: unknown): AccountPrincipalProvisionalHistoryRecord[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error("Invalid provisional principal history");
  return value.map(item => {
    if (!isAccountPrincipalProvisional(item) || !item || typeof item !== "object" || Array.isArray(item) || typeof (item as Record<string, unknown>).recordedAt !== "string" || !Number.isFinite(Date.parse((item as Record<string, unknown>).recordedAt as string))) {
      throw new Error("Invalid provisional principal history");
    }
    return { ...item, recordedAt: (item as Record<string, unknown>).recordedAt as string } satisfies AccountPrincipalProvisionalHistoryRecord;
  });
}

export class AccountPrincipalProvisionalConflictError extends Error {
  readonly code = "revision-conflict" as const;
  constructor(readonly current: AccountPrincipalProvisional | null) {
    super("暂定本金版本已变化，请重新加载当前值后再保存");
    this.name = "AccountPrincipalProvisionalConflictError";
  }
}

export class AccountPrincipalProvisionalValidationError extends Error {
  readonly code = "invalid-provisional" as const;
  constructor(message = "账户暂定本金请求无效") {
    super(message);
    this.name = "AccountPrincipalProvisionalValidationError";
  }
}

/**
 * CAS storage for the existing M1 account_principal_provisionals table.
 * History is kept in app_settings in the same transaction because this slice
 * does not own a schema migration or a second business table.
 */
export class AccountPrincipalProvisionalStore {
  constructor(
    private readonly database: DatabaseSync,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  read(accountId: string): AccountPrincipalProvisional | null {
    const row = this.database.prepare("select account_id, currency, amount, as_of, status, source, revision, updated_at from account_principal_provisionals where account_id = ?").get(accountId) as ProvisionalRow | undefined;
    return row ? fromRow(row) : null;
  }

  history(): AccountPrincipalProvisionalHistoryRecord[] {
    const row = this.database.prepare("select value_json from app_settings where key = ?").get(ACCOUNT_PRINCIPAL_PROVISIONAL_HISTORY_SETTINGS_KEY) as JsonRow | undefined;
    if (!row) return [];
    try { return historyFromValue(typeof row.value_json === "string" ? JSON.parse(row.value_json) : row.value_json); }
    catch (error) { throw error instanceof Error ? error : new Error("Invalid provisional principal history"); }
  }

  save(input: AccountPrincipalProvisionalDraft): AccountPrincipalProvisionalWriteResult {
    const draft = normalizeDraft(input);
    if (!draft) throw new AccountPrincipalProvisionalValidationError();
    const now = this.now();
    if (!Number.isFinite(Date.parse(now))) throw new AccountPrincipalProvisionalValidationError("更新时间无效");

    this.database.exec("begin immediate");
    try {
      const current = this.read(draft.accountId);
      const actualRevision = current?.revision ?? null;
      if (draft.expectedRevision !== actualRevision) throw new AccountPrincipalProvisionalConflictError(current);
      const next: AccountPrincipalProvisional = {
        accountId: draft.accountId,
        currency: draft.currency,
        amount: draft.amount,
        asOf: draft.asOf,
        status: draft.status,
        source: draft.source,
        revision: current ? current.revision + 1 : 0,
        updatedAt: new Date(now).toISOString(),
      };
      this.database.prepare(`
        insert into account_principal_provisionals (account_id, currency, amount, as_of, status, source, revision, updated_at)
        values (?, ?, ?, ?, ?, ?, ?, ?)
        on conflict(account_id) do update set
          currency = excluded.currency,
          amount = excluded.amount,
          as_of = excluded.as_of,
          status = excluded.status,
          source = excluded.source,
          revision = excluded.revision,
          updated_at = excluded.updated_at
      `).run(next.accountId, next.currency, next.amount, next.asOf, next.status, next.source, next.revision, next.updatedAt);

      const previousHistory = this.history();
      const history = current ? [...previousHistory, { ...current, recordedAt: new Date(now).toISOString() }] : previousHistory;
      this.database.prepare(`
        insert into app_settings (key, value_json, updated_at)
        values (?, ?, current_timestamp)
        on conflict(key) do update set value_json = excluded.value_json, updated_at = excluded.updated_at
      `).run(ACCOUNT_PRINCIPAL_PROVISIONAL_HISTORY_SETTINGS_KEY, JSON.stringify(history));
      this.database.exec("commit");
      return { record: next, previous: current, history };
    } catch (error) {
      try { this.database.exec("rollback"); } catch { /* preserve original error */ }
      throw error;
    }
  }
}

export type AccountPrincipalProvisionalStoreLike = Pick<AccountPrincipalProvisionalStore, "read" | "save" | "history">;
