import Decimal from "decimal.js";

import {
  dashboardEpisodeDate,
  dashboardRowExclusionReason,
  dashboardRowIsTrustedClosed,
  exclusionReasonLabel,
  type DashboardRow,
} from "./dashboard";
import {
  buildRoomMoneyView,
  classifyTradingRoomAsset,
  filterRoomRows,
  roomTodayKey,
  type RoomDateRange,
  type RoomFxSnapshot,
  type RoomMoneyAmount,
  type RoomMoneyView,
  type RoomScope,
  type TradingRoomInstrumentMetadata,
  type TradingRoomMetadataInput,
} from "./trading-room-scope";
import type { TradeLibraryEntry } from "../trades/library";

export type TradingRoomCalendarLevel = "month" | "year" | "all-years";
export type TradingRoomTrendLevel = "month" | "week" | "day";

export type TradingRoomCalendarState = "positive" | "negative" | "break-even" | "empty" | "unavailable" | "future";

export type TradingRoomCalendarCell = {
  key: string;
  label: string;
  startDate: string;
  endDate: string;
  money: RoomMoneyView;
  value: string | null;
  state: TradingRoomCalendarState;
  trustedClosedCount: number;
  wins: number;
  losses: number;
  breakEven: number;
  winRatePercent: string | null;
  excludedCount: number;
  unavailableReason: string | null;
  episodeIds: string[];
  excludedEpisodeIds: string[];
};

export type TradingRoomTrendPoint = {
  key: string;
  label: string;
  startDate: string;
  endDate: string;
  periodMoney: RoomMoneyView;
  periodValue: string | null;
  money: RoomMoneyView;
  value: string | null;
  rawByCurrency: Readonly<Record<string, string>>;
  trustedClosedCount: number;
  wins: number;
  losses: number;
  breakEven: number;
  availability: "available" | "empty" | "insufficient" | "not-combinable";
};

export type TradingRoomTrendModel = {
  points: TradingRoomTrendPoint[];
  currencies: string[];
  endMoney: RoomMoneyView;
};

export type TradingRoomCalendarSummary = {
  money: RoomMoneyView;
  trustedClosedCount: number;
  excludedCount: number;
  unknownAssetCount: number;
  unknownAssetEpisodeCount: number;
  wins: number;
  losses: number;
  breakEven: number;
  exclusionReasons: Readonly<Record<string, number>>;
};

export type TradingRoomCalendarOptions = {
  scope: RoomScope;
  level?: TradingRoomCalendarLevel;
  trendLevel?: TradingRoomTrendLevel;
  /** Date used for year/all-years drilldown; date-only or an ISO instant. */
  anchorDate?: string;
  /** Injected in tests and by the view so future dates use one local day. */
  asOf?: string;
  instrumentMetadata?: TradingRoomMetadataInput;
  fxSnapshot?: RoomFxSnapshot;
};

export type TradingRoomCalendarModel = {
  scope: RoomScope;
  level: TradingRoomCalendarLevel;
  asOf: string;
  range: RoomDateRange;
  rows: DashboardRow[];
  summary: TradingRoomCalendarSummary;
  cells: TradingRoomCalendarCell[];
  trend: TradingRoomTrendModel;
  detailFor: (key: string) => DashboardRow[];
};

type Bucket = {
  key: string;
  label: string;
  startDate: string;
  endDate: string;
};

type RowValue = {
  row: DashboardRow;
  date: string;
  value: string | null;
  currency: string;
  exclusionReason: string | null;
  unknownAsset: boolean;
};

function dateOnly(value: string | undefined): string | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? roomTodayKey(parsed) : null;
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

function endOfMonth(startDate: string): string {
  const next = dateFromKey(startDate);
  next.setUTCMonth(next.getUTCMonth() + 1);
  next.setUTCDate(0);
  return dateKey(next);
}

function endOfYear(year: string): string {
  return `${year}-12-31`;
}

function validDateRange(startDate: string, endDate: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(startDate) && /^\d{4}-\d{2}-\d{2}$/.test(endDate) && startDate <= endDate;
}

