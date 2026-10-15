import { act, cleanup, fireEvent, render, waitFor, within } from "@testing-library/react";
import { Activity, useState, type ComponentProps } from "react";
import { flushSync } from "react-dom";
import { afterEach, expect, it, vi } from "vitest";

const engine = vi.hoisted(() => ({
  data: [] as { time: number }[],
  range: { from: 0, to: 0 },
  priceRange: { from: 0, to: 3 },
  resetPriceRangeOnCreate: false,
  fitCalls: 0,
  controlY: 100,
  options: null as Record<string, unknown> | null,
  resizeCallbacks: [] as ResizeObserverCallback[],
  animationFrames: [] as FrameRequestCallback[],
  cancelledAnimationFrameIds: [] as number[],
  asyncRange: false,
  pendingRanges: [] as Array<{ from: number; to: number }>,
  rangeChangeHandlers: [] as Array<() => void>,
  setDataRangeShift: null as { from: number; to: number } | null,
  applyOptionsRangeMutation: null as { from: number; to: number } | null,
  drawingCommit: vi.fn(),
  prepareTextDraft: vi.fn(),
  screenshotArgs: null as [boolean, boolean] | null,
  screenshotData: [] as { time: number }[][],
  overlayIds: [] as string[],
  removed:0,
  lifecycleCalls: [] as string[],
  deferredLifecycleFrames: [] as Array<() => void>,
  lifecycleErrors: [] as string[],
  rangeReadsAfterRemove: 0,
  canonicalOptions: null as Record<string, unknown> | null,
  captureOptions: [] as Array<Record<string, unknown>>,
  autoScale:true,
  priceRanges:[] as {from:number;to:number}[],
  priceRangeCalls: [] as Array<{ instance: number; range: { from: number; to: number } }>,
  paintedTexts:[] as string[],
  pixelSizes:[] as number[][],
  expandedTextIds: [] as string[],
  capturedExpandedTextIds: undefined as string[] | undefined,
  plotBounds: undefined as { width: number; height: number } | undefined,
  timeScaleWidth: 0,
  paneHeight: 0,
  modelResizeSemantics: false,
  sdkPlotWidth: 0,
  pendingSdkPlotWidth: null as number | null,
  sdkBarSpacing: 8,
  lockVisibleTimeRangeOnResize: false,
  appliedSizes: [] as Array<{ width?: number; height?: number }>,
  resetRangeOnCreate: false,
  chartInstances: 0,
  setDataCalls: [] as Array<{ instance: number; data: { time: number }[] }>,
  reconcileCoordinateOnScreenshot: false,
  pendingControlY: null as number | null,
  coordinateVersionSamples: [] as Array<{ version: number; controlY: number }>,
  crosshairHandler: null as ((param: { time?: number; seriesData: Map<unknown, unknown> }) => void) | null,
  candleSeries: null as object | null,
  canvasOnRequestCursorTool: undefined as (() => void) | undefined,
}));

vi.mock("./drawing-canvas", async () => {
  const React = await import("react");
  const DrawingCanvas = React.forwardRef((props, ref) => {
    engine.canvasOnRequestCursorTool = (props as { onRequestCursorTool?: () => void }).onRequestCursorTool;
    engine.plotBounds = (props as { plotBounds?: { width: number; height: number } }).plotBounds;
    engine.coordinateVersionSamples.push({
      version: (props as { coordinateVersion?: number }).coordinateVersion ?? -1,
      controlY: engine.controlY,
    });
    React.useImperativeHandle(ref, () => ({
      captureOverlay: async () => {
        engine.overlayIds = ((props as { drawings?: Array<{ id: string }> }).drawings ?? []).map(
          (drawing) => drawing.id,
        );
        return { width: 800, height: 480 };
      },
      commitText: () => engine.drawingCommit(props),
      prepareTextDraft: (reason: string) => {
        const guarded = engine.prepareTextDraft(reason);
        if (guarded !== undefined) return Promise.resolve(guarded);
        const committed = engine.drawingCommit(props);
        // The real guard resolves after its decision action has committed the
        // parent drawing state; model that settled seam in this mock handle.
        flushSync(() => {});
        return Promise.resolve(committed === undefined ? true : committed);
      },
      getExpandedTextIds: () => [...engine.expandedTextIds],
    }));
    return <button type="button" aria-label="mock drawing interaction" onClick={() => (props as { onDrawingInteractionStart?: () => void }).onDrawingInteractionStart?.()} />;
  });
  DrawingCanvas.displayName = "DrawingCanvas";
  return { DrawingCanvas, paintDrawingScene: (_context:unknown, scene:{drawings:Array<{id:string;text?:string}>;expandedTextIds?: Set<string>}) => { if (scene.drawings.length) engine.overlayIds=scene.drawings.map(d=>d.id); if (scene.drawings.some(d=>typeof d.text === 'string')) engine.paintedTexts=scene.drawings.map(d=>d.text??''); engine.capturedExpandedTextIds=scene.expandedTextIds ? [...scene.expandedTextIds] : undefined; } };
});

