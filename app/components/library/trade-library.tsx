"use client";

import {
  ArrowLeft,
  BarChart3,
  BookOpenCheck,
  ChevronRight,
  Clock3,
  Database,
  Search,
} from "lucide-react";
import { useMemo, useState } from "react";

import { aggregateCandles } from "../../lib/market/aggregate";
import type { DailyCandleRecord } from "../../lib/market/contracts";
import {
  marketDataStatusLabel,
  type MarketDataSyncStatus,
} from "../../lib/market/sync-status";
import {
  formatMarketTradingDate,
  marketTradingDate,
} from "../../lib/market/trading-date";
import type { EpisodeReviewRecord } from "../../lib/reviews/types";
import {
  reviewTagLabel,
  REVIEW_TAGS,
} from "../../lib/reviews/review-tags";
import {
  dailyRecordToChartCandle,
  type Timeframe,
} from "../../lib/market/types";
import type {
  TradeLibraryEntry,
  TradeLibraryEpisode,
} from "../../lib/trades/library";
import { ReplayChart } from "../chart/replay-chart";
import { EpisodeReviewEditor } from "../review/episode-review-editor";

type Props = {
  entries: TradeLibraryEntry[];
  candlesByInstrument: Record<string, DailyCandleRecord[]>;
  marketDataStatuses: Record<string, MarketDataSyncStatus>;
  timeframe: Timeframe;
  onTimeframeChange: (timeframe: Timeframe) => void;
  onOpenInReview: (instrumentId: string) => void;
  onSaveReview: (record: EpisodeReviewRecord) => void | Promise<void>;
  reviewsHydrated: boolean;
};

type FilterValue = "all" | string;

function money(value: string | null, currency: string) {
  if (value === null) return "待行情";
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
    signDisplay: "always",
  }).format(Number(value));
}

function episodeLabel(
  item: TradeLibraryEpisode,
  chronologicalNumber: number,
) {
  const { episode, metrics } = item;
  return `第 ${chronologicalNumber} 次交易 · ${
    episode.direction === "long" ? "多头" : "空头"
  } · ${metrics.buyCount} 买 / ${metrics.sellCount} 卖`;
}

