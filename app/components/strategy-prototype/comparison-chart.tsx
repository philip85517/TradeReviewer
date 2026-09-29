"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { SYMBOL_IDS, type PortfolioId, type SymbolId } from "./running-model";
import type { ResultAnalysis, ResultPoint } from "./results-model";
import "./comparison-chart.css";

export type ComparisonChartMode = "net-value" | "drawdown" | "allocation";

export type ComparisonChartSeries = {
  id: PortfolioId;
  name: string;
  analysis: ResultAnalysis;
  color: string;
  dash: string;
};

type ComparisonChartProps = {
  series: ComparisonChartSeries[];
  mode: ComparisonChartMode;
  currentDate: string;
  empty: boolean;
};

type ChartSize = { width: number; height: number };
type WeightKey = "cash" | SymbolId;

const INITIAL_SIZE: ChartSize = { width: 1000, height: 360 };
const EMPTY_POINTS: ResultPoint[] = [];
const CASH_COLOR = "#72849b";
const SYMBOL_COLORS: Record<SymbolId, string> = {
  A: "#55a4e8",
  B: "#be9bf2",
  C: "#76c5aa",
  D: "#dfa957",
};

function isoDateValue(date: string): number {
  const datePart = date.slice(0, 10);
  const value = Date.parse(`${datePart}T00:00:00Z`);
  return Number.isFinite(value) ? value : 0;
}

function compactDate(date: string): string {
  return date.length >= 10 ? date.slice(0, 10) : date || "—";
}

function finiteValues(points: ResultPoint[], selector: (point: ResultPoint) => number): number[] {
  return points.map(selector).filter(Number.isFinite);
}

function netValueText(value: number | null | undefined): string {
  return value === null || value === undefined || !Number.isFinite(value) ? "不可用" : value.toFixed(4);
}

function drawdownText(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "不可用";
  const magnitude = `${Math.abs(value * 100).toFixed(2)}%`;
  return value < 0 ? `−${magnitude}` : magnitude;
}

function percentText(value: number | null | undefined): string {
  return value === null || value === undefined || !Number.isFinite(value)
    ? "不可用"
    : `${(value * 100).toFixed(1)}%`;
}

function chartTitle(mode: ComparisonChartMode): string {
  return mode === "net-value" ? "组合净值曲线"
    : mode === "drawdown" ? "组合回撤曲线"
      : "所选组合的实际仓位历史";
}

function axisText(value: number, mode: ComparisonChartMode): string {
  if (mode === "net-value") return value.toFixed(4);
  const amount = `${Math.abs(value * 100).toFixed(1)}%`;
  if (mode === "drawdown" && value < 0) return `−${amount}`;
  return amount;
}

function weightName(key: WeightKey): string {
  return key === "cash" ? "现金" : `合成股票 ${key}`;
}

