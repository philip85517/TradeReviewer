import { expect, it, vi } from 'vitest';
import type { IChartApi, ISeriesApi } from 'lightweight-charts';
import type { NormalizedDrawing } from '../../lib/chart/drawings';
import * as canonicalCapture from './canonical-chart-capture';
import { CANONICAL_CAPTURE_FRAME, CanonicalPlanAxisLayoutError, canonicalTextGeometryOverrides, captureDrawingProjection, copyChartOptions, captureRasterOptions, drawExecutionMarkers, drawPlanAxisLabels, drawTextSourceMarkers } from './canonical-chart-capture';
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

it('keeps the canonical frame unchanged and exposes the bounded derived frame contract', () => {
    expect(CANONICAL_CAPTURE_FRAME).toEqual({ version: 1, width: 1280, height: 720, pixelRatio: 2 });
    expect(canonicalCapture).toHaveProperty('DERIVED_CAPTURE_FRAME', { version: 1, width: 432, height: 280, pixelRatio: 2 });
});

it('uses the shared transient body resolver for canonical text positions', () => {
    const base: NormalizedDrawing = {
        version: 2, id: 'first', episodeId: 'ep', name: 'text', tool: 'text',
        anchors: [{ time: '2026-01-01', price: 10 }], text: '第一行\n第二行',
        placement: 'anchor', canvasX: .1, canvasY: .1, textWidth: 110, fontSize: 14,
        style: { color: '#fff', opacity: 1, lineWidth: 1 }, hidden: false, locked: false,
        visibleOn: 'all', stage: 'during-replay', createdAtCursor: '2026-01-02', zIndex: 0,
    };
    const second = { ...base, id: 'second', canvasX: .1, canvasY: .12, text: '第三行\n第四行' };
    const placements = canonicalTextGeometryOverrides(
        [base, second],
        {
            maxX: 240,
            plotHeight: 280,
            pointFor: () => ({ x: 20, y: 20 }),
            pointForDrawing: drawing => ({ x: 24, y: drawing.id === 'first' ? 20 : 26 }),
        },
        { width: 240, height: 280 },
    );
    const first = placements.get('first')!;
    const next = placements.get('second')!;
    expect(first.width).toBe(next.width);
    expect(first.anchor).toEqual({ x: 20, y: 20 });
    expect(first.y + first.height).toBeLessThanOrEqual(next.y);
});

it('paints plan labels outside the plot while preserving the true-price connector', () => {
    const context = {
        save: vi.fn(), restore: vi.fn(), setLineDash: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(),
        fillText: vi.fn(), measureText: vi.fn((text: string) => ({ width: text.length * 6 })),
    } as unknown as CanvasRenderingContext2D;
    drawPlanAxisLabels(context, [
        { id: 'entry', price: 56, title: '计划入场', displayPrice: '56.0000' },
        { id: 'target', price: 68, title: '止盈目标', displayPrice: '68.0000001' },
    ], { maxX: 300, plotHeight: 220 }, { priceToCoordinate: (price: number) => price === 56 ? 100 : 105 } as unknown as ISeriesApi<'Candlestick'>);

    expect(context.moveTo).toHaveBeenCalledWith(300, 100);
    expect(context.moveTo).toHaveBeenCalledWith(300, 105);
    expect(context.fillText).toHaveBeenCalledWith('计划入场', expect.any(Number), expect.any(Number));
    expect(context.fillText).toHaveBeenCalledWith('56.0000', expect.any(Number), expect.any(Number));
    expect(context.fillText).toHaveBeenCalledWith('止盈目标', expect.any(Number), expect.any(Number));
    expect(context.fillText).toHaveBeenCalledWith('68.0000001', expect.any(Number), expect.any(Number));
});

it('right-aligns varied lexical values to the shared value column and avoids current price', () => {
    const fillText = vi.fn();
    const context = {
        save: vi.fn(), restore: vi.fn(), setLineDash: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(),
        fillText, measureText: vi.fn((text: string) => ({ width: text.length * 6 })),
    } as unknown as CanvasRenderingContext2D;
    drawPlanAxisLabels(context, [
        { id: 'entry', price: 56, title: '入场', displayPrice: '56.00' },
        { id: 'target', price: 68, title: '非常长的止盈目标', displayPrice: '68.0000000000001' },
    ], { maxX: 300, plotHeight: 220, obstacleY: 100 }, { priceToCoordinate: (price: number) => price === 56 ? 100 : 160 } as unknown as ISeriesApi<'Candlestick'>);

    const valueCalls = fillText.mock.calls.filter(([value]) => value === '56.00' || value === '68.0000000000001');
    expect(valueCalls).toHaveLength(2);
    const measure = (value: string) => value.length * 6;
    expect(valueCalls[0]?.[1] as number + measure(String(valueCalls[0]?.[0]))).toBe(
        valueCalls[1]?.[1] as number + measure(String(valueCalls[1]?.[0])),
    );
    expect(context.moveTo).toHaveBeenCalledWith(300, 100);
});