function periodLabel(level: TradingRoomCalendarLevel, startDate: string, endDate: string): string {
  if (level === "all-years") return startDate.slice(0, 4);
  if (level === "year") return `${startDate.slice(0, 4)}年${Number(startDate.slice(5, 7))}月`;
  if (startDate === endDate) return startDate;
  const naturalStart = `${startDate.slice(0, 7)}-01`;
  const naturalEnd = endOfMonth(naturalStart);
  const monthLabel = `${startDate.slice(0, 4)}年${Number(startDate.slice(5, 7))}月`;
  if (startDate === naturalStart && endDate === naturalEnd) return monthLabel;
  return `${monthLabel}（覆盖${startDate.slice(5)}至${endDate.slice(5)}）`;
}

function monthBuckets(startDate: string, endDate: string, level: TradingRoomCalendarLevel): Bucket[] {
  const buckets: Bucket[] = [];
  let cursor = `${startDate.slice(0, 7)}-01`;
  while (cursor <= endDate) {
    const end = endOfMonth(cursor);
    const start = cursor < startDate ? startDate : cursor;
    const finish = end > endDate ? endDate : end;
    buckets.push({
      key: cursor.slice(0, 7),
      label: periodLabel(level, start, finish),
      startDate: start,
      endDate: finish,
    });
    cursor = addDays(end, 1).slice(0, 7) + "-01";
  }
  return buckets;
}

function dayBuckets(startDate: string, endDate: string): Bucket[] {
  const buckets: Bucket[] = [];
  for (let cursor = startDate; cursor <= endDate; cursor = addDays(cursor, 1)) {
    buckets.push({ key: cursor, label: cursor, startDate: cursor, endDate: cursor });
  }
  return buckets;
}

function startOfWeek(value: string): string {
  const date = dateFromKey(value);
  const day = date.getUTCDay();
  date.setUTCDate(date.getUTCDate() - ((day + 6) % 7));
  return dateKey(date);
}

function weekBuckets(startDate: string, endDate: string): Bucket[] {
  const buckets: Bucket[] = [];
  let cursor = startOfWeek(startDate);
  while (cursor <= endDate) {
    const naturalEnd = addDays(cursor, 6);
    const start = cursor < startDate ? startDate : cursor;
    const finish = naturalEnd > endDate ? endDate : naturalEnd;
    buckets.push({
      key: cursor,
      label: `${start.slice(5)}至${finish.slice(5)}`,
      startDate: start,
      endDate: finish,
    });
    cursor = addDays(cursor, 7);
  }
  return buckets;
}

function yearBuckets(year: string): Bucket[] {
  return Array.from({ length: 12 }, (_, index) => {
    const month = `${year}-${String(index + 1).padStart(2, "0")}`;
    const startDate = `${month}-01`;
    return { key: month, label: `${year}年${index + 1}月`, startDate, endDate: endOfMonth(startDate) };
  });
}

function allYearBuckets(rows: readonly DashboardRow[]): Bucket[] {
  const years = [...new Set(rows.map(row => dashboardEpisodeDate(row).slice(0, 4)))].filter(value => /^\d{4}$/.test(value)).sort();
  return years.map(year => ({ key: year, label: year, startDate: `${year}-01-01`, endDate: endOfYear(year) }));
}

function allRows(entries: readonly TradeLibraryEntry[]): DashboardRow[] {
  return entries.flatMap(entry => entry.episodes.map(item => ({ entry, item })));
}

function historyRange(rows: readonly DashboardRow[], fallback: RoomDateRange): RoomDateRange {
  const dates = rows.map(row => dashboardEpisodeDate(row)).filter(value => validDateRange(value, value)).sort();
  if (dates.length === 0) return fallback;
  return { preset: "custom", startDate: dates[0], endDate: dates.at(-1)! };
}

export function findTradingRoomHistoryRange(
  entries: readonly TradeLibraryEntry[],
  scope: RoomScope,
  options: Pick<TradingRoomCalendarOptions, "asOf" | "instrumentMetadata"> = {},
): RoomDateRange {
  const asOfDate = dateOnly(options.asOf) ?? roomTodayKey(new Date());
  const rows = filterRoomRows(
    entries,
    {
      ...scope,
      period: { preset: "custom", startDate: "0000-01-01", endDate: asOfDate },
    },
    { instrumentMetadata: options.instrumentMetadata },
  ).filter(row => row.item.episode.status === "closed");
  return historyRange(rows, scope.period);
}

