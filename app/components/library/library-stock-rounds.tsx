"use client";

import { ChevronRight } from "lucide-react";
import { useEffect } from "react";

import type { FxSnapshot } from "../../lib/fx/contracts";
import { formatMarketTradingDate } from "../../lib/market/trading-date";
import type { MarketDataSyncStatus } from "../../lib/market/sync-status";
import { instrumentPresentation } from "../../lib/instruments/instrument-presentation";
import {
  reviewQueueBrokerTags,
  reviewState,
  type ReviewQueueItem,
  type ReviewQueueSort,
} from "../../lib/reviews/review-queue";
import type { TradeLibraryEntry } from "../../lib/trades/library";
import {
  summarizeLibraryPerformance,
  type LibraryPerformanceSummary,
} from "../../lib/reviews/library-performance";
import { tradeNatureForReviewRow } from "./library-browse-state";
import { formatSimulationRunLabel } from "./library-filter-options";
import styles from "./library-stock-rounds.module.css";

export type TradeLibraryStockGroup = {
  entry: TradeLibraryEntry;
  rows: ReviewQueueItem[];
  allRows: ReviewQueueItem[];
};

export type LibraryStockRoundsProps = {
  groups: TradeLibraryStockGroup[];
  expandedStockIds: readonly string[];
  includeReviewedStockIds: readonly string[];
  reviewStatus: "pending" | "completed" | "all";
  marketDataLabels?: Record<string, string>;
  marketDataStatuses: Record<string, MarketDataSyncStatus>;
  performanceByInstrument?: ReadonlyMap<string, LibraryPerformanceSummary>;
  performanceByEpisode?: ReadonlyMap<string, LibraryPerformanceSummary>;
  fxSnapshot?: FxSnapshot | null;
  sort?: ReviewQueueSort;
  onSort?: (sort: ReviewQueueSort) => void;
  performanceSortAvailability?: { allowed: boolean; reason: string | null };
  page?: number;
  onPageChange?: (page: number) => void;
  onToggleExpanded: (instrumentId: string) => void;
  onToggleIncludeReviewed: (instrumentId: string) => void;
  onOpenRound: (row: ReviewQueueItem, queueIds: string[]) => void;
  money: (value: string | null, currency: string) => string;
  natureLabel: (nature: TradeLibraryEntry["tradeNature"]) => string;
  marketDataStatusLabel: (status: MarketDataSyncStatus) => string;
  reviewTagLabel: (tagId: string) => string;
};

function runIdForRow(row: ReviewQueueItem) {
  return row.item.episode.simulationRunId ?? row.entry.simulationRunId ?? null;
}

function runLabel(rows: ReviewQueueItem[], runId: string | null) {
  if (!runId) return "实盘回合";
  const first = rows.find((row) => runIdForRow(row) === runId);
  const presentation = first ? instrumentPresentation(first.entry.instrument) : null;
  return `模拟运行 · ${formatSimulationRunLabel(runId, presentation ? {
    instrumentName: presentation.primaryName,
    symbol: first?.entry.instrument.symbol,
  } : undefined)}`;
}

function statusLabel(status: ReviewQueueItem["item"]["episode"]["status"]) {
  return status === "open" ? "持仓中" : "已平仓";
}

function reviewLabel(row: ReviewQueueItem) {
  const state = reviewState(row.item);
  return state === "completed" ? "已复盘" : state === "deferred" ? "暂不复盘" : "待复盘";
}

function rowKey(row: ReviewQueueItem) {
  return `${row.entry.instrument.id}:${row.item.episode.id}`;
}

/**
 * The library entry owns the stable display order used by the review
 * workspace.  Derive the ordinal from that immutable list instead of the
 * currently filtered or sorted child rows.
 */
function chronologicalEpisodeNumber(entry: TradeLibraryEntry, episodeId: string) {
  const index = entry.episodes.findIndex(item => item.episode.id === episodeId);
  return index >= 0 ? entry.episodes.length - index : 1;
}