it('keeps plan labels clear of both revealed close and visible actual cost obstacles', () => {
    const fillText = vi.fn();
    const context = {
        save: vi.fn(), restore: vi.fn(), setLineDash: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(),
        fillText, measureText: vi.fn((text: string) => ({ width: text.length * 6 })),
    } as unknown as CanvasRenderingContext2D;
    const labels = drawPlanAxisLabels(context, [
        { id: 'entry', price: 56, title: '计划入场', displayPrice: '56.0000' },
        { id: 'target', price: 68, title: '止盈目标', displayPrice: '68.0000' },
    ], { maxX: 300, plotHeight: 220, obstacleYs: [100, 160] }, { priceToCoordinate: (price: number) => price === 56 ? 100 : 160 } as unknown as ISeriesApi<'Candlestick'>);

    expect(labels.every(label => Math.abs(label.labelY - 100) >= 22 && Math.abs(label.labelY - 160) >= 22)).toBe(true);
    expect(labels.every(label => label.connectorY === (label.price === 56 ? 100 : 160))).toBe(true);
});

it('does not paint a successful canonical axis when the bounded layout is infeasible', () => {
    const context = {
        save: vi.fn(), restore: vi.fn(), setLineDash: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(),
        fillText: vi.fn(), measureText: vi.fn((text: string) => ({ width: text.length * 6 })),
    } as unknown as CanvasRenderingContext2D;
    const labels = drawPlanAxisLabels(context, [
        { id: 'entry', price: 56, title: '计划入场', displayPrice: '56.0000' },
        { id: 'cost', price: 57, title: '实际成本', displayPrice: '57.0000' },
        { id: 'stop', price: 58, title: '初始止损', displayPrice: '58.0000' },
    ], { maxX: 300, plotHeight: 40, obstacleYs: [20] }, { priceToCoordinate: () => 20 } as unknown as ISeriesApi<'Candlestick'>);

    expect(labels.every(label => !label.layoutFeasible)).toBe(true);
    expect(context.moveTo).not.toHaveBeenCalled();
    expect(context.fillText).not.toHaveBeenCalled();
});

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