vi.mock("lightweight-charts", () => ({
  CandlestickSeries: "candle",
  HistogramSeries: "volume",
  ColorType: { Solid: "solid" },
  CrosshairMode: { MagnetOHLC: 1 },
  LineStyle: { Dashed: 1 },
  createSeriesMarkers: () => ({ setMarkers: () => {} }),
  createChart: (_container: Element, options: Record<string, unknown>) => {
    const chartInstance = ++engine.chartInstances;
    const captureChart = Boolean(_container.closest("[data-recall-capture]"));
    engine.options = options;
    if (captureChart) engine.captureOptions.push(options);
    const timeScaleOptions = options.timeScale as { lockVisibleTimeRangeOnResize?: boolean; barSpacing?: number };
    let chartBarSpacing = Number(timeScaleOptions.barSpacing ?? 8);
    if (!captureChart) {
      engine.canonicalOptions = options;
      engine.lockVisibleTimeRangeOnResize = timeScaleOptions.lockVisibleTimeRangeOnResize === true;
      engine.sdkPlotWidth = Math.max(1, Number(options.width ?? 1) - 84);
      engine.sdkBarSpacing = chartBarSpacing;
    }
    if (engine.resetRangeOnCreate) engine.range = { from: 0, to: 0 };
    if (engine.resetPriceRangeOnCreate) engine.priceRange = { from: 0, to: 3 };
    const setAutoScale=(value:boolean)=>{if(!_container.closest('[data-recall-capture]'))engine.autoScale=value;};
    const scale = {
      subscribeVisibleLogicalRangeChange: (handler: () => void) => { engine.rangeChangeHandlers.push(handler); },
      fitContent: () => {
        engine.fitCalls += 1;
      },
      setVisibleLogicalRange: (range: { from: number; to: number }) => {
        if (engine.asyncRange) engine.pendingRanges.push({ ...range });
        else engine.range = { ...range };
      },
      getVisibleLogicalRange: () => {
        if (engine.removed > 0) engine.rangeReadsAfterRemove += 1;
        return { ...engine.range };
      },
      options: () => ({ barSpacing: chartBarSpacing, rightOffset: 4 }),
      applyOptions: (nextOptions: { barSpacing?: number }) => {
        if (nextOptions.barSpacing !== undefined) {
          chartBarSpacing = nextOptions.barSpacing;
          if (!captureChart) engine.sdkBarSpacing = chartBarSpacing;
        }
      },
      timeToCoordinate: () => null,
      logicalToCoordinate: (logical: number) => logical * 10,
      coordinateToTime: () => null,
      coordinateToLogical: () => 0,
      width: () => engine.timeScaleWidth,
    };
    return {
      options: () => ({...options,timeScale:{...options.timeScale as object}}),
      applyOptions: (nextOptions: { width?: number; height?: number }) => {
        engine.appliedSizes.push({ width: nextOptions.width, height: nextOptions.height });
        if (engine.modelResizeSemantics && nextOptions.width !== undefined) {
          engine.pendingSdkPlotWidth = Math.max(1, nextOptions.width - 84);
        }
        if (engine.applyOptionsRangeMutation) engine.range = { ...engine.applyOptionsRangeMutation };
      },
      remove: () => {
        engine.lifecycleCalls.push("remove");
        engine.removed++;
        engine.deferredLifecycleFrames = [];
      },
      subscribeCrosshairMove: (handler: (param: { time?: number; seriesData: Map<unknown, unknown> }) => void) => { engine.crosshairHandler = handler; },
      timeScale: () => scale,
      panes: () => [{ getHeight: () => engine.paneHeight }],
      addSeries: (kind: string, seriesOptions:object) => {
        const series = {
        options:()=>seriesOptions,
        attachPrimitive: () => {},
        detachPrimitive: () => {
          engine.lifecycleCalls.push("detach");
          engine.deferredLifecycleFrames.push(() => {
            if (engine.removed > 0) engine.lifecycleErrors.push("disposed chart update");
          });
        },
        setData: (data: { time: number }[]) => {
          if (kind === "candle") {
            const clonedData = data.map((item) => ({ ...item }));
            engine.setDataCalls.push({ instance: chartInstance, data: clonedData });
            engine.data = clonedData;
            if (engine.setDataRangeShift) engine.range = { ...engine.setDataRangeShift };
          }
        },
        applyOptions: () => {},
        priceScale: () => ({ applyOptions: (options:{autoScale?:boolean}) => {if(options.autoScale!==undefined)setAutoScale(options.autoScale);},getVisibleRange:()=>({...engine.priceRange}),setVisibleRange:(range:{from:number;to:number})=>{engine.priceRange={...range};engine.priceRanges.push(range);engine.priceRangeCalls.push({instance:chartInstance,range:{...range}});if(engine.reconcileCoordinateOnScreenshot)engine.pendingControlY=140;setAutoScale(false);},setAutoScale,options:()=>({mode:0,invertScale:false,autoScale:engine.autoScale,scaleMargins:{top:.08,bottom:.2}}) }),
        createPriceLine: (line:object) => ({ options:()=>line,applyOptions: () => {} }),
        removePriceLine: () => {},
        coordinateToPrice: () => 100,
        priceToCoordinate: () => engine.controlY,
        };
        if (kind === "candle") engine.candleSeries = series;
        return series;
      },
      takeScreenshot: (includeTopLayer: boolean, includeCrosshair: boolean) => {
        engine.screenshotArgs = [includeTopLayer, includeCrosshair];
        if (engine.reconcileCoordinateOnScreenshot && engine.pendingControlY !== null) {
          engine.controlY = engine.pendingControlY;
          engine.pendingControlY = null;
        }
        engine.screenshotData.push(engine.data.map((item) => ({ ...item })));
        return { width: Number(options.width), height: Number(options.height) };
      },
    };
  },
}));

import { ReplayChart, type ChartHandle } from "./replay-chart";

const candle = (time: string) => ({
  time,
  open: 1,
  high: 2,
  low: 1,
  close: 2,
  volume: 10,
});

function props(overrides: Partial<ComponentProps<typeof ReplayChart>> = {}) {
  return {
    candles: [candle("2026-01-01T00:00:00Z"), candle("2026-01-02T00:00:00Z")],
    executions: [],
    cursor: "2026-09-05T00:00:00Z",
    averageCost: 0,
    drawings: [],
    activeTool: "cursor" as const,
    settings: {
      version: 1,
      showGrid: true,
      showVolume: true,
      showExecutions: true,
      showAverageCost: true,
      colorScheme: "teal-red" as const,
    },
    episodeId: "episode-1",
    selectedDrawingId: null,
    plannedRiskAmount: undefined,
    currency: "USD",
    onSelectDrawing: () => {},
    onCommand: () => {},
    ...overrides,
  } satisfies ComponentProps<typeof ReplayChart>;
}

it("passes the drawing interaction callback through to the canvas interface", () => {
  const onDrawingInteractionStart = vi.fn();
  render(<ReplayChart {...props({ onDrawingInteractionStart })} />);
  fireEvent.click(within(document.body).getByRole("button", { name: "mock drawing interaction" }));
  expect(onDrawingInteractionStart).toHaveBeenCalledTimes(1);
});

it("passes the optional cursor cancellation seam through to DrawingCanvas", () => {
  const onRequestCursorTool = vi.fn();
  render(<ReplayChart {...props({ onRequestCursorTool })} />);
  engine.canvasOnRequestCursorTool?.();
  expect(onRequestCursorTool).toHaveBeenCalledTimes(1);
});

it("publishes plot center and measured axis budget through the Replay seam", async () => {
  stubResize(640, 240);
  const onPlotLayoutChange = vi.fn();
  const view = render(<ReplayChart {...props({
    onPlotLayoutChange,
    planPriceLines: [{ id: "target", price: 68, title: "止盈目标", displayPrice: "68.0000000000001" }],
  })} />);
  await waitFor(() => expect(onPlotLayoutChange).toHaveBeenLastCalledWith(expect.objectContaining({
    width: expect.any(Number),
    height: expect.any(Number),
    plotCenterX: expect.any(Number),
    axisWidth: expect.any(Number),
  })));
  const layout = onPlotLayoutChange.mock.lastCall?.[0];
  expect(layout.plotCenterX).toBe(layout.width / 2);
  expect(layout.axisWidth).toBeGreaterThan(84);
  expect(view.container.querySelector(".chart-stage")).toHaveStyle({
    "--replay-plot-center-x": `${layout.plotCenterX}px`,
    "--replay-axis-width": `${layout.axisWidth}px`,
  });
});

function stubResize(width = 640, height = 240) {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      private readonly callback: ResizeObserverCallback;

      constructor(callback: ResizeObserverCallback) {
        this.callback = callback;
        engine.resizeCallbacks.push(callback);
      }

      observe(target: Element) {
        Object.defineProperties(target, {
          clientWidth: { configurable: true, value: width },
          clientHeight: { configurable: true, value: height },
        });
        this.callback(
          [{ target, contentRect: { width, height } } as ResizeObserverEntry],
          this as unknown as ResizeObserver,
        );
      }

      disconnect() {}
    },
  );
}

function flushPendingRanges() {
  while (engine.pendingRanges.length > 0) {
    engine.range = engine.pendingRanges.shift()!;
    for (const handler of engine.rangeChangeHandlers) handler();
  }
}

