"use client";

import { useEffect, useRef, useState } from "react";
import Decimal from "decimal.js";

import {
  AccountPrincipalProvisionalError,
  createAccountPrincipalProvisionalClient,
  type AccountPrincipalProvisionalClient,
} from "../../lib/principal/account-principal-provisional-client";
import {
  isAccountPrincipalProvisional,
  type AccountPrincipalProvisional,
  type AccountPrincipalProvisionalDraft,
  type AccountPrincipalProvisionalStatus,
} from "../../lib/principal/account-principal-provisional-contracts";
import { TRADINGVIEW_CANONICAL_ACCOUNT_ID } from "../../lib/trades/tradingview-account-identity";
import styles from "./account-principal-provisional-panel.module.css";

type ClientSeam = Pick<AccountPrincipalProvisionalClient, "read" | "save" | "revise">;

export type AccountPrincipalProvisionalPanelProps = {
  accountId?: string;
  /** The validated account-principal client can be replaced for UI tests/callers. */
  client?: ClientSeam;
  loading?: boolean;
  onSaved?: (record: AccountPrincipalProvisional) => void | Promise<void>;
};

type DraftState = {
  currency: AccountPrincipalProvisionalDraft["currency"];
  amount: string;
  asOf: string;
  status: AccountPrincipalProvisionalStatus;
  source: string;
  expectedRevision: number | null;
};

function emptyDraft(): DraftState {
  return {
    currency: "CNY",
    amount: "",
    asOf: "",
    status: "provisional",
    source: "",
    expectedRevision: null,
  };
}

function draftFromRecord(record: AccountPrincipalProvisional): DraftState {
  return {
    currency: record.currency,
    amount: record.amount,
    asOf: record.asOf ? record.asOf.slice(0, 10) : "",
    status: record.status,
    source: record.source,
    expectedRevision: record.revision,
  };
}

function errorText(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return "暂定本金保存失败，请稍后重试";
}

function formatAsOf(value: string | null): string {
  return value ? value.slice(0, 10) : "日期未提供";
}

function validAmount(value: string): boolean {
  try {
    const amount = new Decimal(value.trim());
    return amount.isFinite() && amount.gt(0);
  } catch {
    return false;
  }
}

