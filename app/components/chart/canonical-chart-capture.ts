import type { ChartOptions, DeepPartial, IChartApi, ISeriesApi, Logical, CreatePriceLineOptions, SeriesOptionsMap, Time } from 'lightweight-charts';
import type { NormalizedDrawing } from '../../lib/chart/drawings';
import type { Candle } from '../../lib/market/types';
import { containingCandleTime } from '../../lib/chart/chart-scale';
import { markerDisplayGeometry, markerLogicalPosition, markerRightLabelBoundary, markerTimelineTimes } from '../../lib/chart/marker-geometry';
import {
    canvasTextFont,
    resolveTextCardGeometries,
    textCardGeometry,
    textCardLayout,
    textCardLayoutOptions,
    type TextCardGeometry,
} from '../../lib/chart/text-geometry';
import {
    layoutPlanAxisLabels,
    PLAN_AXIS_COLUMN_GAP,
    PLAN_AXIS_TEXT_FONT,
    PLAN_AXIS_TEXT_LINE_HEIGHT,
    type PlanAxisLine,
} from '../../lib/chart/plan-axis-labels';
import { paintDrawingScene } from './drawing-canvas';
import type { RecallCaptureFrame, RecallTextSourceBinding } from '../../lib/recall/types';
export type CaptureFrame = RecallCaptureFrame;
export const CANONICAL_CAPTURE_FRAME = { version: 1, width: 1280, height: 720, pixelRatio: 2 } as const satisfies CaptureFrame;
export const DERIVED_CAPTURE_FRAME = { version: 1, width: 432, height: 280, pixelRatio: 2 } as const satisfies CaptureFrame;
export const DERIVED_CAPTURE_RENDERER_VERSION = 'canonical-chart-capture-r10';
export const DERIVED_CAPTURE_TEXT_POLICY = 'body-only' as const;
export type CanonicalChartMarker = {
    time: Time;
    price: number;
    position: 'aboveBar' | 'belowBar';
    color: string;
    shape: 'diamond';
    actionLabel: string;
    text: string;
    executionIds?: string[];
    fillCount?: number;
    /** Small media-coordinate separation for multiple fills on one candle. */
    offsetX?: number;
    offsetY?: number;
};
export type CanonicalCaptureScene = {
    chartOptions: DeepPartial<ChartOptions>;
    candleOptions: DeepPartial<SeriesOptionsMap['Candlestick']>;
    volumeOptions: DeepPartial<SeriesOptionsMap['Histogram']>;
    volumeScaleOptions: Parameters<ReturnType<ISeriesApi<'Histogram'>['priceScale']>['applyOptions']>[0];
    candles: Candle[];
    markers: CanonicalChartMarker[];
    priceLines: CreatePriceLineOptions[];
    /** Plan metadata is rendered outside the plot with the same live layout helper. */
    planPriceLines?: PlanAxisLine[];
    /** Measured live axis budget, consumed before the canonical chart is created. */
    planAxisMinimumWidth?: number;
    /** Last revealed close used only as the native SDK current-price keep-out. */
    currentPrice?: number;
    drawings: NormalizedDrawing[];
    logicalRange: {
        from: number;
        to: number;
    };
    priceRange: {
        from: number;
        to: number;
    };
    currency: string;
    plannedRiskAmount?: string;
    /** Optional live card state; omitted captures use the compact summary. */
    expandedTextIds?: readonly string[];
};

/**
 * Resolve positioned text bodies in the same transient plot space used by
 * DrawingCanvas. This is derived from the capture frame and projection only:
 * normalized canvas coordinates, widths, anchors, and persisted fields stay
 * untouched.
 */