function filterPerformanceRows(
  entries: readonly TradeLibraryEntry[],
  scope: RoomScope,
  metadata: TradingRoomMetadataInput,
): DashboardRow[] {
  const rows = allRows(entries);
  return filterRoomRows(rows, scope, { instrumentMetadata: metadata })
    .filter(row => row.item.episode.status === "closed");
}

function metadataFor(input: TradingRoomMetadataInput, instrumentId: string) {
  if (!input) return undefined;
  const map = input as ReadonlyMap<string, TradingRoomInstrumentMetadata | undefined>;
  if (typeof map.get === "function") return map.get(instrumentId);
  return (input as Readonly<Record<string, TradingRoomInstrumentMetadata | undefined>>)[instrumentId];
}

function rowValue(row: DashboardRow, metadata: TradingRoomMetadataInput): RowValue {
  const projection = classifyTradingRoomAsset(row.item.episode.instrument, metadataFor(metadata, row.item.episode.instrument.id));
  const date = dashboardEpisodeDate(row);
  const trusted = projection.category !== "unknown" && dashboardRowIsTrustedClosed(row);
  const rawCurrency = row.item.episode.instrument.currency.trim().toUpperCase();
  const currency = rawCurrency === "人民币" || rawCurrency === "RMB"
    ? "CNY"
    : rawCurrency === "港币" || rawCurrency === "HK$"
      ? "HKD"
      : rawCurrency === "美元" || rawCurrency === "US$"
        ? "USD"
        : rawCurrency || "USD";
  return {
    row,
    date,
    value: trusted ? row.item.metrics.netPnl : null,
    currency,
    exclusionReason: projection.category === "unknown"
      ? "未知资产类型"
      : dashboardRowExclusionReason(row),
    unknownAsset: projection.category === "unknown",
  };
}

function amountsFor(values: readonly RowValue[]): RoomMoneyAmount[] {
  return values
    .filter(value => value.value !== null)
    .map(value => ({ currency: value.currency, amount: value.value }));
}

function addRawTotals(target: Map<string, Decimal>, values: readonly RowValue[]): void {
  for (const value of values) {
    if (value.value === null) continue;
    try {
      const parsed = new Decimal(value.value);
      if (!parsed.isFinite()) continue;
      target.set(value.currency, (target.get(value.currency) ?? new Decimal(0)).plus(parsed));
    } catch {
      // Invalid PnL is already represented as unavailable by the source row.
    }
  }
}

function moneyFromTotals(totals: ReadonlyMap<string, Decimal>, fxSnapshot?: RoomFxSnapshot): RoomMoneyView {
  return buildRoomMoneyView(
    [...totals.entries()].map(([currency, amount]) => ({ currency, amount: amount.toString() })),
    fxSnapshot,
  );
}

function valueForMoney(money: RoomMoneyView): string | null {
  if (money.convertedCny !== null) return money.convertedCny;
  const values = Object.values(money.originalByCurrency);
  return values.length === 1 ? values[0] : null;
}

function stateFor(
  money: RoomMoneyView,
  trustedClosedCount: number,
  excludedCount: number,
  future: boolean,
): TradingRoomCalendarState {
  if (future) return "future";
  if (trustedClosedCount === 0) return excludedCount > 0 ? "unavailable" : "empty";
  const value = valueForMoney(money);
  if (value === null) return "unavailable";
  try {
    const decimal = new Decimal(value);
    if (decimal.isZero()) return "break-even";
    return decimal.gt(0) ? "positive" : "negative";
  } catch {
    return "unavailable";
  }
}

function buildSummary(values: readonly RowValue[], fxSnapshot?: RoomFxSnapshot): TradingRoomCalendarSummary {
  const trusted = values.filter(value => value.value !== null);
  const excluded = values.filter(value => value.value === null && !value.unknownAsset);
  const unknownAssets = values.filter(value => value.unknownAsset);
  const exclusionReasons: Record<string, number> = {};
  for (const value of excluded) {
    const reason = value.exclusionReason ?? "missing-pnl";
    exclusionReasons[reason] = (exclusionReasons[reason] ?? 0) + 1;
  }
  let wins = 0;
  let losses = 0;
  let breakEven = 0;
  for (const value of trusted) {
    const number = new Decimal(value.value!);
    if (number.gt(0)) wins += 1;
    else if (number.lt(0)) losses += 1;
    else breakEven += 1;
  }
  return {
    money: buildRoomMoneyView(amountsFor(values), fxSnapshot),
    trustedClosedCount: trusted.length,
    excludedCount: excluded.length,
    unknownAssetCount: new Set(unknownAssets.map(value => value.row.item.episode.instrument.id)).size,
    unknownAssetEpisodeCount: unknownAssets.length,
    wins,
    losses,
    breakEven,
    exclusionReasons,
  };
}

