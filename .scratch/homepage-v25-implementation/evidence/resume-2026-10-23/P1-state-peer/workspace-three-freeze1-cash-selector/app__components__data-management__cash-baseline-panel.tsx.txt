"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { CashClientError } from "../../lib/cash/cash-client";
import {
  cashBaselineKey,
  normalizeCashBaselineDraft,
  normalizeCashBaselineState,
  type CashBaselineDraft,
  type CashBaselineRecord,
  type CashBaselineState,
  type CashNature,
} from "../../lib/cash/cash-model";
import type {
  CashBaselineHistoryRecord,
  CashBaselineMutation,
  CashBaselineMutationResult,
  CashBaselineStorageState,
} from "../../lib/cash/cash-baseline-contracts";
import styles from "./cash-baseline-panel.module.css";

type PanelState = CashBaselineState | CashBaselineStorageState;
type SaveResult = boolean | void | CashBaselineMutationResult | CashBaselineStorageState | CashBaselineState | CashBaselineRecord;

export type CashBaselinePanelProps = {
  state: PanelState;
  accounts: readonly { id: string; label: string }[];
  nature: CashNature;
  simulationRunId: string | null;
  loading?: boolean;
  saving?: boolean;
  error?: string | null;
  /** Accepts the legacy boolean consumer and the typed CAS consumer. */
  onSave: (draft: CashBaselineMutation) => Promise<SaveResult>;
};

type Draft = Partial<CashBaselineDraft> & {
  source?: string;
  expectedRevision?: number | null;
};

type ConflictState = {
  record: CashBaselineRecord;
  scopeKey: string;
  generation: number;
};

function emptyDraft(accountId = ""): Draft {
  return {
    accountId,
    currency: "CNY",
    balance: "",
    asOf: "",
    source: "",
    expectedRevision: null,
  };
}