export function canonicalTextGeometryOverrides(
    drawings: readonly NormalizedDrawing[],
    projection: {
        pointFor: (anchor: { time: string; price: number }) => { x: number; y: number };
        pointForDrawing: (drawing: NormalizedDrawing) => { x: number; y: number };
        maxX?: number;
        plotHeight?: number;
    },
    frame: Pick<CaptureFrame, 'width' | 'height'>,
    expandedTextIds: readonly string[] = [],
): ReadonlyMap<string, TextCardGeometry> {
    const plotWidth = Math.max(1, projection.maxX ?? frame.width);
    const plotHeight = Math.max(1, projection.plotHeight ?? frame.height);
    const expanded = new Set(expandedTextIds);
    const entries = drawings
        .filter(drawing => !drawing.hidden && drawing.tool === 'text' &&
            Number.isFinite(drawing.canvasX) && Number.isFinite(drawing.canvasY))
        .map(drawing => {
            const layout = textCardLayout(
                drawing.text ?? '关键位',
                drawing.textWidth ?? 180,
                drawing.fontSize ?? 14,
                plotWidth,
                expanded.has(drawing.id),
                Math.max(1, plotHeight - 8),
                textCardLayoutOptions.controlWidth,
                textCardLayoutOptions.controlHeight,
                true,
            );
            const cardPoint = projection.pointForDrawing(drawing);
            const anchorPoint = drawing.anchors[0] ? projection.pointFor(drawing.anchors[0]) : cardPoint;
            return {
                id: drawing.id,
                geometry: textCardGeometry(anchorPoint, cardPoint, layout, plotWidth, plotHeight),
            };
        });
    const anchorObstacles = drawings
        .filter(drawing => !drawing.hidden && drawing.tool === 'text' && drawing.anchors[0])
        .map(drawing => {
            const anchor = projection.pointFor(drawing.anchors[0]!);
            return {
                left: anchor.x - 12,
                top: anchor.y - 12,
                right: anchor.x + 12,
                bottom: anchor.y + 12,
                id: `text-anchor-${drawing.id}`,
            };
        });
    return resolveTextCardGeometries(entries, anchorObstacles, plotWidth, plotHeight).placements;
}

export type MarkerProjection = {
    timeToX: (time: Time) => number | null;
    priceToY: (price: number) => number | null;
  /** Right edge of the plot pane, before the price axis begins. */
  maxX?: number;
  /** Left edge of the measured right-axis label keep-out area. */
  rightLabelBoundaryX?: number;
};

export class CanonicalPlanAxisLayoutError extends Error {
    readonly planAxisLabels: ReturnType<typeof layoutPlanAxisLabels>;

    constructor(planAxisLabels: ReturnType<typeof layoutPlanAxisLabels>) {
        super('canonical plan axis layout infeasible');
        this.name = 'CanonicalPlanAxisLayoutError';
        this.planAxisLabels = planAxisLabels;
    }
}

/** Paint full plan names and lexical prices outside the plot while preserving true-price connectors. */
export function drawPlanAxisLabels(
    context: CanvasRenderingContext2D,
    lines: readonly PlanAxisLine[],
    projection: Pick<MarkerProjection, 'maxX'> & { plotHeight?: number; obstacleY?: number | null; obstacleYs?: readonly number[] },
    series: Pick<ISeriesApi<'Candlestick'>, 'priceToCoordinate'>,
    coordinateScale = 1,
    frame: CaptureFrame = CANONICAL_CAPTURE_FRAME,
) {
    if (!lines.length) return [];
    const width = frame.width;
    const plotRight = projection.maxX ?? width;
    const plotHeight = projection.plotHeight ?? frame.height;
    context.save();
    context.font = PLAN_AXIS_TEXT_FONT;
    const obstacleYs = [...(projection.obstacleYs ?? []), ...(projection.obstacleY == null ? [] : [projection.obstacleY])]
        .filter((value): value is number => Number.isFinite(value));
    const labels = layoutPlanAxisLabels(
        lines.map(line => ({
            ...line,
            trueY: (() => {
                const y = series.priceToCoordinate(line.price);
                return y === null ? null : y / coordinateScale;
            })(),
        })),
        { plotRight, axisRight: width, top: 0, bottom: plotHeight, lineHeight: PLAN_AXIS_TEXT_LINE_HEIGHT, gap: 4, obstacleYs: [...new Set(obstacleYs)] },
        text => typeof context.measureText === 'function' ? context.measureText(text).width : text.length * 7,
    );
    if (labels.some(label => !label.layoutFeasible)) {
        context.restore();
        return labels;
    }
    context.lineWidth = 1;
    context.setLineDash([4, 4]);
    for (const label of labels) {
        if (label.connectorY === null || !Number.isFinite(label.connectorY)) continue;
        context.strokeStyle = label.color;
        context.beginPath();
        context.moveTo(plotRight, label.connectorY);
        context.lineTo(label.rect.x, label.connectorY);
        if (label.connectorY !== label.labelY) context.lineTo(label.rect.x, label.labelY);
        context.stroke();
    }
    context.setLineDash([]);
    context.textBaseline = 'middle';
    context.textAlign = 'left';
    for (const label of labels) {
        let nameX = label.rect.x;
        const valueRightX = label.rect.x + label.nameWidth + PLAN_AXIS_COLUMN_GAP + label.valueWidth;
        const valueTextWidth = typeof context.measureText === 'function'
            ? context.measureText(label.valueText).width
            : label.valueText.length * 7;
        let valueX = valueRightX - valueTextWidth;
        for (const [index, part] of label.parts.entries()) {
            context.fillStyle = part.color;
            context.fillText(part.title, nameX, label.labelY);
            nameX += typeof context.measureText === 'function' ? context.measureText(part.title).width : part.title.length * 7;
            if (index < label.parts.length - 1) {
                const separator = ' / ';
                context.fillStyle = '#dbe5f3';
                context.fillText(separator, nameX, label.labelY);
                nameX += typeof context.measureText === 'function' ? context.measureText(separator).width : separator.length * 7;
            }
        }
        for (const [index, part] of label.parts.entries()) {
            context.fillStyle = part.color;
            context.fillText(part.displayPrice, valueX, label.labelY);
            valueX += typeof context.measureText === 'function' ? context.measureText(part.displayPrice).width : part.displayPrice.length * 7;
            if (index < label.parts.length - 1) {
                const separator = ' / ';
                context.fillStyle = '#dbe5f3';
                context.fillText(separator, valueX, label.labelY);
                valueX += typeof context.measureText === 'function' ? context.measureText(separator).width : separator.length * 7;
            }
        }
    }
    context.restore();
    return labels;
}

