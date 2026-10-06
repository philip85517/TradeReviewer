"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";

import type { TradeLibraryEntry } from "../../lib/trades/library";
import type {
  RoomFxSnapshot,
  RoomDisplayCurrency,
  RoomMoneyView,
  RoomScope,
  RoomTargetCurrency,
  TradingRoomMetadataInput,
} from "../../lib/reviews/trading-room-scope";
import { roomMoneyValue } from "../../lib/reviews/trading-room-scope";
import {
  buildTradingRoomCalendar,
  findTradingRoomHistoryRange,
  type TradingRoomCalendarCell,
  type TradingRoomCalendarLevel,
  type TradingRoomTrendLevel,
  type TradingRoomTrendPoint,
} from "../../lib/reviews/trading-room-calendar";
import {
  applyTradingRoomCalendarPeriod,
  calendarMonthBounds,
  createTradingRoomCalendarState,
  moveTradingRoomCalendarMonth,
  selectTradingRoomCalendarDate,
  type TradingRoomCalendarState,
} from "../../lib/reviews/trading-room-time";
import { buildMonthlyWinRate } from "../../lib/reviews/trading-room-metrics";
import { buildRoomMoneyView, buildTradingRoomModel, classifyTradingRoomAsset, normalizeRoomMetadata } from "../../lib/reviews/trading-room-scope";
import { dashboardEpisodeDate, dashboardRowExclusionReason, exclusionReasonLabel } from "../../lib/reviews/dashboard";
import {
  chartAxisLabels,
  chartAxisTicks,
  chartLinePath,
  chartPointCoordinates,
  chartZeroY,
  createChartGeometry,
  valueDomain,
} from "./room-performance-chart";
import { useObservedChartSize } from "./use-observed-chart-size";
import { nearestTrendHit, type TrendHitCandidate } from "./room-performance-hit-testing";
import styles from "./room-performance.module.css";

export type RoomPerformanceProps = {
  entries: readonly TradeLibraryEntry[];
  scope: RoomScope;
  embedded?: boolean;
  /** B2 keeps the performance, contribution and calendar visible together. */
  layout?: "tabs" | "workspace";
  contributionSlot?: ReactNode;
  onScopeChange: (patch: Partial<RoomScope>) => void;
  instrumentMetadata?: TradingRoomMetadataInput;
  fxSnapshot?: RoomFxSnapshot;
  asOf?: string;
  onOpenInReview: (instrumentId: string, episodeId: string, queueIds?: string[]) => void;
  renderMoney?: (money: RoomMoneyView) => ReactNode;
  /** The report target selected by the shell; original keeps every raw currency visible. */
  reportCurrency?: RoomDisplayCurrency;
  /** Optional shell-owned calendar browse snapshot for cross-page restoration. */
  calendarBrowseState?: RoomPerformanceCalendarBrowseState;
  onCalendarBrowseStateChange?: (state: RoomPerformanceCalendarBrowseState) => void;
};

export type RoomPerformanceCalendarBrowseState = {
  displayMonth: string;
  selectedDate: string | null;
};

function currencyCode(value: string | null | undefined): string {
  const currency = value?.trim().toUpperCase() ?? "";
  if (currency === "人民币" || currency === "RMB") return "CNY";
  if (currency === "港币" || currency === "HK$") return "HKD";
  if (currency === "美元" || currency === "US$") return "USD";
  return currency || "USD";
}

function money(value: string, currency: string): string {
  try {
    return new Intl.NumberFormat("zh-CN", {
      style: "currency",
      currency: currencyCode(currency),
      maximumFractionDigits: 2,
      signDisplay: "always",
    }).format(Number(value));
  } catch {
    return `${Number(value).toFixed(2)} ${currency}`;
  }
}

function targetFor(display: RoomDisplayCurrency): RoomTargetCurrency | undefined {
  return display === "original" ? undefined : display;
}

function displayValue(view: RoomMoneyView, display: RoomDisplayCurrency): string | null {
  if (display === "original") {
    const values = Object.values(view.originalByCurrency);
    return values.length === 1 ? values[0] : null;
  }
  if (view.targetCurrency === display) return roomMoneyValue(view);
  // Legacy CNY views are still accepted while the shell migrates its adapter.
  if (display === "CNY" && view.targetCurrency === undefined && view.converted === undefined) return view.convertedCny;
  return null;
}

function moneyLabel(view: RoomMoneyView, display: RoomDisplayCurrency = "original"): string {
  const target = displayValue(view, display);
  if (display !== "original" && target !== null) return money(target, display);
  const values = Object.entries(view.originalByCurrency);
  if (values.length === 0) return "不可用";
  const original = values.map(([currency, value]) => money(value, currency)).join(" · ");
  return display === "original" ? original : `${original} · ${display}不可用（${view.note}）`;
}

function moneyDetail(view: RoomMoneyView, display: RoomDisplayCurrency = "original"): string {
  const values = Object.entries(view.originalByCurrency);
  if (values.length === 0) return view.note.includes("金额缺失") ? view.note : "暂无已平仓样本";
  const original = values.length > 0
    ? `原币小计：${values.map(([currency, value]) => money(value, currency)).join(" · ")}`
    : "暂无已平仓样本";
  if (display !== "original" && displayValue(view, display) !== null) return `${moneyLabel(view, display)}；${view.note}`;
  return display === "original" ? original : `${original}；${display}不可用（${view.note}）`;
}

function cellLabel(cell: TradingRoomCalendarCell, display: RoomDisplayCurrency = "original"): string {
  if (cell.state === "future") return "尚未发生";
  if (cell.value !== null) return moneyLabel(cell.money, display);
  if (cell.state === "unavailable") return "不可用";
  return "无样本";
}

function pointValue(point: TradingRoomTrendPoint, currency?: string, display: RoomDisplayCurrency = "original"): string | null {
  const view = point.money;
  if (!currency && display !== "original") return displayValue(view, display);
  if (point.value !== null && !currency && display === "original") return point.value;
  if (!currency) return null;
  return point.rawByCurrency[currency] ?? null;
}

function paddedValueDomain(values: readonly (string | null)[]) {
  const domain = valueDomain(values);
  const span = domain.max - domain.min;
  const padding = span === 0 ? 1 : span * 0.1;
  return { min: domain.min - padding, max: domain.max + padding };
}

function visibleAxisTicks(ticks: Array<{ value: number; y: number }>, minGap = 20): Array<{ value: number; y: number }> {
  const ordered = [...ticks].sort((a, b) => a.y - b.y);
  const visible: Array<{ value: number; y: number }> = [];
  for (const tick of ordered) {
    if (tick.value === 0) {
      visible.push(tick);
      continue;
    }
    if (visible.every(other => Math.abs(other.y - tick.y) >= minGap)) visible.push(tick);
  }
  return visible.sort((a, b) => a.y - b.y);
}

function dateFromKey(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day || 1));
}

function dateKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function monthEnd(value: string): string {
  const date = dateFromKey(`${value.slice(0, 7)}-01`);
  date.setUTCMonth(date.getUTCMonth() + 1);
  date.setUTCDate(0);
  return dateKey(date);
}

