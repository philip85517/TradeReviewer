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
  return { min: Math.min(0, ...numbers), max: Math.max(0, ...numbers) };
}

function linePath(points: readonly { value: string | null }[], width: number, height: number, domain = valueDomain(points.map(point => point.value))): string {
  const { min, max } = domain;
  if (points.every(point => point.value === null)) return "";
  const span = max - min || 1;
  const coordinates = points.map((point, index) => {
    const x = points.length <= 1 ? width / 2 : (index / (points.length - 1)) * width;
    const value = point.value === null ? null : Number(point.value);
    if (value === null || !Number.isFinite(value)) return null;
    const y = height - ((value - min) / span) * height;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).filter((value): value is string => value !== null);
  return coordinates.length > 1 ? `M${coordinates.join(" L")}` : "";
}

function pointCoordinate(
  points: readonly { value: string | null }[],
  width: number,
  height: number,
  domain: ValueDomain,
): { x: number; y: number } | null {
  const index = points.findIndex(point => point.value !== null && Number.isFinite(Number(point.value)));
  if (index < 0) return null;
  const value = Number(points[index].value);
  const span = domain.max - domain.min || 1;
  return {
    x: points.length <= 1 ? width / 2 : (index / (points.length - 1)) * width,
    y: height - ((value - domain.min) / span) * height,
  };
}

function zeroLinePosition(domain: ValueDomain, height: number): number {
  const { min, max } = domain;
  const span = max - min || 1;
  return height - ((0 - min) / span) * height;
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
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const metadata = useMemo(() => normalizeRoomMetadata(instrumentMetadata), [instrumentMetadata]);
  const model = useMemo(() => buildTradingRoomCalendar(entries, {
    scope,
    level,
    asOf,
    instrumentMetadata,
    fxSnapshot,
  }), [asOf, entries, fxSnapshot, instrumentMetadata, level, scope]);
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
  const details = selectedKey ? model.detailFor(selectedKey) : [];
  const isDailyCalendar = level === "month" && model.cells.every(cell => cell.startDate === cell.endDate);
  const aggregateTrend = model.trend.endMoney.convertedCny !== null;
  const trendValues = aggregateTrend || model.trend.currencies.length <= 1
    ? model.trend.points.map(point => point.value)
    : model.trend.currencies.flatMap(currency => model.trend.points.map(point => pointValue(point, currency)));
  const trendDomain = valueDomain(trendValues);
  const zeroY = zeroLinePosition(trendDomain, 180);
  const chartSeries = aggregateTrend || model.trend.currencies.length <= 1
    ? [{ key: "CNY", points: model.trend.points.map(point => ({ value: point.value })) }]
    : model.trend.currencies.map(currency => ({
      key: currency,
      points: model.trend.points.map(point => ({ value: pointValue(point, currency) })),
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
      onScopeChange({ period: setPeriodForYear(cell.key, asOfDate) });
      setLevel("year");
      return;
    }
    if (level === "year" || cell.key.length === 7) {
      onScopeChange({ period: setPeriodForMonth(cell.key, asOfDate) });
      setLevel("month");
      return;
    }
    setSelectedKey(cell.key);
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
          <span className={styles.eyebrow}>Performance</span>
          <h2>{view === "trend" ? "累计盈亏趋势" : "盈亏日历"}</h2>
          <p>{model.range.startDate} 至 {model.range.endDate} · {model.summary.trustedClosedCount} 个可信已平仓回合 · 排除 {model.summary.excludedCount} 个已平仓样本{model.summary.unknownAssetEpisodeCount ? ` · 未知资产 ${model.summary.unknownAssetEpisodeCount} 个另列` : ""}</p>
        </div>
        <div className={styles.viewTabs} role="group" aria-label="业绩视图">
          <button type="button" aria-pressed={view === "trend"} onClick={() => { setView("trend"); setSelectedKey(null); }}>趋势</button>
          <button type="button" aria-pressed={view === "calendar"} onClick={() => { setView("calendar"); setSelectedKey(null); }}>日历</button>
        </div>
      </header>

      <div className={styles.summaryLine}>
        <strong>{displayMoney(model.summary.money)}</strong>
        <span>{moneyDetail(model.summary.money)}</span>
      </div>

      {view === "trend" ? (
        <div className={styles.trendWrap}>
          <div className={styles.trendMeta}>
            <span>区间累计末值</span>
            <strong>{displayMoney(model.trend.endMoney)}</strong>
          </div>
          {model.trend.points.length === 0 || model.summary.trustedClosedCount === 0 ? (
            <p className={styles.empty}>当前范围暂无可绘制的已平仓回合。</p>
          ) : (
            <div className={styles.chartFrame}>
              <svg role="img" aria-label="累计盈亏趋势图" viewBox="0 0 640 190" preserveAspectRatio="none">
                <line x1="0" x2="640" y1={zeroY} y2={zeroY} className={styles.zeroLine} />
                {chartSeries.map((series, index) => {
                  const point = pointCoordinate(series.points, 640, 180, trendDomain);
                  return <g key={series.key}>
                    <path d={linePath(series.points, 640, 180, trendDomain)} fill="none" stroke={lineColor(index)} strokeWidth="3" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                    {point && <circle cx={point.x} cy={point.y} r="4" fill={lineColor(index)} />}
                  </g>;
                })}
              </svg>
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
            {(["month", "year", "all-years"] as const).map(value => <button type="button" key={value} aria-pressed={level === value} onClick={() => changeLevel(value)}>{value === "month" ? "月" : value === "year" ? "年" : "全部年份"}</button>)}
          </div>
          {level !== "all-years" && <div className={styles.calendarNav}>
            <button type="button" aria-label={level === "year" ? "上一年" : "上一个月"} onClick={() => level === "year" ? moveYear(-1) : movePeriod(-1)}>‹</button>
            <span>{model.range.startDate} 至 {model.range.endDate}</span>
            <button type="button" aria-label={level === "year" ? "下一年" : "下一个月"} disabled={nextDisabled} onClick={() => level === "year" ? moveYear(1) : movePeriod(1)}>›</button>
          </div>}
          <div className={`${styles.calendarGrid} ${isDailyCalendar ? styles.dailyGrid : styles.periodGrid}`}>
            {model.cells.map(cell => <button type="button" key={cell.key} className={`${styles.cell} ${styles[`state-${cell.state}`]}`} aria-label={`${cell.label}，${cellLabel(cell)}`} disabled={cell.state === "future"} onClick={() => selectCell(cell)}>
              <strong>{cell.label}</strong>
              <span>{cellLabel(cell)}</span>
              <small>{cell.trustedClosedCount ? `${cell.trustedClosedCount} 回合` : cell.excludedCount ? `${cell.excludedCount} 待核对` : ""}</small>
            </button>)}
          </div>
          {selectedKey && <section className={styles.detail} aria-label="日历日期详情">
            <div className={styles.detailHeading}><strong>{selectedKey}</strong><span>{details.length} 个回合</span></div>
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
