import Decimal from "decimal.js";

import type { FxSnapshot } from "../fx/contracts";
import {
  tradeNatureOf as executionTradeNatureOf,
  type TradeNature,
} from "../trades/types";
import {
  reviewState,
  type ReviewQueueItem,
  type ReviewQueueSort,
} from "./review-queue";
import { summarizeLibraryPerformance } from "./library-performance";

export type LibrarySortableItem<T> = {
  id: string;
  rows: ReviewQueueItem[];
  value: T;
};

export type LibraryPerformanceSortAvailability = {
  allowed: boolean;
  reason: string | null;
};

type PreparedItem<T> = {
  item: LibrarySortableItem<T>;
  index: number;
  latestExecutionAt: number | null;
  reviewRank: number;
  netPnl: Decimal | null;
  weightedReturn: Decimal | null;
};

function rowTradeNature(row: ReviewQueueItem): TradeNature {
  return row.entry.tradeNature ??
    row.item.episode.tradeNature ??
    (row.item.episode.executions[0]
      ? executionTradeNatureOf(row.item.episode.executions[0])
      : undefined) ??
    "unknown";
}

function rowSimulationRunId(row: ReviewQueueItem): string | null {
  return row.item.episode.simulationRunId ??
    row.entry.simulationRunId ??
    row.item.episode.executions[0]?.source.simulationRunId ??
    null;
}

function validExecutionTimestamp(value: string): number | null {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function latestExecutionTimestamp(rows: ReviewQueueItem[]): number | null {
  let latest: number | null = null;
  for (const row of rows) {
    for (const execution of row.item.episode.executions) {
      const timestamp = validExecutionTimestamp(execution.executedAt);
      if (timestamp !== null && (latest === null || timestamp > latest)) latest = timestamp;
    }
  }
  return latest;
}

function decimal(value: string | null): Decimal | null {
  if (value === null || value.trim() === "") return null;
  try {
    const parsed = new Decimal(value);
    return parsed.isFinite() ? parsed : null;
  } catch {
    return null;
  }
}

function reviewRankForRow(row: ReviewQueueItem, sort: ReviewQueueSort): number {
  const state = reviewState(row.item);
  if (sort === "pending-first") return state === "pending" ? 0 : state === "deferred" ? 1 : 2;
  return state === "completed" ? 0 : state === "deferred" ? 1 : 2;
}

function reviewRank(rows: ReviewQueueItem[], sort: ReviewQueueSort): number {
  if (rows.length === 0) return 3;
  return Math.min(...rows.map(row => reviewRankForRow(row, sort)));
}

function prepare<T>(
  items: Array<LibrarySortableItem<T>>,
  sort: ReviewQueueSort,
  fxSnapshot?: FxSnapshot,
): PreparedItem<T>[] {
  const performanceSort = sort === "net-profit" || sort === "net-loss" || sort === "return-high" || sort === "return-low";
  return items.map((item, index) => {
    const performance = performanceSort ? summarizeLibraryPerformance(item.rows, fxSnapshot).cny : null;
    return {
      item,
      index,
      latestExecutionAt: latestExecutionTimestamp(item.rows),
      reviewRank: reviewRank(item.rows, sort),
      netPnl: decimal(performance?.netPnl ?? null),
      weightedReturn: decimal(performance?.weightedReturn ?? null),
    };
  });
}

function compareId<T>(left: PreparedItem<T>, right: PreparedItem<T>): number {
  return left.item.id.localeCompare(right.item.id) || left.index - right.index;
}

function compareLatest<T>(left: PreparedItem<T>, right: PreparedItem<T>, direction: "newest" | "oldest"): number {
  if (left.latestExecutionAt === null || right.latestExecutionAt === null) {
    if (left.latestExecutionAt === null && right.latestExecutionAt === null) return compareId(left, right);
    return left.latestExecutionAt === null ? 1 : -1;
  }
  const timeComparison = direction === "newest"
    ? right.latestExecutionAt - left.latestExecutionAt
    : left.latestExecutionAt - right.latestExecutionAt;
  return timeComparison || compareId(left, right);
}

function compareDecimal<T>(
  left: Decimal | null,
  right: Decimal | null,
  direction: "high" | "low",
  leftItem: PreparedItem<T>,
  rightItem: PreparedItem<T>,
): number {
  if (left === null || right === null) {
    if (left === null && right === null) return compareId(leftItem, rightItem);
    return left === null ? 1 : -1;
  }
  return left.comparedTo(right) * (direction === "high" ? -1 : 1) || compareId(leftItem, rightItem);
}

function comparePrepared<T>(left: PreparedItem<T>, right: PreparedItem<T>, sort: ReviewQueueSort): number {
  if (sort === "newest" || sort === "oldest") return compareLatest(left, right, sort);
  if (sort === "pending-first" || sort === "completed-first") {
    return left.reviewRank - right.reviewRank || compareLatest(left, right, "newest");
  }
  if (sort === "net-profit") return compareDecimal(left.netPnl, right.netPnl, "high", left, right);
  if (sort === "net-loss") return compareDecimal(left.netPnl, right.netPnl, "low", left, right);
  if (sort === "return-high") return compareDecimal(left.weightedReturn, right.weightedReturn, "high", left, right);
  return compareDecimal(left.weightedReturn, right.weightedReturn, "low", left, right);
}

/** Sorts library groups from one precomputed snapshot-aware metric per item. */
export function sortLibraryItems<T>(
  items: Array<LibrarySortableItem<T>>,
  sort: ReviewQueueSort,
  fxSnapshot?: FxSnapshot,
): Array<LibrarySortableItem<T>> {
  return prepare(items, sort, fxSnapshot)
    .sort((left, right) => comparePrepared(left, right, sort))
    .map(({ item }) => item);
}

/** Returns whether a performance sort is comparable for the active review rows. */
export function canSortLibraryPerformance(
  rows: ReviewQueueItem[],
  selectedRunId: string,
): LibraryPerformanceSortAvailability {
  if (rows.length === 0) return { allowed: false, reason: "没有可排序的回合" };

  const natures = new Set(rows.map(rowTradeNature));
  const runIds = new Set(rows.map(rowSimulationRunId));
  if (natures.size > 1 || runIds.size > 1) {
    return { allowed: false, reason: "当前范围包含多个交易性质或模拟运行" };
  }

  const nature = rows[0] ? rowTradeNature(rows[0]) : "unknown";
  if (nature === "simulation") {
    const selected = selectedRunId.trim();
    if (!selected || selected.toLocaleLowerCase() === "all") {
      return { allowed: false, reason: "请先选择模拟运行" };
    }
    const [runId] = [...runIds];
    if (runId !== selected) {
      return { allowed: false, reason: "所选模拟运行与当前回合不一致" };
    }
  }

  return { allowed: true, reason: null };
}
