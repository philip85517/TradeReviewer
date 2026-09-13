import { marketTradingDate } from "../market/trading-date";
import { instrumentPresentation } from "../instruments/instrument-presentation";
import type { TradeLibraryEntry, TradeLibraryEpisode } from "../trades/library";
import Decimal from "decimal.js";

export type ReviewQueueSort =
  | "newest"
  | "oldest"
  | "pending-first"
  | "completed-first"
  | "net-profit"
  | "net-loss"
  | "return-high"
  | "return-low";

export const REVIEW_QUEUE_SORT_OPTIONS: ReadonlyArray<{
  value: ReviewQueueSort;
  label: string;
}> = [
  { value: "newest", label: "最近开始" },
  { value: "oldest", label: "最早开始" },
  { value: "pending-first", label: "未复盘优先" },
  { value: "completed-first", label: "已复盘优先" },
  { value: "net-profit", label: "净盈利优先" },
  { value: "net-loss", label: "净亏损优先" },
  { value: "return-high", label: "收益率高到低" },
  { value: "return-low", label: "收益率低到高" },
];

export type ReviewQueueFilter = {
  status?: "pending" | "completed" | "all";
  query?: string;
  account?: string;
  brokers?: string[];
  accounts?: string[];
  market?: string;
  year?: string;
  nature?: string;
  simulationRunId?: string;
  sort?: ReviewQueueSort;
  advancedExpanded?: boolean;
};
export type ReviewQueueItem = { entry: TradeLibraryEntry; item: TradeLibraryEpisode };
export type ReviewQueueBrokerTag = { id: string; label: string };

export function reviewQueueMarketLabel(market: string): string {
  if (market === "HK") return "港股";
  if (market === "US") return "美股";
  return market.trim() || "未知市场";
}

function brokerTagForExecution(execution: TradeLibraryEpisode["episode"]["executions"][number]): ReviewQueueBrokerTag {
  const platform = typeof execution.source?.platform === "string"
    ? execution.source.platform.trim()
    : "";
  if (!platform) return { id: "unknown", label: "来源未知" };
  if (platform === "futu") return { id: platform, label: "富途" };
  if (platform === "tiger") return { id: platform, label: "Tiger" };
  return { id: platform, label: platform };
}

function sortBrokerTags(left: ReviewQueueBrokerTag, right: ReviewQueueBrokerTag) {
  return left.id.localeCompare(right.id) || left.label.localeCompare(right.label);
}

function reviewQueueTradeNature(row: ReviewQueueItem) {
  return row.entry.tradeNature ?? row.item.episode.tradeNature ?? "unknown";
}

function reviewQueueSimulationRunId(row: ReviewQueueItem) {
  return row.item.episode.simulationRunId ?? row.entry.simulationRunId;
}

export function reviewQueueBrokerTags(row: ReviewQueueItem): ReviewQueueBrokerTag[] {
  const tags = new Map<string, ReviewQueueBrokerTag>();
  const executions = row.item.episode.executions;
  if (executions.length === 0) tags.set("unknown", { id: "unknown", label: "来源未知" });
  for (const execution of executions) {
    const tag = brokerTagForExecution(execution);
    tags.set(tag.id, tag);
  }
  return [...tags.values()].sort(sortBrokerTags);
}

export function reviewQueueBrokerOptions(entries: TradeLibraryEntry[]): ReviewQueueBrokerTag[] {
  const tags = new Map<string, ReviewQueueBrokerTag>();
  for (const entry of entries) {
    const executions = [
      ...entry.executions,
      ...entry.episodes.flatMap(({ episode }) => episode.executions),
    ];
    if (executions.length === 0 && entry.episodes.length > 0) {
      tags.set("unknown", { id: "unknown", label: "来源未知" });
    }
    for (const execution of executions) {
      const tag = brokerTagForExecution(execution);
      tags.set(tag.id, tag);
    }
  }
  return [...tags.values()].sort(sortBrokerTags);
}

export function stableAccountDisplayLabels(
  accounts: ReadonlyArray<{ id: string; label: string }>,
) {
  const idsByLabel = new Map<string, string[]>();
  for (const { id, label } of accounts) {
    const ids = idsByLabel.get(label) ?? [];
    if (!ids.includes(id)) ids.push(id);
    idsByLabel.set(label, ids);
  }
  for (const ids of idsByLabel.values()) {
    ids.sort((left, right) => left < right ? -1 : left > right ? 1 : 0);
  }
  return new Map(accounts.map(({ id, label }) => {
    const ids = idsByLabel.get(label) ?? [];
    if (ids.length < 2) return [id, label] as const;
    return [id, `${label}（账户${ids.indexOf(id) + 1}）`] as const;
  }));
}

