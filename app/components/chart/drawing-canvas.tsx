"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

import type { DrawingCommand } from "../../lib/chart/drawing-commands";
import {
  isPointNearAnchorHandle,
  isPointNearRectangleEdge,
  isPointNearSegment,
  fibonacciLevels,
  parallelChannelGeometry,
  type ProjectedPoint,
} from "../../lib/chart/drawing-geometry";
import type {
  DrawingAnchor,
  DrawingTool,
  NormalizedDrawing,
} from "../../lib/chart/drawings";
import {
  calculateRiskReward,
  validateDrawing,
} from "../../lib/chart/drawings";
import { containingCandleTime, priceRangeForCandles } from "../../lib/chart/chart-scale";
import { textLayout } from "../../lib/chart/text-geometry";
import type { Candle } from "../../lib/market/types";

type Props = {
  episodeId: string;
  candles: Candle[];
  cursor: string;
  drawings: NormalizedDrawing[];
  selectedDrawingId: string | null;
  activeTool: DrawingTool;
  plannedRiskAmount: string | undefined;
  currency: string;
  onSelectDrawing: (id: string | null) => void;
  onCommand: (command: DrawingCommand) => void;
  coordinateAdapter?: ChartCoordinateAdapter;
  coordinateVersion?: number;
  /** Defaults to anchored text for compatibility with existing callers. */
  defaultTextPlacement?: "canvas" | "anchor";
  /** Replay charts may draw into unrevealed blank space without adding data. */
  allowFutureAnchors?: boolean;
  /** ReplayChart enables the v1 multiline editor; legacy embedders keep Enter-to-save. */
  multilineText?: boolean;
};

type CanvasSize = { width: number; height: number };
type DragState = {
  drawing: NormalizedDrawing;
  anchorIndex: number | null;
  originPoint: ProjectedPoint;
};
type TextEditor = {
  anchor: DrawingAnchor;
  x: number;
  y: number;
  drawing?: NormalizedDrawing;
  value: string;
  placement: "canvas" | "anchor";
  canvasX: number;
  canvasY: number;
  textWidth: number;
  fontSize: 12 | 14 | 16 | 18 | 24 | 32;
  background: string;
  color: string;
};
type DrawingDraft = Omit<
  NormalizedDrawing,
  "version" | "episodeId" | "name" | "zIndex" | "createdAtCursor"
> & {
  name?: string;
};
type GestureHandlers = {
  activeTool: DrawingTool;
  pointerDown: (clientX: number, clientY: number) => boolean;
  pointerMove: (clientX: number, clientY: number) => void;
  pointerUp: (clientX: number, clientY: number) => void;
  pointerCancel: () => void;
};

export type ChartCoordinateAdapter = {
  timeToX: (time: string) => number | null;
  priceToY: (price: number) => number | null;
  xToTime: (x: number) => string | null;
  yToPrice: (y: number) => number | null;
};

const FALLBACK_ADAPTER_VERSION = 0;

export type DrawingCanvasHandle = {
  /** Render the visible drawings without selection/editor controls. */
  captureOverlay(scale?: number): Promise<HTMLCanvasElement>;
  /** Commit a focused editor before a caller captures the chart. */
  commitText(): void;
};