/** Draw execution markers in media coordinates so the live chart and capture share one semantic painter. */
export function drawExecutionMarkers(
    context: CanvasRenderingContext2D,
    markers: readonly CanonicalChartMarker[],
    projection: MarkerProjection,
) {
    for (const marker of markers) {
        const x = projection.timeToX(marker.time);
        const anchorY = projection.priceToY(marker.price);
        if (x === null || anchorY === null || !Number.isFinite(x) || !Number.isFinite(anchorY)) continue;
        const geometry = markerDisplayGeometry({
            anchorX: x,
            anchorY,
            position: marker.position,
            offsetX: marker.offsetX,
            offsetY: marker.offsetY,
            maxX: projection.maxX,
        });
        const { x: xWithOffset, y, radius } = geometry;
        context.save();
        context.fillStyle = marker.color;
        context.beginPath();
        context.moveTo(xWithOffset, y - radius);
        context.lineTo(xWithOffset + radius, y);
        context.lineTo(xWithOffset, y + radius);
        context.lineTo(xWithOffset - radius, y);
        context.closePath();
        context.fill();
        context.fillStyle = '#dbe5f3';
        context.font = canvasTextFont(12);
        context.textBaseline = 'middle';
        const textWidth = typeof context.measureText === 'function'
            ? context.measureText(marker.text).width
            : Array.from(marker.text).length * 12;
        const rightTextX = xWithOffset + radius + 4;
        const leftTextX = xWithOffset - radius - 4;
        const rightLabelBoundaryX = projection.rightLabelBoundaryX ?? projection.maxX;
        const shouldPlaceLeft = Number.isFinite(rightLabelBoundaryX) &&
            rightTextX + textWidth > (rightLabelBoundaryX as number) &&
            leftTextX - textWidth >= 0;
        context.textAlign = shouldPlaceLeft ? 'right' : 'left';
        context.fillText(marker.text, shouldPlaceLeft ? leftTextX : rightTextX, y);
        context.restore();
    }
}

export function textSourceKey(drawing: Pick<NormalizedDrawing, 'id' | 'textRevision'>): string {
    return `${drawing.id}:${drawing.textRevision === undefined ? `legacy:${drawing.id}` : drawing.textRevision}`;
}

