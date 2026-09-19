"use client";

import { useState } from "react";

import type {
  LibraryPerformanceComparableGroup,
  LibraryPerformanceCurrencyGroup,
  LibraryPerformanceExclusions,
  LibraryPerformanceOpen,
  LibraryPerformanceOpenGroup,
  LibraryPerformanceSummary,
} from "../../lib/reviews/library-performance";
import { formatSimulationRunLabel } from "./library-filter-options";
import styles from "./library-performance-summary.module.css";

export type LibraryPerformanceSummaryViewProps = {
  summary: LibraryPerformanceSummary;
  stockCount: number;
  roundCount: number;
  reviewedCount: number;
  progressTotal: number;
  groupLabels?: Record<string, string>;
};

const EXCLUSION_LABELS: Record<string, string> = {
  open: "持仓中",
  "unknown-fees": "费用未知",
  "currency-conversion": "结算币种不一致",
  "history-incomplete": "历史流水不完整",
  accuracy: "财务证据不完整",
  "pnl-unavailable": "净盈亏不可用",
  "missing-pnl": "缺少净盈亏",
  "invalid-pnl": "净盈亏格式无效",
  "invalid-exposure": "开仓金额无效或非正",
  "missing-fx": "缺少汇率",
  "invalid-fx": "汇率无效",
};

