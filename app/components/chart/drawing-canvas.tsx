"use client";

import { useEffect, useRef, useState } from "react";

import type {
  Drawing,
  DrawingAnchor,
  DrawingTool,
} from "../../lib/chart/drawings";
import { priceRangeForCandles } from "../../lib/chart/chart-scale";
import type { Candle } from "../../lib/market/types";

type Props = {
  candles: Candle[];
  cursor: string;
  drawings: Drawing[];
  activeTool: DrawingTool;
  onAddDrawing: (drawing: Drawing) => void;
  coordinateAdapter?: ChartCoordinateAdapter;
  coordinateVersion?: number;
};

type CanvasSize = { width: number; height: number };

export type ChartCoordinateAdapter = {
  timeToX: (time: string) => number | null;
  priceToY: (price: number) => number | null;
  xToTime: (x: number) => string | null;
  yToPrice: (y: number) => number | null;
};

const FALLBACK_ADAPTER_VERSION = 0;

function drawingId() {
  return `drawing-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function DrawingCanvas({
  candles,
  cursor,
  drawings,
  activeTool,
  onAddDrawing,
  coordinateAdapter,
  coordinateVersion = FALLBACK_ADAPTER_VERSION,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState<CanvasSize>({ width: 0, height: 0 });
  const [startAnchor, setStartAnchor] = useState<DrawingAnchor | null>(null);

  const { minPrice, maxPrice, priceRange } = priceRangeForCandles(candles);

  function anchorFromPoint(x: number, y: number): DrawingAnchor {
    const projectedTime = coordinateAdapter?.xToTime(x);
    const projectedPrice = coordinateAdapter?.yToPrice(y);
    if (projectedTime && projectedPrice !== null && projectedPrice !== undefined) {
      return {
        time: projectedTime > cursor ? cursor : projectedTime,
        price: Number(projectedPrice.toFixed(2)),
      };
    }

    const index = Math.max(
      0,
      Math.min(
        candles.length - 1,
        Math.round((x / Math.max(size.width, 1)) * (candles.length - 1)),
      ),
    );
    const price =
      maxPrice - (y / Math.max(size.height, 1)) * priceRange;
    return {
      time: candles[index]?.time ?? cursor,
      price: Number(price.toFixed(2)),
    };
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.round(entry.contentRect.width);
      const height = Math.round(entry.contentRect.height);
      canvas.width = width * window.devicePixelRatio;
      canvas.height = height * window.devicePixelRatio;
      setSize({ width, height });
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || size.width === 0 || size.height === 0) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    context.setTransform(
      window.devicePixelRatio,
      0,
      0,
      window.devicePixelRatio,
      0,
      0,
    );
    context.clearRect(0, 0, size.width, size.height);

    const coordinates = (anchor: DrawingAnchor) => {
      const projectedX = coordinateAdapter?.timeToX(anchor.time);
      const projectedY = coordinateAdapter?.priceToY(anchor.price);
      if (
        projectedX !== null &&
        projectedX !== undefined &&
        projectedY !== null &&
        projectedY !== undefined
      ) {
        return { x: projectedX, y: projectedY };
      }

      const index = Math.max(
        0,
        candles.findIndex((candle) => candle.time >= anchor.time),
      );
      return {
        x:
          candles.length <= 1
            ? 0
            : (index / (candles.length - 1)) * size.width,
        y: ((maxPrice - anchor.price) / priceRange) * size.height,
      };
    };

    for (const drawing of drawings) {
      if (drawing.hidden || drawing.anchors.length === 0) continue;
      const points = drawing.anchors.map(coordinates);
      context.globalAlpha = drawing.style.opacity;
      context.strokeStyle = drawing.style.color;
      context.fillStyle = drawing.style.color;
      context.lineWidth = drawing.style.lineWidth;
      context.setLineDash([]);

      if (drawing.tool === "trend-line" && points[1]) {
        context.beginPath();
        context.moveTo(points[0].x, points[0].y);
        context.lineTo(points[1].x, points[1].y);
        context.stroke();
      }

      if (
        drawing.tool === "horizontal-line" ||
        drawing.tool === "price-label"
      ) {
        context.setLineDash([6, 5]);
        context.beginPath();
        context.moveTo(0, points[0].y);
        context.lineTo(size.width, points[0].y);
        context.stroke();
        if (drawing.tool === "price-label") {
          const label = drawing.anchors[0].price.toFixed(2);
          context.setLineDash([]);
          context.fillRect(size.width - 54, points[0].y - 10, 54, 20);
          context.fillStyle = "#ffffff";
          context.font = "11px var(--font-geist-mono)";
          context.fillText(label, size.width - 48, points[0].y + 4);
        }
      }

      if (drawing.tool === "text") {
        context.font = "600 12px var(--font-geist-sans)";
        context.fillText(drawing.text ?? "关键位", points[0].x + 6, points[0].y - 8);
      }

      if (drawing.tool === "risk-reward" && points[1] && points[2]) {
        const left = Math.min(points[0].x, points[1].x, points[2].x);
        const right = Math.max(points[0].x, points[1].x, points[2].x, left + 110);
        const entryY = points[0].y;
        const stopY = points[1].y;
        const targetY = points[2].y;
        context.globalAlpha = 0.2;
        context.fillStyle = "#ef5350";
        context.fillRect(left, Math.min(entryY, stopY), right - left, Math.abs(stopY - entryY));
        context.fillStyle = "#26a69a";
        context.fillRect(left, Math.min(entryY, targetY), right - left, Math.abs(targetY - entryY));
        context.globalAlpha = 0.9;
        context.strokeStyle = "#e6edf7";
        context.setLineDash([5, 4]);
        context.beginPath();
        context.moveTo(left, entryY);
        context.lineTo(right, entryY);
        context.stroke();
        const risk = Math.abs(drawing.anchors[0].price - drawing.anchors[1].price);
        const reward = Math.abs(drawing.anchors[2].price - drawing.anchors[0].price);
        context.setLineDash([]);
        context.fillStyle = "#e6edf7";
        context.font = "600 11px var(--font-geist-mono)";
        context.fillText(`R:R 1:${(reward / Math.max(risk, 0.01)).toFixed(1)}`, left + 8, entryY - 8);
      }
    }

    context.globalAlpha = 1;
  }, [
    candles,
    coordinateAdapter,
    coordinateVersion,
    drawings,
    maxPrice,
    minPrice,
    priceRange,
    size,
  ]);

  function createSingleAnchorDrawing(anchor: DrawingAnchor) {
    const tool = activeTool;
    if (
      tool !== "horizontal-line" &&
      tool !== "price-label" &&
      tool !== "text"
    ) {
      return;
    }
    onAddDrawing({
      id: drawingId(),
      tool,
      anchors: [anchor],
      style: {
        color: tool === "price-label" ? "#f3ba2f" : "#2f80ed",
        lineWidth: 1.5,
        opacity: 0.95,
      },
      text: tool === "text" ? "关键观察" : undefined,
      hidden: false,
      locked: false,
      visibleOn: "all",
      stage: "during-replay",
    });
  }

  return (
    <canvas
      ref={canvasRef}
      className={`drawing-canvas ${activeTool !== "cursor" ? "drawing-mode" : ""}`}
      aria-label="绘图画布"
      onPointerDown={(event) => {
        if (activeTool === "cursor" || candles.length === 0) return;
        const rect = event.currentTarget.getBoundingClientRect();
        const anchor = anchorFromPoint(
          event.clientX - rect.left,
          event.clientY - rect.top,
        );
        if (
          activeTool === "horizontal-line" ||
          activeTool === "price-label" ||
          activeTool === "text"
        ) {
          createSingleAnchorDrawing(anchor);
          return;
        }
        setStartAnchor(anchor);
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerUp={(event) => {
        if (!startAnchor || candles.length === 0) return;
        const rect = event.currentTarget.getBoundingClientRect();
        const endAnchor = anchorFromPoint(
          event.clientX - rect.left,
          event.clientY - rect.top,
        );

        if (activeTool === "trend-line") {
          onAddDrawing({
            id: drawingId(),
            tool: "trend-line",
            anchors: [startAnchor, endAnchor],
            style: { color: "#2f80ed", lineWidth: 2, opacity: 0.95 },
            hidden: false,
            locked: false,
            visibleOn: "all",
            stage: "during-replay",
          });
        }

        if (activeTool === "risk-reward") {
          const entry = startAnchor.price;
          const stop = endAnchor.price;
          const isLong = stop < entry;
          const target = isLong
            ? entry + Math.abs(entry - stop) * 2
            : entry - Math.abs(stop - entry) * 2;
          onAddDrawing({
            id: drawingId(),
            tool: "risk-reward",
            anchors: [
              startAnchor,
              endAnchor,
              { ...endAnchor, price: Number(target.toFixed(2)) },
            ],
            style: { color: "#d9e2f1", lineWidth: 1, opacity: 0.95 },
            hidden: false,
            locked: false,
            visibleOn: "all",
            stage: "during-replay",
          });
        }
        setStartAnchor(null);
      }}
    />
  );
}
