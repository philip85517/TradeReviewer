"use client";

import { CandlestickChart, Clock3, DatabaseZap } from "lucide-react";

import type { TradeEpisode } from "../../lib/trades/types";

type Props = {
  episode: TradeEpisode;
};

export function ImportedEpisodeReview({ episode }: Props) {
  return (
    <section className="imported-review" aria-label="导入交易回合详情">
      <div className="imported-review-callout">
        <div className="callout-icon">
          <CandlestickChart size={22} />
        </div>
        <div>
          <span className="eyebrow">成交记录已就绪</span>
          <h2>{episode.instrument.symbol} 交易回合</h2>
          <p>
            成交已保存在本机。连接对应市场的历史行情源后，即可从首笔成交前开始逐根回放。
          </p>
        </div>
        <span className="pending-market-badge">
          <DatabaseZap size={14} />
          待接行情
        </span>
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
        {episode.executions.map((execution) => (
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
