"use client";

import { buildReviewQueue, reviewState, type ReviewQueueFilter, type ReviewQueueItem } from "../../lib/reviews/review-queue";
import { formatMarketTradingDate } from "../../lib/market/trading-date";
import type { TradeLibraryEntry } from "../../lib/trades/library";

type Props = {
  entries: TradeLibraryEntry[];
  filter: ReviewQueueFilter;
  onFilter: (filter: ReviewQueueFilter) => void;
  onOpen: (row: ReviewQueueItem) => void;
  onBrowseStocks: () => void;
  notice?: string;
};

export function ReviewQueue({entries,filter,onFilter,onOpen,onBrowseStocks,notice}: Props) {
  const rows = buildReviewQueue(entries,filter);
  const accounts = [...new Map(entries.flatMap(entry => entry.executions).map(fill => [fill.accountId,fill.accountLabel])).entries()];
  const years = [...new Set(entries.flatMap(entry => entry.executions.map(fill => formatMarketTradingDate(fill.executedAt,entry.instrument.market).slice(0,4))))].sort().reverse();
  const pending = buildReviewQueue(entries,{...filter,status:"pending"});
  return <section className="review-queue" aria-label="回合复盘队列">
    <header className="library-header"><div><span className="eyebrow">Review queue</span><h1>从一回合开始</h1><p>看清一个决策，留下一条下次行动。</p></div><button type="button" onClick={onBrowseStocks}>按标的浏览</button></header>
    {notice && <p role="status" className="review-queue-notice">{notice}</p>}
    <div className="review-queue-start"><div><strong>{pending.length}</strong><span> 个回合待复盘</span></div>{pending[0] && <button type="button" className="primary-action" onClick={() => onOpen(pending[0])}>开始复盘</button>}</div>
    <nav className="review-status-tabs" aria-label="按复盘状态筛选">{([['pending','待复盘'],['completed','已复盘'],['all','全部回合']] as const).map(([status,label]) => <button key={status} type="button" aria-pressed={(filter.status ?? "pending") === status} onClick={() => onFilter({...filter,status})}>{label}</button>)}</nav>
    <div className="review-queue-filters">
      <label><span>搜索标的</span><input type="search" aria-label="搜索复盘回合" placeholder="名称或代码" value={filter.query ?? ""} onChange={event => onFilter({...filter,query:event.target.value})} /></label>
      <label><span>账户</span><select aria-label="复盘账户" value={filter.account ?? "all"} onChange={event => onFilter({...filter,account:event.target.value})}><option value="all">全部账户</option>{accounts.map(([id,label]) => <option key={id} value={id}>{label}</option>)}</select></label>
      <details><summary>更多筛选</summary><div className="review-queue-filters"><label><span>年份</span><select aria-label="复盘年份" value={filter.year ?? "all"} onChange={event => onFilter({...filter,year:event.target.value})}><option value="all">全部年份</option>{years.map(year => <option key={year}>{year}</option>)}</select></label>
        <label><span>市场</span><select aria-label="复盘市场" value={filter.market ?? "all"} onChange={event => onFilter({...filter,market:event.target.value})}><option value="all">全部市场</option>{[...new Set(entries.map(entry => entry.instrument.market))].map(market => <option key={market}>{market}</option>)}</select></label>
        <label><span>交易性质</span><select aria-label="复盘交易性质" value={filter.nature ?? "all"} onChange={event => onFilter({...filter,nature:event.target.value})}><option value="all">全部性质</option><option value="live">实盘</option><option value="simulation">模拟盘</option><option value="unknown">来源未知</option></select></label></div></details>
    </div>
    <div className="review-queue-list">{rows.map(row => {
      const {entry,item} = row;
      const state = reviewState(item);
      const label = state === "completed" ? "已复盘" : state === "deferred" ? "暂不复盘" : "待复盘";
      return <button type="button" className="review-queue-row" key={item.episode.id} onClick={() => onOpen(row)} aria-label={`复盘${entry.instrument.name} ${formatMarketTradingDate(item.episode.startedAt, entry.instrument.market)} ${item.episode.accountLabel}`}>
        <span><strong>{entry.instrument.name}</strong><small>{entry.instrument.symbol} · {entry.tradingLabel ?? "来源未知"}</small></span>
        <span>{formatMarketTradingDate(item.episode.startedAt, entry.instrument.market)}—{item.episode.endedAt ? formatMarketTradingDate(item.episode.endedAt, entry.instrument.market) : "持仓中"}<small>{item.episode.accountLabel} · {item.metrics.buyCount + item.metrics.sellCount} 笔成交</small></span>
        <span className="review-queue-result">{item.metrics.netPnl === null ? "盈亏待核对" : new Intl.NumberFormat("zh-CN",{style:"currency",currency:entry.instrument.currency,signDisplay:"always"}).format(Number(item.metrics.netPnl))}<small>{label}{item.review?.review.planAdherence === "followed" ? " · 符合计划" : item.review?.review.planAdherence === "deviated" ? " · 偏离计划" : ""}</small></span>
      </button>;
    })}</div>
    {rows.length === 0 && <div className="library-empty"><strong>{entries.length ? "当前范围没有待处理的回合" : "导入账单，开始第一次复盘"}</strong><span>{entries.length ? "可调整筛选，或查看已复盘与全部回合。" : "支持股票和 ETF，历史计划可以留空。"}</span></div>}
  </section>;
}
