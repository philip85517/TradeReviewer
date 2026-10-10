"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
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
import { formatBeijingDateTime } from "../../lib/replay/format-time";
import {
  createRiskRewardAnchors,
  hitRiskRewardHandle,
  pointInRiskRewardArea,
  riskRewardBounds,
  riskRewardWidthHandle,
  type RiskHandle,
} from "../../lib/chart/risk-selection";
import {
  canvasMonoFont,
  canvasTextFont,
  CANVAS_TEXT_FONT_FAMILY,
  textCardGeometry,
  textCardLayout,
  textCardLayoutOptions,
  textLayout,
} from "../../lib/chart/text-geometry";
import {
  arrowheadGeometry,
  fibonacciLabelRows,
  layoutDrawingLabels,
  riskRewardLabelRows,
  type DrawingLabelRow,
  type LabelPoint,
  type LabelRect,
  type LabelRowLayout,
} from "../../lib/chart/drawing-label-layout";
import type { Candle } from "../../lib/market/types";
import { Check, X } from "lucide-react";

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
  onDrawingInteractionStart?: () => void;
  coordinateAdapter?: ChartCoordinateAdapter;
  coordinateVersion?: number;
  /** Defaults to anchored text for compatibility with existing callers. */
  defaultTextPlacement?: "canvas" | "anchor";
  /** Replay charts may draw into unrevealed blank space without adding data. */
  allowFutureAnchors?: boolean;
  /** ReplayChart enables the v1 multiline editor; legacy embedders keep Enter-to-save. */
  multilineText?: boolean;
  /** Interactive plot bounds exclude the right price axis and bottom time axis. */
  plotBounds?: ChartPlotBounds;
};

type CanvasSize = { width: number; height: number };
export type ChartPlotBounds = CanvasSize;

type KeyboardObjectControlPositionInput = {
  points: ProjectedPoint[];
  size: CanvasSize;
};

/**
 * Keep the keyboard identity proxy in open space around the drawing. The
 * proxy is an accessible focus target, while the actual 16/44px handles own
 * pointer hit testing; treating the drawing bounds as an exclusion zone keeps
 * the proxy from covering a short arrow tip or an endpoint handle.
 */
function keyboardObjectControlPosition({ points, size }: KeyboardObjectControlPositionInput) {
  const finitePoints = points.filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
  if (finitePoints.length === 0) return { left: 0, top: 0 };
  const bounds = finitePoints.reduce(
    (result, point) => ({
      left: Math.min(result.left, point.x),
      top: Math.min(result.top, point.y),
      right: Math.max(result.right, point.x),
      bottom: Math.max(result.bottom, point.y),
    }),
    { left: finitePoints[0].x, top: finitePoints[0].y, right: finitePoints[0].x, bottom: finitePoints[0].y },
  );
  const proxyWidth = 96;
  const proxyHeight = 24;
  const gap = 8;
  const clampLeft = (left: number) => Math.max(0, Math.min(Math.max(0, size.width - proxyWidth), left));
  const clampTop = (top: number) => Math.max(0, Math.min(Math.max(0, size.height - proxyHeight), top));
  const intersectsBounds = (left: number, top: number) =>
    left < bounds.right + gap && left + proxyWidth > bounds.left - gap &&
    top < bounds.bottom + gap && top + proxyHeight > bounds.top - gap;
  const candidates = [
    { left: bounds.left - proxyWidth - gap, top: bounds.top - proxyHeight - gap },
    { left: bounds.right + gap, top: bounds.top - proxyHeight - gap },
    { left: bounds.left - proxyWidth - gap, top: bounds.bottom + gap },
    { left: bounds.right + gap, top: bounds.bottom + gap },
    { left: bounds.left - proxyWidth - gap, top: (bounds.top + bounds.bottom - proxyHeight) / 2 },
    { left: bounds.right + gap, top: (bounds.top + bounds.bottom - proxyHeight) / 2 },
  ];
  const candidate = candidates
    .map(({ left, top }) => ({ left: clampLeft(left), top: clampTop(top) }))
    .find(({ left, top }) => !intersectsBounds(left, top));
  if (candidate) return candidate;
  return {
    left: clampLeft(bounds.left + gap),
    top: clampTop(bounds.top + gap),
  };
}

type DragState = {
  drawing: NormalizedDrawing;
  anchorIndex: number | null;
  anchorAxis?: "price" | "time";
  textCard: boolean;
  textInteraction?: "move" | "anchor";
  originPoint: ProjectedPoint;
  riskHandle?: RiskHandle;
  interactionStarted?: boolean;
};
type TextEditor = {
  anchor: DrawingAnchor;
  x: number;
  y: number;
  drawing?: NormalizedDrawing;
  value: string;
  placement: "canvas" | "anchor";
  /** Coordinates are optional so editing a legacy anchored Text cannot
   * silently migrate it into a canvas-positioned card. */
  canvasX?: number;
  canvasY?: number;
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
  hover: (clientX: number, clientY: number) => void;
  leave: () => void;
};
type CreationState = {
  tool: Exclude<DrawingTool, "cursor" | "text" | "horizontal-line" | "vertical-line" | "price-label">;
  first: DrawingAnchor;
  second?: DrawingAnchor;
  phase: "second" | "width";
  firstPointConfirmed: boolean;
  pointerDownPoint: ProjectedPoint;
};

type TextCreationState = {
  anchor: DrawingAnchor;
  anchorPoint: ProjectedPoint;
  labelPoint: ProjectedPoint;
  pointerDownPoint: ProjectedPoint;
};

