import { expect, it, vi } from 'vitest';
import type { IChartApi, ISeriesApi } from 'lightweight-charts';
import type { NormalizedDrawing } from '../../lib/chart/drawings';
import { CANONICAL_CAPTURE_FRAME, captureDrawingProjection, copyChartOptions, captureRasterOptions, drawExecutionMarkers } from './canonical-chart-capture';
import { paintDrawingScene } from './drawing-canvas';

vi.mock('lightweight-charts', () => ({
    CandlestickSeries: 'candlestick',
    HistogramSeries: 'histogram',
    createChart: (surface: HTMLElement, options: Record<string, unknown>) => {
        const timeScale = {
            timeToCoordinate: () => 780,
            logicalToCoordinate: () => 780,
            width: () => 800,
            setVisibleLogicalRange: vi.fn(),
        };
        const priceScale = {
            applyOptions: vi.fn(),
            setVisibleRange: vi.fn(),
            width: () => 80,
        };
        const series = {
            setData: vi.fn(),
            priceToCoordinate: () => 400,
            priceScale: () => priceScale,
            createPriceLine: vi.fn(),
        };
        return {
            addSeries: (kind: string) => kind === 'histogram' ? { setData: vi.fn(), priceScale: () => priceScale } : series,
            timeScale: () => timeScale,
            takeScreenshot: () => ({ width: 2560, height: 1440 }),
            remove: vi.fn(),
            options: () => options,
            surface,
        };
    },
}));
it('projects canvas and anchored Text in the canonical frame with one shared painter', () => {
    const candles = [{ time: '2026-01-01', open: 10, high: 12, low: 9, close: 11, volume: 1 }, { time: '2026-01-02', open: 11, high: 13, low: 10, close: 12, volume: 1 }];
    const chart = { timeScale: () => ({ timeToCoordinate: () => null, logicalToCoordinate: (n: number) => n * 100 }) } as unknown as IChartApi;
    const series = { priceToCoordinate: (p: number) => p * 10 } as unknown as ISeriesApi<'Candlestick'>;
    const projection = captureDrawingProjection({ candles }, chart, series);
    const base: NormalizedDrawing = { version: 2, id: 'canvas', episodeId: 'ep', name: 'text', tool: 'text', anchors: [], text: '画布文本', placement: 'canvas', canvasX: .5, canvasY: .5, textWidth: 180, fontSize: 14, style: { color: '#fff', opacity: 1, lineWidth: 1 }, hidden: false, locked: false, visibleOn: 'all', stage: 'during-replay', createdAtCursor: '2026-01-02', zIndex: 0 };
    const anchored = { ...base, id: 'anchored', placement: 'anchor' as const, text: '锚定文本', anchors: [{ time: '2026-01-03', price: 12 }] };
    const fillText = vi.fn();
    const fillRect = vi.fn();
    const context = { setLineDash: vi.fn(), fillText, fillRect } as unknown as CanvasRenderingContext2D;
    paintDrawingScene(context, { ...CANONICAL_CAPTURE_FRAME, drawings: [base, anchored, { ...base, id: 'hidden', hidden: true }], ...projection, currency: 'CNY' });
    expect(fillText).toHaveBeenNthCalledWith(1, '画布文本', 644, 374);
    expect(fillText).toHaveBeenNthCalledWith(2, '1', 802, 374);
    expect(fillText).toHaveBeenNthCalledWith(3, '锚定文本', 644, 374);
    expect(fillText).toHaveBeenCalledTimes(3);
    expect(fillRect).not.toHaveBeenCalled();
});