export function reviewState(item: TradeLibraryEpisode) {
  if (item.review?.review.completed) return "completed";
  return item.review?.review.deferredReason?.trim() ? "deferred" : "pending";
}

export function hasTrustedClosedMetrics(item: TradeLibraryEpisode) {
  return item.episode.status === "closed" &&
    item.metrics.pnlAvailable !== false &&
    item.metrics.netPnl !== null;
}

function decimal(value: string | null) {
  if (value === null) return null;
  try {
    const parsed = new Decimal(value);
    return parsed.isFinite() ? parsed : null;
  } catch {
    return null;
  }
}

function metricForSort(row: ReviewQueueItem, sort: ReviewQueueSort) {
  if (!hasTrustedClosedMetrics(row.item)) return null;
  return decimal(sort === "return-high" || sort === "return-low"
    ? row.item.metrics.returnPercent
    : row.item.metrics.netPnl);
}

function stableTieBreak(left: ReviewQueueItem, right: ReviewQueueItem) {
  return right.item.episode.startedAt.localeCompare(left.item.episode.startedAt) ||
    left.item.episode.id.localeCompare(right.item.episode.id);
}

function compareMetric(left: ReviewQueueItem, right: ReviewQueueItem, sort: ReviewQueueSort) {
  const leftValue = metricForSort(left, sort);
  const rightValue = metricForSort(right, sort);
  if (!leftValue || !rightValue) {
    if (!leftValue && !rightValue) return stableTieBreak(left, right);
    return leftValue ? -1 : 1;
  }
  const direction = sort === "net-loss" || sort === "return-low" ? 1 : -1;
  return leftValue.comparedTo(rightValue) * direction || stableTieBreak(left, right);
}

export function sortReviewQueueItems(
  rows: ReviewQueueItem[],
  sort: ReviewQueueSort = "newest",
) {
  const sorted = [...rows];
  if (sort === "net-profit" || sort === "net-loss") {
    return sorted.sort((left, right) =>
      left.entry.instrument.currency.localeCompare(right.entry.instrument.currency) ||
      compareMetric(left, right, sort),
    );
  }
  if (sort === "pending-first" || sort === "completed-first") {
    const rank = sort === "pending-first"
      ? { pending: 0, deferred: 1, completed: 2 }
      : { completed: 0, pending: 1, deferred: 2 };
    return sorted.sort((left, right) =>
      rank[reviewState(left.item)] - rank[reviewState(right.item)] ||
      stableTieBreak(left, right),
    );
  }
  if (sort === "return-high" || sort === "return-low") {
    return sorted.sort((left, right) => compareMetric(left, right, sort));
  }
  return sorted.sort((left, right) =>
    (sort === "oldest" ? -1 : 1) *
      right.item.episode.startedAt.localeCompare(left.item.episode.startedAt) ||
    left.item.episode.id.localeCompare(right.item.episode.id),
  );
}

export function reviewQueueEpisodeIds(rows: ReviewQueueItem[]) {
  return rows.map(({ item }) => item.episode.id);
}

export function buildReviewQueue(entries: TradeLibraryEntry[], filter: ReviewQueueFilter = {}): ReviewQueueItem[] {
  const query = filter.query?.trim().toLocaleLowerCase();
  const matches = (value: string | undefined, actual: string | undefined) => !value || value === "all" || value === actual;
  const matchesAny = (values: string[] | undefined, actual: string[]) =>
    !values || values.length === 0 || actual.some(value => values.includes(value));
  const rows = entries.flatMap(entry => entry.episodes.map(item => ({entry,item})))
    .filter(({entry,item}) => {
      const episode = item.episode;
      const accountMatches = filter.accounts === undefined
        ? matches(filter.account, episode.accountId)
        : matchesAny(filter.accounts, [episode.accountId]);
      const brokerMatches = matchesAny(
        filter.brokers,
        reviewQueueBrokerTags({ entry, item }).map(({ id }) => id),
      );
      return matches(filter.status, reviewState(item)) &&
        accountMatches && brokerMatches && matches(filter.market, entry.instrument.market) &&
        matches(filter.nature, reviewQueueTradeNature({ entry, item })) &&
        matches(filter.simulationRunId, reviewQueueSimulationRunId({ entry, item })) &&
        (!filter.year || filter.year === "all" || episode.executions.some(fill => marketTradingDate(fill.executedAt, entry.instrument.market).startsWith(filter.year!))) &&
        (!query || instrumentPresentation(entry.instrument).searchText.toLocaleLowerCase().includes(query));
    });
  return sortReviewQueueItems(rows, filter.sort);
}
