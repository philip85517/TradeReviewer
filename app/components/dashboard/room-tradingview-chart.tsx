"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { IChartApi, ISeriesApi, MouseEventParams, Time } from "lightweight-charts";
import type { TradingRoomTrendPoint } from "../../lib/reviews/trading-room-calendar";
import styles from "./room-tradingview-chart.module.css";

type Props = { points: readonly TradingRoomTrendPoint[]; currencies: readonly string[]; aggregate: boolean; level?: "day" | "week" | "month" };
type PositionedAmount = { currency: string; index: number; value: number; x: number; y: number; width: number };
const COLORS: Record<string, string> = { CNY: "#4b97ff", USD: "#f0ad55", HKD: "#ae8ce8", JPY: "#56b8a6", EUR: "#dc8298" };
const FALLBACK_COLORS = ["#4b97ff", "#f0ad55", "#ae8ce8", "#56b8a6", "#dc8298"];
function colorFor(currency: string): string {
  return COLORS[currency] ?? FALLBACK_COLORS[Array.from(currency).reduce((hash, char) => hash + char.charCodeAt(0), 0) % FALLBACK_COLORS.length];
}
function numeric(point: TradingRoomTrendPoint, currency: string, aggregate: boolean, cumulative = true): number | null {
  const view = cumulative ? point.money : point.periodMoney;
  const raw = aggregate ? view.convertedCny : view.originalByCurrency[currency];
  if (raw === undefined || raw === null) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}
function format(value: number | null, currency: string): string {
  if (value === null) return "不可用";
  try { return new Intl.NumberFormat("zh-CN", { style: "currency", currency, maximumFractionDigits: 2, signDisplay: "always" }).format(value); }
  catch { return `${value.toFixed(2)} ${currency}`; }
}
function tone(value: number | null): string { return value === null ? styles.unavailable : value > 0 ? styles.positive : value < 0 ? styles.negative : styles.zero; }
function dateForTime(time: Time): string {
  if (typeof time === "string") return time;
  if (typeof time === "number") return new Date(time * 1000).toISOString().slice(0, 10);
  return `${time.year}-${String(time.month).padStart(2, "0")}-${String(time.day).padStart(2, "0")}`;
}
function chartDate(point: TradingRoomTrendPoint): string { return point.endDate.length === 7 ? `${point.endDate}-01` : point.endDate; }

