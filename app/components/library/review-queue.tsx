"use client";

import { Fragment, useState } from "react";

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
} from "../../lib/reviews/review-queue";
import { buildReviewQueueSummary } from "../../lib/reviews/review-queue-summary";
import type { TradeLibraryEntry } from "../../lib/trades/library";

type Props = {
  entries: TradeLibraryEntry[];
  filter: ReviewQueueFilter;
  onFilter: (filter: ReviewQueueFilter) => void;
  onOpen: (row: ReviewQueueItem, queueIds?: string[]) => void;
  onBrowseStocks: () => void;
  notice?: string;
};

function money(value: string | null, currency: string) {
  if (value === null) return "待核对";
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
    signDisplay: "always",
  }).format(Number(value));
}

function percent(value: string | null) {
  return value === null ? "待核对" : `${Number(value).toFixed(2)}%`;
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
  return [filter.year, filter.nature, filter.simulationRunId]
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
          <div><dt>保本</dt><dd>{selectedGroup.breakEven}</dd></div>
          <div><dt>排除</dt><dd>{selectedGroup.excludedCount}</dd></div>
        </dl>
        <small>按入选完整回合统计；净盈亏已扣已知费用{year && year !== "all" ? "；年份筛选仅筛选回合，不代表年度现金流" : ""}</small>
        {selectedGroup.winRate && selectedGroup.trustedClosedCount > 0 && selectedGroup.trustedClosedCount < 5 && <small>样本有限</small>}
      </div>}
      {!selectedGroup && <p className="review-queue-summary-empty">当前范围暂无可汇总回合。</p>}
    </section>
  );
}

