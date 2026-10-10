"use client";

import Decimal from "decimal.js";
import { useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import {
  sampleHoldingsHistory,
  type HoldingsHistoryGranularity,
  type HoldingsHistoryModel,
  type HoldingsHistoryPoint,
} from "../../lib/reviews/trading-room-history";
import { roomMoneyValue, type RoomDisplayCurrency, type RoomMoneyView } from "../../lib/reviews/trading-room-scope";
import type { RoomMoneySubtotal } from "../../lib/reviews/holdings-money-subtotal";
import {
  chartAxisLabels,
  chartAxisTicks,
  chartX,
  chartMarkerPoints,
  createChartGeometry,
  valueDomain,
} from "./room-performance-chart";
import { currencyPresentation, orderCurrencies } from "./currency-presentation";
import { useObservedChartSize } from "./use-observed-chart-size";
import styles from "./room-holdings-history.module.css";

export type RoomHoldingsHistoryProps = {
  model: HoldingsHistoryModel;
  reportCurrency?: RoomDisplayCurrency;
  /** The shell owns the observation range state; this slot keeps its controls inside the chart card. */
  periodControls?: ReactNode;
  periodLabel?: string;
};
type Metric = "marketValue" | "unrealizedPnl" | "return";
type Selection = { index: number; source: "mouse" | "touch" | "keyboard" | "click"; actualDate: string };
const metricLabels: Record<Metric, string> = {
  marketValue: "总市值",
  unrealizedPnl: "未实现盈亏",
  return: "未实现收益率",
};
const granularityLabels = { day: "日", week: "周", month: "月" };
const targetLabels: Record<Exclude<RoomDisplayCurrency, "original">, string> = { CNY: "人民币", HKD: "港币" };

function numberText(value: string, signed = false): string {
  try {
    const number = new Decimal(value);
    return `${signed && number.gt(0) ? "+" : ""}${number.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
  } catch {
    return "—";
  }
}
function tone(value: string | null) {
  if (value === null || Number(value) === 0) return "";
  return Number(value) > 0 ? styles.gain : styles.loss;
}
function targetValue(money: RoomMoneyView, mode: RoomDisplayCurrency): string | null {
  if (mode === "original") return null;
  if (money.targetCurrency === mode) return roomMoneyValue(money);
  // Legacy CNY fixtures predate targetCurrency; convertedCny remains a valid
  // CNY value. Never treat that legacy field as an HKD conversion.
  if (mode === "CNY" && money.targetCurrency === undefined) return roomMoneyValue(money);
  // A single original amount in the selected target currency is already an
  // exact same-currency value, even when an older model omitted targetCurrency.
  const original = money.originalByCurrency[mode];
  return money.targetCurrency === undefined && Object.keys(money.originalByCurrency).length === 1 && original !== undefined
    ? original
    : null;
}

function targetUnavailableLabel(mode: RoomDisplayCurrency): string {
  return mode === "original" ? "不可用" : `目标 ${mode} 不可用`;
}

function MoneyValue({ money, mode, available, signed = false, subtotal }: {
  money: RoomMoneyView;
  mode: RoomDisplayCurrency;
  available: boolean;
  signed?: boolean;
  subtotal?: RoomMoneySubtotal;
}) {
  const originalValues = Object.entries(money.originalByCurrency);
  const converted = targetValue(money, mode);
  const knownTarget = converted === null && mode !== "original" && subtotal?.currency === mode ? subtotal.value : null;
  const displayAvailable = available && (mode === "original" || !subtotal || subtotal.complete);
  const values = mode === "original"
    ? originalValues
    : converted === null && knownTarget === null ? [] : [[mode, converted ?? knownTarget!] as const];
  const targetUnavailable = mode !== "original" && converted === null;
  return <>
    {!displayAvailable || values.length === 0 ? <span className={styles.unavailable}>{targetUnavailable && knownTarget === null ? targetUnavailableLabel(mode) : "不可用"}</span> : null}
    {values.map(([currency, value]) => <span key={currency} className={signed ? tone(value) : undefined}>
      {currency} {numberText(value, signed)}{!displayAvailable ? "（已知小计）" : ""}
    </span>)}
    {targetUnavailable && originalValues.map(([currency, value]) => <span key={`${currency}-original`} className={styles.originalSubtotal}>
      {currency} {numberText(value, signed)}（原币小计）
    </span>)}
    {mode !== "original" && (targetUnavailable || !available) && <small className={styles.valueNote}>{money.note}</small>}
  </>;
}
function ratioFor(point: HoldingsHistoryPoint, currency: string, mode: RoomDisplayCurrency) {
  // Original-currency returns are independently covered. A different
  // currency's unknown cost/PnL must not hide a trustworthy member set.
  // Converted returns represent the whole target subtotal, so retain the
  // aggregate availability guard for that mode.
  if (mode !== "original" && (!point.costAvailable || !point.unrealizedPnlAvailable)) return null;
  const relevantHoldings = mode === "original" ? point.holdings.filter(h => h.currency === currency) : point.holdings;
  if (relevantHoldings.length === 0 || relevantHoldings.some(h => !holdingMetricAvailable(h, "return"))) return null;
  if (relevantHoldings.some(h => h.quantity !== null && new Decimal(h.quantity).lt(0))) return null;
  if (mode !== "original") return point.unrealizedReturnPercent;
  const pnl = point.unrealizedPnl.originalByCurrency[currency];
  const cost = point.cost.originalByCurrency[currency];
  return pnl !== undefined && cost !== undefined && new Decimal(cost).gt(0)
    ? new Decimal(pnl).div(cost).mul(100).toString()
    : null;
}
function seriesValue(point: HoldingsHistoryPoint, metric: Metric, currency: string, mode: RoomDisplayCurrency) {
  if (metric === "return") return ratioFor(point, currency, mode);
  // Amount series intentionally retain known subtotals when the aggregate
  // point is incomplete; availability gates the complete KPI, not visibility
  // of the covered members.
  if (mode === "original") return point[metric].originalByCurrency[currency] ?? null;
  const candidateSubtotal = point.knownSubtotals?.[metric];
  const subtotal = candidateSubtotal && candidateSubtotal.total === point.holdings.length ? candidateSubtotal : undefined;
  return targetValue(point[metric], mode) ?? (subtotal?.currency === mode ? subtotal.value : null);
}

type CoverageState = "complete" | "partial" | "unknown";
type HistorySeriesPoint = {
  value: string | null;
  state: CoverageState;
  covered: number;
  expected: number;
  members: string;
};

function holdingMetricAvailable(holding: HoldingsHistoryPoint["holdings"][number], metric: Metric): boolean {
  if (metric === "marketValue") return holding.marketValueAvailable;
  if (metric === "unrealizedPnl") return holding.unrealizedPnl !== null;
  // Aggregate return math only needs trustworthy non-negative cost and PnL
  // inputs. A long opened at zero cost has no meaningful individual return,
  // but it still contributes to the aggregate numerator.
  return holding.costAvailable && holding.unrealizedPnl !== null
    && holding.quantity !== null && !new Decimal(holding.quantity).lt(0)
    && holding.cost !== null && new Decimal(holding.cost).gte(0);
}

function coverageFor(point: HoldingsHistoryPoint, metric: Metric, currency: string, mode: RoomDisplayCurrency): HistorySeriesPoint {
  const sourceMembers = point.holdings.filter(holding => holding.currency === currency);
  // A target series represents the complete converted subtotal, so its
  // coverage denominator is the source member set rather than a synthetic
  // CNY/HKD holding that is absent from the ledger.
  const members = mode === "original" || (sourceMembers.length > 0 && !["CNY", "HKD"].includes(currency))
    ? sourceMembers
    : point.holdings;
  const candidateSubtotal = mode === "original" || metric === "return" ? null : point.knownSubtotals?.[metric];
  const subtotal = candidateSubtotal && candidateSubtotal.total === point.holdings.length ? candidateSubtotal : null;
  const covered = subtotal ? subtotal.available : members.filter(holding => holdingMetricAvailable(holding, metric)).length;
  const expected = subtotal ? subtotal.total : members.length;
  const value = seriesValue(point, metric, currency, mode);
  const aggregateAvailable = metric === "marketValue" ? point.marketValueAvailable : metric === "unrealizedPnl" ? point.unrealizedPnlAvailable : point.unrealizedReturnPercent !== null;
  const knownEmptyAggregate = expected === 0 && aggregateAvailable && value !== null && new Decimal(value).eq(0);
  const state: CoverageState = value === null || (expected === 0 && !knownEmptyAggregate) || (expected > 0 && covered === 0)
    ? "unknown"
    : covered >= expected || knownEmptyAggregate ? "complete" : "partial";
  const memberSignature = subtotal
    ? `${members.map(holding => `${holding.key}:${subtotal.memberKeys.includes(holding.key) ? "known" : "missing"}`).sort().join("|")}|${subtotal.available}/${subtotal.total}`
    : members.map(holding => `${holding.key}:${holdingMetricAvailable(holding, metric) ? "known" : "missing"}`).sort().join("|");
  return { value, state, covered, expected, members: memberSignature };
}

function seriesSegments(points: HistorySeriesPoint[], geometry: ReturnType<typeof createChartGeometry>, domain: ReturnType<typeof valueDomain>) {
  const segments: Array<{ state: CoverageState; points: HistorySeriesPoint[]; start: number; end: number; boundary: boolean }> = [];
  let current: typeof segments[number] | null = null;
  points.forEach((point, index) => {
    const previous = points[index - 1];
    const boundary = Boolean(previous && (previous.members !== point.members || previous.state !== point.state));
    if (point.value === null || point.state === "unknown") {
      current = null;
      return;
    }
    if (!current || current.state !== point.state || boundary) {
      current = { state: point.state, points: [], start: index, end: index, boundary };
      segments.push(current);
    }
    current.points.push(point);
    current.end = index;
  });
  return segments.map(segment => ({
    ...segment,
    path: segment.points.map((point, offset) => {
      const index = segment.start + offset;
      const x = chartX(index, points.length, geometry).toFixed(2);
      const y = (geometry.padding.top + geometry.plotHeight - ((Number(point.value) - domain.min) / (domain.max - domain.min || 1)) * geometry.plotHeight).toFixed(2);
      return `${offset === 0 ? "M" : " L"}${x},${y}`;
    }).join(""),
    coordinates: segment.points.map((point, offset) => ({
      index: segment.start + offset,
      x: chartX(segment.start + offset, points.length, geometry),
      y: geometry.padding.top + geometry.plotHeight - ((Number(point.value) - domain.min) / (domain.max - domain.min || 1)) * geometry.plotHeight,
    })),
  }));
}
function axisNumber(value: number) {
  if (Math.abs(value) >= 1e8) return `${(value / 1e8).toFixed(1)}亿`;
  if (Math.abs(value) >= 1e4) return `${(value / 1e4).toFixed(1)}万`;
  return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 1 }).format(value);
}

function History({ model, reportCurrency = "original", periodControls, periodLabel = "持仓历史观察期间" }: RoomHoldingsHistoryProps) {
  const [metric, setMetric] = useState<Metric>("marketValue");
  const [granularity, setGranularity] = useState<HoldingsHistoryGranularity>("day");
  const [chartRef, plotSize] = useObservedChartSize<SVGSVGElement>({ width: 720, height: 220 });
  const geometry = useMemo(() => createChartGeometry({
    width: plotSize.width,
    height: plotSize.height,
    padding: { left: 56, right: 14, top: 14, bottom: 28 },
  }), [plotSize]);
  const touchActive = useRef(false);
  const [selectionInvalidated, setSelectionInvalidated] = useState(false);
  const [committedSelection, setCommittedSelection] = useState<Selection | null>(null);
  const [hoverSelection, setHoverSelection] = useState<Selection | null>(null);
  const [selectedOriginalCurrency, setSelectedOriginalCurrency] = useState<string | null>(null);
  const [previousModel, setPreviousModel] = useState(model);
  const samples = useMemo(() => sampleHoldingsHistory(model, granularity), [model, granularity]);
  const previousSamples = useMemo(() => sampleHoldingsHistory(previousModel, granularity), [previousModel, granularity]);
  const previousOriginalCurrencies = useMemo(() => orderCurrencies(previousSamples.flatMap(sample => {
    const view = metric === "return" ? sample.point.cost : sample.point[metric];
    return [...Object.keys(view.originalByCurrency), ...sample.point.holdings.map(holding => holding.currency)];
  })), [metric, previousSamples]);
  const originalCurrencies = useMemo(() => orderCurrencies(samples.flatMap(sample => {
    const view = metric === "return" ? sample.point.cost : sample.point[metric];
    return [...Object.keys(view.originalByCurrency), ...sample.point.holdings.map(holding => holding.currency)];
  })), [samples, metric]);
  // Reconcile by actual date during immutable status/value updates. The
  // outer component key still clears state for scope and report-currency
  // changes; within one scope a pending recomputation should preserve the
  // date when it remains in the sampled range. If the effective original
  // currency disappears, both the committed table and transient preview
  // must be discarded rather than silently switching to another currency.
  const modelChanged = previousModel !== model;
  const previousActiveOriginalCurrency = selectedOriginalCurrency && previousOriginalCurrencies.includes(selectedOriginalCurrency)
    ? selectedOriginalCurrency
    : previousOriginalCurrencies[0] ?? null;
  const effectiveOriginalCurrencyDisappeared = modelChanged
    && previousActiveOriginalCurrency !== null
    && !originalCurrencies.includes(previousActiveOriginalCurrency);
  if (modelChanged && effectiveOriginalCurrencyDisappeared && !selectionInvalidated) setSelectionInvalidated(true);
  const reconciledSelection = modelChanged
    ? effectiveOriginalCurrencyDisappeared || selectionInvalidated || !committedSelection
      ? null
      : (() => {
        const index = samples.findIndex(sample => sample.actualDate === committedSelection.actualDate);
        return index < 0 ? null : { ...committedSelection, index, actualDate: samples[index].actualDate };
      })()
    : committedSelection;

  if (modelChanged) {
    setPreviousModel(model);
    setCommittedSelection(reconciledSelection);
    setHoverSelection(null);
    if (selectedOriginalCurrency && !originalCurrencies.includes(selectedOriginalCurrency)) {
      setSelectedOriginalCurrency(originalCurrencies[0] ?? null);
    }
  }

  const visibleCommittedSelection = selectionInvalidated ? null : modelChanged ? reconciledSelection : committedSelection;
  const visibleSelection = hoverSelection ?? visibleCommittedSelection;
  const activeOriginalCurrency = selectedOriginalCurrency && originalCurrencies.includes(selectedOriginalCurrency)
    ? selectedOriginalCurrency
    : originalCurrencies[0] ?? null;
  const plot = useMemo(() => {
    const targetAvailable = reportCurrency !== "original" && samples.some(sample => seriesValue(sample.point, metric, reportCurrency, reportCurrency) !== null);
    const fallbackToOriginal = reportCurrency !== "original" && !targetAvailable;
    const seriesMode: RoomDisplayCurrency = fallbackToOriginal ? "original" : reportCurrency;
    const currencies = seriesMode === "original" ? (activeOriginalCurrency ? [activeOriginalCurrency] : []) : [reportCurrency];
    const series = currencies.map(currency => ({
      currency,
      points: samples.map(sample => {
        const coverage = coverageFor(sample.point, metric, currency, seriesMode);
        return {
          ...coverage,
          value: seriesValue(sample.point, metric, currency, seriesMode),
        };
      }),
    }));
    const domain = valueDomain(series.flatMap(series => series.points.map(point => point.value)));
    return {
      currencies,
      originalCurrencies,
      targetUnavailable: fallbackToOriginal,
      domain,
      series: series.map(series => ({
        ...series,
        segments: seriesSegments(series.points, geometry, domain),
        coordinates: seriesSegments(series.points, geometry, domain).flatMap(segment => segment.coordinates),
      })),
      ticks: chartAxisTicks(domain, geometry),
      labels: chartAxisLabels(samples.map(sample => ({ key: sample.periodStart, label: sample.actualDate })), geometry, 3),
    };
  }, [samples, metric, reportCurrency, geometry, activeOriginalCurrency, originalCurrencies]);
  const hasDrawablePoints = plot.series.some(series => series.coordinates.length > 0);
  const active = visibleSelection ? samples[visibleSelection.index] : undefined;
  const selected = active?.point;
  const activeX = visibleSelection ? chartX(visibleSelection.index, samples.length, geometry) : null;
  const selectAt = (clientX: number, element: SVGSVGElement, source: Selection["source"]) => {
    if (!samples.length) return;
    const rect = element.getBoundingClientRect();
    if (!rect.width) return;
    const x = (clientX - rect.left) / rect.width * geometry.width;
    const ratio = Math.min(1, Math.max(0, (x - geometry.padding.left) / geometry.plotWidth));
    const index = Math.round(ratio * Math.max(0, samples.length - 1));
    const actualDate = samples[index]?.actualDate;
    if (!actualDate) return;
    if (source === "mouse") {
      setHoverSelection(previous => previous?.index === index ? previous : { index, source, actualDate });
    } else {
      setSelectionInvalidated(false);
      setHoverSelection(null);
      setCommittedSelection(previous => previous?.index === index && previous.source === source ? previous : { index, source, actualDate });
    }
  };
  const keySelect = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === "Escape") { setSelectionInvalidated(false); setHoverSelection(null); setCommittedSelection(null); return; }
    if (!samples.length || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const index = event.key === "Home" ? 0 : event.key === "End" ? samples.length - 1
      : Math.min(samples.length - 1, Math.max(0, (visibleSelection?.index ?? (event.key === "ArrowLeft" ? samples.length : -1)) + (event.key === "ArrowLeft" ? -1 : 1)));
    setSelectionInvalidated(false);
    setHoverSelection(null);
    setCommittedSelection({ index, source: "keyboard", actualDate: samples[index].actualDate });
  };
  const rateCurrencies = reportCurrency === "original" ? selected ? Object.keys(selected.cost.originalByCurrency) : [] : [reportCurrency];
  const rates = selected ? rateCurrencies.map(currency => ({ currency, value: ratioFor(selected, currency, reportCurrency) })) : [];
  const selectedHasShort = selected?.holdings.some(h => h.quantity !== null && new Decimal(h.quantity).lt(0));
  const selectedMarketCovered = selected?.holdings.filter(holding => holdingMetricAvailable(holding, "marketValue")).length ?? 0;
  const selectedMarketPartial = Boolean(selected && selected.holdings.length > 0 && selectedMarketCovered > 0 && selectedMarketCovered < selected.holdings.length);
  const selectedKnownEmptyMarket = Boolean(selected && selected.holdings.length === 0 && selected.marketValueAvailable
    && Object.values(selected.marketValue.originalByCurrency).some(value => new Decimal(value).eq(0)));
  const selectedMarketSubtotal = Boolean(selected && (!selected.marketValueAvailable || selectedMarketPartial || (selected.holdings.length === 0 && !selectedKnownEmptyMarket)));

  return <section className={styles.panel} aria-label="历史持仓估值">
    <header className={styles.header}>
      <div className={styles.titleBlock}><h3>持仓总览</h3><p>查看历史组合的时点估值与盈亏</p></div>
      <div className={styles.headerControls}>
        <div className={styles.metricControls} role="group" aria-label="持仓曲线指标">
          {(["marketValue", "unrealizedPnl", "return"] as const).map(value => <button type="button" key={value}
            aria-pressed={metric === value} onClick={() => { setSelectionInvalidated(false); setMetric(value); setHoverSelection(null); setCommittedSelection(null); }}>
            {metricLabels[value]}
          </button>)}
        </div>
        {(reportCurrency === "original" || plot.targetUnavailable) && plot.originalCurrencies.length > 1 && <div className={styles.currencyControls} role="group" aria-label="持仓曲线币种">
          {plot.originalCurrencies.map(currency => <button type="button" key={currency}
            aria-pressed={activeOriginalCurrency === currency}
            onClick={() => { setSelectionInvalidated(false); setSelectedOriginalCurrency(currency); setHoverSelection(null); setCommittedSelection(null); }}>
            {currency}
          </button>)}
        </div>}
        {periodControls && <div className={styles.periodSlot} role="group" aria-label={periodLabel}>{periodControls}</div>}
        <div className={styles.controls} role="group" aria-label="持仓曲线粒度">
          {(["day", "week", "month"] as const).map(value => <button type="button" key={value}
            aria-pressed={granularity === value} onClick={() => { setSelectionInvalidated(false); setGranularity(value); setHoverSelection(null); setCommittedSelection(null); }}>
            {granularityLabels[value]}
          </button>)}
        </div>
      </div>
    </header>
    <div className={styles.legend}>
      <span>单位：{metric === "return" ? "%" : plot.targetUnavailable ? `${reportCurrency}不可用 · 原币小计` : reportCurrency === "original" ? plot.currencies.join(" / ") || "原币" : reportCurrency}</span>
      {plot.series.map(series => <span key={series.currency} className={styles.currencyLegend} style={{ color: currencyPresentation(series.currency).color }}>
        <i aria-hidden="true" className={styles.currencyMarker} data-marker={currencyPresentation(series.currency).marker} />{series.currency}{reportCurrency !== "original" && !plot.targetUnavailable ? ` · ${targetLabels[reportCurrency]}` : ""}
      </span>)}
      <span className={styles.coverageLegend}>实线完整 · 虚线部分已知 · 断点表示成员或数据状态变化</span>
    </div>
    <div className={styles.statusSlot} aria-live="polite">
      {model.reasons.length > 0 && <details className={styles.noticeDetails}>
        <summary>数据状态 · {model.reasons.length} 项</summary>
        {model.reasons.map(reason => <p className={styles.note} key={reason}>{reason}</p>)}
      </details>}
    </div>
    <p className={`${styles.emptyCoverage} ${hasDrawablePoints || samples.length === 0 ? styles.emptyCoveragePlaceholder : ""}`} role="status" aria-hidden={hasDrawablePoints || samples.length === 0 ? "true" : undefined}>
      {`${metric === "return" ? "所选期间暂无完整收益率" : "所选期间暂无完整估值"}；可选日期查看已知小计与缺失原因`}
    </p>
    <div className={styles.interaction} role="group" aria-label="持仓曲线交互" tabIndex={0}
      onKeyDown={keySelect} aria-describedby="holdings-chart-help"
      onMouseLeave={() => setHoverSelection(null)}>
      <svg ref={chartRef} viewBox={`0 0 ${geometry.width} ${geometry.height}`} preserveAspectRatio="none"
        role="img" aria-label={`${granularityLabels[granularity]}级持仓${metricLabels[metric]}曲线`}
        className={styles.chart}
        onPointerMove={event => { if (event.pointerType === "mouse") touchActive.current = false; }}
        onMouseMove={event => { if (!touchActive.current) selectAt(event.clientX, event.currentTarget, "mouse"); }}
        onClick={event => selectAt(event.clientX, event.currentTarget, "click")}
        onPointerDown={event => {
          if (event.pointerType === "touch" || event.pointerType === "pen") {
            touchActive.current = true;
            selectAt(event.clientX, event.currentTarget, "touch");
          }
        }}
        onTouchStart={event => { const touch = event.touches[0]; if (touch) { touchActive.current = true; selectAt(touch.clientX, event.currentTarget, "touch"); } }}>
        {hasDrawablePoints && plot.ticks.map(tick => <g key={tick.value}>
          <line x1={geometry.padding.left} x2={geometry.width - geometry.padding.right} y1={tick.y} y2={tick.y} className={styles.gridLine} />
          <text x={geometry.padding.left - 9} y={tick.y + 4} textAnchor="end" className={styles.axisText}>
            {axisNumber(tick.value)}{metric === "return" ? "%" : ""}
          </text>
        </g>)}
        {plot.series.map(series => <g key={series.currency} style={{ color: currencyPresentation(series.currency).color }}>
          {series.segments.map((segment, segmentIndex) => <g key={`${series.currency}-${segmentIndex}`}>
            <path data-history-series={series.currency} data-history-state={segment.state} data-history-covered={segment.points[0]?.covered} data-history-expected={segment.points[0]?.expected}
              d={segment.path} fill="none" stroke="currentColor" strokeWidth="2.4" vectorEffect="non-scaling-stroke"
              strokeDasharray={segment.state === "partial" ? "6 4" : undefined} />
            {segment.coordinates.map(point => {
              const marker = currencyPresentation(series.currency).marker;
              const points = chartMarkerPoints(marker, point.x, point.y, segment.coordinates.length === 1 ? 2.5 : 2.2);
              return points
                ? <polygon key={point.index} data-history-marker={series.currency} data-history-singleton={segment.coordinates.length === 1 ? series.currency : undefined}
                  data-history-boundary={segment.boundary ? series.currency : undefined} points={points} fill="currentColor"
                  stroke={segment.boundary ? "var(--dashboard-card, #111c2d)" : undefined} strokeWidth={segment.boundary ? 1.5 : undefined} />
                : <circle key={point.index} data-history-marker={series.currency} data-history-singleton={segment.coordinates.length === 1 ? series.currency : undefined}
                  data-history-boundary={segment.boundary ? series.currency : undefined} cx={point.x} cy={point.y} r={segment.coordinates.length === 1 ? 2.5 : 2.2} fill="currentColor"
                  stroke={segment.boundary ? "var(--dashboard-card, #111c2d)" : undefined} strokeWidth={segment.boundary ? 1.5 : undefined} />;
            })}
          </g>)}
          {visibleSelection && series.coordinates.filter(point => point.index === visibleSelection.index).map(point => {
            const marker = currencyPresentation(series.currency).marker;
            const points = chartMarkerPoints(marker, point.x, point.y, 5);
            return points
              ? <polygon key={point.index} data-history-highlight={series.currency} points={points} fill="currentColor" stroke="var(--dashboard-card, #111c2d)" strokeWidth="2" />
              : <circle key={point.index} data-history-highlight={series.currency} cx={point.x} cy={point.y} r="5" fill="currentColor" stroke="var(--dashboard-card, #111c2d)" strokeWidth="2" />;
          })}
        </g>)}
        {activeX !== null && <line data-history-crosshair="true" x1={activeX} x2={activeX}
          y1={geometry.padding.top} y2={geometry.height - geometry.padding.bottom} className={styles.crosshair} />}
        {plot.labels.map(label => <text key={label.key} x={label.x} y={geometry.height - 9}
          textAnchor={label.index === 0 && samples.length > 1 ? "start" : label.index === samples.length - 1 && samples.length > 1 ? "end" : "middle"}
          className={styles.axisText}>{label.label}</text>)}
      </svg>
      {selected && active && <div role="tooltip" className={`${styles.tooltip} ${activeX !== null && activeX > geometry.width / 2 ? styles.tooltipLeft : styles.tooltipRight}`}
        data-selection-source={visibleSelection?.source}>
        <div className={styles.tooltipHeader}><time>{active.actualDate}</time>
          <button type="button" aria-label="关闭持仓详情" onClick={() => { setSelectionInvalidated(false); setHoverSelection(null); setCommittedSelection(null); }}>×</button>
        </div>
        <dl>
          <div className={styles.primaryValue}><dt>未实现盈亏</dt><dd>
      <MoneyValue money={selected.unrealizedPnl} mode={reportCurrency} available={selected.unrealizedPnlAvailable} signed subtotal={selected.knownSubtotals?.unrealizedPnl} />
          </dd></div>
          <div><dt>{selectedHasShort ? "持仓净市值" : `总市值${selectedMarketSubtotal ? "（已知小计）" : ""}`}</dt><dd>
            <MoneyValue money={selected.marketValue} mode={reportCurrency} available={selected.marketValueAvailable} subtotal={selected.knownSubtotals?.marketValue} />
          </dd></div>
          <div><dt>未实现盈亏率</dt><dd>{rates.some(rate => rate.value !== null)
            ? rates.map(rate => <span key={rate.currency} className={tone(rate.value)}>{reportCurrency === "CNY" ? "折算口径 " : rates.length > 1 ? `${rate.currency}组 ` : ""}{rate.value === null ? "不可用" : `${numberText(rate.value, true)}%`}</span>)
            : <span>不可用 · {selectedHasShort ? "空头成本分母不支持" : "成本/币种覆盖不足或剩余成本非正"}</span>}</dd></div>
          <div><dt>当日盈亏{granularity !== "day" ? "（估值日当天）" : ""}</dt><dd>
            <MoneyValue money={selected.dailyPnl} mode={reportCurrency} available={selected.dailyPnlAvailable} signed />
          </dd></div>
        </dl>
        {granularity !== "day" && <p>覆盖 {active.periodStart} — {active.periodEnd}{active.partialPeriod ? " · 部分周期" : ""}；实际估值日 {active.actualDate}。当日盈亏不代表整个周期。</p>}
        <details className={styles.tooltipDetails}>
          <summary>覆盖与数据说明</summary>
          <p>数量覆盖 {selected.coverage.quantity}/{selected.coverage.total} · 市值覆盖 {selected.coverage.marketValue}/{selected.coverage.total}</p>
          {selected.reasons.length > 0 && <p>{selected.reasons.join("；")}</p>}
          {plot.series.map(series => {
            const point = series.points[visibleSelection?.index ?? -1];
            const prior = series.points[(visibleSelection?.index ?? -1) - 1];
            const changed = point && prior && point.members !== prior.members;
            return point && point.expected > 0 ? <p key={`coverage-${series.currency}`}>{series.currency} 覆盖 {point.covered}/{point.expected} · {point.state === "partial" ? "部分已知" : point.state === "complete" ? "完整" : "不可用"}{changed ? " · 成员或数据状态已变化，曲线断开" : ""}</p> : null;
          })}
          {selectedMarketSubtotal && <p>总市值为已知持仓小计；缺失成员未纳入。成员或数据状态变化时曲线会断开并标记边界。</p>}
          {!selected.dailyPnlAvailable && <p>{selected.dailyPnlReasons.join("；")}</p>}
          {reportCurrency !== "original" && <p>{selected.marketValue.note}</p>}
          {selected.holdings.length > 0 && <p>行情日期：{[...new Set(selected.holdings.map(h => `${h.instrumentName} ${h.quoteDate ?? "缺价"}`))].join(" · ")}</p>}
        </details>
      </div>}
    </div>
    {samples.length === 0 && <p className={styles.note}>当前期间没有可查看日期</p>}
    <footer className={styles.footer}>
      <p id="holdings-chart-help">查看某日持仓 · 移动查看时点盈亏 · 左右键选点 / Home / End · Esc关闭；触屏可点选并关闭详情。</p>
      {visibleSelection && <button type="button" className={styles.returnCurrent} onClick={() => { setSelectionInvalidated(false); setHoverSelection(null); setCommittedSelection(null); }}>返回当前持仓</button>}
      <label>历史持仓日期<select aria-label="历史持仓日期" value={active?.actualDate ?? ""}
        onChange={event => {
          const index = samples.findIndex(sample => sample.actualDate === event.target.value);
          setSelectionInvalidated(false);
          setHoverSelection(null);
          setCommittedSelection(index < 0 ? null : { index, source: "keyboard", actualDate: samples[index].actualDate });
        }}>
        <option value="">选择日期查看</option>
        {samples.map(sample => <option value={sample.actualDate} key={sample.periodStart}>
          {sample.actualDate}{sample.point.available ? "" : " · 数据不完整"}
        </option>)}
      </select></label>
    </footer>
    <details className={styles.methodDetails}>
      <summary>估值与缺口说明</summary>
      <p className={styles.note}>按当时持仓及原始日线估值；休市沿用最近有效价，缺少应有交易日行情保留断点。{reportCurrency === "original" ? "原币分别显示，不合并跨币种金额。" : `${targetLabels[reportCurrency]}使用同一汇率快照；缺失时保留原币小计。`}</p>
    </details>
    {visibleCommittedSelection && (() => {
      const committedPoint = samples[visibleCommittedSelection.index]?.point;
      const committedSample = samples[visibleCommittedSelection.index];
      if (!committedPoint || !committedSample) return null;
      return <details className={styles.details} open>
      <summary>{committedSample.actualDate} 持仓明细</summary>
      {committedPoint.holdings.length ? <div className={styles.table}><table>
        <thead><tr><th>标的 / 账户</th><th>数量</th><th>市值</th><th>未实现盈亏</th><th>价格日期 / 说明</th></tr></thead>
        <tbody>{committedPoint.holdings.map(holding => <tr key={holding.key}>
          <td>{holding.instrumentName} / {holding.accountId}</td><td>{holding.quantity ?? "—"}</td>
          <td>{holding.currency} {holding.marketValue === null ? "—" : numberText(holding.marketValue)}</td>
          <td className={tone(holding.unrealizedPnl)}>{holding.currency} {holding.unrealizedPnl === null ? "—" : numberText(holding.unrealizedPnl, true)}</td>
          <td>{holding.quoteDate ?? "缺价"}{holding.reasons.length > 0 ? ` · ${holding.reasons.join("；")}` : ""}</td>
        </tr>)}</tbody>
      </table></div> : <p>当日无持仓；请同时查看证据覆盖状态。</p>}
    </details>;
    })()}
  </section>;
}

export function RoomHoldingsHistory(props: RoomHoldingsHistoryProps) {
  const scopeIdentity = JSON.stringify(props.model.scope, (key, value) => key === "period" ? undefined : value);
  return <History key={JSON.stringify([scopeIdentity, props.model.fxSnapshotId, props.reportCurrency])} {...props} />;
}