/**
 * Models the lightweight-charts full paint that follows an explicit pane
 * resize. Without lockVisibleTimeRangeOnResize, the SDK keeps bar spacing and
 * the right edge and therefore shifts the left logical endpoint when the
 * pane width changes. The real chart performs this work after ResizeObserver,
 * so tests must keep it separate from chart.applyOptions().
 */
function paintPendingSdkResize() {
  const nextWidth = engine.pendingSdkPlotWidth;
  if (nextWidth === null || engine.sdkPlotWidth <= 0) return;
  if (engine.modelResizeSemantics && !engine.lockVisibleTimeRangeOnResize) {
    const delta = nextWidth - engine.sdkPlotWidth;
    engine.range = {
      from: engine.range.from - delta / engine.sdkBarSpacing,
      to: engine.range.to,
    };
  }
  engine.sdkPlotWidth = nextWidth;
  engine.pendingSdkPlotWidth = null;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  engine.data = [];
  engine.canvasOnRequestCursorTool = undefined;
  engine.range = { from: 0, to: 0 };
  engine.priceRange = { from: 0, to: 3 };
  engine.fitCalls = 0;
  engine.controlY = 100;
  engine.options = null;
  engine.canonicalOptions = null;
  engine.captureOptions = [];
  engine.resizeCallbacks = [];
  engine.animationFrames = [];
  engine.cancelledAnimationFrameIds = [];
  engine.asyncRange = false;
  engine.pendingRanges = [];
  engine.rangeChangeHandlers = [];
  engine.setDataRangeShift = null;
  engine.applyOptionsRangeMutation = null;
  engine.drawingCommit.mockClear();
  engine.prepareTextDraft.mockClear();
  engine.screenshotArgs = null;
  engine.screenshotData = [];
  Object.defineProperty(document,'fonts',{configurable:true,value:undefined});
  engine.overlayIds = [];
  engine.removed=0;engine.lifecycleCalls=[];engine.deferredLifecycleFrames=[];engine.lifecycleErrors=[];engine.rangeReadsAfterRemove=0;engine.autoScale=true;engine.priceRanges=[];engine.paintedTexts=[];engine.drawingCommit.mockReset();engine.prepareTextDraft.mockReset();
  engine.expandedTextIds=[];engine.capturedExpandedTextIds=undefined;
  engine.plotBounds=undefined;engine.timeScaleWidth=0;engine.paneHeight=0;
  engine.modelResizeSemantics=false;engine.sdkPlotWidth=0;engine.pendingSdkPlotWidth=null;engine.sdkBarSpacing=8;engine.lockVisibleTimeRangeOnResize=false;
  engine.appliedSizes=[];engine.resetRangeOnCreate=false;engine.resetPriceRangeOnCreate=false;engine.priceRangeCalls=[];
  engine.chartInstances=0;engine.setDataCalls=[];engine.reconcileCoordinateOnScreenshot=false;engine.pendingControlY=null;engine.coordinateVersionSamples=[];
  engine.crosshairHandler=null;engine.candleSeries=null;
});

it("formats daily tick marks compactly while retaining Asia/Shanghai date conversion", async () => {
  stubResize();
  render(<ReplayChart {...props({ viewportKey: "[\"instrument\",\"episode\",\"1D\",\"replay\"]" })} />);

  await waitFor(() => expect(engine.options).not.toBeNull());
  const timeScale = engine.options?.timeScale as {
    tickMarkFormatter: (time: number, tickMarkType?: number) => string;
  };
  const timestamp = Date.parse("2025-09-30T16:00:00.000Z") / 1000;
  const day = timeScale.tickMarkFormatter(timestamp, 2);
  const month = timeScale.tickMarkFormatter(timestamp, 1);
  const year = timeScale.tickMarkFormatter(timestamp, 0);
  const intraday = timeScale.tickMarkFormatter(timestamp, 3);

  expect(day).toBe("10/01");
  expect(Array.from(day).length).toBeLessThanOrEqual(5);
  expect(month).toBe("10月");
  expect(year).toBe("2025年");
  expect(intraday).toBe("00:00");
});

it("clears a stale crosshair when the hovered series item has no OHLC", async () => {
  stubResize();
  render(<ReplayChart {...props()} />);
  await waitFor(() => expect(engine.crosshairHandler).not.toBeNull());
  const hoveredTime = Date.parse("2026-01-01T00:00:00.000Z") / 1000;
  engine.crosshairHandler?.({
    time: hoveredTime,
    seriesData: new Map([[engine.candleSeries, { open: 1, high: 2, low: 1, close: 2 }]]),
  });
  await waitFor(() => expect(document.querySelector(".chart-ohlc")).toHaveTextContent("00:00"));

  engine.crosshairHandler?.({ time: hoveredTime, seriesData: new Map() });
  await waitFor(() => expect(document.querySelector(".chart-ohlc")).toHaveTextContent("当前 K 线"));
});

it("passes real plot bounds to Text editing without shrinking the full chart", async () => {
  stubResize(640, 220);
  engine.timeScaleWidth = 560;
  engine.paneHeight = 180;
  render(<ReplayChart {...props()} />);

  await waitFor(() => expect(engine.plotBounds).toEqual({ width: 560, height: 180 }));
  expect(engine.appliedSizes).toContainEqual({ width: 640, height: 220 });
});

it("remeasures plot bounds after the SDK applies a resize on its next paint", async () => {
  const requestAnimationFrameMock = vi.fn((callback: FrameRequestCallback) => {
    engine.animationFrames.push(callback);
    return engine.animationFrames.length;
  });
  const cancelAnimationFrameMock = vi.fn((id: number) => {
    engine.cancelledAnimationFrameIds.push(id);
  });
  vi.stubGlobal("requestAnimationFrame", requestAnimationFrameMock);
  vi.stubGlobal("cancelAnimationFrame", cancelAnimationFrameMock);

  const onPlotLayoutChange = vi.fn();
  engine.timeScaleWidth = 504;
  engine.paneHeight = 422;
  stubResize(902, 450);
  render(<ReplayChart {...props({ onPlotLayoutChange })} />);

  await waitFor(() => expect(engine.plotBounds).toEqual({ width: 504, height: 422 }));
  expect(engine.animationFrames).toHaveLength(1);

  engine.timeScaleWidth = 818;
  act(() => {
    engine.animationFrames.shift()?.(0);
  });

  await waitFor(() => expect(engine.plotBounds).toEqual({ width: 818, height: 422 }));
  expect(onPlotLayoutChange).toHaveBeenLastCalledWith(expect.objectContaining({
    width: 818,
    height: 422,
    plotCenterX: 409,
  }));
  expect(requestAnimationFrameMock).toHaveBeenCalledTimes(1);
  expect(cancelAnimationFrameMock).not.toHaveBeenCalled();
});

