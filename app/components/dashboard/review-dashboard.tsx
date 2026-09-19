"use client";

import { ChevronLeft, ChevronRight, Filter, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import {
  buildDashboardCalendar,
  buildDashboardModel,
  dashboardEpisodeDate,
  dashboardInstrumentLabel,
  dashboardStableShortId,
  dashboardHongKongChannel,
  dashboardMarketFilterOptions,
  dashboardRowExclusionReason,
  dashboardRowMarketSourceLabel,
  exclusionReasonLabel,
  type DashboardCalendarCell,
  type DashboardCalendarPeriod,
  type DashboardFilter,
  type DashboardGroup,
  type DashboardRow,
} from "../../lib/reviews/dashboard";
import type { ChartSettings } from "../../lib/storage/chart-settings";
import type { TradeLibraryEntry } from "../../lib/trades/library";
import styles from "./review-dashboard.module.css";

export type ReviewDashboardProps = {
  entries: TradeLibraryEntry[];
  onOpenInReview: (
    instrumentId: string,
    episodeId: string,
    queueIds?: string[],
  ) => void;
  /** Optional setting loaded from SQLite; teal-red is the safe default. */
  colorScheme?: ChartSettings["colorScheme"];
};

type FilterSelectProps = {
  label: string;
  ariaLabel: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
};

function FilterSelect({ label, ariaLabel, value, options, onChange }: FilterSelectProps) {
  return (
    <label className={styles.filterField}>
      <span>{label}</span>
      <select aria-label={ariaLabel} value={value} onChange={event => onChange(event.target.value)}>
        {options.map(option => <option value={option.value} key={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

function currencyCode(value: string | null | undefined): string {
  return value?.trim().toUpperCase() || "USD";
}

function money(value: string | null, currency: string | null | undefined): string {
  if (value === null) return "不可用";
  try {
    return new Intl.NumberFormat("zh-CN", {
      style: "currency",
      currency: currencyCode(currency),
      maximumFractionDigits: 2,
      signDisplay: "always",
    }).format(Number(value));
  } catch {
    return `${Number(value).toFixed(2)} ${currency ?? ""}`.trim();
  }
}

function ratio(value: string | null): string {
  return value === null ? "不可用" : Number(value).toFixed(2);
}

function amount(value: string | null, currency: string | null | undefined): string {
  if (value === null) return "不可用";
  try {
    return new Intl.NumberFormat("zh-CN", {
      style: "currency",
      currency: currencyCode(currency),
      maximumFractionDigits: 2,
    }).format(Number(value));
  } catch {
    return `${Number(value).toFixed(2)} ${currency ?? ""}`.trim();
  }
}

function signedClass(value: string | null): string {
  if (value === null) return styles.neutral;
  return Number(value) > 0 ? styles.positive : Number(value) < 0 ? styles.negative : styles.neutral;
}

function dateFromKey(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day || 1));
}

function dateKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function monthShift(value: string, delta: number): string {
  const date = dateFromKey(`${value}-01`);
  date.setUTCMonth(date.getUTCMonth() + delta);
  return dateKey(date).slice(0, 7);
}

function monthBounds(month: string): { startDate: string; endDate: string } {
  const start = dateFromKey(`${month}-01`);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  end.setUTCDate(0);
  return { startDate: `${month}-01`, endDate: dateKey(end) };
}

function dayCellsForMonth(month: string, cells: DashboardCalendarCell[]) {
  const { startDate, endDate } = monthBounds(month);
  const byKey = new Map(cells.map(cell => [cell.key, cell]));
  const firstDay = dateFromKey(startDate).getUTCDay();
  const leading = firstDay === 0 ? 6 : firstDay - 1;
  const days = Number(endDate.slice(8, 10));
  return [
    ...Array.from({ length: leading }, (_, index) => ({ key: `blank:${index}`, blank: true as const })),
    ...Array.from({ length: days }, (_, index) => {
      const key = `${month}-${String(index + 1).padStart(2, "0")}`;
      return {
        key,
        blank: false as const,
        cell: byKey.get(key) ?? {
          period: "day" as const,
          key,
          label: key,
          startDate: key,
          endDate: key,
          netPnl: null,
          trustedClosedCount: 0,
          excludedCount: 0,
          state: "empty" as const,
          unavailableReason: null,
          episodeIds: [],
          excludedEpisodeIds: [],
        },
      };
    }),
  ];
}

function periodCellsForMonth(month: string, period: DashboardCalendarPeriod, cells: DashboardCalendarCell[]) {
  const bounds = monthBounds(month);
  return cells.filter(cell =>
    period === "month"
      ? cell.key === month
      : cell.endDate >= bounds.startDate && cell.startDate <= bounds.endDate,
  );
}

function cellValue(cell: DashboardCalendarCell, currency: string | null): string {
  if (cell.netPnl !== null) return money(cell.netPnl, currency);
  if (cell.state === "unavailable") return "不可用";
  return "—";
}

function rowSourceLabel(row: DashboardRow): string | null {
  const source = dashboardRowMarketSourceLabel(row);
  if (source) return source;
  const channel = dashboardHongKongChannel(row);
  return channel === "unknown" ? "港股渠道待核对" : null;
}

function rowDisplayName(row: DashboardRow): string {
  return `${row.entry.instrument.name}（${row.entry.instrument.symbol}）`;
}

function allEntryExecutions(entry: TradeLibraryEntry) {
  return [
    ...entry.executions,
    ...entry.episodes.flatMap(item => item.episode.executions),
  ];
}

type DashboardFilterOption = { value: string; label: string };

function disambiguateFilterOptionLabels(options: DashboardFilterOption[]): DashboardFilterOption[] {
  const counts = new Map<string, number>();
  for (const option of options) counts.set(option.label, (counts.get(option.label) ?? 0) + 1);
  const seen = new Map<string, number>();
  return options.map(option => {
    const count = counts.get(option.label) ?? 0;
    if (count < 2) return option;
    const ordinal = (seen.get(option.label) ?? 0) + 1;
    seen.set(option.label, ordinal);
    return { ...option, label: `${option.label} · ${ordinal}` };
  });
}

function accountFilterOptions(entries: TradeLibraryEntry[]) {
  const values = new Map<string, string>();
  for (const entry of entries) {
    for (const execution of allEntryExecutions(entry)) {
      if (!values.has(execution.accountId)) {
        values.set(execution.accountId, execution.accountLabel.trim());
      }
    }
  }
  const labels = new Map<string, number>();
  for (const label of values.values()) labels.set(label, (labels.get(label) ?? 0) + 1);
  return disambiguateFilterOptionLabels([...values.entries()]
    .sort((left, right) => left[1].localeCompare(right[1], "zh-CN") || left[0].localeCompare(right[0]))
    .map(([value, label]) => ({
      value,
      label: labels.get(label) && labels.get(label)! > 1
        ? `${label || "未命名账户"} · #${dashboardStableShortId(value)}`
        : label || `未命名账户 · #${dashboardStableShortId(value)}`,
    })));
}

function simulationFilterOptions(entries: TradeLibraryEntry[]) {
  const values = new Map<string, Set<string>>();
  for (const entry of entries) {
    const instruments = [entry.instrument, ...entry.episodes.map(item => item.episode.instrument)];
    const instrumentLabels = new Set(instruments.map(dashboardInstrumentLabel));
    const runIds = [
      entry.simulationRunId,
      ...entry.episodes.map(item => item.episode.simulationRunId),
      ...allEntryExecutions(entry).map(execution => execution.source.simulationRunId),
    ].filter((value): value is string => Boolean(value));
    for (const runId of runIds) {
      const labels = values.get(runId) ?? new Set<string>();
      for (const label of instrumentLabels) labels.add(label);
      values.set(runId, labels);
    }
  }
  return disambiguateFilterOptionLabels([...values.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([value, instruments]) => {
      const labels = [...instruments].sort((left, right) => left.localeCompare(right, "zh-CN"));
      const subject = labels.length > 2
        ? `${labels.slice(0, 2).join("、")} 等${labels.length}个标的`
        : labels.join("、") || "未知标的";
      return {
        value,
        label: `${subject} · 运行 #${dashboardStableShortId(value)}`,
      };
    }));
}

function unavailableBreakdown(stats: { excludedCount: number; exclusionReasons: Record<string, number> }) {
  const open = stats.exclusionReasons.open ?? 0;
  return {
    open,
    closed: Math.max(stats.excludedCount - open, 0),
  };
}

function winRateLabel(stats: { winRate: { wins: number; denominator: number } | null }) {
  if (!stats.winRate) return "不可用";
  return `${Math.round(stats.winRate.wins / stats.winRate.denominator * 100)}%`;
}

function statsReason(value: string | null, reason: string | null): string | undefined {
  return value === null && reason ? reason : undefined;
}

function metricCard(
  label: string,
  value: string,
  detail: string,
  className?: string,
  title?: string,
) {
  return <div className={styles.metricCard} title={title}>
    <span>{label}</span>
    <strong className={className}>{value}</strong>
    <small>{detail}</small>
  </div>;
}

function groupLabel(group: DashboardGroup): string {
  return group.scope.label;
}

function qualityScopeLabel(filter: DashboardFilter, calendarMonth: string): string {
  const hasDateFilter = Boolean(
    filter.startDate ||
    filter.endDate ||
    (filter.year && filter.year !== "all"),
  );
  if (hasDateFilter) return `当前筛选日期范围，非下方月份（${calendarMonth} 日历）`;
  return `当前筛选全历史，非下方月份（${calendarMonth} 日历）`;
}

function trendColors(colorScheme: ChartSettings["colorScheme"]) {
  if (colorScheme === "green-red") return { positive: "#22c55e", negative: "#ef4444" };
  if (colorScheme === "blue-orange") return { positive: "#3b82f6", negative: "#f97316" };
  return { positive: "#26a69a", negative: "#ef5350" };
}

export function ReviewDashboard({ entries, onOpenInReview, colorScheme }: ReviewDashboardProps) {
  const [filter, setFilter] = useState<DashboardFilter>({
    market: "all",
    status: "all",
    account: "all",
    currency: "all",
    nature: "all",
    simulationRunId: "all",
  });
  const [calendarPeriod, setCalendarPeriod] = useState<DashboardCalendarPeriod>("day");
  const [calendarMonth, setCalendarMonth] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedCalendarKey, setSelectedCalendarKey] = useState<string | null>(null);

  const dashboardStyle = useMemo<CSSProperties>(() => {
    const colors = trendColors(colorScheme ?? "teal-red");
    return {
      "--dashboard-positive": colors.positive,
      "--dashboard-negative": colors.negative,
    } as CSSProperties;
  }, [colorScheme]);

  const model = useMemo(
    () => buildDashboardModel(entries, filter, calendarPeriod),
    [calendarPeriod, entries, filter],
  );
  const marketOptions = useMemo(() => dashboardMarketFilterOptions(entries), [entries]);
  const hasHongKongSourceOverlap = marketOptions.some(option => option.value === "HK") &&
    marketOptions.some(option => option.value === "hk-connect");
  const accountOptions = useMemo(() => accountFilterOptions(entries), [entries]);
  const currencyOptions = useMemo(() => [...new Set(entries.map(entry => entry.instrument.currency.trim().toUpperCase()).filter(Boolean))]
    .sort()
    .map(value => ({ value, label: value })), [entries]);
  const simulationRunOptions = useMemo(() => simulationFilterOptions(entries), [entries]);

  const selectedGroup = model.groups.find(group => group.scope.id === selectedGroupId) ?? model.groups[0];
  const selectedRows = selectedGroup?.rows ?? model.rows;
  const selectedStats = selectedGroup?.stats ?? model.stats;
  const recentMonth = selectedRows
    .filter(row => row.item.episode.status === "closed")
    .map(dashboardEpisodeDate)
    .sort()
    .at(-1)?.slice(0, 7) ?? null;
  const currentMonth = new Date().toISOString().slice(0, 7);
  const visibleCalendarMonth = calendarMonth ?? recentMonth ?? currentMonth;
  const selectedScopeId = selectedGroup?.scope.id ?? null;
  const autoCalendarScope = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (autoCalendarScope.current === selectedScopeId) return;
    autoCalendarScope.current = selectedScopeId;
    setCalendarMonth(recentMonth ?? currentMonth);
  }, [currentMonth, recentMonth, selectedScopeId]);
  const calendarCells = buildDashboardCalendar(selectedRows, calendarPeriod, selectedGroup?.scope.id);
  const dayGridCells = dayCellsForMonth(visibleCalendarMonth, calendarCells);
  const periodSummaryCells = periodCellsForMonth(visibleCalendarMonth, calendarPeriod, calendarCells);
  const selectedCell = calendarCells.find(cell => cell.key === selectedCalendarKey);
  const selectedCellRows = selectedCell
    ? selectedRows.filter(row => [...selectedCell.episodeIds, ...selectedCell.excludedEpisodeIds].includes(row.item.episode.id))
    : [];
  const updateFilter = (patch: Partial<DashboardFilter>) => {
    setFilter(current => ({ ...current, ...patch }));
    setSelectedCalendarKey(null);
  };
  const openRow = (row: DashboardRow) => {
    onOpenInReview(
      row.entry.instrument.id,
      row.item.episode.id,
      selectedRows.map(item => item.item.episode.id),
    );
  };
  const monthHasData = periodSummaryCells.some(cell => cell.trustedClosedCount > 0 || cell.excludedCount > 0);
  const emptyCalendarMessage = entries.length === 0
    ? "全局暂无已平仓回合。导入交易后，这里会显示按平仓日归属的记录。"
    : model.rows.length === 0
      ? "当前筛选没有已平仓回合。请调整市场、账户、币种或时间条件。"
      : !selectedRows.some(row => row.item.episode.status === "closed")
      ? "当前统计组暂无已平仓回合。"
      : !monthHasData
        ? "本月没有已平仓回合。可以跳转到最近有记录的月份。"
        : null;
  const globalUnavailable = unavailableBreakdown(model.stats);
  const selectedUnavailable = unavailableBreakdown(selectedStats);
  const filterCount = [
    filter.market && filter.market !== "all",
    filter.account && filter.account !== "all",
    filter.currency && filter.currency !== "all",
    filter.nature && filter.nature !== "all",
    filter.simulationRunId && filter.simulationRunId !== "all",
    Boolean(filter.query?.trim()),
    Boolean(filter.startDate || filter.endDate || (filter.year && filter.year !== "all")),
  ].filter(Boolean).length;

  return (
    <section className={styles.dashboard} style={dashboardStyle} aria-label="统计总览">
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Review dashboard</span>
          <h1>统计总览</h1>
          <p>复盘进度、收益质量与按平仓日归属的历史盈亏。</p>
        </div>
        <div className={styles.headerMeta}>
          <strong>{entries.length} 个标的</strong>
          <span>{model.rows.length} 个回合入选</span>
        </div>
      </header>

      <section className={styles.filters} aria-label="总览筛选">
        <div className={styles.filterHeading}>
          <div><Filter size={15} /><strong>统计范围</strong>{filterCount > 0 && <span>{filterCount} 项条件</span>}</div>
          {filterCount > 0 && <button type="button" onClick={() => { setFilter({ market: "all", status: "all", account: "all", currency: "all", nature: "all", simulationRunId: "all" }); setSelectedCalendarKey(null); }}>清除筛选</button>}
        </div>
        <div className={styles.filterGrid}>
          <label className={styles.searchField}>
            <span>搜索标的</span>
            <div><Search size={15} /><input type="search" aria-label="搜索总览标的" placeholder="名称或代码" value={filter.query ?? ""} onChange={event => updateFilter({ query: event.target.value })} /></div>
          </label>
          <FilterSelect label="市场" ariaLabel="总览市场筛选" value={filter.market ?? "all"} options={marketOptions} onChange={market => updateFilter({ market })} />
          <FilterSelect label="账户" ariaLabel="总览账户筛选" value={filter.account ?? "all"} options={[{ value: "all", label: "全部账户" }, ...accountOptions]} onChange={account => updateFilter({ account, accounts: undefined })} />
          <FilterSelect label="币种" ariaLabel="总览币种筛选" value={filter.currency ?? "all"} options={[{ value: "all", label: "全部币种" }, ...currencyOptions]} onChange={currency => updateFilter({ currency })} />
          <FilterSelect label="交易性质" ariaLabel="总览交易性质筛选" value={filter.nature ?? "all"} options={[{ value: "all", label: "全部性质" }, { value: "live", label: "实盘" }, { value: "simulation", label: "模拟盘" }, { value: "unknown", label: "来源未知" }]} onChange={nature => updateFilter({ nature: nature as DashboardFilter["nature"] })} />
          {simulationRunOptions.length > 0 && <FilterSelect label="模拟运行" ariaLabel="总览模拟运行筛选" value={filter.simulationRunId ?? "all"} options={[{ value: "all", label: "全部运行" }, ...simulationRunOptions]} onChange={simulationRunId => updateFilter({ simulationRunId })} />}
          <FilterSelect label="回合状态" ariaLabel="总览回合状态筛选" value={filter.status ?? "all"} options={[{ value: "all", label: "全部回合" }, { value: "pending", label: "待复盘" }, { value: "completed", label: "已复盘" }, { value: "deferred", label: "暂不复盘" }, { value: "open", label: "持仓中" }, { value: "closed", label: "已平仓" }]} onChange={status => updateFilter({ status: status as DashboardFilter["status"] })} />
          <label className={styles.filterField}><span>起始日期</span><input aria-label="总览起始日期" type="date" value={filter.startDate ?? ""} onChange={event => updateFilter({ startDate: event.target.value || null })} /></label>
          <label className={styles.filterField}><span>结束日期</span><input aria-label="总览结束日期" type="date" value={filter.endDate ?? ""} onChange={event => updateFilter({ endDate: event.target.value || null })} /></label>
        </div>
        <small className={styles.filterHint}>金额仅在同一市场范围、交易性质、模拟运行与币种内合并；跨币种或不同运行会分组显示。{hasHongKongSourceOverlap ? " 港股通与普通港股按成交来源识别；混合来源回合可能同时命中两个筛选，数量不可相加。" : ""}</small>
      </section>

      {model.groups.length > 1 && <section className={styles.scopeNotice} aria-label="统计范围提示">
        <div><strong>当前范围包含多个可比统计组</strong><span>当前统计组：{selectedGroup?.scope.label ?? "无"}。总览计数覆盖全部统计组，收益质量只计算当前统计组。</span></div>
        <label><span>统计组</span><select aria-label="总览统计范围" value={selectedGroup?.scope.id ?? ""} onChange={event => { setSelectedGroupId(event.target.value); setSelectedCalendarKey(null); }}>
          {model.groups.map(group => <option value={group.scope.id} key={group.scope.id}>{groupLabel(group)}</option>)}
        </select></label>
      </section>}

      <div className={styles.countHeading}>
        <div><span className={styles.eyebrow}>Global totals</span><strong>全局计数</strong></div>
        <small>当前筛选下全部统计组的回合计数；收益质量使用当前统计组。</small>
      </div>
      <section className={styles.countGrid} aria-label="复盘进度">
        {metricCard("全局回合总数", String(model.stats.sampleCount), `已复盘 ${model.stats.reviewedCount} · 待复盘 ${model.stats.pendingCount}`)}
        {metricCard("全局持仓状态", `${model.stats.closedCount} / ${model.stats.openCount}`, "已平仓 / 持仓中")}
        {metricCard("全局收益结果", `${model.stats.wins} 胜 · ${model.stats.losses} 负`, `持平 ${model.stats.breakEven}`)}
        {metricCard("全局可信已平仓", String(model.stats.trustedClosedCount), model.stats.trustedClosedCount
          ? model.stats.winRate ? `全局胜率 ${winRateLabel(model.stats)}` : "胜率见当前统计组"
          : "尚无可计算样本")}
        {metricCard("全局不可计算", String(model.stats.unavailableCount), `持仓中 ${globalUnavailable.open} · 已平仓不可用 ${globalUnavailable.closed}`)}
      </section>

      <section className={styles.metricsSection} aria-label="收益质量">
        <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>Quality</span><h2>收益质量</h2></div><span>{qualityScopeLabel(filter, visibleCalendarMonth)} · 当前统计组：{selectedGroup?.scope.label ?? (model.stats.groupReason ?? "无")}</span></div>
        <div className={styles.metricGrid}>
          {metricCard("胜率", winRateLabel(selectedStats), selectedStats.winRate
            ? `${selectedStats.winRate.wins} / ${selectedStats.winRate.denominator} 个可信已平仓回合`
            : selectedStats.groupReason ?? "没有可计算样本", selectedStats.winRate ? styles.positive : styles.neutral)}
          {metricCard("可信样本", String(selectedStats.trustedClosedCount), "当前统计组用于收益质量计算")}
          {metricCard("排除样本", String(selectedStats.excludedCount), `持仓中 ${selectedUnavailable.open} · 已平仓不可用 ${selectedUnavailable.closed}`, styles.neutral)}
          {metricCard("净盈亏", money(selectedStats.netPnl, selectedStats.currency), selectedStats.netPnl === null ? (selectedStats.groupReason ?? "没有可计算的已平仓回合") : `已扣已知费用 · ${selectedStats.trustedClosedCount} 个样本`, signedClass(selectedStats.netPnl), selectedStats.groupReason ?? undefined)}
          {metricCard("平均盈利", money(selectedStats.averageWin, selectedStats.currency), selectedStats.averageWin === null ? (selectedStats.payoffReason ?? "没有盈利样本") : `${selectedStats.wins} 个盈利回合`, styles.positive, statsReason(selectedStats.averageWin, selectedStats.payoffReason))}
          {metricCard("平均亏损额", amount(selectedStats.averageLoss, selectedStats.currency), selectedStats.averageLoss === null ? (selectedStats.payoffReason ?? "没有亏损样本") : `${selectedStats.losses} 个亏损回合`, styles.negative, statsReason(selectedStats.averageLoss, selectedStats.payoffReason))}
          {metricCard("盈亏比", ratio(selectedStats.payoff), selectedStats.payoff === null ? (selectedStats.payoffReason ?? "无法计算") : "平均盈利 ÷ 平均亏损绝对值", undefined, selectedStats.payoffReason ?? undefined)}
          {metricCard("利润因子", ratio(selectedStats.profitFactor), selectedStats.profitFactor === null ? (selectedStats.profitFactorReason ?? "无法计算") : "盈利总额 ÷ 亏损总额绝对值", undefined, selectedStats.profitFactorReason ?? undefined)}
          {metricCard("费用", amount(selectedStats.fees, selectedStats.currency), selectedStats.fees === null
            ? (selectedStats.groupReason ?? "没有可计算的已平仓回合")
            : "可信已平仓已知费用")}
        </div>
        {selectedStats.excludedCount > 0 && <details className={styles.exclusionDetails}>
          <summary>查看当前统计组 {selectedStats.excludedCount} 个排除样本及原因</summary>
          <div>{Object.entries(selectedStats.exclusionReasons).map(([reason, count]) => <span key={reason}>{exclusionReasonLabel(reason)}：{count}</span>)}</div>
        </details>}
      </section>

      <section className={styles.calendarSection} aria-label="盈亏日历">
        <div className={styles.sectionHeading}>
          <div><span className={styles.eyebrow}>Closed episodes</span><h2>盈亏日历</h2><p>按每个回合的最后平仓交易日计一次；当前显示 {calendarPeriod === "day" ? "日历日" : calendarPeriod === "week" ? "周汇总" : "月汇总"}。</p></div>
          <div className={styles.calendarControls}>
            <button type="button" aria-label="上一个月" onClick={() => { setCalendarMonth(monthShift(visibleCalendarMonth, -1)); setSelectedCalendarKey(null); }}><ChevronLeft size={16} /></button>
            <strong>{visibleCalendarMonth.slice(0, 4)} 年 {Number(visibleCalendarMonth.slice(5, 7))} 月</strong>
            <button type="button" aria-label="下一个月" onClick={() => { setCalendarMonth(monthShift(visibleCalendarMonth, 1)); setSelectedCalendarKey(null); }}><ChevronRight size={16} /></button>
            {recentMonth && recentMonth !== visibleCalendarMonth && <button type="button" className={styles.textButton} onClick={() => { setCalendarMonth(recentMonth); setSelectedCalendarKey(null); }}>最近有记录</button>}
          </div>
        </div>
        <div className={styles.periodTabs} role="group" aria-label="日历粒度">
          {(["day", "week", "month"] as const).map(period => <button type="button" key={period} aria-pressed={calendarPeriod === period} onClick={() => { setCalendarPeriod(period); setSelectedCalendarKey(null); }}>{period === "day" ? "月历" : period === "week" ? "周汇总" : "月汇总"}</button>)}
        </div>
        {calendarPeriod === "day" ? <>
          <div className={styles.weekdayRow}>{["一", "二", "三", "四", "五", "六", "日"].map(day => <span key={day}>周{day}</span>)}</div>
          <div className={styles.calendarGrid}>
            {dayGridCells.map(value => value.blank ? <span className={styles.calendarBlank} key={value.key} /> : <button type="button" key={value.key} className={`${styles.calendarCell} ${styles[`state${value.cell.state}`]} ${selectedCalendarKey === value.key ? styles.selected : ""}`} aria-label={`${value.key}${value.cell.netPnl === null ? `，${value.cell.state === "unavailable" ? "不可用" : "无已平仓回合"}` : `，${cellValue(value.cell, selectedStats.currency)}`}`} aria-pressed={selectedCalendarKey === value.key} onClick={() => { setSelectedCalendarKey(value.key); }}>
              <span>{Number(value.key.slice(8, 10))}</span><strong>{value.cell.netPnl === null ? value.cell.state === "unavailable" ? "不可用" : "" : money(value.cell.netPnl, selectedStats.currency)}</strong><small>{value.cell.trustedClosedCount ? `${value.cell.trustedClosedCount} 回合` : value.cell.excludedCount ? `${value.cell.excludedCount} 待核对` : ""}</small>
            </button>)}
          </div>
          {emptyCalendarMessage && <p className={styles.emptyCalendar}>{emptyCalendarMessage}</p>}
        </> : <div className={styles.periodList}>
          {periodSummaryCells.length === 0 && <p className={styles.emptyCalendar}>{emptyCalendarMessage ?? "本月没有已平仓回合。可以跳转到最近有记录的月份。"}</p>}
          {periodSummaryCells.map(cell => <button type="button" key={cell.key} className={`${styles.periodRow} ${styles[`state${cell.state}`]} ${selectedCalendarKey === cell.key ? styles.selected : ""}`} aria-pressed={selectedCalendarKey === cell.key} onClick={() => setSelectedCalendarKey(cell.key)}><span><strong>{cell.label}</strong><small>{cell.startDate}—{cell.endDate}</small></span><strong>{cellValue(cell, selectedStats.currency)}</strong><small>{cell.trustedClosedCount ? `${cell.trustedClosedCount} 个已平仓回合` : cell.excludedCount ? `${cell.excludedCount} 个待核对` : "无记录"}</small></button>)}
        </div>}
        {selectedCell && <section className={styles.drilldown} aria-label="日历下钻明细">
          <div><div><span className={styles.eyebrow}>Drilldown</span><h3>{selectedCell.label}</h3></div><span className={selectedCell.state === "unavailable" ? styles.warning : signedClass(selectedCell.netPnl)}>{cellValue(selectedCell, selectedStats.currency)}</span></div>
          {selectedCell.unavailableReason && <p className={styles.warningText}>{selectedCell.unavailableReason}</p>}
          {selectedCellRows.length === 0 ? <p>该日期没有已平仓回合。</p> : <div className={styles.drilldownRows}>{selectedCellRows.map(row => {
            const excluded = dashboardRowExclusionReason(row);
            const sourceLabel = rowSourceLabel(row);
            return <div className={styles.drilldownRow} key={row.item.episode.id}>
              <div><strong>{rowDisplayName(row)}</strong><small>{dashboardEpisodeDate(row)} · {row.item.episode.status === "open" ? "持仓中" : excluded ? exclusionReasonLabel(excluded) : "已平仓"}{sourceLabel ? ` · ${sourceLabel}` : ""}</small></div>
              <div><strong className={signedClass(row.item.metrics.netPnl)}>{excluded ? "不可用" : money(row.item.metrics.netPnl, row.entry.instrument.currency)}</strong><button type="button" onClick={() => openRow(row)}>打开复盘</button></div>
            </div>;
          })}</div>}
        </section>}
      </section>

      <section className={styles.groupSection} aria-label="统计分组">
        <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>Comparable scopes</span><h2>统计分组</h2></div><span>{model.groups.length} 个范围</span></div>
        {model.groups.length === 0 ? <div className={styles.emptyState}><strong>{entries.length ? "当前筛选没有回合" : "导入交易后查看统计总览"}</strong><span>{entries.length ? "调整市场、账户、币种或时间条件。" : "已有交易数据会自动出现在这里。"}</span></div> : <div className={styles.groupList}>{model.groups.map(group => <button type="button" key={group.scope.id} className={`${styles.groupRow} ${selectedGroup?.scope.id === group.scope.id ? styles.selected : ""}`} onClick={() => { setSelectedGroupId(group.scope.id); setSelectedCalendarKey(null); }}><span><strong>{group.scope.label}</strong><small>{group.scope.actualMarkets.length > 1 ? `覆盖 ${group.scope.actualMarkets.join("、")}` : ""}</small></span><span>{group.stats.sampleCount} 回合 · 已复盘 {group.stats.reviewedCount}</span><strong className={signedClass(group.stats.netPnl)}>{money(group.stats.netPnl, group.scope.currency)}</strong><span>{group.stats.payoff === null ? "盈亏比不可用" : `盈亏比 ${ratio(group.stats.payoff)}`} · {group.stats.profitFactor === null ? "利润因子不可用" : `利润因子 ${ratio(group.stats.profitFactor)}`}</span><ChevronRight size={16} /></button>)}</div>}
      </section>
    </section>
  );
}