function validAsOf(value: string): boolean {
  if (!value) return true;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function invalidResponse(message: string): AccountPrincipalProvisionalError {
  return new AccountPrincipalProvisionalError(200, "invalid-response", message);
}

export function AccountPrincipalProvisionalPanel({
  accountId,
  client,
  loading: callerLoading,
  onSaved,
}: AccountPrincipalProvisionalPanelProps) {
  const resolvedAccountId = accountId?.trim() || TRADINGVIEW_CANONICAL_ACCOUNT_ID;
  const clientRef = useRef<ClientSeam | null>(null);
  if (clientRef.current === null) clientRef.current = client ?? createAccountPrincipalProvisionalClient();
  const principalClient = clientRef.current;
  const [record, setRecord] = useState<AccountPrincipalProvisional | undefined>();
  const [draft, setDraft] = useState<DraftState>(emptyDraft);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [conflict, setConflict] = useState<AccountPrincipalProvisional | null>(null);
  const requestVersion = useRef(0);

  useEffect(() => {
    const version = ++requestVersion.current;
    let active = true;
    setLoading(true);
    setError(null);
    setMessage(null);
    setConflict(null);
    setEditing(false);
    void principalClient.read(resolvedAccountId).then((next) => {
      if (!active || requestVersion.current !== version) return;
      if (next !== undefined && (!isAccountPrincipalProvisional(next) || next.accountId !== resolvedAccountId)) {
        throw invalidResponse("账户暂定本金响应账户不匹配");
      }
      setRecord(next);
      setDraft(next ? draftFromRecord(next) : emptyDraft());
    }).catch((reason: unknown) => {
      if (!active || requestVersion.current !== version) return;
      setRecord(undefined);
      setDraft(emptyDraft());
      setError(errorText(reason));
    }).finally(() => {
      if (active && requestVersion.current === version) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [principalClient, resolvedAccountId]);

  const beginEdit = () => {
    setDraft(record ? draftFromRecord(record) : emptyDraft());
    setEditing(true);
    setError(null);
    setMessage(null);
    setConflict(null);
  };

  const cancel = () => {
    setDraft(record ? draftFromRecord(record) : emptyDraft());
    setEditing(false);
    setError(null);
    setMessage(null);
    setConflict(null);
  };

  const reloadConflict = () => {
    if (!conflict) return;
    setRecord(conflict);
    setDraft(draftFromRecord(conflict));
    setEditing(true);
    setConflict(null);
    setError(null);
    setMessage("已载入服务器当前值，请核对后再保存");
  };

  const save = async () => {
    if (saving || loading || callerLoading) return;
    const amount = draft.amount.trim();
    const source = draft.source.trim();
    if (!validAmount(amount)) {
      setError("请输入大于 0 的金额");
      setMessage(null);
      return;
    }
    if (!source) {
      setError("请输入暂定本金来源");
      setMessage(null);
      return;
    }
    if (!validAsOf(draft.asOf)) {
      setError("请输入有效的本金日期");
      setMessage(null);
      return;
    }
    const mutation: AccountPrincipalProvisionalDraft = {
      accountId: resolvedAccountId,
      currency: draft.currency,
      amount,
      asOf: draft.asOf ? `${draft.asOf}T00:00:00.000Z` : null,
      status: draft.status,
      source,
      expectedRevision: record ? draft.expectedRevision ?? record.revision : null,
    };
    const version = requestVersion.current;
    setSaving(true);
    setError(null);
    setMessage(null);
    setConflict(null);
    try {
      const next = record ? await principalClient.revise(mutation) : await principalClient.save(mutation);
      if (!isAccountPrincipalProvisional(next) || next.accountId !== resolvedAccountId) {
        throw invalidResponse("账户暂定本金响应账户不匹配");
      }
      if (requestVersion.current !== version) return;
      setRecord(next);
      setDraft(draftFromRecord(next));
      setEditing(false);
      setMessage("已保存暂定本金");
      try {
        await onSaved?.(next);
      } catch (refreshReason) {
        setError(`已保存暂定本金，但后续刷新失败：${errorText(refreshReason)}`);
      }
    } catch (reason) {
      if (requestVersion.current !== version) return;
      const current = reason instanceof AccountPrincipalProvisionalError
        && reason.status === 409
        && reason.current
        && reason.current.accountId === resolvedAccountId
        && isAccountPrincipalProvisional(reason.current)
        ? reason.current
        : null;
      setConflict(current);
      setError(errorText(reason));
    } finally {
      if (requestVersion.current === version) setSaving(false);
    }
  };

  const busy = Boolean(callerLoading || loading || saving);

  return (
    <section className={styles.panel} aria-label="账户暂定本金">
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>账户参考数据 · {resolvedAccountId}</span>
          <h2>暂定本金</h2>
          <p>本金记录独立于现金基准；缺少记录时保留缺口，不自动填入金额或日期。</p>
        </div>
        {busy && <span className={styles.busy}>正在读取</span>}
      </header>

      <p className={styles.separation}>暂定本金不等于现金基准；本金记录单独维护。</p>

      {error && !conflict && <p className={styles.error} role="alert">{error}</p>}
      {message && !editing && <p className={styles.message} role="status">{message}</p>}

      {record ? (
        <div className={styles.summary} aria-label="暂定本金当前值">
          <div><span>账户</span><strong>{record.accountId}</strong></div>
          <div><span>本金</span><strong>{record.currency} {record.amount}</strong></div>
          <div><span>日期</span><strong>{formatAsOf(record.asOf)}</strong></div>
          <div><span>状态</span><strong>{record.status === "provisional" ? "暂定" : "已确认"}</strong></div>
          <div><span>来源</span><strong>来源：{record.source}</strong></div>
          <div><span>版本</span><strong>当前版本 {record.revision}</strong></div>
        </div>
      ) : !loading && !error ? (
        <div className={styles.missing} role="status">
          <strong>尚未读取到暂定本金记录</strong>
          <span>不能由此推导现金基准或可信收益率。</span>
        </div>
      ) : null}

      {conflict && (
        <div className={styles.conflict} role="alert">
          <strong>服务器当前值已变化，已保留你的草稿</strong>
          <span>{error}</span>
          <span>服务器当前值：{conflict.currency} {conflict.amount} · 日期 {formatAsOf(conflict.asOf)} · 来源 {conflict.source} · 版本 {conflict.revision}</span>
          <button type="button" disabled={busy} onClick={reloadConflict}>重新载入当前本金</button>
        </div>
      )}

      {editing ? (
        <div className={styles.form} role="group" aria-label="编辑暂定本金">
          <label>本金金额
            <input aria-label="本金金额" type="number" step="any" inputMode="decimal" value={draft.amount} disabled={busy} onChange={(event) => setDraft(current => ({ ...current, amount: event.target.value }))} />
          </label>
          <label>币种
            <select aria-label="本金币种" value={draft.currency} disabled={busy} onChange={(event) => setDraft(current => ({ ...current, currency: event.target.value as DraftState["currency"] }))}>
              <option value="CNY">CNY</option>
              <option value="USD">USD</option>
              <option value="HKD">HKD</option>
            </select>
          </label>
          <label>本金日期
            <input aria-label="本金日期" type="date" value={draft.asOf} disabled={busy} onChange={(event) => setDraft(current => ({ ...current, asOf: event.target.value }))} />
          </label>
          <label>来源
            <input aria-label="本金来源" type="text" value={draft.source} disabled={busy} onChange={(event) => setDraft(current => ({ ...current, source: event.target.value }))} />
          </label>
          <label>状态
            <select aria-label="本金状态" value={draft.status} disabled={busy} onChange={(event) => setDraft(current => ({ ...current, status: event.target.value as AccountPrincipalProvisionalStatus }))}>
              <option value="provisional">暂定</option>
              <option value="confirmed">已确认</option>
            </select>
          </label>
          <div className={styles.actions}>
            <button type="button" disabled={busy} onClick={() => void save()}>保存暂定本金</button>
            <button type="button" disabled={busy} onClick={cancel}>取消编辑</button>
          </div>
        </div>
      ) : (
        <button type="button" className={styles.editButton} disabled={busy} onClick={beginEdit}>
          {record ? "编辑暂定本金" : "填写暂定本金"}
        </button>
      )}
    </section>
  );
}
