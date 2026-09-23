"use client";

import { Fragment, useEffect, useState } from "react";

import { formatMarketTradingDate } from "../../lib/market/trading-date";
import { instrumentPresentation } from "../../lib/instruments/instrument-presentation";
import {
  buildReviewQueue,
  hasTrustedClosedMetrics,
  REVIEW_QUEUE_SORT_OPTIONS,
  reviewQueueBrokerOptions,
  reviewQueueBrokerTags,
  reviewQueueEpisodeIds,
  reviewQueueMarketLabel,
  reviewState,
  stableAccountDisplayLabels,
  type ReviewQueueFilter,
  type ReviewQueueItem,
  type ReviewQueueSort,
} from "../../lib/reviews/review-queue";
import { buildReviewQueueSummary } from "../../lib/reviews/review-queue-summary";
import type { LibraryPerformanceSummary } from "../../lib/reviews/library-performance";
import {
  dashboardMarketFilterOptions,
  dashboardRowMarketSourceLabel,
  exclusionReasonLabel,
} from "../../lib/reviews/dashboard";
import type { TradeLibraryEntry } from "../../lib/trades/library";

type Props = {
  entries: TradeLibraryEntry[];
  rows?: ReviewQueueItem[];
  pendingRows?: ReviewQueueItem[];
  filter: ReviewQueueFilter;
  onFilter: (filter: ReviewQueueFilter) => void;
  onOpen: (row: ReviewQueueItem, queueIds?: string[]) => void;
  onBrowseStocks: () => void;
  notice?: string;
  /** The library shell owns the shared toolbar when this list is embedded. */
  compact?: boolean;
  performanceByEpisode?: ReadonlyMap<string, LibraryPerformanceSummary>;
  onSort?: (sort: ReviewQueueSort) => void;
  performanceSortAvailability?: { allowed: boolean; reason: string | null };
  page?: number;
  onPageChange?: (page: number) => void;
  reportCurrency?: "original" | "CNY";
};

const REVIEW_QUEUE_PAGE_SIZE = 100;
const REVIEW_QUEUE_COLUMNS_KEY = "tradereview:review-queue-columns:v1";
type OptionalColumn = "fees" | "return" | "source" | "account";
const OPTIONAL_COLUMNS: ReadonlyArray<{ id: OptionalColumn; label: string }> = [
  { id: "fees", label: "费用" },
  { id: "return", label: "收益率" },
  { id: "source", label: "来源" },
  { id: "account", label: "账户" },
];
const DEFAULT_COLUMNS: Record<OptionalColumn, boolean> = { fees: false, return: true, source: true, account: true };

function money(value: string | null, currency: string) {
  if (value === null) return "待核对";
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
    signDisplay: "always",
  }).format(Number(value));
}

