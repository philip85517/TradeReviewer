"use client";

import Decimal from "decimal.js";
import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import type { HomepageHistoryChartMode } from "../../lib/reviews/homepage-v25-state";
import type { HomepageV25Metric } from "../../lib/reviews/homepage-v25-performance";
import "./history-chart.css";

export type HistoryMoneyMetric = Readonly<Omit<HomepageV25Metric, "coverage" | "reasons" | "money"> & {
  coverage: Readonly<HomepageV25Metric["coverage"]>; reasons: readonly string[];
  money: Readonly<Omit<HomepageV25Metric["money"], "fx"> & {
    fx: Readonly<NonNullable<HomepageV25Metric["money"]["fx"]>> | null;
  }>;
}>;
export type HistoryScalarMetric = Readonly<{ value: string | null; available: boolean; reasons: readonly string[] }>;
export type HistoryChartPoint = Readonly<{
  key: string; label: string; start: string; end: string;
  state: "value" | "no-rounds" | "source-missing" | "future" | "loading" | "error";
  reasons: readonly string[]; periodNet: HistoryMoneyMetric; cumulativeNet: HistoryMoneyMetric;
  roundCount: HistoryScalarMetric; winningRounds: HistoryScalarMetric; winRate: HistoryScalarMetric;
}>;
export type HistoryChartData = Readonly<{
  sourceId: string; requestGeneration: string; grain: "month" | "year";
  range: Readonly<{ label: string; start: string; end: string; timeZone: string }>;
  points: readonly HistoryChartPoint[];
}>;
export type HistoryChartReadState = Readonly<{ kind: "ready" }> | Readonly<{ kind: "pending" | "error" | "empty"; reason: string }>;
export type HistoryChartProps = Readonly<{
  data: HistoryChartData | null; mode: HomepageHistoryChartMode; reportCurrency: string; readState: HistoryChartReadState;
}>;

const NumberValue = Decimal.clone({ precision: 100, rounding: Decimal.ROUND_HALF_UP });
const MODES: readonly HomepageHistoryChartMode[] = ["period-pnl", "cumulative-pnl", "win-rate", "round-count"];
const EMPTY_POINTS: readonly HistoryChartPoint[] = [];
const STATE_LABEL = { value: "已有读数", "no-rounds": "该期间无已关闭回合", "source-missing": "数据缺失", future: "尚未到达或未覆盖", loading: "正在读取该期间", error: "该期间读取失败" } as const;
type Read = { source: HistoryMoneyMetric | HistoryScalarMetric; number: Decimal | null; text: string; reasons: readonly string[] };
type Axis = { low: Decimal; high: Decimal; ticks: readonly Decimal[] };
type Selection = { key: string; data: HistoryChartData; mode: HomepageHistoryChartMode; currency: string };
const hidesFacts = (point: HistoryChartPoint) => point.state === "future" || point.state === "loading" || point.state === "error";

