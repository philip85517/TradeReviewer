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
import {
  chartAxisLabels,
  chartAxisTicks,
  chartLinePath,
  chartPointCoordinates,
  chartX,
  createChartGeometry,
  valueDomain,
} from "./room-performance-chart";
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
type Selection = { index: number; source: "mouse" | "touch" | "keyboard" };
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

function MoneyValue({ money, mode, available, signed = false }: {
  money: RoomMoneyView;
  mode: RoomDisplayCurrency;
  available: boolean;
  signed?: boolean;
}) {
  const originalValues = Object.entries(money.originalByCurrency);
  const converted = targetValue(money, mode);
  const values = mode === "original"
    ? originalValues
    : converted === null ? [] : [[mode, converted] as const];
  const targetUnavailable = mode !== "original" && converted === null;
  return <>
    {!available || values.length === 0 ? <span className={styles.unavailable}>{targetUnavailable ? targetUnavailableLabel(mode) : "不可用"}</span> : null}
    {values.map(([currency, value]) => <span key={currency} className={signed ? tone(value) : undefined}>
      {currency} {numberText(value, signed)}{!available ? "（已知小计）" : ""}
    </span>)}
    {targetUnavailable && originalValues.map(([currency, value]) => <span key={`${currency}-original`} className={styles.originalSubtotal}>
      {currency} {numberText(value, signed)}（原币小计）
    </span>)}
    {mode !== "original" && (targetUnavailable || !available) && <small className={styles.valueNote}>{money.note}</small>}
  </>;
}
function ratioFor(point: HoldingsHistoryPoint, currency: string, mode: RoomDisplayCurrency) {
  if (!point.costAvailable || !point.unrealizedPnlAvailable) return null;
  if (point.holdings.some(h => h.currency === currency && h.quantity !== null && new Decimal(h.quantity).lt(0))) return null;
  if (mode !== "original") return point.unrealizedReturnPercent;
  const pnl = point.unrealizedPnl.originalByCurrency[currency];
  const cost = point.cost.originalByCurrency[currency];
  return pnl !== undefined && cost !== undefined && new Decimal(cost).gt(0)
    ? new Decimal(pnl).div(cost).mul(100).toString()
    : null;
}
function seriesValue(point: HoldingsHistoryPoint, metric: Metric, currency: string, mode: RoomDisplayCurrency) {
  if (metric === "return") return ratioFor(point, currency, mode);
  if (metric === "marketValue" ? !point.marketValueAvailable : !point.unrealizedPnlAvailable) return null;
  return mode === "original" ? point[metric].originalByCurrency[currency] ?? null : targetValue(point[metric], mode);
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
  const [selection, setSelection] = useState<Selection | null>(null);
  const [previousModel, setPreviousModel] = useState(model);
  // Discard selection during the same render that receives a new immutable
  // model. No stale point is painted while waiting for an effect.
  if (previousModel !== model) {
    setPreviousModel(model);
    setSelection(null);
  }
  const samples = useMemo(() => sampleHoldingsHistory(model, granularity), [model, granularity]);
  const plot = useMemo(() => {
    const originalCurrencies = [...new Set(samples.flatMap(sample => {
      const view = metric === "return" ? sample.point.cost : sample.point[metric];
      return Object.keys(view.originalByCurrency);
    }))];
    const targetAvailable = reportCurrency !== "original" && samples.some(sample => seriesValue(sample.point, metric, reportCurrency, reportCurrency) !== null);
    const fallbackToOriginal = reportCurrency !== "original" && !targetAvailable;
    const seriesMode: RoomDisplayCurrency = fallbackToOriginal ? "original" : reportCurrency;
    const currencies = seriesMode === "original" ? originalCurrencies : [reportCurrency];
    const series = currencies.map(currency => ({
      currency,
      points: samples.map(sample => ({ value: seriesValue(sample.point, metric, currency, seriesMode) })),
    }));
    const domain = valueDomain(series.flatMap(series => series.points.map(point => point.value)));
    return {
      currencies,
      targetUnavailable: fallbackToOriginal,
      domain,
      series: series.map(series => ({
        ...series,
        path: chartLinePath(series.points, geometry, domain),
        coordinates: chartPointCoordinates(series.points, geometry, domain),
      })),
      ticks: chartAxisTicks(domain, geometry),
      labels: chartAxisLabels(samples.map(sample => ({ key: sample.periodStart, label: sample.actualDate })), geometry, 3),
    };
  }, [samples, metric, reportCurrency, geometry]);
  const hasDrawablePoints = plot.series.some(series => series.coordinates.length > 0);
  const active = selection ? samples[selection.index] : undefined;
  const selected = active?.point;
  const activeX = selection ? chartX(selection.index, samples.length, geometry) : null;
  const selectAt = (clientX: number, element: SVGSVGElement, source: Selection["source"]) => {
    if (!samples.length) return;
    const rect = element.getBoundingClientRect();
    if (!rect.width) return;
    const x = (clientX - rect.left) / rect.width * geometry.width;
    const ratio = Math.min(1, Math.max(0, (x - geometry.padding.left) / geometry.plotWidth));
    const index = Math.round(ratio * Math.max(0, samples.length - 1));
    setSelection(previous => previous?.index === index && previous.source === source ? previous : { index, source });
  };
  const keySelect = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === "Escape") { setSelection(null); return; }
    if (!samples.length || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const index = event.key === "Home" ? 0 : event.key === "End" ? samples.length - 1
      : Math.min(samples.length - 1, Math.max(0, (selection?.index ?? (event.key === "ArrowLeft" ? samples.length : -1)) + (event.key === "ArrowLeft" ? -1 : 1)));
    setSelection({ index, source: "keyboard" });
  };
  const rateCurrencies = reportCurrency === "original" ? selected ? Object.keys(selected.cost.originalByCurrency) : [] : [reportCurrency];
  const rates = selected ? rateCurrencies.map(currency => ({ currency, value: ratioFor(selected, currency, reportCurrency) })) : [];
  const selectedHasShort = selected?.holdings.some(h => h.quantity !== null && new Decimal(h.quantity).lt(0));

  return <section className={styles.panel} aria-label="历史持仓估值">
    <header className={styles.header}>
      <div className={styles.titleBlock}><h3>持仓总览</h3><p>查看历史组合的时点估值与盈亏</p></div>
      <div className={styles.headerControls}>
        <div className={styles.metricControls} role="group" aria-label="持仓曲线指标">
          {(["marketValue", "unrealizedPnl", "return"] as const).map(value => <button type="button" key={value}
            aria-pressed={metric === value} onClick={() => { setMetric(value); setSelection(null); }}>
            {metricLabels[value]}
          </button>)}
        </div>
        {periodControls && <div className={styles.periodSlot} role="group" aria-label={periodLabel}>{periodControls}</div>}
        <div className={styles.controls} role="group" aria-label="持仓曲线粒度">
          {(["day", "week", "month"] as const).map(value => <button type="button" key={value}
            aria-pressed={granularity === value} onClick={() => { setGranularity(value); setSelection(null); }}>
            {granularityLabels[value]}
          </button>)}
        </div>
      </div>
    </header>
    <div className={styles.legend}>
      <span>单位：{metric === "return" ? "%" : plot.targetUnavailable ? `${reportCurrency}不可用 · 原币小计` : reportCurrency === "original" ? plot.currencies.join(" / ") || "原币" : reportCurrency}</span>
      {plot.series.map((series, index) => <span key={series.currency} className={index % 2 ? styles.secondary : styles.primary}>
        <i aria-hidden="true" />{series.currency}{reportCurrency !== "original" && !plot.targetUnavailable ? ` · ${targetLabels[reportCurrency]}` : ""}
      </span>)}
    </div>
    {model.reasons.length > 0 && <details className={styles.noticeDetails}>
      <summary>数据状态 · {model.reasons.length} 项</summary>
      {model.reasons.map(reason => <p className={styles.note} key={reason}>{reason}</p>)}
    </details>}
    {!hasDrawablePoints && samples.length > 0 && <p className={styles.emptyCoverage} role="status">
      {metric === "return" ? "所选期间暂无完整收益率" : "所选期间暂无完整估值"}；可选日期查看已知小计与缺失原因
    </p>}
    <div className={styles.interaction} role="group" aria-label="持仓曲线交互" tabIndex={0}
      onKeyDown={keySelect} aria-describedby="holdings-chart-help"
      onMouseLeave={() => setSelection(previous => previous?.source === "mouse" ? null : previous)}>
      <svg ref={chartRef} viewBox={`0 0 ${geometry.width} ${geometry.height}`} preserveAspectRatio="none"
        role="img" aria-label={`${granularityLabels[granularity]}级持仓${metricLabels[metric]}曲线`}
        className={styles.chart}
        onPointerMove={event => { if (event.pointerType === "mouse") touchActive.current = false; }}
        onMouseMove={event => { if (!touchActive.current) selectAt(event.clientX, event.currentTarget, "mouse"); }}
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
        {plot.series.map((series, seriesIndex) => <g key={series.currency} className={seriesIndex % 2 ? styles.secondary : styles.primary}>
          <path data-history-series={series.currency} d={series.path} fill="none" stroke="currentColor" strokeWidth="2.4" vectorEffect="non-scaling-stroke" />
          {series.coordinates.length === 1 && <circle cx={series.coordinates[0].x} cy={series.coordinates[0].y} r="2.5" fill="currentColor" />}
          {selection && series.coordinates.filter(point => point.index === selection.index).map(point => <circle key={point.index}
            data-history-highlight={series.currency} cx={point.x} cy={point.y} r="5" fill="currentColor" stroke="var(--dashboard-card, #111c2d)" strokeWidth="2" />)}
        </g>)}
        {activeX !== null && <line data-history-crosshair="true" x1={activeX} x2={activeX}
          y1={geometry.padding.top} y2={geometry.height - geometry.padding.bottom} className={styles.crosshair} />}
        {plot.labels.map(label => <text key={label.key} x={label.x} y={geometry.height - 9}
          textAnchor={label.index === 0 && samples.length > 1 ? "start" : label.index === samples.length - 1 && samples.length > 1 ? "end" : "middle"}
          className={styles.axisText}>{label.label}</text>)}
      </svg>
      {selected && active && <div role="tooltip" className={`${styles.tooltip} ${activeX !== null && activeX > geometry.width / 2 ? styles.tooltipLeft : styles.tooltipRight}`}
        data-selection-source={selection?.source}>
        <div className={styles.tooltipHeader}><time>{active.actualDate}</time>
          <button type="button" aria-label="关闭持仓详情" onClick={() => setSelection(null)}>×</button>
        </div>
        <dl>
          <div className={styles.primaryValue}><dt>未实现盈亏</dt><dd>
            <MoneyValue money={selected.unrealizedPnl} mode={reportCurrency} available={selected.unrealizedPnlAvailable} signed />
          </dd></div>
          <div><dt>{selectedHasShort ? "持仓净市值" : "总市值"}</dt><dd>
            <MoneyValue money={selected.marketValue} mode={reportCurrency} available={selected.marketValueAvailable} />
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
          {!selected.dailyPnlAvailable && <p>{selected.dailyPnlReasons.join("；")}</p>}
          {reportCurrency !== "original" && <p>{selected.marketValue.note}</p>}
          {selected.holdings.length > 0 && <p>行情日期：{[...new Set(selected.holdings.map(h => `${h.instrumentName} ${h.quoteDate ?? "缺价"}`))].join(" · ")}</p>}
        </details>
      </div>}
    </div>
    {samples.length === 0 && <p className={styles.note}>当前期间没有可查看日期</p>}
    <footer className={styles.footer}>
      <p id="holdings-chart-help">移动查看时点盈亏 · 左右键选点 / Home / End · Esc关闭；触屏可点选并关闭详情。</p>
      <label>历史持仓日期<select aria-label="历史持仓日期" value={active?.actualDate ?? ""}
        onChange={event => {
          const index = samples.findIndex(sample => sample.actualDate === event.target.value);
          setSelection(index < 0 ? null : { index, source: "keyboard" });
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
    {selected && selection?.source !== "mouse" && <details className={styles.details}>
      <summary>{active?.actualDate} 持仓明细</summary>
      {selected.holdings.length ? <div className={styles.table}><table>
        <thead><tr><th>标的 / 账户</th><th>数量</th><th>市值</th><th>未实现盈亏</th><th>价格日期 / 说明</th></tr></thead>
        <tbody>{selected.holdings.map(holding => <tr key={holding.key}>
          <td>{holding.instrumentName} / {holding.accountId}</td><td>{holding.quantity ?? "—"}</td>
          <td>{holding.currency} {holding.marketValue === null ? "—" : numberText(holding.marketValue)}</td>
          <td className={tone(holding.unrealizedPnl)}>{holding.currency} {holding.unrealizedPnl === null ? "—" : numberText(holding.unrealizedPnl, true)}</td>
          <td>{holding.quoteDate ?? "缺价"}{holding.reasons.length > 0 ? ` · ${holding.reasons.join("；")}` : ""}</td>
        </tr>)}</tbody>
      </table></div> : <p>当日无持仓；请同时查看证据覆盖状态。</p>}
    </details>}
  </section>;
}

export function RoomHoldingsHistory(props: RoomHoldingsHistoryProps) {
  return <History key={JSON.stringify([props.model.scope, props.reportCurrency])} {...props} />;
}
