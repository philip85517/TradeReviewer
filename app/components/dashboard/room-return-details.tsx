"use client";

import type { PrincipalReferenceSummary } from "../../lib/principal/principal-model";
import styles from "./room-return-details.module.css";

export type RoomReturnDetailsProps = {
  summary: PrincipalReferenceSummary;
  trustedCount?: number;
  onOpenPrincipal?: () => void;
};

const exclusionLabels: Record<string, string> = {
  "unknown-fees": "费用未知",
  "history-incomplete": "历史证据不完整",
  "pnl-unavailable": "净盈亏不可用",
  "incomplete-cost-evidence": "成本证据不完整",
  "short-or-unknown-direction": "做空或方向未知",
  "settlement-currency-mismatch": "结算币种不一致",
  "not-closed": "回合未完整平仓",
  "unknown-asset": "资产类型未知",
  "invalid-cost": "成本金额无效",
};

function number(value: string): string {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toLocaleString("zh-CN", { maximumFractionDigits: 2 }) : "不可用";
}

function money(value: PrincipalReferenceSummary["netPnl"]): string {
  const original = Object.entries(value.originalByCurrency).map(([code, amount]) => `${code} ${number(amount)}`).join(" · ");
  if (value.convertedCny === null) return original || "不可用";
  return `${original || "CNY"}（人民币估算 CNY ${number(value.convertedCny)}）`;
}

function reasons(summary: PrincipalReferenceSummary): string {
  const entries = Object.entries(summary.costReturn.exclusionReasons);
  return entries.length === 0 ? "无排除样本" : entries.map(([reason, count]) => `${exclusionLabels[reason] ?? "数据证据不足"} ${count} 个`).join("、");
}

export function RoomReturnDetails({ summary, trustedCount, onOpenPrincipal }: RoomReturnDetailsProps) {
  const principalMode = summary.mode === "principal";
  const numerator = money(principalMode ? summary.netPnl : summary.costReturn.netPnl);
  const denominator = principalMode ? money(summary.principal) : money(summary.costReturn.buyCost);
  return (
    <details className={styles.details} data-testid="room-return-details">
      <summary>查看收益率口径与样本</summary>
      <div className={styles.content}>
        <p className={styles.formula}>
          {principalMode ? "本金参考收益率 = 可信净盈亏 ÷ 已配置本金" : "交易成本收益率 = 可信净盈亏 ÷ 完整回合买入成本"}
        </p>
        <dl className={styles.grid}>
          <div><dt>实际分子</dt><dd>{numerator}</dd></div>
          <div><dt>实际分母</dt><dd>{denominator}</dd></div>
          <div><dt>{principalMode ? "可信已平仓样本" : "成本适用样本"}</dt><dd>{principalMode ? (trustedCount ?? summary.costReturn.applicableCount) : summary.costReturn.applicableCount} 个</dd></div>
          <div><dt>{principalMode ? "成本收益率排除样本" : "排除样本"}</dt><dd>{summary.costReturn.excludedCount} 个（{reasons(summary)}）</dd></div>
        </dl>
        <p className={styles.note}>
          币种按原币显示；人民币金额为汇率快照估算。{summary.costReturn.buyCost.note}
        </p>
        {!principalMode && summary.fallbackReason && (
          <p className={styles.notice}>
            本金参考收益率不可用；交易成本收益率保持独立口径，不替代本金回报。
          </p>
        )}
        {principalMode && <p className={styles.note}>同时保留交易成本收益率：{summary.costReturn.costReturnPercent === null ? "不可计算" : `${number(summary.costReturn.costReturnPercent)}%`}。</p>}
        {onOpenPrincipal && (
          <button type="button" className={styles.link} onClick={onOpenPrincipal}>前往数据管理配置本金</button>
        )}
      </div>
    </details>
  );
}