function title(mode: HomepageHistoryChartMode, grain: HistoryChartData["grain"] | undefined) {
  return mode === "period-pnl" ? grain === "year" ? "每年净盈亏" : "每月净盈亏"
    : mode === "cumulative-pnl" ? "累计净盈亏" : mode === "win-rate" ? "各期胜率" : "各期回合数";
}
function unit(mode: HomepageHistoryChartMode, currency: string) { return mode === "win-rate" ? "%" : mode === "round-count" ? "回合" : currency; }
function source(point: HistoryChartPoint, mode: HomepageHistoryChartMode) {
  return mode === "period-pnl" ? point.periodNet : mode === "cumulative-pnl" ? point.cumulativeNet : mode === "win-rate" ? point.winRate : point.roundCount;
}
// Presentation validation only; financial qualification, aggregation and conversion belong to the caller.
function read(point: HistoryChartPoint, mode: HomepageHistoryChartMode, currency: string): Read {
  const field = source(point, mode);
  const money = mode === "period-pnl" ? point.periodNet : mode === "cumulative-pnl" ? point.cumulativeNet : null;
  const mismatch = money !== null && money.money.targetCurrency !== currency;
  const blocked = hidesFacts(point) || point.state === "no-rounds" && mode !== "cumulative-pnl";
  let number: Decimal | null = null;
  let invalid: string | null = null;
  if (!blocked && !mismatch && field.available && field.value !== null) {
    try {
      const parsed = new NumberValue(field.value);
      if (!parsed.isFinite()) invalid = "读数格式无效";
      else if (mode === "win-rate" && (parsed.lt(0) || parsed.gt(100))) invalid = "胜率必须在0%至100%之间";
      else if (mode === "round-count" && (!parsed.isInteger() || parsed.lt(0))) invalid = "回合数必须是非负整数";
      else number = parsed;
    } catch { invalid = "读数格式无效"; }
  }
  const reasons = [...point.reasons, ...field.reasons, ...(point.state !== "value" ? [STATE_LABEL[point.state]] : []),
    ...(mismatch ? ["币种与报表不一致"] : []), ...(invalid ? [invalid] : []),
    ...(!blocked && !mismatch && !invalid && number === null && !field.reasons.length ? ["该字段尚无可用读数"] : [])];
  return { source: field, number, text: number !== null ? `${field.value}${mode === "win-rate" ? "%" : ` ${unit(mode, currency)}`}` : "—", reasons: [...new Set(reasons)] };
}
function compact(value: Decimal) {
  if (value.isZero()) return "0";
  const divisor = value.abs().gte(100_000_000) ? 100_000_000 : value.abs().gte(10_000) ? 10_000 : 1;
  const shown = value.div(divisor);
  const text = shown.abs().gte(1e8) ? shown.toExponential(2) : divisor > 1 ? shown.toFixed(2)
    : shown.isInteger() ? shown.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",") : shown.toSignificantDigits(6).toString();
  return text + (divisor === 100_000_000 ? "亿" : divisor === 10_000 ? "万" : "");
}
function axisFor(values: readonly (Decimal | null)[], mode: HomepageHistoryChartMode): Axis {
  if (mode === "win-rate") return { low: new NumberValue(0), high: new NumberValue(100), ticks: [0, 25, 50, 75, 100].map(n => new NumberValue(n)) };
  const actual = values.filter((value): value is Decimal => value !== null);
  const min = NumberValue.min(0, ...actual); const max = NumberValue.max(0, ...actual);
  if (mode === "round-count") {
    const step = NumberValue.max(1, max.div(4).ceil());
    return { low: new NumberValue(0), high: step.mul(4), ticks: [0, 1, 2, 3, 4].map(n => step.mul(n)) };
  }
  const span = max.minus(min);
  const rough = span.isZero() ? new NumberValue(1) : span.div(4);
  const magnitude = new NumberValue(10).pow(rough.e);
  const fraction = rough.div(magnitude);
  const step = magnitude.mul(fraction.lte(1) ? 1 : fraction.lte(2) ? 2 : fraction.lte(5) ? 5 : 10);
  const low = min.div(step).floor().mul(step); let high = max.div(step).ceil().mul(step);
  if (high.eq(low)) high = low.plus(step.mul(4));
  const ticks: Decimal[] = [];
  for (let tick = low; tick.lte(high) && ticks.length < 9; tick = tick.plus(step)) ticks.push(tick);
  return { low, high, ticks };
}
function tickText(value: Decimal, mode: HomepageHistoryChartMode) {
  return mode === "win-rate" ? `${value.toFixed(0)}%` : mode === "round-count"
    ? value.abs().gte(1e9) ? value.toExponential(3).replace(/\.?0+e/, "e") : value.toFixed(0) : compact(value);
}