function numeric(value: string | null): number | null {
  if (value === null || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function signedNumber(value: string | null, suffix: string): string {
  const parsed = numeric(value);
  if (parsed === null) return "不可用";
  const sign = parsed > 0 ? "+" : parsed < 0 ? "-" : "";
  return `${sign}${Math.abs(parsed).toFixed(2)}${suffix}`;
}

function currencyPrefix(currency: string): string {
  if (currency === "CNY") return "¥";
  return `${currency} `;
}

function signedCurrency(value: string | null, currency = "CNY", forceNegative = false): string {
  const parsed = numeric(value);
  if (parsed === null) return "不可用";
  const sign = forceNegative
    ? "-"
    : parsed > 0 ? "+" : parsed < 0 ? "-" : "";
  return `${sign}${currencyPrefix(currency)}${Math.abs(parsed).toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function toneFor(value: string | null): "positive" | "negative" | "neutral" {
  const parsed = numeric(value);
  return parsed === null ? "neutral" : parsed > 0 ? "positive" : parsed < 0 ? "negative" : "neutral";
}

function toneClass(value: string | null): string {
  const tone = toneFor(value);
  return tone === "neutral" ? styles.neutral : tone;
}

function formatRatio(value: string | null): string {
  const parsed = numeric(value);
  return parsed === null ? "不可用" : parsed.toFixed(2);
}

function formatGroupLabel(
  group: Pick<LibraryPerformanceComparableGroup, "tradeNature" | "simulationRunId">,
  groupLabels: Record<string, string> | undefined,
  key: string,
): string {
  const custom = groupLabels?.[key];
  if (custom) return custom;
  if (group.tradeNature === "simulation") {
    return group.simulationRunId ? formatSimulationRunLabel(group.simulationRunId) : "模拟盘 · 未指定运行";
  }
  if (group.tradeNature === "live") return "实盘";
  return "来源未知";
}

function exclusionText(exclusions: LibraryPerformanceExclusions): string[] {
  return Object.entries(exclusions)
    .filter(([, count]) => typeof count === "number" && count > 0)
    .map(([reason, count]) => `${EXCLUSION_LABELS[reason] ?? reason} ${count}`);
}

function matchesScope(
  group: Pick<LibraryPerformanceComparableGroup, "tradeNature" | "simulationRunId">,
  candidate: Pick<LibraryPerformanceOpenGroup | LibraryPerformanceCurrencyGroup, "tradeNature" | "simulationRunId">,
) {
  return group.tradeNature === candidate.tradeNature && group.simulationRunId === candidate.simulationRunId;
}

function openForGroup(
  open: LibraryPerformanceOpen,
  group: Pick<LibraryPerformanceComparableGroup, "tradeNature" | "simulationRunId"> | null,
) {
  if (!group) return null;
  const groups = open.groups.filter(candidate => matchesScope(group, candidate));
  const count = groups.reduce((sum, candidate) => sum + candidate.count, 0);
  const withUnrealizedPnl = groups.reduce((sum, candidate) => sum + candidate.withUnrealizedPnl, 0);
  const unavailable = groups.reduce((sum, candidate) => sum + candidate.unavailable, 0);
  const unrealizedPnl = groups.length === 1 ? groups[0].unrealizedPnl : null;
  return { count, withUnrealizedPnl, unavailable, unrealizedPnl, groups };
}

function openPnlText(group: LibraryPerformanceOpenGroup): string {
  const value = group.unrealizedPnl === null
    ? "不可用"
    : signedCurrency(group.unrealizedPnl, group.currency);
  const currencyLabel = group.currency === "CNY" ? "浮盈亏" : `${group.currency} 浮盈亏`;
  const unavailableLabel = group.unavailable > 0 ? `，${group.unavailable} 个回合不可用` : "";
  return `${currencyLabel} ${value}${unavailableLabel}`;
}

function MetricCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone?: string;
}) {
  return (
    <article className={styles.metricCard} aria-label={label}>
      <span className={styles.metricLabel}>{label}</span>
      <strong className={`${styles.metricValue} ${tone ?? styles.neutral}`}>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function DetailItem({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div className={styles.detailItem} title={title}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function RawCurrencyList({ groups }: { groups: LibraryPerformanceCurrencyGroup[] }) {
  return (
    <section className={styles.rawSection} aria-label="原币金额">
      <div className={styles.sectionHeading}>
        <h3>原币金额</h3>
        <span>保留原币，便于核对人民币折算</span>
      </div>
      {groups.length === 0 ? <p className={styles.muted}>当前统计组没有可查的原币金额。</p> : (
        <ul className={styles.rawList}>
          {groups.map(group => (
            <li key={group.key} className={styles.rawRow}>
              <span className={styles.rawIdentity}>
                <strong>{group.currency}</strong>
                <small>{group.sampleCount} 个回合 · 净盈亏样本 {group.netPnlSampleCount} · 收益率样本 {group.returnSampleCount}</small>
              </span>
              <span className={`${styles.rawValue} ${toneClass(group.netPnl)}`}>
                <b>{signedCurrency(group.netPnl, group.currency)}</b>
                <small>已平仓净盈亏</small>
              </span>
              <span className={styles.rawValue}>
                <b>{signedCurrency(group.grossExposure, group.currency)}</b>
                <small>开仓金额</small>
              </span>
              <span className={`${styles.rawValue} ${toneClass(group.weightedReturn)}`}>
                <b>{signedNumber(group.weightedReturn, "%")}</b>
                <small>按开仓金额加权</small>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function LibraryPerformanceSummaryView({
  summary,
  stockCount,
  roundCount,
  reviewedCount,
  progressTotal,
  groupLabels,
}: LibraryPerformanceSummaryViewProps) {
  const groups = summary.comparableGroups;
  const [selectedGroupKey, setSelectedGroupKey] = useState(groups[0]?.key ?? "");
  const selectedGroup = groups.find(group => group.key === selectedGroupKey) ?? groups[0] ?? null;
  const metricGroup: LibraryPerformanceComparableGroup = groups.length === 1
    ? summary.cny
    : selectedGroup ?? summary.cny;
  const selectedLabel = selectedGroup
    ? formatGroupLabel(selectedGroup, groupLabels, selectedGroup.key)
    : "当前统计组";
  const activeRawGroups = summary.rawCurrencyGroups.filter(group =>
    selectedGroup ? matchesScope(selectedGroup, group) : true,
  );
  const open = openForGroup(summary.open, selectedGroup);
  const progressValue = progressTotal > 0 ? `${reviewedCount}/${progressTotal}` : "不可用";
  const hasMissingFx = (metricGroup.exclusionReasons["missing-fx"] ?? 0) > 0 ||
    (metricGroup.exclusionReasons["invalid-fx"] ?? 0) > 0;
  const reason = metricGroup.netPnlSampleCount === 0
    ? hasMissingFx
      ? "缺少有效汇率，外币样本暂无法折算"
      : !selectedGroup && summary.cny.reason === "multiple-scopes"
        ? "包含多个交易性质或模拟运行，请选择一个统计组"
        : !selectedGroup && summary.cny.reason === "empty"
          ? "当前范围没有可用绩效样本"
          : "没有可信的已平仓净盈亏样本"
    : null;
  const netPnlDetail = metricGroup.netPnlSampleCount > 0
    ? `人民币 · ${metricGroup.netPnlSampleCount} 个可信已平仓回合`
    : reason ?? "没有可信已平仓样本";
  const returnDetail = `收益率样本 ${metricGroup.returnSampleCount}/${metricGroup.netPnlSampleCount}`;
  const winRate = metricGroup.winRate;
  const breakEven = metricGroup.netPnlSampleCount > 0 ? `${metricGroup.breakEven} 个回合` : "不可用";
  const exclusionDetails = exclusionText(metricGroup.exclusionReasons);
  const returnExclusionDetails = exclusionText(metricGroup.returnExclusionReasons);

  return (
    <section className={styles.summary} aria-label="当前筛选绩效汇总">
      <header className={styles.header}>
        <div>
          <h2>当前筛选绩效</h2>
          <p>当前筛选：{stockCount} 个证券 · {roundCount} 个回合 · 已复盘 {reviewedCount}/{progressTotal} 个</p>
        </div>
        <div className={styles.scopeControl}>
          {groups.length > 1 ? (
            <label>
              <span>统计范围</span>
              <select aria-label="统计范围" value={selectedGroup?.key ?? ""} onChange={event => setSelectedGroupKey(event.target.value)}>
                {groups.map(group => <option key={group.key} value={group.key}>{formatGroupLabel(group, groupLabels, group.key)}</option>)}
              </select>
            </label>
          ) : <span className={styles.scopeBadge}>统计组：{selectedLabel}</span>}
        </div>
      </header>

      <div className={styles.scopeLine}>
        <strong>当前统计组：{selectedLabel}</strong>
        <span>统计组：{metricGroup.sampleCount} 个回合 · 净盈亏样本 {metricGroup.netPnlSampleCount} · 收益率样本 {metricGroup.returnSampleCount}</span>
      </div>

      <div className={styles.primaryGrid}>
        <MetricCard
          label="已平仓净盈亏"
          value={signedCurrency(metricGroup.netPnl)}
          detail={netPnlDetail}
          tone={toneClass(metricGroup.netPnl)}
        />
        <MetricCard
          label="加权收益率（按开仓金额）"
          value={signedNumber(metricGroup.weightedReturn, "%")}
          detail={`${returnDetail} · 开仓金额不含费用`}
          tone={toneClass(metricGroup.weightedReturn)}
        />
        <MetricCard
          label="胜率"
          value={winRate ? signedNumber(String(winRate.wins / winRate.denominator * 100), "%") : "不可用"}
          detail={winRate ? `胜 ${winRate.wins}/${winRate.denominator} · 保本 ${breakEven}` : `保本 ${breakEven}`}
          tone={winRate ? "positive" : styles.neutral}
        />
        <MetricCard
          label="复盘进度"
          value={progressValue}
          detail="不受复盘状态筛选影响"
          tone={styles.neutral}
        />
      </div>

      {reason && <p className={styles.notice} role="status">人民币绩效暂不可用：{reason}。原币金额仍可查。</p>}

      <details className={styles.disclosure}>
        <summary>统计详情 <span>样本、次级指标、排除原因与持仓说明</span></summary>
        <section className={styles.details} aria-label="绩效详情">
          <div className={styles.sectionHeading}>
            <h3>统计详情</h3>
            <span>已平仓净盈亏与收益率使用不同覆盖时，会分别显示样本数。</span>
          </div>
          <dl className={styles.detailGrid}>
            <DetailItem label="净盈亏样本" value={`${metricGroup.netPnlSampleCount} 个回合`} />
            <DetailItem label="收益率样本" value={`${metricGroup.returnSampleCount} 个回合`} />
            <DetailItem label="平均盈利" value={signedCurrency(metricGroup.averageWin)} />
            <DetailItem label="平均亏损" value={signedCurrency(metricGroup.averageLoss, "CNY", metricGroup.averageLoss !== null)} />
            <DetailItem label="盈亏比" value={formatRatio(metricGroup.payoff)} title={metricGroup.payoffReason ?? undefined} />
            <DetailItem label="利润因子" value={formatRatio(metricGroup.profitFactor)} title={metricGroup.profitFactorReason ?? undefined} />
            <DetailItem label="持仓回合" value={open && open.count > 0 ? `${open.count} 个回合` : metricGroup.openCount > 0 ? `${metricGroup.openCount} 个回合` : "无"} />
            <DetailItem label="排除回合" value={`${metricGroup.excludedCount} 个`} />
          </dl>
          <p className={styles.methodNote}>净盈亏扣除已知交易费用；开仓金额按开仓方向成交金额计算，持仓中回合与未能核实的费用不进入已平仓统计。</p>
          {(exclusionDetails.length > 0 || returnExclusionDetails.length > 0) && (
            <div className={styles.exclusions} aria-label="排除原因">
              {exclusionDetails.length > 0 && <p><strong>已平仓排除：</strong>{exclusionDetails.join("；")}</p>}
              {returnExclusionDetails.length > 0 && <p><strong>收益率排除：</strong>{returnExclusionDetails.join("；")}</p>}
            </div>
          )}
          {open && open.count > 0 && (
            <div className={styles.openNote}>
              <span>持仓中 {open.count} 个回合</span>
              {open.groups.map(group => <span key={group.key}> · {openPnlText(group)}</span>)}
            </div>
          )}
        </section>
      </details>

      <details className={styles.disclosure}>
        <summary>原币金额 <span>按币种核对 CNY 折算</span></summary>
        <RawCurrencyList groups={activeRawGroups} />
      </details>
    </section>
  );
}