it('collapses positioned long Text, expands it on request, and keeps legacy Text full', () => {
    const fillText = vi.fn();
    const context = {
        setLineDash: vi.fn(),
        fillText,
        fillRect: vi.fn(),
        strokeRect: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
    const base: NormalizedDrawing = {
        version: 2,
        id: 'long-card',
        episodeId: 'ep',
        name: 'text',
        tool: 'text',
        anchors: [{ time: '2026-01-01', price: 10 }],
        text: '第一行\n第二行\n第三行\n第四行',
        placement: 'anchor',
        canvasX: .25,
        canvasY: .25,
        textWidth: 180,
        fontSize: 14,
        style: { color: '#2f80ed', opacity: 1, lineWidth: 1 },
        hidden: false,
        locked: false,
        visibleOn: 'all',
        stage: 'during-replay',
        createdAtCursor: '2026-01-02',
        zIndex: 0,
    };
    const legacy = { ...base, id: 'legacy-long', canvasX: undefined, canvasY: undefined };
    const scene = {
        width: 640,
        height: 360,
        pointFor: () => ({ x: 80, y: 120 }),
        pointForDrawing: (drawing: NormalizedDrawing) => drawing.id === 'legacy-long'
            ? ({ x: 80, y: 120 })
            : ({ x: 160, y: 90 }),
        currency: 'CNY',
    };

    paintDrawingScene(context, { ...scene, drawings: [base] });
    expect(fillText.mock.calls.map(([value]) => value)).toEqual([
        '1', '第一行', '第二行…',
    ]);

    fillText.mockClear();
    paintDrawingScene(context, { ...scene, drawings: [base], expandedTextIds: new Set([base.id]) });
    expect(fillText.mock.calls.map(([value]) => value)).toEqual([
        '1', '第一行', '第二行', '第三行', '第四行',
    ]);

    fillText.mockClear();
    paintDrawingScene(context, { ...scene, drawings: [legacy] });
    expect(fillText.mock.calls.map(([value]) => value)).toEqual([
        '第一行', '第二行', '第三行', '第四行',
    ]);
});
it('copies option trees without retaining mutable data or dropping formatting functions', () => {
    const formatter = vi.fn();
    const source = { timeScale: { tickMarkFormatter: formatter }, grid: { vertLines: { visible: true } } };
    const copy = copyChartOptions(source);
    source.grid.vertLines.visible = false;
    expect(copy.grid.vertLines.visible).toBe(true);
    expect(copy.timeScale.tickMarkFormatter).toBe(formatter);
});
it('renders native two-times geometry at DPR1 rather than enlarging a low-resolution screenshot', () => {
    const options = captureRasterOptions({ layout: { fontSize: 12 }, rightPriceScale: { minimumWidth: 84 }, timeScale: { minimumHeight: 28, barSpacing: 8 } });
    expect(options).toMatchObject({ width: 2560, height: 1440, layout: { fontSize: 24 }, rightPriceScale: { minimumWidth: 168 }, timeScale: { minimumHeight: 56, barSpacing: 16 } });
});

it('paints the same solid diamond and action label used by the interactive replay chart', () => {
    const context = {
        save: vi.fn(),
        restore: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        closePath: vi.fn(),
        fill: vi.fn(),
        fillText: vi.fn(),
        measureText: vi.fn(() => ({ width: 24 })),
    } as unknown as CanvasRenderingContext2D;
    drawExecutionMarkers(context, [{
        time: '2025-01-01',
        price: 10,
        position: 'belowBar',
        color: '#26a69a',
        shape: 'diamond',
        actionLabel: '买入',
        text: '买入',
    }], { timeToX: () => 100, priceToY: () => 200 });
    expect(context.fill).toHaveBeenCalledTimes(1);
    expect(context.fillText).toHaveBeenCalledWith('买入', 110, 210);
    expect(context.lineTo).toHaveBeenCalledTimes(3);
});

it('keeps a marker label inside the plot pane before the right price axis', () => {
    const context = {
        save: vi.fn(),
        restore: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        closePath: vi.fn(),
        fill: vi.fn(),
        fillText: vi.fn(),
        measureText: vi.fn(() => ({ width: 24 })),
    } as unknown as CanvasRenderingContext2D;
    drawExecutionMarkers(context, [{
        time: '2025-01-01',
        price: 10,
        position: 'aboveBar',
        color: '#ef5350',
        shape: 'diamond',
        actionLabel: '卖出',
        text: '卖出',
    }], { timeToX: () => 390, priceToY: () => 200, maxX: 400 });
    expect(context.fillText).toHaveBeenCalledWith('卖出', 380, 190);
    expect(context.textAlign).toBe('right');
});

it('keeps marker text clear of a price-axis label that extends into the plot', () => {
    const context = {
        save: vi.fn(),
        restore: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        closePath: vi.fn(),
        fill: vi.fn(),
        fillText: vi.fn(),
        measureText: vi.fn(() => ({ width: 24 })),
    } as unknown as CanvasRenderingContext2D;
    drawExecutionMarkers(context, [{
        time: '2025-01-01',
        price: 10,
        position: 'aboveBar',
        color: '#26a69a',
        shape: 'diamond',
        actionLabel: '买入',
        text: '买入',
    }], { timeToX: () => 300, priceToY: () => 200, maxX: 400, rightLabelBoundaryX: 280 });
    expect(context.fillText).toHaveBeenCalledWith('买入', 290, 190);
    expect(context.textAlign).toBe('right');
});

it('uses the actual plot boundary when capture paints a right-edge marker', async () => {
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
        drawImage: vi.fn(),
        setTransform: vi.fn(),
        toDataURL: vi.fn(() => 'data:image/png;base64,marker-boundary'),
        save: vi.fn(),
        restore: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        closePath: vi.fn(),
        fill: vi.fn(),
        fillText: vi.fn(),
        measureText: vi.fn(() => ({ width: 24 })),
    } as unknown as CanvasRenderingContext2D);
    const toDataURL = vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,marker-boundary');
    const scene = {
        chartOptions: {}, candleOptions: {}, volumeOptions: {}, volumeScaleOptions: {},
        candles: [{ time: '2025-01-01', open: 10, high: 12, low: 9, close: 11, volume: 1 }],
        markers: [{ time: '2025-01-01', price: 10, position: 'aboveBar' as const, color: '#ef5350', shape: 'diamond' as const, actionLabel: '卖出', text: '卖出', executionIds: ['fill'] }],
        priceLines: [], drawings: [], logicalRange: { from: 0, to: 1 }, priceRange: { from: 0, to: 20 }, currency: 'CNY',
    };

    const { renderCanonicalChartCapture } = await import('./canonical-chart-capture');
    await renderCanonicalChartCapture(scene);

    const context = getContext.mock.results.at(-1)?.value as CanvasRenderingContext2D;
    expect(context.fillText).toHaveBeenCalledWith('卖出', 380, 190);
    getContext.mockRestore();
    toDataURL.mockRestore();
});

