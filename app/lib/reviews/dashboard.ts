import Decimal from "decimal.js";

import { marketTradingDate } from "../market/trading-date";
import { instrumentPresentation } from "../instruments/instrument-presentation";
import type {
  TradeLibraryEntry,
  TradeLibraryEpisode,
} from "../trades/library";
import {
  type Instrument,
  type TradeExecution,
  type TradeNature,
} from "../trades/types";
import { displayTradeNature } from "../trades/trading-nature";

/**
 * The market selector is deliberately made of display/query concepts. These
 * values never get persisted on an instrument, so adding the A-share or
 * Connect aggregate cannot change an existing instrument identity.
 */
export type DashboardMarketFilter = string;

export const DASHBOARD_MARKET_FILTERS = {
  all: "all",
  aShare: "a-share",
  shanghai: "CN-SH",
  shenzhen: "CN-SZ",
  hongKong: "HK",
  hongKongConnect: "hk-connect",
} as const;

export type DashboardRow = {
  entry: TradeLibraryEntry;
  item: TradeLibraryEpisode;
};

export type DashboardFilter = {
  market?: DashboardMarketFilter;
  query?: string;
  status?: "all" | "pending" | "completed" | "deferred" | "open" | "closed";
  account?: string;
  accounts?: string[];
  currency?: string;
  currencies?: string[];
  nature?: TradeNature | "all";
  simulationRunId?: string;
  year?: string;
  startDate?: string | null;
  endDate?: string | null;
};

export const DEFAULT_DASHBOARD_FILTER: DashboardFilter = {
  market: DASHBOARD_MARKET_FILTERS.all,
  status: "all",
  account: "all",
  currency: "all",
  nature: "all",
  simulationRunId: "all",
};

export type DashboardExclusionReason =
  | "open"
  | "unknown-fees"
  | "currency-conversion"
  | "history-incomplete"
  | "accuracy"
  | "pnl-unavailable"
  | "missing-pnl";

export type DashboardScope = {
  id: string;
  label: string;
  market: string;
  actualMarkets: string[];
  tradeNature: TradeNature;
  simulationRunId: string | null;
  currency: string;
};

export type DashboardStats = {
  sampleCount: number;
  reviewedCount: number;
  pendingCount: number;
  openCount: number;
  closedCount: number;
  trustedClosedCount: number;
  excludedCount: number;
  unavailableCount: number;
  wins: number;
  losses: number;
  breakEven: number;
  netPnl: string | null;
  fees: string | null;
  grossProfit: string | null;
  grossLoss: string | null;
  averageWin: string | null;
  averageLoss: string | null;
  payoff: string | null;
  payoffReason: string | null;
  profitFactor: string | null;
  profitFactorReason: string | null;
  winRate: { wins: number; denominator: number } | null;
  exclusionReasons: Partial<Record<DashboardExclusionReason, number>>;
  currency: string | null;
  groupReason: string | null;
};

export type DashboardGroup = {
  scope: DashboardScope;
  rows: DashboardRow[];
  stats: DashboardStats;
};

export type DashboardCalendarPeriod = "day" | "week" | "month";
export type DashboardCalendarState =
  | "positive"
  | "negative"
  | "break-even"
  | "empty"
  | "unavailable";

export type DashboardCalendarCell = {
  period: DashboardCalendarPeriod;
  key: string;
  label: string;
  startDate: string;
  endDate: string;
  netPnl: string | null;
  trustedClosedCount: number;
  excludedCount: number;
  state: DashboardCalendarState;
  unavailableReason: string | null;
  episodeIds: string[];
  excludedEpisodeIds: string[];
};

export type DashboardModel = {
  filter: DashboardFilter;
  rows: DashboardRow[];
  groups: DashboardGroup[];
  stats: DashboardStats;
  selectedGroupId: string | null;
  calendar: DashboardCalendarCell[];
};

export type DashboardMarketOption = {
  value: DashboardMarketFilter;
  label: string;
};

const MULTI_GROUP_REASON = "统计范围包含多个币种、市场、交易性质或模拟运行";

function normalizedMarket(value: string | undefined): string {
  return value?.trim().toUpperCase() ?? "";
}

