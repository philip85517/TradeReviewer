"use client";
import { useModalFocus } from "../import/use-modal-focus";
import { replayCursorAt, replayExecutionAt } from "../../lib/import/statement-evidence";
import { formatMarketTradingDate } from "../../lib/market/trading-date";
import type { Instrument, TradeEpisode } from "../../lib/trades/types";

type Props = {
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
  instrument?: Instrument;
  episodes: TradeEpisode[];
  selectedEpisodeId?: string;
  cursor: string;
  onSelectEpisode: (id: string) => void;
  onLocate: (cursor: string) => void;
  onNext: () => void;
  onSwitchStock: () => void;
  onLibrary: () => void;
};
const date = (value: string) => new Date(value).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false });
const dateOnlyLabel = (execution: TradeEpisode["executions"][number]) =>
  `${formatMarketTradingDate(replayExecutionAt(execution).slice(0, 10), execution.instrument.market)} · 未提供成交时刻`;
const episodeDate = (episode: TradeEpisode) => {
  const execution = episode.executions[0];
  if (!execution || execution.source.timePrecision !== "date-only") {
    return date(episode.startedAt);
  }
  return dateOnlyLabel(execution);
};
export function StockEpisodeNavigation(props: Props) {
  const dialogRef = useModalFocus(() => props.onCloseMobile?.(), props.mobileOpen ?? false);
  const selected = props.episodes.find((episode) => episode.id === props.selectedEpisodeId);
  const knowledgeAt = replayCursorAt(props.cursor);
  const revealed = selected?.executions.filter((execution) => replayExecutionAt(execution) <= knowledgeAt) ?? [];
  const hasNext = selected?.executions.some((execution) => replayExecutionAt(execution) > knowledgeAt) ?? false;
  return <aside ref={dialogRef} className="stock-context" role={props.mobileOpen ? "dialog" : undefined} aria-modal={props.mobileOpen || undefined} aria-label="当前股票交易导航">
    {props.mobileOpen && <button onClick={props.onCloseMobile}>关闭本股交易</button>}
    <header><small>当前股票</small><h2>{props.instrument?.name ?? "演示复盘"}</h2><span>{props.instrument?.symbol}</span></header>
    <div className="stock-context-actions"><button onClick={props.onSwitchStock}>切换股票</button><button onClick={props.onLibrary}>返回交易库</button></div>
    <h3>交易回合</h3>
    <div className="stock-context-episodes">{props.episodes.map((episode, index) => <button key={episode.id} aria-pressed={episode.id === props.selectedEpisodeId} onClick={() => props.onSelectEpisode(episode.id)}><strong>第 {props.episodes.length - index} 次交易</strong><span>{episode.accountLabel}</span><time>{episodeDate(episode)}</time></button>)}</div>
    <h3>已揭示成交 <span>{revealed.length} 笔</span></h3>
    {selected && revealed.length === 0 && <p className="replay-entry-notice">当前尚未回放到首笔成交</p>}
    {!selected && <p>请选择股票和交易回合。</p>}
    <ol className="stock-context-fills">{revealed.map((execution) => { const at = replayExecutionAt(execution); const dateOnly = execution.source.timePrecision === "date-only"; const label = dateOnly ? dateOnlyLabel(execution) : date(execution.executedAt); return <li key={execution.id}><button aria-label={`定位${execution.side === "buy" ? "买入" : "卖出"} ${label}`} aria-current={at === knowledgeAt ? "step" : undefined} onClick={() => props.onLocate(dateOnly ? at : execution.executedAt)}><time>{label}</time><strong>{execution.side === "buy" ? "买入" : "卖出"} {execution.quantity} @ {execution.price}</strong></button></li>; })}</ol>
    {hasNext && <button className="secondary-action" onClick={props.onNext}>下一成交</button>}
  </aside>;
}