export function RoomTradingViewChart({ points, currencies, aggregate, level = "month" }: Props) {
  const chartHostRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<Array<{ currency: string; series: ISeriesApi<"Line"> }>>([]);
  const refreshOverlayRef = useRef<(() => void) | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [selection, setSelection] = useState<{ source: typeof points; index: number } | null>(null);
  const [overlay, setOverlay] = useState<{ source: typeof points; positions: PositionedAmount[] } | null>(null);
  const seriesCurrencies = useMemo(() => aggregate ? ["CNY"] : [...currencies], [aggregate, currencies]);
  const selectedIndex = selection?.source === points ? selection.index : points.length - 1;
  const selected = points[selectedIndex];

  useEffect(() => {
    const container = chartHostRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;
    let disposed = false;
    let observer: ResizeObserver | undefined;
    let chart: IChartApi | undefined;
    let frame: number | undefined;
    void import("lightweight-charts").then(({ ColorType, CrosshairMode, LineSeries, createChart }) => {
      if (disposed) return;
      chart = createChart(container, {
        autoSize: false, width: Math.max(1, container.clientWidth), height: Math.max(1, container.clientHeight),
        layout: { background: { type: ColorType.Solid, color: "#101722" }, textColor: "#a6b2c4", fontSize: 13, attributionLogo: true },
        grid: { vertLines: { color: "#1d2735" }, horzLines: { color: "#1d2735" } },
        crosshair: { mode: CrosshairMode.Normal, vertLine: { color: "#758499", labelBackgroundColor: "#34445e" }, horzLine: { color: "#758499", labelBackgroundColor: "#34445e" } },
        rightPriceScale: { borderColor: "#2a3546", scaleMargins: { top: 0.12, bottom: 0.12 } },
        // Keep a report's full period visible; wheel/touch should scroll the page.
        handleScale: false, handleScroll: false,
        timeScale: { borderColor: "#2a3546", rightOffset: 0.5, minBarSpacing: 0.01, tickMarkFormatter: (time: Time) => level === "month" ? dateForTime(time).slice(0, 7) : dateForTime(time).slice(5) },
        localization: { locale: "zh-CN", timeFormatter: (time: Time) => dateForTime(time), priceFormatter: (price: number) => new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2, signDisplay: "always" }).format(price) },
      });
      const activeChart = chart;
      const activeSeries = seriesCurrencies.map(currency => {
        const series = activeChart.addSeries(LineSeries, { color: colorFor(currency), lineWidth: 2, priceLineVisible: false, lastValueVisible: true, crosshairMarkerVisible: true, crosshairMarkerRadius: 3, title: currency });
        series.setData(points.map(point => { const value = numeric(point, currency, aggregate); return value === null ? { time: chartDate(point) } : { time: chartDate(point), value }; }));
        return { currency, series };
      });
      chartRef.current = activeChart;
      seriesRef.current = activeSeries;
      const selectTime = (param: MouseEventParams<Time>) => {
        if (!param.time) return;
        const index = points.findIndex(point => chartDate(point) === dateForTime(param.time!));
        if (index >= 0) setSelection({ source: points, index });
      };
      const refresh = () => {
        if (frame !== undefined) cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          if (disposed) return;
          const plotWidth = activeChart.timeScale().width();
          const plotHeight = Math.max(1, container.clientHeight - 30);
          const placed: PositionedAmount[] = [];
          // Latest values get first choice, then older points; never overlay the axis.
          for (let index = points.length - 1; index >= 0; index--) {
            for (const { currency, series } of activeSeries) {
              const value = numeric(points[index], currency, aggregate);
              const x = activeChart.timeScale().timeToCoordinate(chartDate(points[index]));
              const y = value === null ? null : series.priceToCoordinate(value);
              if (value === null || x === null || y === null || x < 0 || x > plotWidth) continue;
              const width = format(value, currency).length * 7.5 + 12;
              if (width > plotWidth) continue;
              const center = Math.max(width / 2 + 2, Math.min(plotWidth - width / 2 - 2, x));
              for (const offset of [-18, 18, -38, 38]) {
                const top = y + offset;
                if (top < 12 || top > plotHeight - 12 || placed.some(other => Math.abs(other.x - center) < (other.width + width) / 2 + 6 && Math.abs(other.y - top) < 24)) continue;
                placed.push({ currency, index, value, x: center, y: top, width });
                break;
              }
            }
          }
          setOverlay({ source: points, positions: placed });
        });
      };
      refreshOverlayRef.current = refresh;
      activeChart.subscribeCrosshairMove(selectTime);
      activeChart.subscribeClick(selectTime);
      activeChart.timeScale().subscribeVisibleLogicalRangeChange(refresh);
      observer = new ResizeObserver(() => { activeChart.applyOptions({ width: Math.max(1, container.clientWidth), height: Math.max(1, container.clientHeight) }); activeChart.timeScale().fitContent(); refresh(); });
      observer.observe(container);
      activeChart.timeScale().fitContent();
      refresh();
    });
    return () => {
      disposed = true;
      if (frame !== undefined) cancelAnimationFrame(frame);
      observer?.disconnect(); chart?.remove(); chartRef.current = null; seriesRef.current = []; refreshOverlayRef.current = null;
    };
  }, [aggregate, level, points, seriesCurrencies]);

  const overlayPositions = overlay?.source === points ? overlay.positions : [];
  return <div className={styles.root} data-chart-library="lightweight-charts">
    <div className={styles.toolbar}>
      <div className={styles.legend} aria-label="趋势币种图例">{selected && <strong className={styles.legendDate}>{selected.label}</strong>}{seriesCurrencies.map(currency => <span key={currency}><i style={{ backgroundColor: colorFor(currency) }} />{currency}{selected && <strong className={tone(numeric(selected, currency, aggregate))}>{format(numeric(selected, currency, aggregate), currency)}</strong>}</span>)}</div>
      <label className={styles.toggle}><input type="checkbox" checked={showAll} onChange={event => { setShowAll(event.target.checked); refreshOverlayRef.current?.(); }} />显示全部金额</label>
    </div>
    <div className={styles.stage} onKeyDown={event => {
      if (!points.length || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === "Home" ? 0 : event.key === "End" ? points.length - 1 : Math.max(0, Math.min(points.length - 1, selectedIndex + (event.key === "ArrowLeft" ? -1 : 1)));
      setSelection({ source: points, index: next });
      const item = seriesRef.current.find(({ currency }) => numeric(points[next], currency, aggregate) !== null);
      if (item) chartRef.current?.setCrosshairPosition(numeric(points[next], item.currency, aggregate)!, chartDate(points[next]), item.series);
    }} tabIndex={0} role="group" aria-label="累计盈亏趋势图" title="左右键选择日期，Home和End跳到首末点">
      <div className={styles.chart} ref={chartHostRef} />
      {showAll && <div className={styles.overlay} aria-label="全部金额标注">{overlayPositions.map(item => <span key={`${item.currency}-${item.index}`} className={`${styles.overlayLabel} ${tone(item.value)}`} style={{ left: item.x, top: item.y }}>{format(item.value, item.currency)}</span>)}</div>}
    </div>
    {showAll && <small className={styles.overlayNote}>密集金额自动避让，完整金额可展开“查看趋势数据”。</small>}
    {selected && <div className={styles.selected} role="status" aria-label="趋势点详情" aria-live="polite">
      {seriesCurrencies.map(currency => <div className={styles.currencyDetail} key={currency}><span className={styles.currencyName}>{currency}</span><span className={tone(numeric(selected, currency, aggregate, false))}>本期 {format(numeric(selected, currency, aggregate, false), currency)}</span><span className={tone(numeric(selected, currency, aggregate))}>累计 {format(numeric(selected, currency, aggregate), currency)}</span></div>)}
      <small>{selected.trustedClosedCount} 个可信回合 · {selected.startDate} 至 {selected.endDate}</small>
    </div>}
  </div>;
}