function drawingId() {
  return `drawing-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function canvasTextMeasure(context: CanvasRenderingContext2D, value: string) {
  return typeof context.measureText === "function"
    ? context.measureText(value).width
    : value.length * 7;
}

const names: Record<Exclude<DrawingTool, "cursor">, string> = {
  "trend-line": "趋势线", "horizontal-line": "水平线", "vertical-line": "垂直线",
  rectangle: "矩形区间", arrow: "箭头", "parallel-channel": "平行通道",
  fibonacci: "斐波那契回撤", "price-label": "价格标注", text: "文字标注",
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
  const risk = Math.abs(stop.price - entry.price);
  const reward = Math.abs(target.price - entry.price);
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

function localizedCurrency(value: number, currency: string) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatRiskRewardLabel(
  drawing: NormalizedDrawing,
  plannedRiskAmount: string | undefined,
  currency: string,
) {
  if (
    drawing.tool !== "long-risk-reward" &&
    drawing.tool !== "short-risk-reward"
  ) {
    return "";
  }
  const [entry, stop, target] = drawing.anchors;
  if (!entry || !stop || !target) return "";
  const metrics = calculateRiskReward({
    direction:
      drawing.tool === "long-risk-reward" ? "long" : "short",
    entry: entry.price,
    stop: stop.price,
    target: target.price,
  });
  const parts = [
    `风险距离 ${metrics.riskPerShare.toFixed(2)} (${metrics.riskPercent.toFixed(2)}%)`,
    `收益距离 ${metrics.rewardPerShare.toFixed(2)} (${metrics.rewardPercent.toFixed(2)}%)`,
    `${metrics.ratio.toFixed(2)}R`,
  ];
  const budget = Number(plannedRiskAmount);
  if (Number.isFinite(budget) && budget > 0) {
    parts.push(
      `计划风险 ${localizedCurrency(budget, currency)}`,
      `潜在收益 ${localizedCurrency(budget * metrics.ratio, currency)}`,
      `建议数量 ${Math.floor(budget / metrics.riskPerShare)}`,
    );
  }
  return parts.join(" · ");
}

function riskRewardLabelLines(
  drawing: NormalizedDrawing,
  plannedRiskAmount: string | undefined,
  currency: string,
) {
  const [entry, stop, target] = drawing.anchors;
  if (!entry || !stop || !target) return [];
  const metrics = calculateRiskReward({
    direction:
      drawing.tool === "long-risk-reward" ? "long" : "short",
    entry: entry.price,
    stop: stop.price,
    target: target.price,
  });
  const lines = [
    `入场 ${entry.price.toFixed(2)}`,
    `止损 ${stop.price.toFixed(2)}`,
    `目标 ${target.price.toFixed(2)}`,
    `风险距离 ${metrics.riskPerShare.toFixed(2)} (${metrics.riskPercent.toFixed(2)}%)`,
    `收益距离 ${metrics.rewardPerShare.toFixed(2)} (${metrics.rewardPercent.toFixed(2)}%)`,
    `${metrics.ratio.toFixed(2)}R`,
  ];
  const budget = Number(plannedRiskAmount);
  if (Number.isFinite(budget) && budget > 0) {
    lines.push(
      `计划风险 ${localizedCurrency(budget, currency)}`,
      `潜在收益 ${localizedCurrency(budget * metrics.ratio, currency)}`,
      `建议数量 ${Math.floor(budget / metrics.riskPerShare)}`,
    );
  }
  return lines;
}

function validationMessage(drawing: NormalizedDrawing) {
  if (
    (drawing.tool === "long-risk-reward" ||
      drawing.tool === "short-risk-reward") &&
    drawing.anchors[0]?.price === drawing.anchors[1]?.price
  ) {
    return "止损价不能等于入场价";
  }
  try {
    validateDrawing(drawing);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "绘图参数无效";
  }
}

export const DrawingCanvas = forwardRef<DrawingCanvasHandle, Props>(function DrawingCanvas({
  episodeId,
  candles,
  cursor,
  drawings,
  selectedDrawingId,
  activeTool,
  plannedRiskAmount,
  currency,
  onSelectDrawing,
  onCommand,
  coordinateAdapter,
  coordinateVersion = FALLBACK_ADAPTER_VERSION,
  defaultTextPlacement = "anchor",
  allowFutureAnchors = false,
  multilineText = false,
}, forwardedRef) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const startAnchorRef = useRef<DrawingAnchor | null>(null);
  const parallelDraftRef = useRef<{ first: DrawingAnchor; second: DrawingAnchor } | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const previewRef = useRef<NormalizedDrawing | null>(null);
  const gestureHandlersRef = useRef<GestureHandlers | null>(null);
  const compositionRef = useRef(false);
  const cancelEditorRef = useRef(false);
  const commitTextRef = useRef<() => void>(() => undefined);
  const capturedPointerRef = useRef<{
    target: Element;
    pointerId: number;
  } | null>(null);
  const [size, setSize] = useState<CanvasSize>({ width: 0, height: 0 });
  const [preview, setPreview] = useState<NormalizedDrawing | null>(null);
  const [editor, setEditor] = useState<TextEditor | null>(null);
  const [validationError, setValidationError] = useState<string | null>(
    null,
  );
  const { minPrice, maxPrice, priceRange } = priceRangeForCandles(candles);

  function anchorFromPoint(x: number, y: number): DrawingAnchor {
    const projectedTime = coordinateAdapter?.xToTime(x);
    const projectedPrice = coordinateAdapter?.yToPrice(y);
    if (projectedTime && projectedPrice !== null && projectedPrice !== undefined) {
      // Blank space to the right of the revealed candles is a valid drawing
      // target. The chart's data visibility boundary is independent from a
      // drawing's time anchor, so only the fallback path is candle bounded.
      return {
        time: allowFutureAnchors || projectedTime <= cursor ? projectedTime : cursor,
        price: Number(projectedPrice.toFixed(2)),
      };
    }
    const index = Math.max(0, Math.min(candles.length - 1, Math.round((x / Math.max(size.width, 1)) * (candles.length - 1))));
    const price = maxPrice - (y / Math.max(size.height, 1)) * priceRange;
    const fallbackTime = candles[index]?.time ?? cursor;
    return {
      time: allowFutureAnchors || fallbackTime <= cursor ? fallbackTime : cursor,
      price: Number(price.toFixed(2)),
    };
  }

  const pointFor = useCallback((anchor: DrawingAnchor): ProjectedPoint => {
    const projectedX = coordinateAdapter?.timeToX(anchor.time) ??
      coordinateAdapter?.timeToX(containingCandleTime(candles, anchor.time));
    const projectedY = coordinateAdapter?.priceToY(anchor.price);
    if (projectedX !== null && projectedX !== undefined && projectedY !== null && projectedY !== undefined) return { x: projectedX, y: projectedY };
    const index = Math.max(0, candles.findIndex((candle) => candle.time >= anchor.time));
    return { x: candles.length <= 1 ? 0 : (index / (candles.length - 1)) * size.width, y: ((maxPrice - anchor.price) / priceRange) * size.height };
  }, [candles, coordinateAdapter, maxPrice, priceRange, size.width, size.height]);

  const pointForDrawing = useCallback((drawing: NormalizedDrawing) => {
    if (
      drawing.tool === "text" &&
      drawing.placement === "canvas" &&
      Number.isFinite(drawing.canvasX) &&
      Number.isFinite(drawing.canvasY)
    ) {
      return {
        x: Math.max(0, Math.min(size.width, (drawing.canvasX ?? 0) * size.width)),
        y: Math.max(0, Math.min(size.height, (drawing.canvasY ?? 0) * size.height)),
      };
    }
    return pointFor(drawing.anchors[0] ?? { time: cursor, price: minPrice });
  }, [cursor, minPrice, pointFor, size.height, size.width]);

  function textDefaults(drawing?: NormalizedDrawing) {
    return {
      placement: drawing?.placement ?? defaultTextPlacement,
      canvasX: drawing?.canvasX ?? 0.08,
      canvasY: drawing?.canvasY ?? 0.12,
      textWidth: drawing?.textWidth ?? 180,
      fontSize: drawing?.fontSize ?? 14,
      background: drawing?.background ?? "transparent",
      color: drawing?.style.color ?? "#2f80ed",
    } as const;
  }

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
    const normalizedDrawing = withCanonicalRiskRewardGeometry(
      normalized(drawing),
    );
    const message = validationMessage(normalizedDrawing);
    if (message) {
      setValidationError(message);
      return false;
    }
    setValidationError(null);
    onCommand({
      type: "add",
      drawing: normalizedDrawing,
    });
    return true;
  }

  function emitReplace(drawing: NormalizedDrawing) {
    const normalizedDrawing =
      withCanonicalRiskRewardGeometry({ ...drawing, createdAtCursor: cursor });
    const message = validationMessage(normalizedDrawing);
    if (message) {
      setValidationError(message);
      return false;
    }
    setValidationError(null);
    onCommand({
      type: "replace",
      drawing: normalizedDrawing,
    });
    return true;
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

  const renderDrawings = useCallback((
    context: CanvasRenderingContext2D,
    width: number,
    height: number,
    includeSelection: boolean,
    renderPreview = true,
  ) => {
    const visibleDrawings = renderPreview && preview
      ? drawings.map((item) => item.id === preview.id ? preview : item)
      : drawings;
    for (const drawing of visibleDrawings) {
      if (
        drawing.hidden ||
        (drawing.anchors.length === 0 &&
          !(drawing.tool === "text" && drawing.placement === "canvas"))
      ) continue;
      const points = drawing.anchors.map(pointFor);
      const primaryPoint = pointForDrawing(drawing);
      if (drawing.tool === "text") points[0] = primaryPoint;
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
      if (drawing.tool === "parallel-channel" && points[1] && points[2]) {
        const channel = parallelChannelGeometry(points[0], points[1], points[2]);
        for (const [start, end] of [channel.base, channel.parallel]) {
          context.beginPath(); context.moveTo(start.x, start.y); context.lineTo(end.x, end.y); context.stroke();
        }
      }
      if (drawing.tool === "fibonacci" && points[1]) {
        context.setLineDash([5, 4]);
        for (const level of fibonacciLevels(points[0], points[1])) {
          context.beginPath(); context.moveTo(0, level.y); context.lineTo(width, level.y); context.stroke();
          context.setLineDash([]);
          context.font = "600 10px var(--font-geist-mono)";
          context.fillText(`${(level.ratio * 100).toFixed(1)}%`, Math.min(width - 42, Math.max(3, points[0].x + 5)), level.y - 3);
          context.setLineDash([5, 4]);
        }
      }
      if (drawing.tool === "vertical-line") { context.setLineDash([6, 5]); context.beginPath(); context.moveTo(points[0].x, 0); context.lineTo(points[0].x, height); context.stroke(); }
      if (drawing.tool === "horizontal-line" || drawing.tool === "price-label") {
        context.setLineDash([6, 5]); context.beginPath(); context.moveTo(0, points[0].y); context.lineTo(width, points[0].y); context.stroke();
        if (drawing.tool === "price-label") { context.setLineDash([]); context.fillRect(width - 54, points[0].y - 10, 54, 20); context.fillStyle = "#ffffff"; context.font = "11px var(--font-geist-mono)"; context.fillText(drawing.anchors[0].price.toFixed(2), width - 48, points[0].y + 4); }
      }
      if (drawing.tool === "text") {
        const fontSize = drawing.fontSize ?? 14;
        const layout = textLayout(
          drawing.text ?? "关键位",
          drawing.textWidth ?? 180,
          fontSize,
          width,
        );
        const textWidth = layout.width;
        const boxHeight = layout.height;
        if (drawing.background && drawing.background !== "transparent") {
          context.fillStyle = drawing.background;
          context.fillRect(points[0].x, points[0].y, textWidth, boxHeight);
        }
        context.fillStyle = drawing.style.color;
        context.font = `600 ${fontSize}px var(--font-geist-sans)`;
        layout.lines.forEach((line, index) => context.fillText(line, points[0].x + 6, points[0].y + fontSize + index * layout.lineHeight));
      }
      if ((drawing.tool === "long-risk-reward" || drawing.tool === "short-risk-reward") && points[1] && points[2]) {
        const left = Math.min(points[0].x, points[1].x, points[2].x); const right = Math.max(points[0].x, points[1].x, points[2].x, left + 110);
        context.globalAlpha = 0.2; context.fillStyle = "#ef5350"; context.fillRect(left, Math.min(points[0].y, points[1].y), right - left, Math.abs(points[1].y - points[0].y)); context.fillStyle = "#26a69a"; context.fillRect(left, Math.min(points[0].y, points[2].y), right - left, Math.abs(points[2].y - points[0].y));
        context.globalAlpha = 0.95; context.fillStyle = "#e6edf7"; context.font = "600 10px var(--font-geist-mono)";
        const lines = riskRewardLabelLines(drawing, plannedRiskAmount, currency);
        const lineHeight = 13;
        const widestLine = Math.max(...lines.map((line) => canvasTextMeasure(context, line)), 0);
        const labelX = Math.min(Math.max(left + 8, 4), Math.max(4, width - widestLine - 4));
        const labelY = Math.min(Math.max(points[0].y - 8, 12), Math.max(12, height - (lines.length - 1) * lineHeight - 4));
        lines.forEach((line, index) => context.fillText(line, labelX, labelY + index * lineHeight));
      }
      if (includeSelection && drawing.id === selectedDrawingId) {
        context.fillStyle = "#ffffff";
        for (const point of points) context.fillRect(point.x - 3, point.y - 3, 6, 6);
      }
      // Keep compatibility with lightweight test canvases that only expose
      // the drawing primitives used by the legacy renderer.
      context.globalAlpha = 1;
    }
  }, [currency, drawings, plannedRiskAmount, pointFor, pointForDrawing, preview, selectedDrawingId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || size.width === 0 || size.height === 0) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const ratio = window.devicePixelRatio || 1;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, size.width, size.height);
    renderDrawings(context, size.width, size.height, true);
    context.globalAlpha = 1;
  }, [candles, coordinateAdapter, coordinateVersion, currency, drawings, maxPrice, minPrice, plannedRiskAmount, pointFor, pointForDrawing, preview, priceRange, renderDrawings, selectedDrawingId, size]);

  // Keep the imperative handle stable while still reading the latest editor
  // closure. A ref also avoids a dependency on the per-render function and
  // prevents a capture from observing stale text after a state update.
  commitTextRef.current = commitText;
  useImperativeHandle(forwardedRef, () => ({
    captureOverlay: async (scale = 2) => {
      if (size.width <= 0 || size.height <= 0) throw new Error("图表叠加层尚未就绪");
      const overlay = document.createElement("canvas");
      overlay.width = Math.max(1, Math.round(size.width * scale));
      overlay.height = Math.max(1, Math.round(size.height * scale));
      const context = overlay.getContext("2d");
      if (!context) throw new Error("无法创建图表叠加层画布");
      context.setTransform(scale, 0, 0, scale, 0, 0);
      context.clearRect(0, 0, size.width, size.height);
      renderDrawings(context, size.width, size.height, false, false);
      return overlay;
    },
    commitText: () => commitTextRef.current(),
  }), [renderDrawings, size]);

  function hitDrawing(point: ProjectedPoint) {
    return [...drawings].sort((a, b) => (b.zIndex ?? 0) - (a.zIndex ?? 0)).find((drawing) => {
      if (drawing.hidden) return false;
      const points = drawing.anchors.map(pointFor);
      if (drawing.tool === "text") {
        const origin = pointForDrawing(drawing);
        const layout = textLayout(
          drawing.text ?? "关键位",
          drawing.textWidth ?? 180,
          drawing.fontSize ?? 14,
          size.width,
        );
        return point.x >= origin.x && point.x <= origin.x + layout.width && point.y >= origin.y && point.y <= origin.y + layout.height;
      }
      if (points.some((anchor) => isPointNearAnchorHandle(point, anchor))) return true;
      if (drawing.tool === "rectangle" && points[1]) return isPointNearRectangleEdge(point, points[0], points[1]);
      if (drawing.tool === "horizontal-line" || drawing.tool === "price-label") return Math.abs(point.y - points[0].y) <= 6;
      if (drawing.tool === "vertical-line") return Math.abs(point.x - points[0].x) <= 6;
      if (drawing.tool === "parallel-channel" && points[1] && points[2]) {
        const channel = parallelChannelGeometry(points[0], points[1], points[2]);
        return channel.base.concat(channel.parallel).some((_, index, lines) => {
          if (index % 2 === 1) return false;
          return isPointNearSegment(point, lines[index], lines[index + 1]);
        });
      }
      if (drawing.tool === "fibonacci" && points[1]) {
        return fibonacciLevels(points[0], points[1]).some((level) => Math.abs(point.y - level.y) <= 6);
      }
      return Boolean(points[1] && isPointNearSegment(point, points[0], points[1]));
    });
  }

  function beginEdit(drawing: NormalizedDrawing, point: ProjectedPoint) {
    const points = drawing.anchors.map(pointFor);
    const anchorIndex = drawing.tool === "text"
      ? null
      : points.findIndex((item) => isPointNearAnchorHandle(point, item));
    dragRef.current = {
      drawing,
      anchorIndex: anchorIndex === null || anchorIndex < 0 ? null : anchorIndex,
      originPoint: point,
    };
  }

  function createDrawing(first: DrawingAnchor, last: DrawingAnchor) {
    const tool = activeTool;
    if (tool === "cursor" || tool === "text" || tool === "horizontal-line" || tool === "vertical-line" || tool === "price-label") return;
    const base = { id: drawingId(), tool, anchors: [first, last], style: styleFor(tool), hidden: false, locked: false, visibleOn: "all" as const, stage: "during-replay" as const };
    if (tool === "long-risk-reward" || tool === "short-risk-reward") {
      const direction = tool === "short-risk-reward" ? "short" : "long";
      const risk = Math.abs(first.price - last.price);
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
    // Prevent the textarea blur caused by closing the editor from committing
    // the same revision a second time.
    cancelEditorRef.current = true;
    const text = editor.value;
    if (text) {
      const fields = {
        placement: editor.placement,
        canvasX: editor.canvasX,
        canvasY: editor.canvasY,
        textWidth: editor.textWidth,
        fontSize: editor.fontSize,
        background: editor.background,
      } as const;
      const anchors = editor.placement === "canvas" ? [] : [editor.anchor];
      if (editor.drawing) emitReplace({ ...editor.drawing, anchors, text, ...fields, style: { ...editor.drawing.style, color: editor.color } });
      else emitAdd({ id: drawingId(), tool: "text", anchors, text, ...fields, style: { ...styleFor("text"), color: editor.color }, hidden: false, locked: false, visibleOn: "all", stage: "during-replay" });
    }
    setEditor(null);
    setTimeout(() => {
      cancelEditorRef.current = false;
    }, 0);
  }

  function preserveEditorForControl() {
    // A native color/select control can report a null relatedTarget when it
    // takes focus. Mark this pointer turn as editor-owned so textarea blur
    // cannot commit and unmount the editor before the control's click/change.
    cancelEditorRef.current = true;
    setTimeout(() => {
      cancelEditorRef.current = false;
    }, 0);
  }

  function pointFromClient(clientX: number, clientY: number) {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  function handlePointerDown(clientX: number, clientY: number) {
    if (candles.length === 0) return false;
    const point = pointFromClient(clientX, clientY);
    if (!point) return false;
    const anchor = anchorFromPoint(point.x, point.y);
    if (activeTool === "cursor") {
      const drawing = hitDrawing(point);
      onSelectDrawing(drawing?.id ?? null);
      if (!drawing) return false;
      if (drawing?.tool === "text" && !drawing.locked) {
        const textPoint = pointForDrawing(drawing);
        const defaults = textDefaults(drawing);
        beginEdit(drawing, point);
        setEditor({
          anchor: drawing.anchors[0] ?? anchorFromPoint(textPoint.x, textPoint.y),
          x: textPoint.x,
          y: textPoint.y,
          drawing,
          value: drawing.text ?? "",
          ...defaults,
        });
        return true;
      }
      if (drawing && !drawing.locked) beginEdit(drawing, point);
      return true;
    }
    if (activeTool === "text") {
      const defaults = textDefaults();
      setEditor({
        anchor,
        x: point.x,
        y: point.y,
        value: "",
        ...defaults,
        canvasX: size.width > 0 ? point.x / size.width : defaults.canvasX,
        canvasY: size.height > 0 ? point.y / size.height : defaults.canvasY,
      });
      return true;
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
      return true;
    }
    startAnchorRef.current = anchor;
    return true;
  }

  function handlePointerMove(clientX: number, clientY: number) {
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.drawing.tool === "text" && editor?.drawing?.id === drag.drawing.id) {
      // A click opens the editor; movement turns that same gesture into a
      // drag. Closing the editor here prevents its stale draft from replacing
      // the moved drawing when the pointer is released.
      cancelEditorRef.current = true;
      setEditor(null);
    }
    const point = pointFromClient(clientX, clientY);
    if (!point) return;
    const anchor = anchorFromPoint(point.x, point.y);
    let anchors: DrawingAnchor[];
    if (drag.drawing.tool === "text" && drag.drawing.placement === "canvas") {
      const origin = pointForDrawing(drag.drawing);
      const canvasX = size.width > 0
        ? Math.max(0, Math.min(1, (origin.x + point.x - drag.originPoint.x) / size.width))
        : drag.drawing.canvasX;
      const canvasY = size.height > 0
        ? Math.max(0, Math.min(1, (origin.y + point.y - drag.originPoint.y) / size.height))
        : drag.drawing.canvasY;
      const nextPreview = { ...drag.drawing, canvasX, canvasY };
      previewRef.current = nextPreview;
      setPreview(nextPreview);
      return;
    }
    if (drag.anchorIndex !== null) {
      anchors = drag.drawing.anchors.map((item, index) =>
        index === drag.anchorIndex ? anchor : item,
      );
    } else {
      const requestedX = point.x - drag.originPoint.x;
      const requestedY = point.y - drag.originPoint.y;
      const cursorX = coordinateAdapter?.timeToX(cursor);
      const latestX = Math.max(...drag.drawing.anchors.map((item) => pointFor(item).x));
      const translatedX =
        allowFutureAnchors || cursorX === null || cursorX === undefined
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
    const endAnchor = anchorFromPoint(point.x, point.y);
    if (activeTool === "parallel-channel") {
      const draft = parallelDraftRef.current;
      if (!draft) {
        parallelDraftRef.current = { first: startAnchor, second: endAnchor };
      } else {
        const base = {
          id: drawingId(),
          tool: "parallel-channel" as const,
          anchors: [draft.first, draft.second, endAnchor],
          style: styleFor("parallel-channel"),
          hidden: false,
          locked: false,
          visibleOn: "all" as const,
          stage: "during-replay" as const,
        };
        emitAdd(base);
        parallelDraftRef.current = null;
      }
    } else {
      createDrawing(startAnchor, endAnchor);
    }
    startAnchorRef.current = null;
  }

  function cancelGesture() {
    dragRef.current = null;
    previewRef.current = null;
    startAnchorRef.current = null;
    parallelDraftRef.current = null;
    setPreview(null);
  }

  function capturePointer(target: Element, pointerId: number) {
    if (!Number.isFinite(pointerId)) return;
    const captureTarget = target as Element & {
      setPointerCapture?: (id: number) => void;
    };
    captureTarget.setPointerCapture?.(pointerId);
    capturedPointerRef.current = { target, pointerId };
  }

  function releaseCapturedPointer(pointerId?: number) {
    const captured = capturedPointerRef.current;
    if (
      !captured ||
      (pointerId !== undefined && captured.pointerId !== pointerId)
    ) {
      return;
    }
    capturedPointerRef.current = null;
    const captureTarget = captured.target as Element & {
      releasePointerCapture?: (id: number) => void;
    };
    captureTarget.releasePointerCapture?.(captured.pointerId);
  }

  useLayoutEffect(() => {
    gestureHandlersRef.current = {
      activeTool,
      pointerDown: handlePointerDown,
      pointerMove: handlePointerMove,
      pointerUp: handlePointerUp,
      pointerCancel: cancelGesture,
    };
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = canvas?.closest(".chart-stage");
    if (!stage) return;
    const fromTextEditor = (event: Event) => {
      const target = event.target as (Element & { closest?: (selector: string) => Element | null }) | null;
      return Boolean(target?.closest?.(".drawing-text-editor-shell"));
    };
    const onPointerDown = (event: Event) => {
      if (fromTextEditor(event)) return;
      const handlers = gestureHandlersRef.current;
      if (handlers?.activeTool !== "cursor") return;
      const pointer = event as PointerEvent;
      const owned = handlers.pointerDown(
        pointer.clientX,
        pointer.clientY,
      );
      if (!owned) return;
      pointer.preventDefault();
      pointer.stopPropagation();
      if (dragRef.current) {
        capturePointer(stage, pointer.pointerId);
      }
    };
    const onPointerMove = (event: Event) => {
      if (fromTextEditor(event)) return;
      const handlers = gestureHandlersRef.current;
      if (
        handlers?.activeTool !== "cursor" ||
        !capturedPointerRef.current
      ) {
        return;
      }
      const pointer = event as PointerEvent;
      pointer.preventDefault();
      pointer.stopPropagation();
      handlers.pointerMove(pointer.clientX, pointer.clientY);
    };
    const onPointerUp = (event: Event) => {
      if (fromTextEditor(event)) return;
      const handlers = gestureHandlersRef.current;
      if (
        handlers?.activeTool !== "cursor" ||
        !capturedPointerRef.current
      ) {
        return;
      }
      const pointer = event as PointerEvent;
      pointer.preventDefault();
      pointer.stopPropagation();
      handlers.pointerUp(pointer.clientX, pointer.clientY);
      releaseCapturedPointer(pointer.pointerId);
    };
    const onPointerCancel = (event: Event) => {
      if (!capturedPointerRef.current) return;
      const pointer = event as PointerEvent;
      pointer.preventDefault();
      pointer.stopPropagation();
      gestureHandlersRef.current?.pointerCancel();
      releaseCapturedPointer(pointer.pointerId);
    };
    const onLostPointerCapture = () => {
      if (!capturedPointerRef.current) return;
      gestureHandlersRef.current?.pointerCancel();
      capturedPointerRef.current = null;
    };
    stage.addEventListener("pointerdown", onPointerDown, true);
    stage.addEventListener("pointermove", onPointerMove, true);
    stage.addEventListener("pointerup", onPointerUp, true);
    stage.addEventListener("pointercancel", onPointerCancel, true);
    stage.addEventListener(
      "lostpointercapture",
      onLostPointerCapture,
      true,
    );
    return () => {
      stage.removeEventListener("pointerdown", onPointerDown, true);
      stage.removeEventListener("pointermove", onPointerMove, true);
      stage.removeEventListener("pointerup", onPointerUp, true);
      stage.removeEventListener(
        "pointercancel",
        onPointerCancel,
        true,
      );
      stage.removeEventListener(
        "lostpointercapture",
        onLostPointerCapture,
        true,
      );
      dragRef.current = null;
      previewRef.current = null;
      startAnchorRef.current = null;
      parallelDraftRef.current = null;
      capturedPointerRef.current = null;
      gestureHandlersRef.current = null;
    };
  }, []);

  const drawingMode = activeTool !== "cursor";
  return (
    <div className={`drawing-canvas ${drawingMode ? "drawing-mode" : ""}`}>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="绘图画布"
        onPointerDown={(event) => {
          if (!handlePointerDown(event.clientX, event.clientY)) return;
          event.preventDefault();
          event.stopPropagation();
          if (startAnchorRef.current || dragRef.current) {
            capturePointer(event.currentTarget, event.pointerId);
          }
        }}
        onPointerMove={(event) => {
          if (!capturedPointerRef.current) return;
          event.preventDefault();
          event.stopPropagation();
          handlePointerMove(event.clientX, event.clientY);
        }}
        onPointerUp={(event) => {
          if (!capturedPointerRef.current) return;
          event.preventDefault();
          event.stopPropagation();
          handlePointerUp(event.clientX, event.clientY);
          releaseCapturedPointer(event.pointerId);
        }}
        onPointerCancel={(event) => {
          if (!capturedPointerRef.current) return;
          event.preventDefault();
          event.stopPropagation();
          cancelGesture();
          releaseCapturedPointer(event.pointerId);
        }}
        onLostPointerCapture={() => {
          if (!capturedPointerRef.current) return;
          cancelGesture();
          capturedPointerRef.current = null;
        }}
      />
      {validationError && (
        <p className="drawing-validation-error" role="alert">
          {validationError}
        </p>
      )}
      {editor && (
        <div
          className="drawing-text-editor-shell"
          style={{
            position: "absolute",
            zIndex: 6,
            pointerEvents: "auto",
            display: "grid",
            gap: 2,
            left: Math.max(2, editor.x + 4),
            top: Math.max(2, editor.y - 24),
            width: textLayout(editor.value, editor.textWidth, editor.fontSize, size.width - 8).width,
          }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <div
            className="drawing-text-style-bar"
            aria-label="文字样式"
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 2,
              alignItems: "center",
              minWidth: 0,
              maxWidth: "100%",
              position: "relative",
              zIndex: 7,
            }}
            onPointerDown={(event) => {
              event.stopPropagation();
              preserveEditorForControl();
            }}
          >
            <button
              type="button"
              aria-label={editor.placement === "canvas" ? "改为锚定文字" : "改为自由文字"}
              onClick={() => setEditor((current) => {
                if (!current) return current;
                const placement = current.placement === "canvas" ? "anchor" : "canvas";
                return {
                  ...current,
                  placement,
                  canvasX: size.width > 0 ? current.x / size.width : current.canvasX,
                  canvasY: size.height > 0 ? current.y / size.height : current.canvasY,
                };
              })}
            >
              {editor.placement === "canvas" ? "锚定" : "自由"}
            </button>
            {editor.placement === "canvas" && (
              <button
                type="button"
                aria-label="定位所选文字"
                onClick={() => setEditor((current) => {
                  if (!current || size.width <= 0 || size.height <= 0) return current;
                  const layout = textLayout(current.value, current.textWidth, current.fontSize, size.width - 4);
                  const width = layout.width;
                  const height = layout.height;
                  const x = Math.max(2, Math.min(size.width - width - 2, current.x));
                  const y = Math.max(2, Math.min(size.height - height - 2, current.y));
                  return {
                    ...current,
                    x,
                    y,
                    canvasX: x / size.width,
                    canvasY: y / size.height,
                  };
                })}
              >
                定位
              </button>
            )}
            <label>
              <span className="sr-only">字号</span>
              <select
                aria-label="文字字号"
                value={editor.fontSize}
                onChange={(event) => setEditor((current) => current ? { ...current, fontSize: Number(event.target.value) as TextEditor["fontSize"] } : current)}
              >
                {[12, 14, 16, 18, 24, 32].map((fontSize) => <option key={fontSize} value={fontSize}>{fontSize}px</option>)}
              </select>
            </label>
            <label>
              <span className="sr-only">文字颜色</span>
              <input
                type="color"
                aria-label="文字颜色"
                value={editor.color}
                onChange={(event) => setEditor((current) => current ? { ...current, color: event.target.value } : current)}
              />
            </label>
            <label>
              <span className="sr-only">文字宽度</span>
              <input
                type="number"
                aria-label="文字宽度"
                min={36}
                max={Math.max(36, size.width)}
                value={Math.round(editor.textWidth)}
                onChange={(event) => setEditor((current) => current ? {
                  ...current,
                  // Deliberate user edits are capped to this canvas. Existing
                  // stored desired widths remain untouched until edited and
                  // are only clamped by textLayout while rendered.
                  textWidth: Math.min(
                    Math.max(1, size.width),
                    Math.max(36, Number(event.target.value) || 36),
                  ),
                } : current)}
              />
            </label>
            <button
              type="button"
              aria-label="切换文字背景"
              onClick={() => setEditor((current) => current ? { ...current, background: current.background === "transparent" ? "rgba(16, 23, 34, 0.86)" : "transparent" } : current)}
            >
              背景
            </button>
          </div>
          <textarea
            autoFocus
            className="drawing-text-editor"
            aria-label="文字标注"
            value={editor.value}
            rows={3}
            style={{ position: "static", width: "100%", minHeight: 54, pointerEvents: "auto", fontSize: editor.fontSize, background: editor.background === "transparent" ? "#101722" : editor.background }}
            onChange={(event) => setEditor((current) => current ? { ...current, value: event.target.value } : current)}
            onCompositionStart={() => { compositionRef.current = true; }}
            onCompositionEnd={() => { compositionRef.current = false; }}
            onBlur={(event) => {
              if (cancelEditorRef.current) {
                cancelEditorRef.current = false;
                return;
              }
              const nextTarget = event.relatedTarget;
              if (nextTarget instanceof Node && event.currentTarget.parentElement?.contains(nextTarget)) return;
              commitText();
            }}
            onKeyDown={(event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
              if (event.key === "Escape") {
                event.preventDefault();
                cancelEditorRef.current = true;
                setEditor(null);
                return;
              }
              if (
                event.key === "Enter" &&
                !multilineText &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing &&
                !compositionRef.current &&
                !event.metaKey &&
                !event.ctrlKey
              ) {
                event.preventDefault();
                commitText();
                return;
              }
              if (
                event.key === "Enter" &&
                (event.metaKey || event.ctrlKey) &&
                !event.nativeEvent.isComposing &&
                !compositionRef.current
              ) {
                event.preventDefault();
                commitText();
              }
            }}
          />
          <span className="drawing-text-editor-hint" style={{ color: "#8392a7", fontSize: 9 }}>Enter 换行 · ⌘/Ctrl+Enter 完成 · Esc 取消</span>
        </div>
      )}
    </div>
  );
});