export function TradeLibrary({
  entries,
  candlesByInstrument,
  marketDataStatuses,
  timeframe,
  onTimeframeChange,
  onOpenInReview,
  onSaveReview,
  reviewsHydrated,
}: Props) {
  const [selectedInstrumentId, setSelectedInstrumentId] = useState<
    string | null
  >(null);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<
    string | null
  >(null);
  const [query, setQuery] = useState("");
  const [market, setMarket] = useState<FilterValue>("all");
  const [account, setAccount] = useState<FilterValue>("all");
  const [year, setYear] = useState<FilterValue>("all");
  const [positionStatus, setPositionStatus] =
    useState<FilterValue>("all");
  const [dataStatus, setDataStatus] = useState<FilterValue>("all");
  const [tag, setTag] = useState<FilterValue>("all");

  const selectedEntry = entries.find(
    (entry) => entry.instrument.id === selectedInstrumentId,
  );
  const selectedEpisode =
    selectedEntry?.episodes.find(
      ({ episode }) => episode.id === selectedEpisodeId,
    ) ?? selectedEntry?.episodes[0];

  const filterOptions = useMemo(
    () => ({
      markets: [...new Set(entries.map((entry) => entry.instrument.market))],
      accounts: [
        ...new Map(
          entries
            .flatMap((entry) => entry.executions)
            .map((execution) => [
              execution.accountId,
              {
                id: execution.accountId,
                label: execution.accountLabel,
              },
            ]),
        ).values(),
      ],
      years: [
        ...new Set(
          entries.flatMap((entry) =>
            entry.executions.map((execution) =>
              marketTradingDate(
                execution.executedAt,
                execution.instrument.market,
              ).slice(0, 4),
            ),
          ),
        ),
      ].sort((a, b) => b.localeCompare(a)),
    }),
    [entries],
  );

  const filteredEntries = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return entries.filter((entry) => {
      const status =
        marketDataStatuses[entry.instrument.id] ?? "not-requested";
      const dataIsComplete = status === "complete" || status === "ready";
      return (
        (!normalizedQuery ||
          entry.instrument.name
            .toLocaleLowerCase()
            .includes(normalizedQuery) ||
          entry.instrument.symbol
            .toLocaleLowerCase()
            .includes(normalizedQuery)) &&
        (market === "all" || entry.instrument.market === market) &&
        (account === "all" ||
          entry.executions.some(
            (execution) => execution.accountId === account,
          )) &&
        (year === "all" ||
          entry.executions.some((execution) =>
            marketTradingDate(
              execution.executedAt,
              execution.instrument.market,
            ).startsWith(year),
          )) &&
        (positionStatus === "all" ||
          entry.status === positionStatus) &&
        (tag === "all" || entry.confirmedTagIds.includes(tag)) &&
        (dataStatus === "all" ||
          (dataStatus === "complete" && dataIsComplete) ||
          (dataStatus === "incomplete" && !dataIsComplete))
      );
    });
  }, [
    account,
    dataStatus,
    entries,
    market,
    marketDataStatuses,
    positionStatus,
    query,
    tag,
    year,
  ]);

  if (selectedEntry && selectedEpisode) {
    const { episode, metrics } = selectedEpisode;
    const candles = candlesByInstrument[selectedEntry.instrument.id] ?? [];
    const chartCandles = aggregateCandles(
      candles.map(dailyRecordToChartCandle),
      timeframe === "1W" ? "1W" : "1D",
    );
    const cursor =
      chartCandles.at(-1)?.time ??
      episode.endedAt ??
      episode.startedAt;
    const selectedIndex = selectedEntry.episodes.findIndex(
      (item) => item.episode.id === episode.id,
    );
    const selectedNumber = selectedEntry.episodeCount - selectedIndex;

    return (
      <section className="trade-library trade-library-detail" aria-label="交易库">
        <header className="library-detail-header">
          <button
            className="library-back"
            aria-label="返回股票库"
            onClick={() => {
              setSelectedInstrumentId(null);
              setSelectedEpisodeId(null);
            }}
          >
            <ArrowLeft size={15} />
            返回股票库
          </button>
          <div>
            <span className="eyebrow">股票交易库 · 持仓回合</span>
            <h1>
              {selectedEntry.instrument.name}（
              {selectedEntry.instrument.symbol}）
            </h1>
            <p>
              {selectedEntry.accountCount} 个账户 ·{" "}
              {selectedEntry.tradeCount} 笔成交 ·{" "}
              {selectedEntry.episodeCount} 个回合
            </p>
          </div>
          <button
            className="library-open-review"
            onClick={() =>
              onOpenInReview(selectedEntry.instrument.id)
            }
          >
            <BookOpenCheck size={15} />
            进入逐笔复盘
          </button>
        </header>

        <div className="library-detail-layout">
          <aside className="library-episode-rail" aria-label="交易回合列表">
            <div className="library-episode-heading">
              <span>交易回合</span>
              <b>最近优先</b>
            </div>
            {selectedEntry.episodes.map((item, index) => {
              const chronologicalNumber =
                selectedEntry.episodeCount - index;
              const active = item.episode.id === episode.id;
              return (
                <button
                  key={item.episode.id}
                  className={`library-episode-card ${active ? "active" : ""}`}
                  aria-label={episodeLabel(item, chronologicalNumber)}
                  onClick={() =>
                    setSelectedEpisodeId(item.episode.id)
                  }
                >
                  <div>
                    <strong>第 {chronologicalNumber} 次交易</strong>
                    <span
                      className={`library-position-chip ${item.episode.status}`}
                    >
                      {item.episode.status === "open" ? "持仓中" : "已平仓"}
                    </span>
                  </div>
                  <p>
                    {formatMarketTradingDate(
                      item.episode.startedAt,
                      item.episode.instrument.market,
                    )}—
                    {item.episode.endedAt
                      ? formatMarketTradingDate(
                          item.episode.endedAt,
                          item.episode.instrument.market,
                        )
                      : "至今"}
                  </p>
                  <span className="library-review-status">
                    {item.reviewStatus === "completed"
                      ? "已复盘"
                      : "待复盘"}
                  </span>
                  <div>
                    <span>
                      {item.episode.direction === "long" ? "多头" : "空头"} ·{" "}
                      {item.metrics.buyCount} 买 / {item.metrics.sellCount} 卖
                    </span>
                    <b
                      className={
                        Number(item.metrics.netPnl ?? 0) >= 0
                          ? "positive"
                          : "negative"
                      }
                    >
                      {money(
                        item.metrics.netPnl,
                        selectedEntry.instrument.currency,
                      )}
                    </b>
                  </div>
                </button>
              );
            })}
          </aside>

          <div className="library-episode-content">
            <div className="library-episode-summary">
              <div>
                <span className="eyebrow">当前回合</span>
                <h2>第 {selectedNumber} 次交易</h2>
                <p>
                  {episode.accountLabel} ·{" "}
                  {episode.direction === "long" ? "多头" : "空头"} ·{" "}
                  {episode.status === "open" ? "持仓中" : "已平仓"}
                </p>
              </div>
              <div className="library-timeframes" aria-label="交易库K线周期">
                <button
                  className={timeframe === "1D" ? "active" : ""}
                  onClick={() => onTimeframeChange("1D")}
                >
                  1D
                </button>
                <button
                  className={timeframe === "1W" ? "active" : ""}
                  onClick={() => onTimeframeChange("1W")}
                >
                  1W
                </button>
              </div>
            </div>

            <div className="library-metric-grid">
              <div>
                <span>净盈亏</span>
                <strong
                  className={
                    Number(metrics.netPnl ?? 0) >= 0
                      ? "positive"
                      : "negative"
                  }
                >
                  {money(metrics.netPnl, selectedEntry.instrument.currency)}
                </strong>
              </div>
              <div>
                <span>收益率</span>
                <strong>
                  {metrics.returnPercent === null
                    ? "待行情"
                    : `${Number(metrics.returnPercent).toFixed(2)}%`}
                </strong>
              </div>
              <div>
                <span>成交</span>
                <strong>
                  {metrics.buyCount} 买 / {metrics.sellCount} 卖
                </strong>
              </div>
              <div>
                <span>费用</span>
                <strong>{metrics.fees}</strong>
              </div>
              <div>
                <span>R 倍数</span>
                <strong>
                  {selectedEpisode.rMultiple === null
                    ? "—"
                    : `${selectedEpisode.rMultiple}R`}
                </strong>
              </div>
            </div>

            {chartCandles.length > 0 ? (
              <div className="library-chart">
                <div className="library-chart-meta">
                  <BarChart3 size={14} />
                  <span>
                    {timeframe === "1W" ? "周线" : "日线"} · 本地缓存 · 买卖点
                  </span>
                </div>
                <ReplayChart
                  episodeId={episode.id}
                  candles={chartCandles}
                  executions={episode.executions}
                  cursor={cursor}
                  averageCost={0}
                  drawings={[]}
                  activeTool="cursor"
                  selectedDrawingId={null}
                  plannedRiskAmount={undefined}
                  settings={{
                    version: 1,
                    showGrid: true,
                    showVolume: true,
                    showExecutions: true,
                    showAverageCost: true,
                    colorScheme: "teal-red",
                  }}
                  onSelectDrawing={() => undefined}
                  onCommand={() => undefined}
                />
              </div>
            ) : (
              <div className="library-chart-empty">
                <Database size={20} />
                <strong>本地尚无行情</strong>
                <span>返回逐笔复盘后可手动更新这只股票。</span>
              </div>
            )}

            <div className="library-section-heading">
              <div>
                <strong>成交明细</strong>
                <span>仅显示当前持仓回合</span>
              </div>
              <b>{episode.executions.length} 笔</b>
            </div>
            <div className="library-execution-table">
              <div className="library-execution-head">
                <span>时间</span>
                <span>方向</span>
                <span>数量</span>
                <span>价格</span>
                <span>费用</span>
              </div>
              {episode.executions.map((execution) => (
                <div
                  className="library-execution-row"
                  data-testid="library-execution-row"
                  key={execution.id}
                >
                  <span>
                    <Clock3 size={12} />
                    {execution.source.sourceTimestampText ??
                      new Date(execution.executedAt).toLocaleString("zh-CN")}
                  </span>
                  <b
                    className={
                      execution.side === "buy" ? "positive" : "negative"
                    }
                  >
                    {execution.side === "buy" ? "买入" : "卖出"}
                  </b>
                  <span>{execution.quantity}</span>
                  <span>{execution.price}</span>
                  <span>{execution.fee}</span>
                </div>
              ))}
            </div>

            {reviewsHydrated ? (
              <EpisodeReviewEditor
                key={episode.id}
                episodeId={episode.id}
                instrumentId={selectedEntry.instrument.id}
                netPnl={metrics.netPnl}
                record={selectedEpisode.review}
                onSave={onSaveReview}
              />
            ) : (
              <section
                className="episode-review-editor"
                aria-label="正在读取当前回合复盘"
                aria-live="polite"
              >
                正在读取本机复盘记录…
              </section>
            )}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="trade-library" aria-label="交易库">
      <header className="library-header">
        <div>
          <span className="eyebrow">Trade Library</span>
          <h1>股票交易库</h1>
          <p>先按股票聚合，再进入每一次买入到卖出的持仓回合。</p>
        </div>
        <strong>{entries.length} 只股票</strong>
      </header>

      <div className="library-filters">
        <label className="library-search">
          <Search size={15} />
          <input
            type="search"
            aria-label="搜索股票"
            placeholder="搜索股票名或代码"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label>
          <span>市场</span>
          <select
            aria-label="按市场筛选"
            value={market}
            onChange={(event) => setMarket(event.target.value)}
          >
            <option value="all">全部市场</option>
            {filterOptions.markets.map((value) => (
              <option value={value} key={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>账户</span>
          <select
            aria-label="按账户筛选"
            value={account}
            onChange={(event) => setAccount(event.target.value)}
          >
            <option value="all">全部账户</option>
            {filterOptions.accounts.map((value) => (
              <option value={value.id} key={value.id}>
                {value.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>年份</span>
          <select
            aria-label="按年份筛选"
            value={year}
            onChange={(event) => setYear(event.target.value)}
          >
            <option value="all">全部年份</option>
            {filterOptions.years.map((value) => (
              <option value={value} key={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>状态</span>
          <select
            aria-label="按持仓状态筛选"
            value={positionStatus}
            onChange={(event) => setPositionStatus(event.target.value)}
          >
            <option value="all">全部状态</option>
            <option value="open">持仓中</option>
            <option value="closed">已平仓</option>
          </select>
        </label>
        <label>
          <span>行情</span>
          <select
            aria-label="按行情完整性筛选"
            value={dataStatus}
            onChange={(event) => setDataStatus(event.target.value)}
          >
            <option value="all">全部行情</option>
            <option value="complete">完整</option>
            <option value="incomplete">待补齐</option>
          </select>
        </label>
        <label>
          <span>标签</span>
          <select
            aria-label="按标签筛选"
            value={tag}
            onChange={(event) => setTag(event.target.value)}
          >
            <option value="all">全部标签</option>
            {REVIEW_TAGS.map(({ id, label }) => (
              <option value={id} key={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {filteredEntries.length === 0 ? (
        <div className="library-empty">
          <Database size={28} />
          <strong>
            {entries.length === 0 ? "还没有导入交易" : "没有符合条件的股票"}
          </strong>
          <span>
            {entries.length === 0
              ? "请先在逐笔复盘中导入券商成交记录。"
              : "调整搜索词或筛选条件后再试。"}
          </span>
        </div>
      ) : (
        <div className="library-stock-list">
          <div className="library-stock-head">
            <span>股票</span>
            <span>账户 / 成交 / 回合</span>
            <span>交易区间</span>
            <span>状态</span>
            <span>净盈亏 / 收益率</span>
            <span />
          </div>
          {filteredEntries.map((entry) => {
            const status =
              marketDataStatuses[entry.instrument.id] ?? "not-requested";
            return (
              <button
                className="library-stock-row"
                aria-label={`打开${entry.instrument.name}交易回合`}
                key={entry.instrument.id}
                onClick={() => {
                  setSelectedInstrumentId(entry.instrument.id);
                  setSelectedEpisodeId(
                    entry.episodes[0]?.episode.id ?? null,
                  );
                }}
              >
                <span className="library-stock-identity">
                  <b>{entry.instrument.market}</b>
                  <span>
                    <strong>{entry.instrument.name}</strong>
                    <small>{entry.instrument.symbol}</small>
                  </span>
                </span>
                <span className="library-stock-meta">
                  <span>
                    {entry.accountCount} 个账户 · {entry.tradeCount} 笔成交 ·{" "}
                    {entry.episodeCount} 个回合
                  </span>
                  <small>
                    {entry.cumulativeR === null
                      ? "累计 R —"
                      : `累计 ${entry.cumulativeR}R`}{" "}
                    ·{" "}
                    {entry.confirmedTagIds.length === 0
                      ? "标签待确认"
                      : entry.confirmedTagIds
                          .map(reviewTagLabel)
                          .join("、")}
                  </small>
                </span>
                <span>
                  {formatMarketTradingDate(
                    entry.firstTradeAt,
                    entry.instrument.market,
                  )}—
                  {formatMarketTradingDate(
                    entry.lastTradeAt,
                    entry.instrument.market,
                  )}
                </span>
                <span className="library-stock-status">
                  <b className={entry.status}>
                    {entry.status === "open" ? "持仓中" : "已平仓"}
                  </b>
                  <small>{marketDataStatusLabel(status)}</small>
                </span>
                <span className="library-stock-pnl">
                  <strong
                    className={
                      Number(entry.netPnl ?? 0) >= 0
                        ? "positive"
                        : "negative"
                    }
                  >
                    {money(entry.netPnl, entry.instrument.currency)}
                  </strong>
                  <small>
                    {entry.returnPercent === null
                      ? "收益率待行情"
                      : `${Number(entry.returnPercent).toFixed(2)}%`}
                  </small>
                </span>
                <ChevronRight size={16} />
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
