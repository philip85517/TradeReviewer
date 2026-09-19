"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  IChartApi,
  IPriceLine,
  ISeriesApi,
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
} from "./drawing-canvas";

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

export function chartTickLabel(time: Time, unit: "year" | "date" | "time" | "seconds") {
  const label = chartTimeLabel(time);
  const parts = /^(\d+)年(\d+)月(\d+)日 (\d+:\d+):(\d+)$/.exec(label);
  if (!parts) return label;
  if (unit === "year") return parts[1];
  if (unit === "date") return `${parts[2]}-${parts[3]}`;
  return unit === "seconds" ? `${parts[4]}:${parts[5]}` : parts[4];
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
        return timestamp === null
          ? null
          : chartRef.current?.timeScale().timeToCoordinate(timestamp) ?? null;
      },
      priceToY: (price) =>
        seriesRef.current?.priceToCoordinate(price) ?? null,
      xToTime: (x) => {
        const time = chartRef.current?.timeScale().coordinateToTime(x);
        return typeof time === "number"
          ? new Date(time * 1000).toISOString()
          : null;
      },
      yToPrice: (y) =>
        seriesRef.current?.coordinateToPrice(y) ?? null,
    }),
    [],
  );

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
        TickMarkType,
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
            tickMarkFormatter: (time: Time, type: TickMarkType) => chartTickLabel(time,
              type === TickMarkType.Year ? "year" :
              type === TickMarkType.Time ? "time" :
              type === TickMarkType.TimeWithSeconds ? "seconds" : "date"),
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
          const range = chart.timeScale().getVisibleLogicalRange();
          chart.applyOptions({
            width: Math.max(1, container.clientWidth),
            height: Math.max(1, container.clientHeight),
          });
          if (range && container.clientWidth > 0) chart.timeScale().setVisibleLogicalRange(range);
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

  useEffect(() => {
    const candleSeries = seriesRef.current;
    const volumeSeries = volumeSeriesRef.current;
    if (!chartReady || !candleSeries || !volumeSeries) return;

    const scale = chartRef.current?.timeScale();
    // Capture the user's logical range before setData. lightweight-charts may
    // otherwise reset it while replacing a series, especially when a refresh
    // temporarily returns an empty array.
    const preserveViewport = fittedRef.current === viewportKey;
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
    candleSeries.setData(validCandleData);
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
    if (fittedRef.current === viewportKey) return;
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
    fittedRef.current = viewportKey;
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
        episodeId={episodeId}
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
