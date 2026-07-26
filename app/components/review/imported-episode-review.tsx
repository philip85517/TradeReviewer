"use client";

import {
  CandlestickChart,
  Clock3,
  DatabaseZap,
  RefreshCw,
} from "lucide-react";

import type { MarketDataSyncStatus } from "../../lib/market/sync-status";
import { marketDataStatusLabel } from "../../lib/market/sync-status";
import type { InstrumentTradeSummary } from "../../lib/trades/instruments";

type Props = {
  summary: InstrumentTradeSummary;
  marketDataStatus: MarketDataSyncStatus;
  onUpdateMarketData: () => void;
};

function date(value: string) {
  return new Date(value).toLocaleDateString("zh-CN");
}

export function ImportedEpisodeReview({
  summary,
  marketDataStatus,
  onUpdateMarketData,
}: Props) {
  const { instrument, executions } = summary;
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
            当前尚缺少该股票的历史 K 线，行情补齐后即可从首笔成交前开始逐根复盘。
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
        {executions.map((execution) => (
          <div className="execution-review-row" key={execution.id}>
            <span>
              <Clock3 size={13} />
              {execution.source.sourceTimestampText ??
                new Date(execution.executedAt).toLocaleString("zh-CN")}
            </span>
            <b className={execution.side === "buy" ? "positive" : "negative"}>
              {execution.side === "buy" ? "买入" : "卖出"}
            </b>
            <span>{execution.quantity}</span>
            <span>{execution.price}</span>
            <span>{execution.fee}</span>
            <span>{execution.source.sourceTimezone ?? "已含时区"}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
