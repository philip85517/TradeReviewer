"use client";

import { flushSync } from "react-dom";
import {
  CANONICAL_CAPTURE_FRAME,
  copyChartOptions,
  drawExecutionMarkers,
  renderCanonicalChartCapture,
  type CanonicalCaptureScene,
  type CanonicalChartMarker,
} from "./canonical-chart-capture";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type {
  IChartApi,
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  IPriceLine,
  ISeriesApi,
  ISeriesPrimitive,
  Logical,
  Time,
  TickMarkType,
} from "lightweight-charts";
import type { CanvasRenderingTarget2D } from "fancy-canvas";

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
import { markerDisplayGeometry, markerLogicalPosition, markerRightLabelBoundary, markerTimelineTimes } from "../../lib/chart/marker-geometry";
import { displayTimeForCandle } from "../../lib/replay/display-time";
import type { TradeExecution } from "../../lib/trades/types";
import { Eye, Maximize2 } from "lucide-react";
import { tradeScopeKey } from "../../lib/trades/types";
import {
  mapExecutionsToCandles,
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
  type ChartPlotBounds,
  type DrawingCanvasHandle,
} from "./drawing-canvas";

export type ChartViewport = {
  version: 1;
  logicalRange: { from: number; to: number } | null;
  barSpacing: number;
  rightOffset: number;
  width: number;
  height: number;
  priceRange?: { from: number; to: number };
  priceScaleOptions?: { mode: number; invertScale: boolean; autoScale: boolean; scaleMargins: { top: number; bottom: number } };
  imageFrame?: typeof CANONICAL_CAPTURE_FRAME;
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
  planLinesEditable?: boolean;
  onPlanPriceChange?: (id: string, price: string) => void;
  onPlanInteractionStart?: () => void;
  onPlanPriceSelect?: (id: string) => void;
  planPriceLines?: { id: string; price: number; title: string }[];
  compactControls?: boolean;
  drawings: NormalizedDrawing[];
  activeTool: DrawingTool;
  settings: ChartSettings;
  episodeId: string;
  timeframe?: Timeframe;
  viewportKey?: string;
  focusRange?: EpisodeViewport;
  revealRequest?: ReplayChartRevealRequest;
  locateRequest?: ReviewChartLocateRequest;
  onLocateResult?: (result: ReviewChartLocateResult) => void;
  onLocateTimeframeChange?: (timeframe: Timeframe) => void;
  onExecutionSelect?: (executionId: string) => void;
  onReady?: (handle: ChartHandle | null) => void;
  selectedDrawingId: string | null;
  plannedRiskAmount: string | undefined;
  currency: string;
  onSelectDrawing: (id: string | null) => void;
  onCommand: (command: DrawingCommand) => void;
  onDrawingInteractionStart?: () => void;
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

type ChartTimelineData = {
  time: Time;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
};

export type ReplayChartMarker = CanonicalChartMarker & {
  /** Source fills represented by this visual marker. */
  executionIds?: string[];
  fillCount?: number;
  side?: TradeExecution["side"];
};

export type ReplayChartRevealRequest = {
  id: number;
  time: string;
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
      execution.source.sourceTimeKind ?? "",
      execution.source.positionEffect ?? "",
      execution.source.tradingSession ?? "",
    ].join(","))
    .join("|");
}

function positionEventSignature(positionEvents: readonly StatementEvent[]) {
  return positionEvents
    .map((event) => [event.id, event.kind, event.date, event.quantity ?? "", event.displayTimePolicy ?? ""].join(","))
    .join("|");
}

type VisibleTimeRange = { from: Time; to: Time };
type LogicalRange = { from: number; to: number };
type ReplayChartClickParam = { hoveredInfo?: { objectId?: unknown }; hoveredObjectId?: unknown };

function logicalRangesEqual(left: LogicalRange | null | undefined, right: LogicalRange | null | undefined) {
  return left !== null && left !== undefined && right !== null && right !== undefined &&
    Math.abs(left.from - right.from) < 0.0001 && Math.abs(left.to - right.to) < 0.0001;
}

function numericChartTime(time: Time) {
  if (typeof time === "number") return time;
  if (typeof time === "string") {
    const parsed = Date.parse(time);
    return Number.isFinite(parsed) ? Math.floor(parsed / 1000) : null;
  }
  return Date.UTC(time.year, time.month - 1, time.day) / 1000;
}

/** Project a known timestamp into the chart's logical timeline, including
 * whitespace after the last revealed candle. No candle is fabricated. */
function logicalPositionForTime(candles: readonly ChartTimelineData[], target: Time) {
  const targetSeconds = numericChartTime(target);
  return targetSeconds === null
    ? null
    : markerLogicalPosition(candles.map((candle) => Number(candle.time)), targetSeconds);
}

function nearestCandleIndex(candles: readonly ChartTimelineData[], target: Time) {
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
  candles: readonly ChartTimelineData[],
  target: ChartTimelineData,
  fallback: number,
) {
  const exact = candles.findIndex((candle) => candle.time === target.time);
  if (exact >= 0) return exact;
  return nearestCandleIndex(candles, target.time) ?? fallback;
}

/** Preserve logical padding/fractional bar offsets while refreshes add or remove bars. */
function logicalRangeForUpdatedCandles(
  previousCandles: readonly ChartTimelineData[],
  nextCandles: readonly ChartTimelineData[],
  range: { from: number; to: number },
) {
  if (previousCandles.length === 0 || nextCandles.length === 0) return null;
  const previousSpan = Math.max(0, range.to - range.from);
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
  const mappedFrom = mapCoordinate(range.from);
  const mappedTo = mapCoordinate(range.to);
  const from = Math.min(mappedFrom, mappedTo);
  const to = Math.max(mappedFrom, mappedTo);
  if (previousSpan > 0 && to - from < previousSpan) {
    // When replay rewinds to a shorter known candle set, nearest-time mapping
    // can map both old endpoints to the same final candle and collapse the
    // user's spacing to one or two bars. Keep the latest known time anchor
    // (including its fractional padding) and translate the original span
    // around it; the reveal request can then move that preserved window to a
    // newly known target without inventing future candles.
    return { from: mappedTo - previousSpan, to: mappedTo };
  }
  return { from, to };
}

function logicalRangeForVisibleTimes(
  candles: readonly ChartTimelineData[],
  range: VisibleTimeRange,
) {
  const from = nearestCandleIndex(candles, range.from);
  const to = nearestCandleIndex(candles, range.to);
  return from === null || to === null
    ? null
    : { from: Math.min(from, to), to: Math.max(from, to) };
}