function normalizedCurrency(value: string | undefined): string {
  const currency = value?.trim().toUpperCase() ?? "";
  if (currency === "人民币" || currency === "RMB") return "CNY";
  if (currency === "港币" || currency === "HK$" || currency === "HKD") return "HKD";
  if (currency === "美元" || currency === "US$" || currency === "USD") return "USD";
  return currency;
}

/** A stable short identifier for UI labels; the original ID remains the value. */
export function dashboardStableShortId(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).toUpperCase().padStart(4, "0").slice(-4);
}

export function dashboardInstrumentLabel(instrument: Instrument): string {
  return `${instrumentPresentation(instrument).primaryName}（${instrument.symbol}）`;
}

function sourceValue(execution: TradeExecution, key: string): string {
  const source = execution.source as unknown as Record<string, unknown>;
  const value = source[key];
  return typeof value === "string" ? value.trim() : "";
}

function sourceChannel(execution: TradeExecution): string {
  const values = [
    sourceValue(execution, "channel"),
    sourceValue(execution, "sourceMarket"),
    sourceValue(execution, "marketChannel"),
    execution.source.venue?.trim() ?? "",
  ];
  return values.filter(Boolean).join(" ").toLocaleLowerCase();
}

function channelDeclaresConnect(execution: TradeExecution): boolean {
  const value = sourceChannel(execution);
  return [
    "hk-connect",
    "hk_connect",
    "hkconnect",
    "stock connect",
    "港股通",
    "沪港通",
    "深港通",
    "southbound",
  ].some(token => value.includes(token));
}

function channelDeclaresOrdinaryHongKong(execution: TradeExecution): boolean {
  const value = sourceChannel(execution);
  return ["ordinary", "普通港股", "港股（普通）", "港股(普通)"].some(token => value.includes(token));
}

/**
 * HK Connect is a channel backed by statement/source evidence. In the
 * current normalized data a China Merchants HK row keeps HKD as the quote
 * currency and CNY as its settlement currency, which is enough evidence even
 * though there is no persisted `sourceMarket` field.
 */
export function isHongKongConnectExecution(execution: TradeExecution): boolean {
  if (normalizedMarket(execution.instrument.market) !== "HK") return false;
  if (channelDeclaresOrdinaryHongKong(execution)) return false;
  if (channelDeclaresConnect(execution)) return true;
  const platform = sourceValue(execution, "platform").toLocaleLowerCase();
  const settlementCurrency = normalizedCurrency(execution.source.settlement?.currency);
  return platform === "china-merchants" && settlementCurrency === "CNY";
}

export function isAShareMarket(market: string | Instrument): boolean {
  const value = typeof market === "string" ? market : market.market;
  return ["CN", "CN-SH", "CN-SZ", "SH", "SZ", "SSE", "SZSE"].includes(normalizedMarket(value));
}

export function isShanghaiShareMarket(market: string | Instrument): boolean {
  const value = typeof market === "string" ? market : market.market;
  return ["CN-SH", "SH", "SSE"].includes(normalizedMarket(value));
}

export function isShenzhenShareMarket(market: string | Instrument): boolean {
  const value = typeof market === "string" ? market : market.market;
  return ["CN-SZ", "SZ", "SZSE"].includes(normalizedMarket(value));
}

export function dashboardMarketGroup(market: string | Instrument): string {
  const value = typeof market === "string" ? market : market.market;
  if (isAShareMarket(value)) return "a-share";
  return normalizedMarket(value) || "unknown";
}

export function dashboardMarketLabel(market: string): string {
  switch (market) {
    case "all": return "全部";
    case "a-share": return "A股";
    case "CN-SH":
    case "SH":
    case "SSE": return "沪市";
    case "CN-SZ":
    case "SZ":
    case "SZSE": return "深市";
    case "HK": return "港股";
    case "hk-connect": return "港股通";
    case "US": return "美股";
    case "unknown": return "未知市场";
    default: return market.trim() || "未知市场";
  }
}

export const marketFilterLabel = dashboardMarketLabel;

