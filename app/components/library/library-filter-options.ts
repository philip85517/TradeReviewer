import { marketTradingDate } from "../../lib/market/trading-date";
import {
  normalizeBrokerId,
  normalizeBrokerIds,
  stableAccountDisplayLabels,
} from "../../lib/reviews/review-queue";
import { reviewTagLabel } from "../../lib/reviews/review-tags";
import { dashboardStableShortId } from "../../lib/reviews/dashboard";
import type { TradeLibraryEntry } from "../../lib/trades/library";

export type LibraryFilterOption = Readonly<{
  id: string;
  label: string;
}>;

export type LibraryFilterOptions = Readonly<{
  brokers: readonly LibraryFilterOption[];
  accounts: readonly LibraryFilterOption[];
  years: readonly LibraryFilterOption[];
  simulationRuns: readonly LibraryFilterOption[];
  positionStatuses: readonly LibraryFilterOption[];
  dataStatuses: readonly LibraryFilterOption[];
  tags: readonly LibraryFilterOption[];
}>;

const BROKER_LABELS: Readonly<Record<string, string>> = {
  futu: "富途",
  tiger: "Tiger",
  "china-merchants": "招商证券",
  tradingview: "TradingView",
  unknown: "来源未知",
};

const BROKER_ORDER: Readonly<Record<string, number>> = {
  futu: 0,
  tiger: 1,
  "china-merchants": 2,
  tradingview: 3,
  unknown: 99,
};

export { normalizeBrokerId, normalizeBrokerIds };

export function formatBrokerLabel(id: string): string {
  const value = id.trim();
  if (!value) return BROKER_LABELS.unknown;
  const canonical = normalizeBrokerId(value);
  return BROKER_LABELS[canonical] ?? value;
}

export function shortStableId(value: string): string {
  const trimmed = value.trim();
  return trimmed ? dashboardStableShortId(trimmed) : "未知";
}

export function formatSimulationRunLabel(
  runId: string,
  instrument?: { instrumentName?: string; symbol?: string },
): string {
  const name = instrument?.instrumentName?.trim();
  const symbol = instrument?.symbol?.trim();
  const instrumentLabel = name && symbol
    ? `${name}（${symbol}）`
    : name || symbol || "模拟运行";
  return `${instrumentLabel} · ${shortStableId(runId)}`;
}

function compareOption(left: LibraryFilterOption, right: LibraryFilterOption) {
  return left.label.localeCompare(right.label, "zh-CN") || left.id.localeCompare(right.id);
}

function sourceExecutions(entry: TradeLibraryEntry) {
  return [
    ...entry.executions,
    ...entry.episodes.flatMap(({ episode }) => episode.executions),
  ];
}

function brokerOptions(entries: TradeLibraryEntry[]): LibraryFilterOption[] {
  const values = new Set<string>();
  for (const entry of entries) {
    for (const execution of sourceExecutions(entry)) {
      values.add(normalizeBrokerId(execution.source.platform));
    }
  }
  return [...values]
    .map((id) => ({ id, label: formatBrokerLabel(id) }))
    .sort((left, right) =>
      (BROKER_ORDER[left.id] ?? 50) - (BROKER_ORDER[right.id] ?? 50) ||
      compareOption(left, right),
    );
}

function accountOptions(entries: TradeLibraryEntry[]): LibraryFilterOption[] {
  const byId = new Map<string, { id: string; label: string }>();
  for (const entry of entries) {
    for (const execution of sourceExecutions(entry)) {
      if (!byId.has(execution.accountId)) {
        byId.set(execution.accountId, {
          id: execution.accountId,
          label: execution.accountLabel?.trim() || execution.accountId,
        });
      }
    }
  }
  const records = [...byId.values()];
  const displayLabels = stableAccountDisplayLabels(records);
  return records
    .map(({ id, label }) => ({ id, label: displayLabels.get(id) ?? label }))
    .sort(compareOption);
}

function runOptions(entries: TradeLibraryEntry[]): LibraryFilterOption[] {
  const runs = new Map<string, { instrumentName: string; symbol: string }>();
  const add = (runId: string | undefined, entry: TradeLibraryEntry) => {
    if (!runId || runs.has(runId)) return;
    runs.set(runId, {
      instrumentName: entry.instrument.name,
      symbol: entry.instrument.symbol,
    });
  };
  for (const entry of entries) {
    add(entry.simulationRunId, entry);
    for (const item of entry.episodes) {
      add(item.episode.simulationRunId, entry);
      for (const execution of item.episode.executions) {
        add(execution.source.simulationRunId, entry);
      }
    }
  }
  return [...runs.entries()]
    .map(([id, instrument]) => ({
      id,
      label: formatSimulationRunLabel(id, instrument),
    }))
    .sort(compareOption);
}

function yearOptions(entries: TradeLibraryEntry[]): LibraryFilterOption[] {
  const years = new Set<string>();
  for (const entry of entries) {
    for (const execution of sourceExecutions(entry)) {
      const year = marketTradingDate(execution.executedAt, entry.instrument.market).slice(0, 4);
      if (/^\d{4}$/.test(year)) years.add(year);
    }
  }
  return [...years]
    .sort((left, right) => right.localeCompare(left))
    .map((year) => ({ id: year, label: `${year} 年` }));
}

function valueOptions(values: ReadonlyArray<LibraryFilterOption>): LibraryFilterOption[] {
  return [{ id: "all", label: "全部" }, ...values];
}

function tagOptions(entries: TradeLibraryEntry[]): LibraryFilterOption[] {
  const tags = new Set(entries.flatMap((entry) => [
    ...entry.confirmedTagIds,
    ...entry.episodes.flatMap((item) => item.confirmedTagIds),
  ]));
  return [...tags].sort().map((id) => ({ id, label: reviewTagLabel(id) }));
}

export function buildLibraryFilterOptions(entries: TradeLibraryEntry[]): LibraryFilterOptions {
  return {
    brokers: brokerOptions(entries),
    accounts: accountOptions(entries),
    years: yearOptions(entries),
    simulationRuns: runOptions(entries),
    positionStatuses: valueOptions([
      { id: "open", label: "持仓中" },
      { id: "closed", label: "已平仓" },
    ]),
    dataStatuses: valueOptions([
      { id: "complete", label: "行情完整" },
      { id: "incomplete", label: "行情待补" },
    ]),
    tags: tagOptions(entries),
  };
}