function amount(value: string | null, currency: string) {
  if (value === null) return "不可用";
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function percent(value: string | null) {
  return value === null ? "待核对" : `${Number(value).toFixed(2)}%`;
}

function performanceUnavailableText(reason: string | null): string {
  if (reason === "missing-fx" || reason === "invalid-fx") return "人民币暂无法折算";
  if (reason === "multiple-scopes") return "绩效不可比较";
  if (reason === "no-trusted-closed") return "没有可信已平仓盈亏";
  return "绩效暂不可用";
}

function rawPerformanceText(performance: LibraryPerformanceSummary): string {
  if (performance.rawCurrencyGroups.length === 0) return "暂无可信原币样本";
  return performance.rawCurrencyGroups
    .map(group => `${group.currency} ${group.netPnl === null ? "不可用" : money(group.netPnl, group.currency)}`)
    .join("；");
}

function holding(value: number | null, open: boolean) {
  if (open) return "持仓中";
  if (value === null || !Number.isFinite(value)) return "时长待核对";
  const minutes = Math.round(value / 60_000);
  if (minutes < 60) return `持仓 ${minutes} 分钟`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `持仓 ${hours} 小时`;
  return `持仓 ${Math.round(hours / 24)} 天`;
}

function coverageWarningDetails(warnings: ReviewQueueItem["item"]["episode"]["warnings"]) {
  if (!warnings?.length) return null;
  const ranges = [...new Set(warnings.map(({ from, to }) => `${from} 至 ${to}`))].join("、");
  return {
    title: `账单缺月：${ranges}`,
    ariaLabel: `账单缺月，持仓边界一致；缺失区间：${ranges}`,
  };
}

function reviewLabel(item: ReviewQueueItem["item"]) {
  const state = reviewState(item);
  return state === "completed" ? "已复盘" : state === "deferred" ? "暂不复盘" : "待复盘";
}

function selectedAccountIds(filter: ReviewQueueFilter) {
  return filter.accounts ?? (filter.account && filter.account !== "all" ? [filter.account] : []);
}

function advancedFilterCount(filter: ReviewQueueFilter) {
  // Trading nature is a shared always-visible library filter; do not count it
  // as an advanced condition or change the drawer label when it is live.
  return [filter.year, filter.simulationRunId]
    .filter(value => Boolean(value && value !== "all")).length +
    selectedAccountIds(filter).length;
}

function toggleFilterValue(values: ReadonlyArray<string>, value: string) {
  return values.includes(value)
    ? values.filter(item => item !== value)
    : [...values, value];
}

function currencyGroupsRequired(rows: ReviewQueueItem[], sort: ReviewQueueFilter["sort"]) {
  return (sort === "net-profit" || sort === "net-loss") &&
    new Set(rows.map(row => row.entry.instrument.currency)).size > 1;
}

function isPerformanceSort(sort: ReviewQueueSort) {
  return sort === "net-profit" || sort === "net-loss" || sort === "return-high" || sort === "return-low";
}

function QueueSummary({ rows, year }: { rows: ReviewQueueItem[]; year?: string }) {
  const summary = buildReviewQueueSummary(rows);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const selectedGroup = summary.groups.find(group => group.id === selectedGroupId) ?? summary.groups[0];
  return (
    <section className="review-queue-summary" aria-label="当前筛选汇总">
      <div className="review-queue-summary-heading">
        <div>
          <strong>当前筛选</strong>
          <span>{summary.sampleCount} 个回合 · 已复盘 {summary.reviewedCount} 个 · 可信已平仓 {summary.trustedClosedCount} 个</span>
        </div>
        <span className="review-queue-sharpe" title="夏普需要账户资金净值与等间隔周期收益序列">
          夏普：暂不可计算（{summary.sharpe.reason}）
        </span>
      </div>
      {selectedGroup && <div className="review-queue-summary-selected">
        <strong className="review-queue-summary-scope">{selectedGroup.label}</strong>
        {summary.groups.length > 1 && <label><span>统计范围</span><select aria-label="队列汇总范围" value={selectedGroup.id} onChange={event => setSelectedGroupId(event.target.value)}>{summary.groups.map(group => <option key={group.id} value={group.id}>{group.label}</option>)}</select></label>}
        <dl>
          <div><dt>净盈亏</dt><dd>{selectedGroup.netPnl === null ? "不可用" : money(selectedGroup.netPnl, selectedGroup.currency)}</dd></div>
          <div><dt>胜率</dt><dd>{selectedGroup.winRate ? `${selectedGroup.winRate.denominator ? `${Math.round(selectedGroup.winRate.wins / selectedGroup.winRate.denominator * 100)}%` : "不可用"} · ${selectedGroup.winRate.wins} / ${selectedGroup.winRate.denominator}` : "不可用"}</dd></div>
          <div><dt>平均盈利</dt><dd>{selectedGroup.averageWin === null ? "不可用" : money(selectedGroup.averageWin, selectedGroup.currency)}</dd></div>
          <div><dt>平均亏损额</dt><dd>{selectedGroup.averageLoss === null ? "不可用" : amount(selectedGroup.averageLoss, selectedGroup.currency)}</dd></div>
          <div><dt>盈亏比</dt><dd title={selectedGroup.payoffReason ?? undefined}>{selectedGroup.payoff === null ? `不可用${selectedGroup.payoffReason ? `（${selectedGroup.payoffReason}）` : ""}` : `${Number(selectedGroup.payoff).toFixed(2)}`}</dd></div>
          <div><dt>利润因子</dt><dd title={selectedGroup.profitFactorReason ?? undefined}>{selectedGroup.profitFactor === null ? `不可用${selectedGroup.profitFactorReason ? `（${selectedGroup.profitFactorReason}）` : ""}` : `${Number(selectedGroup.profitFactor).toFixed(2)}`}</dd></div>
          <div><dt>保本</dt><dd>{selectedGroup.breakEven}</dd></div>
          <div><dt>排除</dt><dd>{selectedGroup.excludedCount}</dd></div>
        </dl>
        <small>按入选完整回合统计；净盈亏已扣已知费用{year && year !== "all" ? "；年份筛选仅筛选回合，不代表年度现金流" : ""}</small>
        {Object.keys(selectedGroup.exclusionReasons).length > 0 && <small>排除原因：{Object.entries(selectedGroup.exclusionReasons).map(([reason, count]) => `${exclusionReasonLabel(reason)} ${count}`).join("；")}</small>}
        {selectedGroup.winRate && selectedGroup.trustedClosedCount > 0 && selectedGroup.trustedClosedCount < 5 && <small>样本有限</small>}
      </div>}
      {!selectedGroup && <p className="review-queue-summary-empty">当前范围暂无可汇总回合。</p>}
    </section>
  );
}

export function ReviewQueue({ entries, rows: suppliedRows, pendingRows: suppliedPendingRows, filter, onFilter, onOpen, onBrowseStocks, notice, compact = false, performanceByEpisode, onSort, performanceSortAvailability, page = 1, onPageChange, reportCurrency = "CNY" }: Props) {
  const rows = suppliedRows ?? buildReviewQueue(entries, filter);
  const pending = suppliedPendingRows ?? buildReviewQueue(entries, { ...filter, status: "pending" });
  const [localPage, setLocalPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [visibleColumns, setVisibleColumns] = useState<Record<OptionalColumn, boolean>>(() => {
    if (typeof window === "undefined") return DEFAULT_COLUMNS;
    try {
      const stored = JSON.parse(window.localStorage.getItem(REVIEW_QUEUE_COLUMNS_KEY) ?? "null") as Partial<Record<OptionalColumn, boolean>> | null;
      return stored ? { ...DEFAULT_COLUMNS, ...Object.fromEntries(OPTIONAL_COLUMNS.map(({ id }) => [id, stored[id] === true])) } : DEFAULT_COLUMNS;
    } catch { return DEFAULT_COLUMNS; }
  });
  const [columnsOpen, setColumnsOpen] = useState(false);
  useEffect(() => {
    try { window.localStorage.setItem(REVIEW_QUEUE_COLUMNS_KEY, JSON.stringify(visibleColumns)); } catch { /* optional storage */ }
  }, [visibleColumns]);
  const pageCount = Math.max(1, Math.ceil(rows.length / REVIEW_QUEUE_PAGE_SIZE));
  const requestedPage = onPageChange ? page : localPage;
  const currentPage = Math.min(Math.max(requestedPage, 1), pageCount);
  const pageStart = (currentPage - 1) * REVIEW_QUEUE_PAGE_SIZE;
  const visibleRows = rows.slice(pageStart, pageStart + REVIEW_QUEUE_PAGE_SIZE);
  const changePage = (nextPage: number) => {
    if (onPageChange) onPageChange(nextPage);
    else setLocalPage(nextPage);
  };
  const accounts = [...new Map(entries.flatMap(entry => entry.executions).map(fill => [fill.accountId, fill.accountLabel])).entries()];
  const accountDisplayLabels = stableAccountDisplayLabels(accounts.map(([id, label]) => ({ id, label })));
  const selectedAccounts = selectedAccountIds(filter);
  const brokerOptions = reviewQueueBrokerOptions(entries);
  const selectedBrokers = filter.brokers ?? [];
  const years = [...new Set(entries.flatMap(entry => entry.executions.map(fill => formatMarketTradingDate(fill.executedAt, entry.instrument.market).slice(0, 4))))].sort().reverse();
  const markets = dashboardMarketFilterOptions(entries);
  const simulationRuns = [...new Set(entries.map(entry => entry.simulationRunId).filter((value): value is string => Boolean(value)))].sort();
  const advancedExpanded = filter.advancedExpanded === true;
  const advancedCount = advancedFilterCount(filter);
  const showCurrencyGroups = currencyGroupsRequired(visibleRows, filter.sort);
  const queueIds = reviewQueueEpisodeIds(rows);
  const activeSort = filter.sort ?? "newest";
  const sortDirection = (column: "date" | "pnl" | "return") => {
    if (column === "date") {
      if (activeSort === "newest") return "降序";
      if (activeSort === "oldest") return "升序";
    }
    if (column === "pnl") {
      if (activeSort === "net-profit") return "降序";
      if (activeSort === "net-loss") return "升序";
    }
    if (column === "return") {
      if (activeSort === "return-high") return "降序";
      if (activeSort === "return-low") return "升序";
    }
    return "未排序";
  };
  const changeSort = (sort: ReviewQueueSort) => {
    if (isPerformanceSort(sort) && performanceSortAvailability && !performanceSortAvailability.allowed) {
      if (onSort) onSort("newest");
      else onFilter({ ...filter, sort: "newest" });
      return;
    }
    if (onSort) onSort(sort);
    else onFilter({ ...filter, sort });
  };
  const toggleSort = (column: "date" | "pnl" | "return") => {
    if (column === "date") return changeSort(activeSort === "newest" ? "oldest" : "newest");
    if (column === "pnl") return changeSort(activeSort === "net-profit" ? "net-loss" : "net-profit");
    return changeSort(activeSort === "return-high" ? "return-low" : "return-high");
  };
  const performanceSortDisabled = Boolean(performanceSortAvailability && !performanceSortAvailability.allowed);
  const selectedRows = rows.filter(row => selectedIds.has(row.item.episode.id));
  const toggleSelected = (id: string) => setSelectedIds(current => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const openSelected = () => {
    if (!selectedRows[0]) return;
    onOpen(selectedRows[0], selectedRows.map(row => row.item.episode.id));
  };

  return (
    <section className="review-queue" aria-label="回合复盘队列">
      {!compact && <>
        <header className="library-header">
          <div><span className="eyebrow">Review queue</span><h1>从一回合开始</h1><p>看清一个决策，留下一条下次行动。</p></div>
          <button type="button" onClick={onBrowseStocks}>按标的浏览</button>
        </header>
        {notice && <p role="status" className="review-queue-notice">{notice}</p>}
        <div className="review-queue-start">
          <div><strong>{pending.length}</strong><span> 个回合待复盘</span></div>
          {pending[0] && <button type="button" className="primary-action" onClick={() => onOpen(pending[0], queueIds)}>开始复盘</button>}
        </div>
        <nav className="review-status-tabs" aria-label="按复盘状态筛选">
          {([["pending", "待复盘"], ["completed", "已复盘"], ["all", "全部回合"]] as const).map(([status, label]) => (
            <button key={status} type="button" aria-pressed={(filter.status ?? "pending") === status} onClick={() => onFilter({ ...filter, status })}>{label}</button>
          ))}
        </nav>

        <nav className="review-market-tabs" aria-label="按市场筛选">
          {markets.map(({ value, label }) => {
            return <button key={value} type="button" aria-pressed={(filter.market ?? "all") === value} onClick={() => onFilter({ ...filter, market: value })}>{label}</button>;
          })}
        </nav>

        <div className="review-queue-filter-panel">
          <div className="review-queue-main-filters">
            <label className="review-queue-search"><span>搜索标的</span><input type="search" aria-label="搜索复盘回合" placeholder="名称或代码" value={filter.query ?? ""} onChange={event => onFilter({ ...filter, query: event.target.value })} /></label>
            <div className="review-queue-brokers" role="group" aria-label="按券商筛选">
              <span>券商</span>
              <div>
                {brokerOptions.map(({ id, label }) => <button key={id} type="button" aria-pressed={selectedBrokers.includes(id)} onClick={() => onFilter({ ...filter, brokers: toggleFilterValue(selectedBrokers, id) })}>{label}</button>)}
                {brokerOptions.length === 0 && <small>来源未知</small>}
              </div>
            </div>
            <label><span>排序</span><select aria-label="回合排序" value={filter.sort ?? "newest"} onChange={event => onFilter({ ...filter, sort: event.target.value as ReviewQueueFilter["sort"] })}>{REVIEW_QUEUE_SORT_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            <button type="button" className="review-queue-advanced-toggle" aria-expanded={advancedExpanded} aria-controls="review-queue-advanced-filters" onClick={() => onFilter({ ...filter, advancedExpanded: !advancedExpanded })}>更多筛选{advancedCount > 0 ? `（${advancedCount}）` : ""}</button>
          </div>
          <div className="review-queue-active-filters" aria-label="当前启用筛选">
            {filter.market && filter.market !== "all" && <span className="review-queue-filter-tag">市场：{markets.find(option => option.value === filter.market)?.label ?? reviewQueueMarketLabel(filter.market)}<button type="button" aria-label={`移除市场筛选 ${markets.find(option => option.value === filter.market)?.label ?? reviewQueueMarketLabel(filter.market)}`} onClick={() => onFilter({ ...filter, market: "all" })}>×</button></span>}
            {selectedBrokers.map(id => <span className="review-queue-filter-tag" key={id}>券商：{brokerOptions.find(option => option.id === id)?.label ?? id}<button type="button" aria-label={`移除券商筛选 ${brokerOptions.find(option => option.id === id)?.label ?? id}`} onClick={() => onFilter({ ...filter, brokers: selectedBrokers.filter(value => value !== id) })}>×</button></span>)}
            {selectedAccounts.map(id => <span className="review-queue-filter-tag" key={id}>账户：{accountDisplayLabels.get(id) ?? id}<button type="button" aria-label={`移除账户筛选 ${accountDisplayLabels.get(id) ?? id}`} onClick={() => onFilter({ ...filter, accounts: selectedAccounts.filter(value => value !== id), account: undefined })}>×</button></span>)}
            {filter.query?.trim() && <span className="review-queue-filter-tag">搜索：{filter.query.trim()}</span>}
          </div>
          {advancedExpanded && <div id="review-queue-advanced-filters" className="review-queue-advanced-filters" role="group" aria-label="高级筛选">
            <label><span>年份</span><select aria-label="复盘年份" value={filter.year ?? "all"} onChange={event => onFilter({ ...filter, year: event.target.value })}><option value="all">全部年份</option>{years.map(year => <option key={year}>{year}</option>)}</select></label>
            {simulationRuns.length > 0 && <label><span>模拟运行</span><select aria-label="复盘模拟运行" value={filter.simulationRunId ?? "all"} onChange={event => onFilter({ ...filter, simulationRunId: event.target.value })}><option value="all">全部运行</option>{simulationRuns.map(run => <option key={run}>{run}</option>)}</select></label>}
            <div className="review-queue-accounts-row"><fieldset className="review-queue-account-tags"><legend>账户标签</legend><div>{accounts.map(([id, label]) => {
              const displayLabel = accountDisplayLabels.get(id) ?? label;
              return <label key={id} className="review-queue-account-tag"><input type="checkbox" aria-label={`账户筛选 ${displayLabel}`} checked={selectedAccounts.includes(id)} onChange={() => onFilter({ ...filter, accounts: toggleFilterValue(selectedAccounts, id), account: undefined })} /><span>{displayLabel}</span></label>;
            })}</div></fieldset>
            <div className="review-queue-advanced-actions"><button type="button" className="review-queue-clear-accounts" onClick={() => onFilter({ ...filter, accounts: [], account: undefined })}>清除账户标签</button><button type="button" className="review-queue-clear-advanced" onClick={() => onFilter({ ...filter, accounts: [], account: undefined, year: "all", nature: "all", simulationRunId: "all" })}>清除高级条件</button></div></div>
          </div>}
          {!advancedExpanded && advancedCount > 0 && <p className="review-queue-filter-state">高级条件已启用 {advancedCount} 项</p>}
        </div>
      </>}

      {!compact && <QueueSummary rows={rows} year={filter.year} />}
      <div className="review-queue-batch-toolbar" aria-label="批量复盘操作">
        <span>已选 {selectedRows.length} 个回合</span>
        <button type="button" onClick={() => setSelectedIds(new Set())} disabled={selectedIds.size === 0}>取消选择</button>
        <button type="button" className="primary-action" onClick={openSelected} disabled={selectedRows.length === 0}>加入本次复盘队列</button>
        <details open={columnsOpen} onToggle={event => setColumnsOpen(event.currentTarget.open)}>
          <summary>列设置</summary>
          <div role="group" aria-label="复盘队列列设置">
            {OPTIONAL_COLUMNS.map(({ id, label }) => <label key={id}><input type="checkbox" checked={visibleColumns[id]} onChange={event => setVisibleColumns(current => ({ ...current, [id]: event.target.checked }))} />{label}</label>)}
          </div>
        </details>
      </div>
      <div className="review-queue-head" role="row" aria-label="回合列表排序">
        <div className="review-queue-head-columns">
          <span role="columnheader">标的 / 账户</span>
          <span role="columnheader"><button type="button" aria-label={`按成交时间排序（${sortDirection("date")}）`} onClick={() => toggleSort("date")}>
            最近成交 <small aria-hidden="true">{sortDirection("date") === "降序" ? "↓" : sortDirection("date") === "升序" ? "↑" : "↕"}</small>
          </button></span>
          <span role="columnheader" className="review-queue-head-result">
            <button type="button" aria-label={`按 ${reportCurrency === "original" ? "原币" : "CNY"} 净盈亏排序（${sortDirection("pnl")}）`} disabled={performanceSortDisabled} title={performanceSortDisabled ? performanceSortAvailability?.reason ?? undefined : undefined} onClick={() => toggleSort("pnl")}>
              {reportCurrency === "original" ? "原币" : "CNY"} 净盈亏 <small aria-hidden="true">{sortDirection("pnl") === "降序" ? "↓" : sortDirection("pnl") === "升序" ? "↑" : "↕"}</small>
            </button>
            <button type="button" aria-label={`按加权收益率排序（${sortDirection("return")}）`} disabled={performanceSortDisabled} title={performanceSortDisabled ? performanceSortAvailability?.reason ?? undefined : undefined} onClick={() => toggleSort("return")}>
              加权收益率 <small aria-hidden="true">{sortDirection("return") === "降序" ? "↓" : sortDirection("return") === "升序" ? "↑" : "↕"}</small>
            </button>
          </span>
          <span role="columnheader">复盘状态</span>
        </div>
        <span aria-hidden="true" className="review-queue-head-spacer" />
      </div>
      <div className="review-queue-list">
        {visibleRows.map((row, index) => {
          const { entry, item } = row;
          const presentation = instrumentPresentation(entry.instrument);
          const accountDisplayLabel = accountDisplayLabels.get(item.episode.accountId) ?? item.episode.accountLabel;
          const brokerTags = reviewQueueBrokerTags(row);
          const state = reviewState(item);
          const trusted = hasTrustedClosedMetrics(item);
          const performance = performanceByEpisode?.get(item.episode.id);
          const cny = performance?.cny.available && performance.cny.netPnl !== null
            ? performance.cny
            : null;
          const rawGroup = performance?.rawCurrencyGroups.find(group => group.currency === entry.instrument.currency);
          const originalPnl = rawGroup?.netPnl;
          const originalReturn = rawGroup?.weightedReturn;
          const pnl = item.episode.status === "open"
            ? "持仓中 · 最终盈亏未定"
            : reportCurrency === "original" && originalPnl !== null && originalPnl !== undefined ? money(originalPnl, entry.instrument.currency) : cny ? money(cny.netPnl, "CNY") : performance
              ? performanceUnavailableText(performance.cny.reason)
              : trusted ? money(item.metrics.netPnl, entry.instrument.currency) : "盈亏待核对";
          const resultClass = !trusted || (reportCurrency !== "original" && Boolean(performance) && !cny)
            ? "neutral"
            : Number(item.metrics.netPnl) > 0
              ? "positive"
              : Number(item.metrics.netPnl) < 0 ? "negative" : "neutral";
          const coverageWarning = coverageWarningDetails(item.episode.warnings);
          const sourceLabel = dashboardRowMarketSourceLabel({ entry, item });
          const accessibleName = `复盘${presentation.primaryName} ${formatMarketTradingDate(item.episode.startedAt, entry.instrument.market)} ${accountDisplayLabel}（${reviewQueueMarketLabel(entry.instrument.market)}${sourceLabel ? `，${sourceLabel}` : ""}，原名：${presentation.originalName}，${presentation.secondaryName}）`;
          const previousCurrency = visibleRows[index - 1]?.entry.instrument.currency;
          return <Fragment key={item.episode.id}>
            {showCurrencyGroups && previousCurrency !== entry.instrument.currency && <h3 className="review-queue-currency-heading">{entry.instrument.currency} · 金额排序分组</h3>}
            <div className="review-queue-row-shell">
            <div role="button" tabIndex={0} className="review-queue-row" onClick={() => onOpen(row, queueIds)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onOpen(row, queueIds); } }} aria-label={accessibleName}>
              <input type="checkbox" aria-label={`选择复盘回合 ${presentation.primaryName} ${formatMarketTradingDate(item.episode.startedAt, entry.instrument.market)}`} checked={selectedIds.has(item.episode.id)} onClick={event => event.stopPropagation()} onChange={() => toggleSelected(item.episode.id)} />
              <span className="review-queue-identity"><strong title={presentation.originalName}>{presentation.primaryName}</strong><small>{presentation.secondaryName}{presentation.hasChineseName ? "" : " · 中文名未补全"}</small>{visibleColumns.account && <small data-column="account">账户 · {accountDisplayLabel}</small>}</span>
              <span className="review-queue-window"><strong>{formatMarketTradingDate(item.episode.startedAt, entry.instrument.market)}—{item.episode.endedAt ? formatMarketTradingDate(item.episode.endedAt, entry.instrument.market) : "持仓中"}</strong><small>{reviewQueueMarketLabel(entry.instrument.market)}{visibleColumns.source && sourceLabel && <> · {sourceLabel}</>} · {item.metrics.buyCount + item.metrics.sellCount} 笔成交{visibleColumns.source && brokerTags.length > 0 && <span className="review-queue-broker-tags" aria-label="来源券商">{brokerTags.map(tag => <span key={tag.id}>{tag.label}</span>)}</span>}</small></span>
              <span className={`review-queue-result ${resultClass}`}><strong>{pnl}</strong>{visibleColumns.return && <small data-column="return">{item.episode.status === "open" ? "最终盈亏未定 · 持仓中" : reportCurrency === "original" ? `${percent(originalReturn ?? (trusted ? item.metrics.returnPercent : null))} · ${entry.instrument.currency} · ${holding(item.metrics.holdingMilliseconds, false)}` : performance && !cny ? `${performanceUnavailableText(performance.cny.reason)} · ${holding(item.metrics.holdingMilliseconds, false)}` : `${percent(cny ? cny.weightedReturn : trusted ? item.metrics.returnPercent : null)}${cny ? " · CNY" : ""} · ${holding(item.metrics.holdingMilliseconds, false)}`}{coverageWarning && <> {" · "}<span title={coverageWarning.title} aria-label={coverageWarning.ariaLabel}>账单缺月，持仓边界一致</span></>}</small>}</span>
              <span className="review-queue-status"><strong>{reviewLabel(item)}</strong><small>{state === "completed" ? "结论已保存" : state === "deferred" ? item.review?.review.deferredReason : "可开始复盘"}</small></span>
            </div>
            <details className="review-queue-full-name"><summary>查看完整原名</summary><p>原名：{presentation.originalName}</p><small>账户：{accountDisplayLabel}</small>{visibleColumns.fees && <small>已知费用：{item.metrics.fees ?? "不可用"}</small>}{performance && <><small>原币净盈亏：{rawPerformanceText(performance)}</small><small>人民币折算：{cny ? money(cny.netPnl, "CNY") : performanceUnavailableText(performance.cny.reason)}</small></>}</details>
            </div>
          </Fragment>;
        })}
      </div>
      {pageCount > 1 && <nav className="review-queue-pagination" aria-label="回合列表分页">
        <button type="button" aria-label="上一页" disabled={currentPage <= 1} onClick={() => changePage(currentPage - 1)}>上一页</button>
        <span>显示第 {pageStart + 1}–{Math.min(pageStart + REVIEW_QUEUE_PAGE_SIZE, rows.length)} 个，共 {rows.length} 个回合</span>
        <button type="button" aria-label="下一页" disabled={currentPage >= pageCount} onClick={() => changePage(currentPage + 1)}>下一页</button>
      </nav>}
      {rows.length === 0 && <div className="library-empty"><strong>{entries.length ? "当前范围没有待处理的回合" : "导入账单，开始第一次复盘"}</strong><span>{entries.length ? "可调整筛选，或查看已复盘与全部回合。" : "支持股票和 ETF，历史计划可以留空。"}</span></div>}
    </section>
  );
}