it('keeps the filled diamond inside the plot when a lane offset crosses the right edge', () => {
    const context = {
        save: vi.fn(),
        restore: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        closePath: vi.fn(),
        fill: vi.fn(),
        fillText: vi.fn(),
        measureText: vi.fn(() => ({ width: 24 })),
    } as unknown as CanvasRenderingContext2D;
    drawExecutionMarkers(context, [{
        time: '2025-01-01',
        price: 10,
        position: 'aboveBar',
        color: '#ef5350',
        shape: 'diamond',
        actionLabel: '清仓',
        text: '清仓',
        offsetX: 18,
    }], { timeToX: () => 100, priceToY: () => 200, maxX: 110 });
    expect(context.moveTo).toHaveBeenCalledWith(104, 184);
    expect(context.lineTo).toHaveBeenNthCalledWith(1, 110, 190);
    expect(context.lineTo).toHaveBeenNthCalledWith(2, 104, 196);
    expect(context.lineTo).toHaveBeenNthCalledWith(3, 98, 190);
});

it('projects an explicitly registered execution time after a calendar gap on the shared axis', () => {
    const candles = [
        { time: '2026-09-03T00:00:00Z', open: 10, high: 12, low: 9, close: 11, volume: 1 },
        { time: '2026-09-04T00:00:00Z', open: 11, high: 13, low: 10, close: 12, volume: 1 },
        { time: '2026-09-07T00:00:00Z', open: 12, high: 14, low: 11, close: 13, volume: 1 },
    ];
    const chart = { timeScale: () => ({ timeToCoordinate: () => null, logicalToCoordinate: (n: number) => n * 10 }) } as unknown as IChartApi;
    const series = { priceToCoordinate: () => 100 } as unknown as ISeriesApi<'Candlestick'>;
    const projection = captureDrawingProjection({ candles, markers: [{ time: '2026-09-08T00:00:00Z', price: 10, position: 'belowBar', color: '#26a69a', shape: 'diamond', actionLabel: '买入', text: '买入', executionIds: ['fill'] }] }, chart, series);

    expect(projection.timeToX('2026-09-08T00:00:00Z')).toBe(30);
});

it('does not place a single-candle unknown execution at the old candle', () => {
    const candles = [{ time: '2026-09-07T00:00:00Z', open: 10, high: 12, low: 9, close: 11, volume: 1 }];
    const chart = { timeScale: () => ({ timeToCoordinate: () => null, logicalToCoordinate: () => 0 }) } as unknown as IChartApi;
    const series = { priceToCoordinate: () => 100 } as unknown as ISeriesApi<'Candlestick'>;
    const projection = captureDrawingProjection({ candles }, chart, series);

    expect(projection.timeToX('2026-09-08T00:00:00Z')).toBeNull();
});
