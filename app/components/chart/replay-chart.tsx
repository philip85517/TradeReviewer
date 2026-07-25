"use client";

import { useEffect, useRef, useState } from "react";
import type { IChartApi, ISeriesApi, Time } from "lightweight-charts";

import type { Drawing, DrawingTool } from "../../lib/chart/drawings";
import type { Candle } from "../../lib/market/types";
import type { TradeExecution } from "../../lib/trades/types";
import { DrawingCanvas } from "./drawing-canvas";

type Props = {
  candles: Candle[];
  executions: TradeExecution[];
  cursor: string;
  averageCost: number;
  drawings: Drawing[];
  activeTool: DrawingTool;
  onAddDrawing: (drawing: Drawing) => void;
};

function chartTime(time: string) {
  return Math.floor(new Date(time).getTime() / 1000) as Time;
}

export function ReplayChart({
  candles,
  executions,
  cursor,
  averageCost,
  drawings,
  activeTool,
  onAddDrawing,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const [crosshair, setCrosshair] = useState<{
    time: string;
    price: number;
  } | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (
      !container ||
      typeof ResizeObserver === "undefined" ||
      candles.length === 0
    ) {
      return;
    }

    let disposed = false;
    let observer: ResizeObserver | null = null;

    import("lightweight-charts").then(
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
          autoSize: true,
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
            vertLine: { color: "#52657e", labelBackgroundColor: "#2f80ed" },
            horzLine: { color: "#52657e", labelBackgroundColor: "#2f80ed" },
          },
          rightPriceScale: {
            borderColor: "#273345",
            scaleMargins: { top: 0.08, bottom: 0.2 },
          },
          timeScale: {
            borderColor: "#273345",
            timeVisible: true,
            secondsVisible: false,
            rightOffset: 4,
            barSpacing: 8,
          },
          handleScroll: activeTool === "cursor",
          handleScale: activeTool === "cursor",
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

        const chartCandles = candles.map((candle) => ({
          time: chartTime(candle.time),
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
        }));
        candleSeries.setData(chartCandles);
        volumeSeries.setData(
          candles.map((candle) => ({
            time: chartTime(candle.time),
            value: candle.volume,
            color:
              candle.close >= candle.open
                ? "rgba(38, 166, 154, 0.34)"
                : "rgba(239, 83, 80, 0.32)",
          })),
        );

        const markers = executions
          .map((execution) => {
            const candle =
              [...candles]
                .reverse()
                .find((item) => item.time <= execution.executedAt) ??
              candles[0];
            return {
              time: chartTime(candle.time),
              position:
                execution.side === "buy"
                  ? ("belowBar" as const)
                  : ("aboveBar" as const),
              color: execution.side === "buy" ? "#26a69a" : "#ef5350",
              shape:
                execution.side === "buy"
                  ? ("arrowUp" as const)
                  : ("arrowDown" as const),
              text: `${execution.side === "buy" ? "买" : "卖"} ${execution.quantity}`,
            };
          })
          .sort((a, b) => Number(a.time) - Number(b.time));
        createSeriesMarkers(candleSeries, markers);

        if (averageCost > 0) {
          candleSeries.createPriceLine({
            price: averageCost,
            color: "#f3ba2f",
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title: "成本",
          });
        }

        chart.subscribeCrosshairMove((param) => {
          if (!param.time) {
            setCrosshair(null);
            return;
          }
          const value = param.seriesData.get(candleSeries);
          if (value && "close" in value) {
            setCrosshair({
              time: new Date(Number(param.time) * 1000).toISOString(),
              price: value.close,
            });
          }
        });
        chart.timeScale().fitContent();
        chartRef.current = chart;
        seriesRef.current = candleSeries;

        observer = new ResizeObserver(() => {
          chart.applyOptions({
            width: container.clientWidth,
            height: container.clientHeight,
          });
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
    };
  }, [activeTool, averageCost, candles, executions]);

  const latest = candles.at(-1);

  return (
    <div className="chart-stage">
      <div className="chart-ohlc">
        <span>{crosshair ? new Date(crosshair.time).toLocaleString("zh-CN") : "当前 K 线"}</span>
        {latest && (
          <>
            <b>开 {latest.open.toFixed(2)}</b>
            <b>高 {latest.high.toFixed(2)}</b>
            <b>低 {latest.low.toFixed(2)}</b>
            <b className={latest.close >= latest.open ? "positive" : "negative"}>
              收 {(crosshair?.price ?? latest.close).toFixed(2)}
            </b>
          </>
        )}
      </div>
      <div ref={containerRef} className="lightweight-chart" />
      <DrawingCanvas
        candles={candles}
        cursor={cursor}
        drawings={drawings}
        activeTool={activeTool}
        onAddDrawing={onAddDrawing}
      />
    </div>
  );
}
