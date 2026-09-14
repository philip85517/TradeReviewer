import type { TradeEpisode } from "../trades/types";

export function intradayReplayRestriction(episode: Pick<TradeEpisode, "executions" | "positionEvents" | "accuracy">): string | undefined {
  const ambiguousEventTime = episode.accuracy?.reasons.includes("ambiguous-event-order") || episode.positionEvents?.some(event => (event.kind === "transfer-in" || event.kind === "transfer-out") && event.date.length <= 10);
  if (ambiguousEventTime) return "持仓事件只有日期，无法确认日内先后，仅支持日期级回放";
  if (episode.executions.some(e => e.source.timePrecision === "date-only" || e.source.sourceTimeKind === "order")) return "账单缺少明确成交时刻，仅支持日期级回放";
}