function MoneyFacts({ label, metric }: { label: string; metric: HistoryMoneyMetric }) {
  return <section className="hp-history-chart__money-facts" aria-label={label}><h4>{label}</h4><dl>
    <dt>来源金额</dt><dd>{metric.value ?? "—"} {metric.money.targetCurrency ?? "币种未知"}</dd>
    <dt>覆盖数量</dt><dd>{metric.coverage.available} / {metric.coverage.total}</dd>
    <dt>原币金额</dt><dd>{Object.entries(metric.money.originalByCurrency).map(([currency, value]) => <span key={currency}>{value} {currency}</span>)}</dd>
    <dt>汇率来源</dt><dd>{metric.money.fx ? <>{metric.money.fx.source}<span>{metric.money.fx.asOf} · {metric.money.fx.id} · {metric.money.fx.status}</span></>
      : metric.money.conversion === "same-currency" ? "同币种，无需换汇" : "未提供汇率来源"}</dd>
  </dl>{metric.reasons.length > 0 && <p>{metric.reasons.join("；")}</p>}</section>;
}
function ScalarFact({ label, metric, rate = false }: { label: string; metric: HistoryScalarMetric; rate?: boolean }) {
  let text = "—"; let invalid: string | null = null;
  if (metric.available && metric.value !== null) {
    try {
      const number = new NumberValue(metric.value);
      if (!number.isFinite()) invalid = "读数格式无效";
      else if (rate ? number.lt(0) || number.gt(100) : !number.isInteger() || number.lt(0)) invalid = rate ? "胜率必须在0%至100%之间" : `${label}必须是非负整数`;
      else text = metric.value + (rate ? "%" : "");
    } catch { invalid = "读数格式无效"; }
  }
  const reasons = [...new Set([...metric.reasons, ...(invalid ? [invalid] : []),
    ...(text === "—" && !invalid && !metric.reasons.length ? ["该字段尚无可用读数"] : [])])];
  return <><dt>{label}</dt><dd>{text}{reasons.map(reason => <p key={reason}>{reason}</p>)}</dd></>;
}