export type DrawingLabelFallback = {
  drawingId: string;
  rows: LabelRowLayout[];
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ChartCoordinateAdapter = {
  timeToX: (time: string) => number | null;
  priceToY: (price: number) => number | null;
  xToTime: (x: number) => string | null;
  yToPrice: (y: number) => number | null;
};

const FALLBACK_ADAPTER_VERSION = 0;
const DEFAULT_TEXT_CARD_BACKGROUND = "rgba(16, 23, 34, 0.86)";
const DEFAULT_TEXT_COLOR = "#e7edf6";
const DEFAULT_TEXT_AUXILIARY_COLOR = "#2f80ed";
const EDITOR_MIN_WIDTH = 220;
// The style controls are a single editing surface, not part of the stored
// text-card width. Give them a usable desktop span while still allowing the
// frame to shrink to the actual chart pane on small viewports.
const EDITOR_CONTROLS_MIN_WIDTH = 500;
const EDITOR_STYLE_BAR_HEIGHT = 36;
const EDITOR_TOUCH_STYLE_BAR_HEIGHT = 44;
const EDITOR_HINT_HEIGHT = 18;
const EDITOR_VERTICAL_GAP = 2;
// Includes the textarea's 3px vertical padding and 1px borders. Keeping this
// explicit prevents a large font from being clipped to a half line by the
// grid row's min-height.
const EDITOR_TEXTAREA_VERTICAL_INSET = 8;

export function paintDrawingScene(
  context: CanvasRenderingContext2D,
  { width, height, drawings, pointFor, pointForDrawing, plannedRiskAmount, currency,
    selectedDrawingId = null, hoveredDrawingId = null, selectionPulse = 0, activeRiskGesture = null, preview = null, expandedTextIds, plotWidth, plotHeight, onLabelFallback }: {
    width: number; height: number; drawings: readonly NormalizedDrawing[];
    pointFor: (anchor: DrawingAnchor) => ProjectedPoint;
    pointForDrawing: (drawing: NormalizedDrawing) => ProjectedPoint;
    plannedRiskAmount?: string; currency: string;
    selectedDrawingId?: string | null; preview?: NormalizedDrawing | null;
    hoveredDrawingId?: string | null; selectionPulse?: number;
    activeRiskGesture?: { drawingId: string; handle: RiskHandle } | null;
    expandedTextIds?: ReadonlySet<string>;
    /** Optional real plot bounds; the backing canvas remains width × height. */
    plotWidth?: number; plotHeight?: number;
    /** Interactive callers can replace an unreadable label with a DOM surface. */
    onLabelFallback?: (fallback: DrawingLabelFallback) => void;
  },
  includeSelection = false,
  renderPreview = false,
) {
    const visibleDrawings = renderPreview && preview
      ? drawings.some((item) => item.id === preview.id)
        ? drawings.map((item) => item.id === preview.id ? preview : item)
        : [...drawings, preview]
      : drawings;
    const cardNumberById = new Map(
      [...visibleDrawings]
        .filter((item) => !item.hidden && item.tool === "text" && item.placement !== "canvas")
        .sort((left, right) => (left.zIndex ?? 0) - (right.zIndex ?? 0))
        .map((item, index) => [item.id, index + 1] as const),
    );
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
      const creationPreview = renderPreview && preview?.id === drawing.id && !drawings.some((item) => item.id === drawing.id);
      if (creationPreview && points[0] && !points[1]) {
        context.beginPath(); context.arc(points[0].x, points[0].y, 4, 0, Math.PI * 2); context.stroke();
      }
      if ((drawing.tool === "trend-line" || drawing.tool === "arrow" || drawing.tool === "measure") && points[1]) {
        context.beginPath(); context.moveTo(points[0].x, points[0].y); context.lineTo(points[1].x, points[1].y); context.stroke();
        if (drawing.tool === "arrow") {
          const head = arrowheadGeometry(points[0], points[1], { length: 10, width: 8 });
          if (head && [head.tip, head.baseLeft, head.baseRight].every(finiteLabelPoint)) {
            context.beginPath();
            context.moveTo(head.tip.x, head.tip.y);
            context.lineTo(head.baseLeft.x, head.baseLeft.y);
            context.lineTo(head.baseRight.x, head.baseRight.y);
            context.closePath?.();
            context.fill();
          }
        }
        if (drawing.tool === "measure") { context.font = canvasMonoFont(11); context.fillText(`${Math.abs(drawing.anchors[1].price - drawing.anchors[0].price).toFixed(2)}`, points[1].x + 6, points[1].y - 6); }
      }
      if (drawing.tool === "rectangle" && points[1]) { context.strokeRect(points[0].x, points[0].y, points[1].x - points[0].x, points[1].y - points[0].y); }
      if (drawing.tool === "parallel-channel" && points[1]) {
        context.beginPath(); context.moveTo(points[0].x, points[0].y); context.lineTo(points[1].x, points[1].y); context.stroke();
        if (points[2]) {
          const channel = parallelChannelGeometry(points[0], points[1], points[2]);
          context.beginPath(); context.moveTo(channel.parallel[0].x, channel.parallel[0].y); context.lineTo(channel.parallel[1].x, channel.parallel[1].y); context.stroke();
        }
      }
      if (drawing.tool === "fibonacci" && points[1]) {
        context.setLineDash([5, 4]);
        const levels = fibonacciLevels(points[0], points[1]);
        for (const level of levels) {
          if (!Number.isFinite(level.y)) continue;
          context.beginPath(); context.moveTo(0, level.y); context.lineTo(width, level.y); context.stroke();
          context.setLineDash([]);
          context.setLineDash([5, 4]);
        }
        const fibRows = fibonacciLabelRows(levels.map((level) => ({
          ratio: level.ratio,
          price: Number.isFinite(drawing.anchors[0]?.price) && Number.isFinite(drawing.anchors[1]?.price)
            ? drawing.anchors[0].price + (drawing.anchors[1].price - drawing.anchors[0].price) * level.ratio
            : Number.NaN,
          y: level.y,
        })));
        const plot = labelPlot(width, height, plotWidth, plotHeight);
        const bounds = {
          x: Math.min(points[0].x, points[1].x),
          y: Math.min(points[0].y, points[1].y),
          width: Math.abs(points[1].x - points[0].x),
          height: Math.abs(points[1].y - points[0].y),
        };
        const targets = [points[0], points[1]].filter(finiteLabelPoint);
        const avoidRects = targets.map((point) => ({ x: point.x - 22, y: point.y - 22, width: 44, height: 44 }));
        paintDrawingLabelLayout(
          context,
          drawingLabelLayout(context, fibRows, bounds, plot, targets, avoidRects, points[1]),
          drawing.style.color,
          undefined,
          { drawingId: drawing.id, onFallback: onLabelFallback },
        );
      }
      if (drawing.tool === "vertical-line") { context.setLineDash([6, 5]); context.beginPath(); context.moveTo(points[0].x, 0); context.lineTo(points[0].x, height); context.stroke(); }
      if (drawing.tool === "horizontal-line" || drawing.tool === "price-label") {
        context.setLineDash([6, 5]); context.beginPath(); context.moveTo(0, points[0].y); context.lineTo(width, points[0].y); context.stroke();
        if (drawing.tool === "price-label") { context.setLineDash([]); context.fillRect(width - 54, points[0].y - 10, 54, 20); context.fillStyle = "#ffffff"; context.font = canvasMonoFont(11, 400); context.fillText(drawing.anchors[0].price.toFixed(2), width - 48, points[0].y + 4); }
      }
      if (drawing.tool === "text") {
        const fontSize = drawing.fontSize ?? 14;
        const hasCardPosition =
          Number.isFinite(drawing.canvasX) && Number.isFinite(drawing.canvasY);
        // Legacy anchored cards intentionally retain their old geometry. New
        // normalized cards are constrained to the actual plot pane while the
        // backing canvas and stored coordinates remain unchanged.
        const textPlotWidth = hasCardPosition && Number.isFinite(plotWidth)
          ? Math.min(width, Math.max(1, plotWidth as number))
          : width;
        const textPlotHeight = hasCardPosition && Number.isFinite(plotHeight)
          ? Math.min(height, Math.max(1, plotHeight as number))
          : height;
        const layout = textCardLayout(
          drawing.text ?? "关键位",
          drawing.textWidth ?? 180,
          fontSize,
          textPlotWidth,
          !hasCardPosition || expandedTextIds?.has(drawing.id) === true,
          hasCardPosition ? Math.max(1, textPlotHeight - 8) : Number.POSITIVE_INFINITY,
          hasCardPosition ? textCardLayoutOptions.controlWidth : 0,
          hasCardPosition ? textCardLayoutOptions.controlHeight : 0,
        );
        const anchorPoint = drawing.anchors[0]
          ? pointFor(drawing.anchors[0])
          : primaryPoint;
        const geometry = hasCardPosition
          ? textCardGeometry(
              anchorPoint,
              primaryPoint,
              layout,
              textPlotWidth,
              textPlotHeight,
            )
          : {
              x: primaryPoint.x,
              y: primaryPoint.y,
              width: layout.width,
              height: layout.height,
              anchor: anchorPoint,
              connectorStart: anchorPoint,
              connectorEnd: anchorPoint,
            };
        const hasAnchoredCard =
          drawing.placement !== "canvas" &&
          drawing.anchors.length > 0 &&
          hasCardPosition;
        const auxiliaryColor = drawing.style.color === DEFAULT_TEXT_COLOR
          ? DEFAULT_TEXT_AUXILIARY_COLOR
          : drawing.style.color;
        const textWidth = geometry.width;
        const boxHeight = geometry.height;
        if (drawing.background && drawing.background !== "transparent") {
          context.fillStyle = drawing.background;
          context.fillRect(geometry.x, geometry.y, textWidth, boxHeight);
        }
        // Paint the connector after the card surface so an anchor that starts
        // inside the card still has a visible edge-to-anchor line.
        if (
          hasAnchoredCard &&
          (geometry.connectorStart.x !== geometry.connectorEnd.x ||
            geometry.connectorStart.y !== geometry.connectorEnd.y) &&
          typeof context.beginPath === "function" &&
          typeof context.moveTo === "function" &&
          typeof context.lineTo === "function" &&
          typeof context.stroke === "function"
        ) {
          context.save?.();
          context.globalAlpha = drawing.style.opacity * 0.72;
          context.strokeStyle = auxiliaryColor;
          context.lineWidth = 1;
          context.setLineDash([]);
          context.beginPath();
          context.moveTo(geometry.connectorStart.x, geometry.connectorStart.y);
          context.lineTo(geometry.connectorEnd.x, geometry.connectorEnd.y);
          context.stroke();
          context.restore?.();
        }
        if (
          hasAnchoredCard &&
          typeof context.strokeRect === "function"
        ) {
          context.strokeStyle = auxiliaryColor;
          context.lineWidth = 1;
          context.strokeRect(geometry.x, geometry.y, textWidth, boxHeight);
        }
        const cardNumber = cardNumberById.get(drawing.id);
        if (hasAnchoredCard && cardNumber !== undefined) {
          context.fillStyle = auxiliaryColor;
          context.font = canvasMonoFont(12, 600);
          context.fillText(String(cardNumber), geometry.x + Math.max(4, textWidth - 18), geometry.y + 14);
        }
        const selectedText = includeSelection && drawing.id === selectedDrawingId;
        const expandedText = expandedTextIds?.has(drawing.id) === true;
        context.globalAlpha = selectedText ? 0 : drawing.style.opacity;
        context.fillStyle = drawing.style.color;
        context.font = canvasTextFont(fontSize);
        // Expanded cards are rendered by the scrollable DOM layer. Keeping
        // the bounded canvas lines underneath would leave an ellipsis tail
        // visible in the ordinary (unselected) state.
        // Interactive expanded cards are replaced by the scrollable DOM layer.
        // Capture/export has no DOM layer, so it must keep painting its text.
        if (!expandedText || !includeSelection) {
          layout.lines.forEach((line, index) => context.fillText(line, geometry.x + textCardLayoutOptions.horizontalPadding, geometry.y + fontSize + index * layout.lineHeight));
        }
        if (includeSelection && drawing.id === selectedDrawingId) {
          const linkColor = typeof document !== "undefined"
            ? getComputedStyle(document.documentElement).getPropertyValue("--link").trim() || "#8cbdff"
            : "#8cbdff";
          context.save?.();
          context.globalAlpha = 1;
          context.strokeStyle = linkColor;
          context.lineWidth = 1;
          context.strokeRect(geometry.x, geometry.y, textWidth, boxHeight);
          if (selectionPulse > 0 && selectionPulse < 1) {
            context.globalAlpha = 1 - selectionPulse;
            context.strokeRect(geometry.x - selectionPulse * 4, geometry.y - selectionPulse * 4, textWidth + selectionPulse * 8, boxHeight + selectionPulse * 8);
          }
          context.restore?.();
        }
      }
      if ((drawing.tool === "long-risk-reward" || drawing.tool === "short-risk-reward") && points[1] && points[2]) {
        const left = Math.min(points[0].x, points[1].x, points[2].x); const right = Math.max(points[0].x, points[1].x, points[2].x, left + 110);
        context.globalAlpha = 0.2; context.fillStyle = "#ef5350"; context.fillRect(left, Math.min(points[0].y, points[1].y), right - left, Math.abs(points[1].y - points[0].y)); context.fillStyle = "#26a69a"; context.fillRect(left, Math.min(points[0].y, points[2].y), right - left, Math.abs(points[2].y - points[0].y));
        const [entry, stop, target] = drawing.anchors;
        const safePrice = (value: number | undefined) => typeof value === "number" && Number.isFinite(value) ? value.toFixed(2) : "Invalid price";
        let metrics: ReturnType<typeof calculateRiskReward> | null = null;
        try {
          if (entry && stop && target) {
            const next = calculateRiskReward({
              direction: drawing.tool === "long-risk-reward" ? "long" : "short",
              entry: entry.price,
              stop: stop.price,
              target: target.price,
            });
            if ([next.riskPerShare, next.rewardPerShare, next.riskPercent, next.rewardPercent, next.ratio].every(Number.isFinite)) {
              metrics = next;
            }
          }
        } catch {
          metrics = null;
        }
        const rows = riskRewardLabelRows(metrics ? {
          entry: `入场 ${safePrice(entry?.price)}`,
          stop: `止损 ${safePrice(stop?.price)}`,
          target: `目标 ${safePrice(target?.price)}`,
          risk: `风险距离 ${metrics.riskPerShare.toFixed(2)} (${metrics.riskPercent.toFixed(2)}%)`,
          reward: `收益距离 ${metrics.rewardPerShare.toFixed(2)} (${metrics.rewardPercent.toFixed(2)}%)`,
          ratio: `${metrics.ratio.toFixed(2)}R`,
        } : {
          entry: `入场 ${safePrice(entry?.price)}`,
          stop: `止损 ${safePrice(stop?.price)}`,
          target: `目标 ${safePrice(target?.price)}`,
          risk: "风险距离 Invalid",
          reward: "收益距离 Invalid",
          ratio: "Invalid ratio",
        });
        const plot = labelPlot(width, height, plotWidth, plotHeight);
        const bounds = riskRewardBounds(points);
        if (bounds) {
          // The width handle is an independent interactive target just like
          // the three price anchors. Keep every one in the placement obstacle
          // set so a readable label surface never covers a control.
          const targets = [...points.slice(0, 3), bounds.widthHandle].filter(finiteLabelPoint);
          const avoidRects = targets.map((point) => ({ x: point.x - 22, y: point.y - 22, width: 44, height: 44 }));
          const plannedRows = metrics && Number.isFinite(Number(plannedRiskAmount)) && Number(plannedRiskAmount) > 0 && metrics.riskPerShare > 0
            ? [
              { id: "planned-risk", text: `计划风险 ${localizedCurrency(Number(plannedRiskAmount), currency)}`, kind: "value" as const },
              { id: "potential-reward", text: `潜在收益 ${localizedCurrency(Number(plannedRiskAmount) * metrics.ratio, currency)}`, kind: "value" as const },
              { id: "suggested-quantity", text: `建议数量 ${Math.floor(Number(plannedRiskAmount) / metrics.riskPerShare)}`, kind: "value" as const },
            ]
            : [];
          // Planned rows are part of the same label surface. Measuring them
          // here makes surface height, overflow and endpoint avoidance account
          // for every visible line instead of painting a second unchecked
          // block below a six-row core surface.
          const labelRows = [...rows, ...plannedRows];
          const labelLayout = drawingLabelLayout(
            context,
            labelRows,
            { x: bounds.left, y: bounds.top, width: Math.max(0, bounds.right - bounds.left), height: Math.max(0, bounds.bottom - bounds.top) },
            plot,
            targets,
            avoidRects,
            points[2],
          );
          paintDrawingLabelLayout(context, labelLayout, "#e6edf7", (row) =>
            row.id === "stop" || row.id === "risk" ? "#ef8b8b" : row.id === "target" || row.id === "reward" ? "#73d6ba" : "#e6edf7",
            { drawingId: drawing.id, onFallback: onLabelFallback },
          );
        }
      }
      // Hover is a lightweight preview: it never exposes handles or starts a
      // gesture. Selection feedback below remains the durable operation layer.
      if (includeSelection && drawing.id === hoveredDrawingId && drawing.id !== selectedDrawingId && drawing.tool !== "long-risk-reward" && drawing.tool !== "short-risk-reward" && drawing.tool !== "text") {
        const linkColor = typeof document !== "undefined"
          ? getComputedStyle(document.documentElement).getPropertyValue("--link").trim() || "#8cbdff"
          : "#8cbdff";
        context.save?.();
        context.globalAlpha = 0.55;
        context.strokeStyle = linkColor;
        context.lineWidth = 1;
        context.setLineDash([]);
        if (drawing.tool === "horizontal-line" || drawing.tool === "price-label") {
          context.beginPath(); context.moveTo(0, points[0].y); context.lineTo(width, points[0].y); context.stroke();
        } else if (drawing.tool === "vertical-line") {
          context.beginPath(); context.moveTo(points[0].x, 0); context.lineTo(points[0].x, height); context.stroke();
        } else if (drawing.tool === "rectangle" && points[1]) {
          context.strokeRect(Math.min(points[0].x, points[1].x), Math.min(points[0].y, points[1].y), Math.abs(points[1].x - points[0].x), Math.abs(points[1].y - points[0].y));
        } else if (drawing.tool === "parallel-channel" && points[1] && points[2]) {
          const channel = parallelChannelGeometry(points[0], points[1], points[2]);
          for (const line of [channel.base, channel.parallel]) {
            context.beginPath(); context.moveTo(line[0].x, line[0].y); context.lineTo(line[1].x, line[1].y); context.stroke();
          }
        } else if (points[1]) {
          context.beginPath(); context.moveTo(points[0].x, points[0].y); context.lineTo(points[1].x, points[1].y); context.stroke();
        } else if (points[0]) {
          context.beginPath(); context.arc(points[0].x, points[0].y, 4, 0, Math.PI * 2); context.stroke();
        }
        context.restore?.();
      }
      // Keep non-risk selection feedback tied to the object's real anchor set.
      if (includeSelection && drawing.id === selectedDrawingId && drawing.tool !== "long-risk-reward" && drawing.tool !== "short-risk-reward" && drawing.tool !== "text") {
        const linkColor = typeof document !== "undefined"
          ? getComputedStyle(document.documentElement).getPropertyValue("--link").trim() || "#8cbdff"
          : "#8cbdff";
        const handleIndexes = drawing.tool === "horizontal-line" || drawing.tool === "vertical-line" || drawing.tool === "price-label"
          ? [0]
          : points.map((_, index) => index);
        context.save?.();
        context.globalAlpha = 1;
        context.strokeStyle = linkColor;
        context.lineWidth = 2;
        for (const index of handleIndexes) {
          const point = points[index];
          if (!point) continue;
          context.fillStyle = "#17202b";
          context.beginPath();
          context.arc(point.x, point.y, 3, 0, Math.PI * 2);
          context.fill();
          context.stroke();
          if (selectionPulse > 0 && selectionPulse < 1) {
            context.globalAlpha = 1 - selectionPulse;
            context.beginPath();
            context.arc(point.x, point.y, 6 + selectionPulse * 4, 0, Math.PI * 2);
            context.stroke();
            context.globalAlpha = 1;
          }
        }
        context.restore?.();
      }
      // Keep compatibility with lightweight test canvases that only expose
      // the drawing primitives used by the legacy renderer.
      context.globalAlpha = 1;
    }
    // Selection feedback is a separate auxiliary pass so a later drawing's
    // body cannot cover the selected risk handles or its hover outline.
    if (includeSelection) {
      const feedbackDrawings = visibleDrawings.filter((drawing) =>
        !drawing.hidden && (drawing.tool === "long-risk-reward" || drawing.tool === "short-risk-reward"),
      ).sort((a, b) => Number(a.id === selectedDrawingId) - Number(b.id === selectedDrawingId));
      for (const drawing of feedbackDrawings) {
        const points = drawing.anchors.map(pointFor);
        const bounds = riskRewardBounds(points);
        if (!bounds) continue;
        const linkColor = typeof document !== "undefined"
          ? getComputedStyle(document.documentElement).getPropertyValue("--link").trim() || "#8cbdff"
          : "#8cbdff";
        if (drawing.id === hoveredDrawingId && drawing.id !== selectedDrawingId && !drawing.locked) {
          context.save?.();
          context.globalAlpha = 0.55;
          context.strokeStyle = linkColor;
          context.lineWidth = 1;
          context.strokeRect(bounds.left, bounds.top, bounds.right - bounds.left, bounds.bottom - bounds.top);
          context.restore?.();
        }
        if (drawing.id !== selectedDrawingId) continue;
        context.save?.();
        context.globalAlpha = 1;
        context.strokeStyle = linkColor;
        context.lineWidth = drawing.locked ? 1 : 2;
        context.strokeRect(bounds.left, bounds.top, bounds.right - bounds.left, bounds.bottom - bounds.top);
        if (drawing.locked) {
          context.fillStyle = linkColor;
          context.font = canvasTextFont(11);
          context.fillText("只读", Math.max(4, Math.min(width - 30, bounds.right - 28)), Math.max(12, bounds.top - 5));
        } else {
          const active = activeRiskGesture?.drawingId === drawing.id ? activeRiskGesture.handle : null;
          for (const [index, point] of points.slice(0, 3).entries()) {
            context.fillStyle = active?.kind === "price" && active.anchorIndex === index ? linkColor : "#17202b";
            context.beginPath();
            context.arc(point.x, point.y, 3, 0, Math.PI * 2);
            context.fill();
            context.stroke();
          }
          const { x, y } = bounds.widthHandle;
          context.fillStyle = active?.kind === "width" ? linkColor : "#17202b";
          context.fillRect(x - 2, y - 4, 4, 8);
          context.strokeRect(x - 2, y - 4, 4, 8);
          // Independent horizontal cues distinguish time width from price adjustment.
          context.beginPath();
          context.moveTo(x - 4, y); context.lineTo(x - 8, y);
          context.moveTo(x - 6, y - 2); context.lineTo(x - 8, y); context.lineTo(x - 6, y + 2);
          context.moveTo(x + 4, y); context.lineTo(x + 8, y);
          context.moveTo(x + 6, y - 2); context.lineTo(x + 8, y); context.lineTo(x + 6, y + 2);
          context.stroke();
          if (selectionPulse > 0 && selectionPulse < 1) {
            context.globalAlpha = 1 - selectionPulse;
            for (const point of [...points.slice(0, 3), bounds.widthHandle]) {
              context.beginPath();
              context.arc(point.x, point.y, 6 + selectionPulse * 4, 0, Math.PI * 2);
              context.stroke();
            }
          }
        }
        context.restore?.();
      }
    }
}

export type DrawingCanvasHandle = {
  /** Render the visible drawings without selection/editor controls. */
  captureOverlay(scale?: number): Promise<HTMLCanvasElement>;
  /** Commit a focused editor before a caller captures the chart. */
  commitText(): boolean;
  /** Snapshot view-only expand/collapse state for canonical capture. */
  getExpandedTextIds(): string[];
};