function logicalRangeIncludingIndex(
  current: { from: number; to: number } | null | undefined,
  targetIndex: number,
  candleCount: number,
) {
  if (!current || current.to <= current.from) {
    const padding = Math.max(3, Math.ceil(candleCount * 0.04));
    return { from: -padding, to: candleCount - 1 + padding };
  }
  const span = current.to - current.from;
  if (targetIndex >= current.from && targetIndex <= current.to) return current;
  if (current && targetIndex < current.from) {
    return { from: targetIndex, to: targetIndex + span };
  }
  return { from: targetIndex - span, to: targetIndex };
}

function priceRangeIncludingValues(
  current: { from: number; to: number } | null | undefined,
  values: readonly number[],
) {
  const finiteValues = values.filter(Number.isFinite);
  if (finiteValues.length === 0) return null;
  const low = Math.min(...finiteValues);
  const high = Math.max(...finiteValues);
  if (current && current.to > current.from && [current.from, current.to].every(Number.isFinite)) {
    if (low >= current.from && high <= current.to) return current;
    const padding = Math.max((high - low) * 0.1, Math.abs(high) * 0.01, 0.000001);
    const span = current.to - current.from;
    if (high - low + padding * 2 >= span) return { from: low - padding, to: high + padding };
    if (low < current.from) {
      const from = low - padding;
      return { from, to: from + span };
    }
    const to = high + padding;
    return { from: to - span, to };
  }
  const padding = Math.max((high - low) * 0.1, Math.abs(high) * 0.01, 0.000001);
  return { from: low - padding, to: high + padding };
}

type MarkerPositionState = {
  long: number;
  short: number;
  unknown: boolean;
  directionUnknown: boolean;
};

function markerQuantity(execution: TradeExecution) {
  const quantity = Number(execution.quantity);
  return Number.isFinite(quantity) && quantity > 0 ? quantity : null;
}

function markerDelta(execution: TradeExecution) {
  const quantity = markerQuantity(execution);
  if (quantity === null) return null;
  switch (execution.source.positionEffect) {
    case "open-long": return { long: quantity, short: 0, directionKnown: true };
    case "close-long": return { long: -quantity, short: 0, directionKnown: true };
    case "open-short": return { long: 0, short: quantity, directionKnown: true };
    case "close-short": return { long: 0, short: -quantity, directionKnown: true };
    default: return execution.side === "buy"
      ? { long: quantity, short: 0, directionKnown: false }
      : { long: -quantity, short: 0, directionKnown: false };
  }
}

function actionLabelForExecution(
  execution: TradeExecution,
  before: MarkerPositionState,
  after: MarkerPositionState,
) {
  const inventoryKnown = !before.unknown && !after.unknown && !before.directionUnknown && !after.directionUnknown;
  switch (execution.source.positionEffect) {
    case "open-long": return before.long > 0 && !before.unknown && !before.directionUnknown ? "加仓" : "买入";
    case "close-long": return inventoryKnown && after.long <= 0 && before.long > 0 ? "清仓" : "减仓";
    case "open-short": return before.short > 0 && !before.unknown && !before.directionUnknown ? "加空" : "卖出开仓";
    case "close-short": return inventoryKnown && after.short <= 0 && before.short > 0 ? "买入平仓" : "减空";
    default:
      if (execution.side === "buy") return before.long > 0 && !before.unknown && !before.directionUnknown ? "加仓" : "买入";
      if (before.long > 0 && !before.unknown && !before.directionUnknown) return inventoryKnown && after.long <= 0 ? "清仓" : "减仓";
      return "卖出";
  }
}

type ReplayExecutionMarkerPrimitive = ISeriesPrimitive<Time> & {
  setMarkers: (markers: readonly ReplayChartMarker[]) => void;
};

export function createExecutionMarkerPrimitive(
  getCandleData: () => readonly ChartTimelineData[],
): ReplayExecutionMarkerPrimitive {
  let chart: IChartApi | null = null;
  let series: ISeriesApi<"Candlestick"> | null = null;
  let requestUpdate: (() => void) | null = null;
  let markers: readonly ReplayChartMarker[] = [];
  const timeToX = (time: Time) => {
    const candleData = getCandleData();
    const seconds = numericChartTime(time);
    if (seconds === null || !chart) return null;
    const logical = markerLogicalPosition(candleData.map((candle) => Number(candle.time)), seconds);
    if (logical === null) return null;
    const exactCandleTime = Number.isInteger(logical);
    return exactCandleTime
      ? chart.timeScale().timeToCoordinate(time) ?? chart.timeScale().logicalToCoordinate(logical as Logical) ?? null
      : chart.timeScale().logicalToCoordinate(logical as Logical) ?? null;
  };
  const renderer: IPrimitivePaneRenderer = {
    draw(target: CanvasRenderingTarget2D) {
      if (!chart || !series) return;
      const liveChart = chart;
      const liveSeries = series;
      target.useMediaCoordinateSpace(({ context, mediaSize }) => {
        const plotWidth = liveChart.timeScale().width?.();
        const priceScaleWidth = liveSeries.priceScale().width?.();
        drawExecutionMarkers(context, markers, {
          timeToX,
          priceToY: (price) => liveSeries.priceToCoordinate(price) ?? null,
          maxX: Number.isFinite(plotWidth) && (plotWidth as number) > 0 ? plotWidth : mediaSize.width,
          rightLabelBoundaryX: Number.isFinite(plotWidth) && (plotWidth as number) > 0
            ? markerRightLabelBoundary(plotWidth as number, priceScaleWidth)
            : mediaSize.width,
        });
      });
    },
  };
  const view: IPrimitivePaneView = {
    zOrder: () => "top",
    renderer: () => renderer,
  };
  return {
    setMarkers(nextMarkers: readonly ReplayChartMarker[]) {
      markers = nextMarkers;
      requestUpdate?.();
    },
    attached(parameters: { chart: IChartApi; series: ISeriesApi<"Candlestick">; requestUpdate: () => void }) {
      chart = parameters.chart;
      series = parameters.series;
      requestUpdate = parameters.requestUpdate;
    },
    detached() {
      chart = null;
      series = null;
      requestUpdate = null;
    },
    updateAllViews() {},
    hitTest(x: number, y: number) {
      if (!chart || !series) return null;
      let nearest: { marker: ReplayChartMarker; distance: number } | null = null;
      for (const marker of markers) {
        const markerX = timeToX(marker.time);
        const markerAnchorY = series.priceToCoordinate(marker.price);
        if (markerX === null || markerAnchorY === null) continue;
        const geometry = markerDisplayGeometry({
          anchorX: markerX,
          anchorY: markerAnchorY,
          position: marker.position,
          offsetX: marker.offsetX,
          offsetY: marker.offsetY,
          maxX: chart.timeScale().width?.(),
        });
        const distance = Math.hypot(x - geometry.x, y - geometry.y);
        if (distance <= 14 && (!nearest || distance < nearest.distance)) nearest = { marker, distance };
      }
      const hit = nearest;
      const executionId = hit?.marker.executionIds?.[0];
      if (!hit || !executionId) return null;
      return { externalId: executionId, distance: hit.distance, hitTestPriority: 2, cursorStyle: "pointer", zOrder: "top", itemType: "marker" };
    },
    autoscaleInfo(startTimePoint: Logical, endTimePoint: Logical) {
      const candleTimes = getCandleData().map((candle) => Number(candle.time));
      const prices = markers.flatMap((marker) => {
        if (!Number.isFinite(marker.price)) return [];
        const seconds = numericChartTime(marker.time);
        const logical = seconds === null ? null : markerLogicalPosition(candleTimes, seconds);
        return logical !== null && logical >= Number(startTimePoint) && logical <= Number(endTimePoint)
          ? [marker.price]
          : [];
      });
      if (prices.length === 0) return null;
      const min = Math.min(...prices);
      const max = Math.max(...prices);
      const padding = Math.max((max - min) * 0.08, Math.abs(max) * 0.01, 0.000001);
      return {
        priceRange: {
          minValue: min - padding,
          maxValue: max + padding,
        },
      };
    },
    paneViews: () => [view],
  } as unknown as ReplayExecutionMarkerPrimitive;
}