function groupRoundRows(rows: ReviewQueueItem[]) {
  const grouped = new Map<string, ReviewQueueItem[]>();
  for (const row of rows) {
    const nature = tradeNatureForReviewRow(row);
    const key = nature === "simulation"
      ? `simulation:${runIdForRow(row) ?? "unknown"}`
      : nature === "unknown" ? "unknown" : "live";
    const existing = grouped.get(key);
    if (existing) existing.push(row);
    else grouped.set(key, [row]);
  }
  return [...grouped.entries()];
}

function displayPerformance(
  summary: LibraryPerformanceSummary | null | undefined,
  money: (value: string | null, currency: string) => string,
) {
  const cny = summary?.cny;
  const raw = summary?.rawCurrencyGroups.length === 1
    ? summary.rawCurrencyGroups[0]
    : null;
  const trustedRaw = raw && raw.netPnl !== null && raw.netPnlSampleCount > 0 ? raw : null;
  const rawCurrencies = summary ? [...new Set(summary.rawCurrencyGroups.map(group => group.currency))] : [];
  const currency = raw?.currency ?? (rawCurrencies.length === 1 ? rawCurrencies[0] : rawCurrencies.length > 1 ? "多币种" : "CNY");
  const rawPnlDetails = summary?.cny.reason === "multiple-scopes"
    ? []
    : (summary?.rawCurrencyGroups ?? [])
      .filter(group => group.netPnl !== null && group.netPnlSampleCount > 0 && (!cny?.available || group.currency !== "CNY"))
      .map(group => `${group.currency} ${money(group.netPnl, group.currency)}`);
  const sampleByGroup = summary?.cny.reason === "multiple-scopes";
  if (cny?.available && cny.netPnl !== null) {
    return {
      pnl: money(cny.netPnl, "CNY"),
      pnlValue: cny.netPnl,
      currency: "CNY",
      returnValue: cny.weightedReturn,
      pnlSampleCount: cny.netPnlSampleCount,
      returnSampleCount: cny.returnSampleCount,
      cnyUnavailable: false,
      unavailableReason: null,
      rawPnlDetails,
      sampleByGroup: false,
      summaryPresent: true,
    };
  }
  if (trustedRaw) {
    return {
      pnl: money(trustedRaw.netPnl, trustedRaw.currency),
      pnlValue: trustedRaw.netPnl,
      currency: trustedRaw.currency,
      returnValue: trustedRaw.weightedReturn,
      pnlSampleCount: trustedRaw.netPnlSampleCount,
      returnSampleCount: trustedRaw.returnSampleCount,
      cnyUnavailable: true,
      unavailableReason: cny?.reason ?? null,
      rawPnlDetails,
      sampleByGroup: false,
      summaryPresent: Boolean(summary),
    };
  }
  return {
    pnl: null,
    pnlValue: null,
    currency,
    returnValue: null,
    pnlSampleCount: cny?.netPnlSampleCount ?? 0,
    returnSampleCount: cny?.returnSampleCount ?? 0,
    cnyUnavailable: Boolean(summary && !cny?.available),
    unavailableReason: cny?.reason ?? null,
    rawPnlDetails,
    sampleByGroup: Boolean(sampleByGroup),
    summaryPresent: Boolean(summary),
  };
}

function formatReturn(value: string | null, currency: string, cnyUnavailable: boolean) {
  if (value === null || !Number.isFinite(Number(value))) return "收益率暂不可用";
  return `${Number(value).toFixed(2)}%${cnyUnavailable ? ` · ${currency}原币` : " · CNY"}`;
}

function weightedReturnLabel(
  value: string | null,
  currency: string,
  cnyUnavailable: boolean,
) {
  const formatted = formatReturn(value, currency, cnyUnavailable);
  return formatted === "收益率暂不可用"
    ? "加权收益率（按开仓金额）暂不可用"
    : `加权收益率（按开仓金额）：${formatted}`;
}

