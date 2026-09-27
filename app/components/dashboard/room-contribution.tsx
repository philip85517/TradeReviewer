"use client";

import Decimal from "decimal.js";
import { useState } from "react";
import type { RoomContributionDimension, RoomContributionGroup, RoomContributionModel } from "../../lib/reviews/trading-room-contribution";
import { roomMoneyValue, type RoomDisplayCurrency, type RoomMoneyView } from "../../lib/reviews/trading-room-scope";
import styles from "./room-contribution.module.css";

export type RoomContributionProps = { model: RoomContributionModel; reportCurrency?: RoomDisplayCurrency };
function amount(value: string | null | undefined, currency: string) {
  if (value === null || value === undefined) return "不可用";
  const parsed = new Decimal(value);
  try {
    return new Intl.NumberFormat("zh-CN", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
      signDisplay: "always",
    }).format(parsed.toNumber());
  } catch {
    return `${parsed.gte(0) ? "+" : ""}${parsed.toFixed(2)} ${currency}`;
  }
}

function valueFor(view: RoomMoneyView, reportCurrency: RoomDisplayCurrency): string | null {
  if (reportCurrency === "original") return null;
  return view.targetCurrency === reportCurrency ? roomMoneyValue(view) : null;
}

function groupValue(group: RoomContributionGroup, currency: string, reportCurrency: RoomDisplayCurrency, converted: boolean): string | null {
  return converted ? valueFor(group.money, reportCurrency) : group.money.originalByCurrency[currency] ?? null;
}

export function RoomContribution({ model, reportCurrency: reportCurrencyProp }: RoomContributionProps) {
  const [dimension, setDimension] = useState<RoomContributionDimension>("market");
  const reportCurrency = reportCurrencyProp ?? model.total.targetCurrency ?? "original";
  // A partial FX snapshot must never convert just the convenient groups.
  const converted = reportCurrency !== "original"
    && valueFor(model.total, reportCurrency) !== null
    && (model.total.conversion === "complete" || model.total.conversion === "same-currency");
  const currencies = converted ? [reportCurrency] : Object.keys(model.total.originalByCurrency).sort();
  const groups = model.dimensions[dimension];
  return <section className={styles.panel} aria-label="盈亏贡献分解">
    <h3>盈亏贡献分解</h3>
    <div className={styles.tabs} role="group" aria-label="贡献维度">{([["market", "市场"], ["instrument", "标的"], ["account", "账户"]] as const).map(([key, label]) => <button type="button" key={key} aria-pressed={dimension === key} onClick={() => setDimension(key)}>{label}</button>)}</div>
    <p className={styles.note}>{converted ? `折算 ${reportCurrency} · ${model.total.note}` : reportCurrency === "original" ? `按原币分别显示 · ${model.total.note}` : `${reportCurrency}不可用，保留原币小计 · ${model.total.note}`}</p>
    {model.includedCount === 0 ? <p className={styles.note}>当前范围暂无可信已平仓贡献样本。</p> : currencies.map(currency => {
      const values = groups.map(group => ({ group, value: groupValue(group, currency, reportCurrency, converted) })).filter((item): item is typeof item & { value: string } => item.value != null);
      const max = values.reduce((current, item) => Decimal.max(current, new Decimal(item.value).abs()), new Decimal(0));
      const total = converted ? valueFor(model.total, reportCurrency) : model.total.originalByCurrency[currency];
      return <div className={styles.currencyGroup} key={currency} aria-label={`${currency} 贡献金额`}>
        <strong>{currency} 合计 {amount(total, currency)}</strong>
        <ul>{values.map(({ group, value }) => {
          const numeric = new Decimal(value);
          const sign = numeric.gt(0) ? "positive" : numeric.lt(0) ? "negative" : "zero";
          const width = max.isZero() ? 0 : numeric.abs().div(max).mul(50).toNumber();
          return <li key={group.id}>
            <div className={styles.rowLabel}><span>{group.label}</span><div className={styles.barTrack} aria-hidden="true"><i data-contribution-sign={sign} className={styles[sign]} style={{ left: `${numeric.lt(0) ? 50 - width : 50}%`, width: `${width}%` }} /></div><b className={styles[sign]}>{amount(value, currency)}</b></div>
            <small title={group.id}>{group.detail} · {group.count} 回合</small>
          </li>;
        })}</ul>
      </div>;
    })}
    <p className={styles.note}>{model.includedCount} 个可信已平仓回合 · 已扣交易费用</p>
    {model.excluded.length > 0 && <details className={styles.note}><summary>未纳入贡献 {model.excluded.length} 回合</summary><ul>{model.excluded.map(row => <li key={row.episodeId}>{row.reason}</li>)}</ul></details>}
  </section>;
}
