"use client";

import { useMemo, useState, type ReactNode } from "react";

import type { TradeLibraryEntry } from "../../lib/trades/library";
import type {
  RoomFxSnapshot,
  RoomMoneyView,
  RoomScope,
  TradingRoomMetadataInput,
} from "../../lib/reviews/trading-room-scope";
import {
  buildTradingRoomCalendar,
  type TradingRoomCalendarCell,
  type TradingRoomCalendarLevel,
  type TradingRoomTrendLevel,
  type TradingRoomTrendPoint,
} from "../../lib/reviews/trading-room-calendar";
import { classifyTradingRoomAsset, normalizeRoomMetadata } from "../../lib/reviews/trading-room-scope";
import { dashboardEpisodeDate, dashboardRowExclusionReason, exclusionReasonLabel } from "../../lib/reviews/dashboard";
import styles from "./room-performance.module.css";

export type RoomPerformanceProps = {
  entries: readonly TradeLibraryEntry[];
  scope: RoomScope;
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

type ValueDomain = { min: number; max: number };

function valueDomain(values: readonly (string | null)[]): ValueDomain {
  const numbers = values.filter((value): value is string => value !== null).map(Number).filter(Number.isFinite);
  const min = Math.min(0, ...numbers);
  const max = Math.max(0, ...numbers);
  const span = max - min;
  // Keep zero and isolated extrema away from the frame edge. This also gives a
  // useful visible position to an all-zero or single-point series.
  const padding = span === 0 ? 1 : span * 0.1;
  return { min: min - padding, max: max + padding };
}

function pointX(index: number, length: number, width: number): number {
  const inset = Math.min(14, width / 8);
  return length <= 1 ? width / 2 : inset + (index / (length - 1)) * (width - inset * 2);
}

function pointY(value: string, height: number, domain: ValueDomain): number {
  const span = domain.max - domain.min || 1;
  return height - ((Number(value) - domain.min) / span) * height;
}

function linePaths(points: readonly { value: string | null }[], width: number, height: number, domain = valueDomain(points.map(point => point.value))): string[] {
  if (points.every(point => point.value === null)) return [];
  const { min, max } = domain;
  const span = max - min || 1;
  const paths: string[] = [];
  let coordinates: string[] = [];
  points.forEach((point, index) => {
    const value = point.value === null ? null : Number(point.value);
    if (value === null || !Number.isFinite(value)) {
      if (coordinates.length > 1) paths.push(`M${coordinates.join(" L")}`);
      coordinates = [];
      return;
    }
    const x = pointX(index, points.length, width);
    const y = height - ((value - min) / span) * height;
    coordinates.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  });
  if (coordinates.length > 1) paths.push(`M${coordinates.join(" L")}`);
  return paths;
}

function pointCoordinates(
  points: readonly { value: string | null }[],
  width: number,
  height: number,
  domain: ValueDomain,
): Array<{ index: number; x: number; y: number; value: string }> {
  return points.flatMap((point, index) => {
    if (point.value === null || !Number.isFinite(Number(point.value))) return [];
    return [{
      index,
      x: pointX(index, points.length, width),
      y: pointY(point.value, height, domain),
      value: point.value,
    }];
  });
}

function trendTicks(domain: ValueDomain, height = 180): number[] {
  const step = (domain.max - domain.min) / 4;
  const ticks = Array.from({ length: 5 }, (_, index) => domain.max - (step * index));
  if (domain.min < 0 && domain.max > 0) ticks.push(0);
  const unique = [...new Set(ticks.map(value => Number(value.toFixed(8))))].sort((a, b) => b - a);
  const minGap = 20;
  const visible: number[] = [];
  for (const tick of unique) {
    const y = pointY(String(tick), height, domain);
    if (visible.every(value => Math.abs(pointY(String(value), height, domain) - y) >= minGap)) visible.push(tick);
  }
  if (domain.min < 0 && domain.max > 0 && !visible.includes(0)) {
    const zeroIndex = visible.findIndex(value => Math.abs(pointY(String(value), height, domain) - pointY("0", height, domain)) < minGap);
    if (zeroIndex >= 0) visible.splice(zeroIndex, 1);
    visible.push(0);
  }
  return visible.sort((a, b) => b - a);
}

function axisTickLabel(value: number, currency: string | undefined, sharedOriginalScale: boolean): string {
  if (sharedOriginalScale) {
    return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2, signDisplay: "always" }).format(value);
  }
  return money(String(value), currency ?? "CNY");
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