function performanceStatusLabel(metrics: ReturnType<typeof displayPerformance>) {
  if (!metrics.summaryPresent) return "统计数据暂不可用";
  if (!metrics.cnyUnavailable) return "人民币已平仓净盈亏";
  if (metrics.unavailableReason === "multiple-scopes") return "绩效按性质/模拟运行分组显示";
  if (metrics.unavailableReason === "missing-fx") {
    return `原币 ${metrics.currency} · 人民币暂无法折算`;
  }
  if (metrics.unavailableReason === "no-trusted-closed") return "暂无可信已平仓样本";
  if (metrics.unavailableReason === "empty") return "暂无可用已平仓样本";
  return "人民币暂无法折算";
}

function sampleCoverageLabel(metrics: ReturnType<typeof displayPerformance>) {
  const prefix = metrics.sampleByGroup ? "各组" : "";
  return `${prefix}净盈亏样本 ${metrics.pnlSampleCount} · ${prefix}收益率样本 ${metrics.returnSampleCount}`;
}

function rawPnlDetailsLabel(metrics: ReturnType<typeof displayPerformance>) {
  if ((metrics.cnyUnavailable && metrics.pnlValue !== null) || metrics.rawPnlDetails.length === 0) return null;
  return `原币金额：${metrics.rawPnlDetails.join(" · ")}`;
}

function metricSignClass(metrics: ReturnType<typeof displayPerformance>) {
  return metrics.pnlValue === null ? undefined : Number(metrics.pnlValue) >= 0 ? "positive" : "negative";
}

function openValuesLabel(
  summary: LibraryPerformanceSummary | null | undefined,
  money: (value: string | null, currency: string) => string,
) {
  const open = summary?.open;
  if (!open || open.count === 0) return null;
  const groups = open.groups.map(group => {
    const value = group.unrealizedPnl === null ? "不可用" : money(group.unrealizedPnl, group.currency);
    return `${group.currency}浮盈亏 ${value}${group.unavailable > 0 ? `（${group.unavailable} 个不可用）` : ""}`;
  });
  return groups.join(" · ") || "浮盈亏不可用";
}

function openSummaryLabel(
  summary: LibraryPerformanceSummary | null | undefined,
  money: (value: string | null, currency: string) => string,
) {
  const open = summary?.open;
  if (!open || open.count === 0) return null;
  return `持仓中 ${open.count} 个回合 · ${openValuesLabel(summary, money)}`;
}

function sortButtonLabel(
  label: string,
  sort: ReviewQueueSort,
  high: ReviewQueueSort,
  low: ReviewQueueSort,
) {
  if (sort === high) return `${label}，当前降序，点击切换升序`;
  if (sort === low) return `${label}，当前升序，点击切换降序`;
  return `${label}，点击按降序排序`;
}

export function buildTradeLibraryStockGroups(
  rows: ReviewQueueItem[],
  allRows: ReviewQueueItem[],
  stocks: TradeLibraryEntry[],
): TradeLibraryStockGroup[] {
  const rowsByInstrument = new Map<string, ReviewQueueItem[]>();
  const allRowsByInstrument = new Map<string, ReviewQueueItem[]>();
  for (const row of rows) {
    const existing = rowsByInstrument.get(row.entry.instrument.id);
    if (existing) existing.push(row);
    else rowsByInstrument.set(row.entry.instrument.id, [row]);
  }
  for (const row of allRows) {
    const existing = allRowsByInstrument.get(row.entry.instrument.id);
    if (existing) existing.push(row);
    else allRowsByInstrument.set(row.entry.instrument.id, [row]);
  }
  return stocks.map((entry) => ({
    entry,
    rows: rowsByInstrument.get(entry.instrument.id) ?? [],
    allRows: allRowsByInstrument.get(entry.instrument.id) ?? [],
  }));
}