export function dashboardMarketFilterMatchesExecution(
  execution: TradeExecution,
  filter: DashboardMarketFilter | undefined,
): boolean {
  if (!filter || filter === "all") return true;
  const market = normalizedMarket(execution.instrument.market);
  switch (filter) {
    case "a-share": return isAShareMarket(market);
    case "CN-SH": return isShanghaiShareMarket(market);
    case "CN-SZ": return isShenzhenShareMarket(market);
    case "hk-connect": return isHongKongConnectExecution(execution);
    case "HK": return market === "HK" && !isHongKongConnectExecution(execution);
    default: return market === normalizedMarket(filter);
  }
}

export const marketFilterMatchesExecution = dashboardMarketFilterMatchesExecution;

function entryExecutions(entry: TradeLibraryEntry): TradeExecution[] {
  const unique = new Map<string, TradeExecution>();
  for (const execution of [
    ...entry.executions,
    ...entry.episodes.flatMap(({ episode }) => episode.executions),
  ]) unique.set(execution.id, execution);
  return [...unique.values()];
}

export function marketFilterMatchesEntry(
  entry: TradeLibraryEntry,
  filter: DashboardMarketFilter | undefined,
): boolean {
  if (!filter || filter === "all") return true;
  const executions = entryExecutions(entry);
  if (executions.length > 0) {
    return executions.some(execution => dashboardMarketFilterMatchesExecution(execution, filter));
  }
  if (filter === "hk-connect") return false;
  const market = entry.instrument.market;
  if (filter === "HK") return normalizedMarket(market) === "HK";
  if (filter === "a-share") return isAShareMarket(market);
  if (filter === "CN-SH") return isShanghaiShareMarket(market);
  if (filter === "CN-SZ") return isShenzhenShareMarket(market);
  return normalizedMarket(market) === normalizedMarket(filter);
}

export function marketFilterMatchesRow(
  row: DashboardRow,
  filter: DashboardMarketFilter | undefined,
): boolean {
  if (!filter || filter === "all") return true;
  const executions = row.item.episode.executions.length > 0
    ? row.item.episode.executions
    : entryExecutions(row.entry);
  if (executions.length > 0) {
    return executions.some(execution => dashboardMarketFilterMatchesExecution(execution, filter));
  }
  return marketFilterMatchesEntry(row.entry, filter);
}

function availableMarketFilters(entries: TradeLibraryEntry[]): Set<string> {
  const executions = entries.flatMap(entryExecutions);
  const instruments = entries.map(entry => entry.instrument);
  const values = new Set<string>();
  if (instruments.some(isAShareMarket)) values.add("a-share");
  if (instruments.some(isShanghaiShareMarket)) values.add("CN-SH");
  if (instruments.some(isShenzhenShareMarket)) values.add("CN-SZ");
  if (executions.some(isHongKongConnectExecution)) values.add("hk-connect");
  if (instruments.some(instrument => normalizedMarket(instrument.market) === "HK") &&
      executions.some(execution => normalizedMarket(execution.instrument.market) === "HK" && !isHongKongConnectExecution(execution))) {
    values.add("HK");
  }
  for (const instrument of instruments) {
    const market = normalizedMarket(instrument.market);
    if (!isAShareMarket(market) && market !== "HK") values.add(market || "unknown");
  }
  return values;
}

export function dashboardMarketFilterOptions(entries: TradeLibraryEntry[]): DashboardMarketOption[] {
  const available = availableMarketFilters(entries);
  const options: DashboardMarketOption[] = [{ value: "all", label: "全部" }];
  const ordered = ["a-share", "CN-SH", "CN-SZ", "hk-connect", "HK"];
  for (const value of ordered) {
    if (available.has(value)) options.push({ value, label: dashboardMarketLabel(value) });
  }
  for (const value of [...available].sort((a, b) => a.localeCompare(b))) {
    if (!ordered.includes(value)) options.push({ value, label: dashboardMarketLabel(value) });
  }
  return options;
}

export const marketFilterOptions = dashboardMarketFilterOptions;