function monthDates(month: string): string[] {
  const dates: string[] = [];
  for (let cursor = `${month}-01`; cursor <= monthEnd(`${month}-01`);) {
    dates.push(cursor);
    const next = dateFromKey(cursor);
    next.setUTCDate(next.getUTCDate() + 1);
    cursor = dateKey(next);
  }
  return dates;
}

function intersectPeriod(
  period: RoomScope["period"],
  startDate: string,
  endDate: string,
): RoomScope["period"] | null {
  const start = period.startDate > startDate ? period.startDate : startDate;
  const end = period.endDate < endDate ? period.endDate : endDate;
  return start <= end ? { preset: "custom", startDate: start, endDate: end } : null;
}

function calendarPeriod(
  level: TradingRoomCalendarLevel,
  period: RoomScope["period"],
  displayMonth: string,
  allYearsRange: RoomScope["period"],
): RoomScope["period"] {
  if (level === "all-years") return allYearsRange;
  if (level === "year") {
    return intersectPeriod(period, `${displayMonth.slice(0, 4)}-01-01`, `${displayMonth.slice(0, 4)}-12-31`) ?? period;
  }
  return intersectPeriod(period, `${displayMonth}-01`, monthEnd(`${displayMonth}-01`)) ?? period;
}

function lineColor(index: number): string {
  return ["#b76be7", "#00d5b6", "#f1a35b", "#78a8ff"][index % 4];
}

function defaultTrendLevel(scope: RoomScope): TradingRoomTrendLevel {
  if (scope.period.preset === "last-3-months" || scope.period.preset === "ytd") return "month";
  return scope.period.startDate.slice(0, 7) === scope.period.endDate.slice(0, 7) ? "day" : "month";
}

function roomPeriodSignature(period: RoomScope["period"]): string {
  return `${period.preset}:${period.startDate}:${period.endDate}`;
}

function roomFilterSignature(scope: RoomScope): string {
  return JSON.stringify([
    scope.nature,
    scope.assetCategory,
    scope.assetType ?? "all",
    scope.simulationRunId,
    scope.query ?? "",
    [...scope.accountIds],
    [...scope.instrumentIds],
    [...scope.markets],
    [...scope.currencies],
    [...scope.reviewStatuses],
  ]);
}

function trendLevelLabel(level: TradingRoomTrendLevel): string {
  if (level === "day") return "自然日";
  if (level === "week") return "自然周";
  return "自然月";
}

function trendPointMoney(point: TradingRoomTrendPoint, cumulative: boolean, currency?: string, display: RoomDisplayCurrency = "original"): string {
  const view = cumulative ? point.money : point.periodMoney;
  if (currency) {
    const value = view.originalByCurrency[currency];
    return value === undefined ? (cumulative ? "该币种无累计" : "该币种无成交") : money(value, currency);
  }
  const target = displayValue(view, display);
  if (display !== "original") return target === null ? `${display}不可用` : money(target, display);
  const values = Object.entries(view.originalByCurrency);
  if (values.length === 0) return point.availability === "empty" ? "暂无样本" : "数据不足";
  if (values.length > 1) return "无法合计";
  return values.map(([currency, value]) => money(value, currency)).join(" · ");
}

function trendPointLabel(point: TradingRoomTrendPoint, currency?: string, display: RoomDisplayCurrency = "original"): string {
  return `${point.label}，本期盈亏 ${trendPointMoney(point, false, currency, display)}，累计盈亏 ${trendPointMoney(point, true, currency, display)}`;
}

