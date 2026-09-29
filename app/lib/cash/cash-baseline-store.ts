import "server-only";

import { DatabaseSync } from "node:sqlite";

import {
  CASH_SETTINGS_KEY,
  cashBaselineKey,
  normalizeCashBaselineDraft,
  normalizeCashBaselineState,
  parseCashBaselineState,
  type CashBaselineRecord,
  type CashBaselineState,
} from "./cash-model";
import {
  emptyCashBaselineStorageState,
  type CashBaselineFilter,
  type CashBaselineHistoryRecord,
  type CashBaselineMutation,
  type CashBaselineMutationResult,
  type CashBaselineStorageState,
} from "./cash-baseline-contracts";

type SqlRow = { value_json?: unknown };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function revisionValue(value: unknown): number {
  return Number.isInteger(value) && Number(value) >= 0 ? Number(value) : 0;
}

function legacyRecord(record: CashBaselineRecord): CashBaselineRecord {
  return {
    ...record,
    source: stringValue(record.source) ?? "legacy",
    revision: revisionValue(record.revision),
  };
}

function normalizeHistory(value: unknown): CashBaselineHistoryRecord[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new CashBaselineValidationError("现金基准历史内容无效");
  return value.map(item => {
    if (!isRecord(item) || !stringValue(item.source) || !Number.isInteger(item.revision) || Number(item.revision) < 0 || !stringValue(item.recordedAt)) {
      throw new CashBaselineValidationError("现金基准历史内容无效");
    }
    const normalized = parseCashBaselineState({ version: 1, records: [{ ...item, updatedAt: item.recordedAt }] }).records[0];
    if (!normalized || normalized.source === undefined || normalized.revision === undefined) throw new CashBaselineValidationError("现金基准历史内容无效");
    return {
      id: normalized.id,
      accountId: normalized.accountId,
      currency: normalized.currency,
      scope: normalized.scope,
      balance: normalized.balance,
      asOf: normalized.asOf,
      source: normalized.source,
      revision: normalized.revision,
      recordedAt: normalized.updatedAt,
    } satisfies CashBaselineHistoryRecord;
  });
}

/** Parse both the original v1 state and the v1-with-history envelope. */
export function parseCashBaselineStorageState(value: unknown): CashBaselineStorageState {
  const state = parseCashBaselineState(value);
  const records = state.records.map(legacyRecord);
  const history = isRecord(value) ? normalizeHistory(value.history) : [];
  return { version: 1, records, history };
}

export function normalizeCashBaselineStorageState(value: unknown): CashBaselineStorageState {
  const state = normalizeCashBaselineState(value);
  const records = state.records.map(legacyRecord);
  const history = isRecord(value) ? normalizeHistory(value.history) : [];
  return { version: 1, records, history };
}

function filterRecords(state: CashBaselineStorageState, filter: CashBaselineFilter = {}): CashBaselineStorageState {
  const records = state.records.filter(record =>
    (!filter.accountId || record.accountId === filter.accountId) &&
    (!filter.nature || record.scope.nature === filter.nature) &&
    (filter.nature !== "simulation" || filter.simulationRunId === undefined || record.scope.simulationRunId === filter.simulationRunId) &&
    (filter.nature !== "live" || filter.simulationRunId === undefined || record.scope.simulationRunId === null),
  );
  const keys = new Set(records.map(record => `${record.accountId}:${record.currency}:${record.scope.nature}:${record.scope.simulationRunId ?? ""}`));
  return {
    ...state,
    records,
    history: state.history.filter(record => keys.has(`${record.accountId}:${record.currency}:${record.scope.nature}:${record.scope.simulationRunId ?? ""}`)),
  };
}

function publicState(state: CashBaselineStorageState): CashBaselineStorageState {
  return {
    version: 1,
    records: state.records.map(legacyRecord),
    history: [...state.history],
  };
}

export class CashBaselineRevisionConflictError extends Error {
  readonly code = "revision-conflict" as const;
  constructor(readonly current: CashBaselineRecord | null) {
    super("现金基准版本已变化，请重新加载当前值后再保存");
    this.name = "CashBaselineRevisionConflictError";
  }
}

export class CashBaselineValidationError extends Error {
  readonly code = "invalid-baseline" as const;
  constructor(message = "现金基准请求无效") {
    super(message);
    this.name = "CashBaselineValidationError";
  }
}

export type CashBaselineStoreReader = {
  read(filter?: CashBaselineFilter): CashBaselineStorageState;
};

/**
 * SQLite-backed CAS store for the cash baseline settings row.
 *
 * No DDL is owned here: app_settings is part of the existing schema.  A
 * revision writes the new current records and appends the previous record to
 * the same JSON value inside one BEGIN IMMEDIATE transaction.
 */
