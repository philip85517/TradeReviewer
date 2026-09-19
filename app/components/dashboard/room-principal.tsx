"use client";

import { useState } from "react";

import {
  DEFAULT_PRINCIPAL_CURRENCIES,
  normalizePrincipalValue,
  PRINCIPAL_CATEGORIES,
  PRINCIPAL_CATEGORY_LABELS,
  type PrincipalCategory,
  type PrincipalConfig,
  type PrincipalCurrency,
  type PrincipalReferenceSummary,
  type PrincipalValue,
} from "../../lib/principal/principal-model";
import styles from "./room-principal.module.css";

export type RoomPrincipalProps = {
  /** Pass the live/simulation scope key; changing it gives the new scope a fresh draft space. */
  scopeKey?: string;
  config: PrincipalConfig;
  summary: PrincipalReferenceSummary;
  loading?: boolean;
  saving?: boolean;
  error?: string | null;
  onSave: (category: PrincipalCategory, value: PrincipalValue) => Promise<boolean | void> | boolean | void;
  onClear: (category: PrincipalCategory) => Promise<boolean | void> | boolean | void;
};

type Draft = PrincipalValue;
type CurrencyChoice = PrincipalCurrency | undefined;

function decimal(value: string | null): string {
  if (value === null) return "不可计算";
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString("zh-CN", { maximumFractionDigits: 8 }) : "不可计算";
}

function percent(value: string | null): string {
  return value === null ? "不可计算" : `${decimal(value)}%`;
}

function money(value: PrincipalReferenceSummary["principal"]): string {
  if (value.convertedCny !== null) return `CNY ${decimal(value.convertedCny)}`;
  const entries = Object.entries(value.originalByCurrency);
  return entries.length === 0 ? "暂无本金" : entries.map(([currency, amount]) => `${currency} ${decimal(amount)}`).join(" · ");
}

function displayError(error: string | null | undefined): string | null {
  return error && error.trim() ? error : null;
}