it("cancels a pending post-resize plot measurement when the chart is disposed", async () => {
  const requestAnimationFrameMock = vi.fn((callback: FrameRequestCallback) => {
    engine.animationFrames.push(callback);
    return engine.animationFrames.length;
  });
  const cancelAnimationFrameMock = vi.fn((id: number) => {
    engine.cancelledAnimationFrameIds.push(id);
  });
  vi.stubGlobal("requestAnimationFrame", requestAnimationFrameMock);
  vi.stubGlobal("cancelAnimationFrame", cancelAnimationFrameMock);

  engine.timeScaleWidth = 504;
  engine.paneHeight = 422;
  stubResize(902, 450);
  const view = render(<ReplayChart {...props()} />);
  await waitFor(() => expect(engine.plotBounds).toEqual({ width: 504, height: 422 }));
  expect(engine.animationFrames).toHaveLength(1);

  view.unmount();

  expect(cancelAnimationFrameMock).toHaveBeenCalledWith(1);
  engine.timeScaleWidth = 818;
  act(() => {
    for (const callback of engine.animationFrames) callback(0);
  });
  expect(engine.plotBounds).toEqual({ width: 504, height: 422 });
});

it("preserves the logical view when the replay/history mode changes", async () => {
  stubResize();
  const firstKey = JSON.stringify(["instrument", "episode", "1D", "replay"]);
  const { rerender } = render(<ReplayChart {...props({ viewportKey: firstKey })} />);

  await waitFor(() => expect(engine.fitCalls).toBeGreaterThan(0));
  engine.range = { from: 0.25, to: 1.25 };
  const historyKey = JSON.stringify(["instrument", "episode", "1D", "history"]);
  rerender(<ReplayChart {...props({ viewportKey: historyKey, candles: [
    candle("2026-01-01T00:00:00Z"),
    candle("2026-01-02T00:00:00Z"),
    candle("2026-01-03T00:00:00Z"),
  ] })} />);

  await waitFor(() => expect(engine.data).toHaveLength(3));
  expect(engine.range).toEqual({ from: 0.25, to: 1.25 });
  expect(engine.fitCalls).toBe(1);
});

it("brings a newly revealed candle into a manually fixed price window without using unseen bars", async () => {
  stubResize();
  const first = candle("2026-01-01T00:00:00Z");
  const { rerender } = render(<ReplayChart {...props({ candles: [first], viewportKey: "replay-price" })} />);
  await waitFor(() => expect(engine.data).toHaveLength(1));
  engine.range = { from: 0, to: 1 };
  engine.autoScale = false;
  const revealed = { ...candle("2026-01-02T00:00:00Z"), low: 90, high: 100, open: 95, close: 98 };
  rerender(<ReplayChart {...props({
    candles: [first, revealed],
    viewportKey: "replay-price",
    revealRequest: { id: 1, time: revealed.time },
  })} />);
  await waitFor(() => expect(engine.priceRanges.at(-1)?.to).toBeGreaterThan(100));
  expect(engine.priceRanges.at(-1)?.from).toBeLessThan(90);
  expect(engine.range.to - engine.range.from).toBe(1);
});

it("brings a revealed execution fact into a manual price window when the request is a later cutoff", async () => {
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  const candles = [{ ...candle("2026-08-07T00:00:00Z"), knowledgeAt: "2026-08-08T00:00:00Z" }];
  const execution = {
    id: "aug-10-entry",
    source: { platform: "fixture", row: 1, displayTimePolicy: "execution-time" as const },
    accountId: "account", accountLabel: "Account",
    instrument: { id: "US:TEST", symbol: "TEST", name: "Test", market: "US", currency: "USD" },
    side: "buy" as const,
    executedAt: "2026-08-10T02:00:00Z",
    quantity: "1",
    price: "61.5",
    fee: "0",
  };
  const props: ComponentProps<typeof ReplayChart> = {
    candles, executions: [], cursor: candles[0].time, averageCost: 0, drawings: [], activeTool: "cursor",
    episodeId: "episode", selectedDrawingId: null, plannedRiskAmount: undefined, currency: "USD",
    onSelectDrawing: () => {}, onCommand: () => {},
    settings: { version: 1, showGrid: true, showVolume: true, showExecutions: true, showAverageCost: true, colorScheme: "teal-red" },
  };
  const { rerender } = render(<ReplayChart {...props} />);
  await waitFor(() => expect(engine.data).toHaveLength(1));
  engine.autoScale = false;
  rerender(<ReplayChart {...props} executions={[execution]} revealRequest={{ id: 1, time: "2026-08-10T16:00:00Z" }} />);
  await waitFor(() => expect(engine.priceRanges.at(-1)?.to).toBeGreaterThan(61.5));
  expect(engine.priceRanges.at(-1)?.from).toBeLessThan(61.5);
  expect(engine.data).toHaveLength(2);
});

it("fits once after a zero-sized mount becomes usable", async () => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(private readonly callback: ResizeObserverCallback) {}

      observe(target: Element) {
        this.callback([{ target, contentRect: { width: 0, height: 0 } } as ResizeObserverEntry], this as unknown as ResizeObserver);
        this.callback([{ target, contentRect: { width: 640, height: 240 } } as ResizeObserverEntry], this as unknown as ResizeObserver);
      }

      disconnect() {}
    },
  );
  render(<ReplayChart {...props()} />);

  await waitFor(() => expect(engine.fitCalls).toBe(1));
});

it("captures the real chart plus a 2x drawing overlay after committing focused Text", async () => {
  stubResize(400, 200);
  const drawImage = vi.fn();
  const toDataURL = vi.fn(() => "data:image/png;base64,review");
  const context = { drawImage, toDataURL, setTransform:vi.fn(), save:vi.fn(), restore:vi.fn(), beginPath:vi.fn(), arc:vi.fn(), stroke:vi.fn(), fillText:vi.fn() } as unknown as CanvasRenderingContext2D;
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context);
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockImplementation(toDataURL);
  const onReady = vi.fn();
  const { container } = render(
    <ReplayChart
      {...props({
        onReady,
        drawings: [],
      })}
    />,
  );
  const stage = container.querySelector(".chart-stage");
  expect(stage).not.toBeNull();
  vi.spyOn(stage!, "getBoundingClientRect").mockReturnValue({
    x: 0,
    y: 0,
    width: 400,
    height: 200,
    top: 0,
    left: 0,
    right: 400,
    bottom: 200,
    toJSON: () => ({}),
  });

  await waitFor(() => expect(onReady).toHaveBeenCalledWith(expect.objectContaining({ capture: expect.any(Function) })));
  const handle = onReady.mock.calls.find(([value]) => value && typeof value.capture === "function")?.[0] as { capture: () => Promise<{ imageDataUrl: string; viewport: unknown }> };
  const capture = await handle.capture();
  expect(capture.viewport).toMatchObject({width:400,height:200,imageFrame:{version:1,width:1280,height:720,pixelRatio:2}});
  expect(engine.captureOptions[0]).toMatchObject({width:2560,height:1440});

  expect(engine.drawingCommit).toHaveBeenCalledTimes(1);
  expect(engine.screenshotArgs).toEqual([true, false]);
  expect(drawImage).toHaveBeenCalledTimes(2);
  expect(toDataURL).toHaveBeenCalledWith("image/png");
  expect(capture.imageDataUrl).toBe("data:image/png;base64,review");
});