export class CashBaselineStore implements CashBaselineStoreReader {
  constructor(
    private readonly database: DatabaseSync,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  read(filter: CashBaselineFilter = {}): CashBaselineStorageState {
    const row = this.database.prepare("select value_json from app_settings where key = ?").get(CASH_SETTINGS_KEY) as SqlRow | undefined;
    if (!row) return emptyCashBaselineStorageState();
    let value: unknown;
    try {
      value = typeof row.value_json === "string" ? JSON.parse(row.value_json) : row.value_json;
    } catch {
      throw new CashBaselineValidationError("现金基准存储内容无效");
    }
    return filterRecords(parseCashBaselineStorageState(value), filter);
  }

  getState(): CashBaselineStorageState {
    return this.read();
  }

  save(input: CashBaselineMutation): CashBaselineMutationResult {
    const draft = normalizeCashBaselineDraft(input);
    if (!draft || !draft.source || draft.expectedRevision === undefined || !Number.isInteger(draft.expectedRevision) && draft.expectedRevision !== null) {
      throw new CashBaselineValidationError("账户、原币、金额、时点、来源或版本无效");
    }
    const source = draft.source.trim();
    const now = this.now();
    if (!source || !Number.isFinite(Date.parse(now))) throw new CashBaselineValidationError();

    this.database.exec("begin immediate");
    try {
      const row = this.database.prepare("select value_json from app_settings where key = ?").get(CASH_SETTINGS_KEY) as SqlRow | undefined;
      let raw: unknown = undefined;
      if (row) {
        try { raw = typeof row.value_json === "string" ? JSON.parse(row.value_json) : row.value_json; }
        catch { throw new CashBaselineValidationError("现金基准存储内容无效"); }
      }
      const currentState = raw === undefined ? emptyCashBaselineStorageState() : parseCashBaselineStorageState(raw);
      const normalized = {
        ...draft,
        source,
        expectedRevision: draft.expectedRevision,
      };
      const key = cashBaselineKey(normalized);
      const byKey = currentState.records.findIndex(record => cashBaselineKey(record) === key);
      const byId = normalized.id ? currentState.records.findIndex(record => record.id === normalized.id) : -1;
      // An explicit id is an identity assertion as well as an update hint.  Do
      // not let an id match one record while the business key matches another
      // (or no record): that would migrate the existing record and hide its
      // audit history under the old key.
      if (normalized.id && ((byId >= 0 && byKey !== byId) || (byId < 0 && byKey >= 0))) {
        throw new CashBaselineValidationError("现金基准身份或范围冲突");
      }
      const index = byKey >= 0 ? byKey : byId;
      const previous = index >= 0 ? legacyRecord(currentState.records[index]) : null;
      const actualRevision = previous?.revision ?? null;
      if (normalized.expectedRevision !== actualRevision) {
        throw new CashBaselineRevisionConflictError(previous);
      }
      const record: CashBaselineRecord = {
        id: previous?.id ?? normalized.id ?? `cash:${key}`,
        scope: normalized.scope,
        accountId: normalized.accountId,
        currency: normalized.currency,
        balance: normalized.balance,
        asOf: normalized.asOf,
        updatedAt: new Date(now).toISOString(),
        source,
        revision: previous ? (previous.revision ?? 0) + 1 : 0,
      };
      if (normalized.id && byId < 0 && byKey < 0 && currentState.records.some(item => item.id === normalized.id)) {
        throw new CashBaselineValidationError("现金基准 id 已存在");
      }
      const records = [...currentState.records];
      if (index >= 0) records[index] = record;
      else records.push(record);
      const history = previous ? [...currentState.history, {
        id: previous.id,
        accountId: previous.accountId,
        currency: previous.currency,
        scope: previous.scope,
        balance: previous.balance,
        asOf: previous.asOf,
        source: previous.source ?? "legacy",
        revision: previous.revision ?? 0,
        recordedAt: new Date(now).toISOString(),
      } satisfies CashBaselineHistoryRecord] : [...currentState.history];
      const next: CashBaselineStorageState = { version: 1, records, history };
      this.database.prepare(`
        insert into app_settings (key, value_json, updated_at)
        values (?, ?, current_timestamp)
        on conflict(key) do update set value_json = excluded.value_json, updated_at = excluded.updated_at
      `).run(CASH_SETTINGS_KEY, JSON.stringify(next));
      this.database.exec("commit");
      return { state: publicState(next), record, previous };
    } catch (error) {
      try { this.database.exec("rollback"); } catch { /* preserve original error */ }
      throw error;
    }
  }

  mutate(input: CashBaselineMutation): CashBaselineMutationResult {
    return this.save(input);
  }
}

/** Narrow adapter useful for route consumers and tests. */
export type CashBaselineStoreLike = Pick<CashBaselineStore, "read" | "save">;

export function filterCashBaselineState(state: CashBaselineStorageState, filter: CashBaselineFilter): CashBaselineStorageState {
  return filterRecords(state, filter);
}
