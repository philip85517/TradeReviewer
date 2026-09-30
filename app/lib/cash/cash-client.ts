"use client";

import Decimal from "decimal.js";

import {
  cashBaselineKey,
  normalizeCashBaselineDraft,
  normalizeCashBaselineState,
  type BuildCashSummaryInput,
  type CashBaselineDraft,
  type CashBaselineState,
  type CashScope,
  type CashSummary,
} from "./cash-model";
import type {
  CashBaselineFilter,
  CashBaselineStorageState,
} from "./cash-baseline-contracts";
import { TRADINGVIEW_CANONICAL_ACCOUNT_ID } from "../trades/tradingview-account-identity";

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

export class CashClientError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly current?: unknown,
  ) {
    super(message);
    this.name = "CashClientError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function errorFromBody(status: number, body: unknown, expectedKey?: string): CashClientError {
  const error = isRecord(body) && isRecord(body.error) ? body.error : {};
  const hasCurrent = isRecord(body) && ("current" in body || "currentRecord" in body);
  const rawCurrent = isRecord(body) ? body.current ?? body.currentRecord : undefined;
  if (status === 409 && expectedKey && hasCurrent && rawCurrent !== null && rawCurrent !== undefined) {
    const current = parseCurrent(rawCurrent);
    if (!current || cashBaselineKey(current) !== expectedKey) {
      return new CashClientError(status, "invalid-response", "现金冲突响应范围不匹配");
    }
    return new CashClientError(
      status,
      typeof error.code === "string" ? error.code : "cash-request-failed",
      typeof error.message === "string" ? error.message : `现金请求失败（${status}）`,
      current,
    );
  }
  return new CashClientError(
    status,
    typeof error.code === "string" ? error.code : "cash-request-failed",
    typeof error.message === "string" ? error.message : `现金请求失败（${status}）`,
    rawCurrent,
  );
}

function finiteAmount(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try { return new Decimal(value).isFinite(); } catch { return false; }
}

function validInstant(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value));
}

function isMoneyView(value: unknown): boolean {
  if (!isRecord(value) || value.baseCurrency !== "CNY" || !isRecord(value.originalByCurrency) ||
      !(["same-currency", "complete", "partial", "missing"] as readonly unknown[]).includes(value.conversion) ||
      (value.fxSnapshotId !== null && typeof value.fxSnapshotId !== "string") || typeof value.note !== "string") return false;
  if (Object.values(value.originalByCurrency).some(amount => !finiteAmount(amount))) return false;
  return (value.convertedCny === null || finiteAmount(value.convertedCny)) &&
    (value.converted === undefined || value.converted === null || finiteAmount(value.converted)) &&
    (value.convertedHkd === undefined || value.convertedHkd === null || finiteAmount(value.convertedHkd));
}

function isCashSummary(value: unknown): value is CashSummary {
  if (!isRecord(value) || !isMoneyView(value.cashTotal) || !isMoneyView(value.todayProceeds) || !isRecord(value.coverage) || !isRecord(value.byScope)) return false;
  const coverage = value.coverage;
  const byScopeValid = Object.values(value.byScope).every(item => isRecord(item) && typeof item.currency === "string" && finiteAmount(item.amount) &&
    (["available", "zero", "partial", "unavailable"] as readonly unknown[]).includes(item.status));
  return (value.todayProceedsStatus === "available" || value.todayProceedsStatus === "zero" || value.todayProceedsStatus === "partial" || value.todayProceedsStatus === "unavailable")
    && (value.cashTotalStatus === "available" || value.cashTotalStatus === "partial" || value.cashTotalStatus === "unavailable")
    && Number.isInteger(coverage.included) && Number(coverage.included) >= 0
    && Number.isInteger(coverage.excluded) && Number(coverage.excluded) >= 0
    && Number.isInteger(coverage.missing) && Number(coverage.missing) >= 0
    && Array.isArray(value.missingReasons) && value.missingReasons.every(reason => typeof reason === "string")
    && byScopeValid
    && (value.asOf === null || validInstant(value.asOf))
    && (value.updatedAt === null || validInstant(value.updatedAt));
}

function isAuditedCashRecord(value: unknown): boolean {
  if (!isRecord(value) || typeof value.source !== "string" || !value.source.trim() || !Number.isInteger(value.revision) || Number(value.revision) < 0) return false;
  try {
    const normalized = normalizeCashBaselineState({ version: 1, records: [value] });
    return normalized.records.length === 1;
  } catch { return false; }
}

function parseCurrent(value: unknown): CashBaselineState["records"][number] | null {
  if (!isAuditedCashRecord(value)) return null;
  try {
    const normalized = normalizeCashBaselineState({ version: 1, records: [value] });
    return normalized.records.length === 1 ? normalized.records[0] : null;
  } catch {
    return null;
  }
}

function isHistoryRecord(value: unknown): boolean {
  if (!isRecord(value) || typeof value.recordedAt !== "string" || !validInstant(value.recordedAt)) return false;
  return isAuditedCashRecord({ ...value, updatedAt: value.recordedAt });
}

function isStorageState(value: unknown): value is CashBaselineStorageState {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.records) || !Array.isArray(value.history)) return false;
  try {
    const normalized = normalizeCashBaselineState(value);
    return normalized.records.length === value.records.length && value.records.every(isAuditedCashRecord) && value.history.every(isHistoryRecord);
  } catch {
    return false;
  }
}