function tradeNatureForRow(row: DashboardRow): TradeNature {
  if (row.entry.tradeNature) return row.entry.tradeNature;
  if (row.item.episode.tradeNature) return row.item.episode.tradeNature;
  const execution = row.item.episode.executions[0] ?? row.entry.executions[0];
  return execution ? displayTradeNature(execution) : "unknown";
}

function simulationRunForRow(row: DashboardRow): string | null {
  return row.item.episode.simulationRunId ?? row.entry.simulationRunId ?? null;
}

function statusForRow(row: DashboardRow): "pending" | "completed" | "deferred" {
  if (row.item.review?.review.completed) return "completed";
  if (row.item.review?.review.deferredReason?.trim()) return "deferred";
  return "pending";
}

function rowDate(row: DashboardRow): string {
  const endedAt = row.item.episode.endedAt;
  if (endedAt) {
    const executions = [...row.item.episode.executions]
      .sort((left, right) => left.executedAt.localeCompare(right.executedAt));
    const dateOnlyEndedAt = /^\d{4}-\d{2}-\d{2}$/.test(endedAt);
    const closingExecution = dateOnlyEndedAt
      ? executions.at(-1)
      : executions.filter(execution => Date.parse(execution.executedAt) <= Date.parse(endedAt)).at(-1);
    const sourceTradingDate = closingExecution?.source.tradingDate?.trim();
    if (sourceTradingDate && /^\d{4}-\d{2}-\d{2}$/.test(sourceTradingDate)) return sourceTradingDate;
    // Date-only evidence can carry the exchange calendar date while the
    // normalized episode timestamp is only a synthetic midnight anchor.
    if (closingExecution?.source.timePrecision === "date-only") {
      const sourceDate = closingExecution.source.marketCalendarDate?.trim();
      if (sourceDate && /^\d{4}-\d{2}-\d{2}$/.test(sourceDate)) return sourceDate;
    }
    if (dateOnlyEndedAt) return endedAt;
  }
  const timestamp = endedAt ?? row.item.episode.startedAt;
  return marketTradingDate(timestamp, row.item.episode.instrument.market);
}

function matchesText(row: DashboardRow, query: string | undefined): boolean {
  const normalized = query?.trim().toLocaleLowerCase();
  if (!normalized) return true;
  return instrumentPresentation(row.entry.instrument).searchText.toLocaleLowerCase().includes(normalized);
}

function matchesDateRange(row: DashboardRow, filter: DashboardFilter): boolean {
  const date = rowDate(row);
  const startDate = filter.startDate ?? null;
  const endDate = filter.endDate ?? null;
  if (startDate && date < startDate) return false;
  if (endDate && date > endDate) return false;
  if (filter.year && filter.year !== "all" && !date.startsWith(filter.year)) return false;
  return true;
}

function selectedValues(filter: DashboardFilter): string[] | undefined {
  if (filter.accounts !== undefined) return filter.accounts;
  if (filter.account && filter.account !== "all") return [filter.account];
  return undefined;
}

function matchesRowFilter(row: DashboardRow, filter: DashboardFilter): boolean {
  if (!marketFilterMatchesRow(row, filter.market)) return false;
  if (!matchesText(row, filter.query)) return false;
  const accounts = selectedValues(filter);
  if (accounts?.length && !accounts.includes(row.item.episode.accountId)) return false;
  if (filter.currency && filter.currency !== "all" && normalizedCurrency(row.item.episode.instrument.currency) !== normalizedCurrency(filter.currency)) return false;
  const nature = tradeNatureForRow(row);
  if (filter.nature && filter.nature !== "all" && nature !== filter.nature) return false;
  const run = simulationRunForRow(row);
  if (filter.simulationRunId && filter.simulationRunId !== "all" && run !== filter.simulationRunId) return false;
  const status = statusForRow(row);
  if (filter.status && filter.status !== "all" && filter.status !== status && filter.status !== row.item.episode.status) return false;
  return matchesDateRange(row, filter);
}

export function filterDashboardRows(
  entries: TradeLibraryEntry[],
  filter: DashboardFilter = DEFAULT_DASHBOARD_FILTER,
): DashboardRow[] {
  return entries.flatMap(entry => entry.episodes.map(item => ({ entry, item })))
    .filter(row => matchesRowFilter(row, filter));
}

