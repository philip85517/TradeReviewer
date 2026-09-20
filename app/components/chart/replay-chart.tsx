"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type {
  IChartApi,
  IPriceLine,
  ISeriesApi,
  Logical,
  Time,
  TickMarkType,
} from "lightweight-charts";

import type {
  DrawingTool,
  NormalizedDrawing,
} from "../../lib/chart/drawings";
import type { DrawingCommand } from "../../lib/chart/drawing-commands";
import type { StatementEvent } from "../../lib/import/monthly-statement";
import type { Candle, Timeframe } from "../../lib/market/types";
import {
  formatBeijingDateTime,
  formatBeijingUnixSeconds,
} from "../../lib/replay/format-time";
import type { ChartSettings } from "../../lib/storage/chart-settings";
import { displayTimeForCandle } from "../../lib/replay/display-time";
import { textLayout } from "../../lib/chart/text-geometry";
import type { TradeExecution } from "../../lib/trades/types";
import {
  groupExecutionsByCandle,
} from "../../lib/replay/execution-markers";
import type {
  ReviewChartLocateRequest,
  ReviewChartLocateResult,
} from "../../lib/replay/chart-location";
import { resolveExecutionChartLocation } from "../../lib/replay/chart-location";
import { episodeViewport, type EpisodeViewport } from "../../lib/reviews/episode-viewport";
import {
  DrawingCanvas,
  type ChartCoordinateAdapter,
  type DrawingCanvasHandle,
} from "./drawing-canvas";

export type ChartViewport = {
  version: 1;
  logicalRange: { from: number; to: number } | null;
  barSpacing: number;
  rightOffset: number;
  width: number;
  height: number;
};

export type ChartCapture = {
  imageDataUrl: string;
  viewport: ChartViewport;
  /** Present when visible text/drawings touch the capture boundary. */
  warnings?: string[];
};

export type ChartHandle = {
  capture: () => Promise<ChartCapture>;
  /** Resolve after pending chart invalidations have been drawn synchronously. */
  flush: () => Promise<void>;
  getViewport: () => ChartViewport;
  restoreViewport: (viewport: ChartViewport) => void;
  fitAll: () => void;
};

type Props = {
  candles: Candle[];
  executions: TradeExecution[];
  positionEvents?: StatementEvent[];
  cursor: string;
  averageCost: number;
  drawings: NormalizedDrawing[];
  activeTool: DrawingTool;
  settings: ChartSettings;
  episodeId: string;
  timeframe?: Timeframe;
  viewportKey?: string;
  focusRange?: EpisodeViewport;
  locateRequest?: ReviewChartLocateRequest;
  onLocateResult?: (result: ReviewChartLocateResult) => void;
  onLocateTimeframeChange?: (timeframe: Timeframe) => void;
  onReady?: (handle: ChartHandle | null) => void;
  selectedDrawingId: string | null;
  plannedRiskAmount: string | undefined;
  currency: string;
  onSelectDrawing: (id: string | null) => void;
  onCommand: (command: DrawingCommand) => void;
};

const EMPTY_POSITION_EVENTS: StatementEvent[] = [];

type CrosshairCandle = Pick<
  Candle,
  "time" | "open" | "high" | "low" | "close"
>;

function chartTime(time: string) {
  const milliseconds = Date.parse(time);
  return Number.isFinite(milliseconds)
    ? Math.floor(milliseconds / 1000) as Time
    : null;
}