function isTimeAnchoredExecution(execution: TradeExecution) {
  return execution.source.tradingSession !== "grey-market" &&
    execution.source.timePrecision !== "date-only" &&
    execution.source.sourceTimeKind !== "date" &&
    execution.source.sourceTimeKind !== "order" &&
    chartTime(execution.executedAt) !== null &&
    Number.isFinite(Number(execution.price));
}

/**
 * Build the exact time axis known to the replay. Unmapped timestamped fills
 * are registered as Lightweight Charts whitespace points; they carry no OHLC
 * and therefore cannot reveal a future candle.
 */
function chartTimelineData(
  candles: readonly Candle[],
  executions: readonly TradeExecution[],
): ChartTimelineData[] {
  const candleData = chartCandleData(candles);
  const validCandleTimes = new Set(validCandles(candles).map((candle) => candle.time));
  const mappedExecutionIds = new Set(
    mapExecutionsToCandles(candles, executions)
      .filter((marker) => validCandleTimes.has(marker.candleTime))
      .map((marker) => marker.executionId),
  );
  const timeline = new Map<number, ChartTimelineData>(
    candleData.map((candle) => [Number(candle.time), candle]),
  );
  for (const execution of executions) {
    if (mappedExecutionIds.has(execution.id) || !isTimeAnchoredExecution(execution)) continue;
    const time = chartTime(execution.executedAt);
    if (time === null) continue;
    const seconds = Number(time);
    if (!timeline.has(seconds)) timeline.set(seconds, { time });
  }
  const axisTimes = markerTimelineTimes(
    candleData.map((candle) => Number(candle.time)),
    [...timeline.keys()].filter((time) => !candleData.some((candle) => Number(candle.time) === time)),
  );
  return axisTimes.flatMap((time) => {
    const point = timeline.get(time);
    return point ? [point] : [];
  });
}

type MarkerExecutionFact = {
  execution: TradeExecution;
  inputIndex: number;
  candleTime?: string;
  time: Time;
  candle?: Candle;
};

function executionMarkerFacts(
  candles: readonly Candle[],
  executions: readonly TradeExecution[],
) {
  const candleByTime = new Map(validCandles(candles).map((candle) => [candle.time, candle]));
  const mapped = new Map(
    mapExecutionsToCandles(candles, executions)
      .filter((marker) => candleByTime.has(marker.candleTime))
      .map((marker) => [marker.executionId, marker.candleTime]),
  );
  return executions
    .map((execution, inputIndex): MarkerExecutionFact | null => {
      const candleTime = mapped.get(execution.id);
      const time = chartTime(candleTime ?? (isTimeAnchoredExecution(execution) ? execution.executedAt : ""));
      if (time === null) return null;
      return { execution, inputIndex, candleTime, time, candle: candleTime ? candleByTime.get(candleTime) : undefined };
    })
    .filter((fact): fact is MarkerExecutionFact => fact !== null)
    .sort((left, right) => {
      const leftTime = Date.parse(left.execution.executedAt);
      const rightTime = Date.parse(right.execution.executedAt);
      const leftOrder = Number.isFinite(leftTime) ? leftTime : Number.POSITIVE_INFINITY;
      const rightOrder = Number.isFinite(rightTime) ? rightTime : Number.POSITIVE_INFINITY;
      return leftOrder - rightOrder || left.inputIndex - right.inputIndex;
    });
}

