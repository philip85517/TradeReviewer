"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  normalizeCashBaselineDraft,
  type CashBaselineDraft,
  type CashBaselineRecord,
  type CashBaselineState,
  type CashNature,
} from "../../lib/cash/cash-model";
import styles from "./cash-baseline-panel.module.css";

export type CashBaselinePanelProps = {
  state: CashBaselineState;
  accounts: readonly { id: string; label: string }[];
  nature: CashNature;
  simulationRunId: string | null;
  loading?: boolean;
  saving?: boolean;
  error?: string | null;
  onSave: (draft: CashBaselineDraft) => Promise<boolean>;
};

type Draft = Partial<CashBaselineDraft>;

function emptyDraft(_nature: CashNature, _simulationRunId: string | null, accountId = ""): Draft {
  return {
    accountId,
    currency: "CNY",
    balance: "",
    asOf: "",
  };
}

function inputDateTime(value: string | undefined): string {
  if (!value) return "";
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return "";
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
}

function isoDateTime(value: string): string {
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : value;
}

function scopeMatches(record: CashBaselineRecord, nature: CashNature, simulationRunId: string | null): boolean {
  return record.scope.nature === nature && record.scope.simulationRunId === (nature === "simulation" ? simulationRunId : null);
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
  const [draft, setDraft] = useState<Draft>(() => emptyDraft(nature, simulationRunId, accounts[0]?.id));
  const [draftScopeKey, setDraftScopeKey] = useState(scopeKey);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const currentScopeKey = useRef(scopeKey);
  useEffect(() => {
    currentScopeKey.current = scopeKey;
  }, [scopeKey]);
  const visible = useMemo(
    () => state.records.filter((record) => scopeMatches(record, nature, simulationRunId) && accounts.some((account) => account.id === record.accountId)),
    [accounts, nature, simulationRunId, state.records],
  );
  const scopeChanged = draftScopeKey !== scopeKey;
  const activeDraft = scopeChanged ? emptyDraft(nature, simulationRunId, accounts[0]?.id) : draft;
  const effectiveEditingId = editingId && !scopeChanged && visible.some((record) => record.id === editingId) ? editingId : null;
  const editing = effectiveEditingId ? visible.find((record) => record.id === effectiveEditingId) : undefined;
  const activeMessage = scopeChanged ? null : message;
  const busy = Boolean(loading || saving || submitting);
  const update = (patch: Partial<Draft>) => {
    setDraft((current) => scopeChanged ? { ...activeDraft, ...patch } : { ...current, ...patch });
    setDraftScopeKey(scopeKey);
    setMessage(null);
  };
  const edit = (record: CashBaselineRecord) => {
    setEditingId(record.id);
    setDraft({
      ...record,
      scope: record.scope,
      asOf: inputDateTime(record.asOf),
    });
    setDraftScopeKey(scopeKey);
    setMessage(null);
  };
  const cancel = () => {
    setEditingId(null);
    setDraft(emptyDraft(nature, simulationRunId, accounts[0]?.id));
    setDraftScopeKey(scopeKey);
    setMessage(null);
  };
  const submit = async () => {
    if (busy) return;
    const submitScopeKey = scopeKey;
    const normalized = normalizeCashBaselineDraft({
      ...activeDraft,
      id: effectiveEditingId ?? undefined,
      scope: { nature, simulationRunId },
      asOf: activeDraft.asOf ? isoDateTime(activeDraft.asOf) : "",
    });
    if (!normalized || !accounts.some((account) => account.id === normalized.accountId)) {
      setMessage("请填写账户、有效金额和截至时间");
      return;
    }
    setSubmitting(true);
    try {
      const ok = await onSave(normalized);
      if (ok && currentScopeKey.current === submitScopeKey) {
        setMessage(effectiveEditingId ? "已更新现金基准" : "已保存现金基准");
        setEditingId(null);
        setDraft(emptyDraft(nature, simulationRunId, accounts[0]?.id));
        setDraftScopeKey(submitScopeKey);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className={styles.panel} aria-label="现金基准">
      <header>
        <div>
          <span>{nature === "simulation" ? `模拟运行：${simulationRunId ?? "未选择"}` : "实盘"}</span>
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
          <input
            aria-label="截至时间"
            disabled={busy}
            type="datetime-local"
            value={activeDraft.asOf ?? ""}
            onChange={(event) => update({ asOf: event.target.value })}
            onInput={(event) => update({ asOf: event.currentTarget.value })}
            onBlur={(event) => update({ asOf: event.currentTarget.value })}
          />
        </label>
        <div className={styles.formActions}>
          <button type="button" disabled={busy} onClick={() => void submit()}>{editing ? "保存修改" : "保存现金基准"}</button>
          {editing && <button type="button" disabled={busy} onClick={cancel}>取消编辑</button>}
        </div>
      </div>

      {(activeMessage || error) && <p role={error ? "alert" : "status"}>{error ?? activeMessage}</p>}

      <table>
        <caption>当前范围现金基准</caption>
        <thead><tr><th>账户</th><th>原币</th><th>截至时间</th><th>余额</th><th /></tr></thead>
        <tbody>
          {visible.map((record) => (
            <tr key={record.id}>
              <td>{accounts.find((account) => account.id === record.accountId)?.label ?? record.accountId}</td>
              <td>{record.currency}</td>
              <td>{record.asOf}</td>
              <td>{record.balance}</td>
              <td><button type="button" disabled={busy} onClick={() => edit(record)}>编辑</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      {visible.length === 0 && <p className={styles.empty}>当前范围还没有现金基准记录。</p>}
    </section>
  );
}