export function RoomPrincipal({
  scopeKey = "live",
  config,
  summary,
  loading = false,
  saving = false,
  error = null,
  onSave,
  onClear,
}: RoomPrincipalProps) {
  const [draftsByScope, setDraftsByScope] = useState<Record<string, Partial<Record<PrincipalCategory, Draft>>>>({});
  const [pendingByScope, setPendingByScope] = useState<Record<string, Partial<Record<PrincipalCategory, PrincipalCurrency>>>>({});
  const [errorsByScope, setErrorsByScope] = useState<Record<string, Partial<Record<PrincipalCategory, string>>>>({});
  const drafts = draftsByScope[scopeKey] ?? {};
  const pendingCurrencies = pendingByScope[scopeKey] ?? {};
  const fieldErrors = errorsByScope[scopeKey] ?? {};

  const draftFor = (category: PrincipalCategory): Draft => drafts[category] ?? config[category] ?? {
    amount: "",
    currency: DEFAULT_PRINCIPAL_CURRENCIES[category],
  };

  const setDraft = (category: PrincipalCategory, value: Draft | undefined) => {
    setDraftsByScope(previous => ({
      ...previous,
      [scopeKey]: { ...previous[scopeKey], [category]: value },
    }));
  };

  const setFieldError = (category: PrincipalCategory, value: string | undefined) => {
    setErrorsByScope(previous => ({
      ...previous,
      [scopeKey]: { ...previous[scopeKey], [category]: value },
    }));
  };

  const changeAmount = (category: PrincipalCategory, amount: string) => {
    setDraft(category, { ...draftFor(category), amount });
    setFieldError(category, undefined);
  };

  const requestCurrency = (category: PrincipalCategory, currency: PrincipalCurrency) => {
    const current = draftFor(category);
    if (current.amount.trim() && current.currency !== currency) {
      setPendingByScope(previous => ({ ...previous, [scopeKey]: { ...previous[scopeKey], [category]: currency } }));
      return;
    }
    setDraft(category, { ...draftFor(category), currency });
  };

  const confirmCurrency = (category: PrincipalCategory) => {
    const currency = pendingCurrencies[category];
    if (!currency) return;
    setDraft(category, { ...draftFor(category), currency });
    setPendingByScope(previous => ({ ...previous, [scopeKey]: { ...previous[scopeKey], [category]: undefined } }));
  };

  const save = async (category: PrincipalCategory) => {
    if (pendingCurrencies[category]) {
      setFieldError(category, "请先确认币种变更");
      return;
    }
    const value = normalizePrincipalValue(draftFor(category));
    if (!value) {
      setFieldError(category, "金额必须为正数");
      return;
    }
    setFieldError(category, undefined);
    const result = await onSave(category, value);
    setPendingByScope(previous => ({ ...previous, [scopeKey]: { ...previous[scopeKey], [category]: undefined } }));
    if (result !== false) setDraft(category, undefined);
  };

  const clear = async (category: PrincipalCategory) => {
    setFieldError(category, undefined);
    const result = await onClear(category);
    setPendingByScope(previous => ({ ...previous, [scopeKey]: { ...previous[scopeKey], [category]: undefined } }));
    if (result !== false) setDraft(category, undefined);
  };

  return (
    <section className={styles.panel} aria-label="本金与参考收益率">
      <header className={styles.heading}>
        <div>
          <span className={styles.eyebrow}>Principal</span>
          <h2>本金与参考收益率</h2>
          <p>按完整交易范围的可信净盈亏除以对应本金计算，日期变化会沿用已填本金。</p>
        </div>
        {loading && <span className={styles.badge}>正在读取</span>}
      </header>

      <div className={styles.summary}>
        <div>
          <span>本金参考收益率</span>
          <strong className={summary.mode === "principal" ? styles.value : styles.unavailable}>
            {summary.mode === "principal" ? percent(summary.principalReturnPercent) : "不可用"}
          </strong>
        </div>
        <div>
          <span>交易成本收益率</span>
          <strong>{percent(summary.costReturn.costReturnPercent)}</strong>
        </div>
        <div>
          <span>已填本金小计</span>
          <strong>{money(summary.principal)}</strong>
        </div>
      </div>

      {summary.fallbackReason && <p className={styles.notice}>{summary.fallbackReason}</p>}
      {displayError(error) && <p className={styles.error} role="alert">{error}</p>}

      <div className={styles.cards}>
        {PRINCIPAL_CATEGORIES.map(category => {
          const label = PRINCIPAL_CATEGORY_LABELS[category];
          const draft = draftFor(category);
          const pending = pendingCurrencies[category] as CurrencyChoice;
          const fieldError = fieldErrors[category];
          return (
            <fieldset className={styles.card} key={category} aria-label={`${label}本金`}>
              <legend>{label}</legend>
              <label>
                <span>金额</span>
                <input
                  aria-label={`${label}本金金额`}
                  inputMode="decimal"
                  type="text"
                  value={draft.amount}
                  onChange={event => changeAmount(category, event.target.value)}
                  placeholder="请输入正数"
                  disabled={saving}
                />
              </label>
              <label>
                <span>币种</span>
                <select
                  aria-label={`${label}本金币种`}
                  value={draft.currency}
                  onChange={event => requestCurrency(category, event.target.value as PrincipalCurrency)}
                  disabled={saving}
                >
                  <option value="CNY">CNY 人民币</option>
                  <option value="USD">USD 美元</option>
                  <option value="HKD">HKD 港币</option>
                </select>
              </label>
              {pending && (
                <div className={styles.confirmation} role="status">
                  <span>请确认将币种改为 {pending}；金额不会自动换算。</span>
                  <div>
                    <button type="button" disabled={saving} onClick={() => confirmCurrency(category)}>确认币种 {pending}</button>
                    <button type="button" disabled={saving} onClick={() => setPendingByScope(previous => ({ ...previous, [scopeKey]: { ...previous[scopeKey], [category]: undefined } }))}>取消</button>
                  </div>
                </div>
              )}
              {fieldError && <p className={styles.fieldError}>{fieldError}</p>}
              <div className={styles.actions}>
                <button type="button" onClick={() => void save(category)} disabled={saving}>保存{label}</button>
                <button type="button" className={styles.secondary} onClick={() => void clear(category)} disabled={saving}>清空{label}</button>
              </div>
            </fieldset>
          );
        })}
      </div>
    </section>
  );
}