export function ReviewQueue({ entries, filter, onFilter, onOpen, onBrowseStocks, notice }: Props) {
  const rows = buildReviewQueue(entries, filter);
  const pending = buildReviewQueue(entries, { ...filter, status: "pending" });
  const accounts = [...new Map(entries.flatMap(entry => entry.executions).map(fill => [fill.accountId, fill.accountLabel])).entries()];
  const accountDisplayLabels = stableAccountDisplayLabels(accounts.map(([id, label]) => ({ id, label })));
  const selectedAccounts = selectedAccountIds(filter);
  const brokerOptions = reviewQueueBrokerOptions(entries);
  const selectedBrokers = filter.brokers ?? [];
  const years = [...new Set(entries.flatMap(entry => entry.executions.map(fill => formatMarketTradingDate(fill.executedAt, entry.instrument.market).slice(0, 4))))].sort().reverse();
  const markets = [...new Set(entries.map(entry => entry.instrument.market))].sort((left, right) => left.localeCompare(right));
  const simulationRuns = [...new Set(entries.map(entry => entry.simulationRunId).filter((value): value is string => Boolean(value)))].sort();
  const advancedExpanded = filter.advancedExpanded === true;
  const advancedCount = advancedFilterCount(filter);
  const showCurrencyGroups = currencyGroupsRequired(rows, filter.sort);
  const queueIds = reviewQueueEpisodeIds(rows);

  return (
    <section className="review-queue" aria-label="回合复盘队列">
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
        {["all", ...markets].map(market => {
          const label = market === "all" ? "全部" : reviewQueueMarketLabel(market);
          return <button key={market} type="button" aria-pressed={(filter.market ?? "all") === market} onClick={() => onFilter({ ...filter, market })}>{label}</button>;
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
          {filter.market && filter.market !== "all" && <span className="review-queue-filter-tag">市场：{reviewQueueMarketLabel(filter.market)}<button type="button" aria-label={`移除市场筛选 ${reviewQueueMarketLabel(filter.market)}`} onClick={() => onFilter({ ...filter, market: "all" })}>×</button></span>}
          {selectedBrokers.map(id => <span className="review-queue-filter-tag" key={id}>券商：{brokerOptions.find(option => option.id === id)?.label ?? id}<button type="button" aria-label={`移除券商筛选 ${brokerOptions.find(option => option.id === id)?.label ?? id}`} onClick={() => onFilter({ ...filter, brokers: selectedBrokers.filter(value => value !== id) })}>×</button></span>)}
          {selectedAccounts.map(id => <span className="review-queue-filter-tag" key={id}>账户：{accountDisplayLabels.get(id) ?? id}<button type="button" aria-label={`移除账户筛选 ${accountDisplayLabels.get(id) ?? id}`} onClick={() => onFilter({ ...filter, accounts: selectedAccounts.filter(value => value !== id), account: undefined })}>×</button></span>)}
          {filter.query?.trim() && <span className="review-queue-filter-tag">搜索：{filter.query.trim()}</span>}
        </div>
        {advancedExpanded && <div id="review-queue-advanced-filters" className="review-queue-advanced-filters" role="group" aria-label="高级筛选">
          <label><span>年份</span><select aria-label="复盘年份" value={filter.year ?? "all"} onChange={event => onFilter({ ...filter, year: event.target.value })}><option value="all">全部年份</option>{years.map(year => <option key={year}>{year}</option>)}</select></label>
          <label><span>交易性质</span><select aria-label="复盘交易性质" value={filter.nature ?? "all"} onChange={event => onFilter({ ...filter, nature: event.target.value })}><option value="all">全部性质</option><option value="live">实盘</option><option value="simulation">模拟盘</option><option value="unknown">来源未知</option></select></label>
          {simulationRuns.length > 0 && <label><span>模拟运行</span><select aria-label="复盘模拟运行" value={filter.simulationRunId ?? "all"} onChange={event => onFilter({ ...filter, simulationRunId: event.target.value })}><option value="all">全部运行</option>{simulationRuns.map(run => <option key={run}>{run}</option>)}</select></label>}
          <div className="review-queue-accounts-row"><fieldset className="review-queue-account-tags"><legend>账户标签</legend><div>{accounts.map(([id, label]) => {
            const displayLabel = accountDisplayLabels.get(id) ?? label;
            return <label key={id} className="review-queue-account-tag"><input type="checkbox" aria-label={`账户筛选 ${displayLabel}`} checked={selectedAccounts.includes(id)} onChange={() => onFilter({ ...filter, accounts: toggleFilterValue(selectedAccounts, id), account: undefined })} /><span>{displayLabel}</span></label>;
          })}</div></fieldset>
          <div className="review-queue-advanced-actions"><button type="button" className="review-queue-clear-accounts" onClick={() => onFilter({ ...filter, accounts: [], account: undefined })}>清除账户标签</button><button type="button" className="review-queue-clear-advanced" onClick={() => onFilter({ ...filter, accounts: [], account: undefined, year: "all", nature: "all", simulationRunId: "all" })}>清除高级条件</button></div></div>
        </div>}
        {!advancedExpanded && advancedCount > 0 && <p className="review-queue-filter-state">高级条件已启用 {advancedCount} 项</p>}
      </div>

      <QueueSummary rows={rows} year={filter.year} />
      <div className="review-queue-list">
        {rows.map((row, index) => {
          const { entry, item } = row;
          const presentation = instrumentPresentation(entry.instrument);
          const accountDisplayLabel = accountDisplayLabels.get(item.episode.accountId) ?? item.episode.accountLabel;
          const brokerTags = reviewQueueBrokerTags(row);
          const state = reviewState(item);
          const trusted = hasTrustedClosedMetrics(item);
          const pnl = item.episode.status === "open"
            ? "持仓中 · 最终盈亏未定"
            : trusted ? money(item.metrics.netPnl, entry.instrument.currency) : "盈亏待核对";
          const resultClass = !trusted
            ? "neutral"
            : Number(item.metrics.netPnl) > 0
              ? "positive"
              : Number(item.metrics.netPnl) < 0 ? "negative" : "neutral";
          const coverageWarning = coverageWarningDetails(item.episode.warnings);
          const accessibleName = `复盘${presentation.primaryName} ${formatMarketTradingDate(item.episode.startedAt, entry.instrument.market)} ${accountDisplayLabel}（${reviewQueueMarketLabel(entry.instrument.market)}，原名：${presentation.originalName}，${presentation.secondaryName}）`;
          const previousCurrency = rows[index - 1]?.entry.instrument.currency;
          return <Fragment key={item.episode.id}>
            {showCurrencyGroups && previousCurrency !== entry.instrument.currency && <h3 className="review-queue-currency-heading">{entry.instrument.currency} · 金额排序分组</h3>}
            <div className="review-queue-row-shell">
            <div role="button" tabIndex={0} className="review-queue-row" onClick={() => onOpen(row, queueIds)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onOpen(row, queueIds); } }} aria-label={accessibleName}>
              <span className="review-queue-identity"><strong title={presentation.originalName}>{presentation.primaryName}</strong><small>{presentation.secondaryName}{presentation.hasChineseName ? "" : " · 中文名未补全"}</small></span>
              <span className="review-queue-window"><strong>{formatMarketTradingDate(item.episode.startedAt, entry.instrument.market)}—{item.episode.endedAt ? formatMarketTradingDate(item.episode.endedAt, entry.instrument.market) : "持仓中"}</strong><small>{reviewQueueMarketLabel(entry.instrument.market)} · {item.metrics.buyCount + item.metrics.sellCount} 笔成交{brokerTags.length > 0 && <span className="review-queue-broker-tags" aria-label="来源券商">{brokerTags.map(tag => <span key={tag.id}>{tag.label}</span>)}</span>}</small></span>
              <span className={`review-queue-result ${resultClass}`}><strong>{pnl}</strong><small>{item.episode.status === "open" ? "最终盈亏未定 · 持仓中" : `${percent(trusted ? item.metrics.returnPercent : null)} · ${holding(item.metrics.holdingMilliseconds, false)}`}{coverageWarning && <> {" · "}<span title={coverageWarning.title} aria-label={coverageWarning.ariaLabel}>账单缺月，持仓边界一致</span></>}</small></span>
              <span className="review-queue-status"><strong>{reviewLabel(item)}</strong><small>{state === "completed" ? "结论已保存" : state === "deferred" ? item.review?.review.deferredReason : "可开始复盘"}</small></span>
            </div>
            <details className="review-queue-full-name"><summary>查看完整原名</summary><p>原名：{presentation.originalName}</p><small>账户：{accountDisplayLabel}</small></details>
            </div>
          </Fragment>;
        })}
      </div>
      {rows.length === 0 && <div className="library-empty"><strong>{entries.length ? "当前范围没有待处理的回合" : "导入账单，开始第一次复盘"}</strong><span>{entries.length ? "可调整筛选，或查看已复盘与全部回合。" : "支持股票和 ETF，历史计划可以留空。"}</span></div>}
    </section>
  );
}
