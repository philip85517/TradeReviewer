import type { ChartOptions, DeepPartial, IChartApi, ISeriesApi, Logical, CreatePriceLineOptions, SeriesOptionsMap, Time } from 'lightweight-charts';
import type { NormalizedDrawing } from '../../lib/chart/drawings';
import type { Candle } from '../../lib/market/types';
import { containingCandleTime } from '../../lib/chart/chart-scale';
import { markerDisplayGeometry, markerLogicalPosition, markerRightLabelBoundary, markerTimelineTimes } from '../../lib/chart/marker-geometry';
import { canvasTextFont, textCardGeometry, textCardLayout, textCardLayoutOptions } from '../../lib/chart/text-geometry';
import { paintDrawingScene } from './drawing-canvas';
export const CANONICAL_CAPTURE_FRAME = { version: 1, width: 1280, height: 720, pixelRatio: 2 } as const;
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

export type MarkerProjection = {
    timeToX: (time: Time) => number | null;
    priceToY: (price: number) => number | null;
  /** Right edge of the plot pane, before the price axis begins. */
  maxX?: number;
  /** Left edge of the measured right-axis label keep-out area. */
  rightLabelBoundaryX?: number;
};

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
export function captureRasterOptions(options: DeepPartial<ChartOptions>): DeepPartial<ChartOptions> {
    const { width, height, pixelRatio } = CANONICAL_CAPTURE_FRAME;
    const scale = (value: number | undefined, fallback: number) => (value ?? fallback) * pixelRatio;
    return { ...options, autoSize: false, width: width * pixelRatio, height: height * pixelRatio, handleScroll: false, handleScale: false,
        layout: { ...options.layout, fontSize: scale(options.layout?.fontSize, 12) },
        leftPriceScale: { ...options.leftPriceScale, minimumWidth: scale(options.leftPriceScale?.minimumWidth, 0) },
        rightPriceScale: { ...options.rightPriceScale, minimumWidth: scale(options.rightPriceScale?.minimumWidth, 84) },
        timeScale: { ...options.timeScale, minimumHeight: scale(options.timeScale?.minimumHeight, 0), barSpacing: scale(options.timeScale?.barSpacing, 8), minBarSpacing: scale(options.timeScale?.minBarSpacing, .5) },
    };
}
/** The same projected scene drives every drawing tool and clipping warnings. */
export function captureDrawingProjection(
    scene: Pick<CanonicalCaptureScene, 'candles'> & Partial<Pick<CanonicalCaptureScene, 'markers'>>,
    chart: IChartApi,
    series: ISeriesApi<'Candlestick'>,
    coordinateScale = 1,
) {
    const { width, height } = CANONICAL_CAPTURE_FRAME;
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
        const x = chart.timeScale().logicalToCoordinate(logical as Logical);
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
export async function renderCanonicalChartCapture(scene: CanonicalCaptureScene): Promise<{
    imageDataUrl: string;
    warnings: string[];
}> {
    const { width, height, pixelRatio } = CANONICAL_CAPTURE_FRAME;
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
        chart = createChart(surface, captureRasterOptions(scene.chartOptions));
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
        const projection = captureDrawingProjection(scene, liveChart, series, pixelRatio);
        drawExecutionMarkers(context, scene.markers, {
            timeToX: projection.timeToX,
            priceToY: price => {
                const projected = series.priceToCoordinate(price);
                return projected === null ? null : projected / pixelRatio;
            },
            maxX: projection.maxX,
            rightLabelBoundaryX: projection.rightLabelBoundaryX,
        });
        paintDrawingScene(context, {
            width,
            height,
            drawings: scene.drawings,
            ...projection,
            plotWidth: projection.maxX ?? width,
            plotHeight: projection.plotHeight ?? height,
            currency: scene.currency,
            plannedRiskAmount: scene.plannedRiskAmount,
            expandedTextIds: scene.expandedTextIds
                ? new Set(scene.expandedTextIds)
                : undefined,
        });
        const warnings = scene.drawings.filter(d => !d.hidden && d.tool === 'text').flatMap(d => {
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
                ? textCardGeometry(anchorPoint, cardPoint, layout, width, height)
                : { x: cardPoint.x, y: cardPoint.y, width: layout.width, height: layout.height };
            return geometry.x < 0 || geometry.y < 0 || geometry.x + geometry.width > width || geometry.y + geometry.height > height ? ['截图文字被裁切'] : [];
        });
        const imageDataUrl = output.toDataURL('image/png');
        if (!imageDataUrl || imageDataUrl === 'data:,')
            throw new Error('图表截图为空');
        return { imageDataUrl, warnings: [...new Set(warnings)] };
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