function drawingId() {
  return `drawing-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function canvasTextMeasure(context: CanvasRenderingContext2D, value: string) {
  return typeof context.measureText === "function"
    ? context.measureText(value).width
    : value.length * 7;
}

const DRAWING_LABEL_FONT_SIZE = 12;
const DRAWING_LABEL_LINE_HEIGHT = 18;
const DRAWING_LABEL_PADDING = 6;

function finiteLabelPoint(point: ProjectedPoint | undefined): point is LabelPoint {
  return Boolean(point && Number.isFinite(point.x) && Number.isFinite(point.y));
}

function labelPlot(width: number, height: number, plotWidth?: number, plotHeight?: number): LabelRect {
  return {
    x: 0,
    y: 0,
    width: Math.max(1, Math.min(width, Number.isFinite(plotWidth) ? plotWidth as number : width)),
    height: Math.max(1, Math.min(height, Number.isFinite(plotHeight) ? plotHeight as number : height)),
  };
}

function paintDrawingLabelLayout(
  context: CanvasRenderingContext2D,
  layout: ReturnType<typeof layoutDrawingLabels>,
  color: string,
  rowColor?: (row: DrawingLabelRow) => string,
  fallback?: {
    drawingId: string;
    onFallback?: (value: DrawingLabelFallback) => void;
    additionalRows?: readonly DrawingLabelRow[];
  },
) {
  const position = layout.bestPosition;
  if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.y)) return false;
  const safeWidth = Math.max(0, Number.isFinite(position.width) ? position.width : 0);
  const safeHeight = Math.max(0, Number.isFinite(position.height) ? position.height : 0);
  const needsFallback = Boolean(
    fallback?.onFallback && (!layout.nonOverlapping || layout.overflow.width || layout.overflow.height),
  );
  if (needsFallback) {
    const extraRows = fallback?.additionalRows ?? [];
    const rows = [...position.rows, ...extraRows.map((row) => ({
      ...row,
      lines: [row.text],
      width: Math.max(0, canvasTextMeasure(context, row.text)),
      height: DRAWING_LABEL_LINE_HEIGHT,
    }))];
    fallback?.onFallback?.({
      drawingId: fallback.drawingId,
      rows,
      x: position.x,
      y: position.y,
      width: safeWidth,
      height: safeHeight,
    });
    // The interactive DOM fallback owns the readable surface. Capture/export
    // does not pass this callback and therefore keeps the complete canvas
    // rendering below.
    return true;
  }
  context.save?.();
  context.globalAlpha = 0.94;
  if (position.surface === "surface") {
    context.fillStyle = "rgba(16, 23, 34, 0.9)";
    context.fillRect(position.x, position.y, safeWidth, safeHeight);
    context.strokeStyle = "rgba(140, 189, 255, 0.45)";
    context.lineWidth = 1;
    context.strokeRect(position.x, position.y, safeWidth, safeHeight);
  }
  if (position.leader && finiteLabelPoint(position.leader.from) && finiteLabelPoint(position.leader.to) &&
      (position.leader.from.x !== position.leader.to.x || position.leader.from.y !== position.leader.to.y)) {
    context.globalAlpha = 0.72;
    context.strokeStyle = color;
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(position.leader.from.x, position.leader.from.y);
    context.lineTo(position.leader.to.x, position.leader.to.y);
    context.stroke();
  }
  context.globalAlpha = 1;
  context.font = canvasMonoFont(DRAWING_LABEL_FONT_SIZE, 500);
  let rowOffset = DRAWING_LABEL_PADDING;
  for (const row of position.rows) {
    context.fillStyle = rowColor?.(row) ?? color;
    for (const line of row.lines) {
      const baseline = position.y + rowOffset + DRAWING_LABEL_FONT_SIZE;
      if (Number.isFinite(baseline)) context.fillText(line, position.x + DRAWING_LABEL_PADDING, baseline);
      rowOffset += DRAWING_LABEL_LINE_HEIGHT;
    }
  }
  context.restore?.();
  return false;
}

function drawingLabelLayout(
  context: CanvasRenderingContext2D,
  rows: readonly DrawingLabelRow[],
  geometryBounds: LabelRect,
  plot: LabelRect,
  endpointTargets: readonly LabelPoint[],
  avoidRects: readonly LabelRect[],
  leaderTarget?: LabelPoint,
) {
  return layoutDrawingLabels({
    rows,
    geometryBounds,
    plot,
    endpointTargets,
    avoidRects,
    leaderTarget,
    priceAxis: plot.width < context.canvas?.width
      ? { x: plot.width, y: 0, width: Math.max(0, context.canvas.width - plot.width), height: plot.height }
      : undefined,
    measure: (text) => canvasTextMeasure(context, text),
    fontSize: DRAWING_LABEL_FONT_SIZE,
    lineHeight: DRAWING_LABEL_LINE_HEIGHT,
    padding: DRAWING_LABEL_PADDING,
  });
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
  onDrawingInteractionStart,
  coordinateAdapter,
  coordinateVersion = FALLBACK_ADAPTER_VERSION,
  defaultTextPlacement = "anchor",
  allowFutureAnchors = false,
  multilineText = false,
  plotBounds,
}, forwardedRef) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const startAnchorRef = useRef<DrawingAnchor | null>(null);
  const parallelDraftRef = useRef<{ first: DrawingAnchor; second: DrawingAnchor } | null>(null);
  const creationRef = useRef<CreationState | null>(null);
  const textCreationRef = useRef<TextCreationState | null>(null);
  const selectedDrawingIdRef = useRef(selectedDrawingId);
  const previousActiveToolRef = useRef(activeTool);
  const dragRef = useRef<DragState | null>(null);
  const previewRef = useRef<NormalizedDrawing | null>(null);
  const gestureHandlersRef = useRef<GestureHandlers | null>(null);
  const compositionRef = useRef(false);
  const cancelEditorRef = useRef(false);
  const commitTextRef = useRef<() => boolean>(() => true);
  const capturedPointerRef = useRef<{
    target: Element;
    pointerId: number;
  } | null>(null);
  const dragSelectionBeforeRef = useRef<string | null>(null);
  const dragSelectionCapturedRef = useRef(false);
  const suppressSelectionPulseRef = useRef<string | null>(null);
  const selectionPulseRafRef = useRef<number | null>(null);
  const pickingAnchorRef = useRef(false);
  const [size, setSize] = useState<CanvasSize>({ width: 0, height: 0 });
  const [preview, setPreview] = useState<NormalizedDrawing | null>(null);
  const [creationStatus, setCreationStatus] = useState<string | null>(null);
  const [editor, setEditor] = useState<TextEditor | null>(null);
  const [pickingAnchor, setPickingAnchor] = useState(false);
  const [expandedTextIds, setExpandedTextIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [validationError, setValidationError] = useState<string | null>(
    null,
  );
  const [coarsePointer, setCoarsePointer] = useState(false);
  const [narrowViewport, setNarrowViewport] = useState(false);
  const [hoveredDrawingId, setHoveredDrawingId] = useState<string | null>(null);
  const [riskHoverCursor, setRiskHoverCursor] = useState<string | null>(null);
  const [selectionPulse, setSelectionPulse] = useState(0);
  const [activeRiskGesture, setActiveRiskGesture] = useState<{ drawingId: string; handle: RiskHandle } | null>(null);
  const [activeTextGesture, setActiveTextGesture] = useState<{ drawingId: string; kind: "move" | "anchor" } | null>(null);
  const [draggingDrawingId, setDraggingDrawingId] = useState<string | null>(null);
  const [labelFallbacks, setLabelFallbacks] = useState<DrawingLabelFallback[]>([]);
  const [focusedRiskControl, setFocusedRiskControl] = useState<string | null>(null);
  const [focusedTextControl, setFocusedTextControl] = useState<string | null>(null);
  selectedDrawingIdRef.current = selectedDrawingId;
  const cancelGesture = useCallback(() => {
    // cancellation is also handled by the native stage listeners below
    if (dragSelectionCapturedRef.current) {
      const previousSelection = dragSelectionBeforeRef.current;
      // A cancel is authoritative even when no move event was delivered. The
      // prior identity must be restored, while suppressing only the pulse
      // caused by that restoration. A same-id cancel has no effect to suppress.
      if (previousSelection !== selectedDrawingIdRef.current) {
        suppressSelectionPulseRef.current = previousSelection;
        onSelectDrawing(previousSelection);
      } else {
        suppressSelectionPulseRef.current = null;
      }
    }
    dragRef.current = null;
    setActiveRiskGesture(null);
    setActiveTextGesture(null);
    setDraggingDrawingId(null);
    setRiskHoverCursor(null);
    previewRef.current = null;
    startAnchorRef.current = null;
    parallelDraftRef.current = null;
    creationRef.current = null;
    textCreationRef.current = null;
    setPreview(null);
    setCreationStatus(null);
    dragSelectionBeforeRef.current = null;
    dragSelectionCapturedRef.current = false;
  }, [onSelectDrawing]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }
    const media = window.matchMedia("(pointer: coarse)");
    const narrow = window.matchMedia("(max-width: 640px)");
    const update = () => setCoarsePointer(media.matches);
    const updateNarrow = () => setNarrowViewport(narrow.matches);
    update();
    updateNarrow();
    media.addEventListener?.("change", update);
    narrow.addEventListener?.("change", updateNarrow);
    return () => {
      media.removeEventListener?.("change", update);
      narrow.removeEventListener?.("change", updateNarrow);
    };
  }, []);
  useLayoutEffect(() => {
    const stage = canvasRef.current?.closest<HTMLElement>(".chart-stage");
    if (!stage || activeTool !== "cursor" || !riskHoverCursor) return;
    const previousCursor = stage.style.cursor;
    stage.style.cursor = riskHoverCursor;
    return () => { stage.style.cursor = previousCursor; };
  }, [activeTool, riskHoverCursor]);
  const { minPrice, maxPrice, priceRange } = priceRangeForCandles(candles);
  const boundedPlot = useMemo<ChartPlotBounds>(() => {
    const width = Number.isFinite(plotBounds?.width)
      ? Math.min(size.width, Math.max(1, plotBounds!.width))
      : size.width;
    const height = Number.isFinite(plotBounds?.height)
      ? Math.min(size.height, Math.max(1, plotBounds!.height))
      : size.height;
    return { width: Math.max(0, width), height: Math.max(0, height) };
  }, [plotBounds, size.height, size.width]);

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

  function textGeometryForDrawing(
    drawing: NormalizedDrawing,
    expanded = expandedTextIds.has(drawing.id),
  ) {
    const hasCardPosition =
      Number.isFinite(drawing.canvasX) && Number.isFinite(drawing.canvasY);
    const textWidth = hasCardPosition ? boundedPlot.width : size.width;
    const textHeight = hasCardPosition ? boundedPlot.height : size.height;
    const layout = textCardLayout(
      drawing.text ?? "关键位",
      drawing.textWidth ?? 180,
      drawing.fontSize ?? 14,
      textWidth,
      !hasCardPosition || expanded,
      hasCardPosition ? Math.max(1, textHeight - 8) : Number.POSITIVE_INFINITY,
      hasCardPosition ? textCardLayoutOptions.controlWidth : 0,
      hasCardPosition ? textCardLayoutOptions.controlHeight : 0,
    );
    const cardPoint = pointForDrawing(drawing);
    const anchorPoint = drawing.anchors[0]
      ? pointFor(drawing.anchors[0])
      : cardPoint;
    const geometry = hasCardPosition
      ? textCardGeometry(
          anchorPoint,
          cardPoint,
          layout,
          textWidth,
          textHeight,
        )
      : {
          x: cardPoint.x,
          y: cardPoint.y,
          width: layout.width,
          height: layout.height,
          anchor: anchorPoint,
          connectorStart: anchorPoint,
          connectorEnd: anchorPoint,
        };
    return {
      layout,
      geometry,
    };
  }

  function textEditorFrame(editorValue: string, editorWidth: number, fontSize: TextEditor["fontSize"], x: number, y: number) {
    const measuredWidth = textLayout(editorValue, editorWidth, fontSize, Math.max(1, boundedPlot.width - 8)).width;
    // The editor is an independent editing surface. A 36px card remains
    // compact on the chart, but its controls get enough room to operate.
    // The width is deliberately independent of the persisted textWidth.
    const availableWidth = Math.max(1, boundedPlot.width - 4);
    const width = Math.max(
      measuredWidth,
      EDITOR_MIN_WIDTH,
      Math.min(EDITOR_CONTROLS_MIN_WIDTH, availableWidth),
    );
    const maxLeft = Math.max(2, boundedPlot.width - width - 2);
    const left = Math.max(2, Math.min(maxLeft, x + 4));
    const controlHeight = coarsePointer || narrowViewport
      ? EDITOR_TOUCH_STYLE_BAR_HEIGHT
      : EDITOR_STYLE_BAR_HEIGHT;
    // At a narrow chart boundary the controls wrap into a second/third row;
    // reserving those rows in the grid keeps them reachable instead of
    // clipping them inside the one-line toolbar.
    const styleRows = width < 360 ? 3 : width < EDITOR_CONTROLS_MIN_WIDTH ? 2 : 1;
    const styleBarHeight = controlHeight * styleRows;
    const lineHeight = Math.max(18, Math.round(fontSize * 1.5));
    const measuredLines = textLayout(
      editorValue,
      editorWidth,
      fontSize,
      Math.max(1, boundedPlot.width - 8),
    ).lines.length;
    // Give the textarea one complete line plus its border/padding, and use
    // the available space for up to three lines. Longer text stays editable
    // through the textarea's own vertical scroll container.
    const visibleLines = Math.max(1, Math.min(3, measuredLines));
    const textareaMinHeight = lineHeight + EDITOR_TEXTAREA_VERTICAL_INSET;
    const textareaHeight = visibleLines * lineHeight + EDITOR_TEXTAREA_VERTICAL_INSET;
    const preferredHeight = styleBarHeight + textareaHeight + EDITOR_HINT_HEIGHT + EDITOR_VERTICAL_GAP * 2;
    const maxTop = Math.max(2, boundedPlot.height - preferredHeight - 2);
    const top = Math.max(2, Math.min(maxTop, y - 24));
    const maxHeight = Math.max(1, boundedPlot.height - top - 2);
    const height = Math.min(preferredHeight, maxHeight);
    return {
      style: { width, left, top, maxHeight, height },
      styleBarHeight,
      controlHeight,
      lineHeight,
      textareaHeight,
      textareaMinHeight,
      hintHeight: EDITOR_HINT_HEIGHT,
    };
  }

  function textDefaults(drawing?: NormalizedDrawing) {
    return {
      placement: drawing?.placement ?? defaultTextPlacement,
      // New drawings receive an initial canvas position, while legacy
      // drawings retain the absence of these fields until the user explicitly
      // changes their placement or drags a card.
      canvasX: drawing ? drawing.canvasX : 0.08,
      canvasY: drawing ? drawing.canvasY : 0.12,
      textWidth: drawing?.textWidth ?? 180,
      fontSize: drawing?.fontSize ?? 14,
      background: drawing?.background ?? (
        drawing
          ? "transparent"
          : defaultTextPlacement === "anchor"
            ? DEFAULT_TEXT_CARD_BACKGROUND
            : "transparent"
      ),
      color: drawing?.style.color ?? DEFAULT_TEXT_COLOR,
    } as const;
  }

  function textCreationPreview(anchor: DrawingAnchor, labelPoint: ProjectedPoint) {
    return normalized({
      id: "__text-creation-preview__",
      tool: "text",
      anchors: [anchor],
      placement: "anchor",
      canvasX: size.width > 0 ? labelPoint.x / size.width : 0.08,
      canvasY: size.height > 0 ? labelPoint.y / size.height : 0.12,
      text: "文字批注",
      textWidth: 180,
      fontSize: 14,
      background: DEFAULT_TEXT_CARD_BACKGROUND,
      style: styleFor("text"),
      hidden: false,
      locked: false,
      visibleOn: "all",
      stage: "during-replay",
    });
  }

  function setTextCreationPreview(anchor: DrawingAnchor, labelPoint: ProjectedPoint) {
    const nextPreview = textCreationPreview(anchor, labelPoint);
    previewRef.current = nextPreview;
    setPreview(nextPreview);
    setCreationStatus(
      `已取锚点 ${anchor.price.toFixed(2)} · ${anchor.time}；移动到标签位置后再次点击编辑`,
    );
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
    const normalizedDrawing = normalized(drawing);
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
    const normalizedDrawing = { ...drawing, createdAtCursor: cursor };
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
    context: CanvasRenderingContext2D, width: number, height: number,
    includeSelection: boolean, renderPreview = true,
  ) => {
    const fallbackById = new Map<string, DrawingLabelFallback>();
    paintDrawingScene(context, { width, height, drawings, pointFor, pointForDrawing,
      plannedRiskAmount, currency, selectedDrawingId, hoveredDrawingId, selectionPulse, activeRiskGesture, preview, expandedTextIds,
      plotWidth: boundedPlot.width, plotHeight: boundedPlot.height,
      onLabelFallback: includeSelection ? (fallback) => fallbackById.set(fallback.drawingId, fallback) : undefined,
    }, includeSelection, renderPreview);
    if (includeSelection) {
      const next = [...fallbackById.values()];
      setLabelFallbacks((current) => {
        if (current.length === next.length && current.every((item, index) => JSON.stringify(item) === JSON.stringify(next[index]))) return current;
        return next;
      });
    }
  },
  [activeRiskGesture, boundedPlot.height, boundedPlot.width, currency, drawings, expandedTextIds, hoveredDrawingId, plannedRiskAmount, pointFor, pointForDrawing, preview, selectedDrawingId, selectionPulse]);

  useEffect(() => {
    if (selectionPulseRafRef.current !== null) cancelAnimationFrame(selectionPulseRafRef.current);
    selectionPulseRafRef.current = null;
    setSelectionPulse(0);
    const suppressedId = suppressSelectionPulseRef.current;
    suppressSelectionPulseRef.current = null;
    if (!selectedDrawingId || suppressedId === selectedDrawingId) return;
    const reducedMotion = typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-reduced-motion: reduce)")
      : null;
    if (reducedMotion?.matches) return;
    const started = performance.now();
    const frame = (now: number) => {
      const progress = Math.min(1, (now - started) / 200);
      setSelectionPulse(progress);
      if (progress < 1) selectionPulseRafRef.current = requestAnimationFrame(frame);
      else selectionPulseRafRef.current = null;
    };
    selectionPulseRafRef.current = requestAnimationFrame(frame);
    const cancelForReducedMotion = () => {
      if (reducedMotion?.matches && selectionPulseRafRef.current !== null) {
        cancelAnimationFrame(selectionPulseRafRef.current);
        selectionPulseRafRef.current = null;
        setSelectionPulse(0);
      }
    };
    reducedMotion?.addEventListener?.("change", cancelForReducedMotion);
    return () => {
      reducedMotion?.removeEventListener?.("change", cancelForReducedMotion);
      if (selectionPulseRafRef.current !== null) cancelAnimationFrame(selectionPulseRafRef.current);
      selectionPulseRafRef.current = null;
    };
  }, [selectedDrawingId]);

  useEffect(() => () => {
    if (selectionPulseRafRef.current !== null) cancelAnimationFrame(selectionPulseRafRef.current);
  }, []);

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
    getExpandedTextIds: () => [...expandedTextIds],
  }), [expandedTextIds, renderDrawings, size]);

  function hitDrawing(point: ProjectedPoint) {
    const ordered = [...drawings].sort((a, b) => (b.zIndex ?? 0) - (a.zIndex ?? 0));
    const handleCandidates = ordered.flatMap((drawing) => {
      if (drawing.hidden || drawing.locked || (drawing.tool !== "long-risk-reward" && drawing.tool !== "short-risk-reward")) return [];
      const points = drawing.anchors.map(pointFor);
      const handle = hitRiskRewardHandle(point, points, coarsePointer);
      if (!handle) return [];
      const center = handle.kind === "price" ? points[handle.anchorIndex] : riskRewardBounds(points)!.widthHandle;
      return [{ drawing, handle, distance: Math.hypot(point.x - center.x, point.y - center.y) }];
    }).sort((left, right) => left.distance - right.distance || (right.drawing.zIndex ?? 0) - (left.drawing.zIndex ?? 0));
    if (handleCandidates[0]) return handleCandidates[0].drawing;
    const riskBodies = ordered.filter((drawing) => !drawing.hidden && (drawing.tool === "long-risk-reward" || drawing.tool === "short-risk-reward") && pointInRiskRewardArea(point, drawing.anchors.map(pointFor)))
      .map((drawing) => {
        const bounds = riskRewardBounds(drawing.anchors.map(pointFor))!;
        return { drawing, distance: Math.hypot(point.x - (bounds.left + bounds.right) / 2, point.y - (bounds.top + bounds.bottom) / 2) };
      }).sort((a, b) => a.distance - b.distance || (b.drawing.zIndex ?? 0) - (a.drawing.zIndex ?? 0));
    // Preserve other tools' existing precedence while ranking risk bodies by distance.
    const nearestRisk = riskBodies[0]?.drawing;
    return ordered.find((drawing) => {
      if (drawing.hidden) return false;
      const points = drawing.anchors.map(pointFor);
      if ((drawing.tool === "long-risk-reward" || drawing.tool === "short-risk-reward") && points.length >= 3) {
        return drawing.id === nearestRisk?.id;
      }
      if (drawing.tool === "text") {
        const { geometry } = textGeometryForDrawing(drawing);
        const insideCard = point.x >= geometry.x && point.x <= geometry.x + geometry.width && point.y >= geometry.y && point.y <= geometry.y + geometry.height;
        const anchorPoint = drawing.anchors[0] ? pointFor(drawing.anchors[0]) : null;
        const hasConnectorCoordinates = drawing.placement === "anchor" &&
          Number.isFinite(drawing.canvasX) && Number.isFinite(drawing.canvasY) &&
          Boolean(anchorPoint) &&
          (geometry.connectorStart.x !== geometry.connectorEnd.x || geometry.connectorStart.y !== geometry.connectorEnd.y);
        return insideCard ||
          Boolean(anchorPoint && isPointNearAnchorHandle(point, anchorPoint)) ||
          (hasConnectorCoordinates && isPointNearSegment(point, geometry.connectorStart, geometry.connectorEnd));
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

  function beginEdit(
    drawing: NormalizedDrawing,
    point: ProjectedPoint,
    textInteraction?: "move" | "anchor",
    forcedAnchorIndex?: number,
  ) {
    const points = drawing.anchors.map(pointFor);
    const riskHandle = (drawing.tool === "long-risk-reward" || drawing.tool === "short-risk-reward")
      ? hitRiskRewardHandle(point, points, coarsePointer)
      : null;
    const anchorIndex = drawing.tool === "text"
      ? null
      : forcedAnchorIndex !== undefined && drawing.anchors[forcedAnchorIndex]
        ? forcedAnchorIndex
      : riskHandle?.kind === "price"
        ? riskHandle.anchorIndex
        : points.findIndex((item) => isPointNearAnchorHandle(point, item));
    if (riskHandle) setActiveRiskGesture({ drawingId: drawing.id, handle: riskHandle });
    setDraggingDrawingId(drawing.id);
    setRiskHoverCursor(
      drawing.tool === "horizontal-line" || drawing.tool === "price-label"
        ? "ns-resize"
        : drawing.tool === "vertical-line"
          ? "ew-resize"
          : "grabbing",
    );
    dragRef.current = {
      drawing,
      anchorIndex: anchorIndex === null || anchorIndex < 0 ? null : anchorIndex,
      anchorAxis: drawing.tool === "horizontal-line" || drawing.tool === "price-label"
        ? "price"
        : drawing.tool === "vertical-line" ? "time" : undefined,
      textCard:
        drawing.tool === "text" &&
        drawing.placement !== "canvas" &&
        Number.isFinite(drawing.canvasX) &&
        Number.isFinite(drawing.canvasY),
      textInteraction,
      originPoint: point,
      riskHandle,
      interactionStarted: false,
    };
  }

  function openTextEditor(drawing: NormalizedDrawing) {
    if (drawing.locked) return;
    const { geometry: textGeometry } = textGeometryForDrawing(drawing);
    const defaults = textDefaults(drawing);
    setEditor({
      anchor: drawing.anchors[0] ?? anchorFromPoint(textGeometry.x, textGeometry.y),
      x: textGeometry.x,
      y: textGeometry.y,
      drawing,
      value: drawing.text ?? "",
      ...defaults,
    });
    onDrawingInteractionStart?.();
  }

  function beginTextControl(
    event: ReactPointerEvent<HTMLButtonElement>,
    drawing: NormalizedDrawing,
    interaction: "move" | "anchor",
  ) {
    event.preventDefault();
    event.stopPropagation();
    onSelectDrawing(drawing.id);
    if (drawing.locked) return;
    const point = pointFromClient(event.clientX, event.clientY);
    if (!point) return;
    beginEdit(drawing, point, interaction);
    setActiveTextGesture({ drawingId: drawing.id, kind: interaction });
    setRiskHoverCursor("grabbing");
    capturePointer(event.currentTarget, event.pointerId);
  }

  function beginRiskControlEdit(drawing: NormalizedDrawing, point: ProjectedPoint, handle: RiskHandle) {
    dragSelectionBeforeRef.current = selectedDrawingId;
    dragSelectionCapturedRef.current = true;
    dragRef.current = {
      drawing, anchorIndex: handle?.kind === "price" ? handle.anchorIndex : null,
      textCard: false, originPoint: point, riskHandle: handle, interactionStarted: false,
    };
    setActiveRiskGesture({ drawingId: drawing.id, handle });
    setDraggingDrawingId(drawing.id);
    setRiskHoverCursor(handle?.kind === "price" ? "ns-resize" : handle?.kind === "width" ? "ew-resize" : "grabbing");
    onSelectDrawing(drawing.id);
  }

  function createDrawing(first: DrawingAnchor, last: DrawingAnchor) {
    const tool = activeTool;
    if (tool === "cursor" || tool === "text" || tool === "horizontal-line" || tool === "vertical-line" || tool === "price-label") return;
    const base = { id: drawingId(), tool, anchors: [first, last], style: styleFor(tool), hidden: false, locked: false, visibleOn: "all" as const, stage: "during-replay" as const };
    if (tool === "long-risk-reward" || tool === "short-risk-reward") {
      const direction = tool === "short-risk-reward" ? "short" : "long";
      const anchors = createRiskRewardAnchors(first, last, direction);
      if (!anchors) {
        setValidationError(first.price === last.price
          ? "止损价不能等于入场价"
          : direction === "long" ? "做多止损必须低于入场价" : "做空止损必须高于入场价");
        return;
      }
      emitAdd({
        ...base,
        tool,
        anchors,
      });
      return;
    }
    emitAdd(base);
  }

  function setCreationPreview(tool: CreationState["tool"], anchors: DrawingAnchor[]) {
    const nextPreview = normalized({
      id: "__creation-preview__",
      tool,
      anchors,
      style: styleFor(tool),
      hidden: false,
      locked: false,
      visibleOn: "all",
      stage: "during-replay",
    });
    previewRef.current = nextPreview;
    setPreview(nextPreview);
    setCreationStatus(
      creationRef.current?.phase === "width"
        ? "已确定通道基线，移动或点击确定宽度"
        : "已取第一个点，移动或点击确定第二点",
    );
  }

  function clearCreationDraft() {
    creationRef.current = null;
    textCreationRef.current = null;
    startAnchorRef.current = null;
    parallelDraftRef.current = null;
    previewRef.current = null;
    setPreview(null);
    setCreationStatus(null);
  }

  function sameAnchor(left: DrawingAnchor, right: DrawingAnchor) {
    return left.time === right.time && left.price === right.price;
  }

  function commitText(): boolean {
    if (!editor) return true;
    if (pickingAnchor || pickingAnchorRef.current) return false;
    // Prevent the textarea blur caused by closing the editor from committing
    // the same revision a second time.
    cancelEditorRef.current = true;
    const text = editor.value;
    if (text) {
      const fields = {
        placement: editor.placement,
        textWidth: editor.textWidth,
        fontSize: editor.fontSize,
        background: editor.background,
        ...(Number.isFinite(editor.canvasX) && Number.isFinite(editor.canvasY)
          ? { canvasX: editor.canvasX, canvasY: editor.canvasY }
          : {}),
      } as const;
      const anchors = editor.placement === "canvas" ? [] : [editor.anchor];
      if (editor.drawing) {
        const nextDrawing = {
          ...editor.drawing,
          anchors,
          text,
          ...fields,
          style: { ...editor.drawing.style, color: editor.color },
        };
        // Some legacy records arrive with explicit undefined properties after
        // an in-memory merge. Remove them as well as preserving a genuinely
        // absent field so a text-only edit cannot migrate the drawing into a
        // canvas-positioned card.
        if (!Number.isFinite(editor.canvasX) || !Number.isFinite(editor.canvasY)) {
          delete nextDrawing.canvasX;
          delete nextDrawing.canvasY;
        }
        if (!emitReplace(nextDrawing)) {
          cancelEditorRef.current = false;
          return false;
        }
      } else {
        if (!emitAdd({ id: drawingId(), tool: "text", anchors, text, ...fields, style: { ...styleFor("text"), color: editor.color }, hidden: false, locked: false, visibleOn: "all", stage: "during-replay" })) {
          cancelEditorRef.current = false;
          return false;
        }
      }
    } else {
      setValidationError("请输入文字后再完成编辑");
      cancelEditorRef.current = false;
      return false;
    }
    setEditor(null);
    setTimeout(() => {
      cancelEditorRef.current = false;
    }, 0);
    return true;
  }

  function cancelTextEditor() {
    cancelEditorRef.current = true;
    pickingAnchorRef.current = false;
    setPickingAnchor(false);
    setValidationError(null);
    setEditor(null);
    setTimeout(() => {
      cancelEditorRef.current = false;
    }, 0);
  }

  function beginAnchorPick() {
    if (!editor) return;
    setValidationError(null);
    cancelEditorRef.current = true;
    pickingAnchorRef.current = true;
    setPickingAnchor(true);
  }

  function cancelAnchorPick() {
    pickingAnchorRef.current = false;
    setPickingAnchor(false);
    cancelEditorRef.current = false;
    setValidationError(null);
  }

  function pickRevealedAnchor(point: ProjectedPoint) {
    if (!editor || candles.length === 0) return;
    if (
      !Number.isFinite(point.x) ||
      !Number.isFinite(point.y) ||
      point.x < 0 ||
      point.y < 0 ||
      point.x > boundedPlot.width ||
      point.y > boundedPlot.height
    ) return;
    const revealed = candles.filter((candle) => candle.time <= cursor);
    if (revealed.length === 0) return;
    const nearest = revealed.reduce((best, candle) => {
      const projected = pointFor({ time: candle.time, price: candle.close });
      const bestProjected = pointFor({ time: best.time, price: best.close });
      return Math.abs(projected.x - point.x) < Math.abs(bestProjected.x - point.x)
        ? candle
        : best;
    }, revealed[0]);
    const price = coordinateAdapter?.yToPrice(point.y);
    if (price !== undefined && !Number.isFinite(price)) return;
    const nextAnchor = {
      time: nearest.time,
      price: Number((price ?? nearest.close).toFixed(2)),
    };
    const anchorPoint = pointFor(nextAnchor);
    const draftX = Number.isFinite(editor.canvasX) ? (editor.canvasX ?? 0) * size.width : editor.x;
    const draftY = Number.isFinite(editor.canvasY) ? (editor.canvasY ?? 0) * size.height : editor.y;
    const layout = textCardLayout(
      editor.value,
      editor.textWidth,
      editor.fontSize,
      boundedPlot.width,
      editor.drawing ? expandedTextIds.has(editor.drawing.id) : false,
      Math.max(1, boundedPlot.height - 8),
      textCardLayoutOptions.controlWidth,
      textCardLayoutOptions.controlHeight,
    );
    const cardGeometry = (desired: ProjectedPoint) => textCardGeometry(anchorPoint, desired, layout, boundedPlot.width, boundedPlot.height);
    let geometry = cardGeometry({ x: draftX, y: draftY });
    const connectorLength = () => Math.hypot(geometry.connectorStart.x - geometry.connectorEnd.x, geometry.connectorStart.y - geometry.connectorEnd.y);
    const anchorOutsideCard = () => (
      anchorPoint.x < geometry.x ||
      anchorPoint.x > geometry.x + geometry.width ||
      anchorPoint.y < geometry.y ||
      anchorPoint.y > geometry.y + geometry.height
    );
    if (connectorLength() < 12 || !anchorOutsideCard()) {
      const candidates = [
        { x: anchorPoint.x + 20, y: anchorPoint.y + 20 },
        { x: anchorPoint.x - layout.width - 20, y: anchorPoint.y + 20 },
        { x: anchorPoint.x + 20, y: anchorPoint.y - layout.height - 20 },
        { x: anchorPoint.x - layout.width - 20, y: anchorPoint.y - layout.height - 20 },
      ];
      const alternative = candidates
        .map(cardGeometry)
        .find((candidate) => {
          const outside = anchorPoint.x < candidate.x ||
            anchorPoint.x > candidate.x + candidate.width ||
            anchorPoint.y < candidate.y ||
            anchorPoint.y > candidate.y + candidate.height;
          return outside && Math.hypot(candidate.connectorStart.x - candidate.connectorEnd.x, candidate.connectorStart.y - candidate.connectorEnd.y) >= 12;
        });
      if (!alternative) {
        setValidationError("关联点与文字卡片空间不足，请重新取点");
        return;
      }
      geometry = alternative;
    }
    setEditor((current) => current ? {
      ...current,
      anchor: nextAnchor,
      placement: "anchor",
      canvasX: size.width > 0 ? geometry.x / size.width : current.canvasX,
      canvasY: size.height > 0 ? geometry.y / size.height : current.canvasY,
    } : current);
    setValidationError(null);
    cancelAnchorPick();
  }

  function revealedTextAnchor(point: ProjectedPoint): DrawingAnchor | null {
    if (
      !Number.isFinite(point.x) ||
      !Number.isFinite(point.y) ||
      point.x < 0 ||
      point.y < 0 ||
      point.x > boundedPlot.width ||
      point.y > boundedPlot.height
    ) return null;
    const revealed = candles.filter((candle) => candle.time <= cursor);
    if (revealed.length === 0) return null;
    const nearest = revealed.reduce((best, candle) => {
      const projected = pointFor({ time: candle.time, price: candle.close });
      const bestProjected = pointFor({ time: best.time, price: best.close });
      return Math.abs(projected.x - point.x) < Math.abs(bestProjected.x - point.x)
        ? candle
        : best;
    }, revealed[0]);
    const price = coordinateAdapter?.yToPrice(point.y);
    if (price !== undefined && !Number.isFinite(price)) return null;
    return {
      time: nearest.time,
      price: Number((price ?? nearest.close).toFixed(2)),
    };
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (event.isComposing || event.keyCode === 229 || compositionRef.current) return;
      const hasCanvasAction = Boolean(
        pickingAnchor ||
        pickingAnchorRef.current ||
        editor ||
        dragRef.current ||
        creationRef.current ||
        textCreationRef.current ||
        startAnchorRef.current ||
        parallelDraftRef.current ||
        selectedDrawingIdRef.current,
      );
      if (!hasCanvasAction) return;
      const target = event.target as Element | null;
      const targetOwnsEscape = !editor && !pickingAnchor && Boolean(
        target?.closest?.(
          "input, textarea, [contenteditable='true'], [role='dialog'], [role='menu'], dialog[open], [aria-modal='true']",
        ) || document.querySelector("[role='menu'], dialog[open], [aria-modal='true']"),
      );
      if (targetOwnsEscape) return;
      event.preventDefault();
      event.stopPropagation();
      if (pickingAnchor || pickingAnchorRef.current) {
        cancelAnchorPick();
      } else if (editor) {
        cancelTextEditor();
      } else if (dragRef.current || creationRef.current || textCreationRef.current || startAnchorRef.current || parallelDraftRef.current) {
        cancelGesture();
        releaseCapturedPointer();
      } else if (selectedDrawingIdRef.current) {
        // Keep DOM focus on the real keyboard target, but remove its visual
        // proxy when Escape cancels the object selection.
        setFocusedTextControl(null);
        setFocusedRiskControl(null);
        onSelectDrawing(null);
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [cancelGesture, editor, onSelectDrawing, pickingAnchor]);

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

  function updateDrawingHover(clientX: number, clientY: number) {
    if (activeTool !== "cursor") {
      setHoveredDrawingId(null);
      setRiskHoverCursor(null);
      return;
    }
    const point = pointFromClient(clientX, clientY);
    if (!point) return;
    const drawing = hitDrawing(point);
    setHoveredDrawingId(drawing?.id ?? null);
    if (!drawing || drawing.locked) {
      setRiskHoverCursor(drawing?.locked ? "default" : null);
      return;
    }
    const points = drawing.anchors.map(pointFor);
    const risk = drawing.tool === "long-risk-reward" || drawing.tool === "short-risk-reward";
    const handle = risk ? hitRiskRewardHandle(point, points, coarsePointer) : null;
    const nearAnchor = points.findIndex((item) => isPointNearAnchorHandle(point, item)) >= 0;
    const cursor = handle?.kind === "price" ? "ns-resize"
      : handle?.kind === "width" ? "ew-resize"
        : drawing.tool === "horizontal-line" || drawing.tool === "price-label" ? "ns-resize"
          : drawing.tool === "vertical-line" ? "ew-resize"
            : nearAnchor ? "move" : "move";
    setRiskHoverCursor(cursor);
  }

  function handlePointerDown(clientX: number, clientY: number) {
    if (candles.length === 0) return false;
    const point = pointFromClient(clientX, clientY);
    if (!point) return false;
    if (pickingAnchorRef.current) {
      pickRevealedAnchor(point);
      return true;
    }
    // Default staged Text must bind to a revealed source bar even when the
    // chart adapter projects a blank/future x-coordinate. Other drawing tools
    // retain their existing free-anchor semantics.
    let anchor = anchorFromPoint(point.x, point.y);
    if (activeTool === "text" && multilineText) {
      const revealedAnchor = revealedTextAnchor(point);
      if (!revealedAnchor) {
        setValidationError("当前位置没有可见行情锚点");
        return true;
      }
      anchor = revealedAnchor;
    }
    if (activeTool === "cursor") {
      const drawing = hitDrawing(point);
      onSelectDrawing(drawing?.id ?? null);
      if (!drawing) return false;
      // Text selection is deliberately separate from editing and movement.
      // Dedicated DOM controls own those gestures; a card click only selects.
      if (drawing.tool === "text") return true;
      if (drawing && !drawing.locked) {
        dragSelectionBeforeRef.current = selectedDrawingId;
        dragSelectionCapturedRef.current = true;
        beginEdit(drawing, point);
      }
      return true;
    }
    if (activeTool === "text") {
      if (editor && editor.value.length > 0) {
        // A non-empty draft owns the canvas until the user explicitly
        // completes or cancels it. Do not replace it with a fresh creation
        // gesture from an outside click.
        setValidationError("请先完成或取消当前文字编辑");
        return true;
      }
      if (multilineText) {
        const pending = textCreationRef.current;
        if (pending) {
          // The second click chooses the label position. Use its current
          // projected point so a click without an intervening hover still
          // lands where the user released it.
          const labelPoint = point;
          textCreationRef.current = null;
          startAnchorRef.current = null;
          previewRef.current = null;
          setPreview(null);
          setCreationStatus(null);
          const defaults = textDefaults();
          setEditor({
            anchor: pending.anchor,
            x: labelPoint.x,
            y: labelPoint.y,
            value: "",
            ...defaults,
            placement: "anchor",
            background: DEFAULT_TEXT_CARD_BACKGROUND,
            canvasX: size.width > 0 ? labelPoint.x / size.width : defaults.canvasX,
            canvasY: size.height > 0 ? labelPoint.y / size.height : defaults.canvasY,
          });
          onDrawingInteractionStart?.();
          return true;
        }
        const anchorPoint = pointFor(anchor);
        textCreationRef.current = {
          anchor,
          anchorPoint,
          labelPoint: point,
          pointerDownPoint: point,
        };
        startAnchorRef.current = anchor;
        setTextCreationPreview(anchor, point);
        return true;
      }
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
    const creationTool = activeTool as CreationState["tool"];
    const creation = creationRef.current;
    if (creation && creation.tool === creationTool) {
      creation.pointerDownPoint = point;
      if (creation.phase === "second") {
        setCreationPreview(creation.tool, [creation.first, anchor]);
      } else {
        setCreationPreview(creation.tool, [creation.first, creation.second!, anchor]);
      }
    } else {
      creationRef.current = {
        tool: creationTool,
        first: anchor,
        phase: "second",
        firstPointConfirmed: false,
        pointerDownPoint: point,
      };
      setCreationPreview(creationTool, [anchor]);
    }
    startAnchorRef.current = creation?.tool === creationTool ? creation.first : anchor;
    return true;
  }

  function handlePointerMove(clientX: number, clientY: number) {
    const drag = dragRef.current;
    if (!drag) {
      const textCreation = textCreationRef.current;
      if (textCreation) {
        const point = pointFromClient(clientX, clientY);
        if (!point) return;
        textCreation.labelPoint = point;
        setTextCreationPreview(textCreation.anchor, point);
        return;
      }
      const creation = creationRef.current;
      if (!creation) return;
      const point = pointFromClient(clientX, clientY);
      if (!point) return;
      const anchor = anchorFromPoint(point.x, point.y);
      const anchors = creation.phase === "width"
        ? [creation.first, creation.second!, anchor]
        : [creation.first, anchor];
      setCreationPreview(creation.tool, anchors);
      return;
    }
    const point = pointFromClient(clientX, clientY);
    if (!point) return;
    const physicallyMoved = point.x !== drag.originPoint.x || point.y !== drag.originPoint.y;
    if (!physicallyMoved) {
      previewRef.current = null;
      setPreview(null);
      return;
    }
    const anchor = anchorFromPoint(point.x, point.y);
    let anchors: DrawingAnchor[];
    if (drag.drawing.tool === "text" && drag.textInteraction === "move") {
      const origin = textGeometryForDrawing(drag.drawing).geometry;
      const canvasX = size.width > 0
        ? Math.max(0, Math.min(1, (origin.x + point.x - drag.originPoint.x) / size.width))
        : drag.drawing.canvasX;
      const canvasY = size.height > 0
        ? Math.max(0, Math.min(1, (origin.y + point.y - drag.originPoint.y) / size.height))
        : drag.drawing.canvasY;
      const nextPreview = { ...drag.drawing, canvasX, canvasY };
      if (!drag.interactionStarted && physicallyMoved) {
        drag.interactionStarted = true;
        onDrawingInteractionStart?.();
      }
      previewRef.current = nextPreview;
      setPreview(nextPreview);
      return;
    }
    if (drag.drawing.tool === "text" && drag.textInteraction === "anchor") {
      const textAnchor = revealedTextAnchor(point);
      if (!textAnchor) {
        previewRef.current = null;
        setPreview(null);
        return;
      }
      anchors = drag.drawing.anchors.map((item, index) => index === 0 ? textAnchor : item);
      if (!drag.interactionStarted && physicallyMoved) {
        drag.interactionStarted = true;
        onDrawingInteractionStart?.();
      }
    } else if (
      drag.drawing.tool === "text" &&
      (drag.drawing.placement === "canvas" || drag.textCard)
    ) {
      const origin = textGeometryForDrawing(drag.drawing).geometry;
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
    if (drag.riskHandle?.kind === "width") {
      // The grip can sit on the virtual minimum-width edge while the actual
      // rightmost anchors are closer to the left edge. A vertical-only move
      // must remain a selection gesture and preserve those original times.
      if (point.x === drag.originPoint.x) {
        previewRef.current = null;
        setPreview(null);
        return;
      }
      const bounds = riskRewardBounds(drag.drawing.anchors.map(pointFor));
      const left = bounds?.left ?? Math.min(...drag.drawing.anchors.map((item) => pointFor(item).x));
      const widthX = Math.max((bounds?.right ?? point.x) + point.x - drag.originPoint.x, left + 110);
      const cursorX = coordinateAdapter?.timeToX(cursor);
      const cappedX = allowFutureAnchors || cursorX === null || cursorX === undefined ? widthX : Math.min(widthX, cursorX);
      let time = coordinateAdapter?.xToTime(cappedX) ?? anchorFromPoint(cappedX, point.y).time;
      if (!allowFutureAnchors && time > cursor) time = cursor;
      anchors = drag.drawing.anchors.map((item, index) =>
        drag.riskHandle?.kind === "width" && drag.riskHandle.anchorIndexes.includes(index) && time
          ? { ...item, time }
          : item,
      );
    } else if (drag.riskHandle?.kind === "price" && drag.anchorIndex !== null) {
      const original = drag.drawing.anchors[drag.anchorIndex];
      const originalY = pointFor(original).y;
      const deltaY = point.y - drag.originPoint.y;
      // Preserve the original price and account only for pointer displacement,
      // including rounded projections and an offset candidate/near-edge hit.
      const priceAtY = (y: number) => coordinateAdapter?.yToPrice(y) ?? (maxPrice - y / Math.max(size.height, 1) * priceRange);
      const mappedOrigin = priceAtY(originalY);
      const mappedDelta = priceAtY(originalY + deltaY);
      const price = Number((original.price + mappedDelta - mappedOrigin).toFixed(2));
      anchors = drag.drawing.anchors.map((item, index) =>
        index === drag.anchorIndex && deltaY !== 0 ? { ...item, price } : item,
      );
    } else if (drag.anchorIndex !== null) {
      anchors = drag.drawing.anchors.map((item, index) =>
        index !== drag.anchorIndex ? item : drag.anchorAxis === "price"
          ? { ...item, price: anchor.price }
          : drag.anchorAxis === "time"
            ? { ...item, time: anchor.time }
            : anchor,
      );
    } else if (drag.anchorAxis === "price") {
      anchors = drag.drawing.anchors.map((item, index) =>
        index === 0 ? { ...item, price: anchor.price } : item,
      );
    } else if (drag.anchorAxis === "time") {
      anchors = drag.drawing.anchors.map((item, index) =>
        index === 0 ? { ...item, time: anchor.time } : item,
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
    const changed = anchors.some((item, index) => {
      const original = drag.drawing.anchors[index];
      return item.time !== original?.time || item.price !== original?.price;
    });
    if (!changed) {
      previewRef.current = null;
      setPreview(null);
      return;
    }
    if (
      !drag.interactionStarted &&
      (drag.drawing.tool === "long-risk-reward" || drag.drawing.tool === "short-risk-reward") &&
      physicallyMoved
    ) {
      drag.interactionStarted = true;
      onDrawingInteractionStart?.();
    }
    const nextPreview = { ...drag.drawing, anchors };
    previewRef.current = nextPreview;
    setPreview(nextPreview);
  }

  function handlePointerUp(clientX: number, clientY: number) {
    const drag = dragRef.current;
    if (drag) {
      // The release position is authoritative. A pointerup can be the first
      // event observed after a capture handoff, so never commit the previous
      // move preview instead of the final coordinates.
      handlePointerMove(clientX, clientY);
      if (previewRef.current) emitReplace(previewRef.current);
      dragRef.current = null;
      setActiveRiskGesture(null);
      setActiveTextGesture(null);
      setDraggingDrawingId(null);
      setRiskHoverCursor(null);
      dragSelectionBeforeRef.current = null;
      dragSelectionCapturedRef.current = false;
      previewRef.current = null;
      setPreview(null);
      return;
    }
    const textCreation = textCreationRef.current;
    if (textCreation) {
      const point = pointFromClient(clientX, clientY);
      if (!point) return;
      const moved = Math.hypot(
        point.x - textCreation.pointerDownPoint.x,
        point.y - textCreation.pointerDownPoint.y,
      ) >= 3;
      textCreation.labelPoint = point;
      if (!moved) {
        setTextCreationPreview(textCreation.anchor, point);
        startAnchorRef.current = null;
        return;
      }
      textCreationRef.current = null;
      startAnchorRef.current = null;
      previewRef.current = null;
      setPreview(null);
      setCreationStatus(null);
      const defaults = textDefaults();
      setEditor({
        anchor: textCreation.anchor,
        x: point.x,
        y: point.y,
        value: "",
        ...defaults,
        placement: "anchor",
        background: DEFAULT_TEXT_CARD_BACKGROUND,
        canvasX: size.width > 0 ? point.x / size.width : defaults.canvasX,
        canvasY: size.height > 0 ? point.y / size.height : defaults.canvasY,
      });
      onDrawingInteractionStart?.();
      return;
    }
    const creation = creationRef.current;
    const startAnchor = creation?.first ?? startAnchorRef.current;
    if (!creation || !startAnchor) return;
    const point = pointFromClient(clientX, clientY);
    if (!point) return;
    const endAnchor = anchorFromPoint(point.x, point.y);
    const moved = Math.hypot(point.x - creation.pointerDownPoint.x, point.y - creation.pointerDownPoint.y) >= 3;
    if (creation.phase === "width") {
      const secondPoint = pointFor(creation.second!);
      const widthMoved = !sameAnchor(creation.second!, endAnchor) &&
        Math.hypot(point.x - secondPoint.x, point.y - secondPoint.y) >= 3;
      if (!widthMoved) {
        setCreationPreview(creation.tool, [creation.first, creation.second!]);
        return;
      }
      const base = {
        id: drawingId(),
        tool: "parallel-channel" as const,
        anchors: [creation.first, creation.second!, endAnchor],
        style: styleFor("parallel-channel"),
        hidden: false,
        locked: false,
        visibleOn: "all" as const,
        stage: "during-replay" as const,
      };
      emitAdd(base);
      clearCreationDraft();
      return;
    }
    if (!creation.firstPointConfirmed) {
      if (!moved) {
        creation.firstPointConfirmed = true;
        setCreationPreview(creation.tool, [creation.first]);
        return;
      }
      if (creation.tool === "parallel-channel") {
        parallelDraftRef.current = { first: creation.first, second: endAnchor };
        creation.second = endAnchor;
        creation.phase = "width";
        creation.firstPointConfirmed = false;
        setCreationPreview(creation.tool, [creation.first, endAnchor]);
      } else {
        createDrawing(creation.first, endAnchor);
        clearCreationDraft();
      }
      return;
    }
    if (sameAnchor(creation.first, endAnchor)) {
      setCreationPreview(creation.tool, [creation.first]);
      return;
    }
    if (creation.tool === "parallel-channel") {
      parallelDraftRef.current = { first: creation.first, second: endAnchor };
      creation.second = endAnchor;
      creation.phase = "width";
      creation.firstPointConfirmed = false;
      setCreationPreview(creation.tool, [creation.first, endAnchor]);
    } else {
      createDrawing(creation.first, endAnchor);
      clearCreationDraft();
    }
  }

  useEffect(() => {
    if (previousActiveToolRef.current === activeTool) return;
    previousActiveToolRef.current = activeTool;
    if (dragRef.current) {
      cancelGesture();
      return;
    }
    clearCreationDraft();
    if (editor && editor.value.length === 0) cancelTextEditor();
  }, [activeTool, cancelGesture, editor]);

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
      hover: updateDrawingHover,
      leave: () => { setHoveredDrawingId(null); setRiskHoverCursor(null); },
    };
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = canvas?.closest(".chart-stage");
    if (!stage) return;
    const fromTextEditor = (event: Event) => {
      const target = event.target as (Element & { closest?: (selector: string) => Element | null }) | null;
      return Boolean(target?.closest?.(
        ".drawing-text-editor-shell, .drawing-text-card-control, .drawing-text-card-text-layer, " +
        ".replay-chart-compact-controls, .replay-chart-compact-control, .replay-chart-plan-hit, " +
        "[data-replay-control]",
      ));
    };
    const onPointerDown = (event: Event) => {
      if (fromTextEditor(event) || (event.target as Element | null)?.closest?.(".drawing-risk-control, .drawing-selection-control")) return;
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
    const onReplayControlPointerDown = (event: Event) => {
      const target = event.target as Element | null;
      if (!target?.closest?.("[data-replay-control]")) return;
      // The replay/toolbar control will take focus between pointerdown and
      // click. Keep a non-empty editor draft alive through that blur so the
      // history action applies to drawings rather than becoming a text add.
      cancelEditorRef.current = true;
      window.setTimeout(() => {
        cancelEditorRef.current = false;
      }, 0);
    };
    const onPointerMove = (event: Event) => {
      if (fromTextEditor(event)) return;
      const handlers = gestureHandlersRef.current;
      if (
        handlers?.activeTool !== "cursor" ||
        !capturedPointerRef.current
      ) {
        if (handlers?.activeTool === "cursor" && !capturedPointerRef.current) {
          const pointer = event as PointerEvent;
          handlers.hover(pointer.clientX, pointer.clientY);
        }
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
      if (!capturedPointerRef.current && !dragRef.current) return;
      const pointer = event as PointerEvent;
      pointer.preventDefault();
      pointer.stopPropagation();
      gestureHandlersRef.current?.pointerCancel();
      releaseCapturedPointer(pointer.pointerId);
    };
    const onLostPointerCapture = () => {
      if (!capturedPointerRef.current && !dragRef.current) return;
      gestureHandlersRef.current?.pointerCancel();
      capturedPointerRef.current = null;
    };
    const onPointerLeave = () => {
      // Pointer capture deliberately keeps the drag alive after the pointer
      // leaves the stage. Preserve the active cursor until release/cancel.
      if (capturedPointerRef.current || dragRef.current) return;
      gestureHandlersRef.current?.leave();
    };
    const onKeyDown = (event: Event) => {
      const key = event as KeyboardEvent;
      if (
        key.key !== "Escape" ||
        key.isComposing ||
        key.keyCode === 229 ||
        compositionRef.current ||
        (!dragRef.current && !creationRef.current && !textCreationRef.current && !startAnchorRef.current && !parallelDraftRef.current)
      ) return;
      key.preventDefault(); key.stopPropagation();
      gestureHandlersRef.current?.pointerCancel();
      releaseCapturedPointer();
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
    stage.addEventListener("pointerleave", onPointerLeave, true);
    stage.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("pointerdown", onReplayControlPointerDown, true);
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
      stage.removeEventListener("pointerleave", onPointerLeave, true);
      stage.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("pointerdown", onReplayControlPointerDown, true);
      dragRef.current = null;
      previewRef.current = null;
      startAnchorRef.current = null;
      parallelDraftRef.current = null;
      creationRef.current = null;
      capturedPointerRef.current = null;
      gestureHandlersRef.current = null;
    };
  }, []);

  const drawingMode = activeTool !== "cursor";
  const editorFrame = editor
    ? textEditorFrame(editor.value, editor.textWidth, editor.fontSize, editor.x, editor.y)
    : null;
  const editorControlStyle = editorFrame
    ? {
        flex: "0 0 auto",
        flexShrink: 0,
        minHeight: editorFrame.controlHeight,
        height: editorFrame.controlHeight,
        whiteSpace: "nowrap" as const,
        boxSizing: "border-box" as const,
      }
    : undefined;
  const editorButtonStyle = editorControlStyle
    ? {
        ...editorControlStyle,
        color: "var(--text)",
        background: "transparent",
        border: "1px solid transparent",
        borderRadius: "4px",
        padding: "0 8px",
        cursor: "pointer",
      }
    : undefined;
  const editorActionStyle = editorControlStyle
    ? {
        ...editorControlStyle,
        width: editorControlStyle.height,
        minWidth: editorControlStyle.height,
        color: "var(--text)",
        background: "transparent",
        border: "1px solid transparent",
        borderRadius: "4px",
        padding: 0,
        cursor: "pointer",
        fontSize: 14,
      }
    : undefined;
  const editorFieldStyle = editorControlStyle
    ? {
        ...editorControlStyle,
        color: "var(--text)",
        background: "var(--surface)",
        border: "1px solid var(--line-soft)",
        borderRadius: "4px",
        padding: "0 6px",
      }
    : undefined;
  const editorColorStyle = editorFrame
    ? {
        ...editorControlStyle,
        // A color input is one touch target, not a full wrapped toolbar row.
        // Keeping it square prevents the narrow style viewport from spending
        // its first scroll rows on the color control itself.
        width: editorFrame.controlHeight,
        minWidth: editorFrame.controlHeight,
        padding: "2px",
        background: "var(--surface)",
        borderRadius: "4px",
        boxShadow: "0 0 0 1px var(--line-soft)",
      }
    : undefined;
  const textPreviewGeometry = preview?.id === "__text-creation-preview__"
    ? textGeometryForDrawing(preview).geometry
    : null;
  return (
    <div
      className={`drawing-canvas ${drawingMode ? "drawing-mode" : ""}`}
      // Keep the cursor-mode root above the chart/plan stacking layers while
      // remaining pointer-transparent. Its explicit controls opt into hit
      // testing; empty Canvas space still lets replay plan-hit buttons through.
      style={activeTool === "cursor" ? { zIndex: 9, pointerEvents: "none" } : editor ? { zIndex: 9 } : undefined}
    >
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
          if (!capturedPointerRef.current) {
            updateDrawingHover(event.clientX, event.clientY);
            if (creationRef.current || textCreationRef.current) handlePointerMove(event.clientX, event.clientY);
            return;
          }
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
          if (!capturedPointerRef.current && !dragRef.current) return;
          event.preventDefault();
          event.stopPropagation();
          cancelGesture();
          releaseCapturedPointer(event.pointerId);
        }}
        onLostPointerCapture={() => {
          if (!capturedPointerRef.current && !dragRef.current) return;
          cancelGesture();
          capturedPointerRef.current = null;
        }}
        onPointerLeave={() => {
          setHoveredDrawingId(null);
          if (capturedPointerRef.current || dragRef.current) return;
          setRiskHoverCursor(null);
        }}
        tabIndex={0}
        onKeyDown={(event) => {
          if ((event.key === "Enter" || event.key === " ") && selectedDrawingId) {
            event.preventDefault();
            event.stopPropagation();
            onSelectDrawing(selectedDrawingId);
          }
        }}
      />
      {creationStatus && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: "absolute",
            top: 8,
            left: 12,
            maxWidth: "calc(100% - 24px)",
            padding: "4px 8px",
            border: "1px solid rgba(140, 189, 255, 0.42)",
            borderRadius: 4,
            color: "var(--link, #8cbdff)",
            background: "rgba(16, 23, 34, 0.86)",
            fontSize: 11,
            lineHeight: "16px",
            pointerEvents: "none",
            zIndex: 11,
          }}
        >
          {creationStatus}
        </div>
      )}
      {labelFallbacks.map((fallback) => {
        const left = Math.max(0, Math.min(Math.max(0, boundedPlot.width - 1), fallback.x));
        const top = Math.max(0, Math.min(Math.max(0, boundedPlot.height - 1), fallback.y));
        const availableWidth = Math.max(1, boundedPlot.width - left);
        const availableHeight = Math.max(1, boundedPlot.height - top);
        const width = Math.max(1, Math.min(availableWidth, fallback.width));
        // Keep the safe-cell minimum in sync with label-layout geometry. A
        // 35px cell must not grow to 36px and cover the adjacent handle.
        const minFallbackHeight = Math.min(35, availableHeight);
        const height = Math.max(minFallbackHeight, Math.min(availableHeight, fallback.height));
        return (
          <div
            key={`drawing-label-fallback-${fallback.drawingId}`}
            role="status"
            aria-label={`绘图标签 ${fallback.drawingId}`}
            data-label-fallback="true"
            style={{
              position: "absolute",
              zIndex: 2,
              left,
              top,
              width,
              height,
              maxWidth: availableWidth,
              maxHeight: availableHeight,
              boxSizing: "border-box",
              padding: `${DRAWING_LABEL_PADDING}px`,
              overflowY: "auto",
              overflowX: "hidden",
              background: "rgba(16, 23, 34, 0.94)",
              border: "1px solid rgba(140, 189, 255, 0.55)",
              color: "#e6edf7",
              font: canvasMonoFont(DRAWING_LABEL_FONT_SIZE, 500),
              lineHeight: `${DRAWING_LABEL_LINE_HEIGHT}px`,
              whiteSpace: "pre-wrap",
              pointerEvents: activeTool === "cursor" ? "auto" : "none",
            }}
          >
            {fallback.rows.flatMap((row) => row.lines).map((line, index) => (
              <div key={`${fallback.drawingId}-line-${index}`} style={{ minHeight: DRAWING_LABEL_LINE_HEIGHT }}>{line}</div>
            ))}
          </div>
        );
      })}
      {preview?.id === "__text-creation-preview__" && textPreviewGeometry && (
        <div
          aria-label="文字定位预览"
          style={{
            position: "absolute",
            left: textPreviewGeometry.x,
            top: textPreviewGeometry.y,
            width: textPreviewGeometry.width,
            height: textPreviewGeometry.height,
            boxSizing: "border-box",
            padding: `4px ${textCardLayoutOptions.horizontalPadding}px`,
            border: "1px dashed var(--link, #8cbdff)",
            borderRadius: 3,
            color: "var(--link, #8cbdff)",
            background: "rgba(16, 23, 34, 0.42)",
            fontSize: 14,
            lineHeight: "20px",
            pointerEvents: "none",
            userSelect: "none",
            zIndex: 5,
          }}
        >文字批注</div>
      )}
      {validationError && (
        <p className="drawing-validation-error" role="alert">
          {validationError}
        </p>
      )}
      {drawings.flatMap((drawing) => {
        if (drawing.hidden || (drawing.tool !== "long-risk-reward" && drawing.tool !== "short-risk-reward")) return [];
        const projected = preview?.id === drawing.id ? preview : drawing;
        const points = projected.anchors.map(pointFor);
        const bounds = riskRewardBounds(points);
        if (!bounds) return [];
        const hitSize = coarsePointer ? 44 : 16;
        const objectKey = `${drawing.id}:object`;
        const objectFocused = focusedRiskControl === objectKey;
        const selectWithKey = (event: ReactKeyboardEvent) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault(); event.stopPropagation(); onSelectDrawing(drawing.id);
          }
        };
        const beginControl = (event: ReactPointerEvent<HTMLButtonElement>, handle: RiskHandle) => {
          event.preventDefault(); event.stopPropagation();
          const point = pointFromClient(event.clientX, event.clientY);
          if (drawing.locked || !point) { onSelectDrawing(drawing.id); return; }
          beginRiskControlEdit(drawing, point, handle);
          capturePointer(event.currentTarget, event.pointerId);
        };
        const focusStyle = (key: string) => ({ outline: focusedRiskControl === key ? "2px solid var(--link, #8cbdff)" : "none", outlineOffset: 2 });
        const result = [
          <button key={objectKey} type="button" className="drawing-risk-control"
            aria-label={`选择绘图 ${drawing.name}${drawing.locked ? " 只读" : ""}`}
            onFocus={() => setFocusedRiskControl(objectKey)} onBlur={() => setFocusedRiskControl(null)}
            onKeyDown={selectWithKey} onPointerDown={(event) => beginControl(event, null)}
            onClick={() => onSelectDrawing(drawing.id)}
            style={{ position: "absolute", left: Math.max(0, Math.min(Math.max(0, size.width - 90), bounds.left + 12)), top: Math.max(0, Math.min(Math.max(0, size.height - 22), bounds.top + 12)), height: 22, maxWidth: 90, padding: "0 4px", pointerEvents: activeTool === "cursor" && objectFocused ? "auto" : "none", opacity: objectFocused ? 1 : 0, background: "var(--surface, #17202b)", color: "var(--link, #8cbdff)", border: 0, zIndex: 8, ...focusStyle(objectKey) }}>
            {drawing.name}{drawing.locked ? " 只读" : ""}
          </button>,
        ];
        if (drawing.id !== selectedDrawingId || drawing.locked || activeTool !== "cursor") return result;
        const overlapping = points.slice(0, 3).some((point, index) => points.slice(0, 3).some((other, otherIndex) => index !== otherIndex && Math.hypot(point.x - other.x, point.y - other.y) < 8));
        const candidateLeft = Math.max(hitSize / 2, Math.min(Math.max(hitSize / 2, size.width - hitSize / 2 - 78), points[0].x + 24));
        const candidateTop = Math.max(hitSize / 2, Math.min(Math.max(hitSize / 2, size.height - hitSize / 2 - 2 * (hitSize + 4)), points[0].y - hitSize - 4));
        points.slice(0, 3).forEach((point, index) => {
          const key = `${drawing.id}:price:${index}`;
          const label = index === 0 ? "入场价柄" : index === 1 ? "止损价柄" : "目标价柄";
          const x = overlapping ? candidateLeft : point.x;
          const y = overlapping ? candidateTop + index * (hitSize + 4) : point.y;
          const active = activeRiskGesture?.drawingId === drawing.id && activeRiskGesture.handle?.kind === "price" && activeRiskGesture.handle.anchorIndex === index;
          result.push(<button key={key} type="button" className="drawing-risk-control"
            aria-label={`${drawing.name} ${label}`} title={`${label} ${projected.anchors[index].price}`}
            onFocus={() => setFocusedRiskControl(key)} onBlur={() => setFocusedRiskControl(null)} onKeyDown={selectWithKey}
            onPointerDown={(event) => beginControl(event, { kind: "price", anchorIndex: index as 0 | 1 | 2 })}
            style={{ position: "absolute", left: x - hitSize / 2, top: y - hitSize / 2, width: hitSize, height: hitSize, padding: 0, border: 0, background: "transparent", pointerEvents: activeTool === "cursor" ? "auto" : "none", cursor: "ns-resize", zIndex: 8, ...focusStyle(key) }}>
            {overlapping && <><span aria-hidden="true" style={{ position: "absolute", left: hitSize / 2 - 4, top: hitSize / 2 - 4, width: 8, height: 8, boxSizing: "border-box", borderRadius: "50%", border: "2px solid var(--link, #8cbdff)", background: active ? "var(--link, #8cbdff)" : "#17202b" }} />
              <span aria-hidden="true" style={{ position: "absolute", left: hitSize + 2, top: hitSize / 2 - 8, fontSize: 11, whiteSpace: "nowrap", background: "var(--surface, #17202b)", color: "var(--link, #8cbdff)", pointerEvents: "none" }}>{label.slice(0, 2)} {projected.anchors[index].price}</span></>}
          </button>);
        });
        const widthKey = `${drawing.id}:width`;
        result.push(<button key={widthKey} type="button" className="drawing-risk-control" aria-label={`${drawing.name} 宽度时间柄`}
          onFocus={() => setFocusedRiskControl(widthKey)} onBlur={() => setFocusedRiskControl(null)} onKeyDown={selectWithKey}
          onPointerDown={(event) => beginControl(event, riskRewardWidthHandle(drawing.anchors.map(pointFor)))}
          style={{ position: "absolute", left: bounds.right - hitSize / 2, top: bounds.widthHandle.y - hitSize / 2, width: hitSize, height: hitSize, padding: 0, border: 0, background: "transparent", pointerEvents: activeTool === "cursor" ? "auto" : "none", cursor: "ew-resize", zIndex: 8, ...focusStyle(widthKey) }} />);
        return result;
      })}
      {drawings.flatMap((drawing) => {
        if (drawing.hidden || drawing.tool === "text" || drawing.tool === "long-risk-reward" || drawing.tool === "short-risk-reward") return [];
        const renderedDrawing = preview?.id === drawing.id ? preview : drawing;
        const points = renderedDrawing.anchors.map(pointFor);
        const objectKey = `${drawing.id}:object`;
        const objectPoint = points[0];
        const objectControlPosition = keyboardObjectControlPosition({ points, size });
        const objectFocused = focusedTextControl === objectKey;
        const objectControl = objectPoint ? <button
          key={objectKey}
          type="button"
          className="drawing-selection-control"
          aria-label={`选择绘图 ${drawing.name}${drawing.locked ? " 只读" : ""}`}
          onFocus={() => setFocusedTextControl(objectKey)}
          onBlur={() => setFocusedTextControl(null)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault(); event.stopPropagation(); onSelectDrawing(drawing.id);
            }
          }}
          onClick={() => onSelectDrawing(drawing.id)}
          style={{
            position: "absolute", zIndex: 7,
            left: objectControlPosition.left,
            top: objectControlPosition.top,
            minWidth: 16, minHeight: 16, padding: "1px 4px", border: 0,
            background: "var(--surface, #17202b)", color: "var(--link, #8cbdff)",
            pointerEvents: activeTool === "cursor" && objectFocused ? "auto" : "none",
            opacity: objectFocused ? 1 : 0,
            outline: objectFocused ? "2px solid var(--link, #8cbdff)" : "none",
            outlineOffset: 2,
          }}
        >{drawing.name}{drawing.locked ? " 只读" : ""}</button> : null;
        if (drawing.id !== selectedDrawingId || drawing.locked || activeTool !== "cursor") return objectControl ? [objectControl] : [];
        const indexes = drawing.tool === "horizontal-line" || drawing.tool === "vertical-line" || drawing.tool === "price-label"
          ? [0]
          : drawing.tool === "parallel-channel" ? [0, 1, 2] : [0, 1];
        const hitSize = coarsePointer ? 44 : 16;
        return indexes.flatMap((index) => {
          const point = points[index];
          if (!point) return [];
          const key = `${drawing.id}:anchor:${index}`;
          const axis = drawing.tool === "horizontal-line" || drawing.tool === "price-label" ? "ns-resize" : drawing.tool === "vertical-line" ? "ew-resize" : "move";
          return [
            <button
              key={key}
              type="button"
              className="drawing-selection-control"
              aria-label={`移动${drawing.name}端点 ${index + 1}`}
              onFocus={() => setFocusedTextControl(key)}
              onBlur={() => setFocusedTextControl(null)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelectDrawing(drawing.id);
                }
              }}
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onSelectDrawing(drawing.id);
                const origin = pointFromClient(event.clientX, event.clientY);
                if (!origin) return;
                beginEdit(drawing, origin, undefined, index);
                capturePointer(event.currentTarget, event.pointerId);
              }}
              style={{
                position: "absolute", zIndex: 7,
                left: point.x - hitSize / 2, top: point.y - hitSize / 2,
                width: hitSize, height: hitSize, minWidth: hitSize, minHeight: hitSize,
                padding: 0, border: 0, borderRadius: "50%", background: "transparent",
                pointerEvents: "auto", cursor: draggingDrawingId === drawing.id && axis === "move" ? "grabbing" : axis,
                outline: focusedTextControl === key ? "2px solid var(--link, #8cbdff)" : "none",
                outlineOffset: 2,
              }}
            >
              <span aria-hidden="true" style={{ display: "block", width: 8, height: 8, margin: "auto", boxSizing: "border-box", border: "2px solid var(--link, #8cbdff)", borderRadius: "50%", background: "#17202b" }} />
            </button>,
          ];
        }).concat(objectControl ? [objectControl] : []);
      })}
      {size.width > 0 && size.height > 0 && drawings.map((drawing) => {
        if (drawing.hidden || drawing.tool !== "text") return null;
        const renderedDrawing = preview?.id === drawing.id && preview.tool === "text" ? preview : drawing;
        const { layout, geometry } = textGeometryForDrawing(renderedDrawing);
        const expanded = expandedTextIds.has(drawing.id);
        const hitSize = coarsePointer ? 44 : 24;
        const selected = drawing.id === selectedDrawingId;
        const editingThisDrawing = editor?.drawing?.id === drawing.id;
        const sourceAnchor = renderedDrawing.anchors[0];
        const sourceBar = sourceAnchor && Number.isFinite(sourceAnchor.price)
          ? candles.find((candle) => candle.time === sourceAnchor.time && candle.time <= cursor)
          : undefined;
        const sourceBarDateTime = sourceBar
          ? formatBeijingDateTime(sourceBar.time).replace(
            /^(\d{4})年(\d{2})月(\d{2})日 (\d{2}:\d{2}:\d{2})$/u,
            "$1-$2-$3 $4",
          )
          : "时间未知";
        const showAnchorReadout = Boolean(
          sourceBar && (selected || activeTextGesture?.drawingId === drawing.id),
        );
        const readoutWidth = Math.max(96, Math.min(190, Math.max(96, boundedPlot.width - 4)));
        // The readout is deliberately laid out as its own compact surface. Two
        // 16px lines plus the border/padding fit in 38px at the normal width;
        // retain extra room only when a narrow plot can wrap either line.
        const readoutReserveHeight = readoutWidth < 140 ? 80 : 38;
        const clampReadoutLeft = (value: number) => Math.max(2, Math.min(Math.max(2, boundedPlot.width - readoutWidth - 2), value));
        const clampReadoutTop = (value: number) => Math.max(2, Math.min(Math.max(2, boundedPlot.height - readoutReserveHeight - 2), value));
        const readoutRect = (left: number, top: number) => ({
          left, top, right: left + readoutWidth, bottom: top + readoutReserveHeight,
        });
        const operationRowHeight = Math.max(hitSize, textCardLayoutOptions.controlHeight);
        const editLeft = Math.max(4, Math.min(Math.max(4, boundedPlot.width - 64), geometry.x + 4));
        const editTop = expanded && geometry.height >= operationRowHeight
          ? geometry.y + geometry.height - operationRowHeight + Math.max(0, (operationRowHeight - 22) / 2)
          : geometry.y - 28;
        const clampCenter = (value: number, limit: number) => Math.max(hitSize / 2, Math.min(Math.max(hitSize / 2, limit - hitSize / 2), value));
        const operationMoveCandidates = [
          { x: geometry.x - hitSize - 6, y: geometry.y + Math.min(12, geometry.height / 2) },
          { x: geometry.x + geometry.width + hitSize + 6, y: geometry.y + Math.min(12, geometry.height / 2) },
          { x: geometry.x - hitSize - 6, y: geometry.y + Math.max(geometry.height - 12, geometry.height / 2) },
          { x: geometry.x + geometry.width + hitSize + 6, y: geometry.y + Math.max(geometry.height - 12, geometry.height / 2) },
          { x: geometry.x + geometry.width / 2, y: geometry.y - hitSize - 6 },
          { x: geometry.x + geometry.width / 2, y: geometry.y + geometry.height + hitSize + 6 },
        ].map((candidate) => ({
          x: clampCenter(candidate.x, boundedPlot.width),
          y: clampCenter(candidate.y, boundedPlot.height),
        }));
        const operationRects = [
          { left: editLeft, top: editTop, right: editLeft + 64, bottom: editTop + 22 },
          ...(layout.canExpand ? [{
            left: Math.max(4, Math.min(Math.max(4, boundedPlot.width - hitSize - 4), geometry.x + geometry.width - hitSize)),
            top: Math.max(4, Math.min(Math.max(4, boundedPlot.height - hitSize - 4), geometry.y + geometry.height - hitSize)),
            right: Math.max(4, Math.min(Math.max(4, boundedPlot.width - hitSize - 4), geometry.x + geometry.width - hitSize)) + hitSize,
            bottom: Math.max(4, Math.min(Math.max(4, boundedPlot.height - hitSize - 4), geometry.y + geometry.height - hitSize)) + hitSize,
          }] : []),
          ...(selected && activeTool === "cursor" ? operationMoveCandidates.map(({ x, y }) => ({
            left: x - hitSize / 2, top: y - hitSize / 2, right: x + hitSize / 2, bottom: y + hitSize / 2,
          })) : []),
          ...(selected && activeTool === "cursor" && sourceAnchor ? [{
            left: pointFor(sourceAnchor).x - hitSize / 2,
            top: pointFor(sourceAnchor).y - hitSize / 2,
            right: pointFor(sourceAnchor).x + hitSize / 2,
            bottom: pointFor(sourceAnchor).y + hitSize / 2,
          }] : []),
        ];
        const preferredReadoutCandidates = [
          // Leave the edit row (geometry.y - 28 .. - 6) below the readout.
          { left: geometry.x + 4, top: geometry.y - readoutReserveHeight - 36 },
          { left: geometry.x + geometry.width + 8, top: geometry.y + 4 },
          { left: geometry.x - readoutWidth - 8, top: geometry.y + 4 },
          { left: geometry.x + 4, top: geometry.y + geometry.height + 8 },
        ];
        const readoutCandidateXs = [
          geometry.x + 4,
          geometry.x + geometry.width + 8,
          geometry.x - readoutWidth - 8,
          2,
          boundedPlot.width - readoutWidth - 2,
        ];
        const readoutCandidateYs = [
          geometry.y - readoutReserveHeight - 36,
          geometry.y + 4,
          geometry.y + geometry.height + 8,
          2,
          boundedPlot.height - readoutReserveHeight - 2,
        ];
        const readoutCandidates = [...preferredReadoutCandidates, ...readoutCandidateYs.flatMap((top) =>
          readoutCandidateXs.map((left) => ({ left, top })),
        )].map((candidate) => readoutRect(clampReadoutLeft(candidate.left), clampReadoutTop(candidate.top)))
          .filter((candidate, index, all) => all.findIndex((other) =>
            other.left === candidate.left && other.top === candidate.top,
          ) === index);
        // The candidate grid includes each bounded corner and the four sides
        // around the card. Normal chart panes always have a clear candidate;
        // the tiny synthetic pane used by legacy unit fixtures can be smaller
        // than the readout and every grip at once, so retain its historical
        // compact fallback without weakening the real narrow-chart path.
        const readoutPositionCandidate = readoutCandidates.find((candidate) =>
          !operationRects.some((operation) =>
            candidate.left < operation.right && operation.left < candidate.right &&
            candidate.top < operation.bottom && operation.top < candidate.bottom,
          ),
        ) ?? (boundedPlot.width < 200 || boundedPlot.height < 140
          ? readoutRect(2, 2)
          : readoutCandidates[0]!);
        // Expanded cards keep the bounded viewport for layout, but their DOM
        // layer must retain every wrapped line so the user can scroll/read the
        // complete original text instead of receiving an ellipsis-only tail.
        const visibleText = expanded ? layout.fullLines.join("\n") : layout.lines.join("\n");
        const controlFocusStyle = (key: string) => ({
          outline: focusedTextControl === key ? "2px solid var(--link, #8cbdff)" : "none",
          outlineOffset: 2,
        });
        const textLayer = (
          <div
            key={`text-card-text-layer-${drawing.id}`}
            className="drawing-text-card-text-layer"
            aria-label={`文字内容 ${drawing.id}`}
            onPointerDown={() => onSelectDrawing(drawing.id)}
            style={{
              position: "absolute",
              // A selected card must remain legible over an opaque risk/reward
              // label fallback. Its controls/readout use higher layers below.
              zIndex: selected ? 7 : 3,
              left: geometry.x,
              top: geometry.y,
              width: geometry.width,
              height: geometry.height,
              boxSizing: "border-box",
              // Expanded text scrolls inside the fixed card geometry. Keep the
              // existing operation row inside that geometry, but reserve its
              // height in the scroll content so the last wrapped line cannot
              // end underneath the edit/collapse controls at scroll bottom.
              padding: expanded
                ? `4px ${textCardLayoutOptions.horizontalPadding}px ${operationRowHeight + 4}px`
                : `4px ${textCardLayoutOptions.horizontalPadding}px`,
              color: (selected || expanded) && !editingThisDrawing ? drawing.style.color : "transparent",
              opacity: (selected || expanded) && !editingThisDrawing ? drawing.style.opacity : 0,
              background: selected ? "#101722" : "transparent",
              fontSize: drawing.fontSize ?? 14,
              fontFamily: CANVAS_TEXT_FONT_FAMILY,
              fontWeight: 600,
              lineHeight: `${layout.lineHeight}px`,
              whiteSpace: "pre-wrap",
              overflow: "auto",
              userSelect: "text",
              cursor: "text",
              pointerEvents: activeTool === "cursor" && !editingThisDrawing && (selected || expanded) ? "auto" : "none",
            }}
          >
            {visibleText}
          </div>
        );
        const selectKey = `${drawing.id}:select`;
        const controls: React.ReactNode[] = [
          textLayer,
          <button key={selectKey} type="button" className="drawing-selection-control" aria-label={`选择文字 ${drawing.id}`}
            onFocus={() => setFocusedTextControl(selectKey)} onBlur={() => setFocusedTextControl(null)}
            onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelectDrawing(drawing.id); } }}
            onPointerDown={(event) => { event.preventDefault(); event.stopPropagation(); onSelectDrawing(drawing.id); }}
            style={{ position: "absolute", zIndex: 4, left: Math.max(0, geometry.x), top: Math.max(0, geometry.y), width: 22, height: 22, minWidth: 0, minHeight: 0, padding: 0, border: focusedTextControl === selectKey ? "1px solid var(--link, #8cbdff)" : 0, borderRadius: 3, background: focusedTextControl === selectKey ? "rgba(140, 189, 255, 0.18)" : "transparent", color: "var(--link, #8cbdff)", opacity: focusedTextControl === selectKey ? 1 : 0, pointerEvents: activeTool === "cursor" && focusedTextControl === selectKey ? "auto" : "none", cursor: "pointer", ...controlFocusStyle(selectKey) }}>
            {focusedTextControl === selectKey && <span aria-hidden="true" style={{ fontSize: 12, lineHeight: "20px" }}>⌖</span>}
          </button>,
        ];
        if (showAnchorReadout && sourceAnchor && sourceBar) {
          controls.push(
            <div
              key={`${drawing.id}:anchor-readout`}
              role="status"
              aria-label={`文字锚点 ${drawing.id}`}
              title="已揭示行情源柱（北京时间）"
              style={{
                position: "absolute",
                zIndex: 8,
                left: readoutPositionCandidate.left,
                top: readoutPositionCandidate.top,
                width: readoutWidth,
                maxWidth: readoutWidth,
                minHeight: readoutReserveHeight,
                padding: "2px 5px",
                boxSizing: "border-box",
                color: "var(--link, #8cbdff)",
                background: "rgba(16, 23, 34, 0.9)",
                border: "1px solid rgba(140, 189, 255, 0.42)",
                borderRadius: 3,
                fontSize: 11,
                lineHeight: "16px",
                whiteSpace: "normal",
                overflowWrap: "anywhere",
                pointerEvents: "none",
              }}
            >
              <div>源柱 {sourceAnchor.price.toFixed(2)} · 北京时间</div>
              <div>{sourceBarDateTime}</div>
            </div>,
          );
        }
        if (layout.canExpand) {
          const toggleKey = `${drawing.id}:expand`;
          controls.push(
            <button
              key={toggleKey}
              type="button"
              className="drawing-text-card-control"
              aria-label={`${expanded ? "收起" : "展开"}文字 ${drawing.id}`}
              title={expanded ? "收起文字" : "展开文字"}
              onFocus={() => setFocusedTextControl(toggleKey)}
              onBlur={() => setFocusedTextControl(null)}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => setExpandedTextIds((current) => {
                const next = new Set(current);
                if (next.has(drawing.id)) next.delete(drawing.id);
                else next.add(drawing.id);
                return next;
              })}
              style={{
                position: "absolute", zIndex: selected ? 8 : 6, pointerEvents: activeTool === "cursor" ? "auto" : "none",
                left: Math.max(4, Math.min(Math.max(4, boundedPlot.width - hitSize - 4), geometry.x + geometry.width - hitSize)),
                top: Math.max(4, Math.min(Math.max(4, boundedPlot.height - hitSize - 4), geometry.y + geometry.height - hitSize)),
                width: hitSize, height: hitSize, minWidth: hitSize, minHeight: hitSize,
                padding: 0, boxSizing: "border-box", border: "1px solid rgba(140, 189, 255, 0.65)",
                borderRadius: 3, color: "#cfe3ff", background: "rgba(16, 23, 34, 0.92)",
                fontSize: coarsePointer ? 12 : 10, lineHeight: `${hitSize - 2}px`, cursor: "pointer",
                ...controlFocusStyle(toggleKey),
              }}
            >
              <span aria-hidden="true">{expanded ? "⌃" : "⌄"}</span>
            </button>,
          );
        }
        if (selected && activeTool === "cursor") {
          const moveKey = `${drawing.id}:move`;
          const clampCenter = (value: number, limit: number) => Math.max(hitSize / 2, Math.min(Math.max(hitSize / 2, limit - hitSize / 2), value));
          const anchorPoint = renderedDrawing.anchors[0] ? pointFor(renderedDrawing.anchors[0]) : null;
          const moveCandidates = [
            { x: geometry.x - hitSize - 6, y: geometry.y + Math.min(12, geometry.height / 2) },
            { x: geometry.x + geometry.width + hitSize + 6, y: geometry.y + Math.min(12, geometry.height / 2) },
            { x: geometry.x - hitSize - 6, y: geometry.y + Math.max(geometry.height - 12, geometry.height / 2) },
            { x: geometry.x + geometry.width + hitSize + 6, y: geometry.y + Math.max(geometry.height - 12, geometry.height / 2) },
            { x: geometry.x + geometry.width / 2, y: geometry.y - hitSize - 6 },
            { x: geometry.x + geometry.width / 2, y: geometry.y + geometry.height + hitSize + 6 },
          ].map((candidate) => ({
            x: clampCenter(candidate.x, boundedPlot.width),
            y: clampCenter(candidate.y, boundedPlot.height),
          }));
          const separated = anchorPoint
            ? moveCandidates.find((candidate) => Math.abs(candidate.x - anchorPoint.x) >= hitSize || Math.abs(candidate.y - anchorPoint.y) >= hitSize)
            : moveCandidates[0];
          const moveX = separated?.x ?? moveCandidates[0].x;
          const moveY = separated?.y ?? moveCandidates[0].y;
          if (!drawing.locked) {
            const moveActive = activeTextGesture?.drawingId === drawing.id && activeTextGesture.kind === "move";
            const anchorActive = activeTextGesture?.drawingId === drawing.id && activeTextGesture.kind === "anchor";
            controls.push(
              <button key={moveKey} type="button" className="drawing-selection-control" aria-label={`移动文字 ${drawing.id}`}
                onFocus={() => setFocusedTextControl(moveKey)} onBlur={() => setFocusedTextControl(null)}
                onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelectDrawing(drawing.id); } }}
                onPointerDown={(event) => beginTextControl(event, drawing, "move")}
            style={{ position: "absolute", zIndex: 9, left: moveX - hitSize / 2, top: moveY - hitSize / 2, width: hitSize, height: hitSize, minWidth: hitSize, minHeight: hitSize, padding: 0, border: 0, borderRadius: "50%", background: "transparent", color: "#17202b", pointerEvents: "auto", cursor: moveActive ? "grabbing" : "move", ...controlFocusStyle(moveKey) }}>
                <span aria-hidden="true" style={{ display: "block", width: 8, height: 8, margin: "auto", boxSizing: "border-box", border: "2px solid var(--link, #8cbdff)", borderRadius: 2, background: moveActive ? "var(--link, #8cbdff)" : "#17202b" }} />
              </button>,
            );
            if (renderedDrawing.placement !== "canvas" && renderedDrawing.anchors[0]) {
              const anchorPoint = pointFor(renderedDrawing.anchors[0]);
              const anchorKey = `${drawing.id}:anchor`;
              controls.push(
                <button key={anchorKey} type="button" className="drawing-selection-control" aria-label={`移动市场锚点 ${drawing.id}`}
                  onFocus={() => setFocusedTextControl(anchorKey)} onBlur={() => setFocusedTextControl(null)}
                  onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelectDrawing(drawing.id); } }}
                  onPointerDown={(event) => beginTextControl(event, drawing, "anchor")}
                  style={{ position: "absolute", zIndex: 9, left: anchorPoint.x - hitSize / 2, top: anchorPoint.y - hitSize / 2, width: hitSize, height: hitSize, minWidth: hitSize, minHeight: hitSize, padding: 0, border: 0, borderRadius: "50%", background: "transparent", pointerEvents: "auto", cursor: anchorActive ? "grabbing" : "move", ...controlFocusStyle(anchorKey) }}>
                  <span aria-hidden="true" style={{ display: "block", width: 8, height: 8, margin: "auto", boxSizing: "border-box", border: "2px solid var(--link, #8cbdff)", borderRadius: "50%", background: anchorActive ? "var(--link, #8cbdff)" : "#17202b" }} />
                </button>,
              );
            }
            const editKey = `${drawing.id}:edit`;
            controls.push(
              <button key={editKey} type="button" className="drawing-selection-control" aria-label={`编辑文字 ${drawing.id}`}
                onFocus={() => setFocusedTextControl(editKey)} onBlur={() => setFocusedTextControl(null)}
                onPointerDown={(event) => event.stopPropagation()} onClick={() => openTextEditor(drawing)}
                style={{ position: "absolute", zIndex: 9, left: editLeft, top: Math.max(4, editTop), minHeight: 22, height: 22, padding: "0 6px", border: "1px solid var(--line-soft)", borderRadius: 3, background: "var(--surface-elevated, #17202b)", color: "var(--link, #8cbdff)", fontSize: 11, pointerEvents: "auto", cursor: "text", ...controlFocusStyle(editKey) }}>
                编辑文字
              </button>,
            );
          }
        }
        return controls;
      })}
      {editor && editorFrame && (
        <div
          className="drawing-text-editor-shell"
          style={{
            position: "absolute",
            zIndex: 10,
            pointerEvents: "auto",
            display: "grid",
            gap: 2,
            overflow: "hidden",
            overflowY: "hidden",
            gridTemplateRows: `${editorFrame.styleBarHeight}px minmax(0, 1fr) ${editorFrame.hintHeight}px`,
            background: "var(--surface-elevated)",
            borderRadius: "6px",
            boxShadow: "0 0 0 1px var(--line-soft)",
            ...editorFrame.style,
          }}
          onPointerDown={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <div
            className="drawing-text-editor-controls"
            style={{
              display: "flex",
              gap: 2,
              alignItems: "center",
              minWidth: 0,
              minHeight: 0,
              maxHeight: editorFrame.styleBarHeight,
              height: editorFrame.styleBarHeight,
              width: "100%",
              maxWidth: "100%",
              overflow: "hidden",
              flexShrink: 0,
              position: "relative",
              zIndex: 7,
              }}
            onPointerDown={(event) => {
              event.stopPropagation();
              preserveEditorForControl();
            }}
          >
            <div
              className="drawing-text-style-bar"
              aria-label="文字样式"
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 2,
                alignItems: "flex-start",
                alignContent: "flex-start",
                minWidth: 0,
                flex: "1 1 auto",
                minHeight: 0,
                maxHeight: editorFrame.styleBarHeight,
                boxSizing: "border-box",
                overflowX: "hidden",
                overflowY: "auto",
                whiteSpace: "nowrap",
                background: "var(--surface)",
                borderRadius: "4px",
                boxShadow: "inset 0 0 0 1px var(--line-soft)",
                height: editorFrame.styleBarHeight,
                position: "relative",
                zIndex: 7,
              }}
            >
              <button
                type="button"
                style={editorButtonStyle}
                aria-label={editor.placement === "canvas" ? "改为锚定文字" : "改为自由文字"}
                onClick={() => setEditor((current) => {
                if (!current) return current;
                const placement = current.placement === "canvas" ? "anchor" : "canvas";
                return {
                  ...current,
                  placement,
                  background:
                    placement === "canvas" &&
                    current.background === DEFAULT_TEXT_CARD_BACKGROUND
                      ? "transparent"
                      : current.background,
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
                  style={editorButtonStyle}
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
              <button
                type="button"
                style={editorButtonStyle}
                aria-label={pickingAnchor ? "取消关联取点" : "关联价格 / K线"}
                onClick={() => pickingAnchor ? cancelAnchorPick() : beginAnchorPick()}
              >
                {pickingAnchor ? "取消关联" : "关联价格 / K线"}
              </button>
              <label style={editorControlStyle}>
              <span className="sr-only">字号</span>
              <select
                aria-label="文字字号"
                value={editor.fontSize}
                style={editorFieldStyle}
                onChange={(event) => setEditor((current) => current ? { ...current, fontSize: Number(event.target.value) as TextEditor["fontSize"] } : current)}
              >
                {[12, 14, 16, 18, 24, 32].map((fontSize) => <option key={fontSize} value={fontSize}>{fontSize}px</option>)}
              </select>
              </label>
              <label style={editorControlStyle}>
              <span className="sr-only">文字颜色</span>
              <input
                type="color"
                aria-label="文字颜色"
                value={editor.color}
                style={editorColorStyle}
                onChange={(event) => setEditor((current) => current ? { ...current, color: event.target.value } : current)}
              />
              </label>
              <label style={editorControlStyle}>
              <span className="sr-only">文字宽度</span>
              <input
                type="number"
                aria-label="文字宽度"
                min={36}
                max={Math.max(36, size.width)}
                value={Math.round(editor.textWidth)}
                style={editorFieldStyle}
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
                style={editorButtonStyle}
                aria-label="切换文字背景"
                onClick={() => setEditor((current) => current ? { ...current, background: current.background === "transparent" ? "rgba(16, 23, 34, 0.86)" : "transparent" } : current)}
              >
                背景
              </button>
            </div>
            <button type="button" style={editorActionStyle} aria-label="完成文字编辑" disabled={pickingAnchor} onClick={commitText}><Check size={18} aria-hidden="true" /></button>
            <button type="button" style={editorActionStyle} aria-label="取消文字编辑" onClick={cancelTextEditor}><X size={18} aria-hidden="true" /></button>
          </div>
          <textarea
            autoFocus
            className="drawing-text-editor"
            aria-label="文字标注"
            value={editor.value}
            rows={3}
            style={{ position: "static", width: "100%", minWidth: 0, maxWidth: "100%", minHeight: editorFrame.textareaMinHeight, height: "100%", overflowY: "auto", boxSizing: "border-box", pointerEvents: "auto", fontSize: editor.fontSize, fontFamily: CANVAS_TEXT_FONT_FAMILY, fontWeight: 600, lineHeight: `${editorFrame.lineHeight}px`, padding: "3px 6px", border: "1px solid var(--line-soft)", boxShadow: "none", background: editor.background === "transparent" ? "#101722" : editor.background }}
            onChange={(event) => setEditor((current) => current ? { ...current, value: event.target.value } : current)}
            onCompositionStart={() => { compositionRef.current = true; }}
            onCompositionEnd={() => { compositionRef.current = false; }}
            onBlur={(event) => {
              if (cancelEditorRef.current) {
                cancelEditorRef.current = false;
                return;
              }
              const nextTarget = event.relatedTarget;
              if (nextTarget instanceof Element && nextTarget.closest("[data-replay-control]")) return;
              if (nextTarget instanceof Node && event.currentTarget.parentElement?.contains(nextTarget)) return;
              commitText();
            }}
            onKeyDown={(event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
              if (event.key === "Escape") {
                if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229 || compositionRef.current) return;
                event.preventDefault();
                cancelTextEditor();
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
          <span className="drawing-text-editor-hint" style={{ color: "#8392a7", fontSize: 12, lineHeight: `${editorFrame.hintHeight}px`, whiteSpace: "nowrap", overflowX: "auto", overflowY: "hidden", display: "block" }}>{pickingAnchor ? "请在已揭示的图表区域点选价格/K线 · Esc 取消取点" : "Enter 换行 · ⌘/Ctrl+Enter 完成 · Esc 取消"}</span>
        </div>
      )}
    </div>
  );
});