it("captures current data and overlays even when requestAnimationFrame never runs", async () => {
  stubResize(400, 200);
  vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    drawImage: vi.fn(),
    setTransform:vi.fn(),
    toDataURL: vi.fn(() => "data:image/png;base64:stalled-rAF"),
    save: vi.fn(), restore: vi.fn(), beginPath: vi.fn(), arc: vi.fn(), stroke: vi.fn(), fillText: vi.fn(),
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(
    "data:image/png;base64:stalled-rAF",
  );
  const onReady = vi.fn();
  const latestCandles = [
    candle("2026-01-03T00:00:00Z"),
    candle("2026-01-04T00:00:00Z"),
    candle("2026-01-05T00:00:00Z"),
  ];
  const latestDrawing = {
    id: "latest-overlay",
    version: 2 as const,
    episodeId: "episode-1",
    name: "latest-overlay",
    tool: "text" as const,
    anchors: [{ time: latestCandles[1].time, price: 2 }],
    style: { color: "#fff", lineWidth: 1, opacity: 1 },
    text: "latest",
    hidden: false,
    locked: false,
    visibleOn: "all" as const,
    stage: "during-replay" as const,
    zIndex: 0,
    createdAtCursor: latestCandles[1].time,
  };
  const { container, rerender } = render(
    <ReplayChart {...props({ onReady })} />,
  );
  const stage = container.querySelector(".chart-stage");
  expect(stage).not.toBeNull();
  vi.spyOn(stage!, "getBoundingClientRect").mockReturnValue({
    x: 0,
    y: 0,
    width: 400,
    height: 200,
    top: 0,
    left: 0,
    right: 400,
    bottom: 200,
    toJSON: () => ({}),
  });

  await waitFor(() => expect(onReady).toHaveBeenCalledWith(expect.objectContaining({ capture: expect.any(Function) })));
  rerender(
    <ReplayChart
      {...props({
        onReady,
        candles: latestCandles,
        drawings: [latestDrawing],
      })}
    />,
  );
  await waitFor(() => expect(engine.data).toHaveLength(latestCandles.length));
  const handle = onReady.mock.calls.find(([value]) => value && typeof value.capture === "function")?.[0] as {
    capture: () => Promise<{ imageDataUrl: string }>;
  };
  const capture = handle.capture();
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error("capture timed out while rAF was stalled")), 50);
  });

  await expect(Promise.race([capture, timeout])).resolves.toEqual(
    expect.objectContaining({ imageDataUrl: "data:image/png;base64:stalled-rAF" }),
  );
  expect(engine.screenshotData.at(-1)).toEqual(
    latestCandles.map((item) => ({
      time: Math.floor(Date.parse(item.time) / 1000),
      open: item.open,
      high: item.high,
      low: item.low,
      close: item.close,
    })),
  );
  expect(engine.overlayIds).toEqual(["latest-overlay"]);
});

function captureHarness() {
  stubResize(400,200);
  vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue({drawImage:vi.fn(),setTransform:vi.fn()} as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype,'toDataURL').mockReturnValue('data:image/png;base64,capture');
  const onReady=vi.fn();
  return {onReady,prepare:(container:HTMLElement)=>{vi.spyOn(container.querySelector('.chart-stage')!,'getBoundingClientRect').mockReturnValue({width:400,height:200} as DOMRect);},handle:()=>onReady.mock.calls.find(([v])=>v)?.[0] as import('./replay-chart').ChartHandle};
}
it("awaits the shared text-draft guard before freezing the canonical capture", async () => {
  const h = captureHarness();
  let release!: (ready: boolean) => void;
  engine.prepareTextDraft.mockReturnValue(new Promise<boolean>(resolve => { release = resolve; }));
  const { container } = render(<ReplayChart {...props({ onReady: h.onReady })} />);
  h.prepare(container);
  await waitFor(() => expect(h.handle()).toBeDefined());
  const capture = h.handle().capture();
  await waitFor(() => expect(engine.prepareTextDraft).toHaveBeenCalledWith("capture"));
  expect(engine.screenshotArgs).toBeNull();
  release(true);
  await capture;
});
it("rejects a pending text association before taking a screenshot and allows the next ready capture", async () => {
  const h = captureHarness();
  engine.drawingCommit.mockReturnValue(false);
  const { container } = render(<ReplayChart {...props({ onReady: h.onReady })} />);
  h.prepare(container);
  await waitFor(() => expect(h.handle()).toBeDefined());
  await expect(h.handle().capture()).rejects.toThrow("文字编辑或关联取点尚未完成");
  expect(engine.screenshotArgs).toBeNull();
  expect(engine.screenshotData).toEqual([]);
  expect(document.querySelector("[data-recall-capture]")).toBeNull();
  engine.drawingCommit.mockReturnValue(true);
  let result: Awaited<ReturnType<import("./replay-chart").ChartHandle["capture"]>> | undefined;
  await act(async () => { result = await h.handle().capture(); });
  expect(result?.imageDataUrl).toBe("data:image/png;base64,capture");
  expect(engine.screenshotArgs).toEqual([true, false]);
  expect(engine.drawingCommit).toHaveBeenCalledTimes(2);
  expect(document.querySelector("[data-recall-capture]")).toBeNull();
});
it('freezes data, drawings, range and source viewport before awaiting fonts',async()=>{
  const h=captureHarness();let ready!:()=>void;
  Object.defineProperty(document,'fonts',{configurable:true,value:{ready:new Promise<void>(resolve=>{ready=resolve;})}});
  const {container,rerender}=render(<ReplayChart {...props({onReady:h.onReady})}/>);h.prepare(container);
  await waitFor(()=>expect(h.handle()).toBeDefined());
  const source=h.handle().getViewport();const capture=h.handle().capture();
  rerender(<ReplayChart {...props({onReady:h.onReady,candles:[candle('2030-01-01')],currency:'CNY'})}/>);
  ready();const result=await capture;
  expect(engine.screenshotData.at(-1)?.map(c=>c.time)).toEqual(props().candles.map(c=>Date.parse(c.time)/1000));
  expect(result.viewport).toMatchObject({...source,imageFrame:{width:1280,height:720,pixelRatio:2}});
  expect(engine.priceRanges.at(-1)).toEqual({from:0,to:3});
  expect(document.querySelector('[data-recall-capture]')).toBeNull();
  Object.defineProperty(document,'fonts',{configurable:true,value:undefined});
});
it('commits an active Text state update before freezing its drawing revision',async()=>{
  const h=captureHarness();
  engine.drawingCommit.mockImplementation((p:{onCommand:(command:unknown)=>void})=>p.onCommand({type:'add',drawing:{id:'committed',text:'当前编辑文本',version:2,episodeId:'episode-1',tool:'text',placement:'canvas',canvasX:.1,canvasY:.1,anchors:[],style:{color:'#fff',opacity:1,lineWidth:1}}}));
  function Owner(){const [drawings,setDrawings]=useState<ComponentProps<typeof ReplayChart>['drawings']>([]);return <ReplayChart {...props({onReady:h.onReady,drawings,onCommand:c=>{if(c.type==='add')setDrawings([c.drawing]);}})}/>;}
  const {container}=render(<Owner/>);h.prepare(container);await waitFor(()=>expect(h.handle()).toBeDefined());
  await act(async()=>{await h.handle().capture();});
  expect(engine.paintedTexts).toEqual(['当前编辑文本']);expect(engine.drawingCommit).toHaveBeenCalledTimes(1);
});
it('passes the live Text expansion state into canonical capture',async()=>{
  const h=captureHarness();
  engine.expandedTextIds=['expanded-card'];
  const {container}=render(<ReplayChart {...props({onReady:h.onReady})}/>);h.prepare(container);await waitFor(()=>expect(h.handle()).toBeDefined());
  await act(async()=>{await h.handle().capture();});
  expect(engine.capturedExpandedTextIds).toEqual(['expanded-card']);
});
it('disposes the isolated renderer on PNG failure and leaves source viewport unchanged',async()=>{
  const h=captureHarness();const {container}=render(<ReplayChart {...props({onReady:h.onReady})}/>);h.prepare(container);await waitFor(()=>expect(h.handle()).toBeDefined());
  const source=h.handle().getViewport();vi.spyOn(HTMLCanvasElement.prototype,'toDataURL').mockImplementation(()=>{throw new Error('encoding failed');});
  await expect(h.handle().capture()).rejects.toThrow('encoding failed');
  expect(h.handle().getViewport()).toEqual(source);expect(engine.removed).toBe(1);expect(document.querySelector('[data-recall-capture]')).toBeNull();
});

