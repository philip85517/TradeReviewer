"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import type { DrawingCommand } from "../../lib/chart/drawing-commands";
import {
  isPointNearAnchorHandle,
  isPointNearRectangleEdge,
  isPointNearSegment,
  type ProjectedPoint,
} from "../../lib/chart/drawing-geometry";
import type {
  DrawingAnchor,
  DrawingTool,
  NormalizedDrawing,
} from "../../lib/chart/drawings";
import { containingCandleTime, priceRangeForCandles } from "../../lib/chart/chart-scale";
import type { Candle } from "../../lib/market/types";

type Props = {
  episodeId: string;
  candles: Candle[];
  cursor: string;
  drawings: NormalizedDrawing[];
  selectedDrawingId: string | null;
  activeTool: DrawingTool;
  plannedRiskAmount: string | undefined;
  onSelectDrawing: (id: string | null) => void;
  onCommand: (command: DrawingCommand) => void;
  coordinateAdapter?: ChartCoordinateAdapter;
  coordinateVersion?: number;
};

type CanvasSize = { width: number; height: number };
type DragState = {
  drawing: NormalizedDrawing;
  anchorIndex: number | null;
  originPoint: ProjectedPoint;
};
type TextEditor = { anchor: DrawingAnchor; x: number; y: number; drawing?: NormalizedDrawing; value: string };
type DrawingDraft = Omit<
  NormalizedDrawing,
  "version" | "episodeId" | "name" | "zIndex" | "createdAtCursor"
> & {
  name?: string;
};
type GestureHandlers = {
  activeTool: DrawingTool;
  pointerDown: (clientX: number, clientY: number) => void;
  pointerMove: (clientX: number, clientY: number) => void;
  pointerUp: (clientX: number, clientY: number) => void;
};

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

const names: Record<Exclude<DrawingTool, "cursor">, string> = {
  "trend-line": "趋势线", "horizontal-line": "水平线", "vertical-line": "垂直线",
  rectangle: "矩形区间", arrow: "箭头", "price-label": "价格标注", text: "文字标注",
  measure: "区间测量", "long-risk-reward": "做多盈亏比", "short-risk-reward": "做空盈亏比",
};

function styleFor(tool: DrawingTool) {
  return { color: tool === "price-label" ? "#f3ba2f" : "#2f80ed", lineWidth: tool === "trend-line" || tool === "arrow" ? 2 : 1.5, opacity: 0.95 };
}

function withCanonicalRiskRewardGeometry(
  drawing: NormalizedDrawing,
): NormalizedDrawing {
  if (
    (drawing.tool !== "long-risk-reward" &&
      drawing.tool !== "short-risk-reward") ||
    drawing.anchors.length < 3
  ) {
    return drawing;
  }
  const [entry, stop, target] = drawing.anchors;
  const risk = Math.max(Math.abs(stop.price - entry.price), 0.01);
  const reward = Math.max(Math.abs(target.price - entry.price), 0.01);
  const direction = drawing.tool === "long-risk-reward" ? 1 : -1;
  return {
    ...drawing,
    anchors: [
      entry,
      { ...stop, price: Number((entry.price - direction * risk).toFixed(2)) },
      { ...target, price: Number((entry.price + direction * reward).toFixed(2)) },
    ],
  };
}