function compactTrendLabel(label: string): string {
  const match = label.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[2]}-${match[3]}`;
  const month = label.match(/(\d{4})-(\d{2})/);
  if (month) return `${month[1]}-${month[2]}`;
  const chineseMonth = label.match(/(\d{4})年(\d{1,2})月/);
  return chineseMonth ? `${chineseMonth[2]}月` : label;
}

function trendPointMoney(point: TradingRoomTrendPoint, cumulative: boolean, currency?: string): string {
  const view = cumulative ? point.money : point.periodMoney;
  if (currency) {
    const value = view.originalByCurrency[currency];
    return value !== undefined ? money(value, currency) : cumulative ? "该币种无累计" : "该币种无成交";
  }
  if (view.convertedCny !== null) return money(view.convertedCny, "CNY");
  const values = Object.entries(view.originalByCurrency);
  if (values.length === 0) return point.availability === "empty" ? "暂无样本" : "数据不足";
  return values.map(([currency, value]) => money(value, currency)).join(" · ");
}

function trendPointLabel(point: TradingRoomTrendPoint, currency?: string): string {
  return `${point.label}，期间收益 ${trendPointMoney(point, false, currency)}，累计收益 ${trendPointMoney(point, true, currency)}`;
}

function renderableTrendValue(point: TradingRoomTrendPoint, currency?: string): string | null {
  // An empty bucket has a known carried-forward cumulative total and should
  // form a plateau. Insufficient/unavailable buckets must break the path.
  if (point.availability === "insufficient") return null;
  return pointValue(point, currency);
}

export function RoomPerformance({
  entries,
  scope,
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
  const allYears = useMemo(() => buildTradingRoomCalendar(entries, {
    scope,
    level: "all-years",
    asOf,
    instrumentMetadata,
    fxSnapshot,
  }), [asOf, entries, fxSnapshot, instrumentMetadata, scope]);
  const allYearsRange = allYears.cells.length > 0
    ? { preset: "custom" as const, startDate: allYears.cells[0].startDate, endDate: allYears.cells.at(-1)!.endDate > allYears.asOf ? allYears.asOf : allYears.cells.at(-1)!.endDate }
    : allYears.range;
  const asOfDate = model.asOf;
  const queueIds = model.rows.map(row => row.item.episode.id);
  const displayMoney = (value: RoomMoneyView) => renderMoney ? renderMoney(value) : moneyLabel(value);
  const validSelectedKey = selectedKey && model.cells.some(cell => cell.key === selectedKey) ? selectedKey : null;
  const details = validSelectedKey ? model.detailFor(validSelectedKey) : [];
  const isDailyCalendar = level === "month" && model.cells.every(cell => cell.startDate === cell.endDate);
  const isCrossMonthSummary = level === "month" && scope.period.startDate.slice(0, 7) !== scope.period.endDate.slice(0, 7);
  const weekdayOffset = isDailyCalendar && model.cells.length > 0
    ? (dateFromKey(model.cells[0].startDate).getUTCDay() + 6) % 7
    : 0;
  const aggregateTrend = model.trend.endMoney.convertedCny !== null;
  const trendValues = aggregateTrend || model.trend.currencies.length <= 1
    ? model.trend.points.map(point => renderableTrendValue(point))
    : model.trend.currencies.flatMap(currency => model.trend.points.map(point => renderableTrendValue(point, currency)));
  const trendDomain = valueDomain(trendValues);
  const ticks = trendTicks(trendDomain, 180);
  const sharedOriginalScale = !aggregateTrend && model.trend.currencies.length > 1;
  const chartSeries = aggregateTrend
    ? [{ key: "CNY", points: model.trend.points.map(point => ({ value: renderableTrendValue(point) })) }]
    : model.trend.currencies.length <= 1
      ? [{ key: model.trend.currencies[0] ?? "CNY", points: model.trend.points.map(point => ({ value: renderableTrendValue(point, model.trend.currencies[0]) })) }]
    : model.trend.currencies.map(currency => ({
      key: currency,
      points: model.trend.points.map(point => ({ value: renderableTrendValue(point, currency) })),
    }));

  const changeLevel = (next: TradingRoomCalendarLevel) => {
    setSelectedKey(null);
    setLevel(next);
    if (next === "all-years") {
      if (allYearsRange.startDate <= allYearsRange.endDate) {
        onScopeChange({ period: allYearsRange });
      }
      return;
    }
    if (next === "year") {
      const anchor = scope.period.endDate > asOfDate ? asOfDate : scope.period.endDate;
      onScopeChange({ period: setPeriodForYear(anchor, asOfDate) });
      return;
    }
    if (scope.period.preset === "last-3-months") return;
    const anchor = scope.period.endDate > asOfDate ? asOfDate : scope.period.endDate;
    onScopeChange({ period: setPeriodForMonth(anchor, asOfDate) });
  };

  const selectCell = (cell: TradingRoomCalendarCell) => {
    if (cell.state === "future") return;
    setSelectedKey(null);
    if (level === "all-years") {
      setCalendarHistory(history => [...history, { level, period: scope.period }]);
      onScopeChange({ period: setPeriodForYear(cell.key, asOfDate) });
      setLevel("year");
      return;
    }
    if (level === "year" || cell.key.length === 7) {
      setCalendarHistory(history => [...history, { level, period: scope.period }]);
      onScopeChange({ period: setPeriodForMonth(cell.key, asOfDate) });
      setLevel("month");
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
    onScopeChange({ period: previous.period });
  };

  const movePeriod = (delta: number) => {
    const base = dateFromKey(scope.period.endDate);
    base.setUTCDate(1);
    base.setUTCMonth(base.getUTCMonth() + delta);
    const key = dateKey(base).slice(0, 7);
    if (delta > 0 && `${key}-01` > asOfDate) return;
    setSelectedKey(null);
    onScopeChange({ period: setPeriodForMonth(key, asOfDate) });
  };

  const moveYear = (delta: number) => {
    const year = Number(scope.period.endDate.slice(0, 4)) + delta;
    if (delta > 0 && year > Number(asOfDate.slice(0, 4))) return;
    onScopeChange({ period: setPeriodForYear(`${year}-01-01`, asOfDate) });
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
    <section className={styles.panel} aria-label="业绩趋势与日历">
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
          {(["day", "week", "month"] as const).map(value => <button type="button" key={value} aria-label={value === "day" ? "日" : value === "week" ? "周" : "月"} aria-pressed={trendLevel === value} onClick={() => { setTrendLevelOverride(value); setSelectedKey(null); }}>{value === "day" ? "日" : value === "week" ? "周" : "月"}<span className={styles.visuallyHidden}>{value === "day" ? "自然日" : value === "week" ? "自然周" : "自然月"}</span></button>)}
        </div>}
      </header>

      {view === "calendar" && <div className={styles.summaryLine}>
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
                <div className={styles.axisY} aria-label="趋势图纵轴">
                  {ticks.map((tick, index) => <span key={index} style={{ top: `${pointY(String(tick), 180, trendDomain)}px` }}>{axisTickLabel(tick, aggregateTrend ? "CNY" : model.trend.currencies[0], sharedOriginalScale)}</span>)}
                </div>
                <div className={styles.chartPlotArea}>
                  <svg role="img" aria-label="累计盈亏趋势图" viewBox="0 0 640 180" preserveAspectRatio="none">
                    {ticks.map((tick, index) => <line key={`grid-${index}`} x1="0" x2="640" y1={pointY(String(tick), 180, trendDomain)} y2={pointY(String(tick), 180, trendDomain)} className={tick === 0 ? styles.zeroLine : styles.gridLine} />)}
                    {chartSeries.map((series, index) => {
                      const points = pointCoordinates(series.points, 640, 180, trendDomain);
                      return <g key={series.key}>
                        {linePaths(series.points, 640, 180, trendDomain).map((path, pathIndex) => <path key={`${series.key}-path-${pathIndex}`} d={path} fill="none" stroke={lineColor(index)} strokeWidth="3" strokeLinecap="round" vectorEffect="non-scaling-stroke" />)}
                        {points.map((point, pointIndex) => {
                          const source = model.trend.points[point.index];
                          const label = `${source.label}，${series.key}，${trendPointLabel(source, aggregateTrend ? undefined : series.key)}`;
                          const select = () => setSelectedTrendKey(`${series.key}:${source.key}`);
                          return <circle key={`${series.key}-${pointIndex}`} cx={point.x} cy={point.y} r={selectedTrendKey === `${series.key}:${source.key}` ? "6" : "4"} fill={lineColor(index)} stroke="transparent" strokeWidth="44" pointerEvents="stroke" vectorEffect="non-scaling-stroke" tabIndex={0} role="button" aria-label={label} onClick={select} onTouchStart={select} onMouseEnter={select} onFocus={select} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); select(); } }}><title>{label}</title></circle>;
                        })}
                      </g>;
                    })}
                  </svg>
                  <div className={styles.axisX} aria-label="趋势图横轴">
                    {model.trend.points.map((point, index) => (index === 0 || index === model.trend.points.length - 1 || index % Math.max(1, Math.ceil(model.trend.points.length / 5)) === 0) ? <span key={point.key} title={point.label} aria-label={point.label} style={{ left: `${(pointX(index, model.trend.points.length, 640) / 640) * 100}%`, textAlign: index === 0 ? "left" : index === model.trend.points.length - 1 ? "right" : "center" }}>{compactTrendLabel(point.label)}</span> : null)}
                  </div>
                </div>
              </div>
              <div className={styles.trendValueLegend}><span>累计净盈亏</span></div>
              {selectedTrendKey && (() => {
                const [seriesKey, pointKey] = selectedTrendKey.split(":");
                const point = model.trend.points.find(value => value.key === pointKey);
                return point ? <p className={styles.selectedTrend} aria-live="polite">{point.label} · 期间 {trendPointMoney(point, false, aggregateTrend ? undefined : seriesKey)} · 累计 {trendPointMoney(point, true, aggregateTrend ? undefined : seriesKey)} · {seriesKey} · {model.trend.currencies.length > 1 ? `全部币种${point.trustedClosedCount}个可信回合` : `${point.trustedClosedCount} 个可信回合`}</p> : null;
              })()}
              <details className={styles.trendDetails}>
                <summary>查看趋势数据</summary>
                <div className={styles.trendPointList} aria-label="趋势数据">
                  {model.trend.points.map(point => <div key={point.key} aria-label={trendPointLabel(point)}>
                    <strong>{point.label}</strong>
                    <span>期间 {trendPointMoney(point, false)}</span>
                    <span>累计 {trendPointMoney(point, true)}</span>
                    <small>{point.trustedClosedCount} 个可信回合 · {point.wins} 胜 / {point.losses} 负 · {point.startDate} 至 {point.endDate}</small>
                  </div>)}
                </div>
              </details>
              {model.trend.currencies.length > 1 && model.trend.endMoney.convertedCny === null && <>
                <div className={styles.legend} aria-label="趋势币种图例">{model.trend.currencies.map((currency, index) => <span key={currency}><i style={{ backgroundColor: lineColor(index) }} />{currency}</span>)}</div>
                <p className={styles.notice}>多币种暂不可合计，趋势按原币分别显示（共用同一数值尺度）。原币小计：{moneyDetail(model.summary.money).replace(/^原币小计：/, "")}</p>
              </>}
              {model.trend.currencies.length > 1 && aggregateTrend && <p className={styles.notice}>多币种已按同一汇率快照换算为人民币合计。</p>}
            </div>
          )}
        </div>
      ) : (
        <div className={styles.calendarWrap}>
          <div className={styles.levelTabs} role="group" aria-label="日历层级">
            {(["month", "year", "all-years"] as const).map(value => <button type="button" key={value} aria-pressed={level === value && !isCrossMonthSummary} onClick={() => changeLevel(value)}>{value === "month" ? (isCrossMonthSummary ? "所选期间·按月汇总" : "月") : value === "year" ? "年" : "全部年份"}</button>)}
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
            {model.cells.map(cell => <button type="button" key={cell.key} className={`${styles.cell} ${styles[`state-${cell.state}`]}`} aria-label={`${isDailyCalendar ? cell.startDate : cell.label}，${cellLabel(cell)}`} disabled={cell.state === "future"} onClick={() => selectCell(cell)}>
              <strong>{isDailyCalendar ? <><span className={styles.dayNumber}>{cell.startDate.slice(8)}</span><span className={styles.fullDate}>{cell.startDate}</span></> : cell.label}</strong>
              <span>{cellLabel(cell)}</span>
              <small>{cell.trustedClosedCount ? `${cell.trustedClosedCount} 回合` : cell.excludedCount ? `${cell.excludedCount} 待核对` : ""}</small>
            </button>)}
          </div>
          <div className={styles.legend} aria-label="日历状态图例"><span><i className={styles.legendPositive} />盈利</span><span><i className={styles.legendNegative} />亏损</span><span><i className={styles.legendBreakEven} />持平</span><span><i className={styles.legendUnavailable} />不可用</span><span><i className={styles.legendEmpty} />无样本</span><span><i className={styles.legendFuture} />未来</span></div>
          {validSelectedKey && <section className={styles.detail} aria-label="日历日期详情">
            <div className={styles.detailHeading}><strong>{validSelectedKey}</strong><span>{details.length} 个回合</span></div>
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