it('rejects concurrent capture while retaining one frozen scene',async()=>{
  const h=captureHarness();let ready!:()=>void;
  Object.defineProperty(document,'fonts',{configurable:true,value:{ready:new Promise<void>(resolve=>{ready=resolve;})}});
  const {container}=render(<ReplayChart {...props({onReady:h.onReady})}/>);h.prepare(container);await waitFor(()=>expect(h.handle()).toBeDefined());
  const capture=h.handle().capture();await expect(h.handle().capture()).rejects.toThrow('图表截图正在进行');
  ready();await capture;expect(engine.drawingCommit).toHaveBeenCalledTimes(1);
  Object.defineProperty(document,'fonts',{configurable:true,value:undefined});
});

it('restores saved auto scale after the native explicit-range setter disables it',async()=>{
  const h=captureHarness();const {container}=render(<ReplayChart {...props({onReady:h.onReady})}/>);h.prepare(container);await waitFor(()=>expect(h.handle()).toBeDefined());
  const source=h.handle().getViewport();expect(source.priceScaleOptions?.autoScale).toBe(true);
  act(()=>h.handle().restoreViewport(source));
  expect(engine.priceRanges.at(-1)).toEqual(source.priceRange);expect(engine.autoScale).toBe(true);
  act(()=>h.handle().restoreViewport({...source,priceScaleOptions:{...source.priceScaleOptions!,autoScale:false}}));
  expect(engine.autoScale).toBe(false);
});

it("publishes drawing coordinates only after a restored price range is flushed", async () => {
  const h = captureHarness();
  engine.reconcileCoordinateOnScreenshot = true;
  const { container } = render(<ReplayChart {...props({ onReady: h.onReady })} />);
  h.prepare(container);
  await waitFor(() => expect(h.handle()).toBeDefined());
  const source = h.handle().getViewport();
  act(() => h.handle().restoreViewport(source));

  expect(engine.screenshotData.length).toBeGreaterThan(0);
  expect(engine.coordinateVersionSamples.at(-1)?.controlY).toBe(140);
});

it("repositions plan controls after scale movement, edits, and resize", async () => {
  stubResize();
  const { container, rerender } = render(<ReplayChart {...props({ planPriceLines: [{ id: "entry", title: "入场", price: 100 }] })}/>);
  const chart = container.querySelector(".lightweight-chart")!;
  Object.defineProperties(chart, { clientWidth: { configurable: true, value: 640 }, clientHeight: { configurable: true, value: 240 } });
  await waitFor(() => expect(engine.resizeCallbacks).toHaveLength(1));
  act(() => engine.resizeCallbacks[0]([], {} as ResizeObserver));
  const control = container.querySelector<HTMLButtonElement>('button[aria-label="入场 100，精确编辑"]')!;
  expect(control).toBeVisible();
  expect(control.style.top).toBe("60px");
  engine.controlY = 140;
  fireEvent.pointerMove(container.querySelector(".chart-stage")!);
  expect(control.style.top).toBe("100px");
  engine.controlY = 160;
  rerender(<ReplayChart {...props({ planPriceLines: [{ id: "entry", title: "入场", price: 110 }] })}/>);
  expect(control.style.top).toBe("120px");
  expect(control).toHaveAttribute("aria-label", "入场 110，精确编辑");
  Object.defineProperty(chart, "clientHeight", { configurable: true, value: 170 });
  act(() => engine.resizeCallbacks[0]([], {} as ResizeObserver));
  expect(control).not.toBeVisible();
  Object.defineProperty(chart, "clientHeight", { configurable: true, value: 300 });
  act(() => engine.resizeCallbacks[0]([], {} as ResizeObserver));
  const resizedControl = within(container).getByRole("button", { name: "入场 110，精确编辑" });
  expect(resizedControl).toBeVisible();
  expect(resizedControl.style.top).toBe("120px");
});

it("renders one outside hit target for an equal-price group while retaining every source id", async () => {
  stubResize();
  const view = render(<ReplayChart {...props({
    planPriceLines: [
      { id: "entry", price: 56, title: "计划入场", displayPrice: "56.0000" },
      { id: "cost", price: 56, title: "实际成本", displayPrice: "56.00" },
    ],
  })} />);
  await waitFor(() => expect(view.container.querySelectorAll("[data-plan-source-ids]")).toHaveLength(1));
  const group = view.container.querySelector("[data-plan-source-ids]")!;
  expect(group).toHaveAttribute("data-plan-source-ids", "entry,cost");
  expect(group.querySelector("[data-plan-axis-name]")).toHaveTextContent("计划入场 / 实际成本");
  expect(group.querySelector("[data-plan-axis-value]")).toHaveTextContent("56.0000 / 56.00");
  const semanticNameParts = [...group.querySelectorAll("[data-plan-axis-name] > span")];
  const semanticValueParts = [...group.querySelectorAll("[data-plan-axis-value] > span")];
  expect(semanticNameParts).toHaveLength(2);
  expect(semanticValueParts).toHaveLength(2);
  expect(semanticNameParts.map(part => (part as HTMLElement).style.color)).toEqual(["rgb(173, 187, 207)", "rgb(173, 187, 207)"]);
  expect(semanticValueParts.map(part => (part as HTMLElement).style.color)).toEqual(["rgb(173, 187, 207)", "rgb(173, 187, 207)"]);
});

it("keeps the in-plot dashed connector at each true price when outside rows are separated", async () => {
  stubResize();
  const view = render(<ReplayChart {...props({
    planPriceLines: [
      { id: "entry", price: 56, title: "计划入场", displayPrice: "56" },
      { id: "target", price: 56.0001, title: "止盈目标", displayPrice: "56.0001" },
    ],
  })} />);
  await waitFor(() => expect(view.container.querySelectorAll("[data-plan-axis-connectors] line").length).toBe(4));
  expect(view.container.querySelector("[data-plan-axis-connectors]"))
    .toHaveAttribute("data-plan-axis-connectors", "true");
});