function isLegacyState(value: unknown): value is CashBaselineState {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.records) || "history" in value) return false;
  try {
    const normalized = normalizeCashBaselineState(value);
    return normalized.records.length === value.records.length;
  } catch {
    return false;
  }
}

async function readBody(response: Response): Promise<unknown> {
  try { return await response.json(); }
  catch { throw new CashClientError(response.status, "invalid-response", "现金响应格式无效"); }
}

function queryFor(scope: CashScope, options: { accountIds?: readonly string[]; targetCurrency?: string; today?: string } = {}): string {
  const params = new URLSearchParams({ nature: scope.nature });
  if (scope.simulationRunId !== null) params.set("simulationRunId", scope.simulationRunId);
  for (const accountId of options.accountIds ?? []) if (accountId.trim()) params.append("accountId", accountId.trim());
  if (options.targetCurrency) params.set("targetCurrency", options.targetCurrency);
  if (options.today) params.set("today", options.today);
  return params.toString();
}

function baselineQuery(filter: CashBaselineFilter = {}): string {
  const params = new URLSearchParams();
  const accountId = filter.accountId ?? (filter.nature === "simulation" && filter.simulationRunId === null ? TRADINGVIEW_CANONICAL_ACCOUNT_ID : undefined);
  if (accountId) params.set("accountId", accountId);
  if (filter.nature) params.set("nature", filter.nature);
  if (filter.simulationRunId !== undefined && filter.simulationRunId !== null) params.set("simulationRunId", filter.simulationRunId);
  return params.toString();
}

function validateBaselineResponse(body: unknown, expectedKey?: string, filter?: CashBaselineFilter, status = 200): CashBaselineStorageState | CashBaselineState {
  if (!isStorageState(body) && !isLegacyState(body)) throw new CashClientError(status, "invalid-response", "现金基准响应格式无效");
  const records = (body as CashBaselineStorageState | CashBaselineState).records;
  if (expectedKey && !records.some(record => cashBaselineKey(record) === expectedKey)) throw new CashClientError(status, "invalid-response", "现金基准响应范围不匹配");
  if (filter) {
    const expectedAccountId = filter.accountId ?? (filter.nature === "simulation" && filter.simulationRunId === null ? TRADINGVIEW_CANONICAL_ACCOUNT_ID : undefined);
    if (records.some(record =>
      (expectedAccountId !== undefined && record.accountId !== expectedAccountId) ||
      (filter.nature !== undefined && record.scope.nature !== filter.nature) ||
      (filter.nature === "simulation" && filter.simulationRunId !== undefined && record.scope.simulationRunId !== filter.simulationRunId) ||
      (filter.nature === "live" && record.scope.simulationRunId !== null)
    )) throw new CashClientError(status, "invalid-response", "现金基准响应范围不匹配");
  }
  return body as CashBaselineStorageState | CashBaselineState;
}

export type CashClient = {
  readSummary: (scope: CashScope, options?: { accountIds?: readonly string[]; targetCurrency?: "CNY" | "HKD"; today?: string }) => Promise<CashSummary>;
  readBaselines: (filter?: CashBaselineFilter) => Promise<CashBaselineStorageState | CashBaselineState>;
  saveBaseline: (draft: CashBaselineDraft & { source: string; expectedRevision: number | null }) => Promise<CashBaselineStorageState | CashBaselineState>;
};

export function createCashClient(fetcher: Fetcher = fetch): CashClient {
  return {
    async readSummary(scope, options) {
      const response = await fetcher(`/api/trading-room/cash?${queryFor(scope, options)}`, { cache: "no-store", headers: { accept: "application/json" } });
      const body = await readBody(response);
      if (!response.ok) throw errorFromBody(response.status, body);
      if (!isCashSummary(body)) throw new CashClientError(response.status, "invalid-response", "现金摘要响应格式无效");
      return body;
    },
    async readBaselines(filter) {
      const suffix = baselineQuery(filter);
      const response = await fetcher(`/api/trading-room/cash/baselines${suffix ? `?${suffix}` : ""}`, { cache: "no-store", headers: { accept: "application/json" } });
      const body = await readBody(response);
      if (!response.ok) throw errorFromBody(response.status, body);
      return validateBaselineResponse(body, undefined, filter, response.status);
    },
    async saveBaseline(draft) {
      const normalized = normalizeCashBaselineDraft(draft);
      if (!normalized || normalized.source !== draft.source || normalized.expectedRevision !== draft.expectedRevision) {
        throw new CashClientError(400, "invalid-request", "现金基准请求无效");
      }
      const response = await fetcher("/api/trading-room/cash/baselines", {
        method: "PUT",
        cache: "no-store",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(draft),
      });
      const body = await readBody(response);
      const expected = cashBaselineKey(normalized);
      if (!response.ok) throw errorFromBody(response.status, body, expected);
      return validateBaselineResponse(body, expected, undefined, response.status);
    },
  };
}

/** Alias used by the S5 panel owner while keeping one transport contract. */
export const createCashBaselineClient = createCashClient;

export type CashReadOptions = Parameters<CashClient["readSummary"]>[1];
export type CashSummaryRequest = BuildCashSummaryInput;
