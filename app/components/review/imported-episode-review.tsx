"use client";

import {
  CandlestickChart,
  Clock3,
  DatabaseZap,
  RefreshCw,
} from "lucide-react";
import { useMemo } from "react";

import type { MarketDataSyncStatus } from "../../lib/market/sync-status";
import { marketDataStatusLabel } from "../../lib/market/sync-status";
import { aggregateCandles } from "../../lib/market/aggregate";
import type { DailyCandleRecord } from "../../lib/market/contracts";
import {
  dailyRecordToChartCandle,
  type Timeframe,
} from "../../lib/market/types";
import type { InstrumentTradeSummary } from "../../lib/trades/instruments";
import { ReplayChart } from "../chart/replay-chart";

type Props = {
  summary: InstrumentTradeSummary;
  marketDataStatus: MarketDataSyncStatus;
  onUpdateMarketData: () => void;
  timeframe: Timeframe;
  candles: DailyCandleRecord[];
};

function date(value: string) {
  return new Date(value).toLocaleDateString("zh-CN");
}

export function ImportedEpisodeReview({
  summary,
  marketDataStatus,
  onUpdateMarketData,
  timeframe,
  candles,
}: Props) {
  const { instrument, executions } = summary;
  const chartCandles = useMemo(
    () =>
      aggregateCandles(
        candles.map(dailyRecordToChartCandle),
        timeframe === "1W" ? "1W" : "1D",
      ),
    [candles, timeframe],
  );
  const firstCandle = candles[0];
  const lastCandle = candles.at(-1);
  const providerLabel =
    lastCandle?.provider === "tencent"
      ? "腾讯公开行情"
      : lastCandle?.provider === "eastmoney"
        ? "东方财富公开行情"
        : lastCandle?.provider === "yahoo"
          ? "Yahoo Finance 公开行情"
          : null;
  return (
    <section className="imported-review" aria-label="导入股票成交详情">
      <div className="imported-review-callout">
        <div className="callout-icon">
          <CandlestickChart size={22} />
        </div>
        <div>
          <span className="eyebrow">股票成交已导入</span>
          <h2>
            {instrument.name}（{instrument.symbol}）
          </h2>
          <p>
            已导入 {summary.tradeCount} 笔成交，交易区间为{" "}
            {date(summary.firstTradeAt)} 至 {date(summary.lastTradeAt)}。
            {candles.length > 0
              ? ` 已缓存 ${candles.length} 根日线，可直接复盘且不会重复请求。`
              : " 当前尚缺少该股票的历史 K 线，行情补齐后即可从首笔成交前开始逐根复盘。"}
          </p>
        </div>
        <div className="market-update-action">
          <span className={`pending-market-badge ${marketDataStatus}`}>
            <DatabaseZap size={14} />
            {marketDataStatusLabel(marketDataStatus)}
          </span>
          <button
            className="update-market-button"
            disabled={marketDataStatus === "syncing"}
            onClick={onUpdateMarketData}
          >
            <RefreshCw
              size={14}
              className={marketDataStatus === "syncing" ? "spinning" : ""}
            />
            更新 {instrument.name} 行情
          </button>
        </div>
      </div>

      {chartCandles.length > 0 && lastCandle && (
        <div
          className="imported-market-chart"
          data-testid="imported-market-chart"
        >
          <div className="imported-market-meta">
            <strong>
              {timeframe === "1W" ? "周线" : "日线"} · 本地缓存
            </strong>
            <span>
              {providerLabel} · {firstCandle?.tradingDate} 至{" "}
              {lastCandle.tradingDate} · 抓取于{" "}
              {new Date(lastCandle.fetchedAt).toLocaleString("zh-CN")}
            </span>
          </div>
          <ReplayChart
            candles={chartCandles}
            executions={executions}
            cursor={chartCandles.at(-1)?.time ?? summary.lastTradeAt}
            averageCost={0}
            drawings={[]}
            activeTool="cursor"
            onAddDrawing={() => undefined}
          />
        </div>
      )}

      <div className="execution-section-heading">
        <div>
          <strong>{instrument.name} 成交明细</strong>
          <span>{instrument.symbol} · {instrument.market}</span>
        </div>
        <b>{summary.tradeCount} 笔</b>
      </div>
      <div className="execution-review-table">
        <div className="execution-review-head">
          <span>时间</span>
          <span>方向</span>
          <span>数量</span>
          <span>价格</span>
          <span>费用</span>
          <span>源时区</span>
        </div>
        {executions.map((execution) => {
          const isDateOnly =
            execution.source.timePrecision === "date-only";
          const timestampText =
            execution.source.sourceTimestampText ??
            (isDateOnly
              ? date(execution.executedAt)
              : new Date(execution.executedAt).toLocaleString("zh-CN"));

          return (
            <div className="execution-review-row" key={execution.id}>
              <span>
                <Clock3 size={13} />
                {timestampText}
                {isDateOnly ? " · 对账单未提供成交时间" : null}
              </span>
              <b
                className={execution.side === "buy" ? "positive" : "negative"}
              >
                {execution.side === "buy" ? "买入" : "卖出"}
              </b>
              <span>{execution.quantity}</span>
              <span>{execution.price}</span>
              <span>{execution.fee}</span>
              <span>{execution.source.sourceTimezone ?? "已含时区"}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