function inputDateTime(value: string | undefined): string {
  if (!value) return "";
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return "";
  const pad = (part: number) => String(part).padStart(2, "0");
  const milliseconds = parsed.getMilliseconds();
  const fraction = milliseconds > 0 ? `.${String(milliseconds).padStart(3, "0")}` : "";
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}:${pad(parsed.getSeconds())}${fraction}`;
}

function isoDateTime(value: string): string {
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : value;
}

function scopeMatches(record: CashBaselineRecord, nature: CashNature, simulationRunId: string | null): boolean {
  return record.scope.nature === nature && record.scope.simulationRunId === (nature === "simulation" ? simulationRunId : null);
}

function recordToDraft(record: CashBaselineRecord): Draft {
  return {
    ...record,
    asOf: inputDateTime(record.asOf),
    source: record.source ?? "legacy",
    expectedRevision: record.revision ?? 0,
  };
}

function historyFor(state: PanelState): readonly CashBaselineHistoryRecord[] {
  return "history" in state ? state.history : [];
}

function conflictRecord(error: unknown): CashBaselineRecord | null {
  if (!(error instanceof CashClientError) || error.status !== 409) return null;
  const current = error.current;
  if (current === null || current === undefined) return null;
  const parsed = normalizeCashBaselineState({ version: 1, records: [current] });
  return parsed.records.length === 1 ? parsed.records[0] : null;
}

function errorText(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return "现金基准保存失败，请稍后重试";
}

function isSaveSuccess(result: SaveResult): boolean {
  return result !== false;
}

export function CashBaselinePanel({
  state,
  accounts,
  nature,
  simulationRunId,
  loading,
  saving,
  error,
  onSave,
}: CashBaselinePanelProps) {
  const scopeKey = `${nature}:${simulationRunId ?? ""}:${accounts.map((account) => account.id).join("|")}`;
  const [draft, setDraft] = useState<Draft>(() => emptyDraft(accounts[0]?.id));
  const [draftScopeKey, setDraftScopeKey] = useState(scopeKey);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<ConflictState | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const currentScopeKey = useRef(scopeKey);
  const knownScopeKey = useRef(scopeKey);
  const scopeGeneration = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      scopeGeneration.current += 1;
    };
  }, []);

  useEffect(() => {
    const changed = knownScopeKey.current !== scopeKey;
    knownScopeKey.current = scopeKey;
    currentScopeKey.current = scopeKey;
    if (!changed) return;

    scopeGeneration.current += 1;
    setDraft(emptyDraft(accounts[0]?.id));
    setDraftScopeKey(scopeKey);
    setEditingId(null);
    setMessage(null);
    setSubmitError(null);
    setConflict(null);
    setSubmitting(false);
  }, [accounts, scopeKey]);

  const visible = useMemo(
    () => state.records.filter((record) => scopeMatches(record, nature, simulationRunId) && accounts.some((account) => account.id === record.accountId)),
    [accounts, nature, simulationRunId, state.records],
  );
  const visibleKeys = useMemo(() => new Set(visible.map(cashBaselineKey)), [visible]);
  const history = useMemo(
    () => historyFor(state).filter((record) => visibleKeys.has(cashBaselineKey(record))),
    [state, visibleKeys],
  );
  const scopeChanged = draftScopeKey !== scopeKey;
  const activeDraft = scopeChanged ? emptyDraft(accounts[0]?.id) : draft;
  const effectiveEditingId = editingId && !scopeChanged && visible.some((record) => record.id === editingId) ? editingId : null;
  const editing = effectiveEditingId ? visible.find((record) => record.id === effectiveEditingId) : undefined;
  const activeMessage = scopeChanged ? null : message;
  const activeError = scopeChanged ? null : submitError ?? error;
  const busy = Boolean(loading || saving || submitting);
  const activeConflict = conflict
    && conflict.scopeKey === scopeKey
    && knownScopeKey.current === scopeKey
    && conflict.generation === scopeGeneration.current
    ? conflict.record
    : null;

  const update = (patch: Partial<Draft>) => {
    setDraft((current) => scopeChanged ? { ...activeDraft, ...patch } : { ...current, ...patch });
    setDraftScopeKey(scopeKey);
    setMessage(null);
    setSubmitError(null);
    setConflict(null);
  };

  const edit = (record: CashBaselineRecord) => {
    setEditingId(record.id);
    setDraft(recordToDraft(record));
    setDraftScopeKey(scopeKey);
    setMessage(null);
    setSubmitError(null);
    setConflict(null);
  };

  const cancel = () => {
    setEditingId(null);
    setDraft(emptyDraft(accounts[0]?.id));
    setDraftScopeKey(scopeKey);
    setMessage(null);
    setSubmitError(null);
    setConflict(null);
  };

  const reloadConflict = () => {
    if (!conflict || conflict.scopeKey !== scopeKey || knownScopeKey.current !== scopeKey || conflict.generation !== scopeGeneration.current) return;
    setEditingId(conflict.record.id);
    setDraft(recordToDraft(conflict.record));
    setDraftScopeKey(scopeKey);
    setConflict(null);
    setSubmitError(null);
    setMessage("已载入服务器当前值，请核对后再保存");
  };

  const submit = async () => {
    if (busy) return;
    const submitScopeKey = scopeKey;
    const submitGeneration = scopeGeneration.current;
    const source = activeDraft.source?.trim() ?? "";
    // Capture the revision when the user entered edit mode.  A refreshed
    // `state` prop may contain a newer record while this draft is still open;
    // saving against that newer revision would silently overwrite the change.
    const expectedRevision = effectiveEditingId === null
      ? null
      : (activeDraft.expectedRevision === undefined ? (editing?.revision ?? 0) : activeDraft.expectedRevision);
    const candidate = {
      ...activeDraft,
      id: effectiveEditingId ?? undefined,
      scope: { nature, simulationRunId },
      source,
      expectedRevision,
      asOf: activeDraft.asOf ? isoDateTime(activeDraft.asOf) : "",
    };
    const normalized = normalizeCashBaselineDraft(candidate);
    if (!normalized || !normalized.source || normalized.expectedRevision === undefined || !accounts.some((account) => account.id === normalized.accountId)) {
      setSubmitError("请填写账户、有效金额和截至时间；来源也必须提供");
      setMessage(null);
      return;
    }
    const mutation: CashBaselineMutation = {
      ...(normalized.id ? { id: normalized.id } : {}),
      scope: normalized.scope,
      accountId: normalized.accountId,
      currency: normalized.currency,
      balance: normalized.balance,
      asOf: normalized.asOf,
      source: normalized.source,
      expectedRevision: normalized.expectedRevision,
    };
    setSubmitting(true);
    setSubmitError(null);
    setConflict(null);
    try {
      const result = await onSave(mutation);
      const requestIsCurrent = mounted.current
        && currentScopeKey.current === submitScopeKey
        && scopeGeneration.current === submitGeneration;
      if (isSaveSuccess(result) && requestIsCurrent) {
        setMessage(effectiveEditingId ? "已更新现金基准" : "已保存现金基准");
        setEditingId(null);
        setDraft(emptyDraft(accounts[0]?.id));
        setDraftScopeKey(submitScopeKey);
      }
    } catch (reason) {
      const requestIsCurrent = mounted.current
        && currentScopeKey.current === submitScopeKey
        && scopeGeneration.current === submitGeneration;
      if (!requestIsCurrent) return;
      setSubmitError(errorText(reason));
      const current = conflictRecord(reason);
      setConflict(current ? { record: current, scopeKey: submitScopeKey, generation: submitGeneration } : null);
    } finally {
      const requestIsCurrent = mounted.current
        && currentScopeKey.current === submitScopeKey
        && scopeGeneration.current === submitGeneration;
      if (requestIsCurrent) setSubmitting(false);
    }
  };

  return (
    <section className={styles.panel} aria-label="现金基准">
      <header>
        <div>
          <span>{nature === "simulation" ? `模拟运行：${simulationRunId ?? "全部来源（run-null）"}` : "实盘"}</span>
          <h2>现金基准</h2>
          <p>按账户、原币和截至时间修正真实现金余额；后续只叠加成交变化，不等于参考分配资本。</p>
        </div>
        {loading && <span>正在读取</span>}
      </header>

      <div className={styles.form} role="group" aria-label={editing ? "编辑现金基准" : "新增现金基准"}>
        <label>账户
          <select disabled={busy || Boolean(editing)} value={activeDraft.accountId ?? ""} onChange={(event) => update({ accountId: event.target.value })}>
            <option value="">请选择账户</option>
            {accounts.map((account) => <option key={account.id} value={account.id}>{account.label}</option>)}
          </select>
        </label>
        <label>原币
          <select disabled={busy || Boolean(editing)} value={activeDraft.currency ?? "CNY"} onChange={(event) => update({ currency: event.target.value as CashBaselineDraft["currency"] })}>
            <option value="CNY">CNY</option>
            <option value="USD">USD</option>
            <option value="HKD">HKD</option>
          </select>
        </label>
        <label>余额
          <input aria-label="余额" disabled={busy} type="number" step="any" inputMode="decimal" value={activeDraft.balance ?? ""} onChange={(event) => update({ balance: event.target.value })} />
        </label>
        <label>截至时间
          <input aria-label="截至时间" disabled={busy} step="0.001" type="datetime-local" value={activeDraft.asOf ?? ""} onChange={(event) => update({ asOf: event.target.value })} onInput={(event) => update({ asOf: event.currentTarget.value })} onBlur={(event) => update({ asOf: event.currentTarget.value })} />
        </label>
        <label>来源
          <input aria-label="来源" disabled={busy} type="text" value={activeDraft.source ?? ""} onChange={(event) => update({ source: event.target.value })} />
        </label>
        <div className={styles.formActions}>
          {editing && <span className={styles.revision}>当前版本 {activeDraft.expectedRevision ?? 0}</span>}
          <button type="button" disabled={busy} onClick={() => void submit()}>{editing ? "保存修改" : "保存现金基准"}</button>
          <button type="button" disabled={busy} onClick={cancel}>{editing ? "取消编辑" : "重置草稿"}</button>
        </div>
      </div>

      {activeConflict && (
        <div className={styles.conflict} role="alert">
          <strong>服务器当前值已变化，已保留你的草稿</strong>
          {submitError && <span>{submitError}</span>}
          <span>服务器当前值：{activeConflict.currency} {activeConflict.balance} · 截至 {activeConflict.asOf} · 来源 {activeConflict.source ?? "legacy"} · 版本 {activeConflict.revision ?? 0}</span>
          <button type="button" disabled={busy} onClick={reloadConflict}>重新载入当前值</button>
        </div>
      )}
      {activeMessage && !activeConflict && <p role="status">{activeMessage}</p>}
      {activeError && !activeConflict && <p role="alert">{activeError}</p>}

      <table>
        <caption>当前范围现金基准</caption>
        <thead><tr><th>账户</th><th>原币</th><th>截至时间</th><th>余额</th><th>来源</th><th>版本</th><th /></tr></thead>
        <tbody>
          {visible.map((record) => (
            <tr key={record.id}>
              <td>{accounts.find((account) => account.id === record.accountId)?.label ?? record.accountId}</td>
              <td>{record.currency}</td>
              <td>{record.asOf}</td>
              <td>{record.balance}</td>
              <td>{record.source ?? "legacy"}</td>
              <td>{record.revision ?? 0}</td>
              <td><button type="button" disabled={busy} onClick={() => edit(record)}>编辑</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      {visible.length === 0 && <p className={styles.empty}>当前范围还没有现金基准记录。</p>}
      {history.length > 0 && (
        <details className={styles.history} role="group" aria-label="现金基准修订历史">
          <summary>查看历史（{history.length} 条旧版本）</summary>
          <ul>
            {history.map((record, index) => <li key={`${record.id}:${record.revision}:${index}`}>
              <strong>{record.currency} {record.balance}</strong>
              <span>截至 {record.asOf} · 来源 {record.source} · 版本 {record.revision} · 记录于 {record.recordedAt}</span>
            </li>)}
          </ul>
        </details>
      )}
    </section>
  );
}