/** Numbered, quiet anchors keep body-only derived captures associated with their source text. */
export function drawTextSourceMarkers(
    context: CanvasRenderingContext2D,
    drawings: readonly NormalizedDrawing[],
    projection: { pointFor: (anchor: { time: string; price: number }) => { x: number; y: number }; maxX?: number; plotHeight?: number },
): RecallTextSourceBinding[] {
    const textDrawings = drawings.filter(drawing => !drawing.hidden && drawing.tool === 'text' && typeof drawing.text === 'string');
    const maxX = projection.maxX ?? CANONICAL_CAPTURE_FRAME.width;
    const plotHeight = projection.plotHeight ?? CANONICAL_CAPTURE_FRAME.height;
    return textDrawings.map((drawing, index) => {
        const sourceNumber = index + 1;
        const anchor = drawing.anchors?.[0];
        const base = { sourceKey: textSourceKey(drawing), sourceNumber, drawingId: drawing.id };
        if (drawing.placement === 'canvas') return { ...base, status: 'canvas-position' as const };
        if (!anchor) return { ...base, status: 'missing-anchor' as const };
        const point = projection.pointFor(anchor);
        const visible = Number.isFinite(point.x) && Number.isFinite(point.y) && point.x >= 0 && point.x <= maxX && point.y >= 0 && point.y <= plotHeight;
        if (visible) {
            context.save();
            context.fillStyle = '#dbe5f3';
            context.strokeStyle = '#dbe5f3';
            context.lineWidth = 1;
            context.beginPath();
            context.arc(point.x, point.y, 3, 0, Math.PI * 2);
            context.stroke();
            context.font = canvasTextFont(10);
            context.textBaseline = 'bottom';
            context.textAlign = 'left';
            context.fillText(String(sourceNumber), point.x + 5, point.y - 5);
            context.restore();
            return { ...base, status: 'visible-anchor' as const, anchorTime: anchor.time, anchorPrice: anchor.price };
        }
        return { ...base, status: 'off-range' as const, anchorTime: anchor.time, anchorPrice: anchor.price };
    });
}
/** Copy option trees while preserving formatter functions; never retain mutable library options. */
export function copyChartOptions<T>(value: T): T {
    if (Array.isArray(value))
        return value.map(copyChartOptions) as T;
    if (value && typeof value === 'object')
        return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, copyChartOptions(item)])) as T;
    return value;
}
/** LWC has no public pixel-ratio override. Render native doubled geometry
 * inside a half-scale CSS surface, then downsample only if host DPR exceeds 1.
 * This keeps the canonical CSS frame at 1280x720 without touching global DPR. */
export function captureRasterOptions(options: DeepPartial<ChartOptions>, planAxisMinimumWidth?: number, frame: CaptureFrame = CANONICAL_CAPTURE_FRAME): DeepPartial<ChartOptions> {
    const { width, height, pixelRatio } = frame;
    const scale = (value: number | undefined, fallback: number) => (value ?? fallback) * pixelRatio;
    const rightAxisMinimumWidth = Math.max(options.rightPriceScale?.minimumWidth ?? 84, planAxisMinimumWidth ?? 0);
    return { ...options, autoSize: false, width: width * pixelRatio, height: height * pixelRatio, handleScroll: false, handleScale: false,
        layout: { ...options.layout, fontSize: scale(options.layout?.fontSize, 12) },
        leftPriceScale: { ...options.leftPriceScale, minimumWidth: scale(options.leftPriceScale?.minimumWidth, 0) },
        rightPriceScale: { ...options.rightPriceScale, minimumWidth: scale(rightAxisMinimumWidth, 84) },
        timeScale: { ...options.timeScale, minimumHeight: scale(options.timeScale?.minimumHeight, 0), barSpacing: scale(options.timeScale?.barSpacing, 8), minBarSpacing: scale(options.timeScale?.minBarSpacing, .5) },
    };
}

function logicalToCoordinateByInterpolation(
    timeScale: ReturnType<IChartApi['timeScale']>,
    logical: number,
) {
    if (!Number.isFinite(logical)) return null;
    if (Number.isInteger(logical)) {
        return timeScale.logicalToCoordinate(logical as Logical) ?? null;
    }
    const lowerLogical = Math.floor(logical);
    const upperLogical = Math.ceil(logical);
    const lower = timeScale.logicalToCoordinate(lowerLogical as Logical);
    const upper = timeScale.logicalToCoordinate(upperLogical as Logical);
    if (lower === null || lower === undefined || upper === null || upper === undefined) return null;
    return lower + (upper - lower) * (logical - lowerLogical);
}

