"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import type { TradeLibraryEntry } from "../../lib/trades/library";
import type {
  RoomFxSnapshot,
  RoomMoneyView,
  RoomScope,
  TradingRoomMetadataInput,
} from "../../lib/reviews/trading-room-scope";
import {
  buildTradingRoomCalendar,
  findTradingRoomHistoryRange,
  type TradingRoomCalendarCell,
  type TradingRoomCalendarLevel,
  type TradingRoomTrendLevel,
  type TradingRoomTrendPoint,
} from "../../lib/reviews/trading-room-calendar";
import { classifyTradingRoomAsset, normalizeRoomMetadata } from "../../lib/reviews/trading-room-scope";
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
import styles from "./room-performance.module.css";

export type RoomPerformanceProps = {
  entries: readonly TradeLibraryEntry[];
  scope: RoomScope;
  embedded?: boolean;
  onScopeChange: (patch: Partial<RoomScope>) => void;
  instrumentMetadata?: TradingRoomMetadataInput;
  fxSnapshot?: RoomFxSnapshot;
  asOf?: string;
  onOpenInReview: (instrumentId: string, episodeId: string, queueIds?: string[]) => void;
  renderMoney?: (money: RoomMoneyView) => ReactNode;
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

function moneyLabel(view: RoomMoneyView): string {
  if (view.convertedCny !== null) return money(view.convertedCny, "CNY");
  const values = Object.entries(view.originalByCurrency);
  if (values.length === 0) return "不可用";
  return values.map(([currency, value]) => money(value, currency)).join(" · ");
}

function moneyDetail(view: RoomMoneyView): string {
  const values = Object.entries(view.originalByCurrency);
  if (values.length === 0) return view.note.includes("金额缺失") ? view.note : "暂无已平仓样本";
  const original = values.length > 0
    ? `原币小计：${values.map(([currency, value]) => money(value, currency)).join(" · ")}`
    : "暂无已平仓样本";
  if (view.convertedCny !== null && values.length === 1 && values[0][0] === "CNY") return view.note;
  return `${original}；${view.note}`;
}

function cellLabel(cell: TradingRoomCalendarCell): string {
  if (cell.state === "future") return "尚未发生";
  if (cell.value !== null) return moneyLabel(cell.money);
  if (cell.state === "unavailable") return "不可用";
  return "无样本";
}

function pointValue(point: { value: string | null; rawByCurrency: Readonly<Record<string, string>> }, currency?: string): string | null {
  if (point.value !== null && !currency) return point.value;
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

function setPeriodForMonth(key: string, asOf: string): RoomScope["period"] {
  const startDate = `${key.slice(0, 7)}-01`;
  const naturalEnd = monthEnd(startDate);
  const endDate = naturalEnd > asOf ? asOf : naturalEnd;
  return { preset: "custom", startDate, endDate };
}

function setPeriodForYear(key: string, asOf: string): RoomScope["period"] {
  const startDate = `${key.slice(0, 4)}-01-01`;
  const endDate = key.slice(0, 4) === asOf.slice(0, 4) ? asOf : `${key.slice(0, 4)}-12-31`;
  return { preset: key.slice(0, 4) === asOf.slice(0, 4) ? "ytd" : "custom", startDate, endDate };
}

function rowMoney(row: { item: { metrics: { netPnl: string | null }; episode: { instrument: { currency: string } } } }): string {
  if (row.item.metrics.netPnl === null) return "不可用";
  return money(row.item.metrics.netPnl, row.item.episode.instrument.currency);
}

function lineColor(index: number): string {
  return ["#4e9bab", "#9a6ec7", "#d48b47", "#638b5a"][index % 4];
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

function trendPointMoney(point: TradingRoomTrendPoint, cumulative: boolean, currency?: string): string {
  const view = cumulative ? point.money : point.periodMoney;
  if (currency) {
    const value = view.originalByCurrency[currency];
    return value === undefined ? (cumulative ? "该币种无累计" : "该币种无成交") : money(value, currency);
  }
  if (view.convertedCny !== null) return money(view.convertedCny, "CNY");
  const values = Object.entries(view.originalByCurrency);
  if (values.length === 0) return point.availability === "empty" ? "暂无样本" : "数据不足";
  if (values.length > 1) return "无法合计";
  return values.map(([currency, value]) => money(value, currency)).join(" · ");
}

function trendPointLabel(point: TradingRoomTrendPoint, currency?: string): string {
  return `${point.label}，期间收益 ${trendPointMoney(point, false, currency)}，累计收益 ${trendPointMoney(point, true, currency)}`;
}

function renderableTrendValue(point: TradingRoomTrendPoint, currency?: string): string | null {
  if (point.availability === "insufficient") return null;
  return pointValue(point, currency);
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

function compactCellValue(cell: TradingRoomCalendarCell): string {
  if (cell.state === "future") return "—";
  if (cell.state === "positive") return "盈";
  if (cell.state === "negative") return "亏";
  if (cell.state === "break-even") return "平";
  if (cell.state === "unavailable") return "不可用";
  return "—";
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
  onScopeChange,
  instrumentMetadata,
  fxSnapshot,
  asOf,
  onOpenInReview,
  renderMoney,
}: RoomPerformanceProps) {
  const [view, setView] = useState<"trend" | "calendar">("trend");
  const [level, setLevel] = useState<TradingRoomCalendarLevel>("month");
  const [trendLevelOverride, setTrendLevelOverride] = useState<TradingRoomTrendLevel | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [selectedTrendKey, setSelectedTrendKey] = useState<string | null>(null);
  const [calendarHistory, setCalendarHistory] = useState<Array<{ level: TradingRoomCalendarLevel; period: RoomScope["period"] }>>([]);
  const [chartWidth, setChartWidth] = useState(640);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const scopePeriodSignature = roomPeriodSignature(scope.period);
  const scopeFilterSignature = roomFilterSignature(scope);
  const previousScopePeriodSignatureRef = useRef(scopePeriodSignature);
  const previousScopeFilterSignatureRef = useRef(scopeFilterSignature);
  const pendingInternalPeriodSignatureRef = useRef<string | null>(null);
  const trendLevel = trendLevelOverride ?? defaultTrendLevel(scope);
  const metadata = useMemo(() => normalizeRoomMetadata(instrumentMetadata), [instrumentMetadata]);
  const model = useMemo(() => buildTradingRoomCalendar(entries, {
    scope,
    level,
    trendLevel,
    asOf,
    instrumentMetadata,
    fxSnapshot,
  }), [asOf, entries, fxSnapshot, instrumentMetadata, level, scope, trendLevel]);
  const allYearsRange = useMemo(() => findTradingRoomHistoryRange(entries, scope, {
    asOf,
    instrumentMetadata,
  }), [asOf, entries, instrumentMetadata, scope]);
  const asOfDate = model.asOf;
  const queueIds = model.rows.map(row => row.item.episode.id);
  const displayMoney = (value: RoomMoneyView) => renderMoney ? renderMoney(value) : moneyLabel(value);
  const validSelectedKey = selectedKey && model.cells.some(cell => cell.key === selectedKey && cell.state !== "future") ? selectedKey : null;
  const validSelectedTrendKey = selectedTrendKey && model.trend.points.some(point => point.key === selectedTrendKey.split(":").at(-1)) ? selectedTrendKey : null;
  const details = validSelectedKey ? model.detailFor(validSelectedKey) : [];
  const selectedTrend = validSelectedTrendKey ? model.trend.points.find(point => point.key === validSelectedTrendKey.split(":").at(-1)) ?? null : null;
  const selectedTrendCurrency = validSelectedTrendKey?.split(":")[0];
  const selectedCell = validSelectedKey ? model.cells.find(cell => cell.key === validSelectedKey && cell.state !== "future") ?? null : null;
  const isDailyCalendar = level === "month" && model.cells.every(cell => cell.startDate === cell.endDate);
  const isCrossMonthSummary = level === "month" && scope.period.startDate.slice(0, 7) !== scope.period.endDate.slice(0, 7);
  const weekdayOffset = isDailyCalendar && model.cells.length > 0
    ? (dateFromKey(model.cells[0].startDate).getUTCDay() + 6) % 7
    : 0;
  const aggregateTrend = model.trend.endMoney.convertedCny !== null;
  const trendValues = aggregateTrend || model.trend.currencies.length <= 1
    ? model.trend.points.map(point => renderableTrendValue(point))
    : model.trend.currencies.flatMap(currency => model.trend.points.map(point => renderableTrendValue(point, currency)));
  const trendDomain = paddedValueDomain(trendValues);
  const chartGeometry = createChartGeometry({
    width: chartWidth,
    height: 190,
    padding: { top: 14, right: chartWidth < 240 ? 10 : 16, bottom: 42, left: 72 },
  });
  const zeroY = chartZeroY(trendDomain, chartGeometry);
  const maxTrendAxisLabels = chartWidth < 240 ? 2 : chartWidth < 360 ? 3 : 4;
  const trendAxisLabels = chartAxisLabels(model.trend.points, chartGeometry, maxTrendAxisLabels)
    .map(point => ({ ...point, label: trendAxisLabel(model.trend.points[point.index], trendLevel) }));
  const trendAxisTicks = visibleAxisTicks(chartAxisTicks(trendDomain, chartGeometry));
  const chartSeries = aggregateTrend || model.trend.currencies.length <= 1
    ? [{ key: aggregateTrend ? "CNY" : model.trend.currencies[0] ?? "CNY", points: model.trend.points.map(point => ({ value: renderableTrendValue(point, aggregateTrend ? undefined : model.trend.currencies[0]) })) }]
    : model.trend.currencies.map(currency => {
      let seenCurrency = false;
      return {
        key: currency,
        points: model.trend.points.map(point => {
          if (Object.prototype.hasOwnProperty.call(point.periodMoney.originalByCurrency, currency)) seenCurrency = true;
          return { value: seenCurrency ? renderableTrendValue(point, currency) : null };
        }),
      };
    });

  useEffect(() => {
    if (previousScopeFilterSignatureRef.current !== scopeFilterSignature) {
      setLevel("month");
      setSelectedKey(null);
      setSelectedTrendKey(null);
      setCalendarHistory([]);
      previousScopeFilterSignatureRef.current = scopeFilterSignature;
    }
    if (previousScopePeriodSignatureRef.current !== scopePeriodSignature) {
      if (pendingInternalPeriodSignatureRef.current === scopePeriodSignature) {
        pendingInternalPeriodSignatureRef.current = null;
      } else {
        setLevel("month");
        setSelectedKey(null);
        setSelectedTrendKey(null);
        setCalendarHistory([]);
      }
      previousScopePeriodSignatureRef.current = scopePeriodSignature;
    }
  }, [scopeFilterSignature, scopePeriodSignature]);

  const chartStageRef = useCallback((element: HTMLDivElement | null) => {
    resizeObserverRef.current?.disconnect();
    resizeObserverRef.current = null;
    if (!element) return;
    const updateWidth = () => {
      const measured = Math.round(element.getBoundingClientRect().width);
      if (measured > 0) setChartWidth(current => current === measured ? current : measured);
    };
    updateWidth();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);
    resizeObserverRef.current = observer;
  }, []);

  const requestPeriodChange = (period: RoomScope["period"], nextLevel?: TradingRoomCalendarLevel) => {
    pendingInternalPeriodSignatureRef.current = roomPeriodSignature(period);
    if (nextLevel) setLevel(nextLevel);
    onScopeChange({ period });
  };

  const changeLevel = (next: TradingRoomCalendarLevel) => {
    setSelectedKey(null);
    setLevel(next);
    if (next === "all-years") {
      if (allYearsRange.startDate <= allYearsRange.endDate) {
        requestPeriodChange(allYearsRange, "all-years");
      }
      return;
    }
    if (next === "year") {
      const anchor = scope.period.endDate > asOfDate ? asOfDate : scope.period.endDate;
      requestPeriodChange(setPeriodForYear(anchor, asOfDate), "year");
      return;
    }
    if (scope.period.preset === "last-3-months") return;
    const anchor = scope.period.endDate > asOfDate ? asOfDate : scope.period.endDate;
    requestPeriodChange(setPeriodForMonth(anchor, asOfDate), "month");
  };

  const selectCell = (cell: TradingRoomCalendarCell) => {
    if (cell.state === "future") return;
    setSelectedKey(null);
    if (level === "all-years") {
      setCalendarHistory(history => [...history, { level, period: scope.period }]);
      requestPeriodChange(setPeriodForYear(cell.key, asOfDate), "year");
      return;
    }
    if (level === "year" || cell.key.length === 7) {
      setCalendarHistory(history => [...history, { level, period: scope.period }]);
      requestPeriodChange(setPeriodForMonth(cell.key, asOfDate), "month");
      return;
    }
    setSelectedKey(cell.key);
  };

  const returnToPreviousRange = () => {
    const previous = calendarHistory.at(-1);
    if (!previous) return;
    setCalendarHistory(history => history.slice(0, -1));
    setSelectedKey(null);
    setLevel(previous.level);
    requestPeriodChange(previous.period, previous.level);
  };

  const movePeriod = (delta: number) => {
    const base = dateFromKey(scope.period.endDate);
    base.setUTCDate(1);
    base.setUTCMonth(base.getUTCMonth() + delta);
    const key = dateKey(base).slice(0, 7);
    if (delta > 0 && `${key}-01` > asOfDate) return;
    setSelectedKey(null);
    requestPeriodChange(setPeriodForMonth(key, asOfDate), "month");
  };

  const moveYear = (delta: number) => {
    const year = Number(scope.period.endDate.slice(0, 4)) + delta;
    if (delta > 0 && year > Number(asOfDate.slice(0, 4))) return;
    requestPeriodChange(setPeriodForYear(`${year}-01-01`, asOfDate), "year");
  };
  const nextPeriodStart = (() => {
    const base = dateFromKey(scope.period.endDate);
    base.setUTCDate(1);
    base.setUTCMonth(base.getUTCMonth() + 1);
    return dateKey(base);
  })();
  const nextDisabled = level === "year"
    ? Number(scope.period.endDate.slice(0, 4)) >= Number(asOfDate.slice(0, 4))
    : nextPeriodStart > asOfDate;

  return (
    <section className={`${styles.panel} ${embedded ? styles.embeddedPanel : ""}`} aria-label="业绩趋势与日历">
      <header className={styles.heading}>
        <div>
          <h2>{view === "trend" ? "累计盈亏趋势" : "盈亏日历"}</h2>
          <p>{model.range.startDate} 至 {model.range.endDate} · {model.summary.trustedClosedCount} 个可信已平仓回合 · 排除 {model.summary.excludedCount} 个已平仓样本{model.summary.unknownAssetEpisodeCount ? ` · 未知资产 ${model.summary.unknownAssetEpisodeCount} 个另列` : ""}</p>
        </div>
        <div className={styles.viewTabs} role="group" aria-label="业绩视图">
          <button type="button" aria-pressed={view === "trend"} onClick={() => { setView("trend"); setSelectedKey(null); }}>趋势</button>
          <button type="button" aria-pressed={view === "calendar"} onClick={() => { setView("calendar"); setSelectedKey(null); }}>日历</button>
        </div>
        {view === "trend" && <div className={styles.levelTabs} role="group" aria-label="趋势分桶">
          {(["day", "week", "month"] as const).map(value => <button type="button" key={value} aria-label={value === "day" ? "日" : value === "week" ? "周" : "月"} aria-pressed={trendLevel === value} onClick={() => { setTrendLevelOverride(value); setSelectedKey(null); }}>{value === "day" ? "日" : value === "week" ? "周" : "月"}<span className={styles.visuallyHidden}>{trendLevelLabel(value)}</span></button>)}
        </div>}
      </header>

      {!embedded && <div className={styles.summaryLine} role="group" aria-label="区间收益摘要">
        <strong>{displayMoney(model.summary.money)}</strong>
        <span>{moneyDetail(model.summary.money)}</span>
      </div>}

      {view === "trend" ? (
        <div className={styles.trendWrap}>
          {model.trend.points.length === 0 || model.summary.trustedClosedCount === 0 ? (
            <p className={styles.empty}>当前范围暂无可绘制的已平仓回合。</p>
          ) : (
            <div className={styles.chartFrame}>
              <div className={styles.chartAxisLayout}>
                <div className={styles.chartPlotArea}>
                  <div className={styles.chartStage} ref={chartStageRef}>
                    <svg role="img" aria-label="累计盈亏趋势图" width="100%" height={chartGeometry.height} viewBox={`0 0 ${chartGeometry.width} ${chartGeometry.height}`} preserveAspectRatio="none">
                    {trendAxisTicks.map(tick => <g key={tick.value}>
                      <line x1={chartGeometry.padding.left} x2={chartGeometry.width - chartGeometry.padding.right} y1={tick.y} y2={tick.y} className={styles.axisGridLine} />
                      <line x1={chartGeometry.padding.left - 4} x2={chartGeometry.padding.left} y1={tick.y} y2={tick.y} className={styles.axisTickMark} data-chart-role="axis-y-tick" data-value={tick.value} y={tick.y} />
                    </g>)}
                    <line x1={chartGeometry.padding.left} x2={chartGeometry.width - chartGeometry.padding.right} y1={zeroY} y2={zeroY} className={styles.zeroLine} data-chart-role="zero-line" />
                    {chartSeries.map((series, index) => {
                      const points = chartPointCoordinates(series.points, chartGeometry, trendDomain);
                      return <g key={series.key}>
                        <path d={chartLinePath(series.points, chartGeometry, trendDomain)} fill="none" stroke={lineColor(index)} strokeWidth="3" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                        {points.map(point => {
                          const trendPoint = model.trend.points[point.index];
                          if (!trendPoint) return null;
                          const selectPoint = () => setSelectedTrendKey(`${series.key}:${trendPoint.key}`);
                          const pointLabel = `${series.key} · ${trendPointLabel(trendPoint, aggregateTrend ? undefined : series.key)}`;
                          const pointEvents = {
                            onMouseEnter: selectPoint,
                            onPointerEnter: selectPoint,
                            onFocus: selectPoint,
                            onClick: selectPoint,
                            onKeyDown: (event: KeyboardEvent<SVGCircleElement>) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                selectPoint();
                              }
                            },
                          };
                          return <g key={`${series.key}-${point.index}`}>
                            <circle cx={point.x} cy={point.y} r="4" fill={lineColor(index)} data-chart-role="point-visible" pointerEvents="none"><title>{series.key} · {point.value}</title></circle>
                            <circle cx={point.x} cy={point.y} r="22" fill="transparent" role="button" tabIndex={0} aria-label={pointLabel} data-chart-role="point-hit-area" className={styles.chartPointHitArea} {...pointEvents} />
                          </g>;
                        })}
                      </g>;
                    })}
                    </svg>
                    <div className={styles.axisYLabels} aria-label="趋势图纵轴刻度">
                      {trendAxisTicks.map(tick => <span key={tick.value} style={{ top: `${(tick.y / chartGeometry.height) * 100}%`, left: `${(chartGeometry.padding.left / chartGeometry.width) * 100}%` }} data-chart-role="axis-y-label" data-value={tick.value}>{model.trend.currencies.length > 1 && !aggregateTrend ? new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2, signDisplay: "always" }).format(tick.value) : money(String(tick.value), aggregateTrend ? "CNY" : model.trend.currencies[0] ?? "CNY")}</span>)}
                    </div>
                    <div className={styles.axisXLabels} aria-label="趋势图横轴">
                      {trendAxisLabels.map(point => <span className={point.index === 0 ? styles.axisXLabelStart : point.index === model.trend.points.length - 1 ? styles.axisXLabelEnd : undefined} key={point.key} style={{ left: `${(point.x / chartGeometry.width) * 100}%` }} data-chart-role="axis-x-tick" data-key={point.key} data-x={point.x}>{point.label}</span>)}
                    </div>
                  </div>
                </div>
              </div>
              <div className={styles.trendValueLegend}><span><i style={{ backgroundColor: lineColor(0) }} />累计收益</span></div>
              {selectedTrend && <div className={styles.selectedTrendPoint} role="status" aria-label="趋势点详情" aria-live="polite">
                <strong>{selectedTrend.label}</strong>
                <span>期间收益 {trendPointMoney(selectedTrend, false, aggregateTrend ? undefined : selectedTrendCurrency)}</span>
                <span>累计收益 {trendPointMoney(selectedTrend, true, aggregateTrend ? undefined : selectedTrendCurrency)}</span>
                <small>{selectedTrend.trustedClosedCount} 个可信回合 · {selectedTrend.wins} 胜 / {selectedTrend.losses} 负 / 持平 {selectedTrend.breakEven} · {selectedTrend.startDate} 至 {selectedTrend.endDate}{selectedTrend.availability !== "available" ? ` · ${selectedTrend.availability === "not-combinable" ? "多币种无法合计" : selectedTrend.availability === "insufficient" ? "数据不足" : "暂无样本"}` : ""}</small>
              </div>}
              <details className={styles.trendDetails}>
                <summary>查看趋势数据</summary>
                <div className={styles.trendPointList} aria-label="趋势数据">
                  {model.trend.points.map(point => <div key={point.key} aria-label={trendPointLabel(point)}>
                    <strong>{point.label}</strong>
                    <span>期间收益 {trendPointMoney(point, false)}</span>
                    <span>累计收益 {trendPointMoney(point, true)}</span>
                    <small>{point.trustedClosedCount} 个可信回合 · {point.wins} 胜 / {point.losses} 负 · {point.startDate} 至 {point.endDate}</small>
                  </div>)}
                </div>
              </details>
              {model.trend.currencies.length > 1 && model.trend.endMoney.convertedCny === null && <>
                <div className={styles.legend} aria-label="趋势币种图例">{model.trend.currencies.map((currency, index) => <span key={currency}><i style={{ backgroundColor: lineColor(index) }} />{currency}</span>)}</div>
                <p className={styles.notice}>多币种暂不可合计，趋势按原币分别显示（共用同一数值尺度）。</p>
              </>}
              {model.trend.currencies.length > 1 && aggregateTrend && <p className={styles.notice}>多币种已按同一汇率快照换算为人民币合计。</p>}
            </div>
          )}
        </div>
      ) : (
        <div className={styles.calendarWrap}>
          <div className={styles.levelTabs} role="group" aria-label="日历层级">
            {(["month", "year", "all-years"] as const).map(value => <button type="button" key={value} aria-label={value === "month" && !isCrossMonthSummary ? "月" : undefined} aria-pressed={level === value && !isCrossMonthSummary} onClick={() => changeLevel(value)}>{value === "month" ? (isCrossMonthSummary ? "所选期间·按月汇总" : "月") : value === "year" ? "年" : "全部年份"}</button>)}
          </div>
          {calendarHistory.length > 0 && <div className={styles.breadcrumb}><span>范围路径：{calendarHistory.map(item => item.level === "all-years" ? "全部年份" : item.level === "year" ? "年份" : "月份").join(" / ")} / 当前</span><button type="button" onClick={returnToPreviousRange}>返回上一范围</button></div>}
          {level !== "all-years" && <div className={styles.calendarNav}>
            <button type="button" aria-label={level === "year" ? "上一年" : "上一个月"} onClick={() => level === "year" ? moveYear(-1) : movePeriod(-1)}>‹</button>
            <span>{model.range.startDate} 至 {model.range.endDate}</span>
            <button type="button" aria-label={level === "year" ? "下一年" : "下一个月"} disabled={nextDisabled} onClick={() => level === "year" ? moveYear(1) : movePeriod(1)}>›</button>
          </div>}
          {isDailyCalendar && <div className={styles.weekdays} aria-hidden="true">{["一", "二", "三", "四", "五", "六", "日"].map(day => <span key={day}>周{day}</span>)}</div>}
          <div className={`${styles.calendarGrid} ${isDailyCalendar ? styles.dailyGrid : styles.periodGrid}`}>
            {isDailyCalendar && Array.from({ length: weekdayOffset }, (_, index) => <span key={`leading-${index}`} className={styles.leadingBlank} aria-hidden="true" />)}
            {model.cells.map(cell => <button type="button" key={cell.key} className={`${styles.cell} ${styles[`state-${cell.state}`]}`} aria-label={`${cell.label}，${cellLabel(cell)}，${cellSecondaryLabel(cell)}`} disabled={cell.state === "future"} onClick={() => selectCell(cell)}>
              <strong>{isDailyCalendar ? <><span className={styles.dayNumber}>{cell.startDate.slice(8)}</span><span className={styles.fullDate}>{cell.startDate}</span></> : cell.label}</strong>
              <span className={styles.cellValueLong}>{cellLabel(cell)}</span>
              {isDailyCalendar && <span className={styles.cellValueShort}>{compactCellValue(cell)}</span>}
              <small className={styles.cellSecondaryLong}>{cellSecondaryLabel(cell)}</small>
              {isDailyCalendar && <small className={styles.cellSecondaryShort}>{compactCellSecondaryLabel(cell)}</small>}
            </button>)}
          </div>
          {validSelectedKey && <section className={styles.detail} aria-label="日历日期详情">
            <div className={styles.detailHeading}><strong>{selectedKey}</strong><span>{details.length} 个回合</span></div>
            {selectedCell && <div className={styles.detailSummary} aria-label="日历汇总详情">
              <div><span>期间金额</span><strong>{selectedCell.value !== null ? displayMoney(selectedCell.money) : cellLabel(selectedCell)}</strong></div>
              <div><span>可信样本</span><strong>{selectedCell.trustedClosedCount}</strong></div>
              <div><span>胜率</span><strong>{percentLabel(selectedCell.winRatePercent)}</strong></div>
            </div>}
            {details.length === 0 ? <p className={styles.empty}>该日期没有已平仓回合。</p> : <div className={styles.detailRows}>{details.map(row => {
              const projection = classifyTradingRoomAsset(row.item.episode.instrument, metadata.get(row.item.episode.instrument.id));
              const excluded = projection.category === "unknown" ? "未知资产类型" : dashboardRowExclusionReason(row);
              return <div className={styles.detailRow} key={row.item.episode.id}>
                <div><strong>{row.item.episode.instrument.name}（{row.item.episode.instrument.symbol}）</strong><small>{dashboardEpisodeDate(row)} · {row.item.episode.accountLabel}</small></div>
                <div><strong>{excluded ? `不可用 · ${exclusionReasonLabel(excluded)}` : rowMoney(row)}</strong><button type="button" onClick={() => onOpenInReview(row.item.episode.instrument.id, row.item.episode.id, queueIds)}>打开复盘</button></div>
              </div>;
            })}</div>}
          </section>}
        </div>
      )}
    </section>
  );
}