export const buildDashboardRows = filterDashboardRows;

function scopeParts(row: DashboardRow) {
  return {
    market: dashboardMarketGroup(row.item.episode.instrument),
    nature: tradeNatureForRow(row),
    simulationRunId: simulationRunForRow(row),
    currency: normalizedCurrency(row.item.episode.instrument.currency) || row.item.episode.instrument.currency,
  };
}

export function dashboardScopeKey(row: DashboardRow): string {
  const scope = scopeParts(row);
  return [scope.market, scope.nature, scope.simulationRunId ?? "", scope.currency]
    .map(encodeURIComponent)
    .join(":");
}

function natureLabel(nature: TradeNature): string {
  return nature === "live" ? "实盘" : nature === "simulation" ? "模拟盘" : "来源未知";
}

function makeScope(rows: DashboardRow[]): DashboardScope {
  const first = rows[0];
  const parts = scopeParts(first);
  const actualMarkets = [...new Set(rows.map(row => normalizedMarket(row.item.episode.instrument.market)))].sort();
  const marketLabel = parts.market === "a-share" && actualMarkets.length > 1
    ? "A股"
    : dashboardMarketLabel(actualMarkets[0] ?? parts.market);
  const run = parts.simulationRunId
    ? ` · ${parts.nature === "simulation" ? `${dashboardInstrumentLabel(first.entry.instrument)} · ` : ""}运行 #${dashboardStableShortId(parts.simulationRunId)}`
    : "";
  return {
    id: dashboardScopeKey(first),
    label: `${marketLabel} · ${natureLabel(parts.nature)}${run} · ${parts.currency}`,
    market: parts.market,
    actualMarkets,
    tradeNature: parts.nature,
    simulationRunId: parts.simulationRunId,
    currency: parts.currency,
  };
}

function decimal(value: string | null | undefined): Decimal | null {
  if (value === null || value === undefined) return null;
  try {
    const parsed = new Decimal(value);
    return parsed.isFinite() ? parsed : null;
  } catch {
    return null;
  }
}

function exclusionReason(row: DashboardRow): DashboardExclusionReason {
  const episode = row.item.episode;
  if (episode.status !== "closed") return "open";
  const executions = episode.executions;
  if (executions.some(execution => {
    const settlementCurrency = normalizedCurrency(execution.source.settlement?.currency);
    return settlementCurrency !== "" && settlementCurrency !== normalizedCurrency(execution.instrument.currency);
  })) return "currency-conversion";
  if (executions.some(execution => execution.source.feeStatus === "unknown")) return "unknown-fees";
  if (executions.some(execution => (execution.source.historyIncomplete?.length ?? 0) > 0)) return "history-incomplete";
  if (episode.accuracy?.reasons.length) return "accuracy";
  if (row.item.metrics.pnlAvailable === false) return "pnl-unavailable";
  return "missing-pnl";
}

function trustedPnl(row: DashboardRow): Decimal | null {
  if (row.item.episode.status !== "closed" || row.item.metrics.pnlAvailable === false) return null;
  return decimal(row.item.metrics.netPnl);
}

function blankStats(overrides: Partial<DashboardStats> = {}): DashboardStats {
  return {
    sampleCount: 0,
    reviewedCount: 0,
    pendingCount: 0,
    openCount: 0,
    closedCount: 0,
    trustedClosedCount: 0,
    excludedCount: 0,
    unavailableCount: 0,
    wins: 0,
    losses: 0,
    breakEven: 0,
    netPnl: null,
    fees: null,
    grossProfit: "0",
    grossLoss: "0",
    averageWin: null,
    averageLoss: null,
    payoff: null,
    payoffReason: null,
    profitFactor: null,
    profitFactorReason: null,
    winRate: null,
    exclusionReasons: {},
    currency: null,
    groupReason: null,
    ...overrides,
  };
}