/** The same projected scene drives every drawing tool and clipping warnings. */
export function captureDrawingProjection(
    scene: Pick<CanonicalCaptureScene, 'candles'> & Partial<Pick<CanonicalCaptureScene, 'markers'>>,
    chart: IChartApi,
    series: ISeriesApi<'Candlestick'>,
    coordinateScale = 1,
    frame: CaptureFrame = CANONICAL_CAPTURE_FRAME,
) {
    const { width, height } = frame;
    const candleTimes = scene.candles.flatMap(candle => {
        const parsed = Date.parse(candle.time);
        return Number.isFinite(parsed) ? [Math.floor(parsed / 1000)] : [];
    });
    const whitespaceTimes: number[] = [];
    for (const marker of scene.markers ?? []) {
        if (!marker.executionIds?.length) continue;
        const parsed = typeof marker.time === 'number'
            ? marker.time
            : typeof marker.time === 'string'
                ? Math.floor(Date.parse(marker.time) / 1000)
                : Date.UTC(marker.time.year, marker.time.month - 1, marker.time.day) / 1000;
        if (Number.isFinite(parsed)) whitespaceTimes.push(parsed);
    }
    const axisTimes = markerTimelineTimes(candleTimes, whitespaceTimes);
    const timeToX = (time: Time): number | null => {
        const timestamp = typeof time === 'number'
            ? time
            : typeof time === 'string'
                ? Math.floor(Date.parse(time) / 1000)
                : Date.UTC(time.year, time.month - 1, time.day) / 1000;
        if (!Number.isFinite(timestamp)) return null;
        const exactCandleTime = axisTimes.includes(timestamp);
        if (exactCandleTime) {
            const projected = chart.timeScale().timeToCoordinate(timestamp as Time);
            if (projected !== null)
                return projected / coordinateScale;
        }
        const logical = markerLogicalPosition(axisTimes, timestamp);
        if (logical === null) return null;
        const x = logicalToCoordinateByInterpolation(chart.timeScale(), logical);
        return x === null ? null : x / coordinateScale;
    };
    const pointFor = (anchor: {
        time: string;
        price: number;
    }) => ({
        x: timeToX(anchor.time) ?? timeToX(containingCandleTime(scene.candles, anchor.time)) ?? -1,
        y: (series.priceToCoordinate(anchor.price) ?? -coordinateScale) / coordinateScale,
    });
    const pointForDrawing = (drawing: NormalizedDrawing) => drawing.tool === 'text' && Number.isFinite(drawing.canvasX) && Number.isFinite(drawing.canvasY)
        ? { x: Math.max(0, Math.min(width, (drawing.canvasX ?? 0) * width)), y: Math.max(0, Math.min(height, (drawing.canvasY ?? 0) * height)) }
        : pointFor(drawing.anchors[0] ?? { time: '', price: 0 });
    const plotWidth = chart.timeScale().width?.();
    const paneHeight = chart.panes?.()[0]?.getHeight?.();
    const priceScale = typeof series.priceScale === 'function' ? series.priceScale() : undefined;
    const priceScaleWidth = priceScale?.width?.();
    const rightLabelBoundaryX = Number.isFinite(plotWidth) && (plotWidth as number) > 0
        ? markerRightLabelBoundary(plotWidth as number, priceScaleWidth)
        : undefined;
    return {
        timeToX,
        pointFor,
        pointForDrawing,
        ...(Number.isFinite(plotWidth) && (plotWidth as number) > 0 ? { maxX: (plotWidth as number) / coordinateScale } : {}),
        ...(Number.isFinite(rightLabelBoundaryX) ? { rightLabelBoundaryX: (rightLabelBoundaryX as number) / coordinateScale } : {}),
        ...(Number.isFinite(paneHeight) && (paneHeight as number) > 0 ? { plotHeight: (paneHeight as number) / coordinateScale } : {}),
    };
}
/** An isolated renderer never resizes, fits, or restores the interactive chart. */
export type CanonicalCaptureRenderOptions = {
    frame?: CaptureFrame;
    drawings?: readonly NormalizedDrawing[];
    textOverlayPolicy?: 'full' | 'body-only';
};

