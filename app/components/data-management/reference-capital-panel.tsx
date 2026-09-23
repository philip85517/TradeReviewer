"use client";

import { useMemo, useState } from "react";
import { normalizeReferenceCapitalDraft, type ReferenceCapitalDraft, type ReferenceCapitalRecord, type ReferenceCapitalState } from "../../lib/principal/reference-capital-model";
import type { PrincipalConfig } from "../../lib/principal/principal-model";
import styles from "./reference-capital-panel.module.css";

export type ReferenceCapitalPanelProps = { state: ReferenceCapitalState; legacyConfig?: PrincipalConfig; accounts: readonly { id: string; label: string }[]; nature: "live" | "simulation"; simulationRunId: string | null; loading?: boolean; saving?: boolean; error?: string | null; onSave: (draft: ReferenceCapitalDraft) => Promise<boolean>; onRemove: (id: string) => Promise<boolean> };

function emptyDraft(nature: ReferenceCapitalPanelProps["nature"], simulationRunId: string | null, accountId = ""): Partial<ReferenceCapitalDraft> { return { nature, simulationRunId, accountId, currency: "CNY", fromDate: "", toDate: "", amount: "" }; }

export function ReferenceCapitalPanel({ state, legacyConfig = {}, accounts, nature, simulationRunId, loading, saving, error, onSave, onRemove }: ReferenceCapitalPanelProps) {
  const scopeKey = `${nature}:${simulationRunId ?? ""}:${accounts.map(account => account.id).join("|")}`;
  const [draft, setDraft] = useState<Partial<ReferenceCapitalDraft>>(() => emptyDraft(nature, simulationRunId, accounts[0]?.id));
  const [draftScopeKey, setDraftScopeKey] = useState(scopeKey);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const scopeChanged = draftScopeKey !== scopeKey;
  const activeDraft = scopeChanged ? emptyDraft(nature, simulationRunId, accounts[0]?.id) : draft;
  const visible = useMemo(() => state.records.filter(record => record.nature === nature && record.simulationRunId === (nature === "simulation" ? simulationRunId : null) && accounts.some(account => account.id === record.accountId)), [accounts, nature, simulationRunId, state.records]);
  const effectiveEditingId = editingId && visible.some(record => record.id === editingId) && !scopeChanged ? editingId : null;
  const setField = (patch: Partial<ReferenceCapitalDraft>) => { setDraft(current => scopeChanged ? { ...activeDraft, ...patch } : { ...current, ...patch }); setDraftScopeKey(scopeKey); setMessage(null); };
  const cancelEdit = () => { setEditingId(null); setDraft(emptyDraft(nature, simulationRunId, accounts[0]?.id)); setDraftScopeKey(scopeKey); setMessage(null); };
  const busy = Boolean(saving || loading || submitting);
  const submit = async () => { if (busy) return; if (!activeDraft.accountId || !accounts.some(account => account.id === activeDraft.accountId)) { setMessage("请选择当前范围内的账户"); return; } const normalized = normalizeReferenceCapitalDraft({ ...activeDraft, id: effectiveEditingId ?? undefined, nature, simulationRunId }); if (!normalized) { setMessage("请填写账户、有效日期和正数金额"); return; } setSubmitting(true); try { const ok = await onSave(normalized); if (ok) { setMessage(effectiveEditingId ? "已更新参考分配资本" : "已保存参考分配资本"); setEditingId(null); setDraft(emptyDraft(nature, simulationRunId, accounts[0]?.id)); setDraftScopeKey(scopeKey); } } finally { setSubmitting(false); } };
  const edit = (record: ReferenceCapitalRecord) => { setEditingId(record.id); setDraft({ ...record }); setDraftScopeKey(scopeKey); setMessage(null); };
  return <section className={styles.panel} aria-label="参考分配资本 v2">
    <header><div><span>Reference capital v2</span><h2>参考分配资本</h2><p>按账户、币种和适用期间记录，仅用于参考收益；不代表账户净值。</p></div>{loading && <span>正在读取</span>}</header>
    <div className={styles.form} role="group" aria-label={effectiveEditingId ? "编辑参考资本配置" : "新增参考资本配置"}>
      <label>账户<select disabled={busy} value={activeDraft.accountId ?? ""} onChange={e => setField({ accountId: e.target.value })}><option value="">请选择账户</option>{accounts.map(account => <option key={account.id} value={account.id}>{account.label}</option>)}</select></label>
      <label>币种<select disabled={busy} value={activeDraft.currency ?? "CNY"} onChange={e => setField({ currency: e.target.value as ReferenceCapitalDraft["currency"] })}><option>CNY</option><option>USD</option><option>HKD</option></select></label>
      <label>起始日期<input disabled={busy} type="date" value={activeDraft.fromDate ?? ""} onChange={e => setField({ fromDate: e.target.value })}/></label>
      <label>结束日期<input disabled={busy} type="date" value={activeDraft.toDate ?? ""} onChange={e => setField({ toDate: e.target.value })}/></label>
      <label>金额<input disabled={busy} inputMode="decimal" value={activeDraft.amount ?? ""} onChange={e => setField({ amount: e.target.value })}/></label>
      <div className={styles.formActions}><button type="button" disabled={busy} onClick={() => void submit()}>{effectiveEditingId ? "保存修改" : "保存参考资本"}</button>{effectiveEditingId && <button type="button" disabled={busy} onClick={cancelEdit}>取消编辑</button>}</div>
    </div>
    {(message || error) && <p role={error ? "alert" : "status"}>{error ?? message}</p>}
    <table><caption>当前账本期间配置</caption><thead><tr><th>账户</th><th>币种</th><th>期间</th><th>金额</th><th /></tr></thead><tbody>{visible.map(record => <ReferenceCapitalRow key={record.id} record={record} accountLabel={accounts.find(account => account.id === record.accountId)?.label ?? "当前账户"} busy={busy} onEdit={edit} onRemove={onRemove}/>)}</tbody></table>
    <details open={Object.keys(legacyConfig).length > 0}><summary>旧版类别配置（未映射，仅只读）</summary>{Object.keys(legacyConfig).length === 0 ? <p>未发现旧版类别配置。</p> : <ul>{Object.entries(legacyConfig).map(([category, value]) => <li key={category}>{category}：{value.amount} {value.currency}（未映射）</li>)}</ul>}</details>
  </section>;
}

function ReferenceCapitalRow({ record, accountLabel, busy, onEdit, onRemove }: { record: ReferenceCapitalRecord; accountLabel: string; busy: boolean; onEdit: (record: ReferenceCapitalRecord) => void; onRemove: (id: string) => Promise<boolean> }) {
  const [confirming, setConfirming] = useState(false);
  const [removing, setRemoving] = useState(false);
  const rowBusy = busy || removing;
  const remove = async () => { if (rowBusy) return; setRemoving(true); try { const ok = await onRemove(record.id); if (ok) setConfirming(false); } finally { setRemoving(false); } };
  return <tr><td>{accountLabel}</td><td>{record.currency}</td><td>{record.fromDate} — {record.toDate}</td><td>{record.amount}</td><td className={styles.rowActions}>{confirming ? <><button disabled={rowBusy} onClick={() => void remove()}>确认删除</button><button disabled={rowBusy} onClick={() => setConfirming(false)}>取消</button></> : <><button disabled={rowBusy} onClick={() => onEdit(record)}>编辑</button><button disabled={rowBusy} onClick={() => setConfirming(true)}>删除</button></>}</td></tr>;
}