it('consumes the measured plan axis budget when scaling the canonical chart', () => {
    const options = captureRasterOptions({ rightPriceScale: { minimumWidth: 84 } }, 190);
    expect(options.rightPriceScale).toMatchObject({ minimumWidth: 380 });
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

it('draws a quiet numbered source marker for each visible anchored Text and returns its exact source binding', () => {
    const fillText = vi.fn();
    const context = {
        save: vi.fn(), restore: vi.fn(), beginPath: vi.fn(), arc: vi.fn(), stroke: vi.fn(), fillText,
        measureText: vi.fn(() => ({ width: 8 })),
    } as unknown as CanvasRenderingContext2D;
    const drawing = {
        id: 'text-1', tool: 'text', text: '判断', textRevision: 7, hidden: false,
        anchors: [{ time: '2026-01-01', price: 56 }], placement: 'anchor',
    } as unknown as NormalizedDrawing;
    const bindings = drawTextSourceMarkers(context, [drawing], {
        pointFor: () => ({ x: 120, y: 80 }), maxX: 400, plotHeight: 220,
    });

    expect(bindings).toEqual([expect.objectContaining({ sourceKey: 'text-1:7', sourceNumber: 1, status: 'visible-anchor', anchorTime: '2026-01-01', anchorPrice: 56 })]);
    expect(context.arc).toHaveBeenCalledWith(120, 80, expect.any(Number), 0, Math.PI * 2);
    expect(fillText).toHaveBeenCalledWith('1', expect.any(Number), expect.any(Number));
});

it('keeps canvas and off-range Text in the body binding without fabricating a chart marker', () => {
    const context = {
        save: vi.fn(), restore: vi.fn(), beginPath: vi.fn(), arc: vi.fn(), stroke: vi.fn(), fillText: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
    const canvas = { id: 'canvas-text', tool: 'text', text: '画布正文', textRevision: 1, hidden: false, anchors: [], placement: 'canvas' } as unknown as NormalizedDrawing;
    const offRange = { id: 'off-range', tool: 'text', text: '窗外正文', textRevision: 2, hidden: false, anchors: [{ time: '2026-01-09', price: 99 }], placement: 'anchor' } as unknown as NormalizedDrawing;
    const bindings = drawTextSourceMarkers(context, [canvas, offRange], {
        pointFor: anchor => anchor.time === '2026-01-09' ? { x: -1, y: 400 } : { x: 100, y: 100 }, maxX: 400, plotHeight: 220,
    });

    expect(bindings.map(binding => [binding.sourceKey, binding.sourceNumber, binding.status])).toEqual([
        ['canvas-text:1', 1, 'canvas-position'],
        ['off-range:2', 2, 'off-range'],
    ]);
    expect(context.arc).not.toHaveBeenCalled();
    expect(context.fillText).not.toHaveBeenCalled();
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

it('fails canonical capture with complete plan metadata when the bounded axis cannot fit', async () => {
    const context = {
        drawImage: vi.fn(), setTransform: vi.fn(), toDataURL: vi.fn(() => 'data:image/png;base64,infeasible'),
        save: vi.fn(), restore: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), closePath: vi.fn(),
        fill: vi.fn(), fillText: vi.fn(), measureText: vi.fn(() => ({ width: 24 })), setLineDash: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context);
    const scene = {
        chartOptions: {}, candleOptions: {}, volumeOptions: {}, volumeScaleOptions: {},
        candles: [{ time: '2025-01-01', open: 10, high: 12, low: 9, close: 11, volume: 1 }],
        markers: [], priceLines: [], drawings: [], logicalRange: { from: 0, to: 1 }, priceRange: { from: 0, to: 20 }, currency: 'CNY',
        planPriceLines: Array.from({ length: 40 }, (_, index) => ({ id: `plan-${index}`, price: index + 1, title: `计划${index}`, displayPrice: `${index + 1}.0000` })),
    };
    const { renderCanonicalChartCapture } = await import('./canonical-chart-capture');

    let capturedError: unknown;
    try {
        await renderCanonicalChartCapture(scene);
    } catch (error) {
        capturedError = error;
    }
    expect(capturedError).toBeInstanceOf(CanonicalPlanAxisLayoutError);
    if (capturedError instanceof CanonicalPlanAxisLayoutError) {
        expect(capturedError.planAxisLabels).toHaveLength(40);
        expect(capturedError.planAxisLabels[0]).toMatchObject({ sourceIds: ['plan-0'], nameText: '计划0', valueText: '1.0000', trueY: 200 });
    }
    getContext.mockRestore();
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

it('projects a between-candle canonical time through integer SDK coordinates', () => {
    const candles = [
        { time: '2026-09-03T00:00:00Z', open: 10, high: 12, low: 9, close: 11, volume: 1 },
        { time: '2026-09-04T00:00:00Z', open: 11, high: 13, low: 10, close: 12, volume: 1 },
    ];
    const chart = {
        timeScale: () => ({
            timeToCoordinate: () => null,
            // Installed lightweight-charts returns 0 for a fractional logical.
            logicalToCoordinate: (logical: number) => Number.isInteger(logical) ? logical * 100 : 0,
        }),
    } as unknown as IChartApi;
    const series = { priceToCoordinate: () => 100 } as unknown as ISeriesApi<'Candlestick'>;
    const projection = captureDrawingProjection({ candles }, chart, series);

    expect(projection.timeToX('2026-09-03T12:00:00Z')).toBe(50);
});

it('does not place a single-candle unknown execution at the old candle', () => {
    const candles = [{ time: '2026-09-07T00:00:00Z', open: 10, high: 12, low: 9, close: 11, volume: 1 }];
    const chart = { timeScale: () => ({ timeToCoordinate: () => null, logicalToCoordinate: () => 0 }) } as unknown as IChartApi;
    const series = { priceToCoordinate: () => 100 } as unknown as ISeriesApi<'Candlestick'>;
    const projection = captureDrawingProjection({ candles }, chart, series);

    expect(projection.timeToX('2026-09-08T00:00:00Z')).toBeNull();
});