it("keeps the revealed last candle when a height resize races the async range commit", async () => {
  engine.asyncRange = true;
  const width = 640;
  let height = 240;
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(() => width);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(() => height);
  let resizeCallback!: ResizeObserverCallback;
  vi.stubGlobal("ResizeObserver", class {
    constructor(callback: ResizeObserverCallback) {
      resizeCallback = callback;
      engine.resizeCallbacks.push(callback);
    }
    observe() {}
    disconnect() {}
  });
  const first = candle("2026-01-01T00:00:00Z");
  const second = candle("2026-01-02T00:00:00Z");
  const { rerender } = render(<ReplayChart {...props({
    candles: [first, second],
    viewportKey: "resize-reveal-race",
  })} />);
  await waitFor(() => expect(engine.data).toHaveLength(2));
  flushPendingRanges();
  act(() => resizeCallback([], {} as ResizeObserver));
  flushPendingRanges();
  engine.range = { from: -0.5, to: 1.5 };
  const third = candle("2026-01-03T00:00:00Z");
  const fourth = candle("2026-01-04T00:00:00Z");
  rerender(<ReplayChart {...props({
    candles: [first, second, third, fourth],
    viewportKey: "resize-reveal-race",
    revealRequest: { id: 1, time: fourth.time },
  })} />);
  height = 200;
  act(() => resizeCallback([], {} as ResizeObserver));
  flushPendingRanges();
  expect(engine.range).toEqual({ from: 1, to: 3 });
});

it("keeps a pending restored range authoritative during a same-frame width resize", async () => {
  engine.asyncRange = true;
  let width = 640;
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(() => width);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(240);
  let resizeCallback!: ResizeObserverCallback;
  vi.stubGlobal("ResizeObserver", class {
    constructor(callback: ResizeObserverCallback) {
      resizeCallback = callback;
      engine.resizeCallbacks.push(callback);
    }
    observe() {}
    disconnect() {}
  });
  const onReady = vi.fn();
  render(<ReplayChart {...props({ onReady, viewportKey: "resize-restore-race" })} />);
  await waitFor(() => expect(onReady).toHaveBeenCalledWith(expect.objectContaining({ restoreViewport: expect.any(Function) })));
  flushPendingRanges();
  act(() => resizeCallback([], {} as ResizeObserver));
  flushPendingRanges();
  engine.range = { from: 0, to: 2 };
  const handle = onReady.mock.calls.find(([value]) => value && typeof value.restoreViewport === "function")?.[0] as ChartHandle | undefined;
  if (!handle) throw new Error("chart handle not ready");
  width = 720;
  act(() => handle.restoreViewport({
    version: 1,
    logicalRange: { from: 1, to: 4 },
    barSpacing: 8,
    rightOffset: 4,
    width: 640,
    height: 240,
  }));
  act(() => resizeCallback([], {} as ResizeObserver));
  flushPendingRanges();
  expect(engine.range).toEqual({ from: 1, to: 4 });
});

it("does not refit over a persisted restore on the first usable resize", async () => {
  let resizeCallback!: ResizeObserverCallback;
  vi.stubGlobal("ResizeObserver", class {
    constructor(callback: ResizeObserverCallback) {
      resizeCallback = callback;
      engine.resizeCallbacks.push(callback);
    }
    observe(target: Element) {
      Object.defineProperties(target, {
        clientWidth: { configurable: true, value: 640 },
        clientHeight: { configurable: true, value: 240 },
      });
    }
    disconnect() {}
  });
  const onReady = vi.fn();
  render(<ReplayChart {...props({ onReady, viewportKey: "initial-restore-resize" })} />);
  await waitFor(() => expect(onReady).toHaveBeenCalledWith(expect.objectContaining({ restoreViewport: expect.any(Function) })));
  const fitCallsBeforeRestore = engine.fitCalls;
  const handle = onReady.mock.calls.find(([value]) => value && typeof value.restoreViewport === "function")?.[0] as ChartHandle | undefined;
  if (!handle) throw new Error("chart handle not ready");

  act(() => handle.restoreViewport({
    version: 1,
    logicalRange: { from: -22.8594, to: 29.1406 },
    barSpacing: 15.434,
    rightOffset: 4,
    width: 902,
    height: 450,
    priceRange: { from: 55.0836, to: 57.94 },
    priceScaleOptions: { mode: 0, invertScale: false, autoScale: true, scaleMargins: { top: 0.08, bottom: 0.2 } },
  }));
  engine.rangeChangeHandlers[0]?.();
  act(() => resizeCallback([], {} as ResizeObserver));

  expect(engine.fitCalls).toBe(fitCallsBeforeRestore);
  expect(engine.range).toEqual({ from: -22.8594, to: 29.1406 });
});

it("keeps a restored range through a delayed first resize and the SDK full paint", async () => {
  engine.modelResizeSemantics = true;
  let width = 902;
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(() => width);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(450);
  let resizeCallback!: ResizeObserverCallback;
  vi.stubGlobal("ResizeObserver", class {
    constructor(callback: ResizeObserverCallback) {
      resizeCallback = callback;
      engine.resizeCallbacks.push(callback);
    }
    observe() {}
    disconnect() {}
  });
  const onReady = vi.fn();
  render(<ReplayChart {...props({ onReady, viewportKey: "delayed-sdk-resize" })} />);
  await waitFor(() => expect(onReady).toHaveBeenCalledWith(expect.objectContaining({ restoreViewport: expect.any(Function) })));
  expect((engine.options?.timeScale as { lockVisibleTimeRangeOnResize?: boolean }).lockVisibleTimeRangeOnResize).toBe(true);
  const handle = onReady.mock.calls.find(([value]) => value && typeof value.restoreViewport === "function")?.[0] as ChartHandle;
  const savedRange = { from: -22.8594, to: 29.1406 };

  act(() => handle.restoreViewport({
    version: 1,
    logicalRange: savedRange,
    barSpacing: 15.434,
    rightOffset: 4,
    width: 902,
    height: 450,
  }));
  // The restore paint has completed and its pending range notification was
  // consumed before the late first ResizeObserver delivery.
  engine.rangeChangeHandlers[0]?.();
  width = 842;
  act(() => resizeCallback([], {} as ResizeObserver));
  paintPendingSdkResize();

  expect(engine.range).toEqual(savedRange);
});

it("keeps SDK-only axis width changes stable, returns to the original width, and respects a user pan", async () => {
  engine.modelResizeSemantics = true;
  stubResize(902, 450);
  const onReady = vi.fn();
  render(<ReplayChart {...props({ onReady, viewportKey: "sdk-only-resize" })} />);
  await waitFor(() => expect(onReady).toHaveBeenCalledWith(expect.objectContaining({ restoreViewport: expect.any(Function) })));
  const handle = onReady.mock.calls.find(([value]) => value && typeof value.restoreViewport === "function")?.[0] as ChartHandle;
  const savedRange = { from: -10, to: 30 };
  act(() => handle.restoreViewport({
    version: 1,
    logicalRange: savedRange,
    barSpacing: 12,
    rightOffset: 4,
    width: 902,
    height: 450,
  }));
  engine.rangeChangeHandlers[0]?.();

  engine.pendingSdkPlotWidth = 778;
  paintPendingSdkResize();
  expect(engine.range).toEqual(savedRange);
  engine.pendingSdkPlotWidth = 902 - 84;
  paintPendingSdkResize();
  expect(engine.range).toEqual(savedRange);

  // A later user pan is authoritative; a resize must not replay the saved
  // restore range over it.
  engine.range = { from: 4, to: 24 };
  engine.rangeChangeHandlers[0]?.();
  engine.pendingSdkPlotWidth = 850;
  paintPendingSdkResize();
  expect(engine.range).toEqual({ from: 4, to: 24 });
});