export function buildReplayChartMarkers(
  candles: readonly Candle[],
  executions: readonly TradeExecution[],
  positionEvents: readonly StatementEvent[] = [],
  highlightedExecutionId?: string,
): ReplayChartMarker[] {
  const validChartCandles = validCandles(candles);
  const validChartTimes = new Set(validChartCandles.flatMap((candle) => {
    const time = chartTime(candle.time);
    return time === null ? [] : [time];
  }));
  const executionFacts = executionMarkerFacts(candles, executions);
  const markerOffsetByExecutionId = new Map<string, number>();
  const markerOffsetYByExecutionId = new Map<string, number>();
  const sameTimeFacts = new Map<number, MarkerExecutionFact[]>();
  for (const fact of executionFacts) {
    const key = Number(fact.time);
    const group = sameTimeFacts.get(key) ?? [];
    group.push(fact);
    sameTimeFacts.set(key, group);
  }
  for (const facts of sameTimeFacts.values()) {
    const sideLanes = new Map<TradeExecution["side"], number>();
    facts.forEach((fact, index) => {
      const lane = sideLanes.get(fact.execution.side) ?? 0;
      sideLanes.set(fact.execution.side, lane + 1);
      markerOffsetByExecutionId.set(
        fact.execution.id,
        (index - (facts.length - 1) / 2) * 18,
      );
      markerOffsetYByExecutionId.set(
        fact.execution.id,
        fact.execution.side === "buy" ? lane * 22 : lane === 0 ? 0 : -lane * 22,
      );
    });
  }
  const stateByScope = new Map<string, MarkerPositionState>();
  const executionMarkers = executionFacts.flatMap((fact): ReplayChartMarker[] => {
    const { execution } = fact;
    const stateKey = `${execution.accountId}:${tradeScopeKey(execution)}`;
    const before = stateByScope.get(stateKey) ?? { long: 0, short: 0, unknown: false, directionUnknown: false };
    const after = { ...before };
    const delta = markerDelta(execution);
    if (!delta) {
      after.unknown = true;
      if (!execution.source.positionEffect) after.directionUnknown = true;
    } else {
      if (!delta.directionKnown) after.directionUnknown = true;
      if (execution.source.positionEffect === "open-short" || execution.source.positionEffect === "close-short") {
        after.short = Math.max(0, after.short + delta.short);
      } else {
        after.long = Math.max(0, after.long + delta.long);
      }
    }
    const actionLabel = actionLabelForExecution(execution, before, after);
    stateByScope.set(stateKey, after);
    const price = fact.candle
      ? execution.side === "buy" ? fact.candle.low : fact.candle.high
      : Number(execution.price);
    if (!Number.isFinite(price)) return [];
    const highlighted = highlightedExecutionId === execution.id;
    return [{
      time: fact.time,
      price,
      position: execution.side === "buy" ? "belowBar" : "aboveBar",
      color: highlighted ? "#f3ba2f" : execution.side === "buy" ? "#26a69a" : "#ef5350",
      shape: "diamond",
      actionLabel,
      text: `${highlighted ? "★ " : ""}${actionLabel}`,
      executionIds: [execution.id],
      fillCount: 1,
      offsetX: markerOffsetByExecutionId.get(execution.id) ?? 0,
      offsetY: markerOffsetYByExecutionId.get(execution.id) ?? 0,
      side: execution.side,
    }];
  });
  const markers = [
    ...executionMarkers,
    ...[...new Map(positionEvents.map((event) => [event.id, event])).values()]
      .filter((event) => event.kind === "ipo" && event.quantity && event.displayTimePolicy === "session-open")
      .map((event): ReplayChartMarker | null => {
        const candleTime = displayTimeForCandle(validChartCandles, {
          at: event.date,
          policy: event.displayTimePolicy,
        });
        const time = candleTime ? chartTime(candleTime) : null;
        if (time === null || !validChartTimes.has(time)) return null;
        const candle = validChartCandles.find((candidate) => candidate.time === candleTime);
        return {
          time,
          price: candle?.low ?? 0,
          position: "belowBar",
          color: "#a78bfa",
          shape: "diamond",
          actionLabel: "配售",
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

function fitChartToCandles(
  chart: IChartApi,
  candleCount: number,
  setRange: (range: LogicalRange) => void = (range) => chart.timeScale().setVisibleLogicalRange(range),
) {
  if (candleCount <= 0) return;
  chart.timeScale().fitContent();
  const padding = Math.max(3, Math.ceil(candleCount * 0.04));
  setRange({
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
  planPriceLines,
  compactControls = false,
  planLinesEditable = false,
  onPlanPriceChange,
  onPlanInteractionStart,
  onPlanPriceSelect,
  drawings,
  activeTool,
  settings,
  episodeId,
  timeframe = "1D",
  viewportKey = episodeId,
  focusRange,
  revealRequest,
  locateRequest,
  onLocateResult,
  onLocateTimeframeChange,
  onExecutionSelect,
  onReady,
  selectedDrawingId,
  plannedRiskAmount,
  currency,
  onSelectDrawing,
  onCommand,
  onDrawingInteractionStart,
}: Props) {
  const planHitControls = useRef(new Map<string, HTMLButtonElement>());
  const planDrag = useRef<{id:string;original:string;pointerId:number} | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const executionMarkerPrimitiveRef = useRef<ReplayExecutionMarkerPrimitive | null>(null);
  const costLineRef = useRef<IPriceLine | null>(null);
  const drawingCanvasRef = useRef<DrawingCanvasHandle | null>(null);
  const chartHandleRef = useRef<ChartHandle | null>(null);
  const candlesRef = useRef(candles);
  const drawingsRef = useRef(drawings);
  const onExecutionSelectRef = useRef(onExecutionSelect);
  const visibleExecutionIdsRef = useRef<Set<string>>(new Set());
  const chartClickHandlerRef = useRef<((param: ReplayChartClickParam) => void) | null>(null);
  const visibleLogicalRangeHandlerRef = useRef<(() => void) | null>(null);
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
  const revealedRequestRef = useRef<number | null>(null);
  const unresolvedLocationAttemptRef = useRef<string | null>(null);
  const appliedCandleDataRef = useRef<ChartTimelineData[]>([]);
  const lastViewSnapshotRef = useRef<{
    data: ChartTimelineData[];
    logicalRange?: { from: number; to: number } | null;
    timeRange?: VisibleTimeRange | null;
  } | null>(null);
  // lightweight-charts applies target logical ranges during its next paint.
  // ResizeObserver can run in that gap, so keep the latest chart-owned range
  // as the authority instead of reading the still-old range back from LWC.
  const pendingLogicalRangeRef = useRef<LogicalRange | null>(null);
  const pendingPriceRangeRef = useRef<{ from: number; to: number } | null>(null);
  const pendingLogicalRangeVersionRef = useRef(0);
  const [chartReady, setChartReady] = useState(false);
  const [coordinateVersion, setCoordinateVersion] = useState(0);
  const [crosshair, setCrosshair] = useState<CrosshairCandle | null>(
    null,
  );

  const requestLogicalRange = useCallback((
    scale: ReturnType<IChartApi["timeScale"]>,
    range: LogicalRange,
  ) => {
    const next = { from: range.from, to: range.to };
    pendingLogicalRangeRef.current = next;
    pendingLogicalRangeVersionRef.current += 1;
    scale.setVisibleLogicalRange(next);
  }, []);

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

  const [plotBounds, setPlotBounds] = useState<ChartPlotBounds | undefined>();

  useLayoutEffect(() => {
    if (!chartReady) return;
    const chart = chartRef.current;
    const fullWidth = chartSizeRef.current.width;
    const fullHeight = chartSizeRef.current.height;
    if (!chart || fullWidth <= 0 || fullHeight <= 0) return;
    const measuredWidth = chart.timeScale().width?.();
    const measuredHeight = chart.panes?.()[0]?.getHeight?.();
    const nextBounds = {
      width: Number.isFinite(measuredWidth) && (measuredWidth as number) > 0
        ? Math.max(1, Math.min(fullWidth, measuredWidth as number))
        : fullWidth,
      height: Number.isFinite(measuredHeight) && (measuredHeight as number) > 0
        ? Math.max(1, Math.min(fullHeight, measuredHeight as number))
        : fullHeight,
    };
    setPlotBounds((current) => current?.width === nextBounds.width && current.height === nextBounds.height ? current : nextBounds);
  }, [chartReady, coordinateVersion]);

  useLayoutEffect(() => {
    candlesRef.current = candles;
    drawingsRef.current = drawings;
    viewportKeyRef.current = viewportKey;
    coordinateAdapterRef.current = coordinateAdapter;
    onExecutionSelectRef.current = onExecutionSelect;
  }, [candles, coordinateAdapter, drawings, onExecutionSelect, viewportKey]);

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
            minimumWidth: 84,
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
        const executionMarkerPrimitive = createExecutionMarkerPrimitive(
          () => appliedCandleDataRef.current,
        );
        (candleSeries as ISeriesApi<"Candlestick"> & { attachPrimitive?: (primitive: ISeriesPrimitive<Time>) => void }).attachPrimitive?.(executionMarkerPrimitive);
        const costLine = candleSeries.createPriceLine({
          price: 0,
          color: "#f3ba2f",
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: false,
          title: "成本",
        });

        chart.subscribeCrosshairMove((param) => {
          if (disposed) return;
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
        const handleChartClick = (param: ReplayChartClickParam) => {
          const objectId = param.hoveredInfo?.objectId ?? param.hoveredObjectId;
          if (typeof objectId === "string" && visibleExecutionIdsRef.current.has(objectId)) {
            onExecutionSelectRef.current?.(objectId);
          }
        };
        const clickCapableChart = chart as IChartApi & {
          subscribeClick?: (handler: (param: ReplayChartClickParam) => void) => void;
          unsubscribeClick?: (handler: (param: ReplayChartClickParam) => void) => void;
        };
        chartClickHandlerRef.current = handleChartClick;
        clickCapableChart.subscribeClick?.(handleChartClick);
        const handleVisibleLogicalRangeChange = () => {
          if (disposed) return;
          const pending = pendingLogicalRangeRef.current;
          const current = chart.timeScale().getVisibleLogicalRange?.();
          if (pending) {
            const version = pendingLogicalRangeVersionRef.current;
            if (logicalRangesEqual(pending, current)) {
              pendingLogicalRangeRef.current = null;
            } else {
              // A range-change notification can be delivered before the
              // browser's paint that applies the target. Defer mismatch
              // handling so a same-frame resize can reassert the target first.
              queueMicrotask(() => {
                if (disposed || pendingLogicalRangeVersionRef.current !== version) return;
                const latest = chart.timeScale().getVisibleLogicalRange?.();
                if (!logicalRangesEqual(pendingLogicalRangeRef.current, latest)) {
                  pendingLogicalRangeRef.current = null;
                }
              });
            }
          }
          setCoordinateVersion((version) => version + 1);
        };
        visibleLogicalRangeHandlerRef.current = handleVisibleLogicalRangeChange;
        chart.timeScale().subscribeVisibleLogicalRangeChange(handleVisibleLogicalRangeChange);

        chartRef.current = chart;
        seriesRef.current = candleSeries;
        volumeSeriesRef.current = volumeSeries;
        executionMarkerPrimitiveRef.current = executionMarkerPrimitive;
        costLineRef.current = costLine;
        setChartReady(true);

        observer = new ResizeObserver(() => {
          if (disposed) return;
          const width = Math.max(1, container.clientWidth);
          const height = Math.max(1, container.clientHeight);
          const previousWidth = chartSizeRef.current.width;
          const widthChanged = previousWidth > 0 && width !== previousWidth;
          const rangeBeforeResize = pendingLogicalRangeRef.current ?? chart.timeScale().getVisibleLogicalRange?.();
          chart.applyOptions({
            width,
            height,
          });
          // Height changes do not alter the time scale. On a width change,
          // preserve the chart-owned pending target when LWC's getter still
          // exposes the pre-paint range; otherwise preserve the stable range.
          if (widthChanged && width > 0) {
            if (rangeBeforeResize) requestLogicalRange(chart.timeScale(), rangeBeforeResize);
          }
          chartSizeRef.current = { width, height };
          const usable = width >= 400 && height >= 180;
          if (!usable) {
            waitingForUsableSizeRef.current = true;
          } else if (
            waitingForUsableSizeRef.current ||
            (!initialFitDoneRef.current && previousWidth === 0)
          ) {
            const timelineCount = appliedCandleDataRef.current.length || candlesRef.current.length;
            if (pendingLogicalRangeRef.current) {
              requestLogicalRange(chart.timeScale(), pendingLogicalRangeRef.current);
            } else {
              fitChartToCandles(chart, timelineCount, (range) => requestLogicalRange(chart.timeScale(), range));
            }
            initialFitDoneRef.current = timelineCount > 0;
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
      // The chart effect can be cleaned up and rebuilt while React preserves
      // component state (for example during Fast Refresh or Activity).
      // Invalidate the published readiness state before removing the chart so
      // the onReady effect cannot hand the parent a handle backed by this
      // disposed chart.
      setChartReady(false);
      chartHandleRef.current = null;
      const activeChart = chartRef.current;
      const activeRange = activeChart?.timeScale().getVisibleLogicalRange?.();
      pendingLogicalRangeRef.current = activeRange ? { ...activeRange } : null;
      const activePriceRange = seriesRef.current?.priceScale().getVisibleRange?.();
      pendingPriceRangeRef.current = activePriceRange &&
        Number.isFinite(activePriceRange.from) && Number.isFinite(activePriceRange.to) &&
        activePriceRange.to > activePriceRange.from
        ? { ...activePriceRange }
        : null;
      chartSizeRef.current = { width: 0, height: 0 };
      initialFitDoneRef.current = false;
      waitingForUsableSizeRef.current = true;
      observer?.disconnect();
      const clickCapableChart = chartRef.current as (IChartApi & {
        unsubscribeClick?: (handler: (param: ReplayChartClickParam) => void) => void;
      }) | null;
      const chartClickHandler = chartClickHandlerRef.current;
      if (clickCapableChart && chartClickHandler) clickCapableChart.unsubscribeClick?.(chartClickHandler);
      chartClickHandlerRef.current = null;
      const visibleLogicalRangeHandler = visibleLogicalRangeHandlerRef.current;
      if (activeChart && visibleLogicalRangeHandler) {
        activeChart.timeScale().unsubscribeVisibleLogicalRangeChange?.(visibleLogicalRangeHandler);
      }
      visibleLogicalRangeHandlerRef.current = null;
      pendingLogicalRangeVersionRef.current += 1;
      if (seriesRef.current && executionMarkerPrimitiveRef.current) {
        (seriesRef.current as ISeriesApi<"Candlestick"> & { detachPrimitive?: (primitive: ISeriesPrimitive<Time>) => void }).detachPrimitive?.(executionMarkerPrimitiveRef.current);
      }
      chartRef.current?.remove();
      chartRef.current = null;
      seriesRef.current = null;
      volumeSeriesRef.current = null;
      executionMarkerPrimitiveRef.current = null;
      costLineRef.current = null;
    };
  }, [requestLogicalRange]);

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
  const timelineData = chartTimelineData(candles, settings.showExecutions ? executions : []);
  const timelineSignature = [candleSignature, mappingSignature, executionMarkerSignature(executions), settings.showExecutions ? "on" : "off"].join("\u0001");
  const highlightedExecutionId = locateRequest?.episodeId === episodeId &&
    executions.some((execution) =>
      execution.id === locateRequest.executionId &&
      execution.instrument.id === locateRequest.instrumentId,
    )
    ? locateRequest.executionId
    : undefined;
  const markerData = useMemo(
    () => settings.showExecutions
      ? buildReplayChartMarkers(
          candles,
          executions,
          positionEvents,
          highlightedExecutionId,
        )
      : [],
    [candles, executions, highlightedExecutionId, positionEvents, settings.showExecutions],
  );
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
    if (!chartRef.current || appliedCandleDataRef.current.length === 0) return;
    // Leave room for arrows/text on the first and last bars as well.
    fitChartToCandles(
      chartRef.current,
      appliedCandleDataRef.current.length,
      (range) => requestLogicalRange(chartRef.current!.timeScale(), range),
    );
    fittedRef.current = viewportIdentity(viewportKeyRef.current);
    const usable = chartSizeRef.current.width >= 400 && chartSizeRef.current.height >= 180;
    initialFitDoneRef.current = usable;
    waitingForUsableSizeRef.current = !usable;
    setCrosshair(null);
    setCoordinateVersion((version) => version + 1);
  }, [requestLogicalRange]);

  useLayoutEffect(() => {
    const candleSeries = seriesRef.current;
    const volumeSeries = volumeSeriesRef.current;
    if (!chartReady || !candleSeries || !volumeSeries) return;

    const scale = chartRef.current?.timeScale();
    if (!scale) return;
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
    executionMarkerPrimitiveRef.current?.setMarkers([]);
    visibleExecutionIdsRef.current.clear();
    candleSeries.setData(
      timelineData.map((point) => point.open === undefined
        ? { time: point.time }
        : {
            time: point.time,
            open: point.open,
            high: point.high!,
            low: point.low!,
            close: point.close!,
          }),
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
      logicalRangeForUpdatedCandles(snapshot.data, timelineData, snapshot.logicalRange);
    const restoredTimeRange = snapshot?.timeRange &&
      snapshot.data.length > 0 &&
      logicalRangeForVisibleTimes(timelineData, snapshot.timeRange);
    if (timelineData.length > 0 && restoredLogicalRange) {
      requestLogicalRange(scale!, restoredLogicalRange);
    } else if (timelineData.length > 0 && restoredTimeRange) {
      requestLogicalRange(scale!, restoredTimeRange);
    } else if (timelineData.length > 0 && snapshot?.logicalRange) {
      requestLogicalRange(scale!, snapshot.logicalRange);
    }
    const pendingPriceRange = pendingPriceRangeRef.current;
    if (pendingPriceRange) {
      const priceScale = candleSeries.priceScale();
      priceScale.setVisibleRange(pendingPriceRange);
      pendingPriceRangeRef.current = null;
    }
    appliedCandleDataRef.current = timelineData;
    setCoordinateVersion((version) => version + 1);
  // Value signature dependencies intentionally ignore refreshed array identity.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartReady, requestLogicalRange, timelineSignature, viewportKey]);

  useLayoutEffect(() => {
    const scale = chartRef.current?.timeScale();
    if (!chartReady || !scale || !revealRequest || validCandleData.length === 0) return;
    if (revealedRequestRef.current === revealRequest.id) return;
    const targetTimestamp = chartTime(revealRequest.time);
    if (targetTimestamp === null) return;
    const targetSeconds = numericChartTime(targetTimestamp);
    if (targetSeconds === null) return;
    let targetIndex = -1;
    for (let index = 0; index < validCandleData.length; index += 1) {
      if (Number(validCandleData[index].time) <= targetSeconds) targetIndex = index;
      else break;
    }
    // Do not navigate to a future candle when a request arrives before its data.
    if (targetIndex < 0) return;
    const targetCandle = validCandleData[targetIndex];
    // The replay cursor is a knowledge cutoff (usually the candle close),
    // while the chart axis registers a candle at its opening time. A cutoff
    // after the last revealed candle therefore falls outside the axis. Keep
    // the real candle time as the navigation anchor and only use the request
    // time itself when it is an explicitly registered whitespace point (for
    // example an execution whose candle is still withheld).
    const targetCandleLogical = logicalPositionForTime(timelineData, targetCandle.time);
    const requestedLogical = timelineData.some((point) => numericChartTime(point.time) === targetSeconds)
      ? logicalPositionForTime(timelineData, targetTimestamp)
      : null;
    const latestKnownExecutionTime = markerData
      .flatMap((marker) => {
        if (!marker.executionIds?.length) return [];
        const markerSeconds = numericChartTime(marker.time);
        return markerSeconds !== null && markerSeconds <= targetSeconds ? [markerSeconds] : [];
      })
      .reduce((latest, time) => Math.max(latest, time), Number.NEGATIVE_INFINITY);
    const latestKnownExecutionLogical = Number.isFinite(latestKnownExecutionTime)
      ? logicalPositionForTime(timelineData, latestKnownExecutionTime as Time)
      : null;
    const targetLogicals = [targetCandleLogical, requestedLogical, latestKnownExecutionLogical]
      .filter((logical): logical is number => logical !== null && Number.isFinite(logical));
    const targetLogical = targetLogicals.length > 0 ? Math.max(...targetLogicals) : null;
    if (targetLogical === null) return;
    // setData can synchronously shift LWC's getter while the preceding data
    // effect has already queued a preservation range for the next paint. The
    // queued range is authoritative for this reveal transaction; reading the
    // transient getter can make the target look visible and skip navigation.
    const current = pendingLogicalRangeRef.current ?? scale.getVisibleLogicalRange?.();
    // On the first commit lightweight-charts may report an empty range before
    // its first layout. Seed that one request from the caller's revealed
    // episode window so the initial navigation does not collapse to a single
    // bar or let the later generic fit effect overwrite the requested focus.
    const seedRange = current && current.to > current.from
      ? current
      : focusRange
        ? episodeViewport(validChartCandles, focusRange)
        : current;
    const next = logicalRangeIncludingIndex(seedRange, targetLogical, timelineData.length);
    if (next !== current) requestLogicalRange(scale, next);
    const priceScale = seriesRef.current?.priceScale();
    const priceScaleOptions = (priceScale as unknown as { options?: () => { autoScale?: boolean } } | undefined)?.options?.();
    // The replay request is a knowledge cutoff, not necessarily the execution
    // timestamp. Use the latest revealed execution at or before that cutoff,
    // while leaving ordinary refreshes outside this one-shot effect.
    const targetExecutionPrices = markerData
      .flatMap((marker) => {
        if (!marker.executionIds?.length || !Number.isFinite(marker.price)) return [];
        const markerSeconds = numericChartTime(marker.time);
        return markerSeconds !== null && markerSeconds <= targetSeconds
          ? [{ time: markerSeconds, price: marker.price }]
          : [];
      });
    const latestExecutionTime = Math.max(...targetExecutionPrices.map((item) => item.time), Number.NEGATIVE_INFINITY);
    const latestExecutionPrices = targetExecutionPrices
      .filter((item) => item.time === latestExecutionTime)
      .map((item) => item.price);
    const targetPriceValues = targetCandle
      ? [targetCandle.low, targetCandle.high, ...latestExecutionPrices]
      : latestExecutionPrices;
    if (targetPriceValues.length > 0 && priceScaleOptions?.autoScale === false) {
      const currentPriceRange = priceScale?.getVisibleRange?.();
      const nextPriceRange = priceRangeIncludingValues(currentPriceRange, targetPriceValues);
      if (nextPriceRange && nextPriceRange !== currentPriceRange) priceScale?.setVisibleRange(nextPriceRange);
    }
    revealedRequestRef.current = revealRequest.id;
    fittedRef.current = viewportIdentity(viewportKeyRef.current);
    // Let the layout transaction finish before clearing React state, avoiding
    // a synchronous cascading render while still clearing before next paint.
    queueMicrotask(() => {
      setCrosshair(null);
      setCoordinateVersion((version) => version + 1);
    });
  }, [
    chartReady,
    candleSignature,
    revealRequest?.id,
    revealRequest?.time,
    focusRangeSignature,
    focusRange,
    revealRequest,
    validCandleData,
    validCandleData.length,
    timelineData,
    validChartCandles,
    markerData,
    requestLogicalRange,
  ]);

  useEffect(() => {
    const markerPrimitive = executionMarkerPrimitiveRef.current;
    if (!chartReady || !markerPrimitive) return;
    // Data and marker mutations happen in separate effects. Installing after
    // the data mutation avoids a transient marker hit-test against old bars.
    visibleExecutionIdsRef.current = new Set(
      markerData.flatMap((marker) => marker.executionIds ?? []),
    );
    markerPrimitive.setMarkers(markerData);
  // Marker values are derived from the signature; array identity is irrelevant.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartReady, markerSignature]);

  useEffect(() => {
    const scale = chartRef.current?.timeScale();
    if (!chartReady || !scale || timelineData.length === 0 || validCandleData.length === 0) return;
    if (fittedRef.current === viewportIdentity(viewportKey)) return;
    scale.fitContent();
    // Leave room for arrows/text on the first and last bars as well.
    const padding = Math.max(3, Math.ceil(timelineData.length * 0.04));
    requestLogicalRange(scale,
      focusRange
        ? episodeViewport(validChartCandles, focusRange)
        : {
            from: -padding,
            to: timelineData.length - 1 + padding,
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
    timelineData.length,
    validCandleData.length,
    validChartCandles,
    requestLogicalRange,
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
    requestLogicalRange(scale, {
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
    requestLogicalRange,
    candleSignature,
    mappingSignature,
    validCandleData,
    validChartCandles,
  ]);

  useEffect(() => {
    const series = seriesRef.current;
    if (!chartReady || !series) return;
    const lines = (planPriceLines ?? []).filter(line => Number.isFinite(line.price) && line.price > 0).map(line => series.createPriceLine({ price: line.price, title: line.title, color: "#f3ba2f", lineWidth: 1, lineStyle: 2, axisLabelVisible: true }));
    return () => { for (const line of lines) series.removePriceLine(line); };
  }, [chartReady, planPriceLines]);

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
      ...(seriesRef.current?.priceScale().getVisibleRange?.() ? { priceRange: {...seriesRef.current.priceScale().getVisibleRange()!} } : {}),
      ...(seriesRef.current?.priceScale().options?.() ? { priceScaleOptions: {
        mode: seriesRef.current.priceScale().options().mode,
        invertScale: seriesRef.current.priceScale().options().invertScale,
        autoScale: seriesRef.current.priceScale().options().autoScale,
        scaleMargins: { ...seriesRef.current.priceScale().options().scaleMargins },
      }} : {}),
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
    if (viewport.logicalRange) requestLogicalRange(scale, { ...viewport.logicalRange });
    if (viewport.priceScaleOptions) seriesRef.current?.priceScale().applyOptions(viewport.priceScaleOptions);
    if (viewport.priceRange) seriesRef.current?.priceScale().setVisibleRange(viewport.priceRange);
    // LWC's explicit-range setter disables auto scaling. Restore the saved
    // mode last so revisiting an automatic viewport keeps following new bars.
    if (viewport.priceScaleOptions) seriesRef.current?.priceScale().setAutoScale(viewport.priceScaleOptions.autoScale);
    setCoordinateVersion((version) => version + 1);
  }, [requestLogicalRange]);

  const captureInputRef = useRef({ candles, markerData, planPriceLines, currency, plannedRiskAmount, timeframe });
  useLayoutEffect(() => { captureInputRef.current = { candles, markerData, planPriceLines, currency, plannedRiskAmount, timeframe }; });
  const capturePendingRef = useRef(false);
  const capture = useCallback(async (): Promise<ChartCapture> => {
    if (capturePendingRef.current) throw new Error("图表截图正在进行");
    const chart = chartRef.current;
    const series = seriesRef.current;
    const volume = volumeSeriesRef.current;
    if (!chart || !series || !volume) throw new Error("图表截图不可用");
    capturePendingRef.current = true;
    try {
      // Commands and React layout refs must commit before the immutable scene
      // is frozen. No asynchronous boundary precedes this revision barrier.
      let textCommitReady = true;
      flushSync(() => {
        textCommitReady = drawingCanvasRef.current?.commitText() ?? true;
      });
      if (!textCommitReady) {
        throw new Error("文字编辑或关联取点尚未完成，请先完成或取消编辑；草稿已保留");
      }
      chart.takeScreenshot(false, false);
      const viewport = getViewport();
      if (!viewport.logicalRange || !viewport.priceRange) throw new Error("图表可见范围尚未就绪，无法截图");
      if (viewport.width <= 0 || viewport.height <= 0) throw new Error("图表尺寸无效，无法截图");
      const current = captureInputRef.current;
      const chartOptions = { ...copyChartOptions(chart.options()), timeScale: {
        ...copyChartOptions(chart.options().timeScale),
        tickMarkFormatter: (time: Time, tickMarkType: TickMarkType) => chartTickLabel(time, tickMarkType, current.timeframe ?? "1D"),
      }};
      const scene: CanonicalCaptureScene = {
        chartOptions, candleOptions: copyChartOptions(series.options()),
        volumeOptions: copyChartOptions(volume.options()),
        volumeScaleOptions: copyChartOptions(volume.priceScale().options()),
        candles: structuredClone(validCandles(current.candles)),
        markers: structuredClone(current.markerData),
        priceLines: [copyChartOptions(costLineRef.current!.options()), ...(current.planPriceLines ?? []).filter(line => Number.isFinite(line.price) && line.price > 0).map(line => ({ price: line.price, title: line.title, color: "#f3ba2f", lineWidth: 1 as const, lineStyle: 2, axisLabelVisible: true }))],
        drawings: structuredClone(drawingsRef.current),
        logicalRange: { ...viewport.logicalRange }, priceRange: { ...viewport.priceRange },
        currency: current.currency, plannedRiskAmount: current.plannedRiskAmount,
        expandedTextIds: drawingCanvasRef.current?.getExpandedTextIds?.(),
      };
      if (!scene.candles.length) throw new Error("图表行情尚未就绪，无法截图");
      const fonts = document.fonts?.ready;
      if (fonts) await fonts;
      const rendered = await renderCanonicalChartCapture(scene);
      return { imageDataUrl: rendered.imageDataUrl, viewport: { ...viewport, imageFrame: { ...CANONICAL_CAPTURE_FRAME } }, ...(rendered.warnings.length ? { warnings: rendered.warnings } : {}) };
    } finally { capturePendingRef.current = false; }
  }, [getViewport]);

  useEffect(() => {
    captureRef.current = capture;
    flushRef.current = flush;
    getViewportRef.current = getViewport;
    restoreViewportRef.current = restoreViewport;
    fitAllRef.current = fitAll;
  }, [capture, fitAll, flush, getViewport, restoreViewport]);

  useEffect(() => {
    if (!chartReady || !chartRef.current) {
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

  const safePlanLines = (planPriceLines ?? []).filter(
    line => Number.isFinite(line.price) && line.price > 0,
  );
  // Position the HTML controls against the chart's committed external scale.
  useLayoutEffect(() => {
    for (const line of planPriceLines ?? []) {
      const button = planHitControls.current.get(line.id);
      if (!button) continue;
      const y = seriesRef.current?.priceToCoordinate(line.price);
      const halfHeight = compactControls
        ? Math.max(18, button.offsetHeight / 2, Number.parseFloat(getComputedStyle(button).minHeight) / 2 || 0)
        : 18;
      const visible = y != null && (compactControls
        ? y >= halfHeight && y <= chartSizeRef.current.height - halfHeight
        : y >= 20 && y <= chartSizeRef.current.height - 20);
      button.style.display = visible ? "" : "none";
      if (visible) button.style.top = `${y - halfHeight}px`;
    }
  }, [chartReady, compactControls, coordinateVersion, planPriceLines]);
  const fitPlanPrices = () => {
    const revealedPrices = validChartCandles
      .filter(candle => Date.parse(candle.time) <= Date.parse(cursor))
      .flatMap(candle => [candle.low, candle.high]);
    const prices = [...safePlanLines.map(line => line.price), ...revealedPrices];
    if (!prices.length) return;
    const low = Math.min(...prices);
    const high = Math.max(...prices);
    const padding = Math.max((high - low) * 0.1, high * 0.01);
    seriesRef.current?.priceScale().setVisibleRange({
      from: Math.max(0.000001, low - padding),
      to: high + padding,
    });
    setCoordinateVersion(version => version + 1);
  };
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
      {compactControls ? (
        <div className="replay-chart-compact-controls" role="toolbar" aria-label="图表视野操作"
          style={{ left: plotBounds ? `${plotBounds.width / 2}px` : "50%" }}>
          <button type="button" className="replay-chart-compact-control" onClick={() => fitAllRef.current()} aria-label="适应全部" title="适应全部">
            <Maximize2 size={18} aria-hidden="true" />
          </button>
          {safePlanLines.length > 0 && <button type="button" className="replay-chart-compact-control" onClick={fitPlanPrices} aria-label="显示计划价格" title="显示计划价格">
            <Eye size={18} aria-hidden="true" />
          </button>}
        </div>
      ) : safePlanLines.length > 0 && (
        <button type="button" className="recall-plan-price-action" onClick={fitPlanPrices}
          aria-label="显示计划价格" title="显示计划价格"
          style={{ position: "absolute", left: 76, bottom: 48, zIndex: 8 }}>
          显示计划价格
        </button>
      )}
      {chartReady && safePlanLines.map(line => {
        return (
          <button key={line.id} type="button"
            className={compactControls ? "replay-chart-plan-hit" : undefined}
            ref={element => {
              if (element) planHitControls.current.set(line.id, element);
              else planHitControls.current.delete(line.id);
            }}
            aria-label={`${line.title} ${line.price}，精确编辑`}
            title={planLinesEditable ? "拖动调整；点击精确输入；Escape 取消拖动" : "查看计划"}
            style={{
              position: "absolute", left: 8, zIndex: 8,
              minHeight: 36, touchAction: "none",
              cursor: planLinesEditable ? "ns-resize" : "pointer",
            }}
            onClick={() => onPlanPriceSelect?.(line.id)}
            onPointerDown={event => {
              event.stopPropagation();
              if (!planLinesEditable || !onPlanPriceChange) return;
              onPlanInteractionStart?.();
              planDrag.current = { id: line.id, original: String(line.price), pointerId: event.pointerId };
              event.currentTarget.setPointerCapture?.(event.pointerId);
            }}
            onPointerMove={event => {
              if (planDrag.current?.id !== line.id) return;
              event.stopPropagation();
              const rect = containerRef.current?.getBoundingClientRect();
              if (!rect) return;
              const price = seriesRef.current?.coordinateToPrice(event.clientY - rect.top);
              if (price != null && Number.isFinite(price) && price > 0) {
                onPlanPriceChange?.(line.id, price.toFixed(4).replace(/\.?0+$/, ""));
              }
            }}
            onPointerUp={event => {
              event.stopPropagation();
              planDrag.current = null;
              if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId);
              }
            }}
            onPointerCancel={event => {
              event.stopPropagation();
              const drag = planDrag.current;
              planDrag.current = null;
              if (drag) onPlanPriceChange?.(drag.id, drag.original);
            }}
            onKeyDown={event => {
              if (event.key === "Escape" && planDrag.current) {
                event.stopPropagation();
                onPlanPriceChange?.(planDrag.current.id, planDrag.current.original);
                planDrag.current = null;
              }
            }}>
            {line.title} {line.price}
          </button>
        );
      })}

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
        onDrawingInteractionStart={onDrawingInteractionStart}
        coordinateAdapter={coordinateAdapter}
        coordinateVersion={coordinateVersion}
        plotBounds={plotBounds}
      />
    </div>
  );
}