export function LibraryStockRounds({
  groups,
  expandedStockIds,
  includeReviewedStockIds,
  reviewStatus,
  marketDataLabels,
  marketDataStatuses,
  performanceByInstrument,
  performanceByEpisode,
  fxSnapshot,
  sort = "newest",
  onSort,
  performanceSortAvailability = { allowed: true, reason: null },
  page = 1,
  onPageChange,
  onToggleExpanded,
  onToggleIncludeReviewed,
  onOpenRound,
  money,
  natureLabel,
  marketDataStatusLabel,
  reviewTagLabel,
}: LibraryStockRoundsProps) {
  const toggleSort = (high: ReviewQueueSort, low: ReviewQueueSort) => {
    onSort?.(sort === high ? low : high);
  };
  const performanceSortDisabled = !performanceSortAvailability.allowed;
  const pageSize = 100;
  const totalGroups = groups.length;
  const requestedPage = Number.isInteger(page) && page > 0 ? page : 1;
  const totalPages = Math.max(1, Math.ceil(totalGroups / pageSize));
  const currentPage = Math.min(requestedPage, totalPages);
  const visibleGroups = groups.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const visibleStart = totalGroups === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const visibleEnd = Math.min(currentPage * pageSize, totalGroups);

  useEffect(() => {
    if (onPageChange && requestedPage !== currentPage) onPageChange(currentPage);
  }, [currentPage, onPageChange, requestedPage]);

  return (
    <div className="library-stock-list">
      <div className="library-stock-head" role="group" aria-label="股票列表排序">
        <span>股票</span>
        <span>账户 / 成交 / 回合</span>
        <span className={styles.sortHeaderCell}>
          <button
            type="button"
            aria-label={sortButtonLabel("最近成交", sort, "newest", "oldest")}
            aria-pressed={sort === "newest" || sort === "oldest"}
            onClick={() => toggleSort("newest", "oldest")}
          >
            最近成交{sort === "newest" ? " ↓" : sort === "oldest" ? " ↑" : ""}
          </button>
        </span>
        <span>状态</span>
        <span className={styles.sortHeaderCell}>
          <button
            type="button"
            aria-label={sortButtonLabel("净盈亏", sort, "net-profit", "net-loss")}
            aria-pressed={sort === "net-profit" || sort === "net-loss"}
            disabled={performanceSortDisabled}
            title={performanceSortDisabled ? performanceSortAvailability.reason ?? "绩效排序不可用" : undefined}
            onClick={() => toggleSort("net-profit", "net-loss")}
          >
            净盈亏{sort === "net-profit" ? " ↓" : sort === "net-loss" ? " ↑" : ""}
          </button>
          <button
            type="button"
            aria-label={sortButtonLabel("收益率", sort, "return-high", "return-low")}
            aria-pressed={sort === "return-high" || sort === "return-low"}
            disabled={performanceSortDisabled}
            title={performanceSortDisabled ? performanceSortAvailability.reason ?? "绩效排序不可用" : undefined}
            onClick={() => toggleSort("return-high", "return-low")}
          >
            收益率{sort === "return-high" ? " ↓" : sort === "return-low" ? " ↑" : ""}
          </button>
        </span>
        <span />
      </div>
      {performanceSortDisabled && <p className={styles.sortNotice} role="status">绩效排序不可用：{performanceSortAvailability.reason ?? "请缩小范围"}。</p>}
      {totalGroups > 0 && <nav className={styles.pagination} aria-label="股票列表分页">
        <span>显示 {visibleStart}-{visibleEnd}/{totalGroups}</span>
        <button type="button" disabled={currentPage <= 1} onClick={() => onPageChange?.(currentPage - 1)}>上一页</button>
        <span aria-label={`第${currentPage}页，共${totalPages}页`}>{currentPage}/{totalPages}</span>
        <button type="button" disabled={currentPage >= totalPages} onClick={() => onPageChange?.(currentPage + 1)}>下一页</button>
      </nav>}
      {visibleGroups.map(({ entry, rows, allRows }) => {
        const instrumentId = entry.instrument.id;
        const expanded = expandedStockIds.includes(instrumentId);
        const includeReviewed = includeReviewedStockIds.includes(instrumentId);
        const displayedRows = includeReviewed && reviewStatus !== "all" ? allRows : rows;
        const stockPerformance = performanceByInstrument?.get(instrumentId);
        const stockMetrics = displayPerformance(stockPerformance, money);
        const stockOpenLabel = openSummaryLabel(stockPerformance, money);
        const pendingCount = allRows.filter((row) => reviewState(row.item) === "pending").length;
        const reviewedCount = allRows.filter((row) => reviewState(row.item) === "completed").length;
        const status = marketDataStatuses[instrumentId] ?? "not-requested";
        const hasMultipleNatures = new Set(allRows.map(tradeNatureForReviewRow)).size > 1;
        const simulationRunCount = new Set(allRows
          .filter(row => tradeNatureForReviewRow(row) === "simulation")
          .map(runIdForRow)
          .filter((runId): runId is string => Boolean(runId))).size;
        const roundsId = `stock-rounds-${instrumentId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
        return (
          <div className={styles.stockGroup} key={instrumentId}>
            <div className={styles.stockRowShell}>
              <button
                className="library-stock-row"
                aria-controls={roundsId}
                aria-expanded={expanded}
                aria-label={`${expanded ? "收起" : "展开"}${entry.instrument.name}交易回合`}
                onClick={() => onToggleExpanded(instrumentId)}
                type="button"
              >
                <span className="library-stock-identity">
                  <b>{entry.instrument.market}</b>
                  <span>
                    <strong>{entry.instrument.name}</strong>
                    <small>{entry.instrument.symbol}</small>
                  </span>
                  <em className={`trade-nature-badge ${hasMultipleNatures ? "unknown" : entry.tradeNature ?? "unknown"}`}>
                    {hasMultipleNatures ? "多种性质" : natureLabel(entry.tradeNature)}
                  </em>
                </span>
                <span className="library-stock-meta">
                  <span>{entry.accountCount} 个账户 · {entry.tradeCount} 笔成交 · {entry.episodeCount} 个回合</span>
                  <small>
                    {entry.cumulativeR === null ? "累计 R —" : `累计 ${entry.cumulativeR}R`} · {entry.confirmedTagIds.length === 0 ? "标签待确认" : entry.confirmedTagIds.map(reviewTagLabel).join("、")}
                  </small>
                  <small>复盘进度 {reviewedCount}/{allRows.length || entry.episodeCount}</small>
                  {simulationRunCount > 1 && <small>{simulationRunCount} 个模拟运行 · 展开查看</small>}
                </span>
                <span>{formatMarketTradingDate(entry.firstTradeAt, entry.instrument.market)}—{formatMarketTradingDate(entry.lastTradeAt, entry.instrument.market)}</span>
                <span className="library-stock-status">
                  <b className={entry.status}>{statusLabel(entry.status)}</b>
                  <small>{marketDataLabels?.[instrumentId] ?? marketDataStatusLabel(status)}</small>
                </span>
                <span className="library-stock-pnl">
                  <strong className={stockMetrics.pnlValue === null ? undefined : Number(stockMetrics.pnlValue) >= 0 ? "positive" : "negative"}>
                    {stockMetrics.pnl ?? "已平仓净盈亏暂不可用"}
                  </strong>
                  <small>{performanceStatusLabel(stockMetrics)}</small>
                  <small>{sampleCoverageLabel(stockMetrics)}</small>
                  <small>{weightedReturnLabel(stockMetrics.returnValue, stockMetrics.currency, stockMetrics.cnyUnavailable)}</small>
                  {rawPnlDetailsLabel(stockMetrics) && <small>{rawPnlDetailsLabel(stockMetrics)}</small>}
                  {stockOpenLabel && <small>{stockOpenLabel}</small>}
                </span>
                <ChevronRight size={16} />
              </button>
            </div>
            {expanded && <section id={roundsId} className={styles.roundPanel} aria-label={`${entry.instrument.name}交易回合`}>
              <header className={styles.roundHeader}>
                <div>
                  <strong>{entry.instrument.name} · 交易回合</strong>
                  <span>{pendingCount} 待复盘 · {reviewedCount} 已复盘 · {allRows.length} 个匹配回合</span>
                </div>
                {reviewStatus !== "all" && allRows.length > rows.length && <button type="button" onClick={() => onToggleIncludeReviewed(instrumentId)}>
                  {includeReviewed ? "收起已复盘回合" : "包含已复盘回合"}
                </button>}
                {includeReviewed && <small className={styles.localScopeNotice}>仅此标的范围；全局统计与开始复盘不变。</small>}
              </header>
              {groupRoundRows(displayedRows).map(([runGroupId, runRows]) => {
                const runSummary = summarizeLibraryPerformance(runRows, fxSnapshot ?? undefined);
                const runMetrics = displayPerformance(runSummary, money);
                const runLabelText = runGroupId === "live"
                  ? "实盘回合"
                  : runGroupId === "unknown"
                    ? "来源未知回合"
                    : runLabel(runRows, runGroupId.slice("simulation:".length));
                return (
                <div className={styles.runGroup} key={runGroupId}>
                  <div className={styles.runGroupHeader}>
                    <h3>{runLabelText}</h3>
                    <div className={styles.runGroupMetrics}>
                      <strong className={metricSignClass(runMetrics)}>{runMetrics.pnl ?? "已平仓净盈亏暂不可用"}</strong>
                      <small>{performanceStatusLabel(runMetrics)}</small>
                      <small>{sampleCoverageLabel(runMetrics)} · {weightedReturnLabel(runMetrics.returnValue, runMetrics.currency, runMetrics.cnyUnavailable)}</small>
                      {rawPnlDetailsLabel(runMetrics) && <small>{rawPnlDetailsLabel(runMetrics)}</small>}
                    </div>
                  </div>
                  {runRows.map((row) => {
                    const episode = row.item.episode;
                    const childPresentation = instrumentPresentation(row.entry.instrument);
                    const brokerLabels = reviewQueueBrokerTags(row).map((tag) => tag.label).join("、");
                    const roundPerformance = performanceByEpisode?.get(episode.id);
                    const roundMetrics = displayPerformance(roundPerformance, money);
                    const roundOpenLabel = openValuesLabel(roundPerformance, money);
                    const locallyIncludedExtra = includeReviewed && reviewStatus !== "all" &&
                      !rows.some(candidate => candidate.item.episode.id === episode.id);
                    // Use the source scope attached to this row.  The outer
                    // aggregate may contain only the currently filtered
                    // episodes, which must not renumber a child.
                    const ordinal = chronologicalEpisodeNumber(row.entry, episode.id);
                    return (
                      <div className={styles.roundRowShell} key={rowKey(row)}>
                        <button
                          type="button"
                          className={styles.roundRow}
                          aria-label={`打开${childPresentation.primaryName}第${ordinal}次交易 ${episode.accountLabel}`}
                          onClick={() => onOpenRound(row, displayedRows.map((candidate) => candidate.item.episode.id))}
                        >
                          <span><strong>第 {ordinal} 次交易</strong><small>{episode.accountLabel}</small></span>
                          <span><strong>{formatMarketTradingDate(episode.startedAt, episode.instrument.market)}—{episode.endedAt ? formatMarketTradingDate(episode.endedAt, episode.instrument.market) : "持仓中"}</strong><small>{episode.executions.length} 笔成交{brokerLabels ? ` · ${brokerLabels}` : ""}</small></span>
                          <span><b className={episode.status}>{statusLabel(episode.status)}</b><small>{reviewLabel(row)}</small></span>
                          <span>
                            <strong className={episode.status === "open" ? undefined : metricSignClass(roundMetrics)}>{episode.status === "open" ? "持仓中" : roundMetrics.pnl ?? "已平仓净盈亏暂不可用"}</strong>
                            <small>{episode.status === "open" ? (roundOpenLabel ?? "浮盈亏暂不可用") : weightedReturnLabel(roundMetrics.returnValue, roundMetrics.currency, roundMetrics.cnyUnavailable)}</small>
                          </span>
                        </button>
                        {locallyIncludedExtra && <small className={styles.localExtraBadge}>局部额外显示 · 不计入当前统计</small>}
                        <details className={styles.fullName}>
                          <summary>查看完整原名</summary>
                          <p>原名：{childPresentation.originalName}</p>
                          <small>账户：{episode.accountLabel}</small>
                        </details>
                      </div>
                    );
                  })}
                </div>
                );
              })}
            </section>}
          </div>
        );
      })}
    </div>
  );
}