export function aggregateDashboardRows(rows: DashboardRow[]): DashboardStats {
  const stats = blankStats({ sampleCount: rows.length });
  const positive: Decimal[] = [];
  const negative: Decimal[] = [];
  let net = new Decimal(0);
  let fees = new Decimal(0);
  for (const row of rows) {
    if (row.item.review?.review.completed) stats.reviewedCount += 1;
    else stats.pendingCount += 1;
    if (row.item.episode.status === "open") stats.openCount += 1;
    else stats.closedCount += 1;
    const value = trustedPnl(row);
    if (value === null) {
      stats.excludedCount += 1;
      stats.unavailableCount += 1;
      const reason = exclusionReason(row);
      stats.exclusionReasons[reason] = (stats.exclusionReasons[reason] ?? 0) + 1;
      continue;
    }
    stats.trustedClosedCount += 1;
    net = net.plus(value);
    const fee = decimal(row.item.metrics.fees);
    if (fee !== null) fees = fees.plus(fee);
    if (value.gt(0)) {
      stats.wins += 1;
      positive.push(value);
    } else if (value.lt(0)) {
      stats.losses += 1;
      negative.push(value.abs());
    } else {
      stats.breakEven += 1;
    }
  }
  if (stats.trustedClosedCount > 0) {
    stats.netPnl = net.toString();
    stats.fees = fees.toString();
    stats.grossProfit = positive.reduce((sum, value) => sum.plus(value), new Decimal(0)).toString();
    stats.grossLoss = negative.reduce((sum, value) => sum.plus(value), new Decimal(0)).toString();
    stats.averageWin = positive.length
      ? positive.reduce((sum, value) => sum.plus(value), new Decimal(0)).div(positive.length).toString()
      : null;
    stats.averageLoss = negative.length
      ? negative.reduce((sum, value) => sum.plus(value), new Decimal(0)).div(negative.length).toString()
      : null;
    stats.payoff = stats.averageWin !== null && stats.averageLoss !== null && !new Decimal(stats.averageLoss).isZero()
      ? new Decimal(stats.averageWin).div(stats.averageLoss).toString()
      : null;
    stats.profitFactor = stats.grossProfit !== null && stats.grossLoss !== null && stats.grossProfit !== "0" && stats.grossLoss !== "0"
      ? new Decimal(stats.grossProfit).div(stats.grossLoss).toString()
      : null;
  }
  const denominator = stats.wins + stats.losses + stats.breakEven;
  stats.winRate = denominator > 0 ? { wins: stats.wins, denominator } : null;
  if (stats.payoff === null) {
    stats.payoffReason = stats.wins === 0
      ? "无盈利样本，无法计算盈亏比"
      : stats.losses === 0
        ? "无亏损样本，无法计算盈亏比"
        : "可计算样本不足，无法计算盈亏比";
  }
  if (stats.profitFactor === null) {
    stats.profitFactorReason = stats.wins === 0
      ? "无盈利样本，无法计算利润因子"
      : stats.losses === 0
        ? "无亏损样本，无法计算利润因子"
        : "可计算样本不足，无法计算利润因子";
  }
  return stats;
}

export const buildDashboardStats = aggregateDashboardRows;

function aggregateMultiGroupStats(rows: DashboardRow[], groups: DashboardGroup[]): DashboardStats {
  const stats = aggregateDashboardRows(rows);
  if (groups.length <= 1) {
    const scope = groups[0]?.scope;
    return { ...stats, currency: scope?.currency ?? null, groupReason: null };
  }
  return {
    ...stats,
    netPnl: null,
    fees: null,
    grossProfit: null,
    grossLoss: null,
    averageWin: null,
    averageLoss: null,
    payoff: null,
    payoffReason: MULTI_GROUP_REASON,
    profitFactor: null,
    profitFactorReason: MULTI_GROUP_REASON,
    winRate: null,
    currency: null,
    groupReason: MULTI_GROUP_REASON,
  };
}