type ChartCandleData = {
  time: Time;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type ReplayChartMarker = {
  time: Time;
  position: "belowBar" | "aboveBar";
  color: string;
  shape: "arrowUp" | "arrowDown";
  text: string;
  /** Source fills represented by this visual marker. */
  executionIds?: string[];
  fillCount?: number;
  side?: TradeExecution["side"];
};

function validCandles(candles: readonly Candle[]): Candle[] {
  return candles
    .filter((candle) => {
      const time = chartTime(candle.time);
      return time !== null &&
        [candle.open, candle.high, candle.low, candle.close, candle.volume].every(Number.isFinite);
    })
    .sort((left, right) => Number(chartTime(left.time)) - Number(chartTime(right.time)))
    .filter((candle, index, sorted) =>
      index === 0 || chartTime(candle.time) !== chartTime(sorted[index - 1].time),
    );
}

function chartCandleData(candles: readonly Candle[]): ChartCandleData[] {
  return validCandles(candles).flatMap((candle) => {
    const time = chartTime(candle.time);
    if (time === null) return [];
    return [{
      time,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume,
    }];
  });
}

function candleDataSignature(candles: readonly Candle[]) {
  return chartCandleData(candles)
    .map((candle) => [
      candle.time,
      candle.open,
      candle.high,
      candle.low,
      candle.close,
      candle.volume,
    ].join(","))
    .join("|");
}

function candleMappingSignature(candles: readonly Candle[]) {
  return candles
    .map((candle) => [
      candle.time,
      candle.knowledgeAt ?? "",
      candle.tradingDates?.join(",") ?? "",
    ].join(","))
    .join("|");
}

function executionMarkerSignature(executions: readonly TradeExecution[]) {
  return executions
    .map((execution) => [
      execution.id,
      execution.side,
      execution.executedAt,
      execution.quantity,
      execution.price,
      execution.accountId,
      execution.source.tradeNature ?? execution.source.tradingNature ?? "unknown",
      execution.source.simulationRunId ?? "",
      execution.source.marketCalendarDate ?? execution.source.tradingDate ?? "",
      execution.source.timePrecision ?? "",
    ].join(","))
    .join("|");
}

function positionEventSignature(positionEvents: readonly StatementEvent[]) {
  return positionEvents
    .map((event) => [event.id, event.kind, event.date, event.quantity ?? "", event.displayTimePolicy ?? ""].join(","))
    .join("|");
}

type VisibleTimeRange = { from: Time; to: Time };

function numericChartTime(time: Time) {
  if (typeof time === "number") return time;
  if (typeof time === "string") {
    const parsed = Date.parse(time);
    return Number.isFinite(parsed) ? Math.floor(parsed / 1000) : null;
  }
  return Date.UTC(time.year, time.month - 1, time.day) / 1000;
}

function nearestCandleIndex(candles: readonly ChartCandleData[], target: Time) {
  const timestamp = numericChartTime(target);
  if (timestamp === null || candles.length === 0) return null;
  let nearest = 0;
  let distance = Math.abs(Number(candles[0].time) - timestamp);
  for (let index = 1; index < candles.length; index += 1) {
    const nextDistance = Math.abs(Number(candles[index].time) - timestamp);
    if (nextDistance < distance) {
      nearest = index;
      distance = nextDistance;
    }
  }
  return nearest;
}

function logicalIndexByTime(
  candles: readonly ChartCandleData[],
  target: ChartCandleData,
  fallback: number,
) {
  const exact = candles.findIndex((candle) => candle.time === target.time);
  if (exact >= 0) return exact;
  return nearestCandleIndex(candles, target.time) ?? fallback;
}

/** Preserve logical padding/fractional bar offsets while refreshes add bars. */
function logicalRangeForUpdatedCandles(
  previousCandles: readonly ChartCandleData[],
  nextCandles: readonly ChartCandleData[],
  range: { from: number; to: number },
) {
  if (previousCandles.length === 0 || nextCandles.length === 0) return null;
  const lastPreviousIndex = previousCandles.length - 1;
  const mapCoordinate = (coordinate: number) => {
    if (coordinate < 0) {
      return logicalIndexByTime(nextCandles, previousCandles[0], 0) + coordinate;
    }
    if (coordinate > lastPreviousIndex) {
      return logicalIndexByTime(nextCandles, previousCandles[lastPreviousIndex], nextCandles.length - 1) +
        (coordinate - lastPreviousIndex);
    }
    const lower = Math.floor(coordinate);
    const upper = Math.ceil(coordinate);
    const lowerIndex = logicalIndexByTime(nextCandles, previousCandles[lower], lower);
    if (lower === upper) return lowerIndex;
    const upperIndex = logicalIndexByTime(nextCandles, previousCandles[upper], upper);
    return lowerIndex + (upperIndex - lowerIndex) * (coordinate - lower);
  };
  const from = mapCoordinate(range.from);
  const to = mapCoordinate(range.to);
  return { from: Math.min(from, to), to: Math.max(from, to) };
}

function logicalRangeForVisibleTimes(
  candles: readonly ChartCandleData[],
  range: VisibleTimeRange,
) {
  const from = nearestCandleIndex(candles, range.from);
  const to = nearestCandleIndex(candles, range.to);
  return from === null || to === null
    ? null
    : { from: Math.min(from, to), to: Math.max(from, to) };
}

export function buildReplayChartMarkers(
  candles: readonly Candle[],
  executions: readonly TradeExecution[],
  positionEvents: readonly StatementEvent[] = [],
  highlightedExecutionId?: string,
): ReplayChartMarker[] {
  const validChartCandles = validCandles(candles);
  const validChartTimes = new Set(
    validChartCandles.flatMap((candle) => {
      const time = chartTime(candle.time);
      return time === null ? [] : [time];
    }),
  );
  const executionGroups = groupExecutionsByCandle(candles, executions);
  const markers = [
    ...executionGroups.map((group): ReplayChartMarker | null => {
      const candleTime = group.candleTime;
      const time = candleTime ? chartTime(candleTime) : null;
      if (time === null || !validChartTimes.has(time)) return null;
      const highlighted = highlightedExecutionId !== undefined &&
        group.executionIds.includes(highlightedExecutionId);
      const sideLabel = group.side === "buy" ? "B" : "S";
      const countLabel = group.fillCount > 1 ? ` ×${group.fillCount}` : "";
      return {
        time,
        position: group.side === "buy" ? "belowBar" : "aboveBar",
        color: highlighted ? "#f3ba2f" : group.side === "buy" ? "#26a69a" : "#ef5350",
        shape: group.side === "buy" ? "arrowUp" : "arrowDown",
        text: `${highlighted ? "★ " : ""}${sideLabel}${countLabel}`,
        executionIds: group.executionIds,
        fillCount: group.fillCount,
        side: group.side,
      };
    }),
    ...[...new Map(positionEvents.map((event) => [event.id, event])).values()]
      .filter((event) => event.kind === "ipo" && event.quantity && event.displayTimePolicy === "session-open")
      .map((event): ReplayChartMarker | null => {
        const candleTime = displayTimeForCandle(validChartCandles, {
          at: event.date,
          policy: event.displayTimePolicy,
        });
        const time = candleTime ? chartTime(candleTime) : null;
        if (time === null || !validChartTimes.has(time)) return null;
        return {
          time,
          position: "belowBar",
          color: "#a78bfa",
          shape: "arrowUp",
          text: `配售 ${event.quantity}`,
        };
      }),
  ];
  return markers
    .filter((marker): marker is ReplayChartMarker => marker !== null)
    .sort((left, right) => Number(left.time) - Number(right.time));
}

function chartTimeLabel(time: Time) {
  if (typeof time === "number") return formatBeijingUnixSeconds(time);
  if (typeof time === "string") return formatBeijingDateTime(time);
  return formatBeijingDateTime(
    `${time.year.toString().padStart(4, "0")}-${time.month
      .toString()
      .padStart(2, "0")}-${time.day.toString().padStart(2, "0")}T00:00:00.000Z`,
  );
}

export function chartTickLabel(
  time: Time,
  unit: "year" | "date" | "time" | "seconds",
): string;
export function chartTickLabel(
  time: Time,
  tickMarkType?: TickMarkType,
  timeframe?: string,
): string;
export function chartTickLabel(
  time: Time,
  unitOrType: "year" | "date" | "time" | "seconds" | TickMarkType = 2 as TickMarkType,
  timeframe?: string,
) {
  if (typeof unitOrType === "string") {
    const label = chartTimeLabel(time);
    const parts = /^(\d+)年(\d+)月(\d+)日 (\d+:\d+):(\d+)$/.exec(label);
    if (!parts) return label;
    if (unitOrType === "year") return parts[1];
    if (unitOrType === "date") return `${parts[2]}-${parts[3]}`;
    return unitOrType === "seconds" ? `${parts[4]}:${parts[5]}` : parts[4];
  }

  const iso = typeof time === "number"
    ? new Date(time * 1000).toISOString()
    : typeof time === "string"
      ? new Date(time).toISOString()
      : `${time.year.toString().padStart(4, "0")}-${time.month
        .toString()
        .padStart(2, "0")}-${time.day.toString().padStart(2, "0")}T00:00:00.000Z`;
  const full = formatBeijingDateTime(iso);
  const match = full.match(/^(\d{4})年(\d{2})月(\d{2})日(?:\s+(.*))?$/);
  const year = match?.[1] ?? "日期未知";
  const month = match?.[2] ?? "";
  const day = match?.[3] ?? "";
  const clock = match?.[4] ?? "";
  // Lightweight Charts tells us what kind of tick it is. Keep this axis
  // label compact; the full exchange timestamp remains in the crosshair.
  if (unitOrType === 0) return `${year}年`;
  if (unitOrType === 1) return month ? `${month}月` : "日期未知";
  if (unitOrType === 2) return month && day ? `${month}/${day}` : "日期未知";
  if (unitOrType === 4) return clock;
  if (unitOrType === 3) return clock.slice(0, 5);
  return timeframe === "1D" || timeframe === "1W"
    ? month && day ? `${month}/${day}` : "日期未知"
    : clock.slice(0, 5);
}

function timeframeFromViewportKey(key: string) {
  try {
    const parsed: unknown = JSON.parse(key);
    if (Array.isArray(parsed) && typeof parsed[2] === "string") return parsed[2];
  } catch {
    // Opaque keys remain supported; tick kind supplies the compact format.
  }
  const parts = key.split(":");
  return parts.length >= 2 ? parts[1] : undefined;
}

/**
 * Older callers include replay/history mode in viewportKey. Mode is a data
 * visibility concern, so fitting is keyed only by instrument/episode/period
 * when the key uses the workspace's JSON tuple shape.
 */
function viewportIdentity(key: string) {
  try {
    const parsed: unknown = JSON.parse(key);
    if (Array.isArray(parsed) && parsed.length >= 3) {
      return JSON.stringify(parsed.slice(0, 3));
    }
  } catch {
    // Keep opaque keys backwards compatible.
  }
  // The review workspace's legacy key is colon separated and appends the
  // current candle bounds. Keep the stable episode/timeframe/snapshot prefix
  // while ignoring those bounds so replay/history transitions preserve view.
  const parts = key.split(":");
  if (parts.length >= 4) return parts.slice(0, 3).join(":");
  return key;
}

function fitChartToCandles(chart: IChartApi, candleCount: number) {
  if (candleCount <= 0) return;
  chart.timeScale().fitContent();
  const padding = Math.max(3, Math.ceil(candleCount * 0.04));
  chart.timeScale().setVisibleLogicalRange({
    from: -padding,
    to: candleCount - 1 + padding,
  });
}

export function ReplayChart({
  candles,
  executions,
  positionEvents = EMPTY_POSITION_EVENTS,
  cursor,
  averageCost,
  drawings,
  activeTool,
  settings,
  episodeId,
  timeframe = "1D",
  viewportKey = episodeId,
  focusRange,
  locateRequest,
  onLocateResult,
  onLocateTimeframeChange,
  onReady,
  selectedDrawingId,
  plannedRiskAmount,
  currency,
  onSelectDrawing,
  onCommand,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const markerPluginRef = useRef<unknown>(null);
  const costLineRef = useRef<IPriceLine | null>(null);
  const drawingCanvasRef = useRef<DrawingCanvasHandle | null>(null);
  const chartHandleRef = useRef<ChartHandle | null>(null);
  const candlesRef = useRef(candles);
  const drawingsRef = useRef(drawings);
  const viewportKeyRef = useRef(viewportKey);
  const coordinateAdapterRef = useRef<ChartCoordinateAdapter | null>(null);
  const chartSizeRef = useRef({ width: 0, height: 0 });
  const initialFitDoneRef = useRef(false);
  const waitingForUsableSizeRef = useRef(false);
  const captureRef = useRef<ChartHandle["capture"]>(async () => {
    throw new Error("图表尚未就绪");
  });
  const flushRef = useRef<ChartHandle["flush"]>(async () => undefined);
  const getViewportRef = useRef<ChartHandle["getViewport"]>(() => {
    throw new Error("图表尚未就绪");
  });
  const restoreViewportRef = useRef<ChartHandle["restoreViewport"]>(() => undefined);
  const fitAllRef = useRef<ChartHandle["fitAll"]>(() => undefined);
  const fittedRef = useRef<string | null>(null);
  const locatedRequestRef = useRef<string | null>(null);
  const unresolvedLocationAttemptRef = useRef<string | null>(null);
  const appliedCandleDataRef = useRef<ChartCandleData[]>([]);
  const lastViewSnapshotRef = useRef<{
    data: ChartCandleData[];
    logicalRange?: { from: number; to: number } | null;
    timeRange?: VisibleTimeRange | null;
  } | null>(null);
  const [chartReady, setChartReady] = useState(false);
  const [coordinateVersion, setCoordinateVersion] = useState(0);
  const [crosshair, setCrosshair] = useState<CrosshairCandle | null>(
    null,
  );

  const coordinateAdapter = useMemo<ChartCoordinateAdapter>(
    () => ({
      timeToX: (time) => {
        const timestamp = chartTime(time);
        const timeScale = chartRef.current?.timeScale();
        if (timestamp === null) return null;
        const projected = timeScale?.timeToCoordinate(timestamp);
        if (projected !== null && projected !== undefined) return projected;
        // Lightweight Charts has no timeToLogical helper and may return null
        // for a timestamp beyond the loaded data. Map that timestamp through
        // logicalToCoordinate so drawing anchors can occupy blank space while
        // the series remains limited to the revealed candles.
        if (candles.length < 2) return null;
        const first = Date.parse(candles[0].time);
        const delta = Date.parse(candles[1].time) - first;
        const target = Date.parse(time);
        if (!Number.isFinite(first) || !Number.isFinite(delta) || delta <= 0 || !Number.isFinite(target)) return null;
        const logical = (target - first) / delta;
        return timeScale?.logicalToCoordinate(logical as Logical) ?? null;
      },
      priceToY: (price) =>
        seriesRef.current?.priceToCoordinate(price) ?? null,
      xToTime: (x) => {
        const timeScale = chartRef.current?.timeScale();
        const time = timeScale?.coordinateToTime(x);
        return typeof time === "number"
          ? new Date(time * 1000).toISOString()
          : (() => {
              // Lightweight Charts returns null for logical cells beyond the
              // last loaded bar. Extrapolate the existing candle interval so
              // blank-space annotations remain editable without revealing
              // future candles.
              const logical = timeScale?.coordinateToLogical(x);
              if (logical === null || logical === undefined || candles.length < 2) return null;
              const first = Date.parse(candles[0].time);
              const delta = Date.parse(candles[1].time) - first;
              if (!Number.isFinite(first) || !Number.isFinite(delta) || delta <= 0) return null;
              return new Date(first + Number(logical) * delta).toISOString();
            })();
      },
      yToPrice: (y) =>
        seriesRef.current?.coordinateToPrice(y) ?? null,
    }),
    [candles],
  );

  useLayoutEffect(() => {
    candlesRef.current = candles;
    drawingsRef.current = drawings;
    viewportKeyRef.current = viewportKey;
    coordinateAdapterRef.current = coordinateAdapter;
  }, [candles, coordinateAdapter, drawings, viewportKey]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;

    let disposed = false;
    let observer: ResizeObserver | null = null;

    void import("lightweight-charts").then(
      ({
        CandlestickSeries,
        ColorType,
        CrosshairMode,
        HistogramSeries,
        LineStyle,
        createChart,
        createSeriesMarkers,
      }) => {
        if (disposed) return;
        const chart = createChart(container, {
          // The chart is sized by the observer below. Mixing autoSize with
          // explicit width/height updates leaves a zero-height price scale
          // during an update, which makes marker hit-testing throw when the
          // series is refreshed.
          autoSize: false,
          width: Math.max(1, container.clientWidth),
          height: Math.max(1, container.clientHeight),
          layout: {
            background: { type: ColorType.Solid, color: "#101722" },
            textColor: "#8392a7",
            attributionLogo: true,
          },
          grid: {
            vertLines: { color: "#1c2634" },
            horzLines: { color: "#1c2634" },
          },
          crosshair: {
            mode: CrosshairMode.MagnetOHLC,
            vertLine: {
              color: "#52657e",
              labelBackgroundColor: "#2f80ed",
            },
            horzLine: {
              color: "#52657e",
              labelBackgroundColor: "#2f80ed",
            },
          },
          rightPriceScale: {
            borderColor: "#273345",
            scaleMargins: { top: 0.08, bottom: 0.2 },
          },
          localization: {
            locale: "zh-CN",
            timeFormatter: chartTimeLabel,
          },
          timeScale: {
            borderColor: "#273345",
            timeVisible: true,
            secondsVisible: false,
            rightOffset: 4,
            barSpacing: 8,
            tickMarkFormatter: (time: Time, tickMarkType: TickMarkType) =>
              chartTickLabel(
                time,
                tickMarkType,
                timeframeFromViewportKey(viewportKeyRef.current),
              ),
          },
        });
        const candleSeries = chart.addSeries(CandlestickSeries, {
          upColor: "#26a69a",
          downColor: "#ef5350",
          borderVisible: false,
          wickUpColor: "#26a69a",
          wickDownColor: "#ef5350",
          priceLineVisible: true,
          lastValueVisible: true,
        });
        const volumeSeries = chart.addSeries(HistogramSeries, {
          priceFormat: { type: "volume" },
          priceScaleId: "",
          lastValueVisible: false,
          priceLineVisible: false,
        });
        volumeSeries.priceScale().applyOptions({
          scaleMargins: { top: 0.82, bottom: 0 },
        });
        const markerPlugin = createSeriesMarkers(candleSeries, []);
        const costLine = candleSeries.createPriceLine({
          price: 0,
          color: "#f3ba2f",
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: false,
          title: "成本",
        });

        chart.subscribeCrosshairMove((param) => {
          setCoordinateVersion((version) => version + 1);
          if (!param.time) {
            setCrosshair(null);
            return;
          }
          const value = param.seriesData.get(candleSeries);
          if (value && "close" in value) {
            setCrosshair({
              time: new Date(Number(param.time) * 1000).toISOString(),
              open: value.open,
              high: value.high,
              low: value.low,
              close: value.close,
            });
          }
        });
        chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
          setCoordinateVersion((version) => version + 1);
        });

        chartRef.current = chart;
        seriesRef.current = candleSeries;
        volumeSeriesRef.current = volumeSeries;
        markerPluginRef.current = markerPlugin;
        costLineRef.current = costLine;
        setChartReady(true);

        observer = new ResizeObserver(() => {
          const width = Math.max(1, container.clientWidth);
          const height = Math.max(1, container.clientHeight);
          const range = chart.timeScale().getVisibleLogicalRange?.();
          chart.applyOptions({
            width,
            height,
          });
          if (range && width > 0) chart.timeScale().setVisibleLogicalRange(range);
          const previousWidth = chartSizeRef.current.width;
          chartSizeRef.current = { width, height };
          const usable = width >= 400 && height >= 180;
          if (!usable) {
            waitingForUsableSizeRef.current = true;
          } else if (
            waitingForUsableSizeRef.current ||
            (!initialFitDoneRef.current && previousWidth === 0)
          ) {
            fitChartToCandles(chart, candlesRef.current.length);
            initialFitDoneRef.current = candlesRef.current.length > 0;
            waitingForUsableSizeRef.current = false;
            fittedRef.current = viewportIdentity(viewportKeyRef.current);
          }
          setCoordinateVersion((version) => version + 1);
        });
        observer.observe(container);
      },
    );

    return () => {
      disposed = true;
      observer?.disconnect();
      chartRef.current?.remove();
      chartRef.current = null;
      seriesRef.current = null;
      volumeSeriesRef.current = null;
      markerPluginRef.current = null;
      costLineRef.current = null;
    };
  }, []);

  useEffect(() => {
    chartRef.current?.applyOptions({
      handleScroll: activeTool === "cursor",
      handleScale: activeTool === "cursor",
    });
  }, [activeTool, chartReady]);

  const candleSignature = candleDataSignature(candles);
  const mappingSignature = candleMappingSignature(candles);
  const validChartCandles = validCandles(candles);
  const validCandleData = chartCandleData(candles);
  const highlightedExecutionId = locateRequest?.episodeId === episodeId &&
    executions.some((execution) =>
      execution.id === locateRequest.executionId &&
      execution.instrument.id === locateRequest.instrumentId,
    )
    ? locateRequest.executionId
    : undefined;
  const markerData = settings.showExecutions
    ? buildReplayChartMarkers(
        candles,
        executions,
        positionEvents,
        highlightedExecutionId,
      )
    : [];
  // Marker and source signatures are deliberately value based. Refreshing
  // metadata often creates new arrays with the same bars; those updates must
  // not tear down the chart or move the user's viewport.
  const markerSignature = [
    mappingSignature,
    executionMarkerSignature(executions),
    positionEventSignature(positionEvents),
    settings.showExecutions ? "on" : "off",
    highlightedExecutionId ?? "",
  ].join("\u0001");
  const focusRangeSignature = focusRange
    ? `${focusRange.start}\u0001${focusRange.end}`
    : "";

  const fitAll = useCallback(() => {
    if (!chartRef.current || candlesRef.current.length === 0) return;
    // Leave room for arrows/text on the first and last bars as well.
    fitChartToCandles(chartRef.current, candlesRef.current.length);
    fittedRef.current = viewportIdentity(viewportKeyRef.current);
    const usable = chartSizeRef.current.width >= 400 && chartSizeRef.current.height >= 180;
    initialFitDoneRef.current = usable;
    waitingForUsableSizeRef.current = !usable;
    setCrosshair(null);
    setCoordinateVersion((version) => version + 1);
  }, []);

  useLayoutEffect(() => {
    const candleSeries = seriesRef.current;
    const volumeSeries = volumeSeriesRef.current;
    if (!chartReady || !candleSeries || !volumeSeries) return;

    const scale = chartRef.current?.timeScale();
    // Capture the user's logical range before setData. lightweight-charts may
    // otherwise reset it while replacing a series, especially when a refresh
    // temporarily returns an empty array.
    const preserveViewport = fittedRef.current === viewportIdentity(viewportKey);
    if (!preserveViewport) lastViewSnapshotRef.current = null;
    const previousRange = preserveViewport
      ? scale?.getVisibleLogicalRange?.()
      : null;
    const previousTimeRange = preserveViewport
      ? scale?.getVisibleRange?.() as VisibleTimeRange | null | undefined
      : null;
    if (previousRange || previousTimeRange) {
      lastViewSnapshotRef.current = {
        data: appliedCandleDataRef.current,
        logicalRange: previousRange,
        timeRange: previousTimeRange,
      };
    }
    const markerPlugin = markerPluginRef.current as {
      setMarkers: (nextMarkers: readonly ReplayChartMarker[]) => void;
    } | null;
    markerPlugin?.setMarkers([]);
    candleSeries.setData(
      validCandleData.map(({ time, open, high, low, close }) => ({
        time,
        open,
        high,
        low,
        close,
      })),
    );
    volumeSeries.setData(
      validCandleData.map((candle) => ({
        time: candle.time,
        value: candle.volume,
        color:
          candle.close >= candle.open
            ? "rgba(38, 166, 154, 0.34)"
            : "rgba(239, 83, 80, 0.32)",
      })),
    );
    const snapshot = lastViewSnapshotRef.current;
    const restoredLogicalRange = snapshot?.logicalRange &&
      snapshot.data.length > 0 &&
      logicalRangeForUpdatedCandles(snapshot.data, validCandleData, snapshot.logicalRange);
    const restoredTimeRange = snapshot?.timeRange &&
      snapshot.data.length > 0 &&
      logicalRangeForVisibleTimes(validCandleData, snapshot.timeRange);
    if (validCandleData.length > 0 && restoredLogicalRange) {
      scale?.setVisibleLogicalRange(restoredLogicalRange);
    } else if (validCandleData.length > 0 && restoredTimeRange) {
      scale?.setVisibleLogicalRange(restoredTimeRange);
    } else if (validCandleData.length > 0 && snapshot?.logicalRange) {
      scale?.setVisibleLogicalRange(snapshot.logicalRange);
    }
    appliedCandleDataRef.current = validCandleData;
    setCoordinateVersion((version) => version + 1);
  // Value signature dependencies intentionally ignore refreshed array identity.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartReady, candleSignature, viewportKey]);

  useEffect(() => {
    const markerPlugin = markerPluginRef.current as {
      setMarkers: (nextMarkers: readonly ReplayChartMarker[]) => void;
    } | null;
    if (!chartReady || !markerPlugin) return;
    // Data and marker mutations happen in separate effects. Installing after
    // the data mutation avoids a transient marker hit-test against old bars.
    markerPlugin.setMarkers([]);
    const markerTimer = window.setTimeout(() => {
      markerPlugin.setMarkers(markerData);
    }, 0);
    return () => window.clearTimeout(markerTimer);
  // Marker values are derived from the signature; array identity is irrelevant.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartReady, markerSignature]);

  useEffect(() => {
    const scale = chartRef.current?.timeScale();
    if (!chartReady || !scale || validCandleData.length === 0) return;
    if (fittedRef.current === viewportIdentity(viewportKey)) return;
    scale.fitContent();
    // Leave room for arrows/text on the first and last bars as well.
    const padding = Math.max(3, Math.ceil(validCandleData.length * 0.04));
    scale.setVisibleLogicalRange(
      focusRange
        ? episodeViewport(validChartCandles, focusRange)
        : {
            from: -padding,
            to: validCandleData.length - 1 + padding,
          },
    );
    fittedRef.current = viewportIdentity(viewportKey);
    setCrosshair(null);
    setCoordinateVersion((version) => version + 1);
  }, [
    chartReady,
    candleSignature,
    focusRange,
    focusRangeSignature,
    validCandleData.length,
    validChartCandles,
    viewportKey,
  ]);

  useEffect(() => {
    if (!chartReady || !locateRequest || locateRequest.episodeId !== episodeId) return;
    const location = resolveExecutionChartLocation(candles, executions, locateRequest);
    if (!location) return;
    // A successful request is one-shot: later metadata updates must not move
    // a view the user has already adjusted. Unresolved attempts include the
    // candle signature so a newly fetched target day can be retried.
    if (locatedRequestRef.current === locateRequest.requestId) return;
    const resultBase = {
      ...locateRequest,
      timeframe,
    } satisfies Omit<ReviewChartLocateResult, "status">;
    if (!location.candleTime) {
      const status = timeframe === "1D"
        ? "missing"
        : "needs-daily";
      const attemptKey = `${locateRequest.requestId}:${timeframe}:${mappingSignature}`;
      if (unresolvedLocationAttemptRef.current === attemptKey) return;
      unresolvedLocationAttemptRef.current = attemptKey;
      const result: ReviewChartLocateResult = {
        ...resultBase,
        status,
        reason: status === "needs-daily"
          ? "当前周期没有目标交易日的可靠映射，日线可能包含该交易日"
          : "目标交易日没有对应日线行情，未跳转到邻近日",
      };
      onLocateResult?.(result);
      if (status === "needs-daily") onLocateTimeframeChange?.("1D");
      return;
    }
    const targetIndex = validChartCandles.findIndex(
      (candle) => candle.time === location.candleTime,
    );
    if (targetIndex < 0) return;
    const scale = chartRef.current?.timeScale();
    if (!scale) return;
    const currentRange = scale.getVisibleLogicalRange?.();
    const span = currentRange
      ? Math.max(8, currentRange.to - currentRange.from)
      : Math.max(16, Math.min(60, validCandleData.length * 0.24));
    const half = span / 2;
    scale.setVisibleLogicalRange({
      from: targetIndex - half,
      to: targetIndex + half,
    });
    locatedRequestRef.current = locateRequest.requestId;
    unresolvedLocationAttemptRef.current = null;
    onLocateResult?.({
      ...resultBase,
      status: "located",
      candleTime: location.candleTime,
    });
    setCoordinateVersion((version) => version + 1);
  }, [
    candles,
    chartReady,
    executions,
    episodeId,
    locateRequest,
    onLocateResult,
    onLocateTimeframeChange,
    timeframe,
    candleSignature,
    mappingSignature,
    validCandleData,
    validChartCandles,
  ]);

  useEffect(() => {
    if (!chartReady) return;
    costLineRef.current?.applyOptions({
      price: averageCost > 0 ? averageCost : validCandleData.at(-1)?.close ?? 0,
      axisLabelVisible: settings.showAverageCost && averageCost > 0,
    });
  }, [averageCost, chartReady, candleSignature, settings.showAverageCost, validCandleData]);

  useEffect(() => {
    if (!chartReady) return;
    const colors = settings.colorScheme === "green-red"
      ? { up: "#22c55e", down: "#ef4444" }
      : settings.colorScheme === "blue-orange"
        ? { up: "#3b82f6", down: "#f97316" }
        : { up: "#26a69a", down: "#ef5350" };
    chartRef.current?.applyOptions({
      grid: {
        vertLines: {
          color: "#1c2634",
          visible: settings.showGrid,
        },
        horzLines: {
          color: "#1c2634",
          visible: settings.showGrid,
        },
      },
    });
    seriesRef.current?.applyOptions({
      upColor: colors.up,
      downColor: colors.down,
      wickUpColor: colors.up,
      wickDownColor: colors.down,
    });
    volumeSeriesRef.current?.applyOptions({
      visible: settings.showVolume,
    });
    costLineRef.current?.applyOptions({
      axisLabelVisible:
        settings.showAverageCost && averageCost > 0,
    });
  }, [
    averageCost,
    chartReady,
    settings.colorScheme,
    settings.showAverageCost,
    settings.showGrid,
    settings.showVolume,
  ]);

  const getViewport = useCallback((): ChartViewport => {
    const chart = chartRef.current;
    const stage = containerRef.current?.parentElement;
    if (!chart || !stage) throw new Error("图表尚未就绪");
    const scale = chart.timeScale();
    const options = scale.options();
    const rect = stage.getBoundingClientRect();
    return {
      version: 1,
      logicalRange: scale.getVisibleLogicalRange()
        ? { ...scale.getVisibleLogicalRange()! }
        : null,
      barSpacing: Number(options.barSpacing),
      rightOffset: Number(options.rightOffset),
      width: Math.round(rect.width || stage.clientWidth),
      height: Math.round(rect.height || stage.clientHeight),
    };
  }, []);

  const flush = useCallback(async () => {
    const chart = chartRef.current;
    if (!chart) throw new Error("图表尚未就绪");
    // Lightweight Charts consumes its pending invalidation mask synchronously
    // inside takeScreenshot(), so capture does not depend on a browser paint
    // frame that may never run while the chart is hidden.
    chart.takeScreenshot(false, false);
  }, []);

  const restoreViewport = useCallback((viewport: ChartViewport) => {
    const chart = chartRef.current;
    if (!chart || viewport.version !== 1) return;
    const scale = chart.timeScale();
    if (Number.isFinite(viewport.barSpacing) || Number.isFinite(viewport.rightOffset)) {
      scale.applyOptions({
        ...(Number.isFinite(viewport.barSpacing) ? { barSpacing: viewport.barSpacing } : {}),
        ...(Number.isFinite(viewport.rightOffset) ? { rightOffset: viewport.rightOffset } : {}),
      });
    }
    if (viewport.logicalRange) scale.setVisibleLogicalRange({ ...viewport.logicalRange });
    setCoordinateVersion((version) => version + 1);
  }, []);

  const capture = useCallback(async (): Promise<ChartCapture> => {
    const chart = chartRef.current;
    const stage = containerRef.current?.parentElement;
    if (!chart || !stage || typeof chart.takeScreenshot !== "function") {
      throw new Error("图表截图不可用");
    }
    // A focused editor is still a working draft. Commit it before taking the
    // base and overlay screenshots so the retained PNG and text state agree.
    drawingCanvasRef.current?.commitText();
    const fonts = typeof document !== "undefined" ? document.fonts?.ready : undefined;
    if (fonts) await fonts;
    await flush();
    const rect = stage.getBoundingClientRect();
    const width = Math.round(rect.width || stage.clientWidth);
    const height = Math.round(rect.height || stage.clientHeight);
    if (width <= 0 || height <= 0) throw new Error("图表尺寸无效，无法截图");
    // Include the chart's top layer so execution markers remain in the
    // retained image while the second argument keeps the crosshair out.
    const base = chart.takeScreenshot(true, false);
    if (!base) throw new Error("基础图表截图失败");
    const overlay = await drawingCanvasRef.current?.captureOverlay(2);
    if (!overlay) throw new Error("图表叠加层截图失败");
    const output = document.createElement("canvas");
    output.width = width * 2;
    output.height = height * 2;
    const context = output.getContext("2d");
    if (!context) throw new Error("无法合成图表截图");
    context.drawImage(base, 0, 0, output.width, output.height);
    context.drawImage(overlay, 0, 0, output.width, output.height);
    const imageDataUrl = output.toDataURL("image/png");
    if (!imageDataUrl) throw new Error("图表截图为空");
    const warnings = drawingsRef.current
      .filter((drawing) => !drawing.hidden && drawing.tool === "text")
      .flatMap((drawing) => {
        const anchor = drawing.anchors[0];
        const x = drawing.placement === "canvas" && Number.isFinite(drawing.canvasX)
          ? Number(drawing.canvasX) * width
          : anchor
            ? coordinateAdapterRef.current?.timeToX(anchor.time) ?? -1
            : -1;
        const y = drawing.placement === "canvas" && Number.isFinite(drawing.canvasY)
          ? Number(drawing.canvasY) * height
          : anchor
            ? coordinateAdapterRef.current?.priceToY(anchor.price) ?? -1
            : -1;
        const layout = textLayout(
          drawing.text ?? "关键位",
          drawing.textWidth ?? 180,
          drawing.fontSize ?? 14,
          width,
        );
        return x < 0 || y < 0 || x + layout.width > width || y + layout.height > height
          ? ["截图文字被裁切"]
          : [];
      });
    return {
      imageDataUrl,
      viewport: getViewport(),
      ...(warnings.length ? { warnings: [...new Set(warnings)] } : {}),
    };
  }, [flush, getViewport]);

  useEffect(() => {
    captureRef.current = capture;
    flushRef.current = flush;
    getViewportRef.current = getViewport;
    restoreViewportRef.current = restoreViewport;
    fitAllRef.current = fitAll;
  }, [capture, fitAll, flush, getViewport, restoreViewport]);

  useEffect(() => {
    if (!chartReady) {
      onReady?.(null);
      return;
    }
    if (!chartHandleRef.current) {
      chartHandleRef.current = {
        capture: () => captureRef.current(),
        flush: () => flushRef.current(),
        getViewport: () => getViewportRef.current(),
        restoreViewport: (viewport) => restoreViewportRef.current(viewport),
        fitAll: () => fitAllRef.current(),
      };
    }
    onReady?.(chartHandleRef.current);
    return () => onReady?.(null);
  }, [chartReady, onReady]);

  const displayCandle = crosshair ?? candles.at(-1);

  return (
    <div
      className="chart-stage"
      data-show-grid={settings.showGrid}
      data-show-volume={settings.showVolume}
      data-show-executions={settings.showExecutions}
      data-show-average-cost={settings.showAverageCost}
      data-color-scheme={settings.colorScheme}
      onPointerMove={() =>
        setCoordinateVersion((version) => version + 1)
      }
      onWheel={() =>
        setCoordinateVersion((version) => version + 1)
      }
    >
      <div className="chart-ohlc">
        <span>
          {crosshair
            ? formatBeijingDateTime(crosshair.time)
            : "当前 K 线"}
        </span>
        {displayCandle && (
          <>
            <b>开 {displayCandle.open.toFixed(2)}</b>
            <b>高 {displayCandle.high.toFixed(2)}</b>
            <b>低 {displayCandle.low.toFixed(2)}</b>
            <b
              className={
                displayCandle.close >= displayCandle.open
                  ? "positive"
                  : "negative"
              }
            >
              收 {displayCandle.close.toFixed(2)}
            </b>
          </>
        )}
      </div>
      <div ref={containerRef} className="lightweight-chart" />
      <DrawingCanvas
        ref={drawingCanvasRef}
        episodeId={episodeId}
        allowFutureAnchors
        multilineText
        candles={candles}
        cursor={cursor}
        drawings={drawings}
        activeTool={activeTool}
        selectedDrawingId={selectedDrawingId}
        plannedRiskAmount={plannedRiskAmount}
        currency={currency}
        onSelectDrawing={onSelectDrawing}
        onCommand={onCommand}
        coordinateAdapter={coordinateAdapter}
        coordinateVersion={coordinateVersion}
      />
    </div>
  );
}