it("lets reveal override a pending data-preservation range after setData shifts the getter", async () => {
  engine.asyncRange = true;
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  const initialCandles = Array.from({ length: 61 }, (_, index) =>
    candle(new Date(Date.UTC(2026, 0, index + 1)).toISOString()),
  );
  const finalCandle = candle(new Date(Date.UTC(2026, 2, 3)).toISOString());
  const { rerender } = render(<ReplayChart {...props({
    candles: initialCandles,
    viewportKey: "set-data-reveal-race",
  })} />);
  await waitFor(() => expect(engine.data).toHaveLength(initialCandles.length));
  flushPendingRanges();
  engine.range = { from: 27, to: 60 };
  engine.setDataRangeShift = { from: 28, to: 61 };
  const nextCandles = [...initialCandles, finalCandle];
  rerender(<ReplayChart {...props({
    candles: nextCandles,
    viewportKey: "set-data-reveal-race",
    revealRequest: { id: 1, time: finalCandle.time },
  })} />);
  flushPendingRanges();
  expect(engine.range).toEqual({ from: 28, to: 61 });
});

it("reapplies a stable range on a width-only resize when no range is pending", async () => {
  engine.asyncRange = true;
  let width = 640;
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(() => width);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(240);
  let resizeCallback!: ResizeObserverCallback;
  vi.stubGlobal("ResizeObserver", class {
    constructor(callback: ResizeObserverCallback) {
      resizeCallback = callback;
      engine.resizeCallbacks.push(callback);
    }
    observe() {}
    disconnect() {}
  });
  render(<ReplayChart {...props({ viewportKey: "resize-stable-range" })} />);
  await waitFor(() => expect(engine.data).toHaveLength(2));
  flushPendingRanges();
  act(() => resizeCallback([], {} as ResizeObserver));
  flushPendingRanges();
  engine.range = { from: 0.25, to: 1.25 };
  engine.applyOptionsRangeMutation = { from: -4, to: -3 };
  width = 720;
  act(() => resizeCallback([], {} as ResizeObserver));
  flushPendingRanges();
  expect(engine.range).toEqual({ from: 0.25, to: 1.25 });
});

it("detaches chart primitives before removing the chart", async () => {
  stubResize();
  const view = render(<ReplayChart {...props({ viewportKey: "dispose-order" })} />);
  await waitFor(() => expect(engine.options).not.toBeNull());

  view.unmount();

  for (const frame of engine.deferredLifecycleFrames.splice(0)) frame();
  expect(engine.lifecycleErrors).toEqual([]);
  expect(engine.lifecycleCalls).toEqual(["detach", "remove"]);
});

it("ignores a resize delivery queued after chart cleanup", async () => {
  stubResize();
  const view = render(<ReplayChart {...props({ viewportKey: "dispose-resize" })} />);
  await waitFor(() => expect(engine.options).not.toBeNull());
  const resizeCallback = engine.resizeCallbacks[0];
  const appliedBeforeCleanup = engine.appliedSizes.length;

  view.unmount();
  resizeCallback([], {} as ResizeObserver);

  expect(engine.appliedSizes).toHaveLength(appliedBeforeCleanup);
});

it("does not let a queued range notification read a removed chart", async () => {
  engine.asyncRange = true;
  stubResize();
  const onReady = vi.fn();
  const view = render(<ReplayChart {...props({ onReady, viewportKey: "dispose-range" })} />);
  await waitFor(() => expect(onReady).toHaveBeenCalledWith(expect.objectContaining({ restoreViewport: expect.any(Function) })));
  await waitFor(() => expect(engine.rangeChangeHandlers.length).toBeGreaterThan(0));
  const handle = onReady.mock.calls.find(([value]) => value && typeof value.restoreViewport === "function")?.[0] as ChartHandle | undefined;
  if (!handle) throw new Error("chart handle not ready");
  act(() => handle.restoreViewport({
    version: 1,
    logicalRange: { from: 1, to: 4 },
    barSpacing: 8,
    rightOffset: 4,
    width: 640,
    height: 240,
  }));
  engine.rangeReadsAfterRemove = 0;

  engine.rangeChangeHandlers[0]();
  view.unmount();
  await Promise.resolve();

  expect(engine.rangeReadsAfterRemove).toBe(0);
});

it("does not publish a stale handle while Activity hides and shows the chart", async () => {
  stubResize();
  const onReady = vi.fn((handle: ChartHandle | null) => {
    if (handle) handle.getViewport();
  });
  const view = render(<Activity mode="visible"><ReplayChart {...props({ onReady })} /></Activity>);
  await waitFor(() => expect(onReady).toHaveBeenCalledWith(expect.objectContaining({ getViewport: expect.any(Function) })));
  await waitFor(() => expect(engine.setDataCalls.length).toBeGreaterThan(0));
  const firstSetDataCallCount = engine.setDataCalls.length;
  const firstChartInstance = engine.setDataCalls[0].instance;
  engine.data = [];
  engine.range = { from: 2, to: 6 };
  engine.priceRange = { from: 52, to: 68 };
  engine.resetPriceRangeOnCreate = true;
  engine.resetRangeOnCreate = true;
  expect(() => view.rerender(<Activity mode="hidden"><ReplayChart {...props({ onReady })} /></Activity>)).not.toThrow();
  expect(() => view.rerender(<Activity mode="visible"><ReplayChart {...props({ onReady })} /></Activity>)).not.toThrow();
  await waitFor(() => expect(onReady.mock.calls.filter(([value]) => value !== null)).toHaveLength(2));
  const handles = onReady.mock.calls.flatMap(([value]) => value ? [value] : []);
  expect(handles[1]).not.toBe(handles[0]);
  expect(() => handles[1]?.getViewport()).not.toThrow();
  await waitFor(() => expect(engine.setDataCalls.length).toBeGreaterThan(firstSetDataCallCount));
  const rebuiltSetDataCalls = engine.setDataCalls.slice(firstSetDataCallCount);
  expect(rebuiltSetDataCalls.some((call) => call.instance !== firstChartInstance)).toBe(true);
  const rebuiltData = rebuiltSetDataCalls.at(-1)?.data;
  expect(rebuiltData).toHaveLength(2);
  expect(rebuiltData?.[0]?.time).toBe(Date.parse("2026-01-01T00:00:00Z") / 1000);
  expect(rebuiltData?.at(-1)?.time).toBe(Date.parse("2026-01-02T00:00:00Z") / 1000);
  await waitFor(() => expect(engine.range).toEqual({ from: 2, to: 6 }));
  await waitFor(() => expect(engine.priceRange).toEqual({ from: 52, to: 68 }));
  expect(engine.priceRangeCalls.some((call) => call.instance !== firstChartInstance && call.range.from === 52 && call.range.to === 68)).toBe(true);
});