function groupDashboardRows(rows: DashboardRow[]): DashboardGroup[] {
  const grouped = new Map<string, DashboardRow[]>();
  for (const row of rows) {
    const key = dashboardScopeKey(row);
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  }
  const groups = [...grouped.values()]
    .map(groupRows => {
      const scope = makeScope(groupRows);
      return { scope, rows: groupRows, stats: { ...aggregateDashboardRows(groupRows), currency: scope.currency, groupReason: null } };
    })
    .sort((a, b) => a.scope.label.localeCompare(b.scope.label, "zh-CN") || a.scope.id.localeCompare(b.scope.id));
  const labelCounts = new Map<string, number>();
  for (const group of groups) labelCounts.set(group.scope.label, (labelCounts.get(group.scope.label) ?? 0) + 1);
  const labelOrdinals = new Map<string, number>();
  return groups.map(group => {
    const count = labelCounts.get(group.scope.label) ?? 0;
    if (count < 2) return group;
    const ordinal = (labelOrdinals.get(group.scope.label) ?? 0) + 1;
    labelOrdinals.set(group.scope.label, ordinal);
    return { ...group, scope: { ...group.scope, label: `${group.scope.label} · ${ordinal}` } };
  });
}

function dateFromKey(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day || 1));
}

function dateKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function addDays(value: string, days: number): string {
  const date = dateFromKey(value);
  date.setUTCDate(date.getUTCDate() + days);
  return dateKey(date);
}

function periodForDate(date: string, period: DashboardCalendarPeriod) {
  if (period === "day") return { key: date, startDate: date, endDate: date };
  if (period === "month") {
    const startDate = `${date.slice(0, 7)}-01`;
    const nextMonth = dateFromKey(startDate);
    nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
    const endDate = addDays(dateKey(nextMonth), -1);
    return { key: date.slice(0, 7), startDate, endDate };
  }
  const dayOfWeek = dateFromKey(date).getUTCDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const startDate = addDays(date, mondayOffset);
  return { key: startDate, startDate, endDate: addDays(startDate, 6) };
}

function periodLabel(period: DashboardCalendarPeriod, startDate: string, endDate: string): string {
  if (period === "day") return startDate;
  if (period === "month") return `${startDate.slice(0, 4)}年${Number(startDate.slice(5, 7))}月`;
  return `${startDate} 至 ${endDate}`;
}

function cellState(value: Decimal | null, trustedCount: number, excludedCount: number, mixed: boolean): DashboardCalendarState {
  if (mixed) return "unavailable";
  if (trustedCount === 0) return excludedCount > 0 ? "unavailable" : "empty";
  if (!value || value.isZero()) return "break-even";
  return value.gt(0) ? "positive" : "negative";
}

/**
 * Build period cells from the same closed episode rows used by the stats.
 * Each episode is placed by its closing market date exactly once. A mixed
 * currency/nature/run/market input deliberately produces an unavailable cell
 * instead of adding incomparable amounts together; callers can select a
 * DashboardGroup and call this again for a comparable scope.
 */
export function buildDashboardCalendar(
  rows: DashboardRow[],
  period: DashboardCalendarPeriod = "month",
  scopeId?: string,
): DashboardCalendarCell[] {
  const selected = (scopeId ? rows.filter(row => dashboardScopeKey(row) === scopeId) : rows)
    .filter(row => row.item.episode.status === "closed");
  const groups = new Set(selected.map(dashboardScopeKey));
  const mixed = groups.size > 1;
  const cells = new Map<string, {
    startDate: string;
    endDate: string;
    value: Decimal;
    trusted: number;
    excluded: number;
    episodeIds: string[];
    excludedEpisodeIds: string[];
    reasons: Set<string>;
  }>();
  for (const row of selected) {
    const date = rowDate(row);
    const bucket = periodForDate(date, period);
    const current = cells.get(bucket.key) ?? {
      startDate: bucket.startDate,
      endDate: bucket.endDate,
      value: new Decimal(0),
      trusted: 0,
      excluded: 0,
      episodeIds: [],
      excludedEpisodeIds: [],
      reasons: new Set<string>(),
    };
    const value = trustedPnl(row);
    if (value === null) {
      current.excluded += 1;
      current.excludedEpisodeIds.push(row.item.episode.id);
      current.reasons.add(exclusionReason(row));
    } else {
      current.trusted += 1;
      current.value = current.value.plus(value);
      current.episodeIds.push(row.item.episode.id);
    }
    cells.set(bucket.key, current);
  }
  return [...cells.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([key, cell]) => {
    const value = mixed ? null : cell.trusted > 0 ? cell.value.toString() : null;
    const state = cellState(mixed ? null : cell.value, cell.trusted, cell.excluded, mixed);
    const unavailableReason = mixed
      ? MULTI_GROUP_REASON
      : cell.trusted === 0 && cell.excluded > 0
        ? [...cell.reasons].map(reason => exclusionReasonLabel(reason)).join("、")
        : null;
    return {
      period,
      key,
      label: periodLabel(period, cell.startDate, cell.endDate),
      startDate: cell.startDate,
      endDate: cell.endDate,
      netPnl: value,
      trustedClosedCount: cell.trusted,
      excludedCount: cell.excluded,
      state,
      unavailableReason,
      episodeIds: mixed ? [] : cell.episodeIds,
      excludedEpisodeIds: mixed ? [...cell.episodeIds, ...cell.excludedEpisodeIds] : cell.excludedEpisodeIds,
    };
  });
}