function bucketForDate(date: string, buckets: readonly Bucket[]): Bucket | undefined {
  return buckets.find(bucket => date >= bucket.startDate && date <= bucket.endDate);
}

function selectedBuckets(
  level: TradingRoomCalendarLevel,
  scope: RoomScope,
  rows: readonly DashboardRow[],
  anchorDate: string,
  asOfDate: string,
): Bucket[] {
  if (level === "all-years") return allYearBuckets(rows);
  if (level === "year") return yearBuckets(anchorDate.slice(0, 4));
  if (scope.period.preset === "last-3-months") return monthBuckets(scope.period.startDate, scope.period.endDate, level);
  if (scope.period.startDate.slice(0, 7) !== scope.period.endDate.slice(0, 7)) {
    return monthBuckets(scope.period.startDate, scope.period.endDate, level);
  }
  const isCurrentMonthThroughToday = scope.period.startDate.endsWith("-01")
    && scope.period.endDate === asOfDate
    && scope.period.endDate.slice(0, 7) === asOfDate.slice(0, 7);
  if (isCurrentMonthThroughToday) return dayBuckets(scope.period.startDate, endOfMonth(scope.period.startDate));
  return dayBuckets(scope.period.startDate, scope.period.endDate);
}

function formatRawTotals(totals: ReadonlyMap<string, Decimal>): Readonly<Record<string, string>> {
  return Object.fromEntries([...totals.entries()].map(([currency, amount]) => [currency, amount.toString()]));
}

function trendBuckets(scope: RoomScope, level: TradingRoomTrendLevel, asOfDate: string): Bucket[] {
  if (level === "day") {
    const endDate = scope.period.endDate > asOfDate ? asOfDate : scope.period.endDate;
    return dayBuckets(scope.period.startDate, endDate);
  }
  if (level === "week") return weekBuckets(scope.period.startDate, scope.period.endDate > asOfDate ? asOfDate : scope.period.endDate);
  return monthBuckets(scope.period.startDate, scope.period.endDate > asOfDate ? asOfDate : scope.period.endDate, "month");
}

function trendAvailability(
  periodMoney: RoomMoneyView,
  trustedClosedCount: number,
  excludedCount: number,
): TradingRoomTrendPoint["availability"] {
  if (trustedClosedCount === 0) return excludedCount > 0 ? "insufficient" : "empty";
  if (periodMoney.convertedCny === null && Object.keys(periodMoney.originalByCurrency).length > 1) return "not-combinable";
  return "available";
}

