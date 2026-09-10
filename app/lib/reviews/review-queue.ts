import { marketTradingDate } from "../market/trading-date";
import type { TradeLibraryEntry, TradeLibraryEpisode } from "../trades/library";

export type ReviewQueueFilter = {
  status?: "pending" | "completed" | "all";
  query?: string;
  account?: string;
  market?: string;
  year?: string;
  nature?: string;
};
export type ReviewQueueItem = { entry: TradeLibraryEntry; item: TradeLibraryEpisode };

export function reviewState(item: TradeLibraryEpisode) {
  if (item.review?.review.completed) return "completed";
  return item.review?.review.deferredReason?.trim() ? "deferred" : "pending";
}

export function buildReviewQueue(entries: TradeLibraryEntry[], filter: ReviewQueueFilter = {}): ReviewQueueItem[] {
  const query = filter.query?.trim().toLocaleLowerCase();
  const matches = (value: string | undefined, actual: string | undefined) => !value || value === "all" || value === actual;
  return entries.flatMap(entry => entry.episodes.map(item => ({entry,item})))
    .filter(({entry,item}) => {
      const episode = item.episode;
      return matches(filter.status, reviewState(item)) &&
        matches(filter.account, episode.accountId) && matches(filter.market, entry.instrument.market) &&
        matches(filter.nature, entry.tradeNature ?? "unknown") &&
        (!filter.year || filter.year === "all" || episode.executions.some(fill => marketTradingDate(fill.executedAt, entry.instrument.market).startsWith(filter.year!))) &&
        (!query || `${entry.instrument.name} ${entry.instrument.symbol}`.toLocaleLowerCase().includes(query));
    })
    .sort((a,b) => b.item.episode.startedAt.localeCompare(a.item.episode.startedAt) || a.item.episode.id.localeCompare(b.item.episode.id));
}