export function DrawingCanvas({
  episodeId,
  candles,
  cursor,
  drawings,
  selectedDrawingId,
  activeTool,
  plannedRiskAmount,
  onSelectDrawing,
  onCommand,
  coordinateAdapter,
  coordinateVersion = FALLBACK_ADAPTER_VERSION,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const startAnchorRef = useRef<DrawingAnchor | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const previewRef = useRef<NormalizedDrawing | null>(null);
  const gestureHandlersRef = useRef<GestureHandlers | null>(null);
  const [size, setSize] = useState<CanvasSize>({ width: 0, height: 0 });
  const [preview, setPreview] = useState<NormalizedDrawing | null>(null);
  const [editor, setEditor] = useState<TextEditor | null>(null);
  const { minPrice, maxPrice, priceRange } = priceRangeForCandles(candles);

  function anchorFromPoint(x: number, y: number): DrawingAnchor {
    const projectedTime = coordinateAdapter?.xToTime(x);
    const projectedPrice = coordinateAdapter?.yToPrice(y);
    if (projectedTime && projectedPrice !== null && projectedPrice !== undefined) {
      return { time: projectedTime > cursor ? cursor : projectedTime, price: Number(projectedPrice.toFixed(2)) };
    }
    const index = Math.max(0, Math.min(candles.length - 1, Math.round((x / Math.max(size.width, 1)) * (candles.length - 1))));
    const price = maxPrice - (y / Math.max(size.height, 1)) * priceRange;
    return { time: (candles[index]?.time ?? cursor) > cursor ? cursor : (candles[index]?.time ?? cursor), price: Number(price.toFixed(2)) };
  }

  const pointFor = useCallback((anchor: DrawingAnchor): ProjectedPoint => {
    const projectedX = coordinateAdapter?.timeToX(containingCandleTime(candles, anchor.time));
    const projectedY = coordinateAdapter?.priceToY(anchor.price);
    if (projectedX !== null && projectedX !== undefined && projectedY !== null && projectedY !== undefined) return { x: projectedX, y: projectedY };
    const index = Math.max(0, candles.findIndex((candle) => candle.time >= anchor.time));
    return { x: candles.length <= 1 ? 0 : (index / (candles.length - 1)) * size.width, y: ((maxPrice - anchor.price) / priceRange) * size.height };
  }, [candles, coordinateAdapter, maxPrice, priceRange, size.width, size.height]);

  function normalized(drawing: DrawingDraft): NormalizedDrawing {
    return {
      ...drawing,
      version: 2,
      episodeId,
      name: drawing.name ?? names[drawing.tool],
      zIndex: drawings.length,
      createdAtCursor: cursor,
    };
  }

  function emitAdd(drawing: DrawingDraft) {
    const normalizedDrawing = normalized(drawing);
    onCommand({
      type: "add",
      drawing: withCanonicalRiskRewardGeometry(normalizedDrawing),
    });
  }

  function emitReplace(drawing: NormalizedDrawing) {
    onCommand({
      type: "replace",
      drawing: withCanonicalRiskRewardGeometry(drawing),
    });
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
    context.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
    context.clearRect(0, 0, size.width, size.height);
    for (const drawing of preview ? drawings.map((item) => item.id === preview.id ? preview : item) : drawings) {
      if (drawing.hidden || drawing.anchors.length === 0) continue;
      const points = drawing.anchors.map(pointFor);
      context.globalAlpha = drawing.style.opacity;
      context.strokeStyle = drawing.style.color;
      context.fillStyle = drawing.style.color;
      context.lineWidth = drawing.style.lineWidth;
      context.setLineDash([]);
      if ((drawing.tool === "trend-line" || drawing.tool === "arrow" || drawing.tool === "measure") && points[1]) {
        context.beginPath(); context.moveTo(points[0].x, points[0].y); context.lineTo(points[1].x, points[1].y); context.stroke();
        if (drawing.tool === "arrow") { context.beginPath(); context.arc(points[1].x, points[1].y, 3, 0, Math.PI * 2); context.fill(); }
        if (drawing.tool === "measure") { context.font = "600 11px var(--font-geist-mono)"; context.fillText(`${Math.abs(drawing.anchors[1].price - drawing.anchors[0].price).toFixed(2)}`, points[1].x + 6, points[1].y - 6); }
      }
      if (drawing.tool === "rectangle" && points[1]) { context.strokeRect(points[0].x, points[0].y, points[1].x - points[0].x, points[1].y - points[0].y); }
      if (drawing.tool === "vertical-line") { context.setLineDash([6, 5]); context.beginPath(); context.moveTo(points[0].x, 0); context.lineTo(points[0].x, size.height); context.stroke(); }
      if (drawing.tool === "horizontal-line" || drawing.tool === "price-label") {
        context.setLineDash([6, 5]); context.beginPath(); context.moveTo(0, points[0].y); context.lineTo(size.width, points[0].y); context.stroke();
        if (drawing.tool === "price-label") { context.setLineDash([]); context.fillRect(size.width - 54, points[0].y - 10, 54, 20); context.fillStyle = "#ffffff"; context.font = "11px var(--font-geist-mono)"; context.fillText(drawing.anchors[0].price.toFixed(2), size.width - 48, points[0].y + 4); }
      }
      if (drawing.tool === "text") { context.font = "600 12px var(--font-geist-sans)"; context.fillText(drawing.text ?? "关键位", points[0].x + 6, points[0].y - 8); }
      if ((drawing.tool === "long-risk-reward" || drawing.tool === "short-risk-reward") && points[1] && points[2]) {
        const left = Math.min(points[0].x, points[1].x, points[2].x); const right = Math.max(points[0].x, points[1].x, points[2].x, left + 110);
        context.globalAlpha = 0.2; context.fillStyle = "#ef5350"; context.fillRect(left, Math.min(points[0].y, points[1].y), right - left, Math.abs(points[1].y - points[0].y)); context.fillStyle = "#26a69a"; context.fillRect(left, Math.min(points[0].y, points[2].y), right - left, Math.abs(points[2].y - points[0].y));
        const risk = Math.abs(drawing.anchors[0].price - drawing.anchors[1].price); const reward = Math.abs(drawing.anchors[2].price - drawing.anchors[0].price); const budget = Number(plannedRiskAmount);
        context.globalAlpha = 0.95; context.fillStyle = "#e6edf7"; context.font = "600 11px var(--font-geist-mono)";
        const text = Number.isFinite(budget) && budget > 0 ? `风险 $${budget.toFixed(2)} · 收益 $${(budget * reward / Math.max(risk, .01)).toFixed(2)} · ${Math.floor(budget / Math.max(risk, .01))} 股` : `R:R 1:${(reward / Math.max(risk, .01)).toFixed(1)}`;
        context.fillText(text, left + 8, points[0].y - 8);
      }
      if (drawing.id === selectedDrawingId) { context.fillStyle = "#ffffff"; for (const point of points) { context.fillRect(point.x - 3, point.y - 3, 6, 6); } }
    }
    context.globalAlpha = 1;
  }, [candles, coordinateAdapter, coordinateVersion, drawings, maxPrice, minPrice, plannedRiskAmount, pointFor, preview, priceRange, selectedDrawingId, size]);

  function hitDrawing(point: ProjectedPoint) {
    return [...drawings].sort((a, b) => (b.zIndex ?? 0) - (a.zIndex ?? 0)).find((drawing) => {
      if (drawing.hidden) return false;
      const points = drawing.anchors.map(pointFor);
      if (points.some((anchor) => isPointNearAnchorHandle(point, anchor))) return true;
      if (drawing.tool === "rectangle" && points[1]) return isPointNearRectangleEdge(point, points[0], points[1]);
      if (drawing.tool === "horizontal-line" || drawing.tool === "price-label") return Math.abs(point.y - points[0].y) <= 6;
      if (drawing.tool === "vertical-line") return Math.abs(point.x - points[0].x) <= 6;
      return Boolean(points[1] && isPointNearSegment(point, points[0], points[1]));
    });
  }

  function beginEdit(drawing: NormalizedDrawing, point: ProjectedPoint) {
    const points = drawing.anchors.map(pointFor);
    const anchorIndex = points.findIndex((item) => isPointNearAnchorHandle(point, item));
    dragRef.current = {
      drawing,
      anchorIndex: anchorIndex < 0 ? null : anchorIndex,
      originPoint: point,
    };
  }

  function createDrawing(first: DrawingAnchor, last: DrawingAnchor) {
    const tool = activeTool;
    if (tool === "cursor" || tool === "text" || tool === "horizontal-line" || tool === "vertical-line" || tool === "price-label") return;
    const base = { id: drawingId(), tool, anchors: [first, last], style: styleFor(tool), hidden: false, locked: false, visibleOn: "all" as const, stage: "during-replay" as const };
    if (tool === "long-risk-reward" || tool === "short-risk-reward") {
      const direction = tool === "short-risk-reward" ? "short" : "long";
      const risk = Math.max(Math.abs(first.price - last.price), 0.01);
      const stop = direction === "long"
        ? first.price - risk
        : first.price + risk;
      const target = direction === "long"
        ? first.price + risk * 2
        : first.price - risk * 2;
      emitAdd({
        ...base,
        tool,
        anchors: [
          first,
          { ...last, price: Number(stop.toFixed(2)) },
          { ...last, price: Number(target.toFixed(2)) },
        ],
      });
      return;
    }
    emitAdd(base);
  }

  function commitText() {
    if (!editor) return;
    const text = editor.value.trim();
    if (text) {
      if (editor.drawing) emitReplace({ ...editor.drawing, text });
      else emitAdd({ id: drawingId(), tool: "text", anchors: [editor.anchor], text, style: styleFor("text"), hidden: false, locked: false, visibleOn: "all", stage: "during-replay" });
    }
    setEditor(null);
  }

  function pointFromClient(clientX: number, clientY: number) {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  function handlePointerDown(clientX: number, clientY: number) {
    if (candles.length === 0) return;
    const point = pointFromClient(clientX, clientY);
    if (!point) return;
    const anchor = anchorFromPoint(point.x, point.y);
    if (activeTool === "cursor") {
      const drawing = hitDrawing(point);
      onSelectDrawing(drawing?.id ?? null);
      if (drawing?.tool === "text" && !drawing.locked) {
        const textPoint = pointFor(drawing.anchors[0]);
        setEditor({
          anchor: drawing.anchors[0],
          x: textPoint.x,
          y: textPoint.y,
          drawing,
          value: drawing.text ?? "",
        });
        return;
      }
      if (drawing && !drawing.locked) beginEdit(drawing, point);
      return;
    }
    if (activeTool === "text") {
      setEditor({ anchor, x: point.x, y: point.y, value: "" });
      return;
    }
    if (
      activeTool === "horizontal-line" ||
      activeTool === "vertical-line" ||
      activeTool === "price-label"
    ) {
      emitAdd({
        id: drawingId(),
        tool: activeTool,
        anchors: [anchor],
        style: styleFor(activeTool),
        hidden: false,
        locked: false,
        visibleOn: "all",
        stage: "during-replay",
      });
      return;
    }
    startAnchorRef.current = anchor;
  }

  function handlePointerMove(clientX: number, clientY: number) {
    const drag = dragRef.current;
    if (!drag) return;
    const point = pointFromClient(clientX, clientY);
    if (!point) return;
    const anchor = anchorFromPoint(point.x, point.y);
    let anchors: DrawingAnchor[];
    if (drag.anchorIndex !== null) {
      anchors = drag.drawing.anchors.map((item, index) =>
        index === drag.anchorIndex ? anchor : item,
      );
    } else {
      const requestedX = point.x - drag.originPoint.x;
      const requestedY = point.y - drag.originPoint.y;
      const cursorX = coordinateAdapter?.timeToX(cursor);
      const latestX = Math.max(
        ...drag.drawing.anchors.map((item) => pointFor(item).x),
      );
      const translatedX =
        cursorX === null || cursorX === undefined
          ? requestedX
          : Math.min(requestedX, cursorX - latestX);
      anchors = drag.drawing.anchors.map((item) => {
        const projected = pointFor(item);
        return anchorFromPoint(
          projected.x + translatedX,
          projected.y + requestedY,
        );
      });
    }
    const nextPreview = { ...drag.drawing, anchors };
    previewRef.current = nextPreview;
    setPreview(nextPreview);
  }

  function handlePointerUp(clientX: number, clientY: number) {
    const drag = dragRef.current;
    if (drag) {
      if (previewRef.current) emitReplace(previewRef.current);
      dragRef.current = null;
      previewRef.current = null;
      setPreview(null);
      return;
    }
    const startAnchor = startAnchorRef.current;
    if (!startAnchor) return;
    const point = pointFromClient(clientX, clientY);
    if (!point) return;
    createDrawing(startAnchor, anchorFromPoint(point.x, point.y));
    startAnchorRef.current = null;
  }

  useLayoutEffect(() => {
    gestureHandlersRef.current = {
      activeTool,
      pointerDown: handlePointerDown,
      pointerMove: handlePointerMove,
      pointerUp: handlePointerUp,
    };
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = canvas?.closest(".chart-stage");
    if (!stage) return;
    const fromTextEditor = (event: Event) =>
      event.target instanceof Element &&
      Boolean(event.target.closest(".drawing-text-editor"));
    const onPointerDown = (event: Event) => {
      if (fromTextEditor(event)) return;
      const handlers = gestureHandlersRef.current;
      if (handlers?.activeTool !== "cursor") return;
      const pointer = event as PointerEvent;
      handlers.pointerDown(pointer.clientX, pointer.clientY);
    };
    const onPointerMove = (event: Event) => {
      if (fromTextEditor(event)) return;
      const handlers = gestureHandlersRef.current;
      if (handlers?.activeTool !== "cursor") return;
      const pointer = event as PointerEvent;
      handlers.pointerMove(pointer.clientX, pointer.clientY);
    };
    const onPointerUp = (event: Event) => {
      if (fromTextEditor(event)) return;
      const handlers = gestureHandlersRef.current;
      if (handlers?.activeTool !== "cursor") return;
      const pointer = event as PointerEvent;
      handlers.pointerUp(pointer.clientX, pointer.clientY);
    };
    stage.addEventListener("pointerdown", onPointerDown, true);
    stage.addEventListener("pointermove", onPointerMove, true);
    stage.addEventListener("pointerup", onPointerUp, true);
    return () => {
      stage.removeEventListener("pointerdown", onPointerDown, true);
      stage.removeEventListener("pointermove", onPointerMove, true);
      stage.removeEventListener("pointerup", onPointerUp, true);
    };
  }, []);

  const drawingMode = activeTool !== "cursor";
  return (
    <div className={`drawing-canvas ${drawingMode ? "drawing-mode" : ""}`}>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="绘图画布"
        onPointerDown={(event) =>
          handlePointerDown(event.clientX, event.clientY)
        }
        onPointerMove={(event) =>
          handlePointerMove(event.clientX, event.clientY)
        }
        onPointerUp={(event) =>
          handlePointerUp(event.clientX, event.clientY)
        }
      />
      {editor && <input autoFocus className="drawing-text-editor" aria-label="文字标注" value={editor.value} style={{ left: editor.x + 4, top: editor.y - 24, pointerEvents: "auto" }} onChange={(event) => setEditor({ ...editor, value: event.target.value })} onBlur={commitText} onKeyDown={(event) => { if (event.key === "Enter") commitText(); if (event.key === "Escape") setEditor(null); }} />}
    </div>
  );
}