function trendNumericValue(point: TradingRoomTrendPoint, cumulative: boolean, currency?: string, display: RoomDisplayCurrency = "original"): number | null {
  const view = cumulative ? point.money : point.periodMoney;
  const raw = currency
    ? view.originalByCurrency[currency]
    : display !== "original"
      ? displayValue(view, display)
      : Object.keys(view.originalByCurrency).length === 1
        ? Object.values(view.originalByCurrency)[0]
        : undefined;
  if (raw === undefined) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function amountTone(value: number | null): "positive" | "negative" | "zero" | "unavailable" {
  if (value === null) return "unavailable";
  if (value > 0) return "positive";
  if (value < 0) return "negative";
  return "zero";
}

type TrendLabelPlacement = {
  index: number;
  x: number;
  y: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
  textAnchor: "start" | "middle" | "end";
};

function trendLabelWidth(value: string): number {
  return Math.max(40, value.length * 8 + 12);
}

function visibleTrendLabelPlacements(
  points: readonly { x: number; y: number; value: string }[],
  values: readonly string[],
  occupied: readonly TrendLabelPlacement[],
  width: number,
  plotTop = 14,
  plotBottom = 278,
  plotLeft = 72,
): TrendLabelPlacement[] {
  const numericPoints = points.map((point, index) => ({ index, value: Number(point.value) }))
    .filter(point => Number.isFinite(point.value));
  const priorityIndices = [
    points.length > 0 ? 0 : -1,
    points.length > 1 ? points.length - 1 : -1,
    numericPoints.filter(point => point.value > 0).sort((a, b) => b.value - a.value)[0]?.index ?? -1,
    numericPoints.filter(point => point.value < 0).sort((a, b) => a.value - b.value)[0]?.index ?? -1,
  ];
  const candidates = [...new Set([
    ...priorityIndices,
    ...points.map((_, index) => index),
  ].filter(index => index >= 0))].map(index => ({ index }));
  const result: TrendLabelPlacement[] = [];
  for (const candidate of candidates) {
    const point = points[candidate.index];
    const labelWidth = trendLabelWidth(values[candidate.index]);
    const textAnchor: TrendLabelPlacement["textAnchor"] = candidate.index === 0 ? "start" : candidate.index === points.length - 1 ? "end" : "middle";
    const edgeAwareX = textAnchor === "end" ? Math.min(point.x, width - 4) : textAnchor === "start" ? Math.max(point.x, 4) : point.x;
    const labelHeight = 18;
    const candidatesY = [point.y - 10, point.y + 18, point.y - 34, point.y + 42, point.y - 58, point.y + 66]
      .map(y => Math.max(plotTop + labelHeight, Math.min(plotBottom - 4, y)))
      .filter((y, index, values) => values.indexOf(y) === index);
    const candidateXs = [edgeAwareX, edgeAwareX + 8, edgeAwareX - 8]
      .map(x => Math.max(plotLeft, Math.min(width, x)));
    const placement = candidateXs.flatMap(x => candidatesY.map(y => {
      const left = textAnchor === "start" ? x : textAnchor === "end" ? x - labelWidth : x - labelWidth / 2;
      const right = textAnchor === "start" ? x + labelWidth : textAnchor === "end" ? x : x + labelWidth / 2;
      return {
        index: candidate.index,
        x,
        y,
        left,
        right,
        top: y - labelHeight,
        bottom: y + 4,
        textAnchor,
      };
    })).find(candidatePlacement => candidatePlacement.left >= plotLeft
      && candidatePlacement.right <= width
      && result.concat(occupied).every(other => (
      candidatePlacement.right + 6 <= other.left
      || candidatePlacement.left - 6 >= other.right
      || candidatePlacement.bottom + 4 <= other.top
      || candidatePlacement.top - 4 >= other.bottom
    )));
    if (placement) result.push(placement);
  }
  return result;
}

function renderableTrendValue(point: TradingRoomTrendPoint, currency?: string, display: RoomDisplayCurrency = "original"): string | null {
  if (point.availability === "insufficient") return null;
  return pointValue(point, currency, display);
}

function trendAxisLabel(point: TradingRoomTrendPoint, level: TradingRoomTrendLevel): string {
  if (point.startDate === point.endDate) return point.startDate.slice(5);
  if (level === "week") return `${point.startDate.slice(5)}~${point.endDate.slice(5)}`;
  if (point.startDate.slice(0, 7) === point.endDate.slice(0, 7)) return point.startDate.slice(0, 7);
  return `${point.startDate.slice(5)}~${point.endDate.slice(5)}`;
}

function percentLabel(value: string | null): string {
  if (value === null) return "不可用";
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return "不可用";
  return `${new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 }).format(numericValue)}%`;
}

function cellSecondaryLabel(cell: TradingRoomCalendarCell): string {
  if (cell.state === "future") return "尚未发生";
  if (cell.trustedClosedCount > 0) return `${cell.trustedClosedCount} 回合 · 胜率 ${percentLabel(cell.winRatePercent)}`;
  if (cell.excludedCount > 0) return `${cell.excludedCount} 待核对 · 胜率不可用`;
  return "暂无样本";
}

function compactNumeric(value: string): string {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "不可用";
  const sign = parsed > 0 ? "+" : parsed < 0 ? "−" : "";
  const absolute = Math.abs(parsed);
  if (absolute >= 1_000_000_000) return `${sign}${(absolute / 1_000_000_000).toFixed(1).replace(/\.0$/, "")}B`;
  if (absolute >= 1_000_000) return `${sign}${(absolute / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (absolute >= 1_000) return `${sign}${(absolute / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return `${sign}${Math.round(absolute)}`;
}

function compactMoneyValue(value: string, currency: string): string {
  // The calendar header carries the selected unit. Keeping the cell to the
  // signed short amount prevents a valid value from being ellipsized at the
  // seven-column desktop breakpoint.
  void currency;
  return compactNumeric(value);
}

function compactCellValue(cell: TradingRoomCalendarCell, display: RoomDisplayCurrency): string {
  if (cell.state === "future") return "—";
  if (cell.state === "empty") return "·";
  if (cell.value !== null) {
    if (display !== "original") {
      const target = displayValue(cell.money, display);
      if (target !== null) return compactMoneyValue(target, display);
    }
    const values = Object.entries(cell.money.originalByCurrency);
    if (values.length === 1) return compactMoneyValue(values[0][1], values[0][0]);
    if (values.length > 1) return "多币种";
  }
  if (cell.state === "unavailable") return "不可用";
  return "无样本";
}

function compactCellStateLabel(cell: TradingRoomCalendarCell): string {
  if (cell.state === "future") return "尚未发生";
  if (cell.state === "positive") return "盈";
  if (cell.state === "negative") return "亏";
  if (cell.state === "break-even") return "平";
  if (cell.state === "unavailable") return "金额不可用";
  return "无样本";
}

function compactCellSecondaryLabel(cell: TradingRoomCalendarCell): string {
  if (cell.state === "future") return "未发生";
  if (cell.trustedClosedCount > 0) return `${cell.trustedClosedCount}笔`;
  if (cell.excludedCount > 0) return `${cell.excludedCount}笔`;
  return "—";
}

export function RoomPerformance({
  entries,
  scope,
  embedded = false,
  layout = "tabs",
  contributionSlot,
  instrumentMetadata,
  fxSnapshot,
  asOf,
  onOpenInReview,
  renderMoney,
  reportCurrency: reportCurrencyProp,
  calendarBrowseState,
  onCalendarBrowseStateChange,
}: RoomPerformanceProps) {
  const [metric, setMetric] = useState<"pnl" | "win-rate">("pnl");
  const workspace = layout === "workspace";
  const [view, setView] = useState<"trend" | "calendar">("trend");
  const [level, setLevel] = useState<TradingRoomCalendarLevel>("month");
  const [trendLevelOverride, setTrendLevelOverride] = useState<TradingRoomTrendLevel | null>(null);
  const [selectedKeyState, setSelectedKey] = useState<string | null>(() => calendarBrowseState?.selectedDate ?? null);
  const [selectedTrendKey, setSelectedTrendKey] = useState<string | null>(null);
  const [hoverTrendKey, setHoverTrendKey] = useState<string | null>(null);
  const [selectedTrendCandidates, setSelectedTrendCandidates] = useState<string[]>([]);
  const [hoverTrendCandidates, setHoverTrendCandidates] = useState<string[]>([]);
  const [calendarState, setCalendarState] = useState<TradingRoomCalendarState>(() => createTradingRoomCalendarState(scope.period));
  const [calendarHistory, setCalendarHistory] = useState<Array<{ level: TradingRoomCalendarLevel; state: TradingRoomCalendarState; selectedKey: string | null }>>([]);
  const [chartStageRef, chartSize] = useObservedChartSize<HTMLDivElement>({ width: 640, height: 320 });
  const scopePeriodSignature = roomPeriodSignature(scope.period);
  const scopeFilterSignature = roomFilterSignature(scope);
  const previousScopePeriodSignatureRef = useRef(scopePeriodSignature);
  const trendLevel = trendLevelOverride ?? defaultTrendLevel(scope);
  const reportCurrency = reportCurrencyProp ?? "original";
  const previousScopeFilterSignatureRef = useRef(scopeFilterSignature);
  const previousReportCurrencyRef = useRef(reportCurrency);
  const targetCurrency = targetFor(reportCurrency);
  const activeCalendarState: TradingRoomCalendarState = calendarBrowseState
    ? { ...calendarState, displayMonth: calendarBrowseState.displayMonth, selectedDate: calendarBrowseState.selectedDate }
    : calendarState;
  const selectedKey = calendarBrowseState ? calendarBrowseState.selectedDate : selectedKeyState;
  const publishCalendarState = useCallback((next: TradingRoomCalendarState) => {
    setCalendarState(next);
    onCalendarBrowseStateChange?.({ displayMonth: next.displayMonth, selectedDate: next.selectedDate });
  }, [onCalendarBrowseStateChange]);
  const metadata = useMemo(() => normalizeRoomMetadata(instrumentMetadata), [instrumentMetadata]);
  const model = useMemo(() => buildTradingRoomCalendar(entries, {
    scope,
    level: "month",
    trendLevel,
    asOf,
    instrumentMetadata,
    fxSnapshot,
    targetCurrency,
  }), [asOf, entries, fxSnapshot, instrumentMetadata, scope, targetCurrency, trendLevel]);
  const calendarUnit = reportCurrency === "original"
    ? model.trend.currencies.length === 1 ? model.trend.currencies[0] : "原币"
    : reportCurrency;
  const monthlyWinRate = useMemo(() => buildMonthlyWinRate(
    buildTradingRoomModel(entries, { scope: { ...scope, period: model.range }, instrumentMetadata, fxSnapshot }).rows,
    model.range,
  ), [entries, scope, model.range, instrumentMetadata, fxSnapshot]);
  const allYearsRange = useMemo(() => findTradingRoomHistoryRange(entries, scope, {
    asOf,
    instrumentMetadata,
  }), [asOf, entries, instrumentMetadata, scope]);
  const browsedPeriod = useMemo(
    () => calendarPeriod(level, scope.period, activeCalendarState.displayMonth, allYearsRange),
    [activeCalendarState.displayMonth, allYearsRange, level, scope.period],
  );
  const calendarModel = useMemo(() => buildTradingRoomCalendar(entries, {
    scope: { ...scope, period: browsedPeriod },
    level,
    trendLevel,
    anchorDate: `${activeCalendarState.displayMonth}-01`,
    asOf,
    instrumentMetadata,
    fxSnapshot,
    targetCurrency,
  }), [asOf, browsedPeriod, activeCalendarState.displayMonth, entries, fxSnapshot, instrumentMetadata, level, scope, targetCurrency, trendLevel]);
  const queueIds = model.rows.map(row => row.item.episode.id);
  const displayMoney = (value: RoomMoneyView) => renderMoney ? renderMoney(value) : moneyLabel(value, reportCurrency);
  const validSelectedKey = selectedKey && calendarModel.cells.some(cell => cell.key === selectedKey && cell.state !== "future") ? selectedKey : null;
  const isDailyCalendar = level === "month" && calendarModel.cells.every(cell => cell.startDate === cell.endDate);
  const weekdayOffset = isDailyCalendar
    ? (dateFromKey(`${activeCalendarState.displayMonth}-01`).getUTCDay() + 6) % 7
    : 0;
  const calendarDisplayCells = isDailyCalendar
    ? monthDates(activeCalendarState.displayMonth).map(date => {
      const cell = calendarModel.cells.find(candidate => candidate.key === date);
      if (date < scope.period.startDate || date > scope.period.endDate) return { kind: "outside" as const, date, cell: null };
      return { kind: "cell" as const, date, cell: cell ?? null };
    })
    : calendarModel.cells.map(cell => ({ kind: "cell" as const, date: cell.startDate, cell }));
  const aggregateTrend = reportCurrency !== "original"
    ? displayValue(model.trend.endMoney, reportCurrency) !== null
    : model.trend.currencies.length <= 1;
  const trendValues = aggregateTrend || model.trend.currencies.length <= 1
    ? model.trend.points.map(point => renderableTrendValue(point, undefined, reportCurrency))
    : model.trend.currencies.flatMap(currency => model.trend.points.map(point => renderableTrendValue(point, currency, reportCurrency)));
  const trendDomain = paddedValueDomain(trendValues);
  const chartGeometry = createChartGeometry({
    width: chartSize.width,
    height: chartSize.height,
    padding: { top: 14, right: chartSize.width < 240 ? 10 : 16, bottom: 42, left: 72 },
  });
  const zeroY = chartZeroY(trendDomain, chartGeometry);
  const maxTrendAxisLabels = chartSize.width < 240 ? 2 : chartSize.width < 360 ? 3 : 4;
  const trendAxisLabels = chartAxisLabels(model.trend.points, chartGeometry, maxTrendAxisLabels)
    .map(point => ({ ...point, label: trendAxisLabel(model.trend.points[point.index], trendLevel) }));
  const trendAxisTicks = visibleAxisTicks(chartAxisTicks(trendDomain, chartGeometry));
  const chartSeries = aggregateTrend || model.trend.currencies.length <= 1
    ? [{ key: aggregateTrend ? reportCurrency === "original" ? model.trend.currencies[0] ?? "原币" : reportCurrency : model.trend.currencies[0] ?? "原币", points: model.trend.points.map(point => ({ value: renderableTrendValue(point, aggregateTrend ? undefined : model.trend.currencies[0], reportCurrency) })) }]
    : model.trend.currencies.map(currency => {
      let seenCurrency = false;
      return {
        key: currency,
        points: model.trend.points.map(point => {
          if (Object.prototype.hasOwnProperty.call(point.periodMoney.originalByCurrency, currency)) seenCurrency = true;
          return { value: seenCurrency ? renderableTrendValue(point, currency, reportCurrency) : null };
        }),
      };
    });
  const trendHitTargets: TrendHitCandidate[] = chartSeries.flatMap(series => chartPointCoordinates(series.points, chartGeometry, trendDomain).flatMap(point => {
    const trendPoint = model.trend.points[point.index];
    return trendPoint ? [{ x: point.x, y: point.y, key: `${series.key}:${trendPoint.key}` }] : [];
  }));
  const currentTrendKeys = new Set(trendHitTargets.map(candidate => candidate.key));
  const validSelectedTrendKey = selectedTrendKey && currentTrendKeys.has(selectedTrendKey) ? selectedTrendKey : null;
  const validHoverTrendKey = hoverTrendKey && currentTrendKeys.has(hoverTrendKey) ? hoverTrendKey : null;
  const details = validSelectedKey ? calendarModel.detailFor(validSelectedKey) : [];
  const displayedTrendKey = validSelectedTrendKey ?? validHoverTrendKey;
  const displayedTrendCandidates = (validSelectedTrendKey ? selectedTrendCandidates : hoverTrendCandidates).filter(candidate => currentTrendKeys.has(candidate));
  const selectedTrend = displayedTrendKey ? model.trend.points.find(point => point.key === displayedTrendKey.split(":").at(-1)) ?? null : null;
  const selectedTrendCurrency = displayedTrendKey?.split(":")[0];
  const selectedCell = validSelectedKey ? calendarModel.cells.find(cell => cell.key === selectedKey && cell.state !== "future") ?? null : null;
  const occupiedTrendLabels: TrendLabelPlacement[] = [];
  const chartLabelPlacements = chartSeries.map(series => {
    const points = chartPointCoordinates(series.points, chartGeometry, trendDomain);
    const currency = aggregateTrend ? undefined : series.key;
    const values = points.map(point => trendPointMoney(model.trend.points[point.index], true, currency, reportCurrency));
    const placements = visibleTrendLabelPlacements(
      points,
      values,
      occupiedTrendLabels,
      chartGeometry.width - chartGeometry.padding.right,
      chartGeometry.padding.top,
      chartGeometry.height - chartGeometry.padding.bottom,
      chartGeometry.padding.left,
    );
    occupiedTrendLabels.push(...placements);
    return placements;
  });

  useEffect(() => {
    if (previousScopeFilterSignatureRef.current !== scopeFilterSignature) {
      setLevel("month");
      setSelectedKey(null);
      setSelectedTrendKey(null);
      setHoverTrendKey(null);
      setSelectedTrendCandidates([]); setHoverTrendCandidates([]);
      setCalendarHistory([]);
      const next = applyTradingRoomCalendarPeriod(calendarState, scope.period);
      publishCalendarState(next);
      previousScopeFilterSignatureRef.current = scopeFilterSignature;
    }
    if (previousScopePeriodSignatureRef.current !== scopePeriodSignature) {
      setLevel("month");
      setSelectedKey(null);
      setSelectedTrendKey(null);
      setHoverTrendKey(null);
      setSelectedTrendCandidates([]); setHoverTrendCandidates([]);
      setCalendarHistory([]);
      const next = applyTradingRoomCalendarPeriod(calendarState, scope.period);
      publishCalendarState(next);
      previousScopePeriodSignatureRef.current = scopePeriodSignature;
    }
  }, [calendarState, publishCalendarState, scope.period, scopeFilterSignature, scopePeriodSignature]);

  useEffect(() => {
    if (previousReportCurrencyRef.current !== reportCurrency) {
      previousReportCurrencyRef.current = reportCurrency;
      setSelectedTrendKey(null);
      setHoverTrendKey(null);
      setSelectedTrendCandidates([]);
      setHoverTrendCandidates([]);
    }
  }, [reportCurrency]);

  const changeLevel = (next: TradingRoomCalendarLevel) => {
    setSelectedKey(null);
    setLevel(next);
  };

  const selectCell = (cell: TradingRoomCalendarCell) => {
    if (cell.state === "future") return;
    setSelectedKey(null);
    if (level === "all-years") {
      setCalendarHistory(history => [...history, { level, state: activeCalendarState, selectedKey }]);
      publishCalendarState({ ...activeCalendarState, displayMonth: `${cell.key}-01`, selectedDate: null });
      setLevel("year");
      return;
    }
    if (level === "year" || cell.key.length === 7) {
      setCalendarHistory(history => [...history, { level, state: activeCalendarState, selectedKey }]);
      publishCalendarState({ ...activeCalendarState, displayMonth: cell.key, selectedDate: null });
      setLevel("month");
      return;
    }
    setSelectedKey(cell.key);
    publishCalendarState(selectTradingRoomCalendarDate(activeCalendarState, cell.key));
  };

  const returnToPreviousRange = () => {
    const previous = calendarHistory.at(-1);
    if (!previous) return;
    setCalendarHistory(history => history.slice(0, -1));
    setSelectedKey(previous.selectedKey);
    setLevel(previous.level);
    publishCalendarState(previous.state);
  };

  const movePeriod = (delta: number) => {
    setSelectedKey(null);
    publishCalendarState(moveTradingRoomCalendarMonth(activeCalendarState, delta));
  };

  const moveYear = (delta: number) => {
    setSelectedKey(null);
    publishCalendarState(moveTradingRoomCalendarMonth(activeCalendarState, delta * 12));
  };
  const monthBounds = calendarMonthBounds(activeCalendarState);
  const nextDisabled = !monthBounds.nextAvailable;

  return (
    <section className={`${styles.panel} ${embedded ? styles.embeddedPanel : ""}`} aria-label="业绩趋势与日历">
      {!workspace && <header className={styles.heading}>
        <div>
          <h2>{view === "trend" ? "累计盈亏" : "已平仓净盈亏日历"}</h2>
          <p>{model.range.startDate} 至 {model.range.endDate} · {model.rows.filter(row => row.item.episode.status === "closed").length} 个完整回合 · {model.summary.trustedClosedCount} 个可信已平仓回合 · 排除 {model.summary.excludedCount} 个已平仓样本{model.summary.unknownAssetEpisodeCount ? ` · 未知资产 ${model.summary.unknownAssetEpisodeCount} 个另列` : ""}</p>
        </div>
        <div className={styles.viewTabs} role="group" aria-label="业绩视图">
          <button type="button" aria-pressed={view === "trend"} onClick={() => { setView("trend"); setSelectedKey(null); }}>趋势</button>
          <button type="button" aria-pressed={view === "calendar"} onClick={() => { setView("calendar"); setSelectedKey(null); }}>日历</button>
        </div>
        {view === "trend" && metric === "pnl" && <div className={styles.levelTabs} role="group" aria-label="趋势分桶">
          {(["day", "week", "month"] as const).map(value => <button type="button" key={value} aria-label={value === "day" ? "日" : value === "week" ? "周" : "月"} aria-pressed={trendLevel === value} onClick={() => { setTrendLevelOverride(value); setSelectedKey(null); setSelectedTrendKey(null); setHoverTrendKey(null); setSelectedTrendCandidates([]); setHoverTrendCandidates([]); }}>{value === "day" ? "日" : value === "week" ? "周" : "月"}<span className={styles.visuallyHidden}>{trendLevelLabel(value)}</span></button>)}
        </div>}
      </header>}

      {!embedded && <div className={styles.summaryLine} role="group" aria-label="区间收益摘要">
        <strong>{displayMoney(model.summary.money)}</strong>
        <span>{moneyDetail(model.summary.money)}</span>
      </div>}

      <div className={workspace ? styles.workspaceGrid : undefined}>
      {(workspace || view === "trend") && (
        <div className={styles.trendWrap}>
          {workspace && <div className={styles.cardHeading}>
            <h3>已完成交易表现</h3>
            {metric === "pnl" && <div className={styles.levelTabs} role="group" aria-label="趋势分桶">
              {["day", "week", "month"].map(value => <button type="button" key={value} aria-label={value === "day" ? "日" : value === "week" ? "周" : "月"} aria-pressed={trendLevel === value} onClick={() => { setTrendLevelOverride(value as TradingRoomTrendLevel); setSelectedKey(null); setSelectedTrendKey(null); setHoverTrendKey(null); setSelectedTrendCandidates([]); setHoverTrendCandidates([]); }}>{value === "day" ? "日" : value === "week" ? "周" : "月"}</button>)}
            </div>}
          </div>}
          <div className={styles.levelTabs} role="group" aria-label="历史表现指标">
            <button type="button" aria-pressed={metric === "pnl"} onClick={() => { setMetric("pnl"); setSelectedTrendKey(null); setHoverTrendKey(null); setSelectedTrendCandidates([]); setHoverTrendCandidates([]); }}>累计盈亏</button>
            <button type="button" aria-pressed={metric === "win-rate"} onClick={() => { setMetric("win-rate"); setSelectedTrendKey(null); setHoverTrendKey(null); setSelectedTrendCandidates([]); setHoverTrendCandidates([]); }}>自然月胜率</button>
          </div>
          {metric === "win-rate" ? <section className={styles.winRate} aria-label="自然月胜率表现">
            <p>盈利回合 ÷ 可信已平仓回合；持平计入分母，无样本月份留缺口。</p>
            <svg role="img" aria-label="自然月胜率趋势图" viewBox="0 0 640 240">
              {[0, 50, 100].map(value => <g key={value}><line x1="45" x2="625" y1={215 - value * 1.9} y2={215 - value * 1.9} className={styles.axisGridLine} /><text x="5" y={219 - value * 1.9}>{value}%</text></g>)}
              <path d={chartLinePath(monthlyWinRate.points.map(point => ({ value: point.ratePercent })), createChartGeometry({ width: 640, height: 240, padding: { left: 45, right: 15, top: 25, bottom: 25 } }), { min: 0, max: 100 })} fill="none" stroke="var(--dashboard-positive)" strokeWidth="2" />
              {chartPointCoordinates(monthlyWinRate.points.map(point => ({ value: point.ratePercent })), createChartGeometry({ width: 640, height: 240, padding: { left: 45, right: 15, top: 25, bottom: 25 } }), { min: 0, max: 100 }).map(point => <circle key={point.index} cx={point.x} cy={point.y} r="4" data-month={monthlyWinRate.points[point.index].month} fill="var(--dashboard-positive)"><title>{monthlyWinRate.points[point.index].month} · {percentLabel(monthlyWinRate.points[point.index].ratePercent)}</title></circle>)}
            </svg>
            <ul>{monthlyWinRate.points.map(point => <li key={point.month}><strong>{point.month} · {point.ratePercent === null ? "无样本" : percentLabel(point.ratePercent)} · {point.wins}/{point.denominator}</strong><small>{point.coverageLabel}</small></li>)}</ul>
          </section> : <>

          <div className={styles.chartFrame}>
              <div className={styles.chartAxisLayout}>
                <div className={styles.chartPlotArea}>
                  <div className={styles.chartStage} ref={chartStageRef}>
                    {model.trend.points.length === 0 || model.summary.trustedClosedCount === 0 ? <p className={styles.empty}>当前范围暂无可绘制的已平仓回合。</p> : <>
                    <svg role="img" aria-label="累计盈亏趋势图" width="100%" height={chartGeometry.height} viewBox={`0 0 ${chartGeometry.width} ${chartGeometry.height}`} preserveAspectRatio="none">
                    {trendAxisTicks.map(tick => <g key={tick.value}>
                      <line x1={chartGeometry.padding.left} x2={chartGeometry.width - chartGeometry.padding.right} y1={tick.y} y2={tick.y} className={styles.axisGridLine} />
                      <line x1={chartGeometry.padding.left - 4} x2={chartGeometry.padding.left} y1={tick.y} y2={tick.y} className={styles.axisTickMark} data-chart-role="axis-y-tick" data-value={tick.value} y={tick.y} />
                    </g>)}
                    <line x1={chartGeometry.padding.left} x2={chartGeometry.width - chartGeometry.padding.right} y1={zeroY} y2={zeroY} className={styles.zeroLine} data-chart-role="zero-line" />
                    {chartSeries.map((series, index) => {
                      const points = chartPointCoordinates(series.points, chartGeometry, trendDomain);
                      const seriesCurrency = aggregateTrend ? undefined : series.key;
                      return <g key={series.key}>
                        <path d={chartLinePath(series.points, chartGeometry, trendDomain)} fill="none" stroke={lineColor(index)} strokeWidth="3" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                        {points.map(point => {
                          const trendPoint = model.trend.points[point.index];
                          if (!trendPoint) return null;
                          const selectPoint = () => { setSelectedTrendKey(`${series.key}:${trendPoint.key}`); };
                          const previewPoint = () => {
                            if (validSelectedTrendKey) return;
                            setHoverTrendKey(`${series.key}:${trendPoint.key}`);
                            setHoverTrendCandidates([]);
                          };
                          const selectNearestPoint = (event: ReactMouseEvent<SVGCircleElement> | ReactPointerEvent<SVGCircleElement>) => {
                            if (validSelectedTrendKey) return;
                            const svg = event.currentTarget.ownerSVGElement;
                            const bounds = svg?.getBoundingClientRect();
                            if (!svg || !bounds || bounds.width <= 0 || bounds.height <= 0) {
                              previewPoint();
                              return;
                            }
                            const hit = nearestTrendHit(event, bounds, chartGeometry, trendHitTargets);
                            if (!hit.nearest) return;
                            setHoverTrendKey(hit.nearest.key);
                            const nextCandidates = hit.matches.length > 1 ? hit.matches.map(candidate => candidate.key) : [];
                            setHoverTrendCandidates(previous => previous.length === nextCandidates.length && previous.every((candidate, index) => candidate === nextCandidates[index]) ? previous : nextCandidates);
                          };
                          const pointLabel = `${series.key} · ${trendPointLabel(trendPoint, aggregateTrend ? undefined : series.key, reportCurrency)}`;
                          const pointEvents = {
                            onMouseEnter: selectNearestPoint,
                            onMouseMove: selectNearestPoint,
                            onPointerEnter: selectNearestPoint,
                            onPointerMove: selectNearestPoint,
                            onFocus: previewPoint,
                            onClick: (event: ReactMouseEvent<SVGCircleElement>) => {
                              if (event.detail === 0) {
                                selectPoint();
                                setHoverTrendKey(null);
                                setSelectedTrendCandidates([]); setHoverTrendCandidates([]);
                              } else {
                                const svg = event.currentTarget.ownerSVGElement;
                                const bounds = svg?.getBoundingClientRect();
                                if (!svg || !bounds || bounds.width <= 0 || bounds.height <= 0) {
                                  selectPoint();
                                  setHoverTrendKey(null);
                                  setSelectedTrendCandidates([]);
                                  setHoverTrendCandidates([]);
                                  return;
                                }
                                const hit = nearestTrendHit(event, bounds, chartGeometry, trendHitTargets);
                                if (hit.nearest) {
                                  setSelectedTrendKey(hit.nearest.key);
                                  setHoverTrendKey(null);
                                  setSelectedTrendCandidates(hit.matches.length > 1 ? hit.matches.map(candidate => candidate.key) : []);
                                } else {
                                  setHoverTrendKey(null);
                                  setHoverTrendCandidates([]);
                                }
                              }
                            },
                            onKeyDown: (event: KeyboardEvent<SVGCircleElement>) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                selectPoint();
                                setHoverTrendKey(null);
                                setSelectedTrendCandidates([]); setHoverTrendCandidates([]);
                              }
                            },
                          };
                          return <g key={`${series.key}-${point.index}`}>
                            <circle cx={point.x} cy={point.y} r="4" fill={lineColor(index)} data-chart-role="point-visible" pointerEvents="none"><title>{series.key} · {point.value}</title></circle>
                            {chartLabelPlacements[index].some(placement => placement.index === points.findIndex(value => value.index === point.index)) && (() => {
                              const placement = chartLabelPlacements[index].find(value => value.index === points.findIndex(item => item.index === point.index))!;
                              return <text x={placement.x} y={placement.y} textAnchor={placement.textAnchor} className={styles[`amount-${amountTone(trendNumericValue(trendPoint, true, seriesCurrency, reportCurrency))}`]} data-chart-role="point-label" data-tone={amountTone(trendNumericValue(trendPoint, true, seriesCurrency, reportCurrency))}>{trendPointMoney(trendPoint, true, seriesCurrency, reportCurrency)}</text>;
                            })()}
                            <circle cx={point.x} cy={point.y} r="22" fill="transparent" role="button" tabIndex={0} aria-label={pointLabel} data-chart-role="point-hit-area" className={styles.chartPointHitArea} {...pointEvents} />
                          </g>;
                        })}
                      </g>;
                    })}
                    </svg>
                    <div className={styles.axisYLabels} aria-label="趋势图纵轴刻度">
                      {trendAxisTicks.map(tick => <span key={tick.value} style={{ top: `${(tick.y / chartGeometry.height) * 100}%`, left: `${(chartGeometry.padding.left / chartGeometry.width) * 100}%` }} data-chart-role="axis-y-label" data-value={tick.value}>{model.trend.currencies.length > 1 && !aggregateTrend ? new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2, signDisplay: "always" }).format(tick.value) : money(String(tick.value), aggregateTrend && reportCurrency !== "original" ? reportCurrency : model.trend.currencies[0] ?? "CNY")}</span>)}
                    </div>
                    </>}
                    <div className={styles.axisXLabels} aria-label="趋势图横轴">
                      {trendAxisLabels.map(point => <span className={point.index === 0 ? styles.axisXLabelStart : point.index === model.trend.points.length - 1 ? styles.axisXLabelEnd : undefined} key={point.key} style={{ left: `${(point.x / chartGeometry.width) * 100}%` }} data-chart-role="axis-x-tick" data-key={point.key} data-x={point.x}>{point.label}</span>)}
                    </div>
                  </div>
                </div>
              </div>
              <div className={styles.trendFooter}>
                <div className={styles.trendValueLegend}><span><i style={{ backgroundColor: lineColor(0) }} />累计盈亏</span></div>
                {model.trend.currencies.length > 1 && !aggregateTrend && <>
                  <div className={styles.legend} aria-label="趋势币种图例">{model.trend.currencies.map((currency, index) => <span key={currency}><i style={{ backgroundColor: lineColor(index) }} />{currency}</span>)}</div>
                  <p className={styles.notice} title={reportCurrency === "original" ? "多币种暂不可合计：按原币分别显示（共用同一数值尺度）。" : `${reportCurrency}暂不可用，趋势保留原币分别显示（${model.trend.endMoney.note}）。`}>{reportCurrency === "original" ? "多币种暂不可合计：按原币分别显示（共用同一数值尺度）。" : `${reportCurrency}暂不可用，趋势保留原币分别显示（${model.trend.endMoney.note}）。`}</p>
                </>}
                {model.trend.currencies.length > 1 && aggregateTrend && reportCurrency !== "original" && <p className={styles.notice} title={`多币种已按同一汇率快照换算为${reportCurrency}合计。`}>多币种已按同一汇率快照换算为{reportCurrency}合计。</p>}
              </div>
              {selectedTrend && <div className={styles.selectedTrendPoint} role="status" aria-label="趋势点详情" aria-live="polite">
                <strong>{selectedTrend.label}</strong>
                <span className={styles.selectedTrendIdentity}>{selectedTrendCurrency ?? "原币"} · {selectedTrend.startDate === selectedTrend.endDate ? selectedTrend.startDate : `${selectedTrend.startDate} 至 ${selectedTrend.endDate}`}</span>
                <span className={styles[`amount-${amountTone(trendNumericValue(selectedTrend, false, aggregateTrend ? undefined : selectedTrendCurrency, reportCurrency))}`]}>本期盈亏 {trendPointMoney(selectedTrend, false, aggregateTrend ? undefined : selectedTrendCurrency, reportCurrency)}</span>
                <span className={styles[`amount-${amountTone(trendNumericValue(selectedTrend, true, aggregateTrend ? undefined : selectedTrendCurrency, reportCurrency))}`]}>累计盈亏 {trendPointMoney(selectedTrend, true, aggregateTrend ? undefined : selectedTrendCurrency, reportCurrency)}</span>
                <small>{selectedTrend.trustedClosedCount} 个可信回合 · {selectedTrend.wins} 胜 / {selectedTrend.losses} 负 / 持平 {selectedTrend.breakEven} · {selectedTrend.startDate} 至 {selectedTrend.endDate}{selectedTrend.availability !== "available" ? ` · ${selectedTrend.availability === "not-combinable" ? "多币种无法合计" : selectedTrend.availability === "insufficient" ? "数据不足" : "暂无样本"}` : ""}</small>
                {displayedTrendCandidates.length > 1 && <div className={styles.trendCandidates} role="listbox" aria-label="重合趋势点候选">
                  {displayedTrendCandidates.map(candidateKey => {
                    const [currency, pointKey] = candidateKey.split(":");
                    const point = model.trend.points.find(item => item.key === pointKey);
                    if (!point) return null;
                    return <button key={candidateKey} type="button" role="option" aria-selected={candidateKey === displayedTrendKey} onClick={() => { setSelectedTrendKey(candidateKey); setHoverTrendKey(null); setSelectedTrendCandidates([]); setHoverTrendCandidates([]); }}>{currency} · {point.startDate === point.endDate ? point.startDate : `${point.startDate} 至 ${point.endDate}`}</button>;
                  })}
                </div>}
              </div>}
              <details className={styles.trendDetails}>
                <summary>查看趋势数据</summary>
                <div className={styles.trendPointList} aria-label="趋势数据">
                  {model.trend.points.map(point => <div key={point.key} aria-label={trendPointLabel(point, undefined, reportCurrency)}>
                    <strong>{point.label}</strong>
                    <span data-chart-role="trend-period-value" data-tone={amountTone(trendNumericValue(point, false, undefined, reportCurrency))} className={styles[`amount-${amountTone(trendNumericValue(point, false, undefined, reportCurrency))}`]}>本期盈亏 {trendPointMoney(point, false, undefined, reportCurrency)}</span>
                    <span data-chart-role="trend-cumulative-value" data-tone={amountTone(trendNumericValue(point, true, undefined, reportCurrency))} className={styles[`amount-${amountTone(trendNumericValue(point, true, undefined, reportCurrency))}`]}>累计盈亏 {trendPointMoney(point, true, undefined, reportCurrency)}</span>
                    <small>{point.trustedClosedCount} 个可信回合 · {point.wins} 胜 / {point.losses} 负 · {point.startDate} 至 {point.endDate}</small>
                  </div>)}
                </div>
              </details>
            </div>
          </>}
        </div>
      )}
      {workspace && contributionSlot && <div className={styles.contributionSlot}>{contributionSlot}</div>}
      {(workspace || view === "calendar") && (
        <div className={styles.calendarWrap} role="region" aria-label="盈亏日历">
          {workspace ? <div className={styles.calendarHeader}>
            <h3>盈亏日历 <small className={styles.calendarUnit}>单位：{calendarUnit}</small></h3>
            <div className={styles.levelTabs} role="group" aria-label="日历层级">
              {(["month", "year", "all-years"] as const).map(value => <button type="button" key={value} aria-label={value === "month" ? "月" : undefined} aria-pressed={level === value} onClick={() => changeLevel(value)}>{value === "month" ? "月" : value === "year" ? "年" : "全部年份"}</button>)}
            </div>
            {level !== "all-years" && <div className={styles.calendarNav}>
              <button type="button" aria-label={level === "year" ? "上一年" : "上一个月"} onClick={() => level === "year" ? moveYear(-1) : movePeriod(-1)}>‹</button>
              <span>{level === "month" ? `${activeCalendarState.displayMonth.slice(0, 4)}年${Number(activeCalendarState.displayMonth.slice(5, 7))}月` : `${browsedPeriod.startDate} 至 ${browsedPeriod.endDate}`}</span>
              <button type="button" aria-label={level === "year" ? "下一年" : "下一个月"} disabled={nextDisabled} onClick={() => level === "year" ? moveYear(1) : movePeriod(1)}>›</button>
            </div>}
          </div> : <>
            <div className={styles.levelTabs} role="group" aria-label="日历层级">
              {(["month", "year", "all-years"] as const).map(value => <button type="button" key={value} aria-label={value === "month" ? "月" : undefined} aria-pressed={level === value} onClick={() => changeLevel(value)}>{value === "month" ? "月" : value === "year" ? "年" : "全部年份"}</button>)}
            </div>
            {level !== "all-years" && <div className={styles.calendarNav}>
            <button type="button" aria-label={level === "year" ? "上一年" : "上一个月"} onClick={() => level === "year" ? moveYear(-1) : movePeriod(-1)}>‹</button>
            <span>{level === "month" ? `${activeCalendarState.displayMonth.slice(0, 4)}年${Number(activeCalendarState.displayMonth.slice(5, 7))}月` : `${browsedPeriod.startDate} 至 ${browsedPeriod.endDate}`}</span>
            <button type="button" aria-label={level === "year" ? "下一年" : "下一个月"} disabled={nextDisabled} onClick={() => level === "year" ? moveYear(1) : movePeriod(1)}>›</button>
            </div>}
          </>}
          {calendarHistory.length > 0 && <div className={styles.breadcrumb}><span>范围路径：{calendarHistory.map(item => item.level === "all-years" ? "全部年份" : item.level === "year" ? "年份" : "月份").join(" / ")} / 当前</span><button type="button" onClick={returnToPreviousRange}>返回上一范围</button></div>}
          {level === "all-years" && <div className={styles.calendarSummary} aria-label="日历汇总"><strong>{displayMoney(calendarModel.summary.money)}</strong><span>{calendarModel.summary.trustedClosedCount} 个可信回合 · {calendarModel.summary.wins} 胜 / {calendarModel.summary.losses} 负 / 持平 {calendarModel.summary.breakEven}</span></div>}
          {isDailyCalendar && <div className={styles.weekdays} aria-hidden="true">{["一", "二", "三", "四", "五", "六", "日"].map(day => <span key={day}>周{day}</span>)}</div>}
          <div className={`${styles.calendarGrid} ${isDailyCalendar ? styles.dailyGrid : styles.periodGrid}`}>
            {isDailyCalendar && Array.from({ length: weekdayOffset }, (_, index) => <span key={`leading-${index}`} className={styles.leadingBlank} aria-hidden="true" />)}
            {calendarDisplayCells.map(item => item.kind === "outside"
              ? <span key={`outside-${item.date}`} className={styles.outsideCell} aria-label={`${item.date}，范围外`}><strong>{item.date.slice(8)}</strong><small>范围外</small></span>
              : item.cell === null
                ? <span key={`empty-${item.date}`} className={`${styles.cell} ${styles["state-empty"]}`} aria-label={`${item.date}，无样本`}><strong>{item.date.slice(8)}</strong><span aria-hidden="true">·</span><span className={styles.visuallyHidden}>无样本</span><small className={styles.visuallyHidden}>暂无样本</small></span>
              : <button type="button" key={item.cell!.key} className={`${styles.cell} ${styles[`state-${item.cell!.state}`]}`} aria-label={`${item.cell!.label}，${cellLabel(item.cell!, reportCurrency)}，${cellSecondaryLabel(item.cell!)}`} disabled={item.cell!.state === "future"} onClick={() => selectCell(item.cell!)}>
                <strong>{isDailyCalendar ? <><span className={styles.dayNumber}>{item.cell.startDate.slice(8)}</span><span className={styles.fullDate}>{item.cell.startDate}</span></> : item.cell.label}</strong>
                <span className={styles.cellValueLong}>{cellLabel(item.cell, reportCurrency)}</span>
                {isDailyCalendar && <><span className={styles.cellValueShort}>{compactCellValue(item.cell, reportCurrency)}</span><span className={styles.visuallyHidden}>{compactCellStateLabel(item.cell)}</span></>}
                <small className={styles.cellSecondaryLong}>{cellSecondaryLabel(item.cell)}</small>
                {isDailyCalendar && <small className={styles.cellSecondaryShort}>{compactCellSecondaryLabel(item.cell)}</small>}
              </button>)}
          </div>
          {validSelectedKey && <section className={styles.detail} aria-label="日历日期详情">
            <div className={styles.detailHeading}><strong>{selectedKey}</strong><span>{details.length} 个回合</span></div>
            {selectedCell && <div className={styles.detailSummary} aria-label="日历汇总详情">
              <div><span>期间金额</span><strong>{selectedCell.value !== null ? displayMoney(selectedCell.money) : cellLabel(selectedCell, reportCurrency)}</strong></div>
              <div><span>可信样本</span><strong>{selectedCell.trustedClosedCount}</strong></div>
              <div><span>胜率</span><strong>{percentLabel(selectedCell.winRatePercent)}</strong></div>
            </div>}
            {details.length === 0 ? <p className={styles.empty}>该日期没有已平仓回合。</p> : <div className={styles.detailRows}>{details.map(row => {
              const projection = classifyTradingRoomAsset(row.item.episode.instrument, metadata.get(row.item.episode.instrument.id));
              const excluded = projection.category === "unknown" ? "未知资产类型" : dashboardRowExclusionReason(row);
              return <div className={styles.detailRow} key={row.item.episode.id}>
                <div><strong>{row.item.episode.instrument.name}（{row.item.episode.instrument.symbol}）</strong><small>{dashboardEpisodeDate(row)} · {row.item.episode.accountLabel}</small></div>
                <div><strong>{excluded
                  ? `不可用 · ${exclusionReasonLabel(excluded)}`
                  : row.item.metrics.netPnl === null
                    ? "不可用"
                    : displayMoney(buildRoomMoneyView([{
                      currency: row.item.episode.instrument.currency,
                      amount: row.item.metrics.netPnl,
                    }], fxSnapshot, targetCurrency))}</strong><button type="button" onClick={() => onOpenInReview(row.item.episode.instrument.id, row.item.episode.id, queueIds)}>打开复盘</button></div>
              </div>;
            })}</div>}
          </section>}
        </div>
      )}
      </div>
    </section>
  );
}