function pointWeight(point: ResultPoint, key: WeightKey): number {
  const value = key === "cash" ? point.cashWeight : point.symbolWeights[key];
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

function weightColor(key: WeightKey): string {
  return key === "cash" ? CASH_COLOR : SYMBOL_COLORS[key];
}

function adjustedDomain(values: number[], mode: ComparisonChartMode): { min: number; max: number } {
  if (mode === "drawdown") {
    const minimum = values.length ? Math.min(0, ...values) : 0;
    const span = Math.abs(minimum);
    return { min: minimum - Math.max(span * 0.12, 0.004), max: 0 };
  }

  let min = values.length ? Math.min(1, ...values) : 1;
  let max = values.length ? Math.max(1, ...values) : 1;
  const span = max - min;
  const padding = Math.max(span * 0.12, 0.001);
  min -= padding;
  max += padding;
  return { min, max };
}

export function ComparisonChart({ series, mode, currentDate, empty }: ComparisonChartProps) {
  const svgId = useId();
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState(INITIAL_SIZE);
  const visibleSeries = useMemo(() => mode === "allocation" ? series.slice(0, 1) : series, [mode, series]);
  const isEmpty = empty || visibleSeries.length === 0 || visibleSeries.every(item => !item.analysis.hasAnalyzablePeriod);
  const allocationAnalysis = visibleSeries[0]?.analysis;
  const allocationPoints = allocationAnalysis?.points ?? EMPTY_POINTS;
  const activeSymbols = useMemo(
    () => SYMBOL_IDS.filter(symbol => allocationPoints.some(point => pointWeight(point, symbol) > 0)),
    [allocationPoints],
  );
  const allocationKeys = useMemo<WeightKey[]>(() => ["cash", ...activeSymbols], [activeSymbols]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const measure = () => {
      const rect = svg.getBoundingClientRect();
      const next = { width: Math.max(1, Math.round(rect.width)), height: Math.max(1, Math.round(rect.height)) };
      setSize(previous => previous.width === next.width && previous.height === next.height ? previous : next);
    };

    measure();
    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(measure);
      observer.observe(svg);
      return () => observer.disconnect();
    }
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const chart = useMemo(() => {
    const margin = {
      left: 76,
      right: mode === "allocation" ? 18 : 96,
      top: mode === "allocation" ? 31 : 19,
      bottom: mode === "allocation" ? 57 : 34,
    };
    const plotWidth = Math.max(1, size.width - margin.left - margin.right);
    const plotHeight = Math.max(1, size.height - margin.top - margin.bottom);
    const allPoints = visibleSeries.flatMap(item => item.analysis.points);
    const dateNumbers = allPoints.map(point => isoDateValue(point.date));
    const minDate = dateNumbers.length ? Math.min(...dateNumbers) : 0;
    const maxDate = dateNumbers.length ? Math.max(...dateNumbers) : minDate;
    const xAt = (date: string) => maxDate === minDate
      ? margin.left + plotWidth / 2
      : margin.left + (isoDateValue(date) - minDate) / (maxDate - minDate) * plotWidth;
    const allValues = visibleSeries.flatMap(item => finiteValues(
      item.analysis.points,
      point => mode === "net-value" ? point.netValue : point.drawdown,
    ));
    const domain = mode === "allocation" ? { min: 0, max: 1 } : adjustedDomain(allValues, mode);
    const yAt = (value: number) => margin.top + ((domain.max - value) / (domain.max - domain.min)) * plotHeight;
    const tickCount = 4;
    const ticks = Array.from({ length: tickCount + 1 }, (_, index) => {
      const fraction = index / tickCount;
      const value = domain.max - fraction * (domain.max - domain.min);
      return { value, y: margin.top + fraction * plotHeight };
    });
    const linePaths = visibleSeries.map(item => {
      const points = item.analysis.points.filter(point => Number.isFinite(
        mode === "net-value" ? point.netValue : point.drawdown,
      ));
      const path = points.map((point, index) => {
        const value = mode === "net-value" ? point.netValue : point.drawdown;
        return `${index === 0 ? "M" : "L"}${xAt(point.date).toFixed(2)},${yAt(value).toFixed(2)}`;
      }).join(" ");
      const lastPoint = points.at(-1) ?? null;
      return { item, path, lastPoint };
    });
    const allocationPaths: { key: WeightKey; path: string }[] = [];
    if (mode === "allocation" && allocationPoints.length > 0) {
      const lower = Array<number>(allocationPoints.length).fill(0);
      for (const key of allocationKeys) {
        const upper = allocationPoints.map((point, index) => lower[index] + pointWeight(point, key));
        const topPath = allocationPoints.map((point, index) => `${index === 0 ? "M" : "L"}${xAt(point.date).toFixed(2)},${yAt(upper[index]).toFixed(2)}`).join(" ");
        const bottomPath = allocationPoints.slice().reverse().map((point, reverseIndex) => {
          const index = allocationPoints.length - 1 - reverseIndex;
          return `L${xAt(point.date).toFixed(2)},${yAt(lower[index]).toFixed(2)}`;
        }).join(" ");
        allocationPaths.push({ key, path: `${topPath} ${bottomPath} Z` });
        for (let index = 0; index < lower.length; index += 1) lower[index] = upper[index];
      }
    }
    const endLabels = linePaths.flatMap(({ item, lastPoint }) => {
      if (!lastPoint) return [];
      const value = mode === "net-value" ? lastPoint.netValue : lastPoint.drawdown;
      return [{
        item,
        point: lastPoint,
        value,
        text: mode === "net-value" ? netValueText(value) : drawdownText(value),
        y: yAt(value),
      }];
    }).sort((left, right) => left.y - right.y);
    const labelGap = 17;
    const minimumLabelY = margin.top + 8;
    const maximumLabelY = margin.top + plotHeight - 3;
    for (const label of endLabels) {
      label.y = Math.max(minimumLabelY, Math.min(maximumLabelY, label.y));
    }
    for (let index = 1; index < endLabels.length; index += 1) {
      endLabels[index].y = Math.max(endLabels[index].y, endLabels[index - 1].y + labelGap);
    }
    if (endLabels.length > 0) {
      const lastIndex = endLabels.length - 1;
      const overflow = Math.max(0, endLabels[lastIndex].y - maximumLabelY);
      if (overflow > 0) for (const label of endLabels) label.y -= overflow;
      const underflow = Math.max(0, minimumLabelY - endLabels[0].y);
      if (underflow > 0) for (const label of endLabels) label.y += underflow;
    }
    const baseline = mode === "net-value" ? 1 : mode === "drawdown" ? 0 : null;
    return { margin, plotWidth, plotHeight, ticks, xAt, yAt, linePaths, endLabels, allocationPaths, baseline };
  }, [allocationKeys, allocationPoints, mode, size.height, size.width, visibleSeries]);

  const lastAllocationPoint = allocationPoints.at(-1);
  const axisLabelId = `${svgId}-title`;
  const descriptionId = `${svgId}-description`;
  const labelDate = visibleSeries
    .map(item => item.analysis.startDate ?? item.analysis.points[0]?.date)
    .filter((date): date is string => Boolean(date))
    .sort()[0] ?? currentDate;
  const emptyText = mode === "allocation"
    ? "T0 尚无可分析区间，不绘制仓位历史。"
    : "只有 T0 净值起点 1.0000，尚无多日走势。";

  return (
    <figure className={`comparison-viz comparison-viz-${mode}`} aria-label={chartTitle(mode)}>
      <div className="comparison-viz-frame">
        <svg
          ref={svgRef}
          className="comparison-viz-svg"
          viewBox={`0 0 ${size.width} ${size.height}`}
          role="img"
          aria-labelledby={axisLabelId}
          aria-describedby={descriptionId}
          preserveAspectRatio="none"
        >
          <title id={axisLabelId}>{chartTitle(mode)} · 截止 {compactDate(currentDate)}</title>
          <desc id={descriptionId}>{mode === "allocation"
            ? `按实际日期显示${visibleSeries[0]?.name ?? "所选组合"}的现金与标的仓位占比。`
            : `按实际日期显示${visibleSeries.map(item => item.name).join("、")}的${mode === "net-value" ? "净值" : "回撤"}；截止读数为${chart.endLabels.map(label => `${label.item.name} ${label.text}`).join("、")}；不显示结果截止之后的数据。`}</desc>
          {chart.ticks.map((tick, index) => <g key={index}>
            <line className="comparison-viz-guide" x1={chart.margin.left} x2={size.width - chart.margin.right} y1={tick.y} y2={tick.y} />
            <text className="comparison-viz-axis-label" x={chart.margin.left - 10} y={tick.y + 4} textAnchor="end">{axisText(tick.value, mode)}</text>
          </g>)}
          {chart.baseline !== null && <line
            className="comparison-viz-zero-line"
            x1={chart.margin.left}
            x2={size.width - chart.margin.right}
            y1={chart.yAt(chart.baseline)}
            y2={chart.yAt(chart.baseline)}
          />}
          {!isEmpty && mode !== "allocation" && chart.linePaths.map(({ item, path, lastPoint }) => path && <g key={item.id}>
            <path className="comparison-viz-line" d={path} stroke={item.color} strokeDasharray={item.dash || undefined} />
            {lastPoint && <circle className="comparison-viz-point" cx={chart.xAt(lastPoint.date)} cy={chart.yAt(mode === "net-value" ? lastPoint.netValue : lastPoint.drawdown)} r="3.5" stroke={item.color} />}
          </g>)}
          {!isEmpty && mode !== "allocation" && chart.endLabels.map(({ item, point, text, y }) => {
            const pointValue = mode === "net-value" ? point.netValue : point.drawdown;
            const pointY = chart.yAt(pointValue);
            const labelX = size.width - chart.margin.right + 10;
            return <g key={`${item.id}-readout`}>
              <line className="comparison-viz-readout-leader" x1={chart.xAt(point.date) + 4} x2={labelX - 5} y1={pointY} y2={y} stroke={item.color} />
              <text className="comparison-viz-endvalue" x={labelX} y={y + 4} fill={item.color}>
                <title>{item.name} · {mode === "net-value" ? "净值" : "回撤"} {text}</title>{text}
              </text>
            </g>;
          })}
          {!isEmpty && mode === "allocation" && chart.allocationPaths.map(({ key, path }) => <path
            key={key}
            className="comparison-viz-area"
            d={path}
            fill={weightColor(key)}
            stroke={weightColor(key)}
          />)}
          {isEmpty && <text className="comparison-viz-empty-label" x={chart.margin.left + chart.plotWidth / 2} y={chart.margin.top + chart.plotHeight / 2 - 6} textAnchor="middle">暂无可分析区间</text>}
          {isEmpty && <text className="comparison-viz-empty-copy" x={chart.margin.left + chart.plotWidth / 2} y={chart.margin.top + chart.plotHeight / 2 + 15} textAnchor="middle">{emptyText}</text>}
          {mode === "allocation" && <text className="comparison-viz-selected-name" x={chart.margin.left} y="18">当前组合 · {visibleSeries[0]?.name ?? "未选择组合"}</text>}
          <text className="comparison-viz-date-label" x={chart.margin.left} y={size.height - (mode === "allocation" ? 40 : 9)} textAnchor="start">{compactDate(labelDate)}</text>
          <text className="comparison-viz-date-label" x={size.width - chart.margin.right} y={size.height - (mode === "allocation" ? 40 : 9)} textAnchor="end">结果截至 R · {compactDate(currentDate)}</text>
          {!isEmpty && mode === "allocation" && allocationKeys.map((key, index) => {
            const columnWidth = chart.plotWidth / allocationKeys.length;
            const x = chart.margin.left + index * columnWidth + 2;
            return <g key={`${key}-allocation-readout`}>
              <rect className="comparison-viz-allocation-key" x={x} y={size.height - 23} width="8" height="8" fill={weightColor(key)} />
              <text className="comparison-viz-allocation-label" x={x + 13} y={size.height - 14}>
                {weightName(key)} {percentText(lastAllocationPoint ? pointWeight(lastAllocationPoint, key) : null)}
              </text>
            </g>;
          })}
          {isEmpty && mode === "allocation" && <text className="comparison-viz-empty-copy" x={chart.margin.left} y={size.height - 14}>暂无仓位历史</text>}
        </svg>
      </div>
    </figure>
  );
}