export async function renderCanonicalChartCapture(scene: CanonicalCaptureScene, options: CanonicalCaptureRenderOptions = {}): Promise<{
    imageDataUrl: string;
    warnings: string[];
    textSourceKeys: string[];
    textSourceBindings: RecallTextSourceBinding[];
}> {
    const frame = options.frame ?? CANONICAL_CAPTURE_FRAME;
    const drawings = options.drawings ?? (options.textOverlayPolicy === DERIVED_CAPTURE_TEXT_POLICY
        ? scene.drawings.filter(drawing => drawing.tool !== 'text')
        : scene.drawings);
    const { width, height, pixelRatio } = frame;
    const host = document.createElement('div');
    host.dataset.recallCapture = 'canonical';
    host.setAttribute('aria-hidden', 'true');
    host.style.cssText = `position:fixed;left:-10000px;top:0;width:${width}px;height:${height}px;pointer-events:none;`;
    document.body.appendChild(host);
    let chart: IChartApi | undefined;
    try {
        const { createChart, CandlestickSeries, HistogramSeries } = await import('lightweight-charts');
        const surface = document.createElement('div');
        surface.style.cssText = `width:${width * pixelRatio}px;height:${height * pixelRatio}px;transform:scale(${1 / pixelRatio});transform-origin:top left;`;
        host.appendChild(surface);
        chart = createChart(surface, captureRasterOptions(scene.chartOptions, scene.planAxisMinimumWidth, frame));
        const series = chart.addSeries(CandlestickSeries, scene.candleOptions);
        const volume = chart.addSeries(HistogramSeries, scene.volumeOptions);
        volume.priceScale().applyOptions(scene.volumeScaleOptions);
        const data = scene.candles.map(c => ({ ...c, time: Math.floor(Date.parse(c.time) / 1000) as Time }));
        const timeline = new Map<number, { time: Time; open?: number; high?: number; low?: number; close?: number }>(
            data.map(candle => [Number(candle.time), { time: candle.time, open: candle.open, high: candle.high, low: candle.low, close: candle.close }]),
        );
        const whitespaceTimes: number[] = [];
        for (const marker of scene.markers) {
            if (!marker.executionIds?.length) continue;
            const timestamp = typeof marker.time === 'number'
                ? marker.time
                : typeof marker.time === 'string'
                    ? Math.floor(Date.parse(marker.time) / 1000)
                    : Date.UTC(marker.time.year, marker.time.month - 1, marker.time.day) / 1000;
            if (Number.isFinite(timestamp)) whitespaceTimes.push(timestamp);
        }
        const axisTimes = markerTimelineTimes([...timeline.keys()], whitespaceTimes);
        const timelineData = axisTimes.flatMap(time => {
            const point = timeline.get(time);
            return point ? [point] : [{ time: time as Time }];
        });
        series.setData(timelineData.map(point => point.open === undefined
            ? { time: point.time }
            : { time: point.time, open: point.open, high: point.high!, low: point.low!, close: point.close! }));
        volume.setData(data.map(c => ({ time: c.time, value: c.volume, color: c.close >= c.open ? 'rgba(38, 166, 154, 0.34)' : 'rgba(239, 83, 80, 0.32)' })));
        for (const line of scene.priceLines)
            series.createPriceLine({ ...line, lineWidth: Math.min(4, (line.lineWidth ?? 1) * pixelRatio) as 1 | 2 | 3 | 4 });
        chart.timeScale().setVisibleLogicalRange(scene.logicalRange);
        series.priceScale().setVisibleRange(scene.priceRange);
        // takeScreenshot synchronously consumes pending invalidations, even when rAF stalls.
        const base = chart.takeScreenshot(true, false);
        if (!base)
            throw new Error('基础图表截图失败');
        if (base.width < width * pixelRatio || base.height < height * pixelRatio)
            throw new Error('图表像素分辨率不足，无法截图');
        const output = document.createElement('canvas');
        output.width = width * pixelRatio;
        output.height = height * pixelRatio;
        const context = output.getContext('2d');
        if (!context)
            throw new Error('无法合成图表截图');
        context.drawImage(base, 0, 0, output.width, output.height);
        context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
        const liveChart = chart;
        if (!liveChart)
            throw new Error('图表实例尚未就绪，无法投影成交标记');
        const projection = captureDrawingProjection(scene, liveChart, series, pixelRatio, frame);
        const textGeometryOverrides = canonicalTextGeometryOverrides(
            drawings,
            projection,
            frame,
            scene.expandedTextIds ?? [],
        );
        drawExecutionMarkers(context, scene.markers, {
            timeToX: projection.timeToX,
            priceToY: price => {
                const projected = series.priceToCoordinate(price);
                return projected === null ? null : projected / pixelRatio;
            },
            maxX: projection.maxX,
            rightLabelBoundaryX: projection.rightLabelBoundaryX,
        });
        const currentPriceY = scene.currentPrice == null ? null : series.priceToCoordinate(scene.currentPrice);
        const nativeObstacleYs = [
            ...(currentPriceY == null ? [] : [currentPriceY / pixelRatio]),
            ...scene.priceLines
                .filter(line => line.axisLabelVisible === true && Number.isFinite(line.price))
                .flatMap(line => {
                    const y = series.priceToCoordinate(line.price);
                    return y == null ? [] : [y / pixelRatio];
                }),
        ].filter((value): value is number => Number.isFinite(value));
        const planAxisLabels = drawPlanAxisLabels(
            context,
            scene.planPriceLines ?? [],
            { ...projection, obstacleYs: [...new Set(nativeObstacleYs)] },
            series,
            pixelRatio,
            frame,
        );
        if (planAxisLabels.some(label => !label.layoutFeasible)) {
            throw new CanonicalPlanAxisLayoutError(planAxisLabels);
        }
        paintDrawingScene(context, {
            width,
            height,
            drawings,
            ...projection,
            plotWidth: projection.maxX ?? width,
            plotHeight: projection.plotHeight ?? height,
            currency: scene.currency,
            plannedRiskAmount: scene.plannedRiskAmount,
            expandedTextIds: scene.expandedTextIds
                ? new Set(scene.expandedTextIds)
                : undefined,
            textGeometryOverrides,
        });
        const textSourceBindings = options.textOverlayPolicy === DERIVED_CAPTURE_TEXT_POLICY
            ? drawTextSourceMarkers(context, scene.drawings, projection)
            : [];
        const textSourceKeys = scene.drawings
            .filter(d => !d.hidden && d.tool === 'text' && typeof d.text === 'string')
            .map(textSourceKey);
        const warnings = drawings.filter(d => !d.hidden && d.tool === 'text').flatMap(d => {
            const hasCardPosition = Number.isFinite(d.canvasX) && Number.isFinite(d.canvasY);
            const layout = textCardLayout(
                d.text ?? '关键位',
                d.textWidth ?? 180,
                d.fontSize ?? 14,
                width,
                !hasCardPosition || scene.expandedTextIds?.includes(d.id) === true,
                hasCardPosition ? Math.max(1, height - 8) : Number.POSITIVE_INFINITY,
                hasCardPosition ? textCardLayoutOptions.controlWidth : 0,
                hasCardPosition ? textCardLayoutOptions.controlHeight : 0,
            );
            const cardPoint = projection.pointForDrawing(d);
            const anchorPoint = d.anchors[0] ? projection.pointFor(d.anchors[0]) : cardPoint;
            const geometry = hasCardPosition
                ? textGeometryOverrides.get(d.id) ?? textCardGeometry(anchorPoint, cardPoint, layout, width, height)
                : { x: cardPoint.x, y: cardPoint.y, width: layout.width, height: layout.height };
            return geometry.x < 0 || geometry.y < 0 || geometry.x + geometry.width > width || geometry.y + geometry.height > height ? ['截图文字被裁切'] : [];
        });
        const imageDataUrl = output.toDataURL('image/png');
        if (!imageDataUrl || imageDataUrl === 'data:,')
            throw new Error('图表截图为空');
        const sourceWarnings = textSourceBindings.flatMap(binding => {
            if (binding.status === 'off-range') return [`截图文字来源${binding.sourceNumber}锚点在当前图窗外：${binding.anchorTime ?? '时间未提供'} / ${binding.anchorPrice ?? '价格未提供'}`];
            if (binding.status === 'canvas-position') return [`截图文字来源${binding.sourceNumber}使用画布定位，无价格锚点`];
            if (binding.status === 'missing-anchor') return [`截图文字来源${binding.sourceNumber}未提供价格锚点`];
            return [];
        });
        return { imageDataUrl, warnings: [...new Set([...sourceWarnings, ...warnings])], textSourceKeys, textSourceBindings };
    }
    finally {
        try {
            chart?.remove();
        }
        finally {
            host.remove();
        }
    }
}