export function buildTradingRoomCalendar(
  entries: readonly TradeLibraryEntry[],
  options: TradingRoomCalendarOptions,
): TradingRoomCalendarModel {
  const level = options.level ?? "month";
  const asOfDate = dateOnly(options.asOf) ?? roomTodayKey(new Date());
  const trendLevel = options.trendLevel ?? (options.scope.period.preset === "month" ? "day" : "month");
  const metadata = options.instrumentMetadata;
  const selectedRows = filterPerformanceRows(entries, options.scope, metadata);
  // Keep the row-to-value conversion explicit so metadata remains a read-only projection.
  const rowValues = selectedRows.map(row => rowValue(row, metadata));
  const effectiveValues = rowValues.filter(value => value.date <= asOfDate);
  const effectiveRows = effectiveValues.map(value => value.row);
  const anchorDate = dateOnly(options.anchorDate) ?? options.scope.period.endDate;
  const buckets = selectedBuckets(level, options.scope, effectiveRows, anchorDate, asOfDate);
  const cells = buckets.map(bucket => {
    const bucketValues = effectiveValues.filter(value => bucketForDate(value.date, [bucket]) !== undefined);
    const trusted = bucketValues.filter(value => value.value !== null);
    const excluded = bucketValues.filter(value => value.value === null);
    let wins = 0;
    let losses = 0;
    let breakEven = 0;
    for (const value of trusted) {
      const decimal = new Decimal(value.value!);
      if (decimal.gt(0)) wins += 1;
      else if (decimal.lt(0)) losses += 1;
      else breakEven += 1;
    }
    const money = buildRoomMoneyView(amountsFor(bucketValues), options.fxSnapshot);
    const future = bucket.startDate > asOfDate;
    const reasons = [...new Set(excluded.map(value => value.exclusionReason).filter((value): value is string => Boolean(value)))];
    return {
      key: bucket.key,
      label: bucket.label,
      startDate: bucket.startDate,
      endDate: bucket.endDate,
      money: future ? buildRoomMoneyView([], options.fxSnapshot) : money,
      value: future ? null : valueForMoney(money),
      state: stateFor(money, trusted.length, excluded.length, future),
      trustedClosedCount: trusted.length,
      wins,
      losses,
      breakEven,
      winRatePercent: trusted.length > 0
        ? new Decimal(wins).dividedBy(trusted.length).times(100).toString()
        : null,
      excludedCount: excluded.length,
      unavailableReason: excluded.length > 0 && trusted.length === 0
        ? reasons.map(reason => exclusionReasonLabel(reason)).join("、") || "结果不可用"
        : null,
      episodeIds: future ? [] : trusted.map(value => value.row.item.episode.id),
      excludedEpisodeIds: future ? [] : excluded.map(value => value.row.item.episode.id),
    } satisfies TradingRoomCalendarCell;
  });

  const trendRange = trendBuckets(options.scope, trendLevel, asOfDate);
  const trendRows = effectiveValues;
  const cumulative = new Map<string, Decimal>(
    [...new Set(trendRows.filter(value => value.value !== null).map(value => value.currency))]
      .map(currency => [currency, new Decimal(0)]),
  );
  const trendPoints = trendRange.map(bucket => {
    const bucketValues = trendRows.filter(value => bucketForDate(value.date, [bucket]) !== undefined);
    const trusted = bucketValues.filter(value => value.value !== null);
    const excluded = bucketValues.filter(value => value.value === null);
    const periodMoney = buildRoomMoneyView(amountsFor(bucketValues), options.fxSnapshot);
    addRawTotals(cumulative, bucketValues);
    const money = moneyFromTotals(cumulative, options.fxSnapshot);
    let wins = 0;
    let losses = 0;
    let breakEven = 0;
    for (const value of trusted) {
      const decimal = new Decimal(value.value!);
      if (decimal.gt(0)) wins += 1;
      else if (decimal.lt(0)) losses += 1;
      else breakEven += 1;
    }
    return {
      key: bucket.key,
      label: bucket.label,
      startDate: bucket.startDate,
      endDate: bucket.endDate,
      periodMoney,
      periodValue: valueForMoney(periodMoney),
      money,
      value: valueForMoney(money),
      rawByCurrency: formatRawTotals(cumulative),
      trustedClosedCount: trusted.length,
      wins,
      losses,
      breakEven,
      availability: trendAvailability(periodMoney, trusted.length, excluded.length),
    } satisfies TradingRoomTrendPoint;
  });
  const summary = buildSummary(effectiveValues, options.fxSnapshot);
  const currencies = [...new Set(effectiveValues.filter(value => value.value !== null).map(value => value.currency))].sort();
  return {
    scope: options.scope,
    level,
    asOf: asOfDate,
    // The calendar may extend the current month with future cells, but the
    // performance range remains the user's actual scope (for example 09-01
    // through 09-19), so the trend header never implies future data is in the
    // aggregate.
    range: options.scope.period,
    rows: effectiveRows,
    summary,
    cells,
    trend: {
      points: trendPoints,
      currencies,
      endMoney: summary.money,
    },
    detailFor: key => {
      const bucket = buckets.find(value => value.key === key);
      if (!bucket) return [];
      return effectiveValues
        .filter(value => value.date >= bucket.startDate && value.date <= bucket.endDate)
        .map(value => value.row);
    },
  };
}
