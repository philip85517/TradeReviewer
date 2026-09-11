"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  IChartApi,
  IPriceLine,
  ISeriesApi,
  Time,
} from "lightweight-charts";

import type {
  DrawingTool,
  NormalizedDrawing,
} from "../../lib/chart/drawings";
import type { DrawingCommand } from "../../lib/chart/drawing-commands";
import type { StatementEvent } from "../../lib/import/monthly-statement";
import type { Candle } from "../../lib/market/types";
import {
  formatBeijingDateTime,
  formatBeijingUnixSeconds,
} from "../../lib/replay/format-time";
import type { ChartSettings } from "../../lib/storage/chart-settings";
import { displayTimeForCandle } from "../../lib/replay/display-time";
import type { TradeExecution } from "../../lib/trades/types";
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
  viewportKey?: string;
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

type ReplayChartMarker = {
  time: Time;
  position: "belowBar" | "aboveBar";
  color: string;
  shape: "arrowUp" | "arrowDown";
  text: string;
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

export function buildReplayChartMarkers(
  candles: readonly Candle[],
  executions: readonly TradeExecution[],
  positionEvents: readonly StatementEvent[] = [],
): ReplayChartMarker[] {
  const validChartCandles = validCandles(candles);
  const validChartTimes = new Set(
    validChartCandles.flatMap((candle) => {
      const time = chartTime(candle.time);
      return time === null ? [] : [time];
    }),
  );
  const markers = [
    ...executions.map((execution): ReplayChartMarker | null => {
      const candleTime = displayTimeForCandle(validChartCandles, {
        at: execution.executedAt,
        policy: execution.source.displayTimePolicy,
        calendarDate: execution.source.marketCalendarDate ?? execution.source.tradingDate,
      });
      const time = candleTime ? chartTime(candleTime) : null;
      if (time === null || !validChartTimes.has(time)) return null;
      return {
        time,
        position: execution.side === "buy" ? "belowBar" : "aboveBar",
        color: execution.side === "buy" ? "#26a69a" : "#ef5350",
        shape: execution.side === "buy" ? "arrowUp" : "arrowDown",
        text: `${execution.side === "buy" ? "买" : "卖"} ${execution.quantity}${execution.source.venue ? ` · ${execution.source.venue}` : ""}`,
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
  viewportKey = episodeId,
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
            tickMarkFormatter: (time: Time) => chartTimeLabel(time),
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

  useEffect(() => {
    const candleSeries = seriesRef.current;
    const volumeSeries = volumeSeriesRef.current;
    if (!chartReady || !candleSeries || !volumeSeries) return;

    const validCandleData = chartCandleData(candles);
    // Clear markers before replacing the series data. lightweight-charts can
    // render a hit-test frame between these two mutations; stale markers may
    // then point at a bar that no longer exists and throw from its renderer.
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

    const markers = settings.showExecutions
      ? buildReplayChartMarkers(candles, executions, positionEvents)
      : [];
    // Defer installing markers until the series has completed its data
    // mutation. This also protects the transient empty-data frame while a
    // market-data request replaces the current instrument's candles.
    const markerTimer = window.setTimeout(() => {
      markerPlugin?.setMarkers(markers);
    }, 0);

    costLineRef.current?.applyOptions({
      price: averageCost > 0 ? averageCost : validCandleData.at(-1)?.close ?? 0,
      axisLabelVisible: settings.showAverageCost && averageCost > 0,
    });
    if (fittedRef.current !== viewportKey && validCandleData.length > 0) {
      chartRef.current?.timeScale().fitContent();
      // Leave room for arrows/text on the first and last bars as well.
      const padding = Math.max(3, Math.ceil(validCandleData.length * 0.04));
      chartRef.current?.timeScale().setVisibleLogicalRange({
        from: -padding,
        to: validCandleData.length - 1 + padding,
      });
      fittedRef.current = viewportKey;
      setCrosshair(null);
    }
    setCoordinateVersion((version) => version + 1);
    return () => window.clearTimeout(markerTimer);
  }, [
    averageCost,
    candles,
    chartReady,
    viewportKey,
    executions,
    positionEvents,
    settings.showAverageCost,
    settings.showExecutions,
  ]);

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