/** Draws only caller-committed facts. No IO, financial projection, cumulative calculation or source-value cache. */
export function HistoryChart({ data, mode, reportCurrency, readState }: HistoryChartProps) {
  const id = useId();
  const card = useRef<HTMLDivElement>(null);
  const surface = useRef<HTMLElement>(null);
  const hasCommitted = useRef(false);
  const hits = useRef(new Map<string, SVGGElement>());
  const labelNodes = useRef(new Map<string, SVGTextElement>());
  const [width, setWidth] = useState(1328);
  const [staggerLabels, setStaggerLabels] = useState(false);
  const [labelIndices, setLabelIndices] = useState<readonly number[] | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const valid = selection && selection.data === data && selection.mode === mode && selection.currency === reportCurrency && readState.kind !== "empty";
  if (selection && !valid) setSelection(null);
  const active = valid ? data?.points.find(point => point.key === selection.key) : undefined;
  const periods = data?.points ?? EMPTY_POINTS;
  // Empty ranges may retain caller period metadata, never their financial facts or hit targets.
  const points = readState.kind === "empty" ? EMPTY_POINTS : periods;
  const allAxes = MODES.map(candidate => axisFor(points.map(point => read(point, candidate, reportCurrency).number), candidate));
  const axis = allAxes[MODES.indexOf(mode)];
  const labelExtent = Math.max(0, ...allAxes.flatMap((candidate, index) => candidate.ticks.map(tick => tickText(tick, MODES[index]).length * 6.5 + 22)));
  const left = Math.max(84, labelExtent); const right = width - 16;
  const x = (index: number) => periods.length <= 1 ? (left + right) / 2 : left + (right - left) * index / (periods.length - 1);
  const y = (value: Decimal) => 276 - value.minus(axis.low).div(axis.high.minus(axis.low)).mul(200).toNumber();
  const readings = points.map(point => read(point, mode, reportCurrency));
  const segments: string[][] = []; let segment: string[] = [];
  readings.forEach((reading, index) => { if (reading.number === null) { if (segment.length) segments.push(segment); segment = []; }
    else segment.push(`${x(index)},${y(reading.number)}`); });
  if (segment.length) segments.push(segment);
  const open = (key: string) => { if (data) setSelection({ key, data, mode, currency: reportCurrency }); };
  const close = () => setSelection(null);
  const activeIndex = active ? points.indexOf(active) : -1;
  const cellLeft = (index: number) => index === 0 ? left - 6 : (x(index - 1) + x(index)) / 2;
  const cellRight = (index: number) => index === points.length - 1 ? right + 6 : (x(index) + x(index + 1)) / 2;
  const hasOldData = points.length > 0;
  const statusTone = readState.kind === "pending" ? hasOldData ? "updating" : "loading" : readState.kind;
  function keyDown(event: KeyboardEvent<SVGGElement>, index: number) {
    if (event.key === "Escape") { event.preventDefault(); close(); return; }
    const next = event.key === "Home" ? 0 : event.key === "End" ? points.length - 1 : event.key === "ArrowLeft" ? Math.max(0, index - 1) : event.key === "ArrowRight" ? Math.min(points.length - 1, index + 1) : null;
    if (next !== null) { event.preventDefault(); hits.current.get(points[next].key)?.focus(); }
  }
  useLayoutEffect(() => {
    const resize = () => { const next = card.current?.getBoundingClientRect().width; if (next && next > 0) setWidth(next); };
    resize(); const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(resize);
    if (card.current) observer?.observe(card.current);
    window.addEventListener("resize", resize); return () => { observer?.disconnect(); window.removeEventListener("resize", resize); };
  }, []);
  useLayoutEffect(() => {
    // All labels remain measurable. Only annual visual ticks still crowded on two rows may be thinned.
    const widths = periods.map(point => {
      const measured = labelNodes.current.get(point.key)?.getComputedTextLength?.();
      return measured && measured > 0 ? measured : [...point.label].reduce((total, char) => total + (/[^\u0000-\u00ff]/u.test(char) ? 11 : 6.5), 0);
    });
    const all = periods.map((_, index) => index);
    const spacing = (right - left) / Math.max(1, periods.length - 1);
    const fits = (indices: readonly number[], rows: number) => {
      const previous: (number | undefined)[] = [];
      return indices.every((index, ordinal) => {
        const row = ordinal % rows; const before = previous[row]; previous[row] = index;
        return before === undefined || (index - before) * spacing >= (widths[before] + widths[index]) / 2 + 4;
      });
    };
    const stagger = !fits(all, 1);
    let selected: readonly number[] | null = null;
    if (stagger && data?.grain === "year" && !fits(all, 2)) {
      // Smallest fixed index stride, always including the last year; its final interval may be shorter.
      for (let stride = 2; stride < periods.length; stride++) {
        const candidate = all.filter(index => index % stride === 0 || index === periods.length - 1);
        if (fits(candidate, 2)) { selected = candidate; break; }
      }
    }
    setStaggerLabels(stagger); setLabelIndices(selected);
  }, [periods, width, left, right, data?.grain]);
  useLayoutEffect(() => {
    if (!hasCommitted.current) { hasCommitted.current = true; return; }
    const element = surface.current;
    const preference = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!element?.animate || preference?.matches) return;
    // One committed surface fades atomically. No path/number interpolation or saved financial snapshot.
    const animation = element.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150, easing: "ease-out" });
    const changed = () => { if (preference?.matches) animation.cancel(); };
    preference?.addEventListener("change", changed);
    return () => { animation.cancel(); preference?.removeEventListener("change", changed); };
  }, [data, mode, reportCurrency]);

  return <section className="hp-history-chart" ref={surface} aria-labelledby={`${id}-title`}>
    <div className="hp-history-chart__card" ref={card} data-testid="hp-history-card" data-height="320">
      <header className="hp-history-chart__header"><h3 id={`${id}-title`}>{title(mode, data?.grain)}</h3><span>{unit(mode, reportCurrency)}</span></header>
      <svg className="hp-history-chart__svg" viewBox={`0 0 ${width} 320`} data-label-rows={staggerLabels ? 2 : 1} role="group" aria-label={`${title(mode, data?.grain)}，${data?.range.label ?? "尚无已提交范围"}`}
        aria-describedby={readState.kind === "empty" && periods.length ? `${id}-periods` : undefined}>
        {readState.kind === "empty" && periods.length > 0 && <desc id={`${id}-periods`}>期间：{periods.map(point => point.label).join("、")}</desc>}
        <g data-testid="hp-history-plot" data-bounds={`${left},66,${right},276`}>
          {readState.kind === "empty" && <rect data-testid="hp-history-empty-region" data-state="empty" className="hp-history-chart__region hp-history-chart__region--empty"
            x={left} y="66" width={right - left} height="210" aria-hidden="true" pointerEvents="none" />}
          {points.map((point, index) => point.state !== "value" && <rect key={point.key} data-testid={`hp-history-region-${point.key}`} data-state={point.state} className={`hp-history-chart__region hp-history-chart__region--${point.state}`}
            x={index === 0 ? left : (x(index - 1) + x(index)) / 2} y="66"
            width={(index === points.length - 1 ? right : (x(index) + x(index + 1)) / 2) - (index === 0 ? left : (x(index - 1) + x(index)) / 2)} height="210" />)}
          {axis.ticks.map(tick => <g key={tick.toString()}><line data-testid={tick.isZero() ? "hp-history-zero-line" : undefined} className={`hp-history-chart__grid${tick.isZero() ? " hp-history-chart__grid--zero" : ""}`} x1={left} x2={right} y1={y(tick)} y2={y(tick)} />
            <text data-testid="hp-history-y-tick" className="hp-history-chart__tick" x={left - 14} y={y(tick) + 4} textAnchor="end">{tickText(tick, mode)}</text></g>)}
          {segments.map((pointsString, index) => <polyline key={index} data-testid="hp-history-segment" className="hp-history-chart__line" points={pointsString.join(" ")} />)}
          {readings.map((reading, index) => reading.number !== null && <circle key={points[index].key} data-testid={`hp-history-point-${points[index].key}`} className={`hp-history-chart__point${activeIndex === index ? " hp-history-chart__point--active" : ""}`} cx={x(index)} cy={y(reading.number)} r="3" />)}
          {active && <line data-testid="hp-history-crosshair" className="hp-history-chart__crosshair" x1={x(activeIndex)} x2={x(activeIndex)} y1="66" y2="276" />}
          {points.map((point, index) => <g key={point.key} ref={element => { if (element) hits.current.set(point.key, element); else hits.current.delete(point.key); }}
            data-testid={`hp-history-hit-${point.key}`} role="button" tabIndex={0} aria-label={`${point.label}，${readings[index].text}，${readings[index].reasons.join("；")}`}
            aria-describedby={active?.key === point.key ? `${id}-reading` : undefined} className="hp-history-chart__hit"
            onMouseEnter={() => open(point.key)} onMouseLeave={close} onFocus={() => open(point.key)} onBlur={close} onKeyDown={event => keyDown(event, index)}>
            <rect x={cellLeft(index)} y="66" width={cellRight(index) - cellLeft(index)} height="210" />
          </g>)}
        </g>
        {periods.map((point, index) => {
          const ordinal = labelIndices === null ? index : labelIndices.indexOf(index);
          return <text key={point.key} ref={element => { if (element) labelNodes.current.set(point.key, element); else labelNodes.current.delete(point.key); }}
            visibility={ordinal < 0 ? "hidden" : undefined} aria-hidden={ordinal < 0 ? true : undefined}
            className="hp-history-chart__tick" x={x(index)} y={staggerLabels && ordinal % 2 === 0 ? 298 : 312} textAnchor="middle">{point.label}</text>;
        })}
      </svg>
      {!points.length && <p role="status" data-tone={statusTone} className={`hp-history-chart__empty hp-history-chart__status--${statusTone}`}>{readState.kind === "ready" ? "所选范围无已平仓回合" : readState.reason}</p>}
      {hasOldData && readState.kind !== "ready" && <p role="status" title={readState.reason} aria-label={readState.reason} data-tone={statusTone} className={`hp-history-chart__status hp-history-chart__status--${statusTone}`}>{readState.reason}</p>}
    </div>
    {active && data && <div id={`${id}-reading`} role="tooltip" className="hp-history-chart__reading">
      <h4>{active.label} · {data.grain === "month" ? "月度" : "年度"}读数</h4>
      <p>{active.start} — {active.end} · {data.range.timeZone}</p>
      <strong data-testid="hp-history-primary-reading">{read(active, mode, reportCurrency).text}</strong>
      {read(active, mode, reportCurrency).reasons.map(reason => <p key={reason}>{reason}</p>)}
      {!hidesFacts(active) && <><MoneyFacts label="每期净盈亏" metric={active.periodNet} /><MoneyFacts label="累计净盈亏" metric={active.cumulativeNet} />
      <dl><ScalarFact label="回合数" metric={active.roundCount} /><ScalarFact label="盈利回合数" metric={active.winningRounds} />
        <ScalarFact label="各期胜率" metric={active.winRate} rate /></dl></>}
    </div>}
  </section>;
}