export const buildDashboardCalendarCells = buildDashboardCalendar;

export function exclusionReasonLabel(reason: string): string {
  switch (reason) {
    case "open": return "持仓中，尚未平仓";
    case "unknown-fees": return "费用未知";
    case "currency-conversion": return "跨币种，缺少换算依据";
    case "history-incomplete": return "历史成交不完整";
    case "accuracy": return "方向或来源顺序待核对";
    case "pnl-unavailable": return "盈亏不可用";
    case "missing-pnl": return "缺少净盈亏";
    default: return reason;
  }
}

export function buildDashboardModel(
  entries: TradeLibraryEntry[],
  filter: DashboardFilter = DEFAULT_DASHBOARD_FILTER,
  period: DashboardCalendarPeriod = "month",
): DashboardModel {
  const rows = filterDashboardRows(entries, filter);
  const groups = groupDashboardRows(rows);
  const stats = aggregateMultiGroupStats(rows, groups);
  const selectedGroupId = groups.length === 1 ? groups[0].scope.id : groups[0]?.scope.id ?? null;
  return {
    filter,
    rows,
    groups,
    stats,
    selectedGroupId,
    calendar: buildDashboardCalendar(rows, period, selectedGroupId ?? undefined),
  };
}

/** A small helper used by UI drilldown to keep one episode in one cell. */
export function dashboardEpisodeDate(row: DashboardRow): string {
  return rowDate(row);
}

export function dashboardEpisodeNature(row: DashboardRow): TradeNature {
  return tradeNatureForRow(row);
}

export function dashboardEpisodeSimulationRunId(row: DashboardRow): string | null {
  return simulationRunForRow(row);
}

export function dashboardRowIsTrustedClosed(row: DashboardRow): boolean {
  return trustedPnl(row) !== null;
}

export function dashboardRowExclusionReason(row: DashboardRow): DashboardExclusionReason | null {
  return trustedPnl(row) === null ? exclusionReason(row) : null;
}

export type HongKongChannel = "hk-connect" | "hk" | "mixed" | "unknown";

export function dashboardHongKongChannel(row: DashboardRow): HongKongChannel | null {
  const executions = row.item.episode.executions.length > 0
    ? row.item.episode.executions
    : entryExecutions(row.entry);
  if (!executions.some(execution => normalizedMarket(execution.instrument.market) === "HK")) return null;
  const hkExecutions = executions.filter(execution => normalizedMarket(execution.instrument.market) === "HK");
  const connects = hkExecutions.some(isHongKongConnectExecution);
  const ordinary = hkExecutions.some(execution => !isHongKongConnectExecution(execution));
  if (connects && ordinary) return "mixed";
  if (connects) return "hk-connect";
  if (ordinary) return "hk";
  return "unknown";
}

export function dashboardRowMarketSourceLabel(row: DashboardRow): string | null {
  const channel = dashboardHongKongChannel(row);
  if (channel === "hk-connect") return "港股通来源";
  if (channel === "hk") return "普通港股来源";
  if (channel === "mixed") return "港股通 + 普通港股（混合来源）";
  return null;
}
