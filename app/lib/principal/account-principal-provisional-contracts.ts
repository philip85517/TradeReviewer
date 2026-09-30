import Decimal from "decimal.js";

import type { PrincipalCurrency } from "./principal-model";

export const ACCOUNT_PRINCIPAL_PROVISIONAL_STATUS = ["provisional", "confirmed"] as const;
export type AccountPrincipalProvisionalStatus = (typeof ACCOUNT_PRINCIPAL_PROVISIONAL_STATUS)[number];

/** Public camelCase projection shared with the frozen M1 provisional GET. */
export type AccountPrincipalProvisional = {
  accountId: string;
  currency: PrincipalCurrency;
  amount: string;
  asOf: string | null;
  status: AccountPrincipalProvisionalStatus;
  source: string;
  revision: number;
  updatedAt: string;
};

export type AccountPrincipalProvisionalDraft = {
  accountId: string;
  currency: PrincipalCurrency;
  amount: string;
  asOf: string | null;
  status: AccountPrincipalProvisionalStatus;
  source: string;
  /** null is required for a create; a number is required for a CAS revision. */
  expectedRevision: number | null;
};

export type AccountPrincipalProvisionalHistoryRecord = AccountPrincipalProvisional & {
  recordedAt: string;
};

export type AccountPrincipalProvisionalWriteResult = {
  record: AccountPrincipalProvisional;
  previous: AccountPrincipalProvisional | null;
  history: AccountPrincipalProvisionalHistoryRecord[];
};

export const ACCOUNT_PRINCIPAL_PROVISIONAL_HISTORY_SETTINGS_KEY = "trading-room.account-principal-provisional-history.v1" as const;

export function isAccountPrincipalProvisional(value: unknown): value is AccountPrincipalProvisional {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  let amount: Decimal;
  try { amount = new Decimal(typeof item.amount === "string" ? item.amount : ""); } catch { return false; }
  return typeof item.accountId === "string" && item.accountId.trim().length > 0
    && (item.currency === "CNY" || item.currency === "USD" || item.currency === "HKD")
    && amount.isFinite() && amount.gt(0)
    && (item.asOf === null || (typeof item.asOf === "string" && Number.isFinite(Date.parse(item.asOf))))
    && (item.status === "provisional" || item.status === "confirmed")
    && typeof item.source === "string" && item.source.trim().length > 0
    && Number.isInteger(item.revision) && Number(item.revision) >= 0
    && typeof item.updatedAt === "string" && item.updatedAt.trim().length > 0;
}
